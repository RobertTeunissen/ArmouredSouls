# Implementation Plan: Spec #40 Legacy Column Drop (Phase 2)

## Overview

This plan completes the Spec #40 database unification by dropping dead scheduling tables, migrating remaining read paths to the unified `standings` table, removing dual-writes from battle orchestrators, and dropping 59 legacy columns across 3 models. Tasks are ordered by dependency: dead table drops first (no deps), read migrations second (enable column drops), dual-write removal third (enable Battle column drops), schema drops fourth, cleanup fifth.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Wave 1: Dead table drops + Read migrations + Dual-write removal",
      "parallel": true,
      "tasks": ["1", "2", "3", "4", "5"]
    },
    {
      "name": "Wave 2: Schema column drops",
      "parallel": false,
      "tasks": ["6"],
      "dependsOn": ["2", "3", "4", "5"]
    },
    {
      "name": "Wave 3: Interface cleanup + Documentation",
      "parallel": true,
      "tasks": ["7", "8"],
      "dependsOn": ["6"]
    },
    {
      "name": "Wave 4: Final verification",
      "parallel": false,
      "tasks": ["9"],
      "dependsOn": ["7", "8"]
    }
  ]
}
```

- Tasks 1, 2, 3, 4, and 5 can proceed in parallel (no interdependencies between them)
- Task 6 (column drops) requires Tasks 2, 3, 4, and 5 to be complete (all read paths migrated and dual-writes removed before columns can be dropped)
- Task 6.4 (Battle column drop) requires a verification period after Task 6.3 (nullable step)
- Tasks 7 and 8 depend on Task 6 (types shrink after columns are dropped)
- Task 9 is the final verification gate

## Notes

- **Deployment strategy**: Phases 1–3 can ship as separate PRs merged on the same day. Phase 6 (column drops) ships the next day after smoke-testing. Phase 6.4 (final Battle column drop) ships 1 cycle later.
- **Rollback**: If any read migration produces incorrect data, the rollback is to revert the service code — the legacy columns still exist until Phase 6 executes. Phase 6 is the point of no return.
- **`robot1Id`/`robot2Id` explicitly excluded**: These columns are referenced by 13+ files including FK constraints and are the primary mechanism for all match-history queries. Removing them requires rewriting the entire match-history data access layer — a separate spec.
- **Tournament scheduling explicitly excluded**: `ScheduledTournamentMatch` is still actively used for tournament bracket management. Migrating it to `scheduled_matches_v2` requires a full tournament service rewrite.

## Tasks

- [ ] 1. Drop dead scheduling tables

  - [ ] 1.1 Remove `ScheduledLeagueMatch` model and relations from schema
    - Remove the `ScheduledLeagueMatch` model definition from `prisma/schema.prisma`
    - Remove `scheduledMatchesAsRobot1` and `scheduledMatchesAsRobot2` relations from the `Robot` model
    - Remove `scheduledMatch ScheduledLeagueMatch[]` relation from the `Battle` model
    - Run `pnpm exec prisma generate` to confirm type generation succeeds
    - Fix any TypeScript import errors referencing `ScheduledLeagueMatch`
    - _Requirements: 1.1, 1.4, 1.5, 1.7, 1.8_

  - [ ] 1.2 Remove `ScheduledKothMatch` and `ScheduledKothMatchParticipant` models and relations from schema
    - Remove both model definitions from `prisma/schema.prisma`
    - Remove `kothMatchParticipations ScheduledKothMatchParticipant[]` relation from the `Robot` model
    - Remove `scheduledKothMatch ScheduledKothMatch[]` relation from the `Battle` model
    - Fix any TypeScript import errors referencing these models
    - _Requirements: 1.2, 1.4, 1.5, 1.7, 1.8_

  - [ ] 1.3 Remove `ScheduledTeamBattleMatch` model and relations from schema
    - Remove the model definition from `prisma/schema.prisma`
    - Remove `matchesAsTeam1` and `matchesAsTeam2` relations from the `TeamBattle` model
    - Fix any TypeScript import errors referencing `ScheduledTeamBattleMatch`
    - _Requirements: 1.3, 1.6, 1.7, 1.8_

  - [ ] 1.4 Run migration and verify build
    - Run `pnpm exec prisma migrate dev --name drop-dead-scheduling-tables`
    - Run `pnpm exec prisma generate`
    - Run `pnpm run build` in `app/backend/` — must exit 0
    - Run `pnpm test -- --silent` — all tests must pass
    - _Requirements: 1.7_

- [ ] 2. Read path migrations — KotH and Hall of Records

  - [ ] 2.1 Migrate `kothAnalyticsService.ts` to read from standings
    - Replace `prisma.robot.findUnique()` with parallel queries: `prisma.robot.findUnique({ select: { id, name } })` + `prisma.standing.findUnique({ where: { entityType_entityId_mode: { entityType: 'robot', entityId: robotId, mode: 'koth' } } })`
    - Map standings fields to `KothPerformance` interface: `totalMatches` → `kothMatches`, `wins` → `kothWins`, `totalZoneScore` → avgZoneScore calculation, `totalZoneTime` → `kothTotalZoneTime`, `totalKills` → `kothKills`, `bestPlacement` → `kothBestPlacement`, `currentWinStreak` → `kothCurrentWinStreak`, `bestWinStreak` → `kothBestWinStreak`
    - Return `null` when no standings row exists (equivalent to current `kothMatches === 0` check)
    - Verify response shape is unchanged (no frontend impact)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 2.2 Migrate `records-queries.ts` `fetchKothRecords()` to read from standings
    - Replace all 7 `prisma.robot.findMany()` calls (each with a KotH orderBy) with equivalent `prisma.standing.findMany()` calls filtered by `mode: 'koth'` and `totalMatches: { gt: 0 }`
    - For each category, fetch robot details (name + user) via a second query using the entity IDs from standings
    - Map standings ordering: `kothWins` → `wins`, `kothTotalZoneScore` → `totalZoneScore`, `kothKills` → `totalKills`, `kothBestWinStreak` → `bestWinStreak`, `kothTotalZoneTime` → `totalZoneTime`, `kothBestPlacement` → `bestPlacement` (ASC)
    - Preserve existing response shape (robotId, robotName, username, plus category-specific fields)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 2.3 Update KotH-related tests
    - Update any unit tests for `kothAnalyticsService` to mock `prisma.standing` instead of `prisma.robot` KotH fields
    - Update any tests for `fetchKothRecords` to mock standings queries
    - Run `pnpm test -- --testPathPattern="koth" --silent` — must pass
    - _Requirements: 2.1, 3.1_

- [ ] 3. Read path migrations — Leaderboard, Stable View, Profile, Finances

  - [ ] 3.1 Migrate `leaderboardService.ts` league filter to use standings
    - Replace `where.currentLeague = league` with a standings pre-filter: query `prisma.standing.findMany({ where: { mode: 'league_1v1', tier: league, entityType: 'robot' }, select: { entityId: true } })` and apply `where.id = { in: [...] }`
    - Source the `currentLeague` field in the response from standings (fetch alongside the robot data or include in the pre-filter results)
    - Preserve existing interface (`LeaderboardEntry` with `currentLeague` field)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 3.2 Migrate `stableViewService.ts` team stats to use standings
    - Replace `teamBattles: { select: { totalLeagueWins, totalLeagueLosses, totalLeagueDraws } }` include on User query with a separate standings query
    - Fetch user's team IDs from `prisma.teamBattle.findMany({ where: { stableId: userId }, select: { id: true } })`
    - Query `prisma.standing.findMany({ where: { entityType: 'team', entityId: { in: teamIds }, mode: { in: ['league_2v2', 'league_3v3'] } }, select: { wins, losses, draws } })`
    - Compute `teamBattleWins`, `teamBattleLosses`, `teamBattleDraws` by summing standings rows
    - Preserve response shape
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 3.3 Migrate `userProfileService.ts` tag team stats to use standings
    - Remove `totalTagTeamBattles`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws` from the robots select
    - Fetch user's 2v2 team IDs (already done in the function for `tagTeamStandings`)
    - Compute tag team totals from `prisma.standing.findMany({ where: { entityType: 'team', entityId: { in: teamIds }, mode: 'tag_team' }, select: { wins, losses, draws } })`
    - Update `totalBattles` computation: sum robot `totalBattles` (1v1) + tag team totals from standings
    - Preserve response shape
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 3.4 Migrate `finances.ts` and `economyCalculations.ts` league reads
    - In `finances.ts`: check if `robots.select.currentLeague` is used in the response or downstream calculations. If unused: remove the select. If used: replace with a standings lookup per robot.
    - In `economyCalculations.ts`: refactor functions that select `currentLeague` to either accept league as a parameter (preferred) or perform an inline standings lookup. Update callers.
    - Preserve calculation outputs (numerical correctness unchanged)
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3_

  - [ ] 3.5 Migrate remaining `currentLeague` / `teamLeague` reads (matchHistory, tournamentParticipantResolver, teamBattles route)
    - `matchHistoryService.ts`: Identify where `robot.currentLeague` is read directly (not via battle participants). If used for display in match history entries: source from standings or remove if already available from participants context.
    - `tournamentParticipantResolver.ts`: Remove fallback reads of `robot.currentLeague` and `teamBattle.teamLeague`. Source league tier exclusively from `prisma.standing` (mode `league_1v1` for robots, mode `league_2v2`/`league_3v3` for teams).
    - `routes/teamBattles.ts`: Verify whether the route still reads `teamLp`, `teamLeague`, `teamLeagueId`, `tagTeamLp`, `tagTeamLeague` directly from TeamBattle. If already mapped from standings: confirm no residual column references and document. If not: migrate to standings.
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 3.6 Verify and migrate `triggerEvaluator.ts` achievement reads
    - Inspect `triggerEvaluator.ts` for direct reads of `robot.currentLeague`, `robot.totalLeague2v2Wins`, `robot.totalLeague3v3Wins`
    - If already delegating to a service that reads from standings: document in a code comment and move on
    - If reading directly from robot: replace with standings query (`mode: 'league_1v1'` for tier, `mode: 'league_2v2'`/`'league_3v3'` for team wins using user's team standings)
    - Verify achievement trigger thresholds remain identical
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ] 3.7 Update tests for migrated read paths
    - Update unit tests for `leaderboardService` to mock standings queries
    - Update unit tests for `stableViewService` to mock standings instead of TeamBattle columns
    - Update unit tests for `userProfileService` to mock standings for tag team stats
    - Update tests for `economyCalculations` if function signatures changed
    - Update tests for `tournamentParticipantResolver` if fallback logic changed
    - Run `pnpm test -- --silent` — all tests must pass
    - _Requirements: 4.1, 5.1, 6.1, 8.1, 9.2_

