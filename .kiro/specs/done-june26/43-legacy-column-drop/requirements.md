# Requirements Document

## Introduction

Spec #40 (Database Unification) delivered the unified tables — `standings`, `scheduled_matches_v2`, `battle_participants`, `financial_ledger`, and `leaderboard_cache` — and migrated all write paths to them. However, the planned column and table drops were never executed. A June 2026 audit (#[[docs/analysis/SPEC40_LEGACY_COLUMN_AUDIT.md]]) found **60+ production-code references** to legacy columns across 25+ files — all reads or dual-writes that should now point at the unified tables.

This spec completes the Spec #40 migration by:
1. Dropping the 3 dead scheduling tables (zero reads, zero writes)
2. Migrating remaining read paths from legacy Robot/TeamBattle columns to the `standings` table
3. Removing dual-writes of ELO and tag-team columns on the `Battle` model
4. Dropping the legacy columns from the Prisma schema once all consumers are migrated

**Scope exclusions:**
- `robot1Id`/`robot2Id` on Battle — 13+ file blast radius, FK constraints, and match-history query patterns make this a separate spec-sized effort
- Tournament scheduling migration (`ScheduledTournamentMatch` → `scheduled_matches_v2`) — still actively used, needs its own spec
- Frontend type cleanup for legacy field names — addressed in Phase 5 tasks but limited to backend-facing API responses (no new frontend pages)

## Expected Contribution

This spec delivers the following measurable improvements:

1. **Dead table removal**: 3 legacy scheduling tables (`scheduled_matches`, `scheduled_koth_matches` + `scheduled_koth_match_participants`, `scheduled_team_battle_matches`) dropped from the schema. Reduces schema surface from 30 models to 27 models, removing ~80 lines of model definitions and eliminating dangling relations on Robot, Battle, and TeamBattle.

2. **Legacy Robot column elimination**: 26 legacy columns removed from the `Robot` model (`currentLeague`, `leagueId`, `leaguePoints`, `cyclesInCurrentLeague`, 8 KotH columns, 3 streak columns, 6 tag-team counters, 5 per-mode win counters). Reduces Robot model from ~95 data columns to ~69 data columns — a 27% reduction.

3. **Legacy TeamBattle column elimination**: 14 legacy columns removed from the `TeamBattle` model (league LP/tier/instance/cycles, win/loss/draw counters for both league and tag-team modes). Reduces TeamBattle model from ~20 data columns to ~6 data columns — a 70% reduction.

4. **Battle dual-write removal**: 5 ELO columns + 14 tag-team columns (robot IDs, tag-out times, per-robot damage/fame stats) no longer written during battle creation. Removes 19 column writes from every battle insert — reducing write payload by ~40% per battle.

5. **Single source of truth enforcement**: After this spec, competitive standings data has exactly ONE read/write location (`standings` table). No more ambiguity about whether `robot.currentLeague` or `standings.tier` is canonical. Eliminates the class of bugs where legacy columns drift from the unified table.

6. **Index cleanup**: 5 database indexes on dropped columns are removed, reducing index maintenance overhead during writes and saving ~20MB of index storage at current data volumes.

### Verification Criteria

After all tasks are complete, run these checks to confirm the spec delivered:

1. `grep -r "ScheduledLeagueMatch\|ScheduledKothMatch\|ScheduledKothMatchParticipant\|ScheduledTeamBattleMatch" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill\|__tests__" | wc -l` → **0** (no production code references dead scheduling models)

2. `grep -r "kothWins\|kothMatches\|kothTotalZoneScore\|kothTotalZoneTime\|kothKills\|kothBestPlacement\|kothCurrentWinStreak\|kothBestWinStreak" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill\|__tests__" | wc -l` → **0** (no production reads of Robot KotH columns)

3. `grep -r "currentLeague\|leaguePoints\|cyclesInCurrentLeague\|\bleagueId\b" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill\|__tests__\|robot1Id\|robot2Id\|leagueInstanceId" | wc -l` → **0** (no production reads of Robot league columns)

