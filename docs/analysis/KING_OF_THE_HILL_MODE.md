# King of the Hill — Future Game Mode Analysis

**Status**: 📋 FUTURE RELEASE — Design notes only  
**Depends on**: 2D Combat Arena (`.kiro/specs/2d-combat-arena/`)  
**Date**: March 16, 2026

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

- 2D Combat Arena must be fully implemented (spatial positioning, range bands, movement)
- Requirement 16 (Extensibility) provides the architectural hooks needed
- Arena zones (Req 16, AC 4) provide the control zone implementation
- Pluggable target priority (Req 16, AC 5) provides the targeting override
- Pluggable movement intent (Req 16, AC 6) provides the zone-biased movement
