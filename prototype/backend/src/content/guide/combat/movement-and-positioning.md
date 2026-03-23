---
title: "Movement & Positioning"
description: "How the 2D combat arena works — movement speed, range bands, weapon optimal ranges, backstab and flanking mechanics, and the attributes that control spatial combat."
order: 2
lastUpdated: "2026-03-17"
relatedArticles:
  - combat/battle-flow
  - robots/attributes-overview
  - robots/attribute-combat-influence
  - weapons/loadout-types
---

## Overview

Battles in Armoured Souls take place in a **circular 2D arena**. Robots spawn on opposite sides and move freely within the arena boundaries. Distance between robots determines which **range band** is active, which directly affects damage through range penalties and weapon restrictions.

Positioning is not just about distance — the **angle** of attack matters too. Getting behind an opponent triggers backstab bonuses, while defenders with high Gyro Stabilizers and Threat Analysis can minimize these advantages.

## The Arena

The combat arena is a circular space. Robots spawn at opposite positions and move toward their preferred engagement range based on their weapon loadout and AI decisions.

- Robots cannot move outside the arena boundary
- The arena edge matters for **Formation Tactics** — robots within 3 grid units of the boundary receive a wall-bracing damage reduction bonus

## Movement Speed

Movement speed is primarily determined by **Servo Motors**:

- **Base speed formula**: 7.0 + servoMotors × 0.2 units/second
- At level 1: 7.2 units/second
- At level 50: 17.0 units/second

Movement speed is also modified by:

- **Stance** — Offensive and Defensive stances modify movement speed
- **Servo strain** — Sustained movement at high speed causes strain, temporarily reducing effective speed. Robots need brief pauses to recover.
- **Closing bonus** — Melee robots moving toward a ranged opponent get a speed boost to help close the gap

```callout-tip
Servo Motors is the key attribute for controlling engagement distance. A fast robot with a sniper can kite a slow melee robot, staying at long range where the sniper deals 1.1× damage while the melee robot can't attack at all. Conversely, a fast melee robot can close the gap and force close-range combat where Hydraulic Systems dominates.
```

## Range Bands

Distance between robots is classified into four range bands:

| Range Band | Distance (grid units) | Weapon Types |
|-----------|----------------------|-------------|
| **Melee** | 0–2 | Melee weapons (Energy Blade, Vibro Mace, War Club, Shock Maul, Thermal Lance, etc.), Shields |
| **Short** | 3–6 | One-handed short (Laser Pistol, Machine Pistol, Volt Sabre, etc.), two-handed short (Scatter Cannon, Laser Rifle, Pulse Accelerator, Arc Projector) |
| **Mid** | 7–12 | One-handed mid (Bolt Carbine, Flux Repeater, Disruptor Cannon, Nova Caster), two-handed mid (Shotgun, Grenade Launcher, Plasma Cannon, Mortar System) |
| **Long** | 13+ | One-handed long (Beam Pistol, Photon Marksman, Gauss Pistol, Particle Lance), two-handed long (Sniper Rifle, Railgun, Ion Beam, Siege Cannon) |

### Range Penalties

Every weapon has an **optimal range band**. Fighting outside that band reduces damage:

| Situation | Damage Multiplier | Example |
|-----------|------------------|---------|
| At optimal range | **1.1×** (+10% bonus) | Sniper Rifle at long range |
| One band away | **0.75×** (-25%) | Sniper Rifle at mid range |
| Two+ bands away | **0.5×** (-50%) | Sniper Rifle at melee range |

### Melee Weapon Restriction

Melee weapons (and shields for counter-attacks) **cannot attack beyond 2 grid units**. If the opponent is at short range or farther, melee weapons simply can't fire. The robot must close the distance first.

This makes Servo Motors critical for melee builds — without the speed to close the gap, your melee weapons are useless.

## Weapon Optimal Ranges

| Weapon Category | Optimal Range | Examples |
|----------------|--------------|---------|
| Melee weapons | Melee (0–2) | Energy Blade, Vibro Mace, War Club, Shock Maul, Thermal Lance, Power Sword, Heavy Hammer |
| Shield weapons | Melee (0–2) | Light Shield, Combat Shield, Reactive Shield, Barrier Shield, Fortress Shield, Aegis Bulwark |
| One-handed short ranged | Short (3–6) | Laser Pistol, Machine Pistol, Burst Rifle, Plasma Rifle, Assault Rifle, Volt Sabre |
| Two-handed short ranged | Short (3–6) | Scatter Cannon, Laser Rifle, Pulse Accelerator, Arc Projector |
| One-handed mid ranged | Mid (7–12) | Bolt Carbine, Flux Repeater, Disruptor Cannon, Nova Caster |
| Two-handed mid ranged | Mid (7–12) | Shotgun, Grenade Launcher, Plasma Cannon, Mortar System |
| One-handed long-range | Long (13+) | Beam Pistol, Photon Marksman, Gauss Pistol, Particle Lance |
| Two-handed long-range | Long (13+) | Sniper Rifle, Railgun, Ion Beam, Siege Cannon |

