# Design Document

## Spec: Bug Fixes and Balance Changes

## Overview

This spec is a collection of nine independent items: two balance reworks (Requirements 2 and 3), five defect fixes (Requirements 1, 4, 5, 8, 9), and two feature additions (Requirements 6 and 7). Nothing here introduces a new subsystem, a new database table, or a new API surface. Every change modifies an existing formula, prunes an existing response, or wires an existing but unreachable code path.

Because the items are independent, this design is organised per requirement rather than per architectural layer. Three cross-cutting concerns are handled up front, because they constrain the order in which the work can land.

## Architecture

No new services, routes, tables, or modules. Every change lands in an existing layer:

```
Pure formula layer        economyFormulas.ts (R2, R6), weaponRefinement.ts ×2 (R3)
Shared computation        streamingRevenueService.ts (R10), battlePostCombat.ts (R8)
Query/service layer       recordsQueryService.ts (R4, R7), leaderboardService.ts (R5),
                          achievementService.ts + triggerEvaluator.ts +
                          achievementCatalog.ts (R8), matchHistoryService.ts (R4),
                          financialReportService.ts (R2, R10)
Route layer               facility.ts (R2, R6), leaderboards.ts (R5), finances.ts (R2)
Scheduler                 cycleScheduler.ts (R1, R2)
Config                    facilities.ts (R2), achievements.ts (R8)
Presentation              hall-of-records/* (R4, R7), Leaderboards*Page (R5),
                          BookingOfficePage (R6), weapon-refinement/* (R3)
```

### Cross-cutting concern 1: shared files touched by multiple requirements

Four files are modified by more than one requirement. Each must be edited once with all changes present, not sequentially by separate tasks, or the second edit will conflict with or silently revert the first.

| File | Requirements | Nature of collision |
|------|--------------|---------------------|
| `app/backend/src/utils/economyFormulas.ts` | 2, 6 | R2 changes `calculateMerchandisingIncome()` and `getMerchandisingBaseRate()`; R6 makes `calculateFacilityOperatingCost()` the single source for the facility route. No textual overlap, but both are in the same module. |
| `app/backend/src/services/analytics/leaderboardService.ts` | 2, 5 | R5 deletes the inline `1 + prestige / 10000` expression and `calculateBattleWinningsBonus()`. R2 would otherwise have to update that expression. R5 must land first, or R2 updates code that R5 then deletes. |
| `app/backend/src/services/records/recordsQueryService.ts` | 4, 7 | R4 removes Record_Categories and re-scopes others; R7 adds four Win_Streak_Record categories. Both restructure the same `fetch*Records()` exports. |
| `app/backend/src/routes/facility.ts` | 2, 6 | R2 changes the Merchandising_Prestige_Gate comparison to Prestige_Per_Slot; R6 replaces the Facility_Operating_Cost_Chain. Both are in the `GET /api/facilities` handler. |

**Ordering decision:** Requirement 5 lands before Requirement 2. Requirement 4 lands before Requirement 7. Requirement 6's `economyFormulas.ts` and `facility.ts` work lands with Requirement 2's. All other requirements are order-independent.

### Cross-cutting concern 2: the shared module is a symlink, not a duplicate

`app/backend/src/shared/utils` is a **committed symlink** to `app/shared/utils` — git tracks it with mode `120000` and blob content `../../../shared/utils`. There is exactly one `weaponRefinement.ts`, reachable by two paths.

This was verified rather than assumed: both paths report the same inode, and `git ls-files -s app/backend/src/shared` confirms the symlink is tracked. An earlier draft of this spec asserted two committed copies needing parallel edits; that was wrong and the affected criteria were corrected.

Requirement 3 therefore edits one file. The test in criterion 3.13 asserts that both import paths resolve to the same module and produce identical outputs — its value is catching a future change that replaces the symlink with a real directory, which would silently fork the formula between frontend preview and combat engine. `app/backend/tests/sharedRepairCostParity.test.ts` guards `repairCost` on the same principle.

### Cross-cutting concern 3: no data migrations, no backfills

No requirement in this spec adds, removes, or alters a database column. Specifically:

- **Requirement 2** changes a formula that reads existing columns. Existing `facilities` rows keep their levels (criterion 12 grandfathers over-gated facilities).
- **Requirement 3** changes the Refinement_Fold. `weapon_refinement` stores tier and magnitude, never the computed effect, so every already-refined weapon picks up the new behaviour on deploy with no migration (criterion 11).
- **Requirement 8** performs no achievement backfill (criterion 26), because Spec #45 deletes `user_achievements` at the season boundary.
- **Requirement 4** performs no cleanup of the orphaned battle rows described below, for the same reason.

The only schema-adjacent change is Requirement 8's Grand Melee counter increments, which write to `robots.grand_melee_wins` and `robots.grand_melee_top3` — columns that already exist and are currently always zero.

## Components and Interfaces

New or changed exported signatures. Everything else is an internal edit to an existing function body.

| Component | Signature change | Requirement |
|-----------|------------------|-------------|
| `economyFormulas.ts` | `calculateMerchandisingIncome(level, prestige, rosterCapacity)` — third parameter added | 2 |
| `economyFormulas.ts` | `getRosterCapacity(rosterExpansionLevel): number` — new export | 2 |
| `economyFormulas.ts` | `getMerchandisingBaseRate()` — values doubled, signature unchanged | 2 |
| `weaponRefinement.ts` ×2 | `SHARPEN_COOLDOWN_REDUCTION_PER_INSTANCE`, `FORGE_DAMAGE_INCREASE_PER_INSTANCE` — new exported constants | 3 |
| `weaponRefinement.ts` ×2 | `applyRefinementsToWeapon()` — behaviour change, signature unchanged | 3 |
| `recordsQueryService.ts` | `fetchWinStreakRecords()` — new export | 7 |
| `recordsQueryService.ts` | `fetchCombatRecords()` — `mostDamageInBattle` becomes mode-keyed; `longestBattle` and `fastestVictory` removed | 4 |
| `recordsQueryService.ts` | `fetchUpsetRecords()` — `biggestEloGain` / `biggestEloLoss` removed | 4 |
| `recordsQueryService.ts` | `fetchKothRecords()` — `bestPlacement` removed | 4 |
| `matchHistoryService.ts` | `buildStandardLogResponse()` — `robot1` / `robot2` params widened to nullable | 4 |
| `leaderboardService.ts` | `getFameLeaderboard()` — `league` / `minBattles` params removed | 5 |
| `leaderboardService.ts` | `getPrestigeLeaderboard()` — `minRobots` param removed | 5 |
| `leaderboardService.ts` | `calculateBattleWinningsBonus()` — deleted | 5 |
| `streamingRevenueService.ts` | `computeStreamingRevenue(battles, fame, studioLevel)` — new export | 9 |
| `battlePostCombat.ts` | `updateRobotCombatStats()` — optional `placement` field added to options | 8 |
| achievement services | `resolveTeamModeWins(robotIds): Promise<Map<number, TeamModeWins>>` — new shared helper | 8 |
| `WinStreakRecords.tsx` | New component | 7 |
| `discounts.ts` (shared) | `calculateTrainingFacilityDiscount(level, rosterCapacity)` — second parameter added | 11 |
| `discounts.ts` (shared) | `TRAINING_DISCOUNT_BASE_PER_LEVEL`, `TRAINING_DISCOUNT_PER_SLOT`, `TRAINING_DISCOUNT_MAX` — new exported constants | 11 |
| `upgradeCosts.ts` (shared) | `calculateDiscountedUpgradeCost(currentLevel, trainingLevel, rosterCapacity)` — third parameter added | 11 |
| `rosterCapacity.ts` (shared) | `getRosterCapacity()` moved here from backend `economyFormulas.ts`, which now re-exports it | 11 |
| `robotUpgradeService.ts` | `validateAndCalculateUpgrades()` and `validateUpgradesFresh()` — `rosterCapacity` parameter added | 11 |

## Data Models

No Prisma schema changes. The following TypeScript interfaces change.

| Interface | Change | Requirement |
|-----------|--------|-------------|
| `FacilityConfig` (`config/facilities.ts`) | `prestigeGateIsPerSlot?: boolean` added | 2 |
| `CycleEventPayload` (`src/types/`) | `PASSIVE_INCOME` payload gains `rosterCapacity`, `prestigePerSlot` | 2 |
| `EffectiveWeaponStats` | Unchanged shape; values now rounded to Refinement_Rounding_Precision | 3 |
| `RobotForLog` usage | Parameter type widened to `RobotForLog \| null` at the `buildStandardLogResponse()` boundary | 4 |
| `FameLeaderboardEntry` | `currentLeague` removed | 5 |
| `PrestigeLeaderboardEntry` | `battleWinningsBonus`, `merchandisingMultiplier` removed | 5 |
| `RecordsData` (frontend) | Removed categories dropped; `winStreaks` added; `mostDamageInBattle` re-keyed by mode | 4, 7 |
| `WinStreakEntry` (new) | `entityId`, `entityName`, `stableName`, `bestWinStreak`, `currentWinStreak`, `isActive` | 7 |
| `TeamModeWins` (new) | `league_2v2`, `league_3v3`, `tag_team` win counts | 8 |
| Daily financial report | Merchandising block gains `rosterCapacity`, `prestigePerSlot` | 2 |
| Achievement context | `eloDiff` renamed to `eloChange`; `subjectEloBefore`, `opponentEloBefore`, `placement`, `finalHpPercent` added | 8 |

