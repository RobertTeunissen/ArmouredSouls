# Implementation Plan: Cron Schedule Restructure — Daily-Everything Slot Map

## Overview

Restructure the `cycleScheduler.ts` cron layout from an ad-hoc, incrementally-grown schedule into a deterministic daily slot map with heavy-mode spacing, reserved slots for future battle events, and midnight settlement. All changes are configuration-driven (env vars with sensible defaults), preserving full rollback capability. No database migrations required.

## Tasks

- [x] 1. Update environment configuration and validation
  - [x] 1.1 Update existing schedule defaults and add new env vars in `app/backend/src/config/env.ts`
    - Change `LEAGUE_SCHEDULE` default from `'0 20 * * *'` to `'0 8 * * *'`
    - Change `TOURNAMENT_SCHEDULE` default from `'0 8 * * *'` to `'0 10 * * *'`
    - Change `TAGTEAM_SCHEDULE` default from `'0 12 * * *'` to `'0 11 * * *'`
    - Change `KOTH_SCHEDULE` default from `'0 16 * * 1,3,5'` to `'0 13 * * *'`
    - Change `SETTLEMENT_SCHEDULE` default from `'0 23 * * *'` to `'0 0 * * *'`
    - Change `DAILY_REPORT_SCHEDULE` default from `'0 8 * * *'` to `'30 0 * * *'`
    - Add `TEAM_2V2_LEAGUE_SCHEDULE` (default `'0 9 * * *'`)
    - Add `TEAM_3V3_LEAGUE_SCHEDULE` (default `'0 14 * * *'`)
    - Add `TEAM_2V2_TOURNAMENT_SCHEDULE` (default `'0 15 * * *'`)
    - Add `TEAM_3V3_TOURNAMENT_SCHEDULE` (default `'0 18 * * *'`)
    - Add `GRAND_MELEE_SCHEDULE` (default `'0 17 * * *'`)
    - Expose all 5 new fields on the `EnvConfig` interface (`team2v2LeagueSchedule`, `team3v3LeagueSchedule`, `team2v2TournamentSchedule`, `team3v3TournamentSchedule`, `grandMeleeSchedule`)
    - _Requirements: R1.1, R1.3, R1.4, R1.5, R5.5_

  - [x] 1.2 Add cron expression validation at startup in `app/backend/src/config/env.ts`
    - Add `validateCronExpressions` function that validates all 11 cron fields using `node-cron`'s `validate()` method
    - Call it after config is loaded; on failure, write to stderr identifying the offending env var and call `process.exit(1)`
    - _Requirements: R8.1_

  - [x] 1.3 Add Spec 35 startup assertion in `app/backend/src/index.ts`
    - Before scheduler initialisation, query `information_schema.tables` for the `subscription` table
    - If not found, log FATAL error and `process.exit(1)` with message: "Spec 35 (Booking Office) must be deployed first"
    - _Requirements: R3.5, R12.1_

  - [x] 1.4 Update `.env.example`, `.env.production.example`, and `.env.acc.example`
    - Add the 5 new env vars with their defaults
    - Update existing schedule defaults to match the new slot map
    - _Requirements: R1.3_

