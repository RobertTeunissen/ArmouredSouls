# Implementation Plan

## Spec: Bug Fixes and Balance Changes

## Overview

Nine independent items across ten implementation groups plus a verification group. Two balance reworks (groups 4 and 6), five defect fixes (groups 1, 2, 7, 9, 10), and two feature additions (groups 3 and 5 for the Booking Office, group 8 for win streaks).

No group adds a database column, so there are no migration tasks. No group performs a data backfill: the merchandising and refinement changes recompute from existing rows on deploy, and the achievement fixes deliberately skip retroactive awards because Spec #45 resets achievements at the season boundary.

## Task Dependency Graph

Most groups are independent. Three ordering constraints follow from the shared-file collisions recorded in the design's Architecture section, and violating any of them causes a later edit to conflict with or silently revert an earlier one.

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2", "3", "6", "7", "9", "10", "11"],
      "description": "All independent work plus the two prerequisites for wave 2. Groups 1, 6, 9, 10, and 11 have no dependencies on other groups; groups 2 and 3 must complete before group 4; group 7 must complete before group 8. Within group 11, task 11.1 must precede 11.3."
    },
    {
      "wave": 2,
      "tasks": ["4", "8"],
      "dependsOn": ["2", "3", "7"],
      "description": "Group 4 (merchandising) requires groups 2 and 3 to have released leaderboardService.ts and routes/facility.ts. Group 8 (win streaks) requires group 7 to have restructured recordsQueryService.ts and RecordsData."
    },
    {
      "wave": 3,
      "tasks": ["5"],
      "dependsOn": ["3", "4"],
      "description": "Booking Office UI requires the repaired operating costs from group 3 and the prestige gate handling from group 4."
    },
    {
      "wave": 4,
      "tasks": ["12"],
      "dependsOn": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
      "description": "Spec verification runs only after every implementation group is complete."
    }
  ]
}
```

| Constraint | Reason |
|------------|--------|
| Group 2 before Group 4 | Group 2 deletes the inline `1 + prestige / 10000` and `calculateBattleWinningsBonus()` in `leaderboardService.ts`. If Group 4 runs first it updates code Group 2 then deletes. |
| Group 3 before Group 4 | Both edit the `GET /api/facilities` handler in `routes/facility.ts` — Group 3 replaces the Facility_Operating_Cost_Chain, Group 4 changes the prestige gate comparison. |
| Group 4 before Group 5 | The Booking Office Upgrade_Implication_Panel reads the operating cost that Group 3 repairs and is tested against the `prestigeGateIsPerSlot` handling Group 4 introduces. |
| Group 7 before Group 8 | Both restructure the `fetch*Records()` exports in `recordsQueryService.ts` and the `RecordsData` type. |

Groups 1, 6, 9, 10, and 11 may proceed in parallel with any other group. Group 11 has one internal ordering constraint: task 11.1 removes the duplicate alert emitter on each host and must precede task 11.3, because four of the five alerts per hour originate from that emitter and changing the cooldown constant first would appear to have no effect.

## Tasks

- [x] 1. Tournament creation timing alignment
  - [x] 1.1 Restructure the team tournament handlers in `cycleScheduler.ts`
    - Remove the `return` from inside the `if (activeTournament)` branch of `executeTeam2v2TournamentCycle()` and `executeTeam3v3TournamentCycle()` so both fall through to Tournament_Auto_Creation on every run
    - Verify `autoCreateNextTeamTournament(size)` already guards against creating a second tournament while one is active and already logs the Participant_Type and shortfall when eligible participants are below the minimum bracket size — no change inside it
    - Confirm both handlers still build and return the same `JobContext` object shape
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x] 1.2 Add the Season_Phase seam at the auto-creation call site
    - Guard the auto-creation call so it is skipped when the current Season_Phase is `preparation`
    - Spec #45 has not shipped, so the accessor does not yet exist — write the guard against the Season_Service interface Spec #45 defines and leave it inert until that spec lands, with a comment naming the dependency
    - _Requirements: 1.8_
  - [x] 1.3 Write per-participant-type cadence tests
    - One test per Participant_Type (`robot`, `team_2v2`, `team_3v3`) asserting that the run which completes the final round also creates the next tournament when enough participants are eligible
    - Test asserting no tournament is created when one is still active
    - Test asserting the shortfall log fires and no tournament is created below the minimum bracket size
    - _Requirements: 1.7_
  - [x] 1.4 Update `docs/game-systems/PRD_TOURNAMENT_SYSTEM.md`
    - Document that all three Participant_Types create the next bracket in the run that completes the previous one
    - _Requirements: 1.9_

- [x] 2. Leaderboard filter and column cleanup
  - [x] 2.1 Remove the Fame_Leaderboard filters from the backend
    - Delete `league` and `minBattles` from `fameQuerySchema` in `routes/leaderboards.ts`
    - Delete both from `FameLeaderboardParams` and `getFameLeaderboard()` in `services/analytics/leaderboardService.ts`
    - Remove the `WHERE r."total_battles" >= …` predicate and the conditional `AND s.tier = …` from the raw SQL
    - Remove both keys from the response `filters` object
    - Drop the `LEFT JOIN "standings"` entirely, since nothing is projected from it once `currentLeague` is gone
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 2.2 Remove the Fame_Leaderboard filters and League column from the page
    - Delete `currentLeague` from `FameLeaderboardEntry` and from the SQL projection
    - Delete the League column from the desktop table header and body, and the League row from the mobile card, in `LeaderboardsFamePage.tsx`
    - Delete the League Filter select, the minimum-battles select, their `useState` hooks, and their entries in the fetch effect dependency array
    - Remove the filter bar container rather than leaving it rendered empty
    - _Requirements: 5.5, 5.6, 5.7_
  - [x] 2.3 Remove the Prestige_Leaderboard filter and derived columns from the backend
    - Delete `minRobots` from `prestigeQuerySchema`, `PrestigeLeaderboardParams`, and `getPrestigeLeaderboard()`
    - Remove the `HAVING COUNT(r.id) >= …` clause so all stables rank regardless of robot count
    - Remove `minRobots` from the response `filters` object
    - Delete `battleWinningsBonus` and `merchandisingMultiplier` from `PrestigeLeaderboardEntry` and from the entry mapping
    - Delete `calculateBattleWinningsBonus()` and the inline `1 + prestige / 10000` expression; remove the `getPrestigeMultiplier` import if now unused
    - Retain `totalRobots` as identifying context
    - _Requirements: 5.8, 5.9, 5.10, 5.12, 5.13, 5.14_
  - [x] 2.4 Remove the bonus column from the Prestige_Leaderboard page
    - Delete the bonus table cell — which renders both `battleWinningsBonus` and `merchandisingMultiplier` — from the desktop table, and the equivalent row from the mobile card, in `LeaderboardsPrestigePage.tsx`
    - Verify no dangling table header remains for either leaderboard
    - _Requirements: 5.11, 5.17_
  - [x] 2.5 Rebuild both Leaderboard_Cache_Keys
    - Reduce the fame key to `fame:${page}:${limit}` and the prestige key to `prestige:${page}:${limit}` so no fragment references a removed filter
    - Confirm Zod's default `.strip()` causes a removed parameter supplied by an old client or bookmark to be ignored rather than rejected
    - _Requirements: 5.15, 5.16_
  - [x] 2.6 Write and update leaderboard tests
    - Test asserting a robot with non-zero `fame` and zero `total_battles` appears in the Fame_Leaderboard response
    - Test asserting a stable owning one robot appears in the Prestige_Leaderboard response
    - Test asserting `league`, `minBattles`, and `minRobots` query parameters produce the same result as omitting them
    - Update or delete existing tests that assert on the removed filters, `currentLeague`, `battleWinningsBonus`, or `merchandisingMultiplier`
    - Mobile viewport assertions for both pages: no horizontal overflow from 320px, touch targets at least 44px
    - _Requirements: 5.18, 5.19, 5.20, 5.21_
  - [x] 2.7 Update `docs/game-systems/PRD_PRESTIGE_AND_FAME.md`
    - There is no leaderboard document under `docs/prd_pages/`; this PRD already owns the prestige and fame tier tables the leaderboards render
    - List the retained filters and columns for the Fame_Leaderboard and Prestige_Leaderboard
    - Add the note that prestige is a stable-level total accruing per winning robot, so a larger roster ranks higher, and that this ranking is deliberately not normalised
    - _Requirements: 5.22, 5.23_

- [x] 3. Facility operating cost consolidation
  - [x] 3.1 Replace the Facility_Operating_Cost_Chain in `routes/facility.ts`
    - Replace the per-type `if`/`else if` chain with `calculateFacilityOperatingCost()` from `utils/economyFormulas.ts` for both `currentOperatingCost` and `nextOperatingCost`
    - Retain the `roster_expansion` special case, which is charged per filled robot slot rather than per level, and add a comment stating why it cannot route through the shared formula
    - Confirm the response now reports the Booking Office at `150 × level` and the Tuning Bay at `300 × level`, both of which the removed chain omitted
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 3.2 Write the operating cost parity test
    - Property test walking every entry in `FACILITY_TYPES` asserting the response `currentOperatingCost` equals `calculateFacilityOperatingCost(type, currentLevel)`, skipping only `roster_expansion`
    - _Requirements: 6.4_

- [x] 4. Merchandising Hub roster concentration
  - [x] 4.1 Change the merchandising formulas in `utils/economyFormulas.ts`
    - Add `getRosterCapacity(rosterExpansionLevel)` returning `level + 1` with a minimum of 1, mirroring `maxRobots` in `robotCreationService.ts`
    - Change `getMerchandisingBaseRate()` to `10000 × level` for levels 1 through 10
    - Add a third `rosterCapacity` parameter to `calculateMerchandisingIncome()` and compute the Merch_Multiplier as `1 + (prestige / rosterCapacity) / 10000`, keeping the module free of database access
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 4.2 Thread Roster_Capacity through every call site
    - `cycleScheduler.ts` Settlement_Job: resolve capacity from the `facilitiesByUser` map the job already batch-loads, adding no per-user query
    - `utils/economyCalculations.ts` `calculateDailyPassiveIncome()`: add `roster_expansion` to the existing facility lookup
    - `services/economy/financialReportService.ts`: extend the existing `Promise.all` facility fetch
    - `services/admin/adminCycleService.ts` daily-finances branch: resolve from the facilities it already loads per user
    - Confirm `unifiedFacilityROIService.ts` needs no change, as it reads historical `merchandisingIncome` from snapshots rather than the formula
    - _Requirements: 2.8_
  - [x] 4.3 Extend the `PASSIVE_INCOME` audit payload
    - Add `rosterCapacity` and `prestigePerSlot` to the payload emitted by the Settlement_Job
    - Extend `CycleEventPayload` in `src/types/` accordingly; confirm `cycleSnapshotService.ts` still reads only `merchandising` and needs no change
    - _Requirements: 2.9_
  - [x] 4.4 Re-base the Merchandising_Prestige_Gate to Prestige_Per_Slot
    - Change the `merchandising_hub` `prestigeRequirements` in `config/facilities.ts` from `[0,0,0,3000,0,0,7500,0,15000,0]` to `[0,0,0,2000,0,0,5000,0,9000,0]`
    - Add `prestigeGateIsPerSlot?: boolean` to `FacilityConfig` and set it on `merchandising_hub` only
    - Read the flag in both the `GET /api/facilities` gate display and the Facility_Upgrade_Endpoint validation to choose between Prestige_Per_Slot and raw prestige, rather than special-casing the facility type by string comparison
    - Confirm no downgrade or refund path exists, so a stable already above its new gate keeps its level and continues producing income
    - _Requirements: 2.10, 2.11, 2.12_
  - [x] 4.5 Update the `merchandising_hub` config strings
    - Rewrite all ten benefit strings to state the doubled base rates and to describe the multiplier as scaling with prestige per robot slot
    - Rewrite the description to state that a larger roster divides the same prestige across more slots
    - _Requirements: 2.14, 2.15_
  - [x] 4.6 Update the financial report and the finances recommendation
    - Add `rosterCapacity` and `prestigePerSlot` to the merchandising block of `getDailyFinancialReport()` and rebuild the formula string to show the per-slot division
    - Replace the stale `currency >= 800000 && prestige >= 1000` heuristic in `routes/finances.ts` with the facility's actual level 1 cost from `getFacilityUpgradeCost('merchandising_hub', 0)`
    - _Requirements: 2.16, 2.17_
  - [x] 4.7 Write merchandising tests
    - Property test asserting merchandising income is non-increasing as Roster_Capacity increases at fixed `prestige` and level (Property 1)
    - Regression test asserting Roster_Capacity 1 yields exactly double the pre-change income at the same `prestige` and level (Property 2)
    - Unit test asserting cumulative payback at each level 1 through 10 is under 100 cycles at a Prestige_Per_Slot of zero
    - Test asserting that at equal `prestige` and level, the lower Roster_Capacity receives income greater than or equal to the higher
    - _Requirements: 2.7, 2.13, 2.18, 2.19, 2.20_
  - [x] 4.8 Update merchandising documentation
    - `docs/game-systems/PRD_ECONOMY_SYSTEM.md`: document the Prestige_Per_Slot formula, the doubled base rate table, and the re-based Merchandising_Prestige_Gate values
    - `.kiro/steering/project-overview.md`: note in the Economy entry that merchandising scales with prestige per robot slot while streaming scales per robot per battle
    - _Requirements: 2.21, 2.22_

- [x] 5. Booking Office upgrade control
  - [x] 5.1 Add the facilities data source to `BookingOfficePage.tsx`
    - Fetch `GET /api/facilities` and select the `booking_office` entry, using its `upgradeCost`, `nextLevelPrestigeRequired`, `hasPrestige`, `canAfford`, `canUpgrade`, `currentOperatingCost`, `nextOperatingCost`, plus response-level `userPrestige` and `userCurrency`
    - Recompute nothing client-side that the endpoint already returns
    - _Requirements: 6.14_
  - [x] 5.2 Build the upgrade control and Upgrade_Implication_Panel
    - Add an upgrade control that raises the Booking Office by one level via the existing Facility_Upgrade_Endpoint with `{ facilityType: 'booking_office' }`, introducing no new endpoint so the endpoint's `lockUserForSpending` transaction and validations are inherited
    - Render the Upgrade_Implication_Panel with the credit cost of the next level, the resulting Subscription_Cap as `3 + nextLevel` subscriptions per robot, the resulting daily operating cost, and the current credit balance
    - Express the effect as the resulting cap, never as a bare level number
    - Where the next level is gated, state the required prestige and the player's current prestige
    - _Requirements: 6.5, 6.6, 6.7, 6.8, 6.9_
  - [x] 5.3 Implement the disabled-state matrix
    - Insufficient prestige: disabled, prestige stated as the blocking condition
    - Insufficient credits: disabled, credits stated as the blocking condition
    - Both insufficient: disabled, both conditions stated rather than only the first
    - Level 10: replace the control with a maximum-level indicator and omit the Upgrade_Implication_Panel
    - Request in flight: disabled, so a double click cannot submit two upgrades
    - _Requirements: 6.10, 6.11, 6.12, 6.13, 6.18_
  - [x] 5.4 Handle upgrade success and failure
    - On success, refetch the facilities data and the SubscriptionMatrix data so the new slots become usable and the credit balance updates without a page reload
    - On failure, surface the error message from the Facility_Upgrade_Endpoint and leave the displayed level and balance unchanged
    - Confirm no existing subscription is invalidated, reassigned, or cancelled, since raising the cap is purely additive
    - _Requirements: 6.15, 6.16, 6.17, 6.19_
  - [x] 5.5 Accessibility and mobile layout
    - Make the control keyboard reachable and operable with an accessible name identifying both the action and the facility, and expose the disabled reason via `aria-describedby` rather than colour alone
    - Give the control a touch target of at least 44px
    - Stack the Upgrade_Implication_Panel figures vertically below 1024px, following the responsive pattern in `.kiro/steering/frontend-standards.md`
    - _Requirements: 6.20, 6.21, 6.22_
  - [x] 5.6 Write Booking Office page tests
    - Test the disabled state and stated reason for each of insufficient prestige, insufficient credits, both insufficient, and maximum level
    - Test that a successful upgrade refreshes the Subscription_Cap shown on the page
    - Test that the Upgrade_Implication_Panel displays a non-zero daily operating cost, guarding the Facility_Operating_Cost_Chain regression
    - Mobile viewport assertions: no horizontal overflow from 320px, touch targets at least 44px
    - _Requirements: 6.23, 6.24, 6.25_
  - [x] 5.7 Update Booking Office documentation
    - `docs/prd_pages/` Booking Office: document the upgrade control and the contents of the Upgrade_Implication_Panel
    - `docs/game-systems/` Booking Office: state the ₡150 per level daily operating cost if not already present
    - _Requirements: 6.26, 6.27_

- [x] 6. Proportional Sharpen and Forge refinements
  - [x] 6.1 Rewrite the Refinement_Fold
    - Edit `app/shared/utils/weaponRefinement.ts` only. `app/backend/src/shared/utils` is a committed symlink to `app/shared/utils` (git mode `120000`), so there is one file reachable by two paths — verified by matching inodes and `git ls-files -s`
    - Convert the refinement loop to a counting pass for Sharpen and Forge while leaving Hone and Augment handling unchanged
    - Export `SHARPEN_COOLDOWN_REDUCTION_PER_INSTANCE = 0.10` and `FORGE_DAMAGE_INCREASE_PER_INSTANCE = 0.08` so tests and UI copy read the same values
    - Apply the multipliers additively against the catalog value after the loop, so two instances land on exactly `× 0.80` cooldown and `× 1.16` damage rather than the `0.81` and `1.1664` compounding would give
    - Add a local `roundTo2` helper and apply it to both outputs; keep the module dependency-free since the frontend consumes it
    - Confirm the multiplier lands on the catalog cooldown before the offhand penalty and the `attackSpeed` divisor in `calcCooldown()`
    - Confirm Effective_Cooldown stays strictly positive at the maximum reduction, retiring the unfloored-subtraction hazard from Spec #34 key decision #7
    - Leave the per-tier instance caps of 2 and the cost formulas unchanged
    - Confirm no migration is needed, since `weapon_refinement` stores tier and magnitude rather than the computed effect
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9, 3.10, 3.11, 3.12_
  - [x] 6.2 Write refinement tests
    - Property test asserting the proportional gain from a fixed refinement set is invariant across the full catalog range of cooldown and base damage, across `attackSpeed` values, and across main and offhand slots (Property 3)
    - Import-identity test asserting the backend path and the shared path resolve to the same module and produce identical Effective_Cooldown and Effective_Base_Damage, so replacing the symlink with a real directory is caught, following `app/backend/tests/sharedRepairCostParity.test.ts`
    - Regression tests asserting a 2.0s weapon at the Sharpen cap yields 1.6s and a 6.0s weapon yields 4.8s
    - Precision test asserting a 3.5s weapon with one Sharpen instance yields 3.15s rather than a value rounded to one decimal
    - _Requirements: 3.7, 3.8, 3.13, 3.14, 3.15, 3.16_
  - [x] 6.3 Update the refinement display copy and rendering
    - Replace the flat values with per-instance percentages and cap values in the `TIER_BLURB` map and the inline Sharpen and Forge explanation paragraphs of `RefinementModal.tsx`, the slot labels of `SlotBar.tsx`, the per-row effect strings of `RefinementHistoryPopover.tsx`, and the `TIER_DESC` map of `RefinementAdoptionPage.tsx`
    - Update the header docblock tier list in `weaponRefinement.ts`
    - Render Effective_Cooldown and Effective_Base_Damage with trailing zeros trimmed, so `1.60` shows as `1.6` and `3.15` stays `3.15`
    - Keep the modal's live stat preview showing concrete before-and-after values for the specific weapon alongside the proportional copy
    - Ensure any projected DPS figure is computed from the Observable_Cadence or labelled approximate, since `SIMULATION_TICK` quantises the firing interval to 0.1s
    - _Requirements: 3.17, 3.18, 3.19, 3.20, 3.21_
  - [x] 6.4 Update refinement documentation and changelog
    - `docs/game-systems/PRD_WEAPON_ECONOMY.md`: add a v1.7 section documenting the proportional effects, the additive stacking rule, the Refinement_Rounding_Precision, and the reasoning that flat bonuses subsidised fast low-damage one-handed weapons
    - `docs/game-systems/PRD_WEAPON_ECONOMY.md`: update the four-tier table so the Sharpen and Forge effect columns state proportional values
    - `docs/guides/ADMIN_PANEL_GUIDE.md`: check the Refinement section for hardcoded tier effect values and update if present
    - Draft a `balance` changelog entry stating that fast one-handed builds lose a small amount of Sharpen value while slow two-handed builds gain substantially, because every existing refinement is recomputed on deploy
    - _Requirements: 3.22, 3.23, 3.24, 3.25_

- [x] 7. Hall of Records pruning and re-scoping
  - [x] 7.1 Remove the degenerate Record_Categories
    - Remove `longestBattle` and `fastestVictory` from `fetchCombatRecords()` in `recordsQueryService.ts` and their sections from `CombatRecords.tsx`
    - Remove `biggestEloGain` and `biggestEloLoss` from `fetchUpsetRecords()` and their sections from `UpsetRecords.tsx`, since `ELO_K_FACTOR` is fixed at 32 and every entry reports the same magnitude
    - Remove `bestPlacement` from `fetchKothRecords()` and its section from `KothRecords.tsx`, since any robot that has won ties at placement 1
    - Add no Longest Battle replacement: any duration-derived metric inherits the same `MAX_BATTLE_DURATION` cap
    - _Requirements: 4.1, 4.2, 4.3, 4.8, 4.9_
  - [x] 7.2 Convert Most Damage to a Mode_Scoped_Record
    - Change `mostDamageInBattle` to an object keyed by `battles.battle_type` covering `league_1v1`, `tournament_1v1`, `league_2v2`, `league_3v3`, `koth`, and `grand_melee`, following the `'2v2'` / `'3v3'` shape `fetchTeamBattleRecords()` already uses
    - Drop the opponent field for multi-participant modes, where a single opponent is not well defined
    - _Requirements: 4.5_
  - [x] 7.3 Restrict Biggest Upset to tournament modes and add summed team ELO
    - Change the `battle_type` predicate on the existing 1v1 upset query to the tournament types only, since league matchmaking pairs robots on comparable standing
    - Add a separate query for team tournament types computing the differential from summed team `elo_before` via a `GROUP BY battle_id, team` aggregation, consistent with how `calculateTeamBattleELOChanges()` derives team ratings
    - _Requirements: 4.6, 4.7_
  - [x] 7.4 Round the KotH zone metrics
    - Round `totalZoneScore` and `totalZoneTime` to Zone_Metric_Precision using `Math.round(value * 10) / 10` in `recordsQueryService.ts`, not in `KothRecords.tsx`, so the API ships display-ready values
    - Retain the Zone Dominator and Most Zone Time categories
    - _Requirements: 4.10, 4.11, 4.12_
  - [x] 7.5 Label the Career tab mode coverage
    - Label Most Battles and Highest Win Rate as covering 1v1, tournament, tag team, and team league, since Career_Battle_Counters are skipped for KotH and Grand Melee
    - Label Most Lifetime Damage as covering all modes, since `damageDealtLifetime` is incremented regardless of the `skipBattleCounters` flag
    - Label Most Kills and Highest ELO with their current scope
    - Record the decision not to widen Career_Battle_Counters: both modes resolve by placement, a win is undefined for placements 2 through N, and widening would corrupt the win-rate denominator Highest Win Rate ranks on and change `robots.wins` semantics for every other consumer
    - Record criterion 4.15 as not applicable, following from that decision
    - _Requirements: 4.13, 4.14, 4.15_
  - [x] 7.6 Fix the battle detail null dereference
    - Widen the `battleData.robot1` and `battleData.robot2` parameter types on `buildStandardLogResponse()` in `matchHistoryService.ts` to `RobotForLog | null` and guard both assignment blocks, emitting `robot1` and `robot2` as `null` when the participant is unresolvable
    - Confirm `BattleDetailPage.tsx` already guards these fields with optional chaining and needs no change
    - Confirm the existing `playbackAvailable` flag and the separately loaded `battle_summaries` row already provide the summary-only rendering path for a NULL `battle_log`
    - Write no data remediation task: the orphaned single-participant rows originate from migration `20260611120000_drop_legacy_scheduling_tables` deleting participants and battles through two different keys, and Spec #45 deletes the battle history at the season boundary
    - _Requirements: 4.18, 4.19, 4.20_
  - [x] 7.7 Update the frontend types and section rendering
    - Remove the deleted categories from `RecordsData` in `app/frontend/src/components/hall-of-records/types.ts` and re-key `mostDamageInBattle` by mode
    - Omit any section with no qualifying entries rather than rendering an empty heading
    - Verify the Combat, Upset, Career, KotH, and Grand Melee tabs remain usable from 320px to below 1024px with no horizontal overflow and touch targets of at least 44px, rendering the mode-scoped Most Damage as a mode switcher above a single list on narrow viewports
    - _Requirements: 4.21, 4.22, 4.23_
  - [x] 7.8 Verify and extend the Grand Melee kills record
    - Confirm `standings.total_kills` is populated for `mode = 'grand_melee'` — the backend already returns `mostKillsCareer` and `GrandMeleeRecords.tsx` already renders it, so an empty section indicates the kill counting in `computePlacements()` is not recording kills rather than a missing feature
    - Investigate the attacker-name matching in `computePlacements()` if the counter is zero, and fix it there
    - Add kills per match alongside total kills so robots with many matches do not dominate on volume alone
    - _Requirements: 4.16, 4.17_
  - [x] 7.9 Write records tests
    - Test asserting that for every retained Record_Category, seeded data with distinct underlying values produces distinct ranked values (Property 6)
    - Test asserting battle detail resolves successfully for a battle whose `battle_log` is NULL and whose `battle_summaries` row exists
    - Test asserting battle detail resolves for a battle with exactly one `battle_participants` row
    - Test asserting the zone metrics in the `GET /api/records` response carry at most one decimal place
    - _Requirements: 4.24, 4.25, 4.26_
  - [x] 7.10 Update records documentation and record the open observation
    - `docs/prd_pages/` Hall of Records: list the retained Record_Categories, the per-mode scoping of Most Damage, and the mode coverage of each Career category
    - Record the ~1-second battle question as an open observation for separate investigation, noting that removing Fastest Victory removes the only surface where it was visible and that a one-second resolution may indicate a combat defect
    - Draft a `feature` changelog entry for the removed categories, since players lose visible leaderboard positions
    - _Requirements: 4.4, 4.27, 4.28_

- [x] 8. League win streak records
  - [x] 8.1 Add `fetchWinStreakRecords()` to `recordsQueryService.ts`
    - Return one list per League_Mode: `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`
    - Query `standings` per mode filtered on `bestWinStreak: { gt: 0 }`, ordered by `bestWinStreak` descending with `entityId` ascending as the deterministic tiebreak
    - Read `standings.best_win_streak` directly; do not recompute from battle history, since `battle_log` is subject to retention and streaks are maintained counters
    - Resolve `league_1v1` entities as robots and the three team modes as `TeamBattle` rows via `standings.entity_id`, each with the owning stable
    - Batch entity resolution into one `robot.findMany` and one `teamBattle.findMany` across all four result sets, following the `robotMap` pattern in `fetchKothRecords()`
    - Include `currentWinStreak` and an `isActive` flag set when `currentWinStreak === bestWinStreak`
    - Exclude the tournament modes, whose orchestrators never call `recordBattleResult()` so their streak columns are permanently zero
    - Exclude `grand_melee` per the recorded decision: a win there is placement 1 of 20, so streaks would rank near zero for every player and invite a meaningless comparison against league streaks
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.16_
  - [x] 8.2 Add the `WinStreakRecords` component
    - Render all four League_Modes side by side in one grouped Hall_Of_Records section rather than scattering them across the existing per-mode tabs, so streaks can be compared across modes
    - Render `RecordCard` without its `onClick` prop, since a streak spans multiple battles and no single battle represents it
    - Omit any mode section with no entity holding a non-zero streak
    - Add the new categories to `RecordsData` in `app/frontend/src/components/hall-of-records/types.ts`
    - Stack the four mode sections vertically below 1024px with no horizontal overflow and touch targets of at least 44px
    - _Requirements: 7.13, 7.14, 7.15, 7.17, 7.18_
  - [x] 8.3 Write win streak tests
    - Test asserting a Win_Streak_Record is returned for each of the four League_Modes when streak data is present
    - Test asserting a team-mode Win_Streak_Record resolves the team name rather than reporting an unknown entity
    - Test asserting entities with a zero `best_win_streak` are absent from the response
    - Test asserting the tournament modes produce no Win_Streak_Record
    - _Requirements: 7.19, 7.20, 7.21, 7.22_
  - [x] 8.4 Document the win streak records
    - `docs/prd_pages/` Hall of Records: list the Win_Streak_Records, their per-mode scoping, and the bye-win caveat for `league_1v1`
    - Document that `processByeBattle()` calls `recordBattleResult()` with a `'win'` outcome so a streak may be extended by a walkover, and that this is accepted rather than corrected because league points already treat a bye as a win
    - Draft a `feature` changelog entry for the addition
    - _Requirements: 7.11, 7.12, 7.23, 7.24_

- [x] 9. Unreachable achievements
  - [x] 9.1 Fix Cause A — resolve team-mode wins through team memberships
    - Add a shared `resolveTeamModeWins(robotIds): Promise<Map<number, TeamModeWins>>` helper using two queries: `teamBattleMember.findMany` selecting `robotId`, `teamId`, and `team.teamSize`, then `standing.findMany` for `entityType: 'team'` on those team ids
    - Replace the Robot_Scoped_Standing lookups for `'tag_team'`, `'league_2v2'`, and `'league_3v3'` in `achievementService.ts` with the helper
    - Use the same helper in `achievementCatalog.ts` so displayed progress cannot disagree with unlock behaviour
    - Rely on the invariant that a robot belongs to at most one team per team size, enforced by the `TEAM_MEMBER_CONFLICT` check in `createTeam()` under `pg_advisory_xact_lock(2, robotId)`; note in a comment that this is an application-level invariant, since `TeamBattleMember`'s unique indexes are both team-scoped
    - Map a size-2 membership to both its `league_2v2` and `tag_team` standings, since Tag Team is a combat mode on the same `TeamBattle`
    - Resolve a robot with no membership in a given size to zero rather than raising, since the evaluator runs for every participant of every battle
    - Write tests asserting a robot on exactly one team resolves that team's win count, and a robot on no team of that size resolves zero
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 9.2 Fix Cause B — compare the Opponent_Elo_Gap
    - Change the `'elo_upset'` case in `evaluateTrigger()` to compare `opponentEloBefore - subjectEloBefore` against `minEloDiff`, instead of the subject's own ELO change which `ELO_K_FACTOR` bounds at 32
    - Keep the win requirement and the restriction to `'league_1v1'` and `'tournament_1v1'`
    - Pass both `subjectEloBefore` and `opponentEloBefore` in the achievement context from the 1v1 league and 1v1 tournament orchestrators, which already hold both participant records at the call site
    - Rename the existing `eloDiff` context field to `eloChange` across its consumers, including the `'elo'` trigger and audit logging, so it cannot be mistaken for an opponent gap again
    - _Requirements: 8.6, 8.7, 8.8, 8.9_
  - [x] 9.3 Fix Cause C — register the three Grand Melee trigger types
    - Add `'grand_melee_wins'`, `'grand_melee_top3'`, and `'grand_melee_win_high_hp'` to the `battle_complete` array of `EVENT_TRIGGER_MAP` in `achievementTypes.ts`
    - Add three cases to the `switch` in `evaluateTrigger()`: the two counter types via `checkRobotStatCached()` on `grandMeleeWins` and `grandMeleeTop3` following the `koth_wins` pattern, and `'grand_melee_win_high_hp'` as a one-shot boolean requiring `battleType === 'grand_melee'`, `placement === 1`, and `finalHpPercent` above `triggerMeta.minHpPercent`
    - Add `'grand_melee_wins'` and `'grand_melee_top3'` to the Achievement_Progress_Resolver in `achievementCatalog.ts` via `bestRobotFor()`; `'grand_melee_win_high_hp'` is boolean and needs no entry
    - _Requirements: 8.10, 8.11, 8.12_
  - [x] 9.4 Fix Cause C — increment the Grand Melee counters
    - Add an optional `placement` field to the `updateRobotCombatStats()` options in `battlePostCombat.ts`
    - Increment `grandMeleeWins` when `battleType === 'grand_melee'` and `placement === 1`, and `grandMeleeTop3` when `placement <= 3`
    - Place the increments outside the `if (!opts.skipBattleCounters)` guard, since the Grand Melee orchestrator passes `skipBattleCounters: true` to exclude the mode from Career_Battle_Counters, not from its own mode counters
    - Keep the increments in the shared helper rather than inline in the orchestrator, per the unified post-battle update rule in `.kiro/steering/project-overview.md`
    - Pass `placement` and `finalHpPercent` in the Grand Melee orchestrator's achievement context, both of which it already computes
    - _Requirements: 8.13, 8.14, 8.15, 8.16, 8.17_
  - [x] 9.5 Audit for further unreachable achievements
    - Check every entry in `ACHIEVEMENTS` for a `triggerType` absent from any of the three Achievement_Trigger_Registration locations, and report any additional unreachable achievement beyond the nine
    - Check every trigger type that reads a `standings` row for the Cause A mode-to-entity-type mismatch
    - Fix anything found under this task group, or raise it separately with a recorded reason
    - _Requirements: 8.20, 8.21_
  - [x] 9.6 Record the threshold reachability finding
    - Document that at one match per mode per cycle over a 100-cycle season, L16 "Dynamic Duo" at 40 tag team wins needs a 40% win rate and L19 "Twins!" and L21 "Voltron" at 25 wins each need 25%, all attainable, so no threshold reduction is triggered
    - State the assumption of continuous subscription to the mode through the season
    - Note that these were previously unreachable at any threshold because of Cause A
    - _Requirements: 8.18, 8.19_
  - [x] 9.7 Write the structural guard tests
    - Test asserting every `triggerType` referenced by an `ACHIEVEMENTS` entry appears in at least one `EVENT_TRIGGER_MAP` array and is handled by a non-default branch of `evaluateTrigger()` (Property 5)
    - Test asserting every entry with `progressType: 'numeric'` appears in the Achievement_Progress_Resolver
    - _Requirements: 8.22, 8.23_
  - [x] 9.8 Write the per-achievement unlock tests
    - One test per affected achievement asserting it unlocks when its stated condition is met: L16, L19, L21, C11, L26, L27, L28, L29, L30
    - Regression test asserting `'elo_upset'` does not unlock on a win whose ELO change is 32 but whose Opponent_Elo_Gap is below the threshold
    - _Requirements: 8.24, 8.25_
  - [x] 9.9 Confirm no backfill and document the deferred unlock
    - Write no backfill task and no retroactive award, since Spec #45 deletes `user_achievements` and resets the backing counters at the season boundary
    - Document that because evaluation is driven by the `battle_complete` event, a player already holding qualifying Team_Scoped_Standing win counts sees the achievement unlock on their next qualifying battle rather than at deploy time
    - Draft a `bugfix` changelog entry listing the nine achievements that are now obtainable and stating the deferred-unlock behaviour, so the delay is not read as the defect persisting
    - _Requirements: 8.26, 8.27, 8.28, 8.31_
  - [x] 9.10 Correct the spec record and achievement documentation
    - Mark tasks 10.1 and 10.2 complete in `.kiro/specs/done-june26/44-grand-melee/tasks.md`, which are currently unchecked in a spec filed as done and are how Cause C escaped notice
    - Update `docs/game-systems/` achievement documentation for any threshold changed under task 9.6 — none expected per the reachability finding
    - _Requirements: 8.29, 8.30_

- [x] 10. Streaming revenue single source of truth
  - [x] 10.1 Extract the canonical streaming computation
    - Add an exported `computeStreamingRevenue(totalBattleCount, fame, studioLevel)` to `streamingRevenueService.ts` returning the base amount, all three multipliers, and the total
    - Delegate both `calculateStreamingRevenue()` and `calculateStreamingRevenueBatch()` to it, removing the current duplication between the single and batch paths
    - _Requirements: 10.1, 10.2_
  - [x] 10.2 Correct every display and projection consumer
    - `financialReportService.ts`: derive the streaming breakdown from `computeStreamingRevenue()`, replacing the `min(1 + (totalBattles/100) × 0.1, 3.0)` battle multiplier and `min(1 + (totalFame/500) × 0.1, 2.0)` fame multiplier
    - `financialReportService.ts`: present the formula per robot rather than against summed roster battle count and fame, which inflates both multipliers, and label the roster-level figure as an aggregate of per-robot awards
    - `facilityRecommendationService.ts`: use `1 + level` in both the ROI projection and the average-revenue estimate, replacing the `1 + level × 0.1` in the projection branch
    - `unifiedFacilityROIService.ts`: derive the per-battle estimate from `computeStreamingRevenue()` rather than the local `1000 × (1 + level)` approximation
    - Where a path cannot supply per-robot battle count or fame, label the figure as an estimate rather than presenting it as the awarded amount
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7_
  - [x] 10.3 Write streaming parity tests
    - Test asserting the value shown by `getDailyFinancialReport()` for a single robot equals the value awarded by `calculateStreamingRevenue()` for that robot
    - Test asserting `calculateStreamingRevenue()` and `calculateStreamingRevenueBatch()` return identical values for the same robot
    - _Requirements: 10.8, 10.9_
  - [x] 10.4 Document the streaming formula
    - `docs/game-systems/PRD_ECONOMY_SYSTEM.md`: document the Streaming_Revenue_Formula once and note that all display paths derive from it
    - _Requirements: 10.10_

- [ ] 11. Disk alert cadence
  - [ ] 11.1 Identify and remove the duplicate emitter on each host
    - Enumerate cron entries matching `disk-monitor` on `armouredsouls-acc` and on production with `crontab -l | grep disk-monitor`, confirming exactly one remains
    - Confirm `/opt/armouredsouls/scripts/disk-monitor.sh` matches the version in this repository, replacing any stale copy that predates the cooldown
    - Do this before changing the cooldown constant: four of the five alerts per hour come from the ungated emitter, so the constant change alone would reduce five per hour to four
    - Record what was found on each host, since cron is installed by hand per `docs/guides/operations/MONITORING.md` and there is no repository artefact that would have prevented the duplicate
    - _Requirements: 9.4, 9.5_
    - **⚠️ BLOCKED — requires live-host SSH access.** Tasks 11.2–11.6 (script, tests, docs) are complete.
    - **⚠️ THE PREMISE OF THIS TASK WAS WRONG.** Diagnosis on `armouredsouls-acc` found **one** cron entry, not a duplicate. The alerts-per-hour came from a chain: `/var/lib/armouredsouls` never existed so the script silently used `/tmp`; no state file was ever present in either location so the cooldown was inert and every run alerted; the `*/15` interval multiplied that by four; and `source .env` was failing on four lines per run, making `DISK_ALERT_COOLDOWN_SECONDS` unreliable. The code changes in 11.2–11.6 address all of that — only the attribution was wrong.
    - Remaining work is therefore **create the state directory and deploy**, not remove an emitter: `sudo mkdir -p /var/lib/armouredsouls && sudo chown deploy /var/lib/armouredsouls`, deploy the script, change cron `*/15 * * * *` → `0 * * * *`. Verify by running the script twice by hand — the second run must be silent. Full sequence and findings in `VERIFICATION.md` § Remediation sequence.
    - Still confirm `crontab -l | grep -c disk-monitor` is 1 on production, which has not been checked.
  - [x] 11.2 Make the cooldown state write observable
    - Replace `echo "$now" > "$state_file" 2>/dev/null || true` in `should_alert()` with a conditional that logs a warning naming the state file when the write fails
    - Keep returning success so the threshold alert still fires, so that a broken cooldown degrades toward noise rather than toward silence
    - Log which Disk_Alert_State_Directory is in use when the `/var/lib/armouredsouls` check falls back to `/tmp`
    - _Requirements: 9.6, 9.7, 9.12_
  - [x] 11.3 Set the cooldown to two hours and the check interval to hourly
    - Change the `DISK_ALERT_COOLDOWN_SECONDS` default in `app/scripts/disk-monitor.sh` from `3600` to `7200`
    - Change the cron from `*/15 * * * *` to `0 * * * *` on each host and in the script's header comment
    - Record in the header comment why hourly is the right interval: disk growth is driven by the hourly battle and settlement cron jobs, so consumption rises in steps at those boundaries and sub-hourly sampling observes nothing extra
    - Do not lengthen the interval beyond one hour: past that, latency on the first alert grows with no benefit, since the cooldown already caps the rate for every alert after the first
    - Retain the existing cooldown-clearing behaviour when usage drops below a threshold, and the existing WARNING and CRITICAL message formats
    - _Requirements: 9.1, 9.2, 9.3, 9.10, 9.11_
  - [x] 11.4 Bring the script into steering compliance
    - Replace `source /opt/armouredsouls/backend/.env` with the Env_Get_Pattern helper from `app/scripts/backup.sh`, reading `MONITORING_DISCORD_WEBHOOK`, `DISCORD_WEBHOOK_URL`, and `DISK_ALERT_COOLDOWN_SECONDS`
    - Add `set -euo pipefail`, which Spec #29 task 4.1 specified but the shipped script never contained
    - Preserve the existing `|| true` guards on `curl` and `rm` and the terminating `exit 0`, so cron still receives a zero exit status
    - _Requirements: 9.8, 9.9_
  - [x] 11.5 Add the disk monitor test harness
    - Create `app/scripts/__tests__/disk-monitor.test.sh`, prepending a stub directory to `PATH` with a fake `df` reporting a scripted usage percentage, pointing `STATE_DIR` at a temporary directory, and leaving the webhook unset so no network call is made
    - Assert two consecutive invocations above the CRITICAL threshold within the cooldown window emit exactly one alert
    - Assert an invocation after the cooldown window has elapsed emits a second alert
    - Assert an unwritable state directory produces a diagnostic and still emits the threshold alert
    - Assert a drop below the threshold clears the cooldown so the next breach alerts immediately
    - Assert the script exits zero in every case, including with the webhook unset
    - _Requirements: 9.13, 9.14, 9.15, 9.16, 9.17, 9.18_
  - [x] 11.6 Update the monitoring documentation
    - `docs/guides/operations/MONITORING.md` cron section: replace the `*/15 * * * *` install line with `0 * * * *`, state the two-hour Disk_Alert_Cooldown, explain that the hourly interval matches the cadence at which disk consumption changes, and state that only one cron entry may exist
    - `docs/guides/operations/MONITORING.md` troubleshooting section: add a duplicate-cron and stale-copy check using `crontab -l | grep -c disk-monitor` to confirm exactly one
    - Record the stale-emitter finding against the Spec #29 "no deduplication" design decision so it is not reintroduced
    - _Requirements: 9.19, 9.20, 9.21_

- [x] 13. Training Facility roster concentration
  - [x] 13.1 Change the Training_Discount formula in the shared module
    - Rewrite `calculateTrainingFacilityDiscount()` in `app/shared/utils/discounts.ts` to `clamp(level × max(0, 10 - Roster_Capacity), 0, 90)`, taking Roster_Capacity as an explicit second parameter
    - Export `TRAINING_DISCOUNT_BASE_PER_LEVEL`, `TRAINING_DISCOUNT_PER_SLOT`, and `TRAINING_DISCOUNT_MAX` so UI copy reads the same values
    - Add a third `rosterCapacity` parameter to `calculateDiscountedUpgradeCost()` in `upgradeCosts.ts`
    - Clamp the rate at 0 so a roster wider than the discount curve cannot invert into a cost penalty
    - _Requirements: 11.1, 11.3, 11.4, 11.6_
  - [x] 13.2 Move `getRosterCapacity()` into the shared module
    - Create `app/shared/utils/rosterCapacity.ts`; re-export from backend `economyFormulas.ts` so existing merchandising imports are untouched and one definition remains
    - Export both from `app/shared/utils/index.ts`
    - _Requirements: 11.5, 11.10_
  - [x] 13.3 Raise the `training_facility` max level to 10
    - `maxLevel` 9 → 10, add the ₡1,500,000 level 10 cost, extend `prestigeRequirements` with an ungated level 10
    - Rewrite the description and all ten benefit strings to state the roster-dependent rate
    - _Requirements: 11.2_
  - [x] 13.4 Thread Roster_Capacity through the upgrade transaction
    - Add `rosterCapacity` to `validateAndCalculateUpgrades()` and `validateUpgradesFresh()` in `robotUpgradeService.ts`
    - Resolve it from the facilities the orchestration already loads, and **re-read it inside the locked transaction** so a concurrent `roster_expansion` upgrade cannot be charged at a stale discount
    - _Requirements: 11.6, 11.7_
  - [x] 13.5 Report the stable's actual discount from the facilities endpoint
    - Override `currentBenefit` and `nextBenefit` for `training_facility` with the discount computed against the requesting stable's Roster_Capacity, following the existing `repair_bay` dynamic-benefit pattern
    - Where the rate is zero, state that the facility grants no discount at that roster size rather than rendering a bare `0%`
    - Add `rosterCapacity` to the response
    - _Requirements: 11.8, 11.9_
  - [x] 13.6 Thread Roster_Capacity through the frontend cost previews
    - `useRobotDetail` and `usePracticeArena` resolve capacity from the facilities they already fetch and expose it
    - Pass through `RobotDetailPage` → `UpgradePlanner`, `PracticeArenaPage` → `BattleSlotPanel` → `WhatIfPanel`, and into the onboarding `Step4_Upgrades`
    - _Requirements: 11.11_
  - [x] 13.7 Write the Training_Discount tests
    - Property test asserting the discount is non-increasing as Roster_Capacity increases
    - Regression tests for both worked examples: L5 at capacity 4 = 30%, L8 at capacity 2 = 64%
    - Test asserting L10 beats L9 at every capacity earning a non-zero rate, plus a test showing the old formula made them equal
    - Bounds tests: never negative, never above 90, capacity 10 yields 0 at every level
    - Update the existing `discounts`, `sharedFormulas`, and both `robotServices` suites for the new signatures
    - _Requirements: 11.12, 11.13, 11.14_
  - [x] 13.8 Update Training Facility documentation and changelog
    - `docs/game-systems/STABLE_SYSTEM.md`: formula, raised `maxLevel`, per-level rate table, revised strategic guidance
    - `app/backend/src/content/guide/facilities/facility-overview.md` and `robots/upgrade-costs.md`: roster-dependent formula and rate table
    - `docs/prd_pages/PRD_FACILITIES_PAGE.md`: roster-dependent benefit, actual-figure display
    - Draft a `balance` changelog entry
    - _Requirements: 11.15, 11.16, 11.17, 11.18_

- [x] 12. Spec verification
  - [x] 12.1 Run the grep-based verification checks
    - Verification criteria 1, 3, 4, 6, 7, 9, 10, 13, 14, 16, 19, 20, 21, 23, 24 from the requirements document
    - Confirm each returns the stated result; investigate and fix any that does not before marking the spec complete
    - _Requirements: 1.2, 2.1, 2.5, 3.1, 3.19, 4.1, 4.3, 5.1, 5.10, 6.1, 7.1, 8.10, 8.13, 9.1, 9.8_
  - [x] 12.2 Run the full test suite verification
    - Verification criteria 2, 5, 8, 11, 12, 15, 17, 18, 22, 25 from the requirements document
    - Confirm the backend suites pass: `cycleScheduler|tournament`, `economyFormulas|economyCalculations|streamingRevenue|financialReport`, `weaponRefinement`, `records`, `leaderboard`, `facility`, `achievement`
    - Confirm the frontend suites pass: `weapon-refinement`, `hall-of-records`, `Leaderboards`, `BookingOfficePage`
    - Confirm the shell harness passes: `bash app/scripts/__tests__/disk-monitor.test.sh`
    - Verify coverage meets 90% for the combat, economy, and achievement code touched by Requirements 2, 3, 8, and 10, and 80% for the presentation changes in Requirements 4, 5, 6, and 7
    - _Requirements: 1.7, 2.18, 3.14, 4.24, 5.18, 6.23, 7.19, 8.22, 9.14, 10.8_
  - [x] 12.3 Confirm the documentation and changelog deliverables
    - Verify every file named in the design's Documentation Impact table has been updated
    - Verify the four changelog entries are drafted: `balance` for refinements, `feature` for removed records categories, `feature` for win streaks, `bugfix` for achievements
    - Verify `.kiro/specs/done-june26/44-grand-melee/tasks.md` tasks 10.1 and 10.2 are marked complete
    - Verify the duplicate-emitter finding from task 11.1 is recorded against the Spec #29 design decision
    - _Requirements: 1.9, 2.21, 3.22, 4.27, 5.22, 6.26, 7.23, 8.29, 9.19, 10.10_

## Notes

**Deploy timing.** The spec is intended to be applied during a Preparation_Phase once Spec #45 ships, so the balance changes in groups 4 and 6 land at a season boundary rather than mid-season. Before Spec #45 ships, the groups may be applied at any time.

**Player-visible changes on deploy.** Three groups alter something players already paid for or already see, and each carries a changelog task for that reason:

- Group 6 recomputes every existing weapon refinement. Fast one-handed builds lose a little Sharpen value; slow two-handed builds gain substantially.
- Group 7 removes four Hall of Records categories, so players lose visible leaderboard positions.
- Group 9 makes nine achievements obtainable, but a player already holding qualifying win counts will not see the unlock until their next qualifying battle, because evaluation runs on the `battle_complete` event.

**Group 3 is a prerequisite, not a nicety.** The Booking Office implication panel is the reason the operating cost consolidation exists in this spec. Building group 5 without group 3 would display a ₡0 daily operating cost for the Booking Office, since `booking_office` and `tuning_bay` are both absent from the current chain.

**Two investigations, no blocked decisions.** Task 7.8 verifies whether Grand Melee kills are actually recorded before treating the empty section as a missing feature, and task 9.5 audits for achievements unreachable beyond the nine reported. Both produce findings rather than requiring a decision before implementation starts. Anything either turns up is fixed in place or raised separately with a recorded reason.

**Recorded observations that are not tasks.** The cause of ~1-second battle resolutions is noted in task 7.10 but not investigated here, since removing Fastest Victory removes the only surface where it appeared and nothing in this spec depends on the answer. The Team Battle tab's own `fastestVictory` and `longestNonDrawBattle` categories share the structural weaknesses that justify removing the Combat tab equivalents, but Requirement 4 does not scope them, so they remain.
