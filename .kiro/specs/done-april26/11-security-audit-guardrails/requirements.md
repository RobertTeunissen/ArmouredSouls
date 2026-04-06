# Requirements Document

## Introduction

This document defines the security audit guardrails for Armoured Souls — a browser-based robot combat strategy game. The feature addresses internet-facing attack vectors targeting game manipulation, codifies lessons learned from recent real-world exploits ("Koen's Exploits"), and establishes systematic guardrails to prevent recurrence of similar vulnerabilities. The scope covers input validation hardening, transaction integrity, authentication strengthening, monitoring/alerting, and automated security scanning aligned with OWASP Top 10 and game-specific threat models.

## Glossary

- **API_Gateway**: The Express 5 application layer that receives and routes all HTTP requests from the internet
- **Input_Validator**: The middleware and utility layer responsible for sanitizing and validating all user-supplied data before it reaches business logic
- **Credit_Guard**: The row-level locking module (`creditGuard.ts`) that serializes concurrent spending transactions per user via `SELECT ... FOR UPDATE`
- **Transaction_Manager**: The Prisma interactive transaction layer that ensures atomicity of multi-step game state mutations
- **Auth_Service**: The authentication and authorization layer handling JWT issuance, verification, and role-based access control
- **Rate_Limiter**: The Express middleware that throttles requests per IP to prevent brute-force and denial-of-service attacks
- **Error_Handler**: The centralized Express error-handling middleware that produces structured JSON responses without leaking internals
- **Security_Monitor**: The proposed logging and alerting subsystem that detects anomalous player behavior and potential exploit attempts
- **Dependency_Scanner**: The automated tooling that checks npm dependencies for known vulnerabilities
- **OWASP_Top_10**: The Open Web Application Security Project's list of the ten most critical web application security risks
- **IDOR**: Insecure Direct Object Reference — an access control vulnerability where a user manipulates resource identifiers to access other users' data
- **Race_Condition**: A concurrency bug where the outcome depends on the timing of multiple simultaneous operations
- **XSS**: Cross-Site Scripting — injection of malicious scripts into web pages viewed by other users
- **CSRF**: Cross-Site Request Forgery — an attack that tricks a user's browser into making unintended requests
- **Advisory_Lock**: A PostgreSQL application-level lock (`pg_advisory_xact_lock`) used to serialize operations on logical resources

## Requirements

### Requirement 1: Centralized Input Validation Middleware

**User Story:** As a developer, I want a centralized input validation layer applied to all API routes, so that every user-supplied value is validated against an allowlist before reaching business logic.

#### Acceptance Criteria

1. THE Input_Validator SHALL validate all request body fields, URL parameters, and query parameters against a schema definition before the request reaches the route handler
2. WHEN a request contains a field that does not conform to the defined schema, THE Input_Validator SHALL reject the request with HTTP 400 and a structured error response containing the field name and violation type
3. WHEN a string field exceeds the maximum allowed length defined in the schema, THE Input_Validator SHALL reject the request with HTTP 400
4. THE Input_Validator SHALL enforce character allowlists for all user-supplied string fields that are stored or rendered (robot names, stable names, slugs, identifiers)
5. WHEN a numeric parameter is provided as a non-numeric string, THE Input_Validator SHALL reject the request with HTTP 400 rather than coercing or defaulting the value
6. THE Input_Validator SHALL strip or reject any fields not defined in the route's schema to prevent mass-assignment attacks

### Requirement 2: Transaction Integrity Guardrails for Economic Operations

**User Story:** As a game operator, I want all credit-spending and game-state-mutating operations to use serialized transactions with row-level locking, so that race condition exploits cannot bypass balance or limit validations.

#### Acceptance Criteria

1. THE Transaction_Manager SHALL wrap every credit-spending operation (weapon purchase, facility upgrade, robot creation, attribute upgrade) in a Prisma interactive transaction that acquires a row-level lock via Credit_Guard before reading the user's balance
2. THE Transaction_Manager SHALL re-read all mutable game state (facility levels, roster counts, weapon inventory counts, attribute levels, academy caps) inside the transaction after acquiring the lock, and SHALL use the re-read values for all validation checks
3. WHEN a concurrent request attempts to modify the same user's balance, THE Credit_Guard SHALL block the second request until the first transaction commits or rolls back
4. THE Database SHALL enforce a CHECK constraint on the currency column preventing values below the defined floor (-10,000,000 credits)
5. WHEN a new economic endpoint is added, THE Transaction_Manager SHALL require the developer to use the `lockUserForSpending` function within an interactive transaction, enforced by code review checklist and documented in the security guide
6. THE Transaction_Manager SHALL use `pg_advisory_xact_lock` for operations that require serialization across multiple resource rows (team creation, multi-robot operations)

