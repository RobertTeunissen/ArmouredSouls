# Implementation Plan: Team Battles (2v2 and 3v3)

## Overview

This implementation plan delivers two new simultaneous-combat battle modes (2v2 League and 3v3 League) by: migrating event naming for consistency, extracting shared matchmaking utilities, adding database schema for teams and scheduled matches, building the full Team Battle service layer (CRUD, engine, matchmaking, orchestrator, rewards, adapter), integrating with the cycle scheduler and admin portal, extending the subscription system, updating the frontend with unified team management and battle display surfaces, extending the achievement system, updating seeded user generation, and completing documentation updates.

## Tasks

- [x] 1. Event naming migration and shared matchmaking extraction
  - [x] 1.1 Migrate event naming in database and code
    - Create a Prisma migration that renames `event_type = 'league'` → `'league_1v1'` and `event_type = 'tournament'` → `'tournament_1v1'` in the `subscriptions` table (idempotent UPDATE)
    - Same migration renames `battle_type = 'league'` → `'league_1v1'` and `battle_type = 'tournament'` → `'tournament_1v1'` in the `battle` table
    - Update `SubscribableEventType` union in `eventRegistry.ts` to use `'league_1v1'` and `'tournament_1v1'`
    - Update all `registerSubscribableEvent` calls in `src/index.ts` to use new identifiers
    - Update all code references reading/writing `battleType` values (`'league'` → `'league_1v1'`, `'tournament'` → `'tournament_1v1'`) across backend and frontend
    - Update the `BattleType` type definition
    - _Requirements: R3.6, R3.11, R3.12_

  - [x] 1.2 Extract shared matchmaking module (`teamMatchmakingUtils.ts`)
    - Create `app/backend/src/services/matchmaking/teamMatchmakingUtils.ts` with `calculateMatchScore`, `createByeTeam`, `getRecentOpponentsBatch` extracted from `tagTeamMatchmakingService.ts`
    - Export constants: `LP_MATCH_IDEAL`, `LP_MATCH_FALLBACK`, `ELO_MATCH_IDEAL`, `ELO_MATCH_FALLBACK`, `RECENT_OPPONENT_PENALTY`, `SAME_STABLE_PENALTY`, `RECENT_OPPONENT_LIMIT`
    - Export `MatchScoreInput` interface
    - Implement LP-primary scoring: LP difference as PRIMARY factor, ELO as SECONDARY (no hard reject), +400 recent-opponent penalty, +10000 same-stable penalty
    - _Requirements: R4.1, R4.1a, R4.3, R4.5_

  - [x] 1.3 Update `tagTeamMatchmakingService.ts` to import from shared module
    - Replace inline `calculateMatchScore`, `createByeTeam`, `getRecentOpponentsBatch` with imports from `teamMatchmakingUtils.ts`
    - Verify zero functional changes to tag team battle orchestration or simulation logic
    - _Requirements: R1.2, R14.6, R17.4_

  - [x] 1.4 Update 1v1 `matchmakingService.ts` to use shared scoring formula
    - Replace inline `calculateMatchScore` in `app/backend/src/services/analytics/matchmakingService.ts` with import from `teamMatchmakingUtils.ts`
    - Remove ELO hard-reject logic — ELO is now secondary (soft factor only) per the shared formula
    - Verify 1v1 matchmaking still produces valid pairings with the new formula
    - _Requirements: R4.1a, R14.6_

  - [x] 1.5 Write unit tests for shared matchmaking module
    - Create `tests/services/matchmaking/teamMatchmakingUtils.test.ts`
    - Test LP-primary scoring, ELO secondary scoring, recent-opponent penalty, same-stable penalty
    - Test `createByeTeam` factory function
    - Test `getRecentOpponentsBatch` delegation
    - Test tie-breaking by earliest creation timestamp
    - _Requirements: R4.1, R4.1a, R4.3, R4.5_

- [x] 2. Database schema for Team Battles
  - [x] 2.1 Create Prisma schema and migration for Team Battle tables
    - Add `TeamBattle` model: `id`, `stableId`, `teamSize`, `teamName`, `teamLp`, `teamLeague`, `teamLeagueId`, `cyclesInLeague`, `totalWins`, `totalLosses`, `totalDraws`, `eligibility`, `createdAt`, `updatedAt`; indexes on `stableId`, `teamLeagueId`, `(teamSize, teamLeague)`
    - Add `TeamBattleMember` model: `id`, `teamId`, `robotId`, `slotIndex`; unique constraints on `(teamId, slotIndex)` and `(teamId, robotId)`; index on `robotId`
    - Add `ScheduledTeamBattleMatch` model: `id`, `team1Id`, `team2Id` (nullable for bye), `teamSize`, `teamBattleLeague`, `teamBattleLeagueId`, `scheduledFor`, `status`, `cancelReason`; indexes on `(status, teamSize)`, `team1Id`, `team2Id`
    - Add `totalLeague2v2Wins` and `totalLeague3v3Wins` fields to `Robot` model (Int, default 0)
    - Add `teamBattleMembers` relation to `Robot` model
    - Run `npx prisma migrate dev` to generate and apply migration
    - _Requirements: R2.1, R2.2, R2.3, R4.4, R5.8, R8.1, R16.3_

- [x] 3. Checkpoint - Schema and shared module verification
  - Ensure `npx prisma migrate status` shows no drift, all existing tests pass, tag team tests still pass with updated imports. Ask the user if questions arise.

