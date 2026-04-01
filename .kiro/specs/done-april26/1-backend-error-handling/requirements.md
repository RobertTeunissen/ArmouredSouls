# Requirements Document

## Introduction

Standardize error handling across the entire Armoured Souls backend by extending the structured error pattern currently used only in the onboarding module (`OnboardingError` with machine-readable codes) to all backend services and routes. This eliminates inconsistent HTTP status codes, generic error messages, and raw Prisma errors leaking to clients. The result is a unified error contract that both backend routes and frontend consumers can rely on.

## Glossary

- **AppError**: The base error class that all domain-specific errors extend. Carries a machine-readable `code`, HTTP `statusCode`, human-readable `message`, and optional `details` payload.
- **ErrorCode**: A string constant that uniquely identifies an error scenario within a domain (e.g., `ROBOT_NOT_FOUND`, `INSUFFICIENT_CREDITS`). Frontend consumers switch on these codes to display context-appropriate messages.
- **Error_Middleware**: The Express error-handling middleware registered in `index.ts` that catches all errors, formats them into a consistent JSON response, and logs them.
- **Domain**: A logical grouping of related services and routes (e.g., battle, league, economy, robot, auth, tournament, tag-team, koth).
- **Structured_Error_Response**: The JSON response shape returned by the API for all error conditions: `{ error: string, code: string, details?: unknown }`.

## Expected Contribution

This spec targets the "inconsistent error handling" debt identified in the project assessment. The expected measurable outcomes after all tasks are complete:

1. **Error response consistency**: 100% of API error responses conform to the `{ error, code, details? }` shape. Before: only onboarding endpoints (~5% of routes) return structured errors.
2. **Machine-readable error codes**: Every known error scenario has a domain-specific code. Before: only 9 onboarding codes exist. After: 50+ codes across 9 domains.
3. **Route handler simplification**: Route handlers contain zero manual `res.status(4xx).json({ error: ... })` calls for error cases. Before: error formatting is scattered across every route file.
4. **Prisma error leakage eliminated**: No raw Prisma errors reach the client. Before: `PrismaClientKnownRequestError` objects leak as 500s with internal details.
5. **Single error middleware**: One `errorHandler.ts` handles all error formatting. Before: inline catch-all in `index.ts` plus per-route try-catch blocks.

### Verification Criteria

After all tasks are marked complete, run these checks to confirm the debt reduction was achieved:

1. `grep -r "res.status(4" src/routes/ | grep -v "res.status(200\|res.status(201\|res.status(204)"` returns zero matches (no direct error responses in routes)
2. `grep -r "new Error(" src/services/ | grep -v "AppError\|AuthError\|RobotError\|BattleError\|EconomyError\|LeagueError\|TournamentError\|TagTeamError\|KothError\|OnboardingError"` returns zero matches for business logic errors (generic Error only for truly unexpected cases)
3. All backend tests pass
4. The `docs/guides/ERROR_CODES.md` document exists and lists all error codes
5. The `error-handling-logging.md` steering file reflects the new error response shape

## Requirements

### Requirement 1: Base AppError Class

**User Story:** As a backend developer, I want a single base error class that all domain-specific errors extend, so that the error middleware can detect structured errors and format them consistently without per-domain logic.

#### Acceptance Criteria

1. WHEN a new file `src/errors/AppError.ts` is created, IT SHALL export an `AppError` class that extends `Error` with properties: `code` (string), `statusCode` (number, default 400), and `details` (unknown, optional).
2. WHEN `AppError` is instantiated, THE `name` property SHALL be set to `'AppError'` and the prototype chain SHALL be correctly maintained for `instanceof` checks.
3. WHEN the existing `OnboardingError` class is refactored, IT SHALL extend `AppError` instead of `Error` directly, preserving all existing behavior and error codes.
4. WHEN any service throws an `AppError` (or subclass), THE error middleware SHALL detect it via `instanceof AppError` and return a `Structured_Error_Response` with the error's `statusCode`, `code`, `message`, and `details`.
5. WHEN an error that is NOT an `AppError` reaches the error middleware, THE middleware SHALL return a 500 response with `{ error: "Internal Server Error", code: "INTERNAL_ERROR" }` and log the full stack trace.

### Requirement 2: Domain-Specific Error Classes and Codes

**User Story:** As a backend developer, I want domain-specific error classes with exhaustive error code enums for each major domain, so that every error scenario has a machine-readable code that frontend consumers can rely on.

#### Acceptance Criteria

1. WHEN domain error classes are created, THE following domains SHALL each have their own error class and error code enum in `src/errors/`: battle, league, economy, robot, auth, tournament, tag-team, koth.
2. WHEN a domain error class is created (e.g., `BattleError`), IT SHALL extend `AppError` and set its `name` property to the domain-specific name (e.g., `'BattleError'`).
3. WHEN a domain error code enum is created (e.g., `BattleErrorCode`), IT SHALL use `as const` object pattern (matching the existing `OnboardingErrorCode` style) and include codes for all known error scenarios in that domain.
4. WHEN a new error scenario is discovered in a domain that lacks a specific code, THE developer SHALL add the code to the domain's error code enum rather than throwing a generic `Error`.

