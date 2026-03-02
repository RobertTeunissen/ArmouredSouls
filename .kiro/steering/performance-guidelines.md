---
inclusion: always
---

# Performance Guidelines

## Performance Targets

### API Response Times
- **Fast endpoints** (< 100ms): Health checks, static data
- **Standard endpoints** (< 500ms): CRUD operations, simple queries
- **Complex endpoints** (< 2s): Battle calculations, matchmaking, reports
- **Background jobs** (< 30s): Cycle processing, batch operations

### Database Query Performance
- **Simple queries** (< 50ms): Single table lookups by primary key
- **Join queries** (< 200ms): Multi-table joins with proper indexes
- **Aggregation queries** (< 500ms): COUNT, SUM, AVG operations
- **Complex queries** (< 1s): Multiple joins with aggregations

### Frontend Performance
- **First Contentful Paint** (< 1.5s): Initial page render
- **Time to Interactive** (< 3s): Page fully interactive
- **Bundle size** (< 500KB): JavaScript bundle (gzipped)
- **API calls per page** (< 10): Minimize network requests

## Performance Optimization Strategy

### When to Optimize
1. **Measure first** - Use profiling tools before optimizing
2. **Identify bottlenecks** - Focus on slowest operations
3. **Set targets** - Define acceptable performance thresholds
4. **Optimize** - Implement improvements
5. **Measure again** - Verify improvements

### When NOT to Optimize
- Premature optimization before measuring
- Code that runs infrequently
- Operations already meeting targets
- Micro-optimizations with negligible impact


## Database Performance

### Query Optimization

**Use Indexes Effectively**:
```sql
-- Good: Uses index on userId
SELECT * FROM robots WHERE userId = 123;

-- Bad: Full table scan
SELECT * FROM robots WHERE LOWER(name) = 'destroyer';

-- Good: Index on name column
SELECT * FROM robots WHERE name = 'Destroyer';
```

**Avoid N+1 Queries**:
```typescript
// BAD - N+1 query problem
const users = await prisma.user.findMany();
for (const user of users) {
  const robots = await prisma.robot.findMany({ where: { userId: user.id } });
}

// GOOD - Single query with include
const users = await prisma.user.findMany({
  include: { robots: true }
});
```

**Use Pagination**:
```typescript
// Always paginate large result sets
const robots = await prisma.robot.findMany({
  take: 20,
  skip: page * 20,
  orderBy: { createdAt: 'desc' }
});
```

**Select Only Needed Fields**:
```typescript
// BAD - Fetches all fields
const users = await prisma.user.findMany();

// GOOD - Only needed fields
const users = await prisma.user.findMany({
  select: { id: true, username: true, credits: true }
});
```

### Index Strategy

**Create Indexes For**:
- Foreign keys (userId, robotId, etc.)
- Frequently queried columns (username, email)
- Columns used in WHERE clauses
- Columns used in ORDER BY
- Composite indexes for multi-column queries

**Index Examples**:
```prisma
model Robot {
  id        Int      @id @default(autoincrement())
  userId    Int
  name      String
  elo       Int
  createdAt DateTime @default(now())
  
  @@index([userId])
  @@index([elo])
  @@index([userId, elo])
  @@index([createdAt])
}
```


### Connection Pooling

**Configure Prisma Connection Pool**:
```typescript
// In DATABASE_URL
postgresql://user:password@localhost:5432/db?connection_limit=10

// Adjust based on environment
// Development: 5-10 connections
// Production: 20-50 connections (depends on VPS resources)
```

### Transaction Best Practices

**Keep Transactions Short**:
```typescript
// GOOD - Minimal transaction scope
await prisma.$transaction(async (tx) => {
  await tx.user.update({ where: { id }, data: { credits: newCredits } });
  await tx.transaction.create({ data: transactionData });
});

// BAD - Long-running transaction
await prisma.$transaction(async (tx) => {
  // Complex calculations
  // External API calls
  // Multiple unrelated operations
});
```

## API Performance

### Response Caching

