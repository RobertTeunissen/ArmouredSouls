# Modules Directory

> **Phase 2 — Migration Planned**
>
> This directory defines the target modular architecture. Each module has a `MODULE_CONTRACT.md`
> specifying its public API, dependencies, and the current source files that will be extracted.
> No implementation code has been moved yet — all active development lives in [`/prototype/`](../prototype/).

## Migration Documentation

- [Migration Strategy](../docs/guides/MODULAR_MIGRATION_STRATEGY.md) — Phased extraction plan with rollback procedures
- [Service-to-Module Mapping](../docs/guides/SERVICE_MODULE_MAPPING.md) — Every service file mapped to its target module
- [Module Template](../docs/guides/MODULE_TEMPLATE.md) — Standardized package structure for all modules

## Module Contracts

| Module | Description | Dependencies | Contract |
|--------|-------------|-------------|----------|
| [`database/`](database/) | Prisma client, migrations, data access utilities | None (leaf) | [CONTRACT](database/MODULE_CONTRACT.md) |
| [`auth/`](auth/) | JWT, password hashing, user management, auth middleware | database | [CONTRACT](auth/MODULE_CONTRACT.md) |
| [`game-engine/`](game-engine/) | Battle simulation, leagues, economy, robots, analytics (~70 files) | database | [CONTRACT](game-engine/MODULE_CONTRACT.md) |
| [`api/`](api/) | Express app, routes, HTTP middleware, admin services | auth, game-engine, database | [CONTRACT](api/MODULE_CONTRACT.md) |
| [`ui/`](ui/) | React frontend (pages, components, stores) | None (HTTP only) | [CONTRACT](ui/MODULE_CONTRACT.md) |

## Dependency Graph

```
ui → (HTTP) → api → auth → database
                  → game-engine → database
```

## Extraction Order

1. `database` (no dependencies)
2. `auth` (depends on database)
3. `game-engine` (depends on database)
4. `api` (depends on auth, game-engine, database)
5. `ui` (directory move only)
