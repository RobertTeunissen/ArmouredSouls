# Investigation: why short range dominates after the Season 2 package (PR #537, round 2)

**Status:** dated evidence (October 2026). It led to Season 2 round 3 (#540): Grand Melee own-weapon targeting (option 1), ranged positioning (option 2) and short Hydraulic Systems 0.005 (option 3). The 1v1 arena size stays open in #543. Decisions: [SEASON_2_PRODUCT_DECISIONS.md](../balance_changes/SEASON_2_PRODUCT_DECISIONS.md).

Read-only investigation of `feature/season2-combat-tuning` @ `2d8d89ed` (round 2 included), compared with `main` @ `0d7e5b51`.
Nothing was changed on the branch, its worktree or the main checkout; no database was used.

## Summary for the product owner

- **Short range wins 1v1 because it always fights at its own distance and the others never do.** Against a mid or long
  robot, the short robot walks up to ~5 units and stays there. The mid/long robot backs off, but there is no "keep your
  distance" mode against another ranged robot, it is slowed by strain while retreating, and the 1v1 arena is small: it
  ends up against the wall 95–97% of the time. Short spends ~78% of the fight in its best band; mid ~20%, long ~2%.
  Every short hit gets ~1.28× damage; mid gets ~0.89×, long ~0.61×.
- **Short beats melee because the new chase rules park the fight exactly in short's best band.** The melee robot
  chases, the short robot backs off, and the fight hovers at 2–4 units: just outside melee reach, inside short's band.
  Short fires at full bonus (incl. Hydraulic Systems); melee is in reach only ~12% of the time. A mid/long robot
  caught in the same chase fires at the same 2–4 units with a 25–50% penalty, so melee beats them.
- **This was already true on main** (short 75–79%). The package made short weaker against mid/long (Hydraulics cut)
  but much stronger against melee (the engagement cycle), so short's total went up.
- **Grand Melee: long robots get "focused".** At the start everyone stands ~22 units apart, which is long range. The
  targeting AI treats "his weapon fits this distance" as a 1.5× threat (others 0.8×), so long robots are everyone's
  first target. The new Logic Cores bonus makes all that long-range fire hit harder, so long robots now die ~18 s
  sooner. Short robots look harmless from far away, get targeted least, and pick up the places. In 1v1 the same bonus
  barely matters because long never gets to long range there. That is why Grand Melee moved the opposite way.
- **What fixes it:** two targeting rules in Grand Melee, and a positioning rule ("ranged robots keep their distance from
  closer-range robots") in 1v1. Number tweaks (Hydraulics, range penalty) only shave a few points off.
  Recommended options are ranked at the end, with measured effects.

## Method

- Scratch worktrees `.worktrees/scratch-short-range` (branch HEAD) and `.worktrees/scratch-short-range-main`
  (`0d7e5b51`), dependencies symlinked from the branch worktree, both removed afterwards.
- Instrumentation (temporary scratch patches, not kept in the repository):
  a per-tick hook in `simulationLoop.ts` (after the patience update) that records distance, bands, wall contact,
  speed, strain, bursts, targets; per-hit `formulaBreakdown.components` (range penalty, hydraulic, Logic Cores) from
  events. Experiment switches are environment variables in the scratch copy only (`X_HYD_SHORT`, `X_RP_TWO`, `X_KITE`,
  `X_RPURSUE`, `X_WTHREAT`, `X_TSEL`, `X_THREAT`, `X_MOVE`, `X_LC_WEAPON`, …); unset they are byte-for-byte the branch.
- Script `scripts/investigate/shortRange.ts` (scratch) reproduces the harness' **invest** builds, weapon sampling, seed
  derivation (seed 516), side alternation and Grand Melee orchestration (16 robots, radius 58, `allowDraws: false`) of
  `scripts/combatBaselineValidation.ts`. Sanity check: its scores reproduce the report exactly (combined invest mid:
  melee vs short 18.3%, short vs mid 71.1%, short vs long 89.3%, melee vs long 78.5%; main 40.8/83.1/93.8/84.4%; GM
  combined ranks 0.592/0.386/0.451/0.571, main 0.682/0.465/0.406/0.447).
- n = 2,000 trials per 1v1 cell (95% CI ±1.2–2.2 pp per cell; class score = mean of its 3 cells), n = 1,000 Grand
  Melee battles (rank CI ≈ ±0.009), KotH via the harness with n = 1,000 fields (rank CI ≈ ±0.015). Late-budget arena
  checks n = 1,000 (±1.8–2.8 pp). All numbers are invest mid unless stated.

## Q1 — 1v1 short vs mid and short vs long

Combined arm, invest mid (A = short):

| Metric | short vs mid: short / mid | short vs long: short / long |
|---|---|---|
| Score of short | 71.1% ±2.0 | 89.3% ±1.2 |
| Distance distribution (time) | short band 78.6%, mid 20.3%, long 1.1% | short 76.7%, mid 20.9%, long 2.4% |
| Distance histogram | 76% of ticks at 5–6 units | 74% at 5–6 units |
| Time in own optimal band | 78.6% / 20.3% | 76.7% / 2.4% |
| Time at the arena wall (≤0.5 from edge) | 13.9% / **95.5%** | 13.7% / **96.8%** |
| Mean servo strain | 20.1% / 24.3% | 20.0% / 24.7% |
| Mean effective speed | 9.89 / 9.31 | 9.90 / 9.24 |
| Mean range-penalty mult per hit | 1.04 / 0.82 | 1.03 / 0.56 |
| Mean hydraulic mult per hit | 1.22 / 1.01 | 1.22 / 1.01 |
| Mean Logic Cores mult per hit | 1.00 / 1.06 | 1.00 / 1.06 |
| Product (spatial damage mult) | **1.28 / 0.89** | **1.27 / 0.61** |
| Hit / crit / malfunction | 74% / 8% / 18% both sides | same |
| Damage per second dealt | **3.84 / 3.12** | **3.74 / 2.28** |
| Raw weapon DPS (base/cooldown) | 2.66 / 2.89 | 2.65 / 2.93 |

Findings:

- **Short controls the distance.** `movementAI.calculateMovementIntent` sends every non-pursuing robot to a point at
  its band midpoint from the nearest opponent (`RANGE_BAND_MIDPOINTS`: short 4.5, mid 9.5, long 16). Both robots try
  to hold their own midpoint, so the closer-preferring robot advances and the other retreats.
- **Mid/long have no movement mode to keep distance from a short robot.** `servoStrain.calculateEffectiveSpeed`
  grants kiting (1.10×, strain-free) only if `opponentRole === 'melee'`; short is the `ranged` role
  (`engagementCycle.getEngagementRole`). So both move at normal speed with strain, and the retreater strains more
  (24% vs 20%) because it is always moving.
- **The wall decides it.** 1v1 arena radius is 16 (`arenaLayout.calculateArenaRadius`). The retreater reaches the
  wall within seconds and then slides along it (#520 wall-aware retreat); the chaser cuts across the inside of the
  circle and keeps the gap at ~5 units. The mid/long robot is at the wall 95–97% of the battle.
- **Yes: short is almost always in its optimal band, mid/long are forced one or two bands off.** The damage gap is
  entirely positional: raw weapon DPS is actually lower for short (2.66 vs 2.89/2.93), hit/crit/malfunction rates are
  identical, but the spatial multiplier is 1.28 vs 0.89 (mid) / 0.61 (long).
- Mid vs long shows the same mechanism one band up: mid in its band 96.7%, long at the wall 97.3%, mid 75.3%.

## Q2 — melee vs short (18.3%)

Combined arm, invest mid (A = melee, B = short); compared with melee vs mid / long:

| Metric | melee vs short | melee vs mid | melee vs long |
|---|---|---|---|
| Score of melee | 18.3% | 54.5% | 78.5% |
| Time in melee band (≤2) | 12.2% | 12.6% | 13.3% |
| Distance histogram | 58% at 2–3, 22% at 3–4 units | 54% at 2–3 | 55% at 2–3 |
| Ranged robot's hits in melee band / short band | 12% / 88% | 13% / 81% | 13% / 81% |
| Ranged robot's spatial mult (RP × hyd × LC) | **1.35** (1.06 × 1.28 × 1.00) | 0.77 (0.74 × 1.01 × 1.02) | 0.54 (0.52 × 1.01 × 1.02) |
| Melee spatial mult (all hits at ≤2) | 1.62 | 1.61 | 1.61 |
| Disengage burst time (ranged) / commit time (melee) | 13.1% / 4.6% | 12.7% / 4.6% | 12.7% / 4.3% |
| DPS melee / ranged | 2.81 / **4.11** | 2.63 / 2.80 | 2.74 / 2.13 |

- **The engagement cycle parks every melee-vs-ranged fight at 2–4 units**, whatever the ranged class: pursuit 1.15
  vs kiting 1.10, kiting stops once the ranged robot is at its own midpoint, and the disengage burst (13% of the time)
  throws the gap back out to just beyond reach. Melee is within reach only 12–13% of the time against every class.
- **2–4 units is the short band.** Short fires 88% of its shots there at 1.1× range and 1.28× Hydraulics (short
  focus buys ~27 Hydraulic Systems at invest mid; `hydraulicBonus.ts` applies by distance band). Mid fires at the same
  distance at 0.75×, long at 0.5×, and Logic Cores gives them nothing there. That alone explains the 18.3 / 54.5 /
  78.5% ladder.
- On main the same cell was 40.8%: melee spent 46% of the battle in reach (no disengage, chase stall order effects),
  so short got only 52% of its shots in its own band (spatial mult 1.36 there too). #520 reduced melee's contact time
  from 46% to 12%, and the time it removed became short-band time for the short robot.
- Short preferred range 4.5 sits so close to reach (2) that "kiting" for short means fighting at 2.5–4.5, always in
  band; for mid/long, kiting toward 9.5/16 never completes because pursuit (1.15) out-speeds kiting (1.10).

## Q3 — build and harness effects

| Variant (invest mid) | melee | short | mid | long | short vs mid | short vs long | melee vs short |
|---|---|---|---|---|---|---|---|
| combined (baseline) | 50.4 | **80.7** | 49.9 | 19.0 | 71.1 | 89.3 | 18.3 |
| short focus logicCores instead of hydraulicSystems | 56.4 | 70.0 | 53.3 | 20.3 | 60.8 | 85.3 | 36.0 |
| only the highest-DPS weapon per class/hands | 41.2 | 89.4 | 55.0 | 14.4 | 78.0 | 97.3 | 7.1 |

- **Weapons are not the cause.** At invest mid every weapon fits the 40% share, so selection is uniform over the
  catalogue. Short's mean raw DPS is the lowest of the ranged classes (2.65 vs 2.89 mid, 2.93 long). The top DPS per
  class is equal (one-handed 4.00: Volt Sabre / Nova Caster / Particle Lance; two-handed Arc Projector 3.25,
  Plasma Cannon 3.00, Ion Beam 3.25). Forcing the best weapon makes short *more* dominant (89.4%), because every
  robot's damage scales with the same positional multiplier.
- **The focus lists account for roughly 10 pp.** Short's focus buys Hydraulic Systems, a damage multiplier that is
  active where short actually fights. Mid/long buy Logic Cores, which pays only in mid/long bands they rarely reach
  in 1v1. Giving short the mid/long focus drops it from 80.7% to 70.0% (melee vs short 18.3 → 36.0%). This is a
  real game property (a rational player builds the same way), not a harness bug, but it inflates the gap compared
  with players who don't stack Hydraulics on short builds.
- **Not an invest artefact in general:** uniform builds also put short on top (68.7% / 63.7% at L10 / L25, round 2
  report), and there every class has Hydraulics too.
- **Arena size matters.** The same 1v1 at arena radius 24 instead of 16: short 73.7%, melee 43.0%, mid 56.9%, long
  26.4%. The small arena is part of the mechanism (Q1), so harness results match production here (the harness uses
  the production 1v1 radius).

## Q4 — Grand Melee (16 robots, invest mid, n = 1,000)

Per class, main → combined:

| Metric | melee | short | mid | long |
|---|---|---|---|---|
| Normalized rank (lower is better) | 0.682 → 0.592 | 0.465 → **0.386** | 0.406 → 0.451 | 0.447 → **0.571** |
| Podium | 9.4 → 13.3% | 19.4 → 27.4% | 26.2 → 22.7% | 20.0 → 11.6% |
| Survival time (s) | 53.4 → 54.4 | 72.1 → 68.4 | 76.6 → 63.2 | **73.5 → 55.3** |
| Among the first four eliminated | 52.2 → 36.3% | 18.2 → 12.6% | 13.5 → 19.5% | 16.2 → **31.6%** |
| Mean elimination index (0 = first out) | 4.30 → 5.86 | 7.36 → 8.58 | 8.07 → 7.47 | 7.55 → 6.05 |
| Damage dealt / taken | 215/238 → 198/231 | 237/239 → 211/229 | 246/235 → 254/227 | 254/239 → 253/229 |
| Opponents targeting it, per alive tick (first 15 s) | 0.99 (1.28) → 0.90 (1.03) | 0.95 (0.83) → 0.89 (**0.66**) | 0.94 (0.79) → 1.00 (0.90) | 1.11 (1.10) → 1.22 (**1.41**) |
| Damage taken in first 15 s from mid / long robots | 16/16 → 16/18 | 10/9 → 10/9 | 10/11 → 17/17 | 14/17 → **24/28** |
| Distance to its target: long band share | 20.8 → 24.0% | 26.3 → 29.3% | 39.8 → 42.8% | 72.4 → 71.0% |
| Mean spatial mult per hit | 1.80 → 1.62 | 1.08 → 1.00 | 0.90 → 1.15 | 0.97 → 1.30 |

Mechanism:

1. **The opening is fought at long range.** Spawns are on a ring of radius 56 (`simulationLoop`, `n > 2`): neighbours
   are ~22 units apart, all long band. Long robots then stay there (71% of their target time at long distance);
   melee/short close in.
2. **Target selection systematically focuses long robots.** `threatScoring.calculateThreatScore` multiplies by
   `weaponThreat` = 1.5 if the *opponent's* weapon band equals the current distance band, else 0.8. At long distance
   this is 1.5 for long robots and 0.8 for everyone else (×1.9). Proximity decay is normalized by the arena diameter
   (116), so it barely discounts a target 22 units away (0.51 vs 0.79 at 6 units). The score also uses the
   opponent's `totalDamageDealt` (falling back to `maxHP × 0.5` before the first hit), so high-damage dealers attract
   more fire. Note the `movementAI` moves toward the *nearest* opponent while `selectTarget` shoots the *highest
   threat*, so robots fire across the arena at long robots with whatever weapon they hold.
3. **Logic Cores (#519) turns that focus into early deaths.** The bonus is distance-based (`logicCoresBonus.ts`), so
   every mid/long robot (Logic Cores ~26) gets 1.26–1.39× on hits at long distance, and the robots standing at long
   distance are the long robots. Damage taken by long robots in the first 15 s rises from 31 to 52 (mid + long
   attackers); total damage taken stays ~230, but it arrives earlier, so long robots die 18 s sooner and are among the
   first four out twice as often. Long also deals more damage (spatial mult 0.97 → 1.30), which raises its own
   damage-based threat (targeted-by in the first 15 s 1.10 → 1.41).
4. **Short is the "quiet" class.** It deals the least damage (threat term) and from long distance its weapon is "off
   band" (0.8), so it is targeted least (0.66 in the first 15 s) and inherits the places freed by long/mid deaths.
   Short's own damage barely changed relevance; its rank gain is a by-product of others being focused.

Isolating #519 (paired, same seeds; combined arm with the #519 coefficients switched back):

| Arm | melee | short | mid | long |
|---|---|---|---|---|
| combined | 0.592 | 0.386 | 0.451 | 0.571 |
| combined, #519 off (Hydraulics 0.02/0.015, Logic Cores 0) | 0.656 | 0.466 | 0.408 | 0.470 |
| combined, Logic Cores off only | 0.644 | 0.453 | 0.419 | 0.484 |
| combined, old Hydraulics only (LC on) | 0.603 | 0.402 | 0.446 | 0.549 |
| combined, Logic Cores only on weapon's own band (`X_LC_WEAPON`) | 0.606 | 0.400 | 0.430 | 0.564 |
| combined, static threat (`maxHP × 0.5`, no damage term) | 0.594 | 0.461 | 0.438 | 0.508 |
| combined, flat weaponThreat (1.0 for everyone) | 0.631 | 0.416 | 0.484 | 0.469 |

- With #519 off, GM ranks return to main values (short 0.466 vs 0.465, long 0.470 vs 0.447): **#519, specifically the
  Logic Cores bonus, explains almost the whole GM shift** (LC off: long −0.087, short +0.067). The Hydraulics cut alone
  is minor (long −0.022).
- Gating LC to the weapon's own band does not help (long 0.564): the damage that kills long robots is long-vs-long
  and mid-at-long fire within a band where LC is legitimately active.
- Removing the targeting bias does help: flat weaponThreat brings long to 0.469 without touching LC.

**Why opposite to 1v1:** in 1v1 long is in its band 2.4% of the time vs short and 1.6% vs melee, so its Logic Cores
almost never pays (LC mult 1.02–1.06) and #519 is a small net plus for mid/long. In Grand Melee the long band is
where long robots *live* and where everyone else's LC-boosted fire meets them, while the targeting rule concentrates
that fire on them. Same bonus, opposite exposure.

## Q5 — was short already dominant on main for the same reasons?

Yes. Main, invest mid, short vs mid: short in band 93.1%, mid at the wall 93.8%, spatial mult 1.51 (RP 1.08 ×
hyd 1.39) vs 0.78, DPS 4.46 vs 2.96, score 83.1%. Short vs long 93.8% (0.52 mult for long). The package changed:

| Effect on short | Mechanism | Size (invest mid) |
|---|---|---|
| Weaker vs mid/long | Hydraulics short 0.015 → 0.01 (1.39 → 1.22 per hit); Logic Cores gives mid 1.06; wall-slide lets mid reach its band 20% instead of 6% | short vs mid 83.1 → 71.1, short vs long 93.8 → 89.3 |
| Much stronger vs melee | Engagement cycle: melee contact 46% → 12%, fight parked at 2–4 units (short band) | melee vs short 40.8 → 18.3 |
| Net | melee collapse outweighs the nerf | short 78.7 → 80.7% |
| Grand Melee | LC-boosted focus on long robots | short rank 0.465 → 0.386 |

## Q6 — fix options, ranked

Measured on the combined arm (invest mid unless stated; 1v1 class score = mean of 3 cells, cells ±1.2–2.2 pp; GM ranks
±0.009; KotH ranks ±0.015).

| Variant | melee | short | mid | long | short vs mid | short vs long | melee vs short |
|---|---|---|---|---|---|---|---|
| combined (today) | 50.4 | 80.7 | 49.9 | 19.0 | 71.1 | 89.3 | 18.3 |
| A: ranged kiting vs closer ranged (1.10) + ranged pursuit 1.00 | 50.4 | 49.3 | 66.5 | 33.8 | 21.2 | 45.1 | 18.3 |
| A: … + ranged pursuit 1.05 | 50.4 | 64.0 | 60.2 | 25.4 | 40.3 | 70.1 | 18.3 |
| A: … + ranged pursuit 1.10 | 50.4 | 77.1 | 52.2 | 20.3 | 64.1 | 85.5 | 18.3 |
| A without a pursuit counterpart (kiting 1.10 only) | 50.4 | 31.5 | 62.2 | 55.9 | 9.7 | 2.9 | 18.3 |
| C: Hydraulics short 0.01 → 0.005 | 53.1 | 75.2 | 51.7 | 20.0 | 65.0 | 86.2 | 25.4 |
| C: Hydraulics short 0 | 56.1 | 68.8 | 53.9 | 21.2 | 58.2 | 82.1 | 34.0 |
| A (pursuit 1.05) + C (0.005) | 53.1 | 58.7 | 61.8 | 26.5 | 34.8 | 66.6 | 25.4 |
| D: range penalty two+ bands 0.50 → 0.65 | 44.4 | 78.5 | 50.8 | 26.3 | 71.1 | 82.6 | 18.3 |
| E: range penalty one band 0.75 → 0.85 | 47.0 | 79.2 | 51.9 | 21.8 | 65.5 | 89.5 | 17.5 |
| F: 1v1 arena radius 16 → 24 | 43.0 | 73.7 | 56.9 | 26.4 | 58.8 | 79.2 | 17.0 |

By budget (short score, early / mid / late): combined 84.1 / 80.7 / 80.5; A (pursuit 1.05) 68.0 / 64.0 / 81.7;
A (1.00) 48.6 / 49.3 / 79.6; C (0.005) 81.4 / 75.2 / 73.9; A (1.05) + C 65.3 / 58.7 / 75.1.

Grand Melee ranks (melee / short / mid / long; podium long):

| Variant | ranks | long podium |
|---|---|---|
| combined | 0.592 / 0.386 / 0.451 / 0.571 | 11.6% |
| B1: flat weaponThreat | 0.631 / 0.416 / 0.484 / 0.469 | 21.4% |
| B2: B1 + scale threat by own weapon's range multiplier at that distance | 0.611 / 0.460 / 0.474 / 0.455 | 23.3% |
| B2 + A (pursuit 1.05) | 0.614 / 0.463 / 0.479 / 0.443 | 23.7% |
| B1 + static threat (no damage term) | 0.659 / 0.516 / 0.452 / 0.372 | 34.2% (overshoot) |
| own-weapon scaling only | 0.580 / 0.426 / 0.454 / 0.539 | 15.2% |
| threat uses max(damage dealt, maxHP × 0.5) | 0.578 / 0.411 / 0.454 / 0.558 | 11.9% |
| movement toward the selected target instead of the nearest | 0.548 / 0.403 / 0.495 / 0.555 | 12.9% |
| A, C, D or E alone | long 0.570–0.580, short 0.364–0.394 | 11.0–12.2% |

KotH (radius 7, invest mid) stays put under every option tested: ranks short 0.539–0.550, mid 0.365–0.370, long
0.329–0.353, melee 0.652–0.668 (baseline 0.550 / 0.370 / 0.339 / 0.652). B does not act in KotH (KotH uses
`KothTargetPriorityStrategy`), and 1v1 never calls `selectTarget` with more than one opponent.

### 1. Grand Melee targeting fix (B2) — mechanism fix, GM only

Replace the opponent-band `weaponThreat` (1.5 / 0.8) with a neutral factor and multiply the score by the evaluating
robot's *own* range multiplier at that distance (`getRangePenalty(ownWeaponBand, band(distance))`), i.e. "shoot who
I can hurt", not "shoot whoever is comfortable at this distance". Files: `arena/threatScoring.ts`.
- Expected: long 0.571 → 0.455, short 0.386 → 0.460, mid 0.451 → 0.474, melee 0.592 → 0.611; long podium 11.6 → 23.3%.
  Ranged classes end up within 0.02 of each other; melee is last, which fits the "GM gravitates to mid/long" intent.
- Leaves #519 intact; no 1v1 or KotH effect (verified). B1 alone (flat factor) gets most of it.
- Do not also drop the damage-dealt term (B1 + static overshoots: long 0.372, short 0.516).
- Verify: harness `--suite grand-melee --builds invest --budget mid` and uniform L10/L25 (n = 1,000), plus
  `threatScoring` unit tests; check 1v1/KotH suites are byte-identical.

### 2. Ranged positioning mode (A) — mechanism fix, 1v1

Extend kiting in `servoStrain.calculateEffectiveSpeed`: a ranged robot whose opponent's engagement midpoint is
*closer* than its own kites at 1.10× (strain-free) while inside its own midpoint; give the closer-preferring ranged
robot a ranged-pursuit multiplier while beyond its midpoint (pass the opponent's engagement midpoint into
`ServoStrainState`). The pursuit value is the tuning knob: 1.05 gives short 64.0% (mid), short vs mid 40.3%, mid 60.2%,
long 25.4%; 1.10 changes little (77.1%); 1.00 overshoots (short 49.3%, short vs mid 21.2%). Kiting without a pursuit
counterpart collapses short to 31.5% (short vs long 2.9%), so both halves are needed.
- Caveat 1: **it does nothing at invest late** (short 81.7% at pursuit 1.05). At Servo ~46 the 1v1 arena (radius 16)
  is crossed in ~2 s, the kiter is pinned at the wall (97%) and the chaser cuts inside the circle. With radius 24 the
  same rule works at late (short vs mid 73.1 → 27.8%, short vs long 85.6 → 48.4%, n = 1,000). Pair A with either a
  wall-aware kiting path (circle/strafe instead of radial retreat) or a 1v1 arena radius that scales with speed;
  that is a design decision.
- Caveat 2: no effect on melee vs short (18.3%), Grand Melee (long 0.570–0.580) or KotH.
- Verify: harness `range` suite at invest early/mid/late and uniform L10/L25; new speed-matrix unit tests mirroring
  the #520 ones; mobility suite unchanged.

### 3. Short Hydraulics 0.01 → 0.005 (C) — number tweak

- Expected: short 84.1/80.7/80.5 → 81.4/75.2/73.9; melee vs short 18.3 → 25.4%; small gains for every other class.
  In Grand Melee it slightly *helps* short (0.386 → 0.364) and does nothing for long. Treat as a complement to A,
  not a fix on its own. With A (1.05): short 65.3 / 58.7 / 75.1.
- Verify: harness `range` suites; `hydraulicBonus` tests.

### 4. Range penalty two+ bands 0.50 → 0.65 (D, reserve lever from #516) — number tweak

- Mostly helps long against melee (melee vs long 78.5 → 63.3%, long 19.0 → 26.3%); short barely moves (80.7 → 78.5).
  It does not address short dominance and lowers melee to 44.4%. No GM/KotH effect. Useful for long's 1v1 level,
  independent of the short question.

### 5. Smaller items

- **Threat damage-term discontinuity** (bug-like): `combatPower = totalDamageDealt > 0 ? totalDamageDealt : maxHP × 0.5`
  drops a robot's threat from ~92 to its first hit's damage, so a robot looks harmless right after its first hit.
  `max(…)` fixes it; GM effect is small (long 0.571 → 0.558). Worth bundling with option 1.
- **Movement toward the selected target** (instead of the nearest): mixed (long 0.555, mid 0.495), not recommended.
- **Range penalty one band 0.75 → 0.85 (E)** and **arena radius 24 alone (F)**: modest short reductions (79.2 / 73.7%),
  F also lowers melee to 43.0%. F is mainly interesting as the enabler for option 2 at late budgets.
- **Logic Cores gated to the weapon's own band**: no GM benefit (long 0.564) and hurts long in 1v1 (14.0%). Rejected.

### Recommendation

Do 1 (targeting) for Grand Melee and 2 (ranged positioning, pursuit ≈ 1.05, plus a wall/arena answer for late builds)
for 1v1, then re-measure before touching numbers. Consider 3 only if short stays above the band afterwards. Option 1 is
self-contained (one file, GM-only blast radius). Option 2 changes 1v1 movement for every ranged-vs-ranged matchup and
needs the same order-independence and speed-matrix tests as the #520 movement fix.

## Limits

- Local simulation with synthetic equal-investment builds (balanced stance, no tuning/refinements); ACC behaviour
  not checked. Option estimates are single-arm experiments with 1,000–2,000 trials, not the full 5-budget matrix.
- The GM rank CI uses per-robot variance (slightly optimistic vs the harness' per-battle group means).
- The kiting/pursuit prototypes are minimal env-switched rules in the scratch copy; a production design (wall
  handling, stance interactions, dual-wield mixed ranges) would differ in detail.
