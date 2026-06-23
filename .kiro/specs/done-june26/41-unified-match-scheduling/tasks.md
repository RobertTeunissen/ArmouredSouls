# Implementation Plan: Unified Match Scheduling

## Overview

Unify match scheduling across all 5 battle modes (1v1 League, 2v2 League, 3v3 League, Tag Team, KotH) so they share identical business rules, code paths, and data infrastructure. The implementation proceeds in waves: infrastructure changes first, then KotH rewrite, then fixes to other modes, then cron/admin drift fixes, then legacy table migrations, and finally cleanup/drops.

## Tasks

- [x] 1. Infrastructure changes — schedulingService interface and shared utilities

  - [x] 1.1 Add `matchTypes` parameter to `schedulingService.getUpcomingForTeam()`
    - Modify `src/services/scheduling/schedulingService.ts`
    - Add optional `matchTypes?: MatchType[]` parameter to `getUpcomingForTeam(teamId, matchTypes?)`
    - When provided, filter by `matchType: { in: matchTypes }` instead of hardcoded `TEAM_MATCH_TYPES`
    - When omitted, preserve existing behavior (filter by all team match types)
    - Update the `schedulingService` singleton export type
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 1.2 Remove `rotatingZone` from `CreateScheduledMatchInput` interface
    - Modify `src/services/scheduling/schedulingService.ts`
    - Remove `rotatingZone?: boolean` from `CreateScheduledMatchInput`
    - Remove `rotatingZone` from the `createMatch` destructuring and Prisma `data` object
    - Leave the DB column nullable (will be dropped in a future migration) — stop writing it
    - _Requirements: 5.4_

  - [x] 1.3 Add `createRecentOpponentQueryFn` shared utility to `teamMatchmakingUtils.ts`
    - Modify `src/services/matchmaking/teamMatchmakingUtils.ts`
    - Add factory function `createRecentOpponentQueryFn(matchType: MatchType, participantType: 'robot' | 'team')` that returns an async query function
    - The returned function queries `prisma.scheduledMatch` where `matchType`, `status = 'completed'`, filtered by participants containing the entity IDs
    - For KotH: all participants in the same completed match are treated as recent opponents of each other
    - For paired modes (1v1, 2v2, 3v3, Tag Team): the other participant is the recent opponent
    - Returns `Map<number, number[]>` (entityId → recent opponent IDs)
    - _Requirements: 8.5, 8.6, 23.1, 23.2_

  - [x] 1.4 Add `defaultScheduledFor()` shared utility to `teamMatchmakingUtils.ts`
    - Add exported function `defaultScheduledFor(): Date` that computes `Date.now() + 24h` rounded down to the nearest hour (minutes, seconds, ms set to 0)
    - This will be consumed by all 5 matchmaking services
    - _Requirements: 11.1_

  - [x] 1.5 Write property test for `defaultScheduledFor` utility
    - Create test file `src/services/matchmaking/__tests__/scheduledForDefault.property.test.ts`
    - **Property 8: scheduledFor Default Computation**
    - Use `fc.date()` to generate random timestamps, mock `Date.now()` to each, verify the default is 24h ahead with minutes/seconds/ms zeroed
    - Also verify that when an explicit `scheduledFor` is provided, it passes through unmodified
    - **Validates: Requirements 11.1, 11.4**