- [x] 2. Checkpoint — Ensure env config compiles and existing tests still pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Restructure cycle scheduler with expanded slot map
  - [x] 3.1 Expand `SchedulerConfig` interface and `JobState` union type in `app/backend/src/services/cycle/cycleScheduler.ts`
    - Add 5 new schedule fields to `SchedulerConfig`: `team2v2LeagueSchedule`, `team3v3LeagueSchedule`, `team2v2TournamentSchedule`, `team3v3TournamentSchedule`, `grandMeleeSchedule`
    - Expand `JobState['name']` union from 5 to 10 members: add `'team2v2League'`, `'team3v3League'`, `'team2v2Tournament'`, `'team3v3Tournament'`, `'grandMelee'`
    - _Requirements: R1.1, R1.2, R4.5_

  - [x] 3.2 Implement reserved-slot stub handler factory in `app/backend/src/services/cycle/cycleScheduler.ts`
    - Create `createReservedSlotHandler(eventName: string)` that returns an async function
    - The stub reads `cycleMetadata.totalCycles`, logs an info message with event name, cycle number, and "reserved slot, no handler implemented yet", then returns a `JobContext`
    - Ensure the stub does NOT trigger monitoring alerts or count as a failure
    - _Requirements: R4.1, R4.2, R4.3, R4.4, R4.5_

  - [x] 3.3 Update `initScheduler` to register all 10 cron jobs
    - Register the 5 existing handlers (league, tournament, tagTeam, koth, settlement) with updated schedule values from config
    - Register 5 new reserved-slot stubs using `createReservedSlotHandler` for each reserved event
    - All jobs use the same `runJob` wrapper with lock, logging, and error handling
    - Update startup log message to "all 10 jobs registered and active"
    - _Requirements: R1.1, R1.2, R4.1, R4.5, R5.1_

  - [x] 3.4 Add structured logging to `runJob` wrapper
    - After each handler completes, emit a structured log entry with: `event: 'battle_event_complete'`, `eventName`, `startTimestamp`, `durationMs`, `matchesProcessed`, `failures`
    - Ensure failed handlers log the error with event name and continue (do not block subsequent events or settlement)
    - Verify the daily health report (`generateDailyReport` or equivalent) already reads per-event durations from `jobStates`; if not, add a read of `jobStates` so the report includes per-event durations and match counts for the just-closed cycle
    - _Requirements: R7.1, R7.2, R7.3, R7.4_

- [x] 4. Migrate Tag Team to daily cadence
  - [x] 4.1 Remove `shouldRunTagTeamMatchmaking` from `app/backend/src/services/tag-team/tagTeamMatchmakingService.ts`
    - Delete the function entirely
    - Remove its export from `app/backend/src/services/tag-team/index.ts`
    - _Requirements: R2.1, R2.2_

  - [x] 4.2 Update `executeTagTeamCycle` in `app/backend/src/services/cycle/cycleScheduler.ts`
    - Remove the cycle parity check (`isOddCycle` branch) — always execute tag team battles, rebalancing, and matchmaking
    - Change matchmaking lead time from 48h to 24h (daily cadence means next execution is tomorrow)
    - Preserve all existing matchmaking, battle execution, league rebalancing, and reward semantics
    - Update JSDoc comment in `app/backend/src/services/tag-team/tagTeamLeagueRebalancingService.ts` (line 221): remove "every other cycle (odd cycles only)" — rebalancing now runs daily
    - _Requirements: R2.1, R2.5_

  - [x] 4.3 Delete obsolete Tag Team property tests in `tests/tagTeamValidation.property.test.ts`
    - Remove the 5 property tests that assert odd/even cycle behavior for `shouldRunTagTeamMatchmaking`
    - These tests validate a function that no longer exists
    - _Requirements: R2.1, R2.2_

- [x] 5. Migrate KotH to daily cadence
  - [x] 5.1 Remove `getNextKothScheduledDate` and weekday logic from `app/backend/src/services/cycle/cycleScheduler.ts`
    - Delete `getNextKothScheduledDate` function (lines 526–543)
    - Remove the `kothDays` weekday array
    - In `executeKothCycle`: replace `getNextKothScheduledDate()` call with `new Date(Date.now() + 24 * 60 * 60 * 1000)` rounded to the configured hour
    - Remove `rotatingZone` day-of-week logic — use cycle number modulo for zone rotation instead (preserving 1-in-3 ratio)
    - _Requirements: R2.3, R2.4, R2.5_

