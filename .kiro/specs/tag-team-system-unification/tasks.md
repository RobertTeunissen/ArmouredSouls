# Implementation Plan: Tag Team System Unification

## Overview

Consolidate the `TagTeam` Prisma model into the existing `TeamBattle` model (teamSize=2), eliminating duplicate services, routes, and frontend components. The implementation proceeds in strict phases: schema extension → data migration → service rewiring (parallel) → frontend changes → legacy cleanup → documentation & verification.

## Tasks

- [x] 1. Schema Extension and Data Migration
  - [x] 1.1 Create Prisma migration: add tag team fields to TeamBattle
    - Add `tagTeamLp` (Int, default 0), `tagTeamLeague` (VarChar(20), default 'bronze'), `tagTeamLeagueId` (VarChar(30), default 'bronze_1'), `cyclesInTagTeamLeague` (Int, default 0)
    - Add `totalTagTeamWins` (Int, default 0), `totalTagTeamLosses` (Int, default 0), `totalTagTeamDraws` (Int, default 0)
    - Rename `totalWins` → `totalLeagueWins`, `totalLosses` → `totalLeagueLosses`, `totalDraws` → `totalLeagueDraws`
    - Add composite index on `[teamSize, tagTeamLeague, tagTeamLeagueId]`
    - All changes in a single transaction (Prisma migration default)
    - Run `npx prisma generate` to regenerate client
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 1.2 Create Prisma migration: add matchMode to ScheduledTeamBattleMatch
    - Add `matchMode` column (VarChar(20)) as nullable initially
    - Backfill existing rows: `teamSize = 2` → `'league_2v2'`, `teamSize = 3` → `'league_3v3'`
    - Set column to NOT NULL after backfill
    - Add index on `[status, matchMode]`
    - Update Prisma schema model for `ScheduledTeamBattleMatch`
    - _Requirements: 7.1, 7.6_

  - [x] 1.3 Update Prisma schema model definitions
    - Update `TeamBattle` model with all new fields, renamed fields, and new index
    - Update `ScheduledTeamBattleMatch` model with `matchMode` field
    - Verify schema compiles with `npx prisma validate`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 7.1_

  - [x] 1.4 Implement data migration script for TagTeam → TeamBattle
    - Create migration script in `app/backend/prisma/migrations/` or as a standalone seed/migration script
    - For each `TagTeam` row: create `TeamBattle` (teamSize=2) with `stableId`, `teamName` from `"{ActiveRobotName} & {ReserveRobotName}"` (truncated to 32 chars with `"..."` suffix)
    - Create two `TeamBattleMember` rows: slot 0 = activeRobotId, slot 1 = reserveRobotId
    - Copy `tagTeamLeaguePoints` → `tagTeamLp`, `tagTeamLeague`, `tagTeamLeagueId`, `cyclesInTagTeamLeague`
    - Copy `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws`
    - Set 2v2 League fields to defaults (teamLp=0, teamLeague='bronze', etc.)
    - Skip rows where robot already on a teamSize=2 TeamBattle (log conflict warning)
    - Substitute `"Robot"` for NULL/empty robot names
    - Idempotency: skip if TeamBattle with matching stableId + member robots exists
    - Execute in single transaction, log summary on completion
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 6.6_

  - [x] 1.5 Implement scheduled match migration (ScheduledTagTeamMatch → ScheduledTeamBattleMatch)
    - Migrate existing `ScheduledTagTeamMatch` rows into `ScheduledTeamBattleMatch`
    - Map `team1Id`/`team2Id` to new `TeamBattle.id` values using ID mapping from 1.4
    - Set `matchMode = 'tag_team'`, `teamSize = 2`, preserve `scheduledFor` and `status`
    - _Requirements: 7.2_

  - [x] 1.6 Implement LeagueHistory migration
    - Update `LeagueHistory` entries where `entityType = 'tag_team'` to reference new `TeamBattle.id`
    - Use ID mapping from 1.4
    - _Requirements: 13.1_

  - [x] 1.7 Write property tests for data migration (Properties 1–3, 9, 11)
    - **Property 1: Migration Data Preservation** — Generate random TagTeam inputs, verify correct TeamBattle output with all fields mapped
    - **Validates: Requirements 1.6, 2.1, 2.2, 2.3, 2.4, 2.5**
    - **Property 2: Migration Conflict Handling** — Generate inputs with robot conflicts, verify correct skip behavior and migrated count
    - **Validates: Requirements 2.6**
    - **Property 3: Migration Idempotency** — Run migration twice, verify no duplicate rows or field changes
    - **Validates: Requirements 2.8**
    - **Property 9: Scheduled Match Migration Correctness** — Verify matchMode backfill and team ID remapping
    - **Validates: Requirements 7.2, 7.6**
    - **Property 11: League History EntityId Integrity** — Verify entityId remapping for tag_team history entries
    - **Validates: Requirements 13.1, 13.2**
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 7.2, 7.6, 13.1, 13.2_

  - [x] 1.8 Update existing services, routes, and frontend for column rename
    - Update `teamBattleOrchestrator.ts` — change `totalWins`/`totalLosses`/`totalDraws` references to `totalLeagueWins`/`totalLeagueLosses`/`totalLeagueDraws`
    - Update `teamBattleMatchmakingService.ts` — update bye-team creation and any stat references
    - Update `teamBattleService.ts` — update team creation defaults and eligibility logic
    - Update `stableViewService.ts` (or similar) — update select/read of team stats
    - Update `app/backend/src/routes/teamBattles.ts` — update standings response field access
    - Update `app/frontend/src/utils/teamBattleApi.ts` — update TypeScript interface field names
    - Update `TeamBattleManagementContent.tsx` and `TeamBattleCard` — update field references in UI
    - Update test fixtures in affected test files that reference the old column names
    - Run `npx prisma generate` and verify full compilation (`npx tsc --noEmit`)
    - _Requirements: 1.6_

