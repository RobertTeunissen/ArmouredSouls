# Implementation Plan: Grand Melee — Free-for-All Battle Mode

## Overview

This plan delivers the Grand Melee mode end-to-end. Implementation proceeds in phases: algorithmic optimizations (global) → schema + registration → orchestrator + rewards → matchmaking + standings → cron integration → frontend playback → frontend integration → achievements + hall of records → admin → guide content → documentation → verification.

## Tasks

- [ ] 1. Algorithmic optimizations to `simulateBattleMulti` (global, all modes benefit)
  - [x] 1.1 Implement `SpatialGrid` class in `app/backend/src/services/battle/combat-simulator/spatialGrid.ts`
    - Constructor takes `arenaRadius` and `maxWeaponRange`, computes `cellSize = maxWeaponRange + 10`
    - `update(states: SpatialRobotCombatState[])` — rebuilds grid from current robot positions (called once per tick)
    - `getNearby(robotIndex: number): number[]` — returns indices of robots in same cell + 8-neighbourhood
    - Private `getCellKey(pos: Position): string` — maps position to cell coordinates
    - _Requirements: R1.1, R1.2, R1.5_

  - [x] 1.2 Integrate spatial grid into `simulationLoop.ts`
    - After arena setup, compute `maxWeaponRange` across all robots (main + offhand)
    - Create `SpatialGrid` instance with `arena.radius` and `maxWeaponRange`
    - Call `grid.update(states)` at the start of each tick
    - Modify `selectTarget()` calls to pass `grid.getNearby(i)` as candidate filter instead of all alive states
    - Ensure `threatScoring.ts` `selectTarget` accepts an optional pre-filtered candidate array
    - _Requirements: R1.1, R1.2, R1.5_

  - [x] 1.3 Implement variable tick rate in `simulationLoop.ts`
    - Add per-robot `lastAITick` array tracking last full-evaluation time
    - Add constants: `SLOW_TICK_INTERVAL = 0.5`, `VARIABLE_TICK_DISTANCE = 50`, `VARIABLE_TICK_MIN_ROBOTS = 10`
    - Before PHASE 1 (MOVEMENT), for each alive robot: if N < 10, skip this logic entirely
    - If nearest opponent > 50 units AND `currentTime - lastAITick[i] < 0.5`: apply movement only (constant velocity), skip AI re-evaluation
    - Otherwise: set `lastAITick[i] = currentTime` and proceed with normal full-evaluation tick
    - _Requirements: R1.3, R1.4, R1.7_

  - [x] 1.4 Add `BattleConfig` flags for spatial partitioning and variable tick rate
    - Add `spatialPartitioning?: boolean` (default `true`) and `variableTickRate?: boolean` (default `true`) to `BattleConfig` interface
    - Guard spatial grid creation and variable tick rate logic behind these flags
    - _Requirements: R1.6_

  - [x] 1.5 Write tests for spatial grid and variable tick rate
    - Unit tests for `SpatialGrid`: known positions → verify `getNearby` correctness, edge cases (robot on cell boundary, all robots in one cell)
    - Property test (P1): For any robot pair within `maxWeaponRange + 10` units, both appear in each other's `getNearby` result
    - Property test (P2): For any robot on slow tick, position at time T = previous position + velocity × SIMULATION_TICK (movement continuity)
    - Property test (P3): For 6-robot battles with identical seeds, simulation with/without spatial grid produces same winner and same total damage per robot
    - Integration test: 20-robot simulation completes within 10 seconds wall-clock time
    - _Requirements: R1.4, R1.5, R1.7_

- [x] 2. Schema changes and type registration
  - [x] 2.1 Create Prisma migration adding `grand_melee` to enums and Robot counters
    - Add `grand_melee` to `StandingsMode` enum
    - Add `grand_melee` to `MatchType` enum
    - Add `grand_melee_wins` (Int, default 0) and `grand_melee_top3` (Int, default 0) columns to `robots` table
    - Run `pnpm exec prisma generate` to regenerate client
    - _Requirements: R4.1, R11.3, R13.3_

  - [x] 2.2 Register `grand_melee` battle type and event
    - Add `'grand_melee'` to `ALL_BATTLE_TYPES` array in `baseOrchestrator.ts`
    - Extend `SubscribableEventType` union in `eventRegistry.ts` to include `'grand_melee'`
    - Register `grand_melee` event at startup in `src/index.ts` with label `'Grand Melee'` and locking predicate (checks `scheduledMatchV2` for pending/scheduled grand_melee matches with robot as participant)
    - Add roster eligibility filter rule: `{ eventType: 'grand_melee', minRobots: 1, reason: 'Grand Melee requires at least 1 robot in your Stable' }`
    - _Requirements: R6.1, R6.2, R6.3, R6.4, R6.6, R13.1, R13.2_

  - [x] 2.3 Implement Standing creation on subscription
    - In `subscriptionService.subscribe()`, after creating the subscription for `grand_melee`, call `getOrCreateStanding('robot', robotId, 'grand_melee')` to ensure a bronze-tier standing exists
    - _Requirements: R6.5, R4.5_

