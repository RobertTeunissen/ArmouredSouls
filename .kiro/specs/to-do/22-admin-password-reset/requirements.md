# Requirements Document

## Introduction

Admin Password Reset allows administrators of Armoured Souls to reset any user's password directly from the admin portal. This eliminates the current manual process of SSH-ing into production servers and running raw SQL UPDATE commands with pre-generated bcrypt hashes — a workflow that is error-prone (wrong hashes, wrong containers) and time-consuming. The feature provides a secure, auditable, and rate-limited admin endpoint backed by a simple UI form.

This is a high-privilege operation: anyone with admin access (or who can escalate to it) gains the ability to reset any user's password. The security posture reflects this — defense-in-depth with rate limiting, audit logging, session invalidation, and security monitor integration.

The service layer is designed for extensibility. When email-based self-service password resets are added in the future, the core transactional logic (hash + invalidate + audit) will be reused without modification.

## Glossary

- **Admin_Portal**: The authenticated admin section of the Armoured Souls frontend — a tabbed shell (`AdminPage.tsx`) with dedicated tab components in `components/admin/`
- **Admin_API**: The Express 5 backend router in `src/routes/admin.ts`, protected by `authenticateToken` and `requireAdmin` middleware
- **Password_Service**: The existing `passwordService.ts` module (`hashPassword`, `verifyPassword`) using bcrypt with configurable salt rounds
- **PasswordResetService**: A new service that encapsulates the full password reset transaction (hash update, session invalidation, audit logging) in a single reusable unit
- **validatePassword**: The existing password validation function in `src/utils/validation.ts` — enforces 8+ chars, uppercase, lowercase, number. Must be reused; no new password rules
- **findUserByIdentifier**: The existing dual-lookup function in `src/services/auth/userService.ts` — tries username first, then email. Must be reused for user search
- **Token_Version**: An integer field on the User model that is incremented on password change to invalidate all existing JWT sessions for that user
- **Security_Monitor**: The existing `securityMonitor` service that tracks and logs security-relevant events (rate limit violations, authorization failures, validation failures)
- **Audit_Log**: The existing `AuditLog` Prisma model used for event sourcing of game events, extended here to record admin password reset actions
- **Target_User**: The user account whose password is being reset by the administrator

## Existing Components to Reuse (No Duplication)

The following existing modules MUST be reused. No new implementations of equivalent logic are permitted:

| Component | Location | Reuse For |
|-----------|----------|-----------|
| `validatePassword()` | `src/utils/validation.ts` | Password strength rules (8+ chars, uppercase, lowercase, number) |
| `hashPassword()` | `src/services/auth/passwordService.ts` | Bcrypt hashing of the new password |
| `findUserByIdentifier()` | `src/services/auth/userService.ts` | User search by username or email (dual-lookup) |
| `positiveIntParam` | `src/utils/securityValidation.ts` | Zod schema for user ID params |
| `validateRequest` | `src/middleware/schemaValidator.ts` | Zod validation middleware on all new routes |
| `authenticateToken` + `requireAdmin` | `src/middleware/auth.ts` | Auth + admin guard on all new routes |
| `securityMonitor` | `src/services/security/securityMonitor.ts` | Logging security events (rate limit violations, reset attempts) |
| `AdminPage.tsx` tab pattern | `src/pages/AdminPage.tsx` | New tab added to existing shell, component in `components/admin/` |
| `AppError` hierarchy | `src/errors/` | Error responses (not custom error formats) |

## Expected Contribution

This spec eliminates a manual, error-prone operational workflow and replaces it with a secure, self-service admin feature. It is designed as the first step toward automated password resets (e.g., email-based self-service) — the service layer and audit infrastructure built here will be reused when that flow is added.

