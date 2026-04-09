# Module Contract: @armoured-souls/database

## Purpose

Data persistence layer. Owns the Prisma schema, migrations, generated client, seed scripts, and cross-cutting data access utilities.

## Dependencies

None — this is the leaf module. All other modules depend on `database`.

## Exported Public API

### Prisma Client

```typescript
// Singleton PrismaClient with driver adapter (Prisma 7 requirement)
export { prisma } from './lib/prisma';
export type { PrismaClient } from './generated/prisma';
```

### Data Access Helpers

```typescript
// Event logging for audit trails
export { eventLogger } from './services/eventLogger';
export type { EventType, EventPayload } from './services/eventLogger';

// Generic query builder for paginated/filtered queries
export { queryService } from './services/queryService';

// Data integrity checks and repair
export { dataIntegrityService } from './services/dataIntegrityService';

// Event compression for storage optimization
export { eventCompression } from './services/eventCompression';
```

### Migration Utilities

```typescript
// Prisma migrate commands (wrapped for programmatic use)
export { runMigrations, resetDatabase } from './migrations';
```

### Generated Types

All Prisma-generated model types are re-exported for use by other modules:

```typescript
export type { Robot, User, Battle, BattleParticipant, Weapon, Facility, ... } from './generated/prisma';
```

## Internal Implementation (Not Exported)

- `prisma/schema.prisma` — Database schema definition
- `prisma/migrations/` — Migration history
- `prisma/seed.ts` — Seed data script
- `generated/prisma/` — Auto-generated Prisma client

## Current Source Location

| Target | Current Location |
|--------|-----------------|
| `lib/prisma.ts` | `prototype/backend/src/lib/prisma.ts` |
| `eventLogger` | `prototype/backend/src/services/common/eventLogger.ts` |
| `queryService` | `prototype/backend/src/services/common/queryService.ts` |
| `dataIntegrityService` | `prototype/backend/src/services/common/dataIntegrityService.ts` |
| `eventCompression` | `prototype/backend/src/services/common/eventCompression.ts` |
| Prisma schema | `prototype/backend/prisma/schema.prisma` |
| Generated client | `prototype/backend/generated/prisma/` |

## External Package Dependencies

- `@prisma/client` (generated)
- `@prisma/adapter-pg` (driver adapter for Prisma 7)
- `pg` (PostgreSQL driver)