- [x] 4. Team Battle Service (CRUD)
  - [x] 4.1 Implement `teamBattleService.ts` (register, swap, rename, disband)
    - Create `app/backend/src/services/team-battle/teamBattleService.ts`
    - `registerTeam(stableId, robotIds, teamName, teamSize, userId)`: validate team size (2 or 3), exactly N distinct robot IDs, all owned by stable, all subscribed to corresponding event, no robot already on same-size team, name passes `safeName`, stable has ≥ N robots; use Prisma interactive transaction with `SELECT FOR UPDATE`
    - `swapTeamMember(teamId, oldRobotId, newRobotId, userId)`: reject if team locked for battle, validate new robot ownership/subscription/uniqueness
    - `renameTeam(teamId, newName, userId)`: validate against `safeName`, 3–32 chars
    - `disbandTeam(teamId, userId)`: reject if team locked for battle, cascade delete members
    - Support incomplete rosters: team with < N members is `INELIGIBLE`, returns to `ELIGIBLE` when filled
    - Define error codes: `TEAM_INVALID_SIZE`, `TEAM_INVALID_COMPOSITION`, `TEAM_OWNERSHIP_VIOLATION`, `TEAM_MEMBER_CONFLICT`, `TEAM_INSUFFICIENT_ROBOTS`, `TEAM_NAME_INVALID`, `TEAM_LOCKED_FOR_BATTLE`
    - _Requirements: R2.1, R2.2, R2.3, R2.4, R2.5, R2.6, R2.7, R2.8, R2.9, R2.10, R2.11, R10.2, R10.3, R10.6_

  - [x] 4.2 Write unit tests for `teamBattleService.ts`
    - Create `tests/services/team-battle/teamBattleService.test.ts`
    - Test all registration validation rules (size, ownership, subscription, uniqueness, name)
    - Test swap rejection when locked, swap success when unlocked
    - Test rename validation
    - Test disband rejection when locked, disband success when unlocked
    - Test incomplete roster → INELIGIBLE → fill → ELIGIBLE state transitions
    - Test error codes match expected values
    - _Requirements: R2.1–R2.11, R10.2, R10.3, R10.6_

  - [x] 4.3 Write property test for team composition validation (Property 7)
    - Create property test in `tests/teamBattle.property.test.ts`
    - **Property 7: Team Composition Validation** — registration succeeds iff all composition rules satisfied (N distinct robots, all owned, all subscribed, no conflicts)
    - Use `fc.assert` with `{ numRuns: 100 }` minimum
    - **Validates: Requirements R2.4, R2.5, R2.6, R1.9**

  - [x] 4.4 Write property test for team eligibility state machine (Property 8)
    - Add to `tests/teamBattle.property.test.ts`
    - **Property 8: Team Eligibility State Machine** — team INELIGIBLE iff members < N or subscription missing or robot destroyed; ELIGIBLE when all conditions met
    - Use `fc.assert` with `{ numRuns: 100 }` minimum
    - **Validates: Requirements R2.1, R2.9, R3.10**

- [x] 5. Team Coordination Effects
  - [x] 5.1 Implement `teamCoordinationEffects.ts`
    - Create `app/backend/src/services/team-battle/teamCoordinationEffects.ts`
    - `calculateFocusFireBonus(avgSyncProtocols, contributorCount, teamSize)`: `0.25 × √(avgSyncProtocols / 50) × (contributors / N)`, max 25%
    - `calculateAllyShieldRegen(supportSystemsValue, dt)`: `0.8 × √(supportSystems / 50) × dt`, max 0.80 shield/sec
    - `calculateFormationDefense(avgFormationTactics, alliesInRange, teamSize)`: `0.20 × √(avgFormationTactics / 50) × (alliesInRange / (N-1))`, max 20%
    - Export `FORMATION_RANGE = 8` constant
    - All formulas return 0 when attribute = 0
    - _Requirements: R6.1, R6.2, R6.3, R6.4, R6.5, R6.7, R6.8_

  - [x] 5.2 Write unit tests for team coordination effects
    - Create `tests/services/team-battle/teamCoordinationEffects.test.ts`
    - Test each formula at attribute values 0, 5, 15, 25, 50
    - Test zero-attribute produces zero bonus (R6.7)
    - Test max cap values
    - Test edge cases (teamSize=2 vs 3, partial contributors)
    - _Requirements: R6.1–R6.7_

  - [x] 5.3 Write property tests for coordination effect monotonicity (Properties 3 & 4)
    - Create `tests/teamCoordination.property.test.ts`
    - **Property 3: syncProtocols Monotonicity** — for A ≤ B in [0, 50], focus fire bonus at A ≤ bonus at B
    - **Property 4: supportSystems and formationTactics Monotonicity** — for A ≤ B in [0, 50], ally shield regen at A ≤ regen at B AND formation defence at A ≤ defence at B
    - Use `fc.assert` with `{ numRuns: 100 }` minimum per property
    - **Validates: Requirements R13.3, R13.4**

