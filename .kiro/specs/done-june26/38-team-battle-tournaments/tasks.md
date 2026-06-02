# Implementation Plan: Team Battle Tournaments (2v2 and 3v3)

## Overview

This plan converts the robot-keyed tournament system into an entity-agnostic infrastructure supporting 1v1, 2v2, and 3v3 brackets through a single codebase. Implementation proceeds in phases: schema migration → service refactoring → team tournament orchestration → cron integration → frontend → achievements → admin → documentation → verification.

## Tasks

- [x] 1. Schema migration and Prisma model updates
  - [x] 1.1 Create multi-step Prisma migration for entity-agnostic tournament schema
    - Add `participant_type` column (String, default 'robot') to `tournaments` table
    - Add `participant1_id` (Int?), `participant2_id` (Int?), `participant_type` (String, default 'robot') columns to `tournament_matches` table
    - Add `championship_titles_1v1` (Int, default 0), `championship_titles_2v2` (Int, default 0), `championship_titles_3v3` (Int, default 0) columns to `users` table
    - Copy data: `UPDATE tournament_matches SET participant1_id = robot1_id, participant2_id = robot2_id, participant_type = 'robot'`
    - Copy data: `UPDATE tournaments SET participant_type = 'robot'`
    - Backfill: `UPDATE users SET championship_titles_1v1 = championship_titles`
    - Verify row counts: assert non-null participant1_id count equals non-null robot1_id count (same for participant2)
    - If verification fails, RAISE EXCEPTION to rollback
    - Drop `robot1_id`, `robot2_id` columns from `tournament_matches`
    - Remove FK constraint on `winner_id` (both tables)
    - Include down migration that restores old columns
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.2, 6.4, 11.1, 11.2, 11.3, 11.4, 11.6, 11.7_

  - [x] 1.2 Update Prisma schema models to reflect new entity-agnostic structure
    - Update `Tournament` model: add `participantType` field, remove `winner` relation to Robot, remove `tournamentsWon` relation on Robot model
    - Update `ScheduledTournamentMatch` model: replace `robot1Id`/`robot2Id` with `participant1Id`/`participant2Id`, add `participantType` field, remove `robot1`/`robot2`/`winner` relations, remove `tournamentMatchesAsRobot1`/`tournamentMatchesAsRobot2`/`tournamentMatchWins` relations on Robot model
    - Update `User` model: add `championshipTitles1v1`, `championshipTitles2v2`, `championshipTitles3v3` fields (Int, default 0)
    - Add indexes: `[participantType, status]` on Tournament, `[participant1Id]` and `[participant2Id]` on ScheduledTournamentMatch
    - Run `npx prisma generate` to regenerate client
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 6.2_

  - [x] 1.3 Update all application code referencing old column names
    - `tournamentService.ts`: rename `robot1Id`/`robot2Id` to `participant1Id`/`participant2Id` in bracket generation and `advanceWinnersToNextRound`
    - `tournamentBattleOrchestrator.ts`: use `participant1Id`/`participant2Id` + resolve via `participantType`
    - `lockingPredicates.ts`: change `{ OR: [{ robot1Id: robotId }, { robot2Id: robotId }] }` to `{ OR: [{ participant1Id: ... }, { participant2Id: ... }] }` with team membership lookup for team tournaments
    - `resetService.ts`: rename column references in cleanup queries
    - `robotQueryService.ts`: rename + add `participantType = 'robot'` filter for 1v1 queries
    - `matchHistoryService.ts`: rename column references in bye match detection
    - _Requirements: 1.2, 11.5_

  - [x] 1.4 Write property tests for schema invariants (Properties 1, 2)
    - **Property 1: Participant type consistency invariant** — For any tournament and all its matches, `participantType` on every match equals the parent Tournament's `participantType`
    - **Validates: Requirements 1.10**
    - **Property 2: Invalid participant type rejection** — For any string not in `['robot', 'team_2v2', 'team_3v3']`, creating a tournament/match with that type produces a validation error
    - **Validates: Requirements 1.9**
    - Test file: `tournamentService.property.test.ts`

