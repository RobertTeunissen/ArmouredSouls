# Requirements Document

## Spec: Grand Melee — Free-for-All Battle Mode

## Glossary

- **Grand_Melee**: A free-for-all elimination battle mode where 8–20 robots fight simultaneously in a single arena with last-standing elimination as the win condition. The 9th subscribable battle event in the Booking Office system.
- **Placement**: A robot's finishing position in a Grand Melee match, determined by elimination order (last eliminated = 1st place) or survival rank at time limit.
- **Placement_Points**: F1-style league points awarded based on finishing position: 25/18/15/12/10/8/6/4/2/1 for positions 1–10, 0 for positions 11–20.
- **Elimination_Order**: The sequence in which robots are destroyed during a match. The first robot destroyed receives the lowest placement (equal to total participants), the last destroyed receives placement 2 (or higher if others survive).
- **Time_Limit_Tiebreaker**: The ranking mechanism applied when the standard 120-second battle duration expires with robots still alive. Surviving robots are ranked by HP percentage descending; eliminated robots are ranked by elimination time (later elimination = higher rank).
- **Mutual_Destruction_Tiebreaker**: The ranking mechanism applied when multiple robots are eliminated in the same simulation tick. Robots eliminated in the same tick are ranked by total damage dealt descending (higher damage = higher rank).
- **Arena_Radius_Formula**: The standard arena sizing formula: radius = 16 + (N − 2) × 3, where N is the number of participants. For 20 robots this yields radius 70.
- **Grand_Melee_Orchestrator**: The battle execution service following the KotH orchestrator pattern: load robots → prepareRobotForCombat → build battle config → run simulateBattleMulti → persist Battle + BattleParticipants + BattleSummary → calculate rewards → update standings → streaming revenue → achievements → audit.
- **Grand_Melee_Matchmaking_Service**: The matchmaking service that groups eligible robots into matches of 8–20 using LP-primary banding within tier/instance, same-stable swaps, and recent-opponent swaps.
- **Spatial_Partitioning**: A grid-based or quadtree data structure applied within `simulateBattleMulti` that limits threat evaluation to nearby robots only, reducing per-tick complexity from O(n²) to O(n × k) where k is the number of nearby robots.
- **Variable_Tick_Rate**: An optimization where robots more than 50 units from any opponent simulate at 0.5-second intervals instead of the standard 0.1-second tick, reducing computation for disengaged robots.
- **Standings_Mode**: The Prisma enum value `grand_melee` added to `StandingsMode`, enabling LP tracking, tier placement, and league rebalancing for Grand Melee participants.
- **Event_Registry**: The runtime singleton that holds subscribable event definitions. This spec adds `grand_melee` as the 9th entry.
- **Booking_Office**: The facility whose level determines how many concurrent subscriptions each robot may hold. After this spec there are 9 total event types.
- **Cycle_Scheduler**: The production cron with a reserved stub at 17:00 UTC (`grandMelee`). This spec replaces the stub with the real handler.
- **MIN_MATCH_SIZE**: The minimum number of robots required to form a Grand Melee match: 8. If a tier instance has fewer than 8 eligible robots, no match fires that cycle.
- **IDEAL_MATCH_SIZE**: The target number of robots per Grand Melee match: 20. Matchmaking fills groups up to this size before splitting into additional groups.
- **League_Rebalancing**: The existing `createStandingsAdapter` factory-based tier promotion/demotion system. Grand Melee uses the same configuration as KotH with `overrideMinLP: 0`.

## Introduction

Grand Melee is a free-for-all elimination mode where 8–20 robots fight simultaneously in a single arena. It is the first large-scale combat mode in Armoured Souls, scaling beyond KotH's 5–6 robot matches to 20-robot battles. The mode uses the existing `simulateBattleMulti` function (which already handles N-robot FFA natively) with no custom win condition — pure last-standing elimination.

This spec delivers the Grand Melee mode end-to-end: orchestrator, matchmaking, standings integration, event registration, cron handler, frontend playback and dashboard integration, admin portal, achievements, and Discord notifications. It also delivers algorithmic optimizations (spatial partitioning and variable tick rate) to `simulateBattleMulti` that benefit ALL battle modes, maintaining the project's unification principle.

The mode runs daily at 17:00 UTC in a pre-reserved cron slot. With ~100 robots per league instance and an ideal match size of 20, this yields ~5 matches per instance per cycle. The same league/tier system (bronze through champion) applies, with LP-based promotion/demotion via the unified `createStandingsAdapter` factory. Matchmaking follows the same pipeline as KotH: LP-primary banding within tier/instance, same-stable swaps, recent-opponent swaps, and subscription gating via the Booking Office.

