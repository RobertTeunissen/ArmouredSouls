# Project Quality Audit Fixes — Bugfix Design

## Overview

A quality audit of the Armoured Souls repository uncovered 10 categories of defects: broken README documentation links (16+ dead links from a docs reorganization), stale progress indicators, CI/CD misconfiguration (wrong Node version, missing vitest step), duplicate/dead files, missing env var documentation, a duplicate Express route handler, and placeholder directories without implementation. This design formalizes each defect as a bug condition, defines the expected fix behavior, and outlines a validation strategy to ensure every fix is correct and no existing behavior regresses.

## Glossary

- **Bug_Condition (C)**: Any of the 10 defect conditions identified in the audit — a broken link, wrong CI config value, dead file present, etc.
- **Property (P)**: The desired state after the fix — links resolve, CI uses Node 20, dead files removed, etc.
- **Preservation**: Existing behaviors that must remain unchanged — working links, backend test jobs, env defaults, frontend routing, API endpoint behavior.
- **README.md**: Root project README at `/README.md` containing documentation links, quick-start guide, and project status.
- **ci.yml**: GitHub Actions workflow at `.github/workflows/ci.yml` defining CI/CD pipeline jobs.
- **adminTournaments.ts**: Backend route file at `app/backend/src/routes/adminTournaments.ts` containing tournament admin endpoints.
- **env.ts**: Environment config loader at `app/backend/src/config/env.ts` that reads scheduler cron variables with defaults.

## Bug Details

### Bug Condition

The bug manifests across 10 independent defect categories. A file, link, config value, or code block is defective if it matches any of the conditions below.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ProjectArtifact (file, link, config line, or code block)
  OUTPUT: boolean

  RETURN
    (input.type == "readme_link" AND input.target NOT EXISTS in filesystem)
    OR (input.type == "readme_status" AND input.indicator != actualImplementationState)
    OR (input.type == "ci_node_version" AND input.value == "18")
    OR (input.type == "ci_frontend_job" AND NOT containsStep("vitest --run"))
    OR (input.type == "env_file" AND input.path == ".env.prd.example")
    OR (input.type == "env_example" AND NOT containsSchedulerVars(input))
    OR (input.type == "route_handler" AND isDuplicateHandler(input, "eligible-robots"))
    OR (input.type == "source_file" AND input.path IN [
         "LoginPage.tsx", "SystemHealthPage.tsx", "RobotUpcomingMatches.pbt.test.tsx"
       ] AND NOT isImportedOrUsed(input))
    OR (input.type == "directory" AND input.path == "/modules/"
        AND allChildrenArePlaceholderOnly(input) AND NOT hasPhase2Disclaimer(input))
