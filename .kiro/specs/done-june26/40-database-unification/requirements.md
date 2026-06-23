# Requirements Document

## Introduction

This specification defines a major database unification and simplification overhaul for the ArmouredSouls project. The current schema has 27 tables with significant structural redundancy: four separate scheduling tables that all serve the same "upcoming matches" concept, competitive standings data scattered across `robots` (~20 columns) and `team_battles` (~12 columns) with triplicated rebalancing logic, legacy denormalized columns on the Battle model that duplicate data already in `battle_participants`, financial data scattered across multiple tables requiring recomputation, and full-table sorts for leaderboard pages.

This overhaul consolidates scheduling into a single polymorphic table, unifies all competitive standings (1v1 league, 2v2/3v3 league, tag team, KotH, tournaments) into a single `standings` table with per-mode streaks and a new KotH point-based ranking system, removes legacy Battle columns, introduces a financial ledger for pre-computed economics, and adds a materialized leaderboard cache. All changes must be backward-compatible during migration and preserve historical data integrity.

## Expected Contribution

This spec delivers the following measurable improvements to the ArmouredSouls database architecture:

1. **Scheduling table count reduction**: 5 tables (`scheduled_matches`, `scheduled_team_battle_matches`, `scheduled_koth_matches`, `scheduled_koth_match_participants`, `tournament_matches`) → 2 tables (`scheduled_matches`, `scheduled_match_participants`). Net reduction: 3 tables dropped from schema.

2. **Upcoming-matches query reduction**: Dashboard, Robot Detail, and Onboarding currently execute 4 separate queries to assemble upcoming matches. After unification: 1 query with a `matchType` filter. Eliminates all frontend merge logic for these views.

3. **Standings data consolidation**: ~20 league/KotH columns removed from `robots` model, ~12 league columns removed from `team_battles` model. All competitive standing data (LP, tier, instance, streaks, win/loss counters) lives in one `standings` table with a `mode` discriminator. Eliminates 3 separate rebalancing/promotion implementations → 1 unified implementation.

4. **Battle model column reduction**: 20 legacy columns removed from the `battles` table (`robot1Id`, `robot2Id`, 5 ELO columns, 4 tag-team robot ID columns, 2 tag-out timestamps, 8 per-robot damage/fame stats). All data already exists in `battle_participants`.

5. **Financial report computation elimination**: Financial Report, Cycle Summary, and Admin Economy currently recompute finances from `audit_logs` + formula recalculation on every page load. After: pre-recorded ledger entries serve aggregated totals directly. Expected query time reduction: O(n audit_logs scan) → O(1) indexed lookup per transaction type.

6. **Leaderboard sort elimination**: Leaderboard pages currently sort the entire `robots` table (100+ rows with 50+ columns each) on every request. After: serve pre-ranked results from a compact cache table with a simple `ORDER BY rank` on indexed column.

7. **KotH competitive redesign**: KotH moves from a pure cumulative stat tracker (no league structure) to a point-based ranking system (F1-style points per placement), integrated into the unified standings table with proper tier structure.

8. **Hall of Records structural improvement** (indirect): KotH records move from sorting the bloated `robots` table (50+ columns) to sorting the compact `standings` table filtered by `mode = 'koth'`. The `battles` table drops ~20 columns, halving row size and improving sort performance for combat records. Career/Economic records benefit from a leaner `robots` model with better memory utilization per scan. Dedicated Hall of Records caching is deferred to a follow-up spec.

### Verification Criteria

After all tasks are complete, run these checks to confirm the spec delivered:

1. `grep -r "scheduled_matches\b\|scheduled_team_battle_matches\|scheduled_koth_matches\|scheduled_koth_match_participants\|tournament_matches" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill\|legacy" | wc -l` → **0** (no production code references legacy scheduling tables)

2. `grep -r "robot1Id\|robot2Id\|robot1ELOBefore\|robot2ELOBefore\|robot1ELOAfter\|robot2ELOAfter\|eloChange\|team1ActiveRobotId\|team1ReserveRobotId\|team2ActiveRobotId\|team2ReserveRobotId" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill" | wc -l` → **0** (no production code references legacy Battle columns)

