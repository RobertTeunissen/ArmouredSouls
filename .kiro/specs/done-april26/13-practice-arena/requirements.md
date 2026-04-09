# Requirements Document

## Introduction

The Practice Arena is a 1v1 sandbox battle simulator that allows players to run simulated battles between their own robots (or against configurable sparring partners) without any economic consequences. Battles in the Practice Arena do not affect robot HP, ELO, league points, credits, fame, or prestige, and produce zero database writes. The feature calls the exact same combat engine code path (`simulateBattleMulti` in `combatSimulator.ts`) as real league and tournament battles — no forked or custom combat logic — so any future changes to combat formulas, attributes, or messages are automatically reflected in practice battles. Players see the battle log and battle playback using the same `BattlePlaybackViewer` component as real battles, but the Practice Arena page uses distinct visual styling to clearly differentiate practice matches from real ones. Practice battle results are persisted in the browser's localStorage (not in-memory session state) so that results survive page navigation and refreshes. Practice battles are excluded from battle history and recent matches.

## Glossary

- **Practice_Arena**: The 1v1 sandbox battle simulation feature that runs consequence-free battles using the existing combat engine. Supports only 1v1 battles (no team battles, no King of the Hill, no multi-robot modes).
- **Practice_Battle**: A single simulated 1v1 battle executed within the Practice Arena that produces zero persistent side effects on robot state, player economy, or database records.
- **Sparring_Partner**: A virtual opponent robot constructed from a player-selected loadout type, stance, range band, and bot tier. Weapons are auto-selected from the weapon catalog based on the chosen loadout, range band, and price tier, using the existing `selectWeapon` / `selectShield` functions from `weaponSelection.ts`. Four sparring partner types exist: the first three match the existing tier system in `tierConfig.ts` exactly (WimpBot: attribute level 1, Budget price tier ₡0–₡99,999; AverageBot: attribute level 5, Standard price tier ₡100,000–₡250,000; ExpertBot: attribute level 10, Premium price tier ₡250,000–₡400,000), and a new LuxuryBot (attribute level 15, Luxury price tier ₡400,000+) is added for the Practice Arena only.
- **Battle_Report**: The detailed post-battle analysis output showing combat events, damage breakdown, timeline, and performance statistics.
- **Battle_Playback**: The visual replay of a Practice_Battle rendered using the existing `BattlePlaybackViewer` component, identical in content to real battle playback.
- **Combat_Engine**: The existing `simulateBattleMulti` function in `combatSimulator.ts` that performs tick-based battle simulation. The Practice Arena calls this exact function — no forked or custom combat logic.
- **Narrative_Generator**: The existing `convertBattleEvents` / `convertSimulatorEvents` pipeline in `combatMessageGenerator.ts` that converts raw `CombatEvent[]` into human-readable battle narratives.
- **Loadout**: A robot's weapon and shield configuration (single, weapon_shield, two_handed, dual_wield).
- **Stance**: A robot's pre-battle behavior setting (offensive, defensive, balanced).
- **Yield_Threshold**: The HP percentage at which a robot surrenders during battle.
- **What-If_Configuration**: A temporary override of a robot's attributes, weapons, loadout, or stance applied only within a Practice Battle without modifying the persisted robot state. These overrides are discarded after the practice session and never affect the real robot.
- **Price_Tier**: One of four weapon cost ranges used to categorize sparring partner equipment. The first three match the existing `tierConfig.ts` price tiers exactly: Budget/WimpBot (₡0–₡99,999), Standard/AverageBot (₡100,000–₡250,000), Premium/ExpertBot (₡250,000–₡400,000). The fourth is new for the Practice Arena: Luxury/LuxuryBot (₡400,000+).
- **Result_History**: The collection of recent Practice_Battle results stored in the browser's localStorage, persisting across page navigation and refreshes within the same browser.
- **Batch_Run**: A single API call that executes N Practice_Battles (2-10) with the same configuration and returns all individual results plus aggregate statistics. Each battle in a batch counts toward the rate limit.

## Expected Contribution

This spec addresses a gap in the player experience: there is currently no way for players to test robot configurations, evaluate upgrade paths, or experiment with weapon/loadout combinations without risking real resources (credits for repairs, ELO changes, league point losses). Players must commit to real battles to learn what works, which creates a punishing feedback loop for new and experimenting players.

