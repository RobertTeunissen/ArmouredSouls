# Requirements Document

## Introduction

Unify the Tag Team system by migrating its data model onto the existing `TeamBattle` table (`teamSize: 2`). A 2v2 team becomes the single entity for both simultaneous 2v2 League combat and sequential Tag Team combat. Creating a 2v2 team automatically grants tag team eligibility — no separate tag team creation, naming, subscription, or management flow exists. The tag team battle ENGINE (sequential 1v1 with tag-out mechanics) is preserved unchanged; what changes is where it reads team composition data from.

This is a data model migration + service rewiring spec. The `TagTeam` Prisma model is deprecated and eventually dropped. All tag team matchmaking, orchestration, league tracking, and UI surface are rewired to use `TeamBattle` (teamSize=2) as the source of truth.

## Glossary

- **TeamBattle**: The Prisma model (`team_battles` table) that stores persistent team compositions for 2v2 and 3v3 modes. Each team has a `teamSize`, `teamName`, league tracking fields, and a `TeamBattleMember` join table for robot assignments.
- **TeamBattleMember**: The join table linking robots to a `TeamBattle` with a `slotIndex` (0-based). For tag team purposes, slot 0 = Active robot and slot 1 = Reserve robot.
- **TagTeam_Legacy**: The deprecated `TagTeam` Prisma model (`tag_teams` table) with fixed `activeRobotId`/`reserveRobotId` columns. Data is migrated to `TeamBattle` and the table is dropped.
- **Tag_Team_Battle_Orchestrator**: The service (`tagTeamBattleOrchestrator.ts`) that executes sequential 1v1 tag team combat. Its combat logic is preserved; its data loading is rewired to read from `TeamBattle`.
- **Tag_Team_Matchmaking_Service**: The service (`tagTeamMatchmakingService.ts`) that pairs 2v2 teams for tag team battles. Rewired to query `TeamBattle` (teamSize=2) instead of `TagTeam`.
- **Tag_Team_League_Service**: The services handling tag team league rebalancing, instance management, and LP tracking. Rewired to operate on `TeamBattle` fields.
- **Tag_Team_LP**: A separate League Points track (`tagTeamLp`) stored on the `TeamBattle` model, used for tag team league promotion/demotion independently from the 2v2 League LP (`teamLp`).
- **Active_Robot**: The robot at `slotIndex: 0` in a 2v2 `TeamBattle` — starts the tag team match.
- **Reserve_Robot**: The robot at `slotIndex: 1` in a 2v2 `TeamBattle` — tags in when the active robot yields or is destroyed.
- **Data_Migration**: A Prisma migration that adds `tagTeamLp` and tag team stats fields to `TeamBattle`, migrates existing `TagTeam` rows into `TeamBattle` rows, and eventually drops the `tag_teams` table.
- **Tag_Team_Scheduled_Match**: The `ScheduledTagTeamMatch` model, which is migrated to use `ScheduledTeamBattleMatch` with a discriminator or mode field.
- **Team_Battles_Page**: The frontend page (`TeamBattlesPage.tsx`) that manages all team modes through tabs.
- **TeamBattle_Management_UI**: The frontend component (`TeamBattleManagementContent`) that renders 2v2 team cards with management actions.

## Expected Contribution

This spec addresses the architectural split between two models (`TagTeam` and `TeamBattle`) that represent the same logical concept: a 2-robot team. The duplication causes maintenance burden, player confusion (separate creation flows, separate tabs, separate naming), and prevents feature sharing between modes.

