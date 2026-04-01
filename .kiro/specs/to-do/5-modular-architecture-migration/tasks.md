# Implementation Plan: Modular Architecture Migration Plan

## Overview

This is a documentation-only spec. No code is moved. The deliverables are module contract documents, a service-to-module mapping, and a phased migration strategy. This gives the team a clear roadmap for Phase 2 extraction.

## Tasks

- [ ] 1. Create module contract documents
  - [ ] 1.1 Create `modules/database/MODULE_CONTRACT.md` defining: exported interfaces (PrismaClient, data access helpers), internal implementation details, and external dependencies (none)
  - [ ] 1.2 Create `modules/auth/MODULE_CONTRACT.md` defining: exported interfaces (authenticate middleware, user CRUD, token utilities), and dependencies (database module)
  - [ ] 1.3 Create `modules/game-engine/MODULE_CONTRACT.md` defining: exported interfaces grouped by domain (battle, league, economy, cycle, tournament, tag-team, koth, onboarding), and dependencies (database module)
  - [ ] 1.4 Create `modules/api/MODULE_CONTRACT.md` defining: exported interfaces (configured Express app), and dependencies (auth, game-engine, database modules)
  - [ ] 1.5 Create `modules/ui/MODULE_CONTRACT.md` defining: exported artifacts (built static assets), and dependencies (none at build time, api module at runtime via HTTP)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 2. Create service-to-module mapping
  - [ ] 2.1 Create `docs/guides/SERVICE_MODULE_MAPPING.md` with a table mapping every service file in `prototype/backend/src/services/` to its target module
  - [ ] 2.2 Identify and document cross-cutting services that span module boundaries (eventLogger, queryService, etc.) with notes on resolution
  - [ ] 2.3 Identify and document any circular dependencies between services that must be resolved before extraction
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 3. Document migration strategy
  - [ ] 3.1 Create `docs/guides/MODULAR_MIGRATION_STRATEGY.md` with: phase order (database → auth → game-engine → api → ui), coexistence approach during transition, workspace configuration, and rollback procedures
  - [ ] 3.2 Document the npm workspace configuration (root `package.json` workspaces field, per-module `package.json` with workspace dependencies) — include the actual JSON snippets for the root `package.json` workspace config
  - [ ] 3.3 Document TypeScript project references configuration for cross-module type checking
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.3_

- [ ] 4. Define module package structure template
  - [ ] 4.1 Create a template `MODULE_TEMPLATE.md` in `docs/guides/` showing the standard directory structure, `package.json` shape, `tsconfig.json` shape, and barrel file pattern for new modules
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 5. Update existing documentation and final verification
  - [ ] 5.1 Update each `modules/{name}/README.md` to reference its `MODULE_CONTRACT.md` and the migration strategy document
  - [ ] 5.2 Update the root `modules/README.md` with an overview of the modular architecture plan and links to all contract documents
  - [ ] 5.3 Update `.kiro/steering/project-overview.md` Project Structure section to reference the modular architecture plan and link to the migration strategy
  - [ ] 5.4 Update `docs/guides/MODULE_STRUCTURE.md` to reference the module contracts and migration strategy as the authoritative source for the target architecture
  - [ ] 5.5 Run verification criteria checks: confirm 5 MODULE_CONTRACT.md files exist, SERVICE_MODULE_MAPPING.md covers all services, MODULAR_MIGRATION_STRATEGY.md exists with required sections, MODULE_TEMPLATE.md exists, all READMEs updated
  - _Requirements: 1.1_

## Notes

- This spec produces documentation only — no code is moved
- The service-to-module mapping assumes Spec 3 (service consolidation) has been completed, so services are already in domain subdirectories
- Module contracts should be reviewed by the team before Phase 2 extraction begins
- The migration strategy should be validated against the actual dependency graph once Spec 3 is complete
