# Implementation Plan: Security Audit Guardrails

## Overview

Incremental implementation of security guardrails across the Armoured Souls backend, building on existing infrastructure (AppError, creditGuard, Helmet, express-rate-limit, Winston). Each task group wires new components into the existing request pipeline and validates correctness via property-based and unit tests. The order ensures foundational pieces (validation primitives, schema middleware) land first, then auth hardening, then authorization, then monitoring, then CI/CD, then documentation.

## Tasks

- [x] 1. Create validation primitives and schema validation middleware
  - [x] 1.1 Install Zod dependency and create `src/utils/securityValidation.ts` with reusable Zod refinements (`safeName`, `safeSlug`, `positiveInt`, `positiveIntParam`, `safeImageUrl`, `orderByColumn`, `safeEnum`, `stableName`)
    - Import and export all primitives as named exports
    - _Requirements: 1.4, 5.1, 5.2, 5.3, 5.6, 9.2_
  - [x] 1.2 Create `src/middleware/schemaValidator.ts` with the `validateRequest` middleware factory accepting `{ body?, params?, query? }` Zod schemas
    - Validate params first, then query, then body
    - Use `safeParse` and throw `AppError('VALIDATION_ERROR', ...)` with `details.fields` array on failure
    - Body parsing uses Zod's default `.strip()` to remove unknown fields (mass-assignment prevention)
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 5.6_
  - [x] 1.3 Write property tests for validation primitives (`tests/securityValidation.property.test.ts`)
    - **Property 2: Character allowlist enforcement** — generate random strings with/without allowed characters, verify accept/reject
    - **Validates: Requirements 1.4, 5.1, 9.2**
  - [x] 1.4 Write property tests for schema validator middleware (`tests/schemaValidator.property.test.ts`)
    - **Property 1: Schema validation rejects invalid fields with structured error** — generate random invalid bodies/params, verify 400 + VALIDATION_ERROR code + fields array
    - **Validates: Requirements 1.1, 1.2, 1.3**
  - [x] 1.5 Write property test for numeric parameter validation (`tests/securityValidation.property.test.ts`)
    - **Property 3: Numeric parameter validation** — generate non-numeric strings, zero, negative, floats; verify rejection
    - **Validates: Requirements 1.5, 4.5**
  - [x] 1.6 Write property test for unknown field stripping (`tests/schemaValidator.property.test.ts`)
    - **Property 4: Unknown field stripping (mass-assignment prevention)** — generate objects with extra fields, verify stripped output
    - **Validates: Requirements 1.6**
  - [x] 1.7 Write property test for image URL validation (`tests/securityValidation.property.test.ts`)
    - **Property 10: Image URL strict validation** — generate URLs with javascript:, data:, ../ patterns; verify rejection
    - **Validates: Requirements 5.2**
  - [x] 1.8 Write property test for ORDER BY allowlist (`tests/securityValidation.property.test.ts`)
    - **Property 11: ORDER BY allowlist mapping** — generate random column names vs allowlist; verify default fallback
    - **Validates: Requirements 5.3**
  - [x] 1.9 Write property test for slug path traversal prevention (`tests/securityValidation.property.test.ts`)
    - **Property 19: Slug path traversal prevention** — generate strings with .., /, %2e; verify rejection
    - **Validates: Requirements 5.6**

