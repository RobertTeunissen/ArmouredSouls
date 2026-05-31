# Implementation Plan: Booking Office Facility — Event Subscription System

## Overview

This plan implements the dormant Booking Office facility with event-subscription semantics. The system introduces a per-robot subscription model gating participation in all battle events through a single, extensible Event Registry. Implementation proceeds from backend infrastructure (schema, config, services) through matchmaker integration, migration tooling, frontend surfaces, documentation, and final verification.

## Tasks

- [x] 1. Backend infrastructure: Prisma schema, config, and error codes
  - [x] 1.1 Add `Subscription` model to Prisma schema and run migration
    - Add the `Subscription` model to `app/backend/prisma/schema.prisma` with fields `id`, `robotId`, `eventType`, `createdAt`
    - Add `@@unique([robotId, eventType])`, `@@index([robotId])`, `@@index([eventType])`, `@@map("subscriptions")`
    - Add `subscriptions Subscription[]` relation to the `Robot` model
    - Run `npx prisma migrate dev --name add-subscription-table` and `npx prisma generate`
    - _Requirements: R3.1, R3.6_

  - [x] 1.2 Create subscription config at `app/backend/src/config/subscriptions.ts`
    - Export `BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT` constant array `[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]`
    - Export `getSubscriptionCap(bookingOfficeLevel: number): number` helper with clamping
    - _Requirements: R2.1, R2.2, R2.3, R2.4, R2.5_

  - [x] 1.3 Update `app/backend/src/config/facilities.ts` — activate Booking Office
    - Set `implemented: true` on the `booking_office` row
    - Update `description` to reflect event-subscription semantics
    - Set `costs` to `[75000, 150000, 225000, 300000, 375000, 450000, 525000, 600000, 675000, 750000]`
    - Set `prestigeRequirements` to `[0, 0, 0, 1000, 0, 0, 5000, 0, 10000, 0]`
    - Update `benefits` array to describe per-level subscription counts
    - Confirm `maxLevel` remains 10
    - _Requirements: R1.1, R1.2, R1.3, R1.4, R1.5, R1.6_

  - [x] 1.4 Create `app/backend/src/errors/subscriptionErrors.ts`
    - Define `SubscriptionErrorCode` const object with codes: `SUBSCRIPTION_CAP_EXCEEDED`, `SUBSCRIPTION_DUPLICATE`, `SUBSCRIPTION_UNKNOWN_EVENT`, `EVENT_SUBSCRIPTION_LOCKED`, `SUBSCRIPTION_NOT_FOUND`, `ACCESS_DENIED`
    - Define `SubscriptionError` class extending `AppError`
    - _Requirements: R3.2, R3.3, R3.4, R4.3, R10.3_

- [x] 2. Event Registry and locking predicates
  - [x] 2.1 Create `app/backend/src/services/subscription/eventRegistry.ts`
    - Define `SubscribableEventType` type union: `'league' | 'tournament' | 'tag_team' | 'koth'`
    - Define `SubscribableEventDefinition` interface with `type`, `label`, `lockingPredicate`
    - Implement `registerSubscribableEvent`, `getRegisteredEvents`, `getEventDefinition`, `isRegisteredEvent`, `getLockingPredicate`
    - Throw on duplicate registration
    - _Requirements: R5.1, R5.2, R5.3, R5.4, R5.6_

  - [x] 2.2 Create `app/backend/src/services/subscription/lockingPredicates.ts`
    - Implement `leagueLockingPredicate(robotId)` — checks `ScheduledLeagueMatch` with `status: 'scheduled'`
    - Implement `tournamentLockingPredicate(robotId)` — checks `ScheduledTournamentMatch` alive in active bracket
    - Implement `tagTeamLockingPredicate(robotId)` — checks `ScheduledTagTeamMatch` with `status: 'scheduled'`
    - Implement `kothLockingPredicate(robotId)` — checks `ScheduledKothMatchParticipant` with match `status: 'scheduled'`
    - _Requirements: R5.7, R4.3, R4.7, R4.9_

  - [x] 2.3 Create `app/backend/src/services/subscription/rosterEligibilityFilter.ts`
    - Define `ELIGIBILITY_RULES` array with `minRobots` per event type (league=1, tournament=1, koth=1, tag_team=2)
    - Export `getEligibleEvents(robotCount): EligibleEvent[]` function
    - _Requirements: R8.1, R8.2, R8.3, R9.8_

  - [x] 2.4 Register v1 events in `app/backend/src/index.ts` at startup
    - Import `registerSubscribableEvent` and all four locking predicates
    - Register `league`, `tournament`, `tag_team`, `koth` before cycle scheduler init
    - _Requirements: R5.3, R14.1, R14.2_

