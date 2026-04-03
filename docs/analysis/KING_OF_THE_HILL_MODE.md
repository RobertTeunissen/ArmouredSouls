# King of the Hill — Game Mode Analysis

**Status**: ✅ Implemented  
**Implemented via**: Unified combat simulator (`combatSimulator.ts`) + KotH strategy objects (`arena/kothEngine.ts`) + orchestration in `kothBattleOrchestrator.ts`  
**Original design date**: March 16, 2026  
**Implementation date**: March 18, 2026

> **Note**: This document was originally written as a future design analysis. KotH is now fully implemented using the unified N-robot combat simulator with pluggable `GameModeConfig` strategies. The design notes below reflect the original thinking; see the "Implementation Decisions" section at the bottom for how each open question was resolved.

---

## Concept

A zone-control game mode where robots compete to accumulate points by occupying a central control zone. Victory is determined by point accumulation, not elimination — though combat is the primary tool for contesting the zone.

## Format Options

- **Free-for-all**: 4–8 individual robots, each scoring independently
- **Team-based**: 2v2 or 3v3 teams, shared team score
- **Rotating zone**: Zone moves to a new position every N seconds, forcing repositioning

## Core Mechanics

### Zone Design
- Circular control zone at arena center
- Suggested radius: 4–6 grid units (forces close-quarters combat inside the zone)
- Only robots physically inside the zone accumulate points
- Points tick every 1 second of zone occupation
- If multiple robots from different teams/players are in the zone simultaneously, the zone is "contested" and no one scores (or scoring is reduced)

### Scoring
- Zone control: 1 point per second of uncontested occupation
- Kill bonus: Small point reward (equivalent to ~5 seconds of zone control) to prevent kills from being worthless, but not enough to win by kills alone
- Win condition: First to reach a point threshold (e.g., 60 points = 1 minute of uncontested control) or highest score after a time limit

### Target Selection (Pluggable Strategy)

The 2D arena's extensibility (Requirement 16, AC 5) supports a pluggable Target_Priority strategy. For king of the hill:

**Priority 1 — Zone contesters**: Robots currently inside the control zone. These are actively scoring or blocking your scoring. Highest urgency.

**Priority 2 — Zone approachers**: Robots moving toward the zone. A high threatAnalysis robot recognizes incoming threats before they arrive. combatAlgorithms influences whether the robot intercepts the approacher outside the zone or waits inside.

**Priority 3 — Standard Threat_Score**: Normal combat threat evaluation. Only dominates when no one is contesting or approaching the zone.

**Context-dependent weighting**:
- If you're in the zone alone (scoring): prioritize approaching robots to defend your position
- If the zone is contested (multiple robots inside): prioritize the weakest contester for fastest elimination
- If you're outside the zone: prioritize getting in over fighting perimeter opponents

**Target stickiness**: Robots lock onto their selected target for 1.5 seconds before re-evaluating. This prevents erratic flip-flopping between opponents with similar priority weights, which was especially problematic in KotH where 5-6 robots create many near-equal threat scores. The lock breaks immediately if the target is destroyed or yields.

### Movement Intent (Pluggable Modifier)

The 2D arena's extensibility (Requirement 16, AC 6) supports a pluggable Movement_Intent modifier:

- When no immediate combat threat exists, bias movement toward the control zone
- Bias strength influenced by threatAnalysis (higher = better zone awareness) and combatAlgorithms (higher = smarter zone entry timing)
- High combatAlgorithms robots may wait outside the zone for two opponents to weaken each other before entering

## The Sniper Problem

**Issue**: A sniper robot parks at long range, never enters the zone, and picks off zone contesters. It doesn't score points but prevents others from scoring.

**Natural counters already in the 2D arena spec**:
- Sniper isn't scoring while sniping — it must eventually enter the zone to win
- Range penalties if the zone is positioned so snipers are at mid range, not long range
- Adaptive AI gives zone fighters Adaptation_Bonus from taking damage
- Servo_Strain prevents indefinite repositioning

