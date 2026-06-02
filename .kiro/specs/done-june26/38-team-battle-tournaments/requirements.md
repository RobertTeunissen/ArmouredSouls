# Requirements Document

## Spec: Team Battle Tournaments (2v2 and 3v3)

## Glossary

- **Tournament**: A bracketed single-elimination competition where participants are seeded by ELO, paired in rounds, and eliminated on loss until one champion remains. After this spec, tournaments serve three participant types: individual robots (1v1), 2v2 teams, and 3v3 teams.
- **Participant**: An entity-agnostic reference to a tournament competitor. A participant is identified by a `participantId` (integer FK) and a `participantType` discriminator (`'robot'` | `'team_2v2'` | `'team_3v3'`). For 1v1 tournaments the participant is a Robot; for 2v2/3v3 tournaments the participant is a TeamBattle entity.
- **Participant_Type**: The discriminator column on `Tournament` and `ScheduledTournamentMatch` that identifies what kind of entity competes. Values: `'robot'`, `'team_2v2'`, `'team_3v3'`.
- **Tournament_System**: The unified tournament infrastructure comprising the `Tournament` model, `ScheduledTournamentMatch` model, `tournamentService.ts`, and `tournamentBattleOrchestrator.ts`. After this spec, all three participant types share this single system.
- **Team_Tournament**: A tournament where the participant type is `'team_2v2'` or `'team_3v3'`. Teams compete in single-elimination brackets using the Team Battle Engine (from Spec 37) for combat simulation.
- **Team_Battle_Engine**: The existing `teamBattleEngine.ts` from Spec 37 that simulates N-vs-N simultaneous combat. Reused by team tournaments for match execution.
- **Team_Coordination_Effects**: The ally-targeted effects (focus fire bonus, ally shield regen, formation defence) from Spec 37 that activate during N-vs-N combat. Active in team tournament battles identically to team league battles.
- **TeamBattle**: The existing Prisma model representing a persistent team of N robots owned by a single stable. Used as the participant entity for team tournaments.
- **Bracket**: The tournament structure of paired matches across rounds. Power-of-2 bracket sizes with bye matches for non-power-of-2 participant counts.
- **Seeding**: The process of ordering participants by ELO (sum of member robot ELOs for teams) to determine bracket positions. Higher seeds face lower seeds in early rounds.
- **Championship_Title**: A tournament victory tracked on the User model. The existing `User.championshipTitles` counter continues to increment on any tournament win (1v1, 2v2, or 3v3) for backward compatibility and C18 achievement checks. Additionally, this spec introduces per-type counters (`championshipTitles1v1`, `championshipTitles2v2`, `championshipTitles3v3`) so that the UI can distinguish which tournament types a player has won and display them with distinct visual representations.
- **Event_Registry**: The runtime singleton from Spec 35 that holds subscribable event definitions. This spec registers `tournament_2v2` and `tournament_3v3` as new entries.
- **Subscription**: A row in the `subscriptions` table representing a robot's opt-in to a subscribable event. This spec adds `tournament_2v2` and `tournament_3v3` as subscribable event types.
- **Booking_Office**: The facility from Spec 35 whose level determines how many concurrent subscriptions each robot may hold (3 at L0, +1 per level up to 13 at L10). After this spec there are 8 total event types.
- **Cycle_Scheduler**: The production cron at `cycleScheduler.ts` with reserved slots for `team2v2Tournament` (15:00 UTC) and `team3v3Tournament` (18:00 UTC). This spec replaces those stubs with real handlers.
- **Tournament_Cadence**: Team tournaments advance one round per daily cycle. A new tournament is auto-created when no active tournament of that type exists and sufficient eligible teams are available.
- **Minimum_Bracket_Size**: The minimum number of participants required to start a tournament. For team tournaments: 4 teams (same as 1v1 robot tournaments).
- **Schema_Migration**: The process of converting the existing robot-keyed tournament schema (`robot1Id`/`robot2Id`/`winnerId` on `ScheduledTournamentMatch`, `winnerId` on `Tournament`) to entity-agnostic participant references (`participant1Id`/`participant2Id`/`participantType`).
- **Stable**: The player account that owns robots and teams. All robots in a team belong to the same stable.
- **Hall_of_Records**: The public read-only surface ranking notable outcomes. After this spec, additionally surfaces team tournament records.

## Introduction

Backlog item #54 ("Team Battle Tournaments 2v2 / 3v3") identifies that the existing tournament system is robot-keyed and needs generalisation to support team participants. Spec 37 delivered the Team Battle league mode with persistent Teams, the Team Battle Engine, and Team Coordination Effects. This spec extends the tournament system to serve those same Teams in bracketed single-elimination tournaments.

The core technical challenge is the schema migration: the current `ScheduledTournamentMatch` model uses `robot1Id`/`robot2Id`/`winnerId` as direct Robot foreign keys, and the `Tournament` model uses `winnerId` referencing Robot. This spec replaces these with entity-agnostic `participant1Id`/`participant2Id`/`winnerId` columns paired with a `participantType` discriminator, so a single tournament infrastructure serves 1v1, 2v2, and 3v3 brackets. Existing 1v1 tournament data is migrated to the new schema with `participantType = 'robot'`.

Team tournaments run daily in their reserved cron slots (2v2 at 15:00 UTC, 3v3 at 18:00 UTC) as established by Spec 36. Each tournament advances one round per cycle. A new tournament is auto-created when the previous one completes and sufficient eligible teams exist. Participation is gated by the Booking Office subscription system — teams must have all member robots subscribed to `tournament_2v2` or `tournament_3v3`.

