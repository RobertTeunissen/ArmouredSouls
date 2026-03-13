---
title: "Hull Integrity & Energy Shields"
description: "Understand the two HP pools that keep your robot alive — Hull Integrity for permanent structural health and Energy Shields for regenerating protection."
order: 3
lastUpdated: "2026-03-11"
relatedArticles:
  - robots/attributes-overview
  - robots/attribute-combat-influence
  - combat/battle-flow
  - combat/yielding-and-repair-costs
---

## Overview

Your robot has two separate health pools that work together to keep it in the fight: **Hull Hit Points (HP)** and **Energy Shields**. Understanding how each one works — and how they differ — is essential for building an effective robot and managing your repair budget.

## Hull HP — Your Robot's Structural Health

Hull HP represents your robot's physical structural integrity. When this reaches zero, your robot is destroyed.

**Hull Integrity** is the attribute that determines your maximum Hull HP. The relationship is straightforward: higher Hull Integrity means significantly more HP.

| Hull Integrity Level | Approximate HP | Context |
|---------------------|---------------|---------|
| 1 (starting) | Very low | Fragile — a few solid hits will take you down |
| 10 | Low-moderate | Enough to survive several exchanges |
| 25 | Moderate-high | Solid durability for mid-game competition |
| 50 (maximum) | Very high | Tank-level survivability |

```callout-warning
Hull HP does **not** regenerate during or between battles. Any damage to your hull persists until you pay Credits to repair it. This is the single most important thing to understand about hull health — every point of hull damage costs you money.
```

### Why Hull Integrity Matters

- **Survivability**: More HP means more room to absorb damage before your robot goes down or triggers its [yield threshold](/guide/combat/yielding-and-repair-costs)
- **Repair costs**: Repair expenses scale with how much damage your robot takes relative to its max HP. A robot with higher Hull Integrity can absorb more total damage, but the percentage-based repair cost means you're paying proportionally
- **Build flexibility**: High Hull Integrity lets you run lower yield thresholds (fighting longer) without as much risk of total destruction
- **New robots**: Every robot starts at full HP when first created — no initial repair needed

```callout-tip
Hull Integrity is especially valuable for defensive and tank builds that plan to absorb hits. Glass cannon builds may choose to invest elsewhere and rely on destroying the opponent before taking much hull damage.
```

## Energy Shields — Your Regenerating Buffer

Energy Shields are a separate HP pool that sits in front of your hull. Incoming damage hits your shields first, and only passes through to your hull once shields are depleted.

**Energy Shield Capacity** determines the maximum size of your shield pool. Higher Shield Capacity means a larger buffer protecting your hull.

| Shield Capacity Level | Shield Strength | Context |
|----------------------|----------------|---------|
| 1 (starting) | Minimal | Barely noticeable protection |
| 10 | Light | Absorbs a hit or two before breaking |
| 25 | Moderate | Meaningful buffer that buys time for regeneration |
| 50 (maximum) | Heavy | Substantial shield pool that can absorb significant punishment |

### How Shields Differ from Hull HP

| Property | Hull HP | Energy Shields |
|----------|---------|---------------|
| **Regenerates during battle?** | ❌ No | ✅ Yes (based on Power Core) |
| **Resets after battle?** | ❌ No — damage persists | ✅ Yes — fully restored |
| **Costs Credits to restore?** | ✅ Yes — repair costs | ❌ No — free regeneration |
| **Controlled by** | Hull Integrity attribute | Energy Shield Capacity attribute |
| **Damage hits this first?** | Second (after shields) | First (absorbs before hull) |

```callout-info
Because shields regenerate during battle and reset for free afterward, they're essentially "free" damage absorption. Every point of damage your shields absorb is a point your hull doesn't take — which means lower repair bills.
```

### Shield Regeneration

Your robot's **Power Core** attribute determines how quickly energy shields regenerate during battle. Higher Power Core means faster shield recovery between incoming attacks.

This creates a powerful synergy:
- **High Shield Capacity** = larger shield pool to absorb damage
- **High Power Core** = faster regeneration to refill that pool during combat

A robot with both high Shield Capacity and high Power Core can effectively regenerate significant shield HP during a fight, dramatically reducing the hull damage it takes.

## Damage Flow: Shields → Armor → Hull

When your robot takes a hit, damage flows through multiple layers:

1. **Damage Dampeners** reduce the raw incoming damage by a flat percentage
2. **Energy Shields** absorb damage first — if shields have HP remaining, they take the hit
3. **Armor Plating** reduces any damage that reaches the hull by a percentage
4. **Hull HP** takes whatever damage remains after shields and armor

```callout-tip
This layered defense means that investing across multiple defensive attributes (shields, armor, dampeners) is more effective than dumping everything into one. Each layer reduces what the next layer has to handle.
```

## Strategic Considerations

### Shield-Focused Builds

Pairing high Energy Shield Capacity with the **Weapon + Shield** loadout is a natural fit. The Weapon + Shield loadout provides a +20% bonus to Shield Capacity, amplifying your investment. Combined with a Defensive stance (+20% shield regeneration), this creates a robot that's extremely hard to wear down.

### Hull-Focused Builds

High Hull Integrity is the foundation of tank builds. Pair it with high Armor Plating and Damage Dampeners to create a robot that can absorb enormous amounts of punishment. This approach works well with lower yield thresholds — your robot can fight longer because it has the HP to survive.

### Balanced Approach

Most competitive builds invest in both Hull Integrity and Shield Capacity to some degree. Shields handle the early and mid-fight damage for free, while hull HP provides the safety net for when shields go down.

## What's Next?

- [Attributes Overview](/guide/robots/attributes-overview) — Full list of all 23 attributes
- [Battle Flow](/guide/combat/battle-flow) — See how damage flows through shields and armor step by step
- [Yielding & Repair Costs](/guide/combat/yielding-and-repair-costs) — How hull HP interacts with surrender decisions and repair costs
- [Upgrade Costs](/guide/robots/upgrade-costs) — What it costs to level up Hull Integrity, Shield Capacity, and other attributes
