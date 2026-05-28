# Requirements Document

## Spec: Cron Schedule Restructure — Daily-Everything Slot Map

## Glossary

- **Cycle_Scheduler**: The existing production cron at `app/backend/src/services/cycle/cycleScheduler.ts` (entry point `initScheduler`) that runs league, tournament, tag-team, KotH, and settlement jobs.
- **Cycle**: A single 24-hour window of game state. Currently aligned to UTC midnight via the settlement job; this spec keeps that alignment.
- **Slot_Map**: The configured set of cron expressions for every battle event type plus settlement, organised so heavy events have headroom and new events have reserved slots.
- **Heavy_Mode**: A battle event type whose execution dominates per-cycle wall-clock time. Today: 1v1 League (most volume) and KotH (multi-robot per match). After this spec: same two, with new team modes scaled comparable to 1v1 league per Stable.
- **Daily_Cadence**: An event type that runs once per cycle, every cycle. After this spec, every battle event type uses daily cadence.
- **Reserved_Slot**: A configured cron entry placeholder for a future battle event type. The slot exists in the schedule but the handler short-circuits to a no-op until a follow-up spec ships the event.
- **Settlement_Boundary**: The end-of-cycle settlement job (`executeSettlement`) that rolls finances, snapshots, repairs, and user-gen. After this spec it runs at 00:00 UTC, providing a 16-hour battle window from 08:00 to 23:59.
- **Subscription_Check**: The `isStableSubscribedTo(stableId, eventType)` helper from Spec 35 (Booking Office). Every matchmaker added or modified by this spec consults this helper before pool inclusion.
- **Booking_Office_Spec**: Spec 35 (`.kiro/specs/to-do/35-booking-office-facility/`). Hard prerequisite: this cron restructure depends on subscriptions to ensure that moving Tag Team and KotH to daily does not auto-enrol every Stable into a daily Tag Team / KotH battle.

## Introduction

Today's cron layout was built incrementally — League at 20:00, Tournament at 08:00, Tag Team at 12:00 (odd cycles only), KotH at 16:00 Mon/Wed/Fri, Settlement at 23:00. With four more battle event types arriving (Team Battle 2v2 / 3v3 league, 2v2 / 3v3 tournament, plus future Grand Melee), and with the Booking Office (Spec 35) gating per-Stable participation, three things need restructuring:

1. **Every battle event runs daily.** Alternation made sense before subscriptions because every Stable was auto-enrolled in every event. With subscriptions, alternation just creates a fairness gap (a daily mode beats an alternating mode in raw volume, so players gravitate to the daily one). Daily-everything restores fairness; subscriptions do the gating.

2. **Settlement moves to midnight UTC.** Current settlement at 23:00 leaves 1 hour between the last battle event (or none if KotH ran that day) and the cycle close. With more battle slots, settlement needs to be the last thing in the cycle; midnight is the cleanest anchor.

3. **The slot map gets reorganised for resource fairness.** The current layout clusters everything between 08:00 and 23:00. After the restructure, heavy modes (1v1 League, KotH) are spaced apart, new modes are interleaved, and reserved slots are pre-allocated for Grand Melee and any future event so future specs only need to register a handler — they don't fight over slot assignment.

This spec is the prerequisite for Spec 37 (Team Battles 2v2 / 3v3): team battles needs to know which slots its modes get, and team battles needs daily-everything to be live. This spec also depends on Spec 35 (Booking Office) being live first; without subscriptions, moving Tag Team to daily would double per-Stable Tag Team volume overnight.

## Context: Discussion Notes

### Why daily on everything

Players naturally gravitate to whichever event runs more often, because more frequent participation = more credits. Alternation made KotH "feel" balanced when every Stable was auto-enrolled, but it inadvertently disadvantaged anyone who built around KotH — they got fewer reps than 1v1-focused players. Once subscriptions exist (Spec 35), each Stable picks the modes they care about; daily cadence on every mode means no one's choice is penalised by frequency.

### Why midnight settlement