- [x] 2. Participant resolver and tournament service refactoring
  - [x] 2.1 Create `tournamentParticipantResolver.ts`
    - Implement `ParticipantType` type union (`'robot' | 'team_2v2' | 'team_3v3'`)
    - Implement `ResolvedParticipant` interface with id, displayName, leagueTier, elo, ownerId, members?
    - Implement `validateParticipantType(type)` that throws `TournamentError(INVALID_PARTICIPANT_TYPE)` for unrecognized types
    - Implement `resolveParticipant(id, type)` — joins Robot table for 'robot', TeamBattle table for team types
    - Implement `resolveParticipantsBatch(ids, type)` for batch resolution
    - _Requirements: 1.8, 1.9_

  - [x] 2.2 Write property test for participant resolver (Property 3)
    - **Property 3: Participant resolver correctness** — For any valid (participantId, participantType) pair, resolver returns object with ID, non-empty displayName, and leagueTier. Robot type returns robot name; team type returns team's teamName.
    - **Validates: Requirements 1.8**
    - Test file: `tournamentParticipantResolver.property.test.ts`

  - [x] 2.3 Refactor `tournamentService.ts` to entity-agnostic bracket generation
    - Implement `seedParticipantsByELO(participants)` — sorts by ELO descending, tie-break by `createdAt` ascending
    - Implement `generateBracketPairsGeneric(seeded, maxRounds, participantType)` — same algorithm as current but uses `participant1Id`/`participant2Id`, max bracket size 64
    - Implement `createTournament(options: { participantType, participants, namePrefix })` — entity-agnostic creation with sequential naming per type
    - Convert existing `createSingleEliminationTournament` to thin wrapper calling `createTournament` with `participantType = 'robot'`
    - Update `advanceWinnersToNextRound` to use new column names
    - Update `completeTournament` to award championship title to correct per-type counter based on `participantType`
    - Enforce that all match rows use same `participantType` as parent Tournament (R1.10)
    - _Requirements: 1.10, 2.2, 2.3, 2.5, 2.6, 2.7, 5.1, 5.2, 5.4, 6.1, 6.3_

  - [x] 2.4 Write property tests for tournament service (Properties 4, 5, 6, 8, 12, 13, 15)
    - **Property 4: Seeding order correctness** — Participants sorted by ELO descending; equal ELO tie-broken by earlier createdAt first
    - **Validates: Requirements 2.2**
    - **Property 5: Bracket size and bye count** — For N participants (4≤N≤64), bracket size = smallest power-of-2 ≥ N, byes = bracketSize − N
    - **Validates: Requirements 2.3**
    - **Property 6: Bye match auto-completion** — Bye matches set winnerId to present participant, status to 'bye'/'completed', battleId null, no rewards
    - **Validates: Requirements 2.6, 5.4, 6.10**
    - **Property 8: Sequential tournament naming** — N-th tournament of a type named "{prefix} #{N}"
    - **Validates: Requirements 2.5**
    - **Property 12: Winner advancement correctness** — Winner of match K feeds into position ceil(K/2) of next round
    - **Validates: Requirements 5.1**
    - **Property 13: Tournament completion detection** — Final round with one winner marks tournament completed with winnerId and completedAt
    - **Validates: Requirements 5.2**
    - **Property 15: Championship counter isolation** — Only the matching per-type counter incremented; others unchanged
    - **Validates: Requirements 6.1, 6.3**
    - Test file: `tournamentService.property.test.ts`

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Team tournament service and subscription gating
  - [x] 4.1 Create `teamTournamentService.ts` with eligibility and creation logic
    - Implement `getEligibleTeamsForTournament(teamSize: 2 | 3)` — queries teams with `eligibility = 'ELIGIBLE'`, filters by all-members-subscribed + scheduling-ready
    - Implement `createTeamTournament(teamSize: 2 | 3)` — calls `createTournament` with correct participantType, throws INSUFFICIENT_PARTICIPANTS if < 4 eligible
    - Implement combined-ELO seeding (sum of member robot ELOs) with `createdAt` ascending tie-breaker
    - Store team size identifier on Tournament record (`'team_2v2'` or `'team_3v3'`)
    - Set tournament status to `'active'` and record `startedAt` after bracket generation and bye resolution
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 3.2, 3.3, 3.7_

  - [x] 4.2 Register `tournament_2v2` and `tournament_3v3` in Event Registry
    - Add to `eventRegistry.ts` type union: `'tournament_2v2' | 'tournament_3v3'`
    - Register both events with labels `'2v2 Tournament'` and `'3v3 Tournament'`
    - Implement `tournament2v2LockingPredicate(robotId)` — checks team memberships for pending/scheduled matches in active 2v2 tournaments
    - Implement `tournament3v3LockingPredicate(robotId)` — same pattern for 3v3
    - Add roster eligibility filter rules: `tournament_2v2` (minRobots: 2), `tournament_3v3` (minRobots: 3)
    - _Requirements: 3.1, 3.4, 3.5, 3.6_

  - [x] 4.3 Write property tests for team tournament service (Properties 7, 9, 10)
    - **Property 7: Tournament creation threshold** — Tournament created iff eligible count ≥ 4; count < 4 → no tournament, no error
    - **Validates: Requirements 2.1, 2.8**
    - **Property 9: Team eligibility requires full subscription and eligible status** — Team eligible iff eligibility='ELIGIBLE' AND all members subscribed AND all members scheduling-ready
    - **Validates: Requirements 3.2, 3.3, 3.7**
    - **Property 10: Tournament locking predicate** — Returns true iff robot is member of team with pending/scheduled match in active tournament of corresponding type
    - **Validates: Requirements 3.5**
    - Test file: `teamTournamentService.property.test.ts`