3. `grep -r "currentLeague\|leaguePoints\|cyclesInCurrentLeague\|teamLp\|teamLeague\|teamLeagueId\|cyclesInLeague\|tagTeamLp\|tagTeamLeague\|tagTeamLeagueId\|kothWins\|kothMatches\|kothTotalZoneScore\|totalLeague1v1Wins\|totalLeague2v2Wins\|totalLeague3v3Wins\|totalTagTeamWins\|totalTagTeamBattles\|timesTaggedIn\|timesTaggedOut" app/backend/src/ --include="*.ts" | grep -v "migration\|backfill" | wc -l` → **0** (no production code references legacy standings columns on robots/team_battles)

4. `pnpm test -- --silent` passes with 0 failures (all services refactored correctly)

5. Dashboard upcoming-matches endpoint returns all match types from a single DB query — verify via query logging that only 1 `SELECT` is issued against `scheduled_matches` (not 4 separate queries)

6. `SELECT COUNT(*) FROM financial_ledger` > 0 (backfill completed)

7. `SELECT COUNT(*) FROM leaderboard_cache` > 0 (cache populated)

8. `SELECT COUNT(*) FROM standings` confirms entries exist for all active robots (1v1) and all active teams (2v2, 3v3, tag_team)

9. `SELECT COUNT(*) FROM battles WHERE robot1_id IS NOT NULL` → **0** (legacy columns dropped after migration)

10. League standings page serves data exclusively from `standings` table — verify via query logging

## Glossary

- **Scheduling_Service**: The backend service responsible for creating, querying, and resolving scheduled match records across all match types
- **Battle_Service**: The backend service responsible for recording battle results and managing battle participant data
- **Standings_Service**: The backend service responsible for managing competitive standings across all modes (LP, tiers, promotion/demotion, KotH points, streaks)
- **Financial_Service**: The backend service responsible for recording and querying financial transactions (credits earned, spent, and transferred)
- **Leaderboard_Service**: The backend service responsible for computing and serving pre-ranked leaderboard data
- **Migration_System**: The Prisma migration tooling and custom data migration scripts that transform existing data into the new schema
- **ScheduledMatch**: The unified scheduling table that replaces `scheduled_matches`, `scheduled_team_battle_matches`, `scheduled_koth_matches`, `scheduled_koth_match_participants`, and `tournament_matches`. Named simply `scheduled_matches` since it becomes the canonical scheduling table after legacy tables are dropped.
- **MatchType**: A discriminator enum on ScheduledMatch indicating the match format: `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3`
- **MatchParticipant**: A child table of ScheduledMatch storing individual robot or team entries for a given scheduled match
- **Standings**: The unified table holding competitive ranking data for all modes, replacing league columns on `robots` and `team_battles`
- **StandingsMode**: A discriminator on the Standings table: `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3`
- **FinancialLedger**: A new append-only transaction table recording every credit change as a typed event
- **LeaderboardCache**: A materialized table storing pre-computed rankings refreshed at the end of each game cycle
- **Legacy_Columns**: The `robot1Id`, `robot2Id`, ELO columns, and tag-team-specific fields on the Battle model that duplicate data in `battle_participants`
- **Game_Cycle**: The automated daily process that executes all battles, updates standings, and settles economics
- **Dual_Write**: A migration phase where both legacy and new tables are written simultaneously to ensure rollback safety
- **KotH_Points**: A Formula 1-style point system where robots earn points based on their placement in each KotH match (e.g., 1st = 25pts, 2nd = 18pts, etc.), used for KotH standings and tier progression

## Requirements

### Requirement 1: Unified Scheduling Table

**User Story:** As a developer, I want a single scheduling table for all match types, so that querying upcoming matches requires one query instead of four separate fan-out queries.

#### Acceptance Criteria