Championship titles from team tournament wins are tracked via per-type counters (`championshipTitles1v1`, `championshipTitles2v2`, `championshipTitles3v3`) on the User model. The C18 "Autobots, Roll Out!" achievement checks the sum of all three counters ≥ 1 for the tournament category, so team tournament wins automatically satisfy that requirement.

## Expected Contribution

This spec addresses Backlog #54 ("Team Battle Tournaments 2v2 / 3v3") and resolves the technical debt of the robot-keyed tournament schema.

1. **Entity-agnostic tournament schema.** Before — `ScheduledTournamentMatch` uses `robot1Id`/`robot2Id`/`winnerId` as Robot FKs with `tournamentMatchesAsRobot1`/`tournamentMatchesAsRobot2` relations on the Robot model; the system cannot represent non-robot participants. After — the schema uses `participant1Id`/`participant2Id`/`winnerId` with a `participantType` discriminator (`'robot'` | `'team_2v2'` | `'team_3v3'`), and the `Tournament` model gains `participantType` and its `winnerId` becomes a generic integer (no FK constraint). A single tournament system serves all three bracket types. Verifiable by: no `robot1Id`/`robot2Id` columns remain on `ScheduledTournamentMatch`; all existing 1v1 tournament data is accessible with `participantType = 'robot'`.

2. **Two new tournament modes shipped.** Before — only 1v1 robot tournaments exist. After — 2v2 and 3v3 team tournaments run daily in their reserved cron slots (15:00 UTC and 18:00 UTC), using the Team Battle Engine for combat and the same single-elimination bracket logic as 1v1. Verifiable by: both tournament types produce `Battle` records with `battleType = 'tournament_2v2'` or `'tournament_3v3'`; bracket progression advances one round per cycle.

3. **Reserved cron stubs replaced with real handlers.** Before — `team2v2Tournament` (15:00 UTC) and `team3v3Tournament` (18:00 UTC) are no-op stubs logging "reserved slot, no handler implemented yet". After — real handlers execute tournament round battles and auto-create new tournaments when eligible. Verifiable by: the admin bulk-cycle tool exercises team tournament execution; no "reserved slot" log messages for these slots.

4. **Subscription-gated participation via Booking Office.** Before — no `tournament_2v2` or `tournament_3v3` event types exist. After — both are registered in the Event Registry; teams are eligible for tournament entry only when all member robots hold the corresponding subscription. With 8 total event types, the Booking Office facility level meaningfully gates how many modes a robot can participate in. Verifiable by: `eventRegistry` contains `tournament_2v2` and `tournament_3v3`; a team with an unsubscribed member is excluded from tournament creation.

5. **Existing 1v1 tournament data migrated without loss.** Before — 3+ cycles of historical tournament data with championship titles tied to `User.championshipTitles`. After — all historical data is preserved with `participantType = 'robot'`; championship title counts are unchanged; the 1v1 tournament flow continues to work identically. Verifiable by: `SELECT COUNT(*) FROM tournament_matches WHERE participant_type = 'robot'` equals the pre-migration row count; all existing `Tournament` records have `participantType = 'robot'`.

6. **Per-type championship tracking with achievement compatibility.** Before — a single `User.championshipTitles` integer with no way to distinguish which tournament type earned each title. After — three per-type counters (`championshipTitles1v1`, `championshipTitles2v2`, `championshipTitles3v3`) enable distinct visual representation per type, while the sum serves as the backward-compatible total for C18 "Autobots, Roll Out!" achievement checks. Existing 1v1 titles are migrated to `championshipTitles1v1`. Verifiable by: winning a 2v2 tournament increments `championshipTitles2v2` by 1 without affecting `championshipTitles1v1`; C18 check passes for users with only team tournament wins; the frontend displays per-type trophy counts.

### Verification Criteria

After all tasks are complete, run these checks to confirm the spec delivered:

1. `grep -r "robot1Id\|robot2Id" app/backend/prisma/schema.prisma | grep -i tournament` — returns zero lines (old robot-keyed columns removed from tournament models)
2. `grep -r "participant1Id\|participant2Id\|participantType" app/backend/prisma/schema.prisma | grep -i tournament` — returns matches confirming new schema
3. `npx prisma migrate status` — no pending migrations
4. `grep -r "tournament_2v2\|tournament_3v3" app/backend/src/services/subscription/eventRegistry.ts` — both event types registered
5. `grep -r "team2v2Tournament\|team3v3Tournament" app/backend/src/services/cycle/cycleScheduler.ts | grep -v "reserved\|stub\|no-op"` — real handlers present, no stubs
6. `npm test -- --testPathPattern="tournament" --silent` — all tournament tests pass (1v1 + team)
7. `npm test -- --testPathPattern="teamTournament" --silent` — dedicated team tournament tests pass
8. Frontend build succeeds: `cd app/frontend && npm run build`
9. `grep -r "participantType.*robot" app/backend/prisma/migrations/ | head -5` — migration sets existing data to 'robot'

## Requirements

### Requirement 1: Entity-Agnostic Tournament Schema

**User Story:** As a developer, I want the tournament schema to support any participant type (robot or team), so that a single tournament system serves 1v1, 2v2, and 3v3 brackets without code duplication.

#### Acceptance Criteria

