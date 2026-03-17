---
title: "Robot Attributes Overview"
description: "A complete guide to all 23 robot attributes organized across five categories — Combat Systems, Defensive Systems, Chassis & Mobility, AI Processing, and Team Coordination."
order: 1
lastUpdated: "2026-03-17"
relatedArticles:
  - robots/attribute-combat-influence
  - robots/hull-and-shields
  - robots/upgrade-costs
  - robots/training-academies
---

## Overview

Every robot in Armoured Souls is defined by **23 core attributes** spread across five categories. These attributes determine everything about how your robot performs — from raw damage output to how well it dodges incoming fire, how it moves and positions in the 2D arena, how it adapts mid-battle, and how effectively it coordinates with teammates.

All attributes start at level 1 and can be upgraded to a maximum of level 50 using Credits. However, attributes are capped at level 10 until you invest in [Training Academies](/guide/robots/training-academies) to unlock higher levels.

All 23 attributes are active in the combat simulator and directly influence battle outcomes.

![Robot attribute categories overview](/images/guide/robots/attribute-categories-overview.png)

## 🔴 Combat Systems (6 Attributes)

Combat Systems govern your robot's offensive capabilities. These attributes are weapon-neutral — they apply equally whether you're using energy weapons, ballistic guns, or melee arms.

| Attribute | What It Does |
|-----------|-------------|
| **Combat Power** | Increases base damage for all attacks. The primary damage-scaling attribute. |
| **Targeting Systems** | Improves hit chance and precision. Higher values mean fewer missed attacks. |
| **Critical Systems** | Increases the chance of landing a critical hit for bonus damage. |
| **Penetration** | Bypasses a portion of the opponent's armor and shields. |
| **Weapon Control** | Reduces weapon malfunction chance and provides a secondary damage boost. A reliable weapon is a deadly weapon. |
| **Attack Speed** | Reduces the cooldown between attacks, allowing your robot to strike more frequently. |

```callout-tip
Combat Power and Weapon Control both increase damage, but in different ways. Combat Power is a straightforward damage multiplier, while Weapon Control improves reliability (fewer misfires) and adds a smaller damage bonus on top. Investing in both gives you consistent, high damage output.
```

## 🔵 Defensive Systems (5 Attributes)

Defensive Systems determine how well your robot absorbs, avoids, and responds to incoming damage.

| Attribute | What It Does |
|-----------|-------------|
| **Armor Plating** | Reduces physical damage from all sources. Each point provides percentage-based damage reduction. |
| **Energy Shield Capacity** | Determines the size of your energy shield pool — a separate HP buffer that absorbs damage before your hull takes hits. |
| **Evasion Thrusters** | Gives your robot a chance to dodge incoming attacks entirely. |
| **Damage Dampeners** | Provides flat damage reduction on every hit and reduces the extra damage from critical strikes. |
| **Counter Protocols** | Gives your robot a chance to strike back immediately when attacked (hit or miss). |

```callout-info
Energy shields regenerate during battle (based on your Power Core attribute) and reset to full after each fight. Hull HP does **not** regenerate — damage to your hull persists until you pay for repairs. This makes shields your first line of defense.
```

## 🟢 Chassis & Mobility (5 Attributes)

Chassis & Mobility attributes define your robot's physical structure, movement capabilities, and energy systems. All five attributes are active in combat.

| Attribute | What It Does |
|-----------|-------------|
| **Hull Integrity** | Determines your robot's maximum HP. More hull integrity means more hits you can take before going down. See [Hull & Shields](/guide/robots/hull-and-shields) for details. |
| **Servo Motors** | Determines movement speed in the 2D arena. Higher values let your robot close distance faster or reposition to maintain optimal weapon range. Base speed: 7.0 + servoMotors × 0.2 units/second. |
| **Gyro Stabilizers** | Enhances balance, turn speed, and dodging ability. Reduces the opponent's hit chance and reduces backstab/flanking damage bonuses against you. |
| **Hydraulic Systems** | Increases melee and close-range damage. At melee range (0–2 units): up to +150% bonus damage at level 50. At short range (3–6 units): up to +75% bonus. No effect at mid/long range. |
| **Power Core** | Governs energy generation, which drives energy shield regeneration during battle. |

```callout-tip
Servo Motors and Hydraulic Systems are essential for melee builds. Servo Motors lets you close the gap to reach melee range, while Hydraulic Systems massively amplifies your damage once you get there. A robot with high values in both can be devastating up close.
```

