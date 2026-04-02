# Error Codes Reference

This document lists all structured error codes used in the Armoured Souls backend API.

## Standard Error Response Shape

All API error responses conform to this TypeScript interface:

```typescript
interface ErrorResponse {
  error: string;       // Human-readable message
  code: string;        // Machine-readable error code
  details?: unknown;   // Optional structured data (validation errors, etc.)
}
```

Example error response:
```json
{
  "error": "Robot does not exist",
  "code": "ROBOT_NOT_FOUND"
}
```

Example with details:
```json
{
  "error": "Invalid robot attributes",
  "code": "INVALID_ROBOT_ATTRIBUTES",
  "details": {
    "fields": ["strength", "agility"],
    "message": "Attributes must sum to 100"
  }
}
```

## HTTP Status Code Conventions

| Status Code | Meaning | When Used |
|-------------|---------|-----------|
| 400 | Bad Request | Invalid input, business rule violation |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource (unique constraint violation) |
| 500 | Internal Server Error | Unexpected server error |

## Error Code Domains

### Auth Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Username or password is incorrect |
| `INVALID_TOKEN` | 401 | JWT token is malformed or invalid |
| `TOKEN_EXPIRED` | 401 | JWT token has expired |
| `USER_NOT_FOUND` | 404 | User does not exist |
| `USER_ALREADY_EXISTS` | 409 | Username is already taken |
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already registered |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |

### Robot Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `ROBOT_NOT_FOUND` | 404 | Robot does not exist |
| `ROBOT_NOT_OWNED` | 403 | Robot belongs to another user |
| `ROBOT_DESTROYED` | 400 | Robot is destroyed and cannot perform action |
| `ROBOT_NAME_TAKEN` | 409 | Robot name is already in use |
| `INVALID_ROBOT_ATTRIBUTES` | 400 | Robot attributes are invalid |
| `MAX_ROBOTS_REACHED` | 400 | User has reached maximum robot limit |
| `ROBOT_STATS_REFRESH_FAILED` | 500 | Failed to refresh robot statistics view |

### Battle Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BATTLE_NOT_FOUND` | 404 | Battle does not exist |
| `INVALID_BATTLE_STATE` | 400/500 | Battle is in an invalid state |
| `ROBOT_NOT_ELIGIBLE` | 400/404 | Robot is not eligible for battle |
| `BATTLE_ALREADY_COMPLETED` | 400 | Battle has already finished |
| `BATTLE_SIMULATION_FAILED` | 400 | Battle simulation encountered an error |

### Economy Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INSUFFICIENT_CREDITS` | 400 | User does not have enough credits |
| `FACILITY_MAX_LEVEL` | 400 | Facility is already at maximum level |
| `INVALID_FACILITY_TYPE` | 400 | Facility type does not exist |
| `FACILITY_NOT_FOUND` | 404 | Facility does not exist |
| `WEAPON_NOT_FOUND` | 404 | Weapon does not exist |
| `WEAPON_NOT_AFFORDABLE` | 400 | User cannot afford the weapon |
| `INVALID_TRANSACTION` | 400 | Transaction is invalid |
| `STORAGE_CAPACITY_FULL` | 400 | Weapon storage capacity is full |

### League Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `LEAGUE_NOT_FOUND` | 404 | League does not exist |
| `INVALID_LEAGUE_TIER` | 400 | League tier is invalid |
| `LEAGUE_INSTANCE_FULL` | 400 | League instance has reached capacity |
| `PROMOTION_BLOCKED` | 400 | Robot cannot be promoted (already at top tier) |
| `RELEGATION_BLOCKED` | 400 | Robot cannot be relegated (already at bottom tier) |
| `NO_ELIGIBLE_ROBOTS` | 400 | No robots are eligible for the operation |

### Tournament Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `TOURNAMENT_NOT_FOUND` | 404 | Tournament does not exist |
| `TOURNAMENT_ALREADY_COMPLETED` | 400 | Tournament has already finished |
| `TOURNAMENT_NOT_ACTIVE` | 400 | Tournament is not currently active |
| `INSUFFICIENT_PARTICIPANTS` | 400 | Not enough participants for tournament |
| `ROUND_NOT_READY` | 400 | Tournament round is not ready to advance |
| `INVALID_TOURNAMENT_STATE` | 400 | Tournament is in an invalid state |
| `MATCH_MISSING_ROBOTS` | 400 | Tournament match is missing required robots |
| `INVALID_MATCH_STATE` | 400 | Tournament match is in an invalid state |
| `BATTLE_RECORD_FAILED` | 500 | Failed to record tournament battle result |

