# Next Season Balance Validation (#516)

Validation record for the Season 2 balance package ([#516](https://github.com/RobertTeunissen/ArmouredSouls/issues/516)).
Sections are added per release-gate step; this file starts with step 2.

## Corrected combat baseline (#517, #518)

**Status**: measured, no coefficients tuned. Tuning belongs to #519, #520 and #521.
**Measured on**: branch `fix/season2-combat-baseline`, October 2026.
**Harness**: `app/backend/scripts/combatBaselineValidation.ts` (new; see "Why a new harness").

### Summary

- **#517 (loadout modifiers in combat)** is the fix that moves outcomes. Weapon+Shield gains +2.1 to +3.2 pp of 1v1 score
  against other loadouts, and Single loses 1.2 to 2.5 pp. Melee loses 1.0 to 2.5 pp against other range classes. In
  Grand Melee, Weapon+Shield ranks better and Dual Wield worse (normalized rank −0.038 and +0.034 at level 25).
  Battles get slightly longer: 1v1 timeouts rise by up to +2.3 pp.
- **#518 (hard melee reach)** removes every melee attack resolved beyond 2 units: 0.97 to 4.45 per battle where they
  occurred, 0 after. It barely changes results. In uniform 1v1 at levels 1 and 10 it changes essentially nothing:
  melee always closes the gap, so beyond-reach attacks were ≈0.00 per battle. Where it applies (level 25, kiters,
  Grand Melee) melee loses 18 to 54 damage per battle. Even so, 1v1 score deltas stay ≤ +0.5 pp and Grand Melee rank
  deltas ≤ 0.009. No-contact battles stay at 0.00%. Aggregate timeouts rise by at most +0.4 ±0.3 pp.
- **Combined** effects are close to the sum of the two isolated effects. The corrected baseline still has the
  existing problems: in 1v1, melee scores 62–79% against other range classes and long range 20–34%. The 1v1 timeout rate
  is 47% at level 25 (78% against kiters). Grand Melee times out in 89% of battles at level 10 and 100% at level 25.
  These issues existed before; neither fix caused them. They are the starting point for #519/#520/#523.
- **Season gating**: the codebase has no way to gate combat rules by season. See
  [Season gating](#season-gating-decision-point-not-implemented).

### Arms (how each code revision was produced)

| Arm | Code | How it was produced |
|---|---|---|
| `main` (baseline) | `8a9de7ba` (`origin/main`) | `git worktree add --detach .worktrees/s2bl-arm-main 8a9de7ba` |
| `517` | `3424ab3a` (#517 commit only) | `git worktree add --detach .worktrees/s2bl-arm-517 3424ab3a` |
| `518` | `8a9de7ba` + #518 patch | `git worktree add --detach .worktrees/s2bl-arm-518 8a9de7ba`, then `git cherry-pick --no-commit 0bad9dbb` in it. Conflicts were in tests/docs only; those files were restored to `8a9de7ba`. The `app/backend/src` + `app/shared` diff vs `8a9de7ba` is identical to `git diff 3424ab3a 0bad9dbb -- app/backend/src app/shared` (checked line by line). |
| `combined` | `0bad9dbb` (#517 + #518) | The `fix/season2-combat-baseline` checkout. Later commits on this branch add only this report and the harness. |

Each arm reuses the dependency install of the branch checkout through symlinks (`node_modules`, `app/backend/node_modules`,
`app/backend/generated`); `package.json`/lockfile are unchanged between the arms. The harness `require`s every arm's own
`prepareRobotForCombat` and `simulateBattleMulti`, so each arm runs its real code in one process. Nothing is
re-implemented or monkey-patched. The weapon catalogue (`WEAPON_DEFINITIONS`) comes from the branch checkout; the
fixes do not change `prisma/seed.ts`.

### Dataset and limits

- **Local simulation only.** No ACC/live player data, deployed SHA or real builds. This answers "what do the fixes do to
  the simulator?", not "what is the live meta?" (#516 step 1 is separate).
- **Synthetic builds**: all 23 attributes at one level (1, 10 or 25), balanced stance, yield threshold 10, no tuning, no
  refinements. These builds are not equal-investment: weapon prices are not equalised, and weapons are sampled uniformly
  from each range/hands category of the seed catalogue. Dual Wield uses two copies of the main weapon; Weapon+Shield
  adds a uniformly sampled shield. The optimised early/mid/late equal-investment builds belong to #516 step 3.
- **1v1 uses league rules**: a draw (timeout) scores ½. Score = win + ½ draw. In timeout-heavy cells this compresses
  score differences toward 50%.
- **Multi-robot mode**: Grand Melee with 16 robots (production allows 8–20; ideal group 20), one robot per
  range class × loadout, spawn order shuffled per trial, production config (`allowDraws: false`, arena radius
  16 + (N − 2) × 3 = 58, 120 s limit). Placements follow `grandMeleeBattleOrchestrator.computePlacements`. That function
  is reproduced in the harness because the orchestrator module needs a database client. KotH, tag team, 2v2/3v3 and
  tournaments were not run (#516 step 4).
- **Time within melee reach** is how long a robot spent ≤ 2 units from its current target, rebuilt from the simulator's
  per-tick `range_transition` events. For 1v1 suites it is side A's value, which equals the pair's value. In the
  `range` suite's "all cells" scope, cells with no melee weapon count as ~0%.
- **No-contact** = no damage dealt by anyone. **Timeout** = battle reached 120 s. **Beyond-reach melee attack** = a
  resolved main/offhand attack (hit or miss; counters excluded) with a melee-band weapon at distance > 2.

### Method

| Suite | Matchups | Trials |
|---|---|---|
| `range` (1v1) | 10 range-class pairs incl. mirrors (melee/short/mid/long); loadout sampled independently per side | 2,000 per pair per level (20,000 per level) |
| `loadout` (1v1) | 10 loadout pairs incl. mirrors; both sides share one sampled range class per trial | 2,000 per pair per level |
| `mobility` (1v1) | uniform melee vs short/mid/long **kiter**: Hydraulic Systems (melee-only damage) moved into Servo Motors at equal attribute total (servo 2L − 1, hydraulics 1) | 2,000 per pair, levels 10 and 25 (identical to `range` at level 1) |
| `grand-melee` (16 robots) | one robot per range class × loadout | 1,000 battles per level |

- **Paired seeds**: trial *t* of a cell uses the same setup (builds, weapons, side/spawn order) and the same battle seed
  (seeded mulberry32 replaces `Math.random` during the battle) in all four arms. Arms diverge after their first
  different random draw, so pairing shares the starting conditions, not whole trajectories. 1v1 sides alternate every trial.
- **Confidence intervals**: deltas are per-trial paired differences (arm − main), 95% CI = ±1.96·sd/√n. In Grand Melee
  the per-trial unit is the class mean over its 4 robots, so robots within one battle are not treated as independent.
  "±0.0" means the arms produced identical outcomes in (nearly) every paired trial.
- Seeded runs are deterministic: two runs with the same arms produce byte-identical output.

### Results: 1v1 by range class (`range` suite)

Score of each class against the other three classes (mirrors excluded; n = 6,000 per row). Deltas are percentage points.

| Class | Level | main | Δ #517 | Δ #518 | Δ combined | combined |
|---|---|---|---|---|---|---|
| melee | 1 | 79.4% | −1.0 ±0.6 | +0.0 ±0.1 | −0.9 ±0.6 | 78.5% |
| short | 1 | 57.4% | +0.2 ±0.7 | +0.0 ±0.0 | +0.2 ±0.7 | 57.6% |
| mid | 1 | 41.2% | +0.5 ±0.6 | +0.0 ±0.0 | +0.5 ±0.6 | 41.7% |
| long | 1 | 22.0% | +0.3 ±0.6 | −0.0 ±0.1 | +0.2 ±0.6 | 22.2% |
| melee | 10 | 80.9% | −2.5 ±0.6 | −0.0 ±0.0 | −2.6 ±0.6 | 78.4% |
| short | 10 | 59.3% | +1.2 ±0.7 | +0.0 ±0.0 | +1.2 ±0.7 | 60.5% |
| mid | 10 | 40.3% | +0.7 ±0.7 | +0.0 ±0.0 | +0.7 ±0.7 | 41.0% |
| long | 10 | 19.5% | +0.7 ±0.5 | +0.0 ±0.0 | +0.7 ±0.5 | 20.2% |
| melee | 25 | 63.2% | −1.0 ±0.4 | +0.2 ±0.2 | −0.7 ±0.4 | 62.5% |
| short | 25 | 57.2% | +1.6 ±0.5 | −0.2 ±0.2 | +1.4 ±0.6 | 58.6% |
| mid | 25 | 44.9% | +0.2 ±0.5 | −0.1 ±0.1 | +0.1 ±0.5 | 45.0% |
| long | 25 | 34.8% | −0.8 ±0.4 | +0.0 ±0.1 | −0.9 ±0.4 | 33.9% |

Range matchup matrix, score of A (n = 2,000 per cell):

| A vs B | L1 main | L1 Δ #517 | L1 Δ comb. | L10 main | L10 Δ #517 | L10 Δ comb. | L25 main | L25 Δ #517 | L25 Δ #518 | L25 Δ comb. |
|---|---|---|---|---|---|---|---|---|---|---|
| melee vs short | 70.0% | −0.8 ±1.3 | −0.8 ±1.3 | 70.5% | −5.2 ±1.4 | −5.2 ±1.4 | 55.5% | −1.2 ±0.9 | +0.5 ±0.5 | −0.7 ±1.0 |
| melee vs mid | 83.5% | −0.8 ±1.0 | −0.8 ±1.0 | 84.8% | −1.2 ±1.0 | −1.2 ±1.0 | 65.7% | −1.5 ±0.7 | +0.2 ±0.2 | −1.3 ±0.7 |
| melee vs long | 84.8% | −1.4 ±1.0 | −1.2 ±1.0 | 87.5% | −1.2 ±0.8 | −1.3 ±0.8 | 68.4% | −0.2 ±0.6 | −0.1 ±0.2 | −0.1 ±0.6 |
| short vs mid | 61.7% | +0.1 ±1.1 | +0.1 ±1.1 | 66.4% | −0.9 ±1.4 | −0.9 ±1.4 | 62.3% | +0.7 ±1.0 | +0.0 ±0.0 | +0.7 ±1.0 |
| short vs long | 80.5% | −0.3 ±1.0 | −0.3 ±1.0 | 82.0% | −0.7 ±0.8 | −0.7 ±0.8 | 64.6% | +2.9 ±0.9 | +0.0 ±0.0 | +2.9 ±0.9 |
| mid vs long | 68.8% | +0.9 ±0.9 | +0.9 ±0.9 | 72.0% | −0.1 ±1.1 | −0.1 ±1.1 | 62.7% | −0.3 ±0.8 | +0.0 ±0.0 | −0.3 ±0.8 |

At levels 1 and 10, #518's delta is ±0.0 (or ±0.1) in every cell, so its column is omitted there. Mirror cells score
47.2–51.6% in every arm; their engagement metrics are below.

### Results: 1v1 by loadout (`loadout` suite)

Score of each loadout against the other three loadouts (mirrors excluded; n = 6,000). #518's delta is +0.0 ±0.0 at
every level: both sides share a range class, so no attack is ever forced beyond reach.

| Loadout | L1 main | L1 Δ #517 | L1 combined | L10 main | L10 Δ #517 | L10 combined | L25 main | L25 Δ #517 | L25 combined |
|---|---|---|---|---|---|---|---|---|---|
| single | 29.0% | −1.2 ±0.5 | 27.7% | 29.6% | −1.7 ±0.7 | 27.8% | 35.7% | −2.5 ±0.6 | 33.1% |
| weapon_shield | 73.2% | +3.2 ±0.6 | 76.4% | 57.5% | +3.0 ±0.8 | 60.5% | 51.1% | +2.1 ±0.7 | 53.3% |
| two_handed | 38.0% | −1.0 ±0.6 | 37.0% | 48.0% | −1.1 ±0.8 | 46.8% | 51.2% | −0.5 ±0.7 | 50.6% |
| dual_wield | 59.9% | −1.0 ±0.8 | 58.8% | 65.0% | −0.1 ±1.0 | 64.9% | 62.0% | +0.9 ±0.8 | 63.0% |

Loadout matchup matrix, score of A (n = 2,000; Δ = #517 = combined):

| A vs B | L1 main | L1 Δ | L10 main | L10 Δ | L25 main | L25 Δ |
|---|---|---|---|---|---|---|
| single vs weapon_shield | 16.3% | −1.8 ±0.7 | 29.3% | −2.1 ±1.2 | 40.3% | −2.3 ±1.0 |
| single vs two_handed | 43.7% | −0.6 ±0.4 | 34.8% | −0.8 ±0.6 | 36.7% | −2.1 ±0.7 |
| single vs dual_wield | 26.8% | −1.3 ±1.2 | 24.6% | −2.4 ±1.5 | 30.0% | −3.2 ±1.2 |
| weapon_shield vs two_handed | 75.8% | +3.5 ±0.9 | 56.0% | +3.8 ±1.4 | 51.1% | +2.0 ±1.3 |
| weapon_shield vs dual_wield | 60.2% | +4.5 ±1.5 | 45.7% | +3.2 ±1.6 | 42.6% | +2.1 ±1.2 |
| two_handed vs dual_wield | 33.4% | −0.1 ±1.5 | 34.6% | −0.4 ±1.9 | 41.3% | −1.7 ±1.5 |

### Results: engagement, damage and timeouts

All cells of each suite (n = 20,000 for `range`/`loadout`, 6,000 for `mobility`). Deltas in pp unless noted.

| Suite, level | Metric | main | Δ #517 | Δ #518 | Δ combined | combined |
|---|---|---|---|---|---|---|
| range L1 | timeout rate | 0.2% | +0.1 ±0.0 | +0.0 ±0.0 | +0.1 ±0.0 | 0.3% |
| range L10 | timeout rate | 12.8% | +1.7 ±0.3 | +0.0 ±0.0 | +1.7 ±0.3 | 14.5% |
| range L25 | timeout rate | 47.4% | −0.2 ±0.4 | +0.2 ±0.1 | −0.1 ±0.4 | 47.3% |
| loadout L1 / L10 / L25 | timeout rate | 0.1% / 7.6% / 35.4% | +0.0 / +1.7 ±0.3 / +1.1 ±0.4 | +0.0 ±0.0 | +0.0 / +1.7 ±0.3 / +1.1 ±0.4 | 0.2% / 9.3% / 36.5% |
| mobility L10 / L25 | timeout rate | 34.5% / 76.8% | +2.3 ±0.8 / +1.7 ±0.7 | +0.3 ±0.3 / +0.4 ±0.3 | +2.3 ±0.8 / +2.0 ±0.7 | 36.8% / 78.8% |
| all 1v1 suites, all levels | no-contact rate | 0.00% | +0.00 | +0.00 | +0.00 | 0.00% |
| range L1 / L10 / L25 | time within melee reach | 30.8% / 30.9% / 34.7% | −0.0 / −0.4 ±0.0 / −2.5 ±0.2 | ±0.0 | −0.0 / −0.4 ±0.0 / −2.5 ±0.2 | 30.7% / 30.5% / 32.2% |
| mobility L10 / L25 | time within melee reach | 44.5% / 26.8% | +0.1 ±0.2 / −3.9 ±0.5 | ±0.0 | +0.1 ±0.2 / −3.9 ±0.5 | 44.6% / 22.9% |
| range L1 / L10 / L25 | beyond-reach melee attacks per battle | 0.00 / 0.00 / 0.97 | +0.00 / +0.00 / +0.02 ±0.01 | −0.00 / −0.00 / −0.97 ±0.04 | same as #518 | 0.00 |
| range L25 | damage from beyond-reach melee per battle | 10.7 | +0.5 ±0.2 | −10.7 ±0.5 | −10.7 ±0.5 | 0.0 |
| mobility L10 / L25 | beyond-reach melee attacks per battle | 1.29 / 4.33 | +0.03 ±0.02 / −0.05 ±0.02 | −1.29 ±0.06 / −4.33 ±0.10 | same as #518 | 0.00 |
| mobility L10 / L25 | damage from beyond-reach melee per battle | 10.1 / 50.0 | +0.3 ±0.3 / −0.1 ±0.6 | −10.1 ±0.6 / −50.0 ±1.4 | same as #518 | 0.0 |
| range L1 / L10 / L25 | mean duration (s) | 26.3 / 58.9 / 86.8 | +0.4 ±0.1 / +1.1 ±0.2 / −0.3 ±0.2 | ±0.0 / ±0.0 / +0.1 ±0.0 | +0.4 / +1.1 / −0.2 | 26.8 / 60.0 / 86.6 |

Per-cell detail where the fixes act:

| Cell | Metric | main | Δ #517 | Δ #518 | Δ combined |
|---|---|---|---|---|---|
| range L10 melee vs short | timeout rate | 10.4% | +3.5 ±1.2 | +0.0 ±0.0 | +3.5 ±1.2 |
| range L10 melee vs short | time within melee reach | 66.2% | −3.1 ±0.4 | +0.0 ±0.0 | −3.1 ±0.4 |
| range L25 melee vs short | timeout rate | 40.4% | +1.1 ±1.2 | +1.0 ±0.9 | +2.4 ±1.4 |
| range L25 melee vs short | melee damage dealt | 374.0 | +2.5 ±5.1 | −34.2 ±2.3 | −33.2 ±5.8 |
| range L25 melee vs mid | melee damage dealt | 410.2 | −3.7 ±4.8 | −37.6 ±2.4 | −41.4 ±5.5 |
| range L25 melee vs mid | ranged damage dealt | 497.3 | +13.2 ±4.5 | −7.5 ±2.4 | +6.1 ±4.7 |
| range L25 melee vs long | melee damage dealt | 426.3 | +13.8 ±4.5 | −32.1 ±2.6 | −17.6 ±5.2 |
| range L25 short vs long | time within melee reach | 50.0% | −10.4 ±1.0 | +0.0 ±0.0 | −10.4 ±1.0 |
| range L25 melee vs melee | timeout rate | 6.5% | +1.8 ±0.8 | +0.0 ±0.0 | +1.8 ±0.8 |
| mobility L25 melee vs short kiter | score of melee | 57.2% | −1.3 ±0.7 | +0.3 ±0.4 | −0.9 ±0.7 |
| mobility L25 melee vs mid kiter | score of melee | 61.4% | −2.8 ±0.7 | +0.2 ±0.2 | −2.8 ±0.7 |
| mobility L25 melee vs long kiter | score of melee | 52.8% | +0.4 ±0.5 | +0.0 ±0.1 | +0.4 ±0.5 |
| mobility L25 melee vs short / mid / long kiter | timeout rate | 64.8% / 71.3% / 94.5% | +1.8 / +4.0 / −0.8 | +0.8 ±0.8 / +0.4 ±0.5 / −0.1 ±0.3 | +2.6 / +4.1 / −0.8 |
| mobility L25 melee vs short / mid / long kiter | melee damage dealt | 353.2 / 353.2 / 254.4 | +9.0 / +12.6 / +19.0 | −41.9 ±3.1 / −51.4 ±2.6 / −53.6 ±3.3 | −33.2 / −38.2 / −36.0 |
| mobility L10 melee vs short / mid / long kiter | score of melee | 49.1% / 68.9% / 78.0% | +0.8 / −2.5 / −2.1 | +0.4 ±0.4 / +0.1 ±0.3 / +0.1 ±0.2 | +1.1 / −2.4 / −2.1 |

Before #518, the attacks it removes were a real damage source when melee could not close. At level 25 they were 8–9%
of melee damage in uniform 1v1 and 12–22% against kiters. Removing them did not lower melee's score within CI, and in `range` L25 melee vs short it rose
+0.5 ±0.5. One possible cause is that a forced attack used up the melee weapon's cooldown and gave the ranged defender
a counter chance. Ranged damage dealt in melee vs mid drops −7.5 ±2.4, which fits that explanation, but the harness
does not verify it. Most of these cells end in draws, which also hides small damage changes.

### Results: Grand Melee (16 robots, n = 1,000 battles per level)

Battle-level:

| Metric | Level | main | Δ #517 | Δ #518 | Δ combined | combined |
|---|---|---|---|---|---|---|
| timeout rate | 1 / 10 / 25 | 7.2% / 87.5% / 99.8% | +2.6 ±1.8 / +1.3 ±2.4 / +0.2 ±0.3 | +0.0 ±0.7 / +0.3 ±0.9 / +0.0 ±0.4 | +2.6 ±1.8 / +1.6 ±2.4 / +0.2 ±0.3 | 9.8% / 89.1% / 100.0% |
| survivors at end | 1 / 10 / 25 | 1.09 / 4.00 / 9.24 | +0.03 ±0.03 / +0.41 ±0.13 / +0.35 ±0.16 | +0.00 / +0.01 ±0.05 / +0.06 ±0.13 | +0.03 / +0.40 ±0.13 / +0.23 ±0.16 | 1.12 / 4.40 / 9.47 |
| beyond-reach melee attacks | 1 / 10 / 25 | 0.21 / 0.23 / 4.45 | +0.03 / +0.06 / −0.09 | −0.21 ±0.03 / −0.23 ±0.03 / −4.45 ±0.24 | same as #518 | 0.00 |
| damage from beyond-reach melee | 1 / 10 / 25 | 1.0 / 1.7 / 52.2 | +0.4 / +0.5 / −1.4 | −1.0 ±0.2 / −1.7 ±0.3 / −52.2 ±3.5 | same as #518 | 0.0 |
| no-contact battles | all | 0.00% | +0.00 | +0.00 | +0.00 | 0.00% |

Normalized rank (0 = 1st, 1 = 16th; parity 0.500; lower is better):

| Group | L1 main | L1 Δ comb. | L10 main | L10 Δ #517 | L10 Δ #518 | L10 Δ comb. | L25 main | L25 Δ #517 | L25 Δ #518 | L25 Δ comb. |
|---|---|---|---|---|---|---|---|---|---|---|
| melee | 0.549 | +0.011 ±0.009 | 0.562 | +0.003 ±0.010 | −0.002 ±0.004 | −0.001 ±0.010 | 0.610 | +0.001 ±0.010 | +0.002 ±0.008 | −0.004 ±0.010 |
| short | 0.468 | −0.004 ±0.009 | 0.493 | +0.000 ±0.009 | −0.001 ±0.004 | +0.003 ±0.009 | 0.518 | −0.016 ±0.010 | −0.007 ±0.009 | −0.018 ±0.010 |
| mid | 0.483 | +0.003 ±0.009 | 0.478 | −0.004 ±0.009 | +0.001 ±0.003 | −0.004 ±0.009 | 0.428 | +0.010 ±0.010 | +0.009 ±0.008 | +0.014 ±0.010 |
| long | 0.501 | −0.010 ±0.009 | 0.466 | +0.000 ±0.009 | +0.002 ±0.003 | +0.002 ±0.009 | 0.444 | +0.005 ±0.009 | −0.004 ±0.008 | +0.008 ±0.009 |
| single | 0.524 | +0.008 ±0.010 | 0.508 | −0.001 ±0.010 | −0.002 ±0.004 | −0.002 ±0.010 | 0.501 | −0.023 ±0.010 | −0.005 ±0.008 | −0.018 ±0.010 |
| weapon_shield | 0.334 | −0.018 ±0.009 | 0.386 | −0.020 ±0.010 | +0.002 ±0.004 | −0.025 ±0.010 | 0.417 | −0.038 ±0.010 | −0.003 ±0.008 | −0.036 ±0.010 |
| two_handed | 0.533 | +0.007 ±0.010 | 0.504 | +0.009 ±0.010 | −0.000 ±0.004 | +0.013 ±0.010 | 0.504 | +0.028 ±0.010 | +0.001 ±0.008 | +0.017 ±0.010 |
| dual_wield | 0.608 | +0.003 ±0.009 | 0.602 | +0.011 ±0.010 | +0.001 ±0.004 | +0.015 ±0.010 | 0.578 | +0.034 ±0.009 | +0.008 ±0.008 | +0.037 ±0.010 |

Podium rate (top 3 of 16; parity 18.8%), combined arm with Δ combined: Weapon+Shield 40.0% (+1.9 ±1.5) / 35.2%
(+2.8 ±1.6) / 33.2% (+4.1 ±1.5) at L1/L10/L25. Dual Wield 7.8% / 8.0% / 7.3% (−2.5 ±1.1 at L25). Two-Handed
13.4% at L25 (−3.3 ±1.3). Melee 14.0% / 15.4% / 11.4%. Damage per melee robot at L25 is −18.9 ±8.9 for #518 alone,
while melee rank stays unchanged (+0.002 ±0.008). #518 produced only two podium/win deltas outside their CI, both at
L25: mid podium −1.6 ±1.3 and Weapon+Shield win +1.2 ±1.0. Neither shows up in rank, so they are treated as noise
across the 48 group×(podium, win)×level cells. One per-robot effect is real: at L25, the share of melee robots that
deal zero damage in a Grand Melee goes from 0.0% to 0.4% (#518 +0.4 ±0.2). These are melee robots that never reach
anyone. Time within melee reach in Grand Melee moves by at most ±1.0 pp for any group in any arm.

### Corrected baseline against the #516 targets

Measured on the `combined` arm. This is the starting point for #519–#521, not a verdict on the fixes:

- **45–55% 1v1 band**: not met. In 1v1, melee scores 78.5% / 78.4% / 62.5% against other range classes and long range
  22.2% / 20.2% / 33.9% (L1/L10/L25). By loadout, Single sits at 27.7–33.1%, Dual Wield at 58.8–64.9%, and
  Weapon+Shield at 76.4% at L1. Both fixes together move any aggregate by at most 3.2 pp.
- **No material no-contact/timeout regression**: met for no-contact battles (0.00% everywhere). Per robot, 0.4% of
  melee robots in L25 Grand Melee now deal zero damage. Timeouts rise by at most
  +2.6 pp (Grand Melee L1) and +2.3 pp in 1v1 (mobility L10), almost entirely from #517. The existing timeout levels are far more serious:
  47% in 1v1 L25, 78.8% against L25 kiters, and 89–100% in Grand Melee at L10/L25. These are inputs to #520
  (pursuit/kiting) and #523 (Grand Melee audit).
- **Melee still reaches combat through positioning**: time within reach is unchanged by #518, so melee contact comes
  only from movement, as intended. Against an equal-points kiter at L25, melee is within reach 22.9% of the time and
  the battle times out 78.8% of the time.

### Reproduce

From the repository root (`$R`) of a checkout that has the branch at `$B` (any commit on
`fix/season2-combat-baseline` from `0bad9dbb` on) with dependencies installed:

```sh
W="$R/.worktrees"
git -C "$R" worktree add --detach "$W/s2bl-arm-main" 8a9de7ba
git -C "$R" worktree add --detach "$W/s2bl-arm-517" 3424ab3a
git -C "$R" worktree add --detach "$W/s2bl-arm-518" 8a9de7ba
# Conflicts are expected in tests/docs only; restore those, keep the src patch.
git -C "$W/s2bl-arm-518" cherry-pick --no-commit 0bad9dbb
git -C "$W/s2bl-arm-518" checkout 8a9de7ba -- app/backend/tests/combatSimulator.spatial.test.ts \
  docs/architecture/BATTLE_SIMULATION_ARCHITECTURE.md docs/architecture/COMBAT_FORMULAS.md
for a in s2bl-arm-main s2bl-arm-517 s2bl-arm-518; do
  ln -sfn "$B/node_modules" "$W/$a/node_modules"
  ln -sfn "$B/app/backend/node_modules" "$W/$a/app/backend/node_modules"
  ln -sfn "$B/app/backend/generated" "$W/$a/app/backend/generated"
done

cd "$B/app/backend"
ARMS="main=$W/s2bl-arm-main/app/backend,517=$W/s2bl-arm-517/app/backend,518=$W/s2bl-arm-518/app/backend,combined=$PWD"
O=../../logs/s2-baseline   # gitignored
mkdir -p "$O"
for L in 1 10 25; do
  for S in range loadout; do
    pnpm exec tsx scripts/combatBaselineValidation.ts --arms "$ARMS" --suite $S --level $L --trials 2000 --out "$O/$S-$L.md" &
  done
  pnpm exec tsx scripts/combatBaselineValidation.ts --arms "$ARMS" --suite grand-melee --level $L --trials 1000 --out "$O/grand-melee-$L.md" &
done
for L in 10 25; do
  pnpm exec tsx scripts/combatBaselineValidation.ts --arms "$ARMS" --suite mobility --level $L --trials 2000 --out "$O/mobility-$L.md" &
done
wait
```

The default seed is 516. Each output file lists the arm revisions it ran and contains every metric table per cell; this
report condenses them. With 11 shards in parallel on an 18-core machine, the slowest shard (Grand Melee L25) took
472 s. Remove the arms afterwards with `git worktree remove --force "$W/s2bl-arm-<name>"`. The `--force` is needed
because of the symlinks and, for `518`, the uncommitted patch.

### Why a new harness

`docs/analysis/WEAPON_BALANCE_ANALYSIS.md` (105,147 battles) was a query over battles stored in a local development
database. No simulation script was committed for it. `scripts/loadoutParityBaseline.ts` (#517) is 1v1 and
loadout-only. It compares an inlined legacy preparation against the current one, is unseeded, and has no reach
variant or multi-robot mode. The new script keeps the same build conventions (uniform attributes, seed catalogue, no
database). It adds real-code arms, paired seeds, range classes, kiters, Grand Melee and the engagement metrics.

### Season gating (decision point, not implemented)

**Finding: the codebase has no way to gate combat rule changes by season.**

- Combat rules are plain code: `prepareRobotForCombat`, the simulator, and the weapon catalogue in `prisma/seed.ts`.
  Every battle runs whatever is deployed, and no combat code reads the season.
- `Season` stores only phase and progress (`phase`, cycle counters, `lengthOverrideCycles`); it has no ruleset or
  config. `Battle` rows store no season or rules/engine revision (`battleLog` is nullable and purged after 7 days).
- The only runtime flag store is `cycle_metadata.feature_flags` (`MigrationFeatureFlags`, currently only
  `leaderboard_cache_active`). Combat does not use it.
- The only season boundary is behavioural: `cycleScheduler` skips every battle job while `Season.phase` is
  `preparation` (Spec #45). The player guide (`seasons/preparation-window.md`) promises that balance changes land in
  that window, but this rests on deploy timing; nothing in the code enforces it. Practice Arena runs during
  preparation with the deployed rules.

Consequence: deploying `fix/season2-combat-baseline` changes live combat immediately in every mode. Keeping the
current season unchanged therefore depends on not deploying until the Season 2 preparation window opens. #516 also
asks to "record the effective season and formula/catalog revision"; today no such field exists. Two options for the
#516 owner: hold merge/deploy until preparation (no code), or specify a season-keyed rules gate as separate work.
Which season is currently active on ACC was not checked.

## Season 2 balance package (#519–#522)

**Status**: measured for information only. No value was tuned in response to these results; every value is a
product-owner decision (see [SEASON_2_BALANCE_PACKAGE.md](../balance_changes/SEASON_2_BALANCE_PACKAGE.md)). Numbers
that look clearly off are listed under [Findings for the product owner](#findings-for-the-product-owner).
**Measured on**: branch `feature/season2-combat-tuning`, October 2026, base `0d7e5b51` (`origin/main`).
**Harness**: `app/backend/scripts/combatBaselineValidation.ts`, extended for this package (per-arm catalogues, invest
builds, KotH suite, melee-reach entries, slot-0 score).

### Summary

- **#520 (engagement cycle + movement fix) is the change that moves 1v1 outcomes.** Melee goes from the strongest
  range class to the weakest-but-one: 82.7% / 67.3% / 58.3% against other classes on main (invest early/mid/late) to
  37.2% / 27.5% / 31.5% combined. Time within melee reach drops from 25–28% to 11–15% of the battle.
- **Short range becomes dominant**: 86.2% / 84.2% / 83.3% combined (72.7–78.7% on main). Mid range moves just above
  the band (56.3–60.1%); long range rises but stays low (20.2–28.9%).
- **#521 (prices, shields, passives)** moves loadouts: Weapon+Shield −8.2 to −17.9 pp, Two-Handed and Dual Wield
  +2.6 to +7.1 pp, Single +2.2 to +3.8 pp. Single stays at 25.0–31.6%, far from the 42–45% target.
- **#519 (Hydraulic Systems / Logic Cores)** is small in 1v1 (≤ 4.4 pp per class) and larger in Grand Melee.
- **Robot order no longer decides 1v1 outcomes.** The robot in simulator slot 0 scored 40.5–48.3% on main (40.8%
  against kiters); with the movement fix it scores 49.7–50.2% in every suite.
- **KotH radius 7** (isolated on main code) lowers score-threshold wins by 6.5 pp and roughly quadruples long-range zone
  time (5.9 → 23.8 s per robot). Combined with the package, matches end by "last standing" in 52.6% of KotH fields.
- **Uniform-build timeouts are an artefact**: Grand Melee times out 99.7% at uniform level 25 but 12.7% with
  equal-investment (mid) builds on the combined arm, in line with the ACC observation (#523, no rule change).

### Arms

| Arm | Code | How it was produced |
|---|---|---|
| `main` (baseline) | `0d7e5b51` | `git worktree add --detach .worktrees/s2pkg-arm-main 0d7e5b51` |
| `521` | `0d7e5b51` + `cd3361f3` | worktree at `0d7e5b51`, `git cherry-pick --no-commit cd3361f3` (FEAT-001 source commit: pricing formula, catalogue, shields, passives, Workshop discount) |
| `519` | `0d7e5b51` + `0d3a6ca7` | worktree at `0d7e5b51`, `git cherry-pick --no-commit 0d3a6ca7` (FEAT-002 source commit) |
| `520` | `0d7e5b51` + `4ea1d534` | worktree at `0d7e5b51`, `git cherry-pick --no-commit 4ea1d534` (FEAT-003 source commit, engagement cycle without the movement fix) |
| `520fix` | `0d7e5b51` + `4ea1d534` + `71267b49` | as `520`, then `git cherry-pick --no-commit 71267b49` (movement fix: simultaneous movement, full-speed pursuit) |
| `combined` | `23ecc11d` | the branch checkout (all FEATs; later commits add only tests and docs) |

All cherry-picks applied without conflicts. For every isolated arm the added/removed lines of
`git diff 0d7e5b51 -- app/backend/src app/shared app/backend/prisma/seed.ts` equal those of the FEAT's own source
commit (521: 278 lines, 519: 107, 520: 543), and the `520fix` − `520` difference equals `71267b49` (134 lines), so no
cumulative fallback was needed. FEAT-004 (Refinement Lab) and the FEAT-005 KotH source change do not change combat,
except the KotH zone radius, which the `koth` suite sets per column. Dependencies are symlinked from the branch
checkout (`node_modules`, `app/backend/node_modules`, `app/backend/generated`); `schema.prisma` is unchanged by the
package. Each arm runs its own `prepareRobotForCombat`, simulator, `WEAPON_DEFINITIONS` and KotH engine.

### Dataset and limits

- **Local simulation only.** No ACC/live data. The results describe what the package does to the simulator with
  synthetic builds, not the live meta.
- **Invest builds (#516 equal investment)** are the primary dataset: per-robot budget ₡1.5M / ₡5M / ₡15M (early / mid /
  late), attribute caps 15 / 30 / 45 (academies outside the budget), weapons at the arm's catalogue price without a
  Workshop discount, the rest spent greedily on the cheapest next attribute level with fixed focus lists (definition
  in the harness header and under Method). Real players do not build this way; in particular every build spreads
  points evenly across its focus list.
- **Weapon choice uses the main catalogue's prices** (candidates whose loadout costs ≤ 40% of the budget), so the same
  weapon names are paired in every arm; in the `521`/`combined` arms the same loadout costs more (+₡86K to +₡109K per
  robot on average) and leaves fewer credits for attributes (2.9 to 8.2 fewer attribute levels on average).
- **Uniform builds** (all 23 attributes at level 10 or 25) are indicative only: they overstate timeouts (equally
  matched robots stall), see #523.
- 1v1 uses league rules (draw = ½). Grand Melee uses 16 robots (one per range class × loadout); KotH uses 6-robot
  fields with range class and loadout sampled per robot, so the KotH group sizes per trial vary (n per group ≈ 1,600
  trials in which the group was present).
- Synthetic robots are always battle-ready; readiness forfeits, loadout fallbacks, tuning and refinements are not
  modelled.

### Method

| Suite | Builds | Arms / columns | Trials | Wall time (s) |
|---|---|---|---|---|
| `range` (1v1, 10 range-class pairs) | invest early / mid / late | 6 arms | 2,000 per cell | 290 / 361 / 485 |
| `loadout` (1v1, 10 loadout pairs) | invest early / mid / late | 6 arms | 2,000 per cell | 222 / 275 / 434 |
| `range` | uniform L10 / L25 | 6 arms | 2,000 per cell | 370 / 522 |
| `loadout` | uniform L10 / L25 | 6 arms | 2,000 per cell | 287 / 467 |
| `mobility` (melee vs equal-points kiter) | uniform L25 | 6 arms | 2,000 per cell | 264 |
| `grand-melee` (16 robots) | uniform L10 / L25, invest mid | 6 arms | 1,000 battles | 637 / 807 / 555 |
| `koth` (6 robots, radius 5 and 7) | invest early / mid / late, uniform L25 | `main`, `combined` × radius 5, 7 | 2,000 per column | 100 / 118 / 168 / 172 |

- **Invest allocation**: all attributes start at 1. Focus attributes are raised first, one level at a time, always the
  cheapest next level (`calculateBaseCost`, ties in list order), until all are capped or the next level is
  unaffordable; then the remaining attributes the same way. Focus: every build combatPower, targetingSystems,
  attackSpeed, hullIntegrity, armorPlating; melee + hydraulicSystems, servoMotors, gyroStabilizers; short
  + hydraulicSystems, servoMotors, evasionThrusters; mid/long + logicCores, servoMotors, evasionThrusters;
  Weapon+Shield + shieldCapacity. Dual Wield buys two copies, Weapon+Shield a weapon plus a shield (pairs sampled
  uniformly among affordable weapon × shield pairs).
- **KotH**: orchestration as `processKothBattle` with each arm's own `buildKothGameModeConfig`,
  `buildKothInitialState`, `buildKothTickHook`, `buildEnrichedPlacements`; `allowDraws: false`, arena radius 14,
  150 s, score threshold 30. Baseline column: `main r5`.
- **New 1v1 metrics**: *melee-reach entries* = side A's `range_transition` events into the melee band per battle;
  *slot-0 score* = score of the robot that occupies simulator slot 0 (sides alternate, so 50% means robot order has no
  effect).
- Paired seeds (default 516), side alternation and paired-difference 95% CIs (±1.96·sd/√n) as in the baseline
  section. All 18 shards ran in parallel (18 cores); the slowest took 807 s. A re-run of `koth` invest early was
  identical except for the arm-revision header line (an uncommitted test file in the branch checkout at re-run time).
  Outputs: `logs/s2-package/` (gitignored), one markdown file per shard listing the arm revisions.

### Results: 1v1 by range class

Score against the other three classes (mirrors excluded; n = 6,000 per row). Deltas in pp vs `main`.

| Class | Builds | main | Δ 521 | Δ 519 | Δ 520 | Δ 520fix | Δ combined | combined |
|---|---|---|---|---|---|---|---|---|
| melee | invest early | 82.7% | +2.7 ±0.8 | −1.3 ±0.4 | −44.1 ±1.3 | −42.3 ±1.3 | −45.6 ±1.4 | 37.2% |
| short | invest early | 72.7% | +1.1 ±0.9 | −1.1 ±0.4 | +16.2 ±1.0 | +16.2 ±1.1 | +13.5 ±1.3 | 86.2% |
| mid | invest early | 34.1% | −0.6 ±0.8 | +2.0 ±0.4 | +17.1 ±1.0 | +17.2 ±1.0 | +22.4 ±1.3 | 56.5% |
| long | invest early | 10.5% | −3.2 ±0.6 | +0.4 ±0.4 | +10.8 ±0.8 | +8.8 ±0.7 | +9.7 ±1.0 | 20.2% |
| melee | invest mid | 67.3% | +0.4 ±0.7 | −2.3 ±0.4 | −34.5 ±1.1 | −34.9 ±1.3 | −39.9 ±1.4 | 27.5% |
| short | invest mid | 78.7% | +1.8 ±0.6 | −2.3 ±0.4 | +8.7 ±0.8 | +9.3 ±0.9 | +5.4 ±1.1 | 84.2% |
| mid | invest mid | 37.4% | +0.1 ±0.7 | +2.4 ±0.5 | +14.3 ±0.8 | +16.7 ±1.0 | +22.8 ±1.2 | 60.1% |
| long | invest mid | 16.6% | −2.3 ±0.6 | +2.2 ±0.5 | +11.5 ±0.7 | +9.0 ±0.8 | +11.7 ±1.1 | 28.2% |
| melee | invest late | 58.3% | +0.4 ±0.4 | +0.3 ±0.3 | −11.3 ±0.7 | −28.6 ±1.2 | −26.8 ±1.2 | 31.5% |
| short | invest late | 77.6% | +1.4 ±0.5 | −4.4 ±0.5 | +4.8 ±0.6 | +10.6 ±0.9 | +5.7 ±1.1 | 83.3% |
| mid | invest late | 41.8% | −0.5 ±0.6 | +2.7 ±0.6 | +2.9 ±0.4 | +11.1 ±0.8 | +14.4 ±1.1 | 56.3% |
| long | invest late | 22.3% | −1.3 ±0.4 | +1.5 ±0.5 | +3.5 ±0.4 | +6.9 ±0.7 | +6.7 ±0.9 | 28.9% |
| melee | uniform L10 | 78.5% | −0.2 ±0.4 | −1.0 ±0.4 | −33.3 ±1.0 | −37.9 ±1.0 | −37.2 ±1.0 | 41.2% |
| short | uniform L10 | 60.4% | +0.4 ±0.4 | −0.2 ±0.3 | +13.2 ±0.8 | +14.5 ±0.9 | +13.5 ±0.9 | 73.9% |
| mid | uniform L10 | 40.8% | +0.0 ±0.3 | +0.5 ±0.4 | +11.6 ±0.7 | +13.6 ±0.8 | +14.0 ±0.8 | 54.7% |
| long | uniform L10 | 20.3% | −0.3 ±0.2 | +0.8 ±0.4 | +8.5 ±0.6 | +9.7 ±0.6 | +9.8 ±0.7 | 30.2% |
| melee | uniform L25 | 62.5% | +0.2 ±0.2 | −1.1 ±0.4 | −10.0 ±0.6 | −19.7 ±0.8 | −18.7 ±0.8 | 43.9% |
| short | uniform L25 | 58.6% | +0.4 ±0.2 | −2.1 ±0.4 | +3.0 ±0.6 | +9.2 ±0.7 | +6.9 ±0.7 | 65.5% |
| mid | uniform L25 | 45.0% | −0.2 ±0.2 | +2.3 ±0.4 | +5.0 ±0.5 | +6.6 ±0.6 | +8.2 ±0.7 | 53.2% |
| long | uniform L25 | 33.8% | −0.4 ±0.2 | +0.9 ±0.4 | +2.0 ±0.5 | +3.8 ±0.6 | +3.6 ±0.7 | 37.4% |

The `main` uniform L25 values reproduce the combined arm of the #517/#518 baseline above (melee 62.5%, long 33.9%).

Range matchup matrix, invest mid, score of A (n = 2,000 per cell):

| A vs B | main | Δ 521 | Δ 519 | Δ 520 | Δ 520fix | Δ combined | combined |
|---|---|---|---|---|---|---|---|
| melee vs short | 40.8% | +0.3 ±1.1 | +0.7 ±0.7 | −30.3 ±2.0 | −33.9 ±2.3 | −32.8 ±2.3 | 7.9% |
| melee vs mid | 76.9% | −0.3 ±1.3 | −3.8 ±0.8 | −40.3 ±2.0 | −45.8 ±2.4 | −53.1 ±2.5 | 23.8% |
| melee vs long | 84.4% | +1.2 ±1.1 | −3.9 ±0.8 | −33.0 ±1.8 | −25.0 ±2.2 | −33.6 ±2.4 | 50.8% |
| short vs mid | 83.1% | +3.0 ±1.2 | −4.3 ±0.9 | −2.7 ±0.6 | −4.2 ±0.8 | −12.0 ±1.7 | 71.1% |
| short vs long | 93.8% | +2.7 ±0.7 | −1.9 ±0.5 | −1.4 ±0.4 | −1.9 ±0.5 | −4.5 ±1.1 | 89.3% |
| mid vs long | 72.1% | +3.1 ±1.0 | −0.8 ±1.1 | +0.0 ±0.1 | +0.0 ±0.1 | +3.2 ±1.4 | 75.3% |

Mirror cells score 48.8–50.7% in every arm.

### Results: 1v1 by loadout

Score against the other three loadouts (mirrors excluded; n = 6,000). Both sides share a range class, so the
engagement cycle (melee vs ranged roles) does not act here: `520` and `520fix` deltas are within ±1.0 pp.

| Loadout | Builds | main | Δ 521 | Δ 519 | Δ combined | combined |
|---|---|---|---|---|---|---|
| single | invest early / mid / late | 26.3% / 22.3% / 27.9% | +1.5 ±0.8 / +2.0 ±0.6 / +4.5 ±0.7 | +0.2 / +0.6 / +0.4 (±0.6–0.7) | +2.2 ±0.9 / +2.7 ±0.7 / +3.8 ±0.8 | 28.5% / 25.0% / 31.6% |
| weapon_shield | invest early / mid / late | 80.5% / 74.2% / 54.9% | −8.6 ±1.0 / −6.9 ±0.8 / −19.2 ±1.0 | −0.1 / −0.5 / +0.8 (±0.5–0.7) | −9.3 ±1.0 / −8.2 ±0.9 / −17.9 ±1.0 | 71.3% / 66.0% / 37.0% |
| two_handed | invest early / mid / late | 38.4% / 38.8% / 51.2% | +4.2 ±0.9 / +2.4 ±0.7 / +7.2 ±0.7 | −0.3 / +0.4 / −0.6 (±0.6–0.7) | +4.1 ±1.0 / +2.6 ±0.8 / +7.1 ±0.9 | 42.5% / 41.4% / 58.3% |
| dual_wield | invest early / mid / late | 54.8% / 64.7% / 66.1% | +2.8 ±1.0 / +2.5 ±0.8 / +7.5 ±0.7 | +0.2 / −0.5 / −0.5 (±0.6) | +2.9 ±1.1 / +2.9 ±0.9 / +7.0 ±0.9 | 57.8% / 67.6% / 73.0% |
| single | uniform L10 / L25 | 27.8% / 33.2% | +1.0 ±0.3 / +1.0 ±0.3 | +0.8 / +0.0 | +1.5 ±0.5 / +0.7 ±0.6 | 29.2% / 33.9% |
| weapon_shield | uniform L10 / L25 | 60.2% / 52.9% | −3.8 ±0.5 / −2.4 ±0.4 | −0.4 / +0.7 | −3.8 ±0.6 / −2.0 ±0.5 | 56.4% / 50.9% |
| two_handed | uniform L10 / L25 | 46.7% / 50.5% | +1.3 ±0.3 / +0.7 ±0.3 | +0.1 / +0.1 | +1.3 ±0.6 / +1.0 ±0.6 | 48.0% / 51.5% |
| dual_wield | uniform L10 / L25 | 65.4% / 63.5% | +1.5 ±0.3 / +0.7 ±0.3 | −0.5 / −0.8 | +1.1 ±0.6 / +0.2 ±0.6 | 66.4% / 63.7% |

Single and Weapon+Shield cells, score of A (n = 2,000), main → combined (Δ combined):

| A vs B | invest early | invest mid | invest late |
|---|---|---|---|
| single vs weapon_shield | 12.3% → 18.3% (+6.0 ±1.4) | 13.6% → 21.1% (+7.5 ±1.3) | 31.6% → 44.7% (+13.0 ±1.7) |
| single vs two_handed | 40.3% → 39.9% (−0.4 ±1.5) | 34.7% → 34.5% (−0.1 ±1.3) | 30.3% → 28.9% (−1.4 ±1.3) |
| single vs dual_wield | 26.2% → 27.2% (+1.0 ±1.6) | 18.6% → 19.3% (+0.7 ±1.1) | 21.6% → 21.3% (−0.3 ±1.1) |
| weapon_shield vs two_handed | 80.4% → 71.5% (−8.9 ±1.7) | 77.5% → 68.8% (−8.8 ±1.5) | 51.7% → 32.1% (−19.7 ±1.8) |
| weapon_shield vs dual_wield | 73.4% → 60.6% (−12.8 ±2.0) | 58.7% → 50.4% (−8.3 ±1.8) | 44.6% → 23.7% (−20.9 ±1.8) |

### Results: engagement, timeouts, range switching and robot order

`range` suite, all cells (n = 20,000); `mobility` n = 6,000. Deltas in pp unless noted.

| Metric | Builds | main | Δ 520 | Δ 520fix | Δ combined | combined |
|---|---|---|---|---|---|---|
| timeout rate | invest early / mid / late | 0.9% / 3.7% / 16.1% | +3.0 ±0.2 / +4.7 ±0.3 / +3.0 ±0.3 | +2.9 / +4.1 / +4.3 (±0.2–0.4) | +1.9 ±0.2 / +2.0 ±0.3 / +0.8 ±0.5 | 2.7% / 5.7% / 16.9% |
| timeout rate | uniform L10 / L25 | 14.5% / 47.0% | +9.2 ±0.4 / +3.6 ±0.4 | +10.2 ±0.5 / +6.0 ±0.5 | +10.2 ±0.5 / +4.7 ±0.6 | 24.8% / 51.7% |
| time within melee reach | invest early / mid / late | 28.0% / 25.3% / 24.9% | −10.6 / −9.1 / −6.6 (±0.2–0.3) | −13.5 / −13.5 / −14.2 (±0.4–0.5) | −13.0 ±0.4 / −13.3 ±0.4 / −13.9 ±0.5 | 15.1% / 12.0% / 11.0% |
| melee-reach entries / battle | invest early / mid / late | 10.02 / 3.07 / 1.83 | −3.58 ±0.31 / −1.97 ±0.12 / −0.73 ±0.11 | +13.80 ±0.64 / +12.31 ±0.51 / +7.73 ±0.30 | +13.37 ±0.66 / +13.83 ±0.58 / +9.47 ±0.37 | 23.39 / 16.90 / 11.31 |
| melee-reach entries / battle | uniform L10 / L25 | 26.05 / 2.14 | −11.22 ±0.76 / −0.58 ±0.09 | +3.21 ±1.03 / +15.53 ±0.55 | +6.15 ±1.06 / +18.47 ±0.65 | 32.20 / 20.61 |
| slot-0 score | invest early / mid / late | 47.4% / 43.0% / 40.5% | −1.5 ±0.5 / +0.8 ±0.4 / +3.0 ±0.2 | +2.8 ±0.5 / +6.9 ±0.5 / +9.7 ±0.4 | +2.8 ±0.7 / +6.8 ±0.6 / +9.7 ±0.6 | 50.2% / 49.9% / 50.2% |
| slot-0 score | uniform L10 / L25 / mobility L25 | 48.3% / 45.3% / 40.8% | −0.8 / +2.2 / +8.9 (±0.3–0.5) | +1.8 / +4.6 / +8.9 (±0.3–0.5) | +1.7 ±0.5 / +4.7 ±0.4 / +9.0 ±0.6 | 50.0% / 50.0% / 49.8% |
| mean duration (s) | invest early / mid / late | 41.3 / 50.4 / 63.8 | +6.3 / +6.4 / +2.9 (±0.2) | +6.1 / +6.1 / +5.9 (±0.2–0.3) | +4.8 / +3.5 / +1.3 (±0.2–0.4) | 46.2 / 53.9 / 65.1 |

`#521` and `#519` move these engagement metrics by ≤ 1.9 pp (timeouts) and ≤ 1.8 entries. No-contact battles and
melee attacks beyond reach stay at 0.00 in every arm and suite.

Melee vs ranged cells, invest mid, main → combined:

| Cell | time within melee reach | melee-reach entries | timeout rate | melee damage dealt | ranged damage dealt | slot-0 score |
|---|---|---|---|---|---|---|
| melee vs short | 51.4% → 7.6% | 1.91 → 40.92 | 3.0% → 3.9% | 130.1 → 119.4 | 198.8 → 227.8 | 16.3% → 50.1% |
| melee vs mid | 53.0% → 7.8% | 13.03 → 57.09 | 7.4% → 12.3% | 214.1 → 146.8 | 146.6 → 225.3 | 29.4% → 49.3% |
| melee vs long | 52.7% → 8.6% | 14.76 → 69.95 | 10.7% → 28.8% | 228.0 → 179.3 | 130.5 → 196.9 | 36.7% → 49.5% |

Mobility, uniform L25 (melee vs a kiter with Servo Motors 49 and Hydraulic Systems 1), main → combined (Δ combined):
score of melee vs short / mid / long kiter 56.0% / 58.7% / 52.9% → 43.1% / 46.3% / 50.0% (−12.8 ±1.2 / −12.4 ±1.0 /
−2.9 ±0.5); timeouts 67.8% / 75.3% / 94.2% → 86.2% / 92.7% / 100.0%; melee time within reach 31.4% / 28.5% / 8.8% →
0.5% / 0.1% / 0.0%; melee damage dealt 317.4 / 316.9 / 214.0 → 26.6 / 5.7 / 0.1; slot-0 score 36.9% / 38.3% / 47.1% →
49.8% / 49.6% / 50.0%. The `520` arm alone already shows the same pattern (time within reach 0.0%).

**Robot order before vs after**: on `main` the robot in slot 0 (robot 1 of a league match) scores 40.5–48.3% over all
range cells, 40.8% against kiters and as little as 16.3% in melee vs short (invest mid). The engagement cycle alone
(`520`) does not remove this in the `range` suite (43.4–47.5%; 41.9% in melee vs short); against kiters it reaches
49.7% only because melee no longer gets into reach at all. With the movement fix (`520fix`, `combined`) slot-0 scores
49.7–50.2% in every suite and 49.3–50.5% in every melee-vs-ranged cell at invest mid, i.e. within noise of no order
effect.

### Results: Grand Melee (16 robots, n = 1,000 battles)

| Metric | Builds | main | Δ 521 | Δ 519 | Δ 520 | Δ 520fix | Δ combined | combined |
|---|---|---|---|---|---|---|---|---|
| timeout rate | uniform L10 | 89.6% | −1.3 ±2.5 | −3.9 ±2.6 | +6.9 ±2.1 | +7.0 ±2.1 | +2.2 ±2.3 | 91.8% |
| timeout rate | uniform L25 | 99.9% | −0.2 ±0.4 | −0.2 ±0.4 | +0.0 ±0.3 | +0.1 ±0.2 | −0.2 ±0.4 | 99.7% |
| timeout rate | invest mid | 30.5% | −13.7 ±3.2 | −13.9 ±3.2 | +2.9 ±3.5 | +1.6 ±3.6 | −17.8 ±3.2 | 12.7% |
| survivors at end | invest mid | 1.52 | −0.25 ±0.06 | −0.28 ±0.06 | +0.07 ±0.07 | +0.07 ±0.08 | −0.35 ±0.06 | 1.17 |

Normalized rank (0 = 1st, 1 = 16th; parity 0.500; lower is better), main → combined (Δ combined; largest isolated arm):

| Group | invest mid | uniform L10 | uniform L25 |
|---|---|---|---|
| melee | 0.682 → 0.593 (−0.089 ±0.009; 519 −0.057) | 0.567 → 0.521 (−0.047 ±0.010) | 0.611 → 0.589 (−0.021 ±0.011; 519 −0.063, 520 +0.060) |
| short | 0.465 → 0.375 (−0.090 ±0.008; 519 −0.082) | 0.489 → 0.468 (−0.021 ±0.010) | 0.507 → 0.432 (−0.075 ±0.010; 519 −0.048) |
| mid | 0.406 → 0.457 (+0.051 ±0.009; 519 +0.052) | 0.472 → 0.489 (+0.017 ±0.010) | 0.434 → 0.458 (+0.024 ±0.010; 519 +0.032) |
| long | 0.447 → 0.575 (+0.128 ±0.008; 519 +0.087) | 0.472 → 0.523 (+0.051 ±0.010; 519 +0.036) | 0.449 → 0.521 (+0.072 ±0.010; 519 +0.079) |
| single | 0.510 → 0.495 (−0.015 ±0.010) | 0.511 → 0.481 (−0.031 ±0.011) | 0.487 → 0.483 (−0.004 ±0.011) |
| weapon_shield | 0.288 → 0.307 (+0.019 ±0.009; 521 +0.033) | 0.360 → 0.379 (+0.019 ±0.011) | 0.381 → 0.387 (+0.005 ±0.011) |
| two_handed | 0.555 → 0.546 (−0.009 ±0.010) | 0.513 → 0.520 (+0.007 ±0.012) | 0.527 → 0.514 (−0.012 ±0.011) |
| dual_wield | 0.646 → 0.652 (+0.006 ±0.009) | 0.616 → 0.621 (+0.005 ±0.011) | 0.606 → 0.617 (+0.011 ±0.010) |

Podium rate (top 3; parity 18.8%), invest mid, main → combined: melee 9.4% → 12.8%, short 19.4% → 28.7%, mid 26.2% →
22.0%, long 20.0% → 11.5% (−8.5 ±1.2), Weapon+Shield 45.6% → 39.9% (−5.7 ±1.6), Dual Wield 4.5% → 5.4%. Zero-damage
participants stay ≤ 0.8% in every group and arm. In Grand Melee, #519 is the largest single effect, and it moves
ranks in the opposite direction from 1v1 (long and mid rank worse, melee and short better); the harness does not
show why.

### Results: King of the Hill (6 robots; radius 5 vs 7)

Columns: `main r5` (baseline) / `main r7` / `combined r5` / `combined r7`; n = 2,000 fields. Paired CIs are against
`main r5`; `main r7` − `main r5` is the isolated radius effect on today's code.

| Metric | Builds | main r5 | main r7 (Δ) | combined r5 (Δ) | combined r7 (Δ) |
|---|---|---|---|---|---|
| win by score threshold | invest early | 52.4% | 49.5% (−2.9 ±2.4) | 43.8% (−8.6 ±2.6) | 37.3% (−15.1 ±2.6) |
| win by score threshold | invest mid | 60.9% | 54.4% (−6.5 ±2.4) | 50.5% (−10.3 ±2.6) | 43.1% (−17.8 ±2.7) |
| win by score threshold | invest late | 45.9% | 19.1% (−26.8 ±2.4) | 40.8% (−5.1 ±2.5) | 21.2% (−24.7 ±2.5) |
| win by time limit | invest early / mid / late | 7.9% / 11.5% / 20.2% | 4.9% / 9.3% / 36.7% | 4.8% / 5.7% / 13.4% | 4.0% / 4.3% / 21.9% |
| win by last standing | invest early / mid / late | 39.7% / 27.7% / 33.9% | 45.6% / 36.4% / 44.1% | 51.4% / 43.8% / 45.8% | 58.8% / 52.6% / 56.9% |
| mean duration (s) | invest early / mid / late | 92.0 / 97.8 / 114.6 | 90.8 / 99.3 / 124.7 | 83.8 / 87.6 / 107.6 | 85.2 / 89.3 / 114.0 |
| win by time limit | uniform L25 | 65.5% | 65.0% | 69.8% | 60.0% |

Per range class, invest mid (normalized rank, 0 = 1st, 1 = 6th; win rate, parity 16.7%; zone time per robot):

| Class | rank main r5 / r7 / comb r5 / comb r7 | win rate | zone time (s) |
|---|---|---|---|
| melee | 0.661 / 0.672 / 0.661 / 0.669 | 2.6% / 1.5% / 7.4% / 5.2% | 23.5 / 22.4 / 16.8 / 20.7 |
| short | 0.344 / 0.397 / 0.548 / 0.552 | 29.3% / 30.3% / 7.1% / 10.1% | 29.5 / 37.6 / 19.9 / 27.4 |
| mid | 0.364 / 0.392 / 0.336 / 0.369 | 24.8% / 27.6% / 28.3% / 27.0% | 28.6 / 38.2 / 20.6 / 29.9 |
| long | 0.532 / 0.438 / 0.382 / 0.339 | 13.6% / 12.0% / 28.5% / 26.8% | 5.9 / 23.8 / 10.8 / 23.0 |

Rank CIs are ±0.013–0.016. Radius 7 on main code: long rank −0.094 ±0.013 and long zone time +17.9 ±1.2 s; short rank
+0.053 ±0.013. By loadout (invest mid) every rank stays within 0.371–0.564; Weapon+Shield is best in every column
(0.371–0.402). Kills per robot stay low in every column (0.042 → 0.068) while last-standing endings rise; the harness
does not split eliminations into destructions and yields. At invest early
and late the class pattern is the same (combined r7: short 0.568 / 0.561, long 0.336 / 0.384); at late, melee
improves with radius 7 on both codes (0.686 → 0.560 main, 0.574 combined).

### Package against the #516 targets

- **45–55% 1v1 band (range classes)**: not met. Combined invest: melee 27.5–37.2%, short 83.3–86.2%, mid 56.3–60.1%,
  long 20.2–28.9%. The spread between the best and worst class narrows by 1–6 pp per budget (main 55.3–72.2 pp,
  combined 54.4–66.0 pp), and the top class changes from melee to short.
- **Single 42–45%**: not met. Combined 25.0–31.6% (invest), 29.2–33.9% (uniform); +2.2 to +3.8 pp from main.
- **Loadouts**: Weapon+Shield 37.0–71.3% and Dual Wield 57.8–73.0% stay outside the band; Two-Handed 41.4–58.3%.
- **No material no-contact/timeout regression**: no-contact stays 0.00%. 1v1 timeouts rise +0.8 to +2.0 pp (invest)
  and +4.7 to +10.2 pp (uniform); against equal-points kiters to 86–100%.
- **More range switching** (PO intent for #520): melee-reach entries rise 2.3–6.2× in invest builds while time
  within reach halves, i.e. many short contacts.

### Findings for the product owner

Information only; no value was changed because of these numbers.

1. **Melee is now weak in 1v1.** Combined invest early/mid/late: 37.2% / 27.5% / 31.5% against other classes (main
   82.7% / 67.3% / 58.3%). Melee vs short at invest mid: 7.9% (main 40.8%); melee vs mid 23.8% (76.9%). Almost all of
   it is #520 (isolated −34.5 pp at mid; with the movement fix −34.9 pp). Melee spends 7.6–8.6% of a melee-vs-ranged
   battle within reach (main 51–53%).
2. **Short range dominates 1v1**: 83.3–86.2% against other classes (combined invest), short vs long 89.3%, short vs
   mid 71.1%. It was already 72.7–78.7% on main.
3. **Long range stays low** in 1v1 (20.2–28.9% combined invest) and gets worse in Grand Melee: rank 0.447 → 0.575,
   podium 20.0% → 11.5% (invest mid), mostly from #519 (+0.087 rank).
4. **Single misses its target**: 25.0–31.6% (target 42–45%). Single vs Two-Handed (28.9–39.9%) and vs Dual Wield
   (19.3–27.2%) do not move; only Single vs Weapon+Shield improves (+6.0 to +13.0 pp).
5. **Weapon+Shield late-game drops hard**: invest late 54.9% → 37.0% (−17.9 ±1.0), vs Two-Handed 51.7% → 32.1%, vs
   Dual Wield 44.6% → 23.7%. This is the `521` arm (−19.2 pp): passives, shield values and prices together (over all
   loadouts the same weapons cost ₡104K more at late and buy 8.2 fewer attribute levels on average; the harness does
   not report this per loadout). At early/mid it stays the strongest loadout (71.3% / 66.0%).
6. **Equal-points kiters cannot be caught**: against a Servo 49 kiter, melee (Servo 25) is within reach 0.0–0.5% of
   the time and deals 0.1–26.6 damage; 86–100% timeouts. This matches the decided threshold (kiter Servo ≥ 1.18 × 25 +
   6.4 = 35.9 outruns a committed melee robot), so it is the rule working as specified, but the result is near-total
   stalemate in that matchup.
7. **Melee contact is many short touches**: 40.9–70.0 melee-reach entries per melee-vs-ranged battle at invest mid
   (main 1.9–14.8) while time within reach falls to ~8%. The entries appear with the movement fix (`520` alone lowers
   them); the harness does not show whether they are disengage bursts or band flicker at 2 units.
8. **1v1 timeouts with uniform builds** rise +10.2 pp at L10 (14.5% → 24.8%) and melee vs long (invest mid) times out
   28.8% (main 10.7%).
9. **KotH outcome shift**: short range goes from the best KotH class to below parity (rank 0.344 → 0.552, win rate
   29.3% → 10.1% at invest mid, combined r7) and long from 13.6% to 26.8% wins. Matches end by "last standing" in
   52.6–58.8% of fields with combined r7 (main r5 27.7–39.7%), and at invest late radius 7 halves score-threshold wins
   (45.9% → 19.1% on main code; time-limit endings 20.2% → 36.7%).
10. **Reported earlier, not re-measured here**: the spatial grid is not outcome-neutral in the default radius-28
    6-robot arena (FEAT-003: grid on vs off gave the same winner and damage in 15 of 30 seeds after #520, 21 of 30
    before). Pre-existing (Spec #44).

### Reproduce

From the repository root (`$R`) with the branch checkout at `$B` (any commit on `feature/season2-combat-tuning`
from `23ecc11d` on) and dependencies installed:

```sh
W="$R/.worktrees"
for a in main 521 519 520 520fix; do git -C "$R" worktree add --detach "$W/s2pkg-arm-$a" 0d7e5b51; done
git -C "$W/s2pkg-arm-521" cherry-pick --no-commit cd3361f3
git -C "$W/s2pkg-arm-519" cherry-pick --no-commit 0d3a6ca7
git -C "$W/s2pkg-arm-520" cherry-pick --no-commit 4ea1d534
git -C "$W/s2pkg-arm-520fix" cherry-pick --no-commit 4ea1d534
git -C "$W/s2pkg-arm-520fix" cherry-pick --no-commit 71267b49
for a in main 521 519 520 520fix; do
  ln -sfn "$B/node_modules" "$W/s2pkg-arm-$a/node_modules"
  ln -sfn "$B/app/backend/node_modules" "$W/s2pkg-arm-$a/app/backend/node_modules"
  ln -sfn "$B/app/backend/generated" "$W/s2pkg-arm-$a/app/backend/generated"
done

cd "$B/app/backend"   # no DATABASE_URL needed; the harness never connects
A="$W/s2pkg-arm"
ARMS="main=$A-main/app/backend,521=$A-521/app/backend,519=$A-519/app/backend,520=$A-520/app/backend,520fix=$A-520fix/app/backend,combined=$PWD"
KARMS="main=$A-main/app/backend,combined=$PWD"
O=../../logs/s2-package; mkdir -p "$O"
H() { n=$1; shift; pnpm exec tsx scripts/combatBaselineValidation.ts "$@" --out "$O/$n.md" > /dev/null & }
for b in early mid late; do
  for s in range loadout; do H $s-invest-$b --arms "$ARMS" --suite $s --builds invest --budget $b --trials 2000; done
  H koth-invest-$b --arms "$KARMS" --suite koth --builds invest --budget $b --koth-radii 5,7 --trials 2000
done
for L in 10 25; do
  for s in range loadout; do H $s-uniform-$L --arms "$ARMS" --suite $s --level $L --trials 2000; done
  H grand-melee-uniform-$L --arms "$ARMS" --suite grand-melee --level $L --trials 1000
done
H mobility-uniform-25 --arms "$ARMS" --suite mobility --level 25 --trials 2000
H grand-melee-invest-mid --arms "$ARMS" --suite grand-melee --builds invest --budget mid --trials 1000
H koth-uniform-25 --arms "$KARMS" --suite koth --level 25 --koth-radii 5,7 --trials 2000
wait
```

Remove the arms afterwards with `git worktree remove --force "$W/s2pkg-arm-<name>"` (`--force` because of the
symlinks and the uncommitted cherry-picks).