- [x] 2. KotH Matchmaking Rewrite

  - [x] 2.1 Rewrite `kothMatchmakingService.ts` — tier/instance scoping and eligibility
    - Full rewrite of `src/services/koth/kothMatchmakingService.ts`
    - Replace global robot pool with tier→instance iteration from `Standing` where `mode = 'koth'`
    - Replace simple `mainWeaponId IS NOT NULL` check with `checkSchedulingReadiness()` (validates full loadout type)
    - Add `batchActivatePendingSubscriptions()` call before subscription check
    - Replace `ScheduledKothMatchParticipant` already-scheduled check with `schedulingService.getUpcomingForRobot(robotId, [MatchType.koth])`
    - Export `getEligibleRobots(tier, leagueInstanceId)` for testing
    - Remove `cycleNumber` parameter from `runKothMatchmaking` signature
    - Skip instances with fewer than 5 eligible robots (no byes in KotH)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 12.3_

  - [x] 2.2 Implement LP-banding grouping algorithm in KotH
    - In the rewritten `kothMatchmakingService.ts`, implement `groupByLPBanding()` function
    - Sort eligible robots by LP from Standing records (descending)
    - Divide into contiguous bands of 5 or 6 (groupCount = ceil(eligible / 6))
    - Apply same-stable swaps: if two robots share userId in a band, swap lower-LP robot with highest-LP from adjacent band
    - Apply recent-opponent swaps: if two robots recently grouped together, swap lower-LP with non-conflicting robot from adjacent band
    - Use `calculateMatchScore` from `teamMatchmakingUtils.ts` to evaluate swap quality
    - Export function as pure (no DB access) for testing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 2.3 Implement KotH match persistence with leagueType/leagueInstanceId and scheduledFor default
    - In the rewritten `kothMatchmakingService.ts`, persist matches via `schedulingService.createMatch()`
    - Set `leagueType` to the robot's KotH tier (from Standing)
    - Set `leagueInstanceId` to the robot's KotH league instance (from Standing)
    - Use `defaultScheduledFor()` when no explicit `scheduledFor` is provided
    - Do NOT set `rotatingZone` (field removed from interface in task 1.2)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 11.1, 11.4_

  - [x] 2.4 Add recent-opponent tracking to KotH matchmaking
    - In the rewritten `kothMatchmakingService.ts`, use `createRecentOpponentQueryFn(MatchType.koth, 'robot')` from `teamMatchmakingUtils.ts`
    - Pass the result to `groupByLPBanding()` for recent-opponent swap resolution
    - All robots in the same completed KotH group are recent opponents of each other
    - Lookback window: same as other modes (default 5 most recent completed matches per robot)
    - _Requirements: 8.4, 23.1, 23.2, 23.3_

  - [x] 2.5 Write property tests for KotH LP-banding
    - Create test file `src/services/koth/__tests__/kothLPBanding.property.test.ts`
    - **Property 1: LP-Banding Produces Valid Group Sizes**
    - Generate random eligible counts (5–100), run `groupByLPBanding`, assert all groups have size 5 or 6, total equals input count
    - **Validates: Requirements 3.2, 3.3**

  - [x] 2.6 Write property test for same-stable resolution in KotH
    - In same test file or `src/services/koth/__tests__/kothStableResolution.property.test.ts`
    - **Property 2: Same-Stable Resolution**
    - Generate robots with random userIds (some overlapping), run banding + same-stable resolution, assert no group has two robots with same userId (unless user has more robots than groups)
    - **Validates: Requirements 3.4**

  - [x] 2.7 Write property test for recent-opponent reduction in KotH
    - Create test file `src/services/koth/__tests__/kothRecentOpponent.property.test.ts`
    - **Property 3: Recent-Opponent Reduction**
    - Generate robots with known recent-opponent maps, compare post-swap co-placement count vs naive contiguous banding, assert equal or fewer conflicts
    - **Validates: Requirements 3.5, 23.3**

  - [x] 2.8 Write property test for eligibility filtering completeness
    - Create test file `src/services/koth/__tests__/kothEligibility.property.test.ts`
    - **Property 10: Eligibility Filtering Completeness**
    - Generate robots with various loadout types (single, dual_wield, weapon_shield, two_handed) and weapon configurations
    - Assert that dual_wield/weapon_shield robots missing offhandWeaponId are excluded
    - Assert that robots with all required weapons AND active subscription are included
    - **Validates: Requirements 2.1, 2.2**

  - [x] 2.9 Write property test for match persistence metadata
    - Create test file `src/services/koth/__tests__/kothPersistence.property.test.ts`
    - **Property 11: Match Persistence Includes Tier/Instance Metadata**
    - Mock `schedulingService.createMatch`, run KotH matchmaking for various tier/instance combos
    - Assert all calls include non-null `leagueType` equal to tier and non-null `leagueInstanceId` equal to instance
    - **Validates: Requirements 4.1, 4.2**