- [x] 6. Checkpoint — Ensure scheduler compiles and core cycle tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Restructure admin bulk-cycle tool
  - [x] 7.1 Rewrite `executeBulkCycles` in `app/backend/src/services/admin/adminCycleService.ts`
    - Remove `shouldRunTagTeam` parity check (`currentCycleNumber % 2 === 1`)
    - Remove `isKothDay` weekday simulation (`simulatedDayOfWeek === 1 || 3 || 5`)
    - Restructure so each event runs as a self-contained block (repair → execute → rebalance → matchmaking) in slot map order, mirroring production cron handlers
    - New step ordering: 1v1 League → Team 2v2 League (stub) → 1v1 Tournament → Tag Team → KotH → Team 3v3 League (stub) → Team 2v2 Tournament (stub) → Grand Melee (stub) → Team 3v3 Tournament (stub) → Settlement
    - Reserved slot stubs log a no-op message
    - Tag Team matchmaking lead time: 24h (not 48h)
    - _Requirements: R6.1, R6.2_

  - [x] 7.2 Add admin trigger endpoints for reserved slots in `app/backend/src/routes/admin.ts`
    - Add 5 new POST endpoints: `/api/admin/team-2v2-league/trigger`, `/api/admin/team-3v3-league/trigger`, `/api/admin/team-2v2-tournament/trigger`, `/api/admin/team-3v3-tournament/trigger`, `/api/admin/grand-melee/trigger`
    - Each returns HTTP 200 with body: `{ message: "reserved slot, no handler implemented", event: "<name>" }`
    - Each emits an `adminAuditLog` row recording the no-op outcome
    - All guarded by `authenticateToken` + `requireAdmin`
    - _Requirements: R6.3, R8.2, R8.3_

- [x] 8. Update existing tests for new schedule
  - [x] 8.1 Update `tests/scheduler.property.test.ts`
    - Remove or update any tests referencing odd-cycle or Mon/Wed/Fri patterns
    - Update assertions to reflect the new 10-slot daily schedule
    - _Requirements: R2.1, R2.3, R11.4_

  - [x] 8.2 Update `tests/notifications.property.test.ts`
    - Remove or update any tests referencing odd-cycle or Mon/Wed/Fri patterns for Tag Team / KotH
    - _Requirements: R2.1, R2.3_

  - [x] 8.3 Update `tests/multiMatchScheduling.property.test.ts`
    - Remove or update any tests referencing odd-cycle or Mon/Wed/Fri patterns
    - _Requirements: R2.1, R2.3_

  - [x] 8.4 Update `tests/integration/tagTeamMultiMatchCycle.test.ts`
    - Remove or update integration tests that assume Tag Team only runs on odd cycles
    - Update to reflect daily Tag Team execution
    - _Requirements: R2.1, R2.2_

  - [x] 8.5 Update `tests/services/admin/adminCycleService.test.ts`
    - Update to reflect new slot order and removal of parity/weekday skips
    - Assert all 10 events execute in slot map order
    - _Requirements: R6.1, R6.2_

- [x] 9. Write new property-based tests
  - [x] 9.1 Write Property 1: Slot Uniqueness test in `tests/cronSchedule.property.test.ts`
    - **Property 1: For any valid slot map configuration, no two events fire in the same UTC hour within a 24-hour window**
    - Use `fast-check` to generate randomised valid cron expressions (varying hours 0–23) for all 10 slots
    - Assert uniqueness of resolved hours across all events
    - Minimum 100 iterations via `fc.assert` with `{ numRuns: 100 }`
    - **Validates: R1.1, R11.1**

  - [x] 9.2 Write Property 2: Settlement Boundary Ordering test in `tests/cronSchedule.property.test.ts`
    - **Property 2: For any valid slot map configuration, the settlement job's UTC hour (0) is strictly less than the smallest battle-event UTC hour within the same cycle**
    - Use `fast-check` to generate randomised valid configurations where settlement hour < min battle hour
    - Assert settlement fires before any battle event of the next cycle starts
    - Minimum 100 iterations via `fc.assert` with `{ numRuns: 100 }`
    - **Validates: R2.6, R5.1, R5.3, R11.2**

  - [x] 9.3 Write Property 3: Execution Logging Completeness test in `tests/cronSchedule.property.test.ts`
    - **Property 3: For any cycle number and any subset of battle event handlers that execute, each handler is logged exactly once with non-null duration**
    - Use `fast-check` to generate arbitrary cycle numbers and subsets of handlers
    - Mock the `runJob` wrapper and assert each executed handler produces exactly one structured log entry with `durationMs !== null`
    - Minimum 100 iterations via `fc.assert` with `{ numRuns: 100 }`
    - **Validates: R7.1, R11.3**

