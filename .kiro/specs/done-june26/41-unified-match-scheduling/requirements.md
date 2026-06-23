# Requirements Document

## Introduction

Unify the match scheduling system across all 5 battle modes (1v1 League, 2v2 League, 3v3 League, Tag Team, KotH) so they share identical business rules, code paths, and data infrastructure. Currently, each mode has diverged in how it checks readiness, tracks recent opponents, handles byes, persists scheduled matches, and computes default scheduling times. KotH is the most divergent (uses snake-draft ELO distribution, simple weapon check, no tier/instance scoping, no LP-banding, zone rotation that never worked). This spec eliminates all divergences, migrates remaining legacy table reads to the unified `scheduled_matches_v2` table, and drops the legacy scheduling tables.

This is a backend-only unification and cleanup spec. No new gameplay features are introduced. The full analysis is documented in `docs/analysis/match-scheduling-audit.md`.

## Glossary

- **Scheduling_Service**: The service (`schedulingService.ts`) that manages the unified `scheduled_matches_v2` table for all match types.
- **Matchmaking_Service_1v1**: The service (`matchmakingService.ts`) responsible for 1v1 League matchmaking.
- **Team_Matchmaking_Service**: The service (`teamBattleMatchmakingService.ts`) responsible for 2v2 and 3v3 League matchmaking.
- **Tag_Team_Matchmaking_Service**: The service (`tagTeamMatchmakingService.ts`) responsible for Tag Team matchmaking.
- **KotH_Matchmaking_Service**: The service (`kothMatchmakingService.ts`) responsible for King of the Hill matchmaking.
- **Cycle_Scheduler**: The service (`cycleScheduler.ts`) that runs daily cron handlers for all modes.
- **Admin_Cycle_Service**: The service (`adminCycleService.ts`) that executes bulk cycles from the admin panel.
- **LP_Banding**: Grouping algorithm that sorts eligible entities by League Points, divides into contiguous bands of the target group size (5-6 for KotH), then applies same-stable swaps and recent-opponent swaps.
- **checkSchedulingReadiness**: A function that validates a robot has a valid weapon equipped for its loadout type (single, dual_wield, weapon_shield, two_handed), rejecting robots with incomplete loadouts.
- **Recent_Opponent_Tracking**: The system that queries completed matches from `scheduled_matches_v2` filtered by MatchType to identify robots/teams that recently fought each other, applying a scoring penalty to discourage rematches.
- **Bye_Robot**: A fabricated in-memory robot entity (id < 0, ELO = 1000) that automatically loses, used when a tier instance has an odd number of eligible robots in paired modes.
- **R4.7_Fallback**: Logic that, when ALL candidate opponents have been recent opponents, falls back to selecting the closest-ELO opponent instead of skipping the match entirely.
- **Zone_Rotation**: A deprecated mechanism (`cycleNumber % 3`) that was supposed to rotate KotH arena zones but never worked properly. Being removed entirely.
- **Legacy_Scheduling_Tables**: The deprecated tables `ScheduledLeagueMatch`, `ScheduledTeamBattleMatch`, `ScheduledKothMatch`, and `ScheduledKothMatchParticipant` that are being replaced by `scheduled_matches_v2`.
- **Standing**: The database model that tracks a robot's league placement (tier, instance, LP) per mode (`league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`).

## Expected Contribution

This spec addresses the architectural divergence between 5 matchmaking services that should use identical business rules but currently don't. The divergence causes bugs (KotH robots with incomplete loadouts getting scheduled), missed features (no recent-opponent tracking in KotH, no R4.7 fallback in 1v1/Tag Team), non-determinism (tie-breaking in 1v1/Tag Team), and maintenance burden (6 different code paths for the same logical pipeline).

1. **KotH matchmaking rewritten**: Before, KotH uses a bespoke snake-draft ELO distribution with no LP, no tier/instance scoping, no readiness validation, no recent-opponent tracking, and zone rotation that never worked. After, KotH uses the same LP-banding pipeline as all other modes with proper readiness checks, same-stable swaps, recent-opponent swaps, and tier/instance boundaries from Standing records.

2. **Single readiness check path**: Before, KotH uses a simple `mainWeaponId IS NOT NULL` filter that allows dual_wield/weapon_shield robots with missing offhand through. After, all 5 modes use `checkSchedulingReadiness()` which validates the complete loadout type.