Existing data is unaffected in every case. `robots.grand_melee_wins` and `robots.grand_melee_top3` begin receiving increments but are not backfilled.

## Correctness Properties

Six invariants that must hold after this spec, expressed as testable properties rather than examples.

### Property 1: Merchandising income is monotonic in roster size

For any fixed `prestige` and Merchandising Hub level, `calculateMerchandisingIncome(level, prestige, capacity)` is non-increasing as `capacity` increases. This is the property that makes the facility reward concentration.

**Validates: Requirements 2.7, 2.18**

### Property 2: Merchandising income doubles at capacity 1

For `rosterCapacity === 1`, income equals exactly twice the pre-change value at the same `prestige` and level, confirming that the base-rate doubling reaches single-robot stables undiluted by the new divisor.

**Validates: Requirements 2.6, 2.20**

### Property 3: Refinement gain is invariant across weapon stats

For a fixed count of Sharpen instances, `effectiveCooldown / weapon.cooldown` is constant across every catalog cooldown, every `attackSpeed` value, and both main and offhand slots. The same holds for `effectiveBaseDamage / weapon.baseDamage` under a fixed count of Forge instances. This is the property the flat bonuses violated.

**Validates: Requirements 3.7, 3.8, 3.9, 3.14**

### Property 4: Operating cost has a single source

For every entry in `FACILITY_TYPES` except `roster_expansion`, the `currentOperatingCost` in the `GET /api/facilities` response equals `calculateFacilityOperatingCost(type, currentLevel)`.

**Validates: Requirements 6.1, 6.4**

### Property 5: Every achievement trigger is registered

Every `triggerType` referenced by an entry in `ACHIEVEMENTS` appears in at least one `EVENT_TRIGGER_MAP` event array and is handled by a non-default branch of `evaluateTrigger()`. Every entry with `progressType: 'numeric'` additionally appears in the Achievement_Progress_Resolver.

**Validates: Requirements 8.22, 8.23**

### Property 6: Retained record categories are not structurally tied

For every retained Record_Category, seeded data with distinct underlying values produces distinct ranked values. A category whose ranking metric is capped, quantised, or otherwise degenerate fails this property.

**Validates: Requirements 4.24**

## Error Handling

| Path | Current behaviour | Designed behaviour |
|------|-------------------|--------------------|
| Battle detail with unresolvable second participant | `TypeError` on `battleData.robot2.id`, forwarded by Express 5 as a 500, frontend shows error state | `robot1` / `robot2` emitted as `null`; response renders from `participants` and `battle_summaries`; `playbackAvailable` already reports the missing log (R4) |
| Booking Office upgrade rejection | N/A — no control exists | Error message from the Facility_Upgrade_Endpoint surfaced on the page; displayed level and balance unchanged; control re-enabled (R6) |
| Booking Office double submit | N/A | Control disabled while the request is in flight (R6) |
| Merchandising income with no `roster_expansion` row | N/A — new parameter | `getRosterCapacity(0)` returns 1, so income matches a single-robot stable rather than dividing by zero (R2) |
| Achievement evaluation with no team membership | Resolves `undefined`, coerced to 0 by `?? 0` — masks the Cause A defect | `resolveTeamModeWins()` returns 0 explicitly for absent memberships, which is correct rather than accidental (R8) |
| Record_Category with no qualifying rows | Empty heading rendered | Section omitted (R4 criterion 22, R7 criterion 13) |

Requirement 2's audit payload extension follows the existing convention that a failed audit write never fails the settlement, and the Booking Office refetch failure after a successful upgrade surfaces as a stale-data notice rather than implying the upgrade failed.

---

## Requirement 1: Tournament Creation Timing Alignment

### Current behaviour

`executeTournamentCycle()` in `cycleScheduler.ts` reaches its Tournament_Auto_Creation step on every run. `executeTeam2v2TournamentCycle()` and `executeTeam3v3TournamentCycle()` `return` from inside their `if (activeTournament)` branch, so a run that processes a round never reaches auto-creation.

### Design

Restructure both team handlers to match the 1v1 handler's control flow: process the round if a tournament is active, then fall through to the auto-creation attempt unconditionally. The `if (activeTournament)` branch loses its `return`.

`autoCreateNextTeamTournament(size)` already guards against creating a second tournament when one is active, and already logs a shortfall when the eligible participant count is below the minimum bracket size. No change is required inside it — criteria 3 and 4 are satisfied by the existing guard once the call is reachable.

The handlers continue to build and return the same `JobContext` object (criterion 6). The auto-creation attempt is added to the existing context accumulation, not to a new return shape.

### Season phase gate

Criterion 8 requires auto-creation to be skipped during a `preparation` Season_Phase. Spec #45 has not shipped, so this design specifies the seam rather than the implementation: the auto-creation call site checks a `Season_Phase` accessor if one is available and skips when the phase is `preparation`. Until Spec #45 lands, the accessor does not exist and the check is a no-op. This is recorded as a task with an explicit dependency note rather than a speculative import.

### Traceability

| Criteria | Design element |
|----------|----------------|
| 1, 2, 5 | Control-flow restructure of both team tournament handlers |
| 3, 4 | Existing guards inside `autoCreateNextTeamTournament()`, now reachable |
| 6 | `JobContext` shape preserved |
| 7 | Per-participant-type cadence tests |
| 8 | Season_Phase seam at the auto-creation call site |
| 9 | `docs/game-systems/PRD_TOURNAMENT_SYSTEM.md` update |

---

## Requirement 2: Merchandising Hub Rewards Roster Concentration

### Formula changes

Two pure functions in `app/backend/src/utils/economyFormulas.ts`:

```ts
// Base rate doubled: ₡10,000 per level (was ₡5,000)
export function getMerchandisingBaseRate(merchandisingHubLevel: number): number

// Roster_Capacity becomes an explicit parameter — the module stays side-effect-free
export function calculateMerchandisingIncome(
  merchandisingHubLevel: number,
  prestige: number,
  rosterCapacity: number,
): number
```

The Merch_Multiplier becomes `1 + (prestige / rosterCapacity) / 10000`. Criterion 2 requires Roster_Capacity to arrive as a parameter rather than being queried, preserving the file's no-database contract.

A shared helper derives Roster_Capacity from a facility level so that no call site reimplements the `level + 1` rule:

```ts
export function getRosterCapacity(rosterExpansionLevel: number): number  // level + 1, minimum 1
```

This mirrors the existing `maxRobots = rosterLevel + 1` in `robotCreationService.ts`. Criterion 3 forbids deriving capacity from a live `robots` count; criterion 4 makes a missing or level-0 facility resolve to 1, which `getRosterCapacity(0)` returns.

### Call sites that must supply Roster_Capacity

| Call site | How capacity is resolved |
|-----------|--------------------------|
| `cycleScheduler.ts` Settlement_Job | From `facilitiesByUser`, the map the job already batch-loads. No new query (criterion 8). |
| `economyCalculations.ts` `calculateDailyPassiveIncome()` | Add a `roster_expansion` lookup to the existing facility query |
| `financialReportService.ts` `getDailyFinancialReport()` | Already loads facilities; extend the existing `Promise.all` |
| `adminCycleService.ts` daily-finances branch | Already loads all facilities per user |
| `unifiedFacilityROIService.ts` | Reads historical `merchandisingIncome` from snapshots, not the formula. No change. |

### Prestige gate re-basing

The `merchandising_hub` entry in `src/config/facilities.ts` changes its `prestigeRequirements` from `[0,0,0,3000,0,0,7500,0,15000,0]` to `[0,0,0,2000,0,0,5000,0,9000,0]` (criterion 10). The semantics change with the values: these are now Prestige_Per_Slot thresholds, not raw prestige.

That semantic shift needs care, because `prestigeRequirements` is a shared field read by a generic comparison in both `GET /api/facilities` and the Facility_Upgrade_Endpoint, and every other facility's gates remain raw-prestige. The design keeps the array shape and adds an explicit per-facility flag rather than special-casing `merchandising_hub` by string comparison at each site:

```ts
interface FacilityConfig {
  // ...
  prestigeRequirements?: number[];
  /** When true, prestigeRequirements are compared against Prestige_Per_Slot, not raw prestige. */
  prestigeGateIsPerSlot?: boolean;
}
```

Both the list handler and the upgrade handler read this flag to choose the comparison value (criterion 11). Criterion 12 is satisfied by construction: the gate is evaluated only on the upgrade path, so an already-owned level is never re-checked and no downgrade path exists.

### Display

`getDailyFinancialReport()` gains `rosterCapacity` and `prestigePerSlot` fields alongside the existing merchandising formula string (criterion 16), and the formula string is rebuilt to show the per-slot division. `src/routes/finances.ts` drops the stale `currency >= 800000 && prestige >= 1000` heuristic in favour of the facility's actual level-1 cost from `getFacilityUpgradeCost('merchandising_hub', 0)` (criterion 17).

### Audit payload

