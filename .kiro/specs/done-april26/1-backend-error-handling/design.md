# Design Document: Backend Error Handling Standardization

## Overview

Replace the ad-hoc error handling across the Armoured Souls backend with a structured, hierarchical error system. The existing `OnboardingError` pattern (machine-readable codes, HTTP status, optional details) becomes the project-wide standard via a base `AppError` class. The Express error middleware is enhanced to detect `AppError` instances and Prisma errors, producing a consistent JSON response contract for all API consumers.

### Key Research Findings

- The backend currently has 1 structured error class (`OnboardingError`) and 40+ services throwing generic `Error` or letting Prisma errors bubble raw.
- The Express error middleware in `index.ts` is a catch-all 500 handler that doesn't detect structured errors.
- Route handlers inconsistently catch errors — some return `res.status(400).json()`, others let errors propagate, and the response shapes vary.
- Express 5 (already in use) automatically catches rejected promises in async route handlers, so manual try-catch for error propagation is unnecessary.
- Prisma's `PrismaClientKnownRequestError` has a `code` field (e.g., `P2002` for unique constraint, `P2025` for record not found) that can be mapped to HTTP status codes.

## Architecture

```
src/errors/
├── AppError.ts              # Base error class
├── onboardingErrors.ts      # Existing (refactored to extend AppError)
├── authErrors.ts            # Auth domain errors
├── robotErrors.ts           # Robot domain errors
├── battleErrors.ts          # Battle domain errors
├── economyErrors.ts         # Economy domain errors
├── leagueErrors.ts          # League domain errors
├── tournamentErrors.ts      # Tournament domain errors
├── tagTeamErrors.ts         # Tag-team domain errors
├── kothErrors.ts            # KotH domain errors
└── index.ts                 # Re-exports all error classes and codes

src/middleware/
└── errorHandler.ts          # New dedicated error middleware
```

### Error Class Hierarchy

```
Error
└── AppError (code, statusCode, details)
    ├── OnboardingError
    ├── AuthError
    ├── RobotError
    ├── BattleError
    ├── EconomyError
    ├── LeagueError
    ├── TournamentError
    ├── TagTeamError
    └── KothError
```

### Error Response Flow

```
Route Handler throws/rejects
    → Express 5 catches automatically
    → errorHandler middleware
        → instanceof AppError? → { error, code, details } with appError.statusCode
        → instanceof PrismaClientKnownRequestError? → mapped status + code
        → unknown? → 500 + INTERNAL_ERROR (stack logged, not exposed)
```

## Components and Interfaces

### AppError Base Class (`src/errors/AppError.ts`)

```typescript
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

### Domain Error Class Pattern

Each domain error follows the same pattern (example: `BattleError`):

```typescript
export const BattleErrorCode = {
  BATTLE_NOT_FOUND: 'BATTLE_NOT_FOUND',
  INVALID_BATTLE_STATE: 'INVALID_BATTLE_STATE',
  ROBOT_NOT_ELIGIBLE: 'ROBOT_NOT_ELIGIBLE',
  BATTLE_ALREADY_COMPLETED: 'BATTLE_ALREADY_COMPLETED',
  BATTLE_SIMULATION_FAILED: 'BATTLE_SIMULATION_FAILED',
} as const;

export type BattleErrorCodeType = typeof BattleErrorCode[keyof typeof BattleErrorCode];

export class BattleError extends AppError {
  constructor(code: BattleErrorCodeType, message: string, statusCode = 400, details?: unknown) {
    super(code, message, statusCode, details);
    this.name = 'BattleError';
  }
}
```

### Error Handler Middleware (`src/middleware/errorHandler.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import logger from '../config/logger';