- [ ] 4. Battle ELO dual-write removal

  - [ ] 4.1 Remove ELO column writes from all battle orchestrators
    - `leagueBattleOrchestrator.ts`: Remove `robot1ELOBefore`, `robot2ELOBefore`, `robot1ELOAfter`, `robot2ELOAfter`, `eloChange` from the `prisma.battle.create()` data object
    - `kothBattleOrchestrator.ts`: Same (currently writes 0-values)
    - `teamBattleOrchestrator.ts`: Same (writes team-sum ELO)
    - `tournamentBattleOrchestrator.ts`: Same
    - `teamTournamentBattleOrchestrator.ts`: Same
    - `battleStrategy.ts`: Remove ELO fields if present in battle creation
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 4.2 Migrate ELO reads from Battle columns to battle_participants
    - `tagTeamResultUpdater.ts`: Replace reads of `battle.robot1ELOBefore`/`battle.robot1ELOAfter` with lookups from `battle.participants.find(p => p.robotId === ...)?.eloBefore`
    - `tournamentBattleOrchestrator.ts`: Replace any ELO reads from battle record with participant data
    - `matchHistoryService.ts`: If it reads `eloChange` or ELO values from the Battle model for display, switch to participant-based lookups
    - `adminBattleService.ts`: Switch any ELO reads to participants
    - _Requirements: 10.5, 10.7_

  - [ ] 4.3 Update tests for ELO column removal
    - Update battle orchestrator tests to not assert on ELO columns in battle create calls
    - Update `tagTeamResultUpdater` tests to mock participant ELO fields
    - Update match history tests if they assert on Battle-level ELO
    - Run `pnpm test -- --testPathPattern="battle|orchestrator|tagTeam|tournament|matchHistory" --silent` — must pass
    - _Requirements: 10.1, 10.5_