- [x] 6. Team Battle Engine (N-vs-N simulation)

  - [x] 6.1 Implement `teamBattleEngine.ts`
    - Create `app/backend/src/services/team-battle/teamBattleEngine.ts`
    - `simulateTeamBattle(team1Robots, team2Robots, teamSize)`: validate exactly 2 teams of N robots each
    - Create arena via `arenaLayout.createArena([teamSize, teamSize])`
    - Place all 2N robots at tick 0, all active simultaneously
    - Run combat loop invoking `combatSimulator.ts` with team coordination effects applied per tick
    - Each robot independently selects one target per tick (opposing side, hp > 0)
    - Detect focus fire events (2+ robots targeting same enemy in same tick)
    - Apply `calculateFocusFireBonus` when focus fire detected
    - Apply `calculateAllyShieldRegen` per supporter per tick
    - Apply `calculateFormationDefense` for allies within 8 grid units
    - Victory: one side has 0 robots with hp > 0; Draw: 300 seconds elapsed
    - Return `TeamBattleResult` with winningSide, participants, battleLog, focusFireEvents
    - Record per-robot stats: damageDealt, damageTaken, finalHP, survivalSeconds
    - Append elimination events to battle log when robot hp reaches 0
    - _Requirements: R1.1, R1.3, R1.5, R1.7, R1.9, R5.1–R5.10, R6.2, R6.3, R6.4, R6.5, R6.6_

  - [x] 6.2 Define Team Battle log types in `src/types/`
    - Create typed interfaces for `TeamBattleResult`, `TeamBattleParticipantResult`, `TeamBattleCombatEvent`, `FocusFireEvent` in `app/backend/src/types/`
    - Define `Battle.battleLog` JSON schema for team battles conforming to the typed schema
    - _Requirements: R5.7, R5.8_

  - [x] 6.3 Write unit tests for `teamBattleEngine.ts`
    - Create `tests/services/team-battle/teamBattleEngine.test.ts`
    - Test 2v2 and 3v3 simulations produce valid results
    - Test victory detection (one side eliminated)
    - Test draw detection (300 seconds elapsed)
    - Test focus fire event detection and logging
    - Test elimination event logging
    - Test rejection of invalid roster sizes (TEAM_INVALID_SIZE, TEAM_INVALID_COMPOSITION)
    - Test per-robot stats are populated correctly
    - _Requirements: R1.1, R1.5, R1.9, R5.1–R5.9_

  - [x] 6.4 Write property test for combat conservation (Property 1)
    - Add to `tests/teamBattle.property.test.ts`
    - **Property 1: Combat Conservation Invariant** — total damage dealt equals total damage taken within 0.01 HP across all participants
    - Use `fc.assert` with `{ numRuns: 100 }` minimum
    - **Validates: Requirements R13.1, R5.8**

  - [x] 6.5 Write property test for winner survival (Property 5)
    - Add to `tests/teamBattle.property.test.ts`
    - **Property 5: Winner Survival Invariant** — winning team has at least one member with finalHP > 0
    - Use `fc.assert` with `{ numRuns: 100 }` minimum
    - **Validates: Requirements R13.5, R5.5**

  - [x] 6.6 Write property test for participant structure (Property 9)
    - Add to `tests/teamBattle.property.test.ts`
    - **Property 9: Participant Structure Invariant** — exactly 2N BattleParticipant rows with N on team 1 and N on team 2, all robotIds matching team members
    - Use `fc.assert` with `{ numRuns: 100 }` minimum
    - **Validates: Requirements R1.5**

- [x] 7. Checkpoint - Core engine verification
  - Ensure all team battle engine tests pass, property tests pass, coordination effect tests pass. Ask the user if questions arise.

- [x] 8. Team Battle Matchmaking
  - [x] 8.1 Implement `teamBattleMatchmakingService.ts`
    - Create `app/backend/src/services/team-battle/teamBattleMatchmakingService.ts`
    - `runTeamBattleMatchmaking(teamSize: 2 | 3, scheduledFor?)`: iterate tiers → instances → eligible teams
    - Check eligibility: all members subscribed via `isRobotSubscribedTo`, all members Robot_Ready, team not already scheduled, team eligibility = ELIGIBLE
    - Compute team ELO as sum of member robot ELOs (no persisted field)
    - Batch-fetch recent opponents via `getRecentOpponentsBatch`
    - Pair using `calculateMatchScore` from shared module
    - Guarantee: never assign bye when real opponents exist
    - Handle odd count: pair last team against bye team via `createByeTeam`
    - Persist `ScheduledTeamBattleMatch` records
    - Handle errors per-team: log and skip, continue with remaining teams (R4.6)
    - Implement R4.7: if all opponents excluded by recent-opponent rule, pair with closest-ELO from excluded set
    - _Requirements: R3.3, R3.4, R4.1–R4.7_

  - [x] 8.2 Write unit tests for `teamBattleMatchmakingService.ts`
    - Create `tests/services/team-battle/teamBattleMatchmakingService.test.ts`
    - Test subscription gating (exclude teams with unsubscribed members)
    - Test bye-team assignment only when odd count
    - Test recent-opponent exclusion and fallback (R4.7)
    - Test error handling per-team (continue on failure)
    - Test scheduled match persistence
    - _Requirements: R3.3, R3.4, R4.1–R4.7_

  - [x] 8.3 Write property test for subscription eligibility (Property 2)
    - Add to `tests/teamBattle.property.test.ts`
    - **Property 2: Subscription Eligibility** — team excluded from matchmaking iff any member lacks subscription; team with all members subscribed is included
    - Use `fc.assert` with `{ numRuns: 100 }` minimum
    - **Validates: Requirements R13.2, R3.3, R3.4**

  - [x] 8.4 Write property test for matchmaking guarantee (Property 10)
    - Create `tests/teamBattleMatchmaking.property.test.ts`
    - **Property 10: Matchmaking Guarantee (No Unnecessary Byes)** — for K ≥ 2 eligible teams, produce ⌊K/2⌋ real matches and at most 1 bye (only when K is odd)
    - Use `fc.assert` with `{ numRuns: 100 }` minimum
    - **Validates: Requirements R4.1, R4.3**