1. **Data model consolidation**: Before, tag teams live in a separate `tag_teams` table with fixed columns (`activeRobotId`/`reserveRobotId`). After, all 2-robot teams live in `team_battles` with the flexible `TeamBattleMember` join table — one table, one set of CRUD operations, one set of indexes.
2. **Frontend component elimination**: Before, `TagTeamManagementContent` is a wholly separate component (~400 lines) with its own card layout, creation flow, and API calls. After, it is removed entirely — the existing `TeamBattleManagementContent` (teamSize=2) handles everything, with tag team stats displayed inline.
3. **API surface reduction**: Before, `/api/tag-teams` has 6 endpoints duplicating logic from `/api/team-battles`. After, the `/api/tag-teams` route file is removed — team battles endpoints serve both modes.
4. **Per-mode eligibility on unified entity**: Before, tag team eligibility is implicit (just subscription + readiness check at matchmaking time, no UI feedback). After, 2v2 team cards show per-mode eligibility badges for `league_2v2`, `tag_team`, and `tournament_2v2` — the same pattern already used for 2v2/3v3.
5. **Player UX streamlined**: Before, players manage tag teams in a separate tab with a separate creation flow, separate naming, and no swap/rename/eligibility features. After, the 2v2 team management handles everything — one team entity, multiple combat modes, full CRUD.
6. **Shared infrastructure**: Before, tag team league rebalancing, matchmaking, and battle scheduling each have their own adapter layer querying `TagTeam`. After, they share the `TeamBattle` adapter pattern already proven for 2v2/3v3 League.

### Verification Criteria

1. `grep -r "model TagTeam" app/backend/prisma/schema.prisma` returns zero matches (model removed).
2. `grep -r "tag_team" app/backend/src/services/subscription/eventRegistry.ts` returns a match (event type preserved).
3. `ls app/frontend/src/components/team-battles/TagTeamManagementContent.tsx 2>&1 | grep "No such file"` confirms component is deleted.
4. `ls app/backend/src/routes/tagTeams.ts 2>&1 | grep "No such file"` confirms route file is deleted.
5. `grep -r "tagTeamLp" app/backend/prisma/schema.prisma` returns a match on the `TeamBattle` model.
6. `grep -r "TeamBattle" app/backend/src/services/tag-team/tagTeamMatchmakingService.ts` confirms matchmaking queries `TeamBattle`.
7. `grep -r "TeamBattle" app/backend/src/services/tag-team/tagTeamBattleOrchestrator.ts` confirms orchestrator loads from `TeamBattle`.
8. Running `npm test` in both `app/backend` and `app/frontend` passes with no regressions.
9. `grep -r "tag-team" app/frontend/src/pages/TeamBattlesPage.tsx` returns zero matches for a separate tag-team tab.

## Requirements

### Requirement 1: Schema Extension — Tag Team Fields on TeamBattle

**User Story:** As a developer, I want tag team league tracking fields on the `TeamBattle` model, so that 2v2 teams can participate in tag team leagues without a separate table.

#### Acceptance Criteria

1. THE Data_Migration SHALL add a non-nullable `tagTeamLp` column (INTEGER, default 0) to the `team_battles` table for teams with `teamSize = 2`.
2. THE Data_Migration SHALL add a `tagTeamLeague` column (VARCHAR 20, default `'bronze'`) to the `team_battles` table.
3. THE Data_Migration SHALL add a `tagTeamLeagueId` column (VARCHAR 30, default `'bronze_1'`) to the `team_battles` table.
4. THE Data_Migration SHALL add a `cyclesInTagTeamLeague` column (INTEGER, default 0) to the `team_battles` table.
5. THE Data_Migration SHALL add `totalTagTeamWins` (INTEGER, default 0), `totalTagTeamLosses` (INTEGER, default 0), and `totalTagTeamDraws` (INTEGER, default 0) columns to the `team_battles` table.
6. THE Data_Migration SHALL rename the existing `totalWins`, `totalLosses`, and `totalDraws` columns on the `team_battles` table to `totalLeagueWins`, `totalLeagueLosses`, and `totalLeagueDraws` to clearly indicate they track league mode (2v2 League or 3v3 League) results.
7. THE Data_Migration SHALL add a composite index on `[teamSize, tagTeamLeague, tagTeamLeagueId]` to support tag team matchmaking queries.
8. THE Data_Migration SHALL execute all schema additions within a single database transaction, rolling back all changes if any step fails.

### Requirement 2: Data Migration — TagTeam Rows to TeamBattle

**User Story:** As a developer, I want existing `TagTeam` rows migrated into `TeamBattle` rows, so that historical tag team data (LP, wins, losses, league tier) is preserved.

