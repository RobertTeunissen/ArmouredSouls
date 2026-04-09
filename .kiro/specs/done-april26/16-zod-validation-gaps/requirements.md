# Requirements Document

## Introduction

Add Zod schema validation to all route handlers that currently lack it. The project's coding standards require every route handler to have a Zod schema for params, query, and/or body validated via the `validateRequest` middleware. An audit found 69 route handlers across 21 files missing this validation, with the admin routes (22 of 23 handlers) being the largest gap.

## Glossary

- **validateRequest**: The middleware from `src/middleware/schemaValidator.ts` that validates request params, query, and body against Zod schemas, stripping unknown fields.
- **Security Primitives**: Reusable Zod types from `src/utils/securityValidation.ts` (`safeName`, `safeSlug`, `positiveIntParam`, `safeImageUrl`, `orderByColumn`).
- **Mass Assignment**: An attack where unexpected fields in a request body are processed by the server. Zod's `.strip()` mode prevents this by removing unknown fields.

## Expected Contribution

This spec closes the input validation gap identified in the codebase audit, bringing the project into full compliance with its own coding standards. After completion, every route handler in the project uses `validateRequest`.

1. **Admin route validation**: From 1 of 23 handlers validated to 23 of 23 (22 handlers added).
2. **Finances route validation**: From 1 of 7 handlers validated to 7 of 7 (6 handlers added).
3. **Analytics route validation**: From 9 of 15 handlers validated to 15 of 15 (6 handlers added).
4. **Onboarding route validation**: From 0 of 6 handlers validated to 6 of 6.
5. **Leaderboards route validation**: From 0 of 3 handlers validated to 3 of 3.
6. **Admin tournaments route validation**: From 2 of 5 handlers validated to 5 of 5 (3 handlers added).
7. **Robots route validation**: From 14 of 17 handlers validated to 17 of 17 (3 handlers added).
8. **Remaining routes validation**: 15 handlers across 12 files — matches (2), practiceArena (2), onboardingAnalytics (2), user (2), weaponInventory (2), guide (2), auth (1), facility (1), stables (1), tagTeams (1), tournaments (1), weapons (1), koth (1), records (1).

### Verification Criteria

1. For each route file, count route handlers and `validateRequest` calls — they must match:
   - `grep -c "router\.\(get\|post\|put\|delete\)" app/backend/src/routes/<file>` equals `grep "router\.\(get\|post\|put\|delete\)" app/backend/src/routes/<file> | grep -c "validateRequest"` for every `.ts` file in the routes directory.
2. All backend tests pass: `cd app/backend && npm test`
3. `grep -rn "router\.\(get\|post\|put\|delete\)" app/backend/src/routes/ | grep -v "validateRequest"` returns zero matches (every route handler uses validation).
4. `cd app/backend && npm run lint` passes with zero errors from the `custom-routes/require-validate-request` rule.

## Requirements

### Requirement 1: Admin Route Validation

**User Story:** As a security-conscious developer, I want all admin route handlers to validate input with Zod schemas, so that admin endpoints are protected against malformed input and mass assignment.

#### Acceptance Criteria

1. WHEN admin route handlers accept path parameters (e.g., `/:id`), THEY SHALL validate params using `positiveIntParam` from security primitives.
2. WHEN admin route handlers accept query parameters (e.g., pagination, filters), THEY SHALL validate query using Zod schemas with appropriate types and defaults.
3. WHEN admin route handlers accept request bodies, THEY SHALL validate body using Zod schemas that whitelist expected fields.
4. WHEN all admin routes are validated, ALL 23 handlers in `admin.ts` SHALL use the `validateRequest` middleware.

### Requirement 2: Finances Route Validation

**User Story:** As a security-conscious developer, I want all finances route handlers to validate input with Zod schemas.

#### Acceptance Criteria

1. WHEN finances route handlers accept query parameters (e.g., date ranges, pagination), THEY SHALL validate query using Zod schemas.
2. WHEN all finances routes are validated, ALL 7 handlers in `finances.ts` SHALL use the `validateRequest` middleware.

### Requirement 3: Analytics Route Validation

**User Story:** As a security-conscious developer, I want all analytics route handlers to validate input with Zod schemas.

#### Acceptance Criteria

1. WHEN analytics route handlers accept query parameters, THEY SHALL validate query using Zod schemas.
2. WHEN all analytics routes are validated, ALL 15 handlers in `analytics.ts` SHALL use the `validateRequest` middleware.

### Requirement 4: Onboarding Route Validation

**User Story:** As a security-conscious developer, I want all onboarding route handlers to validate input with Zod schemas.

#### Acceptance Criteria

1. WHEN onboarding route handlers accept request bodies (e.g., step completion, reset), THEY SHALL validate body using Zod schemas.
2. WHEN all onboarding routes are validated, ALL 6 handlers in `onboarding.ts` SHALL use the `validateRequest` middleware.

