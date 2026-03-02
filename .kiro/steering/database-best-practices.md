---
inclusion: always
---

# Database Best Practices

## Schema Design Principles

### Normalization
- Eliminate data redundancy
- Use foreign keys for relationships
- Separate concerns into appropriate tables
- Balance normalization with query performance

### Naming Conventions
- **Tables**: snake_case, plural (e.g., `robots`, `battle_participants`)
- **Columns**: snake_case (e.g., `user_id`, `created_at`)
- **Primary keys**: `id` (auto-increment integer)
- **Foreign keys**: `{table}_id` (e.g., `user_id`, `robot_id`)
- **Timestamps**: `created_at`, `updated_at`
- **Booleans**: `is_active`, `has_premium`

### Data Types
- Use appropriate types for data
- `INT` for IDs and counts
- `DECIMAL` for currency and precise numbers
- `VARCHAR` with appropriate length for strings
- `TEXT` for long content
- `TIMESTAMP` for dates/times
- `BOOLEAN` for true/false values

## Prisma Schema Standards

### Model Definition
```prisma
model Robot {
  id        Int      @id @default(autoincrement())
  userId    Int
  name      String   @db.VarChar(100)
  armor     Decimal  @db.Decimal(10, 2)
  speed     Decimal  @db.Decimal(10, 2)
  elo       Int      @default(1500)
  credits   Decimal  @db.Decimal(15, 2) @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  battles   Battle[]
  weapons   WeaponInventory[]
  
  // Indexes
  @@index([userId])
  @@index([elo])
  @@index([userId, elo])
}
```

### Relationship Patterns

**One-to-Many**:
```prisma
model User {
  id     Int     @id @default(autoincrement())
  robots Robot[]
}

model Robot {
  id     Int  @id @default(autoincrement())
  userId Int
  user   User @relation(fields: [userId], references: [id])
  
  @@index([userId])
}
```

**Many-to-Many**:
```prisma
model Robot {
  id      Int               @id @default(autoincrement())
  weapons WeaponInventory[]
}

model Weapon {
  id        Int               @id @default(autoincrement())
  inventory WeaponInventory[]
}

model WeaponInventory {
  id       Int    @id @default(autoincrement())
  robotId  Int
  weaponId Int
  quantity Int    @default(1)
  
  robot  Robot  @relation(fields: [robotId], references: [id])
  weapon Weapon @relation(fields: [weaponId], references: [id])
  
  @@unique([robotId, weaponId])
  @@index([robotId])
  @@index([weaponId])
}
```

## Query Optimization

### Use Indexes Strategically

**When to Add Indexes**:
- Foreign key columns
- Columns in WHERE clauses
- Columns in ORDER BY clauses
- Columns in JOIN conditions
- Frequently queried columns

**Index Examples**:
```prisma
model Battle {
  id        Int      @id @default(autoincrement())
  robot1Id  Int
  robot2Id  Int
  winnerId  Int?
  createdAt DateTime @default(now())
  
  @@index([robot1Id])
  @@index([robot2Id])
  @@index([winnerId])
  @@index([createdAt])
  @@index([robot1Id, createdAt]) // Composite index
}
```

### Avoid N+1 Queries

**Bad - N+1 Problem**:
```typescript
// Fetches users, then queries robots for each user
const users = await prisma.user.findMany();
for (const user of users) {
  const robots = await prisma.robot.findMany({
    where: { userId: user.id }
  });
}
```

**Good - Single Query**:
```typescript
const users = await prisma.user.findMany({
  include: {
    robots: true
  }
});
```

### Select Only Needed Fields

**Bad - Fetches All Fields**:
```typescript
const users = await prisma.user.findMany();
```

**Good - Select Specific Fields**:
```typescript
const users = await prisma.user.findMany({
  select: {
    id: true,
    username: true,
    credits: true
  }
});
```

### Use Pagination

**Always Paginate Large Results**:
```typescript
const robots = await prisma.robot.findMany({
  take: 20,
  skip: (page - 1) * 20,
  orderBy: { createdAt: 'desc' }
});

const total = await prisma.robot.count();

return {
  data: robots,
  pagination: {
    page,
    pageSize: 20,
    total,
    totalPages: Math.ceil(total / 20)
  }
};
```

## Transaction Management

### When to Use Transactions

**Use Transactions For**:
- Multiple related database operations
- Operations that must succeed or fail together
- Maintaining data consistency
- Financial transactions

**Transaction Example**:
```typescript
await prisma.$transaction(async (tx) => {
  // Deduct credits from buyer
  await tx.user.update({
    where: { id: buyerId },
    data: { credits: { decrement: weaponCost } }
  });
  
  // Add weapon to inventory
  await tx.weaponInventory.create({
    data: {
      robotId,
      weaponId,
      quantity: 1
    }
  });
  
  // Log transaction
  await tx.transaction.create({
    data: {
      userId: buyerId,
      type: 'WEAPON_PURCHASE',
      amount: -weaponCost
    }
  });
});
```

### Transaction Best Practices

**Do's**:
- Keep transactions short
- Only include necessary operations
- Handle errors appropriately
- Use appropriate isolation level

