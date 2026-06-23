# Implementation Plan: Database Unification

## Overview

This plan implements a major database unification overhaul: consolidating 5 scheduling tables into 2, unifying competitive standings into a single table, removing 20 legacy Battle columns, introducing a financial ledger, and adding a materialized leaderboard cache. All changes deploy atomically in a single release. Tasks are ordered for development correctness — schema first, services second, refactoring third, migration scripts fourth, frontend fifth, verification last.

## Tasks

- [x] 1. Schema creation and shared test infrastructure

  - [x] 1.1 Create Prisma schema for ScheduledMatch and ScheduledMatchParticipant models
    - Add `MatchType` enum with all 8 values to `schema.prisma`
    - Define `ScheduledMatch` model with all columns (matchType, status, scheduledFor, battleId, tournament fields, league fields, KotH fields, cancelReason)
    - Define `ScheduledMatchParticipant` model with unique constraint on (scheduledMatchId, slot)
    - Add all indexes: (status, scheduledFor), (matchType, status), (tournamentId, round), (battleId), participant indexes
    - Run `pnpm exec prisma generate` to regenerate client
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.6, 12.1, 12.2_

  - [x] 1.2 Create Prisma schema for Standing model
    - Add `StandingsMode` enum with all 8 values to `schema.prisma`
    - Define `Standing` model with all columns (entityType, entityId, mode, tier, leagueInstanceId, leaguePoints, cyclesInTier, wins, losses, draws, streaks, KotH-specific nullable fields)
    - Add unique constraint on (entityType, entityId, mode)
    - Add all indexes: (mode, tier, leagueInstanceId), (mode, leaguePoints DESC), (entityType, entityId)
    - Run `pnpm exec prisma generate`
    - _Requirements: 4.1, 4.2, 4.6, 5.1, 5.3, 12.3_

  - [x] 1.3 Create Prisma schema for FinancialLedger model
    - Define `FinancialLedger` model with all columns (cycleNumber, userId, robotId, transactionType, amount, balanceAfter, description, metadata, createdAt)
    - Add all indexes: (userId, cycleNumber), (transactionType, cycleNumber), (robotId), (cycleNumber)
    - Run `pnpm exec prisma generate`
    - _Requirements: 9.1, 12.4_

  - [x] 1.4 Create Prisma schema for LeaderboardCache model
    - Define `LeaderboardCache` model with all columns (category, rank, entityType, entityId, score, generation, updatedAt)
    - Add indexes: (category, generation, rank), (entityType, entityId)
    - Run `pnpm exec prisma generate`
    - _Requirements: 10.1, 12.5_

  - [x] 1.5 Enhance BattleParticipant model in Prisma schema
    - Add `tagOutTimeMs` BigInt nullable column to BattleParticipant
    - Ensure `role` column supports all values: solo, active, reserve, team_member, koth_participant
    - Run `pnpm exec prisma generate`
    - _Requirements: 8.1, 8.2, 8.4_

  - [x] 1.6 Create feature flag system
    - Create `src/services/migration/featureFlags.ts` with flags: `financial_ledger_active`, `leaderboard_cache_active`, `legacy_tables_dropped`
    - Store flags in `cycle_metadata` JSON column
    - Implement read/write helpers with fail-safe defaults (legacy behavior on read failure)
    - _Requirements: 11.6_

  - [x] 1.7 Create shared test factories and mock helpers
    - Create test factory for valid `Standing` objects (all modes, all tiers)
    - Create test factory for valid `ScheduledMatch` objects (all match types)
    - Create test factory for valid `FinancialLedger` entries
    - Create test factory for valid `LeaderboardCache` entries
    - Create test factory for valid `BattleParticipant` with enhanced roles
    - Update centralized fast-check arbitraries for `Robot` and `TeamBattle` models to remove legacy columns
    - Place in `tests/factories/` and `tests/arbitraries/`
    - _Requirements: 4.1, 1.1, 9.1, 10.1, 8.1_

- [x] 2. New services — SchedulingService

  - [x] 2.1 Implement SchedulingService core CRUD
    - Create `src/services/scheduling/schedulingService.ts`
    - Implement `createMatch()` — inserts exactly one row into `scheduled_matches` regardless of match type, plus N participant rows
    - Implement `completeMatch()` — updates status and links battleId
    - Implement `cancelMatch()` — updates status and sets cancelReason
    - Enforce unique constraint on (scheduledMatchId, slot) via participant creation logic
    - _Requirements: 1.7, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Implement SchedulingService query methods
    - Implement `getUpcomingForRobot(robotId, matchTypes?)` — single query with participant JOIN and optional matchType filter
    - Implement `getUpcomingForTeam(teamId)` — single query filtered by team-based matchType values
    - Ensure queries use indexes on (participantId, participantType) and (matchType, status)
    - _Requirements: 1.8, 1.9, 12.6_

  - [x] 2.3 Write unit tests for SchedulingService
    - Test single row insertion for each of the 8 match types
    - Test participant creation: 2 participants for 1v1, N for KotH, 2 teams for team modes
    - Test bye match handling (one participant, empty opponent slot)
    - Test duplicate slot constraint violation
    - Test cancellation flow with reason
    - Test query methods return correct results filtered by robot/team
    - Place in `src/services/scheduling/__tests__/schedulingService.test.ts`
    - _Requirements: 1.7, 1.8, 1.9, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.4 Write property tests for SchedulingService (Properties 1–3)
    - **Property 1: Single Row Insertion Per Match** — For any match creation of any MatchType, exactly one scheduled_matches row is created
    - **Property 2: Entity Query Completeness** — For any entity with N scheduled matches across M types, query returns exactly N results
    - **Property 3: KotH Sequential Slot Assignment** — For any KotH match with P participants, exactly P participant rows with sequential slots 1..P
    - Place in `src/services/scheduling/__tests__/scheduling.property.test.ts`
    - _Requirements: 1.7, 1.8, 1.9, 2.3_

