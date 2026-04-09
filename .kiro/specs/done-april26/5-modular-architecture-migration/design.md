# Design Document: Modular Architecture Migration Plan

## Overview

This is a documentation-only spec. No code is moved. The deliverable is a set of module contract documents and a migration strategy that maps the current monolithic `app/` structure to the target `modules/` architecture. This gives the team a clear, unambiguous roadmap for Phase 2 extraction.

### Key Research Findings

- `modules/` contains 5 placeholder directories: `api/`, `auth/`, `database/`, `game-engine/`, `ui/`. Each has only a README.
- The actual codebase in `app/backend/src/services/` has 41 services (being reorganized into domain subdirectories per Spec 3).
- The frontend in `app/frontend/` is a single React app with 23 pages.
- No npm workspace configuration exists yet.
- The Prisma schema and generated client live in `app/backend/` — the `database` module needs to own these.

## Architecture

### Target Module Dependency Graph

```
┌──────────┐     ┌──────────┐     ┌─────────────┐
│    ui    │────▶│   api    │────▶│ game-engine │
│ (React)  │     │(Express) │     │  (services) │
└──────────┘     └────┬─────┘     └──────┬──────┘
                      │                   │
                      ▼                   ▼
                 ┌──────────┐       ┌──────────┐
                 │   auth   │──────▶│ database │
                 │  (JWT)   │       │ (Prisma) │
                 └──────────┘       └──────────┘
```

Dependencies flow downward. No circular dependencies between modules.

### Module Definitions

#### `modules/database`
- Owns: Prisma schema, migrations, generated client, seed scripts
- Exports: PrismaClient singleton, data access helpers, migration utilities
- Dependencies: none (leaf module)

#### `modules/auth`
- Owns: JWT service, password service, user service, auth middleware
- Exports: `authenticate()` middleware, `createUser()`, `findUser()`, token utilities
- Dependencies: `database`

#### `modules/game-engine`
- Owns: All game logic — battle simulation, matchmaking, leagues, tournaments, tag-teams, KotH, economy, cycle management
- Exports: Service functions grouped by domain (battle, league, economy, etc.)
- Dependencies: `database`

#### `modules/api`
- Owns: Express app, route definitions, middleware (rate limiting, request logging, error handling)
- Exports: Configured Express app
- Dependencies: `auth`, `game-engine`, `database`

#### `modules/ui`
- Owns: React app, pages, components, stores, API client
- Exports: Built static assets (consumed by `api` module or served separately)
- Dependencies: none at build time (communicates with `api` via HTTP)

### Service-to-Module Mapping

| Current Location | Target Module | Notes |
|---|---|---|
| `services/auth/` (jwtService, passwordService, userService) | `modules/auth` | |
| `services/battle/` (combatSimulator, battleStrategy, etc.) | `modules/game-engine` | |
| `services/league/` | `modules/game-engine` | |
| `services/tournament/` | `modules/game-engine` | |
| `services/tag-team/` | `modules/game-engine` | |
| `services/koth/` | `modules/game-engine` | |
| `services/economy/` | `modules/game-engine` | |
| `services/cycle/` | `modules/game-engine` | |
| `services/onboarding/` | `modules/game-engine` | |
| `services/analytics/` (11 files incl. cycle, facility, koth, leaderboard, stable analytics) | `modules/game-engine` | |
| `services/arena/` (15 files: movement AI, threat scoring, pressure system, etc.) | `modules/game-engine` | 2D combat arena subsystem |
| `services/robot/` (7 files: creation, query, ranking, repair, sanitizer, upgrade, weapon) | `modules/game-engine` | Extracted from routes in spec 15 |
| `services/match/` (matchHistoryService) | `modules/game-engine` | Extracted from routes in spec 15 |
| `services/admin/` (4 files: battle, cycle, maintenance, stats services) | `modules/api` | Admin-specific, route-adjacent |
| `services/practice-arena/` | `modules/game-engine` | |
| `services/notifications/` (discord, notification-service) | `modules/api` | External integrations |
| `services/security/` (securityLogger, securityMonitor) | `modules/api` | HTTP-layer security |
| `services/common/eventLogger` | `modules/database` | Cross-cutting, DB-dependent |
| `services/common/queryService` | `modules/database` | Direct DB access |
| `services/common/dataIntegrityService` | `modules/database` | DB maintenance |
| `services/common/eventCompression` | `modules/database` | Event storage optimization |
| `services/common/guide-service, markdown-parser` | `modules/api` | Content serving |
| `services/common/resetService` | `modules/game-engine` | Game state reset |
| `shared/utils/` (discounts, academyCaps, upgradeCosts) | `modules/game-engine` | Shared formulas, created in spec 15 |
| `lib/prisma.ts` | `modules/database` | Prisma client singleton |
| `middleware/auth.ts` | `modules/auth` | Auth middleware |
| `middleware/rateLimiter.ts, requestLogger.ts, schemaValidator.ts` | `modules/api` | HTTP middleware |
| `middleware/ownership.ts` | `modules/api` | Route-level ownership checks |
| `routes/*` | `modules/api` | Route definitions |
| `errors/*` | `modules/game-engine` + `modules/auth` | Domain errors with their domains |
| `utils/securityValidation.ts` | `modules/api` | Zod schemas and validation primitives |
| `frontend/` | `modules/ui` | Entire React app |

### Migration Phases

1. **Phase 2a: Extract `database` module** — Move Prisma schema, client, and data access utilities. Other code imports from the module via npm workspace.
2. **Phase 2b: Extract `auth` module** — Move auth services and middleware. Depends on `database` module.
3. **Phase 2c: Extract `game-engine` module** — Move all game logic services. Depends on `database` module.
4. **Phase 2d: Extract `api` module** — Move Express app, routes, and HTTP middleware. Depends on `auth` and `game-engine`.
5. **Phase 2e: Extract `ui` module** — Move React app. Communicates with `api` via HTTP (already the case).

Each phase produces a working application. The monolith shrinks as modules are extracted.

### Workspace Configuration

```json
// Root package.json
{
  "private": true,
  "workspaces": [
    "modules/database",
    "modules/auth",
    "modules/game-engine",
    "modules/api",
    "modules/ui"
  ]
}
```

Each module's `package.json` declares dependencies on sibling modules:
```json
// modules/auth/package.json
{
  "name": "@armoured-souls/auth",
  "dependencies": {
    "@armoured-souls/database": "workspace:*"
  }
}
```

## Components and Interfaces

No new application components. This spec produces documentation only.

## Data Models

No data model changes.

## Documentation Impact

The following existing documentation and steering files will need updating:

- `.kiro/steering/project-overview.md` — Project Structure section should reference the modular architecture plan.
- `docs/guides/MODULE_STRUCTURE.md` — Should reference the module contracts and migration strategy as the authoritative source for the target architecture.
- Each `modules/{name}/README.md` — Must reference its `MODULE_CONTRACT.md`.
- Root `modules/README.md` — Must provide an overview and links to all contract documents.

## Testing Strategy

### Validation
- Review module contracts for completeness (every service mapped, no orphans)
- Review dependency graph for circular dependencies (none allowed)
- Validate that the proposed workspace configuration is compatible with npm workspaces and TypeScript project references
