# Flanking and focus fire in team battles

**Season:** 2 (Nov 2026). **Issue:** #614.

## Problem
- **Flanking** was specified in the 2D combat arena spec (March 2026) and documented in COMBAT_FORMULAS, PRD_ROBOT_ATTRIBUTES and the player guide, but `checkFlanking` was never called. No hit ever got a flanking bonus. The Threat Analysis flank-approach bias (live) set up flanks that paid nothing.
- **Focus fire** (Sync Protocols) was checked every 0.1 s tick on shared *targets* and should then have added bonus damage, but the tick hook reset its damage baseline before the check, so the bonus multiplied zero. Since 31 May 2026 (45298da0) Sync Protocols did nothing in team battles, while 72% of ticks were logged as focus fire.

## Change
Both are Team Coordination effects, in league and tournament 2v2/3v3 only (the team battle engine).

- **Flanking — Formation Tactics.** A hit flanks when a living teammate targets the same enemy, has it in its main weapon's reach, and stands more than 90° away from the attacker around that enemy. Bonus = 20% × √(attacker formationTactics / 50): +6.3% at 5, +11.0% at 15, +14.1% at 25, +20% at 50, none at 0. The defender's Gyro Stabilizers (0.3% per point) and Threat Analysis (1% per point above 25) reduce it. One positional bonus per hit: the larger of backstab and flanking.
- **Focus fire — Sync Protocols.** A hit gets focus fire when a teammate hit the same enemy within the last 1 s. Bonus = 25% × √(avg syncProtocols of the robots hitting it / 50) × (those robots / team size), applied inside the hit's damage. It multiplies with flanking: at most about 1.25 × 1.20 = 1.5×.
- Not in 1v1, Tag Team (one robot per side at a time), King of the Hill or Grand Melee.

## Measured effect
Fixed-seed simulations (random builds with attributes 5–35, one random-band weapon each; the same seeds before and after):

| Mode | Battles | Mean duration | Draws | Flanking hits | Focus fire hits | Backstab hits |
|---|---|---|---|---|---|---|
| 2v2 before | 400 | 54.3 s | 1.8% | 0% | 0% | 6.9% |
| 2v2 after | 400 | 52.3 s | 1.8% | 12.0% | 10.1% | 3.7% |
| 3v3 before | 400 | 53.0 s | 1.5% | 0% | 0% | 11.3% |
| 3v3 after | 400 | 49.1 s | 0.8% | 21.6% | 20.3% | 6.4% |
| 1v1 | 300 | 48.4 s (unchanged) | 11.7% (unchanged) | 0 | 0 | — |

Team battles end about 4% (2v2) and 7% (3v3) sooner. Backstab hits drop because a hit that qualifies for both now counts as flanking whenever flanking pays more. 1v1 results are identical.