Key design decisions already confirmed: no shrinking arena (arena radius 70 at 20 robots provides natural engagement), no anti-vulture mechanic (chaos and compact arena handle this), F1-style placement points for top 10, standard 120-second max battle duration with `allowDraws: false` (same as tournaments — HP% tiebreaker guarantees a winner), and worker thread deferred to v2.

## Expected Contribution

This spec addresses the "Grand Melee" backlog item from `docs/analysis/FREE_FOR_ALL_BATTLE_ROYALE_MODE.md` Phase 1 (16–32 robots on current hardware) and fills the 17:00 UTC cron slot that has been reserved since Spec #36.

1. **9th battle event shipped with full league integration.** Before — 8 subscribable event types exist; the 17:00 UTC slot is a no-op stub returning "no handler implemented". After — `grand_melee` is the 9th event type registered in the Event Registry; the cron slot executes real matches with LP tracking, tier placement, and league rebalancing. Verifiable by: `eventRegistry` contains `grand_melee`; `StandingsMode` enum includes `grand_melee`; Battle records with `battleType = 'grand_melee'` are created.

2. **Large-scale FFA combat (20 robots) running on current hardware.** Before — the largest battle mode is KotH at 5–6 robots; `simulateBattleMulti` has O(n²) per-tick complexity with no spatial optimization. After — spatial partitioning and variable tick rate reduce per-tick cost to O(n × k), enabling 20-robot battles to complete within acceptable wall-clock time (~3–5 seconds per match on the 2-vCPU VPS). These optimizations apply to ALL modes, not just Grand Melee. Verifiable by: 20-robot simulation completes within 10 seconds; KotH and other multi-robot modes continue to function correctly with optimizations active.

3. **F1-style placement scoring with full standings pipeline.** Before — only KotH uses placement-based LP (zone score driven). After — Grand Melee awards 25/18/15/12/10/8/6/4/2/1 placement points to top 10, with the same standings adapter pattern (promotion/demotion thresholds, instance balancing, league history tracking). Verifiable by: Standing records with `mode = 'grand_melee'` exist after battles; LP values increase by the correct placement point amounts.

4. **Complete frontend integration across all surfaces.** Before — no Grand Melee presence on dashboard, battle history, robot detail, or standings pages. After — battle playback supports 20 robots, dashboard shows upcoming/recent Grand Melee matches, robot detail pages show Grand Melee league standings and history, and a dedicated Grand Melee standings page exists. All mobile-responsive. Verifiable by: frontend build succeeds; Grand Melee battles render in playback; standings page loads for `grand_melee` mode.

5. **Cron stub replaced and admin portal operational.** Before — `grandMelee` job returns "no handler implemented"; admin trigger endpoint returns an error. After — real orchestrator executes matches, admin can manually trigger Grand Melee cycles, and the mode appears as active in the admin scheduler dashboard. Verifiable by: no "no handler implemented" log for grandMelee; admin trigger endpoint returns match execution results.

6. **New achievement category for Grand Melee milestones.** Before — no Grand Melee achievements exist. After — a set of Grand Melee-specific achievements reward participation and excellence (wins, survival streaks, placement milestones). Verifiable by: achievement seed contains Grand Melee entries; achievements unlock on match completion.

### Verification Criteria

After all tasks are complete, run these checks to confirm the spec delivered:

1. `grep -r "grand_melee" app/backend/src/services/subscription/eventRegistry.ts` — event type registered
2. `grep -r "grand_melee" app/backend/prisma/schema.prisma` — StandingsMode enum value present
3. `grep -r "grandMelee" app/backend/src/services/cycle/cycleScheduler.ts | grep -v "stub\|no-op\|reserved\|no handler"` — real handler present
4. `grep -r "grand_melee" app/backend/src/services/battle/baseOrchestrator.ts` — battle type registered in ALL_BATTLE_TYPES
5. `npm test -- --testPathPattern="grandMelee" --silent` — all Grand Melee tests pass
6. `npm test -- --testPathPattern="simulateBattleMulti\|spatialPartition\|variableTick" --silent` — optimization tests pass
7. `cd app/frontend && npm run build` — frontend build succeeds with Grand Melee pages
8. `grep -r "SpatialGrid\|SpatialPartition\|spatialIndex" app/backend/src/services/battle/combat-simulator/` — spatial partitioning present
9. `grep -r "GRAND_MELEE\|grand_melee" app/backend/src/services/achievement/` — achievement definitions exist
10. `grep -r "grand_melee" app/backend/src/config/subscriptions.ts app/backend/src/services/subscription/` — subscription integration complete

## Requirements

### Requirement 1: Simulation Algorithmic Optimizations (All Modes)

**User Story:** As a system operator, I want the combat simulator to use spatial partitioning and variable tick rate, so that 20-robot Grand Melee battles complete in acceptable time without degrading other modes.

