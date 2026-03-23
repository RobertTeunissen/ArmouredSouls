# Bugfix Requirements Document

## Introduction

A comprehensive quality and assurance audit of the Armoured Souls project revealed multiple categories of defects spanning broken documentation links, dead code, CI/CD misconfigurations, missing environment variable documentation, and duplicate files. These issues degrade developer experience, mask test failures in CI, and create confusion for contributors. This bugfix addresses the concrete, well-scoped findings (items 1–7 from the audit).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a developer clicks documentation links in the root README.md THEN the system returns 404 errors for 16+ links that point to old flat `docs/` paths (e.g., `docs/SETUP.md`, `docs/ROBOT_ATTRIBUTES.md`, `docs/ARCHITECTURE.md`) because docs were reorganized into subdirectories (`docs/guides/`, `docs/prd_core/`, etc.)

1.2 WHEN a developer clicks README links to documents that were never migrated or were removed THEN the system returns 404 errors for non-existent files (e.g., `docs/TROUBLESHOOTING_DATABASE_URL.md`, `docs/MATCHMAKING_TESTING_GUIDE.md`, `docs/MATCHMAKING_SYSTEM_GUIDE.md`, `docs/IMPLEMENTATION_PLAN_MATCHMAKING.md`, `docs/GITHUB_ISSUES_MATCHMAKING.md`, `docs/QUICK_REFERENCE_MATCHMAKING.md`, `docs/IMPLEMENTATION_PLAN_WEAPON_LOADOUT.md`, `docs/GITHUB_ISSUES_WEAPON_LOADOUT.md`, `docs/QUICK_REFERENCE_WEAPON_LOADOUT.md`, `docs/QUICK_REFERENCE_ECONOMY_SYSTEM.md`, `docs/MY_ROBOTS_PAGE_DOCS_INDEX.md`, `docs/MY_ROBOTS_PAGE_README.md`, `docs/PRD_MY_ROBOTS_LIST_PAGE.md`, `docs/PHASE1_PLAN.md`, `docs/TESTING_STRATEGY.md`, `docs/QUESTIONS.md`)

1.3 WHEN a developer reads the README Phase 1 status section THEN the system displays inaccurate progress indicators showing auth and battle simulation as 🚧 (in progress) when these features are fully implemented

1.4 WHEN the CI/CD pipeline runs on GitHub Actions THEN the system uses Node.js 18 (`.github/workflows/ci.yml` specifies `node-version: '18'`) while the project standard is Node.js 20 LTS as documented in `project-overview.md`

1.5 WHEN the CI/CD `frontend-tests` job executes THEN the system only runs lint and build steps but does not execute `vitest`, causing 104 frontend test failures to go undetected in CI

1.6 WHEN a developer looks at production environment examples THEN the system contains two identical files (`.env.prd.example` and `.env.production.example`) with the same content, creating confusion about which is canonical

1.7 WHEN a developer copies `.env.example` to set up their local environment THEN the system does not include scheduler-related environment variables (`LEAGUE_SCHEDULE`, `TOURNAMENT_SCHEDULE`, `TAGTEAM_SCHEDULE`, `SETTLEMENT_SCHEDULE`, `KOTH_SCHEDULE`) that are consumed by `src/config/env.ts`, leaving developers unaware of configurable scheduler settings

1.8 WHEN Express processes requests to `GET /api/admin/tournaments/eligible-robots` THEN the system has a duplicate route handler defined at both line 103 and line 261 of `adminTournaments.ts`, where the second handler is unreachable dead code

1.9 WHEN the codebase is inspected for unused files THEN the system contains dead code: `LoginPage.tsx` (not imported in App.tsx, superseded by FrontPage), `SystemHealthPage.tsx` (commented out in App.tsx, functionality absorbed into DashboardTab.tsx at 354 lines), and `RobotUpcomingMatches.pbt.test.tsx` (contains only empty skipped test stubs)

1.10 WHEN the codebase is inspected for unused directories THEN the system contains the `/modules/` directory with 5 subdirectories (`api/`, `auth/`, `database/`, `game-engine/`, `ui/`) each containing only a placeholder README.md with zero implementation code

### Expected Behavior (Correct)

