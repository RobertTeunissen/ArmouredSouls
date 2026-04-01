# Implementation Plan: Backend Error Handling Standardization

## Overview

Introduce a base `AppError` class, domain-specific error subclasses for all 8 domains, an enhanced error middleware, and incrementally migrate all services and routes to use structured errors. The onboarding module's existing pattern is preserved and refactored to extend the new base class.

## Tasks

- [x] 1. Create AppError base class and error handler middleware
  - [x] 1.1 Create `src/errors/AppError.ts` with the base `AppError` class (code, statusCode, details, prototype chain fix via `Object.setPrototypeOf`)
  - [x] 1.2 Create `src/middleware/errorHandler.ts` with the enhanced error middleware that handles `AppError` instances, Prisma `PrismaClientKnownRequestError` mapping (P2002→409, P2025→404, P2003→400, P2014→400), and unknown errors (500 + INTERNAL_ERROR)
  - [x] 1.3 Replace the inline error middleware in `src/index.ts` with the new `errorHandler` import
  - [x] 1.4 Refactor `OnboardingError` in `src/errors/onboardingErrors.ts` to extend `AppError` instead of `Error`, preserving all existing error codes and behavior
  - [x] 1.5 Run full backend test suite to verify onboarding error handling still works and no regressions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4_

- [x] 2. Create domain-specific error classes
  - [x] 2.1 Create `src/errors/authErrors.ts` with `AuthErrorCode` enum and `AuthError` class extending `AppError`
  - [x] 2.2 Create `src/errors/robotErrors.ts` with `RobotErrorCode` enum and `RobotError` class extending `AppError`
  - [x] 2.3 Create `src/errors/battleErrors.ts` with `BattleErrorCode` enum and `BattleError` class extending `AppError`
  - [x] 2.4 Create `src/errors/economyErrors.ts` with `EconomyErrorCode` enum and `EconomyError` class extending `AppError`
  - [x] 2.5 Create `src/errors/leagueErrors.ts` with `LeagueErrorCode` enum and `LeagueError` class extending `AppError`
  - [x] 2.6 Create `src/errors/tournamentErrors.ts` with `TournamentErrorCode` enum and `TournamentError` class extending `AppError`
  - [x] 2.7 Create `src/errors/tagTeamErrors.ts` with `TagTeamErrorCode` enum and `TagTeamError` class extending `AppError`
  - [x] 2.8 Create `src/errors/kothErrors.ts` with `KothErrorCode` enum and `KothError` class extending `AppError`
  - [x] 2.9 Create `src/errors/index.ts` that re-exports all error classes and code enums
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Write tests for error infrastructure
  - [x] 3.1 Write unit tests for `AppError`: constructor, prototype chain, `instanceof` checks, default statusCode
  - [x] 3.2 Write unit tests for `errorHandler` middleware: AppError handling, Prisma error mapping, unknown error fallback, production mode redaction
  - [x] 3.3 Write unit tests for each domain error class: inheritance from `AppError`, correct `name` property, error code validation
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3_

- [x] 4. Migrate auth services and routes
  - [x] 4.1 Update `jwtService.ts` and `passwordService.ts` to throw `AuthError` with appropriate codes
  - [x] 4.2 Update auth route handlers (`src/routes/auth.ts`) to remove manual try-catch error formatting and let errors propagate to middleware
  - [x] 4.3 Update user route handlers (`src/routes/user.ts`) to use `AuthError` for auth-related failures
  - [x] 4.4 Run backend test suite to verify auth flows work correctly
  - _Requirements: 4.1, 5.1, 5.2, 5.3, 5.4_

- [x] 5. Migrate robot services and routes
  - [x] 5.1 Update `robotPerformanceService.ts` and `robotStatsViewService.ts` to throw `RobotError` with appropriate codes
  - [x] 5.2 Update robot route handlers (`src/routes/robots.ts`) to remove manual error formatting
  - [x] 5.3 Run backend test suite to verify robot flows work correctly
  - _Requirements: 4.2, 5.1, 5.2, 5.3_

- [x] 6. Migrate battle services and routes
  - [x] 6.1 Update `combatSimulator.ts`, `battlePostCombat.ts`, `battleStrategy.ts`, `combatMessageGenerator.ts` to throw `BattleError`
  - [x] 6.2 Update `leagueBattleOrchestrator.ts` to throw `BattleError` or `LeagueError` as appropriate
  - [x] 6.3 Update match route handlers (`src/routes/matches.ts`) to remove manual error formatting
  - [x] 6.4 Run backend test suite to verify battle flows work correctly
  - _Requirements: 4.3, 5.1, 5.2, 5.3_

- [x] 7. Migrate economy services and routes
  - [x] 7.1 Update `facilityRecommendationService.ts`, `roiCalculatorService.ts`, `spendingTracker.ts`, `streamingRevenueService.ts` to throw `EconomyError`
  - [x] 7.2 Update facility and finance route handlers (`src/routes/facility.ts`, `src/routes/finances.ts`, `src/routes/weapons.ts`) to remove manual error formatting
  - [x] 7.3 Run backend test suite to verify economy flows work correctly
  - _Requirements: 4.4, 5.1, 5.2, 5.3_

- [x] 8. Migrate league, tournament, tag-team, and KotH services and routes
  - [x] 8.1 Update league services (`leagueInstanceService.ts`, `leagueRebalancingService.ts`) to throw `LeagueError`
  - [x] 8.2 Update tournament services (`tournamentService.ts`, `tournamentBattleOrchestrator.ts`) to throw `TournamentError`
  - [x] 8.3 Update tag-team services (`tagTeamService.ts`, `tagTeamMatchmakingService.ts`, `tagTeamBattleOrchestrator.ts`, `tagTeamLeagueInstanceService.ts`, `tagTeamLeagueRebalancingService.ts`) to throw `TagTeamError`
  - [x] 8.4 Update KotH services (`kothBattleOrchestrator.ts`, `kothMatchmakingService.ts`) to throw `KothError`
  - [x] 8.5 Update corresponding route handlers to remove manual error formatting
  - [x] 8.6 Run full backend test suite to verify all flows work correctly
  - _Requirements: 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3_

- [x] 9. Final verification and documentation
  - [x] 9.1 Audit all route files to confirm no route handler directly sends error responses via `res.status(4xx).json({ error: ... })`
  - [x] 9.2 Create error code reference document at `docs/guides/ERROR_CODES.md` listing all domains, error codes, HTTP status mappings, and the standard response shape
  - [x] 9.3 Update `.kiro/steering/error-handling-logging.md` to reflect the new `AppError` hierarchy, the `{ error, code, details? }` response shape (replacing the old `{ success, error: { message, code, details, timestamp } }` shape), and the `errorHandler` middleware pattern
  - [x] 9.4 Update `.kiro/steering/coding-standards.md` to reference the `AppError` pattern as the standard for all new service error handling
  - [x] 9.5 Run full backend test suite (unit + integration) and verify all tests pass
  - [x] 9.6 Run verification criteria checks: confirm zero direct error responses in routes, zero generic `new Error()` for business logic in services, and error code document completeness
  - _Requirements: 5.3, 6.1, 6.2, 6.3_

## Notes

- Migration is incremental by domain — each task group can be committed independently
- Express 5 async error propagation means removing try-catch blocks is safe; rejected promises are forwarded to the error middleware automatically
- The `OnboardingError` refactoring in task 1.4 is the proof-of-concept that validates the approach before migrating other domains
- Error codes should be added conservatively — only for scenarios that actually exist in the current codebase, not speculative future errors