1. **Before**: Password resets require SSH access to the production server, finding the correct Docker container, generating bcrypt hashes manually, and running raw SQL UPDATE commands. **After**: Admins reset passwords in 3 clicks from the admin portal — search user, enter new password, submit.
2. **Before**: Risk of updating the wrong user, using a stale hash, or running commands against the wrong container (as happened twice already). **After**: The API validates the target user exists, hashes the password correctly every time, and returns clear success/error feedback.
3. **Before**: No audit trail of who reset whose password or when. **After**: Every reset is logged with admin ID, target user ID, and timestamp — visible in the security dashboard.
4. **Before**: Password resets don't invalidate existing sessions — the user stays logged in with the old password's JWT. **After**: Token version is incremented atomically, forcing the user to re-authenticate.
5. **Before**: Only developers with SSH access can perform resets. **After**: Any admin-role user can perform resets from the browser, reducing operational dependency on developers.
6. **Before**: No reusable password-reset service exists — future email-based self-service resets would need to be built from scratch. **After**: A `PasswordResetService` encapsulates hash-update + session-invalidation + audit-logging in a single transactional unit, ready to be called from an email-token flow later.

### Verification Criteria

1. `curl -X POST /api/admin/users/:id/reset-password` with a valid admin JWT and password returns 200 — endpoint exists and works
2. `curl -X POST /api/admin/users/:id/reset-password` without a JWT returns 401 — auth middleware is active
3. `curl -X POST /api/admin/users/:id/reset-password` with a non-admin JWT returns 403 — admin guard is active
4. After a successful reset, logging in with the old password fails and logging in with the new password succeeds
5. After a successful reset, the target user's existing JWT tokens are rejected (token version mismatch)
6. `grep -r "admin_password_reset\|ADMIN_PASSWORD_RESET" app/backend/src/` confirms audit logging is wired in
7. The admin portal UI at the password reset page renders a search input, user results, and a password form with confirm field
8. `npm test -- --testPathPattern="password-reset"` in `app/backend` passes with all unit and property-based tests green
9. `grep -r "PasswordResetService" app/backend/src/services/` confirms the service exists as a standalone, reusable module
10. `docs/prd_core/PRD_SECURITY.md` contains the admin password reset rate limit and playbook entry
11. `.kiro/steering/` contains updated references if any existing steering files describe admin endpoints or auth patterns

## Requirements

### Requirement 1: Password Reset Service Layer (Extensibility)

**User Story:** As a system architect, I want the password reset logic encapsulated in a dedicated service, so that future reset flows (e.g., email-based self-service) can reuse the same transactional logic without duplicating code.

#### Acceptance Criteria

1. THE system SHALL provide a `PasswordResetService` that accepts a target user ID, a new plaintext password, and a reset initiator context (admin ID for admin resets, or a future token-based context for self-service)
2. THE `PasswordResetService` SHALL execute the password hash update, Token_Version increment, and audit log write within a single Prisma interactive transaction
3. THE `PasswordResetService` SHALL be callable from both the admin route handler (this spec) and future reset flows (e.g., email-token handler) without modification to the service itself
4. THE `PasswordResetService` SHALL accept a `resetType` parameter (e.g., `"admin"`, `"self_service"`) that is recorded in the audit log to distinguish between reset origins

### Requirement 2: Admin Password Reset API Endpoint

**User Story:** As an admin, I want to reset a user's password via an API endpoint, so that I no longer need to SSH into production servers and run manual SQL commands.

#### Acceptance Criteria

1. WHEN an authenticated admin submits a valid password reset request with a target user ID and a new password, THE Admin_API SHALL delegate to the `PasswordResetService` with resetType `"admin"` and the admin's user ID as initiator
2. WHEN the Admin_API successfully resets a password, THE Admin_API SHALL return a success response containing the Target_User's ID and username
3. IF the target user ID does not correspond to an existing user, THEN THE Admin_API SHALL return a 404 error with a descriptive error code
4. THE Admin_API SHALL validate the new password using the existing `validatePassword()` function from `src/utils/validation.ts` — the same rules that apply to registration and profile password changes

