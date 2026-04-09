# Requirements Document

## Introduction

Document the migration path from the monolithic `prototype/` structure to the modular `modules/` architecture. The `modules/` directory currently contains only placeholder READMEs for 5 modules (api, auth, database, game-engine, ui). This spec does not move code — it defines the module boundaries, dependency contracts, and migration strategy so that the team has a clear roadmap for Phase 2.

## Glossary

- **Prototype_Monolith**: The current application code in `prototype/backend/` and `prototype/frontend/`, organized as a single deployable unit.
- **Module**: A self-contained package in `modules/` with its own `package.json`, public API surface, and internal implementation. Modules communicate through defined interfaces, not direct file imports.
- **Module_Boundary**: The public API exported by a module's `index.ts` — the only entry point other modules may import from.
- **Dependency_Contract**: A documented specification of what a module exports (functions, types, interfaces) and what it depends on from other modules.

## Expected Contribution

This spec targets the "modules/ directory is all placeholders with no documented migration path" debt identified in the project assessment. The expected measurable outcomes after all tasks are complete:

1. **Module boundaries defined**: Each of the 5 modules has a `MODULE_CONTRACT.md` specifying its public API, internal implementation, and dependencies. Before: only placeholder READMEs saying "Phase 2+ — No Implementation Code Yet."
2. **Service mapping complete**: Every one of the 41+ backend services is assigned to exactly one target module with no ambiguity. Before: no mapping exists.
3. **Circular dependencies identified**: Any circular dependencies between services that would block extraction are documented with resolution strategies. Before: unknown.
4. **Migration strategy documented**: A phased extraction plan (database → auth → game-engine → api → ui) with coexistence approach, workspace configuration, and rollback procedures. Before: no migration strategy exists.
5. **Standardized module template**: A reusable template for module package structure (package.json, tsconfig.json, barrel file pattern). Before: no convention defined.

### Verification Criteria

After all tasks are marked complete, run these checks to confirm the debt reduction was achieved:

1. `ls modules/*/MODULE_CONTRACT.md` returns 5 files (one per module)
2. `docs/guides/SERVICE_MODULE_MAPPING.md` exists and contains a row for every service file in `prototype/backend/src/services/`
3. `docs/guides/MODULAR_MIGRATION_STRATEGY.md` exists and contains phase order, coexistence approach, and rollback procedures
4. `docs/guides/MODULE_TEMPLATE.md` exists with standardized package structure
5. Each `modules/{name}/README.md` references its `MODULE_CONTRACT.md`

## Requirements

### Requirement 1: Module Boundary Definitions

**User Story:** As a developer, I want each module's public API surface documented, so that I know exactly what each module exports and what other modules can depend on.

#### Acceptance Criteria

1. WHEN the migration plan is documented, EACH of the 5 modules (api, auth, database, game-engine, ui) SHALL have a `MODULE_CONTRACT.md` file in its `modules/{name}/` directory defining: exported functions/classes, exported types/interfaces, and required dependencies (other modules or external packages).
2. WHEN module boundaries are defined, THE `game-engine` module SHALL export battle simulation, matchmaking, league management, tournament management, and economy calculation interfaces.
3. WHEN module boundaries are defined, THE `auth` module SHALL export authentication, authorization, and user management interfaces.
4. WHEN module boundaries are defined, THE `database` module SHALL export the Prisma client, migration utilities, and data access layer interfaces.
5. WHEN module boundaries are defined, THE `api` module SHALL export Express route definitions and middleware that compose the other modules.
6. WHEN module boundaries are defined, THE `ui` module SHALL export the React application with its pages, components, and stores.

### Requirement 2: Service-to-Module Mapping

**User Story:** As a developer, I want a mapping document that shows which current services in `prototype/backend/src/services/` belong to which target module, so that the migration can be executed incrementally without ambiguity.

#### Acceptance Criteria

1. WHEN the mapping is documented, EVERY service file in `prototype/backend/src/services/` SHALL be assigned to exactly one target module.
2. WHEN the mapping is documented, SERVICES that are shared across modules (e.g., `eventLogger`, `queryService`) SHALL be assigned to a `common` or `database` module with a note explaining the cross-cutting nature.
3. WHEN the mapping is documented, THE document SHALL identify circular dependencies between services that must be resolved before migration.

### Requirement 3: Migration Strategy

**User Story:** As a developer, I want a phased migration strategy that allows incremental extraction of modules from the monolith without breaking the running application, so that the migration can happen alongside feature development.

#### Acceptance Criteria

1. WHEN the migration strategy is documented, IT SHALL define a phase order for extracting modules (recommended: database → auth → game-engine → api → ui).
2. WHEN the migration strategy is documented, IT SHALL specify that each phase produces a working application — the monolith and extracted modules coexist during migration.
3. WHEN the migration strategy is documented, IT SHALL specify how modules are consumed during the transition period (npm workspaces, TypeScript path aliases, or direct file references).
4. WHEN the migration strategy is documented, IT SHALL include a rollback procedure for each phase.

### Requirement 4: Module Package Structure

**User Story:** As a developer, I want a standardized package structure for each module, so that all modules follow the same conventions and can be developed independently.

#### Acceptance Criteria

1. WHEN the module structure is defined, EACH module SHALL have: `package.json`, `tsconfig.json`, `src/index.ts` (public API barrel), `src/` (implementation), and `tests/` (module-specific tests).
2. WHEN the module structure is defined, EACH module's `package.json` SHALL declare its dependencies on other modules explicitly (not implicit file path imports).
3. WHEN the module structure is defined, THE root `package.json` SHALL be configured as an npm workspace that includes all modules.
