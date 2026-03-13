---
title: "Robot Attributes Overview"
description: "A complete guide to all 23 robot attributes organized across five categories — Combat Systems, Defensive Systems, Chassis & Mobility, AI Processing, and Team Coordination."
order: 1
lastUpdated: "2026-03-11"
relatedArticles:
  - robots/attribute-combat-influence
  - robots/hull-and-shields
  - robots/upgrade-costs
  - robots/training-academies
---

## Overview

Every robot in Armoured Souls is defined by **23 core attributes** spread across five categories. These attributes determine everything about how your robot performs — from raw damage output to how well it dodges incoming fire to how effectively it coordinates with teammates.

All attributes start at level 1 and can be upgraded to a maximum of level 50 using Credits. However, attributes are capped at level 10 until you invest in [Training Academies](/guide/robots/training-academies) to unlock higher levels.

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

Chassis & Mobility attributes define your robot's physical structure, movement capabilities, and energy systems.

| Attribute | What It Does | Status |
|-----------|-------------|--------|
| **Hull Integrity** | Determines your robot's maximum HP. More hull integrity means more hits you can take before going down. See [Hull & Shields](/guide/robots/hull-and-shields) for details. | ✅ Active |
| **Servo Motors** | Improves movement speed and positioning in battle. | ⚠️ Not yet active |
| **Gyro Stabilizers** | Enhances balance and dodging ability. Reduces the opponent's hit chance, making your robot harder to hit. | ✅ Active |
| **Hydraulic Systems** | Increases physical force for melee impact and carry capacity. | ⚠️ Not yet active |
| **Power Core** | Governs energy generation, which drives energy shield regeneration during battle. | ✅ Active |

```callout-warning
Servo Motors and Hydraulic Systems are defined in the attribute system but do not currently influence combat outcomes. They exist in the database and can be upgraded, but the combat simulator does not use them yet. Avoid investing heavily in these until they are activated in a future update.
```

```callout-tip
Gyro Stabilizers reduces the opponent's hit chance — it's a defensive attribute that stacks with Evasion Thrusters to make your robot harder to hit.
```

## 🟡 AI Processing (4 Attributes) — ⚠️ Not Yet Active

AI Processing attributes are designed to control your robot's autonomous decision-making during combat. These attributes exist in the database and can be upgraded, but the combat simulator does not use them yet. They are planned for a future update.

| Attribute | Planned Effect | Status |
|-----------|---------------|--------|
| **Combat Algorithms** | Will improve battle strategy and decision quality. | ⚠️ Not yet active |
| **Threat Analysis** | Will enhance target priority and positioning. | ⚠️ Not yet active |
| **Adaptive AI** | Will allow your robot to learn opponent patterns during battle. | ⚠️ Not yet active |
| **Logic Cores** | Will improve performance under pressure — potentially gaining bonuses when damaged. | ⚠️ Not yet active |

```callout-warning
None of the AI Processing attributes currently affect combat. Upgrading them has no impact on battle outcomes right now. Save your credits for attributes that are active unless you want to invest ahead of future updates.
```

## 🟣 Team Coordination (3 Attributes) — ⚠️ Not Yet Active

Team Coordination attributes are designed to enhance your robot's effectiveness in multi-robot arena battles (2v2, 3v3, and larger formats). These attributes exist in the database and can be upgraded, but the combat simulator does not use them yet.

| Attribute | Planned Effect | Status |
|-----------|---------------|--------|
| **Sync Protocols** | Will improve coordination with allied robots in team battles. | ⚠️ Not yet active |
| **Support Systems** | Will enable your robot to buff adjacent allies. | ⚠️ Not yet active |
| **Formation Tactics** | Will improve positioning within team formations. | ⚠️ Not yet active |

```callout-warning
None of the Team Coordination attributes currently affect combat — not even in Tag Team battles. The Tag Team system uses the same combat simulator as 1v1, which does not read these attributes. Avoid investing in them until a future update activates them.
```

## Attribute Summary Table

| Category | Attributes | Count | Primary Role | Status |
|----------|-----------|-------|-------------|--------|
| 🔴 Combat Systems | Combat Power, Targeting, Critical Systems, Penetration, Weapon Control, Attack Speed | 6 | Dealing damage | ✅ All active |
| 🔵 Defensive Systems | Armor Plating, Shield Capacity, Evasion, Damage Dampeners, Counter Protocols | 5 | Surviving damage | ✅ All active |
| 🟢 Chassis & Mobility | Hull Integrity, Servo Motors, Gyro Stabilizers, Hydraulic Systems, Power Core | 5 | Structure and movement | ⚠️ 3 of 5 active |
| 🟡 AI Processing | Combat Algorithms, Threat Analysis, Adaptive AI, Logic Cores | 4 | Smart decision-making | ⚠️ None active |
| 🟣 Team Coordination | Sync Protocols, Support Systems, Formation Tactics | 3 | Teamwork bonuses | ⚠️ None active |

Of the 23 total attributes, **14 are currently active** in the combat simulator and directly influence battle outcomes. The remaining 9 (Servo Motors, Hydraulic Systems, all 4 AI Processing, and all 3 Team Coordination) can be upgraded but have no effect on combat yet.

## What's Next?

- [Attribute Combat Influence](/guide/robots/attribute-combat-influence) — See how each attribute category feeds into combat outcomes
- [Hull & Shields](/guide/robots/hull-and-shields) — Understand the two HP pools that keep your robot alive
- [Upgrade Costs](/guide/robots/upgrade-costs) — Learn what it costs to level up attributes and how to save
- [Training Academies](/guide/robots/training-academies) — Unlock attribute levels beyond the initial cap of 10