- [x] 3. Grand Melee standings and league rebalancing
  - [x] 3.1 Add `awardGrandMeleePoints` to `standingsService.ts`
    - Same interface pattern as `awardKothPoints`: takes `{ robotId, placement, kills, damageDealt, survivalTime }`
    - Looks up standing with `mode = 'grand_melee'`
    - Increments LP by `GRAND_MELEE_LP_SCALE[placement - 1]`
    - Updates `totalMatches`, `totalKills`, `bestPlacement`
    - 1st place: increment `wins`, `currentWinStreak`, update `bestWinStreak`, reset `currentLoseStreak`
    - Non-1st: reset `currentWinStreak` (do NOT increment losses)
    - _Requirements: R3.1, R4.2_

  - [x] 3.2 Add Grand Melee adapter and rebalancing function to `leagueRebalancingService.ts`
    - Create `grandMeleeAdapter` via `createStandingsAdapter('grand_melee', { overrideMinLP: 0, maxPerInstance: MAX_ROBOTS_PER_INSTANCE, entityType: 'robot' })`
    - Create `rebalanceGrandMeleeLeagues()` with `minCyclesForRebalancing: 10` (same as KotH)
    - Wire into settlement cron alongside `rebalanceKothLeagues()`
    - _Requirements: R4.3, R4.4, R4.6, R4.7_

- [x] 4. Grand Melee reward calculation
  - [x] 4.1 Create `app/backend/src/services/grand-melee/grandMeleeRewards.ts`
    - Export `GRAND_MELEE_LP_SCALE` array: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    - Export `GRAND_MELEE_CREDIT_MULTIPLIER` record (positions 1-10: 1.0, 0.8, 0.65, 0.55, 0.45, 0.38, 0.32, 0.28, 0.24, 0.22)
    - Export `GRAND_MELEE_BASE_MULTIPLIER = 2.5`
    - Export `calculateGrandMeleeRewards(placement, tier, totalParticipants, winnerHPPercent?)` returning `{ credits, fame, prestige, lpDelta }`
    - Use same `TIER_CREDIT_BASE` and `TIER_FACTOR` as KotH
    - Participation floor 0.2 for positions 11-20
    - Prestige +50% bonus for winner with >50% HP
    - _Requirements: R3.1, R3.2, R3.3, R3.4, R3.5_

  - [x] 4.2 Write property tests for reward calculation
    - Property (P6): For any placement 1-20, LP delta equals `GRAND_MELEE_LP_SCALE[placement-1]`
    - Property (P7): For any placement and tier, credits ≥ `floor(TIER_CREDIT_BASE[tier] × 2.5 × 0.2)`
    - Unit tests: verify exact values for all placements in bronze, silver, champion tiers
    - Unit test: prestige bonus (1st place, >50% HP → 1.5× prestige)
    - _Requirements: R3.1, R3.2, R3.3, R3.4, R3.5_