Settlement at 23:00 was historically convenient because the cron only had a few jobs. With 9+ jobs daily, settlement needs to come after every battle event, full stop. Midnight UTC is a clean cycle boundary, matches the existing `cycleMetadata.totalCycles` daily increment, and gives the cycle close exactly 24 hours of regularity.

### Why this slot order

Heavy modes are spaced so the database has recovery time between large jobs. 1v1 League at 08:00 (most volume, longest runway to settlement). KotH at 13:00 (5 hours later — gives DB connections time to drain). 2v2 / 3v3 league bracket the heavies. Tournaments interleave. Grand Melee gets a reserved slot. Settlement at 00:00 is the close.

Gaps at 12:00, 16:00, 19:00–23:00 are intentional: they give ops a window for manual intervention, preflight checks before settlement, and reserved space if a future event needs an out-of-band slot.

### Why pre-allocate Grand Melee

Grand Melee is in scope for the next 12 months (Backlog #30). Reserving the slot now means Spec 37 (Team Battles) and the future Grand Melee spec don't fight over slot assignment. Spec 36 establishes the layout; subsequent specs register handlers into existing slots.

### Why this is its own spec, not part of Team Battles

Team Battles is large enough on its own. Bundling cron restructuring would: (a) put database migrations and cron config changes into the same change as a new battle mode, (b) make rollback harder if either piece needs reverting, (c) couple two unrelated risks. Two small specs land cleaner than one big one.

### Why Booking Office must ship first

Today, every Stable with a `TagTeam` row gets a Tag Team battle on odd cycles only. If we move Tag Team to daily without subscriptions, every Stable with a `TagTeam` row gets a daily Tag Team battle — doubling Tag Team volume from cycle one. With Booking Office (Spec 35), Stables explicitly subscribe to Tag Team; only subscribers get matched. Volume scales with player intent, not with schema accident. Same logic applies to KotH going daily.

### Out of Scope

- **Adding new battle modes.** This spec only restructures the schedule. Team Battle 2v2 / 3v3 are added by Spec 37; their tournament variants by a follow-up; Grand Melee by Backlog #30.
- **Per-tier or per-cycle scheduling tuning.** The slot map is a flat daily layout. No per-league-tier delays, no per-cycle parity rules (parity is dropped entirely by this spec).
- **Reducing battle volume.** This spec preserves existing volume per existing mode; subscriptions in Spec 35 are what bound future volume.
- **Performance optimisation of individual battle execution.** If a heavy mode is slow, that's a different spec.
- **Non-battle cron jobs.** Daily health report, monitoring webhooks, and other non-battle crons are unchanged.
- **Removing the existing `tag_team` parity rule (`shouldRunTagTeamMatchmaking`).** This spec deletes that helper and replaces its calls with the daily run pattern.

## Expected Contribution

This spec restructures the cron schedule to support the upcoming 4+ new battle modes and aligns existing cadences for fairness with the Booking Office subscription system.

1. **Daily cadence on every battle event.** Before — Tag Team runs on odd cycles only; KotH runs Mon/Wed/Fri. After — Tag Team and KotH both run daily. Verifiable by: `shouldRunTagTeamMatchmaking` is removed; `getNextKothScheduledDate` is removed or simplified to "next 24h"; the cron expressions for both events are simple `0 H * * *` patterns.

2. **Midnight settlement.** Before — settlement runs at 23:00 UTC. After — settlement runs at 00:00 UTC. Verifiable by: `SETTLEMENT_SCHEDULE` default in `app/backend/src/config/env.ts` is `'0 0 * * *'`; the settlement job fires once per UTC day at midnight.

3. **Reorganised slot map with heavy-mode spacing.** Before — battle events are clustered between 08:00 and 20:00 with KotH on alternate weekdays. After — heavy modes (1v1 League, KotH) are 5 hours apart; light modes interleave; reserved slots exist for new modes. Verifiable by: the configured cron expressions match the documented slot map; a unit test asserts every event's cron expression resolves to a unique hour and to the expected event handler.

4. **Reserved slots for new modes.** Before — adding a new battle event requires fighting over slot assignment. After — the cron config has reserved slots for Team Battle 2v2 league, Team Battle 3v3 league, Team Battle 2v2 tournament, Team Battle 3v3 tournament, and Grand Melee, each registered as a no-op handler stub. Verifiable by: the cron config contains 9 battle event slots + 1 settlement slot; each slot has a handler; the no-op stubs log a `not yet implemented` info line and exit.

5. **Booking Office subscription integration.** Before — Tag Team and KotH matchmaking auto-enrol every eligible Stable. After — both consult the subscription helper from Spec 35; only subscribed Stables enter the candidate pool. Verifiable by: `isStableSubscribedTo` is invoked by `runTagTeamMatchmaking` and `runKothMatchmaking`; a Stable without the corresponding subscription is excluded from matchmaking.

6. **Documentation reflects the new layout.** Before — slot times are scattered across `cycleScheduler.ts`, `env.ts`, `getNextKothScheduledDate`, and the tag-team parity helper. After — a single section in `docs/architecture/PRD_SERVICE_DIRECTORY.md` documents the slot map; the steering files reference the canonical layout. Verifiable by: the documented slot map matches the cron config; grep for slot times in code returns only the env defaults.

### Verification Criteria

After all tasks are complete, the following automatable checks confirm the spec was delivered as designed.

1. `grep -n "LEAGUE_SCHEDULE\|TOURNAMENT_SCHEDULE\|TAGTEAM_SCHEDULE\|KOTH_SCHEDULE\|SETTLEMENT_SCHEDULE" app/backend/src/config/env.ts` — the env defaults match the documented slot map (`'0 8 * * *'`, `'0 10 * * *'`, `'0 11 * * *'`, `'0 13 * * *'`, `'0 0 * * *'` respectively). Verify by inspection.
2. `grep -n "TEAM_2V2_LEAGUE_SCHEDULE\|TEAM_3V3_LEAGUE_SCHEDULE\|TEAM_2V2_TOURNAMENT_SCHEDULE\|TEAM_3V3_TOURNAMENT_SCHEDULE\|GRAND_MELEE_SCHEDULE" app/backend/src/config/env.ts` — five new env entries exist for reserved slots, each with the documented default.
3. `grep -rn "shouldRunTagTeamMatchmaking" app/backend/src/` — returns no matches (helper deleted).
4. `grep -rn "getNextKothScheduledDate\|kothDays\s*=\s*\[" app/backend/src/` — returns no matches, or the helper is reduced to "next 24h" with the alternate-weekday array removed.
5. `grep -rn "isStableSubscribedTo\b" app/backend/src/services/tag-team/ app/backend/src/services/koth/` — both modes' matchmaking invokes the subscription helper before pool inclusion.
6. `cd app/backend && npm test -- cycleScheduler` — all scheduler tests pass, covering: each event has a unique slot; each event has a handler; no-op stubs for reserved slots return without error; settlement runs after every battle slot.
7. `cd app/backend && npm test -- adminBulkCycle` — bulk-cycle tool exercises the new schedule order; tag-team and KotH no longer skip cycles.
8. Manual integration: deploy to a dev DB; observe one full cycle; assert all 9 battle events fire (or short-circuit cleanly) before settlement at 00:00 UTC.
9. Manual integration: a Stable subscribed to Tag Team participates in Tag Team daily; a Stable not subscribed receives no Tag Team match. Same for KotH.
10. `grep -n "## Cron Schedule" docs/architecture/PRD_SERVICE_DIRECTORY.md` — documentation contains a section enumerating the slot map.
11. `grep -n "Cron Schedule\|Daily Cadence" .kiro/steering/project-overview.md` — the steering file references the canonical layout.
12. `grep -n "#56\|cron-schedule-restructure" docs/BACKLOG.md` — backlog entry for this spec is marked "in progress" or completed and references `.kiro/specs/to-do/36-cron-schedule-restructure/`.

## Requirements

### R1: Slot Map

**R1.1** THE Cycle_Scheduler SHALL run battle event jobs at the following UTC times daily:

| UTC | Event | Env var |
|-----|-------|---------|
| 08:00 | 1v1 League | `LEAGUE_SCHEDULE` (default `'0 8 * * *'`) |
| 09:00 | Team Battle 2v2 League (reserved) | `TEAM_2V2_LEAGUE_SCHEDULE` (default `'0 9 * * *'`) |
| 10:00 | 1v1 Tournament | `TOURNAMENT_SCHEDULE` (default `'0 10 * * *'`) |
| 11:00 | Tag Team | `TAGTEAM_SCHEDULE` (default `'0 11 * * *'`) |
| 13:00 | KotH | `KOTH_SCHEDULE` (default `'0 13 * * *'`) |
| 14:00 | Team Battle 3v3 League (reserved) | `TEAM_3V3_LEAGUE_SCHEDULE` (default `'0 14 * * *'`) |
| 15:00 | Team Battle 2v2 Tournament (reserved) | `TEAM_2V2_TOURNAMENT_SCHEDULE` (default `'0 15 * * *'`) |
| 17:00 | Grand Melee (reserved) | `GRAND_MELEE_SCHEDULE` (default `'0 17 * * *'`) |
| 18:00 | Team Battle 3v3 Tournament (reserved) | `TEAM_3V3_TOURNAMENT_SCHEDULE` (default `'0 18 * * *'`) |
| 00:00 | Settlement | `SETTLEMENT_SCHEDULE` (default `'0 0 * * *'`) |

**R1.2** THE slot map in R1.1 SHALL be the canonical schedule; no other module SHALL reimplement scheduling logic for these events.

**R1.3** Each env var listed in R1.1 SHALL be added to or updated in `app/backend/src/config/env.ts` with the indicated default value, validated as a Zod string with no further format check (cron strings are validated by `node-cron` at startup).

**R1.4** Each env var SHALL be exposed on the `Config` interface returned by `getConfig()` so the scheduler reads them via the existing pattern.

**R1.5** WHEN any env var is overridden via `.env`, THE Cycle_Scheduler SHALL use the overridden value rather than the default, with no per-event special casing.

### R2: Existing Mode Cadence Migration

**R2.1** THE Cycle_Scheduler SHALL run Tag Team matchmaking and Tag Team battle execution every day, regardless of cycle parity.

**R2.2** THE helper `shouldRunTagTeamMatchmaking` in `app/backend/src/services/tag-team/tagTeamMatchmakingService.ts` SHALL be removed; every call site SHALL invoke `runTagTeamMatchmaking` directly.

**R2.3** THE Cycle_Scheduler SHALL run KotH matchmaking and KotH battle execution every day, regardless of weekday.

**R2.4** THE helper `getNextKothScheduledDate` SHALL either be removed entirely (replaced by a 24-hour offset from `Date.now()`) or simplified to return "next day at the configured UTC hour" with the `kothDays` weekday array removed.

**R2.5** WHEN the new daily cadence is active, THE Cycle_Scheduler SHALL preserve all existing matchmaking, battle execution, league rebalancing, and reward semantics for Tag Team and KotH; only the cadence changes.

**R2.6** THE settlement job (`executeSettlement` in `cycleScheduler.ts`) SHALL run at 00:00 UTC daily, AND SHALL increment `cycleMetadata.totalCycles` exactly once per UTC day.

### R3: Booking Office Subscription Integration (Reaffirmed)

**R3.1** WHEN `runTagTeamMatchmaking` selects candidate Stables, IT SHALL invoke `isStableSubscribedTo(stableId, 'tag_team')` and exclude any Stable for which the helper returns `false`. (This requirement also exists in Spec 35; it is reaffirmed here to ensure the cron restructure maintains the gate.)

**R3.2** WHEN `runKothMatchmaking` selects candidate Stables, IT SHALL invoke `isStableSubscribedTo(stableId, 'koth')` and exclude any Stable for which the helper returns `false`.

**R3.3** WHEN `runMatchmaking` (1v1 League) and any 1v1 Tournament eligibility routine select candidate Stables, THEY SHALL invoke `isStableSubscribedTo` for `'league'` and `'tournament'` respectively.

**R3.4** Spec 36 SHALL NOT modify the `isStableSubscribedTo` helper itself; the helper is owned by Spec 35.

**R3.5** IF Spec 35 (Booking Office) is not live at deploy time, THEN this spec SHALL NOT deploy. The deploy order is enforced by listing Spec 35 as a hard prerequisite in the spec metadata and by a startup assertion that the `subscription` table exists.

### R4: Reserved Slots for New Modes

**R4.1** THE Cycle_Scheduler SHALL register handler stubs for the five reserved slots (`team_2v2_league`, `team_3v3_league`, `team_2v2_tournament`, `team_3v3_tournament`, `grand_melee`).

**R4.2** Each reserved-slot handler stub SHALL emit a single info-level log entry per cron firing, recording the event name, the cycle number, and the message "reserved slot, no handler implemented yet", and SHALL return without error.

**R4.3** THE reserved-slot stubs SHALL be replaced by real handlers in subsequent specs (Spec 37 for team battle modes; the Grand Melee spec for Grand Melee). Replacing a stub SHALL NOT require any change to `env.ts` or to the slot map.

**R4.4** WHEN a reserved-slot stub fires for an event whose handler is not yet implemented, THE Cycle_Scheduler SHALL NOT count the firing as a failure or trigger any monitoring alert.

**R4.5** THE reserved-slot stubs SHALL be registered in `app/backend/src/services/cycle/cycleScheduler.ts` alongside the existing handlers, using the same `JobState` registration pattern.

### R5: Settlement Boundary

**R5.1** THE settlement job SHALL fire at 00:00 UTC.

**R5.2** WHEN the settlement job fires, IT SHALL execute every existing settlement step (finances, snapshots, repair, user-gen, etc.) without changes to step order or step content.

**R5.3** WHEN any battle event handler runs, IT SHALL complete (or fail and continue) before 00:00 UTC; settlement SHALL NOT wait for any battle handler.

**R5.4** IF a battle event handler is still running at 00:00 UTC due to overrun, THEN the settlement job SHALL begin on schedule; the overrun event handler SHALL continue to completion in parallel; the cycle close (`cycleMetadata.totalCycles` increment) SHALL still occur exactly once.

**R5.5** THE existing `daily health report` cron at `'0 8 * * *'` SHALL be moved to `'30 0 * * *'` (00:30 UTC) so it reports against the just-closed cycle.

### R6: Admin Tooling Compatibility

**R6.1** THE existing local "run N cycles" admin tool (`adminCycleService.executeBulkCycles`) SHALL exercise the new slot order in the same logical sequence as the production scheduler: every battle event in the documented slot order, then settlement.

**R6.2** WHEN `executeBulkCycles` runs in dev/local mode, IT SHALL execute the slot map deterministically (no real cron timing); the order is fixed by R1.1.

**R6.3** THE existing admin manual-trigger endpoints in `app/backend/src/routes/admin.ts` SHALL continue to work unchanged for the events whose handlers exist (1v1 League, KotH, Tag Team, 1v1 Tournament, Settlement); reserved-slot endpoints SHALL be added as no-op stubs returning HTTP 200 with a body indicating "reserved slot, no handler implemented".

**R6.4** THE Admin Cycle Controls page SHALL render the new slot map and the per-event last-run timestamp; reserved slots SHALL render with a "reserved" badge.

### R7: Telemetry and Observability

**R7.1** WHEN a battle event handler completes, THE Cycle_Scheduler SHALL emit a structured log entry recording the event name, the start timestamp, the duration in milliseconds, the count of matches processed, and the count of failures.

**R7.2** WHEN settlement completes, THE Cycle_Scheduler SHALL emit a structured log entry recording the cycle number, the duration in milliseconds, and a one-line summary of each settlement step.

**R7.3** THE existing daily health report (R5.5) SHALL include the per-event durations and match counts for the just-closed cycle.

**R7.4** IF any battle event handler fails entirely (handler throws), THEN the Cycle_Scheduler SHALL log the error with the event name and continue with subsequent events; settlement SHALL still fire on schedule.

### R8: Validation, Authorization, Security

**R8.1** WHEN env vars from R1.1 are loaded, IF any cron expression fails `node-cron` validation, THEN the application SHALL fail to start with a clear error pointing at the offending env var.

**R8.2** Admin manual-trigger endpoints SHALL be guarded by `authenticateToken` followed by `requireAdmin` (no change from existing pattern) AND SHALL emit one `adminAuditLog` row per invocation.

**R8.3** Reserved-slot admin manual-trigger endpoints SHALL also emit `adminAuditLog` rows per invocation, recording the no-op outcome, so admins can audit who attempted to trigger reserved slots.

### R9: Documentation Updates

**R9.1** `docs/architecture/PRD_SERVICE_DIRECTORY.md` SHALL contain a section with the heading `## Cron Schedule` enumerating the slot map exactly as listed in R1.1.

**R9.2** `.kiro/steering/project-overview.md` SHALL include the entry "Daily Cron Schedule" referencing the canonical slot map.

**R9.3** `.kiro/steering/game-mechanics-reference.md` SHALL document that all battle events run daily and that subscription gates participation.

**R9.4** `docs/BACKLOG.md` SHALL contain an entry for Spec 36 (Cron Schedule Restructure), removed when the spec is completed and referencing the spec at `.kiro/specs/to-do/36-cron-schedule-restructure/`.

**R9.5** A public changelog entry SHALL be created via the in-game changelog system explaining: Tag Team and KotH now run daily; settlement moves to midnight UTC; subscriptions (Spec 35) gate which events apply per Stable.

**R9.6** A pull request or release for this spec SHALL be blocked from merging or shipping IF any of the documentation updates required by R9.1 through R9.5 is absent.

### R10: Rollback Plan

**R10.1** THE migration to the new slot map SHALL be reversible via `.env` overrides: setting any of the new env vars to the previous slot value restores the previous schedule for that event without code changes.

**R10.2** IF a critical defect is discovered post-deploy, THEN ops SHALL be able to revert the slot map by:
1. Setting `LEAGUE_SCHEDULE='0 20 * * *'`, `TAGTEAM_SCHEDULE='0 12 * * *'`, `KOTH_SCHEDULE='0 16 * * 1,3,5'`, `SETTLEMENT_SCHEDULE='0 23 * * *'` in `.env`.
2. Restoring the deleted `shouldRunTagTeamMatchmaking` helper from git history (one-line change).
3. Restoring `getNextKothScheduledDate`'s `kothDays` weekday array (one-line change).

**R10.3** THE rollback procedure SHALL be documented in `docs/guides/DEPLOYMENT.md` (or equivalent) so ops can execute it without engineering involvement.

### R11: Property-Based Test Coverage

**R11.1** A property-based test SHALL exist that, for at least 100 randomised cron expressions across the slot map, asserts that no two events fire in the same hour.

**R11.2** A property-based test SHALL exist that asserts the settlement job's hour is strictly less than the smallest battle-event hour within the same cycle (i.e. settlement at 00:00 closes the cycle before any battle event of the next cycle starts at 08:00).

**R11.3** A property-based test SHALL exist that asserts: for any cycle number, every battle event handler that ran during that cycle was logged exactly once with a non-null duration.

**R11.4** WHEN any property defined in R11.1–R11.3 fails, fast-check SHALL report the seed and the shrunk counter-example AND THE CI run SHALL fail.

### R12: Dependencies

**R12.1** Spec 35 (Booking Office Facility / Event Subscription System) SHALL be deployed and its migration completed BEFORE this spec is deployed. The dependency is enforced by:
1. A startup assertion in `app/backend/src/index.ts` that the `subscription` table exists; if not, the application SHALL fail to start with a clear error.
2. A note in `docs/guides/DEPLOYMENT.md` listing Spec 35 as a hard prerequisite.

**R12.2** Spec 37 (Team Battles 2v2 / 3v3) and any future battle event spec SHALL register their handlers into the slots reserved by R4.1 without modifying `env.ts` or the slot map.