- [x] 3. Checkpoint — KotH rewrite complete
  - Ensure all tests pass (`pnpm test` in `app/backend`), ask the user if questions arise.

- [x] 4. Zone rotation removal

  - [x] 4.1 Remove zone rotation from KotH engine and config
    - Modify `src/services/arena/kothConfig.ts`: remove `rotatingZoneScoreThreshold`, `rotatingZoneTimeLimit`, `rotatingZoneInterval` from `KOTH_MATCH_DEFAULTS`; remove `rotatingZone` from `KothMatchConfig` interface
    - Modify `src/services/arena/kothEngine.ts` (kothGameMode, kothZone, kothStrategies): remove all rotating-zone conditional branches
    - Keep `zoneRadius` as valid per-match parameter
    - _Requirements: 5.5, 5.6, 5.7_

  - [x] 4.2 Remove zone rotation from battle orchestrator and callers
    - Modify `src/services/koth/kothBattleOrchestrator.ts`: remove conditional config branching on `rotatingZone` — always use standard `scoreThreshold`/`timeLimit`
    - Modify `src/services/cycle/cycleScheduler.ts`: remove `cycleNumber` parameter passing to `runKothMatchmaking`
    - Modify `src/services/admin/adminCycleService.ts`: remove `cycleNumber` parameter passing to `runKothMatchmaking`
    - _Requirements: 5.2, 5.3_

  - [x] 4.3 Remove zone rotation from frontend and match history
    - Modify `app/frontend/src/api/matchmakingApi.ts`: remove `kothRotatingZone` from type interfaces
    - Modify frontend KotH display components (`CompactBattleCard.tsx`, `KothMatchCard.tsx`): remove rotating zone display logic
    - Modify `src/services/matchHistory/matchHistoryService.ts`: remove `kothRotatingZone` from response objects
    - _Requirements: 5.1, 5.3, 5.5_

- [ ] 5. 1v1 bye robot — switch to in-memory fabrication

  - [x] 5.1 Implement in-memory bye robot factory for 1v1 League
    - Modify `src/services/analytics/matchmakingService.ts`
    - Replace `prisma.robot.findFirst({ where: { name: BYE_ROBOT_NAME } })` with a local `createByeRobot()` factory that returns a `Robot` object with `id: -1`, `elo: 1000`, `loadoutType: 'single'`
    - Follow the same pattern as `createByeTeam()` in `teamBattleMatchmakingService.ts`
    - Remove `NOT: { name: BYE_ROBOT_NAME }` filter from `buildMatchmakingQueue`
    - Set `isByeMatch: true` on the scheduled match when pairing with the bye robot
    - _Requirements: 6.1, 6.2_

  - [x] 5.2 Update bye-match detection in league battle orchestrator
    - Modify `src/services/league/leagueBattleOrchestrator.ts`
    - Replace `robot.name === 'Bye Robot'` detection with `match.isByeMatch === true` check from the scheduled match record
    - Ensure bye matches still award the non-bye robot a win with standard LP gain without running combat simulation
    - _Requirements: 6.3, 6.4_

  - [x] 5.3 Write property test for bye robot fabrication
    - Create test file `src/services/analytics/__tests__/byeRobotFabrication.property.test.ts`
    - **Property 9: Bye Robot Fabrication for Odd Counts**
    - Generate odd-count robot pools (1, 3, 5, 7, ..., up to 21), run pairing, assert exactly one match pair has a participant with `id < 0` and `elo = 1000` and `isByeMatch = true`
    - **Validates: Requirements 6.1**