- [x] 9. Team Battle Reward Service
  - [x] 9.1 Implement `teamBattleRewardService.ts`
    - Create `app/backend/src/services/team-battle/teamBattleRewardService.ts`
    - `calculateTeamBattleReward(league, teamSize, isWinner, isDraw)`: N× multiplier (2× for 2v2, 3× for 3v3) of 1v1 win+participation reward; loser/draw gets 20% of winner
    - Fame: each robot earns full `FAME_BY_LEAGUE[tier]` (no splitting)
    - Prestige: each robot earns full `PRESTIGE_BY_LEAGUE[tier]` for wins
    - Streaming: `awardStreamingRevenueForParticipant` per robot with `teamSize` param
    - ELO: compute team ELO as sum of member ELOs, use `calculateELOChange(team1SumELO, team2SumELO, isDraw)`, apply same delta to each member robot's individual `elo`
    - LP: update Team_LP using existing LP delta rules (win/loss/draw)
    - Credit distribution: split across N robots per R7.4 rules (surviving robots get share, destroyed robots with damageDealt > 0 get at least 1 credit)
    - No modification to individual robot LP, tag-team LP, or tournament standings (R7.8)
    - Bye-team semantics: compute reward as if opponent rating equals tag-team bye rating (R7.9)
    - _Requirements: R7.1–R7.11, R8.1_

  - [x] 9.2 Write unit tests for `teamBattleRewardService.ts`
    - Create `tests/services/team-battle/teamBattleRewardService.test.ts`
    - Test reward calculation per tier for 2v2 and 3v3 (winner, loser, draw)
    - Test credit distribution across N robots (sum equals team reward exactly)
    - Test ELO update applied equally to all members
    - Test LP update on team
    - Test no modification to robot LP or tag-team LP
    - Test bye-team reward calculation
    - _Requirements: R7.1–R7.11_

  - [x] 9.3 Write property test for reward distribution conservation (Property 6)
    - Add to `tests/teamBattle.property.test.ts`
    - **Property 6: Reward Distribution Conservation** — sum of credits distributed across N robots equals documented team reward within 1 credit; no robot receives negative reward
    - Use `fc.assert` with `{ numRuns: 100 }` minimum
    - **Validates: Requirements R13.6, R7.1–R7.5**

- [x] 10. Team Battle Orchestrator and Adapter

  - [x] 10.1 Implement `teamBattleOrchestrator.ts`
    - Create `app/backend/src/services/team-battle/teamBattleOrchestrator.ts`
    - `executeScheduledTeamBattles(teamSize: 2 | 3)`: fetch scheduled matches, load robot data with weapons, invoke `simulateTeamBattle`, persist Battle + BattleParticipant rows
    - Set `Battle.battleType` to `'league_2v2'` or `'league_3v3'`
    - Persist exactly 2N `BattleParticipant` rows with correct `team` values (1 or 2), `role = null`
    - Distribute rewards via `teamBattleRewardService`
    - Update team win/loss/draw counters
    - Increment `totalLeague2v2Wins` / `totalLeague3v3Wins` on winning robots
    - Emit audit log rows per participating robot (R10.4)
    - Handle single-match failures: mark as cancelled, log, continue remaining (R10.5)
    - Use Prisma interactive transaction for reward distribution with rollback on failure (R7.11)
    - Emit structured log line with cycle number, team_size, team IDs, league instance, duration, outcome (R11.1)
    - _Requirements: R1.4, R1.5, R5.5, R5.6, R5.7, R5.8, R7.10, R7.11, R10.4, R10.5, R11.1, R16.2_

  - [x] 10.2 Implement `teamBattleAdapter.ts` for `leagueEngine.ts`
    - Create `app/backend/src/services/team-battle/teamBattleAdapter.ts`
    - Implement `LeagueAdapter<TeamBattle>` interface
    - Config: `promotionPercentage: 0.10`, `demotionPercentage: 0.10`, `minCyclesForRebalancing: 5`, `minEntitiesForRebalancing: 4`, `minCohortForNewTier: 3`, `entityType: 'team_battle'`, instance size target: 50 teams
    - Record `LeagueHistory` rows with `entityType: 'team_battle'` for promotions/demotions
    - Same six-tier structure as 1v1 (bronze through champion)
    - New teams start in `bronze_1` with standard starting LP
    - _Requirements: R8.1–R8.8, R14.6_

  - [x] 10.3 Write unit tests for orchestrator and adapter
    - Create `tests/services/team-battle/teamBattleOrchestrator.test.ts`
    - Test full execution flow: fetch → simulate → persist → reward → audit
    - Test single-match failure handling (cancel and continue)
    - Test transaction rollback on reward failure
    - Test audit log emission per robot
    - Test adapter promotion/demotion logic
    - Test league history recording
    - _Requirements: R1.4, R1.5, R7.10, R7.11, R8.2–R8.8, R10.4, R10.5_