- [x] 2. Apply schema validation to existing routes
  - [x] 2.1 Define Zod schemas for auth routes (`src/routes/auth.ts`) — login body, register body — and wire `validateRequest` middleware before route handlers
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_
  - [x] 2.2 Define Zod schemas for user routes (`src/routes/user.ts`) — profile update body — and wire `validateRequest` middleware
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_
  - [x] 2.3 Define Zod schemas for robot routes (`src/routes/robots.ts`) — robot creation body, robot update body, URL params with `positiveIntParam` — and wire `validateRequest` middleware
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 5.2_
  - [x] 2.4 Define Zod schemas for weapon/weapon-inventory routes (`src/routes/weapons.ts`, `src/routes/weaponInventory.ts`) — purchase body, equip body, URL params — and wire `validateRequest` middleware
    - _Requirements: 1.1, 1.2, 1.5_
  - [x] 2.5 Define Zod schemas for facility routes (`src/routes/facility.ts`) — upgrade body, URL params — and wire `validateRequest` middleware
    - _Requirements: 1.1, 1.2, 1.5_
  - [x] 2.6 Define Zod schemas for remaining routes (tag teams, guide, finances, matches, leagues, leaderboards, records, tournaments, analytics, onboarding, koth, admin) — URL params, query params with `orderByColumn` and `safeSlug` where applicable — and wire `validateRequest` middleware
    - _Requirements: 1.1, 1.2, 1.5, 5.3, 5.6_

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Authentication hardening and token version
  - [x] 4.1 Add `tokenVersion Int @default(0)` column to the `User` model in `prisma/schema.prisma` and create a migration
    - _Requirements: 3.3, 3.4_
  - [x] 4.2 Modify `src/services/auth/jwtService.ts` to accept and include `tokenVersion` in the JWT payload; update `TokenPayload` interface and `generateToken` function signature
    - _Requirements: 3.3, 3.4_
  - [x] 4.3 Modify `src/middleware/auth.ts` to read JWT secret from `getConfig().jwtSecret` instead of `process.env.JWT_SECRET`; after verifying the JWT, query the database for the user's current `tokenVersion` and reject the token if it doesn't match
    - _Requirements: 3.2, 3.3, 3.4_
  - [x] 4.4 Modify `src/routes/auth.ts` login handler to read `tokenVersion` from the user record and pass it to `generateToken`; modify register handler similarly
    - _Requirements: 3.3, 3.4_
  - [x] 4.5 Modify `src/routes/user.ts` password change flow to increment `tokenVersion` in the same database update and issue a new token with the updated version in the response
    - _Requirements: 3.3, 3.4_
  - [x] 4.6 Tighten login rate limiting in `src/index.ts`: change auth limiter to 10 requests per 15-minute window (update `createAuthLimiter` in `src/middleware/rateLimiter.ts` or override config); add `LOGIN_RATE_LIMIT_WINDOW_MS` and `LOGIN_RATE_LIMIT_MAX` to `src/config/env.ts`
    - _Requirements: 3.1_
  - [x] 4.7 Write property test for token version invalidation (`tests/tokenVersion.property.test.ts`)
    - **Property 6: Token version invalidation round-trip** — generate random users, issue token, increment tokenVersion, verify old token rejected and new token accepted
    - **Validates: Requirements 3.3, 3.4**
  - [x] 4.8 Write property test for JWT expiration bound (`tests/jwtExpiration.property.test.ts`)
    - **Property 7: JWT expiration bound** — generate tokens, verify exp - iat <= 86400
    - **Validates: Requirements 3.6**

- [x] 5. Ownership verification and IDOR prevention
  - [x] 5.1 Create `src/middleware/ownership.ts` with `verifyRobotOwnership`, `verifyWeaponOwnership`, `verifyFacilityOwnership` functions that accept a Prisma transaction client, resource ID, and user ID; throw `AppError('FORBIDDEN', 'Access denied', 403)` on mismatch or not-found
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.2 Apply ownership verification calls in robot mutation routes (`src/routes/robots.ts`) — use ownership helpers inside transaction boundaries where applicable
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.3 Apply ownership verification calls in weapon inventory routes (`src/routes/weaponInventory.ts`) and facility routes (`src/routes/facility.ts`)
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.4 Audit and enforce sensitive field stripping on the public robots endpoint (`/api/robots/all/robots` or equivalent) using the `SENSITIVE_ROBOT_FIELDS` constant — ensure non-owners never see battle config, combat state, or equipment IDs
    - _Requirements: 4.4_
  - [x] 5.5 Write property test for ownership verification (`tests/ownership.property.test.ts`)
    - **Property 8: Ownership verification returns generic 403** — generate random user/resource pairs with mismatched ownership, verify 403 + generic message
    - **Validates: Requirements 4.1, 4.2**
  - [x] 5.6 Write property test for sensitive field stripping (`tests/robotSanitization.property.test.ts`)
    - **Property 9: Sensitive field stripping for non-owners** — generate random robot objects, verify SENSITIVE_ROBOT_FIELDS absent from public response
    - **Validates: Requirements 4.4**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Security monitoring and logging
  - [x] 7.1 Create `src/services/security/securityLogger.ts` — dedicated Winston child logger writing structured JSON to `logs/security.log` with `SecuritySeverity` enum and `SecurityEvent` interface
    - _Requirements: 7.6_
  - [x] 7.2 Create `src/services/security/securityMonitor.ts` — singleton `SecurityMonitor` class with in-memory sliding windows for: rapid spending (Req 7.1), conflict tracking (Req 7.2), authorization failures (Req 7.3), validation failures (Req 7.4), robot creation (Req 7.5), rate limit violations (Req 6.6); circular buffer of 500 recent events; `getRecentEvents` and `getSummary` methods for admin API
    - _Requirements: 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [x] 7.3 Integrate security monitor calls into existing middleware and routes: call `trackSpending` in economic transaction handlers, `trackConflict` on 409 responses in error handler, `logAuthorizationFailure` in ownership helpers on 403, `logValidationFailure` in schema validator on 400, `trackRobotCreation` in robot creation route
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 7.4 Add admin security dashboard endpoints to `src/routes/admin.ts`: `GET /api/admin/security/events` (with severity/eventType/userId/since/limit query filters) and `GET /api/admin/security/summary` (event counts by severity, active alerts, flagged users) — both protected by `authenticateToken` + `requireAdmin`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [x] 7.5 Write property tests for security monitor (`tests/securityMonitor.property.test.ts`)
    - **Property 14: Rapid spending alert threshold** — generate spending sequences exceeding 3M in 5min window, verify critical alert
    - **Property 15: Race condition conflict detection** — generate >10 conflicts in 1min, verify warning alert
    - **Property 16: Security event logging completeness** — verify 403 logs contain userId/resourceType/resourceId; verify validation failures contain endpoint/violationType/sourceIp
    - **Property 17: Robot creation automation detection** — generate >3 creations in 10min, verify warning alert
    - **Property 18: Rate limit violation escalation** — generate >5 rate limit hits in 1hr, verify warning alert
    - **Validates: Requirements 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