- [ ] 5. Battle tag-team dual-write removal

  - [ ] 5.1 Remove tag-team column writes from battle creation
    - `tagTeamBattleRecord.ts`: Remove writes of `team1ActiveRobotId`, `team1ReserveRobotId`, `team2ActiveRobotId`, `team2ReserveRobotId`, `team1TagOutTime`, `team2TagOutTime` from `prisma.battle.create()` data
    - `tagTeamBattleRecord.ts`: Also migrate the read of `teamBattle.tagTeamLeagueId` — source `leagueInstanceId` from `prisma.standing` (mode `tag_team`, entityType `team`, entityId = teamId) instead of reading directly from the TeamBattle model
    - `tagTeamResultUpdater.ts`: Remove writes of `team1ActiveDamageDealt`, `team1ReserveDamageDealt`, `team2ActiveDamageDealt`, `team2ReserveDamageDealt`, `team1ActiveFameAwarded`, `team1ReserveFameAwarded`, `team2ActiveFameAwarded`, `team2ReserveFameAwarded` from battle update
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ] 5.2 Migrate tag-team reads to battle_participants
    - `matchHistoryService.ts`: Rewrite tag-team battle log rendering to derive:
      - Active robot: `participants.find(p => p.team === N && p.role === 'active')`
      - Reserve robot: `participants.find(p => p.team === N && p.role === 'reserve')`
      - Tag-out time: `participant.tagOutTimeMs` on the active participant
      - Per-robot damage: `participant.damageDealt`
      - Per-robot fame: `participant.fameAwarded`
    - `adminBattleService.ts`: Same refactoring for admin battle detail view
    - `adminStatsService.ts`: Migrate any references to tag team league columns to use standings lookups
    - `robotQueryService.ts`: Update match history queries that filter by tag-team robot IDs to use participant joins
    - `tagTeamResultUpdater.ts`: Replace reads of `team1TagOutTime`/`team2TagOutTime` with participant `tagOutTimeMs`
    - _Requirements: 11.4, 11.5, 11.6, 11.8_

  - [ ] 5.3 Update tests for tag-team column removal
    - Update `tagTeamBattleRecord` tests to not assert on legacy column writes
    - Update `tagTeamResultUpdater` tests to mock participant data for tag-out time and damage
    - Update `matchHistoryService` tests for tag-team log rendering (now uses participants)
    - Update `adminBattleService` tests for tag-team detail view
    - Run `pnpm test -- --testPathPattern="tagTeam|matchHistory|admin" --silent` — must pass
    - _Requirements: 11.1, 11.4, 11.8_

