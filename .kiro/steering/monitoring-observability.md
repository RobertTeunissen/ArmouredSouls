---
inclusion: always
---

# Monitoring and Observability

## Monitoring Strategy

### What to Monitor

**Application Metrics**:
- Request rate (requests per second)
- Response times (p50, p95, p99)
- Error rates (4xx, 5xx)
- Active connections
- Memory usage
- CPU usage

**Business Metrics**:
- User registrations
- Active users
- Battles executed
- Credits transactions
- Cycle completion time
- Robot creation rate

**Infrastructure Metrics**:
- Database connection pool usage
- Database query performance
- Disk space
- Network I/O
- Container/process health

## Logging

### Log Levels

**Use Appropriate Levels**:
- **DEBUG**: Development only, detailed diagnostics
- **INFO**: Normal operations, significant events
- **WARN**: Recoverable issues, degraded performance
- **ERROR**: Failed operations, exceptions
- **FATAL**: Critical failures, application cannot continue

### Structured Logging

**JSON Format**:
```typescript
logger.info('Battle completed', {
  battleId: 123,
  robot1Id: 456,
  robot2Id: 789,
  winnerId: 456,
  duration: 1250,
  timestamp: new Date().toISOString()
});
```

### Log Aggregation

**Centralized Logging**:
- Collect logs from all services
- Store in searchable format
- Retain for 90 days
- Index by timestamp, level, service

**Log Locations**:
- Backend: PM2 logs (`pm2 logs armouredsouls-backend`)
- Database: Docker logs (`docker logs armouredsouls-db-prod`)
- Caddy: System logs (`journalctl -u caddy`)
- Backups: `/var/log/armouredsouls/backup.log`

## Health Checks

### Application Health Endpoint

**Implementation**:
```typescript
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
});
```

### Monitoring Health Checks

**Automated Checks**:
```bash
# Check every 5 minutes
*/5 * * * * curl -f http://localhost:3001/api/health || echo "Health check failed"
```

## Performance Monitoring

### Response Time Tracking

**Middleware for Timing**:
```typescript
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      userAgent: req.headers['user-agent']
    });
    
    if (duration > 2000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration
      });
    }
  });
  
  next();
});
```

### Database Query Performance

**Slow Query Logging**:
```typescript
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const duration = Date.now() - before;
  
  if (duration > 1000) {
    logger.warn('Slow database query', {
      model: params.model,
      action: params.action,
      duration,
      threshold: 1000
    });
  }
  
  return result;
});
```

## Error Tracking

### Error Monitoring

**Track All Errors**:
```typescript
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});
```

### Error Aggregation

**Group Similar Errors**:
- Track error frequency
- Identify error patterns
- Alert on error rate spikes
- Link errors to deployments

## Alerting

### Alert Thresholds

**Critical Alerts** (immediate notification):
- Application down (health check fails)
- Database connection lost
- Error rate > 10%
- Disk space < 10%
- Memory usage > 90%

**Warning Alerts** (hourly digest):
- Error rate > 5%
- Response time p95 > 2s
- Slow queries increasing
- Memory usage > 80%

**Info Alerts** (daily digest):
- Error rate > 1%
- Unusual traffic patterns
- Backup failures
- Certificate expiration warnings

### Alert Channels

**Notification Methods**:
- Email for critical alerts
- Slack/Discord for warnings
- Dashboard for info alerts
- SMS for production outages (future)

## Metrics Collection

### Application Metrics

**Track Key Metrics**:
```typescript
const metrics = {
  requests: {
    total: 0,
    success: 0,
    errors: 0
  },
  responseTimes: [],
  activeConnections: 0
};

// Increment on each request
app.use((req, res, next) => {
  metrics.requests.total++;
  metrics.activeConnections++;
  
  res.on('finish', () => {
    metrics.activeConnections--;
    if (res.statusCode < 400) {
      metrics.requests.success++;
    } else {
      metrics.requests.errors++;
    }
  });
  
  next();
});

// Expose metrics endpoint
app.get('/api/metrics', (req, res) => {
  res.json({
    ...metrics,
    errorRate: metrics.requests.errors / metrics.requests.total,
    avgResponseTime: metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length
  });
});
```

