# Implementation Plan: King of the Hill

## Overview

Implement the King of the Hill (KotH) zone-control battle mode for Armoured Souls. The implementation follows a bottom-up approach: database schema first, then core engine logic, matchmaking, orchestrator integration, cycle scheduling, API endpoints, frontend components, and finally documentation updates. Each task builds incrementally on previous work, with property-based tests (fast-check, 100+ iterations) validating correctness properties from the design document.

## Tasks

- [x] 1. Database schema and model changes
  - [x] 1.1 Create Prisma migration for KotH tables and Robot model extensions
    - Add `ScheduledKothMatch` model with fields: id, scheduledFor, status, battleId, rotatingZone, scoreThreshold, timeLimit, zoneRadius, createdAt, indexes on (scheduledFor, status) and (status)
    - Add `ScheduledKothMatchParticipant` model with fields: id, matchId, robotId, unique constraint on (matchId, robotId), indexes on matchId and robotId
    - Extend `Robot` model with 8 KotH cumulative stat fields: kothWins, kothMatches, kothTotalZoneScore, kothTotalZoneTime, kothKills, kothBestPlacement, kothCurrentWinStreak, kothBestWinStreak
    - Add `kothMatchParticipations` relation on Robot model
    - Add `scheduledKothMatch` relation on Battle model
    - Add `'koth'` to any battleType enums or union types
    - Run `npx prisma migrate dev` to generate and apply migration
    - _Requirements: 19.8, 22.1_

  - [x] 1.2 Write unit tests for schema integrity
    - Verify ScheduledKothMatch and ScheduledKothMatchParticipant tables exist with correct columns
    - Verify Robot model has all 8 KotH stat fields with correct defaults
    - Verify unique constraint on (matchId, robotId) in ScheduledKothMatchParticipant
    - _Requirements: 19.8, 22.1_

- [x] 2. KotH Engine — Core zone mechanics and scoring
  - [x] 2.1 Implement zone management and spawn positioning
    - Create `prototype/backend/src/services/arena/kothEngine.ts`
    - Implement `createControlZone(config)` returning an `ArenaZone` with `effect: 'control_point'`, center `{x:0, y:0}`, default radius 5, constrained [3, 8]
    - Implement `calculateSpawnPositions(participantCount, arenaRadius)` distributing robots at (arenaRadius - 2) distance with equal angular spacing (72° for 5, 60° for 6)
    - Implement `validateKothConfig(config)` validating: participantCount [5,6], scoreThreshold [15,90], timeLimit [60,300], zoneRadius [3,8], returning `{ valid, errors[] }`
    - Implement `evaluateZoneOccupation(robots, zone)` computing Euclidean distance per robot, returning occupants set and state (uncontested/contested/empty)
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.5, 11.4, 11.5_

  - [x] 2.2 Write property test: Zone occupation by Euclidean distance (Property 1)
    - **Property 1: Zone occupation is determined by Euclidean distance**
    - Generate random positions, zone centers, radii; verify occupant set matches distance condition
    - **Validates: Requirements 2.1, 2.2, 2.5**

  - [x] 2.3 Write property test: Spawn position geometry (Property 23)
    - **Property 23: Spawn positions are equidistant and equally spaced**
    - For participant counts 5 and 6, verify all positions at distance (arenaRadius - 2) with equal angular spacing
    - **Validates: Requirements 1.3**

  - [x] 2.4 Write property test: Config validation (Property 21)
    - **Property 21: Config validation accepts valid ranges and rejects invalid**
    - Generate random config values; verify valid ranges accepted, invalid ranges rejected with descriptive errors
    - **Validates: Requirements 1.5, 4.7, 11.4, 11.5**

  - [x] 2.5 Implement scoring system and kill bonus
    - Implement `tickScoring(scoreState, zoneState, occupationResult, deltaTime)` awarding 0.1 points per tick (1 pt/sec) for uncontested, 0 for contested/empty
    - Implement `awardKillBonus(scoreState, killerRobotId, victimRobotId)` awarding exactly 5 points and emitting `kill_bonus` event
    - Implement `score_tick` event emission every 1 second of game time with all Zone_Scores and zone state
    - Track Zone_Score per robot in `GameModeState.zoneScores`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 2.6 Write property test: Uncontested scoring rate (Property 3)
    - **Property 3: Uncontested zone scoring accumulates at 1 point per second**
    - Generate random tick counts with single occupant; verify score increases by exactly T points over T seconds
    - **Validates: Requirements 3.1, 3.5**

  - [x] 2.7 Write property test: No scoring when contested or empty (Property 4)
    - **Property 4: No points awarded when zone is contested or empty**
    - Generate random ticks with 0 or 2+ occupants; verify no zone score increase
    - **Validates: Requirements 3.2, 3.3**

  - [x] 2.8 Write property test: Kill bonus (Property 5)
    - **Property 5: Kill bonus awards exactly 5 points and emits event**
    - Generate random kill events; verify exactly 5 points added and event emitted
    - **Validates: Requirements 3.4, 3.7**

  - [x] 2.9 Implement win condition evaluator
    - Implement `KothWinConditionEvaluator` class implementing `WinConditionEvaluator` interface
    - Check score threshold reached → `ended: true`, reason `'score_threshold'`
    - Check all-but-one eliminated → enter last-standing phase (10s window)
    - Check last-standing timer expired → highest score wins, reason `'last_standing'`
    - Check time limit reached → highest score wins, reason `'time_limit'`
    - Implement tiebreaker: zone occupation time → damage dealt
    - Implement final placement ordering: Zone_Score desc → zone time desc → damage desc
    - Emit `last_standing` event with survivor identity, scores, countdown
    - Emit `match_end` event with winner, final scores, placements, duration, win reason
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

  - [x] 2.10 Write property test: Score threshold triggers immediate match end (Property 6)
    - **Property 6: Score threshold triggers immediate match end**
    - Generate random score states near threshold; verify `ended: true` with correct winner on the same tick
    - **Validates: Requirements 4.2**

  - [x] 2.11 Write property test: Final placement ordering (Property 7)
    - **Property 7: Final placement is ordered by Zone_Score with correct tiebreakers**
    - Generate random sets of robot scores/times/damage; verify placement order: score desc → zone time desc → damage desc
    - **Validates: Requirements 4.4, 4.5, 4.12**

  - [x] 2.12 Write property test: Last standing phase (Property 8)
    - **Property 8: Last standing phase gives exactly 10 seconds then ends**
    - Generate random elimination sequences leaving 1 robot; verify 10s window and highest score wins
    - **Validates: Requirements 4.8, 4.9**