- [x] 3. New services — StandingsService

  - [x] 3.1 Implement StandingsService core LP and battle result recording
    - Create `src/services/standings/standingsService.ts`
    - Implement `recordBattleResult()` — updates LP by delta, increments correct win/loss/draw counter, maintains streak consistency (win streak resets on loss, lose streak resets on win)
    - Single unified algorithm that works for all modes (no mode-specific branching for LP math)
    - _Requirements: 4.3, 4.4_

  - [x] 3.2 Implement StandingsService promotion/demotion and tier change logic
    - Implement `checkAndApplyTierChange()` — checks LP thresholds, cyclesInTier minimum, instance size minimum (6 eligible)
    - On tier change: update tier, assign new leagueInstanceId, reset cyclesInTier, create LeagueHistory entry
    - Implement `rebalanceAllTiers(mode)` — end-of-cycle relative rebalancing (top 10% promoted, bottom 10% demoted)
    - Same algorithm for all modes including KotH (relative position, not absolute threshold)
    - _Requirements: 4.3, 4.5, 5.4_

  - [x] 3.3 Implement StandingsService KotH point award
    - Implement `awardKothPoints()` — awards F1-style points based on placement (25, 18, 15, 12, 10, 8)
    - Updates `standings.leaguePoints` (cumulative, never reset)
    - Updates KotH-specific fields: totalMatches, totalKills, totalZoneScore, totalZoneTime, bestPlacement
    - Increments wins counter for 1st place finishes
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 3.4 Implement StandingsService query methods
    - Implement `getStandings(mode, leagueInstanceId?)` — returns standings ordered by leaguePoints DESC within instance
    - Implement `getEntityStandings(entityType, entityId)` — returns all standings for one entity across modes
    - KotH standings served from standings table filtered by mode=koth, ordered by LP desc
    - _Requirements: 5.5_

  - [x] 3.5 Write unit tests for StandingsService
    - Test LP delta application for win/loss/draw outcomes
    - Test streak logic: win streak increments on win, resets on loss; lose streak increments on loss, resets on win
    - Test tier boundary promotion/demotion with specific LP values
    - Test KotH point award table correctness for all 6 placements
    - Test rebalancing with edge cases (< 6 eligible, cyclesInTier < 5)
    - Test first-entry creation when standings row not found
    - Place in `src/services/standings/__tests__/standingsService.test.ts`
    - _Requirements: 4.3, 4.4, 4.5, 5.2, 5.4_

  - [x] 3.6 Write property tests for StandingsService (Properties 4–8)
    - **Property 4: Unified Promotion/Demotion Algorithm** — Same LP/cycles/threshold produces same tier transition regardless of mode
    - **Property 5: Battle Completion Updates Standings** — Win/loss/draw increments correct counter by 1, LP updated by delta, streaks consistent
    - **Property 6: Threshold-Triggered Tier Transitions** — LP crossing threshold + cyclesInTier met → tier updates, LeagueHistory created
    - **Property 7: KotH Point Award by Placement** — N participants get correct points, sum equals sum of first N scale values
    - **Property 8: KotH Standings Ordering** — Query results ordered by LP descending within instance
    - Place in `src/services/standings/__tests__/standings.property.test.ts` and `src/services/standings/__tests__/koth-standings.property.test.ts`
    - _Requirements: 4.3, 4.4, 4.5, 5.2, 5.4, 5.5_

- [x] 4. New services — FinancialService and LeaderboardService

  - [x] 4.1 Implement FinancialService
    - Create `src/services/financial/financialService.ts`
    - Implement `recordTransaction()` — creates one ledger entry per credit-changing event with correct transactionType, signed amount, and balanceAfter
    - Implement `getReport()` — serves pre-aggregated totals from financial_ledger grouped by transactionType and cycleNumber
    - Implement `getAggregatedTotals()` — returns transaction summaries for a user in a given cycle
    - Maintain `balanceAfter` invariant: previous balanceAfter + current amount = current balanceAfter
    - Feature flag check: only record if `financial_ledger_active` is true
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

  - [x] 4.2 Write unit tests for FinancialService
    - Test ledger entry creation for each of the 12 transaction types
    - Test balanceAfter calculation (previous balance + amount)
    - Test report aggregation with mixed transaction types across cycles
    - Test feature flag bypass (no ledger write when flag is off)
    - Place in `src/services/financial/__tests__/financialService.test.ts`
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

  - [x] 4.3 Write property tests for FinancialService (Properties 10–11)
    - **Property 10: Financial Ledger Per Credit Event** — For any credit-changing event, exactly one ledger entry with correct type, signed amount, and actual balance in balanceAfter
    - **Property 11: Running Balance Invariant** — For any sequence of ledger entries ordered by createdAt, each balanceAfter = previous balanceAfter + current amount
    - Place in `src/services/financial/__tests__/financial-ledger.property.test.ts`
    - _Requirements: 9.2, 9.3, 9.4_

  - [x] 4.4 Implement LeaderboardService
    - Create `src/services/leaderboard/leaderboardService.ts`
    - Implement `refreshAll()` — recomputes all 7 categories, writes with next generation, updates active generation pointer, deletes old generation rows
    - Implement `getLeaderboard(category, page, limit)` — serves from leaderboard_cache with `ORDER BY rank` using active generation
    - Enforce max 200 entries per category during refresh
    - Implement swap semantics via generation column (readers see current gen while writer builds next gen)
    - Feature flag check: fall back to direct robot table sort if `leaderboard_cache_active` is false
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 4.5 Write unit tests for LeaderboardService
    - Test refresh produces correct rankings for each of 7 categories
    - Test max 200 entries per category enforced
    - Test generation swap semantics (old gen readable during refresh)
    - Test empty cache fallback to direct query
    - Test pagination (page, limit, totalPages calculation)
    - Test updatedAt freshness included in response
    - Place in `src/services/leaderboard/__tests__/leaderboardService.test.ts`
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 4.6 Write property test for LeaderboardService (Property 12)
    - **Property 12: Leaderboard Cache Bounded Size** — After any refresh, entries with active generation ≤ 200 per category, ranked 1..N with no gaps
    - Place in `src/services/leaderboard/__tests__/leaderboard-cache.property.test.ts`
    - _Requirements: 10.5_