1. THE Tournament_System SHALL use `participantType` as a discriminator column on both `Tournament` and `ScheduledTournamentMatch` models with allowed values `'robot'`, `'team_2v2'`, and `'team_3v3'`
2. THE ScheduledTournamentMatch model SHALL replace `robot1Id`, `robot2Id`, and `winnerId` Robot FK columns with `participant1Id`, `participant2Id`, and `winnerId` integer columns that reference the entity identified by `participantType`, where `participant1Id` and `participant2Id` remain nullable to preserve bye-match and placeholder semantics
3. THE Tournament model SHALL replace its `winnerId` Robot FK with a `winnerId` integer column and a `participantType` column identifying what entity type the winner is
4. WHEN a Prisma migration runs, THE Tournament_System SHALL migrate all existing `ScheduledTournamentMatch` rows by copying `robot1Id` → `participant1Id`, `robot2Id` → `participant2Id`, preserving `winnerId`, and setting `participantType = 'robot'`
5. WHEN a Prisma migration runs, THE Tournament_System SHALL migrate all existing `Tournament` rows by setting `participantType = 'robot'` and preserving the existing `winnerId` value
6. THE ScheduledTournamentMatch model SHALL remove the `robot1`/`robot2`/`winner` Prisma relations to the Robot model and the corresponding `tournamentMatchesAsRobot1`/`tournamentMatchesAsRobot2`/`tournamentMatchWins` relations on Robot
7. THE Tournament model SHALL remove the `winner` Prisma relation to the Robot model and the corresponding `tournamentsWon` relation on Robot
8. IF a query requests tournament match participants, THEN THE Tournament_System SHALL resolve participant details by joining on the Robot table when `participantType` is `'robot'` or on the TeamBattle table when `participantType` is `'team_2v2'` or `'team_3v3'`, returning at minimum the participant's ID, display name, and league tier
9. IF a `participantType` value does not match one of the allowed values (`'robot'`, `'team_2v2'`, `'team_3v3'`), THEN THE Tournament_System SHALL reject the operation with a validation error indicating the unrecognized participant type
10. THE Tournament_System SHALL enforce that all `ScheduledTournamentMatch` rows belonging to a given `Tournament` use the same `participantType` value as the parent Tournament record

### Requirement 2: Team Tournament Creation and Bracket Generation

**User Story:** As a player, I want my team to compete in bracketed tournaments, so that I can pursue championship titles through elimination-style competition.

#### Acceptance Criteria

1. WHEN no active tournament of a given team size (2 or 3) exists and the number of eligible teams for that size meets the minimum bracket size of 4 teams, THE Tournament_System SHALL auto-create a new single-elimination tournament for that team size, where a team is eligible if its `eligibility` field is `'ELIGIBLE'` and all member robots pass scheduling readiness checks and hold an active subscription for the corresponding event type (`tournament_2v2` or `tournament_3v3`)
2. THE Tournament_System SHALL seed teams by combined ELO (sum of member robot ELOs) in descending order for bracket placement, using team `createdAt` timestamp ascending (older team first) as the tie-breaker when combined ELO values are equal
3. THE Tournament_System SHALL generate power-of-2 brackets (maximum bracket size of 64) with bye matches for non-power-of-2 participant counts, using the same `generateStandardSeedOrder` algorithm as 1v1 tournaments
4. WHEN a team tournament is created, THE Tournament_System SHALL store the team size identifier (`'team_2v2'` or `'team_3v3'`) on the Tournament record so that active-tournament lookups can be scoped per team size
5. THE Tournament_System SHALL name team tournaments sequentially per type using the format `"2v2 Tournament #N"` or `"3v3 Tournament #N"`, where N is the count of all previously created tournaments of that same type plus one (including completed tournaments, so numbering never resets)
6. WHEN a bye match exists in round 1, THE Tournament_System SHALL auto-complete it by setting the present team as the winner and marking the match status as `'completed'` without executing combat
7. THE Tournament_System SHALL set the tournament status to `'active'` and record `startedAt` with the current timestamp after bracket generation and bye-match resolution are complete
8. IF fewer than 4 eligible teams exist for a given team size at the scheduled tournament creation time, THEN THE Tournament_System SHALL skip tournament creation for that team size and log the insufficient count without raising an error

### Requirement 3: Team Tournament Eligibility and Subscription Gating

**User Story:** As a player, I want to subscribe my robots to team tournaments via the Booking Office, so that my teams can enter bracketed competition.

#### Acceptance Criteria

1. THE Event_Registry SHALL register `tournament_2v2` and `tournament_3v3` as subscribable event types with labels `'2v2 Tournament'` and `'3v3 Tournament'` respectively, each with a locking predicate that returns `true` when the robot's team has a pending or scheduled match in an active tournament of the corresponding `participantType`
2. WHEN determining team eligibility for a tournament, THE Tournament_System SHALL require ALL member robots of the team to hold an active subscription to the corresponding event type (`tournament_2v2` or `tournament_3v3`)
3. IF any member robot of a team lacks the required tournament subscription, THEN THE Tournament_System SHALL exclude that team from tournament eligibility
4. THE Booking_Office subscription cap SHALL apply to tournament subscriptions identically to league subscriptions (consuming one slot per subscription per robot)
5. WHEN a team is entered into a tournament bracket, THE Tournament_System SHALL enforce the locking predicate such that member robots cannot unsubscribe while their team has any pending or scheduled match in that tournament (tournament status is `'active'` and match `winnerId` is null)
6. THE Roster_Eligibility_Filter SHALL include rules for `tournament_2v2` (minRobots: 2, reason: '2v2 Tournament requires 2 or more robots in your Stable') and `tournament_3v3` (minRobots: 3, reason: '3v3 Tournament requires 3 or more robots in your Stable')
7. IF the team's `eligibility` field is not `'ELIGIBLE'`, THEN THE Tournament_System SHALL exclude that team from tournament eligibility regardless of subscription status

### Requirement 4: Team Tournament Match Execution

**User Story:** As a player, I want my team's tournament battles to use the same N-vs-N combat as league battles, so that Team Coordination Effects and team strategy carry over.

#### Acceptance Criteria