The `PASSIVE_INCOME` event payload gains `rosterCapacity` and `prestigePerSlot` (criterion 9). `CycleEventPayload` in `src/types/` is extended accordingly; `cycleSnapshotService.ts` continues to read only `merchandising`, so no snapshot change is required.

### Payback arithmetic

Net daily income is `level × (10000 × multiplier − 200)` and cumulative cost is `75000 × level × (level + 1)`, so payback is `75000 × (level + 1) / (10000 × multiplier − 200)`. At a Prestige_Per_Slot of zero this is 15 cycles at L1 and 84 at L10 — all under 100 (criterion 13). The unit test asserts this for every level rather than only the extremes.

### Traceability

| Criteria | Design element |
|----------|----------------|
| 1, 2, 5, 6 | `calculateMerchandisingIncome()` and `getMerchandisingBaseRate()` changes |
| 3, 4 | `getRosterCapacity()` helper |
| 7 | Monotonicity property test |
| 8 | Settlement_Job resolves capacity from its existing batch load |
| 9 | `PASSIVE_INCOME` payload extension |
| 10, 11, 12 | `prestigeGateIsPerSlot` flag and gate re-basing |
| 13 | Per-level payback unit test |
| 14, 15 | `facilities.ts` benefit and description strings |
| 16 | `getDailyFinancialReport()` fields |
| 17 | `finances.ts` recommendation gate |
| 18, 19, 20 | Property test, payback test, doubling regression test |
| 21, 22 | `PRD_ECONOMY_SYSTEM.md` and `project-overview.md` updates |

---

## Requirement 3: Proportional Sharpen and Forge Refinements

### The fold

`applyRefinementsToWeapon()` currently mutates accumulators inside the refinement loop:

```ts
if (r.tier === 'forge')   { effectiveBaseDamage += 1.0; continue; }
if (r.tier === 'sharpen') { effectiveCooldown  -= 0.25; continue; }
```

The proportional version cannot accumulate inside the loop, because additive-percentage stacking must multiply the *catalog* value by a factor derived from the instance count. The loop becomes a counting pass, and the multipliers are applied once afterwards:

```ts
let sharpenCount = 0;
let forgeCount = 0;
// loop: count sharpen/forge, apply hone/augment to effectiveAttributeBonuses as today

const effectiveCooldown = roundTo2(
  weapon.cooldown * (1 - SHARPEN_COOLDOWN_REDUCTION_PER_INSTANCE * sharpenCount)
);
const effectiveBaseDamage = roundTo2(
  weapon.baseDamage * (1 + FORGE_DAMAGE_INCREASE_PER_INSTANCE * forgeCount)
);
```

with named constants `SHARPEN_COOLDOWN_REDUCTION_PER_INSTANCE = 0.10` and `FORGE_DAMAGE_INCREASE_PER_INSTANCE = 0.08`, exported so tests and UI copy read the same values rather than hardcoding percentages.

Additive-on-catalog rather than compounding (criterion 3) makes two instances land on exactly `× 0.80` and `× 1.16`. Compounding would give `0.81` and `1.1664`, which contradicts the advertised cap. Additive also matches how every other stacking discount in the codebase works — Workshop, Training Facility, Repair Bay are all `n × level`.

`roundTo2` is a local helper in the same module, not an import, because the module is consumed by the frontend and must stay dependency-free. It is applied to both outputs (criterion 4) so the frontend preview and the engine cannot diverge through float representation.

### Why the multiplier position matters

`prepareRobotForCombat()` writes Effective_Cooldown onto `weapon.cooldown`, and `calcCooldown()` then computes:

```ts
baseCooldown * (hand === 'offhand' ? 1.4 : 1) / (1 + attackSpeed / 50)
```

Because the Sharpen multiplier lands on the catalog cooldown *before* both the offhand penalty and the `attackSpeed` divisor, the proportional gain is invariant across every weapon, every `attackSpeed` value, and both hands (criterion 9). This is the property the flat `−0.25s` lacked and is what the property test asserts.

Criterion 10 — Effective_Cooldown remains strictly positive — holds by construction: the maximum reduction is `1 − 0.10 × 2 = 0.80`, so a positive catalog cooldown cannot reach zero. This retires the unfloored-subtraction hazard recorded as key decision #7 in the Spec #34 design.

### Tier differentiation

`applyDamage()` applies every mitigation step as a multiplier — crit, dampeners, formation, armour, penetration — so proportional damage and proportional attack rate are equivalent in expected DPS. The 10% versus 8% split is therefore a deliberate design choice, not a mechanical one: Forge accepts a lower ceiling (+16% versus +25% at cap) in exchange for being the deeper unlock (Workshop L8 versus L5) and the better option against shield-regen builds, since `shieldDamage = min(damage, currentShield)` and bigger hits strip a regenerating shield in fewer swings. Sharpen is correspondingly better against very high armour, where `hpDamage = Math.max(1, …)` floors each hit and hit count dominates.

### Display

Six sites hardcode the flat values and must state percentages instead (criteria 19, 20):

| File | What changes |
|------|--------------|
| `RefinementModal.tsx` | `TIER_BLURB` entries for both tiers, plus the inline Sharpen and Forge explanation paragraphs |
| `SlotBar.tsx` | Slot label strings in the tier `switch` |
| `RefinementHistoryPopover.tsx` | Per-row effect strings |
| `RefinementAdoptionPage.tsx` | Admin `TIER_DESC` map |
| `app/shared/utils/weaponRefinement.ts` | Header docblock tier list (one file; the backend path is a symlink) |

Copy states the per-instance percentage and the cap value; the concrete before-and-after figures belong in the modal's existing live stat preview, which already computes projected stats from a candidate refinement row (criterion 21).

Rendering rule (criterion 17): trailing zeros trimmed, so a folded `1.60` displays as `1.6` while `3.15` displays as `3.15`. The 3.5s Plasma Lance is the only catalog weapon producing two decimals at one Sharpen instance, and criterion 16 pins it at `3.15` specifically to stop an implementer rounding the fold to one decimal.

Criterion 18 constrains DPS previews: because `SIMULATION_TICK` is 0.1 and the loop fires on the first tick at or past the cooldown, Observable_Cadence is `ceil(cooldown / 0.1) × 0.1`. A preview computed from a raw 3.15 disagrees with the interval players count in the battle log, so such figures are either derived from Observable_Cadence or labelled approximate.

### Traceability

| Criteria | Design element |
|----------|----------------|
| 1, 2, 3 | Counting-pass fold with additive-on-catalog multipliers |
| 4 | `roundTo2` on both outputs |
| 5, 6 | Existing per-tier caps and cost formulas unchanged |
| 7, 8, 9 | Multiplier position before offhand penalty and `attackSpeed` divisor; property test |
| 10 | Positive-by-construction bound |
| 11 | No migration — `weapon_refinement` stores tier and magnitude only |
| 12, 13 | Single file edited via the symlinked path; import-identity test |
| 14, 15, 16 | Property test, cap regression tests, 3.15 precision test |
| 17, 18 | Trailing-zero trim rule; Observable_Cadence constraint on DPS previews |
| 19, 20, 21 | Six copy sites; modal live preview |
| 22, 23, 24 | `PRD_WEAPON_ECONOMY.md` v1.7 section and tier table; `ADMIN_PANEL_GUIDE.md` check |
| 25 | Changelog entry |

---

## Requirement 4: Hall of Records Shows Meaningful Records

### Category disposition

| Record_Category | Disposition | Reason |
|-----------------|-------------|--------|
| Longest Battle (Combat) | Remove | `MAX_BATTLE_DURATION` caps every long battle at 120s |
| Fastest Victory (Combat) | Remove | Ranking occupied by ~1s degenerate battles |
| Most Damage in Single Battle (Combat) | Retain, convert to Mode_Scoped_Record | Grand Melee and team damage ranges dwarf 1v1 |
| Narrowest Victory (Combat) | Retain unchanged | Not reported as degenerate |
| Biggest Upset (Upset) | Retain, restrict to tournament types | League matchmaking pairs comparable robots |
| Biggest ELO Gain (Upset) | Remove | Fixed `ELO_K_FACTOR` of 32 makes every entry ±32 |
| Biggest ELO Loss (Upset) | Remove | Same |
| Best Placement (KotH) | Remove | Any winner ties at 1 |
| Zone Dominator (KotH) | Retain, round to Zone_Metric_Precision | Raw float renders as `1642.7000000000005` |
| Most Zone Time (KotH) | Retain, round to Zone_Metric_Precision | Same class of defect |

Criterion 2 permits but does not require a Longest Battle replacement. This design does not add one: any duration-derived metric inherits the same cap, and a non-duration "endurance" metric would need a new computation over `battle_summaries`. The removal stands alone and a replacement is left to a future spec.

### Mode-scoped Most Damage

`fetchCombatRecords()` currently filters `battleType: { in: ['league_1v1', 'tournament_1v1'] }` for its damage query. The Mode_Scoped_Record version returns an object keyed by battle type, following the shape `fetchTeamBattleRecords()` already uses for `'2v2'` / `'3v3'`:

