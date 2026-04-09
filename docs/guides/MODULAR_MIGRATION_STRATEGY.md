# Modular Architecture Migration Strategy

This document defines the phased plan for extracting the monolithic `app/` codebase into the `modules/` architecture.

See [SERVICE_MODULE_MAPPING.md](./SERVICE_MODULE_MAPPING.md) for the complete file-to-module mapping.
See [MODULE_TEMPLATE.md](./MODULE_TEMPLATE.md) for the standardized module package structure.

## Principles

1. **Each phase produces a working application** — the monolith and extracted modules coexist.
2. **Extract leaf modules first** — `database` has no dependencies, so it's extracted first.
3. **One module per phase** — never extract two modules simultaneously.
4. **Tests pass at every step** — run the full test suite after each extraction.
5. **Rollback is always possible** — each phase can be reverted independently.

## Phase Order

```
Phase 2a: database    (no dependencies)
Phase 2b: auth        (depends on database)
Phase 2c: game-engine (depends on database)
Phase 2d: api         (depends on auth, game-engine, database)
Phase 2e: ui          (no code dependencies, HTTP only)
```

## Phase 2a: Extract `database` Module

### What Moves
- `app/backend/prisma/` → `modules/database/prisma/`
- `app/backend/generated/prisma/` → `modules/database/generated/prisma/`
- `app/backend/src/lib/prisma.ts` → `modules/database/src/lib/prisma.ts`
- `app/backend/src/services/common/eventLogger.ts` → `modules/database/src/services/eventLogger.ts`
- `app/backend/src/services/common/queryService.ts` → `modules/database/src/services/queryService.ts`
- `app/backend/src/services/common/dataIntegrityService.ts` → `modules/database/src/services/dataIntegrityService.ts`
- `app/backend/src/services/common/eventCompression.ts` → `modules/database/src/services/eventCompression.ts`
- `app/backend/src/errors/AppError.ts` → `modules/database/src/errors/AppError.ts`

### Coexistence Approach
The monolith's `app/backend/` imports from `@armoured-souls/database` via npm workspace. The old files are replaced with re-exports:

```typescript
// app/backend/src/lib/prisma.ts (after extraction)
export { prisma } from '@armoured-souls/database';
```

### Rollback
1. Copy files back from `modules/database/` to their original locations
2. Remove the re-export shims
3. Remove `@armoured-souls/database` from workspace dependencies
4. Run `npm install` to restore the flat dependency tree

## Phase 2b: Extract `auth` Module

### What Moves
- `app/backend/src/services/auth/` → `modules/auth/src/services/`
- `app/backend/src/middleware/auth.ts` → `modules/auth/src/middleware/auth.ts`
- `app/backend/src/errors/authErrors.ts` → `modules/auth/src/errors/authErrors.ts`

### Coexistence Approach
Same as Phase 2a — old files become re-exports from `@armoured-souls/auth`.

### Rollback
Same pattern as Phase 2a — copy back, remove shims, remove workspace dependency.

## Phase 2c: Extract `game-engine` Module

### What Moves
All game logic services (~70 files across 14 directories). See [SERVICE_MODULE_MAPPING.md](./SERVICE_MODULE_MAPPING.md) for the complete list.

### Coexistence Approach
This is the largest extraction. Recommended sub-phases:
1. Extract `shared/utils/` (game formulas) first
2. Extract `services/battle/` and `services/arena/` (core combat)
3. Extract remaining service directories one at a time
4. Extract domain error classes last

Each sub-phase produces re-export shims in the monolith.

### Rollback
Same pattern. Due to the size, keep a git tag before starting this phase.

## Phase 2d: Extract `api` Module

### What Moves
- All route files (`app/backend/src/routes/`)
- HTTP middleware (`errorHandler`, `rateLimiter`, `schemaValidator`, `ownership`, `requestLogger`)
- Admin services, security services, notification services
- Express app configuration (`index.ts`)
- Validation utilities, credit guard, facility config, logger config

### Coexistence Approach
At this point, the monolith is essentially empty — the `api` module IS the application entry point. The `app/backend/` directory can be replaced entirely.

### Rollback
Restore `app/backend/` from git. Remove workspace configuration.

## Phase 2e: Extract `ui` Module

### What Moves
- `app/frontend/` → `modules/ui/`

### Coexistence Approach
The frontend already communicates with the backend via HTTP only. This is a directory move with no import changes.

### Rollback
Move the directory back.

## Workspace Configuration

### Root `package.json`

```json
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

### Per-Module `package.json` (Example: auth)

```json
{
  "name": "@armoured-souls/auth",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "@armoured-souls/database": "workspace:*"
  }
}
```

### During Transition (Monolith + Modules)

While the monolith coexists with extracted modules, the workspace includes both:

```json
{
  "private": true,
  "workspaces": [
    "app/backend",
    "app/frontend",
    "modules/database"
  ]
}
```

The monolith's `package.json` adds workspace dependencies as modules are extracted:

```json
{
  "dependencies": {
    "@armoured-souls/database": "workspace:*"
  }
}
```

## TypeScript Project References

Each module has its own `tsconfig.json`. Cross-module type checking uses TypeScript project references:

### Module `tsconfig.json` (Example: auth)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../database" }
  ]
}
```

### Root `tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "modules/database" },
    { "path": "modules/auth" },
    { "path": "modules/game-engine" },
    { "path": "modules/api" },
    { "path": "modules/ui" }
  ]
}
```

Build all modules: `tsc --build` from the root.

## Pre-Migration Checklist

Before starting any phase:

- [ ] All tests pass on `main`
- [ ] No pending PRs that touch files being extracted
- [ ] Git tag created at the pre-extraction commit
- [ ] Team notified of the extraction in progress

## Post-Migration Verification

After each phase:

- [ ] `npm install` succeeds from root
- [ ] `npm run build` succeeds for the extracted module
- [ ] `npm test` passes for the extracted module
- [ ] `npm test` passes for the monolith (consuming the module)
- [ ] CI pipeline passes
- [ ] No `import` statements reference old file paths (grep check)