- [x] 3. Checkpoint — Core zone mechanics and scoring
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. KotH Engine — AI strategies and elimination
  - [x] 4.1 Implement zone-aware target priority strategy
    - Implement `KothTargetPriorityStrategy` class implementing `TargetPriorityStrategy` interface
    - Zone contesters: 3.0× weight, zone approachers: 2.0× weight, others: 1.0× base
    - Inside zone uncontested: prioritize approachers over distant non-approaching robots
    - Inside zone contested: prioritize lowest HP contester
    - Outside zone: 1.5× weight for approaching opponents
    - threatAnalysis scaling: ta < 10 → 50%, ta 10–30 → linear 50%–100%, ta > 30 → 100%
    - Include zone targeting context in formula breakdown
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 4.2 Write property test: Zone-aware target priority weights (Property 9)
    - **Property 9: Zone-aware target priority weights scale correctly**
    - Generate random robot positions and threatAnalysis values; verify weight assignments and scaling
    - **Validates: Requirements 5.2, 5.3, 5.5, 5.6**

  - [x] 4.3 Write property test: Contested zone lowest HP priority (Property 10)
    - **Property 10: Contested zone prioritizes lowest HP contester**
    - Generate random HP values for zone contesters; verify lowest HP is highest priority
    - **Validates: Requirements 5.4**

  - [x] 4.4 Implement zone-biased movement intent modifier
    - Implement `KothMovementIntentModifier` class implementing `MovementIntentModifier` interface
    - No opponent within 6 units → move toward zone center, bias 30% at ta=1 to 100% at ta=50
    - Inside zone uncontested, no opponent within 8 units → hold position
    - combatAlgorithms > 25 + zone contested by 2 others → wait-and-enter (hold 2 units outside zone edge)
    - Opponent within 4 units and attacking → preserve base combat AI movement
    - Include zone movement bias data in formula breakdown
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 4.5 Write property test: Movement bias scaling (Property 11)
    - **Property 11: Zone movement bias scales with threatAnalysis**
    - Generate random threatAnalysis values and opponent distances; verify bias strength interpolation
    - **Validates: Requirements 6.2, 6.3**

  - [x] 4.6 Write property test: Wait-and-enter tactic (Property 12)
    - **Property 12: Wait-and-enter tactic activates for high combatAlgorithms**
    - Generate random combatAlgorithms values and zone states; verify hold position outside zone edge
    - **Validates: Requirements 6.4**

  - [x] 4.7 Write property test: Active combat preserves movement (Property 13)
    - **Property 13: Active combat preserves base movement AI**
    - Generate random opponent distances and attack states; verify base movement not overridden when opponent within 4 units attacking
    - **Validates: Requirements 6.5**

  - [x] 4.8 Implement yield, destruction, and permanent elimination
    - Handle yield: permanently remove robot, no Kill_Bonus, record Zone_Score at elimination
    - Handle destruction (HP=0): permanently remove robot, award Kill_Bonus to destroyer, record Zone_Score
    - Immediately remove eliminated robot from zone occupant set (may change contested → uncontested)
    - Emit `robot_eliminated` event with identity, reason (destroyed/yielded), Zone_Score, timestamp
    - Track eliminated robots in `GameModeState.customData.eliminatedRobots`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 4.9 Write property test: Yield vs destruction kill bonus (Property 14)
    - **Property 14: Yield does not award kill bonus; destruction does**
    - Generate random elimination events; verify yield → no bonus, destruction → 5 points
    - **Validates: Requirements 7.2, 7.3, 7.4**

  - [x] 4.10 Write property test: Elimination updates zone occupants (Property 15)
    - **Property 15: Elimination inside zone immediately updates occupant set**
    - Generate random eliminations inside zone; verify occupant set updated same tick
    - **Validates: Requirements 7.5**

  - [x] 4.11 Write property test: Eliminated score preserved (Property 16)
    - **Property 16: Eliminated robot's score is preserved for placement**
    - Generate random elimination sequences with scores; verify preserved scores used in placement
    - **Validates: Requirements 7.6**

  - [x] 4.12 Write property test: Zone transition events (Property 2)
    - **Property 2: Zone transitions emit correct events**
    - Generate sequences of robot positions crossing zone boundary; verify exactly one zone_enter or zone_exit event per transition
    - **Validates: Requirements 2.3, 2.4**