```ts
mostDamageInBattle: {
  league_1v1: MostDamageEntry[];
  tournament_1v1: MostDamageEntry[];
  league_2v2: MostDamageEntry[];
  league_3v3: MostDamageEntry[];
  koth: MostDamageEntry[];
  grand_melee: MostDamageEntry[];
}
```

The opponent field is dropped for multi-participant modes, where "the opponent" is not well defined.

### Upset restriction and team ELO

Biggest Upset keeps its raw SQL shape but changes its `battle_type` predicate to the tournament types. For team tournament types the ELO differential is the difference of summed team `elo_before`, consistent with how `calculateTeamBattleELOChanges()` derives team ratings (criterion 7). That requires a `GROUP BY battle_id, team` aggregation rather than the current self-join on two participant rows, so the team-mode upset query is a separate statement from the 1v1 one.

### Zone metric rounding

Rounding happens in `recordsQueryService.ts`, not in `KothRecords.tsx` (criterion 12), so the API ships display-ready values and any future consumer inherits the rounding. `Math.round(value * 10) / 10` on `totalZoneScore` and `totalZoneTime`.

### Career tab mode coverage

Criterion 13 requires each Career Record_Category to state which modes it covers, and criterion 14 requires a recorded decision on whether to widen Career_Battle_Counters.

**Decision: label the existing scope; do not widen the counters.** Both the KotH and Grand Melee orchestrators pass `skipBattleCounters: true` deliberately, because those modes resolve by placement rather than win/loss and a "win" is not defined for placements 2 through N. Widening `totalBattles` and `wins` to include them would corrupt the win-rate denominator that Highest Win Rate ranks on, and would change `robots.wins` semantics for every other consumer. Instead:

- Most Battles and Highest Win Rate are labelled as covering 1v1, tournament, tag team, and team league
- Most Lifetime Damage is labelled as covering all modes, since `damageDealtLifetime` is incremented regardless of the flag
- Most Kills and Highest ELO keep their current scope with labels

Criterion 15 therefore does not apply, and is recorded as not-applicable rather than silently skipped.

### Battle detail error — confirmed root cause

Criterion 19 requires the root cause to be identified before a fix. It has been, so this design records it rather than deferring to a reproduction task.

`getBattleLog()` in `matchHistoryService.ts` derives the legacy response pair:

```ts
robot1: robot1Participant?.robot ?? null,
robot2: robot2Participant?.robot ?? null,
```

and passes the object to `buildStandardLogResponse()`, whose signature declares `battleData: { robot1: RobotForLog; robot2: RobotForLog }` — non-nullable — and whose body dereferences `battleData.robot2.id` on its first statement. When `robot2` is `null` this throws a `TypeError`, Express 5 forwards it, the endpoint 500s, and `BattleDetailPage` renders its error state.

`robot2` is null when a battle has fewer than two resolvable participants. The `battles` table originally had `robot1_id` and `robot2_id` as `NOT NULL` with FK constraints; migration `20260627120000_drop_battle_robot_fk_columns` dropped them in favour of `battle_participants`. The derivation replaced a database guarantee, but `buildStandardLogResponse()` was never updated to cope with its absence. The `koth` / `grand_melee` and `tag_team` branches both guard; only the `else` branch — every 1v1, tournament, and team league battle — does not.

The single-participant rows themselves originate from migration `20260611120000_drop_legacy_scheduling_tables`, which removed the persistent Bye Robot by deleting `battle_participants` rows keyed on `robot_id` and then deleting `battles` rows keyed on `robot1_id` / `robot2_id`. Two different keys, so battles whose columns did not name the Bye Robot kept their row and lost a participant.

**Fix:** widen the parameter type to `RobotForLog | null` and guard both blocks, emitting `robot1` / `robot2` as `null` when the participant is unresolvable. `BattleDetailPage` already guards these fields with optional chaining, so no frontend change is required. The `participants` array — which is populated from `battle_participants` directly and is correct for any participant count — remains the response's authoritative shape.

**No data remediation.** Spec #45 deletes the entire battle history at the season boundary, so the orphaned rows disappear without a cleanup task. The code guard is still required, because the null-deref sits on the main battle detail path and any future partial delete re-triggers it.

Criterion 20 is satisfied by the existing `playbackAvailable: battleData.battleLog !== null` flag and the separately loaded `battle_summaries` row — that behaviour is already correct and is covered by a new test rather than new code.

### Fastest Victory removal

Both duration-ranked Combat categories are removed. Longest Battle is capped by `MAX_BATTLE_DURATION`; Fastest Victory is dominated by the ~1-second tail. Neither is repairable by filtering — a floor on Fastest Victory would need a threshold justified by understanding the 1-second battles, and the resulting category would rank a narrow band of near-identical durations.

This leaves the Combat tab with two categories: Narrowest Victory and the per-mode Most Damage. That is a thinner tab than before, which is the correct outcome — the removed categories were not records.

Criterion 4 keeps the underlying question open rather than closing it: removing the category also removes the only surface where ~1-second battles were visible. A battle resolving in one simulation second may indicate a combat defect, so the observation is recorded as an item for separate investigation with no dependency on this spec. It is not an implementation task here, because nothing in this spec's scope depends on the answer.

**Note on the Team Battle tab.** `fetchTeamBattleRecordsForSize()` has its own `fastestVictory` and `longestNonDrawBattle` categories with the same structural exposure — the same 120s cap and the same potential degenerate tail. Requirement 4 as written scopes only the Combat tab, so those are left in place. Whether to apply the same removal there is deferred rather than decided.

### Traceability

| Criteria | Design element |
|----------|----------------|
| 1, 2 | Longest Battle removal; no replacement, with reason |
| 3, 4 | Fastest Victory removal; 1-second observation recorded, not closed |
| 5 | Mode_Scoped_Record shape for Most Damage |
| 6, 7 | Upset restriction to tournament types; summed team ELO query |
| 8 | ELO gain/loss category removal |
| 9 | Best Placement removal |
| 10, 11, 12 | Zone metric rounding in the service |
| 13, 14 | Career mode labels; recorded decision not to widen counters |
| 15 | Not applicable — follows from the criterion 14 decision |
| 16, 17 | Grand Melee kills verification (see Requirement 8, Cause C) and per-match display |
| 18, 19, 20 | `buildStandardLogResponse()` null guard; root cause recorded above |
| 21, 22 | Response and `RecordsData` field removal; empty-section omission |
| 23 | Mobile layout per `.kiro/steering/frontend-standards.md` |
| 24, 25, 26 | Distinct-values test, NULL `battle_log` test, zone precision test |
| 27, 28 | `docs/prd_pages/` update; changelog entry |

---

## Requirement 5: Leaderboard Filter and Column Cleanup

### Removals

| Layer | Fame_Leaderboard | Prestige_Leaderboard |
|-------|------------------|----------------------|
| Zod schema (`leaderboards.ts`) | `league`, `minBattles` | `minRobots` |
| Leaderboard_Cache_Key | Both fragments | `minRobots` fragment |
| Service params | `league`, `minBattles` | `minRobots` |
| SQL | `WHERE total_battles >= …`, `AND s.tier = …` | `HAVING COUNT(r.id) >= …` |
| Response `filters` | Both keys | `minRobots` key |
| Entry interface | `currentLeague` | `battleWinningsBonus`, `merchandisingMultiplier` |
| Page | League Filter select, minimum-battles select, League column, mobile League row | Bonus table cell, mobile bonus row |

### The `LEFT JOIN` decision

Criterion 4 asks whether the `standings` join survives. After `currentLeague` is removed, the Fame_Leaderboard projects nothing from `standings`, so the join is dropped entirely. This also removes the join's incidental effect of excluding robots without a `league_1v1` standing under a tier filter.

### Cache key reconstruction

Criterion 15 requires the Leaderboard_Cache_Key be rebuilt from only surviving parameters. The fame key becomes `fame:${page}:${limit}` and the prestige key `prestige:${page}:${limit}`. A stale key fragment referencing a removed filter would fragment the cache and could serve a filtered payload to an unfiltered request.

Criterion 16 is satisfied without code: Zod's default `.strip()` removes unknown fields, so a bookmarked URL carrying `?minBattles=10` is ignored rather than rejected. This is asserted by test rather than implemented.

### Helper cleanup

`calculateBattleWinningsBonus()` loses its only consumer and is deleted, along with the `getPrestigeMultiplier` import if unused (criterion 12). The inline `1 + prestige / 10000` expression goes with the column (criterion 13) — this is the third copy of the merchandising multiplier, and deleting it removes a site Requirement 2 would otherwise have to update. **This is why Requirement 5 lands before Requirement 2.**

`totalRobots` is retained on `PrestigeLeaderboardEntry` as identifying context (criterion 14) even though the filter that used it is gone.

### Traceability

| Criteria | Design element |
|----------|----------------|
| 1, 2, 3 | Fame filter removal across five layers |
| 4 | `standings` join dropped |
| 5, 6, 7 | `currentLeague` removal; filter controls and hooks; empty filter bar removed |
| 8, 9 | `minRobots` removal; unfiltered prestige ranking |
| 10, 11 | Bonus cell removal from both layouts |
| 12, 13 | `calculateBattleWinningsBonus()` and inline multiplier deletion |
| 14 | `totalRobots` retained |
| 15 | Cache key reconstruction |
| 16 | Zod `.strip()` behaviour, asserted by test |
| 17 | Mobile card layouts updated alongside desktop tables |
| 18, 19, 20, 21 | Visibility tests; ignored-parameter test; existing test updates |
| 22, 23 | `docs/prd_pages/` update; prestige roster-scaling note |