- [x] 11. Subscription system extensions
  - [x] 11.1 Register `league_2v2` and `league_3v3` in Event Registry and subscription system
    - Add `registerSubscribableEvent` calls in `src/index.ts` for `league_2v2` (label: '2v2 League') and `league_3v3` (label: '3v3 League') with locking predicates
    - Add `league2v2LockingPredicate` and `league3v3LockingPredicate` to `lockingPredicates.ts` — check for queued `ScheduledTeamBattleMatch` rows with status `'scheduled'` for the robot's team
    - Add roster eligibility rules to `rosterEligibilityFilter.ts`: `league_2v2` with `minRobots: 2`, `league_3v3` with `minRobots: 3`
    - Extend `SubscribableEventType` union to include `'league_2v2'` and `'league_3v3'`
    - _Requirements: R3.5, R3.6, R3.7, R3.8, R3.9, R3.10_

  - [x] 11.2 Write unit tests for locking predicates and eligibility filter
    - Create/extend `tests/services/subscription/lockingPredicates.test.ts`
    - Test `league2v2LockingPredicate` returns true when robot has scheduled match
    - Test `league3v3LockingPredicate` returns true when robot has scheduled match
    - Test roster eligibility filter blocks subscription when stable has < N robots
    - _Requirements: R3.7, R3.8, R3.9_

- [x] 12. Cycle scheduler and admin integration
  - [x] 12.1 Replace reserved-slot stubs in `cycleScheduler.ts` with real handlers
    - Replace `createReservedSlotHandler('team2v2League')` with `executeTeam2v2LeagueCycle()`: execute scheduled 2v2 battles → rebalance 2v2 tiers → run 2v2 matchmaking
    - Replace `createReservedSlotHandler('team3v3League')` with `executeTeam3v3LeagueCycle()`: same pattern for 3v3
    - Do NOT modify `env.ts` or the slot map — use existing env vars `TEAM_2V2_LEAGUE_SCHEDULE` and `TEAM_3V3_LEAGUE_SCHEDULE`
    - _Requirements: R3.1, R3.2, R14.1, R14.8_

  - [x] 12.2 Update `adminCycleService.ts` for bulk cycle integration
    - Replace no-op stubs for team_2v2_league (slot position 2) and team_3v3_league (slot position 6) with real Team Battle execution + rebalance + matchmaking
    - Ensure per-cycle failure handling: record failure, continue remaining steps and iterations (R14.7)
    - _Requirements: R14.2, R14.7_

  - [x] 12.3 Implement admin manual-trigger endpoints for Team Battles
    - Replace no-op endpoints in `app/backend/src/routes/admin.ts` with real manual-trigger endpoints for Team Battle matchmaking and execution
    - URL shape mirrors existing `/api/admin/tag-teams/matchmaking` and `/api/admin/tag-teams/battles`
    - Guard with `authenticateToken` + `requireAdmin`
    - Emit `recordAuditAction` per invocation with `team_battle` event type
    - Declare Zod schemas via `validateRequest` for body/query/params
    - _Requirements: R14.3, R14.4, R14.5, R10.1_

  - [x] 12.4 Add Team Battle API routes (player-facing)
    - Create routes for team CRUD: register team, swap member, rename, disband
    - All routes use `validateRequest` with Zod schemas, `authenticateToken`, ownership verification inside transaction
    - Return generic 403 "Access denied" for all ownership failures (byte-identical, R10.6)
    - Reject Tag Team Orchestrator payloads with `league_2v2`/`league_3v3` battleType (R1.8)
    - _Requirements: R10.1, R10.2, R10.3, R10.6, R1.8_

  - [x] 12.5 Write unit tests for admin endpoints
    - Create/extend `tests/routes/admin.test.ts`
    - Test manual-trigger endpoints invoke matchmaking and execution
    - Test auth guard (authenticateToken + requireAdmin)
    - Test audit log emission
    - Test Zod validation rejects invalid input
    - _Requirements: R14.3–R14.5_

- [x] 13. Discord webhook notifications

  - [x] 13.1 Extend `notification-service.ts` with team battle cases
    - Add `team2v2League` and `team3v3League` cases to `buildSuccessMessage`
    - Message format: `⚔️ 2v2 League: ${matchesCompleted} team battles completed. [View results](${appUrl}/team-battles)` (same for 3v3)
    - Return `null` when `matchesCompleted = 0`
    - _Requirements: R11.1a_

  - [x] 13.2 Write unit tests for Discord webhook messages
    - Extend `tests/services/notifications/notification-service.test.ts`
    - Test `team2v2League` case produces correct message with link
    - Test `team3v3League` case produces correct message with link
    - Test returns null when matchesCompleted = 0
    - _Requirements: R11.1a_

- [x] 14. Achievement system integration

  - [x] 14.1 Extend achievement system for 2v2/3v3 League
    - Add `league_2v2_wins` and `league_3v3_wins` to `AchievementTriggerType` union in `achievements.ts`
    - Add to `EVENT_TRIGGER_MAP` for `'battle_complete'` event in `achievementService.ts`
    - Add four new achievement rows: "Daft Punk" (2v2 first win, threshold 1, easy), "Twins!" (2v2 mastery, threshold 25, hard), "Three Laws Safe" (3v3 first win, threshold 1, easy), "Voltron" (3v3 mastery, threshold 25, hard)
    - Update C18 "Autobots, Roll Out!" `checkAllModesWin` to require wins in 4 categories: any league (1v1/2v2/3v3), tag team, any tournament, KotH
    - Update C18 description to enumerate the four categories
    - Preserve existing C18 holders (no revocation)
    - _Requirements: R16.1–R16.7_

  - [x] 14.2 Write unit tests for achievement integration
    - Extend `tests/services/achievement/achievementService.test.ts`
    - Test new trigger types fire on team battle win
    - Test C18 updated logic: requires all 4 categories
    - Test existing C18 holders retain achievement
    - Test player without C18 must have wins in all 4 categories
    - _Requirements: R16.1–R16.7_

