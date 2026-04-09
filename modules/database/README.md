# Database Module

> **Phase 2 — Migration Planned**

Data persistence, schema management, and database operations. This is the leaf module with no dependencies on other modules.

See [MODULE_CONTRACT.md](./MODULE_CONTRACT.md) for the full public API specification.
See [Migration Strategy](../../docs/guides/MODULAR_MIGRATION_STRATEGY.md) for the extraction plan (Phase 2a).

## Current Source

All implementation currently lives in `prototype/backend/`:
- Prisma schema: `prisma/schema.prisma`
- Prisma client singleton: `src/lib/prisma.ts`
- Data access services: `src/services/common/` (eventLogger, queryService, dataIntegrityService, eventCompression)