- [x] 5. Team tournament battle orchestrator
  - [x] 5.1 Create `teamTournamentBattleOrchestrator.ts` with match execution
    - Implement `processTeamTournamentBattle(match, tournament)`:
      - Load teams with robot weapons
      - `prepareRobotForCombat` for all 2N robots (full HP, shield, tuning bonuses)
      - Call `simulateTeamBattle(team1Robots, team2Robots, teamSize)` from Team Battle Engine
      - Apply Team Coordination Effects (focus fire, ally shield regen, formation defence) via same `simulateTeamBattle` function
      - Create `Battle` record with `battleType = 'tournament_2v2'` or `'tournament_3v3'`
      - Create `BattleParticipant` records for all 2N robots with correct `team` values (1 or 2)
      - Update match: `winnerId`, `battleId`, `status = 'completed'`, `completedAt`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 5.2 Implement draw tiebreaking logic
    - If `simulateTeamBattle` returns draw (winningSide === null):
      1. Sum finalHP for team 1 vs team 2
      2. Higher total HP wins
      3. If equal: participant1Id wins (higher seed = lower bracket position)
    - Ensure tournament matches never end in a draw
    - _Requirements: 4.4_

  - [x] 5.3 Implement reward distribution for team tournament battles
    - Calculate rewards using `calculateTournamentWinReward(totalParticipants, currentRound, maxRounds) × teamSize`
    - Each robot on winning team receives full N× amount (not split)
    - Losers receive 30% of winner reward per robot
    - Award prestige using stepped curve: R1=20, R2=30, R3=40, R4=50, R5+=60 (capped) + 150 championship bonus for final round win
    - Award zero prestige to losing team in each round
    - Award fame using `calculateTournamentFame(totalParticipants, robotsRemaining, winnerTotalHP, winnerMaxHP)` with HP summed across team members
    - Award streaming revenue via `awardStreamingRevenueForParticipant` with `teamSize` parameter
    - Calculate ELO via `calculateTeamBattleELOChanges(team1SumELO, team2SumELO, team1Won, isDraw)` and apply same delta to each member robot
    - Bye matches: zero rewards (no credits, prestige, fame, ELO)
    - _Requirements: 4.7, 6.1, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

  - [x] 5.4 Implement forfeit handling and round advancement
    - Implement `checkForfeitConditions(match)` — checks team eligibility at execution time
    - If one team ineligible: forfeit match, advance opponent as winner
    - If both teams ineligible: forfeit with winnerId=null, propagate bye to next round
    - Implement `executeTeamTournamentRound(tournamentId, teamSize)`:
      - Process pending matches in sequence
      - Check forfeit conditions first
      - Execute battle if both eligible
      - On match failure: log error, skip match, continue remaining matches
      - Return `{ matchesExecuted, matchesFailed }`
    - _Requirements: 5.1, 5.3, 5.5, 5.6, 7.5, 7.6_

  - [x] 5.5 Write property tests for team tournament orchestrator (Properties 11, 14, 16, 18)
    - **Property 11: Draw tiebreaking determinism** — Draw resolved by HP sum comparison, then seed position; never remains a draw
    - **Validates: Requirements 4.4**
    - **Property 14: Forfeit on ineligibility** — Ineligible team forfeits; both ineligible → winnerId null + bye propagated
    - **Validates: Requirements 5.5, 5.6**
    - **Property 16: Team tournament reward formula (N× multiplier)** — Per-robot reward = calculateTournamentWinReward × N; each member receives full amount
    - **Validates: Requirements 6.5, 6.6**
    - **Property 18: Tournament battles do not affect league counters** — totalLeague2v2Wins/totalLeague3v3Wins unchanged after tournament battle
    - **Validates: Requirements 10.4**
    - Test file: `teamTournamentBattleOrchestrator.property.test.ts`

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Cron schedule integration
  - [x] 7.1 Replace reserved-slot stubs with real team tournament handlers
    - Implement `executeTeam2v2TournamentCycle()`:
      - Call `repairAllRobots(true)` before execution
      - If active 2v2 tournament exists: execute current round, advance winners
      - If no active tournament + ≥ 4 eligible teams: create new tournament
      - If < 4 eligible teams: log skip reason, return without error
      - On final round completion: mark tournament completed, award championship prizes
    - Implement `executeTeam3v3TournamentCycle()` — same pattern with teamSize=3, participantType='team_3v3'
    - Replace `createReservedSlotHandler('team2v2Tournament')` at 15:00 UTC with real handler
    - Replace `createReservedSlotHandler('team3v3Tournament')` at 18:00 UTC with real handler
    - Handle match execution failures: log, skip, continue, report partial failure in job context
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 7.2 Update Admin Bulk Cycle Service to use real handlers
    - Replace no-op stubs for team2v2Tournament (position 7) and team3v3Tournament (position 9) with real handler logic
    - Ensure slot-map order matches production
    - _Requirements: 7.8_

  - [x] 7.3 Write unit tests for cron handlers
    - Test: active tournament → executes round and advances
    - Test: no active tournament + sufficient teams → creates tournament
    - Test: no active tournament + insufficient teams → skips gracefully
    - Test: match execution failure → logs, skips, continues remaining
    - Test: final round completion → marks completed, awards prizes
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 8. Achievement integration
  - [x] 8.1 Add 4 new achievement definitions and seed data
    - C79 "R2-D2 & C-3PO": trigger `tournament_2v2_wins`, threshold 1, easy tier
    - C80 "Jaeger Pilots": trigger `tournament_2v2_wins`, threshold 3, hard tier
    - C81 "Triforce": trigger `tournament_3v3_wins`, threshold 1, easy tier
    - C82 "Devastator": trigger `tournament_3v3_wins`, threshold 3, hard tier
    - Add `tournament_2v2_wins` and `tournament_3v3_wins` to `AchievementTriggerType`
    - Seed rows with appropriate icons, descriptions, and rarity tiers
    - _Requirements: 10.5, 10.6, 10.7_

  - [x] 8.2 Integrate achievement checks into team tournament flow
    - Fire `battle_complete` per robot on both teams with correct `battleType` after each match
    - Fire `tournament_complete` for team owner when tournament is won
    - Update C18 "Autobots, Roll Out!" evaluation to use sum of all per-type counters ≥ 1
    - Ensure tournament battles do NOT increment `totalLeague2v2Wins`/`totalLeague3v3Wins`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 8.3 Write property test for C18 achievement evaluation (Property 17)
    - **Property 17: C18 achievement evaluation** — C18 unlocked iff championshipTitles1v1 + championshipTitles2v2 + championshipTitles3v3 >= 1
    - **Validates: Requirements 10.3**
    - Test file: `achievementService.property.test.ts`