4. `grep -r "totalTagTeamBattles\|totalTagTeamWins\|totalTagTeamLosses\|totalTagTeamDraws\|timesTaggedIn\|timesTaggedOut\|totalLeague1v1Wins\|totalLeague1v1Losses\|totalLeague1v1Draws\|totalLeague2v2Wins\|totalLeague3v3Wins" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill\|__tests__" | wc -l` → **0** (no production reads of Robot per-mode counters)

5. `grep -r "robot1ELOBefore\|robot2ELOBefore\|robot1ELOAfter\|robot2ELOAfter\|eloChange" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill\|__tests__" | wc -l` → **0** (no production writes/reads of Battle ELO columns)

6. `grep -r "team1ActiveRobotId\|team1ReserveRobotId\|team2ActiveRobotId\|team2ReserveRobotId\|team1TagOutTime\|team2TagOutTime\|team1ActiveDamageDealt\|team1ReserveDamageDealt\|team2ActiveDamageDealt\|team2ReserveDamageDealt\|team1ActiveFameAwarded\|team1ReserveFameAwarded\|team2ActiveFameAwarded\|team2ReserveFameAwarded" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill\|__tests__" | wc -l` → **0** (no production writes/reads of Battle tag-team columns)

7. `grep -r "teamLp\b\|teamLeague\b\|teamLeagueId\b\|cyclesInLeague\b\|totalLeagueWins\b\|totalLeagueLosses\b\|totalLeagueDraws\b\|tagTeamLp\b\|tagTeamLeague\b\|tagTeamLeagueId\b\|cyclesInTagTeamLeague\b\|totalTagTeamWins\b\|totalTagTeamLosses\b\|totalTagTeamDraws\b" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill\|__tests__" | wc -l` → **0** (no production reads of TeamBattle legacy columns)

8. `pnpm run build` in `app/backend/` exits 0 (TypeScript compiles cleanly after column removal)

9. `pnpm test -- --silent` passes with 0 failures

10. The Prisma schema no longer contains models `ScheduledLeagueMatch`, `ScheduledTeamBattleMatch`, `ScheduledKothMatch`, or `ScheduledKothMatchParticipant`

11. The Robot model in `schema.prisma` no longer contains any of the 26 dropped columns

12. The TeamBattle model in `schema.prisma` no longer contains any of the 14 dropped columns

## Glossary