- [x] 10. Write unit tests for new functionality
  - [x] 10.1 Write unit tests for env defaults and cron validation in `tests/config/env.test.ts` and `tests/config/cronValidation.test.ts`
    - Assert all env defaults match the documented slot map (R1.1)
    - Assert invalid cron expressions cause `process.exit(1)` with clear error message
    - Assert valid expressions pass without error
    - _Requirements: R1.3, R1.4, R8.1_

  - [x] 10.2 Write unit tests for reserved slot stubs in `tests/services/cycle/reservedSlots.test.ts`
    - Assert each stub logs the expected info message with event name and cycle number
    - Assert stubs return without error
    - Assert stubs do not trigger failure counts or monitoring alerts
    - _Requirements: R4.2, R4.4_

  - [x] 10.3 Write unit tests for startup assertion in `tests/startup.test.ts`
    - Assert application exits with FATAL error when `subscription` table is missing
    - Assert application proceeds normally when `subscription` table exists
    - _Requirements: R3.5, R12.1_

  - [x] 10.4 Write unit tests for admin reserved-slot endpoints in `tests/routes/admin.test.ts`
    - Assert each reserved-slot trigger endpoint returns HTTP 200 with correct body
    - Assert `adminAuditLog` row is created per invocation
    - Assert endpoints require `authenticateToken` + `requireAdmin`
    - _Requirements: R6.3, R8.2, R8.3_

  - [x] 10.5 Write unit tests for Tag Team daily execution in `tests/services/tag-team/tagTeamMatchmaking.test.ts`
    - Assert Tag Team runs regardless of cycle parity (no odd/even check)
    - Assert matchmaking lead time is 24h (not 48h)
    - Assert `shouldRunTagTeamMatchmaking` no longer exists as an export
    - _Requirements: R2.1, R2.2_

  - [x] 10.6 Write unit tests for KotH daily execution in `tests/services/koth/kothMatchmaking.test.ts`
    - Assert KotH runs regardless of weekday (no Mon/Wed/Fri check)
    - Assert `getNextKothScheduledDate` no longer exists or is replaced by 24h offset
    - Assert zone rotation uses cycle number modulo instead of day-of-week
    - _Requirements: R2.3, R2.4_

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Update frontend Admin Cycle Controls page
  - [x] 12.1 Update Admin Cycle Controls page to render the full 10-slot map
    - Display all 10 events with per-event last-run timestamp
    - Reserved slots display a "Reserved" badge with muted styling and no "Run" button
    - Live events retain their current "Run" button behavior
    - _Requirements: R6.4_

- [x] 13. Documentation updates
  - [x] 13.1 Add `## Cron Schedule` section to `docs/architecture/PRD_SERVICE_DIRECTORY.md`
    - Add a section enumerating the full slot map table exactly as listed in R1.1
    - Include UTC times, event names, env var names, and handler status (Live/Stub)
    - _Requirements: R9.1_

  - [x] 13.2 Update `.kiro/steering/project-overview.md`
    - Add "Daily Cron Schedule" entry referencing the canonical slot map in `docs/architecture/PRD_SERVICE_DIRECTORY.md`
    - _Requirements: R9.2_

  - [x] 13.3 Update `.kiro/steering/game-mechanics-reference.md`
    - Document that all battle events run daily
    - Document that subscription (Spec 35 Booking Office) gates participation per Stable
    - _Requirements: R9.3_

  - [x] 13.4 Update `.kiro/steering/environments-and-deployment.md`
    - Update cron schedule table with new times
    - Remove "Mon/Wed/Fri" for KotH
    - Add reserved slots with their times and env vars
    - _Requirements: R9.1_

  - [x] 13.5 Update `docs/game-systems/PRD_CYCLE_SYSTEM.md`
    - Remove "odd cycles only" references for Tag Team
    - Remove "Mon/Wed/Fri only" references for KotH
    - Update schedule table to new slot map
    - Update bulk cycle step table to match new self-contained ordering
    - _Requirements: R2.1, R2.3, R6.1_

  - [x] 13.6 Update `docs/game-systems/PRD_MATCHMAKING.md`
    - KotH schedule section: change "Mon/Wed/Fri at 16:00 UTC" to "daily at 13:00 UTC"
    - _Requirements: R2.3_

  - [x] 13.7 Update `docs/game-systems/GAME_DESIGN.md`
    - Battle modes table: Tag Team "48h cadence" → "daily (11:00 UTC)"
    - Battle modes table: KotH "Mon/Wed/Fri (16:00 UTC)" → "daily (13:00 UTC)"
    - _Requirements: R2.1, R2.3_

  - [x] 13.8 Update `src/content/guide/getting-started/daily-cycle.md`
    - Remove odd/even cycle distinction for Tag Team
    - Update schedule table to reflect daily cadence for all events
    - Change 48h lead time references to 24h
    - _Requirements: R2.1_

  - [x] 13.9 Update `src/content/guide/facilities/booking-office.md`
    - Tag Team row: remove "on odd cycles" language
    - _Requirements: R2.1_

  - [x] 13.10 Update `src/content/guide/king-of-the-hill/entry-requirements.md`
    - Schedule section: change "Mon/Wed/Fri at 4:00 PM UTC" to "daily at 1:00 PM UTC"
    - _Requirements: R2.3_

  - [x] 13.11 Add rollback procedure to `docs/guides/DEPLOYMENT.md`
    - Document the env-var rollback procedure (set previous values, restore deleted helpers from git, restart)
    - List Spec 35 as a hard prerequisite for this spec's deployment
    - _Requirements: R10.1, R10.2, R10.3, R12.1_

  - [x] 13.12 Update `docs/BACKLOG.md`
    - Add/update entry for Spec 36 referencing `.kiro/specs/to-do/36-cron-schedule-restructure/`
    - _Requirements: R9.4_

  - [x] 13.13 Create public changelog entry via the in-game changelog system
    - Explain: Tag Team and KotH now run daily; settlement moves to midnight UTC; subscriptions (Spec 35) gate which events apply per Stable
    - _Requirements: R9.5_