- [x] 2. Checkpoint — Schema and migration verified
  - Ensure all migration tests pass, ask the user if questions arise.

- [x] 3. Tag Team League Adapter
  - [x] 3.1 Implement tagTeamLeagueAdapter in teamBattleAdapter.ts
    - Create adapter using the existing `createTeamBattleAdapter` factory pattern
    - Remap fields: `tagTeamLp` for LP, `tagTeamLeague` for tier, `tagTeamLeagueId` for instance, `cyclesInTagTeamLeague` for cycle counter
    - Set `entityType = 'tag_team'`
    - Filter queries by `teamSize = 2`
    - Export alongside existing `teamBattle2v2Adapter` and `teamBattle3v3Adapter`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 3.2 Write property test for tag team league adapter (Property 7)
    - **Property 7: Tag Team League Promotion/Demotion Field Isolation** — Verify promote/demote updates `tagTeamLeague`/`tagTeamLeagueId`/`cyclesInTagTeamLeague` without affecting `teamLeague`/`teamLeagueId`/`cyclesInLeague`
    - **Validates: Requirements 5.2, 5.3, 5.4**
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 4. Tag Team Matchmaking Service Rewiring
  - [x] 4.1 Rewire tagTeamMatchmakingService to query TeamBattle
    - Change `getEligibleTeams()` to query `TeamBattle` where `teamSize = 2` + `tagTeamLeague` + `tagTeamLeagueId`
    - Load `TeamBattleMember` with robots (slot 0 = active, slot 1 = reserve)
    - Verify both members have active `tag_team` subscriptions
    - Exclude teams with fewer than 2 members
    - Use `calculateMatchScore` with `tagTeamLp` as LP input and combined ELO
    - Check `ScheduledTeamBattleMatch` where `matchMode = 'tag_team'` for already-scheduled teams
    - Create `ScheduledTeamBattleMatch` rows with `matchMode = 'tag_team'`, `teamSize = 2`
    - Preserve advisory lock namespace 1
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.2, 6.4, 7.3, 7.4, 15.6_

  - [x] 4.2 Write property tests for matchmaking eligibility (Properties 6, 8)
    - **Property 6: Tag Team Eligibility Independence** — Generate random subscription combinations, verify per-mode eligibility depends only on corresponding subscription
    - **Validates: Requirements 3.2, 3.6, 6.2, 6.4**
    - **Property 8: Match Mode Discrimination** — Verify new scheduled matches have `matchMode = 'tag_team'` and `teamSize = 2`; verify lock queries only consider `matchMode = 'tag_team'`
    - **Validates: Requirements 7.3, 7.4, 12.6**
    - _Requirements: 3.2, 3.6, 6.2, 6.4, 7.3, 7.4, 12.6_

  - [x] 4.3 Write property test for LP isolation (Property 4)
    - **Property 4: Tag Team LP Isolation** — Verify tag team LP operations read/write `tagTeamLp` exclusively, leaving `teamLp` unchanged; and vice versa
    - **Validates: Requirements 3.3, 4.4, 5.6**
    - _Requirements: 3.3, 4.4, 5.6_