END FUNCTION
```

### Examples

- **Broken link**: README links to `docs/SETUP.md` → 404. Correct path is `docs/guides/SETUP.md`.
- **Non-existent doc**: README links to `docs/TROUBLESHOOTING_DATABASE_URL.md` → 404. File was never created; link should be removed.
- **Stale status**: README shows 🚧 for authentication — but auth is fully implemented with JWT + bcrypt.
- **Wrong Node version**: `ci.yml` uses `node-version: '18'` in all 4 jobs. Project standard is Node 20 LTS.
- **Missing vitest**: `frontend-tests` job runs lint + build but never runs `vitest --run`, hiding 104 test failures.
- **Duplicate env file**: Both `.env.prd.example` and `.env.production.example` exist with identical content.
- **Missing scheduler vars**: `.env.example` omits `LEAGUE_SCHEDULE`, `TOURNAMENT_SCHEDULE`, `TAGTEAM_SCHEDULE`, `SETTLEMENT_SCHEDULE`, `KOTH_SCHEDULE` that `env.ts` consumes.
- **Duplicate route**: `adminTournaments.ts` defines `GET /eligible-robots` at line ~103 and again at line ~261. Second handler is unreachable.
- **Dead files**: `LoginPage.tsx` (superseded by FrontPage), `SystemHealthPage.tsx` (commented out in App.tsx), `RobotUpcomingMatches.pbt.test.tsx` (empty skipped stubs).
- **Placeholder modules**: `/modules/` has 5 subdirs each with only a README.md and zero code.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All currently-working README links (e.g., `CONTRIBUTING.md`, inline code blocks, external URLs) must continue to resolve
- Backend CI jobs (`backend-unit-tests`, `backend-integration-tests`, `security-audit`) must continue to run the same test commands and configurations (aside from Node version bump)
- Backend `loadEnvConfig()` default values for scheduler variables must remain identical (`'0 20 * * *'` for league, etc.)
- Frontend routing in `App.tsx` must continue to route all existing paths to their current page components
- The single remaining `/eligible-robots` handler (line ~103) must behave identically to how the endpoint works today
- The `frontend-tests` CI job must continue to run lint and build steps as before
- `.env.acc.example` must remain available and unchanged
- `.env.production.example` must remain as the canonical production env template

**Scope:**
All artifacts that do NOT match any of the 10 bug conditions should be completely unaffected. This includes:
- Backend source code (aside from the duplicate route removal)
- Frontend page components (aside from dead file deletion)
- Database schema and migrations
- All existing test files (aside from the empty stub deletion)
- Docker and Caddy configuration

## Hypothesized Root Cause

Based on the audit findings, the root causes are straightforward and well-understood:

1. **Documentation Drift**: The `docs/` directory was reorganized into subdirectories (`guides/`, `prd_core/`, `prd_pages/`, etc.) but the root `README.md` was never updated to reflect the new paths. Some referenced documents were removed entirely without cleaning up their links.

2. **Stale Progress Indicators**: The README status section was written early in development and never updated as features were completed. Auth, robot management, and battle simulation are all implemented but still marked 🚧.

3. **CI/CD Configuration Lag**: The CI pipeline was created when Node 18 was current and was never updated to Node 20 LTS. The `vitest` step was likely omitted because frontend tests were added after the CI workflow was written.

4. **Copy-Paste Duplication**: The `.env.prd.example` file is a naming variant of `.env.production.example` — likely created by a different contributor or at a different time. The duplicate route handler in `adminTournaments.ts` was likely added during a merge or feature addition without noticing the existing handler above.

5. **Incomplete Cleanup**: `LoginPage.tsx` was superseded by `FrontPage` but never deleted. `SystemHealthPage.tsx` was commented out in `App.tsx` when its functionality moved to `DashboardTab.tsx`. `RobotUpcomingMatches.pbt.test.tsx` was scaffolded but never implemented.

6. **Premature Scaffolding**: The `/modules/` directory was created as a placeholder for Phase 2+ architecture but contains no implementation code — only README placeholders.

## Correctness Properties

Property 1: Bug Condition — All Defective Artifacts Are Fixed

_For any_ project artifact where the bug condition holds (isBugCondition returns true), the fix SHALL transform that artifact into its correct state: broken links resolve to valid paths or are removed, CI uses Node 20 and runs vitest, duplicate files and dead code are deleted, env vars are documented, the duplicate route is removed, and the modules directory has a clear Phase 2 disclaimer.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

Property 2: Preservation — Non-Defective Artifacts Are Unchanged

_For any_ project artifact where the bug condition does NOT hold (isBugCondition returns false), the fix SHALL produce no change to that artifact, preserving all existing working links, CI job configurations (aside from Node version), env defaults, frontend routing, and API endpoint behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `README.md`

**Specific Changes**:
1. **Fix relocated doc links**: Update all links pointing to old flat `docs/` paths to their new subdirectory locations:
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

2. **Remove or replace non-existent doc links**: Remove entire sections referencing documents that no longer exist (matchmaking guides, weapon loadout implementation plans, GitHub issue templates, quick references, troubleshooting files that were never created). Consolidate the Documentation section to only reference files that actually exist.

3. **Update Phase 1 status indicators**: Change auth, robot management, and battle simulation from 🚧 to ✅. Update the active development list to reflect current state.

---

**File**: `.github/workflows/ci.yml`

**Specific Changes**:
4. **Update Node.js version**: Change `node-version: '18'` to `node-version: '20'` in all 4 jobs (backend-unit-tests, backend-integration-tests, frontend-tests, security-audit).

5. **Add vitest step to frontend-tests job**: Add a step after the build step:
   ```yaml
   - name: Run frontend unit tests
     working-directory: ./app/frontend
     run: npx vitest --run
   ```

---

**File**: `app/backend/.env.prd.example`

**Specific Changes**:
6. **Delete duplicate file**: Remove `.env.prd.example` entirely. `.env.production.example` is the canonical production template.

---

**File**: `app/backend/.env.example`

**Specific Changes**:
7. **Add scheduler env vars**: Append a scheduler configuration section with documented defaults:
   ```
   # Scheduler Configuration
   # Cron expressions for automated game cycle scheduling
   # LEAGUE_SCHEDULE=0 20 * * *
   # TOURNAMENT_SCHEDULE=0 8 * * *
   # TAGTEAM_SCHEDULE=0 12 * * *
   # SETTLEMENT_SCHEDULE=0 23 * * *
   # KOTH_SCHEDULE=0 16 * * 1,3,5
   ```

---

**File**: `app/backend/src/routes/adminTournaments.ts`

**Specific Changes**:
8. **Remove duplicate route handler**: Delete the second `GET /eligible-robots` handler (the block starting around line 261 through the end of the route, just before `export default router`). The first handler at line ~103 is the correct one with the proper ordering comment.

---

**Files to delete**:
9. **Remove dead code files**:
   - `app/frontend/src/pages/LoginPage.tsx` — superseded by FrontPage
   - `app/frontend/src/pages/SystemHealthPage.tsx` — commented out in App.tsx, absorbed into DashboardTab
   - `app/frontend/src/components/__tests__/RobotUpcomingMatches.pbt.test.tsx` — empty skipped test stubs

---

**Directory**: `/modules/`

**Specific Changes**:
10. **Add Phase 2 disclaimer**: Update the root-level modules directory with a clear README explaining these are reserved for future Phase 2+ modular architecture and contain no implementation code yet. Clean up or consolidate the individual placeholder READMEs.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the defects on unfixed code, then verify the fixes are correct and preserve existing behavior. Since these are primarily file-level and config-level defects (not runtime logic bugs), testing is largely structural verification rather than runtime property-based testing.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the defects BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write verification scripts/tests that check for the existence of broken links, wrong config values, duplicate files, and dead code. Run these on the UNFIXED codebase to observe failures.

**Test Cases**:
1. **Broken README Links Test**: Parse `README.md` for markdown links and verify each target file exists in the filesystem (will fail on unfixed code — 16+ broken links)
2. **CI Node Version Test**: Parse `ci.yml` and assert all `node-version` values are `'20'` (will fail on unfixed code — all 4 jobs use `'18'`)
3. **CI Vitest Step Test**: Parse `ci.yml` frontend-tests job and assert a vitest run step exists (will fail on unfixed code — no vitest step)
4. **Duplicate Env File Test**: Assert `.env.prd.example` does not exist (will fail on unfixed code — file exists)
5. **Scheduler Vars in .env.example Test**: Parse `.env.example` and assert scheduler variables are documented (will fail on unfixed code — vars missing)
6. **Duplicate Route Test**: Parse `adminTournaments.ts` and count occurrences of `'/eligible-robots'` route registration (will fail on unfixed code — 2 occurrences)
7. **Dead Files Test**: Assert `LoginPage.tsx`, `SystemHealthPage.tsx`, `RobotUpcomingMatches.pbt.test.tsx` do not exist (will fail on unfixed code — all 3 exist)

**Expected Counterexamples**:
- README link targets return "file not found" for 16+ paths
- `node-version: '18'` found in 4 CI job definitions
- No `vitest` step in frontend-tests job
- `.env.prd.example` exists as duplicate of `.env.production.example`
- Possible causes: documentation drift, CI config lag, copy-paste duplication, incomplete cleanup

### Fix Checking

**Goal**: Verify that for all artifacts where the bug condition holds, the fixed project state satisfies the expected behavior.

**Pseudocode:**
```
FOR ALL artifact WHERE isBugCondition(artifact) DO
  result := verifyFixedState(artifact)
  ASSERT expectedBehavior(result)