- [x] 5. Grand Melee battle orchestrator
  - [x] 5.1 Create `app/backend/src/services/grand-melee/grandMeleeBattleOrchestrator.ts`
    - Export `GrandMeleeBattleExecutionSummary` interface
    - Export `executeScheduledGrandMeleeBattles()` — loads all scheduled grand_melee matches, processes sequentially with KotH batch/super-batch pause pattern (500ms/5s/30s)
    - Implement `processGrandMeleeBattle(match)`:
      - Load robots with weapons + refinements (same query as KotH)
      - Batch-fetch tuning bonuses via `getTuningBonusesBatch`
      - `prepareRobotForCombat` for each robot
      - Call `simulateBattleMulti(robots, { allowDraws: false, arenaRadius: 16 + (N-2) * 3 })`
      - Call `computePlacements` to derive elimination order
      - Persist: Battle record (`battleType = 'grand_melee'`, `participantCount = N`, `winningSide = winnerId`), BattleParticipant records, BattleSummary
      - Call `calculateGrandMeleeRewards` per robot
      - Batch user currency update (credits + fame + prestige in one transaction)
      - Call `awardGrandMeleePoints` per robot
      - Call `updateRobotCombatStats` per robot with `skipBattleCounters: true`, increment `grandMeleeWins`/`grandMeleeTop3` based on placement
      - Call `calculateStreamingRevenueBatch`
      - Call `checkAndAwardAchievements` per robot
      - Call `logBattleAuditEvent`
    - Continue-on-failure per match: try/catch, log error, include in summary
    - _Requirements: R2.1, R2.2, R2.3, R2.4, R2.5, R2.6, R2.7, R2.8, R2.9, R2.10, R3.6, R13.6, R13.7_

  - [x] 5.2 Implement `computePlacements` function
    - Extract `robot_eliminated`/`destroyed` events with timestamps
    - Split into survivors (alive) and eliminated (dead)
    - Sort survivors by HP% descending, tiebreak by total damage dealt descending
    - Sort eliminated by elimination time descending (later = higher rank), same-tick tiebreak by damage dealt descending
    - Assign placements: survivors 1..S, eliminated S+1..N — no gaps, no duplicates
    - Return array with robotId, placement, kills, damageDealt, survivalTime, finalHP, destroyed
    - _Requirements: R14.1, R14.2, R14.3, R14.4, R14.5, R14.6_

  - [x] 5.3 Implement BattleSummary extension for Grand Melee
    - Pass placement data to `computeBattleSummary` via `kothPlacements` field (reuse same shape: robotId, robotName, placement, zoneScore=0, zoneTime=0, kills, destroyed)
    - Include match-level metadata: total eliminations, first blood, end reason (time limit vs natural)
    - _Requirements: R15.1, R15.2, R15.3_

  - [ ] 5.4 Write property tests for placement computation
    - Property (P4): For N participants, placements form exactly the set {1, 2, ..., N}
    - Property (P5): For any two eliminated robots where A's elimination time > B's, A's placement < B's (better)
    - Property (P10): With `allowDraws: false`, result always has non-null winnerId
    - Unit tests: all-eliminated scenario (mutual destruction), time-limit with multiple survivors, same-tick elimination tiebreaker
    - _Requirements: R14.1, R14.2, R14.3, R14.4, R14.5, R14.6_

- [x] 6. Grand Melee matchmaking service
  - [x] 6.1 Create `app/backend/src/services/grand-melee/grandMeleeMatchmakingService.ts`
    - Constants: `MIN_MATCH_SIZE = 8`, `IDEAL_MATCH_SIZE = 20`
    - Export `runGrandMeleeMatchmaking(): Promise<{ matchesCreated: number }>`
    - Iterate all tier/instance combinations from Standing records with `mode = 'grand_melee'`
    - Per instance: load eligible robots (active subscription + checkSchedulingReadiness + no pending scheduled match)
    - If eligible < 8: skip instance, log reason
    - Group using LP-primary banding: sort by LP desc, compute group count (`ceil(eligible / 20)`), ensure no group < 8
    - Apply same-stable swaps (no two robots from same userId in one group)
    - Apply recent-opponent swaps (penalty weight, not blocker) via `getRecentOpponentsBatch` with `MatchType.grand_melee`
    - Persist each group via `schedulingService` with `MatchType.grand_melee` and `scheduledFor` via `defaultScheduledFor`
    - _Requirements: R5.1, R5.2, R5.3, R5.4, R5.5, R5.6, R5.7, R5.8, R5.9_

  - [ ] 6.2 Write property tests for matchmaking
    - Property (P8): All produced groups have size ≥ 8 and ≤ 20
    - Property (P9): No two robots in any group share the same userId
    - Unit tests: 8 eligible (single group), 20 eligible (single group), 21 eligible (split), 100 eligible (5 groups), 7 eligible (skip)
    - _Requirements: R5.3, R5.5, R5.8, R5.9_