```callout-tip
Gyro Stabilizers has a triple role: it reduces the opponent's hit chance, increases your turn speed (making backstabs harder to land on you), and directly reduces backstab and flanking damage bonuses. It's one of the most versatile defensive investments.
```

## 🟡 AI Processing (4 Attributes)

AI Processing attributes control your robot's autonomous decision-making during combat. These determine how smartly your robot fights — from target selection to mid-battle adaptation.

| Attribute | What It Does |
|-----------|-------------|
| **Combat Algorithms** | Improves battle strategy and decision quality. Grants a hit chance bonus when the algorithm score exceeds 0.5, and controls the patience timer that determines how long your robot waits for optimal range before forcing an attack. |
| **Threat Analysis** | Enhances facing/turning speed with a predictive turn bias. At high levels (25+), your robot anticipates opponents moving behind it and turns faster to prevent backstabs. Also reduces backstab and flanking damage taken. |
| **Adaptive AI** | Allows your robot to learn during battle. Each time your robot misses or takes damage, it accumulates hit and damage bonuses. Higher Adaptive AI means faster adaptation. Bonuses are halved when HP is above 70% to prevent snowballing. |
| **Logic Cores** | Improves performance under pressure. Sets the HP threshold below which your robot enters "pressure mode," gaining accuracy and damage bonuses. Higher Logic Cores raises this threshold, activating the bonus earlier. |

```callout-tip
Adaptive AI is especially powerful in longer fights. Against tanky opponents, your robot gradually becomes more accurate and hits harder as the battle progresses. Pair it with defensive attributes to survive long enough for the adaptation to kick in.
```

```callout-info
Combat Algorithms controls the patience timer — how long your robot will wait for the opponent to enter optimal weapon range before forcing an attack anyway. Higher values mean your robot is smarter about when to engage, but won't wait forever.
```

## 🟣 Team Coordination (3 Attributes)

Team Coordination attributes enhance your robot's effectiveness in combat. Even in 1v1 battles, these provide solo combat benefits through self-synergy mechanics.

| Attribute | What It Does |
|-----------|-------------|
| **Sync Protocols** | In dual-wield builds, grants a damage bonus when both main and offhand weapons are ready within a 1-second window. Bonus: 0.2% per point. In team modes, improves coordination with allied robots. |
| **Support Systems** | Provides a passive shield regeneration boost during combat. Bonus: 0.1% increased shield regen per point per tick. In team modes, enables buffing adjacent allies. |
| **Formation Tactics** | Grants a damage reduction bonus when your robot is within 3 grid units of the arena boundary (wall-bracing). Bonus: 0.3% per point. In team modes, improves positioning within formations. |

```callout-tip
Formation Tactics rewards positional awareness. If your robot tends to fight near the arena edge, the wall-bracing bonus from Formation Tactics provides meaningful damage reduction. This pairs well with defensive builds that don't need to chase opponents.
```

## Attribute Summary Table

| Category | Attributes | Count | Primary Role | Status |
|----------|-----------|-------|-------------|--------|
| 🔴 Combat Systems | Combat Power, Targeting, Critical Systems, Penetration, Weapon Control, Attack Speed | 6 | Dealing damage | ✅ All active |
| 🔵 Defensive Systems | Armor Plating, Shield Capacity, Evasion, Damage Dampeners, Counter Protocols | 5 | Surviving damage | ✅ All active |
| 🟢 Chassis & Mobility | Hull Integrity, Servo Motors, Gyro Stabilizers, Hydraulic Systems, Power Core | 5 | Structure, movement, and positioning | ✅ All active |
| 🟡 AI Processing | Combat Algorithms, Threat Analysis, Adaptive AI, Logic Cores | 4 | Smart decision-making and adaptation | ✅ All active |
| 🟣 Team Coordination | Sync Protocols, Support Systems, Formation Tactics | 3 | Self-synergy and teamwork bonuses | ✅ All active |

All 23 attributes are active in the combat simulator and directly influence battle outcomes.

## What's Next?

- [Attribute Combat Influence](/guide/robots/attribute-combat-influence) — See how each attribute category feeds into combat outcomes
- [Hull & Shields](/guide/robots/hull-and-shields) — Understand the two HP pools that keep your robot alive
- [Upgrade Costs](/guide/robots/upgrade-costs) — Learn what it costs to level up attributes and how to save
- [Training Academies](/guide/robots/training-academies) — Unlock attribute levels beyond the initial cap of 10