- [x] 15. Seeded user generation

  - [x] 15.1 Extend seeded user generation for team battles
    - Add `createLeague2v2` and `createLeague3v3` boolean flags to `TierConfig` interface in `tierConfig.ts`
    - Set values on every existing tier row in `TIER_CONFIGS`
    - Grant Booking Office L1 (cap 4) to stables with 2+ robots
    - Implement subscription assignment rules per stable size (1-robot: L0 cap 3; 2-robot: L1 cap 4 with team modes; 3-robot: L1 cap 4 prioritising league_3v3)
    - Register teams from subscribed pool using same validation path as player-initiated registration (R15.5)
    - Assign teams to initial league tier via `leagueEngine.ts` with `teamBattleAdapter` (R15.6)
    - Extend `TieredGenerationResult` with `league2v2TeamsCreated` and `league3v3TeamsCreated` fields
    - Handle registration failures gracefully: log and skip, continue (R15.8)
    - _Requirements: R15.1–R15.8_

  - [x] 15.2 Write unit tests for seeded user generation
    - Extend user generation tests
    - Test subscription assignment rules per stable size
    - Test team creation from subscribed pool
    - Test Booking Office L1 grant for 2+ robot stables
    - Test graceful failure handling on registration errors
    - Test `league2v2TeamsCreated` and `league3v3TeamsCreated` counts
    - _Requirements: R15.1–R15.8_

- [x] 16. Checkpoint - Backend complete
  - Ensure all backend tests pass (`cd app/backend && npm test`), all property tests pass, no lint errors. Ask the user if questions arise.

- [x] 17. Frontend: Unified Team Battles page and team management

  - [x] 17.1 Create unified `/team-battles` page with tabs
    - Create `app/frontend/src/pages/TeamBattlesPage.tsx` with tabs: Tag Team, 2v2 League, 3v3 League
    - Register route `/team-battles` in `App.tsx`
    - Redirect `/tag-teams` → `/team-battles?tab=tag-team` (preserve existing links)
    - Redirect `/tag-teams/standings` → `/team-battles?tab=tag-team`
    - Reuse `TagTeamManagementPage.tsx` and `TagTeamStandingsPage.tsx` as tab content components
    - Mobile responsive: stacked tabs on < 1024px, touch targets ≥ 44px
    - _Requirements: R9.8, R9.12, R9.17_

  - [x] 17.2 Implement team management view (register, swap, rename, disband)
    - Per-tab team management: view current members with stats, swap member (robot picker filtered by subscription), rename (safeName validated, 3–32 chars), disband (confirmation modal)
    - Disable swap/disband when team is locked for battle
    - "Register a Team" affordance per type when stable doesn't own a team of that type
    - Robot picker only shows robots with corresponding subscription
    - Empty-state placeholders when no team registered
    - Mobile responsive: vertical layout, touch-friendly controls
    - _Requirements: R9.8, R9.10, R9.18_

  - [x] 17.3 Update navigation bar
    - Replace/rename "Tag Teams" nav entry with "Team Battles" linking to `/team-battles`
    - Ensure no duplicate nav entries
    - _Requirements: R9.17_

- [x] 18. Frontend: League standings and battle pages

  - [x] 18.1 Extend League Standings page with mode selector
    - Add mode selector (tabs or dropdown) to `LeagueStandingsPage.tsx`: "1v1 League", "2v2 League", "3v3 League"
    - 2v2/3v3 views show team standings: team name, stable name, Team_LP, Team_ELO, W/L/D
    - Use same table component and tier/instance selector pattern as 1v1
    - Default view remains 1v1 League
    - Mobile responsive: horizontal scroll on narrow viewports
    - _Requirements: R9.19_

  - [x] 18.2 Extend Battle page with team battle sections
    - Add "Recent Matches" section for 2v2 and 3v3 League (last 5 per size): opponent team name, outcome, Team_LP delta, timestamp
    - Add "Upcoming Matches" section showing scheduled matches: opponent name (or "Bye"), scheduled time, team size
    - Display Team_Battle_League standings (rank and Team_LP) for both sizes
    - Empty-state placeholders when no standings/matches exist (R9.9, R9.10)
    - Mobile responsive: stacked cards
    - _Requirements: R9.1, R9.9, R9.10, R9.13, R9.14_

  - [x] 18.3 Extend Battle Detail page for N-robot team battles
    - Extend `BattleDetailPage.tsx` to render team battle logs with 2N participants grouped by team
    - Show per-robot stats: damageDealt, damageTaken, finalHP, survivalSeconds
    - Show team-level metrics: focus fire total, ally support total, formation defence total, Team_LP delta, Team_ELO delta
    - Extend existing log viewer component to handle team battle log schema without breaking 1v1/tag team rendering
    - Mobile responsive: vertical team grouping on narrow viewports
    - _Requirements: R9.4, R9.20_

  - [x] 18.4 Extend Battle History with team battle filter
    - Add "2v2 League" and "3v3 League" to battle-mode filter options on Battle History page
    - Mutually-exclusive filter: "All" (default), "Tag Team", "2v2 League", "3v3 League", plus existing modes
    - _Requirements: R9.5_