- [x] 9. Discord webhook notifications
  - [x] 9.1 Implement team tournament Discord notifications
    - Add round completion message: tournament type ("2v2"/"3v3"), round number, matches completed, link to tournament page using APP_BASE_URL
    - Add tournament completion message: tournament type, champion team name, owner stable name, link to tournament page
    - Include tournament type label in all messages for disambiguation
    - On webhook delivery failure: log error, allow cron job to complete without interruption
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 10. Hall of Records integration
  - [x] 10.1 Extend `/api/records` endpoint with team tournament champions
    - Add `tournamentChampions2v2` and `tournamentChampions3v3` arrays (10 most recent per type, ordered by completion date descending)
    - Each entry: champion team name, member robot names, owner stable name, completion date
    - Cache in existing `recordsCache` instance (5-min TTL)
    - Omit section if no completed tournaments of that type exist
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 11. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Admin portal extensions
  - [x] 12.1 Add type filter and team tournament display to admin tournament page
    - Add type filter (`1v1`, `2v2`, `3v3`, `All`) defaulting to all types
    - Display team tournaments alongside 1v1 tournaments, paginated 20 per page, ordered by creation date descending
    - Render team tournament brackets with team names and member robot names at each position
    - Display per-robot combat statistics grouped by team (damage dealt, damage received, HP remaining, critical hits)
    - Show tournament creation history per type (participant counts, round counts, completion timestamps), limited to 50 most recent per type
    - _Requirements: 8.1, 8.2, 8.4, 8.6_

  - [x] 12.2 Implement manual-trigger endpoints and cycle control updates
    - Create `POST /api/admin/team-2v2-tournament/trigger` endpoint
    - Create `POST /api/admin/team-3v3-tournament/trigger` endpoint
    - Both execute pending matches in current round, advance winners
    - Return JSON: `{ matchesExecuted, matchesFailed, tournamentComplete, championTeamId }`
    - If no active tournament: return error response without executing matches
    - Record audit trail entry: admin user ID, operation type (`team_tournament_trigger`), tournament type, execution result
    - Show active "Run" buttons for team tournament cron slots (replacing "Reserved" badges)
    - _Requirements: 8.3, 8.5, 8.7, 8.8_

