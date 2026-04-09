# Implementation Plan: Prototype-to-App Rename

## Overview

Rename `/prototype/` to `/app/` using `git mv`, remove the empty `/modules/` directory, and update every path reference across CI/CD, steering files, documentation, specs, and shell scripts. Two-phase approach: physical rename first, then global reference updates, followed by build/test verification.

## Tasks

- [ ] 1. Rename prototype directory and remove modules
  - [ ] 1.1 Rename `prototype/` to `app/` using `git mv`
    - Run `git mv prototype app` from the repository root
    - Verify `app/` contains `backend/`, `frontend/`, `docker-compose.yml`, `.gitignore`, and all nested contents
    - Verify `prototype/` no longer exists in the working tree
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 1.2 Remove the `modules/` directory
    - Run `git rm -rf modules/` from the repository root
    - Verify `modules/` no longer exists in the working tree
    - _Requirements: 2.1_

- [ ] 2. Update CI/CD pipeline files
  - [ ] 2.1 Update `.github/workflows/ci.yml`
    - Replace all `prototype/backend` → `app/backend` in `working-directory` and `cache-dependency-path` values
    - Replace all `prototype/frontend` → `app/frontend` in `working-directory` and `cache-dependency-path` values
    - Replace `prototype/backend/package-lock.json` → `app/backend/package-lock.json`
    - Replace `prototype/frontend/package-lock.json` → `app/frontend/package-lock.json`
    - _Requirements: 3.1, 3.2_

  - [ ] 2.2 Update `.github/workflows/deploy.yml`
    - Replace all `./prototype/backend` → `./app/backend` in `working-directory` values
    - Replace all `./prototype/frontend` → `./app/frontend` in `working-directory` values
    - Replace `./prototype/shared/` → `./app/shared/` in rsync source paths
    - Replace `./prototype/ecosystem.config.js` → `./app/ecosystem.config.js`
    - Replace `prototype/frontend/dist/` → `app/frontend/dist/` in artifact paths
    - Replace `prototype/frontend/playwright-report/` → `app/frontend/playwright-report/`
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3. Update Kiro steering files
  - [ ] 3.1 Update `.kiro/steering/project-overview.md`
    - Replace all `prototype/` path references with `app/`
    - Remove the `/modules/` entry from the Project Structure section
    - Update `/prototype/backend` → `/app/backend` and `/prototype/frontend` → `/app/frontend`
    - _Requirements: 4.1, 9.1, 9.2_

  - [ ] 3.2 Update `.kiro/steering/common-tasks.md`
    - Replace all `prototype/` path references with `app/`
    - _Requirements: 4.2_

  - [ ] 3.3 Update `.kiro/steering/guide-content-maintenance.md`
    - Update the `fileMatchPattern` value from `prototype/backend` to `app/backend`
    - _Requirements: 4.3_

  - [ ] 3.4 Update `.kiro/steering/environments-and-deployment.md`
    - Replace all `prototype/` path references with `app/` in setup commands and directory structure diagrams
    - _Requirements: 4.4_

  - [ ] 3.5 Update remaining steering files with `prototype/` references
    - Update `.kiro/steering/coding-standards.md` — Prisma generated client path
    - Update `.kiro/steering/testing-strategy.md` — test file location paths and run commands
    - Update `.kiro/steering/pre-deployment-checklist.md` — test run commands
    - Update `.kiro/steering/database-best-practices.md` — migration command path
    - Update `.kiro/steering/dependency-management.md` — install command path
    - Run `grep -rn "prototype/" .kiro/steering/` to catch any remaining references
    - _Requirements: 4.5_

- [ ] 4. Checkpoint - Verify steering and CI/CD updates
  - Ensure all `prototype/` references are removed from `.github/workflows/` and `.kiro/steering/`
  - Run `grep -rn "prototype/" .github/workflows/ .kiro/steering/` and verify zero matches
  - Run `grep -rn "modules/" .kiro/steering/` and verify zero matches (excluding `node_modules`)
  - Ask the user if questions arise.