---

## Requirement 6: Booking Office Upgrade From the Booking Office Page

### Backend: operating cost consolidation

The Facility_Operating_Cost_Chain in the `GET /api/facilities` handler is replaced by:

```ts
const currentOperatingCost = config.type === 'roster_expansion'
  ? Math.max(0, robotCount - 1) * 500
  : calculateFacilityOperatingCost(config.type, currentLevel);

const nextOperatingCost = config.type === 'roster_expansion'
  ? robotCount * 500
  : calculateFacilityOperatingCost(config.type, nextLevel);
```

`roster_expansion` keeps its special case because its cost is charged per filled robot slot rather than per facility level — `economyFormulas.ts` already returns 0 for it with an explanatory comment (criterion 2). Every other type routes through the shared formula, which fixes `booking_office` at ₡150/level and `tuning_bay` at ₡300/level (criteria 1, 3).

The parity test walks every entry in `FACILITY_TYPES` and asserts the response value equals `calculateFacilityOperatingCost(type, currentLevel)`, skipping only `roster_expansion` (criterion 4). This is the guard that stops the next facility being omitted the same way.

### Frontend: data source

`BookingOfficePage.tsx` currently reads `bookingOfficeLevel` from `useStableOverview()`. That hook does not carry cost, prestige requirement, or affordability, so the page adds a `GET /api/facilities` fetch and selects the `booking_office` entry (criterion 14). The endpoint already returns `upgradeCost`, `nextLevelPrestigeRequired`, `hasPrestige`, `canAfford`, `canUpgrade`, `currentOperatingCost`, `nextOperatingCost`, `userPrestige`, and `userCurrency` — every figure the Upgrade_Implication_Panel needs, with nothing recomputed client-side.

### Upgrade_Implication_Panel

Contents (criteria 7, 8, 9): credit cost of the next level, resulting Subscription_Cap expressed as `3 + nextLevel` subscriptions per robot, resulting daily operating cost, current credit balance, and — where the next level is gated — required and current prestige.

The effect is stated as the cap, never as a bare level number, because the level is meaningful to the player only through the cap.

### Disabled-state matrix

| Condition | Control state | Stated reason |
|-----------|---------------|---------------|
| `!canAfford && !hasPrestige` | Disabled | Both credits and prestige (criterion 12) |
| `!canAfford` | Disabled | Credits (criterion 11) |
| `!hasPrestige` | Disabled | Prestige (criterion 10) |
| `!canUpgrade` (level 10) | Replaced by max-level indicator, panel omitted (criterion 13) | — |
| Request in flight | Disabled (criterion 18) | — |

Criterion 20 requires the disabled reason be announced to assistive technology, not conveyed by colour: the reason renders as text associated with the control via `aria-describedby`, and the control carries an accessible name identifying both action and facility.

### Mutation path

The control calls the existing Facility_Upgrade_Endpoint with `{ facilityType: 'booking_office' }` (criterion 6). No new endpoint, so the endpoint's `lockUserForSpending` transaction, prestige validation, and max-level validation are inherited unchanged — which also means the client-side disabled states are a usability affordance, not the security boundary.

On success the page refetches both the facilities data and the SubscriptionMatrix data so the new slots become usable without a reload (criteria 15, 16). On failure the error message from the endpoint surfaces and the displayed level and balance are untouched (criterion 17).

Criterion 19 holds by construction: raising the Subscription_Cap is purely additive, so no existing subscription can be invalidated and there is no over-cap state to reconcile.

### Mobile

The Upgrade_Implication_Panel stacks its figures vertically below 1024px rather than rendering a horizontal row (criterion 22), following the responsive pattern in `.kiro/steering/frontend-standards.md`. The upgrade control carries a minimum 44px touch target (criterion 21).

### Traceability

| Criteria | Design element |
|----------|----------------|
| 1, 2, 3, 4 | Operating cost consolidation and parity test |
| 5, 6 | Upgrade control on existing endpoint |
| 7, 8, 9 | Upgrade_Implication_Panel contents |
| 10, 11, 12, 13, 18 | Disabled-state matrix |
| 14 | `GET /api/facilities` as the data source |
| 15, 16, 17 | Refetch on success; error handling |
| 19 | Additive-cap invariant |
| 20, 21, 22 | Accessibility and mobile layout |
| 23, 24, 25 | Disabled-state tests, cap refresh test, non-zero operating cost test |
| 26, 27 | `docs/prd_pages/` and `docs/game-systems/` updates |

---

## Requirement 7: League Win Streak Records

### Query design

One new export in `recordsQueryService.ts`:

```ts
export async function fetchWinStreakRecords(): Promise<{
  league_1v1: WinStreakEntry[];
  league_2v2: WinStreakEntry[];
  league_3v3: WinStreakEntry[];
  tag_team: WinStreakEntry[];
}>
```

Each mode is one `standings` query filtered on `mode` and `bestWinStreak: { gt: 0 }` (criterion 5), ordered by `bestWinStreak` descending with `entityId` ascending as the deterministic tiebreak (criterion 6). No recomputation from battle history (criterion 2) — `best_win_streak` is a maintained counter and `battle_log` is subject to retention.

Entity resolution follows the existing `robotMap` pattern in `fetchKothRecords()` (criterion 16): collect all `entityId` values across the four result sets, then one `robot.findMany` for `league_1v1` and one `teamBattle.findMany` for the three team modes, each including the owning stable. Two batch queries total, no N+1.

`WinStreakEntry` carries `bestWinStreak`, `currentWinStreak`, the entity name, the owning stable name, and an `isActive` boolean set when `currentWinStreak === bestWinStreak` (criteria 7, 8).

### Tournament and Grand Melee scoping

Tournament modes are excluded because no tournament orchestrator calls `recordBattleResult()`, so their streak columns are permanently zero (criterion 9). A category there would always render empty.

**Grand Melee decision (criterion 10): excluded.** `awardGrandMeleePoints()` does maintain streak columns and Grand Melee does run a full tier system, but a Grand Melee "win" is placement 1 of 20, so a streak of consecutive first places is a categorically harder achievement than a streak of 1v1 wins and would rank near zero for every player. Presenting it beside the league streaks would invite a comparison that is not meaningful. The decision is recorded here rather than left implicit, and the mode remains a candidate for a Grand Melee–specific streak category in a future spec.

### Placement

Criterion 15 requires the four modes be grouped in one location rather than scattered across the existing per-mode tabs. A new `WinStreakRecords` component renders all four side by side, added as its own Hall_Of_Records section. The trade-off is that the Team Battle tab does not own its own streaks; the benefit is cross-mode comparison, which is the point of a streak board.

Criterion 14 — no battle links — falls out naturally: a streak spans multiple battles and no single `battleId` represents it, so `RecordCard` is rendered without its `onClick` prop.

### Traceability

| Criteria | Design element |
|----------|----------------|
| 1, 2 | `fetchWinStreakRecords()` reading `best_win_streak` |
| 3, 4 | Per-mode entity resolution, robot versus `TeamBattle` |
| 5, 6 | Zero exclusion; deterministic ordering |
| 7, 8 | `currentWinStreak` and `isActive` on the entry |
| 9, 10 | Tournament exclusion; recorded Grand Melee exclusion |
| 11, 12 | Bye-win caveat documented and accepted |
| 13 | Empty-section omission |
| 14 | No `onClick` on the record cards |
| 15 | Single grouped `WinStreakRecords` component |
| 16 | Batch entity resolution |
| 17 | `RecordsData` extension |
| 18 | Mobile layout |
| 19, 20, 21, 22 | Per-mode presence, team name resolution, zero exclusion, tournament absence tests |
| 23, 24 | `docs/prd_pages/` update; changelog entry |

---

## Requirement 8: Unreachable Achievements

Three independent causes, each with its own design.

### Cause A — entity scope mismatch (L16, L19, L21)

`achievementService.ts` builds its cached robot by reading Robot_Scoped_Standing rows:

```ts
totalTagTeamWins:    robotStandings.find(s => s.mode === 'tag_team')?.wins ?? 0,
totalLeague2v2Wins:  robotStandings.find(s => s.mode === 'league_2v2')?.wins ?? 0,
totalLeague3v3Wins:  robotStandings.find(s => s.mode === 'league_3v3')?.wins ?? 0,
```

Those three modes only ever write Team_Scoped_Standing rows, so all three resolve to zero. `achievementCatalog.ts` repeats the same mistake for progress display.

**Resolution.** A shared helper resolves a robot's team-mode win counts through its team memberships:

```ts
// Returns { league_2v2, league_3v3, tag_team } win counts for one robot
async function resolveTeamModeWins(robotIds: number[]): Promise<Map<number, TeamModeWins>>
```

Two queries: `teamBattleMember.findMany({ where: { robotId: { in: robotIds } }, select: { robotId, teamId, team: { select: { teamSize } } } })`, then `standing.findMany({ where: { entityType: 'team', entityId: { in: teamIds } } })`. The batch signature serves both the single-robot evaluation path and the all-robots progress path without an N+1.