1. **New player decision support**: Before this spec, players have 0 tools to preview battle outcomes before committing. After, players can run practice simulations to evaluate builds, reducing blind upgrade spending.
2. **Full combat engine reuse with zero forking**: The Practice Arena calls the exact same `simulateBattleMulti` code path as real 1v1 league battles with 0 modifications to combat logic, 0 forked combat code, and 0 custom simulation paths. If combat formulas, attribute effects, or combat messages are ever updated, practice battles automatically reflect those changes.
3. **Battle log and playback parity**: Practice battles produce the same battle log (via `convertBattleEvents`) and the same visual playback (via `BattlePlaybackViewer`) as real battles. The Practice Arena page uses distinct visual styling (e.g., different background, "PRACTICE" badge) to differentiate from real battle pages, but the battle content itself is identical.
4. **What-If analysis capability**: Before, players must spend credits to upgrade attributes and buy weapons to test configurations. After, players can temporarily override any attribute (1-50) and select any weapon from the 47-weapon catalog in a sandbox, seeing estimated upgrade costs before committing. These overrides are clearly marked as temporary and never affect the real robot.
5. **Minimal database footprint**: Practice battles produce zero writes to robot, user, battle, or audit tables. The only database addition is a `practice_arena_daily_stats` table that receives one INSERT per day at midnight UTC for admin trend tracking. No battle-level writes.
6. **Persistent client-side result history**: Practice battle results are stored in the browser's localStorage (not in-memory session state), so results survive page navigation and browser refreshes. Players can leave the Practice Arena to check robot attributes or visit the weapon shop and return without losing their results.
7. **Server protection**: Rate limiting (30 battles per 15 minutes per player) ensures the CPU-intensive combat simulation cannot be abused to degrade server performance.

### Verification Criteria

1. `grep -r "practice-arena" prototype/backend/src/routes/ | wc -l` returns at least 1 (route file exists)
2. `grep -r "practice-arena" prototype/frontend/src/ | wc -l` returns at least 1 (frontend page exists)
3. `grep -r "simulateBattleMulti\|simulateBattle" prototype/backend/src/services/practice-arena/ | wc -l` returns at least 1 (service calls existing combat engine)
4. `grep -rn "prisma\.\(battle\|battleParticipant\)\.create" prototype/backend/src/services/practice-arena/ | wc -l` returns 0 (no production battle records created)
5. `grep -rn "prisma\.robot\.update" prototype/backend/src/services/practice-arena/ | wc -l` returns 0 (no robot state mutations)
6. `grep -rn "prisma\.user\.update" prototype/backend/src/services/practice-arena/ | wc -l` returns 0 (no user economy mutations)
7. `ls prototype/backend/prisma/migrations/ | wc -l` increases by exactly 1 after implementation (one migration for `practice_arena_daily_stats` table)
8. Backend practice arena tests pass: `cd prototype/backend && npx jest --testPathPattern=practice-arena --passWithNoTests`
9. Frontend practice arena tests pass: `cd prototype/frontend && npx vitest run --reporter=verbose src/**/*practice-arena*`
10. `grep -r "rateLimit\|rateLimiter\|rate-limit" prototype/backend/src/routes/practiceArena.ts | wc -l` returns at least 1 (rate limiting configured)
11. `grep -rn "localStorage" prototype/frontend/src/pages/PracticeArenaPage.tsx prototype/frontend/src/hooks/usePracticeHistory.ts | wc -l` returns at least 1 (localStorage used for result persistence)
12. `grep -rn "BattlePlaybackViewer" prototype/frontend/src/pages/PracticeArenaPage.tsx | wc -l` returns at least 1 (reuses existing playback component)
13. `grep -rn "convertBattleEvents\|convertSimulatorEvents" prototype/backend/src/services/practice-arena/ | wc -l` returns at least 1 (reuses existing narrative generator)
14. `grep -rn "battlePostCombat\|updateRobotCombatStats\|awardCreditsToUser\|awardPrestigeToUser\|awardFameToRobot\|logBattleAuditEvent" prototype/backend/src/services/practice-arena/ | wc -l` returns 0 (no post-combat pipeline imports)
15. `grep -rn "cycleScheduler\|BattleStrategy\|BattleProcessor" prototype/backend/src/services/practice-arena/ | wc -l` returns 0 (no orchestrator dependencies)
16. `grep -rn "practice-arena/stats" prototype/backend/src/routes/admin.ts | wc -l` returns at least 1 (admin metrics endpoint exists)
17. `grep -rn "getSchedulerState" prototype/backend/src/routes/practiceArena.ts | wc -l` returns at least 1 (cycle execution guard exists)

## Requirements