### Requirement 3: Authentication and Session Hardening

**User Story:** As a game operator, I want the authentication system to resist brute-force attacks, token theft, and session hijacking, so that player accounts remain secure against internet-based attackers.

#### Acceptance Criteria

1. WHEN a single IP address exceeds 10 failed login attempts within a 15-minute window, THE Auth_Service SHALL temporarily block further login attempts from that IP for 15 minutes
2. THE Auth_Service SHALL load the JWT secret exclusively from the centralized `EnvConfig` module rather than reading `process.env.JWT_SECRET` directly at module level
3. WHEN a user changes their password, THE Auth_Service SHALL invalidate all existing JWT tokens for that user by incrementing a token-version counter stored in the database
4. THE Auth_Service SHALL include the token-version in the JWT payload and SHALL reject tokens whose version does not match the current database value
5. IF the JWT_SECRET environment variable equals the default development placeholder in a production environment, THEN THE Auth_Service SHALL refuse to start the application and SHALL log a fatal error
6. THE Auth_Service SHALL set the JWT expiration to a maximum of 24 hours and SHALL support a configurable refresh mechanism

### Requirement 4: Authorization and IDOR Prevention

**User Story:** As a player, I want the system to verify that I own every resource I attempt to modify, so that other players cannot manipulate my robots, weapons, or facilities.

#### Acceptance Criteria

1. THE API_Gateway SHALL verify resource ownership (robot, weapon inventory, facility, tag team) by checking that the resource's `userId` or `stableId` matches the authenticated user's ID before performing any mutation
2. WHEN a user attempts to modify a resource they do not own, THE API_Gateway SHALL return HTTP 403 with a generic "forbidden" message that does not reveal whether the resource exists
3. THE API_Gateway SHALL verify ownership inside the database transaction for operations that combine ownership checks with state mutations, preventing TOCTOU (time-of-check-time-of-use) race conditions
4. WHEN a user requests another user's robot data via a public endpoint, THE API_Gateway SHALL strip all sensitive fields defined in the `SENSITIVE_ROBOT_FIELDS` constant before returning the response
5. THE API_Gateway SHALL validate that all resource IDs in request parameters are positive integers and SHALL reject requests with non-positive or non-integer IDs with HTTP 400

### Requirement 5: XSS and Injection Prevention

**User Story:** As a player, I want all user-generated content to be sanitized before storage and rendering, so that malicious scripts cannot be injected into the game interface.

#### Acceptance Criteria

1. THE Input_Validator SHALL enforce a character allowlist pattern (`/^[a-zA-Z0-9 _\-'.!]+$/`) on all user-visible name fields (robot names, stable names) at the API boundary before database storage
2. THE Input_Validator SHALL validate the `imageUrl` field on robot records against a strict pattern that permits only the allowed protocol, domain, and path format, rejecting protocol injection, path traversal sequences, and JavaScript URIs
3. WHEN an ORDER BY column is specified via user input, THE API_Gateway SHALL map the input to a predefined allowlist of valid column names and SHALL fall back to a safe default column when the input does not match any allowed value
4. THE Error_Handler SHALL sanitize all error messages before including them in HTTP responses, ensuring that unsanitized user input is never reflected back in error payloads (preventing reflected XSS)
5. THE API_Gateway SHALL set Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy headers on all responses via Helmet.js configuration
6. THE Input_Validator SHALL validate URL path parameters (slugs) against the pattern `/^[a-zA-Z0-9_-]+$/` to prevent path traversal attacks

### Requirement 6: Rate Limiting and Abuse Prevention

**User Story:** As a game operator, I want granular rate limiting on sensitive endpoints, so that automated tools cannot brute-force accounts or flood economic transactions.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL apply a strict limit of 30 requests per minute per IP on authentication endpoints (login, registration)
2. THE Rate_Limiter SHALL apply a general limit of 300 requests per minute per IP on all other API endpoints
3. WHEN a rate limit is exceeded, THE Rate_Limiter SHALL return HTTP 429 with a `Retry-After` header indicating when the client may retry
4. THE Rate_Limiter SHALL apply a stricter limit of 60 requests per minute per authenticated user on economic transaction endpoints (weapon purchase, facility upgrade, robot creation, attribute upgrade)
5. THE Rate_Limiter SHALL use the `X-Forwarded-For` header (validated via Express `trust proxy` setting) to correctly identify client IPs behind the Caddy reverse proxy
6. WHEN a single user triggers rate limits on economic endpoints more than 5 times within an hour, THE Security_Monitor SHALL log a warning event with the user ID and endpoint details

### Requirement 7: Security Monitoring and Anomaly Detection

**User Story:** As a game operator, I want automated detection of suspicious player behavior patterns, so that exploit attempts are identified and flagged before they cause economic damage.