- [ ] 6. Unified recent-opponent tracking for all modes


  - [x] 6.1 Migrate 1v1 recent-opponent tracking to `scheduled_matches_v2`
    - Modify `src/services/analytics/matchmakingService.ts`
    - Replace `prisma.battle.findMany(...)` query in `getRecentOpponentsBatch` with `createRecentOpponentQueryFn(MatchType.league_1v1, 'robot')` from `teamMatchmakingUtils.ts`
    - _Requirements: 8.1_

  - [x] 6.2 Migrate Tag Team recent-opponent tracking to `scheduled_matches_v2`
    - Modify `src/services/tag-team/tagTeamMatchmakingService.ts`
    - Replace `prisma.scheduledTeamBattleMatch.findMany(...)` in the local `getRecentOpponentsBatch` with `createRecentOpponentQueryFn(MatchType.tag_team, 'team')` from `teamMatchmakingUtils.ts`
    - _Requirements: 8.3_

  - [x] 6.3 Migrate 2v2/3v3 recent-opponent tracking to `scheduled_matches_v2`
    - Modify `src/services/team-battle/teamBattleMatchmakingService.ts`
    - Replace `prisma.scheduledTeamBattleMatch.findMany(...)` in the local `getRecentOpponentsBatch` with `createRecentOpponentQueryFn(MatchType.league_2v2, 'team')` for teamSize=2 and `createRecentOpponentQueryFn(MatchType.league_3v3, 'team')` for teamSize=3
    - _Requirements: 8.2_

  - [x] 6.4 Write property test for mode-specific recent-opponent isolation
    - Create test file `src/services/matchmaking/__tests__/recentOpponentIsolation.property.test.ts`
    - **Property 4: Mode-Specific Recent-Opponent Isolation**
    - Generate completed matches across multiple MatchTypes (league_1v1, koth, tag_team), call the query function for one specific mode, assert only opponents from that mode are returned
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 23.1**

  - [x] 6.5 Write property test for KotH multi-participant recent opponents
    - Create test file `src/services/matchmaking/__tests__/kothMultiParticipant.property.test.ts`
    - **Property 5: KotH Multi-Participant Recent Opponents**
    - Generate completed KotH matches with 5 or 6 participants, verify that for each participant, all other N-1 participants appear as recent opponents
    - **Validates: Requirements 8.4, 23.1**

- [x] 7. R4.7 fallback, tie-breaking, and scheduledFor internalization


  - [x] 7.1 Add R4.7 fallback to 1v1 matchmaking
    - Modify `src/services/analytics/matchmakingService.ts` — `findBestOpponent` function
    - Add logic: if best match is a recent opponent AND no non-recent opponent exists, fall back to closest-ELO from the pool (tie-broken by `createdAt`)
    - Follow the same pattern as `teamBattleMatchmakingService.ts` R4.7 implementation
    - _Requirements: 9.1, 9.3_

  - [x] 7.2 Add R4.7 fallback to Tag Team matchmaking
    - Modify `src/services/tag-team/tagTeamMatchmakingService.ts` — `findBestOpponent` function
    - Add same R4.7 logic as 1v1 and team battle services
    - _Requirements: 9.2, 9.3_

  - [x] 7.3 Add `createdAt` deterministic tie-breaking to 1v1 matchmaking
    - Modify `src/services/analytics/matchmakingService.ts` — `findBestOpponent` function
    - Change sort from `scoredOpponents.sort((a, b) => a.score - b.score)` to include `createdAt` tie-break: `if (a.score !== b.score) return a.score - b.score; return a.opponent.createdAt.getTime() - b.opponent.createdAt.getTime()`
    - _Requirements: 10.1, 10.3_

  - [x] 7.4 Add `createdAt` deterministic tie-breaking to Tag Team matchmaking
    - Modify `src/services/tag-team/tagTeamMatchmakingService.ts` — `findBestOpponent` function
    - Change sort to include `createdAt` tie-break (same pattern as 7.3)
    - _Requirements: 10.2, 10.3_

  - [x] 7.5 Internalize `scheduledFor` default in all matchmaking services
    - Modify `src/services/analytics/matchmakingService.ts`: use `defaultScheduledFor()` from `teamMatchmakingUtils.ts` when `scheduledFor` is not provided, include rounding
    - Modify `src/services/tag-team/tagTeamMatchmakingService.ts`: same change
    - Modify `src/services/team-battle/teamBattleMatchmakingService.ts`: same change (add rounding if not already present)
    - All services use identical default logic: `Date.now() + 24h` rounded to hour
    - _Requirements: 11.1, 11.4_

  - [x] 7.6 Remove `scheduledFor` computation from callers
    - Modify `src/services/cycle/cycleScheduler.ts`: remove `scheduledFor` variable computation in league, tag team, KotH, team2v2, and team3v3 cycle handlers; pass `undefined` to matchmaking services
    - Modify `src/services/admin/adminCycleService.ts`: remove `scheduledFor` computation; pass `undefined` to matchmaking services
    - _Requirements: 11.2, 11.3_

  - [x] 7.7 Write property test for R4.7 fallback closest-ELO selection
    - Create test file `src/services/matchmaking/__tests__/r47Fallback.property.test.ts`
    - **Property 6: R4.7 Fallback Selects Closest-ELO**
    - Generate entity pools where ALL candidates are recent opponents, verify the selected opponent has the smallest absolute ELO difference, tie-broken by `createdAt`
    - **Validates: Requirements 9.1, 9.2**

  - [x] 7.8 Write property test for deterministic tie-breaking
    - Create test file `src/services/matchmaking/__tests__/deterministicTieBreaking.property.test.ts`
    - **Property 7: Deterministic Tie-Breaking via createdAt**
    - Generate entities with identical LP, ELO, recent-opponent status, and stable membership; shuffle input array multiple times; assert the same entity is always selected (the one with earlier `createdAt`)
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [x] 8. Checkpoint — mode fixes complete
  - Ensure all tests pass (`pnpm test` in `app/backend`), ask the user if questions arise.