- [x] 3. Subscription service
  - [x] 3.1 Create `app/backend/src/services/subscription/subscriptionService.ts`
    - Implement `isRobotSubscribedTo(robotId, eventType): Promise<boolean>` — single DB existence check
    - Implement `subscribeRobot(robotId, eventType, requestingUserId)` — transactional with ownership check, registry validation, duplicate check, cap check, create row, audit log, structured log
    - Implement `unsubscribeRobot(robotId, eventType, requestingUserId)` — transactional with ownership check, locking predicate check, delete row, audit log, structured log
    - Implement `getSubscriptionsForRobot(robotId)` — returns all subscriptions + cap info
    - Implement `getStableOverview(userId)` — returns matrix of all robots × all events
    - _Requirements: R3.1, R3.2, R3.3, R3.4, R3.5, R3.6, R3.7, R3.8, R4.1, R4.2, R4.3, R4.4, R4.5, R4.6, R5.5, R10.2, R10.4, R11.1_

  - [x] 3.2 Write unit tests for subscription service at `app/backend/tests/services/subscription/subscriptionService.test.ts`
    - Test cap enforcement, duplicate prevention, lock checking, ownership verification, audit logging
    - Test `isRobotSubscribedTo` returns correct boolean
    - Test unsubscribe blocked when locking predicate returns true
    - Test unsubscribe permitted when locking predicate returns false
    - _Requirements: R3.2, R3.3, R3.5, R4.3, R4.4, R10.2_

  - [x] 3.3 Write unit tests for event registry at `app/backend/tests/services/subscription/eventRegistry.test.ts`
    - Test registration, lookup, duplicate rejection, `isRegisteredEvent`, `getRegisteredEvents`
    - _Requirements: R5.1, R5.2, R5.4_

  - [x] 3.4 Write unit tests for locking predicates at `app/backend/tests/services/subscription/lockingPredicates.test.ts`
    - Test each predicate with mocked scheduled matches (returns true when queued, false when not)
    - _Requirements: R5.7_

  - [x] 3.5 Write property-based tests at `app/backend/tests/services/subscription/subscriptionProperties.test.ts`
    - Property 1: Cap curve monotonically non-decreasing with floor ≥ 3 (R13.5)
    - Property 2: Cap never violated by any operation sequence (R13.1)
    - Property 3: Duplicate subscription prevention (R13.1)
    - Property 4: Unknown event type rejection (R13.1)
    - Property 6: Subscribe/unsubscribe does not charge credits (R13.1)
    - Property 8: Duplicate `registerSubscribableEvent` call throws at module-load time (R13.4)
    - Configure fast-check with `{ numRuns: 100 }` and verify shrinking produces minimal counterexamples on failure
    - _Requirements: R13.1, R13.4, R13.5, R13.6_

  - [x] 3.6 Write property-based tests for eligibility at `app/backend/tests/services/subscription/eligibilityProperties.test.ts`
    - Property 9: `isRobotSubscribedTo` reflects database state (R13.3)
    - _Requirements: R13.3_

