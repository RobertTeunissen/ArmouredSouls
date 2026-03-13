---
title: "Counter-Attacks & Shield Regeneration"
description: "How Counter Protocols give your robot free retaliatory strikes and how Energy Shields regenerate during battle based on Power Core."
order: 5
lastUpdated: "2026-03-12"
relatedArticles:
  - combat/battle-flow
  - combat/stances
  - robots/attributes-overview
  - robots/hull-and-shields
  - weapons/loadout-types
---

## Overview

Two defensive mechanics in Armoured Souls happen *between* normal attacks: **counter-attacks** and **energy shield regeneration**. Both reward defensive investment and can turn the tide of a battle over time.

Counter-attacks give your robot a chance to strike back whenever you're attacked. Shield regeneration restores your energy shield pool during combat, extending your robot's effective durability. Together, they form the backbone of attrition-based strategies.

## Counter-Attacks

### How They Work

After an opponent attacks your robot — whether the attack hits or misses — there's a chance your robot will immediately counter-attack. This happens automatically — it's a bonus attack that doesn't consume your robot's normal attack cycle.

Counter-attacks are checked after the [attack sequence](/guide/combat/battle-flow) resolves, regardless of whether the original attack dealt damage or not. The only exception is weapon malfunctions — a malfunctioning weapon never fired a real attack, so there's nothing to counter.

Key rules:

- Counter-attacks trigger whenever your robot is **attacked** — whether the attack hits or misses
- Weapon **malfunctions** do **not** trigger counter-attacks (the weapon failed, there was no real attack to react to)
- Counter-attacks have their own **hit check** — they can miss, just like a normal attack
- Counter-attacks deal **reduced damage** compared to a normal attack (roughly 70% of base damage)
- Counter-attacks use your robot's **main hand weapon** for damage calculation
- Counter-attacks themselves **cannot be countered** (no infinite counter chains)

```callout-info
Counter-attacks are essentially free bonus attacks. They don't replace your robot's normal attacks — they happen in addition to them. A robot with high Counter Protocols effectively gets extra attacks every time it's targeted, even if the incoming attack misses. However, counters have their own hit check and can miss too.
```

### What Affects Counter Chance

Three factors determine your counter-attack probability:

| Factor | Effect |
|--------|--------|
| **Counter Protocols** (attribute) | The primary driver. Higher Counter Protocols means higher counter chance. |
| **Defensive Stance** | Multiplies your counter chance by 1.15× (+15% boost). |
| **Weapon+Shield Loadout** | Multiplies your counter chance by 1.10× (+10% boost). |

These multipliers stack. A robot with high Counter Protocols, Defensive stance, and a Weapon+Shield loadout has the highest possible counter-attack rate.

The counter chance is capped at **40%** regardless of how high your attributes and bonuses go. This prevents counter-attacks from becoming too dominant.

Once a counter triggers, it goes through its own **hit check** using the standard hit chance formula — your robot's Targeting Systems vs the opponent's Evasion Thrusters and Gyro Stabilizers. A triggered counter that misses deals no damage.

```callout-tip
Defensive stance and Weapon+Shield loadout both boost counter chance. If you're building a counter-attack focused robot, use both. The combined bonus is significant — and the defensive benefits of both (more armor, more shield regen) keep your robot alive longer to trigger more counters. Don't neglect Targeting Systems either — it affects whether your counters actually land.
```

### Counter-Attack Damage

When a counter-attack hits, it deals approximately 70% of what a normal attack would deal. The damage is calculated using your robot's main hand weapon and relevant attributes, then reduced by the counter-attack modifier.

This means:

- Robots with strong main hand weapons get stronger counter-attacks
- Combat Power, Weapon Control, and other damage attributes still apply
- The defender's armor and shields still reduce counter-attack damage normally

### Building Around Counter-Attacks

A counter-attack focused build (sometimes called a "Counter Striker") typically invests in:

- **Counter Protocols** — As high as possible, up to the 40% cap
- **Defensive stance** — For the +15% counter chance bonus
- **Weapon+Shield loadout** — For the +10% counter chance bonus and defensive stats
- **Armor Plating / Shield Capacity** — To survive long enough to trigger many counters
- **A strong main hand weapon** — Since counter-attacks use the main hand for damage

The trade-off is lower direct damage output. You're relying on your opponent's attacks to generate your bonus damage, which means you need to survive a lot of hits. This strategy excels against aggressive opponents who attack frequently and struggles against opponents who deal massive damage per hit.