- **Legacy columns**: Columns on Robot, TeamBattle, and Battle models that were superseded by Spec #40's unified tables but never dropped
- **Standings table**: The unified `standings` table (created by Spec #40) that holds all competitive ranking data with a `mode` discriminator
- **Dead tables**: The 3 legacy scheduling tables with zero production reads and zero writes — safe to drop immediately
- **Dual-write**: Pattern where battle orchestrators write the same data to both the old columns (Battle.robot1ELOBefore, etc.) and the new `battle_participants` table
- **Read migration**: Changing a service from reading legacy columns to reading from the `standings` table
- **Two-step column drop**: Making columns nullable first (stop writing), then dropping entirely after verification period
- **Bye robot/team constructors**: Mock object factories in matchmaking services that build minimal Robot/TeamBattle objects for bye-match handling — these reference legacy fields to satisfy the full Prisma type shape

## Requirements

### Requirement 1: Dead Scheduling Table Removal

**User Story:** As a developer, I want the unused legacy scheduling tables removed from the schema, so that the codebase has no dangling model definitions referencing dead tables.

#### Acceptance Criteria

1. THE Migration_System SHALL remove the `ScheduledLeagueMatch` model from `schema.prisma` and drop the `scheduled_matches` table
2. THE Migration_System SHALL remove the `ScheduledKothMatch` and `ScheduledKothMatchParticipant` models from `schema.prisma` and drop the `scheduled_koth_matches` and `scheduled_koth_match_participants` tables
3. THE Migration_System SHALL remove the `ScheduledTeamBattleMatch` model from `schema.prisma` and drop the `scheduled_team_battle_matches` table
4. THE Migration_System SHALL remove all relations referencing dead tables from the `Robot` model (`scheduledMatchesAsRobot1`, `scheduledMatchesAsRobot2`, `kothMatchParticipations`)
5. THE Migration_System SHALL remove all relations referencing dead tables from the `Battle` model (`scheduledMatch`, `scheduledKothMatch`)
6. THE Migration_System SHALL remove all relations referencing dead tables from the `TeamBattle` model (`matchesAsTeam1`, `matchesAsTeam2`)
7. WHEN the migration runs, THE build SHALL compile without TypeScript errors referencing the removed models
8. ANY type imports or interface references to the removed models in service files SHALL be deleted or replaced with `ScheduledMatch`/`ScheduledMatchParticipant` types

### Requirement 2: KotH Analytics Read Migration

**User Story:** As a developer, I want KotH performance data read from the `standings` table, so that the Robot model's KotH columns can be dropped.

#### Acceptance Criteria

1. THE `kothAnalyticsService.getKothPerformance()` SHALL read all KotH stats from `prisma.standing.findUnique()` with filter `{ entityType: 'robot', entityId: robotId, mode: 'koth' }` instead of `prisma.robot.findUnique()`
2. THE `kothAnalyticsService` SHALL map standings fields to the existing `KothPerformance` response interface: `totalMatches` → `kothMatches`, `wins` → `kothWins`, `totalZoneScore` → `kothTotalZoneScore` (divided by matches for avg), `totalZoneTime` → `kothTotalZoneTime`, `totalKills` → `kothKills`, `bestPlacement` → `kothBestPlacement`, `currentWinStreak` → `kothCurrentWinStreak`, `bestWinStreak` → `kothBestWinStreak`
3. THE response shape of the KotH analytics endpoint SHALL remain unchanged (no frontend breaking changes)
4. WHEN a robot has no `standings` row with `mode = 'koth'`, THE service SHALL return `null` (same behavior as current "kothMatches === 0" check)

### Requirement 3: Hall of Records KotH Read Migration

**User Story:** As a developer, I want the Hall of Records KotH section to read from standings, so that KotH leaderboard records use the unified data source.

#### Acceptance Criteria

1. THE `fetchKothRecords()` function in `records-queries.ts` SHALL query `prisma.standing` (filtered by `mode = 'koth'` and `totalMatches > 0`) instead of `prisma.robot` for all 7 KotH record categories
2. THE function SHALL join standings data with robot/user information to preserve the existing response shape (robotId, robotName, username)
3. THE ordering logic SHALL map legacy fields to standings equivalents: `kothWins` → `standings.wins`, `kothTotalZoneScore` → `standings.totalZoneScore`, `kothKills` → `standings.totalKills`, `kothBestWinStreak` → `standings.bestWinStreak`, `kothTotalZoneTime` → `standings.totalZoneTime`, `kothBestPlacement` → `standings.bestPlacement`
4. THE response format SHALL remain backward-compatible with the frontend (no breaking changes)

### Requirement 4: Leaderboard Service League Filter Migration

**User Story:** As a developer, I want the leaderboard service to filter by league using the standings table, so that it no longer reads `robot.currentLeague`.

#### Acceptance Criteria

1. THE `leaderboardService` SHALL filter robots by league tier using `prisma.standing.findMany({ where: { mode: 'league_1v1', tier: league } })` to obtain robot IDs, instead of filtering on `robot.currentLeague`
2. THE leaderboard response SHALL include a `currentLeague` field sourced from the standings table (not the Robot model)
3. WHEN `league` filter is 'all' or not provided, THE service SHALL not apply league filtering (existing behavior preserved)
4. THE leaderboard query performance SHALL not regress — the standings unique index `(entityType, entityId, mode)` provides O(1) lookups

### Requirement 5: Stable View Team Stats Read Migration

**User Story:** As a developer, I want the stable view to read team battle stats from standings, so that TeamBattle legacy columns can be dropped.

#### Acceptance Criteria

1. THE `stableViewService.getStableProfile()` SHALL read team battle win/loss/draw stats from `prisma.standing.findMany()` filtered by `entityType: 'team'` and modes `league_2v2`/`league_3v3` for the user's teams, instead of reading `teamBattle.totalLeagueWins/Losses/Draws`
2. THE aggregated stats (`teamBattleWins`, `teamBattleLosses`, `teamBattleDraws`, `totalTeamBattles`, `teamBattleWinRate`) SHALL be computed by summing across the user's team standings rows
3. THE response shape SHALL remain unchanged (no frontend breaking changes)
4. THE `teamBattles` include on the User query SHALL be removed or reduced to only fetch team IDs needed for the standings lookup

### Requirement 6: User Profile Tag Team Stats Read Migration

**User Story:** As a developer, I want user profile tag team stats read from standings, so that Robot-level tag team counters can be dropped.

#### Acceptance Criteria

1. THE `userProfileService.getStableStats()` SHALL read tag team battle counts from `prisma.standing` (filtered by `entityType: 'team'`, `mode: 'tag_team'` for the user's 2v2 teams) instead of reading `robot.totalTagTeamBattles/Wins/Losses/Draws`
2. THE `totalBattles` aggregate SHALL sum 1v1 battles (from robot) plus tag team battles (from standings) to preserve the existing combined total
3. THE response shape SHALL remain unchanged
4. THE robots query SHALL no longer select `totalTagTeamBattles`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws`

### Requirement 7: Finances Route League Read Migration

**User Story:** As a developer, I want the finances route to source league context from standings, so that it no longer reads `robot.currentLeague`.

#### Acceptance Criteria

1. IF the finances route uses `robot.currentLeague` for display or calculation purposes, THE route SHALL read the league tier from `prisma.standing` (mode `league_1v1`, entityType `robot`) instead
2. IF `robot.currentLeague` is selected but never used in the response or calculations, THE select SHALL be removed entirely
3. THE finances API response SHALL remain unchanged

### Requirement 8: Economy Calculations League Read Migration

**User Story:** As a developer, I want economy calculations to accept league as a parameter or read from standings, so that no utility function reads `robot.currentLeague` directly.

#### Acceptance Criteria

1. THE `economyCalculations.ts` functions that currently select `robot.currentLeague` SHALL either: (a) accept league as a parameter from the caller, or (b) read from `prisma.standing` with mode `league_1v1`
2. THE callers of these functions SHALL be updated to provide the league value from standings
3. THE calculation outputs SHALL remain numerically identical (no behavioral change)

### Requirement 9: Remaining League Read Migrations (matchHistory, tournamentParticipantResolver, teamBattles route)

**User Story:** As a developer, I want all remaining services that read `currentLeague`, `leagueId`, or `teamLeague` from Robot/TeamBattle to source that data from standings, so that no residual reads block column drops.

#### Acceptance Criteria

1. THE `matchHistoryService.ts` SHALL no longer read `robot.currentLeague` directly — if used for display, source from standings or from the battle participants context
2. THE `tournamentParticipantResolver.ts` SHALL remove its fallback reads of `robot.currentLeague` and `teamBattle.teamLeague` — source exclusively from standings
3. THE `routes/teamBattles.ts` route SHALL be verified: if it still reads `teamLp`, `teamLeague`, `teamLeagueId`, `tagTeamLp`, `tagTeamLeague` from TeamBattle directly (not mapped from standings), those reads SHALL be migrated to standings
4. IF `routes/teamBattles.ts` already maps all values from standings (as indicated by "✅ Mapped" in the audit), confirm no residual direct reads exist and document verification

### Requirement 10: Battle ELO Dual-Write Removal

**User Story:** As a developer, I want battle orchestrators to stop writing ELO columns on the Battle model, so that `battle_participants` is the single source of ELO data per battle.

#### Acceptance Criteria

1. THE `leagueBattleOrchestrator` SHALL not write `robot1ELOBefore`, `robot2ELOBefore`, `robot1ELOAfter`, `robot2ELOAfter`, or `eloChange` during battle creation
2. THE `kothBattleOrchestrator` SHALL not write ELO columns during battle creation
3. THE `teamBattleOrchestrator` SHALL not write ELO columns during battle creation
4. THE `tournamentBattleOrchestrator` and `teamTournamentBattleOrchestrator` SHALL not write ELO columns during battle creation
5. ANY service that previously read ELO from Battle columns (`tagTeamResultUpdater`, `matchHistoryService`, `adminBattleService`) SHALL read from `battle_participants.eloBefore`/`eloAfter` instead
6. THE schema migration SHALL make all 5 ELO columns nullable (`Int?`) in a first step, then drop them in a subsequent migration after verification
7. THE `BattleParticipant.eloBefore` and `BattleParticipant.eloAfter` fields SHALL remain the canonical ELO source (already written by all orchestrators)

### Requirement 11: Battle Tag-Team Dual-Write Removal

**User Story:** As a developer, I want battle orchestrators to stop writing tag-team-specific columns on the Battle model, so that `battle_participants` is the single source of per-robot tag-team data.

#### Acceptance Criteria

1. THE `tagTeamBattleRecord` service SHALL not write `team1ActiveRobotId`, `team1ReserveRobotId`, `team2ActiveRobotId`, `team2ReserveRobotId` during battle creation
2. THE `tagTeamBattleRecord` service SHALL not write `team1TagOutTime`, `team2TagOutTime` during battle creation
3. THE `tagTeamResultUpdater` SHALL not write `team1ActiveDamageDealt`, `team1ReserveDamageDealt`, `team2ActiveDamageDealt`, `team2ReserveDamageDealt`, `team1ActiveFameAwarded`, `team1ReserveFameAwarded`, `team2ActiveFameAwarded`, `team2ReserveFameAwarded` during result processing
4. ANY service reading tag-team robot positions SHALL derive them from `battle_participants` using `role` (active/reserve) and `team` (1/2) instead of Battle-level columns
5. ANY service reading tag-out timestamps SHALL read from `battle_participants.tagOutTimeMs` (already populated per Spec #40 BattleParticipant enhancement) or from `battleLog` JSON
6. ANY service reading per-robot damage/fame stats SHALL read from `battle_participants.damageDealt`/`fameAwarded`
7. THE schema migration SHALL make all 14 tag-team columns nullable in a first step, then drop them after verification
8. THE `matchHistoryService` tag-team battle log rendering SHALL be refactored to use `battle_participants` data exclusively

### Requirement 12: Robot Model Legacy Column Drop

**User Story:** As a developer, I want all 26 legacy columns removed from the Robot model, so that the model only contains actively-written data.

#### Acceptance Criteria

1. THE schema migration SHALL remove these columns from the Robot model: `currentLeague`, `leagueId`, `leaguePoints`, `cyclesInCurrentLeague`, `kothWins`, `kothMatches`, `kothTotalZoneScore`, `kothTotalZoneTime`, `kothKills`, `kothBestPlacement`, `kothCurrentWinStreak`, `kothBestWinStreak`, `currentWinStreak`, `bestWinStreak`, `currentLoseStreak`, `totalTagTeamBattles`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws`, `timesTaggedIn`, `timesTaggedOut`, `totalLeague1v1Wins`, `totalLeague1v1Losses`, `totalLeague1v1Draws`, `totalLeague2v2Wins`, `totalLeague3v3Wins`
2. THE migration SHALL drop indexes: `@@index([currentLeague])`, `@@index([currentLeague, leagueId])`
3. ALL bye-robot and mock-robot constructors in matchmaking services SHALL be updated to no longer set values for dropped fields
4. THE TypeScript build SHALL compile cleanly after column removal
5. THE column drop SHALL only execute after ALL read migrations (Requirements 2–9) are verified working

### Requirement 13: TeamBattle Model Legacy Column Drop

**User Story:** As a developer, I want all 14 legacy columns removed from the TeamBattle model, so that the model only contains team identity and membership data.

#### Acceptance Criteria

1. THE schema migration SHALL remove these columns from the TeamBattle model: `teamLp`, `teamLeague`, `teamLeagueId`, `cyclesInLeague`, `totalLeagueWins`, `totalLeagueLosses`, `totalLeagueDraws`, `tagTeamLp`, `tagTeamLeague`, `tagTeamLeagueId`, `cyclesInTagTeamLeague`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws`
2. THE migration SHALL drop indexes: `@@index([teamLeagueId])`, `@@index([teamSize, teamLeague])`, `@@index([teamSize, tagTeamLeague, tagTeamLeagueId])`
3. THE `teamBattleService.ts` SHALL no longer set initial values for dropped columns during team creation (standings rows already handle this)
4. ALL bye-team constructors SHALL be updated to no longer set values for dropped fields
5. THE `TagTeamWithRobots` interface in `tagTeamTypes.ts` SHALL be updated to remove references to dropped fields
6. THE column drop SHALL only execute after the stable view (Req 5) and all other TeamBattle read paths (Req 9) are migrated

### Requirement 14: Battle Model ELO and Tag-Team Column Drop

**User Story:** As a developer, I want the 19 legacy ELO and tag-team columns dropped from the Battle model after the dual-writes are removed.

#### Acceptance Criteria

1. THE schema migration SHALL remove these columns from the Battle model: `robot1ELOBefore`, `robot2ELOBefore`, `robot1ELOAfter`, `robot2ELOAfter`, `eloChange`, `team1ActiveRobotId`, `team1ReserveRobotId`, `team2ActiveRobotId`, `team2ReserveRobotId`, `team1TagOutTime`, `team2TagOutTime`, `team1ActiveDamageDealt`, `team1ReserveDamageDealt`, `team2ActiveDamageDealt`, `team2ReserveDamageDealt`, `team1ActiveFameAwarded`, `team1ReserveFameAwarded`, `team2ActiveFameAwarded`, `team2ReserveFameAwarded`
2. THE column drop migration SHALL only run after Requirements 10 and 11 are fully verified (two-step: nullable first, drop second)
3. THE `BattleSummary` model (if it caches any of these values) SHALL not be affected — verify it reads from `battle_participants`
4. ALL remaining raw SQL queries referencing these columns SHALL be updated to use `battle_participants` table joins

### Requirement 15: Achievement and Trigger Evaluator Migration

**User Story:** As a developer, I want the achievement system to read per-mode stats exclusively from standings, so that robot legacy columns are no longer needed for achievement evaluation.

#### Acceptance Criteria

1. THE `triggerEvaluator.ts` SHALL read `currentLeague` (for tier-based achievements) from `prisma.standing` with mode `league_1v1` instead of from the Robot model
2. THE `triggerEvaluator.ts` SHALL read `totalLeague2v2Wins` and `totalLeague3v3Wins` from `prisma.standing` wins field (mode `league_2v2`/`league_3v3`, entityType 'team', filtered by user's teams) instead of from the Robot model
3. THE achievement evaluation correctness SHALL be preserved — same achievements trigger at same thresholds
4. IF the achievement system already reads from standings (as indicated by "✅ Mapped" in the audit), verify and document that no fallback to robot columns exists

### Requirement 16: Documentation and Steering Updates

**User Story:** As a developer, I want documentation updated to reflect the simplified schema, so that future development uses the correct data access patterns.

#### Acceptance Criteria

1. THE `.kiro/steering/project-overview.md` SHALL be updated to note the completed column cleanup and reduced model sizes
2. THE `.kiro/steering/coding-standards.md` SHALL be updated to add a rule: "Never read league/KotH/tag-team stats from Robot or TeamBattle models — use the standings table"
3. THE `docs/architecture/PRD_SERVICE_DIRECTORY.md` (or equivalent) SHALL be updated to remove references to dropped tables/columns
4. THE `docs/BACKLOG.md` item #59 SHALL be moved to the "Recently Completed" table with a reference to this spec
5. THE implementation plan at `docs/implementation_notes/SPEC40_LEGACY_CLEANUP_PLAN.md` SHALL be removed or archived (superseded by this spec)