#### Acceptance Criteria

1. THE `simulateBattleMulti` function SHALL implement a grid-based spatial partitioning index that divides the arena into cells sized proportional to the maximum weapon range, updated every simulation tick as robots move
2. WHEN evaluating threats for a robot, THE Combat_Simulator SHALL query only robots in the same cell or adjacent cells (8-neighbourhood) from the spatial index, reducing threat evaluation from O(n²) to O(n × k) where k is the number of nearby robots
3. WHILE a robot has no opponent within 50 units, THE Combat_Simulator SHALL simulate that robot at 0.5-second intervals instead of the standard 0.1-second tick, switching back to the standard tick rate when an opponent enters the 50-unit radius
4. THE Combat_Simulator SHALL produce identical simulation outcomes for battles with 6 or fewer robots regardless of whether spatial partitioning is active, verified by deterministic seeded simulations producing the same event sequence. Variable tick rate SHALL only activate for battles with 10 or more robots, ensuring no behavioral change for existing KotH (5-6 robots) or 1v1 modes
5. WHEN spatial partitioning is active, THE Combat_Simulator SHALL include all robots that are within weapon range plus a safety margin of 10 units in threat evaluation, ensuring no valid target is excluded from consideration
6. THE Combat_Simulator SHALL expose the spatial partitioning and variable tick rate as opt-in configuration flags on `BattleConfig` that default to enabled, allowing individual modes to disable them if needed
7. WHEN variable tick rate is active, robots on the slow (0.5s) tick SHALL continue moving at their last computed velocity every standard 0.1s tick — only AI re-evaluation (target selection, movement intent) is deferred to the slow tick boundary. This ensures no position discontinuities or teleporting

### Requirement 2: Grand Melee Battle Orchestrator

**User Story:** As a system operator, I want Grand Melee battles to execute using the same orchestration pipeline as KotH, so that battle persistence, reward distribution, and stat tracking are consistent.

#### Acceptance Criteria

1. WHEN a scheduled Grand Melee match executes, THE Grand_Melee_Orchestrator SHALL load participant robots with weapons and refinements, call `prepareRobotForCombat` with tuning bonuses for each robot, and invoke `simulateBattleMulti` with `allowDraws: false` (pure elimination mode, same as tournaments) using the standard `MAX_BATTLE_DURATION` (120 seconds)
2. THE Grand_Melee_Orchestrator SHALL compute arena radius using the standard formula (16 + (N − 2) × 3) based on the match's actual participant count, passing the result as `arenaRadius` in the `BattleConfig`
3. WHEN `simulateBattleMulti` completes, THE Grand_Melee_Orchestrator SHALL determine placement for each robot using: (a) surviving robots ranked by HP percentage descending at time limit, (b) eliminated robots ranked by elimination time descending (later elimination = higher rank), (c) robots eliminated in the same tick ranked by total damage dealt descending
4. WHEN placements are determined, THE Grand_Melee_Orchestrator SHALL create a `Battle` record with `battleType = 'grand_melee'`, `BattleParticipant` records for all robots with their placement and combat stats, and a `BattleSummary` record via `computeBattleSummary`
5. WHEN persisting battle results, THE Grand_Melee_Orchestrator SHALL call `updateRobotCombatStats` for each participant with `battleType = 'grand_melee'` and `skipBattleCounters: true` (same pattern as KotH)
6. WHEN persisting battle results, THE Grand_Melee_Orchestrator SHALL call `calculateStreamingRevenueBatch` for all participants to distribute streaming revenue
7. WHEN persisting battle results, THE Grand_Melee_Orchestrator SHALL call `checkAndAwardAchievements` for each participant and `logBattleAuditEvent` for the battle
8. THE Grand_Melee_Orchestrator SHALL implement the same memory-safety batch/super-batch pause pattern as KotH (500ms between matches, 5s after every 10 matches, 30s after every 20 matches in production) to stay within the 2GB VPS memory budget
9. IF a match execution fails, THEN THE Grand_Melee_Orchestrator SHALL log the error, skip the failed match, continue processing remaining matches, and include the failure in the execution summary
10. THE Grand_Melee_Orchestrator SHALL return a `GrandMeleeBattleExecutionSummary` containing `totalMatches`, `successfulMatches`, `failedMatches`, `totalRobotsInvolved`, individual match results with placements, and any errors

### Requirement 3: Grand Melee Reward Distribution

**User Story:** As a player, I want to earn credits, fame, and prestige based on my Grand Melee placement, so that performing well in the mode is rewarded.

#### Acceptance Criteria