- [x] 8. Per-user rate limiting for economic endpoints
  - [x] 8.1 Create `src/middleware/userRateLimiter.ts` with `createUserEconomicLimiter` — uses `express-rate-limit` with `keyGenerator` based on `authReq.user.userId`; 60 req/min per user; on limit exceeded, call `securityMonitor.trackRateLimitViolation` and return 429 with `Retry-After` header
    - _Requirements: 6.4, 6.6_
  - [x] 8.2 Mount the user economic limiter in `src/index.ts` on economic route prefixes (`/api/weapons`, `/api/weapon-inventory`, `/api/facilities`, `/api/robots`) after auth middleware
    - _Requirements: 6.4_
  - [x] 8.3 Verify existing IP-based rate limiters: confirm general limiter is 300 req/min (Req 6.2), auth limiter uses `X-Forwarded-For` via `trust proxy` (Req 6.5), and 429 responses include `Retry-After` header (Req 6.3)
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [x] 9. Helmet.js, HSTS, and security headers configuration
  - [x] 9.1 Update Helmet.js configuration in `src/index.ts` with explicit CSP directives (`defaultSrc: ["'self'"]`, `scriptSrc: ["'self'"]`, `styleSrc: ["'self'", "'unsafe-inline'"]`, `imgSrc: ["'self'", "data:", "https:"]`), HSTS (`maxAge: 31536000`, `includeSubDomains: true`), and `referrerPolicy: 'strict-origin-when-cross-origin'`
    - _Requirements: 5.5, 10.3, 10.5_
  - [x] 9.2 Write property test for security headers (`tests/securityHeaders.property.test.ts`)
    - **Property 13: Security headers present on all responses** — verify CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and HSTS headers on responses
    - **Validates: Requirements 5.5, 10.3, 10.5**

- [x] 10. Error handler sanitization verification
  - [x] 10.1 Audit `src/middleware/errorHandler.ts` to confirm unknown errors return fixed generic message and never reflect user input; add explicit test coverage if gaps found
    - _Requirements: 5.4_
  - [x] 10.2 Write property test for error message sanitization (`tests/errorHandler.property.test.ts`)
    - **Property 12: Error message sanitization** — generate random error messages with HTML/script tags, verify response body does not contain raw unsanitized input
    - **Validates: Requirements 5.4**

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Database constraints and transaction integrity
  - [x] 12.1 Create a Prisma migration adding a CHECK constraint on the `currency` column: `CHECK (currency >= -10000000)` via raw SQL in the migration file
    - _Requirements: 2.4_
  - [x] 12.2 Audit all economic endpoints (weapon purchase, facility upgrade, robot creation, attribute upgrade) to confirm they use `lockUserForSpending` inside a Prisma interactive transaction and re-read mutable state after acquiring the lock — document any gaps and fix them
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  - [x] 12.3 Verify `pg_advisory_xact_lock` usage for multi-row serialization operations (tag team creation, multi-robot operations) — add if missing
    - _Requirements: 2.6_
  - [x] 12.4 Write property test for currency floor constraint (`tests/currencyConstraint.property.test.ts`)
    - **Property 5: Currency floor constraint** — generate random negative values below -10M, verify database rejects the update
    - **Validates: Requirements 2.4**