- [x] 5. KotH Engine — Rotating zone and anti-passive mechanics
  - [x] 5.1 Implement rotating zone variant
    - Implement `generateNextZonePosition(matchId, rotationCount, currentCenter, arenaRadius, zoneRadius)` using deterministic seed
    - Constrain new positions: ≥6 units from arena boundary, ≥8 units from previous position
    - Fallback to arena center after 100 failed attempts
    - Implement zone transition: emit `zone_moving` warning 5s before, 3s inactive transition period, emit `zone_active` after
    - Rotating variant defaults: scoreThreshold=45, timeLimit=210
    - Track rotation count and transition state in `KothZoneState`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 5.2 Write property test: Rotating zone distance constraints (Property 17)
    - **Property 17: Rotating zone positions satisfy distance constraints**
    - Generate random matchIds and rotation counts; verify ≥6 from boundary and ≥8 from previous
    - **Validates: Requirements 8.5**

  - [x] 5.3 Write property test: Zone position determinism (Property 18)
    - **Property 18: Zone position generation is deterministic**
    - Generate random matchIds; call twice with same inputs; verify identical output
    - **Validates: Requirements 8.6**

  - [x] 5.4 Write property test: Rotating zone default thresholds (Property 19)
    - **Property 19: Rotating zone adjusts default thresholds**
    - Generate random configs with rotatingZone flag; verify 45/210 for rotating, 30/150 for fixed
    - **Validates: Requirements 8.7**

  - [x] 5.5 Implement anti-passive penalty system
    - Implement `tickPassivePenalties(scoreState, robots, zone, deltaTime)` tracking consecutive time outside zone per robot
    - 20s outside → emit `passive_warning` event
    - 30s outside → activate damage reduction: 3% per 5s, capped at 30%
    - 60s outside → additional 15% accuracy penalty
    - On zone entry: decay penalty linearly over 3s, reset timer to 0
    - Track passive timers in `GameModeState.customData.passiveTimers`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x] 5.6 Write property test: Passive penalty scaling (Property 20)
    - **Property 20: Passive penalties scale correctly with time outside zone**
    - Generate random time-outside-zone values; verify penalty thresholds, damage reduction formula, accuracy penalty at 60s, and decay on zone entry
    - **Validates: Requirements 10.4, 10.5, 10.7, 10.8**

  - [x] 5.7 Implement buildKothGameModeConfig and buildKothInitialState
    - Implement `buildKothGameModeConfig(config)` assembling complete `GameModeConfig` with all strategy implementations, arena zone, and maxDuration
    - Implement `buildKothInitialState(config, robotIds)` initializing `GameModeState` with `mode: 'zone_control'`, zoneScores at 0, customData with zone occupants, elimination state, passive timers
    - Wire all components: KothTargetPriorityStrategy, KothMovementIntentModifier, KothWinConditionEvaluator, control zone in arenaZones array
    - _Requirements: 11.1, 11.2, 11.3, 11.6, 11.7_

  - [x] 5.8 Write property test: GameModeConfig completeness (Property 22)
    - **Property 22: buildKothGameModeConfig produces complete valid config**
    - Generate random valid configs; verify all strategy objects non-null, arenaZones has exactly one control_point, maxDuration matches time limit, initial state has mode 'zone_control' with zeroed scores
    - **Validates: Requirements 1.4, 11.1, 11.2, 11.6**