1. THE Grand_Melee_Orchestrator SHALL award F1-style placement points as LP delta to standings: 25 (1st), 18 (2nd), 15 (3rd), 12 (4th), 10 (5th), 8 (6th), 6 (7th), 4 (8th), 2 (9th), 1 (10th), 0 (11th–20th)
2. THE Grand_Melee_Orchestrator SHALL calculate credit rewards using the tier-based formula: `TIER_CREDIT_BASE[tier] × GRAND_MELEE_CREDIT_MULTIPLIER (2.5) × placementMultiplier`, where placement multipliers follow the same tiered curve as KotH (1st highest, scaling down by placement, with a participation floor of 0.2 for last place). The 2.5× multiplier reflects the increased difficulty of competing against 19 opponents vs KotH's 5
3. THE Grand_Melee_Orchestrator SHALL award fame using tier-scaled base values: 12 (1st), 8 (2nd), 6 (3rd), 4 (4th), 3 (5th), 2 (6th–8th), 1 (9th–10th), 0 (11th–20th), each multiplied by the tier factor (bronze 1.0 through champion 7.0)
4. THE Grand_Melee_Orchestrator SHALL award prestige for top 3 placements: 20 (1st), 10 (2nd), 5 (3rd), each multiplied by the tier factor, with a performance bonus of +50% prestige for the winner if their final HP percentage exceeds 50%
5. THE Grand_Melee_Orchestrator SHALL use the same `TIER_CREDIT_BASE` values as KotH (bronze: 7500, silver: 15000, gold: 30000, platinum: 60000, diamond: 115000, champion: 225000) multiplied by `GRAND_MELEE_CREDIT_MULTIPLIER` (2.5) for credit calculation
6. THE Grand_Melee_Orchestrator SHALL apply reward amounts to robot owners via the same batched user currency update pattern as KotH (single transaction for all credit/fame/prestige increments per match)

### Requirement 4: Grand Melee Standings and League Integration

**User Story:** As a player, I want Grand Melee to have the same league/tier system as other modes, so that I can progress through ranks and compete against similarly-skilled opponents.

#### Acceptance Criteria

1. THE Prisma schema SHALL add `grand_melee` to the `StandingsMode` enum, enabling Standing records with `mode = 'grand_melee'` for LP tracking, tier assignment, and instance placement
2. THE Grand_Melee_Orchestrator SHALL update standings after each match by calling the standings service with the placement-based LP delta (F1 points) for each participant, using the `awardPlacementPoints` pattern
3. THE League_Rebalancing_Service SHALL support Grand Melee via a `createStandingsAdapter('grand_melee', { maxPerInstance: 100, entityType: 'robot' })` adapter using the same promotion/demotion configuration as KotH with `overrideMinLP: 0`
4. THE League_Rebalancing_Service SHALL rebalance Grand Melee tiers during the daily settlement cron using the same algorithm as KotH (promotion percentage 10%, demotion percentage 10%, min 10 cycles in tier before eligible for rebalancing)
5. WHEN a robot first subscribes to `grand_melee`, THE Standings_Service SHALL create a Standing record in the bronze tier with 0 LP, assigned to an instance with available capacity (same onboarding as KotH)
6. THE Grand Melee standings system SHALL use the same instance splitting logic as all other leagues: instances split at 101 robots into 51+50, and new robots fill the smaller instance until balanced
7. THE League_History_Service SHALL track Grand Melee tier changes (promotions and demotions) identically to other modes, recording `entityType: 'robot'`, `mode: 'grand_melee'`, old tier, new tier, and cycle number

### Requirement 5: Grand Melee Matchmaking Service

**User Story:** As a player, I want to be matched with similarly-ranked opponents in Grand Melee, so that matches are competitive.

#### Acceptance Criteria