### Requirement 5: Leaderboards Route Validation

**User Story:** As a security-conscious developer, I want all leaderboard route handlers to validate input with Zod schemas.

#### Acceptance Criteria

1. WHEN leaderboard route handlers accept query parameters, THEY SHALL validate query using Zod schemas. ALL 3 handlers SHALL use `validateRequest`.

### Requirement 6: Admin Tournaments Route Validation

**User Story:** As a security-conscious developer, I want all admin tournament route handlers to validate input with Zod schemas.

#### Acceptance Criteria

1. WHEN admin tournament route handlers accept request bodies or query parameters, THEY SHALL validate using Zod schemas. ALL 5 handlers in `adminTournaments.ts` SHALL use `validateRequest`.

### Requirement 7: Robots Route Validation

**User Story:** As a security-conscious developer, I want all remaining unvalidated robot route handlers to use Zod schemas.

#### Acceptance Criteria

1. WHEN robot route handlers accept query parameters or have no input, THEY SHALL use `validateRequest`. ALL 17 handlers in `robots.ts` SHALL use `validateRequest`.

### Requirement 8: Remaining Route Validation

**User Story:** As a security-conscious developer, I want all remaining unvalidated route handlers across all files to use Zod schemas.

#### Acceptance Criteria

1. WHEN the 2 unvalidated matches handlers accept query parameters, THEY SHALL use `validateRequest`. All 3 handlers in `matches.ts` SHALL use `validateRequest`.
2. WHEN the 2 unvalidated practiceArena handlers exist, THEY SHALL use `validateRequest`. All 2 handlers in `practiceArena.ts` SHALL use `validateRequest`.
3. WHEN the 2 unvalidated onboardingAnalytics handlers exist, THEY SHALL use `validateRequest`. All 2 handlers in `onboardingAnalytics.ts` SHALL use `validateRequest`.
4. WHEN the 2 unvalidated user handlers exist, THEY SHALL use `validateRequest`. All 3 handlers in `user.ts` SHALL use `validateRequest`.
5. WHEN the 2 unvalidated weaponInventory handlers exist, THEY SHALL use `validateRequest`. All 4 handlers in `weaponInventory.ts` SHALL use `validateRequest`.
6. WHEN the 2 unvalidated guide handlers exist, THEY SHALL use `validateRequest`. All 3 handlers in `guide.ts` SHALL use `validateRequest`.
7. WHEN the 1 unvalidated auth handler (logout) exists, IT SHALL use `validateRequest`. All 3 handlers in `auth.ts` SHALL use `validateRequest`.
8. WHEN the 1 unvalidated facility handler exists, IT SHALL use `validateRequest`. All 2 handlers in `facility.ts` SHALL use `validateRequest`.
9. WHEN the 1 unvalidated stables handler exists, IT SHALL use `validateRequest`. All 1 handler in `stables.ts` SHALL use `validateRequest`.
10. WHEN the 1 unvalidated tagTeams handler exists, IT SHALL use `validateRequest`. All 5 handlers in `tagTeams.ts` SHALL use `validateRequest`.
11. WHEN the 1 unvalidated tournaments handler exists, IT SHALL use `validateRequest`. All 2 handlers in `tournaments.ts` SHALL use `validateRequest`.
12. WHEN the 1 unvalidated weapons handler exists, IT SHALL use `validateRequest`. All 1 handler in `weapons.ts` SHALL use `validateRequest`.
13. WHEN the 1 unvalidated koth handler exists, IT SHALL use `validateRequest`. All 1 handler in `koth.ts` SHALL use `validateRequest`.
14. WHEN the 1 unvalidated records handler exists, IT SHALL use `validateRequest`. All 1 handler in `records.ts` SHALL use `validateRequest`.

### Requirement 9: Schema Reuse

**User Story:** As a backend developer, I want validation schemas to reuse existing security primitives, so that validation logic is consistent and centralized.

#### Acceptance Criteria

1. WHEN new Zod schemas are created, THEY SHALL import and use primitives from `src/utils/securityValidation.ts` where applicable (e.g., `positiveIntParam` for ID params, `safeName` for string inputs).
2. WHEN new reusable primitives are needed (e.g., pagination query schema), THEY SHALL be added to `securityValidation.ts` for project-wide reuse.

### Requirement 10: Automated Enforcement

**User Story:** As a backend developer, I want an ESLint rule that prevents adding route handlers without `validateRequest`, so that 100% validation coverage cannot regress.

#### Acceptance Criteria

1. WHEN a developer adds a `router.get/post/put/delete/patch` call in any file under `src/routes/` without `validateRequest` in its middleware chain, the ESLint rule SHALL report an error.
2. WHEN `npm run lint` is executed, IT SHALL fail if any route handler is missing `validateRequest`.
3. WHEN all existing route handlers already have `validateRequest`, the ESLint rule SHALL pass with zero errors.