- [x] 14. Final verification
  - [x] 14.1 Run Verification Criteria from requirements document
    - Run: `grep -n "LEAGUE_SCHEDULE\|TOURNAMENT_SCHEDULE\|TAGTEAM_SCHEDULE\|KOTH_SCHEDULE\|SETTLEMENT_SCHEDULE" app/backend/src/config/env.ts` — verify defaults match slot map
    - Run: `grep -n "TEAM_2V2_LEAGUE_SCHEDULE\|TEAM_3V3_LEAGUE_SCHEDULE\|TEAM_2V2_TOURNAMENT_SCHEDULE\|TEAM_3V3_TOURNAMENT_SCHEDULE\|GRAND_MELEE_SCHEDULE" app/backend/src/config/env.ts` — verify 5 new env entries exist
    - Run: `grep -rn "shouldRunTagTeamMatchmaking" app/backend/src/` — verify no matches (helper deleted)
    - Run: `grep -rn "getNextKothScheduledDate\|kothDays\s*=\s*\[" app/backend/src/` — verify no matches
    - Run: `grep -rn "isStableSubscribedTo\b" app/backend/src/services/tag-team/ app/backend/src/services/koth/` — verify subscription helper is invoked
    - Run: `cd app/backend && npm test -- cycleScheduler` — all scheduler tests pass
    - Run: `cd app/backend && npm test -- adminBulkCycle` — bulk-cycle tool tests pass
    - Run: `grep -n "## Cron Schedule" docs/architecture/PRD_SERVICE_DIRECTORY.md` — documentation section exists
    - Run: `grep -n "Cron Schedule\|Daily Cadence" .kiro/steering/project-overview.md` — steering file references canonical layout
    - Run: `grep -n "cron-schedule-restructure" docs/BACKLOG.md` — backlog entry exists
    - Verify all documentation updates from R9.1–R9.5 are present (R9.6 gate)
    - _Requirements: R1.1, R1.3, R2.1, R2.2, R2.3, R2.4, R3.1, R3.2, R6.1, R6.2, R9.1, R9.2, R9.4, R9.6_

## Notes