1. THE Grand_Melee_Matchmaking_Service SHALL iterate over all Grand Melee tier/instance combinations from Standing records, loading eligible robots per instance (same tier→instance iteration pattern as KotH)
2. WHEN determining eligibility, THE Grand_Melee_Matchmaking_Service SHALL require: (a) an active Standing record with `mode = 'grand_melee'` in the target instance, (b) passing `checkSchedulingReadiness` weapon validation, (c) an active `grand_melee` subscription, (d) no already-scheduled pending Grand Melee match
3. THE Grand_Melee_Matchmaking_Service SHALL group eligible robots using LP-primary banding: sort by LP descending, divide into contiguous bands of up to IDEAL_MATCH_SIZE (20), with a minimum band size of MIN_MATCH_SIZE (8)
4. IF an instance has fewer than MIN_MATCH_SIZE (8) eligible robots, THEN THE Grand_Melee_Matchmaking_Service SHALL skip that instance for the current cycle and log the skip reason
5. THE Grand_Melee_Matchmaking_Service SHALL apply same-stable swaps: no two robots owned by the same user in one match group, swapping with the nearest adjacent group when a conflict is detected
6. THE Grand_Melee_Matchmaking_Service SHALL apply recent-opponent swaps: avoid grouping robots that competed in the same Grand Melee match within the last 3 cycles, using `getRecentOpponentsBatch` with `MatchType.grand_melee`
7. WHEN a match group is finalized, THE Grand_Melee_Matchmaking_Service SHALL persist it via `schedulingService` with `MatchType.grand_melee` and `scheduledFor` set via `defaultScheduledFor` (24h + rounded)
8. IF the eligible count in an instance is between MIN_MATCH_SIZE and IDEAL_MATCH_SIZE (8–20), THE Grand_Melee_Matchmaking_Service SHALL form a single match group with all eligible robots rather than discarding the remainder
9. IF the eligible count exceeds IDEAL_MATCH_SIZE, THE Grand_Melee_Matchmaking_Service SHALL split into multiple groups where each group has between MIN_MATCH_SIZE and IDEAL_MATCH_SIZE robots, preferring equal group sizes over one full group plus a small remainder

### Requirement 6: Event Registry and Subscription Integration

**User Story:** As a player, I want to subscribe my robots to Grand Melee via the Booking Office, so that they are entered into the matchmaking pool.

#### Acceptance Criteria

1. THE Event_Registry SHALL register `grand_melee` as the 9th subscribable event type with label `'Grand Melee'` and a locking predicate that returns `true` when the robot has a pending or scheduled Grand Melee match
2. THE `SubscribableEventType` union SHALL be extended to include `'grand_melee'`
3. THE `ALL_BATTLE_TYPES` array in `baseOrchestrator.ts` SHALL include `'grand_melee'`
4. THE Booking_Office subscription cap SHALL apply to Grand Melee subscriptions identically to all other event types (consuming one slot per robot)
5. WHEN a robot subscribes to `grand_melee`, THE Subscription_Service SHALL create a Standing record in bronze tier if one does not already exist for that robot with `mode = 'grand_melee'`
6. THE Roster_Eligibility_Filter SHALL include a rule for `grand_melee` (minRobots: 1, reason: 'Grand Melee requires at least 1 robot in your Stable')

### Requirement 7: Cron Handler and Scheduling

**User Story:** As a system operator, I want the Grand Melee to execute automatically at 17:00 UTC daily using the exact same pipeline as all other battle modes, so that matches run without manual intervention.

#### Acceptance Criteria

1. THE Cycle_Scheduler SHALL replace the reserved-slot stub for `grandMelee` (17:00 UTC) with a real handler that follows the same 4-step pipeline as all other battle modes: (a) repair all robots, (b) execute scheduled battles, (c) rebalance leagues, (d) run matchmaking for the next cycle
2. WHEN the Grand Melee cron handler executes, THE Cycle_Scheduler SHALL first call `repairAllRobots(true)`, then run the Grand_Melee_Orchestrator to execute all scheduled matches, then rebalance Grand Melee leagues (promotion/demotion), then run the Grand_Melee_Matchmaking_Service to schedule the next cycle's matches
3. THE Cycle_Scheduler SHALL return a `JobContext` from the Grand Melee handler, enabling automatic Discord notifications via the existing `runJob()` → `buildSuccessMessage()` → `dispatchNotification()` pipeline
4. IF no scheduled Grand Melee matches exist when the handler runs, THE Cycle_Scheduler SHALL log the absence and proceed directly to rebalancing and matchmaking without raising an error
5. THE Admin_Bulk_Cycle_Service SHALL include Grand Melee in its slot-map execution order at the position corresponding to 17:00 UTC, executing the same `executeGrandMeleeCycle()` function as the cron
6. WHEN the Grand Melee handler completes, THE Cycle_Scheduler SHALL update the `grandMelee` job state with `lastRunAt`, `lastRunDurationMs`, `lastRunStatus`, and `nextRunAt`
7. THE existing unified trigger endpoint (`POST /api/admin/scheduler/trigger/:jobName`) SHALL work with `jobName = 'grandMelee'` to run the exact same code path as the cron — no separate trigger endpoint required. The deprecated `/grand-melee/trigger` endpoint SHALL be updated to delegate to `triggerJob('grandMelee')` (same pattern as the deprecated `/koth/trigger`)

### Requirement 8: Frontend Battle Playback for 20 Robots

**User Story:** As a player, I want to watch full battle playback of Grand Melee matches with 20 robots, so that I can see how the fight played out.

#### Acceptance Criteria