```callout-warning
Counter-attacks are reactive — they only trigger when your robot is attacked. Against an opponent with low Attack Speed who attacks infrequently, your counter-attack build generates fewer bonus attacks. Counters are strongest against fast-attacking opponents who target you often. Also remember that counters can miss — Targeting Systems matters for landing them.
```

## Energy Shield Regeneration

### How It Works

Energy shields are a separate HP pool that absorbs damage before your hull takes hits. Unlike hull HP, **energy shields regenerate during battle**. This regeneration happens continuously, restoring shield points over time.

The regeneration rate is determined by your robot's **Power Core** attribute. Higher Power Core means faster shield recovery.

Key rules:

- Shields regenerate continuously during battle, not just between attacks
- Regeneration cannot exceed your maximum shield capacity
- Hull HP does **not** regenerate during battle — only shields do
- Shields reset to maximum after each battle ends (regardless of how depleted they were)

```callout-info
Shield regeneration is what makes energy shields so valuable. Even if your shield gets broken mid-fight, it starts recovering immediately. Given enough time between heavy hits, your shield can partially or fully restore itself, absorbing more damage later in the battle.
```

### What Affects Regeneration Rate

| Factor | Effect |
|--------|--------|
| **Power Core** (attribute) | The primary driver. Each point of Power Core increases shield regeneration per second. |
| **Defensive Stance** | Boosts shield regeneration by 1.20× (+20%). |

The combination of high Power Core and Defensive stance creates substantial shield recovery. Over the course of a long battle, a robot can regenerate a significant portion of its total shield capacity multiple times.

### Shield Regeneration in Practice

Consider two scenarios:

**Low Power Core (5), Balanced Stance:**
Your shields regenerate slowly. Once broken, they take a long time to recover any meaningful amount. In a fast-paced fight, your shields might only regenerate a small fraction before the next hit lands.

**High Power Core (30), Defensive Stance:**
Your shields regenerate rapidly. Even after being broken, they can recover a meaningful buffer within a few seconds. Combined with the +20% Defensive stance bonus, your effective shield pool over the course of a battle is much larger than the raw Shield Capacity number suggests.

```callout-tip
Power Core is often overlooked because it doesn't directly affect damage or accuracy. But for defensive builds, it's one of the most impactful attributes. A robot that regenerates 3–4 shield points per second effectively has hundreds of extra shield HP over a full battle.
```

### Shield Regeneration and Battle Length

Shield regeneration becomes more valuable the longer a battle lasts:

- **Short battles** (aggressive builds, Offensive stance) — Shields might only regenerate once or twice before the fight ends. The raw Shield Capacity matters more than the regen rate.
- **Long battles** (defensive builds, Defensive stance, high yield threshold) — Shields can regenerate many times over. Power Core investment pays massive dividends because the total shield HP absorbed over the fight far exceeds the initial shield pool.

This is why Defensive stance and shield regeneration synergize so well. Defensive stance both extends the battle (by reducing damage taken) and boosts regeneration (+20%), creating a compounding effect.

## Combining Counter-Attacks and Shield Regeneration

The most effective defensive strategies leverage both mechanics together:

1. **High Counter Protocols + Defensive Stance** — You counter-attack frequently, dealing bonus damage while your opponent wears themselves out hitting you.
2. **High Power Core + Defensive Stance** — Your shields keep regenerating, absorbing damage that would otherwise hit your hull and increase repair costs.
3. **Weapon+Shield Loadout** — Boosts counter chance and provides additional defensive stats.
4. **High Yield Threshold (20–30%)** — You surrender before taking catastrophic damage, keeping repair costs low.

The result is a robot that wins through attrition: it doesn't deal the most damage per hit, but it deals consistent counter-attack damage, absorbs hits through regenerating shields, and walks away from losses with manageable repair bills.

```callout-tip
The "Counter Striker" archetype in the [Strategy Guides](/guide/strategy/build-archetypes) section is built around this exact combination. It's one of the most economically efficient builds in the game — it doesn't win every fight, but it rarely loses badly.
```

## What's Next?

- [Battle Flow](/guide/combat/battle-flow) — See where counter-attacks and shield regen fit in the full sequence
- [Stances](/guide/combat/stances) — How Defensive stance amplifies both mechanics
- [Hull & Shields](/guide/robots/hull-and-shields) — Understanding the two HP pools
- [Build Archetypes](/guide/strategy/build-archetypes) — Pre-built strategies including the Counter Striker