- [x] 13. CI/CD security scanning
  - [x] 13.1 Update `.github/workflows/ci.yml` `security-audit` job: change `npm audit` to fail on `high` or `critical` (`--audit-level=high`, remove `|| true`); add `npm audit --json` step producing a report artifact; add allowlist check step that reads `.security-audit-allowlist.json`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 13.2 Create `.security-audit-allowlist.json` at project root with empty allowlist array and documented schema (id, package, justification, reviewDate, nextReviewDate)
    - _Requirements: 8.4_
  - [x] 13.3 Install `eslint-plugin-security` and add security rules to `app/backend/eslint.config.mjs` — flag `eval()`, dynamic `require()`, hardcoded secrets, unparameterized queries
    - _Requirements: 8.5_

- [x] 14. CORS and transport security verification
  - [x] 14.1 Verify CORS configuration in `src/index.ts`: production uses explicit allowlist from `config.corsOrigins`, development permits all origins — add a comment documenting CSRF note for future cookie-based auth (Req 10.4); verify Caddy enforces HTTPS and TLS 1.2+ (Req 10.6) in `Caddyfile`
    - _Requirements: 10.1, 10.2, 10.4, 10.6_

- [x] 15. Documentation updates
  - [x] 15.1 Update `docs/guides/SECURITY.md` — add security playbook section documenting all known exploit patterns (race conditions on balance checks, stored XSS via name fields, path traversal via slugs, ORDER BY injection, duplicate equip via concurrent requests, imageUrl protocol injection) with detection signatures and prevention patterns; add transaction integrity pattern with `lockUserForSpending` code example; add input validation pattern with Zod schema example
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x] 15.2 Update `docs/guides/SECURITY_ADVISORY.md` — add vulnerability allowlist process, dependency scanning changes, and `eslint-plugin-security` integration
    - _Requirements: 8.4, 9.4_
  - [x] 15.3 Update `.kiro/steering/error-handling-logging.md` — add security logger as a new logging channel, document `SecurityEvent` format and `logs/security.log` transport
    - _Requirements: 7.6_
  - [x] 15.4 Update `.kiro/steering/coding-standards.md` — add Zod schema validation requirement for new routes, ownership verification pattern, `lockUserForSpending` requirement for economic endpoints, `eslint-plugin-security` rules
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6_
  - [x] 15.5 Update `.kiro/steering/pre-deployment-checklist.md` — add security scanning verification steps (npm audit passes, ESLint security rules pass, allowlist reviewed)
    - _Requirements: 8.1, 8.5_
  - [x] 15.6 Update `docs/guides/ERROR_CODES.md` — add `VALIDATION_ERROR`, `FORBIDDEN`, `RATE_LIMIT_EXCEEDED` error codes with descriptions, HTTP status codes, and example payloads
    - _Requirements: 1.2, 4.2, 6.3_

- [x] 16. Final verification
  - [x] 16.1 Run full test suite (`npm run test:unit` and `npm run test:integration`) and confirm all tests pass
    - Ensure all tests pass, ask the user if questions arise.
  - [x] 16.2 Run `npm run lint` and confirm no ESLint errors (including new security rules)
  - [x] 16.3 Verify requirements coverage: confirm every acceptance criterion from requirements 1–10 is addressed by at least one implemented task
  - [x] 16.4 Run verification checks:
    - `grep -r "validateRequest" app/backend/src/routes/ | wc -l` — confirm schema validation applied to all route files
    - `grep -r "verifyRobotOwnership\|verifyWeaponOwnership\|verifyFacilityOwnership" app/backend/src/routes/ | wc -l` — confirm ownership checks in mutation routes
    - `grep -r "getConfig().jwtSecret\|getConfig\\(\\).jwtSecret" app/backend/src/ | wc -l` — confirm JWT secret loaded from EnvConfig, not process.env
    - `grep -r "process.env.JWT_SECRET" app/backend/src/ --include="*.ts" | grep -v node_modules | grep -v ".test."` — confirm no direct process.env.JWT_SECRET reads remain in application code
    - `grep -r "securityMonitor" app/backend/src/ | wc -l` — confirm security monitor integrated across middleware and routes
    - `grep "tokenVersion" app/backend/prisma/schema.prisma` — confirm tokenVersion column exists
    - `npm audit --audit-level=high` in `app/backend/` — confirm no high/critical vulnerabilities
    - Verify `logs/security.log` transport configured in securityLogger
    - Verify `.security-audit-allowlist.json` exists with valid schema

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementations use TypeScript
