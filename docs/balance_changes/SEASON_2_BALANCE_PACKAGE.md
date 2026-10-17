# Season 2 Balance Package (#519–#523)

**Effective season**: Season 2 (deployed during the Season 2 preparation window; on ACC as soon as it is deployed).
**Issues**: [#519](https://github.com/RobertTeunissen/ArmouredSouls/issues/519), [#520](https://github.com/RobertTeunissen/ArmouredSouls/issues/520), [#521](https://github.com/RobertTeunissen/ArmouredSouls/issues/521), [#522](https://github.com/RobertTeunissen/ArmouredSouls/issues/522), [#523](https://github.com/RobertTeunissen/ArmouredSouls/issues/523); release gate [#516](https://github.com/RobertTeunissen/ArmouredSouls/issues/516).
**Source**: branch `feature/season2-combat-tuning`, base `0d7e5b51` (`origin/main`). Source commits per topic:

| Topic | Source commit |
|---|---|
| Pricing formula, catalogue, shields, loadout passives, Workshop discount (#521) | `cd3361f3` |
| Hydraulic Systems retune, Logic Cores ranged damage (#519) | `0d3a6ca7` |
| Engagement cycle (#520) | `4ea1d534` |
| Movement fix: simultaneous movement, full-speed pursuit (#520 addendum) | `71267b49` |
| Refinement Lab, grant migration, facility categories | `803b0a39` |
| KotH zone radius 7, backfill migration, rotating-zone removal (#522) | `63150611` |
| Round 2: guaranteed exchange and pursuit edge (#520) | `ed34b158` |

Every value below was decided by the product owner. The measurement in
[NEXT_SEASON_BALANCE_VALIDATION.md](../analysis/NEXT_SEASON_BALANCE_VALIDATION.md#season-2-balance-package-519522) is
for information only; no value was tuned after it.

## #519 Hydraulic Systems and Logic Cores

| Value | Old | New |
|---|---|---|
| Hydraulic Systems, melee band | 1 + 0.02 × H (2.0× at 50) | 1 + 0.015 × H (1.75× at 50) |
| Hydraulic Systems, short band | 1 + 0.015 × H (1.75× at 50) | 1 + 0.01 × H (1.5× at 50) |
| Logic Cores, long band damage | none | 1 + 0.015 × L (1.75× at 50) |
| Logic Cores, mid band damage | none | 1 + 0.01 × L (1.5× at 50) |
| Logic Cores, short/melee damage | none | none |

Both are linear and uncapped and use the current distance band (melee 0–2, short 3–6, mid 7–12, long 13+). Logic
Cores multiplies damage right after Hydraulic Systems. Counters mirror the hydraulic rule: hydraulics apply only to
melee-band counters, Logic Cores only to long-band counters. Logic Cores keeps its pressure/composure role.

## #520 Engagement cycle

| Value | Old | New |
|---|---|---|
| Pursuit speed (melee role closing on a ranged-role opponent) | 1.30 + 0.02 × speed gap | 1.15 (round 2; 1.10 in round 1) |
| Kiting speed (ranged role inside its range midpoint vs a melee-role opponent) | 1.10 + 0.008 × speed gap | 1.10 |
| Defensive stance while pursuing | 0.95 | 0.80 (normal defensive factor) |
| Role source | main weapon `weaponType === 'melee'` | engagement range: melee role iff the robot's engagement band is melee |
| Melee commit | none | 1.30× speed, strain-free, after the patience window (15 s − 5 × min(CA/50, 1): 15 s → 10 s) without a landed hit, until within reach (≤ 2) |
| Ranged disengage | none | starts 2.5 s after the first melee-band hit taken per engagement (round 2; on the hit in round 1); then 1.30× speed, strain-free, for 2 s + 0.04 s × Evasion Thrusters (uncapped); then a cooldown of one patience window |
| Patience reset | any resolved attack (hit, miss, malfunction) | a landed hit only |
| Arena wall | robot clamped to the wall | slides tangentially along the wall, total step ≤ speed × tick |
| Mutual-melee final approach (2–4 units) | 1.15 | 1.15 (unchanged) |
| Prediction (#351/#467), strain model | – | unchanged |

Movement fix (product-owner addendum): the movement phase is simultaneous (every robot decides from the same
tick-start snapshot, then all moves are applied), and a melee-role robot outside reach of a target that does not
prefer melee moves at full speed towards the target's projected end-of-tick position instead of stopping at the
1-unit standoff point. Thresholds at balanced stance after round 2 (K = kiter Servo, M = melee Servo): at range the
gap changes by 0.22·K − 0.23·M − 0.35 u/s, so at equal Servo the chaser closes 0.35 + 0.01 × Servo u/s (0.60 at 25)
and a kiter keeps away only if K > 1.0455·M + 1.59; a committing melee robot is outrun only if K ≥ 1.18·M + 6.4
(unchanged); a disengaging kiter is denied only if M ≥ 1.1304·K + 4.57.

## Round 2 adjustments (#520)

Decided by the product owner after measuring round 1 of this PR. Source commit `ed34b158`.

| Value | Round 1 | Round 2 |
|---|---|---|
| Ranged disengage start | on the first melee-band hit taken in an engagement | 2.5 s after that hit (`DISENGAGE_DELAY_SECONDS`); further melee hits during the delay don't move it |
| Pursuit multiplier | 1.10 | 1.15 |
| Kiting multiplier | 1.10 | 1.10 (unchanged) |
| Disengage duration, 1.30× burst, cooldown (one patience window) | – | unchanged |

Cause (from the round 1 measurement): melee contact was too short. Reach entries went from ~3 to ~17 per battle while
time within reach fell from ~25% to 8–12%. Melee's first hit reset its patience (so the commit dropped) and triggered
the ranged disengage at the same moment.

Confirmed round 1 additions, kept as implemented: missed attacks don't reset patience (only landed hits do), and Logic
Cores applies to counter-attacks at long range (the mirror of the melee-band-only Hydraulic Systems counter rule).

Deferred to the next measurement round (report only): short-range dominance, Single, Dual Wield (late).

### Round 2 measurement

Information only; nothing was tuned. Full tables, CIs and method in the
[validation report](../analysis/NEXT_SEASON_BALANCE_VALIDATION.md#season-2-balance-package-round-2). Arms: `main`
`0d7e5b51`, `round1` `51e25ef4`, `round2` (code of `ed34b158`); paired seeds, 2,000 trials per 1v1 cell.

1v1 score against the other range classes, invest early / mid / late (Δ round2 vs round1 in pp, 95% CI ±0.5–1.2):

| Class | main | round1 | round2 | Δ round2 |
|---|---|---|---|---|
| melee | 83.6% / 67.3% / 58.3% | 36.2% / 27.5% / 31.5% | 62.1% / 50.4% / 47.8% | +25.9 / +22.9 / +16.3 |
| short | 75.0% / 78.7% / 77.6% | 89.5% / 84.2% / 83.3% | 84.1% / 80.7% / 80.5% | −5.5 / −3.5 / −2.8 |
| mid | 33.9% / 37.4% / 41.8% | 55.5% / 60.1% / 56.3% | 43.6% / 49.9% / 49.7% | −11.9 / −10.3 / −6.6 |
| long | 7.4% / 16.6% / 22.3% | 18.8% / 28.2% / 28.9% | 10.3% / 19.0% / 22.1% | −8.5 / −9.2 / −6.9 |

1v1 score against the other loadouts, invest early / mid / late. Both sides share a range class, so round 2 doesn't act
here (Δ round2 +0.0 in every cell):

| Loadout | main | round1 = round2 |
|---|---|---|
| single | 28.5% / 22.3% / 27.9% | 29.5% / 25.0% / 31.6% |
| weapon_shield | 76.4% / 74.2% / 54.9% | 67.7% / 66.0% / 37.0% |
| two_handed | 38.8% / 38.8% / 51.2% | 43.7% / 41.4% / 58.3% |
| dual_wield | 56.2% / 64.7% / 66.1% | 59.2% / 67.6% / 73.0% |

Melee-vs-ranged cells, invest mid, main → round1 → round2:

| Cell | score of melee | time within reach | reach entries / battle | timeouts |
|---|---|---|---|---|
| melee vs short | 40.8% → 7.9% → 18.3% | 51.4% → 7.6% → 12.8% | 1.9 → 40.9 → 66.0 | 3.0% → 3.9% → 4.2% |
| melee vs mid | 76.9% → 23.8% → 54.5% | 53.0% → 7.8% → 13.5% | 13.0 → 57.1 → 90.8 | 7.4% → 12.3% → 12.6% |
| melee vs long | 84.4% → 50.8% → 78.5% | 52.7% → 8.6% → 14.4% | 14.8 → 70.0 → 101.8 | 10.7% → 28.8% → 19.6% |

Contact time rises but reach entries rise too (the decision expected fewer entries). Slot-0 score (50% = robot order
has no effect), `range` suite invest early / mid / late: main 47.0% / 43.0% / 40.5%, round1 50.2% / 49.9% / 50.2%,
round2 50.3% / 49.9% / 50.0%.

Multi-robot modes, round1 → round2 (normalized rank, 0 = best, lower is better):

| Class | KotH r7 rank, invest mid | Grand Melee rank, invest mid |
|---|---|---|
| melee | 0.669 → 0.661 | 0.593 → 0.592 |
| short | 0.552 → 0.550 | 0.375 → 0.386 |
| mid | 0.369 → 0.374 | 0.457 → 0.451 |
| long | 0.339 → 0.337 | 0.575 → 0.571 |

KotH win reasons (invest mid): score threshold 43.1% → 42.4%, last standing 52.6% → 53.3%. Grand Melee timeouts
(invest mid) 12.7% → 8.9%. Every KotH and Grand Melee class and loadout rank moves by at most 0.021.

Deferred (report only):

- **Short range**: still dominant at 84.1% / 80.7% / 80.5% (invest early / mid / late); short vs long 89.3%.
- **Single**: unchanged at 25.0–31.6% (invest), target 42–45%.
- **Dual Wield late**: unchanged at 73.0% (invest late).

## #521 Shields and loadouts

| Item | Old | New |
|---|---|---|
| Fortress Shield | Armor +15, Shield Capacity +14, Counters +10, Evasion −4, Servo −3 | Armor +11, Shield Capacity +10, Counters +8, Evasion −4, Servo −3 |
| Aegis Bulwark | Armor +15, Shield Capacity +15, Counters +14, Power Core +11, Evasion −5, Servo −4 | Armor +11, Shield Capacity +11, Counters +10, Power Core +8, Evasion −5, Servo −4 |
| Weapon+Shield passive | Shield Capacity +20%, Armor +15%, Counters +10%, Attack Speed −15% | Shield Capacity +15%, Armor +10%, Counters +10%, Attack Speed −15% |
| Single passive | Gyro Stabilizers +10%, Servo Motors +5% | Gyro Stabilizers +15%, Servo Motors +10% |

Two-Handed and Dual Wield passives are unchanged. Light, Combat, Reactive and Barrier Shield are unchanged.
Refinements are stored as deltas (`tier`, `magnitude`, `targetAttribute`) and fold onto the new catalogue values; a
unit test covers Fortress/Aegis + Hone.

## Weapon pricing formula

Shared formula in `app/shared/utils/weaponPricing.ts`:

```
price = round1000((50,000 + DPS cost + 500 × (Σ bonuses, negatives included)²) × hand multiplier)
DPS cost = 50,000 × ((baseDamage / cooldown) / 2.0 − 1) × 6.0   (0 for shields)
hand multiplier: one-handed 1.0, two-handed 1.6 → 1.5, shield 0.9 → 1.3
starters (no bonuses, baseline DPS, not a shield): flat ₡50,000
```

- **Bug fix**: the old attribute part `Σ 500 × b²` squared each bonus, so a penalty raised the price. Now the signed
  sum is squared. No weapon has a negative bonus sum.
- **Verification**: before any value changed, the shared DPS part with the old attribute part and old hand multipliers
  reproduced 47 of 47 catalogue prices (with the starter rule). The pre-change catalogue is frozen in
  `app/backend/tests/weaponPricing.test.ts`, and a test asserts every catalogue price equals `calculateWeaponPrice`.
- **Price grid**: with the decided prices three of the 36 hand × range × tier slots are empty (two-handed short Mid,
  one-handed mid Premium, two-handed long Premium). Tier bands are unchanged; see PRD_WEAPON_ECONOMY.md v1.8.

Full catalogue (sorted by new price):

| Weapon | Hands | Range | Old price | New price | Change |
|---|---|---|---|---|---|
| Ion Beam | two | long | 544,000 | 903,000 | +66.0% |
| Aegis Bulwark | shield | melee | 409,000 | 690,000 | +68.7% |
| Vibro Mace | one | melee | 425,000 | 688,000 | +61.9% |
| Arc Projector | two | short | 488,000 | 627,000 | +28.5% |
| Railgun | two | long | 527,000 | 619,000 | +17.5% |
| Volt Sabre | one | short | 425,000 | 550,000 | +29.4% |
| Nova Caster | one | mid | 425,000 | 550,000 | +29.4% |
| Particle Lance | one | long | 425,000 | 550,000 | +29.4% |
| Heavy Hammer | two | melee | 478,000 | 537,000 | +12.3% |
| Power Sword | one | melee | 325,000 | 456,000 | +40.3% |
| Sniper Rifle | two | long | 387,000 | 455,000 | +17.6% |
| Plasma Cannon | two | mid | 408,000 | 447,000 | +9.6% |
| Battle Axe | two | melee | 402,000 | 419,000 | +4.2% |
| Assault Rifle | one | short | 293,000 | 412,000 | +40.6% |
| Disruptor Cannon | one | mid | 293,000 | 412,000 | +40.6% |
| Fortress Shield | shield | melee | 291,000 | 380,000 | +30.6% |
| Laser Rifle | two | short | 243,000 | 335,000 | +37.9% |
| Gauss Pistol | one | long | 291,000 | 335,000 | +15.1% |
| Grenade Launcher | two | mid | 293,000 | 318,000 | +8.5% |
| Thermal Lance | two | melee | 279,000 | 306,000 | +9.7% |
| Pulse Accelerator | two | short | 273,000 | 291,000 | +6.6% |
| Plasma Rifle | one | short | 258,000 | 286,000 | +10.9% |
| Plasma Blade | one | melee | 202,000 | 273,000 | +35.1% |
| Shotgun | two | mid | 283,000 | 263,000 | −7.1% |
| Barrier Shield | shield | melee | 111,000 | 253,000 | +127.9% |
| Energy Blade | one | melee | 175,000 | 222,000 | +26.9% |
| Reactive Shield | shield | melee | 92,000 | 211,000 | +129.3% |
| Shock Maul | two | melee | 183,000 | 211,000 | +15.3% |
| Flux Repeater | one | mid | 147,000 | 186,000 | +26.5% |
| Photon Marksman | one | long | 147,000 | 186,000 | +26.5% |
| Combat Shield | shield | melee | 78,000 | 159,000 | +103.8% |
| Burst Rifle | one | short | 117,000 | 150,000 | +28.2% |
| Mortar System | two | mid | 163,000 | 150,000 | −8.0% |
| Siege Cannon | two | long | 163,000 | 150,000 | −8.0% |
| Machine Gun | one | short | 107,000 | 138,000 | +29.0% |
| Machine Pistol | one | short | 94,000 | 100,000 | +6.4% |
| Combat Knife | one | melee | 93,000 | 96,000 | +3.2% |
| Bolt Carbine | one | mid | 93,000 | 96,000 | +3.2% |
| Beam Pistol | one | long | 93,000 | 96,000 | +3.2% |
| War Club | two | melee | 84,000 | 82,000 | −2.4% |
| Scatter Cannon | two | short | 84,000 | 82,000 | −2.4% |
| Light Shield | shield | melee | 51,000 | 81,000 | +58.8% |
| Laser Pistol | one | short | 57,000 | 63,000 | +10.5% |
| Practice Sword | one | melee | 50,000 | 50,000 | 0.0% |
| Practice Blaster | one | short | 50,000 | 50,000 | 0.0% |
| Training Rifle | two | mid | 50,000 | 50,000 | 0.0% |
| Training Beam | two | long | 50,000 | 50,000 | 0.0% |
| **Total (47)** | | | **10,999,000** | **14,014,000** | **+27.4%** |

Owners keep their `pricePaid`, so resale value of weapons already bought does not change.

## Weapons Workshop discount

| Value | Old | New |
|---|---|---|
| Purchase discount | 10% per level (L10 = 100%, free) | 5% per level (L10 = 50%) |
| Resale rate (of `pricePaid`) | 10% per level | 10% per level (unchanged) |

The discount lives only in `calculateWeaponWorkshopDiscount` (`app/shared/utils/discounts.ts`); the duplicate
implementations in the comparison modal and the ROI/recommendation services now call it.

## Refinement Lab (new facility) and facility categories

- **Refinement Lab** (`refinement_lab`): takes over the refinement tier gates from the Weapons Workshop. Gates
  unchanged: Hone L1, Augment L3, Sharpen L5, Forge L8 (L9–L10 unlock nothing new). 10 levels, ₡75,000–₡750,000 per
  level, prestige gates `PRESTIGE_GATES_10`, operating cost ₡100 × level per day (mirrors the Workshop).
- **Weapons Workshop** keeps the purchase discount and the resale rate; it no longer gates refinement.
- **Grant migration** `20261016120000_grant_refinement_lab` (one-off, idempotent, no schema change): every stable gets
  the Refinement Lab at its current Weapons Workshop level (Workshop level > 0), so no unlocked tier is lost. No ledger
  rows (a grant is not a purchase). No compatibility code remains in services.
- **Facility categories (14 facilities, 4-4-4-2)**:

| Category | Old | New |
|---|---|---|
| Economy (was "Economy & Discounts") | Repair Bay, Training Facility, Weapons Workshop, Merchandising Hub, Streaming Studio | Repair Bay, Training Facility, Merchandising Hub, Streaming Studio |
| Hangar & Armory (was "Capacity & Storage") | Roster Expansion, Storage Facility | Roster Expansion, Storage Facility, Weapons Workshop, Refinement Lab |
| Training Academies | 4 academies | unchanged |
| Tactical & Advanced | Tuning Bay, Booking Office | unchanged |

## #522 King of the Hill zone

| Value | Old | New |
|---|---|---|
| Default zone radius | 5 | 7 |
| Radius on new matches | not stored (orchestrator fell back to the default) | written at scheduling (`scheduled_matches_v2.zone_radius`); a match without a radius fails with `INVALID_BATTLE_STATE` |
| Arena radius, score threshold, time limit, kill bonus, allowed radius range | 14, 30, 150 s, 5, 3–8 | unchanged |

- **Backfill migration** `20261016121000_backfill_koth_zone_radius` (one-off, idempotent): sets radius 7 on KotH
  matches that are still `scheduled` and have no radius.
- **Rotating-zone removal**: all leftovers of the variant abolished in Spec #41 (`generateNextZonePosition`, zone
  transition fields and defaults, `zone_moving`/`zone_active` events and their combat message templates and
  generators, playback transition rendering, the "fixed and
  rotating zone variants" guide text) were verified unreachable and removed. No gameplay change: every match already
  used the fixed centre zone.

## #523 Grand Melee

No change. The 89–100% timeout rates in the baseline came from uniform-level harness builds; with equal-investment
builds the combined arm times out in 12.7% of Grand Melees (mid budget), and the ~10 ACC Grand Melees the product owner
checked all ended by elimination. Re-assess melee/shield dominance in placements with ACC results after Season 2
starts.

## Economy (#524, #525, #526, #527)

Streaming formula v2 (battles and Fame additive, Streaming Studio +50% per level, no caps), Merchandising Hub
₡25,000 per level, a flat 6% per level Repair Bay discount for every roster size, the Training Facility discount
× 0.75 (67.5% max), and team credit pools × 0.75 (tag team/2v2 1.5×, 3v3 2.25× a solo reward). Details, old values,
deploy notes and the 1/3/10-robot comparison are in [SEASON_2_ECONOMY_REBALANCE.md](SEASON_2_ECONOMY_REBALANCE.md).

## Rejected or omitted levers

- No coefficient was tuned after measurement; no tuning-config layer, feature flags or variants were added.
- Hydraulic Systems cap at 50 (issue proposal): rejected, no caps.
- Shield price discount and Workshop "free at L10": replaced by the decided values above.
- Reserve lever from #516 (lower Vibro Mace / Power Sword Hydraulic Systems bonus if still an outlier): not used; the
  harness does not measure per-weapon outliers.

## Deploy notes

- ACC deploy runs `prisma migrate deploy` and then `prisma db seed`: both migrations run once, and the seed upserts
  every weapon by name, so all owners get the new catalogue values immediately.
- The production job runs `prisma migrate deploy` only. The new catalogue (prices, Fortress/Aegis values) reaches
  production only if `prisma db seed` is run there. The workflow was not changed.
- If the deploy lands after a season rollover (facilities reset to L0), the Refinement Lab grant inserts nothing; on
  ACC mid-season it grants for the rest of the season.

## Side effects (recorded, not changed)

- Stables with Workshop L3+ receive a Lab at L3+, which counts toward achievements E10 (3 facilities at L3+) and E11
  (5 facilities at L3+); the next facility-count check can unlock them with their rewards.
- Workshop L9/L10 owners receive Lab L9/L10, which unlock nothing beyond L8.
- Every granted stable pays the Lab operating cost (₡100 × level per day, up to ₡1,000) from the next settlement.
  Generated bots and Automaton stables with a Workshop are granted too.
- Generated bots pick weapons by price tier, so their weapon pools shift with the new prices (for example Machine
  Pistol and Combat/Reactive Shield move to AverageBot, Barrier Shield to ExpertBot).
- Combat formula breakdowns always contain `× X.XX logic` after the hydraulic factor (primary attacks and counters).

## Player announcement

One line per change, for the Season 2 changelog entry (authored in the admin portal):

### Bug fixes

- Fixed a bug where loadout bonuses (Single, Weapon+Shield, Two-Handed, Dual Wield) showed on the robot page but weren't applied in battle; they now apply
- Fixed a bug that let melee weapons hit from beyond melee reach
- Fixed a bug that made weapon penalties raise a weapon's price: negative bonuses now lower it
- Fixed a bug where a fast ranged robot could keep a melee robot out of reach forever, and where turn order within a battle could decide who got to attack
- Fixed: missed attacks no longer reset a robot's patience timer; only landed hits do
- Fixed: energy melee weapons (Shock Maul, Thermal Lance) now chase ranged robots like other melee weapons
- Fixed: one failed match no longer stalls a whole round; that match is cancelled and the rest carry on
- Tag team: a team that isn't battle-ready now forfeits (the opponent wins) instead of the match being cancelled
- Team tournaments: a team that can't play its match now forfeits and the opponent advances with bye rewards; if neither team can play, the higher seed advances instead of nobody
- New: the dashboard warns you when a robot with booked matches would forfeit or fight with an incomplete loadout, and unequipping a weapon from a robot with booked matches asks for confirmation first

### Combat

- Chasing is now faster than kiting: a melee robot chasing moves 15% faster, a ranged robot backing away 10% faster (chasing was +30% plus a catch-up bonus); with equal Servo Motors the chaser slowly closes in
- Defensive stance now slows a robot to 80% speed while chasing too (was 95%)
- New: a melee robot that hasn't landed a hit within its patience window (15 s, down to 10 s with Combat Algorithms) charges 30% faster until it reaches its target
- New: 2.5 s after a ranged robot is first hit in melee, it breaks away 30% faster for 2 s + 0.04 s per Evasion Thrusters point, then needs one patience window to recharge, so melee always gets a real exchange
- Robots backing into the arena wall now slide along it instead of getting stuck
- Hydraulic Systems nerfed: up to +75% melee and +50% short-range damage at level 50 (was +100% / +75%)
- Logic Cores buffed: now adds up to +75% long-range and +50% mid-range damage at level 50, also on long-range counter-attacks

### Loadouts & weapons

- A robot without a main weapon now forfeits its match instead of fighting unarmed (last place in King of the Hill and Grand Melee); an incomplete Dual Wield or Weapon+Shield loadout fights as Single for that battle
- Weapon+Shield nerfed: Shield Capacity +15% (was +20%) and Armor Plating +10% (was +15%)
- Single loadout buffed: Gyro Stabilizers +15% (was +10%) and Servo Motors +10% (was +5%)
- Fortress Shield nerfed: Armor Plating +11, Shield Capacity +10, Counter Protocols +8 (was +15 / +14 / +10)
- Aegis Bulwark nerfed: Armor Plating +11, Shield Capacity +11, Counter Protocols +10, Power Core +8 (was +15 / +15 / +14 / +11)
- Weapon prices recalculated: the catalogue costs 27% more in total, high-end weapons and shields the most, a few two-handed weapons less; practice weapons stay ₡50,000
- Shields now cost a premium (×1.3, was a ×0.9 discount); two-handed weapons ×1.5 (was ×1.6)

### Facilities

- New facility: Refinement Lab, which unlocks the refinement tiers (Hone L1, Augment L3, Sharpen L5, Forge L8) and costs ₡100 per level per day to run
- You received a Refinement Lab at your current Weapons Workshop level, so you keep every refinement tier you had unlocked
- Weapons Workshop no longer unlocks refinement; it keeps its purchase discount and resale rate
- Weapons Workshop discount: now 5% per level (max 50%, was 10% per level up to free); resale unchanged
- Facility categories reorganised: Economy, Hangar & Armory (now with Weapons Workshop and Refinement Lab), Training Academies, Tactical & Advanced

### Economy

- Streaming Studio nerfed: +50% streaming per level (was +100%), so Level 10 is 6× (was 11×)
- Streaming audience: battles and Fame now add up instead of multiplying; a 552-battle, 10,492-Fame robot with a Level 9 Studio earns ₡12,788 per battle (was ₡48,087)
- Merchandising Hub buffed: ₡25,000 per level per day (was ₡10,000); Prestige still counts per robot slot
- Repair Bay: 6% discount per level for every stable (60% at Level 10); extra robots no longer raise it (was up to 90%)
- Guide fix: Repair Bay upkeep is ₡1,000/day at Level 1 plus ₡500 per extra level (unchanged; the guide said ₡100 per level)
- Training Facility discount reduced by a quarter: up to 67.5% (was 90%); 6.75% per level with one robot slot (was 9%)
- Team modes pay 25% less credits: tag team/2v2 pools 1.5× a solo reward (was 2×), 3v3 2.25× (was 3×); team tournaments and team byes likewise. Solo rewards, streaming, fame, prestige and LP are unchanged

### King of the Hill

- Control zone radius 5 → 7 (arena, 30-point target, 150 s limit and kill bonus unchanged)
- Byes now pay the match's tier reward (Silver ₡3,000 up to Champion ₡45,000) instead of always the Bronze reward
- The guide no longer mentions rotating zones; every match uses the fixed centre zone, as before
