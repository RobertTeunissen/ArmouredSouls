# Threat Scoring & Target Selection Integration

**Date**: March 18, 2026  
**Status**: ✅ Implemented  
**Priority**: High - Combat depth and multi-robot battle fairness

---

## What Changed

### Combat Simulator Imports

The core combat simulator (`combatSimulator.ts`) now imports spatial arena and game mode types alongside a dedicated target selection function:

| Addition | Source | Purpose |
|----------|--------|---------|
| `ArenaConfig` | `arena/types` | Arena geometry (radius, center, spawn positions, zones) used to contextualize combat |
| `GameModeConfig` | `arena/types` | Pluggable strategy interfaces for target priority, movement modifiers, and win conditions |
| `GameModeState` | `arena/types` | Runtime game mode state (elimination, zone control, battle royale, custom) with per-robot zone scores |
| `selectTarget` | `arena/threatScoring` | Multi-factor threat scoring algorithm that replaces implicit or random target selection |

### Target Selection Algorithm

Target selection is now driven by a composite threat score rather than proximity alone or random assignment. The `selectTarget` function evaluates each living opponent on five weighted factors:

| Factor | Weight/Formula | Rationale |
|--------|---------------|-----------|
| Combat power | `totalDamageDealt × 2` (or `maxHP × 0.5` fallback) | Prioritize opponents who have proven dangerous |
| HP percentage | `currentHP / maxHP` | Healthier opponents are a bigger ongoing threat |
| Weapon range match | `1.5×` if opponent's weapon is optimal at current distance, `0.8×` otherwise | Respect positional danger from well-ranged opponents |
| Arena-normalized proximity | `1 / (1 + normalizedDist × 5)` where `normalizedDist = dist / (arenaRadius × 2)` | Closer opponents are more immediate threats, scaled to arena size |
| Targeting-me factor | `1.3×` if opponent is currently targeting this robot | Defensive awareness — prioritize threats aimed at you |

All factors are scaled by the robot's `threatAnalysis` attribute: `(0.5 + threatAnalysis / 100)`.

### Tiebreaker Rule

When the top two threat scores are within 10% of each other, the closer opponent is selected. This prevents erratic target switching between similarly threatening opponents and rewards positional play.

---

## Why It Changed

1. **Target selection lacked strategic depth**: Previously, the combat simulator did not incorporate spatial awareness or opponent behavior into targeting decisions. Robots had no way to intelligently prioritize threats in multi-robot scenarios, leading to suboptimal and sometimes random-feeling combat outcomes.

2. **Arena mechanics needed integration**: The 2D combat arena introduced spatial positioning, range bands, and arena geometry. Target selection needed to account for these dimensions so that positioning decisions (closing distance, maintaining range) have meaningful consequences on who gets attacked.

3. **Game mode extensibility**: Importing `GameModeConfig` and `GameModeState` allows the combat simulator to support pluggable target priority strategies, movement modifiers, and win conditions. This lays the groundwork for zone control, battle royale, and custom game modes without further refactoring the core simulator.

4. **Robot attributes gain relevance**: The `threatAnalysis` attribute now directly influences target selection quality. Robots with higher threat analysis make smarter targeting decisions, creating a meaningful stat investment choice and differentiating builds beyond raw damage and defense.

---

## Expected Impact on Gameplay

### Build Diversity
- `threatAnalysis` becomes a competitively relevant stat — high-TA robots pick better targets and respond to being focused
- Ranged builds benefit from the weapon range match factor, as opponents at suboptimal range are deprioritized
- Glass cannon builds (high damage, low HP) draw more aggro due to the combat power factor, creating natural counterplay

### Combat Balance
- Multi-robot battles produce more strategic outcomes — robots focus fire on genuine threats rather than arbitrary targets
- The 10% tiebreaker rule reduces target flickering, leading to more committed engagements and cleaner battle logs
- Proximity decay normalized to arena radius means the same logic works consistently across different arena sizes

### Positional Play
- Closing distance on a target now increases your threat score to them (proximity decay), creating risk/reward tension
- Robots with optimal-range weapons at the right distance are treated as higher threats, rewarding good positioning
- The targeting-me factor (1.3×) means robots under focus fire will prioritize their attacker, enabling defensive counter-targeting

### Game Mode Foundation
- `GameModeConfig` enables future modes to override target priority without touching the core simulator
- `GameModeState` tracks mode-specific data (zone scores, custom state) that can influence targeting decisions
- Arena zones can modify threat calculations for mode-specific objectives (e.g., control points)