Mapping is unambiguous because a robot belongs to at most one team per team size, enforced by the `TEAM_MEMBER_CONFLICT` check in `createTeam()` under `pg_advisory_xact_lock(2, robotId)` (criterion 2). Note that this is an application-level invariant — `TeamBattleMember`'s unique indexes are `[teamId, slotIndex]` and `[teamId, robotId]`, both team-scoped, so nothing in the schema would prevent a second membership. The design depends on that check and the criterion names it so the dependency is traceable.

A 2v2 team holds both a `league_2v2` and a `tag_team` standing row, since Tag Team is a combat mode on the same `TeamBattle` rather than a separate entity. So a size-2 membership yields two of the three counts and a size-3 membership yields the third.

A robot with no membership in a given size resolves to zero rather than raising (criterion 3), because the evaluator runs on every `battle_complete` for every participant, including robots that have never joined a team.

Both the evaluator and the Achievement_Progress_Resolver consume the same helper (criterion 5), so displayed progress cannot disagree with unlock behaviour.

### Cause B — wrong ELO field (C11)

The `'elo_upset'` case compares `Number(data.eloDiff) >= minEloDiff`, defaulting to 150. Every orchestrator populates `eloDiff` as `eloAfter - eloBefore`, which `ELO_K_FACTOR = 32` bounds, so the condition is unsatisfiable.

**Resolution.** The evaluator reads Opponent_Elo_Gap instead:

```ts
case 'elo_upset': {
  const minEloDiff = Number(triggerMeta?.minEloDiff ?? 150);
  const gap = Number(data.opponentEloBefore) - Number(data.subjectEloBefore);
  return Boolean(data.won)
    && gap >= minEloDiff
    && ['league_1v1', 'tournament_1v1'].includes(String(data.battleType ?? ''));
}
```

The context already carries `opponentElo`; criterion 8 requires both `eloBefore` values be passed explicitly so the gap is computable without a further query. The 1v1 league and 1v1 tournament orchestrators already hold both participant records at the call site, so this is a context-shape change with no new query.

Criterion 9 requires `eloDiff` be renamed or documented so it cannot be mistaken for an opponent gap again. **Decision: rename to `eloChange`.** It is consumed by the `'elo'` trigger and by audit logging; a rename is mechanical and eliminates the ambiguity that produced this defect, whereas a comment does not.

### Cause C — Grand Melee never wired (L26–L30)

The trigger types `'grand_melee_wins'`, `'grand_melee_top3'`, and `'grand_melee_win_high_hp'` exist in the `AchievementTriggerType` union and are used by L26 through L30, but are absent from all three consumer locations, and the backing counters are never incremented.

Four changes:

1. **`EVENT_TRIGGER_MAP`** — add all three to the `battle_complete` array (criterion 10).
2. **`evaluateTrigger()`** — add three cases (criterion 11). The two counter types use `checkRobotStatCached(cachedRobot, 'grandMeleeWins' | 'grandMeleeTop3', triggerThreshold)`, matching the existing `koth_wins` pattern. `'grand_melee_win_high_hp'` is a one-shot boolean on the current battle (criterion 17):

   ```ts
   case 'grand_melee_win_high_hp': {
     const minHpPercent = Number(triggerMeta?.minHpPercent ?? 75);
     return String(data.battleType) === 'grand_melee'
       && Number(data.placement) === 1
       && Number(data.finalHpPercent) > minHpPercent;
   }
   ```

3. **Achievement_Progress_Resolver** — add `'grand_melee_wins'` and `'grand_melee_top3'` via `bestRobotFor('grandMeleeWins' | 'grandMeleeTop3')` (criterion 12). `'grand_melee_win_high_hp'` is `progressType: 'boolean'` and needs no resolver entry.
4. **Counter increments** — `updateRobotCombatStats()` in `battlePostCombat.ts` gains an optional `placement` field and increments `grandMeleeWins` when `battleType === 'grand_melee' && placement === 1`, and `grandMeleeTop3` when `placement <= 3` (criteria 13, 14).

Criterion 15 is the subtle one: the Grand Melee orchestrator passes `skipBattleCounters: true`, so the increments must sit **outside** that guard. The flag exists to exclude the mode from Career_Battle_Counters, not from its own mode-specific counters. The two counter groups are therefore separated in `updateRobotCombatStats()`:

```ts
if (!opts.skipBattleCounters) { /* totalBattles, wins, losses, draws, stance/loadout */ }
if (opts.battleType === 'grand_melee' && opts.placement != null) { /* grandMeleeWins, grandMeleeTop3 */ }
```

Placing the increments in the shared helper rather than inline in the orchestrator satisfies the unified post-battle update rule in `.kiro/steering/project-overview.md` (criterion 14).

The Grand Melee orchestrator's achievement context gains `placement` and `finalHpPercent` (criterion 16). It already computes both — `p.placement` and `(p.finalHP / p.robot.maxHP) * 100` — so this is a context-shape change only.

### Structural guards

The two structural tests are the most valuable part of this requirement, because they prevent recurrence rather than fixing an instance.

- **Criterion 22:** for every entry in `ACHIEVEMENTS`, assert its `triggerType` appears in at least one `EVENT_TRIGGER_MAP` array and in the `evaluateTrigger()` switch. Implementation reads the exported map and exercises the evaluator with a sentinel to detect the default branch, rather than parsing source.
- **Criterion 23:** for every entry with `progressType: 'numeric'`, assert its `triggerType` appears in the Achievement_Progress_Resolver.

Criteria 20 and 21 require audits beyond the nine reported: every definition checked against the three Achievement_Trigger_Registration locations, and every `standings`-reading trigger checked for the Cause A mode-to-entity-type mismatch. These are investigation tasks whose findings are recorded; any additional unreachable achievement found is either fixed under this requirement or raised separately with a note.

### Threshold reachability

Criterion 18 requires verifying L16 (40 tag team wins), L19 (25 2v2 wins), and L21 (25 3v3 wins) against a 100-cycle season at one match per mode per cycle:

| Achievement | Threshold | Matches available | Required win rate | Attainable |
|-------------|-----------|-------------------|-------------------|------------|
| L16 Dynamic Duo | 40 | 100 | 40% | Yes |
| L19 Twins! | 25 | 100 | 25% | Yes |
| L21 Voltron | 25 | 100 | 25% | Yes |

All three are attainable within one season, so criterion 19's threshold reduction does not trigger. This assumes continuous subscription to the mode through the season; the finding is recorded with that assumption stated. Note that these were previously *unreachable at any threshold* because of Cause A — the thresholds were never the problem.

### No backfill

Criterion 26 forbids retroactive awards, because Spec #45 deletes `user_achievements` and resets the counters at the season boundary. Criterion 27 records the consequence: because evaluation is driven by `battle_complete`, a player already holding 25 2v2 wins sees Twins! unlock on their next 2v2 match rather than at deploy time. Criterion 28 puts that in the changelog so the delay is not read as the bug persisting.

### Traceability

| Criteria | Design element |
|----------|----------------|
| 1, 2, 3, 4, 5 | `resolveTeamModeWins()` helper; membership invariant; zero fallback; shared by evaluator and resolver |
| 6, 7, 8, 9 | Opponent_Elo_Gap comparison; `eloDiff` → `eloChange` rename |
| 10, 11, 12 | `EVENT_TRIGGER_MAP`, `evaluateTrigger()`, Achievement_Progress_Resolver additions |
| 13, 14, 15 | Counter increments in `updateRobotCombatStats()` outside the `skipBattleCounters` guard |
| 16, 17 | Grand Melee context gains `placement` and `finalHpPercent`; one-shot boolean |
| 18, 19 | Reachability table above; no threshold change required |
| 20, 21 | Registration and standings-scope audits |
| 22, 23 | Structural tests |
| 24, 25 | Nine per-achievement unlock tests; `elo_upset` regression test |
| 26, 27, 28 | No backfill; deferred-unlock behaviour; changelog |
| 29 | Spec #44 task checkboxes corrected |
| 30, 31 | Achievement documentation; changelog entry |

---

## Requirement 9: One Disk Alert Every Two Hours

### The five-messages-per-hour arithmetic

Production logs show five CRITICAL messages per hour on `armouredsouls-acc`. Four arrive at the 15-minute cron boundaries; one carries the `Immediate action required.` suffix that the current script emits and arrives once per hour. That decomposition matters, because it means the current script's 60-minute cooldown **is working** — the noise comes from a second emitter that predates the cooldown, matching the stateless design Spec #29 recorded as deliberate.

Consequently, raising `DISK_ALERT_COOLDOWN_SECONDS` alone reduces five alerts per hour to four. The host reconciliation is the load-bearing change, not the constant.

### Three changes, in dependency order

**1. Remove the duplicate emitter (host operations).** Cron is installed by hand per `MONITORING.md`, so there is no repository artefact to fix. The reconciliation is an operations step on each host: enumerate cron entries matching `disk-monitor`, confirm exactly one remains, and confirm `/opt/armouredsouls/scripts/disk-monitor.sh` is the version from this repository. This must precede the constant change, or the change appears not to work.