- [x] 4. Checkpoint — Backend services
  - Ensure all tests pass (`cd app/backend && npm test -- subscription eventRegistry lockingPredicates`), ask the user if questions arise.

- [x] 5. API routes
  - [x] 5.1 Create `app/backend/src/routes/subscriptions.ts`
    - `GET /api/subscriptions/robot/:robotId` — get subscriptions + cap info for a robot
    - `POST /api/subscriptions/robot/:robotId/subscribe` — subscribe robot to event
    - `POST /api/subscriptions/robot/:robotId/unsubscribe` — unsubscribe robot from event
    - `GET /api/subscriptions/overview` — stable-level matrix (all robots × all events)
    - `GET /api/subscriptions/registry` — list registered events with eligibility
    - `GET /api/subscriptions/admin/analytics` — admin per-event subscriber counts + trends
    - All routes use `authenticateToken`, `validateRequest` with Zod schemas, ownership verification inside transactions
    - Admin analytics route uses `requireAdmin`
    - _Requirements: R10.1, R10.2, R10.3, R10.5, R10.6, R9.2, R9.10, R11.3, R11.5_

  - [x] 5.2 Register subscription routes in `app/backend/src/index.ts`
    - Import and mount at `/api/subscriptions`
    - _Requirements: R10.1_

  - [x] 5.3 Write API route tests at `app/backend/tests/routes/subscriptions.test.ts`
    - Test Zod validation, auth, ownership 403, cap exceeded 400, lock 409, success responses
    - Test admin analytics endpoint requires admin role
    - _Requirements: R10.1, R10.2, R10.3_

- [x] 6. Matchmaking integration
  - [x] 6.1 Integrate subscription check into 1v1 League matchmaker
    - In `app/backend/src/services/analytics/matchmakingService.ts` → `runMatchmaking()`
    - After `readyRobots` filter, batch-query subscriptions and filter by `league` subscription
    - Log excluded robots count per run
    - _Requirements: R7.1, R7.5, R11.2_

  - [x] 6.2 Integrate subscription check into 1v1 Tournament eligibility
    - In `app/backend/src/services/tournament/tournamentService.ts` → eligibility routine
    - Filter candidates by `tournament` subscription before bracket generation
    - Log excluded robots count per run
    - _Requirements: R7.2, R7.5, R4.8, R11.2_

  - [x] 6.3 Integrate subscription check into Tag Team matchmaker
    - In `app/backend/src/services/tag-team/tagTeamMatchmakingService.ts` → `runTagTeamMatchmaking()`
    - Filter teams where BOTH active and reserve robots are subscribed to `tag_team`
    - Log excluded teams count per run
    - _Requirements: R7.3, R7.5, R11.2_

  - [x] 6.4 Integrate subscription check into KotH matchmaker
    - In `app/backend/src/services/koth/kothMatchmakingService.ts` → `getEligibleRobots()`
    - Filter candidates by `koth` subscription
    - Log excluded robots count per run
    - _Requirements: R7.4, R7.5, R11.2_

  - [x] 6.5 Write matchmaker integration tests at `app/backend/tests/services/subscription/matchmakerIntegration.test.ts`
    - Verify `isRobotSubscribedTo` is called and exclusions are logged for each matchmaker
    - Verify robots without subscription are excluded from pools
    - _Requirements: R7.1, R7.2, R7.3, R7.4, R7.5_

- [x] 7. Checkpoint — Matchmaking integration
  - Ensure all tests pass (`cd app/backend && npm test -- matchmaking subscription`), ask the user if questions arise.