3. **Unified recent-opponent tracking**: Before, 1v1 queries the `Battle` table (all battle types mixed), 2v2/3v3/Tag Team query legacy `ScheduledTeamBattleMatch`, KotH has none. After, all modes query completed matches from `scheduled_matches_v2` filtered by their own MatchType using a shared utility.

4. **Legacy table elimination**: Before, 6 services read from 4 legacy scheduling tables (`ScheduledLeagueMatch`, `ScheduledTeamBattleMatch`, `ScheduledKothMatch`, `ScheduledKothMatchParticipant`). After, all reads are migrated to `scheduled_matches_v2` and the legacy tables are dropped — removing ~4 dead Prisma models and their associated query code.

5. **Bye robot simplification**: Before, 1v1 uses a persistent "Bye Robot" database record requiring exclusion filters in 6+ services. After, all paired modes use in-memory fabricated bye entities (id < 0), eliminating the DB record and all its exclusion filters.

6. **Consistent scheduling defaults**: Before, `scheduledFor` computation is scattered across callers (some round, some don't, KotH requires the param). After, all matchmaking services handle `24h + rounded to hour` internally — callers never compute it.

7. **Cron/admin parity fixed**: Before, bulk cycles skip repair for 2v2/3v3, skip KotH rebalance, and admin KotH trigger uses wrong lead time. After, all trigger paths (cron, bulk, admin) execute identical steps.

### Verification Criteria

1. `grep -r "snake" app/backend/src/services/koth/kothMatchmakingService.ts` returns zero matches (snake-draft removed).
2. `grep -r "mainWeaponId" app/backend/src/services/koth/kothMatchmakingService.ts` returns zero matches (simple weapon check removed).
3. `grep -r "rotatingZone\|rotating_zone\|cycleNumber" app/backend/src/services/koth/kothMatchmakingService.ts` returns zero matches (zone rotation removed).
4. `grep -r "checkSchedulingReadiness" app/backend/src/services/koth/kothMatchmakingService.ts` returns a match (proper readiness check added).
5. `grep -r "model ScheduledLeagueMatch" app/backend/prisma/schema.prisma` returns zero matches (legacy model removed).
6. `grep -r "model ScheduledKothMatch" app/backend/prisma/schema.prisma` returns zero matches (legacy model removed).
7. `grep -r "model ScheduledKothMatchParticipant" app/backend/prisma/schema.prisma` returns zero matches (legacy model removed).
8. `grep -r "Bye Robot" app/backend/src/` returns zero matches (persistent bye robot references removed).
9. `grep -r "getRecentOpponents" app/backend/src/services/koth/kothMatchmakingService.ts` returns a match (recent-opponent tracking added to KotH).
10. `grep -r "leagueType" app/backend/src/services/koth/kothMatchmakingService.ts` returns a match (KotH persists leagueType).
11. `grep -r "leagueInstanceId" app/backend/src/services/koth/kothMatchmakingService.ts` returns a match (KotH persists leagueInstanceId).
12. Running `pnpm test` in `app/backend` passes with no regressions.
13. `grep -r "runTeamMatchmaking" app/backend/src/services/matchmaking/unifiedTeamMatchmaking.ts` returns a match (unified team matchmaking exists).
14. `grep -r "executeLeagueCycleSteps" app/backend/src/services/cycle/leagueCycleOrchestrator.ts` returns a match (shared orchestrator exists).
15. `grep -r "getInstancesForTier" app/backend/src/services/analytics/matchmakingService.ts` returns zero matches (1v1 uses unified instance discovery).
16. `grep -r "deprecated.*true" app/backend/src/routes/admin.ts` returns matches (piecemeal endpoints have deprecation warnings).

## Requirements

### Requirement 1: KotH Matchmaking Rewrite — Tier/Instance Scoping

**User Story:** As a developer, I want KotH matchmaking to iterate tier → instance from Standing records, so that KotH uses the same entity discovery pattern as all other modes.

#### Acceptance Criteria

1. WHEN KotH matchmaking runs, THE KotH_Matchmaking_Service SHALL query `Standing` records where `mode = 'koth'` to discover tiers and instances, instead of querying all robots globally.
2. WHEN processing a tier instance, THE KotH_Matchmaking_Service SHALL only consider robots that have a Standing record in that specific tier and instance.
3. IF a tier instance has fewer than 5 eligible robots after all eligibility checks, THEN THE KotH_Matchmaking_Service SHALL skip that instance without creating any matches.
4. THE KotH_Matchmaking_Service SHALL process all tier instances independently, producing separate match groups per instance.

### Requirement 2: KotH Matchmaking Rewrite — Readiness and Eligibility

**User Story:** As a developer, I want KotH to use `checkSchedulingReadiness()` for battle readiness, so that robots with incomplete loadouts are correctly excluded.

#### Acceptance Criteria

1. WHEN determining robot eligibility for KotH matchmaking, THE KotH_Matchmaking_Service SHALL call `checkSchedulingReadiness()` for each robot, which validates the weapon configuration based on loadout type (single, dual_wield, weapon_shield, two_handed).
2. THE KotH_Matchmaking_Service SHALL verify that each robot holds an active `koth` subscription before including it in the eligible pool.
3. WHEN checking for already-scheduled matches, THE KotH_Matchmaking_Service SHALL call `schedulingService.getUpcomingForRobot(robotId, [MatchType.koth])` to exclude robots that already have a pending KotH match.
4. THE KotH_Matchmaking_Service SHALL activate pending subscriptions via `batchActivatePendingSubscriptions()` before checking subscription status.

### Requirement 3: KotH Matchmaking Rewrite — LP-Banding Grouping

**User Story:** As a developer, I want KotH to use LP-banding for grouping instead of snake-draft ELO distribution, so that grouping logic is consistent with all other modes.

#### Acceptance Criteria

1. WHEN grouping eligible robots within a tier instance, THE KotH_Matchmaking_Service SHALL sort robots by LP (from Standing records) in descending order.
2. THE KotH_Matchmaking_Service SHALL divide the sorted list into contiguous bands of 5 or 6 robots, keeping LP-adjacent robots together.
3. WHEN the total eligible count is not evenly divisible by 5 or 6, THE KotH_Matchmaking_Service SHALL distribute remainder robots into existing bands (making some bands 6 instead of 5), preferring to keep band sizes between 5 and 6.
4. WHEN forming bands, THE KotH_Matchmaking_Service SHALL apply same-stable swaps: if two robots from the same user's stable are in the same band, swap the lower-LP robot with the highest-LP robot from the next band.
5. WHEN forming bands, THE KotH_Matchmaking_Service SHALL apply recent-opponent swaps: if two robots that recently fought in KotH are in the same band, swap the lower-LP robot with a non-conflicting robot from an adjacent band.
6. THE KotH_Matchmaking_Service SHALL use the shared `calculateMatchScore` formula from `teamMatchmakingUtils.ts` to evaluate swap quality, ensuring swaps do not degrade overall group quality beyond a defined threshold.

### Requirement 4: KotH Match Persistence

**User Story:** As a developer, I want KotH matches persisted with leagueType and leagueInstanceId, so that match records are queryable the same way as all other modes.

#### Acceptance Criteria

1. WHEN persisting a KotH match, THE KotH_Matchmaking_Service SHALL set `leagueType` to the robot's KotH tier (from Standing).
2. WHEN persisting a KotH match, THE KotH_Matchmaking_Service SHALL set `leagueInstanceId` to the robot's KotH league instance (from Standing).
3. WHEN persisting a KotH match, THE KotH_Matchmaking_Service SHALL use the default `scheduledFor` of 24 hours from now rounded to the nearest hour.
4. THE KotH_Matchmaking_Service SHALL persist matches via `schedulingService.createMatch()` using the same interface as all other modes.

### Requirement 5: Remove Zone Rotation

**User Story:** As a developer, I want zone rotation removed entirely, so that the broken `cycleNumber % 3` logic no longer exists in the codebase.

#### Acceptance Criteria

1. THE KotH_Matchmaking_Service SHALL NOT set `rotatingZone` on any match group.
2. THE Cycle_Scheduler SHALL NOT pass `cycleNumber` to KotH matchmaking.
3. THE KotH battle orchestrator SHALL NOT branch on `rotatingZone` for config selection (score threshold, time limit).
4. THE Scheduling_Service SHALL NOT accept or store `rotatingZone` in `CreateScheduledMatchInput`.
5. THE KotH arena configuration SHALL remove `rotatingZoneScoreThreshold`, `rotatingZoneTimeLimit`, and `rotatingZoneInterval` defaults from `kothConfig.ts`.
6. THE KotH strategy and game mode files SHALL remove all rotating-zone conditional branches.
7. THE `zoneRadius` configuration field SHALL remain as a valid per-match parameter for the KotH arena.

### Requirement 6: 1v1 Bye Robot — Switch to In-Memory Fabrication

**User Story:** As a developer, I want 1v1 League to use an in-memory fabricated bye robot instead of a persistent database record, so that bye handling is consistent with 2v2/3v3/Tag Team.

#### Acceptance Criteria

1. WHEN a tier instance has an odd number of eligible robots, THE Matchmaking_Service_1v1 SHALL create an in-memory bye robot with `id < 0` and `elo = 1000` for pairing purposes.
2. THE Matchmaking_Service_1v1 SHALL NOT query the database for a "Bye Robot" record.
3. WHEN detecting a bye match for execution, THE league battle orchestrator SHALL identify bye matches by checking `robot.id < 0` or an `isByeMatch` flag on the scheduled match, instead of checking `robot.name === 'Bye Robot'`.
4. WHEN a bye match is executed, THE league battle orchestrator SHALL award the non-bye robot a win with standard LP gain without running combat simulation.

### Requirement 7: Remove Persistent Bye Robot from Database

**User Story:** As a developer, I want the persistent Bye Robot DB record and its user removed, so that no services need exclusion filters for it.

#### Acceptance Criteria

1. WHEN the persistent bye robot is no longer referenced by any service, THE Data_Migration SHALL delete the `Bye Robot` record from the `robots` table and its associated `bye_robot_user` from the `users` table.
2. THE seed script (`prisma/seed.ts`) SHALL NOT create a bye robot or bye_robot_user.
3. THE leaderboard, stable view, standings backfill, and migration verification services SHALL remove all `NOT: { name: 'Bye Robot' }` exclusion filters.
4. THE `BYE_ROBOT_NAME` constant SHALL be removed from the codebase.

### Requirement 8: Unified Recent-Opponent Tracking

**User Story:** As a developer, I want all modes to track recent opponents from completed matches in `scheduled_matches_v2` filtered by their own MatchType, so that recent-opponent scoring is consistent and mode-specific.

#### Acceptance Criteria

1. THE Matchmaking_Service_1v1 SHALL query recent opponents from completed matches in `scheduled_matches_v2` where `matchType = 'league_1v1'`, instead of querying the `Battle` table.
2. THE Team_Matchmaking_Service SHALL query recent opponents from completed matches in `scheduled_matches_v2` filtered by the appropriate `matchType` (`league_2v2` or `league_3v3`).
3. THE Tag_Team_Matchmaking_Service SHALL query recent opponents from completed matches in `scheduled_matches_v2` where `matchType = 'tag_team'`.
4. THE KotH_Matchmaking_Service SHALL query recent opponents from completed matches in `scheduled_matches_v2` where `matchType = 'koth'`, treating all robots in the same completed group as recent opponents of each other.
5. ALL matchmaking services SHALL use a shared utility function (`getRecentOpponentsBatch`) from `teamMatchmakingUtils.ts` with an injected query filter for their MatchType.
6. THE shared utility SHALL return a map of entityId → Set of recent opponent entityIds for efficient lookup during scoring.

### Requirement 9: R4.7 Fallback for 1v1 and Tag Team

**User Story:** As a developer, I want 1v1 and Tag Team to fall back to closest-ELO when all opponents are recent, so that matches are always scheduled when eligible entities exist.

#### Acceptance Criteria

1. WHEN all candidate opponents for a robot have been identified as recent opponents, THE Matchmaking_Service_1v1 SHALL fall back to selecting the closest-ELO opponent instead of skipping the match.
2. WHEN all candidate opponents for a team have been identified as recent opponents, THE Tag_Team_Matchmaking_Service SHALL fall back to selecting the closest-ELO opponent instead of skipping the match.
3. THE R4.7 fallback logic SHALL use the same implementation pattern as the existing fallback in the Team_Matchmaking_Service (2v2/3v3).

### Requirement 10: Deterministic Tie-Breaking

**User Story:** As a developer, I want 1v1 and Tag Team to use `createdAt` for tie-breaking when match scores are equal, so that pairing is deterministic across all modes.

#### Acceptance Criteria

1. WHEN two candidate pairings have identical match scores, THE Matchmaking_Service_1v1 SHALL break the tie using the entity's `createdAt` timestamp (earlier creation date takes priority).
2. WHEN two candidate pairings have identical match scores, THE Tag_Team_Matchmaking_Service SHALL break the tie using the team's `createdAt` timestamp (earlier creation date takes priority).
3. THE tie-breaking logic SHALL produce identical results regardless of the initial array ordering of eligible entities.

### Requirement 11: Unified scheduledFor Default

**User Story:** As a developer, I want all matchmaking services to compute `scheduledFor` internally as `24h + rounded to hour`, so that callers never compute scheduling time.

#### Acceptance Criteria

1. WHEN no explicit `scheduledFor` parameter is provided, EACH matchmaking service SHALL default to `new Date(Date.now() + 24 * 60 * 60 * 1000)` rounded down to the nearest hour.
2. THE Cycle_Scheduler SHALL NOT compute or pass `scheduledFor` to matchmaking services (it is handled internally by each service).
3. THE Admin_Cycle_Service SHALL NOT compute or pass `scheduledFor` to matchmaking services.
4. WHEN an explicit `scheduledFor` parameter IS provided (e.g., admin override), THE matchmaking service SHALL use the provided value without modification.

### Requirement 12: Migrate Already-Scheduled Checks to Unified Table

**User Story:** As a developer, I want all modes to check for already-scheduled matches via `schedulingService`, so that legacy table queries are eliminated from matchmaking.

#### Acceptance Criteria

1. THE Team_Matchmaking_Service SHALL check for already-scheduled team matches via `schedulingService.getUpcomingForTeam(teamId, [matchType])` instead of querying `ScheduledTeamBattleMatch`.
2. THE Tag_Team_Matchmaking_Service SHALL check for already-scheduled matches via `schedulingService.getUpcomingForTeam(teamId, [MatchType.tag_team])` instead of querying `ScheduledTeamBattleMatch`.
3. THE KotH_Matchmaking_Service SHALL check for already-scheduled matches via `schedulingService.getUpcomingForRobot(robotId, [MatchType.koth])` instead of querying `ScheduledKothMatchParticipant`.
4. THE Matchmaking_Service_1v1 SHALL continue using `schedulingService.getUpcomingForRobot(robotId, [MatchType.league_1v1])` (already correct).

### Requirement 13: Fix Cron/Admin Drift — Bulk Cycle Repair Steps

**User Story:** As a developer, I want bulk cycles to include repair steps for 2v2 and 3v3, so that bulk cycle execution matches cron behavior.

#### Acceptance Criteria

1. WHEN executing a bulk cycle for 2v2 League (Slot 2), THE Admin_Cycle_Service SHALL call `repairAllRobots(true)` before the execute step.
2. WHEN executing a bulk cycle for 3v3 League (Slot 6), THE Admin_Cycle_Service SHALL call `repairAllRobots(true)` before the execute step.

### Requirement 14: Fix Cron/Admin Drift — KotH Rebalance

**User Story:** As a developer, I want bulk cycles and admin triggers to include KotH rebalance, so that all trigger paths maintain league balance.

#### Acceptance Criteria

1. WHEN executing a bulk cycle for KotH (Slot 5), THE Admin_Cycle_Service SHALL call `rebalanceKothLeagues()` before the matchmaking step.
2. THE admin `/koth/trigger` endpoint SHALL be deprecated in favor of `scheduler/trigger/koth` which uses the standardized cycle handler.

### Requirement 15: Fix Cron/Admin Drift — Admin KotH Trigger

**User Story:** As a developer, I want the admin KotH trigger to use the same lead time and parameters as cron, so that admin-triggered KotH matchmaking produces consistent results.

#### Acceptance Criteria

1. THE admin `scheduler/trigger/koth` endpoint SHALL invoke the same KotH matchmaking function that the Cycle_Scheduler uses, with no special parameters.
2. THE admin `/koth/trigger` endpoint SHALL return a deprecation warning in its response body indicating that `scheduler/trigger/koth` should be used instead.
3. IF the deprecated `/koth/trigger` endpoint is still used, THEN IT SHALL delegate to the same unified matchmaking function (no 48h lead time, no separate cycleNumber parameter).

### Requirement 16: Migrate Legacy Table Reads — Locking Predicates

**User Story:** As a developer, I want locking predicates to query `scheduled_matches_v2` instead of `ScheduledTeamBattleMatch`, so that subscription locking uses the unified table.

#### Acceptance Criteria

1. WHEN checking if a robot is locked for battle (preventing unsubscription), THE locking predicates service SHALL query `scheduled_matches_v2` for pending matches of the relevant MatchType instead of querying `ScheduledTeamBattleMatch`.
2. THE locking predicates service SHALL support all match types that lock subscriptions: `tag_team`, `league_2v2`, `league_3v3`, `tournament_2v2`, `tournament_3v3`.

### Requirement 17: Migrate Legacy Table Reads — Team Lock-for-Battle

**User Story:** As a developer, I want `isTeamLockedForBattle()` to query `scheduled_matches_v2` instead of `ScheduledTeamBattleMatch`, so that team roster locking uses the unified table.

#### Acceptance Criteria

1. WHEN checking if a team is locked for battle (preventing roster changes), THE team battle service SHALL query `scheduled_matches_v2` for pending matches where the team is a participant, instead of querying `ScheduledTeamBattleMatch`.
2. THE team lock check SHALL filter by the appropriate match types for the team's size (`league_2v2`, `tag_team`, `tournament_2v2` for 2v2 teams; `league_3v3`, `tournament_3v3` for 3v3 teams).

### Requirement 18: Migrate Legacy Table Reads — Match History Display

**User Story:** As a developer, I want the match history service to query `scheduled_matches_v2` for upcoming and completed matches, so that the player dashboard uses the unified table.

#### Acceptance Criteria

1. WHEN displaying upcoming matches on the player dashboard, THE match history service SHALL query `scheduled_matches_v2` for pending matches across all relevant MatchTypes, instead of querying `ScheduledTeamBattleMatch` and `ScheduledKothMatch` separately.
2. WHEN displaying completed KotH matches, THE match history service SHALL query `scheduled_matches_v2` where `matchType = 'koth'` and `status = 'completed'`.
3. THE match history service SHALL return results in a consistent format regardless of MatchType.

### Requirement 19: Migrate Legacy Table Reads — Admin Stats Dashboard

**User Story:** As a developer, I want admin dashboard counts to query `scheduled_matches_v2`, so that admin statistics use the unified table.

#### Acceptance Criteria

1. WHEN computing scheduled match counts for the admin dashboard, THE admin stats service SHALL query `scheduled_matches_v2` grouped by `matchType` and `status`, instead of querying `ScheduledTeamBattleMatch` and `ScheduledKothMatch` separately.
2. THE admin stats service SHALL return per-mode counts (1v1, 2v2, 3v3, tag_team, koth) from the unified table.

### Requirement 20: Migrate Legacy Table Reads — Deploy Orchestrator

**User Story:** As a developer, I want the deploy orchestrator's in-flight check to query `scheduled_matches_v2`, so that deploy safety checks use the unified table.

#### Acceptance Criteria

1. WHEN checking for in-flight matches before deployment, THE deploy orchestrator SHALL query `scheduled_matches_v2` for matches with `status = 'in_progress'` across all MatchTypes, instead of querying `ScheduledLeagueMatch`, `ScheduledTeamBattleMatch`, and `ScheduledKothMatch` separately.
2. IF any match has `status = 'in_progress'`, THEN THE deploy orchestrator SHALL block the deployment and report the count and types of in-flight matches.

### Requirement 21: Migrate Legacy Table Reads — KotH Standings Last-10

**User Story:** As a developer, I want KotH standings to query last-10 matches from `scheduled_matches_v2`, so that KotH standings display uses the unified table.

#### Acceptance Criteria

1. WHEN computing last-10 match results for a robot's KotH standings, THE KotH standings service SHALL query `scheduled_matches_v2` where `matchType = 'koth'` and `status = 'completed'` and the robot is a participant, ordered by completion date descending, limited to 10.
2. THE KotH standings service SHALL extract the robot's placement (1st through 6th) from the match result data.

### Requirement 22: Drop Legacy Scheduling Tables

**User Story:** As a developer, I want the legacy scheduling tables dropped after all reads are migrated, so that no dead schema exists.

#### Acceptance Criteria

1. WHEN all services have been migrated to read from `scheduled_matches_v2` (Requirements 12, 16-21 completed), THE Data_Migration SHALL drop the `ScheduledLeagueMatch` table.
2. THE Data_Migration SHALL drop the `ScheduledTeamBattleMatch` table.
3. THE Data_Migration SHALL drop the `ScheduledKothMatch` table.
4. THE Data_Migration SHALL drop the `ScheduledKothMatchParticipant` table.
5. THE corresponding Prisma models SHALL be removed from `schema.prisma`.
6. THE Data_Migration SHALL execute within a single database transaction, rolling back all changes if any step fails.

### Requirement 23: KotH Recent-Opponent Definition

**User Story:** As a developer, I want a clear definition of "recent opponent" for KotH group matches, so that the recent-opponent swap logic has an unambiguous source.

#### Acceptance Criteria

1. FOR KotH matches, THE recent-opponent utility SHALL define all robots that participated in the same completed KotH match group as recent opponents of each other.
2. THE recent-opponent lookback window for KotH SHALL be the same as other modes (configurable, default 5 most recent completed matches per robot).
3. THE KotH_Matchmaking_Service SHALL apply a recent-opponent penalty during band formation swaps, deprioritizing placing robots who were recently in the same group together again.

### Requirement 24: Unify Team Matchmaking Services

**User Story:** As a developer, I want `tagTeamMatchmakingService` and `teamBattleMatchmakingService` merged into a single parameterized function, so that there is one code path for all team-based matchmaking.

#### Acceptance Criteria

1. A shared `runTeamMatchmaking(config)` function SHALL exist in `src/services/matchmaking/unifiedTeamMatchmaking.ts` that handles all team-based modes (2v2 League, 3v3 League, Tag Team).
2. THE config parameter SHALL accept `teamSize`, `matchType`, `standingsMode`, and `subscriptionEvent` to differentiate between modes.
3. THE existing `runTeamBattleMatchmaking()` and `runTagTeamMatchmaking()` exports SHALL remain as thin wrappers that delegate to `runTeamMatchmaking(config)` for backward compatibility.
4. Duplicate bye-team fabrication code SHALL be consolidated into a single shared factory within the unified module.

### Requirement 25: Unify Instance Discovery

**User Story:** As a developer, I want all matchmaking services to use the same instance discovery approach, so that there is one pattern for finding league instances.

#### Acceptance Criteria

1. ALL matchmaking services (1v1, 2v2, 3v3, Tag Team, KotH) SHALL discover league instances via `Standing.distinct('leagueInstanceId')` filtered by mode and tier.
2. THE Matchmaking_Service_1v1 SHALL NOT use `getInstancesForTier()` from `leagueInstanceService.ts` for matchmaking instance discovery (other consumers of that function are unaffected).
3. THE instance discovery pattern SHALL be identical across all 5 modes.

### Requirement 26: Shared League Cycle Orchestrator

**User Story:** As a developer, I want a shared orchestrator function that runs the standard `repair → execute → rebalance → matchmaking` pipeline, so that cron handlers and bulk cycles can never drift.

#### Acceptance Criteria

1. A shared `executeLeagueCycleSteps(config)` function SHALL exist in `src/services/cycle/leagueCycleOrchestrator.ts` that accepts mode-specific callbacks for repair, execute, rebalance, and matchmaking.
2. THE Cycle_Scheduler handlers (`executeLeagueCycle`, `executeTeam2v2LeagueCycle`, `executeTeam3v3LeagueCycle`, `executeTagTeamCycle`, `executeKothCycle`) SHALL delegate to the shared orchestrator.
3. THE Admin_Cycle_Service bulk cycle slot blocks (1, 2, 4, 5, 6) SHALL delegate to the same shared orchestrator (with event logging wrappers).
4. Adding a new battle mode SHALL only require defining a new config object and registering it — not duplicating the pipeline code.

### Requirement 27: Deprecate Piecemeal Admin Endpoints

**User Story:** As a developer, I want piecemeal admin endpoints deprecated with warnings pointing to `scheduler/trigger/:jobName`, so that there is one recommended trigger path.

#### Acceptance Criteria

1. THE following admin endpoints SHALL include a `deprecated: true` and `deprecationWarning` field in their response bodies: `POST /matchmaking/run`, `POST /battles/run`, `POST /leagues/rebalance`, `POST /tag-teams/matchmaking`, `POST /tag-teams/battles`, `POST /tag-teams/rebalance`, `POST /team-battles/matchmaking`, `POST /team-battles/battles`.
2. EACH deprecation warning SHALL specify the equivalent `scheduler/trigger/:jobName` endpoint to use instead.
3. THE deprecated endpoints SHALL continue to function (no removal yet) — only the warning is added.
4. THE frontend admin panel SHALL be updated to use `scheduler/trigger/:jobName` for "run full cycle" actions where applicable.