#### Acceptance Criteria

1. THE Data_Migration SHALL create one `TeamBattle` row for each existing `TagTeam` row, setting `teamSize = 2`, `stableId` from the `TagTeam.stableId`, and `teamName` generated from the pattern `"{ActiveRobotName} & {ReserveRobotName}"` (truncated to 32 characters with `"..."` suffix if exceeded).
2. THE Data_Migration SHALL create two `TeamBattleMember` rows per migrated team: `slotIndex = 0` for `TagTeam.activeRobotId` (Active) and `slotIndex = 1` for `TagTeam.reserveRobotId` (Reserve).
3. THE Data_Migration SHALL copy `tagTeamLeaguePoints` to `tagTeamLp`, `tagTeamLeague` to `tagTeamLeague`, `tagTeamLeagueId` to `tagTeamLeagueId`, and `cyclesInTagTeamLeague` to `cyclesInTagTeamLeague` on the new `TeamBattle` row.
4. THE Data_Migration SHALL copy `totalTagTeamWins`, `totalTagTeamLosses`, and `totalTagTeamDraws` to the corresponding columns on the new `TeamBattle` row.
5. THE Data_Migration SHALL set `teamLp = 0`, `teamLeague = 'bronze'`, `teamLeagueId` to an assigned bronze instance, `cyclesInLeague = 0`, `totalLeagueWins = 0`, `totalLeagueLosses = 0`, `totalLeagueDraws = 0` for the 2v2 League fields on migrated teams (they have no 2v2 League history).
6. IF a `TagTeam` references a `robotId` that is already a member of an existing `TeamBattle` with `teamSize = 2`, THEN THE Data_Migration SHALL skip that `TagTeam` row, log a conflict warning, and continue processing remaining rows.
7. IF a referenced robot's name is NULL or empty, THEN THE Data_Migration SHALL substitute the literal string `"Robot"` in that position before applying the name pattern.
8. THE Data_Migration SHALL be idempotent: IF a `TeamBattle` row with matching `stableId` and member robot IDs already exists, THEN THE Data_Migration SHALL skip creation for that team.
9. THE Data_Migration SHALL execute within a single database transaction, rolling back all changes if any step fails.
10. WHEN migration completes successfully, THE Data_Migration SHALL log a summary including: total `TagTeam` rows processed, rows migrated successfully, rows skipped due to conflicts, and rows skipped due to idempotency.

### Requirement 3: Tag Team Matchmaking Rewired to TeamBattle

**User Story:** As a developer, I want the tag team matchmaking service to query `TeamBattle` (teamSize=2) instead of `TagTeam`, so that matchmaking uses the unified data model.

#### Acceptance Criteria

1. WHEN tag team matchmaking runs, THE Tag_Team_Matchmaking_Service SHALL query `TeamBattle` rows where `teamSize = 2` and `tagTeamLeague` matches the target tier, instead of querying the `TagTeam` table.
2. WHEN determining team eligibility for tag team matchmaking, THE Tag_Team_Matchmaking_Service SHALL load the team's `TeamBattleMember` rows (slot 0 = Active, slot 1 = Reserve) and verify both robots meet scheduling readiness (weapons equipped).
3. WHEN computing match scores for tag team pairing, THE Tag_Team_Matchmaking_Service SHALL use the same shared `calculateMatchScore` formula from `teamMatchmakingUtils.ts` that 2v2 and 3v3 use, passing `tagTeamLp` as the LP input and the combined ELO (sum of both member robot ELOs) as the ELO input.
4. WHEN checking for already-scheduled matches, THE Tag_Team_Matchmaking_Service SHALL query `ScheduledTeamBattleMatch` where `matchMode = 'tag_team'` and the `TeamBattle.id` is referenced as `team1` or `team2`.
5. THE Tag_Team_Matchmaking_Service SHALL use advisory lock namespace 1 for tag team matchmaking operations to prevent race conditions with concurrent tag team mutations.
6. WHEN a team has fewer than 2 members in `TeamBattleMember`, THE Tag_Team_Matchmaking_Service SHALL exclude that team from tag team matchmaking.