- [x] 5. Tag Team Battle Orchestrator Rewiring
  - [x] 5.1 Rewire tagTeamBattleOrchestrator to load from TeamBattle
    - Load teams via `TeamBattle` with `members` include (replaces `TagTeam` with `activeRobot`/`reserveRobot`)
    - Map `slotIndex = 0` → Active robot, `slotIndex = 1` → Reserve robot
    - Pick up matches from `ScheduledTeamBattleMatch` where `matchMode = 'tag_team'` and `status = 'scheduled'`
    - Use `team.teamName` for battle narrative generation
    - Preserve sequential 1v1 combat logic, tag-out mechanics, 5-minute time limit
    - Preserve reward multipliers: 2× credits, 1.6× prestige
    - Preserve ELO calculations using combined team ELO
    - Preserve battle log generation with tag-out/tag-in events
    - Preserve existing repair logic unchanged
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7, 7.5, 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 5.2 Rewire post-battle stat updates on TeamBattle
    - Increment `totalTagTeamWins`/`totalTagTeamLosses`/`totalTagTeamDraws` (not `totalLeagueWins` etc.)
    - Update `tagTeamLp` for LP adjustments (not `teamLp`)
    - _Requirements: 4.3, 4.4_

  - [x] 5.3 Write property test for counter isolation (Property 5)
    - **Property 5: Tag Team Win Counter Isolation** — Verify post-battle updates increment exactly one of `totalTagTeamWins`/`Losses`/`Draws` by 1 and leave `totalLeagueWins`/`Losses`/`Draws` unchanged
    - **Validates: Requirements 4.3**
    - _Requirements: 4.3_

- [x] 6. Tag Team League Rebalancing Service Rewiring
  - [x] 6.1 Rewire tagTeamLeagueRebalancingService to use tagTeamLeagueAdapter
    - Replace old `tagTeamAdapter` (queries `TagTeam`) with new `tagTeamLeagueAdapter`
    - Delegate to `rebalanceAllTiers(TAG_TEAM_LEAGUE_CONFIG, tagTeamLeagueAdapter)`
    - Preserve tier structure, instance sizing (50 max), promotion top 10%, demotion bottom 10%, min 5 cycles, min 10 teams
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 15.7_

  - [x] 6.2 Rewire tag team league history recording
    - Use `entityType = 'tag_team'` with `TeamBattle.id` for new promotion/demotion history entries
    - _Requirements: 13.2_

- [x] 7. Subscription and Event Registry Update
  - [x] 7.1 Update tag_team locking predicate in event registry
    - Update `lockingPredicate` for `tag_team` event type to query `ScheduledTeamBattleMatch` where `matchMode = 'tag_team'` instead of `ScheduledTagTeamMatch`
    - Check robot's team membership via `TeamBattleMember` → `TeamBattle` (teamSize=2) → `ScheduledTeamBattleMatch`
    - Preserve `tag_team` subscription event type in registry (do NOT remove it)
    - _Requirements: 6.1, 12.6_