1. THE BattlePlayback component SHALL render up to 20 robots simultaneously in the arena canvas without performance degradation, maintaining at least 30 FPS on desktop and 24 FPS on mobile devices
2. WHEN rendering a Grand Melee battle, THE BattlePlayback component SHALL display robot health bars scaled to fit the viewport without overlapping, using a reduced HUD size for robots beyond the 8th participant
3. THE BattlePlayback component SHALL display an elimination feed showing robots as they are destroyed, including elimination order number and the name of the robot that dealt the killing blow
4. THE BattlePlayback component SHALL display a live placement tracker sidebar showing current survival rankings (alive robots sorted by HP%, eliminated robots sorted by elimination time) that updates as the battle progresses
5. WHEN a robot is eliminated, THE BattlePlayback component SHALL visually indicate the elimination (fade out, explosion effect) and remove the robot's active health bar while preserving it in the elimination feed
6. THE BattlePlayback component SHALL support playback speed controls (0.5×, 1×, 2×, 4×) for Grand Melee battles, defaulting to 1× speed
7. ON viewports below 1024px, THE BattlePlayback component SHALL stack the elimination feed and placement tracker below the arena canvas in a collapsible section, and reduce robot label sizes to prevent text overlap
8. ON viewports ≥ 320px, THE BattlePlayback component SHALL ensure all interactive elements (speed controls, robot selection, play/pause) have touch targets ≥ 44px

### Requirement 9: Frontend Dashboard and Standings Integration

**User Story:** As a player, I want to see Grand Melee matches on my dashboard and track standings, so that I can follow my competitive progress.

#### Acceptance Criteria

**Dashboard Page (`/dashboard`)**

1. WHEN a robot has an upcoming scheduled Grand Melee match, THE DashboardPage SHALL display a match card showing the match type ("Grand Melee"), scheduled time, participant count, and the robot's current LP and tier
2. WHEN a Grand Melee match has recently completed for a robot, THE DashboardPage SHALL display the result showing placement (e.g., "3rd of 18"), LP gained, and credits earned
3. THE LeagueStandingsSummary component on the dashboard SHALL include a "Grand Melee" section showing each robot's tier, LP, wins (1st places), and best placement — same pattern as the existing KotH standings cards

**Standings Page (`/standings`)**

4. THE StandingsPage mode selector SHALL include `Grand Melee` as a selectable mode, displaying the leaderboard for Grand Melee standings with columns: rank, robot name, stable name, tier, LP, wins (1st place finishes), and total matches
5. THE StandingsPage SHALL support tier filtering for Grand Melee standings (bronze through champion)

**Robot Detail Page (`/robots/:id`)**

6. THE RobotDetailPage "League History" tab SHALL display Grand Melee tier changes alongside other modes, using the same timeline visualization
7. THE RobotDetailPage "Matches" tab SHALL include Grand Melee battles in the battle history list, displayed with placement (e.g., "2nd of 20") and LP change
8. THE RobotDetailPage "Overview" tab SHALL show Grand Melee league tier and LP alongside other mode standings

**Battle History Page (`/battles`)**

9. THE BattleHistoryPage type filter SHALL include `grand_melee` as a filter option with display label "Grand Melee"
10. WHEN displaying a Grand Melee battle in the battle list, THE BattleHistoryPage SHALL show the participant count and the user's robot placement rather than a simple win/loss indicator

**Booking Office Page (`/booking-office`)**

11. THE BookingOfficePage subscription matrix SHALL include `grand_melee` as the 9th column with display label "Grand Melee", showing per-robot subscription status

**Responsiveness**

12. ON viewports below 1024px, THE Frontend SHALL render Grand Melee standings as a vertically scrollable card list instead of a wide table
13. ON viewports ≥ 320px, THE Frontend SHALL ensure all Grand Melee UI elements have touch targets ≥ 44px and no horizontal overflow occurs

### Requirement 10: Admin Portal Extensions

**User Story:** As an admin, I want to view and manage Grand Melee matches from the admin portal, so that I can monitor execution and intervene if needed.

#### Acceptance Criteria

1. THE deprecated `/api/admin/grand-melee/trigger` endpoint SHALL delegate to `triggerJob('grandMelee')` (same pattern as `/koth/trigger`), running the full cycle (repair → execute → rebalance → matchmake) and returning the execution summary. The unified `POST /api/admin/scheduler/trigger/grandMelee` endpoint also works identically.
2. WHEN viewing cycle controls, THE Admin_Portal SHALL show an active "Run" button for the `grandMelee` slot at 17:00 UTC (replacing any "Reserved" badge)
3. THE Admin_Portal scheduler dashboard SHALL display Grand Melee job state: last run time, duration, status, next run, and error details if the last run failed
4. THE Admin_Portal SHALL display Grand Melee match results in the battle history section with per-robot placement, damage dealt, kills, and survival time
5. WHEN an admin triggers Grand Melee via either trigger endpoint, THE Admin_Portal SHALL record an audit trail entry containing the admin user ID, operation type (`scheduler_trigger` or `grand_melee_trigger`), and execution result summary
6. THE Admin_Portal active-modes display SHALL include Grand Melee with its participant count, scheduled time, and last execution status

