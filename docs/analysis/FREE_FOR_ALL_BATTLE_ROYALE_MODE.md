# Free-for-All / Battle Royale — Future Game Mode Analysis

**Status**: 📋 FUTURE RELEASE — Design notes only  
**Depends on**: 2D Combat Arena (`.kiro/specs/2d-combat-arena/`)  
**Date**: March 16, 2026

---

## Concept

A large-scale elimination mode where many robots (up to 100) fight in a single arena. Last robot standing wins. Optional shrinking arena boundary forces engagements over time.

## Format Options

- **Small FFA**: 8–16 robots, standard arena, pure elimination
- **Medium FFA**: 16–32 robots, large arena, optional shrinking boundary
- **Battle Royale**: 50–100 robots, massive arena, mandatory shrinking boundary

## Arena Scaling

Using the 2D arena spec formula: radius = 16 + (total robots − 2) × 3

| Robots | Arena Radius | Diameter | Starting Distance (approx) |
|--------|-------------|----------|---------------------------|
| 8 | 34 | 68 | ~60 units |
| 16 | 58 | 116 | ~100 units |
| 32 | 106 | 212 | ~180 units |
| 50 | 160 | 320 | ~280 units |
| 100 | 310 | 620 | ~540 units |

**Problem**: At 100 robots, the arena is so large that melee robots spend 30+ seconds just walking toward anyone. A shrinking boundary is likely mandatory for 50+ robot matches.

## Phase Analysis: What Happens in a 100-Robot FFA

### Early Game — Chaos and Clustering
- 100 robots all pick targets via threatAnalysis
- Low threatAnalysis robots pick the nearest opponent and beeline toward them
- High threatAnalysis robots evaluate the field and pick weaker targets
- Natural clusters of 2–3 robots fighting each other form while others are still crossing the arena
- Melee robots are at a huge disadvantage — they need to close 300+ units of distance while taking chip damage from ranged robots during the approach

### Mid Game — The Vulture Problem
- Smart robots (high combatAlgorithms + high threatAnalysis) realize the optimal strategy is to NOT engage
- Let everyone else fight, wait for them to weaken each other, then pick off survivors
- A fast ranged robot with high AI attributes orbits the edges, avoids fights, and only engages damaged targets
- This is the "third party" problem every battle royale has

### Late Game — Survivor's Advantage
- Robots that avoided early fights are at full HP/shields against battered survivors
- Adaptive AI (Req 7) helps survivors somewhat — they've accumulated Adaptation_Bonus from damage taken
- But they're still at a massive HP disadvantage against fresh vultures

## Who's Favored?

The optimal FFA build is NOT the same as the optimal 1v1 build:

### Tier 1 — Vulture Build (Strongest)
- High servoMotors (stay away from everyone)
- Long-range weapon (sniper/railgun)
- High threatAnalysis (know when to engage and when to run)
- High combatAlgorithms (smart target selection, movement prediction)
- Moderate defenses (survive incidental damage)
- **Strategy**: Avoid fights, orbit edges, pick off weakened targets

### Tier 2 — Tank Build (Strong)
- High hullIntegrity + armorPlating + shieldCapacity + powerCore
- Mid-range weapon (doesn't need to close distance, doesn't need to stay far)
- Moderate AI attributes
- **Strategy**: Absorb damage from multiple attackers, outlast glass cannons

### Tier 3 — Melee Brawler (Disadvantaged)
- High servoMotors + hydraulicSystems
- Melee weapon with high burst damage
- **Problem**: Closing 300+ units of distance while 10 other robots shoot at you is brutal
- **Problem**: By the time you reach anyone, you've already taken significant damage
- The melee closing bonus and servo strain help in 1v1, but in FFA there's always another ranged robot shooting from a different angle

## Shrinking Arena (Battle Royale Mechanic)

For 50+ robot matches, a shrinking boundary is likely mandatory to prevent stalling:

- Arena starts at full size
- After an initial grace period (e.g., 30 seconds), the boundary begins shrinking at a steady rate
- Robots outside the shrinking boundary take damage over time (environmental damage, bypasses shields and armor)
- Shrink rate should be tuned so the arena reaches melee-range size by ~75% of the max battle duration
- This forces ranged robots into close quarters eventually, giving melee builds a late-game window
- The shrinking boundary can be implemented using the arena zones system (Req 16, AC 4) — the "safe zone" shrinks while the "damage zone" grows