- [x] 5. Checkpoint — New services verified
  - Ensure all new service tests pass (`pnpm test -- --testPathPattern="scheduling|standings|financial|leaderboard" --silent`)
  - Ensure property tests pass for Properties 1–12
  - Ask the user if questions arise.

- [x] 6. Refactor battle orchestrators and BattleService to use new tables

  - [x] 6.1 Refactor BattleService to stop writing legacy columns and use enhanced participant roles
    - Remove all writes to Battle legacy columns (robot1Id, robot2Id, ELO columns, tag-team robot IDs, tag-out times, per-robot damage/fame)
    - Ensure `winnerId` column is still written (retained)
    - Update tag-team battle recording to create 4 BattleParticipant rows with role=active/reserve, team=1/2, tagOutTimeMs, damageDealt, fameAwarded
    - Update 1v1 battle recording to use role=solo
    - Update team battle (2v2/3v3) recording to use role=team_member
    - Update KotH battle recording to use role=koth_participant
    - Update all read queries to use `battle_participants` exclusively (no reference to legacy columns)
    - _Requirements: 7.2, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 6.2 Write property test for BattleService participant creation (Property 9)
    - **Property 9: Tag-Team Participant Creation** — For any tag-team battle, exactly 4 BattleParticipant rows: 2 active (one per team) + 2 reserve (one per team), each with valid team, non-negative damageDealt/fameAwarded
    - Place in `src/services/battle/__tests__/battle-participants.property.test.ts`
    - _Requirements: 8.3_

  - [x] 6.3 Update backend battle-related test files
    - Update `tests/battleOrchestrator.test.ts` — remove assertions on legacy columns, assert on battle_participants with roles
    - Update `tests/battlePostCombat.test.ts` — remove legacy column mocks
    - Update `src/services/match/__tests__/matchHistoryService.test.ts` — queries use battle_participants not legacy columns
    - Update `tests/stanceAndYield.test.ts` — remove robot1Id/robot2Id references
    - Update `tests/eloProgression.property.test.ts` — ELO read from participants not Battle columns
    - Update `tests/hpTracking.pbt.test.ts` — remove legacy battle column references
    - Update `tests/tagTeamPhaseBugs.pbt.test.ts` — use participant roles instead of legacy tag-team columns
    - Update `tests/tagTeamBattleLogCompleteness.property.test.ts` — participant-based assertions
    - Update `tests/tagTeamBattleOrchestrator.property.test.ts` — use enhanced participant roles
    - Delete `tests/kothDatabaseSchema.test.ts` (validates legacy columns that no longer exist)
    - _Requirements: 7.2, 7.5, 8.1, 8.3, 8.5_

- [x] 7. Refactor league engine and team battle services to use StandingsService

  - [x] 7.1 Refactor leagueBattleOrchestrator to write to standings table
    - Replace all writes to `robots.leaguePoints`, `robots.currentLeague`, `robots.currentWinStreak`, etc. with `standingsService.recordBattleResult()` calls
    - Replace promotion/demotion logic with `standingsService.checkAndApplyTierChange()`
    - Replace end-of-cycle rebalancing with `standingsService.rebalanceAllTiers(mode)`
    - Remove imports of legacy league columns from Robot model
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 7.2 Refactor teamBattleLeagueService to use standings table
    - Replace all writes to `team_battles.teamLp`, `team_battles.teamLeague`, `team_battles.totalLeagueWins` etc.
    - Use `standingsService.recordBattleResult()` with entityType='team' and mode=league_2v2 or league_3v3
    - Replace team league promotion/demotion with unified `checkAndApplyTierChange()`
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 7.3 Refactor tagTeamLeagueService to use standings table
    - Replace all writes to `team_battles.tagTeamLp`, `team_battles.tagTeamLeague`, `team_battles.totalTagTeamWins` etc.
    - Use `standingsService.recordBattleResult()` with entityType='team' and mode=tag_team
    - Replace tag team promotion/demotion with unified `checkAndApplyTierChange()`
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 7.4 Refactor leagueRebalancingService to read from standings
    - Replace all reads from `robots` by `currentLeague`/`leagueId` with reads from `standings` by mode
    - Update instance allocation logic to operate on `standings` rows
    - Remove any Robot model imports for league columns
    - _Requirements: 4.3_

  - [x] 7.5 Update backend league/team-battle test files
    - Update `tests/leagueRebalancingService.test.ts` — mock standings table, assert on standings updates
    - Update `tests/services/team-battle/teamBattleOrchestrator.test.ts` — standings-based assertions
    - Update `tests/services/team-battle/teamBattleMatchmakingService.test.ts` — matchmaking reads standings
    - Update `tests/services/team-battle/teamBattleEngine.test.ts` — remove TeamBattle LP column refs
    - Update `tests/services/team-battle/teamBattleRewardService.test.ts` — standings-based reward tracking
    - Update `tests/teamBattleMatchmaking.property.test.ts` — generators use standings
    - Update `tests/teamBattle.property.test.ts` — remove legacy column assertions
    - Update `tests/byeTeamBattles.property.test.ts` — standings-aware
    - Update `tests/services/tag-team/__tests__/tagTeamStandings.property.test.ts` — use unified standings
    - Update `tests/services/tag-team/__tests__/tagTeamLeagueHealth.property.test.ts` — standings-based health checks
    - Update `tests/services/tag-team/__tests__/tagTeamEligibility.property.test.ts` — standings-based eligibility
    - Delete `tests/services/tag-team/__tests__/tagTeamMigration.property.test.ts` (tests previous migration, no longer relevant)
    - _Requirements: 4.3, 4.4, 4.5_