### Requirement 11: Achievement Integration

**User Story:** As a player, I want to unlock achievements for Grand Melee milestones, so that my accomplishments in the mode are recognized.

#### Acceptance Criteria

1. THE Achievement_System SHALL add the following Grand Melee achievements:
   - "Real Steel" — Win a Grand Melee (1st place, threshold: 1 Grand Melee win, easy tier, reference: Real Steel movie)
   - "The Hunger Bots" — Win 5 Grand Melee matches (threshold: 5 Grand Melee wins, medium tier, reference: Hunger Games parody)
   - "Omega Supreme" — Win 20 Grand Melee matches (threshold: 20 Grand Melee wins, hard tier, reference: Transformers Autobot guardian)
   - "Cockroach Protocol" — Finish in the top 3 in 10 Grand Melee matches (threshold: 10 top-3 finishes, medium tier, reference: survival AI concept)
   - "Untouchable" — Win a Grand Melee with more than 75% HP remaining (threshold: 1, hard tier, reference: dominance/invincibility)
2. WHEN a Grand Melee match completes, THE Achievement_System SHALL fire a `battle_complete` achievement check for each participant with `battleType = 'grand_melee'` and include placement data for threshold evaluation
3. THE Achievement_System SHALL track Grand Melee wins and top-3 finishes as separate robot-level counters (`grandMeleeWins`, `grandMeleeTop3`) incremented by `updateRobotCombatStats` or the achievement check handler
4. THE Achievement_System SHALL seed the Grand Melee achievement rows in the achievement seed data with appropriate icons, descriptions, and rarity tiers
5. WHEN the `checkAndAwardAchievements` function is called with `battleType = 'grand_melee'`, THE Achievement_System SHALL evaluate Grand Melee-specific achievement triggers using the robot's updated counters

### Requirement 12: Discord Webhook Notifications

**User Story:** As a player, I want to receive Discord notifications about Grand Melee results, so that I stay informed about match outcomes.

#### Acceptance Criteria

1. WHEN the Grand Melee cron handler completes with at least 1 match executed, THE Notification_Service SHALL send a Discord webhook message containing: total matches played, total robots involved, and per-tier match counts
2. THE Notification_Service SHALL format Grand Melee Discord messages using the same embed structure as other cron job notifications (success/error colour coding, job duration, match count)
3. IF the Discord webhook delivery fails for a Grand Melee notification, THEN THE Notification_Service SHALL log the error and allow the cron job to complete without interruption
4. THE Notification_Service SHALL use the existing `buildSuccessMessage`/`buildErrorMessage` pattern with `JobContext` containing the Grand Melee execution summary

### Requirement 13: Battle Type and Schema Registration

**User Story:** As a developer, I want Grand Melee to be a first-class battle type in the system, so that all existing infrastructure (battle history, API endpoints, type unions) recognizes it.

#### Acceptance Criteria

1. THE `ALL_BATTLE_TYPES` array in `baseOrchestrator.ts` SHALL include `'grand_melee'` as the 9th entry
2. THE `BattleType` type union SHALL include `'grand_melee'`
3. THE `MatchType` Prisma enum SHALL include `grand_melee` for scheduling via `schedulingService`
4. THE `JobState['name']` union in `cycleScheduler.ts` SHALL continue to include `'grandMelee'` (already present)
5. THE `SchedulerConfig` interface SHALL continue to include `grandMeleeSchedule: string` (already present)
6. WHEN creating a Grand Melee Battle record, THE Grand_Melee_Orchestrator SHALL set `battleType = 'grand_melee'`, `mode = 'grand_melee'`, and `participantCount` to the actual number of robots in the match
7. THE Grand Melee Battle record SHALL store metadata containing: `arenaRadius` (computed), `placementPoints` (the F1 point array), and `matchGroupId` (for matchmaking traceability via scheduled match ID)

### Requirement 14: Grand Melee Win Condition and Placement Logic

**User Story:** As a player, I want clear and fair placement rules for Grand Melee, so that I understand how my final position is determined.

#### Acceptance Criteria