- [x] 9. Cron/admin drift fixes

  - [x] 9.1 Add repair steps to bulk cycles for 2v2 and 3v3
    - Modify `src/services/admin/adminCycleService.ts`
    - Add `await repairAllRobots(true)` before the execute step in Slot 2 (2v2 League) block
    - Add `await repairAllRobots(true)` before the execute step in Slot 6 (3v3 League) block
    - _Requirements: 13.1, 13.2_

  - [x] 9.2 Add KotH rebalance to bulk cycles and deprecate `/koth/trigger`
    - Modify `src/services/admin/adminCycleService.ts`: add `rebalanceKothLeagues()` between execute and matchmaking in Slot 5 (KotH) block
    - Modify `src/routes/admin.ts`: add deprecation warning to `/koth/trigger` response body indicating `scheduler/trigger/koth` should be used instead
    - Modify `/koth/trigger` handler to delegate to the same unified `runKothMatchmaking()` function (no 48h lead time, no separate `cycleNumber` parameter)
    - _Requirements: 14.1, 14.2, 15.1, 15.2, 15.3_

- [x] 10. Migrate already-scheduled checks to unified table


  - [x] 10.1 Migrate Team Battle already-scheduled check to `schedulingService`
    - Modify `src/services/team-battle/teamBattleMatchmakingService.ts`
    - Replace `prisma.scheduledTeamBattleMatch.findMany(...)` in `getEligibleTeams` with `schedulingService.getUpcomingForTeam(teamId, [matchType])` (where matchType is `league_2v2` or `league_3v3`)
    - _Requirements: 12.1_

  - [x] 10.2 Migrate Tag Team already-scheduled check to `schedulingService`
    - Modify `src/services/tag-team/tagTeamMatchmakingService.ts`
    - Replace `prisma.scheduledTeamBattleMatch.findMany(...)` in `getEligibleTeams` with `schedulingService.getUpcomingForTeam(teamId, [MatchType.tag_team])`
    - _Requirements: 12.2_