const PRISMA_ERROR_MAP: Record<string, { statusCode: number; code: string }> = {
  P2002: { statusCode: 409, code: 'DATABASE_UNIQUE_VIOLATION' },
  P2025: { statusCode: 404, code: 'DATABASE_RECORD_NOT_FOUND' },
  P2003: { statusCode: 400, code: 'DATABASE_FOREIGN_KEY_VIOLATION' },
  P2014: { statusCode: 400, code: 'DATABASE_RELATION_VIOLATION' },
};

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Structured app errors
  if (err instanceof AppError) {
    logger.warn('App error', { code: err.code, status: err.statusCode, method: req.method, path: req.originalUrl });
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Prisma known errors
  if (err.constructor?.name === 'PrismaClientKnownRequestError' && 'code' in err) {
    const prismaCode = (err as any).code as string;
    const mapping = PRISMA_ERROR_MAP[prismaCode];
    if (mapping) {
      logger.warn('Prisma error', { prismaCode, mapped: mapping.code, method: req.method, path: req.originalUrl });
      res.status(mapping.statusCode).json({ error: err.message, code: mapping.code });
      return;
    }
  }

  // Unknown errors
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'acceptance';
  logger.error('Unhandled error', { message: err.message, stack: err.stack, method: req.method, path: req.originalUrl });
  res.status(500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    ...(isProduction ? {} : { message: err.message, stack: err.stack }),
  });
}
```

### Structured Error Response Shape

All API error responses conform to:

```typescript
interface ErrorResponse {
  error: string;       // Human-readable message
  code: string;        // Machine-readable error code
  details?: unknown;   // Optional structured data (validation errors, etc.)
}
```

## Data Models

No data model changes. This is a code-level refactoring of error handling patterns.

## Error Code Reference by Domain

### Auth
`INVALID_CREDENTIALS`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `USER_NOT_FOUND`, `USER_ALREADY_EXISTS`, `EMAIL_ALREADY_EXISTS`, `UNAUTHORIZED`, `FORBIDDEN`

### Robot
`ROBOT_NOT_FOUND`, `ROBOT_NOT_OWNED`, `ROBOT_DESTROYED`, `ROBOT_NAME_TAKEN`, `INVALID_ROBOT_ATTRIBUTES`, `MAX_ROBOTS_REACHED`

### Battle
`BATTLE_NOT_FOUND`, `INVALID_BATTLE_STATE`, `ROBOT_NOT_ELIGIBLE`, `BATTLE_ALREADY_COMPLETED`, `BATTLE_SIMULATION_FAILED`

### Economy
`INSUFFICIENT_CREDITS`, `FACILITY_MAX_LEVEL`, `INVALID_FACILITY_TYPE`, `FACILITY_NOT_FOUND`, `WEAPON_NOT_FOUND`, `WEAPON_NOT_AFFORDABLE`, `INVALID_TRANSACTION`

### League
`LEAGUE_NOT_FOUND`, `INVALID_LEAGUE_TIER`, `LEAGUE_INSTANCE_FULL`, `PROMOTION_BLOCKED`, `RELEGATION_BLOCKED`, `NO_ELIGIBLE_ROBOTS`

### Tournament
`TOURNAMENT_NOT_FOUND`, `TOURNAMENT_ALREADY_COMPLETED`, `TOURNAMENT_NOT_ACTIVE`, `INSUFFICIENT_PARTICIPANTS`, `ROUND_NOT_READY`, `INVALID_TOURNAMENT_STATE`

### Tag Team
`TAG_TEAM_NOT_FOUND`, `INVALID_TEAM_COMPOSITION`, `TEAM_NOT_ELIGIBLE`, `TAG_TEAM_LEAGUE_NOT_FOUND`

### KotH
`KOTH_NOT_FOUND`, `KOTH_ALREADY_COMPLETED`, `INSUFFICIENT_KOTH_PARTICIPANTS`, `INVALID_KOTH_STATE`

### Onboarding (existing)
`TUTORIAL_STATE_NOT_FOUND`, `INVALID_STEP_TRANSITION`, `INVALID_STRATEGY`, `INVALID_STEP_RANGE`, `RESET_BLOCKED`, `RESET_INVALID_CONFIRMATION`, `TUTORIAL_ALREADY_COMPLETED`, `INVALID_CHOICES`, `ONBOARDING_INTERNAL_ERROR`

## Correctness Properties

### Property 1: All service errors are AppError instances

For any service function that throws an error for a known business logic violation, the thrown error must be an instance of `AppError` (or a subclass). Generic `Error` or raw strings are not permitted for known error scenarios.

**Validates: Requirements 4.1–4.8**

### Property 2: Error middleware produces consistent response shape

For any error that reaches the error middleware, the HTTP response body must conform to the `ErrorResponse` interface: it must have an `error` string and a `code` string. The `details` field is optional.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 3: No route handler directly sends error responses

For any route handler file in `src/routes/`, no error-path code should call `res.status(4xx).json({ error: ... })` directly. All error responses must flow through the error middleware via thrown `AppError` instances.

**Validates: Requirements 5.1, 5.2, 5.3**

## Documentation Impact

The following existing documentation and steering files will need updating:

- `.kiro/steering/error-handling-logging.md` — Currently describes a different error response shape (`{ success, error: { message, code, details, timestamp } }`). Must be updated to reflect the new `{ error, code, details? }` shape and the `AppError` hierarchy.
- `.kiro/steering/coding-standards.md` — Error Handling section should reference `AppError` as the standard pattern for all new service errors.
- `docs/guides/ERROR_CODES.md` — New document listing all error codes by domain (does not exist yet).

## Testing Strategy

### Unit Tests
- Test `AppError` class: constructor, prototype chain, `instanceof` checks
- Test each domain error class: constructor, inheritance from `AppError`, error codes
- Test `errorHandler` middleware: AppError handling, Prisma error mapping, unknown error handling, production vs development response shapes

### Integration Tests
- Test that route handlers propagate service errors to the middleware correctly
- Test that the full request → error → response cycle produces the expected `ErrorResponse` shape

### Property-Based Tests
- Generate random error codes and messages, verify `AppError` always produces valid instances
- Generate random Prisma error codes, verify the middleware maps known codes correctly and falls back to 500 for unknown codes

### Migration Verification
- After each domain migration, run the full backend test suite to verify no regressions
- Verify that existing onboarding error tests still pass after `OnboardingError` is refactored to extend `AppError`