- [x] 19. Frontend: Robot detail and robots page

  - [x] 19.1 Extend Robot Detail page with team battle data
    - Add Team Battle history section per team_size: opponent team name, outcome, damageDealt, damageTaken, finalHP, survivalSeconds, Team_LP delta, Team_ELO delta (most-recent-first, 50 per page)
    - Add league history graph per team league (2v2 and/or 3v3): Team_ELO and Team_LP over time, same chart component as 1v1
    - Empty-state placeholder when no team battle history (R9.11)
    - _Requirements: R9.3, R9.11, R9.15_

  - [x] 19.2 Extend Robots page with team membership chips and stats
    - Add team membership chips on robot cards: "Tag Team", "2v2 League", "3v3 League" (independent chips per membership)
    - Add 2v2/3v3 battle performance stats: win rate, total wins, total battles (derived from `totalLeague2v2Wins`/`totalLeague3v3Wins` and BattleParticipant counts)
    - No chip displayed if robot has no team membership
    - _Requirements: R9.2, R9.16_

- [x] 20. Frontend: Dashboard, stable view, and supporting pages

  - [x] 20.1 Add dashboard readiness warning
    - Add `TeamBattleReadinessWarning` component (same pattern as `TagTeamReadinessWarning`)
    - Show warning when any 2v2/3v3 team has ineligible member (not subscribed, not battle-ready, destroyed)
    - Link to `/team-battles` management page
    - _Requirements: R9.23_

  - [x] 20.2 Extend Stable View with team battle statistics
    - Add team battle stats to "Stable Statistics" section: total team battles, team battle wins, team battle win rate
    - Derived from stable's teams' win/loss/draw records
    - _Requirements: R9.22_

  - [x] 20.3 Extend Cycle Summary with team battle credits
    - Include team battle credits in `battleCredits` breakdown on `CycleSummaryPage.tsx`
    - No separate line item — flows into same `totalCreditsEarned` metric
    - _Requirements: R9.21_

  - [x] 20.4 Extend Hall of Records with team battle records
    - Add Team Battle records section per team_size: fastest victory, longest survival, most damage dealt, most decisive victory, longest non-draw battle (top 10 each)
    - Cache using existing `TimedCache` instance in `records.ts`
    - Extend backend `records.ts` route to return team battle records alongside existing
    - Frontend renders using same component pattern as existing records
    - _Requirements: R9.6_

  - [x] 20.5 Add match notification for team battles
    - Emit notification on team battle completion: team_size, outcome, opponent team name (or "Bye"), Team_LP delta
    - _Requirements: R9.7_

  - [x] 20.6 Extend achievement progress UI for new trigger types
    - Render `league_2v2_wins` and `league_3v3_wins` progress in achievement UI (current value, target, label, best-robot highlight)
    - Extend best-robot-selection helper to recognise new trigger types
    - Use same component pattern as `tag_team_wins` progress
    - _Requirements: R16.8_

- [x] 21. Frontend: Admin portal extensions

  - [x] 21.1 Extend admin Battles page with team battle support
    - Add `league_2v2` and `league_3v3` to `battleType` filter dropdown
    - Add "Team Size" column to battle table
    - Render team battle logs with N robots grouped by team in expandable log viewer
    - Reject invalid filter values gracefully (R11.4)
    - _Requirements: R11.2, R11.3, R11.4, R11.5_

  - [x] 21.2 Extend admin League Health page
    - Add 2v2 League and 3v3 League sections: per-tier team counts, instance counts, avg ELO, needs-rebalancing indicators
    - Use same table component and layout as existing 1v1 league health
    - _Requirements: R11.6_

  - [x] 21.3 Extend admin League History page
    - Add `team_battle` entity type filter for 2v2/3v3 tier changes (promotions/demotions)
    - Show team promotions/demotions alongside existing 1v1 and tag team history
    - _Requirements: R11.7_

  - [x] 21.4 Extend admin Cycle Controls page
    - Replace "Reserved" badges for `team_2v2_league` and `team_3v3_league` with active "Run" buttons
    - Show last-run timestamp and match count for both new slots
    - Bulk cycle results summary displays match counts and success/failure for both new modes
    - _Requirements: R11.8, R11.9_

  - [x] 21.5 Write frontend tests for admin pages
    - Test battle filter includes new types
    - Test league health renders 2v2/3v3 sections
    - Test cycle controls shows active buttons (not reserved badges)
    - _Requirements: R11.2–R11.9_

- [x] 22. Frontend tests

  - [x] 22.1 Write frontend component and page tests
    - `tests/components/TeamBattleRegistration.test.tsx`: team registration form per size
    - `tests/pages/TeamBattleStandings.test.tsx`: team standings page
    - `tests/pages/BattleDetail.test.tsx`: N-robot grouped display
    - `tests/components/RobotCard.test.tsx`: team membership chips (3 chips for robot in all 3 team types)
    - `tests/routing/redirects.test.tsx`: `/tag-teams` redirect to `/team-battles`
    - All component tests include viewport assertions for mobile responsiveness (no horizontal overflow, touch targets ≥ 44px)
    - _Requirements: R9.1–R9.24_

- [x] 23. Checkpoint - Frontend complete
  - Ensure all frontend tests pass (`cd app/frontend && npm test`), no lint errors, mobile responsiveness verified. Ask the user if questions arise.