1. THE Migration_System SHALL create a `scheduled_matches` table with columns: `id`, `matchType` (MatchType enum), `status`, `scheduledFor`, `battleId`, `createdAt`, and match-type-specific nullable metadata fields
2. THE ScheduledMatch model SHALL support all eight MatchType values: `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3`
3. THE ScheduledMatch model SHALL include nullable tournament-specific fields: `tournamentId`, `round`, `matchNumber`, `isByeMatch`
4. THE ScheduledMatch model SHALL include nullable league-specific fields: `leagueType`, `leagueInstanceId`
5. THE ScheduledMatch model SHALL include nullable KotH-specific fields: `rotatingZone`, `scoreThreshold`, `timeLimit`, `zoneRadius`
6. THE ScheduledMatch model SHALL include a `cancelReason` nullable text field for cancelled matches
7. WHEN the Scheduling_Service creates a new scheduled match, THE Scheduling_Service SHALL insert exactly one row into ScheduledMatch regardless of match type
8. WHEN a page queries upcoming matches for a robot, THE Scheduling_Service SHALL return all scheduled matches involving that robot using a single query with a MatchType filter
9. WHEN a page queries upcoming matches for a team, THE Scheduling_Service SHALL return all scheduled matches involving that team using a single query filtered by team-based MatchType values

### Requirement 2: Match Participants for Unified Scheduling

**User Story:** As a developer, I want a participants child table for scheduled matches, so that multi-robot matches (KotH, teams) and 1v1 matches share a consistent participant structure.

#### Acceptance Criteria

1. THE Migration_System SHALL create a `scheduled_match_participants` table with columns: `id`, `scheduledMatchId`, `participantType` (robot or team), `participantId`, `slot` (integer position), `createdAt`
2. WHEN a league_1v1 match is scheduled, THE Scheduling_Service SHALL create exactly two MatchParticipant rows with `participantType` = robot and slots 1 and 2
3. WHEN a KotH match is scheduled, THE Scheduling_Service SHALL create one MatchParticipant row per participating robot, each with `participantType` = robot and sequential slot values
4. WHEN a team-based match (league_2v2, league_3v3, tag_team, tournament_2v2, tournament_3v3) is scheduled, THE Scheduling_Service SHALL create two MatchParticipant rows with `participantType` = team and the respective team IDs
5. WHEN a tournament match has a bye, THE Scheduling_Service SHALL create one MatchParticipant row for the advancing participant and leave the opponent slot empty
6. THE ScheduledMatch model SHALL enforce a unique constraint on (`scheduledMatchId`, `slot`) to prevent duplicate slot assignments

### Requirement 3: Scheduling Data Migration

**User Story:** As a developer, I want all historical scheduled match data migrated to the unified table, so that no data is lost and the legacy tables can be dropped after verification.

#### Acceptance Criteria

1. THE Migration_System SHALL migrate all existing rows from `scheduled_matches` into ScheduledMatch with `matchType` = `league_1v1`
2. THE Migration_System SHALL migrate all existing rows from `scheduled_team_battle_matches` into ScheduledMatch with the appropriate MatchType based on the `matchMode` column value
3. THE Migration_System SHALL migrate all existing rows from `scheduled_koth_matches` into ScheduledMatch with `matchType` = `koth`, and migrate `scheduled_koth_match_participants` into MatchParticipant
4. THE Migration_System SHALL migrate all existing rows from `tournament_matches` into ScheduledMatch with the appropriate MatchType based on the tournament's `participantType` column
5. THE Migration_System SHALL preserve all foreign key relationships (battleId, tournamentId) during migration
6. WHEN the migration completes successfully, THE Migration_System SHALL verify row counts match between source and destination tables before marking migration as complete
7. THE Migration_System SHALL retain the legacy tables in a read-only state for one release cycle after migration to allow rollback

### Requirement 4: Unified Competitive Standings Table

**User Story:** As a developer, I want a single `standings` table that holds competitive ranking data for all modes, so that league/tier/LP logic is implemented once instead of three times across different models.

#### Acceptance Criteria