### Requirement 4: Tag Team Battle Orchestrator Rewired to TeamBattle

**User Story:** As a developer, I want the tag team battle orchestrator to load team compositions from `TeamBattle` members instead of `TagTeam.activeRobotId/reserveRobotId`, so that battles execute against the unified data model.

#### Acceptance Criteria

1. WHEN loading teams for a tag team battle, THE Tag_Team_Battle_Orchestrator SHALL query `TeamBattle` with included `TeamBattleMember` rows, mapping `slotIndex = 0` to the Active robot and `slotIndex = 1` to the Reserve robot.
2. THE Tag_Team_Battle_Orchestrator SHALL preserve the existing sequential 1v1 combat logic: Active robots fight first, tag-out occurs on yield or destruction, Reserve robot tags in with full remaining HP.
3. WHEN updating post-battle stats, THE Tag_Team_Battle_Orchestrator SHALL increment `totalTagTeamWins`, `totalTagTeamLosses`, or `totalTagTeamDraws` on the `TeamBattle` row (not `totalLeagueWins`/`totalLeagueLosses`/`totalLeagueDraws` which track 2v2/3v3 League results).
4. WHEN awarding LP after a tag team battle, THE Tag_Team_Battle_Orchestrator SHALL update `tagTeamLp` on the `TeamBattle` row (not `teamLp`).
5. THE Tag_Team_Battle_Orchestrator SHALL preserve the existing reward multipliers: 2× credit multiplier and 1.6× prestige multiplier for tag team battles.
6. THE Tag_Team_Battle_Orchestrator SHALL use the team's `teamName` field for battle narrative generation (team display names in combat log).
7. WHEN repairing robots after a tag team battle, THE Tag_Team_Battle_Orchestrator SHALL continue to use the existing repair logic unchanged.

### Requirement 5: Tag Team League Infrastructure Rewired to TeamBattle

**User Story:** As a developer, I want tag team league rebalancing and instance management to operate on `TeamBattle` fields, so that promotion/demotion cycles use the unified model.

#### Acceptance Criteria

1. THE Tag_Team_League_Service SHALL query `TeamBattle` rows where `teamSize = 2` for all league operations (rebalancing, promotion, demotion, instance assignment) instead of querying the `TagTeam` table.
2. WHEN promoting a team, THE Tag_Team_League_Service SHALL update `tagTeamLeague` and `tagTeamLeagueId` on the `TeamBattle` row and reset `cyclesInTagTeamLeague` to 0.
3. WHEN demoting a team, THE Tag_Team_League_Service SHALL update `tagTeamLeague` and `tagTeamLeagueId` on the `TeamBattle` row and reset `cyclesInTagTeamLeague` to 0.
4. WHEN incrementing cycle counters, THE Tag_Team_League_Service SHALL increment `cyclesInTagTeamLeague` on `TeamBattle` rows where `teamSize = 2`.
5. THE Tag_Team_League_Service SHALL preserve the existing tier structure (bronze, silver, gold, platinum, diamond, champion), instance sizing (50 max per instance), and rebalancing thresholds (minimum 10 teams, minimum 5 cycles).
6. THE Tag_Team_League_Service SHALL use LP from the `tagTeamLp` field for promotion threshold checks and demotion ranking.

### Requirement 6: Subscription Model — Tag Team Remains a Separate Subscription

**User Story:** As a player, I want to control which modes my 2v2 team participates in by subscribing my robots to specific events, so that I can choose my competitive focus.

#### Acceptance Criteria

