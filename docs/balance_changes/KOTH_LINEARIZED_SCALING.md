# KotH Balance Update — Linearized Attribute Scaling

**Date**: April 3, 2026  
**Status**: ✅ Implemented  
**Files**: `app/backend/src/services/arena/kothEngine.ts`, `app/backend/src/services/battle/combatSimulator.ts`

---

## Overview

All attribute-based thresholds in KotH replaced with linear scaling. Every point of investment now provides a measurable improvement. Previously, many attributes had hard-gated tiers (e.g., "no effect below 15") that made low-level investment worthless.

---

## Threat Analysis

- **Target priority scaling**: `0.3 + (TA / 50) × 0.7` — linear from 0.314 (TA=1) to 1.0 (TA=50). Previously flat 0.5 for TA < 10.
- **Zone pull bias**: Floor raised from 30% to 40%. Formula: `((TA - 1) / 49) × 0.6 + 0.4`, range [0.40, 1.0].
- **Combat pull multipliers**: Raised from 0.25/0.45 to 0.35/0.55 (attacked/nearby).
- **Avoidance positioning**: Now `TA / 50`, always active (was gated at TA > 15).
- **Flank approach**: Now `TA / 50` blended, always active (was gated at TA > 20).

## Combat Algorithms

- **Movement deviation**: Linear `30 - ((CA - 1) / 49) × 25` degrees. CA=1 gets 30°, CA=50 gets 5°. Previously hard tiers at CA < 15 (±30°), CA 15–30 (±15°), CA > 30 (calculated).
- **Movement prediction**: Linear weight `(CA - 1) / 49`, always active. Previously gated at CA ≥ 20.
- **Wait-and-enter**: Linear blend `CA / 50` between rushing in and waiting. Previously hard-gated at CA > 25.

## Score-Aware Target Priority

Robots now factor opponent scores into target selection:

```
scoreRatio = opponentScore / scoreThreshold
scoreThreatBonus = scoreRatio × 3.0 × threatAnalysisScale(TA)
```

High-scoring opponents become higher priority. High-TA robots pivot to the score leader earlier. Low-TA robots are slower to recognize the threat but eventually do as scores climb.

## Score-Aware Movement Pull

```
scorePull = (targetScore / scoreThreshold) × 0.4 × biasStrength(TA)
```

Reinforces target priority by pulling robots toward high-scoring opponents.

## Passive Penalty Zone Pull

After 20 seconds outside the zone, robots receive increasing movement bias back toward the zone:

```
passivePull = min(0.5, (timeOutside - 20) / 40)
```

Complements the existing damage/accuracy penalties for passive play.

## Passive Penalties Wired Into Combat

The KotH passive penalty system (damage reduction + accuracy penalty for staying outside the zone) is now applied during attack resolution:
- **Damage reduction**: Applied as `(1 - damageReduction)` multiplier on final damage
- **Accuracy penalty**: Applied as subtraction from hit chance

Previously these penalties were tracked but never consumed by the combat simulator.

## Bug Fixes

### Out-of-Range Message Throttling
Melee robots that can't reach their target now show one "can't reach" message per out-of-range streak. Subsequent events suppressed until the robot successfully attempts an attack.

### Counter-Attack Kill Attribution
Kill attribution now scans recent combat events backwards to find the last robot that dealt damage to the dead robot, instead of relying on `currentTarget`. Correctly attributes kills from counter-attacks where the counter-attacker's target is a different robot.