- [x] 7. Cron handler and admin integration
  - [x] 7.1 Replace reserved stub in `cycleScheduler.ts` with real Grand Melee handler
    - Implement `executeGrandMeleeCycle()` with 4-step pipeline: (1) `repairAllRobots(true)`, (2) `executeScheduledGrandMeleeBattles()`, (3) `rebalanceGrandMeleeLeagues()`, (4) `runGrandMeleeMatchmaking()`
    - Return `JobContext` with `jobName: 'grandMelee'`, `matchesCompleted`, `matchesFailed`, `totalRobotsInvolved`, `matchesCreated`
    - Replace `createReservedSlotHandler('grandMelee')` reference in job array with `executeGrandMeleeCycle`
    - Verify `JobState['name']` union already includes `'grandMelee'` and `SchedulerConfig` already includes `grandMeleeSchedule` (no changes needed — already present from Spec #36)
    - _Requirements: R7.1, R7.2, R7.3, R7.4, R7.6, R13.4, R13.5_

  - [x] 7.2 Update admin bulk cycle service (`adminCycleService.ts`)
    - Replace `grandMeleeBlock: { skipped: true, message: 'reserved slot...' }` with real execution of `executeGrandMeleeCycle()` at the 17:00 position
    - Include Grand Melee results in bulk cycle response
    - _Requirements: R7.5_

  - [x] 7.3 Update deprecated admin trigger endpoint
    - Replace no-op `POST /api/admin/grand-melee/trigger` with delegation to `triggerJob('grandMelee')` (same pattern as `/koth/trigger`)
    - Update audit action to `'grand_melee_trigger'`
    - Return execution summary
    - _Requirements: R7.7, R10.1, R10.5_

  - [ ] 7.4 Update admin frontend cycle controls
    - Replace "Reserved" badge for Grand Melee slot with active "Run" button
    - Add Grand Melee to the active-modes display with participant count, schedule, last execution status
    - Grand Melee job state (last run, duration, status, next run) already shown by existing scheduler dashboard (job name `'grandMelee'` already tracked)
    - _Requirements: R10.2, R10.3, R10.6_

  - [ ] 7.5 Add Grand Melee to admin battle history display
    - Grand Melee battles appear in admin battle list with per-robot placement table (rank, robot, kills, damage, survival time)
    - _Requirements: R10.4_

- [ ] 8. Frontend battle playback for 20 robots
  - [ ] 8.1 Extend `BattlePlayback` component to support 20 robots
    - Scale robot sprites proportionally to arena radius (smaller robots in larger arenas)
    - Health bars: full-size for top 8 robots, reduced size for robots 9-20
    - Robot labels: abbreviated (first 8 chars) on mobile viewports
    - Canvas-based rendering with requestAnimationFrame for smooth playback
    - _Requirements: R8.1, R8.2_

  - [ ] 8.2 Create `EliminationFeed` sub-component
    - Scrollable list showing robots as they are eliminated: elimination order number, victim name, killer name, timestamp
    - Updates in real-time during playback
    - On elimination: robot fades out in arena canvas, explosion effect, health bar removed from active display
    - _Requirements: R8.3, R8.5_

  - [ ] 8.3 Create `PlacementTracker` sub-component
    - Live ranking sidebar: alive robots sorted by HP% descending, eliminated robots sorted by elimination time
    - Updates each playback tick
    - Highlights user's robot(s) with distinct colour
    - _Requirements: R8.4_

  - [ ] 8.4 Add playback speed controls for Grand Melee
    - Speed buttons: 0.5×, 1×, 2×, 4× (default 1×)
    - Reuse existing speed control pattern if available, or create new controls
    - _Requirements: R8.6_

  - [ ] 8.5 Mobile responsive layout for battle playback
    - < 1024px: stack elimination feed and placement tracker below the arena canvas in collapsible tabs
    - Robot labels hidden on mobile, replaced with colour-coded dots; tap to highlight and show stats
    - All interactive elements (speed controls, robot selection, play/pause) have touch targets ≥ 44px
    - _Requirements: R8.7, R8.8_

- [ ] 9. Frontend dashboard, standings, and page integration
  - [ ] 9.1 Add Grand Melee to dashboard upcoming/recent match cards
    - Add `grand_melee` case to match card renderer: "Grand Melee" badge, participant count, scheduled time, robot's LP/tier
    - Recent results: show placement ("3rd of 18"), LP gained, credits earned
    - _Requirements: R9.1, R9.2_

  - [ ] 9.2 Add Grand Melee to `LeagueStandingsSummary` component on dashboard
    - Fetch Grand Melee standing per robot (same API pattern as KotH: `GET /api/robots/:id/grand-melee-standing`)
    - Add backend route for robot Grand Melee standing query
    - Display per-robot card: tier badge, LP, wins (1st places), best placement
    - Show subscription status (subscribed/not subscribed)
    - _Requirements: R9.3_

  - [ ] 9.3 Add Grand Melee to standings page (`/standings`)
    - Add `Grand Melee` to mode selector
    - Leaderboard columns: rank, robot name, stable name, tier, LP, wins, total matches
    - Tier filter dropdown (bronze→champion)
    - Mobile: vertically scrollable card list instead of wide table
    - _Requirements: R9.4, R9.5, R9.12_

  - [ ] 9.4 Add Grand Melee to robot detail page tabs
    - "Overview" tab: Grand Melee tier/LP badge alongside other mode standings
    - "Matches" tab: Grand Melee battles in history list with placement badge ("2nd of 20") + LP change
    - "League History" tab: Grand Melee tier changes in timeline visualization
    - _Requirements: R9.6, R9.7, R9.8_

  - [ ] 9.5 Add Grand Melee to battle history page and booking office
    - Battle history type filter: add `grand_melee` option with label "Grand Melee"
    - Battle list item: show participant count + user's robot placement (not win/loss)
    - Booking Office subscription matrix: 9th column "Grand Melee"
    - _Requirements: R9.9, R9.10, R9.11_

  - [ ] 9.6 Add Grand Melee battle detail page (`BattleDetailPage`)
    - Results table sorted by placement: rank, robot name, kills, damage dealt, damage received, survival time, HP remaining
    - Mobile (< 1024px): stacked cards with expandable details
    - Touch targets ≥ 44px
    - _Requirements: R15.4, R15.5, R9.13_

- [ ] 10. Achievement integration
  - [ ] 10.1 Add Grand Melee achievement seed data
    - Add 5 achievements to `app/backend/src/config/achievements.ts`:
      - C83 "Real Steel": `grandMeleeWins >= 1`, easy tier, reference: Real Steel movie
      - C84 "The Hunger Bots": `grandMeleeWins >= 5`, medium tier, reference: Hunger Games parody
      - C85 "Omega Supreme": `grandMeleeWins >= 20`, hard tier, reference: Transformers
      - C86 "Cockroach Protocol": `grandMeleeTop3 >= 10`, medium tier, reference: survival AI
      - C87 "Untouchable": `grandMeleeWinHighHP >= 1`, hard tier, reference: dominance
    - Add icons and descriptions for each
    - _Requirements: R11.1, R11.4_

  - [ ] 10.2 Wire achievement checks for Grand Melee battles
    - In `checkAndAwardAchievements`: when `battleType === 'grand_melee'`, evaluate Grand Melee achievement triggers using `robot.grandMeleeWins`, `robot.grandMeleeTop3`
    - For C87 "Untouchable": check `placement === 1 && finalHPPercent > 75` (one-shot boolean, not counter-based)
    - Ensure `updateRobotCombatStats` increments `grandMeleeWins` when placement === 1 and `grandMeleeTop3` when placement <= 3
    - _Requirements: R11.2, R11.3, R11.5_

- [ ] 11. Hall of Records integration
  - [ ] 11.1 Add `fetchGrandMeleeRecords()` to `records-queries.ts`
    - Query Robot model for most Grand Melee wins (`grandMeleeWins` descending, top 10)
    - Query Standing model for highest LP (`mode = 'grand_melee'`, `leaguePoints` descending, top 10)
    - Query Standing model for most kills career (`totalKills` descending, top 10)
    - Include robot name and stable owner username in results
    - _Requirements: R16.1, R16.2_

  - [ ] 11.2 Include Grand Melee records in `/api/records` response
    - Add `fetchGrandMeleeRecords()` to the `Promise.all` in `records.ts`
    - Include result in cached payload under `grandMelee` key
    - _Requirements: R16.4_

  - [ ] 11.3 Add Grand Melee section to HallOfRecordsPage frontend
    - New section card: "Grand Melee" with records tables (most wins, highest LP, most kills)
    - Same card/table pattern as existing KotH section
    - Mobile responsive (stacked cards on < 1024px)
    - _Requirements: R16.3_

- [ ] 12. Discord webhook notification support
  - [ ] 12.1 Ensure `buildSuccessMessage` handles Grand Melee JobContext
    - Verify that the existing `buildSuccessMessage` function produces a valid Discord embed for `jobName: 'grandMelee'` with fields: matchesCompleted, totalRobotsInvolved, matchesCreated
    - If a `grandMelee`-specific format is needed (e.g., per-tier breakdown), add a case to the message builder
    - Test: trigger Grand Melee cycle → Discord webhook fires with correct content
    - _Requirements: R12.1, R12.2, R12.3, R12.4_

- [ ] 13. In-game guide content
  - [ ] 13.1 Create guide section directory and articles
    - Create `app/backend/src/content/guide/grand-melee/` directory
    - Create `basics.md`: What Grand Melee is, 20-robot FFA, elimination win condition, daily at 17:00 UTC
    - Create `entry-requirements.md`: Booking Office subscription, weapon readiness, minimum 8 per tier
    - Create `scoring-and-placement.md`: F1 point scale (25/18/15/12/10/8/6/4/2/1), elimination order rules, HP% tiebreaker, LP/tier system
    - Create `rewards.md`: tier-scaled credit table (with 2.5× multiplier), fame/prestige tables, participation floor
    - Create `strategy.md`: build archetypes for FFA (vulture, tank, brawler), attribute value shifts vs 1v1, positioning tips
    - All articles use YAML frontmatter with title, description, order
    - _Requirements: R17.1, R17.2, R17.4_

  - [ ] 13.2 Register guide section in `sections.json`
    - Add `{ "slug": "grand-melee", "title": "Grand Melee", "description": "Free-for-all elimination battles", "order": 9 }` to sections.json
    - _Requirements: R17.3_

  - [ ] 13.3 Update Booking Office guide article
    - Update `app/backend/src/content/guide/facilities/booking-office.md` to mention 9 event types (add Grand Melee to the list)
    - _Requirements: R17.3_

- [ ] 14. Documentation and steering file updates
  - [ ] 14.1 Update `.kiro/steering/project-overview.md`
    - Add Grand Melee to Key Systems list (new item #18 or appropriate position): description of the mode, 20-robot FFA, 17:00 UTC, subscription-gated
    - Update Daily Cron Schedule description to show 17:00 Grand Melee slot as live (not reserved)
    - Update Booking Office description to reference 9 event types
    - _Requirements: R18.1_

  - [ ] 14.2 Update `docs/architecture/PRD_SERVICE_DIRECTORY.md`
    - Update Cron Schedule section: Grand Melee slot at 17:00 UTC marked as active with handler reference `executeGrandMeleeCycle`
    - _Requirements: R18.2_

  - [ ] 14.3 Update `docs/BACKLOG.md`
    - Move item #30 ("Free-for-All / Battle Royale Mode") to the "Recently Completed" table
    - Reference: Spec #44
    - _Requirements: R18.3_

  - [ ] 14.4 Update `docs/analysis/FREE_FOR_ALL_BATTLE_ROYALE_MODE.md`
    - Change status from "📋 FUTURE RELEASE — Design notes only" to "✅ Phase 1 shipped (Spec #44, 20 robots per match)"
    - Add note referencing the implementation
    - _Requirements: R18.4_

- [ ] 15. Verification
  - [ ] 15.1 Run all verification criteria from the requirements document
    - `grep -r "grand_melee" app/backend/src/services/subscription/eventRegistry.ts` — event type registered
    - `grep -r "grand_melee" app/backend/prisma/schema.prisma` — StandingsMode enum value present
    - `grep -r "grandMelee" app/backend/src/services/cycle/cycleScheduler.ts | grep -v "stub\|no-op\|reserved\|no handler"` — real handler present
    - `grep -r "grand_melee" app/backend/src/services/battle/baseOrchestrator.ts` — battle type in ALL_BATTLE_TYPES
    - `pnpm test -- --testPathPattern="grandMelee" --silent` — all Grand Melee tests pass
    - `pnpm test -- --testPathPattern="simulateBattleMulti\|spatialPartition\|variableTick\|spatialGrid" --silent` — optimization tests pass
    - `cd app/frontend && pnpm run build` — frontend build succeeds
    - `grep -r "SpatialGrid\|SpatialPartition\|spatialIndex" app/backend/src/services/battle/combat-simulator/` — spatial partitioning present
    - `grep -r "GRAND_MELEE\|grand_melee" app/backend/src/services/achievement/` — achievement definitions exist (or in config/achievements.ts)
    - `grep -r "grand_melee" app/backend/src/services/subscription/` — subscription integration complete
    - Verify frontend: Grand Melee appears on standings page, dashboard, booking office, robot detail, battle history
    - Verify admin: Grand Melee trigger works, scheduler shows active status
    - _Requirements: All verification criteria from Expected Contribution_