1. THE `tag_team` subscription event type SHALL remain registered in the event registry — it is NOT removed.
2. WHEN determining tag team matchmaking eligibility for a 2v2 team, THE Tag_Team_Matchmaking_Service SHALL verify that both member robots hold active `tag_team` subscriptions.
3. WHEN determining 2v2 League matchmaking eligibility for a 2v2 team, THE TeamBattle_Matchmaking_Service SHALL verify that both member robots hold active `league_2v2` subscriptions (existing behavior preserved).
4. A 2v2 team's eligibility for each mode SHALL be computed independently: a team can be eligible for Tag Team but ineligible for 2v2 League (or vice versa) depending on member subscriptions.
5. THE TeamBattle_Management_UI SHALL display per-mode eligibility badges showing subscription status for each mode (`league_2v2`, `tag_team`, `tournament_2v2`), indicating which members are subscribed and which are not — using the same pattern as the existing Mode Eligibility Badges on 2v2/3v3 team cards.
6. THE Data_Migration SHALL preserve existing `tag_team` subscription rows unchanged — robots that were previously subscribed to `tag_team` via the old TagTeam system retain their subscriptions.

### Requirement 7: Scheduled Match Migration

**User Story:** As a developer, I want tag team scheduled matches to use the same scheduling infrastructure as 2v2 League, so that match scheduling is unified.

#### Acceptance Criteria

1. THE Data_Migration SHALL add a non-nullable `matchMode` column (VARCHAR 20, no default) to the `scheduled_team_battle_matches` table to discriminate combat mode. Valid values: `'league_2v2'`, `'league_3v3'`, `'tag_team'`, `'tournament_2v2'`, `'tournament_3v3'`.
2. THE Data_Migration SHALL migrate existing `ScheduledTagTeamMatch` rows into `ScheduledTeamBattleMatch` rows, mapping `team1Id` and `team2Id` to the corresponding migrated `TeamBattle.id` values, setting `matchMode = 'tag_team'`, `teamSize = 2`, and preserving `scheduledFor` and `status`.
3. WHEN scheduling new tag team matches, THE Tag_Team_Matchmaking_Service SHALL create `ScheduledTeamBattleMatch` rows with `matchMode = 'tag_team'` and `teamSize = 2`.
4. WHEN checking lock-for-battle status for tag team operations, THE Tag_Team_Matchmaking_Service SHALL query `ScheduledTeamBattleMatch` where `matchMode = 'tag_team'` and the team is referenced as `team1` or `team2`.
5. WHEN the tag team battle orchestrator picks up matches to execute, THE Tag_Team_Battle_Orchestrator SHALL query `ScheduledTeamBattleMatch` where `matchMode = 'tag_team'` and `status = 'scheduled'`.
6. THE Data_Migration SHALL backfill existing `ScheduledTeamBattleMatch` rows with `matchMode` based on their `teamSize`: `'league_2v2'` for `teamSize = 2` and `'league_3v3'` for `teamSize = 3`.

### Requirement 8: Frontend — Remove Tag Team Tab and Integrate into 2v2

**User Story:** As a player, I want to manage my tag team through the 2v2 team management interface, so that I have one place for all 2-robot team operations.

#### Acceptance Criteria

1. THE Team_Battles_Page SHALL remove the "Tag Team" tab from the tab bar, leaving only "2v2 Teams" and "3v3 Teams" tabs.
2. THE TeamBattle_Management_UI SHALL display tag team stats (tag team LP, tag team league tier, tag team wins/losses/draws) on each 2v2 team card alongside the existing 2v2 League stats.
3. THE TeamBattle_Management_UI SHALL display slot role labels on 2v2 team member cards: "Active (Tag Team)" for slot 0 and "Reserve (Tag Team)" for slot 1, indicating their tag team combat roles.
4. THE TeamBattle_Management_UI SHALL display a "Tag Team Eligible" badge on 2v2 team cards when the team's eligibility is ELIGIBLE, indicating automatic participation in tag team matchmaking.
5. WHEN a 2v2 team is ineligible for a specific mode, THE TeamBattle_Management_UI SHALL display the ineligibility reason per mode (e.g., "Tag Team: Robot X not subscribed", "2v2 League: all subscribed ✅"), matching the existing Mode Eligibility Badge pattern.
6. THE Team_Battles_Page SHALL set the default tab to "2v2 Teams" (removing the tag-team default).
7. THE TeamBattle_Management_UI SHALL be responsive on viewports from 320px to 1024px+, displaying tag team stats in a stacked layout on mobile (below 1024px) without horizontal overflow, with all interactive elements having touch targets of at least 44px.