1. THE Grand_Melee_Orchestrator SHALL determine the winner as the last robot surviving (last-standing elimination) when `simulateBattleMulti` completes with a natural end (one robot remains)
2. WHEN the standard 120-second time limit is reached with multiple robots surviving, THE Grand_Melee_Orchestrator SHALL rank surviving robots by HP percentage descending (highest HP% = 1st place among survivors), same as the tournament HP tiebreaker logic
3. THE Grand_Melee_Orchestrator SHALL rank eliminated robots by elimination time: the robot eliminated last among the dead receives the highest rank among eliminated robots (placement = number of survivors + 1), and the robot eliminated first receives the lowest rank (placement = total participants)
4. IF multiple robots are eliminated in the same simulation tick (mutual destruction), THEN THE Grand_Melee_Orchestrator SHALL rank those robots by total damage dealt descending among themselves (higher damage dealt = higher rank)
5. IF multiple surviving robots have identical HP percentage at time limit, THEN THE Grand_Melee_Orchestrator SHALL break the tie by total damage dealt descending
6. THE Grand_Melee_Orchestrator SHALL assign placement values as integers from 1 (winner) to N (first eliminated), with no gaps or duplicates in the placement sequence

### Requirement 15: Battle Performance Statistics

**User Story:** As a player, I want to see detailed per-robot performance statistics for Grand Melee battles, so that I can analyze my robot's performance.

#### Acceptance Criteria

1. THE `BattleSummary` for Grand Melee battles SHALL include per-robot statistics: placement, kills, damage dealt, damage received, survival time (seconds alive), HP remaining at end, and total distance moved
2. THE `BattleSummary` SHALL include match-level statistics: total match duration, total eliminations, first blood (first robot eliminated and by whom), and whether the match ended by time limit or natural elimination
3. WHEN computing the BattleSummary, THE Grand_Melee_Orchestrator SHALL use the existing `computeBattleSummary` function extended to handle Grand Melee placement data (placement array, elimination timestamps, kill attribution)
4. THE BattleDetailPage SHALL display Grand Melee statistics in a results table sorted by placement, showing: rank, robot name, kills, damage dealt, damage received, survival time, and HP remaining
5. ON viewports below 1024px, THE BattleDetailPage SHALL render Grand Melee statistics as stacked cards (one per robot sorted by placement) instead of a wide table, showing only key stats (placement, kills, damage dealt) with an expandable section for full details

### Requirement 16: Hall of Records Integration

**User Story:** As a player, I want Grand Melee records and achievements to appear in the Hall of Records, so that top performers are celebrated.

#### Acceptance Criteria

1. THE Hall_of_Records SHALL include a "Grand Melee" section displaying records fetched via a new `fetchGrandMeleeRecords()` query function, following the same pattern as `fetchKothRecords()`
2. THE `fetchGrandMeleeRecords` function SHALL query Standing records with `mode = 'grand_melee'` to produce: most wins (1st-place finishes), highest average placement, most kills career, longest top-3 streak, and best single-match damage
3. THE Hall_of_Records frontend section SHALL render Grand Melee records using the same card/table pattern as existing KotH records, with mobile-responsive layout (stacked cards on viewports below 1024px)
4. THE records cache (`TimedCache`) SHALL include Grand Melee records in its cached payload, invalidated on the same 5-minute cycle as other records

### Requirement 17: In-Game Guide Content

**User Story:** As a player, I want to read about Grand Melee rules, strategy, and rewards in the in-game guide, so that I understand how the mode works before subscribing.

#### Acceptance Criteria

1. THE Guide_Service SHALL serve a new `grand-melee` section containing at minimum: overview/basics, entry requirements, scoring and placement rules, rewards, and strategy articles
2. THE Guide content SHALL be authored as Markdown files with YAML frontmatter in `app/backend/src/content/guide/grand-melee/`, following the same structure as `king-of-the-hill/`
3. THE `sections.json` registry SHALL include the `grand-melee` section with appropriate ordering and description
4. THE Guide articles SHALL explain: how placement is determined (elimination order + HP tiebreaker), the F1 point scale, tier-scaled rewards, optimal build archetypes for FFA, and differences from KotH/league

### Requirement 18: Documentation and Steering File Updates

**User Story:** As a developer, I want project documentation to reflect the new Grand Melee mode, so that future development work has accurate context.

#### Acceptance Criteria

1. THE `project-overview.md` steering file SHALL be updated to include Grand Melee in the Key Systems list and update the Daily Cron Schedule description to reference the 17:00 UTC Grand Melee slot as live
2. THE `docs/architecture/PRD_SERVICE_DIRECTORY.md` Cron Schedule section SHALL list the Grand Melee slot as active with its handler reference
3. THE `docs/BACKLOG.md` SHALL move item #30 ("Free-for-All / Battle Royale Mode") to the "Recently Completed" table with a reference to Spec #44
4. THE `docs/analysis/FREE_FOR_ALL_BATTLE_ROYALE_MODE.md` status SHALL be updated from "FUTURE RELEASE" to reference the shipped implementation (Spec #44, Phase 1 at 20 robots)
