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
| `PASSWORD_RESET_NOT_ALLOWED` | 400 | Admin password reset for a generated stable, which has no player (`adminPlayersService.ts`); Automaton accounts answer `AUTOMATON_ACCOUNT_LOCKED` |
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
| `ROBOT_NOT_BATTLE_READY` | 500 | Internal: a robot without a main weapon reached the combat simulator. The battle-time readiness check forfeits such robots first, so this only fires if that check was bypassed; the match is cancelled by the per-match failure policy. `details.robotIds` lists the weaponless robots. Never returned to players |
| `BATTLE_LOG_UNREADABLE` | 500 | Internal: a battle's stored combat log (`battle_log_zst`) could not be decompressed or parsed. `details.battleId` names the battle. The log is never partially returned |

### Economy Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INSUFFICIENT_CREDITS` | 400 | User does not have enough credits |
| `FACILITY_MAX_LEVEL` | 400 | Facility is already at maximum level |
| `INVALID_FACILITY_TYPE` | 400 | Facility type does not exist |
| `FACILITY_NOT_FOUND` | 404 | Facility does not exist |
| `WEAPON_NOT_FOUND` | 404 | Weapon does not exist |
| `WEAPON_NOT_AFFORDABLE` | 400 | User cannot afford the weapon |
| `WEAPON_EQUIPPED` | 409 | Weapon is currently equipped on a robot — unequip before selling |
| `INVALID_TRANSACTION` | 400 | Transaction is invalid |
| `STORAGE_CAPACITY_FULL` | 400 | Weapon storage capacity is full |
| `WEAPON_REFINEMENT_TIER_LOCKED` | 403 | Refinement Lab level is below the required level for the requested refinement tier; `details: { requiredRefinementLabLevel, currentRefinementLabLevel }` (Season 2; before that the Weapons Workshop gated refinement) |
| `WEAPON_REFINEMENT_SLOT_CAP_EXCEEDED` | 409 | Weapon already has 5 refinements (the per-weapon hard cap) |
| `WEAPON_REFINEMENT_TIER_CAP_EXCEEDED` | 409 | Sharpen or Forge already has 2 instances on this weapon (per-tier cap) |
| `WEAPON_REFINEMENT_ATTRIBUTE_STACK_CAP_EXCEEDED` | 409 | Adding the requested magnitude would push the attribute total above +10 |
| `WEAPON_REFINEMENT_MAGNITUDE_OUT_OF_RANGE` | 400 | Magnitude not in [1, 5] for Hone/Augment, or not exactly 1 for Sharpen/Forge |
| `WEAPON_REFINEMENT_ATTRIBUTE_NOT_ON_WEAPON` | 400 | Hone target attribute is not present on the weapon (catalog or prior Augment) |
| `WEAPON_REFINEMENT_ATTRIBUTE_ALREADY_ON_WEAPON` | 400 | Augment target attribute is already granted (catalog or prior Augment) |
| `WEAPON_REFINEMENT_SHIELD_CANNOT_TAKE_DPS_TIER` | 400 | Sharpen or Forge attempted on a shield weapon |
| `WEAPON_REFINEMENT_INVALID_TIER` | 400 | Refinement tier is not one of hone, augment, sharpen or forge (service-level guard for non-HTTP callers; the route's Zod schema rejects this first) |
| `WEAPON_REFINEMENT_INVALID_TARGET_ATTRIBUTE` | 400 | Hone/Augment without a valid robot attribute target, or Sharpen/Forge with a target (service-level guard for non-HTTP callers; the route's Zod schema rejects this first) |

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
| `INSUFFICIENT_KOTH_PARTICIPANTS` | 400 | Not enough participants for KotH. No longer thrown since #536: a field that drops below the minimum at battle time is resolved by `resolveBelowMinimumField` (byes for the ready robots). The code is kept for compatibility |
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

### Subscription Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SUBSCRIPTION_CAP_EXCEEDED` | 400 | The requested set would occupy more event slots than the Stable's Booking Office level allows. `details` carries `{ currentCount, requestedCount, cap, level, heldSlots }`; `heldSlots` lists events whose slot is still occupied by a booked match, which is the non-obvious reason a save can fail. |
| `SUBSCRIPTION_DUPLICATE` | 400 | Robot is already subscribed to the requested event type. Each robot can only hold one subscription per event. |
| `SUBSCRIPTION_UNKNOWN_EVENT` | 400 | The requested event type is not a valid registered subscribable event in the Event Registry. |
| `SUBSCRIPTION_NOT_FOUND` | 404 | The robot is not subscribed to the specified event type. Cannot unsubscribe from an event the robot is not in. |

**Removed:** `EVENT_SUBSCRIPTION_LOCKED` (was 409). Unsubscribing is now permitted for
every event, so nothing raises it. A booked match no longer blocks the change — it
keeps its slot until it has been fought, which surfaces as
`SUBSCRIPTION_CAP_EXCEEDED` with the event listed in `details.heldSlots`.

### Automaton Errors (Spec #55)

Raised by the Admin_Automaton_Control endpoints (`/api/admin/automatons`, admin only), Catalogue_Sync and the Automaton_Turn. Validation failures carry every failed rule in `details.issues` (`{ rule, message, path }`); when several rules fail at once the code is `AUTOMATON_BLUEPRINTS_TOO_FEW`, then `AUTOMATON_TEAM_NAMES_MISMATCH`, else `AUTOMATON_CATALOGUE_INVALID`.

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTOMATON_ACCOUNT_LOCKED` | 409 | Password reset for an Automaton_Stable account, which has no usable password (`authErrors.ts`) |
| `AUTOMATON_BLUEPRINTS_TOO_FEW` | 400 | A robots Goal_Target would exceed the stable's buildable Robot_Blueprints (Blueprint_Slots 1…k without a gap): strategy or parameter update, blueprint deletion or slot move, Activation, Catalogue_Entry |
| `AUTOMATON_TEAM_NAMES_MISMATCH` | 400 | Team_Names do not have the count the Team_Rule needs for the strategy and blueprints; send `teamNames` in the same request |
| `AUTOMATON_CATALOGUE_INVALID` | 400 / 409 | 400: a Catalogue_Entry or admin profile/blueprint input fails the catalogue rules (weapons, loadout, Refinement_Plan, Event_Order, stable name, strategy, Goal_Targets), or an export cannot be built. 409: the profile's pinned Strategy_Version has no Strategy_Definition_File (Catalogue_Export, profile edits) |
| `AUTOMATON_NOT_FOUND` | 404 | No Automaton_Profile has this Catalogue_Key |
| `AUTOMATON_BLUEPRINT_NOT_FOUND` | 404 | The profile has no Robot_Blueprint in this Blueprint_Slot |
| `AUTOMATON_KEY_EXISTS` | 409 | The Catalogue_Key is already used by another Automaton_Profile |
| `AUTOMATON_STABLE_NAME_TAKEN` | 409 | The stable name is taken by a stable or another Automaton_Profile |
| `AUTOMATON_USERNAME_TAKEN` | 409 | Activation: the username `automaton_{catalogueKey}` already exists |
| `AUTOMATON_NOT_DRAFT` | 409 | The operation needs a Draft_Automaton (delete, Activation); the profile is active |
| `AUTOMATON_BLUEPRINT_IN_PLAY` | 409 | A live robot is linked to the Robot_Blueprint, so it cannot be deleted or moved to another slot |
| `AUTOMATON_SLOT_TAKEN` | 409 | The Blueprint_Slot is taken, or all 11 slots are used |
| `AUTOMATON_IMAGE_INVALID` | 400 | An uploaded blueprint image failed validation or processing |
| `AUTOMATON_STRATEGY_NOT_FOUND` | 404 | No Strategy_Definition_File has this `key.vN` (Strategy_Draft created from a version) or upgrade target version |
| `AUTOMATON_STRATEGY_DRAFT_NOT_FOUND` | 404 | No Strategy_Draft has this id |
| `AUTOMATON_STRATEGY_DRAFT_EXISTS` | 409 | Another Strategy_Draft already has this strategy key and version |
| `AUTOMATON_STRATEGY_DRAFT_INVALID` | 400 | The Strategy_Draft fails the definition schema or a builder rule, so it cannot be exported or previewed (`details.issues` lists every rule, with the Goal `position` for a Goal-level rule), or a new-version draft tries to change its key |
| `AUTOMATON_UPGRADE_NOT_APPLICABLE` | 409 | A Strategy_Version upgrade names a stable that is not on an older version of that strategy; nothing is upgraded. Per-stable rejections of a confirmed upgrade are not errors: they are listed in the response's `rejected` with `AUTOMATON_BLUEPRINTS_TOO_FEW` or `AUTOMATON_TEAM_NAMES_MISMATCH` |
| `AUTOMATON_WEAPON_UNKNOWN` | — | Turn only: a Robot_Blueprint names a weapon that is not in the weapon catalogue; the turn fails and raises an alert |
| `AUTOMATON_PROFILE_INVALID` | 409 / — | Turn: the stored Team_Names or Event_Order fail their shape; the turn fails. Turn_Preview (409): the pinned Strategy_Version has no file or the stored Goal_Targets do not fit it |
| `AUTOMATON_NO_PROGRESS` | — | Turn only: an executed action changed nothing (defect guard); the turn fails instead of looping |
| `AUTOMATON_CUTOVER_IN_PROGRESS` | — | Turn only, defensive: a Turn_Step was requested during a Serialized_Cycle_Cutover |

### Database Errors (Prisma)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `DATABASE_UNIQUE_VIOLATION` | 409 | Unique constraint violation (P2002) |
| `DATABASE_RECORD_NOT_FOUND` | 404 | Record not found (P2025) |
| `DATABASE_FOREIGN_KEY_VIOLATION` | 400 | Foreign key constraint violation (P2003) |
| `DATABASE_RELATION_VIOLATION` | 400 | Relation constraint violation (P2014) |

### Image Upload Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `IMAGE_MODERATION_FAILED` | 422 | Image rejected by NSFW content moderation (hard block, no override) |
| `INVALID_IMAGE` | 400 | Image dimensions outside allowed range (64×64 to 4096×4096) |
| `INVALID_IMAGE_FORMAT` | 400 | File magic bytes do not match JPEG, PNG, or WebP format |
| `MODERATION_UNAVAILABLE` | 503 | Content moderation model is not loaded — all uploads rejected (fail-closed) |
| `FILE_TOO_LARGE` | 400 | Uploaded file exceeds 2 MB size limit |
| `PREVIEW_EXPIRED` | 410 | Confirmation token has expired (5-minute TTL) — user must re-upload |
| `LOW_ROBOT_LIKENESS` | 422 | Image does not appear robot-like (soft warning — user can override with `?acknowledgeRobotLikeness=true`) |
| `ROBOT_NOT_OWNED` | 403 | Robot belongs to another user — upload denied |

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

## SchedulerErrorCode (Cycle Controls)

`SchedulerError` in `app/backend/src/errors/schedulerErrors.ts`.

| Code | HTTP | Description |
|---|---|---|
| `SCHEDULER_UNKNOWN_JOB` | 400 | The job name is not one of the scheduler's jobs (`startManualRun`). Route validation normally rejects it first with `VALIDATION_ERROR`. |
| `SCHEDULER_JOB_ALREADY_ACTIVE` | 409 | That job (or a bulk run) is already queued or running; a second start would run it twice (`POST /api/admin/scheduler/runs`, `POST /api/admin/cycles/bulk`). |
| `SCHEDULER_RUN_NOT_FOUND` | 404 | No run with that id (`GET /api/admin/scheduler/runs/:id`). |

## SeasonErrorCode (Spec #45)

| Code | HTTP | Meaning |
|---|---|---|
| `ROLLOVER_IN_PROGRESS` | 409 | A season rollover is already queued or executing (admin or settlement-triggered); a second cannot start. |
| `ARCHIVE_VERIFICATION_FAILED` | 500 | Archive row counts did not match the pre-rollover counts. The purge was aborted and no data was deleted. |
| `CONFIRMATION_REQUIRED` | 400 | A destructive or irreversible action was requested without its confirmation value. |
| `SEASON_NUMBER_MISMATCH` | 400 | The confirmed season number does not match the current season (e.g. a stale admin tab or wrong-season rollover request). Distinct from `CONFIRMATION_REQUIRED` so clients can tell a missing confirmation from a wrong-season one. A queued background rollover whose season stopped being current while it waited for the scheduler lock fails with this code (409 in its run record) and changes nothing. |
| `INVALID_PREPARATION_CYCLES` | 400 | Remaining preparation cycles outside 0 to `PREPARATION_LENGTH_CYCLES`. `details` carries `{ min, max }`. |
| `PREPARATION_PHASE_ACTIVE` | 400 | The action is not permitted while the season is in its preparation phase. |
| `SEASON_NOT_FOUND` | 404 | No season or stable archive exists for the requested season number. |
| `IMAGE_LIMIT_REACHED` | 400 | The stable already holds `RETAINED_IMAGES_PER_STABLE` images. Delete one before uploading another. |
| `IMAGE_NOT_OWNED` | 403 | The image path does not resolve inside the caller's own upload directory. Returned as a generic `Access denied` that does not reveal whether the file exists. |