1. WHEN a team tournament match is executed, THE Tournament_System SHALL invoke the Team_Battle_Engine (`simulateTeamBattle`) with the rosters of both participating teams and the `teamSize` derived from the tournament's `participantType` (2 for `'team_2v2'`, 3 for `'team_3v3'`)
2. THE Tournament_System SHALL apply Team_Coordination_Effects (focus fire bonus, ally shield regen, formation defence) identically to team league battles by reusing the same `simulateTeamBattle` function and `teamCoordinationEffects` module
3. WHEN a team tournament battle completes, THE Tournament_System SHALL create a `Battle` record with `battleType = 'tournament_2v2'` or `'tournament_3v3'` and `BattleParticipant` records for all 2N robots with correct `team` values (1 or 2)
4. IF the Team_Battle_Engine returns a draw (time limit reached or mutual elimination), THEN THE Tournament_System SHALL determine the winner by comparing total remaining HP summed across all team members, and IF total remaining HP is also equal, THEN THE Tournament_System SHALL award the win to the higher-seeded team (lower bracket position)
5. WHEN a team tournament match completes, THE Tournament_System SHALL update the `ScheduledTournamentMatch` record with `winnerId` (the winning team's ID), `battleId`, `status = 'completed'`, and `completedAt`
6. WHEN a team tournament match is about to execute, THE Tournament_System SHALL restore all participating robots to full HP and full shield before combat (same `prepareRobotForCombat` behaviour as 1v1 tournament matches, including loading tuning bonuses)
7. WHEN a team tournament match completes, THE Tournament_System SHALL calculate ELO changes using `calculateTeamBattleELOChanges` with team-sum ELO difference and apply the same delta to each individual member robot on both teams (same formula as team league battles)

### Requirement 5: Tournament Round Advancement and Completion

**User Story:** As a player, I want the tournament to advance one round per cycle until a champion is crowned, so that tournament progression has a predictable daily cadence.

#### Acceptance Criteria

1. WHEN all matches in the current round have status `'completed'`, `'bye'`, or `'forfeit'`, THE Tournament_System SHALL advance winners to the next round by populating the next round's `participant1Id`/`participant2Id` fields according to bracket position
2. WHEN only one participant remains after the final round, THE Tournament_System SHALL mark the tournament as `'completed'`, set `winnerId` to the champion's participant ID, and record `completedAt` as the current UTC timestamp
3. THE Tournament_System SHALL execute exactly one round of matches per daily cycle (at 15:00 UTC for 2v2, 18:00 UTC for 3v3)
4. WHEN a next-round match has only one participant populated (bye from odd winner count), THE Tournament_System SHALL auto-complete it by setting `winnerId` to the present participant's ID, `status` to `'bye'`, and `battleId` to null (no combat executed)
5. WHEN the round handler executes, IF a team's `eligibility` field is not `'ELIGIBLE'` (team dissolved, member removed, or member robot destroyed), THEN THE Tournament_System SHALL forfeit that team's pending match by setting the match status to `'forfeit'` and advancing the opponent as winner
6. IF both participants in a pending match are ineligible at round execution time, THEN THE Tournament_System SHALL mark the match as `'forfeit'` with `winnerId` null and propagate a bye to the next round (the next-round slot remains empty, triggering a bye for whichever opponent is placed there)

### Requirement 6: Championship Titles and Rewards

**User Story:** As a player, I want to earn championship titles and rewards from team tournament victories, so that tournament competition is meaningful.

#### Acceptance Criteria

1. WHEN a team wins a tournament, THE Tournament_System SHALL increment `User.championshipTitles` by 1 (unified counter) AND increment the corresponding per-type counter (`User.championshipTitles2v2` or `User.championshipTitles3v3`) by 1 for the team owner's user account
2. THE User model SHALL gain two new integer fields: `championshipTitles2v2` (default 0) and `championshipTitles3v3` (default 0), and the existing `championshipTitles` field SHALL be renamed to `championshipTitles1v1` with a new computed `championshipTitles` field that sums all three per-type counters for backward compatibility
3. WHEN a 1v1 robot tournament is won, THE Tournament_System SHALL increment `User.championshipTitles1v1` by 1 (migrating the existing `completeTournament` logic to use the per-type counter)
4. THE Migration SHALL backfill existing `championshipTitles` values into `championshipTitles1v1` (all existing titles are from 1v1 tournaments)
5. THE Tournament_System SHALL calculate team tournament battle rewards using the existing `calculateTournamentWinReward(totalParticipants, currentRound, maxRounds)` formula from `src/utils/tournamentRewards.ts`, multiplied by the team size (N) so that each robot receives the full per-robot amount
6. WHEN distributing rewards for a team tournament battle, THE Tournament_System SHALL award each member robot the full reward amount (same N× pattern as team league rewards — each robot earns the full amount, not split)
7. THE Tournament_System SHALL award prestige to each member robot on the match-winning team after every round using a stepped curve (R1=20, R2=30, R3=40, R4=50, R5+=60 capped) plus a +150 championship bonus for winning the final round, so that teams accumulate prestige for each round they win (deeper tournament runs earn more total prestige), and fame using `calculateTournamentFame(totalParticipants, robotsRemaining, winnerTotalHP, winnerMaxHP)` where HP values are summed across all team members
8. THE Tournament_System SHALL award zero prestige to the losing team in each round — prestige is earned exclusively by winning tournament matches
9. THE Tournament_System SHALL award streaming revenue to each participating robot using `awardStreamingRevenueForParticipant` with the `teamSize` parameter
10. THE Tournament_System SHALL calculate ELO changes using `calculateTeamBattleELOChanges(team1SumELO, team2SumELO, team1Won, isDraw)` and apply the same delta to each individual member robot on both teams
11. WHEN a bye match is auto-completed, THE Tournament_System SHALL NOT award any credits, prestige, fame, or ELO changes to the advancing team

### Requirement 7: Cron Schedule Integration

**User Story:** As a system operator, I want team tournaments to run automatically in their reserved cron slots, so that tournament progression requires no manual intervention.

#### Acceptance Criteria

1. THE Cycle_Scheduler SHALL replace the reserved-slot stub for `team2v2Tournament` (15:00 UTC) with a real handler that executes the current round of the active 2v2 tournament and auto-creates a new tournament if none is active
2. THE Cycle_Scheduler SHALL replace the reserved-slot stub for `team3v3Tournament` (18:00 UTC) with a real handler that executes the current round of the active 3v3 tournament and auto-creates a new tournament if none is active
3. WHEN the tournament handler runs and no active tournament exists, IF at least 4 teams with `eligibility = 'ELIGIBLE'` and the matching team size exist with all members subscribed, THEN THE Cycle_Scheduler SHALL create a new tournament seeded with those eligible teams
4. WHEN the tournament handler runs and no active tournament exists, IF fewer than 4 eligible teams exist, THEN THE Cycle_Scheduler SHALL log the skip reason and return without creating a tournament
5. WHEN the tournament handler runs and an active tournament exists with unresolved matches in the current round, THE Cycle_Scheduler SHALL execute each unresolved match in sequence, record the result, and advance the tournament to the next round once all matches in the current round are resolved
6. IF a match execution fails during the tournament handler run, THEN THE Cycle_Scheduler SHALL log the failure, skip the failed match, continue processing remaining matches in the round, and report the partial failure in the job context
7. WHEN the tournament handler executes the final round and all matches are resolved, THE Cycle_Scheduler SHALL mark the tournament status as `'completed'` and award prizes to the winning team
8. THE Admin_Bulk_Cycle_Service SHALL exercise team tournament handlers in the same slot-map order as production (team2v2Tournament at position 7, team3v3Tournament at position 9), replacing the no-op stubs with the real handler logic

### Requirement 8: Admin Portal Extensions

**User Story:** As an admin, I want to view and manage team tournaments from the admin portal, so that I can monitor bracket progression and intervene if needed.

#### Acceptance Criteria

1. THE Admin_Portal SHALL display team tournaments alongside 1v1 tournaments on the tournament management page, with a type filter (`1v1`, `2v2`, `3v3`) that defaults to showing all types when no filter is selected, paginated to 20 tournaments per page ordered by creation date descending
2. THE Admin_Portal SHALL render team tournament brackets with team names and member robot names visible at each bracket position, using the same bracket visualization component as 1v1 tournaments with participant names resolved via `participantType`
3. THE Admin_Portal SHALL provide manual-trigger endpoints (`POST /api/admin/team-2v2-tournament/trigger` and `POST /api/admin/team-3v3-tournament/trigger`) for team tournament round execution that execute pending matches in the current round, advance winners, and return a JSON response containing `matchesExecuted`, `matchesFailed`, `tournamentComplete`, and `championTeamId`
4. THE Admin_Portal SHALL display team tournament match results with per-robot combat statistics grouped by team, showing each robot's damage dealt, damage received, HP remaining, and critical hits landed
5. WHEN viewing cycle controls, THE Admin_Portal SHALL show active "Run" buttons for `team2v2Tournament` and `team3v3Tournament` slots (replacing "Reserved" badges)
6. THE Admin_Portal SHALL display tournament creation history per type with participant counts, round counts, and completion timestamps, limited to the 50 most recent tournaments per type
7. IF an admin triggers a team tournament round and no active tournament of that type exists, THEN THE Admin_Portal SHALL return an error response indicating no active tournament is available without executing any matches
8. WHEN an admin triggers a team tournament round via the manual-trigger endpoint, THE Admin_Portal SHALL record an audit trail entry containing the admin user ID, operation type (`team_tournament_trigger`), tournament type (`2v2` or `3v3`), and execution result summary

### Requirement 9: Frontend Tournament UI

**User Story:** As a player, I want to view team tournament brackets and my team's progress across all relevant pages, so that I can follow the competition.

#### Acceptance Criteria

**Tournaments Page (`/tournaments`)**

1. THE TournamentsPage SHALL add a type filter row (`All`, `1v1`, `2v2`, `3v3`) above the existing status filter (`All`, `Active`, `Completed`), defaulting to `All` types
2. WHEN a type filter is selected, THE TournamentsPage SHALL only display tournaments matching that `participantType`
3. THE TournamentsPage tournament cards SHALL display a type badge (`1v1`, `2v2`, or `3v3`) next to the tournament name so players can distinguish types at a glance
4. THE TournamentsPage stats overview SHALL show active/completed counts per type when a type filter is selected

**Tournament Detail Page (`/tournaments/:id`)**

5. WHEN viewing a team tournament, THE TournamentDetailPage SHALL display team names at each bracket position (instead of robot names) with an expandable section showing member robot names and ELOs
6. THE TournamentDetailPage BracketView component SHALL resolve participant names via `participantType` — robot name for `'robot'`, team name for `'team_2v2'`/`'team_3v3'`
7. THE TournamentDetailPage SHALL highlight the user's own team(s) in the bracket with a distinct visual indicator (colored border or background accent)
8. WHEN a team tournament match is completed, THE TournamentDetailPage SHALL display per-robot combat statistics grouped by team (damage dealt, damage received, HP remaining)
9. THE TournamentDetailPage champion banner SHALL display the champion team name and owner stable name (instead of just a robot name) for team tournaments

**Battle History Page (`/battles`)**

10. THE BattleHistoryPage type filter SHALL add `tournament_2v2` and `tournament_3v3` as filter options alongside the existing `tournament` (renamed to display as `1v1 Tournament`)
11. WHEN displaying a team tournament battle in the battle list, THE BattleHistoryPage SHALL show the team names as combatants (not individual robot names) with a `2v2 🏆` or `3v3 🏆` badge
12. THE BattleHistoryPage CompactBattleCard SHALL render team tournament battles with grouped robot names under each team name

**Battle Detail Page (`/battles/:id`)**

13. WHEN viewing a team tournament battle, THE BattleDetailPage SHALL render participants grouped by team (Team 1 vs Team 2) with per-robot stats, matching the existing team league battle display pattern

**Robot Detail Page (`/robots/:id`)**

14. THE RobotDetailPage "Matches" tab SHALL include team tournament battles in the battle history list, displayed with the team name and tournament round context
15. THE RobotDetailPage "League History" tab SHALL display tournament championship wins per type (1v1, 2v2, 3v3) as distinct entries with trophy icons
16. THE RobotDetailPage "Overview" tab SHALL show active tournament participation status (tournament name, current round, next match) if the robot's team is in an active tournament
17. THE RobotDetailPage subscription section (Booking Office integration) SHALL display `tournament_2v2` and `tournament_3v3` as subscribable events alongside the existing 6 event types

**Dashboard Page (`/dashboard`)**

18. WHEN a team tournament is active and the user's team is participating, THE DashboardPage SHALL show a tournament status card with: tournament name, current round, next opponent (if known from bracket), and scheduled execution time
19. THE DashboardPage tournament status card SHALL link to the tournament detail page

**Hall of Records Page (`/hall-of-records`)**

20. THE HallOfRecordsPage SHALL display team tournament champions in a dedicated section grouped by type (1v1, 2v2, 3v3), showing champion team name, member robots, owner stable, and completion date

**Booking Office Page (`/booking-office`)**

21. THE BookingOfficePage subscription matrix SHALL include `tournament_2v2` and `tournament_3v3` columns, showing per-robot subscription status alongside the existing 6 event types

**Stable View Page (`/stable`)**

22. THE StableViewPage statistics section SHALL include per-type championship title counts (1v1 🏆, 2v2 🏆, 3v3 🏆) with distinct trophy icons for each type

**Responsiveness and Accessibility**

23. THE Frontend SHALL be fully responsive on viewports ≥ 320px with bracket visualization using a vertical stacked layout on viewports below 1024px and a horizontal bracket tree on viewports ≥ 1024px
24. THE Frontend SHALL ensure all interactive elements (bracket nodes, team cards, subscription toggles, filter buttons) have touch targets ≥ 44px
25. IF tournament data fails to load on any page, THEN THE Frontend SHALL display an error message with a retry action

### Requirement 10: Achievement Integration

**User Story:** As a player, I want team tournament wins to count toward my achievements and unlock new tournament-specific achievements, so that tournament participation is rewarded in the achievement system.

#### Acceptance Criteria

1. WHEN a team wins a tournament, THE Achievement_System SHALL fire a `tournament_complete` event for the team owner's user account, evaluating the `tournament_wins` trigger against the sum of all per-type championship counters (`championshipTitles1v1 + championshipTitles2v2 + championshipTitles3v3`)
2. WHEN a team tournament battle completes, THE Achievement_System SHALL fire a `battle_complete` achievement check for each robot on both teams with `battleType` set to `tournament_2v2` or `tournament_3v3` matching the tournament size
3. THE Achievement_System C18 "Autobots, Roll Out!" SHALL evaluate to unlocked when the sum of all championship title counters is ≥ 1, regardless of which tournament type earned the title
4. THE Achievement_System SHALL NOT increment `league_2v2_wins` or `league_3v3_wins` robot counters for team tournament battles (tournament wins are tracked only via the `tournament_wins` trigger on the team owner)
5. THE Achievement_System SHALL add the following new achievements:
   - "R2-D2 & C-3PO" — Win a 2v2 Tournament (threshold: `championshipTitles2v2 >= 1`, easy tier)
   - "Jaeger Pilots" — Win 3 different 2v2 Tournaments (threshold: `championshipTitles2v2 >= 3`, hard tier)
   - "Triforce" — Win a 3v3 Tournament (threshold: `championshipTitles3v3 >= 1`, easy tier)
   - "Devastator" — Win 3 different 3v3 Tournaments (threshold: `championshipTitles3v3 >= 3`, hard tier)
6. THE Achievement_System SHALL use `AchievementTriggerType` values `tournament_2v2_wins` and `tournament_3v3_wins` for the new achievements, triggered when the corresponding per-type championship counter is incremented
7. THE Achievement_System SHALL seed the 4 new achievement rows in the achievement seed data with appropriate icons, descriptions, and rarity tiers

### Requirement 11: Data Migration Safety

**User Story:** As a developer, I want the schema migration to be safe and reversible, so that existing tournament data is preserved and the migration can be rolled back if issues arise.

#### Acceptance Criteria

1. THE Migration SHALL be structured as a multi-step process: add new columns (`participant1Id`, `participant2Id`, `participantType`) → copy data from `robot1Id`/`robot2Id` → verify row counts → drop old columns
2. WHEN copying data from old columns to new columns, THE Migration SHALL verify that the count of non-null `participant1Id` values equals the count of non-null `robot1Id` values AND the count of non-null `participant2Id` values equals the count of non-null `robot2Id` values
3. THE Migration SHALL set `participantType = 'robot'` on all existing rows in the `tournament_matches` table before dropping old columns
4. IF the migration verification step fails (row count mismatch on either participant column), THEN THE Migration SHALL throw an error and roll back the entire transaction, leaving the database in its pre-migration state
5. THE Migration SHALL update all application code that references `robot1Id`/`robot2Id` on `ScheduledTournamentMatch` to use `participant1Id`/`participant2Id`, resolving the participant type by reading the `participantType` column to determine whether the ID references a Robot or another entity
6. THE Migration SHALL preserve all existing tournament match `battleId` references (the Battle records themselves are unchanged)
7. THE Migration SHALL include a down migration that restores `robot1Id`/`robot2Id` columns by copying values back from `participant1Id`/`participant2Id`, then drops the `participant1Id`, `participant2Id`, and `participantType` columns

### Requirement 12: Discord Webhook Notifications

**User Story:** As a player, I want to receive Discord notifications about team tournament events, so that I stay informed about tournament progression.

#### Acceptance Criteria

1. WHEN a team tournament round completes with at least 1 match played (excluding bye-only rounds), THE Notification_Service SHALL send a Discord webhook message containing the tournament type ("2v2" or "3v3"), the round number, the number of matches completed, and a link to the tournament page constructed using the APP_BASE_URL environment variable
2. WHEN a team tournament completes, THE Notification_Service SHALL send a Discord webhook message containing the tournament type ("2v2" or "3v3"), the champion team name, the owner's stable name, and a link to the tournament page constructed using the APP_BASE_URL environment variable
3. THE Notification_Service SHALL include the tournament type label ("2v2" or "3v3") in all team tournament messages so that players can distinguish which tournament mode the notification refers to
4. IF the Discord webhook delivery fails for a team tournament notification, THEN THE Notification_Service SHALL log the error and allow the tournament cron job to complete without interruption

### Requirement 13: In-Game Guide Updates

**User Story:** As a player, I want the in-game guides to explain team tournaments, so that I understand how to participate.

#### Acceptance Criteria

1. THE Guide_System SHALL include a new guide article in the tournaments section that covers: bracket format (single-elimination, power-of-2 sizing with byes), daily round cadence (one round per cycle at 15:00 UTC for 2v2 and 18:00 UTC for 3v3), eligibility requirements (all member robots must hold the corresponding subscription, team eligibility must be `'ELIGIBLE'`), and rewards (championship title increment on win)
2. THE Guide_System SHALL update the Booking Office guide article to list all 8 subscribable event types including `tournament_2v2` and `tournament_3v3` alongside the existing 6 event types (`league_1v1`, `league_2v2`, `league_3v3`, `tournament_1v1`, `tag_team`, `koth`)
3. THE Guide_System SHALL update any existing tournament guide article to state that tournaments support three formats: 1v1 (robot participants), 2v2 (team participants), and 3v3 (team participants)
4. THE Guide_System SHALL ensure the new team tournament article is discoverable via the guide search index by including a title, description, and body text that reference "team tournament", "2v2", and "3v3"

### Requirement 14: Seeded User Generation

**User Story:** As a developer, I want the seeded environment to include team tournament data, so that the ACC environment demonstrates the full tournament experience.

#### Acceptance Criteria

1. THE Seed_Script SHALL assign tournament subscriptions to seeded robots using the following roster-aware rules (extending the existing Spec 37 subscription assignment logic), without increasing any stable's Booking Office facility level:
   - **1-robot stables (L0, cap 3):** `league_1v1` + `tournament_1v1` + `koth` (no team tournament subscriptions — roster too small)
   - **2-robot stables (L1, cap 4):** Pick from {`league_2v2`, `tag_team`, `tournament_2v2`} for 2 slots + pick from {`koth`, `league_1v1`, `tournament_1v1`} for 2 slots. At least 2 stables SHALL receive `tournament_2v2` to populate brackets.
   - **3-robot stables (L1, cap 4):** Pick from {`league_3v3`, `tournament_3v3`} for 1–2 slots + pick from {`league_2v2`, `tag_team`, `tournament_2v2`} for 1 slot + pick from {`league_1v1`, `koth`, `tournament_1v1`} for remaining slots. At least 2 stables SHALL receive `tournament_3v3` to populate brackets.
   - **4+ robot stables (L2+, cap 5+):** May subscribe to both `tournament_2v2` and `tournament_3v3` if slots allow, following the same priority logic (team modes first, then individual modes for remaining slots)
2. THE Seed_Script SHALL create at least 1 completed team tournament per size (`tournament_2v2` and `tournament_3v3`) with a minimum bracket of 4 teams, full bracket history (all `ScheduledTournamentMatch` records with `status = 'completed'`, `winnerId`, `battleId`, and `completedAt` populated for every round), and the Tournament record marked `status = 'completed'` with `winnerId` and `completedAt` set
3. THE Seed_Script SHALL create at least 1 active (in-progress) team tournament per size with a minimum bracket of 4 teams, at least 1 completed round and at least 1 pending round remaining, to demonstrate bracket progression UI
4. WHEN a seeded team tournament is marked completed, THE Seed_Script SHALL increment the appropriate per-type championship counter (`championshipTitles2v2` or `championshipTitles3v3`) by 1 for the winning team's owner
5. THE Seed_Script SHALL execute team tournament seeding only in `acceptance` and `development` seed modes (not `production`)
6. THE Seed_Script SHALL use upsert semantics for all seeded tournament data so that re-running the seed script does not create duplicate tournaments or duplicate subscription rows
7. THE Seed_Script SHALL create at least 4 eligible 2v2 teams and at least 4 eligible 3v3 teams from seeded stables to satisfy the minimum bracket size for both completed and active tournaments

### Requirement 15: Hall of Records Integration

**User Story:** As a player, I want team tournament champions to appear in the Hall of Records, so that tournament victories are publicly celebrated.

#### Acceptance Criteria

1. THE Hall_of_Records SHALL display team tournament champions alongside 1v1 tournament champions, grouped by tournament type (`1v1`, `2v2`, `3v3`), showing the 10 most recent champions per type ordered by tournament completion date descending
2. THE Hall_of_Records SHALL show for each champion entry: the champion team name, all member robot names at time of victory, the owner stable name, and the tournament completion date
3. THE Hall_of_Records SHALL include team tournament records in the existing `recordsCache` instance in `records.ts` (5-minute TTL), served alongside existing record categories in the same `/api/records` response
4. IF no completed team tournaments exist for a given type, THEN THE Hall_of_Records SHALL omit that type's champion section from the response rather than returning an empty list

## Context: Design Decisions

The following decisions were settled during scoping. Recorded for traceability.

### Why per-type championship counters alongside a total

The existing `User.championshipTitles` field is a simple integer tracking total tournament wins. However, players want to see *which* types they've won — a 2v2 championship feels different from a 3v3 championship, and the UI should represent them distinctly (different trophy icons, separate counts on the profile). Rather than aggregating from the Tournament table on every render, we add `championshipTitles1v1`, `championshipTitles2v2`, and `championshipTitles3v3` directly on the User model. The old `championshipTitles` field is migrated to `championshipTitles1v1` (all existing titles are 1v1), and the total is computed as the sum of all three. The C18 achievement check uses the sum, so it works regardless of which type earned the title. The frontend can display per-type trophies with distinct visuals while the backend keeps queries simple.

### Why the same minimum bracket size (4) as 1v1

Team pools are smaller than robot pools (a stable with 6 robots might have 3 teams of 2 or 2 teams of 3). Setting the minimum at 4 teams means a tournament can run with as few as 4 participants (2 rounds). Going lower (2 teams = 1 match) isn't a tournament. Going higher risks never triggering in small player bases. The 1v1 system uses `MIN_TOURNAMENT_PARTICIPANTS = 4` and `AUTO_START_THRESHOLD = 8` — team tournaments use the same constants.

### Why one round per cycle (not all rounds in one cycle)

1v1 tournaments already advance one round per cycle. This creates multi-day tournament arcs that build anticipation. Running all rounds in a single cycle would compress a 4-round tournament into one day, removing the narrative tension. The daily cadence also means teams have time to observe results and (in future specs) potentially adjust strategy between rounds.

### Why teams cannot forfeit via unsubscription mid-tournament

The locking predicate (R3.5) prevents member robots from unsubscribing while their team has any pending match in an active tournament. This means a team cannot voluntarily exit a tournament by unsubscribing — the subscription is locked for the tournament's duration.

**Key distinction from league swaps:** In the 2v2/3v3 league, swaps are only blocked when a `ScheduledTeamBattleMatch` with status `'scheduled'` exists — i.e., a match has been paired for the next cycle. Between cycles (after a battle executes and before the next matchmaking pairs them), the team is unlocked and swaps are allowed. In tournaments, the entire bracket is pre-generated at creation time with all future rounds as `'pending'` matches. The locking predicate sees these pending matches and locks the roster for the tournament's full duration.

**This is intentional for tournaments.** Seeding is based on the team's combined ELO at bracket creation time. Allowing mid-tournament roster changes would let a player seed with a weaker team (lower ELO → easier bracket position) then swap in stronger robots for later rounds. Roster lock preserves seeding integrity.

**What IS locked during an active tournament:**
- Unsubscribing from `tournament_2v2` / `tournament_3v3` (locking predicate returns true)
- Swapping team members (team has pending tournament matches → locked for battle)
- Disbanding the team (team has pending tournament matches → locked for battle)

**What is NOT locked (and could theoretically cause ineligibility):**
- Robot destruction from league/KotH/tag-team battles between tournament rounds (robot HP reaches 0)
- The pre-match repair step (R4.6) mitigates this — all robots are restored to full HP before tournament matches execute

Given that the repair step heals all participants before each round, the forfeit scenario is effectively impossible under current game rules. The forfeit handling exists as a safety net for future edge cases (e.g., if permanent robot death is ever introduced) rather than a realistic gameplay path.

### Why no separate ELO for tournament performance

Team ELO is computed at matchmaking/seeding time as the sum of member robot ELOs (same as team league). Tournament battles update individual robot ELOs. There's no persisted "tournament ELO" — the team's seeding strength is always derived from its members' current ratings. This keeps the ELO system simple and means tournament performance feeds back into league matchmaking quality.

### Why `battleType` values are `tournament_2v2` / `tournament_3v3` (not reusing `league_2v2` / `league_3v3`)

Battle records need to distinguish tournament battles from league battles for reward calculation, achievement tracking, and analytics. The `battleType` column already uses the pattern `{mode}_{size}` (e.g. `league_1v1`, `tournament_1v1`). Extending to `tournament_2v2` and `tournament_3v3` is consistent.

### Out of Scope

- **Double elimination or Swiss format** — single elimination only in v1
- **Manual/friendly tournament matches** — tournaments are automated via cron
- **Tag Team tournaments** — Tag Team remains league-only (different combat model)
- **Cross-stable team formation** — all robots in a team owned by single stable
- **Changes to Team Coordination Effects** — already delivered in Spec 37, unchanged here
- **Cosmetic team customization** — banners, skins, taunts are separate future work
- **Tournament entry fees or prize pools from player contributions** — rewards come from the system, not player stakes
- **Spectator mode or live bracket updates** — bracket updates on next page load, no WebSocket push
- **Changes to 1v1 tournament reward formula** — existing formula preserved, team tournaments use same formula