- [x] 13. Frontend — Tournaments page and Tournament detail page
  - [x] 13.1 Update TournamentsPage with type filter and type badges
    - Add type filter row (`All`, `1v1`, `2v2`, `3v3`) above existing status filter
    - Default to `All` types
    - Filter tournaments by `participantType` when type selected
    - Display type badge (`1v1`, `2v2`, `3v3`) next to tournament name on cards
    - Show active/completed counts per type when filter selected
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 13.2 Update TournamentDetailPage for team tournament brackets
    - Display team names at bracket positions (instead of robot names) with expandable section showing member robots and ELOs
    - Update BracketView component to resolve participant names via `participantType`
    - Highlight user's own team(s) with distinct visual indicator (colored border/background)
    - Display per-robot combat statistics grouped by team on match completion
    - Update champion banner to show champion team name and owner stable name for team tournaments
    - _Requirements: 9.5, 9.6, 9.7, 9.8, 9.9_

  - [x] 13.3 Update frontend bracket components for new column names
    - Update `MatchCard.tsx`: rename `robot1Id`/`robot2Id` to `participant1Id`/`participant2Id`
    - Update `BracketView.tsx`: adapt for team participant IDs, add `participantType` and `userParticipantIds` props
    - Update `DesktopBracket.tsx`: rename to `participant1Id`/`participant2Id`
    - Update `MobileBracket.tsx`: rename for participant-based filtering
    - Update `tournament-bracket-seeding.property.test.ts`: update mock data field names
    - _Requirements: 9.5, 9.6, 9.23, 9.24, 11.5_