#### Acceptance Criteria

1. WHEN a user's credit balance decreases by more than 3,000,000 credits within a 5-minute window, THE Security_Monitor SHALL log a high-severity alert with the user ID, transaction details, and timestamps (3,000,000 equals the starting balance — spending more than that in 5 minutes means the user had earned additional credits and is draining them abnormally fast)
2. WHEN a user sends more than 10 concurrent requests that result in transaction serialization conflicts (409 responses) within a 1-minute window, THE Security_Monitor SHALL log a potential race-condition exploit attempt
3. THE Security_Monitor SHALL log all failed authorization attempts (HTTP 403 responses) with the authenticated user ID, requested resource type, and resource ID
4. THE Security_Monitor SHALL log all requests that fail input validation with the endpoint path, violation type, and source IP
5. WHEN a user creates more than 3 robots within a 10-minute window, THE Security_Monitor SHALL flag the activity as potentially automated and log a warning
6. THE Security_Monitor SHALL write all security events to a dedicated security log channel separate from the application log, using structured JSON format with severity levels (info, warning, critical)

### Requirement 8: Automated Dependency and Security Scanning

**User Story:** As a developer, I want automated security scanning integrated into the development workflow, so that known vulnerabilities in dependencies and code patterns are caught before deployment.

#### Acceptance Criteria

1. THE Dependency_Scanner SHALL run `npm audit` as part of the CI/CD pipeline and SHALL fail the build when high or critical severity vulnerabilities are detected in production dependencies
2. THE Dependency_Scanner SHALL generate a report of all dependency vulnerabilities with severity levels, affected packages, and remediation guidance
3. WHEN a new dependency is added to `package.json`, THE Dependency_Scanner SHALL automatically scan the dependency before the pull request can be merged
4. THE Dependency_Scanner SHALL maintain a documented allowlist of accepted vulnerabilities (with justification and review date) for cases where immediate remediation is not possible
5. THE API_Gateway SHALL include a security-focused ESLint configuration that flags common vulnerability patterns (eval usage, dynamic require, unparameterized queries, hardcoded secrets)

### Requirement 9: Lessons Learned Guardrails from Recent Exploits

**User Story:** As a developer, I want codified guardrails derived from the recent exploit fixes, so that the same categories of vulnerabilities cannot be reintroduced in future code.

#### Acceptance Criteria

1. THE Transaction_Manager SHALL provide a documented pattern (in the security guide) for all new economic endpoints that includes: acquire row lock, re-read mutable state, validate, mutate, commit — with code examples from the Credit_Guard pattern
2. THE Input_Validator SHALL provide a reusable validation function for each input type (safe name, safe slug, safe URL, positive integer, enum value) that route handlers import rather than implementing inline regex checks
3. WHEN a developer adds a new user-visible string field to the database schema, THE Input_Validator SHALL require the field to have a corresponding validation rule in the centralized validation module, enforced by code review checklist
4. THE API_Gateway SHALL document all known exploit patterns (race conditions on balance checks, stored XSS via name fields, path traversal via slugs, ORDER BY injection, duplicate equip via concurrent requests, imageUrl protocol injection) in a security playbook with detection signatures and prevention patterns
5. THE Transaction_Manager SHALL enforce that all multi-step operations that read-then-write game state perform the read inside the transaction boundary, preventing stale-data race conditions — documented as a mandatory pattern in the developer security guide
6. WHEN a new route handler performs a database write operation, THE API_Gateway SHALL require the handler to use the centralized error-handling middleware (throw AppError subclasses) rather than catching errors locally and returning generic 500 responses

### Requirement 10: CORS, CSRF, and Transport Security

**User Story:** As a game operator, I want the application to enforce strict cross-origin policies and transport security, so that cross-site attacks and man-in-the-middle interception are prevented.

#### Acceptance Criteria

1. WHILE the application is running in production mode, THE API_Gateway SHALL restrict CORS origins to an explicit allowlist of production domains and SHALL reject requests from unlisted origins
2. WHILE the application is running in development mode, THE API_Gateway SHALL permit all origins for local development convenience
3. THE API_Gateway SHALL set the HTTP Strict-Transport-Security header with a minimum max-age of 31536000 seconds (1 year) and include the `includeSubDomains` directive
4. IF the application transitions to cookie-based token storage in the future, THEN THE API_Gateway SHALL implement CSRF protection using the double-submit cookie pattern or synchronizer token pattern
5. THE API_Gateway SHALL set the `X-Content-Type-Options: nosniff` header on all responses to prevent MIME-type sniffing attacks
6. THE API_Gateway SHALL configure Caddy to enforce HTTPS redirection and TLS 1.2+ for all client connections