**Cache Static Data**:
```typescript
// Cache weapon definitions (rarely change)
const weaponCache = new Map();

async function getWeapons() {
  if (weaponCache.has('weapons')) {
    return weaponCache.get('weapons');
  }
  
  const weapons = await prisma.weapon.findMany();
  weaponCache.set('weapons', weapons);
  return weapons;
}
```

**Cache with TTL**:
```typescript
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  
  set(key: string, data: T, ttlMs: number) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs
    });
  }
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
}
```


### Rate Limiting

**Protect Expensive Endpoints**:
```typescript
import rateLimit from 'express-rate-limit';

// Battle execution (expensive)
const battleLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many battle requests'
});

app.post('/api/battles/execute', battleLimiter, battleHandler);
```

### Async Processing

**Use Background Jobs for Heavy Operations**:
```typescript
// Don't block API response
app.post('/api/cycles/run', async (req, res) => {
  // Queue job instead of processing immediately
  await jobQueue.add('runCycle', { cycleId: req.body.cycleId });
  
  res.json({ success: true, message: 'Cycle queued' });
});

// Process in background
jobQueue.process('runCycle', async (job) => {
  await executeCycle(job.data.cycleId);
});
```

## Frontend Performance

### Code Splitting

**Lazy Load Routes**:
```typescript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const BattleHistory = lazy(() => import('./pages/BattleHistory'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/battles" element={<BattleHistory />} />
      </Routes>
    </Suspense>
  );
}
```

### Memoization

**Prevent Unnecessary Re-renders**:
```typescript
import { memo, useMemo, useCallback } from 'react';

const RobotCard = memo(({ robot }) => {
  return <div>{robot.name}</div>;
});

function RobotList({ robots }) {
  const sortedRobots = useMemo(
    () => robots.sort((a, b) => b.elo - a.elo),
    [robots]
  );
  
  const handleClick = useCallback((robotId) => {
    // Handle click
  }, []);
  
  return sortedRobots.map(robot => (
    <RobotCard key={robot.id} robot={robot} onClick={handleClick} />
  ));
}
```


### Image Optimization

**Optimize Images**:
- Use WebP format when possible
- Compress images before upload
- Use appropriate dimensions (don't load 4K for thumbnails)
- Implement lazy loading for images below fold

### Bundle Optimization

**Reduce Bundle Size**:
```typescript
// Use tree-shaking friendly imports
import { useState } from 'react'; // Good
import React from 'react'; // Avoid

// Dynamic imports for large libraries
const Chart = lazy(() => import('chart.js'));
```

## Monitoring Performance

### Performance Metrics to Track

**Backend Metrics**:
- API response times (p50, p95, p99)
- Database query duration
- Error rates
- Request throughput
- Memory usage
- CPU usage

**Frontend Metrics**:
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Cumulative Layout Shift (CLS)
- First Input Delay (FID)

### Performance Logging

**Log Slow Operations**:
```typescript
async function performOperation() {
  const start = Date.now();
  try {
    const result = await expensiveOperation();
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      logger.warn('Slow operation', {
        operation: 'expensiveOperation',
        duration,
        threshold: 1000
      });
    }
    
    return result;
  } catch (error) {
    logger.error('Operation failed', { error, duration: Date.now() - start });
    throw error;
  }
}
```

## Performance Testing

### Load Testing

**Test Critical Endpoints**:
```bash
# Using Apache Bench
ab -n 1000 -c 10 http://localhost:3001/api/battles

# Using Artillery
artillery quick --count 100 --num 10 http://localhost:3001/api/battles
```

### Database Query Analysis

**Use EXPLAIN to Analyze Queries**:
```sql
EXPLAIN ANALYZE
SELECT * FROM robots 
WHERE userId = 123 
ORDER BY elo DESC 
LIMIT 20;
```

## Performance Checklist

### Before Committing
- [ ] No unnecessary database queries
- [ ] Proper indexes on queried columns
- [ ] Pagination implemented for large datasets
- [ ] No N+1 query problems
- [ ] Expensive operations cached when appropriate

### Before Deploying
- [ ] Performance targets met for critical endpoints
- [ ] Slow query logging enabled
- [ ] Performance monitoring configured
- [ ] Load testing completed for new features
- [ ] Bundle size within acceptable limits