- [x] 6. Checkpoint — KotH Engine complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. KotH combat events and message templates
  - [x] 7.1 Define KotH event types and combat result metadata
    - Add KotH event types to CombatEvent type union: zone_defined, zone_enter, zone_exit, score_tick, kill_bonus, zone_moving, zone_active, robot_eliminated, passive_warning, passive_penalty, last_standing, match_end
    - Ensure CombatResult includes KotH metadata: final Zone_Scores, placement order, zone occupation times, uncontested times, zone entries/exits, kill counts, elimination statuses, match duration
    - Include zone state in position update events
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 7.2 Create KotH combat message templates
    - Add message templates to combat message generator for all KotH event categories
    - zone_enter: "{robotName} enters the control zone" with contested/uncontested variants
    - zone_exit: voluntary exit vs forced exit variants
    - score_tick: "{robotName} holds the zone unopposed" / "The zone is contested"
    - kill_bonus: "{robotName} eliminates {opponentName} and earns a kill bonus of 5 points"
    - robot_eliminated: destroyed/yielded variants with placement info
    - passive_warning/passive_penalty: damage and accuracy penalty variants
    - zone_moving/zone_active: rotating zone transition messages
    - last_standing: "{robotName} is the last robot standing — 10 seconds to score"
    - match_end: winner declaration with win reason and final scores
    - Provide at least 3 message variants per event category
    - _Requirements: 12.6, 12.7_

- [x] 8. KotH Matchmaking Service
  - [x] 8.1 Implement kothMatchmakingService.ts
    - Create `prototype/backend/src/services/kothMatchmakingService.ts`
    - Implement `getEligibleRobots()`: query robots with weapon readiness, not already scheduled for KotH, one robot per stable (highest ELO per user)
    - Implement `distributeIntoGroups(robots, groupCount)`: snake-draft distribution sorting by ELO descending, groups of 6 first, remainder of 5
    - Implement `runKothMatchmaking(scheduledFor)`: orchestrate eligibility → grouping → ScheduledKothMatch + participant record creation
    - Determine zone variant by day of week: Mon/Fri → fixed, Wed → rotating
    - Handle edge cases: fewer than 5 eligible → skip with log, enforce one-robot-per-stable-per-match
    - Return number of matches created
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 17.1, 17.2, 17.3, 17.4, 18.7, 18.8_

  - [x] 8.2 Write property test: ELO-balanced groups with one per stable (Property 26)
    - **Property 26: Matchmaking produces ELO-balanced groups with one robot per stable**
    - Generate random robot lists with ELOs and userIds; verify group sizes 5-6, no duplicate stables per group, minimized ELO variance
    - **Validates: Requirements 16.3, 16.5**

  - [x] 8.3 Write property test: Eligibility filtering (Property 27)
    - **Property 27: Only eligible robots are selected for matchmaking**
    - Generate random robots with various weapon/schedule states; verify only eligible robots pass
    - **Validates: Requirements 16.4, 16.6, 17.1, 17.2**

  - [x] 8.4 Write unit tests for matchmaking edge cases
    - Test: exactly 5 eligible → one group of 5
    - Test: exactly 6 eligible → one group of 6
    - Test: 11 eligible → one group of 6 + one group of 5
    - Test: 12 eligible → two groups of 6
    - Test: 4 eligible → no matches, log message
    - Test: user with 3 robots → only highest ELO selected
    - Test: Monday → fixed zone, Wednesday → rotating zone, Friday → fixed zone
    - Test: robot already scheduled → excluded
    - _Requirements: 16.3, 17.2, 18.7_