- [ ] 5. Update root documentation
  - [ ] 5.1 Update root `README.md`
    - Replace all `prototype/` path references with `app/` (Quick Start commands, troubleshooting paths)
    - Update the repository structure diagram: `prototype/` → `app/`, remove `modules/` section
    - Replace Phase 2 `modules/` description with a note that modular architecture is planned as a future refactor within `app/`
    - _Requirements: 5.1, 10.1, 10.3_

  - [ ] 5.2 Update `CONTRIBUTING.md`
    - Replace all `prototype/` and `modules/` path references
    - Update the project structure diagram: remove `modules/` tree, update `prototype/` → `app/`
    - Remove or update any reference to `MODULE_STRUCTURE.md` if it links to modules content
    - _Requirements: 5.5_

  - [ ] 5.3 Update `app/README.md` (formerly `prototype/README.md`)
    - Replace any self-referential `prototype/` paths with `app/`
    - Update the project structure diagram to show `app/` instead of `prototype/`
    - _Requirements: 5.2, 10.2_

- [ ] 6. Update docs directory files
  - [ ] 6.1 Update `docs/guides/MODULE_STRUCTURE.md`
    - Replace all `prototype/` path references with `app/`
    - Remove or revise sections describing `modules/` as a future production codebase
    - Replace `modules/` links with appropriate `app/` paths or a note about the removal
    - _Requirements: 5.3, 2.3_

  - [ ] 6.2 Update remaining docs files with `prototype/` or `modules/` references
    - Run `grep -rn "prototype/" docs/` to find all affected files
    - Run `grep -rn "modules/" docs/ | grep -v node_modules` to find `modules/` references
    - Update `docs/guides/SETUP.md` and any other files found
    - Replace all `prototype/` → `app/` and remove/update `modules/` references
    - _Requirements: 5.4_

- [ ] 7. Update GitHub Copilot instructions
  - [ ] 7.1 Update `.github/copilot-instructions.md`
    - Replace all `prototype/` path references with `app/`
    - Update the project structure diagram: `prototype/` → `app/`, remove `modules/`
    - Update all code examples and commands that reference `prototype/` paths
    - _Requirements: 5.4_

- [ ] 8. Update in-progress spec references
  - [ ] 8.1 Update spec 3 files under `.kiro/specs/to-do/3-backend-service-consolidation/`
    - Replace all `prototype/` path references with `app/` in `design.md`, `requirements.md`, and `tasks.md`
    - _Requirements: 7.1_

  - [ ] 8.2 Update spec 5 files under `.kiro/specs/to-do/5-modular-architecture-migration/`
    - Replace all `prototype/` path references with `app/` in `design.md`, `requirements.md`, and `tasks.md`
    - Replace or remove `modules/` path references as appropriate
    - _Requirements: 7.1, 7.2_

  - [ ] 8.3 Update spec 8 files under `.kiro/specs/to-do/8-battle-replay-admin/`
    - Replace all `prototype/backend` and `prototype/frontend` path references with `app/backend` and `app/frontend` in `design.md`, `requirements.md`, and `tasks.md`
    - _Requirements: 7.1_

  - [ ] 8.4 Update spec 9 files under `.kiro/specs/to-do/9-web-push-notifications/`
    - Replace all `prototype/backend` and `prototype/frontend` path references with `app/backend` and `app/frontend` in `design.md`
    - _Requirements: 7.1_

  - [ ] 8.5 Update spec 4 files under `.kiro/specs/to-do/4-frontend-state-management/` if they contain `prototype/` references
    - Run `grep -rn "prototype/" .kiro/specs/to-do/4-frontend-state-management/` and update any matches
    - _Requirements: 7.1_

  - [ ] 8.6 Update completed spec files under `.kiro/specs/done-april26/15-route-handler-extraction/`, `16-zod-validation-gaps/`, `17-type-safety-any-elimination/`, `18-frontend-component-splitting/`, `19-frontend-testing-foundation/`
    - Replace all `prototype/backend` and `prototype/frontend` path references with `app/backend` and `app/frontend` in all `design.md`, `requirements.md`, and `tasks.md` files
    - Replace `prototype/shared` with `app/shared`
    - _Requirements: 7.1_

  - [ ] 8.7 Update spec 20 files under `.kiro/specs/to-do/20-robot-image-upload/` if they contain `prototype/` references
    - Run `grep -rn "prototype/" .kiro/specs/to-do/20-robot-image-upload/` and update any matches
    - _Requirements: 7.1_

  - [ ] 8.8 Update GitNexus steering files under `.kiro/steering/gitnexus-*.md`
    - Replace all `prototype/backend` and `prototype/frontend` path references with `app/backend` and `app/frontend`
    - _Requirements: 4.5_

  - [ ] 8.9 Update `AGENTS.md` and `CLAUDE.md` in the repository root
    - Replace all `prototype/` path references with `app/`
    - _Requirements: 5.4_

  - [ ] 8.10 Update `.claude/skills/gitnexus/` skill files
    - Replace all `prototype/` path references with `app/`
    - _Requirements: 5.4_