- [x] 8. Checkpoint — Service rewiring verified
  - Ensure all service-layer tests pass, ask the user if questions arise.

- [x] 9. API Endpoints
  - [x] 9.1 Implement GET /api/team-battles/leagues/2/:tier/tag-team-standings
    - Return tag team standings sorted by `tagTeamLp` descending
    - Accept optional `instance` query parameter to filter by `tagTeamLeagueId`
    - Return: rank, teamId, teamName, stableId, stableName, tagTeamLp, tagTeamLeague, tagTeamLeagueId, totalTagTeamWins/Losses/Draws, combinedELO, member robot details (id, name, elo, slotIndex)
    - Support pagination: `page` (default 1), `perPage` (default 50, max 100)
    - Return empty array with zero total if instance doesn't match
    - Add Zod schema validation with `validateRequest` middleware
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 9.2 Implement GET /api/team-battles/leagues/2/:tier/tag-team-instances
    - Return array of tag team league instances for given tier
    - Group `TeamBattle` rows by `tagTeamLeagueId` where `teamSize = 2` and `tagTeamLeague` matches tier
    - Return: `leagueId`, `leagueTier`, `currentTeams` (count), `maxTeams` (50)
    - Add Zod schema validation
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 9.3 Implement GET /api/team-battles/:id/tag-team-league-history
    - Return league history entries where `entityType = 'tag_team'` for the given TeamBattle.id
    - Add Zod schema validation
    - _Requirements: 13.3_

  - [x] 9.4 Implement GET /api/admin/tag-team-league-health
    - Implement `getTagTeamLeagueHealth` service function querying `TeamBattle` where `teamSize = 2`
    - Group by `tagTeamLeague` and `tagTeamLeagueId` for per-tier statistics
    - Return: tier name, total teams, instances, teams per instance (min/max/avg), teams needing rebalancing, `needsRebalancing` flag
    - Add Zod schema validation and `requireAdmin` middleware
    - _Requirements: 14.1, 14.5_

  - [x] 9.5 Write property test for standings sort invariant (Property 10)
    - **Property 10: Tag Team Standings Sort and Filter Invariant** — Verify standings sorted by `tagTeamLp` desc, instance filter returns correct subset, pagination returns correct slice and total
    - **Validates: Requirements 10.1, 10.2, 10.4, 11.1, 11.2**
    - _Requirements: 10.1, 10.2, 10.4, 11.1, 11.2_

  - [x] 9.6 Write property test for league health computation (Property 12)
    - **Property 12: Tag Team League Health Computation** — Verify per-tier metrics: totalTeams matches count, instances matches distinct tagTeamLeagueId, needsRebalancing correct
    - **Validates: Requirements 14.1, 14.5**
    - _Requirements: 14.1, 14.5_

- [x] 10. Frontend — Team Battles Page and 2v2 Management
  - [x] 10.1 Remove Tag Team tab from TeamBattlesPage
    - Remove `tag-team` tab from tab bar
    - Remove `TagTeamManagementContent` import
    - Set default tab to "2v2 Teams"
    - Only "2v2 Teams" and "3v3 Teams" tabs remain
    - _Requirements: 8.1, 8.6, 12.5_

  - [x] 10.2 Add tag team stats display to 2v2 team cards
    - Display tag team LP, tag team league tier, tag team wins/losses/draws on each 2v2 team card
    - Display alongside existing 2v2 League stats
    - Mobile layout: tag team stats stacked below 2v2 stats (below 1024px)
    - No horizontal overflow, touch targets ≥ 44px
    - _Requirements: 8.2, 8.7_

  - [x] 10.3 Add slot role labels and eligibility badges to 2v2 team cards
    - Display "Active (Tag Team)" for slot 0, "Reserve (Tag Team)" for slot 1
    - Display per-mode eligibility badges: `league_2v2`, `tag_team`, `tournament_2v2`
    - Show "Tag Team Eligible" badge when team is eligible
    - Show ineligibility reasons per mode (e.g., "Tag Team: Robot X not subscribed")
    - Match existing Mode Eligibility Badge pattern
    - _Requirements: 6.5, 8.3, 8.4, 8.5_

  - [x] 10.4 Implement tag team standings mode selector
    - Add toggle between "2v2 League" and "Tag Team" standings in standings view
    - Tag Team standings sorted by `tagTeamLp` desc, calling new endpoint
    - Display: tag team LP, tier, wins/losses/draws, combined ELO
    - Instance selector shown when tier has multiple tag team instances
    - Hide instance selector when tier has exactly one instance
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 10.5 Add Tag Team League section to Admin LeagueHealthPage
    - New "Tag Team League Tiers" section below 3v3 section
    - Same table format: tier, teams, instances, distribution, rebalancing status
    - Yellow ⚠️ indicator for `needsRebalancing: true`
    - Fetch from `GET /api/admin/tag-team-league-health` on page load
    - Responsive: stacked layout on mobile without horizontal overflow
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 11. Checkpoint — Frontend and API integration verified
  - Ensure all frontend and backend tests pass, ask the user if questions arise.