- [ ] 6. Schema migrations — Column drops

  - [ ] 6.1 Drop 26 Robot legacy columns
    - Remove from `schema.prisma` Robot model: `currentLeague`, `leagueId`, `leaguePoints`, `cyclesInCurrentLeague`, `kothWins`, `kothMatches`, `kothTotalZoneScore`, `kothTotalZoneTime`, `kothKills`, `kothBestPlacement`, `kothCurrentWinStreak`, `kothBestWinStreak`, `currentWinStreak`, `bestWinStreak`, `currentLoseStreak`, `totalTagTeamBattles`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws`, `timesTaggedIn`, `timesTaggedOut`, `totalLeague1v1Wins`, `totalLeague1v1Losses`, `totalLeague1v1Draws`, `totalLeague2v2Wins`, `totalLeague3v3Wins`
    - Remove indexes: `@@index([currentLeague])`, `@@index([currentLeague, leagueId])`
    - Run `pnpm exec prisma migrate dev --name drop-robot-legacy-columns`
    - Run `pnpm exec prisma generate`
    - _Requirements: 12.1, 12.2_

  - [ ] 6.2 Drop 14 TeamBattle legacy columns
    - Remove from `schema.prisma` TeamBattle model: `teamLp`, `teamLeague`, `teamLeagueId`, `cyclesInLeague`, `totalLeagueWins`, `totalLeagueLosses`, `totalLeagueDraws`, `tagTeamLp`, `tagTeamLeague`, `tagTeamLeagueId`, `cyclesInTagTeamLeague`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws`
    - Remove indexes: `@@index([teamLeagueId])`, `@@index([teamSize, teamLeague])`, `@@index([teamSize, tagTeamLeague, tagTeamLeagueId])`
    - Run `pnpm exec prisma migrate dev --name drop-teambattle-legacy-columns`
    - Run `pnpm exec prisma generate`
    - _Requirements: 13.1, 13.2_

  - [ ] 6.3 Make 19 Battle ELO and tag-team columns nullable
    - Change all 5 ELO columns from `Int` to `Int?` (nullable): `robot1ELOBefore`, `robot2ELOBefore`, `robot1ELOAfter`, `robot2ELOAfter`, `eloChange`
    - Change all 14 tag-team columns to nullable: `team1ActiveRobotId Int?`, `team1ReserveRobotId Int?`, `team2ActiveRobotId Int?`, `team2ReserveRobotId Int?`, `team1TagOutTime BigInt?` (already nullable), `team2TagOutTime BigInt?` (already nullable), `team1ActiveDamageDealt Int?`, `team1ReserveDamageDealt Int?`, `team2ActiveDamageDealt Int?`, `team2ReserveDamageDealt Int?`, `team1ActiveFameAwarded Int?`, `team1ReserveFameAwarded Int?`, `team2ActiveFameAwarded Int?`, `team2ReserveFameAwarded Int?`
    - Run `pnpm exec prisma migrate dev --name make-battle-legacy-columns-nullable`
    - Run `pnpm exec prisma generate`
    - _Requirements: 10.6, 11.7_

  - [ ] 6.4 Drop 19 Battle ELO and tag-team columns (after verification period)
    - Remove all 19 columns from the Battle model in `schema.prisma`
    - Run `pnpm exec prisma migrate dev --name drop-battle-elo-tagteam-columns`
    - Run `pnpm exec prisma generate`
    - This task executes only after 1 full game cycle confirms no errors from nullable columns
    - _Requirements: 14.1, 14.2, 14.4_