### Shrink Schedule Example (100 robots, 310 radius)

| Time | Arena Radius | Effect |
|------|-------------|--------|
| 0–30s | 310 | Full size, grace period |
| 30–60s | 200 | Outer robots forced inward |
| 60–90s | 100 | Clusters merge, fights intensify |
| 90–120s | 30 | Close quarters, melee viable |
| 120–150s | 10 | Final showdown, everyone in melee range |

## The Vulture Problem — Potential Solutions

The biggest design challenge: passive play (avoiding fights) is the optimal strategy.

### Option A: Aggression Incentive
- Robots that haven't dealt damage in X seconds receive a debuff (reduced shields, reduced armor)
- Forces engagement without dictating who to fight
- Risk: punishes legitimate repositioning

### Option B: Bounty System
- Each kill grants a small HP/shield heal (e.g., 10% of max HP restored)
- Rewards aggressive play and creates a snowball for fighters
- Natural counter to vultures: fighters heal, vultures don't
- Risk: could make early aggression too strong

### Option C: Visibility Mechanic
- Robots that haven't attacked recently become "marked" — visible to all opponents with a targeting bonus
- Punishes hiding without directly damaging the robot
- High threatAnalysis robots can detect marked opponents from further away

### Option D: Shrinking Arena Only
- Don't add any anti-passive mechanic — let the shrinking arena force engagements naturally
- Simplest solution, least design risk
- May still allow vulturing in the mid-game before the arena shrinks enough

**Recommendation**: Start with Option D (shrinking arena only) for the initial implementation. Add Option B (bounty/heal on kill) if playtesting shows vulturing is still dominant.

## Performance Considerations

100 robots creates computational challenges:

| Operation | Per Step (0.1s) | Notes |
|-----------|----------------|-------|
| Threat calculations | 100 × 99 = 9,900 | Each robot evaluates all opponents |
| Movement calculations | 100 | Independent movement per robot |
| Distance calculations | 100 × 99 / 2 = 4,950 | Pairwise distances |
| Attack resolution | ~10–20 | Only robots with ready cooldowns |
| Flanking evaluation | Variable | Only when multiple attackers share a target |

**Mitigation strategies**:
- Spatial partitioning (grid or quadtree) to limit threat evaluation to nearby robots only
- Threat_Score caching — only recalculate when a robot takes significant damage or moves substantially
- Reduce simulation step frequency for distant robots (robots >50 units from any opponent can update at 0.5s instead of 0.1s)
- Consider a maximum battle duration shorter than the standard 120s for large FFAs

## Attribute Value Shifts (vs 1v1)

| Attribute | 1v1 Value | FFA Value | Why |
|-----------|-----------|-----------|-----|
| servoMotors | Medium | Very High | Escape, reposition, chase weakened targets |
| threatAnalysis | Medium | Very High | Target selection among 99 opponents is critical |
| combatAlgorithms | Medium | Very High | Smart engagement timing wins FFAs |
| hullIntegrity | Medium | Very High | Surviving multiple fights requires raw HP |
| armorPlating | Medium | High | Chip damage from many sources adds up |
| adaptiveAI | Medium | High | Accumulates bonuses across many fights |
| hydraulicSystems | Medium | Low | Melee is risky in open-field FFA |
| counterProtocols | Medium | Low | Counter-attacks matter less when threats come from all directions |

## Open Questions for Future Spec

1. Should FFA have team variants (e.g., 10 teams of 10)?
2. Should eliminated robots spectate or disconnect?
3. What rewards structure? Winner-take-all or top-N placement rewards?
4. Should there be weapon/item pickups on the arena (loot)?
5. How does matchmaking work for FFA? ELO-based entry tiers?
6. Should the playback viewer support 100 robots, or is a simplified "highlights" replay more practical?
7. Maximum battle duration for large FFAs? 120s may be too short for 100 robots.

## Dependencies

- 2D Combat Arena must be fully implemented (spatial positioning, range bands, movement)
- Requirement 12 (Multi-Robot Battle Support) provides the foundation for many-robot battles
- Requirement 16 (Extensibility) provides pluggable win conditions and arena zones
- Servo_Strain (Req 2) prevents infinite kiting but may need tuning for FFA scale
- Performance optimization may require architectural changes to the simulation loop