1. THE Migration_System SHALL create a `standings` table with columns: `id`, `entityType` (robot or team), `entityId`, `mode` (StandingsMode enum), `tier` (bronze/silver/gold/platinum/diamond/champion), `leagueInstanceId`, `leaguePoints`, `cyclesInTier`, `wins`, `losses`, `draws`, `currentWinStreak`, `bestWinStreak`, `currentLoseStreak`, `createdAt`, `updatedAt`
2. THE Standings model SHALL enforce a unique constraint on (`entityType`, `entityId`, `mode`) to prevent duplicate standings entries per entity per mode
3. THE Standings_Service SHALL use a single promotion/demotion algorithm that operates on Standings rows regardless of mode, eliminating the current three separate implementations for 1v1, team league, and tag team
4. WHEN a league battle completes, THE Standings_Service SHALL update the LP, win/loss counters, and streak fields on the corresponding Standings row identified by (`entityType`, `entityId`, `mode`)
5. WHEN a promotion or demotion threshold is reached, THE Standings_Service SHALL update the `tier` and `leagueInstanceId` fields on the Standings row and create a `LeagueHistory` entry
6. THE Standings model SHALL support all eight StandingsMode values: `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3`

### Requirement 5: KotH Point-Based Ranking Integration

**User Story:** As a developer, I want KotH integrated into the unified standings system with a point-based ranking (F1-style), so that KotH has proper competitive structure with tiers and promotion like all other modes.

#### Acceptance Criteria

1. THE Standings model SHALL store KotH standings with `mode` = `koth`, using `leaguePoints` to hold the cumulative KotH points total
2. WHEN a KotH battle completes, THE Standings_Service SHALL award points to each participant based on their placement using the following point scale: 1st = 25, 2nd = 18, 3rd = 15, 4th = 12, 5th = 10, 6th = 8 (for matches with fewer than 6 participants, only the applicable top placements receive points)
3. THE Standings model SHALL include KotH-specific nullable fields: `totalMatches`, `totalKills`, `totalZoneScore`, `totalZoneTime`, `bestPlacement`
4. THE Standings_Service SHALL apply the same relative promotion/demotion logic to KotH standings as other modes: top 10% of instance promoted, bottom 10% demoted, requiring minimum 5 cycles in tier and minimum 6 eligible robots in instance. Cumulative KotH points serve as the ranking metric (equivalent to LP in league modes). There are no absolute point thresholds for promotion.
5. WHEN the KotH Standings page loads, THE Standings_Service SHALL serve rankings from the `standings` table filtered by `mode` = `koth`, ordered by `leaguePoints` descending within each league instance, with tier tabs and instance selectors matching the league standings page structure. KotH SHALL be accessible as a mode tab on `/league-standings?mode=koth`, and the legacy `/koth-standings` route SHALL redirect to it.
6. WHEN a KotH battle completes, THE Battle_Service SHALL award tier-scaled credits, fame, and prestige to each participant based on both their placement AND their current KotH tier, using the same tier multiplier scaling as the 1v1 league (Bronze base → Champion at ~30× base). The base credit reward for 1st place in Bronze KotH SHALL equal the 1v1 league win reward for Bronze (₡7,500), scaled up by placement and tier. Lower placements (4th-6th) SHALL receive enough credits to offset average repair costs at that tier, ensuring KotH participation remains economically viable at all tiers.
7. THE KotH reward calculation SHALL apply the following structure per tier: `tierBaseReward × placementMultiplier`, where placementMultipliers are 1st = 1.0, 2nd = 0.7, 3rd = 0.5, 4th = 0.35, 5th = 0.25, 6th = 0.2. The tierBaseReward follows the same progression as `getLeagueWinReward()`: Bronze = ₡7,500, Silver = ₡15,000, Gold = ₡30,000, Platinum = ₡60,000, Diamond = ₡115,000, Champion = ₡225,000.
8. THE KotH fame and prestige rewards SHALL scale by tier using the same tier multiplier as credits, with base fame (1st = 8, 2nd = 5, 3rd = 3, 4th-6th = 1) and base prestige (1st = 15, 2nd = 8, 3rd = 3, 4th-6th = 0) multiplied by a tier factor: Bronze = 1.0, Silver = 1.5, Gold = 2.0, Platinum = 3.0, Diamond = 4.5, Champion = 7.0.
9. THE zone dominance bonus (+25% to all rewards when winner achieves >75% uncontested zone control) SHALL remain in effect and apply after tier scaling.

### Requirement 6: Standings Data Migration

**User Story:** As a developer, I want all existing league and KotH data migrated from `robots` and `team_battles` into the unified standings table, so that no competitive history is lost.

#### Acceptance Criteria