- [x] 12. Legacy Cleanup
  - [x] 12.1 Delete TagTeamManagementContent component
    - Delete `app/frontend/src/components/team-battles/TagTeamManagementContent.tsx`
    - Remove any remaining imports in other files
    - _Requirements: 12.4_

  - [x] 12.2 Delete tag teams route file
    - Delete `app/backend/src/routes/tagTeams.ts`
    - Remove route registration from Express app
    - _Requirements: 12.2_

  - [x] 12.3 Create Prisma migration to drop legacy tables
    - Drop `tag_teams` table and `tag_team_matches` table
    - Remove `TagTeam` model and `ScheduledTagTeamMatch` model from `schema.prisma`
    - Run `npx prisma generate`
    - _Requirements: 12.1, 12.3_

  - [x] 12.4 Update achievement references (if applicable)
    - Check if achievement definitions reference tag team stats on old `TagTeam` model
    - Update any references to point to `TeamBattle` columns
    - _Requirements: 12.7_

  - [x] 12.5 Rewrite integration tests (data source change)
    - Rewrite `tests/integration/tagTeamMultiMatchCycle.test.ts` — replace `createTeam()` with `registerTeam()` from teamBattleService
    - Rewrite `tests/integration/tagTeamAutoRepair.test.ts` — same data source change
    - Rewrite `tests/integration/tagTeamCompleteCycle.test.ts` — same data source change
    - Rewrite `tests/integration/tagTeamByeHandling.test.ts` — same data source change
    - Rewrite `tests/tagTeamBattleLogCompleteness.property.test.ts` — update team creation setup
    - Rewrite `tests/tagTeamPhaseBugs.pbt.test.ts` — update imports and team loading
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [x] 12.6 Delete obsolete tests and update mocks
    - Delete `tests/services/tag-team/tagTeamService.test.ts` (tests old model CRUD)
    - Delete frontend tests for `TagTeamManagementContent`
    - Delete mocks of `/api/tag-teams` route in integration tests
    - Update ~15 test files that mock `tagTeamBattleOrchestrator` to create `TeamBattle` fixtures instead of `TagTeam` fixtures
    - Update frontend test for `TeamBattlesPage` — remove tag-team tab assertions, add tag team stats assertions on 2v2 cards
    - _Requirements: 12.4, 12.5_

