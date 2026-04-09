# Implementation Plan: Modular Architecture Migration Plan

## Overview

This is a documentation-only spec. No code is moved. The deliverables are module contract documents, a service-to-module mapping, and a phased migration strategy. This gives the team a clear roadmap for Phase 2 extraction.

## Tasks

- [x] 1. Create module contract documents
  - [x] 1.1 Create `modules/database/MODULE_CONTRACT.md` defining: exported interfaces (PrismaClient, data access helpers), internal implementation details, and external dependencies (none)
  - [x] 1.2 Create `modules/auth/MODULE_CONTRACT.md` defining: exported interfaces (authenticate middleware, user CRUD, token utilities), and dependencies (database module)
  - [x] 1.3 Create `modules/game-engine/MODULE_CONTRACT.md` defining: exported interfaces grouped by domain (battle, league, economy, cycle, tournament, tag-team, koth, onboarding), and dependencies (database module)
  - [x] 1.4 Create `modules/api/MODULE_CONTRACT.md` defining: exported interfaces (configured Express app), and dependencies (auth, game-engine, database modules)
  - [x] 1.5 Create `modules/ui/MODULE_CONTRACT.md` defining: exported artifacts (built static assets), and dependencies (none at build time, api module at runtime via HTTP)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Create service-to-module mapping
  - [x] 2.1 Create `docs/guides/SERVICE_MODULE_MAPPING.md` with a table mapping every service file across all 18 directories in `app/backend/src/services/` to its target module (including `admin/`, `robot/`, `match/`, `arena/`, `practice-arena/`, `security/`, `notifications/` added in specs 3 and 15)
  - [x] 2.2 Include the `shared/utils/` directory (discounts, academyCaps, upgradeCosts) in the mapping
  - [x] 2.3 Identify and document cross-cutting services that span module boundaries (eventLogger, queryService, etc.) with notes on resolution
  - [x] 2.4 Identify and document any circular dependencies between services that must be resolved before extraction
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Document migration strategy
  - [x] 3.1 Create `docs/guides/MODULAR_MIGRATION_STRATEGY.md` with: phase order (database → auth → game-engine → api → ui), coexistence approach during transition, workspace configuration, and rollback procedures
  - [x] 3.2 Document the npm workspace configuration (root `package.json` workspaces field, per-module `package.json` with workspace dependencies) — include the actual JSON snippets for the root `package.json` workspace config
  - [x] 3.3 Document TypeScript project references configuration for cross-module type checking
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.3_

- [x] 4. Define module package structure template
  - [x] 4.1 Create a template `MODULE_TEMPLATE.md` in `docs/guides/` showing the standard directory structure, `package.json` shape, `tsconfig.json` shape, and barrel file pattern for new modules
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 5. Update existing documentation and final verification
  - [x] 5.1 Update each `modules/{name}/README.md` to reference its `MODULE_CONTRACT.md` and the migration strategy document
  - [x] 5.2 Update the root `modules/README.md` with an overview of the modular architecture plan and links to all contract documents
  - [x] 5.3 Update `.kiro/steering/project-overview.md` Project Structure section to reference the modular architecture plan and link to the migration strategy
  - [x] 5.4 Update `docs/guides/MODULE_STRUCTURE.md` to reference the module contracts and migration strategy as the authoritative source for the target architecture
  - [x] 5.5 Run verification criteria checks: confirm 5 MODULE_CONTRACT.md files exist, SERVICE_MODULE_MAPPING.md covers all services, MODULAR_MIGRATION_STRATEGY.md exists with required sections, MODULE_TEMPLATE.md exists, all READMEs updated
  - _Requirements: 1.1_

## Notes

- This spec produces documentation only — no code is moved
- The service-to-module mapping accounts for all 18 service directories in `app/backend/src/services/`, including `admin/`, `robot/`, `match/`, `arena/`, `practice-arena/`, `security/`, and `notifications/`
- The `shared/utils/` directory (discounts, academyCaps, upgradeCosts) is mapped to `game-engine` module
- Module contracts should be reviewed by the team before Phase 2 extraction begins
- The migration strategy should be validated against the actual dependency graph
- This spec should run BEFORE spec 10 (prototype → app rename) since it references `app/` paths and creates docs in `modules/`