- All tasks are mandatory — no optional tasks
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The design uses TypeScript throughout — all implementation uses TypeScript 5.8 strict mode
- This spec depends on Spec 35 (Booking Office) being deployed first — enforced by startup assertion
- No database migrations needed — all changes are config, code, and documentation
- `shouldRunTagTeamMatchmaking` deletion affects: the function itself, its export in `index.ts`, and 5 property tests in `tagTeamValidation.property.test.ts`
- `getNextKothScheduledDate` deletion only affects `executeKothCycle` in the same file
- Tag Team matchmaking lead time changes from 48h to 24h
- Subscription integration (R3.1–R3.4) is already implemented by Spec 35 — reaffirmed here, no code changes needed (R3.4)
- R12.2 (future specs register handlers into reserved slots) is a forward-looking constraint satisfied by the reserved-slot pattern in tasks 3.2/3.3

## Requirements Coverage Matrix

| Requirement | Covered by Task(s) |
|-------------|-------------------|
| R1.1 | 1.1, 3.1, 3.3, 9.1, 14.1 |
| R1.2 | 3.1, 3.3 |
| R1.3 | 1.1, 1.4, 10.1, 14.1 |
| R1.4 | 1.1, 10.1 |
| R1.5 | 1.1 |
| R2.1 | 4.1, 4.2, 4.3, 8.1, 8.2, 8.3, 8.4, 10.5, 13.5, 13.7, 13.8, 13.9, 14.1 |
| R2.2 | 4.1, 4.3, 8.4, 10.5, 14.1 |
| R2.3 | 5.1, 8.1, 8.2, 8.3, 10.6, 13.5, 13.6, 13.7, 13.10, 14.1 |
| R2.4 | 5.1, 10.6, 14.1 |
| R2.5 | 4.2, 5.1 |
| R2.6 | 9.2 |
| R3.1 | 14.1 (reaffirmed — no code changes per R3.4) |
| R3.2 | 14.1 (reaffirmed — no code changes per R3.4) |
| R3.3 | (reaffirmed — no code changes per R3.4, already in Spec 35) |
| R3.4 | (constraint — no modifications to subscription helper) |
| R3.5 | 1.3, 10.3 |
| R4.1 | 3.2, 3.3 |
| R4.2 | 3.2, 10.2 |
| R4.3 | 3.2 |
| R4.4 | 3.2, 10.2 |
| R4.5 | 3.1, 3.2, 3.3 |
| R5.1 | 3.3, 9.2 |
| R5.2 | (no changes to settlement step order — preserved by design) |
| R5.3 | 9.2 |
| R5.4 | (existing concurrency model preserved — lock serialisation) |
| R5.5 | 1.1 |
| R6.1 | 7.1, 8.5, 13.5, 14.1 |
| R6.2 | 7.1, 8.5, 14.1 |
| R6.3 | 7.2, 10.4 |
| R6.4 | 12.1 |
| R7.1 | 3.4, 9.3 |
| R7.2 | 3.4 |
| R7.3 | 3.4 |
| R7.4 | 3.4 |
| R8.1 | 1.2, 10.1 |
| R8.2 | 7.2, 10.4 |
| R8.3 | 7.2, 10.4 |
| R9.1 | 13.1, 13.4 |
| R9.2 | 13.2 |
| R9.3 | 13.3 |
| R9.4 | 13.12 |
| R9.5 | 13.13 |
| R9.6 | 14.1 |
| R10.1 | 13.11 (env-var rollback documented) |
| R10.2 | 13.11 |
| R10.3 | 13.11 |
| R11.1 | 9.1 |
| R11.2 | 9.2 |
| R11.3 | 9.3 |
| R11.4 | 8.1, 9.1, 9.2, 9.3 |
| R12.1 | 1.3, 10.3, 13.11 |
| R12.2 | 3.2, 3.3 (reserved-slot pattern enables future handler registration) |

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1", "5.1"] },
    { "id": 4, "tasks": ["3.3", "4.2", "4.3"] },
    { "id": 5, "tasks": ["3.4"] },
    { "id": 6, "tasks": ["7.1", "7.2"] },
    { "id": 7, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5"] },
    { "id": 8, "tasks": ["9.1", "9.2", "9.3"] },
    { "id": 9, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6"] },
    { "id": 10, "tasks": ["12.1"] },
    { "id": 11, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5", "13.6", "13.7", "13.8", "13.9", "13.10", "13.11", "13.12", "13.13"] },
    { "id": 12, "tasks": ["14.1"] }
  ]
}
```
