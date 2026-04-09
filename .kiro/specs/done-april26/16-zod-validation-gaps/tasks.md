# Implementation Plan: Zod Validation Gap Closure

## Overview

Add Zod schema validation to all 69 route handlers currently missing it across 21 files, starting with shared primitives, then working through each route file grouped by size of gap.

## Tasks

- [x] 1. Add shared pagination schema
  - [x] 1.1 Add `paginationQuery` Zod schema to `src/utils/securityValidation.ts` with `page` (positive int, default 1), `limit` (positive int, max 100, default 20), and `search` (string, max 200, optional)
  - [x] 1.2 Write unit tests for the new `paginationQuery` schema (valid input, boundary values, defaults, rejection of invalid types)
  - _Requirements: 9.1, 9.2_

- [x] 2. Add validation to admin routes (22 handlers in `admin.ts`)
  - [x] 2.1 Define Zod schemas for all 22 unvalidated admin route handlers at the top of `admin.ts`
  - [x] 2.2 Add `validateRequest` middleware to all 22 unvalidated admin route handlers
  - [x] 2.3 Write tests verifying that admin endpoints reject invalid input (malformed IDs, invalid pagination, unexpected body fields)
  - [x] 2.4 Run full backend test suite to verify no regressions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 9.1_

- [x] 3. Add validation to finances routes (6 handlers in `finances.ts`)
  - [x] 3.1 Define Zod schemas for all 6 unvalidated finances route handlers
  - [x] 3.2 Add `validateRequest` middleware to all 6 unvalidated finances route handlers
  - [x] 3.3 Write tests verifying that finances endpoints reject invalid input
  - [x] 3.4 Run full backend test suite to verify no regressions
  - _Requirements: 2.1, 2.2, 9.1_

- [x] 4. Add validation to analytics routes (6 handlers in `analytics.ts`)
  - [x] 4.1 Define Zod schemas for all 6 unvalidated analytics route handlers
  - [x] 4.2 Add `validateRequest` middleware to all 6 unvalidated analytics route handlers
  - [x] 4.3 Write tests verifying that analytics endpoints reject invalid input
  - [x] 4.4 Run full backend test suite to verify no regressions
  - _Requirements: 3.1, 3.2, 9.1_

- [x] 5. Add validation to onboarding routes (6 handlers in `onboarding.ts`)
  - [x] 5.1 Define Zod schemas for all 6 onboarding route handlers
  - [x] 5.2 Add `validateRequest` middleware to all 6 onboarding route handlers
  - [x] 5.3 Write tests verifying that onboarding endpoints reject invalid input
  - [x] 5.4 Run full backend test suite to verify no regressions
  - _Requirements: 4.1, 4.2, 9.1_

- [x] 6. Add validation to leaderboards, admin tournaments, and robots routes (9 handlers across 3 files)
  - [x] 6.1 Define Zod schemas and add `validateRequest` to all 3 leaderboard route handlers in `leaderboards.ts`
  - [x] 6.2 Define Zod schemas and add `validateRequest` to all 3 unvalidated admin tournament route handlers in `adminTournaments.ts`
  - [x] 6.3 Define Zod schemas and add `validateRequest` to all 3 unvalidated robot route handlers in `robots.ts`
  - [x] 6.4 Write tests verifying that these endpoints reject invalid input
  - [x] 6.5 Run full backend test suite to verify no regressions
  - _Requirements: 5.1, 6.1, 7.1, 9.1_

- [x] 7. Add validation to remaining routes (15 handlers across 14 files)
  - [x] 7.1 Define Zod schemas and add `validateRequest` to the 2 unvalidated matches handlers in `matches.ts`
  - [x] 7.2 Define Zod schemas and add `validateRequest` to the 2 unvalidated practiceArena handlers in `practiceArena.ts`
  - [x] 7.3 Define Zod schemas and add `validateRequest` to the 2 unvalidated onboardingAnalytics handlers in `onboardingAnalytics.ts`
  - [x] 7.4 Define Zod schemas and add `validateRequest` to the 2 unvalidated user handlers in `user.ts`
  - [x] 7.5 Define Zod schemas and add `validateRequest` to the 2 unvalidated weaponInventory handlers in `weaponInventory.ts`
  - [x] 7.6 Define Zod schemas and add `validateRequest` to the 2 unvalidated guide handlers in `guide.ts`
  - [x] 7.7 Define Zod schemas and add `validateRequest` to the 1 unvalidated auth handler in `auth.ts`, the 1 unvalidated facility handler in `facility.ts`, the 1 unvalidated stables handler in `stables.ts`, the 1 unvalidated tagTeams handler in `tagTeams.ts`, the 1 unvalidated tournaments handler in `tournaments.ts`, the 1 unvalidated weapons handler in `weapons.ts`, the 1 unvalidated koth handler in `koth.ts`, and the 1 unvalidated records handler in `records.ts`
  - [x] 7.8 Run full backend test suite to verify no regressions
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14, 9.1_

- [x] 8. Add custom ESLint rule to enforce validateRequest on all routes
  - [x] 8.1 Create `app/backend/eslint-rules/require-validate-request.js` with a custom ESLint rule that reports an error on any `router.get/post/put/delete/patch` call in `src/routes/` that does not include `validateRequest` in its middleware chain
  - [x] 8.2 Add the custom rule plugin to `app/backend/eslint.config.mjs`, scoped to `src/routes/**/*.ts` files, at error level
  - [x] 8.3 Run `npm run lint` and confirm zero errors (all routes now have `validateRequest`)
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 9. Documentation and verification
  - [x] 9.1 Update `docs/guides/SECURITY.md` to document the `custom-routes/require-validate-request` ESLint rule that enforces 100% route validation coverage
  - [x] 9.2 Update `.kiro/steering/coding-standards.md` to add a note in the "Zod Schema Validation" section that the `custom-routes/require-validate-request` ESLint rule enforces this automatically
  - [x] 9.3 Run verification criteria: for each route file, confirm route handler count equals `validateRequest` count; confirm `grep -rn "router\.\(get\|post\|put\|delete\)" app/backend/src/routes/ | grep -v "validateRequest"` returns zero matches; confirm `npm run lint` passes; confirm all backend tests pass
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1, 6.1, 7.1, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14, 9.1, 9.2, 10.1, 10.2, 10.3_