- [x] 8. Migration script and seeded user generation
  - [x] 8.1 Create migration script at `app/backend/src/scripts/migrate-booking-office.ts`
    - Standalone script with own Prisma adapter instance (per coding standards)
    - Process Stables in batches of 50
    - Per-Stable transaction: upsert `booking_office` facility to at least L1 (never lower existing), insert 4 subscription rows per robot with `skipDuplicates`
    - Emit audit log per Stable
    - Emit structured summary at end (totals processed, granted, created, errors)
    - Exit code 1 if any Stable failed
    - Idempotent: re-running produces same state
    - _Requirements: R6.1, R6.2, R6.3, R6.4, R6.5, R6.6, R6.7, R6.11, R6.12_

  - [x] 8.2 Add `migrate:booking-office` script to `app/backend/package.json`
    - Command: `ts-node src/scripts/migrate-booking-office.ts`
    - _Requirements: R6.12_

  - [x] 8.3 Update seeded user generation in `app/backend/src/utils/userGeneration.ts`
    - After robot creation, determine eligible events via `getEligibleEvents(robotCount)`
    - For 1-robot Stables: exclude `tag_team`, pick from `{league, tournament, koth}`
    - For 2+ robot Stables with `createTagTeam: true`: force `tag_team` on TagTeam robots, pick remaining 2 randomly
    - Create subscription rows via `createMany`
    - _Requirements: R6.8, R6.9, R6.10_

  - [x] 8.4 Write migration tests at `app/backend/tests/scripts/bookingOfficeMigration.test.ts`
    - Test idempotency (run twice, same state)
    - Test every existing Stable gets Booking Office level ≥ 1
    - Test every existing robot gets 4 subscriptions
    - Test new robots post-migration start with zero subscriptions
    - Test per-Stable error handling (one failure doesn't abort others)
    - _Requirements: R6.2, R6.4, R6.7_

  - [x] 8.5 Write property-based test for migration idempotency at `app/backend/tests/scripts/bookingOfficeMigration.test.ts`
    - Property 10: applying migration twice produces same state as once
    - _Requirements: R13.2_

  - [x] 8.6 Write property-based test for seeded robot subscriptions at `app/backend/tests/services/subscription/subscriptionProperties.test.ts`
    - Property 11: seeded robot gets exactly `min(3, eligibleEventCount)` subscriptions; 1-robot Stables never get `tag_team`
    - _Requirements: R6.8, R6.9, R6.10_

- [x] 9. Checkpoint — Migration and seeded generation
  - Ensure all tests pass (`cd app/backend && npm test -- bookingOfficeMigration subscription`), ask the user if questions arise.

- [x] 10. Frontend: Subscription management components
  - [x] 10.1 Create `app/frontend/src/hooks/useSubscriptions.ts`
    - Data fetching hook for robot subscriptions, stable overview, registry
    - Expose subscribe/unsubscribe mutation functions
    - _Requirements: R9.2, R9.10_

  - [x] 10.2 Create `app/frontend/src/components/subscriptions/SubscriptionManager.tsx`
    - Robot Detail subscription section: current subscriptions, cap indicator, subscribe/unsubscribe toggles
    - Disable subscribe when at cap (with upgrade prompt message)
    - Show lock indicator on locked subscriptions with tooltip
    - Filter available events by Roster_Eligibility_Filter
    - Show "no longer eligible" indicator for events where robot count dropped below threshold
    - Empty state when zero subscriptions
    - Confirmation message on change ("takes effect next cycle")
    - _Requirements: R9.2, R9.3, R9.4, R9.5, R9.7, R9.8, R9.9_

  - [x] 10.3 Create `app/frontend/src/components/subscriptions/SubscriptionMatrix.tsx`
    - Stable-level matrix: rows = robots, columns = registered events
    - Each cell is a subscribe/unsubscribe toggle (respects cap and lock state)
    - Column headers show per-event totals ("3 of 5 robots subscribed")
    - Row headers show per-robot cap usage
    - _Requirements: R9.10, R9.11_

  - [x] 10.4 Create `app/frontend/src/pages/BookingOfficePage.tsx`
    - Booking Office overview page rendering `SubscriptionMatrix`
    - Reachable from Facilities page Booking Office card and main navigation
    - _Requirements: R9.10, R9.11_

  - [x] 10.5 Create `app/frontend/src/components/subscriptions/EventBadge.tsx`
    - Compact event badge for robot cards on Robots page
    - _Requirements: R9.6_

  - [x] 10.6 Create `app/frontend/src/components/subscriptions/SubscriptionLockIndicator.tsx`
    - Lock icon + tooltip showing queued battle cycle
    - _Requirements: R9.4_

  - [x] 10.7 Update Robots page to render `EventBadge` per subscription on each robot card
    - _Requirements: R9.6_

  - [x] 10.8 Update Facilities page to link Booking Office card to `/booking-office` overview
    - _Requirements: R9.1_

  - [x] 10.9 Update Facilities page and API to filter out `implemented: false` facilities
    - Filter at API boundary (`/api/facilities` returns only implemented rows)
    - Filter at UI boundary (Facilities page does not render unimplemented rows)
    - Config-driven: reads `implemented: true` from `facilities.ts`
    - _Requirements: R9.1.1, R9.1.2, R9.1.3_

  - [x] 10.10 Add mobile-responsive layouts to all subscription UI surfaces
    - SubscriptionMatrix: stacked card layout on viewports < 1024px (one robot per card with toggleable badges)
    - SubscriptionManager (Robot Detail): vertical list of event toggles, no horizontal overflow
    - SubscriptionPicker (onboarding): full-width vertical list of selectable events
    - EventBadge on robot cards: wrap to multiple lines on narrow viewports
    - All touch targets ≥ 44px
    - Use the responsive tab layout pattern from `.kiro/steering/frontend-standards.md`
    - _Requirements: R9.12_

- [x] 11. Frontend: Onboarding subscription picker
  - [x] 11.1 Create `app/frontend/src/components/subscriptions/SubscriptionPicker.tsx`
    - Renders event list from registry filtered by Roster_Eligibility_Filter
    - Pre-selects `league`, `tournament`, `koth` for 1-robot Stables
    - Allows toggling up to cap (3 at L0)
    - Inline "Buy Booking Office L1" affordance: hidden for 1-robot Stables, disabled if insufficient credits/prestige
    - On complete: calls subscribe endpoint for each selected event
    - _Requirements: R8.1, R8.2, R8.3, R8.4, R8.5, R8.6, R8.7, R8.8_

  - [x] 11.2 Integrate `SubscriptionPicker` into `app/frontend/src/pages/OnboardingPage.tsx`
    - Add as new step after robot creation, before completion
    - _Requirements: R8.1, R8.5_

- [x] 12. Frontend: Admin surfaces
  - [x] 12.1 Add Booking Office level display to admin Stables dashboard
    - Show Booking Office level per Stable in the existing admin Stables view
    - _Requirements: R11.3_

  - [x] 12.2 Add Subscription set display to admin robot detail view
    - Show per-robot subscription list in the existing admin robot detail
    - _Requirements: R11.3_

  - [x] 12.3 Add Subscription Analytics view to admin portal
    - Per-event subscriber counts, trend over last 30 cycles, per-Stable breakdown
    - _Requirements: R11.5_

  - [x] 12.4 Add per-cycle subscription-exclusion totals to admin Cycle Controls page
    - Display alongside existing matchmaking summary
    - _Requirements: R11.4_

- [x] 13. Frontend tests
  - [x] 13.1 Write tests for subscription components at `app/frontend/src/components/subscriptions/__tests__/`
    - Test `SubscriptionManager`: cap enforcement UI, lock-state rendering, empty state, eligibility filter
    - Test `SubscriptionMatrix`: toggle behaviour, cap display, per-event totals
    - Test `EventBadge`: renders correct badge per event type
    - Test `SubscriptionLockIndicator`: renders lock icon with tooltip
    - Test mobile viewport rendering: matrix collapses to stacked cards at < 1024px, no horizontal overflow on any component, event badges wrap
    - _Requirements: R9.2, R9.3, R9.4, R9.6, R9.7, R9.10, R9.11, R9.12_

  - [x] 13.2 Write tests for onboarding picker at `app/frontend/src/pages/__tests__/OnboardingSubscriptionPicker.test.tsx`
    - Test default selections for 1-robot Stable
    - Test `tag_team` hidden for 1-robot Stable
    - Test inline buy affordance hidden for 1-robot Stable
    - Test inline buy affordance disabled when insufficient credits/prestige
    - Test completing onboarding persists selected subscriptions
    - _Requirements: R8.1, R8.2, R8.3, R8.4, R8.6, R8.7_

  - [x] 13.3 Write tests for Booking Office page at `app/frontend/src/pages/__tests__/BookingOfficePage.test.tsx`
    - Test matrix rendering, subscribe/unsubscribe from matrix, cap enforcement
    - _Requirements: R9.10, R9.11_

- [x] 14. Checkpoint — Frontend
  - Ensure all frontend tests pass (`cd app/frontend && npm test -- --run`), ask the user if questions arise.

- [x] 15. Documentation updates
  - [x] 15.1 Update `docs/game-systems/PRD_FACILITIES_PAGE.md`
    - Add `## Booking Office` section describing event-subscription semantics, per-robot Max_Events_Per_Robot, switching behaviour, per-robot lock-on-queued-battle rule, list of Subscribable Events
    - _Requirements: R12.1_

  - [x] 15.2 Update `docs/architecture/PRD_SERVICE_DIRECTORY.md`
    - Add Event_Subscription_System entry with `registerSubscribableEvent` and `isRobotSubscribedTo` documentation, one-line description of each new module
    - _Requirements: R12.2_

  - [x] 15.3 Update `.kiro/steering/project-overview.md`
    - Add `Booking Office / Event Subscription System` to the "Key Systems" list
    - _Requirements: R12.3_

  - [x] 15.4 Update `.kiro/steering/game-mechanics-reference.md`
    - Add Event Subscription System as gating mechanism for all battle event modes
    - Document per-robot Max_Events_Per_Robot
    - _Requirements: R12.4_

  - [x] 15.5 Update `docs/BACKLOG.md`
    - Mark Backlog #55 (Battle Subscription Facility) as completed with reference to `.kiro/specs/35-booking-office-facility/`
    - Update Backlog #7 to remove Booking Office from unimplemented-facilities list
    - _Requirements: R12.5_

  - [x] 15.6 Update `docs/guides/ERROR_CODES.md`
    - Add `SUBSCRIPTION_CAP_EXCEEDED`, `SUBSCRIPTION_DUPLICATE`, `SUBSCRIPTION_UNKNOWN_EVENT`, `EVENT_SUBSCRIPTION_LOCKED`, `SUBSCRIPTION_NOT_FOUND` error codes with descriptions
    - _Requirements: R10.3, R3.2, R3.3, R3.4, R4.3_

  - [x] 15.7 Create in-game guide article via existing guide system
    - Explain Booking Office facility, subscribable events, how to subscribe/switch per robot, per-robot lock rule, how to add a 4th subscription via inline buy during onboarding
    - _Requirements: R12.6_

  - [x] 15.8 Create changelog entry via existing changelog system
    - Explain new facility, migration behaviour for existing players (free L1 + all four subscriptions per robot), implications for new players (3 onboarding-picked subscriptions at L0)
    - _Requirements: R12.7_

  - [x] 15.9 Verify all documentation updates from R12.1–R12.7 are present before merge
    - Confirm no documentation update is absent; block merge if any is missing
    - _Requirements: R12.8_

- [x] 16. Cycle integration verification
  - [x] 16.1 Verify existing admin manual-trigger endpoints exercise subscription-aware matchmaking
    - Confirm `adminCycleService.executeBulkCycles` uses the same subscription-checking matchmakers
    - Confirm no parallel "ignore subscription" path exists
    - _Requirements: R14.3, R14.4_

- [x] 17. Migration cleanup task (tracked for follow-up PR)
  - [x] 17.1 After migration runs successfully on production and summary is verified, create follow-up PR to delete:
    - `app/backend/src/scripts/migrate-booking-office.ts`
    - `app/backend/tests/scripts/bookingOfficeMigration.test.ts`
    - The `migrate:booking-office` script entry from `package.json`
    - _Requirements: R6.11_

- [x] 18. Final verification — Run Verification Criteria from requirements
  - [x] 18.1 Run all Verification Criteria checks from the requirements document
    - VC1: `grep -n "implemented: true" app/backend/src/config/facilities.ts | grep -B 5 "booking_office"` — confirms `implemented: true`
    - VC2: `grep -n "Access to\|event subscription\|Event Subscription" app/backend/src/config/facilities.ts` — description reflects event-subscription semantics
    - VC3: `grep -rn "BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT" app/backend/src/config/` — constant exists exactly once and is exported
    - VC4: Confirm `subscriptions` table exists with `(id, robot_id, event_type, created_at)` and unique constraint on `(robot_id, event_type)`
    - VC8: `grep -rn "isRobotSubscribedTo" app/backend/src/services/league/ app/backend/src/services/tournament/ app/backend/src/services/tag-team/ app/backend/src/services/koth/` — every matchmaker invokes the helper
    - VC9: `grep -rn "registerSubscribableEvent" app/backend/src/services/` — exactly 4 registration calls
    - VC10: `cd app/backend && npm test -- subscription` — all subscription tests pass
    - VC11: `cd app/backend && npm test -- bookingOfficeMigration` — migration tests pass
    - VC12: `cd app/frontend && npm test -- --run BookingOffice OnboardingSubscription` — frontend tests pass
    - VC17: `grep -n "Booking Office" docs/game-systems/PRD_FACILITIES_PAGE.md docs/architecture/PRD_SERVICE_DIRECTORY.md` — both documents reference Booking Office
    - VC18: `grep -n "Booking Office\|Event Subscription" .kiro/steering/project-overview.md` — steering file lists the system
    - VC19: `grep -n "#55\|booking-office\|Booking Office" docs/BACKLOG.md` — Backlog #55 marked completed
    - VC20: `grep -n "registerSubscribableEvent" docs/architecture/PRD_SERVICE_DIRECTORY.md` — service directory documents the registry hook
    - _Requirements: R1.1, R1.2, R2.1, R3.1, R5.3, R5.5, R7.1, R7.2, R7.3, R7.4, R12.1, R12.2, R12.3, R12.5_

## Notes

- Every task references specific requirements for traceability
- All tasks are mandatory — no optional tasks
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate universal correctness properties from the design document
- The migration cleanup (task 17.1) is tracked here but executes as a follow-up PR after production migration succeeds
- Task 18.1 runs the Verification Criteria defined in the requirements to confirm the spec delivered what it promised

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3"] },
    { "id": 7, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 8, "tasks": ["6.5", "8.1", "8.3"] },
    { "id": 9, "tasks": ["8.2", "8.4", "8.5", "8.6"] },
    { "id": 10, "tasks": ["10.1", "10.5", "10.6"] },
    { "id": 11, "tasks": ["10.2", "10.3", "10.9"] },
    { "id": 12, "tasks": ["10.4", "10.7", "10.8", "11.1"] },
    { "id": 13, "tasks": ["11.2", "12.1", "12.2", "12.3", "12.4"] },
    { "id": 14, "tasks": ["13.1", "13.2", "13.3"] },
    { "id": 15, "tasks": ["15.1", "15.2", "15.3", "15.4", "15.5", "15.6", "15.7", "15.8"] },
    { "id": 16, "tasks": ["15.9", "16.1", "17.1"] },
    { "id": 17, "tasks": ["18.1"] }
  ]
}
```