**Additional mode-specific counters to consider**:
- Zone size relative to arena size — if the zone is small and central, snipers at the edge are far enough away that their damage is reduced
- Time pressure — if there's a score threshold, passive sniping means losing to whoever is actually scoring
- Diminishing returns on kills — kill bonus is small enough that sniping alone can't win

## Attribute Value Shifts

Compared to standard 1v1 league battles, king of the hill changes which attributes matter most:

| Attribute | 1v1 Value | KotH Value | Why |
|-----------|-----------|------------|-----|
| servoMotors | Medium | High | Need to reach and contest the zone quickly |
| threatAnalysis | Medium | Very High | Zone awareness and target prioritization are critical |
| combatAlgorithms | Medium | High | Smart zone entry timing wins games |
| hullIntegrity | Medium | High | Surviving sustained zone combat matters more |
| armorPlating | Medium | High | Taking hits from multiple opponents in the zone |
| formationTactics | Low (1v1) | High (team) | Holding formation inside the zone with teammates |

## Open Questions for Future Spec

1. Should the zone be visible to all robots, or does threatAnalysis influence zone awareness?
2. Should there be a "capture" mechanic (stay in zone for X seconds to claim it) or instant scoring?
3. How does the yield threshold interact with zone control? Does yielding forfeit your score?
4. Should eliminated robots respawn (with a penalty) or is elimination permanent?
5. What rewards does the winner receive? Credits, prestige, fame? Tournament-style or separate?

## Dependencies

- ✅ 2D Combat Arena fully implemented (spatial positioning, range bands, movement)
- ✅ Requirement 16 (Extensibility) provides the architectural hooks — used via `GameModeConfig`
- ✅ Arena zones (Req 16, AC 4) provide the control zone implementation
- ✅ Pluggable target priority (Req 16, AC 5) — implemented as `KothTargetPriorityStrategy`
- ✅ Pluggable movement intent (Req 16, AC 6) — implemented as `KothMovementIntentModifier`

---

## Implementation Decisions

Resolved during implementation (March 18, 2026). These answer the "Open Questions" above.

### Q1: Zone visibility vs. Threat Analysis awareness
**Decision**: Zone is visible to all robots. Threat Analysis influences *target prioritization* near the zone (zone contesters weighted 3×, approachers 2×), not zone visibility itself. Higher Threat Analysis robots make smarter decisions about *who* to fight near the zone, not *whether* they know where it is.

### Q2: Capture mechanic vs. instant scoring
**Decision**: Instant scoring — 1 point per second of uncontested occupation. No capture delay. This keeps the pace fast and rewards aggressive zone entry. Contested zones (multiple robots from different teams inside) score nothing.

### Q3: Yield threshold interaction
**Decision**: Yield mechanics are active in KotH via the unified simulator. A robot that yields exits the match (treated as eliminated). Its accumulated zone score is preserved for final placement. Yielding does not forfeit score — it just stops the robot from scoring further.

### Q4: Respawning
**Decision**: No respawning. Elimination is permanent. This creates meaningful risk for entering the zone and rewards builds that can survive sustained multi-robot combat. A "last standing" phase gives the final survivor 10 seconds to accumulate score before the match ends.

### Q5: Rewards
**Decision**: Placement-based rewards, separate from league/tournament systems:
- 1st: 25,000 credits, 8 fame, 15 prestige
- 2nd: 17,500 credits, 5 fame, 8 prestige
- 3rd: 10,000 credits, 3 fame, 3 prestige
- 4th-6th: 5,000 credits, 0 fame, 0 prestige

**Winner fame performance multiplier** (1st place only):
- HP ≥ 100%: 2.0× fame (Perfect Victory) → 16 fame
- HP > 80%: 1.5× fame (Dominating) → 12 fame
- HP < 20%: 1.25× fame (Comeback) → 10 fame
- Otherwise: 1.0× fame → 8 fame

**Zone dominance bonus**: +25% to credits, fame, and prestige when >75% of the robot's zone score came from uncontested zone control (vs kill bonuses). Applies to all placements, not just the winner.
- No ELO changes. No league points. Streaming revenue awarded to all participants.