### Requirement 3: Input Validation

**User Story:** As an admin, I want the password reset endpoint to validate all inputs, so that malformed or dangerous requests are rejected at the API boundary.

#### Acceptance Criteria

1. THE Admin_API SHALL validate the request body using a Zod schema that requires a `userId` (positive integer, using `positiveIntParam` from `securityValidation.ts`) and a `password` (string)
2. THE Admin_API SHALL validate the password using the existing `validatePassword()` function from `src/utils/validation.ts` — no new password rules or hardcoded length checks
3. WHEN the request body contains fields not defined in the schema, THE Admin_API SHALL strip unknown fields before processing (Zod default `.strip()` behavior)
4. IF the `userId` field is missing, zero, negative, or non-integer, THEN THE Admin_API SHALL return a 400 validation error with field-level details
5. IF the password fails `validatePassword()` checks, THEN THE Admin_API SHALL return a 400 validation error with the specific failure reason

### Requirement 4: Authorization and Access Control

**User Story:** As a system operator, I want the password reset endpoint restricted to admin users only, so that regular users cannot reset other users' passwords.

#### Acceptance Criteria

1. THE Admin_API SHALL require a valid JWT token (via `authenticateToken` middleware) before processing any password reset request
2. THE Admin_API SHALL require the authenticated user to have the "admin" role (via `requireAdmin` middleware) before processing any password reset request
3. IF an unauthenticated request reaches the password reset endpoint, THEN THE Admin_API SHALL return a 401 error
4. IF a non-admin authenticated user reaches the password reset endpoint, THEN THE Admin_API SHALL return a 403 error and log the authorization failure via the Security_Monitor

### Requirement 5: Enhanced Security (Defense-in-Depth)

**User Story:** As a system operator, I want defense-in-depth protections on the password reset endpoint, so that even if an admin account is compromised, the blast radius is limited and all actions are traceable.

#### Acceptance Criteria

1. THE Admin_API SHALL enforce a per-user rate limit of 10 password reset requests per 15-minute window, keyed by the authenticated admin's user ID
2. IF the rate limit is exceeded, THEN THE Admin_API SHALL return a 429 error with a `retryAfter` value and track the violation via the Security_Monitor
3. THE Admin_API SHALL log every password reset attempt (success and failure) via the Security_Monitor, including the admin's user ID, the Target_User's ID, the outcome (success/failure), and the failure reason if applicable
4. THE Admin_API SHALL NOT log the new password or its hash in any log output or security event
5. THE Security_Monitor SHALL surface admin password reset events in the existing admin Security dashboard so that suspicious patterns (e.g., rapid resets across many users) are visible to other admins

### Requirement 6: Audit Logging

**User Story:** As a system operator, I want every admin password reset to be logged in the audit trail, so that there is a permanent record of who reset whose password and when.

#### Acceptance Criteria

1. WHEN the Admin_API successfully resets a password, THE `PasswordResetService` SHALL write an audit log entry with the admin's user ID, the Target_User's ID, the resetType, and a timestamp
2. THE audit log entry SHALL be written within the same database transaction as the password hash update (via the `PasswordResetService`)
3. THE audit log SHALL NOT contain the new password or its hash

### Requirement 7: Session Invalidation

**User Story:** As a system operator, I want the target user's existing sessions to be invalidated after a password reset, so that the user must log in again with the new password.

#### Acceptance Criteria

1. WHEN the Admin_API resets a password, THE `PasswordResetService` SHALL increment the Target_User's Token_Version within the same database transaction as the password hash update
2. WHEN the Target_User's Token_Version is incremented, THE `authenticateToken` middleware SHALL reject any JWT tokens issued with the previous Token_Version value

### Requirement 8: Admin Portal UI — User Search

**User Story:** As an admin, I want to search for a user by username, email, or user ID in the admin portal, so that I can find the correct account to reset.