### Requirement 9: Frontend — Tag Team Standings via Team Battle Standings

**User Story:** As a player, I want to view tag team league standings through the same interface as 2v2 League standings, so that league browsing is unified.

#### Acceptance Criteria

1. THE TeamBattle_Management_UI SHALL provide a standings view that supports both 2v2 League standings (sorted by `teamLp`) and Tag Team standings (sorted by `tagTeamLp`) as selectable modes.
2. WHEN "Tag Team" standings mode is selected, THE TeamBattle_Management_UI SHALL display tag team LP, tag team league tier, tag team wins/losses/draws, and combined ELO for each team.
3. THE TeamBattle_Management_UI SHALL support instance selection within tag team standings tiers (same pattern as 2v2 League instance selector).
4. IF a tier contains more than one tag team league instance, THEN THE TeamBattle_Management_UI SHALL display an instance selector dropdown above the standings table.
5. IF a tier contains exactly one tag team league instance, THEN THE TeamBattle_Management_UI SHALL hide the instance selector and display standings directly.

### Requirement 10: API — Tag Team Standings Endpoint on Team Battles

**User Story:** As a developer, I want tag team standings served from the team battles API, so that the frontend uses one API surface for all 2-robot team data.

#### Acceptance Criteria

1. THE Team_Battle_API SHALL expose `GET /api/team-battles/leagues/2/:tier/tag-team-standings` that returns tag team standings for 2v2 teams in the specified tier, sorted by `tagTeamLp` descending.
2. THE Team_Battle_API SHALL accept an optional `instance` query parameter to filter by `tagTeamLeagueId`.
3. THE Team_Battle_API SHALL return standings entries including: rank, teamId, teamName, stableId, stableName, tagTeamLp, tagTeamLeague, tagTeamLeagueId, totalTagTeamWins, totalTagTeamLosses, totalTagTeamDraws, combinedELO (sum of member robot ELOs), and member robot details (id, name, elo, slotIndex).
4. THE Team_Battle_API SHALL support pagination with `page` and `perPage` query parameters (default page=1, perPage=50, max perPage=100).
5. IF the `instance` query parameter does not match any existing `tagTeamLeagueId` within the tier, THEN THE Team_Battle_API SHALL return an empty standings array with zero total count.

### Requirement 11: API — Tag Team League Instances Endpoint

**User Story:** As a developer, I want a tag team league instances endpoint on the team battles API, so that the frontend can render instance selectors for tag team standings.

#### Acceptance Criteria

1. THE Team_Battle_API SHALL expose `GET /api/team-battles/leagues/2/:tier/tag-team-instances` that returns an array of tag team league instances for the given tier.
2. WHEN querying instances, THE Team_Battle_API SHALL group `TeamBattle` rows by `tagTeamLeagueId` where `teamSize = 2` and `tagTeamLeague` matches the requested tier.
3. THE Team_Battle_API SHALL return each instance with: `leagueId` (the `tagTeamLeagueId`), `leagueTier`, `currentTeams` (count of teams in that instance), and `maxTeams` (50).

### Requirement 12: Legacy Cleanup — Drop TagTeam Model and Routes

**User Story:** As a developer, I want the legacy `TagTeam` table and associated routes removed after migration, so that the codebase has no dead code or duplicate models.

#### Acceptance Criteria

1. WHEN all data has been verified as successfully migrated, THE Data_Migration SHALL drop the `tag_teams` table and the `tag_team_matches` table from the database.
2. THE Tag_Team_API route file (`app/backend/src/routes/tagTeams.ts`) SHALL be deleted.
3. THE TagTeam Prisma model and ScheduledTagTeamMatch Prisma model SHALL be removed from `schema.prisma`.
4. THE frontend `TagTeamManagementContent` component SHALL be deleted.
5. THE Team_Battles_Page SHALL remove the import of `TagTeamManagementContent` and all references to the `tag-team` tab identifier.
6. THE `tag_team` entry SHALL remain in the `SubscribableEventType` type union in the event registry, but its `lockingPredicate` SHALL be updated to check `ScheduledTeamBattleMatch` (where `matchMode = 'tag_team'`) instead of `ScheduledTagTeamMatch`.
7. IF any achievement definitions reference tag team stats columns on the old `TagTeam` model, THEN THE Data_Migration SHALL update those references to point to the corresponding columns on `TeamBattle`.