- [x] 9. Battle Orchestrator KotH Extension
  - [x] 9.1 Extend battleOrchestrator.ts with KotH execution path
    - Add `executeScheduledKothBattles(scheduledFor?)` function querying ScheduledKothMatch with status 'scheduled'
    - Implement `processKothBattle(match)` per-match pipeline: load participants with weapons → reset HP/shield → build KothMatchConfig → buildKothGameModeConfig → simulateBattle → determine placements → create Battle record (robot1Id=1st, robot2Id=2nd, battleType='koth', eloChange=0) → create BattleParticipant records for all 5-6 robots → calculate rewards → award credits/fame/prestige → award streaming revenue → update cumulative KotH stats → log audit events → mark match 'completed'
    - Implement `calculateKothRewards(placement, zoneScore, totalUncontestedScore)` with tiered rewards and zone dominance bonus (+25% at >75% uncontested)
    - Handle failed matches: log error, mark 'failed', continue remaining
    - Return `KothBattleExecutionSummary` with totals and per-match results
    - Ensure existing league battle processing is unchanged
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

  - [x] 9.2 Implement cumulative KotH stats update logic
    - Update each robot's stats within the same DB transaction as battle result storage
    - Increment kothMatches, add Zone_Score to kothTotalZoneScore, add zone time to kothTotalZoneTime, add kills to kothKills
    - Update kothBestPlacement if current placement is better (lower number)
    - Winner: increment kothWins, increment kothCurrentWinStreak, update kothBestWinStreak if current streak exceeds it
    - Non-winners: reset kothCurrentWinStreak to 0
    - _Requirements: 22.2, 22.3, 22.4, 22.5_

  - [x] 9.3 Write property test: Placement-based rewards (Property 24)
    - **Property 24: Placement-based rewards follow tiered structure**
    - Generate random placements and zone scores; verify credit/fame/prestige tiers and zone dominance bonus
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4**

  - [x] 9.4 Write property test: ELO unchanged (Property 25)
    - **Property 25: KotH battles do not modify ELO**
    - Generate random ELO values; verify eloBefore === eloAfter for all participants, eloChange = 0
    - **Validates: Requirements 14.5**

  - [x] 9.5 Write property test: Cumulative stats update (Property 28)
    - **Property 28: Cumulative KotH stats are correctly updated after each match**
    - Generate random match results; verify all stat fields updated correctly, winner streak logic, best placement logic
    - **Validates: Requirements 22.2, 22.3**

  - [x] 9.6 Write unit tests for orchestrator edge cases
    - Test: KotH battle creates 6 BattleParticipant records
    - Test: Battle.robot1Id = 1st place, robot2Id = 2nd place
    - Test: Battle.battleType = 'koth', eloChange = 0
    - Test: zone dominance bonus at 76% uncontested → 1.25× rewards
    - Test: zone dominance bonus at 74% uncontested → no bonus
    - Test: streaming revenue awarded to all 6 participants
    - Test: failed match marked 'failed', remaining continue
    - Test: kothBestPlacement updates null→3, 3→1, but not 1→3
    - Test: kothCurrentWinStreak increments on wins, resets on non-win
    - Test: kothBestWinStreak tracks all-time best
    - _Requirements: 14.1, 14.2, 14.5, 14.9, 15.4, 15.7, 22.2, 22.3_

