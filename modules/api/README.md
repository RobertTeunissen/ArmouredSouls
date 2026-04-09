# API Module

> **Phase 2 — Migration Planned**

HTTP layer — Express application, route definitions, middleware, admin services, notification integrations, and security monitoring. Depends on auth, game-engine, and database modules.

See [MODULE_CONTRACT.md](./MODULE_CONTRACT.md) for the full public API specification.
See [Migration Strategy](../../docs/guides/MODULAR_MIGRATION_STRATEGY.md) for the extraction plan (Phase 2d).

## Current Source

All implementation currently lives in `prototype/backend/`:
- Express app: `src/index.ts`
- Routes (23 files): `src/routes/`
- HTTP middleware: `src/middleware/` (errorHandler, rateLimiter, schemaValidator, ownership, requestLogger)
- Admin services: `src/services/admin/`
- Security: `src/services/security/`
- Notifications: `src/services/notifications/`
- Validation: `src/utils/securityValidation.ts`