- [x] 8. Refactor KotH services and achievement system to use standings

  - [x] 8.1 Refactor kothBattleOrchestrator to use StandingsService
    - Replace all writes to `robots.kothWins`, `robots.kothMatches`, `robots.kothTotalZoneScore`, etc. with `standingsService.awardKothPoints()` calls
    - Remove direct Robot model updates for KotH stats
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 8.2 Implement tier-scaled KotH reward calculation
    - Replace the flat `calculateKothRewards()` function with a tier-aware version that reads the participant's current KotH tier from standings
    - Credit formula: `getLeagueWinReward(tier) × placementMultiplier` where multipliers are 1st=1.0, 2nd=0.7, 3rd=0.5, 4th=0.35, 5th=0.25, 6th=0.2
    - Fame formula: `baseFame × tierFactor` where tierFactors are Bronze=1.0, Silver=1.5, Gold=2.0, Platinum=3.0, Diamond=4.5, Champion=7.0
    - Prestige formula: `basePrestige × tierFactor` (same tier factors)
    - Zone dominance bonus (+25%) applies after tier scaling
    - _Requirements: 5.6, 5.7, 5.8, 5.9_

  - [x] 8.3 Refactor kothStandingsService to read from standings table
    - Replace reads from `robots` for KotH leaderboard with reads from `standings` filtered by mode=koth
    - Serve standings ordered by leaguePoints DESC within each league instance
    - Support tier tabs and instance selector (same structure as league standings)
    - _Requirements: 5.5_

  - [x] 8.4 Refactor achievement system to read per-mode win counters from standings
    - Update `src/services/achievement/` to read `totalLeague1v1Wins`, `totalLeague2v2Wins`, `totalLeague3v3Wins`, `totalTagTeamWins` from standings table wins column (filtered by appropriate mode) instead of Robot/TeamBattle columns
    - Update achievement checks that reference `kothWins` to use standings (mode=koth).wins
    - _Requirements: 4.4, 5.2_

  - [x] 8.5 Update backend KotH and achievement test files
    - Update `tests/kothOrchestrator.test.ts` — use standings-based assertions, remove Robot KotH column mocks, add tier-scaled reward assertions
    - Update `tests/kothOrchestrator.property.test.ts` — generators produce standings, verify tier-scaled rewards for all tier/placement combinations
    - Update `tests/kothStandings.property.test.ts` — assert ordering from standings table
    - Update `tests/services/koth/kothMatchmaking.test.ts` — matchmaking reads from standings
    - Update `src/services/achievement/__tests__/achievementTeamBattle.test.ts` — win counter reads from standings
    - Update `src/services/achievement/__tests__/achievementService.property.test.ts` — mock standings for win counters
    - _Requirements: 5.1, 5.2, 5.5, 5.6, 5.7, 5.8, 5.9_

- [x] 9. Refactor scheduling consumers to use unified SchedulingService

  - [x] 9.1 Refactor all matchmaking services to use SchedulingService.createMatch()
    - Update league 1v1 matchmaking to call `schedulingService.createMatch({ matchType: 'league_1v1', ... })`
    - Update team battle matchmaking (2v2, 3v3) to use matchType `league_2v2`/`league_3v3`
    - Update tag team matchmaking to use matchType `tag_team`
    - Update KotH matchmaking to use matchType `koth`
    - Update tournament match creation (1v1, 2v2, 3v3) to use appropriate tournament matchTypes
    - Remove all direct inserts into legacy scheduling tables
    - _Requirements: 1.7, 2.2, 2.3, 2.4, 2.5_

  - [x] 9.2 Refactor Dashboard and Robot Detail upcoming-matches queries
    - Replace 4-table fan-out queries with single call to `schedulingService.getUpcomingForRobot()`
    - Ensure Dashboard upcoming-matches endpoint issues 1 SELECT against scheduled_matches (not 4 separate queries)
    - Remove all frontend merge logic for multi-table upcoming match assembly
    - _Requirements: 1.8, 12.6_

  - [x] 9.3 Update backend scheduling-related test files
    - Update `tests/multiMatchScheduling.property.test.ts` — single table assertions
    - Update `tests/matchListInclusion.property.test.ts` — unified scheduled_matches queries
    - Update `tests/services/subscription/matchmakerIntegration.test.ts` — use SchedulingService
    - Update `tests/services/subscription/lockingPredicates.test.ts` — scheduled match locking uses new table
    - Update `tests/services/tournament/teamTournamentService.property.test.ts` — tournament matches in unified table
    - Update `tests/services/tournament/teamTournamentBattleOrchestrator.property.test.ts` — unified scheduling
    - Update `tests/services/tournament/tournamentService.property.test.ts` — unified scheduling
    - _Requirements: 1.7, 1.8, 2.2, 2.4_

- [x] 10. Refactor financial reporting and leaderboard routes

  - [x] 10.1 Integrate FinancialService into all credit-changing code paths
    - Add `financialService.recordTransaction()` calls to: battle income, streaming revenue, repair cost, facility upgrade, weapon purchase/sale/refinement, robot creation, subscription cost, prestige award, attribute upgrade, settlement adjustments
    - Ensure each credit-changing event produces exactly one ledger entry per cycle
    - _Requirements: 9.2, 9.3_

  - [x] 10.2 Refactor Financial Report page backend to serve from ledger
    - Replace existing recomputation from audit_logs + formulas with query to `financial_ledger` grouped by transactionType and cycleNumber
    - Serve pre-aggregated totals directly
    - _Requirements: 9.5_

  - [x] 10.3 Refactor leaderboard routes to serve from LeaderboardCache
    - Replace all leaderboard endpoints that sort the entire `robots` table with `leaderboardService.getLeaderboard()` calls
    - Include `updatedAt` timestamp in response for cache freshness display
    - Implement pagination using rank-based offset
    - _Requirements: 10.2, 10.3, 10.4_

  - [x] 10.4 Integrate LeaderboardService.refreshAll() into game cycle settlement
    - Call `leaderboardService.refreshAll()` at end of daily cycle settlement
    - Ensure refresh runs after all battle results and standings updates are complete
    - _Requirements: 10.2_

  - [x] 10.5 Update backend financial and leaderboard test files
    - Update `tests/finances.test.ts` — assert ledger entries created, report reads from ledger
    - Update `tests/leaderboards.test.ts` — assert reads from leaderboard_cache, not full table sort
    - Update `tests/statsUpdatedBeforeStreamingRevenue.property.test.ts` — financial ledger integration
    - Update `tests/terminalLogStreamingRevenue.property.test.ts` — ledger entry assertions
    - Update `tests/cycleSummaryStreamingRevenue.property.test.ts` — ledger-based summaries
    - Update `tests/battleLogStreamingRevenue.property.test.ts` — ledger recording
    - Update `tests/streamingRevenueFormula.property.test.ts` — transaction type mapping
    - Update `tests/facilityAdvisorStreamingStudioROI.property.test.ts` — ledger-aware ROI
    - Update `tests/cycleCsvStreamingRevenue.property.test.ts` — CSV from ledger data
    - Update `tests/cycleSnapshot.property.test.ts` — snapshot includes leaderboard cache state
    - _Requirements: 9.2, 9.5, 10.2, 10.3_