1. THE Migration_System SHALL create one Standings row per robot with `mode` = `league_1v1`, populating `tier`, `leagueInstanceId`, `leaguePoints`, and `cyclesInTier` from the robot's current league columns
2. THE Migration_System SHALL create one Standings row per TeamBattle with `mode` = `league_2v2` or `league_3v3` (based on `teamSize`), populating from the team's `teamLp`/`teamLeague`/`teamLeagueId`/`cyclesInLeague` columns
3. THE Migration_System SHALL create one Standings row per 2v2 TeamBattle with `mode` = `tag_team`, populating from the team's `tagTeamLp`/`tagTeamLeague`/`tagTeamLeagueId`/`cyclesInTagTeamLeague` columns
4. THE Migration_System SHALL create one Standings row per robot that has `kothMatches` > 0 with `mode` = `koth`, calculating `leaguePoints` as `(kothWins × 25) + ((kothMatches - kothWins) × 12)` (retroactive point approximation: wins assumed 1st place, non-wins assumed average 4th). THE Migration_System SHALL then sort all KotH robots by their retroactive points descending and assign tiers by percentile: top 5% → Diamond, top 5-9% → Platinum, top 9-18% → Gold, top 18-38% → Silver, bottom 62% → Bronze (no Champion on initial seeding — mirrors observed 1v1 league distribution on ACC). Robots within each tier SHALL be distributed across league instances using the standard instance-allocation algorithm (max 8 per instance). Cumulative stats (`totalMatches`, `totalKills`, `totalZoneScore`, `totalZoneTime`, `bestPlacement`) SHALL be carried over from the robot's existing columns.
5. THE Migration_System SHALL populate win/loss/draw counters and streak fields from the corresponding columns on `robots` and `team_battles`
6. WHEN the standings migration completes, THE Migration_System SHALL verify that every active robot has a `league_1v1` entry and every active team has the appropriate mode entries
7. WHEN all standings data is verified, THE Migration_System SHALL drop from `robots`: league columns (`currentLeague`, `leagueId`, `leaguePoints`, `cyclesInCurrentLeague`, `currentWinStreak`, `bestWinStreak`, `currentLoseStreak`), KotH columns (`kothWins`, `kothMatches`, `kothTotalZoneScore`, `kothTotalZoneTime`, `kothKills`, `kothBestPlacement`, `kothCurrentWinStreak`, `kothBestWinStreak`), and per-mode win counters (`totalLeague1v1Wins`, `totalLeague1v1Losses`, `totalLeague1v1Draws`, `totalLeague2v2Wins`, `totalLeague3v3Wins`, `totalTagTeamBattles`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws`, `timesTaggedIn`, `timesTaggedOut`). THE Migration_System SHALL drop from `team_battles`: league columns (`teamLp`, `teamLeague`, `teamLeagueId`, `cyclesInLeague`, `totalLeagueWins`, `totalLeagueLosses`, `totalLeagueDraws`, `tagTeamLp`, `tagTeamLeague`, `tagTeamLeagueId`, `cyclesInTagTeamLeague`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws`)

### Requirement 7: Legacy Battle Column Removal

**User Story:** As a developer, I want the redundant columns removed from the Battle model, so that battle data has a single source of truth in `battle_participants`.

#### Acceptance Criteria

1. THE Migration_System SHALL verify that every existing Battle record has corresponding `battle_participants` rows containing equivalent data for `robot1Id`/`robot2Id`, ELO values, and damage/fame stats before removing legacy columns
2. THE Battle_Service SHALL read participant data exclusively from `battle_participants` using the `team` and `role` columns to identify robot positions
3. THE Migration_System SHALL populate `battle_participants` rows with `role` = `active` or `reserve` for all historical tag-team battles using the legacy `team1ActiveRobotId`, `team1ReserveRobotId`, `team2ActiveRobotId`, `team2ReserveRobotId` column values
4. THE Migration_System SHALL populate `damageDealt` and `fameAwarded` on `battle_participants` for all historical tag-team battles using the legacy per-robot damage/fame columns
5. WHEN all historical data is verified as migrated, THE Migration_System SHALL drop the columns: `robot1Id`, `robot2Id`, `robot1ELOBefore`, `robot2ELOBefore`, `robot1ELOAfter`, `robot2ELOAfter`, `eloChange`, `team1ActiveRobotId`, `team1ReserveRobotId`, `team2ActiveRobotId`, `team2ReserveRobotId`, `team1TagOutTime`, `team2TagOutTime`, `team1ActiveDamageDealt`, `team1ReserveDamageDealt`, `team2ActiveDamageDealt`, `team2ReserveDamageDealt`, `team1ActiveFameAwarded`, `team1ReserveFameAwarded`, `team2ActiveFameAwarded`, `team2ReserveFameAwarded`
6. THE Battle model SHALL retain the `winnerId` column as the canonical winner reference
7. IF data verification fails for any Battle record, THEN THE Migration_System SHALL log the discrepancy and halt the column removal until the discrepancy is resolved