```callout-info
Two-handed melee weapons like Battle Axe and Heavy Hammer are classified as two-handed but their weapon type determines optimal range. If the weapon type is "melee", optimal range is melee regardless of hands required.
```

## Hydraulic Systems Bonus

**Hydraulic Systems** provides a proximity-scaled damage multiplier that rewards close-range combat:

| Range Band | Bonus per Point | At Level 50 |
|-----------|----------------|-------------|
| Melee (0–2) | +3% per point | +150% (2.5× multiplier) |
| Short (3–6) | +1.5% per point | +75% (1.75× multiplier) |
| Mid (7–12) | No bonus | 1.0× |
| Long (13+) | No bonus | 1.0× |

This makes Hydraulic Systems the highest-impact damage attribute for melee builds. At level 50 in melee range, it more than doubles your damage output — stacking multiplicatively with Combat Power, Weapon Control, and the optimal range bonus.

## Backstab Mechanics

When an attacker is positioned more than **120°** from the defender's facing direction, the attack qualifies as a **backstab**:

- **Base bonus**: +10% damage
- **Gyro Stabilizers reduction**: -0.25% per point (defender)
- **Threat Analysis reduction**: -1% per point above 25 (defender)

The effective backstab bonus can be reduced to zero by a defender with high Gyro Stabilizers and Threat Analysis.

### Preventing Backstabs

- **Gyro Stabilizers** increases turn speed (180° + 6° per point per second), letting your robot face the attacker faster
- **Threat Analysis** at high levels (20+) adds predictive turn bias — your robot anticipates opponents moving toward its rear arc and turns faster to compensate
- Both attributes also directly reduce the backstab damage bonus

## Flanking Mechanics (Multi-Robot)

In battles with multiple attackers (tag team, future team modes), **flanking** occurs when two or more attackers are positioned more than **90°** apart relative to the defender:

- **Base bonus**: +20% damage
- **Gyro Stabilizers reduction**: -0.3% per point (defender)
- **Threat Analysis reduction**: -1% per point above 25 (defender)

## Formation Tactics — Wall Bracing

When your robot is within **3 grid units** of the arena boundary, **Formation Tactics** provides a damage reduction bonus:

- **Bonus**: 0.3% damage reduction per point
- At level 50: 15% damage reduction near the arena edge

This rewards defensive builds that fight with their back to the wall rather than chasing opponents into the center.

## Patience Timer

The **patience timer** (controlled by Combat Algorithms) determines how long your robot waits for the opponent to enter optimal weapon range before forcing an attack at suboptimal range.

- Higher Combat Algorithms = longer patience = smarter range management
- When the timer expires, the robot attacks regardless of range, accepting the range penalty
- This prevents stalemates where two robots with incompatible ranges never engage

## Putting It Together: Range Control Strategy

| Build Type | Goal | Key Attributes |
|-----------|------|---------------|
| **Melee brawler** | Close to 0–2 units, stay there | Servo Motors, Hydraulic Systems, Gyro Stabilizers |
| **Short-range fighter** | Maintain 3–6 units | Servo Motors (moderate), Targeting Systems |
| **Mid-range skirmisher** | Hold at 7–12 units | Servo Motors, Combat Algorithms (patience) |
| **Long-range sniper** | Keep distance at 13+ units | Servo Motors (to kite), Combat Algorithms |

```callout-tip
The battle playback viewer shows robot positions and movement in real-time. Watch your replays to see whether your robot is reaching its optimal range — if not, invest in Servo Motors or reconsider your weapon choice.
```

## What's Next?

- [Battle Flow](/guide/combat/battle-flow) — The complete attack resolution sequence
- [Loadout Types](/guide/weapons/loadout-types) — How weapon configurations affect range strategy
- [Attributes Overview](/guide/robots/attributes-overview) — All 23 attributes and what they do
- [Stances](/guide/combat/stances) — How stances modify movement speed and combat stats