- [x] 10. Checkpoint — Backend services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Cycle Scheduler and Notification Integration
  - [x] 11.1 Extend cycleScheduler.ts with KotH cron job
    - Add `kothSchedule` field to `SchedulerConfig` with default `'0 16 * * 1,3,5'`
    - Add `'koth'` to `JobName` type union and `JobState` interface
    - Implement `executeKothCycle()` handler: repairAllRobots → executeScheduledKothBattles → runKothMatchmaking(nextScheduledFor) → return JobContext
    - Calculate next Mon/Wed/Fri at 16:00 UTC for scheduledFor parameter
    - Integrate into SchedulerState tracking (runningJob, queue, job state history)
    - Support manual KotH cycle trigger via admin endpoint
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [x] 11.2 Extend notification service with KotH support
    - Add `'koth'` to `JobContext.jobName` union
    - Add `matchesCompleted` field to JobContext
    - Add `'koth'` case to `buildSuccessMessage`: "King of the Hill: {N} matches completed! 👑 Click here to see the results! {link}"
    - Skip notification when matchesCompleted === 0
    - _Requirements: 28.1, 28.2, 28.3, 28.4_

  - [x] 11.3 Write property test: Notification dispatch logic (Property 29)
    - **Property 29: KotH notification dispatched only when matches were executed**
    - Generate random match counts (0 and positive); verify notification dispatched iff matchesCompleted > 0
    - **Validates: Requirements 28.3, 28.4**

- [x] 12. Backend API endpoints
  - [x] 12.1 Implement KotH standings API
    - Create `GET /api/koth/standings` endpoint with query params: view (all_time | last_10), page, limit
    - Query Robot model KotH stats, sort by kothWins desc then kothTotalZoneScore desc
    - Return ranked list with: rank, robot name, owner, kothWins, kothMatches, win rate, totalZoneScore, avgZoneScore, kothKills, bestWinStreak
    - Include summary header: total KotH events, unique participants, #1 robot
    - Support pagination
    - _Requirements: 21.2, 21.3, 21.6, 21.7, 21.8, 21.10_

  - [x] 12.2 Write property test: Standings sorting (Property 30)
    - **Property 30: KotH standings sorted by wins then zone score**
    - Generate random robot KotH stats; verify sort order: kothWins desc, kothTotalZoneScore desc
    - **Validates: Requirements 21.2**

  - [x] 12.3 Implement KotH robot analytics API
    - Create `GET /api/analytics/robot/:id/koth-performance` endpoint
    - Return cumulative KotH stats from Robot model plus derived metrics (podium rate, avg zone score)
    - Return empty/404 when robot has no KotH matches
    - _Requirements: 25.3_

  - [x] 12.4 Extend existing API endpoints for KotH
    - Extend `GET /api/records` to include `koth` category with 7 records (Most Wins, Highest Single-Match Score, Most Kills Career, Longest Win Streak, Most Zone Time Single Match, Fastest Threshold Victory, Zone Dominator)
    - Only include KotH records after 5+ KotH events completed
    - Extend `GET /api/matches/upcoming` to include scheduled KotH matches with type, zone variant, participant count, scheduled time
    - Extend `GET /api/matches/history` to include KotH battles with battleType 'koth', placement, Zone_Score, participant count, zone variant
    - Extend `GET /api/admin/battles` to support `battleType=koth` filter with all participant data
    - Create `POST /api/admin/koth/trigger` for manual KotH cycle execution (admin-only)
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 24.5, 24.6, 26.5, 27.1, 27.2, 27.6_

  - [x] 12.5 Write unit tests for API endpoints
    - Test standings endpoint returns correct sort order and pagination
    - Test robot analytics returns KotH stats and derived metrics
    - Test records endpoint includes koth category only after 5+ events
    - Test upcoming matches includes KotH matches
    - Test history includes KotH battles with correct metadata
    - Test admin battles filter by battleType=koth
    - Test admin trigger endpoint requires admin role
    - _Requirements: 21.7, 23.3, 23.5, 24.5, 24.6, 27.2, 27.6_