#### Acceptance Criteria

1. THE Admin_Portal SHALL display a search input that accepts a username, email address, or numeric user ID
2. WHEN the admin submits a search query, THE Admin_Portal SHALL display matching user results showing the user's ID, username, email, and stable name
3. IF no users match the search query, THEN THE Admin_Portal SHALL display a "No users found" message
4. WHEN the admin selects a user from the search results, THE Admin_Portal SHALL display the selected user's details (ID, username, stable name) in the password reset form

### Requirement 9: Admin Portal UI — Password Reset Form

**User Story:** As an admin, I want a password reset form in the admin portal, so that I can enter a new password and submit the reset without leaving the browser.

#### Acceptance Criteria

1. THE Admin_Portal SHALL display a password input field and a confirm password input field for the new password
2. WHEN the admin submits the form, THE Admin_Portal SHALL validate that the password and confirm password fields match before sending the request
3. WHEN the admin submits the form, THE Admin_Portal SHALL validate the password using the same rules as the registration form (8+ chars, uppercase, lowercase, number) — reusing or sharing the validation logic, not duplicating it
4. WHEN the Admin_API returns a success response, THE Admin_Portal SHALL display a success message containing the Target_User's username
5. IF the Admin_API returns an error response, THEN THE Admin_Portal SHALL display the error message to the admin
6. WHILE the password reset request is in flight, THE Admin_Portal SHALL disable the submit button and display a loading indicator

### Requirement 10: Admin User Search API Endpoint

**User Story:** As an admin, I want an API endpoint to search for users, so that the admin portal can look up users for password resets.

#### Acceptance Criteria

1. WHEN an authenticated admin submits a search query, THE Admin_API SHALL return matching users by username (partial, case-insensitive match), email (partial, case-insensitive match), or by exact user ID
2. THE Admin_API SHALL return at most 10 results per search query
3. THE Admin_API SHALL return only the user's ID, username, email, and stable name in search results — no password hashes or other sensitive fields
4. THE Admin_API SHALL validate the search query using a Zod schema that requires a non-empty string of at most 50 characters

### Requirement 11: Testing

**User Story:** As a developer, I want comprehensive tests for the password reset feature, so that regressions are caught before they reach production.

#### Acceptance Criteria

1. THE backend SHALL include unit tests for the `PasswordResetService` covering: successful reset, non-existent user, transaction rollback on failure, and audit log creation
2. THE backend SHALL include unit tests for the admin password reset route handler covering: successful reset, validation errors (bad userId, short password, long password), 404 for missing user, 401/403 for auth failures, and 429 for rate limit exceeded
3. THE backend SHALL include unit tests for the admin user search route handler covering: search by username, search by user ID, empty results, and validation errors
4. THE backend SHALL include property-based tests (fast-check) verifying that for any valid password string (8–128 chars), the `PasswordResetService` produces a hash that passes bcrypt verification
5. THE backend SHALL include a property-based test verifying that the `PasswordResetService` always increments Token_Version by exactly 1 regardless of the input password
6. ALL tests SHALL pass when run via `npm test -- --testPathPattern="password-reset"` in `app/backend`

### Requirement 12: Documentation

**User Story:** As a developer or operator, I want the password reset feature documented, so that the security model, rate limits, and extension points are discoverable without reading the source code.

#### Acceptance Criteria

1. `docs/prd_core/PRD_SECURITY.md` SHALL be updated with the admin password reset rate limit in the User-Based Limiters table and a new Security Playbook entry documenting the endpoint, its rate limits (10 req/15 min per admin), audit trail behavior, and session invalidation mechanism
2. IF any `.kiro/steering/` files reference admin endpoints, auth patterns, or rate limiting conventions, THEY SHALL be updated to include the new password reset endpoint
3. THE `PasswordResetService` SHALL include JSDoc comments documenting its public interface, parameters, return values, and extension points for future reset flows