### Requirement 8: Battle Participant Role Enhancement

**User Story:** As a developer, I want the `battle_participants` table to fully describe each robot's role and position in any battle type, so that all battle queries can use a single consistent data source.

#### Acceptance Criteria

1. THE BattleParticipant model SHALL use the `role` column with values: `solo` (1v1/tournament_1v1), `active` (tag team active slot), `reserve` (tag team reserve slot), `team_member` (2v2/3v3 league and tournament), `koth_participant` (KotH)
2. THE BattleParticipant model SHALL include a `tagOutTimeMs` nullable BigInt column for tag-team participants recording the millisecond timestamp of tag-out events
3. WHEN the Battle_Service records a tag-team battle, THE Battle_Service SHALL create four BattleParticipant rows (two with `role` = `active`, two with `role` = `reserve`) with accurate `damageDealt`, `fameAwarded`, and `tagOutTimeMs` values
4. THE BattleParticipant model SHALL maintain the existing `team` column (1 or 2) to indicate team affiliation for all battle types
5. WHEN querying robots involved in a specific battle, THE Battle_Service SHALL use only the `battle_participants` table joined on `robotId` without referencing any legacy Battle columns

### Requirement 9: Financial Ledger Table

**User Story:** As a developer, I want a purpose-built financial ledger table, so that financial reports and economy dashboards can query pre-recorded transactions without recomputing from audit logs and formulas.

#### Acceptance Criteria

1. THE Migration_System SHALL create a `financial_ledger` table with columns: `id`, `cycleNumber`, `userId`, `robotId` (nullable), `transactionType`, `amount` (signed integer, positive = credit, negative = debit), `balanceAfter`, `description`, `metadata` (JSON, nullable), `createdAt`
2. THE Financial_Service SHALL record a ledger entry for every credit-changing event including: battle_income, streaming_revenue, repair_cost, facility_upgrade, weapon_purchase, weapon_sale, weapon_refinement, robot_creation, subscription_cost, prestige_award, attribute_upgrade, and settlement adjustments
3. WHEN a game cycle completes, THE Financial_Service SHALL have recorded one ledger entry per credit-changing event that occurred during that cycle
4. THE Financial_Service SHALL maintain `balanceAfter` as the user's currency balance immediately after the transaction, enabling point-in-time balance reconstruction
5. WHEN the Financial Report page loads, THE Financial_Service SHALL serve pre-aggregated totals from the financial_ledger grouped by `transactionType` and `cycleNumber` without recalculating from formulas
6. THE Migration_System SHALL backfill the financial_ledger from existing `audit_logs` records where `eventType` corresponds to a financial transaction, using the payload JSON to extract amounts and types
7. IF a ledger entry cannot be backfilled due to incomplete audit_log data, THEN THE Migration_System SHALL log the gap and continue processing remaining records

### Requirement 10: Materialized Leaderboard Cache

**User Story:** As a developer, I want a pre-computed leaderboard cache table, so that leaderboard pages serve cached rankings without sorting the entire robots table on every request.

#### Acceptance Criteria