**Don'ts**:
- Don't include external API calls in transactions
- Don't perform complex calculations in transactions
- Don't hold transactions open for user input
- Don't nest transactions unnecessarily

## Connection Pooling

### Configure Connection Limits

**In DATABASE_URL**:
```
postgresql://user:password@localhost:5432/db?connection_limit=10
```

**Environment-Specific Limits**:
- Development: 5-10 connections
- Acceptance: 10-20 connections
- Production: 20-50 connections (based on VPS resources)

### Connection Pool Best Practices

**Monitor Connection Usage**:
```typescript
// Log connection pool metrics
setInterval(() => {
  const metrics = prisma.$metrics.json();
  logger.info('Connection pool metrics', metrics);
}, 60000); // Every minute
```

## Data Integrity

### Constraints

**Use Database Constraints**:
```prisma
model User {
  id       Int    @id @default(autoincrement())
  username String @unique @db.VarChar(50)
  email    String @unique @db.VarChar(255)
  credits  Decimal @db.Decimal(15, 2) @default(0)
  
  @@index([username])
  @@index([email])
}

model Robot {
  id     Int     @id @default(autoincrement())
  userId Int
  name   String  @db.VarChar(100)
  armor  Decimal @db.Decimal(10, 2)
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, name]) // Unique robot name per user
}
```

### Cascade Deletes

**Configure Cascade Behavior**:
```prisma
model User {
  id     Int     @id @default(autoincrement())
  robots Robot[]
}

model Robot {
  id     Int  @id @default(autoincrement())
  userId Int
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // When user is deleted, all their robots are deleted
}
```

## Migrations

### Migration Best Practices

**Before Creating Migration**:
1. Review schema changes carefully
2. Consider impact on existing data
3. Plan for data migration if needed
4. Test migration on development database

**Create Migration**:
```bash
cd prototype/backend
npx prisma migrate dev --name add_robot_image_url
```

**Migration Naming**:
- Use descriptive names
- Use snake_case
- Include action and target
- Examples: `add_robot_image_url`, `remove_old_battle_fields`, `create_tournament_table`

### Data Migrations

**Migrate Existing Data**:
```typescript
// In migration script or separate data migration
await prisma.$executeRaw`
  UPDATE robots
  SET image_url = CONCAT('https://example.com/robots/', id, '.png')
  WHERE image_url IS NULL
`;
```

### Rollback Strategy

**Always Have Rollback Plan**:
1. Backup database before migration
2. Test rollback procedure
3. Document rollback steps
4. Keep previous migration available

## Performance Monitoring

### Slow Query Logging

**Log Slow Queries**:
```typescript
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  const duration = after - before;
  
  if (duration > 1000) {
    logger.warn('Slow query detected', {
      model: params.model,
      action: params.action,
      duration,
      args: params.args
    });
  }
  
  return result;
});
```

### Query Analysis

**Use EXPLAIN for Complex Queries**:
```sql
EXPLAIN ANALYZE
SELECT r.*, u.username
FROM robots r
JOIN users u ON r.user_id = u.id
WHERE r.elo > 1500
ORDER BY r.elo DESC
LIMIT 20;
```

## Backup and Recovery

### Backup Strategy

**Automated Backups**:
- Daily backups at 2 AM (configured in cron)
- Retain backups for 30 days
- Store backups in `/opt/armouredsouls/backups/`
- Test restore procedure monthly

**Manual Backup**:
```bash
ssh deploy@VPS_IP
/opt/armouredsouls/scripts/backup.sh
```

### Restore Procedure

**Restore from Backup**:
```bash
ssh deploy@VPS_IP
/opt/armouredsouls/scripts/restore.sh /opt/armouredsouls/backups/backup-2026-03-02.sql.gz
```

## Security

### SQL Injection Prevention

**Always Use Parameterized Queries**:
```typescript
// GOOD - Prisma handles parameterization
const user = await prisma.user.findUnique({
  where: { username: userInput }
});

// BAD - Never use raw SQL with user input
const user = await prisma.$queryRaw`
  SELECT * FROM users WHERE username = '${userInput}'
`;

// GOOD - Use parameterized raw queries if needed
const user = await prisma.$queryRaw`
  SELECT * FROM users WHERE username = ${userInput}
`;
```

### Sensitive Data

**Encrypt Sensitive Data**:
- Never store passwords in plain text (use bcrypt)
- Encrypt sensitive personal information
- Use environment variables for credentials
- Rotate database passwords periodically

## Checklist

### Before Schema Changes
- [ ] Reviewed impact on existing data
- [ ] Planned data migration if needed
- [ ] Added appropriate indexes
- [ ] Configured cascade behavior
- [ ] Tested on development database
- [ ] Updated DATABASE_SCHEMA.md documentation

### Query Optimization
- [ ] Used indexes on queried columns
- [ ] Avoided N+1 queries
- [ ] Selected only needed fields
- [ ] Implemented pagination for large results
- [ ] Used transactions where appropriate
- [ ] Tested query performance

### Before Deployment
- [ ] Backed up production database
- [ ] Tested migration on staging
- [ ] Documented rollback procedure
- [ ] Verified connection pool settings
- [ ] Enabled slow query logging
