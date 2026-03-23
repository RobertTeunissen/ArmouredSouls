# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Project Quality Audit Defects
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the defects exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate all 10 defect categories exist
  - **Scoped PBT Approach**: Write a structural verification test suite (e.g., `prototype/backend/src/__tests__/project-quality-audit.pbt.test.ts`) using fast-check that checks:
    - Parse `README.md` for all markdown links `[text](path)` where path is a relative file path; assert each target file exists in the filesystem (will fail — 16+ broken links)
    - Parse `.github/workflows/ci.yml` and assert all `node-version` values are `'20'` (will fail — all 4 jobs use `'18'`)
    - Parse `ci.yml` `frontend-tests` job steps and assert a step containing `vitest --run` exists (will fail — no vitest step)
    - Assert `prototype/backend/.env.prd.example` does NOT exist (will fail — file exists)
    - Parse `prototype/backend/.env.example` and assert it contains `LEAGUE_SCHEDULE`, `TOURNAMENT_SCHEDULE`, `TAGTEAM_SCHEDULE`, `SETTLEMENT_SCHEDULE`, `KOTH_SCHEDULE` (will fail — vars missing)
    - Parse `prototype/backend/src/routes/adminTournaments.ts` and count route registrations for `'/eligible-robots'`; assert exactly 1 (will fail — 2 found)
    - Assert `prototype/frontend/src/pages/LoginPage.tsx` does NOT exist (will fail — file exists)
    - Assert `prototype/frontend/src/pages/SystemHealthPage.tsx` does NOT exist (will fail — file exists)
    - Assert `prototype/frontend/src/components/__tests__/RobotUpcomingMatches.pbt.test.tsx` does NOT exist (will fail — file exists)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the defects exist)
  - Document counterexamples found (broken link paths, wrong Node version, missing vitest step, etc.)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Write a preservation test suite (e.g., `prototype/backend/src/__tests__/project-quality-preservation.pbt.test.ts`) that captures current correct behavior:
  - Observe: `CONTRIBUTING.md` link in README resolves correctly on unfixed code
  - Observe: Backend CI jobs (`backend-unit-tests`, `backend-integration-tests`, `security-audit`) have their current test commands in `ci.yml`
  - Observe: `env.ts` default values for scheduler variables are `'0 20 * * *'` (league), `'0 8 * * *'` (tournament), `'0 12 * * *'` (tagteam), `'0 23 * * *'` (settlement), `'0 16 * * 1,3,5'` (koth)
  - Observe: `prototype/backend/.env.acc.example` exists and is available
  - Observe: `prototype/backend/.env.production.example` exists as canonical production template
  - Observe: The first `/eligible-robots` handler at line ~103 in `adminTournaments.ts` has the correct ordering comment and response shape (`success`, `eligibleRobots`, `count`, `timestamp`)
  - Observe: `ci.yml` `frontend-tests` job contains lint and build steps
  - Write property-based tests asserting these observations hold for the non-defective artifacts
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix README.md broken documentation links
  - [x] 3.1 Update relocated doc links to correct subdirectory paths
    - `docs/SETUP.md` → `docs/guides/SETUP.md`
    - `docs/ROBOT_ATTRIBUTES.md` → `docs/prd_core/PRD_ROBOT_ATTRIBUTES.md`
    - `docs/ARCHITECTURE.md` → `docs/prd_core/ARCHITECTURE.md`
    - `docs/GAME_DESIGN.md` → `docs/prd_core/GAME_DESIGN.md`
    - `docs/MODULE_STRUCTURE.md` → `docs/guides/MODULE_STRUCTURE.md`
    - `docs/SECURITY.md` → `docs/guides/SECURITY.md`
    - `docs/PORTABILITY.md` → `docs/guides/PORTABILITY.md`
    - `docs/PRD_MATCHMAKING.md` → `docs/prd_core/PRD_MATCHMAKING.md`
    - `docs/PRD_ECONOMY_SYSTEM.md` → `docs/prd_core/PRD_ECONOMY_SYSTEM.md`
    - `docs/PRD_PRESTIGE_AND_FAME.md` → `docs/prd_core/PRD_PRESTIGE_AND_FAME.md`
    - `docs/STABLE_SYSTEM.md` → `docs/prd_core/STABLE_SYSTEM.md`
    - `docs/PRD_WEAPON_LOADOUT.md` → `docs/prd_core/PRD_WEAPONS_LOADOUT.md`
    - `docs/PRD_MY_ROBOTS_LIST_PAGE.md` → `docs/prd_pages/PRD_ROBOTS_LIST_PAGE.md`
    - _Bug_Condition: isBugCondition(input) where input.type == "readme_link" AND input.target NOT EXISTS_
    - _Expected_Behavior: All links resolve to correct paths in reorganized directory structure_
    - _Preservation: Currently-working links (CONTRIBUTING.md, inline code, external URLs) must continue to resolve_
    - _Requirements: 2.1, 2.2, 3.1_
  - [x] 3.2 Remove or replace links to non-existent documents
    - Remove entire sections referencing documents that no longer exist: matchmaking guides, weapon loadout implementation plans, GitHub issue templates, quick references, troubleshooting files
    - Consolidate Documentation section to only reference files that actually exist in the filesystem
    - _Requirements: 2.2_
  - [x] 3.3 Update Phase 1 status indicators
    - Change auth system from 🚧 to ✅
    - Change robot creation and management from 🚧 to ✅
    - Change battle simulation engine from 🚧 to ✅
    - Update active development list to reflect current state
    - _Bug_Condition: isBugCondition(input) where input.type == "readme_status" AND input.indicator != actualImplementationState_
    - _Expected_Behavior: Status indicators accurately reflect implementation state_
    - _Requirements: 2.3_