**2. Make the cooldown honest.** The current gate cannot fail loudly:

```bash
echo "$now" > "$state_file" 2>/dev/null || true
return 0
```

A failed write returns success with no state recorded, so every subsequent run alerts. The designed version distinguishes the two outcomes:

```bash
if ! echo "$now" > "$state_file" 2>/dev/null; then
  echo "[disk-monitor] WARNING: cannot write cooldown state to ${state_file} — cooldown degraded"
fi
return 0
```

The alert still fires (criterion 7): a monitor whose cooldown is broken should degrade toward noise, not toward silence. But the degradation is now visible in the cron log rather than invisible.

**3. Set the cooldown to two hours and the check interval to hourly.** `COOLDOWN_SECONDS` default becomes `7200`, and the cron changes from `*/15 * * * *` to `0 * * * *`.

The interval change is justified by what actually consumes disk on these hosts. Growth is driven by the hourly battle and settlement cron jobs, so consumption rises in steps at those boundaries rather than continuously. Sampling four times an hour therefore observes nothing that one hourly sample misses. And because the Disk_Alert_Cooldown governs every alert after the first, the interval only affects latency on the initial crossing — where one hour is acceptable against a two-hour notification cadence.

Criterion 3 sets the floor: the interval must not exceed one hour, because past that point latency on the first alert grows with no compensating benefit, the cooldown already having capped the rate.

Two multiples now stack cleanly. With an hourly check and a two-hour cooldown, the second hourly invocation is the one that alerts, so the observed cadence is exactly one alert per two hours with no partial-window drift.

### Steering compliance fixes carried along

The script is the last in `app/scripts/` still calling `source /opt/armouredsouls/backend/.env`. `backup.sh` and `restore.sh` were both converted after the two incidents recorded in `.kiro/steering/coding-standards.md`. Since this requirement edits the script anyway, it adopts the Env_Get_Pattern for the three keys it reads, and adds the `set -euo pipefail` that Spec #29 task 4.1 specified but the shipped script never contained.

`set -euo pipefail` needs care in a script that must always exit zero for cron. The existing `|| true` guards on `curl` and `rm` remain, the `${VAR:-default}` expansions are already `set -u` safe, and the terminating `exit 0` is preserved.

### Test harness

Bash scripts have no existing test pattern in this repository, so this requirement introduces one at `app/scripts/__tests__/disk-monitor.test.sh`. The harness prepends a stub directory to `PATH` containing a fake `df` that reports a scripted usage percentage, points `STATE_DIR` at a temporary directory, and leaves the webhook unset so `send_alert` writes only to stdout and makes no network call. Assertions count alert lines in captured stdout.

This is a shell harness rather than a Jest suite because the unit under test is a shell script; wrapping it in Jest would test the wrapper.

### Traceability

| Criteria | Design element |
|----------|----------------|
| 1, 2, 3 | Cooldown constant to 7200; cron interval to hourly, justified by the cadence of disk consumption change, with one hour as the floor |
| 4, 5 | Host reconciliation of duplicate cron entries and stale script copies, sequenced first |
| 6, 7 | State-write failure reported, alert still emitted |
| 8, 9 | Env_Get_Pattern adoption; `set -euo pipefail` with the exit-zero contract preserved |
| 10, 11, 12 | Existing cooldown-clearing, message formats, and state directory resolution retained, with the fallback logged |
| 13, 14, 15, 16, 17, 18 | `app/scripts/__tests__/disk-monitor.test.sh` harness and its five assertions |
| 19, 20, 21 | `MONITORING.md` cron and troubleshooting sections; Spec #29 stateless-design note corrected |

---

## Requirement 10: Single Source of Truth for Streaming Revenue Display

### The canonical function

`streamingRevenueService.ts` gains an exported pure function that both existing paths delegate to:

```ts
export function computeStreamingRevenue(
  totalBattleCount: number,
  fame: number,
  studioLevel: number,
): { baseAmount: number; battleMultiplier: number; fameMultiplier: number;
     studioMultiplier: number; totalRevenue: number }
```

`calculateStreamingRevenue()` and `calculateStreamingRevenueBatch()` both call it (criterion 2), which also removes the current duplication between the single and batch paths — they compute the same arithmetic in two places today and could drift independently.

### Consumers corrected

| File | Current | Corrected |
|------|---------|-----------|
| `financialReportService.ts` | `min(1 + (totalBattles/100) × 0.1, 3.0)`, `min(1 + (totalFame/500) × 0.1, 2.0)` | Derives from `computeStreamingRevenue()` |
| `facilityRecommendationService.ts` ROI branch | `1 + level × 0.1` | `1 + level` |
| `facilityRecommendationService.ts` average estimate | `1 + level × 1.0` | Derives from `computeStreamingRevenue()` |
| `unifiedFacilityROIService.ts` projection | `1000 × (1 + level)` | Derives from `computeStreamingRevenue()` |

### Per-robot presentation

Criterion 4 requires `getDailyFinancialReport()` present the formula per robot rather than against summed roster battle count and summed fame. The Streaming_Revenue_Formula is evaluated per robot per battle, so summing across the roster and applying the multipliers once overstates the result — the current display sums `totalBattles` and `fame` across all robots, which inflates both multipliers.

The corrected report shows the formula for a representative robot with its own counts, and labels the roster-level figure as an aggregate of per-robot awards rather than a formula output. Criterion 7 covers the case where a display path cannot supply per-robot values: it states the figure is an estimate rather than presenting it as the awarded amount.

### Traceability

| Criteria | Design element |
|----------|----------------|
| 1, 2 | `computeStreamingRevenue()` and delegation from both paths |
| 3, 4 | `financialReportService.ts` derivation and per-robot presentation |
| 5, 6 | `facilityRecommendationService.ts` and `unifiedFacilityROIService.ts` corrections |
| 7 | Estimate labelling where per-robot data is unavailable |
| 8, 9 | Display-versus-award parity test; single-versus-batch parity test |
| 10 | `PRD_ECONOMY_SYSTEM.md` update |

### Note on requirement numbering

The streaming requirement was renumbered from 9 to 10 when the disk alert requirement was inserted. Its criteria numbers are unchanged.

---

## Mobile Responsiveness

Four requirements modify UI and therefore carry mobile requirements. All follow the responsive tab and card patterns in `.kiro/steering/frontend-standards.md`.

| Requirement | Surface | Mobile behaviour |
|-------------|---------|------------------|
| 4 | Hall_Of_Records Combat, Upset, Career, KotH, Grand Melee tabs | Existing stacked card layout retained; removed categories removed from both the desktop table and the mobile card variants. Mode_Scoped_Record for Most Damage renders as a mode switcher above a single list rather than parallel columns below 1024px. |
| 5 | Fame_Leaderboard, Prestige_Leaderboard | Removed columns dropped from the mobile card rows as well as the desktop tables (criterion 17). The Fame filter bar container is removed entirely rather than rendered empty, recovering vertical space. |
| 6 | Booking_Office_Page | Upgrade_Implication_Panel stacks figures vertically below 1024px. Upgrade control at minimum 44px touch target, full-width on narrow viewports. |
| 7 | Hall_Of_Records Win Streak section | Four modes render as a vertical stack of sections below 1024px rather than a side-by-side grid. |

Every changed surface asserts no horizontal overflow from 320px upward, and touch targets of at least 44px on any interactive element.

## Accessibility

The Booking Office upgrade control is the only new interactive element. It is keyboard reachable and operable, carries an accessible name identifying both action and facility, and exposes its disabled reason via `aria-describedby` rather than colour alone (Requirement 6, criterion 20).

Removed leaderboard and records columns require no accessibility work beyond keeping table headers and cells in sync, but the tests assert header-to-cell alignment so a partial removal cannot leave a dangling header.

## Testing Strategy

### Property-based tests

Three properties are the strongest guarantees in this spec and use `fast-check`:

1. **Merchandising monotonicity** (R2 criterion 18): merchandising income is non-increasing as Roster_Capacity rises at fixed prestige and level.
2. **Refinement proportionality** (R3 criterion 14): the proportional gain from a fixed refinement set is invariant across the full catalog range of cooldown and base damage values, and across `attackSpeed` values.
3. **Facility operating cost parity** (R6 criterion 4): for every type in `FACILITY_TYPES` except `roster_expansion`, the API value equals `calculateFacilityOperatingCost()`.

### Structural tests

Two tests in R8 guard against a class of defect rather than an instance: every trigger type used by a definition is registered in all three Achievement_Trigger_Registration locations, and every numeric trigger appears in the Achievement_Progress_Resolver. These would have caught Cause C at commit time.

The records distinct-values test (R4 criterion 24) serves the same purpose for Record_Categories: seeded data with distinct underlying values must produce distinct ranked values, which fails for any structurally-tied category added in future.

### Symlink integrity

R3 adds a test asserting the backend and shared import paths resolve to the same `weaponRefinement` module. `app/backend/src/shared/utils` is a committed symlink, so this guards against a future change replacing it with a real directory and forking the formula.

### Coverage