- [x] 14. Frontend — Battle pages and Robot detail page
  - [x] 14.1 Update BattleHistoryPage for team tournament battles
    - Add `tournament_2v2` and `tournament_3v3` filter options (rename existing `tournament` to display as `1v1 Tournament`)
    - Show team names as combatants with `2v2 🏆` or `3v3 🏆` badge
    - CompactBattleCard renders grouped robot names under each team name
    - _Requirements: 9.10, 9.11, 9.12_

  - [x] 14.2 Update BattleDetailPage for team tournament battles
    - Render participants grouped by team (Team 1 vs Team 2) with per-robot stats
    - Match existing team league battle display pattern
    - _Requirements: 9.13_

  - [x] 14.3 Update RobotDetailPage for team tournament context
    - "Matches" tab: include team tournament battles with team name and tournament round context
    - "League History" tab: display per-type championship wins (1v1, 2v2, 3v3) with distinct trophy icons
    - "Overview" tab: show active tournament participation status (name, round, next match)
    - Subscription section: display `tournament_2v2` and `tournament_3v3` as subscribable events
    - _Requirements: 9.14, 9.15, 9.16, 9.17_

- [x] 15. Frontend — Dashboard, Hall of Records, Booking Office, Stable View
  - [x] 15.1 Update DashboardPage with tournament status card
    - Show tournament status card when user's team is in active tournament
    - Display: tournament name, current round, next opponent (if known), scheduled execution time
    - Link to tournament detail page
    - _Requirements: 9.18, 9.19_

  - [x] 15.2 Update HallOfRecordsPage with team tournament champions
    - Display team tournament champions in dedicated section grouped by type (1v1, 2v2, 3v3)
    - Show: champion team name, member robots, owner stable, completion date
    - _Requirements: 9.20_

  - [x] 15.3 Update BookingOfficePage subscription matrix
    - Include `tournament_2v2` and `tournament_3v3` columns in subscription matrix
    - Show per-robot subscription status alongside existing 6 event types
    - _Requirements: 9.21_

  - [x] 15.4 Update StableViewPage with per-type championship counts
    - Display per-type championship title counts (1v1 🏆, 2v2 🏆, 3v3 🏆) with distinct trophy icons
    - _Requirements: 9.22_

  - [x] 15.5 Ensure mobile responsiveness and accessibility
    - Bracket visualization: vertical stacked layout on viewports < 1024px, horizontal tree on ≥ 1024px
    - All interactive elements (bracket nodes, team cards, subscription toggles, filter buttons): touch targets ≥ 44px
    - Error states with retry action on all tournament data loading failures
    - _Requirements: 9.23, 9.24, 9.25_

- [x] 16. Checkpoint - Ensure frontend build succeeds and all tests pass
  - Run `cd app/frontend && npm run build` to verify no build errors
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Seeded user generation
  - [x] 17.1 Extend seed script with team tournament data
    - Assign tournament subscriptions using roster-aware rules:
      - 1-robot stables (L0, cap 3): `league_1v1` + `tournament_1v1` + `koth` (no team tournament subs)
      - 2-robot stables (L1, cap 4): pick from {`league_2v2`, `tag_team`, `tournament_2v2`} + individual modes; at least 2 stables get `tournament_2v2`
      - 3-robot stables (L1, cap 4): pick from {`league_3v3`, `tournament_3v3`} + team/individual modes; at least 2 stables get `tournament_3v3`
      - 4+ robot stables (L2+, cap 5+): may subscribe to both tournament types
    - Create at least 4 eligible 2v2 teams and 4 eligible 3v3 teams from seeded stables
    - Create 1 completed tournament per size (full bracket history, all matches completed, winnerId/completedAt set)
    - Create 1 active tournament per size (at least 1 completed round, at least 1 pending round)
    - Increment per-type championship counters for completed tournament winners
    - Use upsert semantics (no duplicates on re-run)
    - Only execute in `acceptance` and `development` seed modes
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