- [x] 4. Fix CI/CD pipeline configuration
  - [x] 4.1 Update Node.js version from 18 to 20 in all CI jobs
    - Change `node-version: '18'` to `node-version: '20'` in `backend-unit-tests`, `backend-integration-tests`, `frontend-tests`, and `security-audit` jobs in `.github/workflows/ci.yml`
    - _Bug_Condition: isBugCondition(input) where input.type == "ci_node_version" AND input.value == "18"_
    - _Expected_Behavior: All CI jobs use node-version '20'_
    - _Preservation: Backend CI jobs must continue to run the same test commands and configurations_
    - _Requirements: 2.4, 3.2_
  - [x] 4.2 Add vitest step to frontend-tests job
    - Add a step after the build step in `frontend-tests` job: `npx vitest --run`
    - The 104 failing tests are NOT in scope for fixing — only adding the vitest step to CI is in scope
    - _Bug_Condition: isBugCondition(input) where input.type == "ci_frontend_job" AND NOT containsStep("vitest --run")_
    - _Expected_Behavior: frontend-tests job runs vitest --run in addition to lint and build_
    - _Preservation: Existing lint and build steps must remain unchanged_
    - _Requirements: 2.5, 3.6_

- [x] 5. Remove duplicate .env.prd.example file
  - Delete `prototype/backend/.env.prd.example` — `.env.production.example` is the canonical production template
  - _Bug_Condition: isBugCondition(input) where input.type == "env_file" AND input.path == ".env.prd.example"_
  - _Expected_Behavior: Only .env.production.example exists as canonical production env template_
  - _Preservation: .env.acc.example and .env.production.example must remain unchanged_
  - _Requirements: 2.6, 3.7_

- [x] 6. Add scheduler env vars to .env.example
  - Append scheduler configuration section to `prototype/backend/.env.example` with documented defaults:
    - `LEAGUE_SCHEDULE=0 20 * * *`
    - `TOURNAMENT_SCHEDULE=0 8 * * *`
    - `TAGTEAM_SCHEDULE=0 12 * * *`
    - `SETTLEMENT_SCHEDULE=0 23 * * *`
    - `KOTH_SCHEDULE=0 16 * * 1,3,5`
  - Values must match the defaults in `prototype/backend/src/config/env.ts`
  - _Bug_Condition: isBugCondition(input) where input.type == "env_example" AND NOT containsSchedulerVars(input)_
  - _Expected_Behavior: .env.example contains all 5 scheduler variable comments with default values_
  - _Preservation: Existing env.ts default values must remain identical_
  - _Requirements: 2.7, 3.3_

- [x] 7. Remove duplicate route handler in adminTournaments.ts
  - Delete the second `GET /eligible-robots` handler (lines ~261–280) in `prototype/backend/src/routes/adminTournaments.ts`
  - The first handler at line ~103 with the ordering comment is the correct one
  - _Bug_Condition: isBugCondition(input) where input.type == "route_handler" AND isDuplicateHandler(input, "eligible-robots")_
  - _Expected_Behavior: Exactly one /eligible-robots route handler exists_
  - _Preservation: The remaining first handler must behave identically — same middleware chain, same response shape_
  - _Requirements: 2.8, 3.5_

- [x] 8. Delete dead code files
  - Delete `prototype/frontend/src/pages/LoginPage.tsx` — superseded by FrontPage, not imported in App.tsx
  - Delete `prototype/frontend/src/pages/SystemHealthPage.tsx` — commented out in App.tsx, absorbed into DashboardTab.tsx
  - Delete `prototype/frontend/src/components/__tests__/RobotUpcomingMatches.pbt.test.tsx` — empty skipped test stubs
  - _Bug_Condition: isBugCondition(input) where input.type == "source_file" AND NOT isImportedOrUsed(input)_
  - _Expected_Behavior: Dead files are removed from the codebase_
  - _Preservation: Frontend routing in App.tsx must continue to work — these files are not imported_
  - _Requirements: 2.9, 3.4_

- [x] 9. Add Phase 2 disclaimer to /modules/ directory
  - Update `modules/README.md` (or create if not present) with a clear disclaimer explaining these are reserved for future Phase 2+ modular architecture and contain no implementation code yet
  - Clean up or consolidate the individual placeholder subdirectory READMEs (`api/`, `auth/`, `database/`, `game-engine/`, `ui/`)
  - _Bug_Condition: isBugCondition(input) where input.type == "directory" AND input.path == "/modules/" AND NOT hasPhase2Disclaimer(input)_
  - _Expected_Behavior: /modules/ root README contains Phase 2 disclaimer language_
  - _Requirements: 2.10_

- [x] 10. Verify all fixes and run validation

  - [x] 10.1 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - All Defective Artifacts Are Fixed
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior for all 10 defect categories
    - When this test passes, it confirms all defects are resolved
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms all bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 10.2 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

  - [x] 10.3 Run backend unit tests to confirm no regressions
    - Run `npm run test:unit` in `prototype/backend`
    - All existing tests must pass

  - [x] 10.4 Run frontend build to confirm deleted files don't break build
    - Run `npm run build` in `prototype/frontend`
    - Build must succeed without the deleted files

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