- [ ] 9. Update shell scripts and infrastructure files
  - [ ] 9.1 Update `app/backend/scripts/fix-test-patterns.sh`
    - Replace comment `# Run from prototype/backend directory` → `# Run from app/backend directory`
    - Run `grep -rn "prototype/" app/` to catch any other shell scripts or files with stale references
    - _Requirements: 6.4_

  - [ ] 9.2 Verify infrastructure files need no content changes
    - Confirm `app/docker-compose.yml` contains no `prototype/` self-referential paths (uses container-internal paths only)
    - Confirm `app/docker-compose.production.yml` contains no `prototype/` paths
    - Confirm `app/Caddyfile` contains no `prototype/` paths (uses `/opt/armouredsouls/` deployment paths)
    - Confirm `app/ecosystem.config.js` contains no `prototype/` paths
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 10. Checkpoint - Full reference verification
  - Run `grep -rn "prototype/" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.sh" --include="*.kiro" . | grep -v node_modules | grep -v ".git/" | grep -v "10-prototype-to-app-rename"` and verify zero matches
  - Run `grep -rn "modules/" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.sh" --include="*.kiro" . | grep -v node_modules | grep -v ".git/" | grep -v "10-prototype-to-app-rename"` and verify zero matches
  - Verify `app/` directory exists with `backend/`, `frontend/`, `docker-compose.yml`, `.gitignore`
  - Verify `prototype/` directory does not exist
  - Verify `modules/` directory does not exist
  - Ask the user if questions arise.
  - **Property 1: Zero prototype/ path references in tracked files**
  - **Property 2: Zero modules/ path references in tracked files**
  - **Property 3: File tree preservation after rename**
  - **Validates: Requirements 1.2, 1.3, 1.4, 2.2, 4.5, 5.4, 7.1, 7.2, 9.1**

- [ ] 11. Build and test verification
  - [ ] 11.1 Verify backend build and tests
    - Run `npm run build` from `app/backend` and confirm zero compilation errors
    - Run `npm test` from `app/backend` and confirm all tests pass
    - _Requirements: 8.1, 8.3_

  - [ ] 11.2 Verify frontend build and tests
    - Run `npm run build` from `app/frontend` and confirm zero compilation errors
    - Run `npx vitest --run` from `app/frontend` and confirm all tests pass
    - _Requirements: 8.2, 8.4_

- [ ] 12. Final checkpoint - Verification criteria
  - Ensure all tests pass from tasks 11.1 and 11.2
  - Re-run the grep verification commands from task 10 to confirm zero stale references
  - Confirm `git status` shows the rename is staged correctly (files show as renamed, not deleted+added)
  - Run the requirements verification criteria:
    - `grep -rn "prototype/" . | grep -v node_modules | grep -v ".git/" | grep -v "10-prototype-to-app-rename"` → zero matches
    - `grep -rn "modules/" . | grep -v node_modules | grep -v ".git/" | grep -v "10-prototype-to-app-rename"` → zero matches
    - `test -d app/backend && test -d app/frontend && echo "PASS"` → PASS
    - `test ! -d prototype && test ! -d modules && echo "PASS"` → PASS
  - Ask the user if questions arise.

## Notes

- This spec has no application code changes — all tasks are file renames, path replacements, and documentation updates
- The `git mv` approach preserves full file history when using `git log --follow`
- Infrastructure files (`docker-compose.yml`, `Caddyfile`, `ecosystem.config.js`) use deployment paths (`/opt/armouredsouls/`), not repo paths, so they need no content edits
- Internal TypeScript imports use relative paths within `backend/` and `frontend/`, so they are unaffected by the top-level rename
- This spec must execute AFTER spec 5 (modular-architecture-migration) since spec 5 creates docs in `modules/` which spec 10 removes
- Specs 15–19 added significant new files that reference `prototype/` paths: service directories (`admin/`, `robot/`, `match/`), frontend component directories (`practice-arena/`, `facilities/`, `weapon-shop/`, etc.), `shared/utils/`, 125 frontend test files, and 6 GitNexus steering files. Task 8.6 covers these.
- `AGENTS.md`, `CLAUDE.md`, and `.claude/skills/` were added by GitNexus setup and contain `prototype/` paths. Task 8.9 and 8.10 cover these.
- Checkpoints at tasks 4, 10, and 12 ensure incremental validation
- After completing this spec, re-run `npx gitnexus analyze` to update the index with the new paths