2.1 WHEN a developer clicks documentation links in the root README.md THEN the system SHALL resolve all links to their correct paths in the reorganized directory structure (e.g., `docs/guides/SETUP.md`, `docs/prd_core/PRD_ROBOT_ATTRIBUTES.md`, `docs/prd_core/ARCHITECTURE.md`, `docs/prd_core/PRD_MATCHMAKING.md`, `docs/prd_core/PRD_ECONOMY_SYSTEM.md`, `docs/prd_core/PRD_PRESTIGE_AND_FAME.md`, `docs/prd_core/STABLE_SYSTEM.md`, `docs/prd_core/GAME_DESIGN.md`, `docs/guides/MODULE_STRUCTURE.md`, `docs/guides/SECURITY.md`, `docs/guides/PORTABILITY.md`, `docs/prd_core/PRD_WEAPONS_LOADOUT.md`)

2.2 WHEN a developer clicks README links to documents that no longer exist THEN the system SHALL either remove the broken links and their containing sections, or point them to the closest existing equivalent (e.g., `docs/PRD_WEAPON_LOADOUT.md` → `docs/prd_core/PRD_WEAPONS_LOADOUT.md`, `docs/PRD_MY_ROBOTS_LIST_PAGE.md` → `docs/prd_pages/PRD_ROBOTS_LIST_PAGE.md`)

2.3 WHEN a developer reads the README Phase 1 status section THEN the system SHALL display accurate progress indicators reflecting that authentication, robot management, and battle simulation are complete (✅), and list current active development areas accurately

2.4 WHEN the CI/CD pipeline runs on GitHub Actions THEN the system SHALL use Node.js 20 LTS (`node-version: '20'`) across all jobs to match the project's documented runtime requirement

2.5 WHEN the CI/CD `frontend-tests` job executes THEN the system SHALL run `vitest --run` (single execution, non-watch mode) to execute frontend unit tests and report failures, in addition to the existing lint and build steps

2.6 WHEN a developer looks at production environment examples THEN the system SHALL contain only one canonical production environment example file (`.env.production.example`), with the duplicate `.env.prd.example` removed

2.7 WHEN a developer copies `.env.example` to set up their local environment THEN the system SHALL include documented scheduler-related environment variables (`LEAGUE_SCHEDULE`, `TOURNAMENT_SCHEDULE`, `TAGTEAM_SCHEDULE`, `SETTLEMENT_SCHEDULE`, `KOTH_SCHEDULE`) with their default values and descriptions

2.8 WHEN Express processes requests to `GET /api/admin/tournaments/eligible-robots` THEN the system SHALL have exactly one route handler for this endpoint, with the duplicate at line 261 of `adminTournaments.ts` removed

2.9 WHEN the codebase is inspected for unused files THEN the system SHALL not contain dead code files: `LoginPage.tsx`, `SystemHealthPage.tsx`, and `RobotUpcomingMatches.pbt.test.tsx` SHALL be removed

2.10 WHEN the codebase is inspected for unused directories THEN the `/modules/` directory SHALL either be removed or have a clear README at the root level explaining it is reserved for future Phase 2+ development, with the empty placeholder subdirectory READMEs cleaned up

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a developer clicks README links that currently resolve correctly (e.g., `CONTRIBUTING.md`, inline code examples, external URLs) THEN the system SHALL CONTINUE TO resolve those links without changes

3.2 WHEN the CI/CD pipeline runs backend unit tests, backend integration tests, and security audit jobs THEN the system SHALL CONTINUE TO execute those jobs with the same test commands and configurations (aside from the Node.js version update)

3.3 WHEN the backend application starts and loads environment configuration THEN the system SHALL CONTINUE TO use the same default values for scheduler variables when environment variables are not set (as defined in `src/config/env.ts`)

3.4 WHEN the frontend application routes requests THEN the system SHALL CONTINUE TO route `/login` to `FrontPage` and all other existing routes to their current page components without disruption

3.5 WHEN the backend processes API requests to all existing endpoints THEN the system SHALL CONTINUE TO handle requests identically, with the single remaining `/eligible-robots` handler behaving the same as the current first handler

3.6 WHEN the CI/CD pipeline runs the `frontend-tests` job THEN the system SHALL CONTINUE TO execute lint and build steps as before, with the vitest step added as an additional check

3.7 WHEN a developer uses `.env.acc.example` for acceptance environment setup THEN the system SHALL CONTINUE TO have that file available and unchanged