- [ ] 7. Interface cleanup and bye-robot type fixes

  - [ ] 7.1 Update bye-robot and bye-team constructors
    - Across all matchmaking services (5+ files: `matchmakingService.ts`, `teamBattleMatchmakingService.ts`, `teamBattleOrchestrator.ts`, `tagTeamByeTeam.ts`, `tagTeamMatchmakingService.ts`, `practiceArenaService.ts`): remove legacy field assignments from bye/mock object constructors
    - After column drops, the Prisma type no longer includes these fields — constructors simply shrink
    - _Requirements: 12.3, 12.4_

  - [ ] 7.2 Update `TagTeamWithRobots` interface and team creation
    - Remove `tagTeamLp`, `tagTeamLeague`, `tagTeamLeagueId`, `cyclesInTagTeamLeague`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws` from `tagTeamTypes.ts`
    - In `teamBattleService.ts`: remove initial value writes for dropped columns during team creation (standings row creation already handles LP/tier initialization)
    - _Requirements: 13.3, 13.5_

  - [ ] 7.3 Verify BattleSummary model is unaffected
    - Confirm `BattleSummary` model does not reference any of the 19 dropped Battle columns
    - Confirm it reads from `battle_participants` for any participant-level data
    - If any references exist: migrate them
    - _Requirements: 14.3_

  - [ ] 7.4 Update remaining raw SQL queries
    - Search for any raw SQL (`$queryRaw`, `$executeRaw`) referencing dropped columns
    - In `records-queries.ts`: `fetchCareerRecords` raw SQL references `r."current_league"` — replace with a JOIN to `standings` or remove if only used for display mapping
    - In `records-queries.ts`: `fetchEconomicRecords` references `robot.currentLeague` — replace with standings source
    - Verify no other raw SQL uses dropped columns
    - _Requirements: 14.4, 12.1_

  - [ ] 7.5 Full build and test verification after column drops
    - Run `pnpm run build` in `app/backend/` — must exit 0
    - Run `pnpm test -- --silent` — must pass with 0 failures
    - Run `pnpm run lint` — must pass
    - _Requirements: 12.4, 13.6, 14.2_

- [ ] 8. Documentation updates

  - [ ] 8.1 Update steering files
    - `.kiro/steering/project-overview.md`: Add note to Key Systems section that Spec #40 column cleanup is complete; update model size references if present
    - `.kiro/steering/coding-standards.md`: Add rule under "Database Interactions" section: "Never read league, KotH, or tag-team competitive stats from the Robot or TeamBattle models — the `standings` table is the single source of truth for all competitive ranking data. Use `prisma.standing.findUnique({ where: { entityType_entityId_mode: { ... } } })` for per-entity lookups."
    - _Requirements: 16.1, 16.2_

  - [ ] 8.2 Update architecture and guide documentation
    - `docs/architecture/PRD_SERVICE_DIRECTORY.md`: Remove references to `scheduled_matches`, `scheduled_koth_matches`, `scheduled_team_battle_matches` tables; update Battle model description to note ELO/tag-team columns removed
    - `docs/architecture/PRD_BATTLE_DATA_ARCHITECTURE.md`: Update to document that `battle_participants` is the sole source of per-robot battle data (ELO, damage, fame, tag-out time)
    - `docs/analysis/SPEC40_LEGACY_COLUMN_AUDIT.md`: Add a header noting "✅ Completed — Spec #43" with date
    - _Requirements: 16.3_

  - [ ] 8.3 Update backlog and remove superseded plan
    - `docs/BACKLOG.md`: Move item #59 to "Recently Completed" table with reference to Spec #43
    - Delete `docs/implementation_notes/SPEC40_LEGACY_CLEANUP_PLAN.md` (superseded by this spec)
    - _Requirements: 16.4, 16.5_

- [ ] 9. Final verification

  - [ ] 9.1 Run all verification criteria from requirements
    - Run verification grep #1: ScheduledLeagueMatch/KothMatch/TeamBattleMatch references → expect 0
    - Run verification grep #2: Robot KotH column references → expect 0
    - Run verification grep #3: Robot league column references → expect 0
    - Run verification grep #4: Robot per-mode counter references → expect 0
    - Run verification grep #5: Battle ELO column references → expect 0
    - Run verification grep #6: Battle tag-team column references → expect 0
    - Run verification grep #7: TeamBattle legacy column references → expect 0
    - Run `pnpm run build` → exits 0
    - Run `pnpm test -- --silent` → 0 failures
    - Verify Prisma schema no longer contains dead models (criteria 10)
    - Verify Robot model column count reduced (criteria 11)
    - Verify TeamBattle model column count reduced (criteria 12)
    - _Requirements: 1.1–1.8, 2.1–2.4, 3.1–3.4, 4.1–4.4, 5.1–5.4, 6.1–6.4, 7.1–7.3, 8.1–8.3, 9.1–9.4, 10.1–10.7, 11.1–11.8, 12.1–12.5, 13.1–13.6, 14.1–14.4, 15.1–15.4, 16.1–16.5_