- [x] 24. In-game guides and documentation

  - [x] 24.1 Create in-game guide for Team Battles
    - Create `src/content/guide/team-battles/overview.md`
    - Content: explanation of 2v2/3v3 League, Team Coordination ally effects, daily cadence, subscription requirement, team registration flow, eligibility rules
    - _Requirements: R12.6_

  - [x] 24.2 Update Booking Office guide and rename old event names
    - Update `src/content/guide/facilities/booking-office.md`: list `league_2v2` and `league_3v3` alongside renamed `league_1v1`, `tournament_1v1`, `tag_team`, `koth`
    - Update all guides referencing old event names `league` or `tournament` → `league_1v1` and `tournament_1v1` (including `src/content/guide/getting-started/daily-cycle.md`)
    - _Requirements: R12.9, R12.10_

  - [x] 24.3 Update technical documentation
    - `docs/game-systems/PRD_MATCHMAKING.md`: add "## Team Battle Matchmaking" section
    - `docs/architecture/COMBAT_FORMULAS.md`: add "## Team Battle Engine" section with coordination formulas
    - `docs/architecture/PRD_SERVICE_DIRECTORY.md`: add `services/team-battle/` directory listing with file descriptions
    - `docs/guides/DEPLOYMENT.md`: add deploy order Spec 35 → Spec 36 → Spec 37
    - _Requirements: R12.1, R12.2, R12.8, R17.3_

  - [x] 24.4 Update steering files and backlog
    - `.kiro/steering/game-mechanics-reference.md`: add "2v2 League" and "3v3 League" to battle modes list
    - `.kiro/steering/project-overview.md`: add "Team Battle Mode" to Key Systems list
    - `docs/BACKLOG.md`: mark item #31 complete, reference this spec
    - Ensure codebase uses "Tag Team" exclusively for phased mode and "Team Battle" exclusively for simultaneous mode (terminology enforcement)
    - _Requirements: R1.6, R12.3, R12.4, R12.5, R17.1, R17.2_

  - [x] 24.5 Create changelog entry
    - Create changelog entry via in-game changelog system: list both new modes, Team Coordination Attribute changes, event type renames, link to in-game guide
    - _Requirements: R12.7_

- [x] 25. Integration tests and race condition stress test

  - [x] 25.1 Write integration test for full cycle with team battles
    - Run bulk cycle, verify Battle records with `league_2v2` and `league_3v3` exist in same cycle
    - Verify subscription migration: no rows with old `event_type` values remain
    - Verify tag team unchanged: zero functional diffs in tag team execution
    - _Requirements: R3.11, R3.12, R14.2, R14.6_

  - [x] 25.2 Write race condition stress test
    - Jest test firing 50 parallel "register team / change member / matchmake / simulate / settle rewards" cycles
    - Assert: no team has more/fewer than required member count, no robot on two same-size teams, no BattleParticipant links to robot not in producing team, total currency change equals sum of expected reward deltas
    - _Requirements: R13.7, R10.3_

- [x] 26. Final verification
  - [x] 26.1 Run Verification Criteria from requirements
    - Run all 30 verification checks from the requirements document:
    - `npx prisma migrate status` — no drift
    - `psql` checks for `team_battle`, `team_battle_member`, `scheduled_team_battle_match` tables with correct columns and constraints
    - `grep` checks for `battleType` values, `registerSubscribableEvent` calls, `combatSimulator` imports, shared module imports
    - `cd app/backend && npm test -- team-battle` — all backend tests pass
    - `cd app/backend && npm test -- teamCoordination.property` — property tests pass
    - `cd app/frontend && npm test -- TeamBattle` — frontend tests pass
    - `grep` checks for locking predicates, roster eligibility filter, admin endpoints, seeded generation, achievements
    - `grep` checks for documentation updates (PRD_MATCHMAKING, COMBAT_FORMULAS, steering files, BACKLOG, SERVICE_DIRECTORY, DEPLOYMENT)
    - Verify no reserved-slot stubs remain in cycleScheduler
    - Verify no rows with old event_type values (`league`, `tournament`) in code
    - Verify documentation gate: all R12.1–R12.10 updates present (R12.11)
    - _Requirements: R1.1–R17.4, R12.11 (all verification criteria)_

## Notes

- All tasks are mandatory — no optional tasks per project spec quality standards
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The event naming migration (task 1.1) must run first as all subsequent code depends on the new identifiers
- Frontend tasks (17–22) can run in parallel with backend tasks where no API dependency exists
- The final verification task (26.1) runs all 30 verification criteria from the requirements document

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "6.2"] },
    { "id": 3, "tasks": ["1.5", "4.1", "5.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "5.2", "5.3"] },
    { "id": 5, "tasks": ["6.1", "11.1"] },
    { "id": 6, "tasks": ["6.3", "6.4", "6.5", "6.6", "11.2"] },
    { "id": 7, "tasks": ["8.1", "9.1", "10.2"] },
    { "id": 8, "tasks": ["8.2", "8.3", "8.4", "9.2", "9.3"] },
    { "id": 9, "tasks": ["10.1"] },
    { "id": 10, "tasks": ["10.3", "12.1", "12.2", "12.4"] },
    { "id": 11, "tasks": ["12.3", "12.5", "13.1", "13.2", "14.1"] },
    { "id": 12, "tasks": ["14.2", "15.1"] },
    { "id": 13, "tasks": ["15.2", "17.1", "17.3"] },
    { "id": 14, "tasks": ["17.2", "18.1", "18.4", "19.2"] },
    { "id": 15, "tasks": ["18.2", "18.3", "19.1", "20.1", "20.2", "20.3"] },
    { "id": 16, "tasks": ["20.4", "20.5", "20.6", "21.1", "21.2"] },
    { "id": 17, "tasks": ["21.3", "21.4", "21.5", "22.1"] },
    { "id": 18, "tasks": ["24.1", "24.2", "24.3", "24.4", "24.5"] },
    { "id": 19, "tasks": ["25.1", "25.2"] },
    { "id": 20, "tasks": ["26.1"] }
  ]
}
```