### Requirement 3: Error Middleware Enhancement

**User Story:** As a backend developer, I want the Express error middleware to automatically format all `AppError` instances into consistent JSON responses, so that route handlers don't need per-route error formatting logic.

#### Acceptance Criteria

1. WHEN the error middleware in `index.ts` receives an `AppError` instance, IT SHALL respond with the error's `statusCode` and a JSON body of `{ error: appError.message, code: appError.code, ...(appError.details ? { details: appError.details } : {}) }`.
2. WHEN the error middleware receives a Prisma `PrismaClientKnownRequestError`, IT SHALL map common Prisma error codes to appropriate HTTP status codes (e.g., P2002 unique constraint → 409 Conflict, P2025 record not found → 404) and return a `Structured_Error_Response` with a descriptive code like `DATABASE_UNIQUE_VIOLATION` or `DATABASE_RECORD_NOT_FOUND`.
3. WHEN the error middleware receives an unknown error, IT SHALL return status 500 with `{ error: "Internal Server Error", code: "INTERNAL_ERROR" }` and SHALL NOT expose stack traces or internal details in production.
4. WHEN the error middleware processes any error, IT SHALL log the error with context (method, path, status code, error code, stack trace) using the existing Winston logger.

### Requirement 4: Service Layer Migration

**User Story:** As a backend developer, I want all existing services to throw domain-specific `AppError` subclasses instead of generic `Error` or raw strings, so that error handling is consistent across the entire backend.

#### Acceptance Criteria

1. WHEN auth services (`jwtService`, `passwordService`) encounter errors, THEY SHALL throw an `AuthError` with appropriate codes (e.g., `INVALID_TOKEN`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `USER_NOT_FOUND`).
2. WHEN robot services (`robotPerformanceService`, `robotStatsViewService`) encounter errors, THEY SHALL throw a `RobotError` with appropriate codes (e.g., `ROBOT_NOT_FOUND`, `ROBOT_NOT_OWNED`, `ROBOT_DESTROYED`).
3. WHEN battle services (`combatSimulator`, `battlePostCombat`, `battleStrategy`) encounter errors, THEY SHALL throw a `BattleError` with appropriate codes (e.g., `BATTLE_NOT_FOUND`, `INVALID_BATTLE_STATE`, `ROBOT_NOT_ELIGIBLE`).
4. WHEN economy services (`facilityRecommendationService`, `roiCalculatorService`, `spendingTracker`, `streamingRevenueService`) encounter errors, THEY SHALL throw an `EconomyError` with appropriate codes (e.g., `INSUFFICIENT_CREDITS`, `FACILITY_MAX_LEVEL`, `INVALID_FACILITY_TYPE`).
5. WHEN league services (`leagueInstanceService`, `leagueRebalancingService`, `leagueBattleOrchestrator`) encounter errors, THEY SHALL throw a `LeagueError` with appropriate codes (e.g., `LEAGUE_NOT_FOUND`, `INVALID_LEAGUE_TIER`, `PROMOTION_BLOCKED`).
6. WHEN tournament services encounter errors, THEY SHALL throw a `TournamentError` with appropriate codes (e.g., `TOURNAMENT_NOT_FOUND`, `TOURNAMENT_ALREADY_COMPLETED`, `INSUFFICIENT_PARTICIPANTS`).
7. WHEN tag-team services encounter errors, THEY SHALL throw a `TagTeamError` with appropriate codes.
8. WHEN KotH services encounter errors, THEY SHALL throw a `KothError` with appropriate codes.

### Requirement 5: Route Handler Cleanup

**User Story:** As a backend developer, I want route handlers to stop catching and manually formatting errors, instead letting the error middleware handle all error responses, so that route handlers are focused on the happy path.

#### Acceptance Criteria

1. WHEN a route handler currently wraps service calls in try-catch blocks solely to format error responses, THE try-catch SHALL be removed and the service error SHALL be allowed to propagate to the error middleware.
2. WHEN a route handler needs to throw an error for input validation failures, IT SHALL throw an `AppError` (or domain subclass) with `statusCode: 400` and an appropriate code rather than calling `res.status(400).json()` directly.
3. WHEN all route handlers are migrated, NO route handler SHALL call `res.status().json({ error: ... })` for error cases — all error responses SHALL flow through the error middleware.
4. WHEN Express 5 async route handlers reject (throw), THE error SHALL be automatically caught by Express 5 and forwarded to the error middleware without manual try-catch.

### Requirement 6: Error Response Contract Documentation

**User Story:** As a frontend developer, I want a documented error response contract that lists all possible error codes per API endpoint, so that I can implement proper error handling in the UI.

#### Acceptance Criteria

1. WHEN the error handling system is complete, A reference document SHALL exist listing all error code enums and their meanings, organized by domain.
2. WHEN the error response contract is documented, IT SHALL specify the standard error response shape: `{ error: string, code: string, details?: unknown }`.
3. WHEN the error response contract is documented, IT SHALL include the HTTP status code mapping for each error code.