- [x] 13. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Frontend — KotH Standings Page
  - [x] 14.1 Create KotH Standings page component and route
    - Create `KothStandingsPage.tsx` at route `/koth-standings`, linked from main navigation under Competitive category
    - Follow `LeagueStandingsPage.tsx` pattern for layout and data fetching
    - Ranked table with columns: Rank, Robot Name, Owner, KotH Wins, Matches, Win Rate, Total Zone Score, Avg Zone Score, Kills, Best Streak
    - Medal colors (gold/silver/bronze) for top 3, blue highlight for current user's robots
    - Summary header: total events, unique participants, #1 robot
    - Filter toggle: "All Time" / "Last 10 Events"
    - Pagination following League Standings pattern
    - Responsive: full table on desktop, condensed card view on mobile
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.8, 21.9, 21.10_

  - [x] 14.2 Write unit tests for KotH Standings page
    - Test correct sort order with medal colors for top 3
    - Test blue highlight for current user's robots
    - Test filter toggle between All Time and Last 10 Events
    - _Requirements: 21.2, 21.4, 21.5, 21.10_

- [x] 15. Frontend — Dashboard KotH Match Cards
  - [x] 15.1 Extend dashboard with KotH match cards
    - Extend UpcomingMatches component: KotH cards with 👑 icon, orange left border (#F97316), "King of the Hill" label (or "KotH — Rotating Zone"), robot name, opponent list, participant count, scheduled time
    - Extend RecentMatches component: KotH cards with 👑 icon, orange border, placement ("1st of 6" with medal color), Zone_Score, credits earned, "View Battle" link
    - Adapt CompactBattleCard from head-to-head to event-based layout for KotH
    - Show one card per match when user has multiple robots in different groups
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.7, 24.8_

  - [x] 15.2 Write unit tests for KotH match cards
    - Test CompactBattleCard renders 👑 icon and orange border for KotH
    - Test placement badge ("1st of 6") instead of WIN/LOSS
    - _Requirements: 24.1, 24.4_

- [x] 16. Frontend — Robot Analytics KotH Section
  - [x] 16.1 Add KotH performance section to robot analytics
    - Extend `RobotPerformanceAnalytics` component with "King of the Hill Performance" section
    - Only render when `kothMatches > 0` — no empty state, no placeholder
    - Summary grid: KotH Matches, 1st Place Finishes, Podium Rate, Avg Zone Score, Total Zone Time, KotH Kills, Best Placement, Current Win Streak
    - Orange (#F97316) accent color for KotH metric values
    - Same card styling as existing performance summary (bg-surface-elevated, responsive grid)
    - Ensure league performance summary excludes KotH battles
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6_

  - [x] 16.2 Write unit tests for robot analytics KotH section
    - Test KotH section hidden when kothMatches === 0
    - Test KotH metrics display correctly with orange accent
    - _Requirements: 25.1, 25.6_

- [x] 17. Frontend — Battle History KotH Integration
  - [x] 17.1 Extend battle history page with KotH filter and cards
    - Add "KotH" option to battle type filter alongside Overall, League, Tournament
    - Add KotH view to BattleHistorySummary: total matches, placement breakdown, avg Zone_Score, total credits, total kills
    - Render KotH CompactBattleCard: 👑 icon, orange border (#F97316), placement badge, zone variant label ("Fixed Zone" / "Rotating Zone")
    - Support search by opponent robot names (all participants in same match)
    - Sort controls: date sorting by timestamp, reward sorting by credits, ELO sorting places KotH at bottom (eloChange=0)
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7_

  - [x] 17.2 Write unit tests for battle history KotH integration
    - Test "KotH" filter option present
    - Test CompactBattleCard shows 👑 icon, orange border, zone variant label
    - _Requirements: 26.1, 26.3, 26.4_

- [x] 18. Frontend — Hall of Records KotH Tab
  - [x] 18.1 Add KotH category to Hall of Records
    - Add "King of the Hill" tab with 👑 icon alongside existing categories
    - Display 7 records: Most Wins, Highest Single-Match Score, Most Kills (Career), Longest Win Streak, Most Zone Time (Single Match), Fastest Threshold Victory, Zone Dominator
    - Only show tab after 5+ KotH events completed
    - Fetch from extended `GET /api/records` with `koth` category
    - _Requirements: 23.1, 23.2, 23.5_

- [x] 19. Frontend — Battle Playback Zone Visualization
  - [x] 19.1 Extend Battle Playback Viewer with KotH zone rendering
    - Render Control_Zone as translucent circular overlay (gold/amber base color)
    - Uncontested: tint with controlling robot's color
    - Contested: pulsing red tint
    - Display scoreboard panel with real-time Zone_Scores updated on score_tick events
    - Assign 6-color palette: blue (#3B82F6), red (#EF4444), green (#22C55E), orange (#F97316), purple (#A855F7), cyan (#06B6D4) — consistent across arena, scoreboard, and all UI elements
    - Zone occupation indicators on robot icons when inside zone
    - Rotating zone: fade-out/fade-in animation on zone_moving/zone_active events
    - Elimination animation and grayed-out scoreboard entry on robot_eliminated events
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [x] 19.2 Write unit tests for battle playback zone visualization
    - Test zone overlay renders with correct color states
    - Test scoreboard updates on score_tick events
    - Test robot color assignment from 6-color palette
    - _Requirements: 13.1, 13.4, 13.8_

- [x] 20. Frontend — Admin Panel KotH Integration
  - [x] 20.1 Extend admin panel with KotH battle management
    - Add "koth" filter option to battle type dropdown on admin battles page
    - KotH battle list: match ID, date, zone variant, participant count, winner, duration, end reason
    - KotH battle detail: all participants with placement, Zone_Score, zone time, kills, elimination status, rewards
    - Include KotH in aggregate battle statistics with battle type filtering
    - Add manual KotH cycle trigger button calling `POST /api/admin/koth/trigger`
    - _Requirements: 27.1, 27.3, 27.4, 27.5, 27.6_

  - [x] 20.2 Write unit tests for admin panel KotH integration
    - Test "koth" filter option in battle type dropdown
    - Test KotH battle detail shows all participants
    - _Requirements: 27.1, 27.4_

- [x] 21. Checkpoint — Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. In-Game Guide KotH Content
  - [x] 22.1 Create KotH guide articles
    - Add "King of the Hill" section to in-game guide
    - Article: Zone control basics — Control_Zone, Zone_Occupation, Uncontested vs Contested, scoring at 1 pt/sec
    - Article: Scoring and win conditions — Score_Threshold (30), Time_Limit (150s), Kill_Bonus (5), tiebreakers, last-standing phase
    - Article: Match formats — free-for-all (5–6 robots), Rotating_Zone variant, future team modes
    - Article: KotH strategy — attribute builds (servoMotors, threatAnalysis, combatAlgorithms, hullIntegrity, armorPlating), survivability, wait-and-enter tactic
    - Article: Anti-passive mechanics — damage penalty, accuracy penalty, zone entry requirement
    - Article: Entry requirements — weapon readiness, one per stable, no league prereqs, Mon/Wed/Fri 4 PM UTC
    - Article: Rewards — credit tiers, fame, prestige, zone dominance bonus, repair costs
    - Update Combat System section to mention KotH
    - Update Weapons and Loadouts section for zone control weapon interactions
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10_

- [x] 23. Documentation updates
  - [x] 23.1 Update cross-system documentation
    - Update `COMBAT_FORMULAS.md`: zone scoring, Kill_Bonus, passive penalty, accuracy penalty, zone dominance bonus formulas
    - Update `PRD_ROBOT_ATTRIBUTES.md`: KotH attribute value shifts (servoMotors, threatAnalysis, combatAlgorithms, hullIntegrity, armorPlating)
    - Update `COMBAT_MESSAGES.md`: KotH event message templates
    - Update `PRD_MATCHMAKING.md`: KotH matchmaking section (ELO-balanced groups, one-per-stable, weapon readiness, no league restriction)
    - Update `PRD_CYCLE_SYSTEM.md`: KotH cron schedule, execution order
    - Update `PRD_ECONOMY_SYSTEM.md`: KotH rewards section
    - Update `PRD_PRESTIGE_AND_FAME.md`: KotH prestige and fame awards
    - Update `DATABASE_SCHEMA.md`: new KotH tables, extended Robot model, Battle table usage
    - Update `GAME_DESIGN.md`: KotH game mode description
    - Update `BATTLE_SIMULATION_ARCHITECTURE.md`: KotH integration with GameModeConfig extensibility
    - Update `PRD_HALL_OF_RECORDS.md`: KotH records
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 23.6_

- [x] 24. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests use fast-check with minimum 100 iterations per property
- Unit tests complement property tests with specific examples and edge cases
- All code is TypeScript (backend: Node.js/Express/Prisma, frontend: React 18/Vite/Tailwind)
- The KotH engine is pure functions + strategy classes consumed by the existing combatSimulator — no structural changes to the combat engine