- [x] 11. Refactor remaining backend services and miscellaneous test updates

  - [x] 11.1 Refactor robotPerformanceService, robotStatsView, and admin services
    - Update `robotPerformanceService` to read standings for league/KotH stats instead of Robot columns
    - Update robot stats view queries to JOIN standings for league position data
    - Update admin services (cycle generation, league health) to query standings table
    - _Requirements: 4.4, 5.5_

  - [x] 11.2 Refactor resetService and userGeneration to use new tables
    - Update `resetService` — when resetting a robot, also reset/delete its standings rows
    - Update `userGeneration` — when creating new robots, create default standings entries (tier=bronze, LP=0)
    - _Requirements: 4.1, 4.2_

  - [x] 11.3 Update remaining backend test files
    - Update `tests/robotPerformanceService.test.ts` — standings-based performance data
    - Update `tests/adminServices.test.ts` — admin queries use standings/scheduling tables
    - Update `tests/resetService.test.ts` — verify standings rows cleaned on reset
    - Update `tests/userGeneration.test.ts` — verify standings rows created for new robots
    - Update `tests/robotStatsView.test.ts` — standings-sourced stats
    - Update `tests/stables.test.ts` — stable view uses standings for league position
    - Update `tests/robotCalculations.test.ts` — remove legacy column references
    - Update `tests/robotNameUniqueness.test.ts` — remove irrelevant column refs if any
    - Update `tests/combatSimulator.spatial.test.ts` — remove legacy column refs if present
    - Update `tests/combatSimulator.refinement.test.ts` — remove legacy column refs if present
    - Update `tests/routes/admin.test.ts` — admin routes use new tables
    - _Requirements: 4.1, 4.4, 7.2_

- [x] 12. Checkpoint — All backend services refactored
  - Run full backend test suite: `pnpm test -- --silent`
  - Ensure zero failures from service refactoring
  - Verify no production code references legacy scheduling tables, legacy battle columns, or legacy standings columns (run verification grep commands from requirements)
  - Ask the user if questions arise.

- [x] 13. Backend integration tests rewrite

  - [x] 13.1 Rewrite integration tests for unified schema
    - Rewrite `tests/integration.test.ts` — full cycle against new schema (standings, unified scheduling, financial ledger)
    - Rewrite `tests/integration/adminCycleGeneration.test.ts` — cycle generation uses new services
    - Rewrite `tests/integration/teamBattleCompleteCycle.test.ts` — team battle cycle writes to standings
    - Rewrite `tests/integration/tagTeamCompleteCycle.test.ts` — tag team writes to standings (mode=tag_team)
    - Rewrite `tests/integration/tagTeamMultiMatchCycle.test.ts` — multiple matches update standings correctly
    - Rewrite `tests/integration/tagTeamByeHandling.test.ts` — bye handling with unified scheduling
    - Rewrite `tests/integration/tagTeamAutoRepair.test.ts` — auto repair with new schema
    - Rewrite `tests/integration/teamBattleRaceCondition.test.ts` — race conditions with standings writes
    - Rewrite `tests/integration/tagTeamLeagueRebalancing.test.ts` — rebalancing via unified StandingsService
    - _Requirements: 4.3, 4.4, 4.5, 7.2, 8.3, 12.7_