### Requirement 1: 1v1 Practice Battle Between Owned Robots

**User Story:** As a player, I want to select two of my own robots and run a simulated 1v1 battle between them, so that I can evaluate how different robot builds perform against each other.

#### Acceptance Criteria

1. WHEN a player selects two robots from their stable, THE Practice_Arena SHALL execute a Practice_Battle using the Combat_Engine with those robots' current attributes, weapons, loadout, and stance.
2. THE Practice_Arena SHALL support only 1v1 battles between exactly two robots. THE Practice_Arena SHALL not support team battles, King of the Hill, or any multi-robot battle mode.
3. THE Practice_Arena SHALL use each robot's current persisted state (attributes, equipped weapons, loadout type, stance, yield threshold) as the default configuration for a Practice_Battle.
4. THE Practice_Arena SHALL always set owned robots to full HP (`maxHP`) and full shield (`maxShield`) before executing a Practice_Battle, regardless of the robot's current repair state. Practice battles always simulate fully repaired robots, consistent with how all real battle orchestrators operate.
5. IF a player selects a robot that has no weapon equipped, THEN THE Practice_Arena SHALL display a validation error indicating the robot requires at least a main weapon to participate.

### Requirement 2: Full Combat Engine Compatibility

**User Story:** As a player, I want practice battles to use the exact same combat engine as real battles, so that practice results accurately reflect how my robot would perform in a real match.

#### Acceptance Criteria

1. THE Practice_Arena SHALL execute Practice_Battles by calling the same `simulateBattleMulti` function in `combatSimulator.ts` that league and tournament orchestrators use, with zero custom or forked combat logic.
2. THE Practice_Arena SHALL generate battle narratives by calling the same `convertBattleEvents` / `convertSimulatorEvents` pipeline in `combatMessageGenerator.ts` that real battle orchestrators use.
3. THE Practice_Arena SHALL pass the same `BattleConfig` structure to the Combat_Engine as a standard 1v1 league battle (with `allowDraws: true`).
4. WHEN the combat engine, combat formulas, attribute effects, or combat message templates are updated in the codebase, THE Practice_Arena SHALL automatically reflect those changes without requiring any practice-arena-specific code modifications.

### Requirement 3: Battle Log and Playback

**User Story:** As a player, I want to see the battle log and visual playback for practice battles in the same way I see them for real battles, so that I can fully analyze combat dynamics.

#### Acceptance Criteria

1. WHEN a Practice_Battle completes, THE Practice_Arena SHALL display the battle log using the same narrative format produced by the Narrative_Generator as real battles.
2. WHEN a Practice_Battle completes, THE Practice_Arena SHALL render the Battle_Playback using the existing `BattlePlaybackViewer` component with the same visual fidelity and controls as real battle playback.
3. THE Practice_Arena page SHALL use distinct visual styling (e.g., different background color, border treatment, or a prominent "PRACTICE MATCH" badge) to clearly differentiate practice battles from real battles.
4. WHEN a Practice_Battle completes, THE Battle_Report SHALL display a summary including: winner, battle duration in seconds, total damage dealt by each robot, total damage received by each robot, and final HP and shield values.
5. WHEN a Practice_Battle completes, THE Battle_Report SHALL display per-robot statistics including: hit rate percentage, critical hit rate percentage, malfunction rate percentage, counter-attack trigger rate percentage, and average damage per hit.
6. WHEN a Practice_Battle completes, THE Battle_Report SHALL display effective attribute values for each robot showing the breakdown of base attributes, weapon bonuses, loadout modifiers, and stance modifiers.

### Requirement 4: Practice Battles Excluded from Battle History

**User Story:** As a player, I want practice battles to be completely separate from my real battle history, so that my match record reflects only real competitive results.

#### Acceptance Criteria

1. THE Practice_Arena SHALL not create any Battle or BattleParticipant database records for Practice_Battles.
2. THE Practice_Arena SHALL not include Practice_Battles in the recent matches list, battle history page, or any battle history API responses.
3. THE Practice_Arena SHALL not emit audit log events for Practice_Battles.
4. Practice_Battle results SHALL only be viewable within the Practice Arena page itself, via the client-side Result_History.

### Requirement 5: Zero Database Writes

**User Story:** As a player, I want Practice Arena battles to have no effect on my robots' stats, rankings, or economy, so that I can experiment freely without risk.

#### Acceptance Criteria