### Requirement 13: Tag Team League History Preservation

**User Story:** As a player, I want my tag team league history (promotions, demotions) preserved after migration, so that my competitive record is not lost.

#### Acceptance Criteria

1. THE Data_Migration SHALL migrate existing `LeagueHistory` entries with `entityType = 'tag_team'` to reference the new `TeamBattle.id` for the corresponding migrated team.
2. WHEN recording new tag team league history events (promotion/demotion), THE Tag_Team_League_Service SHALL use `entityType = 'tag_team'` and the `TeamBattle.id` as the entity identifier.
3. THE Team_Battle_API SHALL expose tag team league history for a given team at `GET /api/team-battles/:id/tag-team-league-history` that returns history entries where `entityType = 'tag_team'`.

### Requirement 14: Admin League Health Monitoring for Tag Team

**User Story:** As an admin, I want to monitor tag team league health on the same `/admin/league-health` page as 1v1, 2v2, and 3v3 leagues, so that all league modes are visible in one dashboard.

#### Acceptance Criteria

1. THE Team_Battle_API SHALL expose `GET /api/admin/tag-team-league-health` that returns per-tier tag team league health metrics: tier name, total teams, number of instances, teams per instance (min/max/avg), teams needing rebalancing, and whether the tier needs attention.
2. THE Admin League Health Page SHALL fetch tag team league health data alongside the existing 1v1 and 2v2/3v3 league health data on page load.
3. THE Admin League Health Page SHALL display a "Tag Team League Tiers" section below the existing 2v2 and 3v3 sections, using the same table format (tier, teams, instances, distribution, rebalancing status).
4. IF a tag team league tier has `needsRebalancing: true`, THEN THE Admin League Health Page SHALL display a yellow warning indicator on that tier row (same pattern as 2v2/3v3 rebalancing warnings).
5. THE `getTagTeamLeagueHealth` service function SHALL query `TeamBattle` rows where `teamSize = 2`, grouping by `tagTeamLeague` and `tagTeamLeagueId` to compute per-tier statistics.
6. THE Admin League Health Page SHALL be responsive on viewports from 320px to 1024px+, displaying the tag team section in stacked layout on mobile without horizontal overflow.

### Requirement 15: Preserved Tag Team Combat Invariants

**User Story:** As a developer, I want to ensure that tag team combat mechanics remain unchanged, so that gameplay is unaffected by the data model migration.

#### Acceptance Criteria

1. THE Tag_Team_Battle_Orchestrator SHALL preserve the sequential 1v1 combat flow: Active robots fight first, tag-out triggers on yield (HP below threshold) or destruction (HP = 0), Reserve robot enters with its current HP.
2. THE Tag_Team_Battle_Orchestrator SHALL preserve the 5-minute time limit per battle.
3. THE Tag_Team_Battle_Orchestrator SHALL preserve the reward structure: 2× credit multiplier (`TAG_TEAM_REWARD_MULTIPLIER = 2`) and 1.6× prestige multiplier (`TAG_TEAM_PRESTIGE_MULTIPLIER = 1.6`).
4. THE Tag_Team_Battle_Orchestrator SHALL preserve ELO calculations using the combined team ELO (sum of Active + Reserve robot ELOs).
5. THE Tag_Team_Battle_Orchestrator SHALL preserve battle log generation with tag-out/tag-in events, phase metadata, and per-robot damage/survival statistics.
6. THE Tag_Team_Matchmaking_Service SHALL preserve LP-primary scoring for match pairing quality.
7. THE Tag_Team_League_Service SHALL preserve the 6-tier structure (bronze through champion), promotion of top 10% with minimum 5 cycles, and demotion of bottom 10%.