- [x] 14. Backfill and migration scripts

  - [x] 14.1 Implement scheduling backfill script
    - Create `src/services/migration/backfill/schedulingBackfill.ts`
    - Migrate all rows from legacy `scheduled_matches` → unified ScheduledMatch with matchType=league_1v1
    - Migrate `scheduled_team_battle_matches` → unified ScheduledMatch with appropriate matchType based on matchMode
    - Migrate `scheduled_koth_matches` → unified ScheduledMatch with matchType=koth, migrate `scheduled_koth_match_participants` → MatchParticipant
    - Migrate `tournament_matches` → unified ScheduledMatch with appropriate tournament matchType
    - Preserve all foreign key relationships (battleId, tournamentId)
    - Verify row counts match source → destination
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 14.2 Implement standings backfill script
    - Create `src/services/migration/backfill/standingsBackfill.ts`
    - Create one Standing per robot with mode=league_1v1 from Robot league columns
    - Create one Standing per TeamBattle with mode=league_2v2 or league_3v3 based on teamSize
    - Create one Standing per 2v2 TeamBattle with mode=tag_team from tagTeam columns
    - Create one Standing per robot with kothMatches>0 with mode=koth: calculate retroactive points as (kothWins × 25) + ((kothMatches - kothWins) × 12)
    - Assign KotH tiers by percentile: top 5% Diamond, 5-9% Platinum, 9-18% Gold, 18-38% Silver, bottom 62% Bronze (no Champion on initial seeding — earned through first post-migration promotion cycle)
    - Distribute KotH robots within each tier across instances (max 8 per instance)
    - Populate win/loss/draw counters and streak fields from Robot/TeamBattle columns
    - Carry over KotH cumulative stats (totalMatches, totalKills, totalZoneScore, totalZoneTime, bestPlacement)
    - Verify every active robot has league_1v1 entry, every active team has appropriate mode entries
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 14.3 Implement battle participants backfill script
    - Create `src/services/migration/backfill/battleBackfill.ts`
    - Verify every existing Battle has corresponding battle_participants rows with equivalent data
    - Populate `role` = active/reserve for all historical tag-team battles using legacy team1ActiveRobotId, team1ReserveRobotId, team2ActiveRobotId, team2ReserveRobotId
    - Populate `tagOutTimeMs` from legacy team1TagOutTime, team2TagOutTime columns
    - Populate `damageDealt` and `fameAwarded` on participants for historical tag-team battles from per-robot columns
    - Log discrepancies and halt if data verification fails for any record
    - _Requirements: 7.1, 7.3, 7.4, 7.7_

  - [x] 14.4 Implement financial ledger backfill script
    - Create `src/services/migration/backfill/financialBackfill.ts`
    - Backfill from existing `audit_logs` records where eventType corresponds to financial transactions
    - Extract amounts and types from payload JSON
    - Calculate balanceAfter for each entry based on chronological ordering
    - Log gaps where audit_log data is incomplete and continue processing
    - _Requirements: 9.6, 9.7_

  - [x] 14.5 Implement leaderboard cache initial seed
    - Create initial population script that runs `leaderboardService.refreshAll()` for all 7 categories
    - Verify `SELECT COUNT(*) FROM leaderboard_cache` > 0 after seed
    - _Requirements: 10.2_

  - [x] 14.6 Implement legacy table drop and column removal migrations
    - Create Prisma migration to drop legacy scheduling tables: `scheduled_matches` (old), `scheduled_team_battle_matches`, `scheduled_koth_matches`, `scheduled_koth_match_participants`, `tournament_matches`
    - Rename `scheduled_matches_v2` → `scheduled_matches`
    - Create Prisma migration to drop 20 legacy Battle columns (robot1Id, robot2Id, ELO columns, tag-team columns, damage/fame columns)
    - Create Prisma migration to drop Robot league/KotH/win-counter columns and TeamBattle league columns (as listed in Requirement 6.7)
    - Verify zero rows with `status = 'scheduled'` exist in legacy tables before drop
    - _Requirements: 3.7, 6.7, 7.5, 11.4, 11.7_

  - [x] 14.7 Write unit tests for backfill scripts
    - Test scheduling backfill: row count verification, FK preservation, matchType mapping
    - Test standings backfill: KotH retroactive point calculation, tier percentile assignment, instance allocation
    - Test battle backfill: role assignment from legacy columns, tagOutTimeMs mapping, discrepancy detection
    - Test financial backfill: audit_log parsing, gap handling, balanceAfter calculation
    - Place in `src/services/migration/__tests__/`
    - _Requirements: 3.6, 6.6, 7.1, 7.7, 9.7_

- [x] 15. Implement MigrationVerificationService

  - [x] 15.1 Implement MigrationVerificationService
    - Create `src/services/migration/migrationVerificationService.ts`
    - Implement `verifyRowCounts(domain)` — compares row counts between legacy and unified tables per domain
    - Implement `sampleVerify(domain, samplePercent)` — spot-checks 5% of records comparing key fields (IDs, timestamps, FKs, status)
    - Implement `verifyReferentialIntegrity()` — validates all FK references in new schema (battleId, tournamentId, participantIds)
    - Implement `generateFullReport()` — produces comprehensive verification report
    - Flag any mismatched records and prevent progression if discrepancies found
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 15.2 Implement admin confirmation endpoint for legacy drops
    - Create admin endpoint that requires explicit confirmation before executing table/column drops
    - Log the confirmation action in audit trail
    - _Requirements: 13.5_

  - [x] 15.3 Implement deploy orchestration script
    - Create deploy script that executes the atomic deploy sequence: stop PM2 → run Prisma migrations (create new tables with _v2 suffix) → run backfill scripts → run verification → drop legacy + rename → start PM2
    - Halt deploy if verification fails (leave legacy tables intact)
    - Verify no in-flight matches (zero `status = 'scheduled'` in legacy tables)
    - Deploy must run outside cron window (after daily battles, before next matchmaking)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.7_

  - [x] 15.4 Write unit tests for MigrationVerificationService
    - Test row count comparison logic (match / mismatch scenarios)
    - Test sample verification with known mismatches (flags discrepancy)
    - Test FK integrity check catches broken references
    - Test full report generation format
    - Place in `src/services/migration/__tests__/migrationVerificationService.test.ts`
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 16. Checkpoint — Backend complete
  - Run full backend test suite: `pnpm test -- --silent`
  - Ensure zero failures
  - Verify all 12 property tests pass
  - Ask the user if questions arise.

- [x] 17. Frontend refactoring — League Standings gains KotH tab

  - [x] 17.1 Add KotH mode tab to League Standings page
    - Add 5th mode tab "King of the Hill" to `/league-standings` page alongside 1v1, 2v2, 3v3, Tag Team
    - Support `?mode=koth` query parameter to activate KotH tab directly
    - When KotH tab active: show tier tabs, instance selector, and KotH-specific columns (KotH Pts, Matches, Wins, Best Placement, Kills)
    - Show zone indicators: green border = promotion zone, red border = demotion zone, faded opacity = not eligible (<5 cycles)
    - _Requirements: 5.5_

  - [x] 17.2 Create redirect from /koth-standings to /league-standings?mode=koth
    - Remove or replace the standalone KotH standings page component
    - Add route redirect: `/koth-standings` → `/league-standings?mode=koth`
    - Update navigation sidebar: remove "KotH Standings" link or redirect to league standings with mode param
    - _Requirements: 5.5_

  - [x] 17.3 Update frontend response shape handling for standings data
    - Update API calls to fetch standings from unified endpoint (returns standings table data)
    - Remove references to `robot.currentLeague`, `robot.leaguePoints`, `robot.kothWins` etc. from frontend models/types
    - Update TypeScript interfaces to match new API response shapes (standings-based)
    - Update robot store and stable store to not expect legacy league columns on Robot type
    - _Requirements: 4.4, 5.5, 6.7_

  - [x] 17.4 Update frontend battle history and robot detail for participant-based data
    - Update battle detail modal to read participant data from `battle_participants` response (not legacy Battle columns)
    - Update robot detail page league history section to use standings-sourced data
    - Update battle history stats utility to work with participant-based data structure
    - _Requirements: 7.2, 8.5_

  - [x] 17.5 Update frontend leaderboard and financial report pages
    - Update leaderboard pages to consume paginated cache response with `updatedAt` freshness indicator
    - Update financial report page to consume pre-aggregated ledger response (no client-side recomputation)
    - _Requirements: 9.5, 10.3, 10.4_

  - [x] 17.6 Update frontend upcoming-matches components
    - Update Dashboard robot cards to render upcoming matches from single unified response
    - Remove frontend merge logic that previously combined 4 separate match-type responses
    - Update Robot Detail upcoming section to use unified response
    - _Requirements: 1.8, 12.6_