1. THE Practice_Arena SHALL execute Practice_Battles without writing any data to the database — zero INSERT, UPDATE, or DELETE operations on any table.
2. THE Practice_Arena SHALL execute Practice_Battles without modifying any robot's currentHP, currentShield, ELO rating, league points, fame, wins, losses, or damage lifetime statistics.
3. THE Practice_Arena SHALL execute Practice_Battles without awarding or deducting credits, prestige, or streaming revenue from the player's account.
4. WHEN a Practice_Battle is executed, THE Combat_Engine SHALL operate on cloned copies of robot data so that the original persisted robot state remains unchanged.
5. THE Practice_Arena SHALL not call any functions from `battlePostCombat.ts` (no `updateRobotCombatStats`, `awardCreditsToUser`, `awardPrestigeToUser`, `awardFameToRobot`, `awardStreamingRevenueForParticipant`, or `logBattleAuditEvent`).

### Requirement 6: Sparring Partner System

**User Story:** As a player, I want to fight against pre-configured sparring partners at different difficulty levels, so that I can test my robot against a variety of opponents without needing a second real robot.

#### Acceptance Criteria

1. THE Practice_Arena SHALL provide 4 Sparring_Partner types: the first three reuse the existing tier definitions from `tierConfig.ts` without modification — WimpBot (attributes: 1 across all 23 attributes, weapons from Budget tier ₡0–₡99,999), AverageBot (attributes: 5, weapons from Standard tier ₡100,000–₡250,000), ExpertBot (attributes: 10, weapons from Premium tier ₡250,000–₡400,000) — and a new LuxuryBot (attributes: 15, weapons from Luxury tier ₡400,000+) added for the Practice Arena only.
2. WHEN a player configures a Sparring_Partner, THE Practice_Arena SHALL allow the player to select the loadout type (single, weapon_shield, two_handed, dual_wield) for the sparring partner.
3. WHEN a player configures a Sparring_Partner, THE Practice_Arena SHALL allow the player to select the stance (offensive, defensive, balanced) the sparring partner uses.
4. WHEN a player configures a Sparring_Partner, THE Practice_Arena SHALL allow the player to select the range band (melee, short, mid, long) for the sparring partner's weapons.
5. WHEN a player selects a loadout type, range band, and bot tier for a Sparring_Partner, THE Practice_Arena SHALL auto-select weapons from the weapon catalog using the existing `selectWeapon` and `selectShield` functions from `weaponSelection.ts`, passing the chosen loadout type, range band, and the tier's price range. The player does not manually pick individual weapons.
6. THE Practice_Arena SHALL validate that the Sparring_Partner's auto-selected weapon and loadout configuration follows the same compatibility rules as real robots (e.g., two-handed weapons require two_handed loadout, shields require weapon_shield loadout).
7. THE Practice_Arena SHALL allow the player to set the Sparring_Partner's yield threshold within the valid range of 0 to 50.
8. THE Practice_Arena SHALL not provide free-form attribute editing or default loadout presets (Tank, Glass Cannon, etc.) for Sparring_Partners. The 4 bot-tier types (WimpBot, AverageBot, ExpertBot, LuxuryBot) with fixed attribute levels are the only sparring partner configurations.

### Requirement 7: What-If Configuration Overrides

**User Story:** As a player, I want to temporarily modify my robot's attributes, weapons, or loadout for a practice battle without changing the real robot, so that I can evaluate potential upgrades before spending credits.

#### Acceptance Criteria

1. WHEN a player configures a What-If_Configuration for a Practice_Battle, THE Practice_Arena SHALL allow temporary overrides of any of the 23 robot attributes within the valid range of 1 to 50.
2. WHEN a player configures a What-If_Configuration, THE Practice_Arena SHALL allow temporary selection of any weapon from the full 47-weapon catalog regardless of the player's owned inventory.
3. WHEN a player configures a What-If_Configuration, THE Practice_Arena SHALL allow temporary changes to loadout type, stance, and yield threshold.
4. THE Practice_Arena SHALL clearly indicate which values have been overridden from the robot's actual persisted state using visual differentiation (e.g., color highlight or icon).
5. THE Practice_Arena SHALL display a prominent notice that What-If overrides are temporary and do not affect the real robot.
6. THE Practice_Arena SHALL validate that What-If_Configuration overrides follow the same weapon-loadout compatibility rules as real robot configurations.
7. WHEN a What-If_Configuration includes attribute changes, THE Practice_Arena SHALL display the estimated credit cost of upgrading from the robot's current attribute levels to the overridden levels.
8. WHEN a Practice_Battle session ends or the player navigates away from the Practice Arena, THE Practice_Arena SHALL discard all What-If_Configuration overrides without modifying the real robot.