### Business Metrics

**Track Game Metrics**:
```typescript
const gameMetrics = {
  battlesExecuted: 0,
  robotsCreated: 0,
  creditsTransacted: 0,
  activeUsers: new Set()
};

// Update on relevant events
eventEmitter.on('battleCompleted', () => {
  gameMetrics.battlesExecuted++;
});

eventEmitter.on('robotCreated', () => {
  gameMetrics.robotsCreated++;
});
```

## Dashboard

### Metrics Dashboard

**Key Metrics to Display**:
- Request rate (last hour)
- Error rate (last hour)
- Response time percentiles
- Active users
- Database connection pool usage
- Memory and CPU usage
- Recent errors

### Implementation Options

**Simple Dashboard**:
```typescript
app.get('/api/dashboard', async (req, res) => {
  const [
    totalUsers,
    totalRobots,
    totalBattles,
    recentErrors
  ] = await Promise.all([
    prisma.user.count(),
    prisma.robot.count(),
    prisma.battle.count(),
    getRecentErrors()
  ]);
  
  res.json({
    users: totalUsers,
    robots: totalRobots,
    battles: totalBattles,
    errors: recentErrors,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

## Tracing

### Request Tracing

**Track Request Flow**:
```typescript
import { v4 as uuidv4 } from 'uuid';

app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  
  logger.info('Request started', {
    requestId: req.id,
    method: req.method,
    path: req.path
  });
  
  next();
});
```

### Distributed Tracing

**Track Across Services** (future):
- Use correlation IDs
- Track request through multiple services
- Identify bottlenecks in request flow
- Visualize service dependencies

## Performance Profiling

### CPU Profiling

**Identify Performance Bottlenecks**:
```bash
# Using Node.js built-in profiler
node --prof dist/index.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

### Memory Profiling

**Detect Memory Leaks**:
```typescript
// Log memory usage periodically
setInterval(() => {
  const usage = process.memoryUsage();
  logger.info('Memory usage', {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB'
  });
}, 60000); // Every minute
```

## Monitoring Tools

### Recommended Tools

**Open Source**:
- **Prometheus**: Metrics collection
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation
- **Jaeger**: Distributed tracing

**Commercial** (future consideration):
- **Datadog**: All-in-one APM
- **New Relic**: Application monitoring
- **Sentry**: Error tracking
- **LogRocket**: Session replay

## Incident Response

### When Alerts Fire

**Response Process**:
1. **Acknowledge**: Confirm alert received
2. **Assess**: Determine severity and impact
3. **Investigate**: Check logs, metrics, recent changes
4. **Mitigate**: Take action to restore service
5. **Communicate**: Update stakeholders
6. **Resolve**: Fix root cause
7. **Document**: Post-mortem for major incidents

### Runbooks

**Common Scenarios**:
- Database connection failures
- High error rates
- Slow response times
- Disk space issues
- Memory leaks

## Checklist

### Monitoring Setup
- [ ] Health check endpoint implemented
- [ ] Structured logging configured
- [ ] Error tracking enabled
- [ ] Performance monitoring active
- [ ] Alert thresholds defined
- [ ] Alert channels configured

### Regular Monitoring Tasks
- [ ] Review error logs daily
- [ ] Check performance metrics weekly
- [ ] Analyze slow queries weekly
- [ ] Review alert thresholds monthly
- [ ] Test alert notifications monthly
- [ ] Update runbooks quarterly

### Incident Response
- [ ] Runbooks documented
- [ ] On-call rotation defined
- [ ] Escalation procedures clear
- [ ] Communication channels established
- [ ] Post-mortem template ready