1. THE Migration_System SHALL create a `leaderboard_cache` table with columns: `id`, `category` (varchar: fame, prestige, losses, koth_wins, koth_zone_score, career_wins, team_wins), `rank` (integer), `entityType` (robot or user), `entityId`, `score` (numeric value being ranked), `updatedAt`
2. WHEN a game cycle settlement completes, THE Leaderboard_Service SHALL recompute and replace all rows in the leaderboard_cache for every category
3. WHEN a leaderboard page loads, THE Leaderboard_Service SHALL serve rankings from the leaderboard_cache table using a simple `ORDER BY rank` query with pagination
4. THE Leaderboard_Service SHALL include a `updatedAt` timestamp per row so the frontend can display cache freshness to users
5. THE leaderboard_cache SHALL store the top 200 entries per category to bound table size while covering all realistic display needs
6. WHILE the leaderboard_cache is being refreshed, THE Leaderboard_Service SHALL continue serving the previous cache contents until the new data is fully written (swap semantics using a generation column or table rename)

### Requirement 11: Backward Compatibility During Migration

**User Story:** As a developer, I want the migration deployed atomically in a single release with verification gates, so that the live production system experiences no data loss and can be rolled back if issues arise.

#### Acceptance Criteria

1. THE Migration_System SHALL execute all schema changes and backfills in a single deploy window, requiring that no cron jobs are running during the migration (deploy outside the daily battle window)
2. THE Migration_System SHALL create new tables alongside legacy tables using a temporary name suffix (`_v2`) to avoid naming conflicts during backfill
3. THE Migration_System SHALL run automated verification after backfill (row counts, sample checks, FK integrity) and halt the deploy if verification fails — leaving legacy tables intact
4. WHEN verification passes, THE Migration_System SHALL drop legacy tables and rename `_v2` tables to their final names in a single transaction
5. THE Migration_System SHALL retain a rollback path: if the new code is reverted after deploy but before legacy cleanup, the system can operate on legacy tables that still exist
6. THE Migration_System SHALL include feature flags (`financial_ledger_active`, `leaderboard_cache_active`, `legacy_tables_dropped`) to allow runtime fallback to legacy query paths if issues are discovered post-deploy
7. THE Migration_System SHALL verify that zero rows with `status = 'scheduled'` exist in legacy scheduling tables before proceeding with the drop step (confirming no in-flight matches are lost)

### Requirement 12: Query Performance Preservation

**User Story:** As a developer, I want the unified schema to maintain or improve query performance, so that page load times and cycle processing speed do not regress.

#### Acceptance Criteria

1. THE ScheduledMatch table SHALL include indexes on: (`status`, `scheduledFor`), (`matchType`, `status`), and a composite index on participants for robot-based lookups
2. THE MatchParticipant table SHALL include indexes on: (`participantId`, `participantType`), (`scheduledMatchId`)
3. THE Standings table SHALL include indexes on: (`entityType`, `entityId`, `mode`), (`mode`, `tier`, `leagueInstanceId`), (`mode`, `leaguePoints` DESC)
4. THE financial_ledger table SHALL include indexes on: (`userId`, `cycleNumber`), (`transactionType`, `cycleNumber`), (`robotId`)
5. THE leaderboard_cache table SHALL include indexes on: (`category`, `rank`), (`entityType`, `entityId`)
6. WHEN the Dashboard page queries upcoming matches for a user's robots, THE Scheduling_Service SHALL complete the query within the same or fewer database round-trips compared to the current four-table fan-out approach
7. WHEN the daily game cycle processes battles, THE Battle_Service SHALL complete battle recording without exceeding current processing time per battle (measured as cycle duration regression below 5%)

### Requirement 13: Data Integrity Verification

**User Story:** As a developer, I want automated verification that migrated data matches the source, so that I can confidently drop legacy structures knowing no information was lost.

#### Acceptance Criteria

1. THE Migration_System SHALL produce a verification report comparing row counts between legacy tables and their unified equivalents after each migration phase
2. THE Migration_System SHALL sample-verify at least 5% of migrated records by comparing key fields (IDs, timestamps, foreign keys, status values) between source and destination
3. IF any sampled record has a field mismatch, THEN THE Migration_System SHALL flag the record and prevent progression to the next migration phase
4. THE Migration_System SHALL verify referential integrity of all foreign keys in the new schema (battleId references, tournamentId references, participant IDs) after migration
5. WHEN legacy tables or columns are marked for deletion, THE Migration_System SHALL require explicit admin confirmation via an admin endpoint before executing the drop