Combat, economy, and achievement code fall under the 90% critical-functionality threshold in `.kiro/steering/coding-standards.md`. Requirements 2, 3, 8, and 10 all touch that code and their tests are written to that bar; Requirements 4, 5, 6, and 7 are primarily presentation and hold to 80%. Requirement 9 is an operations script covered by a shell harness rather than a coverage threshold.

## Documentation Impact

### Steering files

| File | Change | Requirement |
|------|--------|-------------|
| `.kiro/steering/project-overview.md` | Economy entry notes merchandising scales with Prestige_Per_Slot while streaming scales per robot per battle | 2 (criterion 22) |

No other steering file describes a pattern this spec changes. `coding-standards.md` already mandates that shared formulas live in `app/shared/utils/` and that post-battle robot updates go through `updateRobotCombatStats()` — Requirements 3 and 8 comply with existing rules rather than changing them.

### Guides and PRDs

| File | Change | Requirement |
|------|--------|-------------|
| `docs/game-systems/PRD_TOURNAMENT_SYSTEM.md` | All Participant_Types create the next bracket in the run that completes the previous one | 1 |
| `docs/game-systems/PRD_ECONOMY_SYSTEM.md` | Prestige_Per_Slot formula, doubled base rate table, re-based gates | 2 |
| `docs/game-systems/PRD_ECONOMY_SYSTEM.md` | Streaming_Revenue_Formula documented once, all display paths derive from it | 9 |
| `docs/game-systems/PRD_WEAPON_ECONOMY.md` | New v1.7 section; four-tier table updated with proportional values | 3 |
| `docs/guides/ADMIN_PANEL_GUIDE.md` | Refinement section checked for hardcoded tier effect values | 3 |
| `docs/prd_pages/` Hall of Records | Retained categories, Most Damage mode scoping, Career mode coverage, Win_Streak_Records, bye-win caveat | 4, 7 |
| `docs/game-systems/PRD_PRESTIGE_AND_FAME.md` | Retained filters and columns; prestige roster-scaling note. No leaderboard document exists under `docs/prd_pages/` | 5 |
| `docs/prd_pages/` Booking Office | Upgrade control and Upgrade_Implication_Panel contents | 6 |
| `docs/game-systems/` Booking Office | ₡150 per level daily operating cost | 6 |
| `docs/game-systems/` achievements | Any threshold changed under R8 criterion 19 (none expected per the reachability table) | 8 |
| `docs/guides/operations/MONITORING.md` | Cron section: hourly `0 * * * *` schedule, two-hour Disk_Alert_Cooldown, one-entry-only rule | 9 |
| `docs/guides/operations/MONITORING.md` | Troubleshooting section: duplicate cron entry and stale script copy check | 9 |
| Spec #29 record | Stale-emitter finding recorded against the "no deduplication" design decision so it is not reintroduced | 9 |
| `docs/game-systems/STABLE_SYSTEM.md` | Training_Discount formula, raised `maxLevel`, per-level rate table | 11 |
| `app/backend/src/content/guide/facilities/facility-overview.md` | Roster-dependent discount formula and rate table | 11 |
| `app/backend/src/content/guide/robots/upgrade-costs.md` | Roster-dependent discount statement | 11 |
| `docs/prd_pages/PRD_FACILITIES_PAGE.md` | Roster-dependent benefit; page shows the stable's actual figure | 11 |

### Spec record correction

`.kiro/specs/done-june26/44-grand-melee/tasks.md` tasks 10.1 and 10.2 are marked complete once Requirement 8's Grand Melee work lands (R8 criterion 29). They are currently unchecked in a spec filed as done, which is how Cause C escaped notice.

### Changelog entries

| Category | Content | Requirement |
|----------|---------|-------------|
| `balance` | Sharpen and Forge become proportional; fast one-handed builds lose a little, slow two-handed builds gain substantially | 3 |
| `feature` | Removed Hall of Records categories | 4 |
| `feature` | League win streak records added | 7 |
| `bugfix` | Nine achievements now obtainable, with the deferred-unlock note | 8 |
| `balance` | Training Facility discount is roster-dependent; level 10 now meaningful | 11 |

Requirements 1, 2, 5, 6, and 9 carry no changelog criterion. Requirement 2 is a significant economy change and a `balance` entry is advisable, but it is not required by the acceptance criteria and is left to the deploy-time changelog review.

## Open Items Carried Into Implementation

One item is unresolved at design time because it requires data rather than judgement:

**Additional unreachable achievements** (R8 criteria 20, 21). The registration audit and the standings-scope audit may find achievements beyond the nine reported. Anything found is either fixed under Requirement 8 or raised as a separate item with a recorded reason. Neither audit needs a decision before implementation starts.

Two observations are recorded here without becoming tasks in this spec:

1. **The ~1-second battles** (R4 criterion 4). Removing Fastest Victory removes the only surface where these were visible. A battle resolving in one simulation second may indicate a combat defect and warrants separate investigation, but nothing in this spec depends on the answer.

2. **Team Battle tab duration categories.** `fetchTeamBattleRecordsForSize()` carries its own `fastestVictory` and `longestNonDrawBattle`, which share the structural weaknesses that justify removing the Combat tab equivalents. Requirement 4 does not scope them, so they remain.

---

## Requirement 11: Training Facility Rewards Roster Concentration

### The formula

```ts
// app/shared/utils/discounts.ts
const ratePerLevel = Math.max(0, TRAINING_DISCOUNT_BASE_PER_LEVEL - TRAINING_DISCOUNT_PER_SLOT * rosterCapacity);
return Math.min(Math.max(0, level) * ratePerLevel, TRAINING_DISCOUNT_MAX);
```

Two clamps, both load-bearing rather than defensive decoration:

- **`Math.max(0, ...)` on the rate.** `roster_expansion` caps at level 9, so Roster_Capacity maxes at 10 and the rate lands exactly on 0 today. If that cap ever rises, a wider roster must mean *no discount*, never a cost penalty — an unclamped rate would make upgrades cost more than base price.
- **`Math.min(..., 90)` on the total.** Preserves the existing 90% ceiling, which is now reachable only at level 10 with Roster_Capacity 1 rather than by any stable at level 9.

### Why `maxLevel` moves from 9 to 10

The old `min(level × 10, 90)` saturated at level 9. `maxLevel` had been *lowered* to 9 to reflect that level 10 bought nothing — the formula had eaten a level of the facility. With a roster-dependent rate the ceiling is only reachable at level 10 and only by a concentrated stable, so the level earns its place. Level 10 costs ₡1,500,000 (continuing the ₡150,000 × level curve) and carries no prestige gate; the existing gates at L4, L7, and L9 are unchanged.

### Roster_Capacity moves to the shared module

`getRosterCapacity()` was added to backend `economyFormulas.ts` under Requirement 2. Requirement 11 makes the frontend need it too, because `UpgradePlanner`, `WhatIfPanel`, and the onboarding step all compute upgrade cost previews locally and a preview that disagrees with the charged price is a defect.

Per `.kiro/steering/coding-standards.md` — shared formulas live in `app/shared/utils/` — it moves to `app/shared/utils/rosterCapacity.ts`. Backend `economyFormulas.ts` re-exports it so the existing merchandising import sites are untouched and exactly one definition remains.

### Transaction safety

`executeUpgradeTransaction()` already re-reads the Training Facility level inside the `lockUserForSpending` transaction to defeat a concurrent facility upgrade. Roster_Capacity is now read in the same place for the same reason: a concurrent `roster_expansion` upgrade changes the discount, so the optimistic price computed outside the lock cannot be trusted (criterion 7).

### Display

The static `benefits[]` strings cannot express a roster-dependent value, so they quote the best case (Roster_Capacity 1) and `GET /api/facilities` overrides `currentBenefit` and `nextBenefit` with the requesting stable's actual figure. This follows the pattern `repair_bay` already uses, whose discount likewise depends on robot count.

Criterion 9 handles the degenerate case: at Roster_Capacity 10 the rate is 0, and rendering a bare `0%` would read as a bug. The benefit text instead states that the facility grants no discount at that roster size.

### Interaction with Requirement 2

Both requirements move a facility onto the concentration axis, and they compound deliberately. A stable expanding its roster now loses merchandising income per slot *and* Training Facility discount per level. That is the intended shape — Requirement 2's premise was that the game had two breadth facilities and no depth facility, and the Training Facility was the third breadth-favouring sink. The Streaming Studio remains the breadth option.

### Traceability

| Criteria | Design element |
|----------|----------------|
| 1, 3, 4 | `calculateTrainingFacilityDiscount()` with both clamps |
| 2 | `training_facility` config: `maxLevel`, costs, gates |
| 5, 10 | `getRosterCapacity()` moved to `app/shared/utils/rosterCapacity.ts` |
| 6 | Explicit `rosterCapacity` parameters on both shared formulas |
| 7 | Fresh Roster_Capacity read inside the locked transaction |
| 8, 9 | `GET /api/facilities` dynamic benefit override |
| 11 | `UpgradePlanner`, `WhatIfPanel`, `Step4_Upgrades` threading |
| 12, 13, 14 | Monotonicity property test, worked-example regressions, L10 > L9 test |
| 15, 16, 17 | `STABLE_SYSTEM.md`, in-game guide, `PRD_FACILITIES_PAGE.md` |
| 18 | Changelog entry |