### Requirement 8: Persistent Client-Side Result History

**User Story:** As a player, I want my practice battle results to persist when I navigate away from the Practice Arena and come back, so that I don't lose my results when checking robot attributes or visiting the weapon shop.

#### Acceptance Criteria

1. THE Practice_Arena SHALL store Practice_Battle results in the browser's localStorage, keyed per authenticated player.
2. THE Practice_Arena SHALL retain the results of the last 10 Practice_Battles in localStorage for comparison and review.
3. WHEN a player returns to the Practice Arena page after navigating away, THE Practice_Arena SHALL restore and display the stored Result_History from localStorage.
4. WHEN a player runs multiple Practice_Battles with the same robots, THE Practice_Arena SHALL allow the player to view a comparison of results showing win/loss outcomes, average damage, and average battle duration across runs.
5. WHEN a Practice_Battle completes, THE Practice_Arena SHALL provide a "Re-Run" action that executes the same battle configuration again to observe variance from the combat engine's random elements.
6. THE Practice_Arena SHALL provide a "Run Batch" action that executes N Practice_Battles (where N is player-selected, between 2 and 10) with the same configuration in a single API call and displays aggregate statistics (win rate, average damage dealt per robot, average battle duration) alongside the individual results.
7. WHEN a batch of Practice_Battles completes, each individual battle result SHALL be stored in the Result_History (up to the 10-result cap, oldest results evicted first).
8. THE Practice_Arena SHALL provide a "Clear History" action that removes all stored Practice_Battle results from localStorage.

### Requirement 9: Practice Battle Rate Limiting

**User Story:** As a system administrator, I want practice battles to be rate-limited, so that the server is protected from excessive simulation requests.

#### Acceptance Criteria

1. THE Practice_Arena SHALL enforce a rate limit of 30 Practice_Battles per player per 15-minute window. Each individual battle in a batch counts toward this limit.
2. IF a player exceeds the Practice_Battle rate limit, THEN THE Practice_Arena SHALL return an error response with a descriptive message indicating the remaining cooldown time.
3. WHEN a Practice_Battle request is received, THE Practice_Arena SHALL execute the simulation synchronously and return the Battle_Report in the API response without queuing or background processing.
4. IF a batch request would cause the player to exceed the rate limit, THE Practice_Arena SHALL reject the entire batch before executing any battles and return the number of remaining battles allowed in the current window.
5. WHEN a cycle job is currently executing (as reported by `getSchedulerState().runningJob` being non-null), THE Practice_Arena SHALL reject all battle requests with a 503 Service Unavailable status and a message indicating that the Practice Arena is temporarily unavailable while real battles are being processed.
6. THE Practice_Arena frontend SHALL display a clear message to the player when the Practice Arena is unavailable due to cycle execution, and SHALL automatically retry or re-enable when the cycle completes.

### Requirement 10: Practice Arena API

**User Story:** As a developer, I want a well-defined API for the Practice Arena, so that the frontend can integrate with the battle simulation backend.

#### Acceptance Criteria

1. THE Practice_Arena SHALL expose a POST endpoint at `/api/practice-arena/battle` that accepts two robot configurations (either owned robot IDs with optional What-If overrides, or Sparring_Partner definitions) and an optional `count` parameter (integer, 1-10, default 1) and returns one or more Battle_Reports including the full battle log, combat events, and playback data.
2. WHEN the `count` parameter is greater than 1, THE Practice_Arena SHALL execute that many battles sequentially with the same configuration and return all individual results plus aggregate statistics (win count per robot, average damage dealt per robot, average battle duration).
3. THE Practice_Arena SHALL expose a GET endpoint at `/api/practice-arena/sparring-partners` that returns the 4 Sparring_Partner type definitions (WimpBot, AverageBot, ExpertBot, LuxuryBot) with their attribute levels, price tiers, and available loadout/stance options.
4. WHEN the battle endpoint receives owned robot IDs, THE Practice_Arena SHALL verify that the authenticated player owns the robots before executing the simulation.
5. THE Practice_Arena SHALL validate all request payloads using Zod schemas before executing any simulation logic.
6. IF the battle endpoint receives invalid robot configurations, THEN THE Practice_Arena SHALL return a 400 status code with a descriptive error message identifying the validation failure.

### Requirement 11: Practice Arena Frontend Page

**User Story:** As a player, I want a dedicated Practice Arena page in the game UI, so that I can easily access and use the battle simulation feature.

