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