END FOR
```

Concretely:
- All README markdown links resolve to existing files
- All `node-version` values in `ci.yml` are `'20'`
- `frontend-tests` job contains a `vitest --run` step
- `.env.prd.example` does not exist
- `.env.example` contains all 5 scheduler variable comments
- `adminTournaments.ts` contains exactly 1 `/eligible-robots` route registration
- Dead files (`LoginPage.tsx`, `SystemHealthPage.tsx`, `RobotUpcomingMatches.pbt.test.tsx`) do not exist
- `/modules/` root README contains Phase 2 disclaimer language
- README Phase 1 status shows ✅ for completed features

### Preservation Checking

**Goal**: Verify that for all artifacts where the bug condition does NOT hold, the fixed project state is identical to the original.

**Pseudocode:**
```
FOR ALL artifact WHERE NOT isBugCondition(artifact) DO
  ASSERT originalState(artifact) == fixedState(artifact)
END FOR
```

**Testing Approach**: For this bugfix, preservation checking is best done through structural verification and existing test suites rather than property-based testing, because the changes are file edits/deletions/config updates rather than runtime logic changes. The existing backend test suite (Jest) and frontend test suite (vitest) serve as the preservation check — if all existing tests pass after the fix, behavior is preserved.

**Test Plan**: Run the full existing test suites on the fixed codebase to verify no regressions.

**Test Cases**:
1. **Backend Unit Tests Preservation**: Run `npm run test:unit` in backend — all existing tests must pass
2. **Frontend Build Preservation**: Run `npm run build` in frontend — build must succeed without the deleted files (they are not imported)
3. **Frontend Route Preservation**: Verify `App.tsx` does not import any of the deleted files (LoginPage is not imported, SystemHealthPage import is commented out)
4. **Env Defaults Preservation**: Verify `env.ts` default values for scheduler variables are unchanged
5. **Working Links Preservation**: Verify `CONTRIBUTING.md` link and other currently-working README links still resolve
6. **API Endpoint Preservation**: The first `/eligible-robots` handler remains unchanged — same response shape, same middleware chain

### Unit Tests

- Verify all README markdown links resolve to existing filesystem paths
- Verify `ci.yml` node-version is `'20'` in all jobs
- Verify `ci.yml` frontend-tests job includes vitest step
- Verify `.env.example` contains scheduler variable documentation
- Verify `adminTournaments.ts` has exactly one `/eligible-robots` route
- Verify dead files are absent from the filesystem

### Property-Based Tests

- Generate random subsets of the 10 defect categories and verify each fix is independent (fixing one doesn't break another)
- For README link verification: generate link paths from the documentation section and assert all resolve to existing files
- For env var verification: parse `env.ts` for all `process.env.*` references and assert each has a corresponding entry in `.env.example`

### Integration Tests

- Run the full CI pipeline locally (or simulate) with Node 20 to verify all jobs pass
- Run `vitest --run` on the frontend to verify the new CI step works correctly
- Verify the backend starts successfully after the duplicate route removal
- Verify the frontend builds and routes correctly after dead file deletion
