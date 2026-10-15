# Loadout Parity Correction (#517)

**Effective season**: Season 2 preparation window (applies from the first Season 2 battle).
**Issue**: [#517](https://github.com/RobertTeunissen/ArmouredSouls/issues/517), parent release gate [#516](https://github.com/RobertTeunissen/ArmouredSouls/issues/516).
**Source**: branch `fix/season2-combat-baseline`, base `8a9de7ba` + the #517 commit (`fix(combat): apply loadout modifiers in combat preparation`).

## What changed

`prepareRobotForCombat()` computed `base + both weapons' bonuses + tuning` but never applied the loadout attribute
modifiers (`LOADOUT_BONUSES`), although the stat screen and the stored max HP/shield did. Every battle mode
(league 1v1, tag team, 2v2/3v3, solo and team tournaments, KotH, Grand Melee, Practice Arena) therefore fought with
loadout-less attributes. Combat preparation now uses the shared canonical formula
(`calculateCombatEffectiveStats` in `app/shared/utils/robotStats.ts`):

```
effective = round2((base + main weapon bonus + offhand weapon bonus + tuning) × (1 + loadout modifier))
maxHP     = 50 + effective hullIntegrity × 5
maxShield = effective shieldCapacity × 4
```

Old value → new value, per loadout (attribute multiplier in combat):

| Loadout | Before (combat) | After (combat) |
|---|---|---|
| Single | ×1.00 everywhere | Gyro Stabilizers ×1.10, Servo Motors ×1.05 |
| Weapon+Shield | ×1.00 everywhere | Shield Capacity ×1.20 (and max shield), Armor Plating ×1.15, Counter Protocols ×1.10, Attack Speed ×0.85 |
| Two-Handed | ×1.00 everywhere | Combat Power ×1.10, Critical Systems ×1.20, Evasion Thrusters ×0.90 |
| Dual Wield | ×1.00 everywhere | Attack Speed ×1.30, Weapon Control ×1.15, Penetration ×0.80, Combat Power ×0.90 |

The formula-level loadout effects were already active and are unchanged: Two-Handed ×1.10 damage, ×2.5 crit
multiplier and +10 crit chance; Dual Wield ×0.90 damage; Weapon+Shield ×1.10 counter chance. They now **stack** with
the attribute modifiers, as COMBAT_FORMULAS.md always described. No weapon base damage was changed to compensate.

Preparation is also idempotent per robot object now: a second call does not compound bonuses, re-fold
refinements or restore a damaged robot's HP/shield (tag-team phases never re-prepared, but nothing prevented it).

## Why

The displayed effective stats, the stored max HP/shield and the combat values disagreed, so balance comparisons
against displayed attributes (e.g. shield and Dual Wield outcomes) were unreliable. This corrected baseline must be
compared separately before #521 or any other tuning.

## Corrected baseline

Command (from `app/backend`, no database used):

```
pnpm exec tsx scripts/loadoutParityBaseline.ts --trials 2000 --out <file>
```

Dataset and limits:

- Synthetic 1v1 builds: all 23 attributes at a uniform level (1, 10, 25), balanced stance, yield threshold 10, no
  tuning, no refinements. Not representative of real stables.
- Weapons from the seed catalogue. Melee family: Single/Dual Wield Energy Blade, Weapon+Shield Energy Blade + Combat
  Shield, Two-Handed Battle Axe. Short family: Laser Pistol / ×2 / + Combat Shield, Two-Handed Laser Rifle. Weapon
  costs are **not** equalised.
- 1v1 only. Multi-mode and equal-investment runs belong to #516 steps 3/4.
- `legacy` = the pre-#517 preparation (inlined in the script, comparison only); `corrected` = `prepareRobotForCombat`.
- Side A is listed first; sides are swapped every other trial. "win A" counts side-A wins over all trials (draws are
  separate, so a mirror sits at roughly (100% − draws) / 2). Timeouts = duration ≥ 120 s. Damage = mean damage dealt.

Notable shifts (legacy → corrected):

- Melee, level 25, Weapon+Shield mirror: timeouts 0.2% → 23.1%, mean duration 70.5 s → 99.7 s.
- Melee, level 25, Single vs Weapon+Shield: Single wins 20.4% → 7.5%.
- Melee, level 25, Two-Handed vs Dual Wield: Two-Handed wins 63.2% → 54.7%.
- Short, level 25, Dual Wield mirror: timeouts 46.7% → 4.6%; Single vs Dual Wield timeouts 86.7% → 67.3%.
- Short, level 1, Weapon+Shield vs Dual Wield: Weapon+Shield wins 51.0% → 61.8%.
- Short range at levels 10 and 25 still times out heavily for Single/Weapon+Shield pairings under both variants; that
  is a pre-existing pattern, not introduced by this correction.

### Results (2000 trials per cell)

Trials per cell: 2000. Win A = side-A wins / trials; draws counted separately.


#### melee weapons, attribute level 1

| A vs B | variant | win A (95% CI) | draws | dmg A | dmg B | timeouts | mean s |
|---|---|---|---|---|---|---|---|
| single vs single | legacy | 46.3% (44.1%–48.5%) | 7.5% | 50.9 | 51.0 | 0.0% | 22.6 |
| single vs single | corrected | 45.3% (43.1%–47.4%) | 8.1% | 50.8 | 51.2 | 0.0% | 22.7 |
| single vs weapon_shield | legacy | 14.8% (13.4%–16.5%) | 0.8% | 55.2 | 58.2 | 0.0% | 25.6 |
| single vs weapon_shield | corrected | 14.3% (12.8%–15.9%) | 0.1% | 55.4 | 58.1 | 0.0% | 26.3 |
| single vs two_handed | legacy | 28.0% (26.0%–30.0%) | 0.0% | 38.1 | 57.0 | 0.0% | 18.3 |
| single vs two_handed | corrected | 24.1% (22.3%–26.1%) | 0.0% | 36.9 | 56.4 | 0.0% | 17.6 |
| single vs dual_wield | legacy | 13.8% (12.3%–15.3%) | 0.1% | 34.7 | 58.0 | 0.0% | 16.5 |
| single vs dual_wield | corrected | 10.6% (9.3%–12.0%) | 0.4% | 33.4 | 58.2 | 0.0% | 15.5 |
| weapon_shield vs weapon_shield | legacy | 46.6% (44.4%–48.8%) | 3.0% | 72.1 | 72.9 | 0.0% | 33.4 |
| weapon_shield vs weapon_shield | corrected | 48.6% (46.4%–50.8%) | 2.1% | 76.2 | 76.6 | 0.0% | 36.2 |
| weapon_shield vs two_handed | legacy | 53.0% (50.8%–55.2%) | 0.1% | 48.8 | 65.6 | 0.0% | 22.2 |
| weapon_shield vs two_handed | corrected | 58.8% (56.6%–60.9%) | 0.7% | 51.1 | 69.6 | 0.0% | 23.9 |
| weapon_shield vs dual_wield | legacy | 44.0% (41.8%–46.1%) | 0.1% | 47.6 | 72.3 | 0.0% | 21.6 |
| weapon_shield vs dual_wield | corrected | 36.7% (34.6%–38.8%) | 0.9% | 46.1 | 76.4 | 0.0% | 21.4 |
| two_handed vs two_handed | legacy | 50.7% (48.5%–52.9%) | 0.0% | 47.3 | 46.6 | 0.0% | 15.1 |
| two_handed vs two_handed | corrected | 48.8% (46.6%–51.0%) | 1.5% | 46.3 | 46.8 | 0.0% | 15.0 |
| two_handed vs dual_wield | legacy | 41.2% (39.1%–43.4%) | 0.4% | 42.9 | 49.8 | 0.0% | 14.5 |
| two_handed vs dual_wield | corrected | 41.5% (39.4%–43.7%) | 1.7% | 43.2 | 50.3 | 0.0% | 13.9 |
| dual_wield vs dual_wield | legacy | 45.0% (42.8%–47.2%) | 7.6% | 49.7 | 50.4 | 0.0% | 14.2 |
| dual_wield vs dual_wield | corrected | 45.3% (43.1%–47.4%) | 7.1% | 49.7 | 50.1 | 0.0% | 13.5 |


#### melee weapons, attribute level 10

| A vs B | variant | win A (95% CI) | draws | dmg A | dmg B | timeouts | mean s |
|---|---|---|---|---|---|---|---|
| single vs single | legacy | 48.5% (46.3%–50.7%) | 1.8% | 203.6 | 204.2 | 0.0% | 51.8 |
| single vs single | corrected | 48.0% (45.9%–50.2%) | 1.8% | 203.4 | 203.6 | 0.0% | 51.6 |
| single vs weapon_shield | legacy | 19.1% (17.4%–20.9%) | 1.4% | 215.4 | 225.9 | 0.1% | 55.4 |
| single vs weapon_shield | corrected | 9.8% (8.6%–11.2%) | 0.9% | 218.3 | 232.4 | 0.1% | 56.6 |
| single vs two_handed | legacy | 8.1% (7.0%–9.4%) | 0.1% | 122.7 | 194.0 | 0.0% | 33.3 |
| single vs two_handed | corrected | 6.8% (5.8%–8.0%) | 0.3% | 117.8 | 190.8 | 0.0% | 31.9 |
| single vs dual_wield | legacy | 3.2% (2.5%–4.1%) | 0.1% | 114.6 | 186.4 | 0.0% | 30.0 |
| single vs dual_wield | corrected | 1.9% (1.4%–2.6%) | 0.1% | 104.0 | 182.1 | 0.0% | 27.1 |
| weapon_shield vs weapon_shield | legacy | 47.1% (44.9%–49.3%) | 2.1% | 259.6 | 261.4 | 0.2% | 65.0 |
| weapon_shield vs weapon_shield | corrected | 49.3% (47.1%–51.5%) | 2.2% | 301.6 | 299.3 | 0.9% | 75.0 |
| weapon_shield vs two_handed | legacy | 18.6% (17.0%–20.4%) | 0.3% | 149.7 | 222.5 | 0.0% | 39.2 |
| weapon_shield vs two_handed | corrected | 25.4% (23.5%–27.3%) | 0.3% | 163.5 | 240.3 | 0.0% | 42.1 |
| weapon_shield vs dual_wield | legacy | 11.2% (9.9%–12.7%) | 0.4% | 144.1 | 221.9 | 0.0% | 36.6 |
| weapon_shield vs dual_wield | corrected | 13.3% (11.8%–14.8%) | 0.4% | 148.4 | 237.3 | 0.0% | 36.6 |
| two_handed vs two_handed | legacy | 48.4% (46.2%–50.5%) | 1.1% | 151.7 | 153.4 | 0.0% | 27.3 |
| two_handed vs two_handed | corrected | 50.2% (48.1%–52.4%) | 1.6% | 150.2 | 149.4 | 0.0% | 25.9 |
| two_handed vs dual_wield | legacy | 48.9% (46.8%–51.1%) | 0.2% | 150.6 | 154.5 | 0.0% | 26.1 |
| two_handed vs dual_wield | corrected | 42.1% (40.0%–44.3%) | 0.2% | 140.0 | 155.6 | 0.0% | 23.8 |
| dual_wield vs dual_wield | legacy | 49.4% (47.2%–51.6%) | 2.4% | 159.8 | 158.6 | 0.0% | 25.9 |
| dual_wield vs dual_wield | corrected | 46.7% (44.5%–48.8%) | 3.7% | 155.0 | 156.2 | 0.0% | 23.2 |


#### melee weapons, attribute level 25

| A vs B | variant | win A (95% CI) | draws | dmg A | dmg B | timeouts | mean s |
|---|---|---|---|---|---|---|---|
| single vs single | legacy | 48.5% (46.4%–50.7%) | 2.9% | 589.3 | 589.1 | 0.1% | 60.8 |
| single vs single | corrected | 48.2% (46.0%–50.4%) | 2.4% | 591.2 | 593.5 | 0.1% | 61.5 |
| single vs weapon_shield | legacy | 20.4% (18.7%–22.2%) | 2.1% | 612.9 | 627.5 | 0.0% | 63.1 |
| single vs weapon_shield | corrected | 7.5% (6.4%–8.7%) | 1.3% | 683.4 | 684.1 | 1.2% | 71.5 |
| single vs two_handed | legacy | 1.8% (1.3%–2.4%) | 0.1% | 289.0 | 459.7 | 0.0% | 33.3 |
| single vs two_handed | corrected | 1.1% (0.7%–1.7%) | 0.0% | 277.3 | 451.5 | 0.0% | 31.6 |
| single vs dual_wield | legacy | 1.1% (0.7%–1.7%) | 0.1% | 312.7 | 456.4 | 0.0% | 32.9 |
| single vs dual_wield | corrected | 0.3% (0.1%–0.7%) | 0.0% | 278.5 | 434.9 | 0.0% | 29.1 |
| weapon_shield vs weapon_shield | legacy | 49.5% (47.4%–51.7%) | 2.6% | 702.4 | 701.5 | 0.2% | 70.5 |
| weapon_shield vs weapon_shield | corrected | 40.3% (38.2%–42.5%) | 22.1% | 961.4 | 959.3 | 23.1% | 99.7 |
| weapon_shield vs two_handed | legacy | 2.9% (2.3%–3.8%) | 0.1% | 339.2 | 523.1 | 0.0% | 37.9 |
| weapon_shield vs two_handed | corrected | 5.3% (4.4%–6.4%) | 0.3% | 387.2 | 608.3 | 0.0% | 43.9 |
| weapon_shield vs dual_wield | legacy | 6.4% (5.4%–7.6%) | 0.2% | 377.0 | 524.9 | 0.0% | 38.4 |
| weapon_shield vs dual_wield | corrected | 6.5% (5.5%–7.7%) | 0.4% | 387.1 | 575.8 | 0.0% | 38.9 |
| two_handed vs two_handed | legacy | 49.5% (47.4%–51.7%) | 1.8% | 377.9 | 375.8 | 0.0% | 28.9 |
| two_handed vs two_handed | corrected | 50.4% (48.3%–52.6%) | 1.8% | 366.1 | 361.5 | 0.0% | 26.8 |
| two_handed vs dual_wield | legacy | 63.2% (61.1%–65.3%) | 1.0% | 391.0 | 363.9 | 0.0% | 27.4 |
| two_handed vs dual_wield | corrected | 54.7% (52.5%–56.9%) | 0.4% | 359.8 | 357.2 | 0.0% | 24.2 |
| dual_wield vs dual_wield | legacy | 49.0% (46.9%–51.2%) | 3.4% | 393.3 | 391.5 | 0.0% | 27.7 |
| dual_wield vs dual_wield | corrected | 47.0% (44.8%–49.2%) | 4.2% | 373.4 | 373.7 | 0.0% | 23.7 |


#### short weapons, attribute level 1

| A vs B | variant | win A (95% CI) | draws | dmg A | dmg B | timeouts | mean s |
|---|---|---|---|---|---|---|---|
| single vs single | legacy | 45.7% (43.5%–47.9%) | 6.2% | 54.0 | 54.5 | 0.0% | 38.4 |
| single vs single | corrected | 48.1% (46.0%–50.3%) | 5.2% | 54.2 | 53.8 | 0.0% | 38.2 |
| single vs weapon_shield | legacy | 9.6% (8.4%–11.0%) | 1.7% | 57.2 | 61.8 | 0.0% | 42.3 |
| single vs weapon_shield | corrected | 6.3% (5.3%–7.5%) | 0.9% | 57.8 | 62.3 | 0.0% | 42.4 |
| single vs two_handed | legacy | 6.3% (5.3%–7.4%) | 0.1% | 32.6 | 63.1 | 0.0% | 24.1 |
| single vs two_handed | corrected | 7.8% (6.7%–9.0%) | 0.1% | 33.2 | 62.9 | 0.0% | 24.3 |
| single vs dual_wield | legacy | 13.9% (12.4%–15.4%) | 1.6% | 40.8 | 58.1 | 0.0% | 29.1 |
| single vs dual_wield | corrected | 14.5% (13.1%–16.2%) | 1.9% | 40.8 | 57.8 | 0.0% | 29.2 |
| weapon_shield vs weapon_shield | legacy | 49.8% (47.6%–51.9%) | 4.7% | 76.5 | 75.8 | 0.0% | 54.8 |
| weapon_shield vs weapon_shield | corrected | 47.9% (45.7%–50.0%) | 4.2% | 81.6 | 81.9 | 0.0% | 58.8 |
| weapon_shield vs two_handed | legacy | 28.1% (26.2%–30.2%) | 0.3% | 45.5 | 77.1 | 0.0% | 31.8 |
| weapon_shield vs two_handed | corrected | 33.6% (31.5%–35.6%) | 0.6% | 47.8 | 80.5 | 0.0% | 33.5 |
| weapon_shield vs dual_wield | legacy | 51.0% (48.8%–53.2%) | 3.5% | 54.9 | 71.5 | 0.0% | 37.9 |
| weapon_shield vs dual_wield | corrected | 61.8% (59.6%–63.9%) | 3.0% | 56.8 | 73.5 | 0.0% | 38.8 |
| two_handed vs two_handed | legacy | 48.6% (46.5%–50.8%) | 1.8% | 51.2 | 51.1 | 0.0% | 20.5 |
| two_handed vs two_handed | corrected | 48.9% (46.8%–51.1%) | 1.4% | 51.1 | 51.3 | 0.0% | 20.2 |
| two_handed vs dual_wield | legacy | 70.0% (68.0%–72.0%) | 0.3% | 57.4 | 42.5 | 0.0% | 22.4 |
| two_handed vs dual_wield | corrected | 70.9% (68.8%–72.8%) | 0.1% | 58.0 | 42.4 | 0.0% | 22.1 |
| dual_wield vs dual_wield | legacy | 47.1% (44.9%–49.3%) | 5.1% | 51.0 | 51.0 | 0.0% | 25.8 |
| dual_wield vs dual_wield | corrected | 46.1% (43.9%–48.3%) | 4.6% | 50.4 | 50.9 | 0.0% | 25.7 |


#### short weapons, attribute level 10

| A vs B | variant | win A (95% CI) | draws | dmg A | dmg B | timeouts | mean s |
|---|---|---|---|---|---|---|---|
| single vs single | legacy | 10.8% (9.6%–12.3%) | 77.3% | 289.9 | 290.7 | 77.2% | 115.9 |
| single vs single | corrected | 10.7% (9.4%–12.1%) | 77.8% | 289.8 | 289.4 | 77.8% | 116.1 |
| single vs weapon_shield | legacy | 0.9% (0.5%–1.4%) | 83.5% | 293.5 | 298.6 | 83.5% | 117.1 |
| single vs weapon_shield | corrected | 0.0% (0.0%–0.2%) | 86.1% | 295.2 | 299.3 | 86.1% | 118.0 |
| single vs two_handed | legacy | 0.1% (0.0%–0.4%) | 0.1% | 127.6 | 227.8 | 0.1% | 51.5 |
| single vs two_handed | corrected | 0.2% (0.1%–0.5%) | 0.1% | 124.3 | 226.0 | 0.1% | 50.4 |
| single vs dual_wield | legacy | 1.7% (1.2%–2.3%) | 1.7% | 189.4 | 267.3 | 1.7% | 74.7 |
| single vs dual_wield | corrected | 0.5% (0.3%–1.0%) | 0.9% | 177.7 | 262.3 | 0.9% | 71.6 |
| weapon_shield vs weapon_shield | legacy | 0.9% (0.5%–1.4%) | 98.0% | 304.0 | 305.4 | 98.0% | 119.9 |
| weapon_shield vs weapon_shield | corrected | 0.0% (0.0%–0.2%) | 99.9% | 307.8 | 308.3 | 99.9% | 120.1 |
| weapon_shield vs two_handed | legacy | 1.4% (1.0%–2.0%) | 0.5% | 166.8 | 284.6 | 0.8% | 65.2 |
| weapon_shield vs two_handed | corrected | 2.4% (1.8%–3.2%) | 1.8% | 183.0 | 316.9 | 2.1% | 71.6 |
| weapon_shield vs dual_wield | legacy | 7.6% (6.6%–8.9%) | 18.9% | 249.1 | 339.3 | 18.6% | 96.8 |
| weapon_shield vs dual_wield | corrected | 9.8% (8.6%–11.2%) | 23.3% | 262.5 | 373.2 | 25.4% | 102.2 |
| two_handed vs two_handed | legacy | 50.7% (48.5%–52.9%) | 1.5% | 184.1 | 182.4 | 0.0% | 41.2 |
| two_handed vs two_handed | corrected | 49.9% (47.7%–52.0%) | 1.7% | 180.9 | 182.1 | 0.0% | 40.1 |
| two_handed vs dual_wield | legacy | 83.9% (82.2%–85.4%) | 0.3% | 216.7 | 171.3 | 0.0% | 49.1 |
| two_handed vs dual_wield | corrected | 83.9% (82.2%–85.4%) | 0.7% | 211.2 | 168.1 | 0.0% | 45.7 |
| dual_wield vs dual_wield | legacy | 49.7% (47.5%–51.9%) | 0.9% | 229.1 | 229.1 | 0.1% | 64.3 |
| dual_wield vs dual_wield | corrected | 48.6% (46.4%–50.8%) | 0.9% | 222.7 | 223.2 | 0.0% | 60.1 |


#### short weapons, attribute level 25

| A vs B | variant | win A (95% CI) | draws | dmg A | dmg B | timeouts | mean s |
|---|---|---|---|---|---|---|---|
| single vs single | legacy | 0.0% (0.0%–0.2%) | 100.0% | 647.8 | 649.9 | 100.0% | 120.1 |
| single vs single | corrected | 0.0% (0.0%–0.2%) | 100.0% | 614.1 | 614.0 | 100.0% | 120.1 |
| single vs weapon_shield | legacy | 0.0% (0.0%–0.2%) | 100.0% | 654.5 | 664.5 | 100.0% | 120.1 |
| single vs weapon_shield | corrected | 0.0% (0.0%–0.2%) | 100.0% | 632.8 | 612.9 | 100.0% | 120.1 |
| single vs two_handed | legacy | 0.0% (0.0%–0.2%) | 8.8% | 461.0 | 762.5 | 9.8% | 84.3 |
| single vs two_handed | corrected | 0.0% (0.0%–0.2%) | 8.7% | 447.9 | 748.2 | 9.7% | 81.9 |
| single vs dual_wield | legacy | 0.0% (0.0%–0.2%) | 85.9% | 647.4 | 883.3 | 86.7% | 117.9 |
| single vs dual_wield | corrected | 0.0% (0.0%–0.2%) | 67.3% | 627.3 | 903.9 | 67.3% | 114.5 |
| weapon_shield vs weapon_shield | legacy | 0.0% (0.0%–0.2%) | 100.0% | 671.3 | 670.8 | 100.0% | 120.1 |
| weapon_shield vs weapon_shield | corrected | 0.0% (0.0%–0.2%) | 100.0% | 644.4 | 646.7 | 100.0% | 120.1 |
| weapon_shield vs two_handed | legacy | 0.0% (0.0%–0.2%) | 30.3% | 564.9 | 906.4 | 32.4% | 100.3 |
| weapon_shield vs two_handed | corrected | 0.0% (0.0%–0.2%) | 44.8% | 586.6 | 1012.9 | 46.6% | 105.6 |
| weapon_shield vs dual_wield | legacy | 0.0% (0.0%–0.2%) | 99.0% | 669.0 | 901.5 | 99.1% | 120.0 |
| weapon_shield vs dual_wield | corrected | 0.0% (0.0%–0.2%) | 99.9% | 630.2 | 963.1 | 99.9% | 120.1 |
| two_handed vs two_handed | legacy | 48.6% (46.4%–50.8%) | 2.8% | 612.8 | 612.5 | 0.4% | 65.8 |
| two_handed vs two_handed | corrected | 50.1% (48.0%–52.3%) | 1.9% | 582.7 | 579.4 | 0.0% | 60.3 |
| two_handed vs dual_wield | legacy | 90.3% (89.0%–91.6%) | 5.0% | 741.3 | 621.8 | 5.8% | 81.0 |
| two_handed vs dual_wield | corrected | 90.9% (89.6%–92.1%) | 0.5% | 664.8 | 563.6 | 0.4% | 67.9 |
| dual_wield vs dual_wield | legacy | 27.0% (25.1%–28.9%) | 45.6% | 858.0 | 859.5 | 46.7% | 109.2 |
| dual_wield vs dual_wield | corrected | 46.6% (44.4%–48.8%) | 6.2% | 769.9 | 769.9 | 4.6% | 89.4 |
