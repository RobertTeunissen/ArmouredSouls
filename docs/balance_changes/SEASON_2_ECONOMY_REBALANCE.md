# Season 2 Economy Rebalance (#524, #525, #526, #527)

**Effective season**: Season 2 (deployed during the Season 2 preparation window; on ACC as soon as it is deployed).
**Issues**: [#524](https://github.com/RobertTeunissen/ArmouredSouls/issues/524) (Streaming Studio and Merchandising Hub), [#525](https://github.com/RobertTeunissen/ArmouredSouls/issues/525) (Repair Bay), [#526](https://github.com/RobertTeunissen/ArmouredSouls/issues/526) (Training Facility), [#527](https://github.com/RobertTeunissen/ArmouredSouls/issues/527) (team credit pools).
**Source**: branch `feature/season2-economy`, stacked on `feature/season2-combat-tuning` (`2d8d89ed`, PR #537).

| Topic | Source commit |
|---|---|
| Streaming formula v2, breakdown v2 and SQL validator, Merchandising ₡25,000 per level (#524) | `d2f0ebc0` |
| Tests for streaming v2 and Merchandising (#524) | `f952f5fa` |
| Flat 6% per level Repair Bay discount, repair breakdown v2, recorded-fact ROI (#525) | `3bea6ed9` |
| Training Facility discount × 0.75, exact fractional rates, capacity-aware ROI (#526) | `6c55d349` |
| Team credit pools × 0.75 once before the split, exact shares (#527) | `bc76a236` |

Every value below was decided by the product owner. The issues' proposed `min()` caps were rejected under the no-caps
principle. Solo battle rewards are out of scope: once the facilities are right, only elite one-robot stables should
reach the top tiers. Team-mode credit pools were judged too high and are reduced (#527).

## Why

ACC evidence at cycle 75:

- A 1v1 Platinum robot with 552 battles, 10,492 Fame and a Level 9 Streaming Studio earned ₡48,087 streaming per
  battle.
- A 10-robot stable earned ₡4.64M per cycle: battle/bye ₡3.36M (61 events), streaming ₡1.27M (78 events),
  Merchandising ₡14k (1 event).

Streaming is paid per robot per match, so it rewards swarms, and the old formula multiplied three growing factors.
Merchandising is paid per stable per cycle with Prestige divided by roster slots, so it penalises swarms, but its base
was too small to matter. The Repair Bay discount grew with roster size, so a 10-robot stable reached 90% at Level 6.
Together the three facilities made a wide roster snowball.

## Changes

| Value | Before | Season 2 |
|---|---|---|
| Streaming formula | `floor(1000 × (1 + battles/1000) × (1 + fame/5000) × (1 + level))` (formula version '1') | `floor(1000 × (1 + battles/2000 + fame/10000) × (1 + 0.5 × level))` (formula version '2'), then `floor(… / teamSize)` |
| Battles and Fame | Two multipliers, multiplied together | One additive audience multiplier |
| Streaming Studio per level | +100% (Level 10 = 11×) | +50% (Level 10 = 6×) |
| Example: 552 battles, 10,492 Fame, Studio L9 | ₡48,087 per battle | ₡12,788 per battle (−73%) |
| Merchandising Hub base rate | ₡10,000 per level (₡100,000 at L10) | ₡25,000 per level (₡250,000 at L10) |
| Repair Bay discount | `min(90, level × (5 + owned robots))` | `6 × min(level, 10)` percent, any roster size (60% at L10) |
| Training Facility discount | `min(90, level × max(0, 10 − slots))` | `clamp(level, 0, 10) × max(0, 10 − slots) × 0.75` percent (67.5% at L10 with 1 slot) |
| Example: Training Facility L6 / L10, 1 slot | 54% / 90% | 40.5% / 67.5% |
| Tag team and 2v2 credit pool | 2× a solo reward | 1.5× a solo reward |
| 3v3 credit pool | 3× a solo reward | 2.25× a solo reward |
| Team tournament owner pool | round reward × team size | round reward × team size × 0.75 |
| Team bye / forfeit-win pool | participation × team size | participation × team size × 0.75 |

No term of the streaming formula is capped. `battles` is the existing all-modes count (KotH and Grand Melee
inclusive). Base streaming without a Studio, the team-size division and no streaming for byes are unchanged; the team
division now happens exactly once and is recorded. A one-robot stable keeps exactly its old Repair Bay curve.

All award, display and projection paths use one implementation each: `computeStreamingRevenue()` in
`app/backend/src/services/economy/streamingRevenueService.ts`, `getMerchandisingBaseRate()` in
`app/backend/src/utils/economyFormulas.ts`, `calculateRepairBayDiscountPercent()` in
`app/shared/utils/repairCost.ts`, `calculateTrainingFacilityDiscount()` in `app/shared/utils/discounts.ts`, and
`TEAM_CREDIT_POOL_FACTOR` / `applyTeamCreditPoolFactor()` in `app/backend/src/utils/economyFormulas.ts`.

**Training Facility (#526).** The roster input stays the purchased Roster_Capacity (`roster_expansion` level + 1),
never the robots currently owned. Rates are multiples of 0.25 and exact; each level's cost is
`floor(base × (100 − d) / 100)`, then the levels are summed (the previous `floor(base × (1 − d/100))` form dropped a
credit to float drift on some exact results). The upgrade planner, Practice Arena what-if panel, onboarding Step 4,
the Automaton planner and the transaction-time charge all use the shared helpers, and the purchase still recomputes
the price inside the locked transaction with fresh facility levels. Onboarding's "10% discount" card now shows the
helper's Level 1 rate for a one-robot stable (6.75%). The facility ROI (`calculateTrainingFacilitySavings` and the
estimate fallback) and the facility advisor used `level × 10` and ignored capacity; they now use the helper with the
stable's purchased capacity. Attribute upgrade records do not store the discount they were charged at, so historical
Training Facility savings remain an estimate at the current level and capacity. The 90% clamp
(`TRAINING_DISCOUNT_MAX`) could no longer bind and was removed.

**Team credit pools (#527).** The factor is applied once, before the split, and the pool is rounded once
(`pool × 0.75` is exact, so a half credit rounds up). Shares come from `distributeTeamCredits`: an equal split with the
remainder one credit at a time to the first robots, so they sum to the recorded pool. Tag team previously floored each
robot's share (`floor(pool / 2)`) and now uses the same split. The 2v2/3v3 loser and draw pool stays 20% of the
(reduced) winner pool; each mode's participation fraction is unchanged. Team tournaments compute both owner pools in
`calculateTeamTournamentCreditPools`, and the per-robot payout never multiplies by team size again (a test guards
against the pre-Spec #49 N² payment). Team byes and battle-time team forfeit wins pay the bye amount from
`resolveByeReward`, which applies the factor for team sizes 2 and 3 only. The facility advisor projects the incremental benefit of the next Studio level; the
facility ROI reads recorded facts (the Studio-attributable share of each stored streaming award, the recorded
`discountPercent` of each repair) instead of applying today's formula to history. Those recorded facts are summed in the
database per stored multiplier and discount (#542), which changes query volume only, not the returns.

## What did not change

Solo battle rewards and solo byes, streaming (already divided by team size), fame, prestige, ELO/LP and standings, the
tag-team prestige multiplier (1.6), facility purchase prices and operating costs, the base repair price (100 per attribute point), the
destruction (2.0) and heavy-damage (1.5) multipliers, the rounding order, the manual-repair 0.5 multiplier, and the
Merchandising prestige-per-slot multiplier `1 + (prestige / rosterSlots) / 10,000`.

The guide previously stated the Repair Bay upkeep as ₡100 per level. The code charges ₡1,000/day at Level 1 plus ₡500
per extra level (₡5,500 at L10); the guide and docs now say so. The upkeep itself did not change.

## Comparison: 1, 3 and 10 robots

Formula arithmetic, not a simulation. Assumptions: every robot has 500 battles and 5,000 Fame and fights 4 solo
battles per cycle; Streaming Studio L6, Merchandising Hub L5, Repair Bay L6; Prestige 20,000; roster capacity equals
the robot count (Roster Expansion L0/L2/L9); each robot needs ₡40,000 of automatic repairs per cycle before the
discount. Streaming per battle goes from ₡21,000 to ₡7,000.

| Stable | Streaming / cycle | Merchandising / cycle | Repair Bay discount | Repairs / cycle | Net of the three |
|---|---|---|---|---|---|
| 1 robot | ₡84,000 → ₡28,000 | ₡150,000 → ₡375,000 | 36% → 36% | ₡25,600 → ₡25,600 | ₡208,400 → ₡377,400 |
| 3 robots | ₡252,000 → ₡84,000 | ₡83,333 → ₡208,333 | 48% → 36% | ₡62,400 → ₡76,800 | ₡272,933 → ₡215,533 |
| 10 robots | ₡840,000 → ₡280,000 | ₡60,000 → ₡150,000 | 90% → 36% | ₡40,000 → ₡256,000 | ₡860,000 → ₡174,000 |

Before, these three facilities paid a 10-robot stable four times what they paid a one-robot stable; now the
one-robot stable earns the most from them. Facility upkeep and battle income are not included.

### Adding the Training Facility and team pools (#526, #527)

Same stables, plus: Training Facility L6 with roster capacity equal to the robot count; each robot buys ₡100,000 of
attribute upgrades per cycle at base price; one Gold 3v3 win per full 3-robot team per cycle (no team for the
1-robot stable, one team for 3 robots, three teams for 10 robots). A Gold 3v3 win pool is
(₡30,000 + ₡6,000) × 3 = ₡108,000 before and ₡81,000 after.

| Stable | Training discount | Training saving / cycle | Team pools / cycle | Net of all five |
|---|---|---|---|---|
| 1 robot | 54% → 40.5% | ₡54,000 → ₡40,500 | ₡0 → ₡0 | ₡262,400 → ₡417,900 |
| 3 robots | 42% → 31.5% | ₡126,000 → ₡94,500 | ₡108,000 → ₡81,000 | ₡506,933 → ₡391,033 |
| 10 robots | 0% → 0% | ₡0 → ₡0 | ₡324,000 → ₡243,000 | ₡1,184,000 → ₡417,000 |

"Net of all five" is the net of the three facilities above plus the training saving and the team pools. Before, the
10-robot stable got 4.5× what the 1-robot stable got from these five sources; now the two are about level.

## Deploy notes

- #526 and #527 need no migration, seed or data change: they change formulas only, and historical ledger rows,
  battle records and participant credits keep the amounts recorded at the time.
- One migration, `20261017120000_streaming_breakdown_v2_validation`, replaces the two SQL validator functions
  `finance_report_breakdown_is_valid_legacy` and `finance_report_breakdown_is_valid` (same signatures). Only the
  streaming branch changes: it accepts both breakdown versions. No table, schema or data change.
- New streaming awards write breakdown `formulaVersion` '2' (`battleContribution`, `fameContribution`,
  `audienceMultiplier`, `studioMultiplier`, `teamSize`, `revenueBeforeTeamShare`, `totalRevenue`); new repairs write
  repair breakdown `formulaVersion` '2' (the owned-robot count is still recorded, but is no longer a discount input).
- Historical ledger rows, audit rows, breakdowns and `BattleParticipant.streamingRevenue` are untouched. A retry of an
  existing streaming event returns the stored award.
- No seed or data migration is needed. The new values apply from the first battle, settlement and repair after deploy.

## Player announcement

The announcement lines are in the `### Economy` subsection of the
[Season 2 player announcement](SEASON_2_BALANCE_PACKAGE.md#economy).