### Format
- Free-for-all with 5-6 robots per match (one per stable, highest ELO selected)
- Two zone variants: Fixed (Mon/Fri) and Rotating (Wed)
- Fixed: 30-point threshold, 150s time limit
- Rotating: 45-point threshold, 210s time limit, zone moves every 30s
- Anti-passive penalties for robots that avoid the zone too long

---

## Balance Update — April 3, 2026

### Linearized Attribute Scaling

All attribute-based thresholds in KoTH have been replaced with linear scaling. Every point of investment now provides a measurable improvement.

#### Threat Analysis
- **Target priority scaling**: `0.3 + (TA / 50) × 0.7` — fully linear from 0.314 (TA=1) to 1.0 (TA=50). Previously flat 0.5 for TA < 10.
- **Zone pull bias**: Floor raised from 30% to 40%. Formula: `((TA - 1) / 49) × 0.6 + 0.4`, range [0.40, 1.0].
- **Combat pull multipliers**: Raised from 0.25/0.45 to 0.35/0.55 (attacked/nearby).
- **Avoidance positioning**: Now `TA / 50`, always active (was gated at TA > 15).
- **Flank approach**: Now `TA / 50` blended, always active (was gated at TA > 20).

#### Combat Algorithms
- **Movement deviation**: Linear `30 - (CA/50) × 25` degrees. CA=1 gets 29.5°, CA=50 gets 5°. Previously hard tiers at CA < 15 (±30°), CA 15–30 (±15°), CA > 30 (calculated).
- **Movement prediction**: Linear weight `(CA - 1) / 49`, always active. Previously gated at CA ≥ 20.
- **Wait-and-enter (KoTH)**: Linear blend `CA / 50` between rushing in and waiting. Previously hard-gated at CA > 25.

### Score-Aware Target Priority

Robots now factor opponent scores into target selection. Each opponent receives a score threat bonus:

```
scoreRatio = opponentScore / scoreThreshold
scoreThreatBonus = scoreRatio × 3.0 × threatAnalysisScale(TA)
```

This means:
- High-scoring opponents become higher priority targets
- High-TA robots pivot to the score leader earlier
- Low-TA robots are slower to recognize the threat but eventually do as scores climb
- The bonus is per-opponent, so two robots fighting for 1st and 2nd naturally draw attention from different attackers based on their TA

### Score-Aware Movement Pull

Movement intent now includes a pull toward the current target proportional to their score:

```
scorePull = (targetScore / scoreThreshold) × 0.4 × biasStrength(TA)
```

This reinforces the target priority by pulling robots toward high-scoring opponents.

### Passive Penalty Zone Pull

After 20 seconds outside the zone, robots receive an increasing movement bias back toward the zone:

```
passivePull = min(0.5, (timeOutside - 20) / 40)
```

This gives robots a behavioral nudge back toward the zone, complementing the existing damage/accuracy penalties.

### Passive Penalties Wired Into Combat

The KoTH passive penalty system (damage reduction + accuracy penalty for staying outside the zone) is now applied during attack resolution:
- **Damage reduction**: Applied as `(1 - damageReduction)` multiplier on final damage
- **Accuracy penalty**: Applied as subtraction from hit chance (converted to percentage)

Previously these penalties were tracked but never consumed by the combat simulator.

### Out-of-Range Message Improvement

Melee robots that can't reach their target now show one "can't reach" message per out-of-range streak. Subsequent out-of-range events are suppressed until the robot successfully attempts an attack (hit or miss), then the suppression resets.

### Counter-Attack Kill Attribution Fix

Previously, kill attribution used `currentTarget` to find the killer — checking which alive robot was targeting the dead robot. This failed for counter-attack kills because the counter-attacker's `currentTarget` points at a different robot (the one they're hunting), not the robot they just killed via counter.

The fix scans recent combat events backwards to find the last robot that dealt damage to the dead robot. This correctly attributes kills from:
- Regular attacks (attacker's `currentTarget` matches victim)
- Counter-attacks (defender countered and killed the original attacker)
- Any other damage source

Falls back to the `currentTarget` heuristic if no matching event is found.