- [x] 11. Migrate legacy table reads — locking, team lock, match history, admin, deploy, standings


  - [x] 11.1 Migrate locking predicates to unified table
    - Modify `src/services/subscription/lockingPredicates.ts` (or equivalent)
    - Replace `ScheduledTeamBattleMatch` queries with `schedulingService.getUpcomingForTeam(teamId, [matchTypes])` for tag_team, league_2v2, league_3v3, tournament_2v2, tournament_3v3
    - _Requirements: 16.1, 16.2_

  - [x] 11.2 Migrate `isTeamLockedForBattle()` to unified table
    - Modify `src/services/team-battle/teamBattleService.ts`
    - Replace `ScheduledTeamBattleMatch` query with `schedulingService.getUpcomingForTeam(teamId, matchTypesForTeamSize)`
    - For 2v2 teams: filter by `[league_2v2, tag_team, tournament_2v2]`
    - For 3v3 teams: filter by `[league_3v3, tournament_3v3]`
    - _Requirements: 17.1, 17.2_

  - [x] 11.3 Migrate match history service to unified table
    - Modify `src/services/matchHistory/matchHistoryService.ts`
    - Replace `ScheduledTeamBattleMatch` and `ScheduledKothMatch` queries with `prisma.scheduledMatch` queries filtered by appropriate `matchType` and `status`
    - Return results in consistent format regardless of MatchType
    - _Requirements: 18.1, 18.2, 18.3_

  - [x] 11.4 Migrate admin stats dashboard to unified table
    - Modify `src/services/admin/adminStatsService.ts`
    - Replace `ScheduledTeamBattleMatch` and `ScheduledKothMatch` queries with a single `prisma.scheduledMatch` query grouped by `matchType` and `status`
    - Return per-mode counts (1v1, 2v2, 3v3, tag_team, koth) from the unified table
    - _Requirements: 19.1, 19.2_

  - [x] 11.5 Migrate deploy orchestrator in-flight check to unified table
    - Modify `src/services/deploy/deployOrchestrator.ts` (or equivalent deploy safety check file)
    - Replace separate queries against `ScheduledLeagueMatch`, `ScheduledTeamBattleMatch`, `ScheduledKothMatch` with single query: `prisma.scheduledMatch.findMany({ where: { status: 'in_progress' } })`
    - If any match has `status = 'in_progress'`, block deployment and report count/types
    - _Requirements: 20.1, 20.2_

  - [x] 11.6 Migrate KotH standings last-10 matches to unified table
    - Modify `src/services/koth/kothStandingsService.ts` (or equivalent)
    - Replace `ScheduledKothMatch` query with `prisma.scheduledMatch.findMany({ where: { matchType: 'koth', status: 'completed', participants: { some: { participantId: robotId } } }, orderBy: { scheduledFor: 'desc' }, take: 10 })`
    - Extract robot's placement from match result data
    - _Requirements: 21.1, 21.2_

- [x] 12. Checkpoint — all legacy reads migrated
  - Ensure all tests pass (`pnpm test` in `app/backend`), ask the user if questions arise.

- [x] 13. Drop legacy tables and remove persistent bye robot

  - [x] 13.1 Create Prisma migration to drop legacy scheduling tables
    - Create a new Prisma migration that drops `ScheduledKothMatchParticipant`, `ScheduledKothMatch`, `ScheduledTeamBattleMatch`, `ScheduledLeagueMatch` in a single transaction
    - Also drop the `rotating_zone` column from `scheduled_matches_v2` (no longer written after zone rotation removal)
    - Remove the 4 model definitions from `app/backend/prisma/schema.prisma`
    - Remove the `rotatingZone` field from the `ScheduledMatch` Prisma model
    - Run `pnpm exec prisma generate` to regenerate the client
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6_

  - [x] 13.2 Remove persistent Bye Robot from database and seed
    - Create a separate Prisma migration to delete the Bye Robot record and its `bye_robot_user` from the database
    - Modify `app/backend/prisma/seed.ts`: remove bye robot and bye_robot_user creation
    - Remove `BYE_ROBOT_NAME` constant from `src/services/analytics/matchmakingService.ts`
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 13.3 Remove all Bye Robot exclusion filters across the codebase
    - Modify `src/services/leaderboard/leaderboardService.ts`: remove `NOT: { name: 'Bye Robot' }` filters
    - Modify `src/services/stable/stableViewService.ts`: remove Bye Robot exclusion filters
    - Modify `src/services/standings/standingsBackfill.ts`: remove Bye Robot exclusion filters
    - Modify `src/services/admin/migrationVerificationService.ts`: remove Bye Robot exclusion filters
    - Modify `src/services/cycle/cycleScheduler.ts` (settlement `robot.updateMany`): remove `NOT: { name: 'Bye Robot' }` filter
    - _Requirements: 7.3_

