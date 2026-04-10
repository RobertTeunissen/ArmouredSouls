# Implementation Plan: Admin Password Reset

## Overview

Implement a secure, auditable admin password reset feature for Armoured Souls. The implementation follows the layered architecture from the design: a reusable `PasswordResetService` (transactional core), Express route handlers appended to the existing admin router, and a `PasswordResetTab` React component in the admin portal. All existing components from the reuse table are consumed directly — zero duplication.

## Tasks

- [x] 1. Create the PasswordResetService
  - [x] 1.1 Create `app/backend/src/services/auth/passwordResetService.ts`
    - Define `ResetInitiator` interface (`initiatorId: number`, `resetType: string`)
    - Define `ResetResult` interface (`userId: number`, `username: string`)
    - Implement `resetPassword(targetUserId, newPassword, initiator)` function
    - Use `prisma.$transaction` (interactive mode) to atomically: look up user (throw `AppError` USER_NOT_FOUND 404 if missing), call `hashPassword()` from `passwordService.ts`, update `passwordHash` and increment `tokenVersion` by 1, write `AuditLog` entry with `eventType: "admin_password_reset"` and payload `{ adminId, targetUserId, resetType }` (no password/hash in payload), `cycleNumber: 0`
    - Include JSDoc documenting public interface, parameters, return values, and extension points for future reset flows (e.g., email-token self-service)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 7.1, 7.2, 12.3_

  - [x] 1.2 Write unit tests for PasswordResetService in `app/backend/src/__tests__/services/auth/passwordResetService.test.ts`
    - Test successful reset: hash updated, tokenVersion incremented, audit log created with correct fields
    - Test non-existent user: throws 404 AppError
    - Test transaction rollback on DB failure: mock Prisma error mid-transaction, verify no partial writes
    - Test audit log contains correct fields (adminId, targetUserId, resetType) and does NOT contain password or hash
    - Test tokenVersion is incremented by exactly 1
    - _Requirements: 11.1, 11.4, 11.5_

  - [x] 1.3 Write property-based tests for PasswordResetService in `app/backend/src/__tests__/services/auth/passwordResetService.test.ts`
    - **Property 5: Hash verification round-trip** — for any valid password (8–128 chars, uppercase + lowercase + digit), the service produces a bcrypt hash that passes `bcrypt.compare(password, hash)`. Use fast-check with custom generator ensuring character class requirements. Minimum 100 iterations.
    - **Validates: Requirements 11.4**
    - **Property 4: Token version increment** — for any valid password and target user, after reset the tokenVersion is exactly `previousTokenVersion + 1`. Minimum 100 iterations.
    - **Validates: Requirements 11.5**
    - **Property 3: No password leakage** — for any password used in a reset, neither plaintext nor bcrypt hash appears in audit log payload or security monitor event details. Minimum 100 iterations.
    - **Validates: Requirements 5.4, 6.3**
    - _Requirements: 11.4, 11.5_

- [x] 2. Checkpoint — Verify PasswordResetService tests pass
  - Run `npm test -- --testPathPattern="passwordResetService"` in `app/backend` and ensure all unit and property tests pass. Ask the user if questions arise.

