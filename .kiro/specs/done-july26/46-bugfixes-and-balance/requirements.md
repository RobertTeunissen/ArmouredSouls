# Requirements Document

## Spec: Bug Fixes and Balance Changes

## Glossary

- **Cycle_Scheduler**: The existing production scheduler (`app/backend/src/services/cycle/cycleScheduler.ts`) that fires 11 cron jobs daily plus settlement at 00:00 UTC.
- **Battle_Event_Job**: Any of the Cycle_Scheduler jobs that schedule or execute battles: `league`, `tournament`, `tagTeam`, `koth`, `team2v2League`, `team3v3League`, `team2v2Tournament`, `team3v3Tournament`, `grandMelee`.
- **Tournament_Auto_Creation**: The step of a tournament Battle_Event_Job that creates the next bracket of its participant type when no tournament of that type is active. Implemented by `autoCreateNextTournament()` for 1v1 and `autoCreateNextTeamTournament(size)` for 2v2 and 3v3.
- **Participant_Type**: The tournament discriminator `robot`, `team_2v2`, or `team_3v3`, stored on `tournaments.participant_type`.
- **Season_Service**: The service introduced by Spec #45 that owns season state and exposes the current Season_Phase. Referenced by this spec only as a seam; it does not exist until Spec #45 ships.
- **Season_Phase**: The current phase of the current season, one of `preparation` or `competitive`, owned by the Season_Service introduced in Spec #45.
- **Preparation_Phase**: The two-cycle window between seasons defined by Spec #45, during which battle events are suspended and balance changes are deployed. This spec is intended to be applied during a Preparation_Phase once Spec #45 has shipped.
- **Settlement_Job**: The midnight (00:00 UTC) Cycle_Scheduler job that credits passive income, deducts facility operating costs, and advances the cycle counter. Implemented by `executeDailySettlement()` in `cycleScheduler.ts`.
- **Roster_Capacity**: The maximum number of robots a stable may own, derived as the stable's `roster_expansion` facility level plus one. A stable with no `roster_expansion` row has a Roster_Capacity of 1. Already computed as `maxRobots` in `robotCreationService.ts`.
- **Prestige_Per_Slot**: A stable's `prestige` value divided by its Roster_Capacity. The normalised prestige measure that drives merchandising income.
- **Training_Discount_Rate_Per_Level**: The percentage points of attribute-upgrade discount each Training Facility level grants, computed as `max(0, 10 - Roster_Capacity)`. Exported as `TRAINING_DISCOUNT_BASE_PER_LEVEL` and `TRAINING_DISCOUNT_PER_SLOT` from `app/shared/utils/discounts.ts`.
- **Training_Discount**: The total attribute-upgrade discount a stable receives, `clamp(Training_Discount_Rate_Per_Level × level, 0, 90)`. Computed by `calculateTrainingFacilityDiscount()`.
- **Merchandising_Base_Rate**: The daily credit base of the Merchandising Hub before the Merch_Multiplier is applied, returned by `getMerchandisingBaseRate()`.
- **Merch_Multiplier**: The multiplier applied to the Merchandising_Base_Rate, defined as `1 + Prestige_Per_Slot / 10000`.
- **Merchandising_Prestige_Gate**: The Prestige_Per_Slot threshold a stable must meet to purchase a given Merchandising Hub level, stored in the `prestigeRequirements` array of the `merchandising_hub` entry in `src/config/facilities.ts`.
- **Streaming_Revenue_Formula**: The canonical per-battle streaming revenue calculation `1000 × (1 + battles/1000) × (1 + fame/5000) × (1 + studioLevel)`, implemented by `calculateStreamingRevenue()` and `calculateStreamingRevenueBatch()` in `streamingRevenueService.ts`. This is the only formula that awards credits; every other occurrence is display-only.
- **Refinement_Fold**: The pure computation that turns a weapon's catalog stats plus its refinement rows into effective combat stats. Implemented by `applyRefinementsToWeapon()` in `app/shared/utils/weaponRefinement.ts`, and the only place refinement effects are calculated. The simulator reads the folded values off `weapon.baseDamage` and `weapon.cooldown` and never sees refinement rows. Note that `app/backend/src/shared/utils` is a committed symlink (git mode `120000`) to `app/shared/utils`, so the backend and frontend read the same file rather than two copies.
- **Sharpen_Cooldown_Reduction**: The proportional reduction one Sharpen instance applies to a weapon's base cooldown. Stacks additively on the catalog value across instances.
- **Forge_Damage_Increase**: The proportional increase one Forge instance applies to a weapon's base damage. Stacks additively on the catalog value across instances.
- **Effective_Cooldown**: The weapon cooldown output by the Refinement_Fold, written onto `weapon.cooldown` by `prepareRobotForCombat()` and consumed by `calcCooldown()`. Returned as `effectiveCooldown` from `applyRefinementsToWeapon()`.
- **Effective_Base_Damage**: The weapon base damage output by the Refinement_Fold, written onto `weapon.baseDamage` by `prepareRobotForCombat()`. Returned as `effectiveBaseDamage` from `applyRefinementsToWeapon()`.
- **Refinement_Rounding_Precision**: The number of decimal places the Refinement_Fold rounds its outputs to, so that the frontend preview and the combat engine cannot diverge through floating-point drift. Two decimals, matching the `Decimal(5, 2)` convention used for robot attributes.
- **Observable_Cadence**: The real firing interval of a weapon in the simulation loop, which the `SIMULATION_TICK` of 0.1s quantises to `ceil(cooldown / 0.1) × 0.1`. Distinct from the folded cooldown value, because the loop fires on the first tick at or past the cooldown.
- **Hall_Of_Records**: The player-facing records page at `/hall-of-records`, served by `GET /api/records` from `recordsQueryService.ts` and rendered by the components in `app/frontend/src/components/hall-of-records/`.
- **Record_Category**: A single ranked list within a Hall_Of_Records tab, such as Fastest Victory or Biggest Upset. Each Record_Category is one key of the response object returned by the corresponding `fetch*Records()` function.
- **Mode_Scoped_Record**: A Record_Category computed and displayed separately per `battles.battle_type` rather than pooled across all types, so that modes with structurally different value ranges are not ranked against each other.
- **Time_Limit_Termination**: A battle that ends because the simulation reached `MAX_BATTLE_DURATION` (120s) rather than because a robot was destroyed or yielded. Resolved by `handleTimeLimitReached()`.
- **Career_Battle_Counters**: The `robots` columns `totalBattles`, `wins`, `losses`, `draws`, and the stance and loadout win counters. All are skipped when an orchestrator passes `skipBattleCounters: true` to `updateRobotCombatStats()`, which both the KotH and Grand Melee orchestrators do.
- **Zone_Metric_Precision**: The rounding applied to the accumulated `standings.total_zone_score` and `standings.total_zone_time` float columns before display, matching the `SIMULATION_TICK` granularity of 0.1.
- **Fame_Leaderboard**: The leaderboard at `/leaderboards/fame`, served by `GET /api/leaderboards/fame` from `getFameLeaderboard()` and rendered by `LeaderboardsFamePage.tsx`. Ranks individual robots by `robots.fame`.
- **Prestige_Leaderboard**: The leaderboard at `/leaderboards/prestige`, served by `GET /api/leaderboards/prestige` from `getPrestigeLeaderboard()` and rendered by `LeaderboardsPrestigePage.tsx`. Ranks stables by `users.prestige`.
- **Leaderboard_Cache_Key**: The composite in-memory cache key built in `leaderboards.ts` from the route name and every query parameter, governing the five-minute `LEADERBOARD_TTL` cache.
- **Booking_Office_Page**: The page at `/booking-office`, rendered by `BookingOfficePage.tsx`, which explains the Event Subscription System and hosts the SubscriptionMatrix.
- **Subscription_Cap**: The number of concurrent event subscriptions one robot may hold, equal to `3 + booking_office level`.
- **Facility_Upgrade_Endpoint**: `POST /api/facilities/upgrade`, which takes a `facilityType` body field, validates level, prestige, and credits, and raises the facility by one level.
- **Facility_Operating_Cost_Chain**: The `if`/`else if` chain in the `GET /api/facilities` handler in `facility.ts` that recomputes `currentOperatingCost` and `nextOperatingCost` per facility type, duplicating `calculateFacilityOperatingCost()` from `economyFormulas.ts`.
- **Upgrade_Implication_Panel**: The Booking_Office_Page region that states, before the player commits, the credit cost of the next level, the resulting Subscription_Cap, the resulting daily operating cost, and any unmet prestige requirement.
- **League_Mode**: A `StandingsMode` value whose orchestrator calls `standingsService.recordBattleResult()` and therefore maintains streak columns: `'league_1v1'` for robots, and `'league_2v2'`, `'league_3v3'`, and `'tag_team'` for teams. The tournament modes do not call it and hold no streak data.
- **Win_Streak_Record**: A Record_Category ranking entities by `standings.best_win_streak` within a single League_Mode, where the ranked entity is a robot for `'league_1v1'` and a `TeamBattle` for the three team modes.
- **Achievement_Trigger_Registration**: The three places a `AchievementTriggerType` must appear to be evaluated: the union in `achievements.ts`, the relevant event array in `EVENT_TRIGGER_MAP` in `achievementTypes.ts`, and the `switch` in `evaluateTrigger()` in `triggerEvaluator.ts`. A trigger present in the union and used by a definition but absent from either of the other two is never evaluated.
- **Achievement_Progress_Resolver**: The `switch` in `achievementCatalog.ts` that computes the current-versus-target progress figure shown in the UI for a given trigger type. A trigger type absent from it renders no progress.
- **Robot_Scoped_Standing**: A `standings` row with `entity_type = 'robot'`, written only for the modes `'league_1v1'`, `'koth'`, and `'grand_melee'`.
- **Team_Scoped_Standing**: A `standings` row with `entity_type = 'team'` whose `entity_id` is a `TeamBattle` id, written for the modes `'league_2v2'`, `'league_3v3'`, and `'tag_team'`.
- **Opponent_Elo_Gap**: The difference between an opponent's `elo_before` and the subject robot's `elo_before` in the same battle. Distinct from the subject's own ELO change, which the fixed `ELO_K_FACTOR` of 32 bounds.
- **Disk_Monitor**: The operations script `app/scripts/disk-monitor.sh`, run by cron on the production and acceptance hosts, which reads root filesystem usage and posts a Discord alert when usage crosses a threshold.
- **Disk_Check_Interval**: How often cron invokes the Disk_Monitor, and therefore the worst-case latency between a threshold being crossed and it being detected. Currently every 15 minutes; changed by this spec to hourly.
- **Disk_Alert_Cooldown**: The minimum interval between two Disk_Monitor alerts of the same severity while usage remains above that threshold. Enforced by `should_alert()` against a timestamp file in `STATE_DIR`, and configured by the environment variable `DISK_ALERT_COOLDOWN_SECONDS`.
- **Disk_Alert_State_Directory**: The filesystem location holding the per-severity Disk_Alert_Cooldown timestamp files, resolved as `/var/lib/armouredsouls` when it exists and is writable, and `/tmp` otherwise.
- **Env_Get_Pattern**: The helper defined in `app/scripts/backup.sh` that reads a single key from a `.env` file as plain text via `grep`, `cut`, and `sed`, so that the shell never evaluates a value. Mandated by `.kiro/steering/coding-standards.md` in place of `source .env`.