#### Acceptance Criteria

1. THE Practice_Arena SHALL be accessible from the main navigation menu as a distinct page.
2. THE Practice_Arena page SHALL display a robot selection panel where the player can choose a robot from their stable for one battle slot and either a second owned robot or a Sparring_Partner for the other slot.
3. THE Practice_Arena page SHALL display the What-If_Configuration controls for each selected owned robot, allowing attribute, weapon, loadout, stance, and yield threshold overrides.
4. THE Practice_Arena page SHALL display the Sparring_Partner configuration controls (bot tier selection, loadout type, range band, stance, yield threshold) when a sparring partner is selected for a battle slot.
5. THE Practice_Arena page SHALL display the Battle_Report and Battle_Playback inline after a Practice_Battle completes, without navigating to a separate page.
6. THE Practice_Arena page SHALL provide a batch count selector (1-10) next to the "Run Battle" button, allowing the player to run multiple battles with the same configuration in one action.
7. WHEN a batch of Practice_Battles completes, THE Practice_Arena page SHALL display aggregate statistics (win rate, average damage, average duration) prominently, with individual results expandable below.
8. WHILE a Practice_Battle or batch is being executed, THE Practice_Arena page SHALL display a loading indicator (with progress for batches, e.g., "Running battle 3 of 10...") to communicate that the simulation is in progress.
9. THE Practice_Arena page SHALL use distinct visual styling to differentiate from real battle pages, making clear to the player that results are from a practice match.
10. THE Practice_Arena page SHALL be responsive and functional on both desktop and mobile viewport sizes.

### Requirement 12: Architectural Independence from Battle Orchestrators

**User Story:** As a developer, I want the Practice Arena to be architecturally independent from the cycle-driven battle orchestrators, so that it does not interfere with the existing battle pipeline and requires no cron jobs or admin triggers.

#### Acceptance Criteria

1. THE Practice_Arena SHALL be implemented as a standalone service in `services/practice-arena/` that is not invoked by the cycle scheduler (`cycleScheduler.ts`), not triggered by any cron job, and not triggered by any admin portal action.
2. THE Practice_Arena SHALL not use or extend the `BattleStrategy` / `BattleProcessor` pattern from `battleStrategy.ts`. It is a synchronous request/response service, not a scheduled orchestrator.
3. THE Practice_Arena SHALL not import or call any function from `battlePostCombat.ts`. The entire post-combat pipeline (stat updates, rewards, audit logging, streaming revenue) is skipped.
4. THE Practice_Arena SHALL only read from the database (robot data, weapon catalog) and never write. The only shared code it imports from the `battle/` domain is `simulateBattle` from `combatSimulator.ts` and `convertBattleEvents` / `convertSimulatorEvents` from `combatMessageGenerator.ts`.
5. THE Practice_Arena service SHALL have no dependency on scheduled matches (`ScheduledMatch`, `ScheduledTagTeamMatch`, `ScheduledKothMatch`, `ScheduledTournamentMatch`). Battles are triggered on-demand by the player via the API.

### Requirement 13: Admin Portal Metrics

**User Story:** As a system administrator, I want to see Practice Arena usage metrics in the admin portal, so that I can monitor feature adoption and server load impact.

#### Acceptance Criteria

1. THE Practice_Arena backend SHALL maintain in-memory counters tracking: total practice battles executed since server start, practice battles executed in the current day (UTC), rate limit rejections in the current day, and unique player IDs that have used the practice arena in the current day.
2. THE Practice_Arena SHALL expose a GET endpoint at `/api/admin/practice-arena/stats` (protected by `authenticateToken` and `requireAdmin`) that returns the current in-memory counter values plus historical daily summaries from the database.
3. THE admin Dashboard tab SHALL display a "Practice Arena" section showing: total battles today, unique players today, rate limit hits today, total battles since server start, and a historical trend of daily usage.
4. THE in-memory counters SHALL be flushed and reset as part of the daily settlement cycle (23:00 UTC). The settlement step SHALL call `practiceArenaMetrics.flushAndReset()`, which persists the current day's counters to the `practice_arena_daily_stats` table and then zeroes the daily counters. The `totalBattlesSinceStart` counter SHALL not be reset.
5. THE `practice_arena_daily_stats` table SHALL store one row per day with columns: `id` (auto-increment), `date` (unique, DATE), `totalBattles` (integer), `uniquePlayers` (integer), `rateLimitHits` (integer), `playerIds` (JSON array of integer user IDs who triggered battles that day), `createdAt` (timestamp).