- [ ] 14. Further unification — merge team services, instance discovery, cycle orchestrator, admin endpoints

  - [x] 14.1 Unify `tagTeamMatchmakingService` and `teamBattleMatchmakingService` into parameterized function
    - Create new file `src/services/matchmaking/unifiedTeamMatchmaking.ts`
    - Extract the shared pattern (tier iteration → eligibility → pairing → scheduling) into a single `runTeamMatchmaking(config)` function
    - Config parameter includes: `teamSize`, `matchType`, `subscriptionEvent`, `standingsMode`, `matchMode` (for tag team discriminator)
    - Rewrite `teamBattleMatchmakingService.ts` to be a thin wrapper calling `runTeamMatchmaking({ teamSize: 2|3, matchType: MatchType.league_2v2|league_3v3, ... })`
    - Rewrite `tagTeamMatchmakingService.ts` to be a thin wrapper calling `runTeamMatchmaking({ teamSize: 2, matchType: MatchType.tag_team, ... })`
    - Preserve all existing exports for backward compatibility (thin wrappers that delegate)
    - Remove duplicate bye-team fabrication code (share a single `createByeTeam` factory in the unified module)
    - _Requirements: 24.1, 24.2, 24.3, 24.4_

  - [x] 14.2 Unify instance discovery — use `Standing.distinct('leagueInstanceId')` for all modes
    - Modify `src/services/analytics/matchmakingService.ts` (1v1): replace `getInstancesForTier(tier)` helper with `Standing.distinct('leagueInstanceId')` query pattern (already used by 2v2/3v3/tag team/KotH)
    - This eliminates the divergence where 1v1 uses a different instance discovery approach from all other modes
    - Remove `getInstancesForTier` usage from matchmaking (keep the function itself for other consumers like league placement)
    - _Requirements: 25.1, 25.2, 25.3_

  - [x] 14.3 Extract shared `executeLeagueCycleSteps()` orchestrator for cron/bulk
    - Create new file `src/services/cycle/leagueCycleOrchestrator.ts`
    - Define interface `LeagueCycleConfig` with mode-specific callbacks: `repairFn`, `executeFn`, `rebalanceFn`, `matchmakingFn`
    - Implement `executeLeagueCycleSteps(config): Promise<JobContext>` that runs the standard `repair → execute → rebalance → matchmaking` pipeline
    - Refactor `cycleScheduler.ts`: replace `executeLeagueCycle`, `executeTeam2v2LeagueCycle`, `executeTeam3v3LeagueCycle`, `executeTagTeamCycle`, `executeKothCycle` to delegate to the shared orchestrator
    - Refactor `adminCycleService.ts`: replace inline slot blocks 1, 2, 4, 5, 6 to delegate to the same orchestrator (with event logging wrappers)
    - This eliminates the ~200 lines of duplicated orchestration that caused the cron/admin drift in the first place
    - _Requirements: 26.1, 26.2, 26.3, 26.4_

  - [x] 14.4 Deprecate piecemeal admin endpoints — point to `scheduler/trigger/:jobName`
    - Modify `src/routes/admin.ts`:
    - Add deprecation warnings to response bodies of: `POST /matchmaking/run`, `POST /battles/run`, `POST /leagues/rebalance`, `POST /tag-teams/matchmaking`, `POST /tag-teams/battles`, `POST /tag-teams/rebalance`, `POST /team-battles/matchmaking`, `POST /team-battles/battles`
    - Each warning suggests the equivalent `scheduler/trigger/:jobName` endpoint
    - Do NOT remove the endpoints yet (frontend may still use them) — just add the warning field
    - Update frontend admin panel to use `scheduler/trigger/:jobName` for "run full cycle" actions where applicable
    - _Requirements: 27.1, 27.2, 27.3, 27.4_

- [ ] 15. Documentation updates

  - [x] 15.1 Update `docs/analysis/match-scheduling-audit.md`
    - Mark all P0, P1, P2, and P3 actions as COMPLETED
    - Add completion timestamps or status markers to each action item
    - _Requirements: 1.1 through 23.3 (aggregate outcome documentation)_

  - [x] 15.2 Update `docs/architecture/PRD_SERVICE_DIRECTORY.md`
    - Update KotH matchmaking service description: LP-banding (not snake-draft), no zone rotation, tier/instance scoping from standings, unified recent-opponent tracking
    - Update cron schedule section if KotH handler signature changed
    - Document the new shared orchestrator (`leagueCycleOrchestrator.ts`)
    - Document the unified team matchmaking service (`unifiedTeamMatchmaking.ts`)
    - _Requirements: 1.1, 3.1, 5.1_

  - [x] 15.3 Update `.kiro/steering/project-overview.md`
    - Update Key System #14 (Daily Cron Schedule) to reflect the shared orchestrator pattern
    - Add mention of unified matchmaking infrastructure under Key Systems
    - _Requirements: 1.1 (project documentation reflects new architecture)_