## Introduction

This spec collects defects and balance adjustments that are independent of the Season System (Spec #45) but were identified while writing it. Each item stands alone: nothing here depends on the season work shipping, and nothing in Spec #45 depends on this spec.

The spec is intended to be applied during a Preparation_Phase once the Season System ships, so that balance changes land at a season boundary rather than mid-season. Before the Season System ships, the items may be applied at any time.

Balance change requirements are added to this document as they are specified. Requirement 1 is a scheduler defect. Requirement 2 re-bases merchandising income so that the Merchandising Hub rewards concentrated rosters rather than large ones. Requirement 3 converts the Sharpen and Forge weapon refinements from flat to proportional effects, removing a subsidy that favoured fast low-damage one-handed weapons. Requirement 4 prunes and re-scopes the Hall of Records so that every category presents a breakable record. Requirement 5 removes suppressive filters and non-ranking columns from the fame and prestige leaderboards. Requirement 6 adds a Booking Office upgrade control to the Booking Office page and repairs the operating costs that page needs to report. Requirement 7 surfaces the league win streak data that is already recorded but never displayed. Requirement 8 repairs nine achievements that cannot currently unlock. Requirement 9 reduces disk alerts to one every two hours and makes a failed cooldown observable. Requirement 10 removes the divergent streaming revenue formulas that show players numbers they are not paid.

## Expected Contribution

1. **Equal tournament cadence across participant types.** Before — the 1v1 tournament handler creates the next bracket in the same run that completes the final round, while the 2v2 and 3v3 handlers return early and only create on a later run, costing one idle cycle per tournament. After — all three participant types create the next bracket in the same run that completes the previous one. Verifiable by: a test per participant type asserting that the run completing the final round also creates the next tournament.

2. **Merchandising Hub rewards concentrated rosters instead of wide ones.** Before — merchandising income scales with raw stable `prestige`, which accrues once per winning robot, so a 5-robot stable earns roughly 5× the prestige and therefore 1.7× to 3.0× the merchandising income of a 1-robot stable at comparable per-robot strength. The Merchandising Hub and the Streaming Studio therefore both scale with roster size, leaving the game with two breadth facilities and no depth facility. After — merchandising scales with Prestige_Per_Slot, so a stable that concentrates its investment in one robot earns strictly more merchandising income than a stable that spreads the same prestige across a larger Roster_Capacity. Verifiable by: a property test asserting merchandising income is non-increasing in Roster_Capacity at fixed prestige.

3. **Merchandising Hub pays back inside a 100-cycle season at every level.** Before — with a ₡5,000/level base rate and a ₡150,000 × level cost curve, cumulative payback runs from 31 cycles at L1 to 172 cycles at L10 for a stable at zero prestige, so levels 7 through 10 can never be recovered inside a season once Spec #45 ships. After — doubling the Merchandising_Base_Rate to ₡10,000/level brings worst-case payback to 84 cycles at L10 and 15 cycles at L1, so every level is recoverable within one season. Verifiable by: a unit test asserting cumulative payback at each level 1–10 is under 100 cycles at Prestige_Per_Slot of zero.

4. **DPS refinement value no longer depends on which weapon class the player bought.** Before — Sharpen's flat `−0.25s` gives two instances a +33.3% attack rate on a 2.0s one-handed weapon against +9.1% on a 6.0s two-handed weapon, a 3.7× spread for the same ₡1.2M; Forge's flat `+1.0` damage gives two instances +44.4% on a 4.5-damage weapon against +10.8% on an 18.5-damage weapon, a 4.1× spread for the same ₡1.6M. Both biases point the same way, because in the catalog the fast weapons are also the low-damage one-handed ones. After — every weapon gains exactly +25% attack rate at the Sharpen cap and +16% damage at the Forge cap, regardless of its catalog cooldown or damage. Verifiable by: a property test asserting the proportional gain from a fixed refinement set is invariant across all catalog cooldown and damage values.

5. **One streaming revenue formula instead of four.** Before — `streamingRevenueService.ts` awards credits using battle and fame divisors of 1000 and 5000, while `financialReportService.ts` displays a different formula with divisors of 100 and 500 and caps of 3.0 and 2.0, and `facilityRecommendationService.ts` uses a studio multiplier of `level × 0.1` in one branch and `level × 1.0` in another within the same service. Players are shown numbers that do not match what they are paid. After — every display and projection path derives its numbers from a single exported helper, and no file redefines the multipliers locally. Verifiable by: a grep showing no occurrence of the incorrect divisors or the `level * 0.1` studio multiplier outside the canonical service.

6. **Hall of Records shows records that can actually be broken.** Before — the Combat tab ranks Longest Battle across a population where `MAX_BATTLE_DURATION` caps every long battle at the same 120s, ranks Fastest Victory across a tail of 1-second degenerate battles, and pools Most Damage across battle types whose damage ranges differ by an order of magnitude; the Upset tab ranks league battles where matchmaking pairs comparable robots so no large upset is possible, and ranks ELO gain and loss where a fixed K-factor of 32 makes every entry ±32; the KotH tab ranks Best Placement where any winner ties at 1; and clicking a record's battle returns an error. After — the Combat tab retains only Narrowest Victory and a per-mode Most Damage, every surviving Record_Category has a spread of distinct values, and every record links to a battle detail page that renders. Verifiable by: a test asserting no Record_Category returns ten identical values on seeded data, and a test asserting battle detail resolves for a battle whose `battle_log` is NULL.

7. **Fame leaderboard ranks every robot that has earned fame.** Before — the Fame_Leaderboard defaults to a minimum of 10 battles and offers a 1v1 league filter, but `robots.total_battles` is never incremented for KotH or Grand Melee because both orchestrators pass `skipBattleCounters: true`, and the league filter matches `standings.tier` for `mode = 'league_1v1'` only. A robot that earns its fame in KotH or Grand Melee is therefore excluded from the fame ranking by default, and excluded entirely whenever a league filter is applied. After — both filters are gone and the ranking is `fame DESC` across all robots, so fame earned in any mode is represented. Verifiable by: a test asserting a robot with fame and zero `total_battles` appears in the response.

8. **Leaderboards carry ranking data only.** Before — the Fame_Leaderboard shows a League column sourced from 1v1 standings alone, and the Prestige_Leaderboard shows a derived bonus column combining `battleWinningsBonus` and `merchandisingMultiplier`, neither of which is a ranked quantity, plus a minimum-robot-count filter. After — both leaderboards present only the ranked value and identifying context, and the prestige response no longer duplicates the merchandising formula that Requirement 2 changes. Verifiable by: a grep showing `battleWinningsBonus`, `merchandisingMultiplier`, and `currentLeague` are absent from the leaderboard service and pages.

9. **Booking Office can be upgraded where it is used.** Before — the Booking_Office_Page tells the player to "upgrade the facility to unlock more slots per robot" but provides no control to do so, requiring a trip to the Facilities page, and the `GET /api/facilities` response reports a daily operating cost of ₡0 for the Booking Office because `booking_office` and `tuning_bay` are both absent from the Facility_Operating_Cost_Chain even though `economyFormulas.ts` defines them at ₡150 and ₡300 per level. After — the page carries an upgrade control with a full Upgrade_Implication_Panel, and operating costs are read from the single shared formula so no facility can silently report ₡0. Verifiable by: a test asserting the Booking Office and Tuning Bay operating costs in the `GET /api/facilities` response match `calculateFacilityOperatingCost()`.

10. **League win streaks are visible.** Before — `standings.best_win_streak` is maintained for all four League_Modes but surfaced only for KotH, so the longest league streaks in the game are recorded and never shown. After — the Hall_Of_Records presents a Win_Streak_Record per League_Mode, reading the column that already exists. Verifiable by: a test asserting the records response contains a streak entry for each of the four League_Modes when streak data is present.

11. **Nine unreachable achievements become reachable.** Before — nine achievements have zero unlocks across more than 40 cycles for three distinct reasons. L16 "Dynamic Duo", L19 "Twins!", and L21 "Voltron" read `standings` rows with `entity_type = 'robot'` for the modes `'tag_team'`, `'league_2v2'`, and `'league_3v3'`, but those modes only ever write Team_Scoped_Standing rows, so the lookup always yields zero. C11 "Never Tell Me the Odds" compares the subject's own ELO change against a threshold of 150, and `ELO_K_FACTOR` bounds that change at 32, so the condition is arithmetically unsatisfiable. L26 "Real Steel", L27 "The Hunger Bots", L28 "Omega Supreme", L29 "Cockroach Protocol", and L30 "Untouchable" use three trigger types that appear in the union and in their definitions but in neither `EVENT_TRIGGER_MAP` nor `evaluateTrigger()`, and their backing counters `grandMeleeWins` and `grandMeleeTop3` are never incremented anywhere. After — all nine evaluate against data that is actually written, and each has a test proving it can unlock. Verifiable by: a test per achievement asserting it unlocks when its condition is met, and a structural test asserting every trigger type used by a definition is present in all three Achievement_Trigger_Registration locations.

12. **Disk alerts respect their cooldown, and a broken cooldown is visible.** Before — the Disk_Alert_Cooldown is nominally 60 minutes but production logs on `armouredsouls-acc` show CRITICAL alerts at 19:09, 19:24, 19:39, and 19:54, exactly the 15-minute Disk_Check_Interval, so the cooldown is not gating. The cause is unobservable because `should_alert()` writes its timestamp with `2>/dev/null || true`, so a failed state write silently degrades the cooldown into a no-op at the moment disk pressure is highest. Separately, the Disk_Monitor is the last script in `app/scripts/` still using `source .env`, which `.kiro/steering/coding-standards.md` forbids after two production incidents. After — one emitter remains per host, the Disk_Alert_Cooldown is 2 hours, the Disk_Check_Interval is hourly to match the cadence at which disk consumption actually changes, a failed state write is reported rather than swallowed, and configuration is read through the Env_Get_Pattern. Verifiable by: a test invoking the Disk_Monitor twice above a threshold and asserting exactly one alert; a test asserting an unwritable Disk_Alert_State_Directory produces a diagnostic; and a grep showing no `source` of a `.env` file in `app/scripts/`.

### Verification Criteria

After all tasks are complete, run these checks to confirm the spec delivered:

1. `grep -n "autoCreateNextTeamTournament" app/backend/src/services/cycle/cycleScheduler.ts` — team tournament handlers call auto-creation outside the active-tournament branch
2. `npm test -- --testPathPattern="cycleScheduler|tournament" --silent` — scheduler and tournament tests pass, including the per-participant-type cadence assertions
3. `grep -rn "prestige / 10000\|prestige/10000" app/backend/src app/frontend/src` — returns no matches; every merchandising multiplier goes through Prestige_Per_Slot
4. `grep -rn "totalFame / 500\|totalBattles / 100\|studioLevel \* 0.1\|currentLevel \* 0.1" app/backend/src` — returns no matches; the divergent streaming display formulas are gone
5. `npm test -- --testPathPattern="economyFormulas|economyCalculations|streamingRevenue|financialReport" --silent` — economy and streaming suites pass, including the Roster_Capacity monotonicity property test and the per-level payback test
6. `grep -n "10000\|10,000" app/backend/src/utils/economyFormulas.ts` — the Merchandising_Base_Rate table starts at ₡10,000 for level 1
7. `grep -rn "effectiveCooldown -= \|effectiveBaseDamage += " app/shared app/backend/src app/frontend/src` — returns no matches; the flat accumulators are gone from the Refinement_Fold. Then `grep -rn "0\.25s\|+1\.0 base damage" app/shared app/backend/src app/frontend/src` — every remaining match must be prose explaining what v1.7 changed, not a live value. Three such references are expected and correct: the `weaponRefinement.ts` fold docblock, the `refinementCopy.ts` header, and the in-game guide's `callout-info`. The check is that no match is a *specification* of current behaviour
8. `npm test -- --testPathPattern="weaponRefinement" --silent` and `npm test -- --run weapon-refinement` — backend and frontend refinement suites pass, including the proportional-gain property test and the cross-copy parity test
9. `grep -n "bestPlacement\|longestBattle\|fastestVictory" app/backend/src/services/records/recordsQueryService.ts app/frontend/src/components/hall-of-records/CombatRecords.tsx app/frontend/src/components/hall-of-records/KothRecords.tsx` — returns no matches outside the team battle records; KotH Best Placement, Longest Battle, and Combat Fastest Victory are gone from both layers
10. `grep -n "biggestEloGain\|biggestEloLoss" app/backend/src/services/records/recordsQueryService.ts` — returns no matches; the fixed-K-factor ELO categories are gone
11. `npm test -- --testPathPattern="records" --silent` — records suite passes, including the no-identical-values assertion per Record_Category and the NULL `battle_log` battle detail test
12. `npm test -- --run hall-of-records` — frontend Hall_Of_Records suite passes, including mobile viewport assertions for any changed tab
13. `grep -rn "minBattles\|minRobots" app/backend/src/routes/leaderboards.ts app/backend/src/services/analytics/leaderboardService.ts app/frontend/src/pages/LeaderboardsFamePage.tsx app/frontend/src/pages/LeaderboardsPrestigePage.tsx` — returns only comments recording the removal; both leaderboard filters are gone from schemas, services, cache keys, and UI. The check is scoped to the four leaderboard surfaces: `minRobots` legitimately survives in `rosterEligibilityFilter.ts` (Booking Office event eligibility) and `minRobotsRequired` in the league rebalancing quorum, neither of which this requirement touches
14. `grep -rn "battleWinningsBonus\|merchandisingMultiplier" app/backend/src/services/analytics/leaderboardService.ts app/frontend/src/pages/LeaderboardsPrestigePage.tsx` and `grep -n "currentLeague" app/frontend/src/pages/LeaderboardsFamePage.tsx` — both return no matches; the removed columns are gone from both layers. Note the check is scoped to the fame and prestige surfaces: `currentLeague` legitimately survives on `LossesLeaderboardEntry`, whose league filter this requirement does not remove
15. `npm test -- --testPathPattern="leaderboard" --silent` and `npm test -- --run Leaderboards` — leaderboard suites pass, including the zero-`total_battles` fame visibility test
16. `grep -n "currentOperatingCost = " app/backend/src/routes/facility.ts` — returns at most one assignment per variable; the per-type chain is replaced by `calculateFacilityOperatingCost()`
17. `npm test -- --testPathPattern="facility" --silent` — facility suite passes, including the operating-cost parity assertion for every facility type in `FACILITY_TYPES`
18. `npm test -- --run BookingOfficePage` — Booking Office page suite passes, including the upgrade control's disabled states and mobile viewport assertions
19. `grep -n "best_win_streak\|bestWinStreak" app/backend/src/services/records/recordsQueryService.ts` — streak queries exist for the league modes, not only KotH
20. `grep -n "grand_melee_wins\|grand_melee_top3\|grand_melee_win_high_hp" app/backend/src/services/achievement/achievementTypes.ts app/backend/src/services/achievement/triggerEvaluator.ts app/backend/src/services/achievement/achievementCatalog.ts` — all three trigger types are registered in the event map, the evaluator, and the progress resolver
21. `grep -n "grandMeleeWins\|grandMeleeTop3" app/backend/src/services/battle/battlePostCombat.ts` — the Grand Melee counters are incremented in the shared post-combat helper
22. `npm test -- --testPathPattern="achievement" --silent` — achievement suites pass, including the nine per-achievement unlock tests and the structural Achievement_Trigger_Registration test
23. `grep -rnE "^[[:space:]]*(source|\.)[[:space:]]+[^#]*\.env" app/scripts/` — returns no matches; every operations script reads configuration through the Env_Get_Pattern. The pattern is anchored to executable lines because `preflight.sh`, `backup.sh`, and `disk-monitor.sh` all carry comments *warning against* sourcing, which an unanchored grep would flag
24. `grep -n "DISK_ALERT_COOLDOWN_SECONDS" app/scripts/disk-monitor.sh` — the default is `7200`
25. `bash app/scripts/__tests__/disk-monitor.test.sh` — the Disk_Monitor harness passes: two consecutive runs above a threshold emit one alert, an unwritable state directory emits a diagnostic, and a drop below threshold clears the cooldown
26. `grep -n "maxLevel" app/backend/src/config/facilities.ts | sed -n '3p'` — the `training_facility` entry reports `maxLevel: 10`
27. `grep -rn "calculateTrainingFacilityDiscount(" app/backend/src app/frontend/src app/shared` — every call passes two arguments; no call site computes the discount without Roster_Capacity
28. `npm test -- --testPathPattern="trainingFacilityRosterDiscount|discounts|sharedFormulas|robotServices" --silent` — the Training_Discount suites pass, including the two worked examples and the level-10-beats-level-9 assertion

## Requirements

### Requirement 1: Tournament Creation Timing Alignment

**User Story:** As a player who enters team tournaments, I want a new bracket to appear as promptly as it does for 1v1, so that team tournaments are not quietly rarer than 1v1 tournaments.

**Source:** Identified during Spec #45 requirements review. `executeTournamentCycle` reaches its auto-creation step on every run, while `executeTeam2v2TournamentCycle` and `executeTeam3v3TournamentCycle` return from inside their `if (activeTournament)` branch and never reach auto-creation on a run that processed a round.

#### Acceptance Criteria

1. WHEN a Battle_Event_Job for any Participant_Type runs, THE Battle_Event_Job SHALL attempt Tournament_Auto_Creation in the same run in which it processed the final round of the previous tournament of that Participant_Type
2. THE `team2v2Tournament` and `team3v3Tournament` handlers SHALL attempt Tournament_Auto_Creation on every run rather than only on runs that begin with no active tournament of that Participant_Type
3. WHERE a tournament of a Participant_Type is still active after its round has been processed, THE Battle_Event_Job SHALL create no new tournament of that Participant_Type
4. WHERE the eligible participant count is below the minimum bracket size, THE Battle_Event_Job SHALL create no tournament and SHALL log the Participant_Type and the shortfall
5. THE elapsed cycles between one tournament completing and the next tournament of the same Participant_Type being created SHALL be equal across all three Participant_Types given equal participant availability
6. THE Battle_Event_Job SHALL continue to return its existing `JobContext` shape, so that the monitoring notifications and the admin scheduler state view are unchanged
7. THE test suite SHALL assert for each Participant_Type that the run which completes the final round also creates the next tournament when enough participants are eligible
8. WHERE the Season System of Spec #45 has shipped and the current Season_Phase is `preparation`, THE Tournament_Auto_Creation SHALL NOT run
9. THE `docs/game-systems/PRD_TOURNAMENT_SYSTEM.md` SHALL document that all Participant_Types create the next bracket in the run that completes the previous one

### Requirement 2: Merchandising Hub Rewards Roster Concentration

**User Story:** As a player who invests everything into a single robot, I want the Merchandising Hub to reward that choice, so that the game has a passive income facility for depth strategies alongside the Streaming Studio which rewards breadth.

**Source:** Identified while evaluating Merchandising Hub impact and costs for Spec #45. The Streaming Studio was designed to scale with fame and the Merchandising Hub with prestige, on the assumption that these were independent axes. They are not: `prestige` is a stable-level counter on `users` and every orchestrator calls `awardPrestigeToUser()` once per winning robot, so prestige accrues in proportion to the number of robots a stable fields. Both facilities therefore scale with roster size. Raising the base rate or lowering the purchase cost cannot correct this, because the ratio between a narrow and a wide stable's merchandising income is `(1 + P_wide/10000) / (1 + P_narrow/10000)`, which is invariant to both. A uniform buff widens the absolute gap in the wide stable's favour.

#### Acceptance Criteria

1. THE `calculateMerchandisingIncome()` function in `src/utils/economyFormulas.ts` SHALL compute the Merch_Multiplier as `1 + (prestige / Roster_Capacity) / 10000`
2. THE `calculateMerchandisingIncome()` signature SHALL accept Roster_Capacity as an explicit parameter rather than querying the database, preserving the file's side-effect-free contract
3. THE Roster_Capacity SHALL be derived from the stable's `roster_expansion` facility level plus one, and SHALL NOT be derived from a live count of `robots` rows
4. WHERE a stable has no `roster_expansion` facility row, or the row exists at level 0, THE Roster_Capacity SHALL be 1
5. THE Merchandising_Base_Rate SHALL be `10000 × level` for levels 1 through 10, replacing the current `5000 × level`
6. THE merchandising income of a stable with Roster_Capacity 1 SHALL be exactly twice its income under the current formula at the same `prestige` and facility level
7. WHEN two stables hold equal `prestige` and equal Merchandising Hub levels, THE stable with the lower Roster_Capacity SHALL receive merchandising income greater than or equal to the other stable's
8. WHEN the Settlement_Job computes passive income, THE Settlement_Job SHALL resolve each user's Roster_Capacity from the facility rows it already batch-loads, without adding a per-user query
9. WHEN the Settlement_Job emits a `PASSIVE_INCOME` audit event, THE payload SHALL include the Roster_Capacity and the Prestige_Per_Slot used, so that income can be reconciled after the fact
10. THE Merchandising_Prestige_Gate values SHALL be re-based against Prestige_Per_Slot rather than raw prestige, to `2000` at level 4, `5000` at level 7, and `9000` at level 9, replacing the current `3000` / `7500` / `15000`
11. THE facility purchase and upgrade path SHALL compare a stable's Prestige_Per_Slot against the Merchandising_Prestige_Gate, and SHALL NOT compare raw `prestige`
12. WHERE a stable already owns a Merchandising Hub level above what its Prestige_Per_Slot would now permit, THE facility SHALL retain its level and SHALL continue to produce income, and no downgrade or refund SHALL occur
13. THE cumulative payback period of every Merchandising Hub level from 1 through 10 SHALL be under 100 cycles at a Prestige_Per_Slot of zero
14. THE `merchandising_hub` benefit strings in `src/config/facilities.ts` SHALL state the doubled base rates and SHALL describe the multiplier as scaling with prestige per robot slot
15. THE `merchandising_hub` description in `src/config/facilities.ts` SHALL state that income scales with prestige per robot slot, so that a larger roster divides the same prestige across more slots
16. THE daily financial report returned by `getDailyFinancialReport()` SHALL display the Roster_Capacity and Prestige_Per_Slot alongside the merchandising formula string, so the player can see why their multiplier is what it is
17. THE Merchandising Hub recommendation in `src/routes/finances.ts` SHALL gate on the facility's actual level 1 cost and SHALL NOT use the stale `currency >= 800000 && prestige >= 1000` heuristic, which overstates the ₡150,000 entry cost by more than 5×
18. THE test suite SHALL include a property test asserting merchandising income is non-increasing as Roster_Capacity increases at fixed `prestige` and facility level
19. THE test suite SHALL include a unit test asserting cumulative payback at each level 1 through 10 is under 100 cycles at a Prestige_Per_Slot of zero
20. THE test suite SHALL include a regression test asserting a Roster_Capacity of 1 yields exactly double the pre-change income at the same `prestige` and level
21. THE `docs/game-systems/PRD_ECONOMY_SYSTEM.md` SHALL document the Prestige_Per_Slot formula, the doubled base rate table, and the re-based Merchandising_Prestige_Gate values
22. THE `.kiro/steering/project-overview.md` Economy entry SHALL note that merchandising scales with prestige per robot slot while streaming scales per robot per battle

### Requirement 3: Proportional Sharpen and Forge Refinements

**User Story:** As a player who invested in a slow two-handed weapon, I want Sharpen and Forge to be worth the same to me as they are to a fast one-handed build, so that the DPS refinement tiers reward refinement rather than rewarding the weapon class I happened to buy.

**Source:** Identified during a balance review of Spec #34. Sharpen subtracts a flat `0.25s` from base cooldown and Forge adds a flat `1.0` to base damage, so both tiers deliver a proportional benefit inversely related to the weapon's catalog stat. In the seed catalog every 2.0s weapon is `handsRequired: 'one'` and the 5.0s–6.0s weapons are all two-handed, and the fast weapons also carry the lowest base damage, so both flat bonuses compound into a single one-handed subsidy. `applyDamage()` applies every mitigation step — crit, dampeners, formation, armour, penetration — as a multiplier, so a proportional damage bonus and a proportional attack-rate bonus are equivalent in expected DPS and neither tier gains an armour-related edge from the change.

#### Acceptance Criteria

1. THE Sharpen_Cooldown_Reduction SHALL be 10% of the weapon's catalog cooldown per instance, replacing the current flat `0.25s` subtraction
2. THE Forge_Damage_Increase SHALL be 8% of the weapon's catalog base damage per instance, replacing the current flat `1.0` addition
3. THE Refinement_Fold SHALL stack both tiers additively against the catalog value rather than compounding per instance, so that two Sharpen instances yield exactly `cooldown × 0.80` and two Forge instances yield exactly `baseDamage × 1.16`
4. THE Refinement_Fold SHALL round its Effective_Cooldown and Effective_Base_Damage outputs to the Refinement_Rounding_Precision
5. THE per-tier instance cap of 2 for Sharpen and Forge SHALL remain unchanged, preserving the DPS protection introduced in Spec #34 v1.6
6. THE refinement cost formulas SHALL remain unchanged at `300_000 × 3^instanceIndex` for Sharpen and `400_000 × 3^instanceIndex` for Forge
7. WHEN a weapon is refined with a fixed set of Sharpen instances, THE proportional attack-rate gain SHALL be identical for every catalog cooldown value
8. WHEN a weapon is refined with a fixed set of Forge instances, THE proportional damage gain SHALL be identical for every catalog base damage value
9. THE Refinement_Fold SHALL apply its multipliers to the catalog cooldown before the offhand penalty and the `attackSpeed` divisor in `calcCooldown()`, so that the proportional gain is also invariant across `attackSpeed` values and across main-hand versus offhand slots
10. THE Effective_Cooldown SHALL remain strictly positive for every reachable combination of catalog cooldown and Sharpen instances, removing the unfloored-subtraction hazard recorded as key decision #7 in the Spec #34 design document
11. THE change SHALL require no data migration, because `weapon_refinement` rows store tier and magnitude rather than the computed effect, and THE new behaviour SHALL apply retroactively to every already-refined weapon
12. THE `applyRefinementsToWeapon()` implementation SHALL be edited once at `app/shared/utils/weaponRefinement.ts`; no second copy exists, because `app/backend/src/shared/utils` is a committed symlink to `app/shared/utils` and the backend therefore imports the same file the frontend does
13. THE test suite SHALL include a test asserting that the backend import path and the shared import path resolve to the same module and produce identical Effective_Cooldown and Effective_Base_Damage, so that replacing the symlink with a real directory — which would silently fork the formula — is caught
14. THE test suite SHALL include a property test asserting the proportional gain from a fixed refinement set is invariant across the full catalog range of cooldown and base damage values
15. THE test suite SHALL include a regression test asserting a 2.0s weapon at the Sharpen cap yields 1.6s and a 6.0s weapon at the Sharpen cap yields 4.8s
16. THE test suite SHALL include a regression test asserting the Refinement_Fold output for a 3.5s weapon with one Sharpen instance is 3.15s rather than a value rounded to one decimal
17. THE refined weapon stat display SHALL render Effective_Cooldown and Effective_Base_Damage with trailing zeros trimmed, so that a folded value of `1.60` displays as `1.6` and a folded value of `3.15` displays as `3.15`
18. WHERE a surface presents a projected DPS figure for a refined weapon, THE surface SHALL either compute it from the Observable_Cadence or label it as approximate, because the `SIMULATION_TICK` quantisation means a figure derived from the raw folded cooldown will not match the interval players observe in the battle log
19. THE tier copy SHALL state the proportional effect per instance and the effect at the instance cap, and SHALL NOT state a flat second or damage value, in all of the following: the `TIER_BLURB` map and the inline Sharpen and Forge explanation paragraphs in `RefinementModal.tsx`, the slot labels in `SlotBar.tsx`, the per-row effect strings in `RefinementHistoryPopover.tsx`, and the `TIER_DESC` map in `RefinementAdoptionPage.tsx`
20. THE docblock headers of both `weaponRefinement.ts` copies SHALL describe the proportional effects, replacing the current `-0.25s base cooldown` and `+1.0 base damage` descriptions
21. WHERE `RefinementModal.tsx` previews a candidate refinement, THE preview SHALL show the concrete before and after values for that specific weapon alongside the proportional tier copy
22. THE `docs/game-systems/PRD_WEAPON_ECONOMY.md` SHALL gain a v1.7 section documenting the proportional Sharpen and Forge effects, the additive stacking rule, the Refinement_Rounding_Precision, and the reasoning that flat bonuses subsidised fast low-damage one-handed weapons
23. THE four-tier table in `docs/game-systems/PRD_WEAPON_ECONOMY.md` SHALL be updated so the Sharpen and Forge effect columns state the proportional values
24. THE Refinement section of `docs/guides/ADMIN_PANEL_GUIDE.md` SHALL be checked for hardcoded tier effect values and updated if any are present
25. THE change SHALL be announced in a changelog entry of category `balance`, stating that fast one-handed builds lose a small amount of Sharpen value while slow two-handed builds gain substantially, because the effect of every existing refinement is recomputed on deploy

### Requirement 4: Hall of Records Shows Meaningful Records

**User Story:** As a player browsing the Hall of Records, I want every category to show a record that someone could plausibly break, so that the page reads as a record book rather than a list of ties and artefacts.

**Source:** Reported after reviewing the Hall_Of_Records against ACC data. Several Record_Categories are structurally degenerate: `MAX_BATTLE_DURATION` is 120s so Longest Battle ties at the cap, `ELO_K_FACTOR` is fixed at 32 so every ELO gain and loss entry is ±32, KotH Best Placement ties at 1 for anyone who has ever won, and the unified matchmaking pipeline pairs robots on comparable LP so league upsets cannot produce a large ELO differential. Separately, Most Damage pools `league_1v1` and `tournament_1v1` together while team and Grand Melee modes have structurally larger damage totals, and the accumulated `standings.total_zone_score` float is rendered unrounded, producing values such as `1642.7000000000005`.

**Investigation note:** The reported battle detail error is not caused by battle log retention. `battleLogRetentionService.ts` only NULLs `battle_log` and never deletes `battles` rows, `getBattleLog()` already reports `playbackAvailable: battleLog !== null` and loads `battle_summaries` independently, and `BattleDetailPage.tsx` guards `battleLog` access with optional chaining. The root cause is therefore something else and must be reproduced before it is fixed.

#### Acceptance Criteria

1. THE Combat tab SHALL NOT present a Longest Battle Record_Category ranked on `durationSeconds`, because Time_Limit_Termination caps the value and produces ties at `MAX_BATTLE_DURATION`
2. WHERE a replacement for Longest Battle is presented, THE Record_Category SHALL rank on a value that Time_Limit_Termination does not cap, and THE requirement to remove the capped category SHALL be satisfied whether or not a replacement is added
3. THE Fastest Victory Record_Category SHALL be removed, because its ranking is occupied by battles resolving in approximately one second, which represent no meaningful achievement
4. THE removal of Fastest Victory SHALL NOT be treated as answering why battles resolve in approximately one second, and THE spec SHALL record that question as an open observation for separate investigation, because removing the category that surfaced it also removes the only place it was visible
5. THE Most Damage in Single Battle Record_Category SHALL be a Mode_Scoped_Record, presented separately per `battles.battle_type`, so that Grand Melee and team battle damage totals are not ranked against 1v1 totals
6. THE Biggest Upset Record_Category SHALL be restricted to tournament battle types, because league matchmaking pairs robots on comparable standing and cannot produce a large ELO differential
7. WHERE Biggest Upset covers a team battle type, THE ELO differential SHALL be computed from the summed team ELO on each side, consistent with how `calculateTeamBattleELOChanges()` derives team ratings
8. THE Biggest ELO Gain and Biggest ELO Loss Record_Categories SHALL be removed, because `ELO_K_FACTOR` is fixed at 32 and every entry therefore reports the same magnitude
9. THE KotH Best Placement Record_Category SHALL be removed, because any robot that has won a KotH match ties at placement 1
10. THE KotH Zone Dominator Record_Category SHALL be retained and SHALL round `total_zone_score` to the Zone_Metric_Precision before display
11. THE KotH Most Zone Time Record_Category SHALL round `total_zone_time` to the Zone_Metric_Precision before display
12. THE rounding of both zone metrics SHALL be applied in `recordsQueryService.ts` rather than in the rendering components, so that the API response carries display-ready values
13. THE Career tab SHALL state for each Record_Category which battle modes it covers, because Career_Battle_Counters exclude every KotH and Grand Melee match while `damageDealtLifetime` includes them, so Most Battles and Highest Win Rate are 1v1, tournament, tag team, and team league only while Most Lifetime Damage spans all modes
14. THE spec SHALL decide and record whether Career_Battle_Counters should begin including KotH and Grand Melee matches, or whether the Hall_Of_Records should label the existing scope, and SHALL NOT leave the inconsistency undocumented
15. WHERE Career_Battle_Counters are changed to include additional modes, THE change SHALL be applied at the `updateRobotCombatStats()` call sites rather than by post-hoc aggregation in the records service
16. THE Grand Melee tab SHALL present a kills Record_Category, and THE spec SHALL verify that `standings.total_kills` is actually populated for `mode = 'grand_melee'`, because the backend already returns `mostKillsCareer` and the frontend already renders it, so an empty section indicates the kill counting in `computePlacements()` is not recording kills rather than a missing feature
17. THE Grand Melee kills Record_Category SHALL display kills per match alongside total kills, so that robots with many matches do not dominate purely on volume
18. WHEN a player selects any record entry that references a battle, THE battle detail page SHALL render successfully for every battle whose `battles` row exists, regardless of whether `battle_log` is NULL
19. THE spec SHALL reproduce the battle detail error against a battle reached from the Hall_Of_Records and SHALL record the root cause before implementing a fix, given that battle log retention has been ruled out
20. WHERE a battle has a NULL `battle_log`, THE battle detail page SHALL render the overview from `battle_summaries` and SHALL indicate that playback is unavailable rather than presenting an error state
21. THE `GET /api/records` response SHALL omit any Record_Category that this requirement removes, and THE corresponding fields SHALL be removed from `RecordsData` in `app/frontend/src/components/hall-of-records/types.ts`
22. WHERE a Record_Category has no qualifying entries, THE tab SHALL omit the section rather than render an empty heading
23. THE Combat, Upset, Career, KotH, and Grand Melee tabs SHALL remain usable on viewports from 320px to below 1024px, with no horizontal overflow and touch targets of at least 44px, following the responsive tab pattern in `.kiro/steering/frontend-standards.md`
24. THE test suite SHALL assert for every retained Record_Category that seeded data with distinct underlying values produces distinct ranked values, so that a future structurally-tied category is caught
25. THE test suite SHALL assert that battle detail resolves successfully for a battle whose `battle_log` is NULL and whose `battle_summaries` row exists
26. THE test suite SHALL assert that the zone metrics in the `GET /api/records` response carry at most one decimal place
27. THE `docs/prd_pages/` page requirements for the Hall of Records SHALL be updated to list the retained Record_Categories, the per-mode scoping of Most Damage, and the mode coverage of each Career category
28. THE removal of Record_Categories SHALL be announced in a changelog entry of category `feature`, because players lose visible leaderboard positions

### Requirement 5: Leaderboard Filter and Column Cleanup

**User Story:** As a player checking a leaderboard, I want it to rank the thing it is named after without filters that hide entrants or columns that belong on a detail page, so that the ranking is complete and readable.

**Source:** Reported after reviewing both leaderboards. On the Fame_Leaderboard the league filter and minimum-battles filter are not merely redundant — they suppress entrants. `robots.total_battles` is never incremented for KotH or Grand Melee because `kothBattleOrchestrator.ts` and `grandMeleeBattleOrchestrator.ts` both pass `skipBattleCounters: true` to `updateRobotCombatStats()`, so the default `minBattles` of 10 hides robots whose fame comes from those modes, even though both award fame. The league filter joins `standings` on `mode = 'league_1v1'` and therefore drops any robot without a 1v1 standing when applied. The League column has the same 1v1-only scope while fame is earned across every mode. On the Prestige_Leaderboard the minimum-robot-count filter suppresses single-robot stables, and the bonus column presents derived economic figures rather than ranked quantities.

#### Acceptance Criteria

1. THE `league` query parameter SHALL be removed from `fameQuerySchema`, from the `getFameLeaderboard()` parameters, from the SQL `WHERE` clause, from the `filters` object in the response, and from the Leaderboard_Cache_Key
2. THE `minBattles` query parameter SHALL be removed from the same five places
3. THE Fame_Leaderboard SQL SHALL rank on `robots.fame` descending with no minimum battle threshold and no tier predicate, so that fame earned in any mode is represented
4. THE Fame_Leaderboard SHALL retain its `LEFT JOIN` on `standings` only if a remaining field requires it, and SHALL otherwise drop the join
5. THE `currentLeague` field SHALL be removed from `FameLeaderboardEntry`, from the SQL projection, and from both the desktop table column and the mobile card row in `LeaderboardsFamePage.tsx`
6. THE League Filter and minimum-battles select controls SHALL be removed from `LeaderboardsFamePage.tsx`, together with their `useState` hooks and their entries in the data-fetch effect dependency array
7. WHERE removing the filter controls leaves the filter bar empty, THE filter bar container SHALL be removed rather than rendered empty
8. THE `minRobots` query parameter SHALL be removed from `prestigeQuerySchema`, from the `getPrestigeLeaderboard()` parameters, from the `HAVING COUNT(r.id) >= ...` clause, from the `filters` object in the response, and from the Leaderboard_Cache_Key
9. THE Prestige_Leaderboard SHALL rank all stables by `users.prestige` descending regardless of robot count
10. THE `battleWinningsBonus` and `merchandisingMultiplier` fields SHALL both be removed from `PrestigeLeaderboardEntry` and from the service, because they are rendered together in the single bonus table cell that this requirement removes
11. THE bonus column SHALL be removed from both the desktop table and the mobile card in `LeaderboardsPrestigePage.tsx`
12. THE `calculateBattleWinningsBonus()` helper SHALL be removed from `leaderboardService.ts` once its only consumer is gone, and its import of `getPrestigeMultiplier` SHALL be removed if unused
13. THE inline `1 + prestige / 10000` expression in `leaderboardService.ts` SHALL be removed with the column, so that Requirement 2 has one fewer duplicate of the merchandising multiplier to update
14. THE `totalRobots` field SHALL be retained on `PrestigeLeaderboardEntry` as identifying context even though the robot-count filter is removed
15. THE Leaderboard_Cache_Key for both routes SHALL be rebuilt from only the parameters that remain, so that no stale key fragment references a removed filter
16. WHERE a removed query parameter is supplied by an old client or a bookmarked URL, THE route SHALL ignore it rather than reject the request, because `prestigeQuerySchema` and `fameQuerySchema` rely on Zod's default `.strip()` behaviour
17. THE Fame_Leaderboard and Prestige_Leaderboard SHALL remain usable on viewports from 320px to below 1024px with no horizontal overflow and touch targets of at least 44px, and THE removal of columns SHALL be applied to the mobile card layouts as well as the desktop tables
18. THE test suite SHALL assert that a robot with non-zero `fame` and zero `total_battles` appears in the Fame_Leaderboard response
19. THE test suite SHALL assert that a stable owning one robot appears in the Prestige_Leaderboard response
20. THE test suite SHALL assert that supplying `league`, `minBattles`, or `minRobots` as query parameters returns the same result as omitting them
21. THE existing leaderboard tests that assert on the removed filters, `currentLeague`, `battleWinningsBonus`, or `merchandisingMultiplier` SHALL be updated or removed rather than left failing
22. THE `docs/game-systems/PRD_PRESTIGE_AND_FAME.md` document SHALL be updated to list the retained filters and columns for both leaderboards; there is no leaderboard page document under `docs/prd_pages/`, and that PRD already owns the prestige and fame tier tables the leaderboards render
23. THE spec SHALL note in the Prestige_Leaderboard documentation that prestige is a stable-level total which accrues per winning robot, so a larger roster ranks higher, and THE spec SHALL NOT attempt to normalise the prestige ranking, because Requirement 2 addresses roster scaling only where prestige drives income

### Requirement 6: Booking Office Upgrade From the Booking Office Page

**User Story:** As a player who has just hit the subscription cap while assigning events, I want to upgrade the Booking Office from the page where I discovered the limit, and to see what it costs and what it gives me before I commit, so that I do not have to navigate away and guess.

**Source:** Requested after using the Booking_Office_Page. The page already displays the current level, the current Subscription_Cap, and the next-level cap, and its copy instructs the player to "Upgrade the facility to unlock more slots per robot" — but offers no control, so the player must leave for the Facilities page. Separately, the Facility_Operating_Cost_Chain in `facility.ts` omits `booking_office` and `tuning_bay`, so `GET /api/facilities` reports ₡0 daily operating cost for both, contradicting the ₡150 and ₡300 per level defined in `economyFormulas.ts`. Any implication panel built on the current response would therefore understate the ongoing cost.

#### Acceptance Criteria

1. THE Facility_Operating_Cost_Chain SHALL be replaced by calls to `calculateFacilityOperatingCost()` from `economyFormulas.ts`, so that `GET /api/facilities` cannot report an operating cost that disagrees with the shared formula
2. WHERE a facility's operating cost cannot be derived from level alone, as with `roster_expansion` which is charged per filled robot slot, THE handler SHALL retain its special case and SHALL document why
3. THE `GET /api/facilities` response SHALL report the Booking Office daily operating cost as `150 × level` and the Tuning Bay as `300 × level`
4. THE test suite SHALL assert for every entry in `FACILITY_TYPES` that the `currentOperatingCost` in the response equals `calculateFacilityOperatingCost(type, currentLevel)`, so that a future facility cannot be omitted silently
5. THE Booking_Office_Page SHALL present an upgrade control that raises the Booking Office by one level
6. THE upgrade control SHALL call the existing Facility_Upgrade_Endpoint with `facilityType` of `'booking_office'`, and SHALL NOT introduce a new endpoint, so that the endpoint's existing `lockUserForSpending` transaction, prestige validation, and level validation are inherited unchanged
7. THE Booking_Office_Page SHALL display an Upgrade_Implication_Panel before the player commits, stating the credit cost of the next level, the Subscription_Cap the next level grants, the daily operating cost the next level incurs, and the player's current credit balance
8. THE Upgrade_Implication_Panel SHALL express the effect as the resulting per-robot Subscription_Cap rather than as a raw level number, because the level is meaningful to the player only through the cap
9. WHERE the next level carries a prestige requirement, THE Upgrade_Implication_Panel SHALL state the required prestige and the player's current prestige
10. WHERE the player's prestige is below the next level's requirement, THE upgrade control SHALL be disabled and SHALL state that prestige is the blocking condition
11. WHERE the player's credit balance is below the upgrade cost, THE upgrade control SHALL be disabled and SHALL state that credits are the blocking condition
12. WHERE both prestige and credits are insufficient, THE upgrade control SHALL state both blocking conditions rather than only the first
13. WHERE the Booking Office is at its maximum level of 10, THE upgrade control SHALL be replaced by a maximum-level indicator and THE Upgrade_Implication_Panel SHALL be omitted
14. THE Booking_Office_Page SHALL source the upgrade cost, prestige requirement, affordability flags, and operating costs from `GET /api/facilities` rather than recomputing them in the frontend, because `getFacilityUpgradeCost()` and the prestige requirements are already returned by that endpoint
15. WHEN an upgrade succeeds, THE Booking_Office_Page SHALL refresh both the Booking Office level and the SubscriptionMatrix, so that the newly available subscription slots become usable without a page reload
16. WHEN an upgrade succeeds, THE displayed credit balance SHALL reflect the deduction without a page reload
17. WHEN an upgrade fails, THE Booking_Office_Page SHALL surface the error message from the Facility_Upgrade_Endpoint and SHALL leave the displayed level and balance unchanged
18. WHILE an upgrade request is in flight, THE upgrade control SHALL be disabled, so that a double click cannot submit two upgrades
19. THE upgrade SHALL NOT invalidate, reassign, or cancel any existing subscription, because raising the Subscription_Cap is purely additive
20. THE upgrade control SHALL be reachable and operable by keyboard, SHALL have an accessible name that identifies both the action and the facility, and SHALL announce its disabled reason to assistive technology rather than conveying it by colour alone
21. THE Booking_Office_Page SHALL remain usable on viewports from 320px to below 1024px with no horizontal overflow, and THE upgrade control SHALL have a touch target of at least 44px
22. WHERE the viewport is below 1024px, THE Upgrade_Implication_Panel SHALL stack its figures vertically rather than rendering a horizontal row that overflows
23. THE test suite SHALL assert that the upgrade control is disabled with the correct stated reason for each of insufficient prestige, insufficient credits, both insufficient, and maximum level
24. THE test suite SHALL assert that a successful upgrade refreshes the Subscription_Cap shown on the page
25. THE test suite SHALL assert that the Upgrade_Implication_Panel displays a non-zero daily operating cost for the Booking Office, guarding the Facility_Operating_Cost_Chain regression
26. THE `docs/prd_pages/` page requirements for the Booking Office SHALL document the upgrade control and the contents of the Upgrade_Implication_Panel
27. THE `docs/game-systems/` Booking Office documentation SHALL state the ₡150 per level daily operating cost, if it does not already

### Requirement 7: League Win Streak Records

**User Story:** As a player on a winning run, I want the Hall of Records to show the longest league win streaks, so that a sustained run is recognised rather than only single-battle extremes.

**Source:** Requested after reviewing the Hall_Of_Records. `standings.best_win_streak` and `current_win_streak` are already maintained for every League_Mode by `recordBattleResult()`, and the KotH tab already renders a `longestWinStreak` category from the same column, but no league mode surfaces it. The data exists and is unused.

#### Acceptance Criteria

1. THE Hall_Of_Records SHALL present a Win_Streak_Record for each of the four League_Modes
2. THE Win_Streak_Record SHALL read `standings.best_win_streak` and SHALL NOT recompute streaks from battle history, because `battle_log` is subject to the seven-day retention window and streaks are maintained as running counters
3. THE Win_Streak_Record for `'league_1v1'` SHALL rank robots and SHALL display the robot name and owning stable
4. THE Win_Streak_Record for `'league_2v2'`, `'league_3v3'`, and `'tag_team'` SHALL rank `TeamBattle` entities and SHALL display the team name and owning stable, resolving `standings.entity_id` against `team_battles.id`
5. THE Win_Streak_Record SHALL exclude entities whose `best_win_streak` is zero
6. THE Win_Streak_Record SHALL order by `best_win_streak` descending with a deterministic secondary ordering, so that repeated requests return a stable ranking when streak values tie
7. THE Win_Streak_Record SHALL display the entity's current active streak alongside its best streak, so that a player can see whether a record run is still live
8. WHERE an entity's `current_win_streak` equals its `best_win_streak`, THE record SHALL indicate that the streak is active
9. THE Win_Streak_Record SHALL NOT be presented for the tournament modes, because no tournament orchestrator calls `recordBattleResult()` and their streak columns are therefore always zero
10. THE spec SHALL decide whether to include a Win_Streak_Record for `'grand_melee'`, which maintains streak columns through `awardGrandMeleePoints()` and operates a full tier system, and SHALL record the decision rather than leaving the mode ambiguous
11. THE Win_Streak_Record for `'league_1v1'` SHALL be documented as including bye wins, because `processByeBattle()` calls `recordBattleResult()` with an outcome of `'win'`, so a streak may be extended by a walkover
12. THE inclusion of bye wins SHALL be accepted rather than corrected, because league points already treat a bye as a win, and excluding byes from streaks alone would make the streak disagree with the standings it is derived from
13. WHERE a League_Mode has no entity with a non-zero streak, THE section for that mode SHALL be omitted rather than rendered empty
14. THE Win_Streak_Record entries SHALL NOT link to a battle, because a streak spans multiple battles and no single battle represents it
15. THE Win_Streak_Records SHALL be grouped together in one Hall_Of_Records location with the four League_Modes presented side by side, rather than scattered across the existing per-mode tabs, so that streaks can be compared across modes
16. THE Win_Streak_Record queries SHALL resolve entity names in batch rather than per entry, following the existing `robotMap` pattern in `fetchKothRecords()`, so that the added categories do not introduce N+1 queries
17. THE new Record_Categories SHALL be added to `RecordsData` in `app/frontend/src/components/hall-of-records/types.ts`
18. THE Win_Streak_Record display SHALL remain usable on viewports from 320px to below 1024px with no horizontal overflow and touch targets of at least 44px
19. THE test suite SHALL assert that a Win_Streak_Record is returned for each of the four League_Modes when streak data is present
20. THE test suite SHALL assert that a team-mode Win_Streak_Record resolves the team name rather than reporting an unknown entity
21. THE test suite SHALL assert that entities with a zero `best_win_streak` are absent from the response
22. THE test suite SHALL assert that the tournament modes produce no Win_Streak_Record
23. THE `docs/prd_pages/` page requirements for the Hall of Records SHALL list the Win_Streak_Records, their per-mode scoping, and the bye-win caveat for `'league_1v1'`
24. THE addition SHALL be announced in a changelog entry of category `feature`

### Requirement 8: Unreachable Achievements

**User Story:** As a player working toward an achievement, I want it to unlock when I meet its stated condition, so that the achievement list represents goals rather than decoration.

**Source:** Reported after observing nine achievements with zero unlocks across more than 40 cycles. Investigation found three independent root causes rather than nine separate defects.

**Cause A — entity scope mismatch.** `achievementService.ts` builds its cached robot by reading `robotStandings.find(s => s.mode === 'tag_team')`, `'league_2v2'`, and `'league_3v3'`, and `achievementCatalog.ts` does the same for progress display. Those rows are queried as Robot_Scoped_Standing records, but `teamBattleOrchestrator.ts` and `tagTeamResultUpdater.ts` both call `recordBattleResult()` with `entityType: 'team'`, so only Team_Scoped_Standing rows exist for those modes. The lookups always return `undefined` and the counters resolve to zero, making L16, L19, and L21 unreachable.

**Cause B — wrong ELO field.** The `'elo_upset'` case in `evaluateTrigger()` compares `Number(data.eloDiff) >= minEloDiff`, defaulting to 150. Every orchestrator populates `eloDiff` as `eloAfter - eloBefore`, which the fixed `ELO_K_FACTOR` of 32 bounds. The context already carries `opponentElo`, which the evaluator never reads. C11 is therefore arithmetically unsatisfiable.

**Cause C — Grand Melee never wired.** The trigger types `'grand_melee_wins'`, `'grand_melee_top3'`, and `'grand_melee_win_high_hp'` exist in the `AchievementTriggerType` union and are used by L26 through L30, but appear in neither the `battle_complete` array of `EVENT_TRIGGER_MAP` nor the `switch` in `evaluateTrigger()` nor the Achievement_Progress_Resolver. Additionally `battlePostCombat.ts` contains no reference to `grandMeleeWins` or `grandMeleeTop3`, so the backing counters are never incremented despite existing on the `Robot` model. Tasks 10.1 and 10.2 of Spec #44 remain unchecked in `.kiro/specs/done-june26/44-grand-melee/tasks.md`, so this work was never completed even though the spec was filed as done.

#### Acceptance Criteria

1. THE achievement trigger evaluation for the modes `'tag_team'`, `'league_2v2'`, and `'league_3v3'` SHALL read Team_Scoped_Standing rows, resolving the robot to the `TeamBattle` entities it is a member of
2. THE resolution from robot to team SHALL rely on the invariant that a robot belongs to at most one team per team size, enforced by the `TEAM_MEMBER_CONFLICT` check in `createTeam()` under `pg_advisory_xact_lock(2, robotId)`, so that exactly one Team_Scoped_Standing row is reachable per robot per mode and no aggregation across teams is required
3. WHERE no team membership exists for a robot in a given mode, THE win count SHALL resolve to zero rather than raising an error, because a robot that has never joined a team of that size legitimately has no standing
4. THE test suite SHALL include a test asserting that a robot on exactly one team of a given size resolves that team's win count, and a test asserting that a robot on no team of that size resolves zero
5. THE Achievement_Progress_Resolver SHALL use the same resolution as the evaluator for those three modes, so that displayed progress and unlock behaviour cannot disagree
6. THE `'elo_upset'` trigger SHALL evaluate the Opponent_Elo_Gap rather than the subject robot's own ELO change
7. THE `'elo_upset'` trigger SHALL continue to require a win and to be restricted to the battle types `'league_1v1'` and `'tournament_1v1'`
8. THE achievement context passed by the 1v1 league and 1v1 tournament orchestrators SHALL carry both the subject's `eloBefore` and the opponent's `eloBefore`, so that the Opponent_Elo_Gap is computable without a further query
9. WHERE the existing `eloDiff` context field is retained for other triggers, THE field SHALL be renamed or documented so that it cannot be mistaken for an opponent gap again
10. THE three Grand Melee trigger types SHALL be added to the `battle_complete` array of `EVENT_TRIGGER_MAP`
11. THE three Grand Melee trigger types SHALL be added to the `switch` in `evaluateTrigger()`
12. THE `'grand_melee_wins'` and `'grand_melee_top3'` trigger types SHALL be added to the Achievement_Progress_Resolver so that L26 through L29 display progress
13. THE `grandMeleeWins` counter SHALL be incremented when a robot finishes a Grand Melee in first place, and THE `grandMeleeTop3` counter SHALL be incremented when a robot finishes in the top three
14. THE Grand Melee counter increments SHALL occur in `updateRobotCombatStats()` in `battlePostCombat.ts` rather than inline in the orchestrator, consistent with the unified post-battle update rule in `.kiro/steering/project-overview.md`
15. THE Grand Melee counter increments SHALL NOT be suppressed by the `skipBattleCounters` flag, which the Grand Melee orchestrator passes as `true` to exclude the mode from the general Career_Battle_Counters
16. THE achievement context passed by the Grand Melee orchestrator SHALL include the robot's `placement` and its final HP percentage, so that `'grand_melee_win_high_hp'` can evaluate the greater-than-75-percent condition for L30
17. THE `'grand_melee_win_high_hp'` trigger SHALL evaluate as a one-shot boolean on the current battle rather than against a stored counter
18. THE spec SHALL verify whether L16 "Dynamic Duo" at 40 tag team wins, L19 "Twins!" at 25 2v2 wins, and L21 "Voltron" at 25 3v3 wins are attainable within a 100-cycle season given one match per mode per cycle, and SHALL record the finding
19. WHERE a threshold requires a win rate above 100 percent of the matches available in a season, THE threshold SHALL be reduced to a value attainable within one season, because Spec #45 resets the counters at each season boundary
20. THE spec SHALL audit every achievement definition for trigger types absent from any of the three Achievement_Trigger_Registration locations, and SHALL report any additional unreachable achievements found beyond the nine reported
21. THE spec SHALL audit every trigger type that reads a `standings` row for a mode-to-entity-type mismatch of the kind described in Cause A
22. THE test suite SHALL include a structural test asserting that every trigger type referenced by an entry in `ACHIEVEMENTS` appears in the `EVENT_TRIGGER_MAP` array for at least one event and in the `evaluateTrigger()` switch, so that a future definition cannot ship unevaluated
23. THE test suite SHALL include a structural test asserting that every trigger type with `progressType` of `'numeric'` appears in the Achievement_Progress_Resolver
24. THE test suite SHALL include one test per affected achievement asserting it unlocks when its stated condition is met: L16, L19, L21, C11, L26, L27, L28, L29, and L30
25. THE test suite SHALL include a regression test asserting that `'elo_upset'` does not unlock on a win whose ELO change is 32 but whose Opponent_Elo_Gap is below the threshold
26. THE fixes SHALL NOT retroactively award any of the affected achievements, and no backfill task SHALL be written, because Spec #45 deletes all `user_achievements` rows and resets the backing counters at the season boundary, so any credited unlock would be discarded within one season
27. WHERE a player's Team_Scoped_Standing rows already hold qualifying win counts at the time the Cause A fix deploys, THE achievement SHALL unlock on that player's next qualifying battle in the affected mode rather than at deploy time, because evaluation is driven by the `battle_complete` event
28. THE deferred-unlock behaviour of criterion 27 SHALL be stated in the changelog entry, so that a player holding 25 2v2 wins understands why the achievement appears after their next match rather than immediately
29. THE unchecked tasks 10.1 and 10.2 in `.kiro/specs/done-june26/44-grand-melee/tasks.md` SHALL be marked complete once this requirement's Grand Melee work lands, so the spec record matches the code
30. THE `docs/game-systems/` achievement documentation SHALL be updated for any threshold changed under criterion 19
31. THE fixes SHALL be announced in a changelog entry of category `bugfix`, listing the achievements that are now obtainable

### Requirement 9: One Disk Alert Every Two Hours

**User Story:** As the operator, I want at most one disk alert every two hours while usage stays above a threshold, so that a genuine alert is not buried in repeats and I still learn about a filling disk within minutes.

**Source:** Reported from production Discord logs on `armouredsouls-acc`, which show five CRITICAL messages per hour: four at 19:09, 19:24, 19:39 and 19:54 matching the 15-minute Disk_Check_Interval, plus one additional message. Only one of the five carries the `Immediate action required.` suffix that the current `app/scripts/disk-monitor.sh` emits, and that one arrives once per hour, consistent with its 60-minute Disk_Alert_Cooldown working correctly. The four suffix-less messages therefore come from a second, ungated emitter — the stateless version of the script described in the Spec #29 design, which recorded "The script is stateless. If disk stays at 85% for hours, it sends a warning every 15 minutes" as a deliberate choice. Cron is installed by hand per `docs/guides/operations/MONITORING.md` rather than by a deploy script, so a stale entry or a stale copy of the script under `/opt/armouredsouls/scripts/` persists indefinitely across deploys.

Two further defects in the current script compound this. `should_alert()` writes its cooldown timestamp with `echo "$now" > "$state_file" 2>/dev/null || true`, so a failed write leaves the function returning success with no state recorded, silently degrading the cooldown into a no-op — and the failure mode is most likely exactly when the disk is under pressure. And the script still calls `source /opt/armouredsouls/backend/.env`, the pattern `.kiro/steering/coding-standards.md` forbids after two production incidents, while `backup.sh` and `restore.sh` have both been converted to the Env_Get_Pattern.

#### Acceptance Criteria

1. THE Disk_Alert_Cooldown default SHALL be `7200` seconds, so that at most one alert per severity is emitted every two hours while usage remains above that threshold
2. THE Disk_Check_Interval SHALL be hourly rather than every 15 minutes, because disk growth on these hosts is driven by the hourly battle and settlement cron jobs, so consumption rises in steps at those boundaries and sampling four times per hour observes nothing that one hourly sample misses
3. THE Disk_Check_Interval SHALL NOT be lengthened beyond one hour, so that the first alert after a threshold is crossed arrives within an hour; beyond the first alert the Disk_Alert_Cooldown governs the rate, so a longer interval would trade detection latency for nothing
4. THE production and acceptance hosts SHALL run exactly one Disk_Monitor cron entry invoking exactly one copy of the script, and THE reconciliation SHALL be performed on each host as an operations step
5. THE spec SHALL identify the second ungated emitter on `armouredsouls-acc` before changing the cooldown, because raising the cooldown alone would still leave four alerts per hour from that emitter
6. WHEN the Disk_Monitor cannot write its cooldown timestamp to the Disk_Alert_State_Directory, THE Disk_Monitor SHALL report the failure rather than discarding it, so that a degraded cooldown is observable instead of silent
7. THE Disk_Monitor SHALL NOT suppress a threshold alert because its state write failed, so that a broken cooldown degrades toward alerting rather than toward silence
8. THE Disk_Monitor SHALL read `MONITORING_DISCORD_WEBHOOK`, `DISCORD_WEBHOOK_URL`, and `DISK_ALERT_COOLDOWN_SECONDS` through the Env_Get_Pattern, and SHALL NOT `source` the `.env` file
9. THE Disk_Monitor SHALL declare `set -euo pipefail`, which Spec #29 task 4.1 specified but the current script does not contain, while preserving the existing `|| true` guards and the final `exit 0` so that cron still receives a zero exit status
10. THE Disk_Monitor SHALL continue to clear the cooldown state for a severity when usage drops below that threshold, so that a fresh breach alerts immediately rather than waiting out a stale cooldown
11. THE Disk_Monitor SHALL continue to emit the existing WARNING and CRITICAL message formats, so that the alert-format table in `docs/guides/operations/MONITORING.md` remains accurate
12. THE Disk_Alert_State_Directory resolution SHALL remain `/var/lib/armouredsouls` when it exists and is writable, falling back to `/tmp`, and THE fallback SHALL be logged so an operator can tell which location is in use
13. THE spec SHALL add a test harness at `app/scripts/__tests__/disk-monitor.test.sh` that runs the script against a stubbed `df` and a temporary state directory, with no network calls
14. THE test harness SHALL assert that two consecutive invocations above the CRITICAL threshold within the cooldown window emit exactly one alert
15. THE test harness SHALL assert that an invocation after the cooldown window has elapsed emits a second alert
16. THE test harness SHALL assert that an unwritable Disk_Alert_State_Directory produces a diagnostic and still emits the threshold alert
17. THE test harness SHALL assert that a drop below the threshold clears the cooldown state so the next breach alerts immediately
18. THE test harness SHALL assert that the script exits zero in every case, including when the webhook is unset
19. THE `docs/guides/operations/MONITORING.md` cron section SHALL state the hourly `0 * * * *` schedule replacing `*/15 * * * *`, the two-hour Disk_Alert_Cooldown, the reason the hourly interval matches the cadence of disk consumption change, and that only one cron entry may exist
20. THE `docs/guides/operations/MONITORING.md` troubleshooting section SHALL add a check for duplicate cron entries and stale script copies, with the `crontab -l | grep -c disk-monitor` command to confirm exactly one
21. THE stale-emitter finding SHALL be recorded in the Spec #29 documentation or its successor, so that the deliberate "no deduplication" decision recorded in that design is not reintroduced

### Requirement 10: Single Source of Truth for Streaming Revenue Display

**User Story:** As a player deciding whether to upgrade my Streaming Studio, I want the projected revenue I am shown to match the credits I actually receive, so that I can make the decision on accurate numbers.

**Source:** Identified while comparing the Streaming Studio against the Merchandising Hub. Three display and projection paths each reimplement the streaming formula with different constants than the Streaming_Revenue_Formula that actually awards credits.

#### Acceptance Criteria

1. THE Streaming_Revenue_Formula SHALL be exposed as an exported pure function that accepts battle count, fame, and studio level, and returns the revenue amount
2. THE `calculateStreamingRevenue()` and `calculateStreamingRevenueBatch()` functions SHALL both delegate their arithmetic to that exported function, so the single-robot and batch paths cannot drift apart
3. THE streaming breakdown in `getDailyFinancialReport()` SHALL derive its battle, fame, and studio multipliers from the Streaming_Revenue_Formula, replacing the current `min(1 + (totalBattles / 100) × 0.1, 3.0)` battle multiplier and `min(1 + (totalFame / 500) × 0.1, 2.0)` fame multiplier
4. THE streaming breakdown in `getDailyFinancialReport()` SHALL present the formula per robot rather than against the roster's summed battle count and summed fame, because the Streaming_Revenue_Formula is evaluated per robot per battle
5. THE Streaming Studio branch of `facilityRecommendationService.ts` SHALL use a studio multiplier of `1 + level` in both its ROI projection and its average-revenue estimate, replacing the `1 + level × 0.1` used in the projection
6. THE `streaming_studio` projection in `unifiedFacilityROIService.ts` SHALL derive its per-battle estimate from the Streaming_Revenue_Formula rather than the local `1000 × (1 + level)` approximation, so that fame and battle count are reflected
7. WHERE a display path cannot supply a per-robot battle count or fame value, THE path SHALL state that the figure is an estimate rather than presenting it as the awarded amount
8. THE test suite SHALL include a test asserting the value shown by `getDailyFinancialReport()` for a single robot equals the value awarded by `calculateStreamingRevenue()` for that robot
9. THE test suite SHALL include a test asserting `calculateStreamingRevenue()` and `calculateStreamingRevenueBatch()` return identical values for the same robot
10. THE `docs/game-systems/PRD_ECONOMY_SYSTEM.md` SHALL document the Streaming_Revenue_Formula once, and SHALL note that all display paths derive from it

### Requirement 11: Training Facility Rewards Roster Concentration

**User Story:** As a player who concentrates on a small roster, I want the Training Facility to be worth taking to its maximum level, so that the facility's top levels are a real investment rather than a rounding error.

**Source:** Identified while reviewing facility value before the Spec #46 ACC deploy. The Training Facility discount was `min(level × 10, 90)`. That saturated at level 9, so level 10 granted exactly nothing and the facility's `maxLevel` had been lowered to 9 to reflect it — a facility whose own maximum level was removed because the formula made it pointless. The formula also ignored roster size entirely: a ten-robot stable received the same per-level rate as a one-robot stable while having ten times as many attributes to fund, so the facility was strictly better for wide rosters in absolute terms. Alongside Requirement 2, which puts the Merchandising Hub on a concentration axis, this leaves the Training Facility as the remaining breadth-favouring credit sink.

#### Acceptance Criteria

1. THE `calculateTrainingFacilityDiscount()` function in `app/shared/utils/discounts.ts` SHALL compute the Training_Discount as `clamp(level × max(0, 10 - Roster_Capacity), 0, 90)`
2. THE `training_facility` `maxLevel` in `src/config/facilities.ts` SHALL be `10`, raised from `9`, with a level 10 cost of `₡1,500,000` and no prestige gate
3. THE Training_Discount SHALL be non-increasing as Roster_Capacity increases at a fixed facility level
4. THE Training_Discount SHALL never be negative and SHALL never exceed 90, for any combination of level and Roster_Capacity including values beyond the current `roster_expansion` cap
5. THE Roster_Capacity used SHALL be derived from the `roster_expansion` facility level plus one, and SHALL NOT be derived from a live count of `robots` rows
6. THE `calculateTrainingFacilityDiscount()` and `calculateDiscountedUpgradeCost()` signatures SHALL accept Roster_Capacity as an explicit parameter rather than querying the database, preserving the shared module's side-effect-free contract
7. THE attribute upgrade transaction SHALL re-read Roster_Capacity inside the locked transaction alongside the Training Facility level, so a concurrent `roster_expansion` upgrade cannot be charged at a stale discount
8. THE `GET /api/facilities` response SHALL report the Training Facility's `currentBenefit` and `nextBenefit` as the discount computed against the requesting stable's own Roster_Capacity, not the best-case value from the static benefit strings
9. WHERE a stable's Training_Discount_Rate_Per_Level is zero, THE benefit text SHALL state that the facility grants no discount at that roster size rather than displaying `0%` without explanation
10. THE `getRosterCapacity()` helper SHALL live in `app/shared/utils/` so that both the frontend cost previews and the backend transaction derive Roster_Capacity from one definition
11. THE frontend attribute upgrade cost previews — `UpgradePlanner`, `WhatIfPanel`, and the onboarding upgrade step — SHALL pass the stable's Roster_Capacity so that the previewed cost matches the charged cost
12. THE test suite SHALL include a property test asserting the Training_Discount is non-increasing as Roster_Capacity increases
13. THE test suite SHALL include regression tests for the two worked examples: level 5 at Roster_Capacity 4 yields 30%, and level 8 at Roster_Capacity 2 yields 64%
14. THE test suite SHALL include a test asserting level 10 yields a strictly greater discount than level 9 at every Roster_Capacity that earns a non-zero rate
15. THE `docs/game-systems/STABLE_SYSTEM.md` SHALL document the Training_Discount formula, the raised `maxLevel`, and the per-level rate table
16. THE in-game guide SHALL state the roster-dependent formula in `facilities/facility-overview.md` and `robots/upgrade-costs.md`
17. THE `docs/prd_pages/PRD_FACILITIES_PAGE.md` SHALL document the roster-dependent benefit and that the page displays the stable's actual figure
18. THE change SHALL be announced in a changelog entry of category `balance`, stating that wide rosters lose Training Facility value while concentrated rosters gain a newly meaningful level 10