- [x] 18. Frontend test updates

  - [x] 18.1 Update frontend page tests
    - Delete `src/pages/__tests__/KothStandingsPage.test.tsx` (page no longer exists)
    - Update `src/pages/__tests__/LeagueStandingsPage.infrastructure.test.ts` — add KotH tab assertions, mode=koth query param
    - Update `src/pages/__tests__/HallOfRecordsKoth.test.tsx` — KotH data from standings
    - Update `src/pages/__tests__/BattleHistoryKoth.test.tsx` — participant-based battle data
    - Update `src/pages/__tests__/StableViewPage.test.tsx` — remove legacy league column assertions
    - Update `src/pages/__tests__/RobotsPage.test.tsx` — remove Robot league column props
    - Update `src/pages/__tests__/RobotsPage.onboarding.test.tsx` — remove legacy column refs
    - Update `src/pages/__tests__/RobotDetailLeagueHistory.test.tsx` — standings-sourced history
    - Update `src/pages/admin/__tests__/BattleLogsPage.test.tsx` — participant-based battle logs
    - Update `src/pages/admin/__tests__/LeagueHealthPage.test.tsx` — standings-based health data
    - _Requirements: 5.5, 7.2, 4.4_

  - [x] 18.2 Update frontend component tests
    - Update `src/components/__tests__/RobotDashboardCard.test.tsx` — unified upcoming matches, no legacy column props
    - Update `src/components/__tests__/KothMatchCards.test.tsx` — standings-based KotH data
    - Update `src/components/__tests__/BattleDetailsModal.test.tsx` — participant-based assertions
    - Update `src/components/__tests__/CompactBattleCard.test.tsx` — remove robot1Id/robot2Id refs
    - Update `src/components/__tests__/RobotPerformanceAnalytics.test.tsx` — standings-sourced performance
    - Update `src/components/__tests__/PerformanceByContext.pbt.test.tsx` — updated generators
    - Update `src/components/__tests__/RecentBattles.pbt.test.tsx` — participant-based battle data
    - Update `src/components/__tests__/KothRobotAnalytics.test.tsx` — standings-based analytics
    - Update `src/components/__tests__/TeamBattleRegistration.test.tsx` — standings-based eligibility
    - Update `src/components/__tests__/TeamBattleStandings.test.tsx` — unified standings response
    - Update `src/components/admin/__tests__/BattleDetailsModal.test.tsx` — participant-based
    - _Requirements: 7.2, 8.5, 5.5, 4.4_

  - [x] 18.3 Update frontend store and utility tests
    - Update `src/stores/__tests__/robotStore.test.ts` — remove legacy league column expectations
    - Update `src/stores/__tests__/stableStore.test.ts` — remove legacy column mocks
    - Update `src/hooks/__tests__/useBattleReadiness.test.ts` — remove legacy column dependencies
    - Update `src/utils/__tests__/battleHistoryStats.test.ts` — participant-based stat calculations
    - _Requirements: 4.4, 7.2_

- [x] 19. Checkpoint — Frontend complete
  - Run frontend test suite: `cd app/frontend && pnpm test -- --run`
  - Run backend test suite: `cd app/backend && pnpm test -- --silent`
  - Ensure zero failures across both
  - Ask the user if questions arise.

- [x] 20. Documentation updates

  - [x] 20.1 Update `.kiro/steering/project-overview.md`
    - Update "Key Systems" section to reflect unified standings, scheduling, financial ledger, leaderboard cache
    - Update table count (note net change: +5 new tables, -4 legacy tables dropped, ~20 legacy columns removed)
    - Add SchedulingService, StandingsService, FinancialService, LeaderboardService to systems list
    - Note KotH tier structure integration
    - _Requirements: 4.1, 5.5, 9.1, 10.1_

  - [x] 20.2 Update `.kiro/steering/coding-standards.md`
    - Add guidance for `Standing` model typed queries (e.g., `Prisma.StandingGetPayload<{...}>`)
    - Update/remove examples that reference `robots.currentLeague` or legacy columns
    - Add guidance for FinancialLedger transactionType enum usage
    - _Requirements: 4.1, 9.1_

  - [x] 20.3 Update `docs/architecture/PRD_SERVICE_DIRECTORY.md`
    - Add new services: SchedulingService, StandingsService, FinancialService, LeaderboardService, MigrationVerificationService
    - Remove references to legacy multi-table scheduling pattern
    - Update data flow descriptions to reflect unified tables
    - _Requirements: 1.7, 4.3, 9.2, 10.2_

  - [x] 20.4 Update `docs/analysis/page-database-audit.md`
    - Rewrite table listings for Dashboard (unified scheduling query), Robot Detail (standings + participants), League Standings (standings table + KotH tab), KotH Standings (redirect to league standings), Leaderboards (leaderboard_cache), Financial Report (financial_ledger)
    - Remove references to legacy scheduling tables and legacy columns
    - _Requirements: 1.8, 5.5, 9.5, 10.3_

  - [x] 20.5 Update `docs/game-systems/` league and KotH documentation
    - Update `docs/game-systems/PRD_LEAGUE_SYSTEM.md` — reference `standings` table instead of `robots` columns, note KotH shares the same tier/promotion system
    - Update `docs/game-systems/PRD_ECONOMY_SYSTEM.md` § "King of the Hill Rewards" — replace flat reward table with tier-scaled reward tables (credits = `getLeagueWinReward(tier) × placementMultiplier`, fame/prestige = `base × tierFactor`). Add full Bronze-through-Champion tables for credits, fame, and prestige. Mark section "Status: Updated by Spec #40".
    - Update `docs/game-systems/PRD_PRESTIGE_AND_FAME.md` § "King of the Hill" (both prestige and fame subsections) — replace "flat (not league-dependent)" with tier-scaled tables. Prestige: `basePrestige × tierFactor` (Bronze=1.0×, Silver=1.5×, Gold=2.0×, Platinum=3.0×, Diamond=4.5×, Champion=7.0×). Fame: same tier factors. Note 4th-6th now earn 1 fame (not 0) to incentivize participation.
    - Update `docs/game-systems/PRD_MATCHMAKING.md` if it references KotH matchmaking to note tier-based matching
    - Document KotH migration tier seeding (percentile-based) in the appropriate PRD
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.7, 5.8, 5.9_

  - [x] 20.6 Update in-game guide content (`app/backend/src/content/guide/`)
    - Rewrite `king-of-the-hill/` section (7 articles): describe new tier system, F1-style points per placement, promotion/demotion mechanics, that KotH is now a tab on League Standings (not a separate page)
    - Update `king-of-the-hill/scoring-and-win-conditions.md` — add point scale table (25/18/15/12/10/8) and explain cumulative points
    - Update `king-of-the-hill/rewards.md` — mention tier-based progression rewards if applicable
    - Update `king-of-the-hill/entry-requirements.md` — mention KotH subscription now gates into a tiered league, not a flat leaderboard
    - Update `leagues/promotion-demotion.md` — add note that KotH uses the same relative promotion system
    - Update `leagues/league-tiers.md` — mention KotH as a mode that shares the tier structure
    - Update `facilities/booking-office.md` — update any references to KotH standings URL
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [x] 20.7 Update `docs/guides/` deployment documentation
    - Add migration deployment guide: preconditions (outside cron window), deploy sequence (stop PM2, migrations, backfill, verify, drop legacy, start PM2)
    - Document rollback procedures for each failure mode
    - Document feature flag usage for runtime fallback
    - Document admin confirmation endpoint for legacy drops
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 13.5_