- [x] 16. Final verification

  - [x] 16.1 Run verification criteria from requirements document
    - Execute all 12 verification grep checks from requirements.md:
    - `grep -r "snake" app/backend/src/services/koth/kothMatchmakingService.ts` → zero matches
    - `grep -r "mainWeaponId" app/backend/src/services/koth/kothMatchmakingService.ts` → zero matches
    - `grep -r "rotatingZone\|rotating_zone\|cycleNumber" app/backend/src/services/koth/kothMatchmakingService.ts` → zero matches
    - `grep -r "checkSchedulingReadiness" app/backend/src/services/koth/kothMatchmakingService.ts` → has match
    - `grep -r "model ScheduledLeagueMatch" app/backend/prisma/schema.prisma` → zero matches
    - `grep -r "model ScheduledKothMatch" app/backend/prisma/schema.prisma` → zero matches
    - `grep -r "model ScheduledKothMatchParticipant" app/backend/prisma/schema.prisma` → zero matches
    - `grep -r "Bye Robot" app/backend/src/` → zero matches
    - `grep -r "getRecentOpponents" app/backend/src/services/koth/kothMatchmakingService.ts` → has match
    - `grep -r "leagueType" app/backend/src/services/koth/kothMatchmakingService.ts` → has match
    - `grep -r "leagueInstanceId" app/backend/src/services/koth/kothMatchmakingService.ts` → has match
    - Run `pnpm test` in `app/backend` — all tests pass with no regressions
    - Verify unified team matchmaking: `grep -r "runTeamMatchmaking" app/backend/src/services/matchmaking/unifiedTeamMatchmaking.ts` → has match
    - Verify shared orchestrator: `grep -r "executeLeagueCycleSteps" app/backend/src/services/cycle/leagueCycleOrchestrator.ts` → has match
    - _Requirements: all (verification criteria)_

## Notes

- All tasks are mandatory — no optional tasks per project convention
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major phases
- Property tests validate universal correctness properties from the design document
- The ordering ensures dependencies are satisfied: infrastructure → KotH rewrite → mode fixes → cron fixes → legacy migrations → drops → further unification → docs → verification
- Legacy table drops (task 13.1) MUST only execute after all reads are confirmed migrated (tasks 10.x and 11.x)
- Bye robot removal (task 13.2) MUST only execute after in-memory fabrication is deployed (task 5.1)
- Further unification (task group 14) MUST only execute after core unification is complete and verified

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.4"] },
    { "id": 1, "tasks": ["1.3", "1.5"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4"] },
    { "id": 4, "tasks": ["2.5", "2.6", "2.7", "2.8", "2.9"] },
    { "id": 5, "tasks": ["4.1", "4.2", "5.1"] },
    { "id": 6, "tasks": ["4.3", "5.2", "5.3"] },
    { "id": 7, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 8, "tasks": ["6.4", "6.5"] },
    { "id": 9, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 10, "tasks": ["7.6", "7.7", "7.8"] },
    { "id": 11, "tasks": ["9.1", "9.2"] },
    { "id": 12, "tasks": ["10.1", "10.2"] },
    { "id": 13, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6"] },
    { "id": 14, "tasks": ["13.1"] },
    { "id": 15, "tasks": ["13.2"] },
    { "id": 16, "tasks": ["13.3"] },
    { "id": 17, "tasks": ["14.1", "14.2"] },
    { "id": 18, "tasks": ["14.3"] },
    { "id": 19, "tasks": ["14.4"] },
    { "id": 20, "tasks": ["15.1", "15.2", "15.3"] },
    { "id": 21, "tasks": ["16.1"] }
  ]
}
```