- [x] 3. Add admin password reset and user search routes
  - [x] 3.1 Add rate limiter and password reset route to `app/backend/src/routes/admin.ts`
    - Import `PasswordResetService`, `validatePassword` from `validation.ts`, `hashPassword` is consumed inside the service (not in route)
    - Define `resetPasswordParamsSchema` using `positiveIntParam` for `:id`
    - Define `resetPasswordBodySchema` with `password: z.string()`
    - Create `resetPasswordLimiter` using `express-rate-limit`: 10 req / 15 min window, keyed by `authReq.user.userId`, handler returns 429 with `retryAfter: 900` and tracks violation via `securityMonitor.trackRateLimitViolation()`
    - Add `POST /api/admin/users/:id/reset-password` route with middleware chain: `resetPasswordLimiter` → `authenticateToken` → `requireAdmin` → `validateRequest({ params, body })` → handler
    - Handler: validate password via `validatePassword()`, return 400 with specific error if invalid; call `resetPassword(id, password, { initiatorId, resetType: "admin" })`; log success/failure via `securityMonitor`; return `200 { success: true, userId, username }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 3.2 Add user search route to `app/backend/src/routes/admin.ts`
    - Define `userSearchQuerySchema` with `q: z.string().min(1).max(50)`
    - Add `GET /api/admin/users/search` route with middleware chain: `authenticateToken` → `requireAdmin` → `validateRequest({ query })` → handler
    - Handler: if `q` is numeric, search by exact user ID; search by username (partial, case-insensitive via Prisma `contains` + `mode: 'insensitive'`); search by email (partial, case-insensitive); deduplicate results; limit to 10; return only `{ id, username, email, stableName }` via Prisma `select`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 3.3 Write unit tests for password reset route in `app/backend/src/__tests__/routes/admin-password-reset.test.ts`
    - Test successful reset returns 200 with userId and username
    - Test missing password field returns 400
    - Test short password returns 400 with specific message from `validatePassword()`
    - Test non-existent user returns 404
    - Test unauthenticated request returns 401
    - Test non-admin request returns 403
    - Test rate limit exceeded returns 429 with retryAfter
    - Test invalid userId (zero, negative, non-integer) returns 400
    - _Requirements: 11.2_

  - [x] 3.4 Write unit tests for user search route in `app/backend/src/__tests__/routes/admin-password-reset.test.ts`
    - Test search by username (partial match)
    - Test search by email (partial match)
    - Test search by numeric user ID (exact match)
    - Test empty results returns empty array
    - Test query too long (>50 chars) returns 400
    - Test empty query returns 400
    - Test results contain only safe fields (id, username, email, stableName — no passwordHash, tokenVersion)
    - _Requirements: 11.3_

  - [x] 3.5 Write property-based tests for routes in `app/backend/src/__tests__/routes/admin-password-reset.test.ts`
    - **Property 1: Password validation delegation** — for any string `s`, the API accepts `s` if and only if `validatePassword(s)` returns `{ valid: true }`. Minimum 100 iterations.
    - **Validates: Requirements 2.4, 3.2, 3.5**
    - **Property 2: Invalid userId rejection** — for any value that is not a positive integer (zero, negatives, floats, non-numeric strings), the API returns 400. Minimum 100 iterations.
    - **Validates: Requirements 3.4**
    - **Property 6: Search result limit invariant** — for any search query (1–50 chars), the API returns at most 10 results. Minimum 100 iterations.
    - **Validates: Requirements 10.2**
    - **Property 7: Search result field safety** — for any search result, the object contains only `id`, `username`, `email`, `stableName`. Minimum 100 iterations.
    - **Validates: Requirements 10.3**
    - **Property 8: Search query validation** — for any empty string or string >50 chars, the API returns 400. Minimum 100 iterations.
    - **Validates: Requirements 10.4**
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

- [x] 4. Checkpoint — Verify all backend tests pass
  - Run `npm test -- --testPathPattern="password-reset"` in `app/backend` and ensure all unit and property tests pass. Ask the user if questions arise.

- [x] 5. Build the PasswordResetTab frontend component
  - [x] 5.1 Create `app/frontend/src/components/admin/PasswordResetTab.tsx`
    - User Search section: text input + search button, calls `GET /api/admin/users/search?q=...` via `apiClient`, displays results as clickable list showing ID, username, email, stable name; shows "No users found" when empty
    - Password Reset Form section: appears after selecting a user, shows selected user details (ID, username, stable name), password input, confirm password input, submit button
    - Client-side validation: replicate same rules as `RegistrationForm.tsx` (8+ chars, uppercase, lowercase, number) and confirm match — inline validation following existing frontend pattern (no shared validation module exists)
    - Submit calls `POST /api/admin/users/:id/reset-password` with `{ password }` via `apiClient`
    - Show success message with target username on 200, show error message on API error
    - Disable submit button and show loading indicator while request is in flight
    - Use local `useState` only — no cross-page state needed
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 5.2 Register PasswordResetTab in AdminPage
    - Add `export { PasswordResetTab } from './PasswordResetTab';` to `app/frontend/src/components/admin/index.ts`
    - In `app/frontend/src/pages/AdminPage.tsx`: add `'password-reset'` to `TabType` union and `VALID_TABS` array, add `'password-reset': '🔑 Password Reset'` to `TAB_LABELS`, import `PasswordResetTab` from barrel export, add tab panel render block
    - _Requirements: 8.1, 9.1_

  - [x] 5.3 Write frontend tests in `app/frontend/src/components/admin/__tests__/PasswordResetTab.test.tsx`
    - Test renders search input and form elements
    - Test displays search results after API call
    - Test shows "No users found" for empty results
    - Test validates password rules client-side (too short, missing uppercase, missing lowercase, missing number)
    - Test validates password confirmation match
    - Test disables submit button during request (loading state)
    - Test shows success message on 200 response
    - Test shows error message on API error
    - _Requirements: 11.6_

- [x] 6. Checkpoint — Verify frontend tests pass
  - Run frontend tests for the PasswordResetTab component and ensure all pass. Ask the user if questions arise.

- [x] 7. Documentation updates
  - [x] 7.1 Update `docs/prd_core/PRD_SECURITY.md` with admin password reset documentation
    - Add a new entry to Section 5 (Rate Limiting) User-Based Limiters table: `Admin password reset | 15 min | 10 | userId | POST /api/admin/users/:id/reset-password`
    - Add a new entry to Section 11 (Security Playbook): "Admin Password Reset Abuse" — exploit: compromised admin mass-resets passwords; prevention: per-admin rate limit (10/15min), audit trail, tokenVersion invalidation, all attempts logged via SecurityMonitor
    - _Requirements: 12.1_

  - [x] 7.2 Update `.kiro/steering/coding-standards.md` — Rate Limiting section
    - Add `10 req/15min admin password reset` to the rate limiting summary line alongside existing rates (10 req/15min login, 300 req/min general, 60 req/min per-user economic, 3 req/hr account reset)
    - Add the admin password reset endpoint as an example in the "Rate Limiting for Destructive Endpoints" section alongside the existing account reset example
    - _Requirements: 12.2_

  - [x] 7.3 Update `.kiro/steering/error-handling-logging.md` — Security Event Types table
    - Add `admin_password_reset` event type with severity `info` for successful resets and `warning` for repeated resets across many users
    - _Requirements: 12.2_

- [x] 8. Final verification
  - Run all Verification Criteria from requirements.md:
    1. `curl -X POST /api/admin/users/:id/reset-password` with valid admin JWT and password returns 200
    2. Same endpoint without JWT returns 401
    3. Same endpoint with non-admin JWT returns 403
    4. After reset, old password login fails and new password login succeeds
    5. After reset, target user's existing JWT tokens are rejected (tokenVersion mismatch)
    6. `grep -r "admin_password_reset\|ADMIN_PASSWORD_RESET" app/backend/src/` confirms audit logging is wired in
    7. Admin portal UI renders search input, user results, and password form with confirm field
    8. `npm test -- --testPathPattern="password-reset"` in `app/backend` passes with all tests green
    9. `grep -r "PasswordResetService" app/backend/src/services/` confirms the service exists as a standalone module
    10. `docs/prd_core/PRD_SECURITY.md` contains the admin password reset rate limit and playbook entry
    11. `.kiro/steering/coding-standards.md` includes the new rate limit entry
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are mandatory — no optional tasks per project spec quality standards
- Each task references specific requirement acceptance criteria for traceability
- Checkpoints ensure incremental validation at each layer boundary
- Property tests validate the 8 correctness properties defined in the design document
- Existing components (validatePassword, hashPassword, findUserByIdentifier, positiveIntParam, validateRequest, authenticateToken, requireAdmin, securityMonitor, AppError, AdminPage tab pattern) are reused directly — zero duplication