### Tag Team Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `TAG_TEAM_NOT_FOUND` | 404 | Tag team does not exist |
| `INVALID_TEAM_COMPOSITION` | 400 | Team composition is invalid |
| `TEAM_NOT_ELIGIBLE` | 400 | Team is not eligible for the operation |
| `TAG_TEAM_LEAGUE_NOT_FOUND` | 404 | Tag team league does not exist |

### KotH Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `KOTH_NOT_FOUND` | 404 | KotH match does not exist |
| `KOTH_ALREADY_COMPLETED` | 400 | KotH match has already finished |
| `INSUFFICIENT_KOTH_PARTICIPANTS` | 400 | Not enough participants for KotH |
| `INVALID_KOTH_STATE` | 400 | KotH match is in an invalid state |

### Onboarding Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `TUTORIAL_STATE_NOT_FOUND` | 404 | Tutorial state does not exist |
| `INVALID_STEP_TRANSITION` | 400 | Invalid step transition attempted |
| `INVALID_STRATEGY` | 400 | Invalid strategy selection |
| `INVALID_STEP_RANGE` | 400 | Step number is out of valid range |
| `RESET_BLOCKED` | 400 | Reset is blocked by active conditions |
| `RESET_INVALID_CONFIRMATION` | 400 | Reset confirmation is invalid |
| `TUTORIAL_ALREADY_COMPLETED` | 400 | Tutorial has already been completed |
| `INVALID_CHOICES` | 400 | Invalid choices provided |
| `ONBOARDING_INTERNAL_ERROR` | 500 | Internal onboarding error |

### Database Errors (Prisma)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `DATABASE_UNIQUE_VIOLATION` | 409 | Unique constraint violation (P2002) |
| `DATABASE_RECORD_NOT_FOUND` | 404 | Record not found (P2025) |
| `DATABASE_FOREIGN_KEY_VIOLATION` | 400 | Foreign key constraint violation (P2003) |
| `DATABASE_RELATION_VIOLATION` | 400 | Relation constraint violation (P2014) |

### Generic Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INTERNAL_ERROR` | 500 | Unexpected internal server error |
| `VALIDATION_ERROR` | 400 | Request failed schema validation — response includes `details.fields` array with per-field violations |
| `FORBIDDEN` | 403 | Authenticated user does not have permission to access or modify the requested resource |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests — response includes `retryAfter` (seconds) indicating when the client may retry |

## Error Handling Architecture

All errors extend the base `AppError` class:

```typescript
class AppError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;
}
```

Domain-specific errors (e.g., `AuthError`, `RobotError`) extend `AppError` and provide type-safe error codes.

The centralized `errorHandler` middleware in `src/middleware/errorHandler.ts` handles all errors:
1. `AppError` instances → Returns `{ error, code, details? }` with the error's status code
2. Prisma errors → Maps to appropriate HTTP status and code
3. Unknown errors → Returns 500 with `INTERNAL_ERROR` code

## Security Error Code Examples

### VALIDATION_ERROR (400)

Returned when request data fails Zod schema validation. The `details.fields` array lists all violations:

```json
{
  "error": "Invalid request body",
  "code": "VALIDATION_ERROR",
  "details": {
    "fields": [
      { "field": "name", "message": "Contains disallowed characters" },
      { "field": "weaponId", "message": "Expected number, received string" }
    ]
  }
}
```

### FORBIDDEN (403)

Returned when an authenticated user attempts to access or modify a resource they don't own. The message is intentionally generic to prevent resource enumeration:

```json
{
  "error": "Access denied",
  "code": "FORBIDDEN"
}
```

### RATE_LIMIT_EXCEEDED (429)

Returned when a client exceeds the rate limit. The response includes a `Retry-After` HTTP header and a `retryAfter` field in the body:

```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

## Frontend Usage

Frontend consumers can switch on the `code` field to display context-appropriate messages:

```typescript
try {
  await api.purchaseFacility(facilityType);
} catch (error) {
  switch (error.code) {
    case 'INSUFFICIENT_CREDITS':
      showToast('Not enough credits for this purchase');
      break;
    case 'FACILITY_MAX_LEVEL':
      showToast('This facility is already at maximum level');
      break;
    default:
      showToast(error.error || 'An error occurred');
  }
}
```