- [x] 13. Documentation Updates
  - [x] 13.1 Update `.kiro/steering/project-overview.md`
    - Remove separate "Tag Team" line from Key Systems if present
    - Merge tag team description into the Team Battle Mode entry (item 15)
    - Note that tag team is now a combat mode on 2v2 TeamBattle, not a separate entity
    - _Requirements: 8.1, 12.3_

  - [x] 13.2 Update `docs/architecture/PRD_SERVICE_DIRECTORY.md`
    - Update tag team service descriptions to note they operate on `TeamBattle`
    - Update cron schedule section: tag team slots still exist but reference TeamBattle internally
    - Note `matchMode` discriminator on `ScheduledTeamBattleMatch`
    - _Requirements: 7.1, 7.3_

  - [x] 13.3 Update `app/backend/src/content/guide/facilities/booking-office.md`
    - Reword tag team description: no longer a separate team entity
    - Explain that 2v2 teams participate in tag team mode via `tag_team` subscription
    - Remove references to "creating a tag team" as a distinct action
    - _Requirements: 6.1, 6.2, 8.1_

  - [x] 13.4 Update `app/backend/src/content/guide/strategy/tactical-tuning.md`
    - Update "Tag Team" section to reference 2v2 teams with Active/Reserve slot assignments
    - Remove references to separate tag team entity
    - _Requirements: 4.1, 8.3_

  - [x] 13.5 Update `docs/BACKLOG.md`
    - Mark backlog item #55 (Tag Team System Unification) as completed with spec reference
    - _Requirements: 12.1_

  - [x] 13.6 Verify cron scheduler compatibility
    - Confirm `cycleScheduler.ts` and `adminCycleService.ts` compile correctly post-migration
    - Verify `executeScheduledTagTeamBattles`, `rebalanceTagTeamLeagues`, `runTagTeamMatchmaking` are still exported from rewired service files at same paths
    - Verify tag team cron slots execute correctly with new data source
    - _Requirements: 3.1, 4.1, 5.1, 7.5_

- [x] 14. Final Verification
  - [x] 14.1 Run full test suite and verification criteria
    - Run `npm test` in `app/backend` — all tests pass
    - Run `npm test` in `app/frontend` — all tests pass
    - Execute verification criteria from requirements:
      1. `grep -r "model TagTeam" app/backend/prisma/schema.prisma` → zero matches
      2. `grep -r "tag_team" app/backend/src/services/subscription/eventRegistry.ts` → match exists
      3. `ls app/frontend/src/components/team-battles/TagTeamManagementContent.tsx` → "No such file"
      4. `ls app/backend/src/routes/tagTeams.ts` → "No such file"
      5. `grep -r "tagTeamLp" app/backend/prisma/schema.prisma` → match on TeamBattle model
      6. `grep -r "TeamBattle" app/backend/src/services/tag-team/tagTeamMatchmakingService.ts` → confirms TeamBattle usage
      7. `grep -r "TeamBattle" app/backend/src/services/tag-team/tagTeamBattleOrchestrator.ts` → confirms TeamBattle usage
      8. All tests pass (verified above)
      9. `grep -r "tag-team" app/frontend/src/pages/TeamBattlesPage.tsx` → zero matches for separate tab
    - _Requirements: All (1–15)_

## Notes

- All tasks are mandatory — none are optional
- Every acceptance criterion is traced to at least one task
- Schema extension (group 1) must complete before any service rewiring (groups 3–7)
- Service rewiring groups (3, 4, 5, 6, 7) can proceed in parallel after schema is done
- Frontend changes (group 10) depend on API endpoints (group 9) being complete
- Legacy cleanup (group 12) must come after all rewiring and frontend work is verified
- Documentation (group 13) and final verification (group 14) come last
- Property tests validate universal correctness properties from the design document
- The cron scheduler does not need code changes — same function exports, rewired internals
- Achievement system reads Robot-level stats, unaffected by this migration

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.8"] },
    { "id": 2, "tasks": ["1.4", "1.5"] },
    { "id": 3, "tasks": ["1.6", "1.7"] },
    { "id": 4, "tasks": ["3.1", "4.1", "5.1", "5.2", "6.1", "6.2", "7.1"] },
    { "id": 5, "tasks": ["3.2", "4.2", "4.3", "5.3"] },
    { "id": 6, "tasks": ["9.1", "9.2", "9.3", "9.4"] },
    { "id": 7, "tasks": ["9.5", "9.6"] },
    { "id": 8, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5"] },
    { "id": 9, "tasks": ["12.1", "12.2", "12.3", "12.4"] },
    { "id": 10, "tasks": ["12.5", "12.6"] },
    { "id": 11, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5", "13.6"] },
    { "id": 12, "tasks": ["14.1"] }
  ]
}
```