- [x] 21. Final verification — Run all verification criteria from requirements

  - [x] 21.1 Run spec verification criteria
    - Run: `grep -r "scheduled_matches\b\|scheduled_team_battle_matches\|scheduled_koth_matches\|scheduled_koth_match_participants\|tournament_matches" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill\|legacy" | wc -l` → verify output is **0**
    - Run: `grep -r "robot1Id\|robot2Id\|robot1ELOBefore\|robot2ELOBefore\|robot1ELOAfter\|robot2ELOAfter\|eloChange\|team1ActiveRobotId\|team1ReserveRobotId\|team2ActiveRobotId\|team2ReserveRobotId" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill" | wc -l` → verify output is **0**
    - Run: `grep -r "currentLeague\|leaguePoints\|cyclesInCurrentLeague\|teamLp\|teamLeague\|teamLeagueId\|cyclesInLeague\|tagTeamLp\|tagTeamLeague\|tagTeamLeagueId\|kothWins\|kothMatches\|kothTotalZoneScore\|totalLeague1v1Wins\|totalLeague2v2Wins\|totalLeague3v3Wins\|totalTagTeamWins\|totalTagTeamBattles\|timesTaggedIn\|timesTaggedOut" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill" | wc -l` → verify output is **0**
    - Run: `pnpm test -- --silent` → verify 0 failures
    - Verify Dashboard upcoming-matches issues 1 SELECT against scheduled_matches (enable query logging, hit endpoint)
    - Verify `SELECT COUNT(*) FROM financial_ledger` > 0
    - Verify `SELECT COUNT(*) FROM leaderboard_cache` > 0
    - Verify `SELECT COUNT(*) FROM standings` confirms entries for all active robots (league_1v1) and all active teams (league_2v2, league_3v3, tag_team)
    - Verify `SELECT COUNT(*) FROM battles WHERE robot1_id IS NOT NULL` → **0** (legacy columns dropped)
    - Verify League Standings page serves data exclusively from standings table (query logging)
    - _Requirements: All verification criteria from Expected Contribution section_

## Notes

- All tasks are mandatory per project standards — no optional tasks
- Test updates are integrated alongside the service refactoring that breaks them (not deferred to a separate cleanup pass)
- Property-based tests use fast-check with minimum 100 iterations per property
- The deploy is atomic: all code ships together, backfill + verification + legacy drop happens in one window
- Feature flags exist for runtime rollback safety only — not for phased rollout
- Deleted test files: `tests/kothDatabaseSchema.test.ts`, `tests/services/tag-team/__tests__/tagTeamMigration.property.test.ts`, `src/pages/__tests__/KothStandingsPage.test.tsx`
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major phase boundaries

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"] },
    { "id": 1, "tasks": ["1.7"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.1", "4.4"] },
    { "id": 3, "tasks": ["2.2", "3.2", "3.3", "4.2", "4.5"] },
    { "id": 4, "tasks": ["2.3", "2.4", "3.4", "3.5", "3.6", "4.3", "4.6"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 8, "tasks": ["7.4", "7.5"] },
    { "id": 9, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 10, "tasks": ["8.4", "8.5", "9.1"] },
    { "id": 11, "tasks": ["9.2", "9.3"] },
    { "id": 12, "tasks": ["10.1", "10.2", "10.3", "10.4"] },
    { "id": 13, "tasks": ["10.5"] },
    { "id": 14, "tasks": ["11.1", "11.2"] },
    { "id": 15, "tasks": ["11.3"] },
    { "id": 16, "tasks": ["13.1"] },
    { "id": 17, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5"] },
    { "id": 18, "tasks": ["14.6", "14.7"] },
    { "id": 19, "tasks": ["15.1", "15.2", "15.3"] },
    { "id": 20, "tasks": ["15.4"] },
    { "id": 21, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5", "17.6"] },
    { "id": 22, "tasks": ["18.1", "18.2", "18.3"] },
    { "id": 23, "tasks": ["20.1", "20.2", "20.3", "20.4", "20.5", "20.6", "20.7"] },
    { "id": 24, "tasks": ["21.1"] }
  ]
}
```