- [x] 18. In-game guide updates
  - [x] 18.1 Create team tournament guide article
    - Create `src/content/guide/tournaments/team-tournaments.md`
    - Cover: bracket format (single-elimination, power-of-2 with byes), daily round cadence (2v2 at 15:00 UTC, 3v3 at 18:00 UTC), eligibility requirements (all members subscribed, team eligible), rewards (championship title on win, prestige per round, credits)
    - Ensure discoverable via guide search index (title, description, body reference "team tournament", "2v2", "3v3")
    - _Requirements: 13.1, 13.4_

  - [x] 18.2 Update existing guide articles
    - Update `src/content/guide/facilities/booking-office.md`: list all 8 subscribable event types including `tournament_2v2` and `tournament_3v3`
    - Update existing tournament guide article: state that tournaments support three formats (1v1 robot, 2v2 team, 3v3 team)
    - _Requirements: 13.2, 13.3_

- [x] 19. Documentation updates
  - [x] 19.1 Update steering files and architecture docs
    - Update `.kiro/steering/project-overview.md`:
      - Add "Team Battle Tournaments (2v2 and 3v3)" to Key Systems list (item 16)
      - Update Booking Office description (item 13) to mention 8 event types
      - Update Daily Cron Schedule description (item 14) to show team tournament slots as active (not reserved)
    - Update `docs/architecture/PRD_SERVICE_DIRECTORY.md`:
      - Update Cron Schedule section: mark `team2v2Tournament` and `team3v3Tournament` as active handlers (not reserved stubs)
    - _Requirements: 7.1, 7.2 (documentation of active slots)_

- [x] 20. Final verification
  - [x] 20.1 Run verification criteria from requirements document
    - `grep -r "robot1Id\|robot2Id" app/backend/prisma/schema.prisma | grep -i tournament` — returns zero lines (old columns removed)
    - `grep -r "participant1Id\|participant2Id\|participantType" app/backend/prisma/schema.prisma | grep -i tournament` — returns matches confirming new schema
    - `npx prisma migrate status` — no pending migrations
    - `grep -r "tournament_2v2\|tournament_3v3" app/backend/src/services/subscription/eventRegistry.ts` — both event types registered
    - `grep -r "team2v2Tournament\|team3v3Tournament" app/backend/src/services/cycle/cycleScheduler.ts | grep -v "reserved\|stub\|no-op"` — real handlers present
    - `npm test -- --testPathPattern="tournament" --silent` — all tournament tests pass
    - `npm test -- --testPathPattern="teamTournament" --silent` — dedicated team tournament tests pass
    - `cd app/frontend && npm run build` — frontend build succeeds
    - `grep -r "participantType.*robot" app/backend/prisma/migrations/ | head -5` — migration sets existing data to 'robot'
    - _Requirements: All (aggregate verification)_

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key integration points
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The migration is multi-step with verification to ensure data safety
- All 15 requirements and their acceptance criteria are covered by implementation tasks
- Documentation tasks name specific files that need updating

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["1.4", "2.2", "2.3"] },
    { "id": 4, "tasks": ["2.4", "4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3", "5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 7, "tasks": ["5.5", "7.1"] },
    { "id": 8, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "9.1", "10.1"] },
    { "id": 10, "tasks": ["12.1", "12.2"] },
    { "id": 11, "tasks": ["13.1", "13.2", "13.3"] },
    { "id": 12, "tasks": ["14.1", "14.2", "14.3"] },
    { "id": 13, "tasks": ["15.1", "15.2", "15.3", "15.4", "15.5"] },
    { "id": 14, "tasks": ["17.1"] },
    { "id": 15, "tasks": ["18.1", "18.2", "19.1"] },
    { "id": 16, "tasks": ["20.1"] }
  ]
}
```
