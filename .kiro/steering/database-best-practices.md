---
inclusion: fileMatch
fileMatchPattern: "**/prisma/**,**/schema.prisma,**/migrations/**,**/db/**,**/database/**,**/*migration*"
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
  currency  Decimal  @db.Decimal(15, 2) @default(0)
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
    currency: true
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
**Current-economy Credits example (Spec #53):** Do not update `User.currency` directly or create an ad-hoc transaction row. Within the enclosing interactive transaction, call `Credit_Mutation_Service` with the signed amount, one of the closed `Transaction_Taxonomy` values, a durable `financialEventId`, and validated `Financial_Breakdown`; it locks and re-reads `User.currency` and atomically writes the balance, `FinancialLedger`, and paired `AuditLog` `financial_transaction` record. Create the inventory row in the same transaction.

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

### Financial mutation persistence contract (Spec #53)

The post-cutover financial path uses `User.currency` as the only mutable Credits balance. A `Credit_Mutation_Service` operation must keep the balance update, the `FinancialLedger` insert, and the paired `AuditLog` insert inside one interactive transaction. Lock and re-read the user row before applying a racing mutation, allocate the audit `sequenceNumber` with `withAuditSequence`, and commit only after both immutable records exist. If any required write fails, the transaction rolls back; do not use a best-effort ledger helper or a feature flag to leave a changed balance without evidence.

Each successful mutation has one non-null `financialEventId`. The `FinancialLedger` row is the accounting/reporting record; the `AuditLog` row with `eventType` `financial_transaction` is the operational/security/reconciliation record. They share the event identity and core financial facts, but the audit row is not a second balance mutation. `FinancialLedger.financialEventId` is unique for post-cutover rows. `AuditLog.financialEventId` is nullable for legacy/unrelated events and participates in a composite uniqueness rule with `eventType`; `AuditLog.sourceEventId` is similarly nullable and unique with `eventType` for `prestige_change` records. Do not add a foreign key from the polymorphic audit stream to the ledger; enforce pairing through uniqueness, atomic writes, and reconciliation diagnostics.

`Financial_Breakdown` JSON must be represented by explicit TypeScript types and runtime validation, then written to the ledger metadata and paired audit payload. It records formula/version, typed inputs, modifiers, source identity, discounts or bonuses, operation order, precision, and final rounding. A later report must be able to explain the amount without reading current facilities, prestige, fame, repair quotes, or formula code. `repair_cost` additionally requires `repairType` `manual` or `automatic`; a manual batch remains one wider transaction containing one per-robot financial/domain pair per repaired robot. Settlement writes one `passive_income` pair and one `operating_costs` pair per stable/cycle, including zero-valued components.

The final `Transaction_Taxonomy` is exactly `battle_income`, `streaming_revenue`, `repair_cost`, `facility_upgrade`, `weapon_purchase`, `weapon_sale`, `weapon_refinement`, `robot_creation`, `attribute_upgrade`, `achievement_reward`, `passive_income`, and `operating_costs`. New writes must reject `subscription_cost`, `prestige_award`, and `settlement_adjustment`. `Prestige_Service` writes separate `prestige_change` records with `sourceEventId`; Booking Office subscription changes remain free and emit no financial record.

### Forward-only identity migration

Add pairing fields as nullable migration-safe columns so surviving pre-cutover rows remain readable. Before relying on uniqueness, run a diagnostic for existing duplicate identities; do not rewrite old amounts, fabricate pairs, or relabel legacy rows. Select `Cutover_Cycle` in `ACC` only after schema/client generation, writer migration, the `Coverage_Manifest` check, blocking test tiers, and required capture activation pass. Reconciliation must separate post-cutover defects from pre-cutover history and must not become a historical reconstruction script.

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
  currency Decimal @db.Decimal(15, 2) @default(0)
  
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
cd app/backend
pnpm exec prisma migrate dev --name add_robot_image_url
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

## JSON Field Typing

Prisma `Json` fields are typed as `Prisma.JsonValue` at the ORM level, which is a union of `string | number | boolean | null | JsonObject | JsonArray`. This provides no structural type safety when accessing nested properties.

### Defining Interfaces for JSON Shapes

Define explicit TypeScript interfaces in `app/backend/src/types/` that match the runtime JSON structures stored in `Json` columns. These are hand-written types (not Prisma-generated) that describe what the application actually writes and reads.

```typescript
// src/types/snapshotTypes.ts
export interface StableMetric {
  userId: number;
  battlesParticipated: number;
  totalCreditsEarned: number;
  // ... fields matching the actual JSON shape
}
```

Import these from the `src/types/` barrel export:
```typescript
import { StableMetric, RobotMetric } from '../../types';
```

### Reading JSON Fields (Cast Pattern)

Use the two-step cast through `unknown` when reading a Prisma `Json` field into a typed interface:

```typescript
const metrics = snapshot.stableMetrics as unknown as StableMetric[];
```

This is necessary because `Prisma.JsonValue` and your interface are not directly assignable. The `as unknown as T` pattern makes the intent explicit.

### Writing JSON Fields (Cast Pattern)

When writing typed objects back to a Prisma `Json` field, cast through `unknown` to `Prisma.InputJsonValue`:

```typescript
import { Prisma } from '../../generated/prisma';

await prisma.cycleSnapshot.create({
  data: {
    stableMetrics: metrics as unknown as Prisma.InputJsonValue,
  },
});
```

### Flexible Objects

Use `Record<string, unknown>` instead of `Record<string, any>` for flexible objects that don't have a defined interface. This forces explicit type narrowing when accessing properties, catching errors at compile time rather than runtime.

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
