# Auth Module

> **Phase 2 — Migration Planned**

Authentication, authorization, and user management. Depends on the `database` module.

See [MODULE_CONTRACT.md](./MODULE_CONTRACT.md) for the full public API specification.
See [Migration Strategy](../../docs/guides/MODULAR_MIGRATION_STRATEGY.md) for the extraction plan (Phase 2b).

## Current Source

All implementation currently lives in `prototype/backend/`:
- Auth services: `src/services/auth/` (jwtService, passwordService, userService)
- Auth middleware: `src/middleware/auth.ts`
- Auth errors: `src/errors/authErrors.ts`
