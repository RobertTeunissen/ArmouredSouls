---
title: "Dual-Wield Mechanics"
description: "How both weapons' bonuses combine into one set of effective attributes, what stays per-hand, offhand attack penalties, and the tactical considerations of running two weapons in Armoured Souls."
order: 3
lastUpdated: "2026-10-15"
relatedArticles:
  - weapons/loadout-types
  - combat/battle-flow
  - combat/malfunctions
  - robots/attributes-overview
---

## Overview

Dual-Wield is the most mechanically complex loadout in Armoured Souls. Running two weapons gives your robot two independent attack cycles — effectively doubling your attack opportunities. But this power comes with significant trade-offs that you need to understand to make it work.

The key concept is **one robot, two attack cycles**. Your robot has a single set of effective attributes that both hands use, but each weapon keeps its own damage, its own cooldown and its own attack timer. Your main hand and offhand are two attackers sharing the same robot body — and the same attributes.

![Dual-wield mechanics](/images/guide/weapons/dual-wield-mechanics.png)

## Shared Attributes, Per-Hand Weapons

Both weapons' attribute bonuses are **added together** with your robot's base attributes and tuning, and then the Dual-Wield loadout modifier is applied once. The result is one set of effective attributes that **both hands** use for hit chance, critical chance, malfunction rate, damage scaling and cooldown speed.

> **Effective Attribute = (Base Attribute + Main Weapon Bonus + Offhand Weapon Bonus + Tuning) × (1 + Dual-Wield Modifier)**

For example, with 10 base Attack Speed and two Machine Guns that each add +3 Attack Speed:

> (10 + 3 + 3) × 1.30 = **20.8 Attack Speed** — used by both the main hand and the offhand.

What stays **per-hand**:

| Per-hand | What it means |
|----------|---------------|
| **Weapon damage** | Each hand hits with its own weapon's base damage |
| **Weapon cooldown** | Each hand uses its own weapon's cooldown |
| **Attack timer** | Each hand attacks on its own independent timer |
| **Offhand penalties** | Only the offhand has the lower 50% base hit chance and the 40% cooldown penalty |

```callout-info
Because attribute bonuses are shared, a weapon's +5 Targeting Systems helps your offhand attacks just as much as your main hand attacks. What you choose per hand is the damage and cooldown each hand brings to the fight.
```

### Choosing Your Two Weapons

Weapon pairing is still a meaningful decision, but it works differently from picking two separate attack profiles:

- **Symmetric pairing** — Two copies of the same weapon. Both hands deal the same damage on the same cooldown, and you get that weapon's attribute bonuses twice.
- **Asymmetric pairing** — Different weapons in each hand. Each hand keeps its own damage and cooldown, while the two weapons' attribute bonuses add up into your robot's shared attributes.

```callout-tip
A popular asymmetric setup puts the hard-hitting weapon in the main hand (where hit chance is better) and a fast weapon in the offhand, where its short cooldown softens the offhand's 40% cooldown penalty. Pick the second weapon's attribute bonuses for what your whole robot needs — they help both hands.
```

## Offhand Attack Rules

The offhand is deliberately weaker than the main hand. Without these penalties, Dual-Wield would be strictly superior to every other loadout. The offhand penalties are what keep the loadout balanced.

### Hit Chance Penalty

| Hand | Base Hit Chance |
|------|----------------|
| Main hand | 70% |
| **Offhand** | **50%** |

Your offhand starts with a 20-percentage-point lower base hit chance compared to the main hand. This means offhand attacks miss significantly more often, especially at lower Targeting Systems levels.

The rest of the hit chance formula works the same — Targeting Systems, stance bonuses, and the defender's Evasion Thrusters all apply normally. But that lower starting point means your offhand needs more Targeting investment to reach the same accuracy as your main hand.

```callout-info
Hit chance is always clamped between 10% and 95%, regardless of hand. Even a poorly-aimed offhand attack has a minimum chance to connect, and even a perfectly-aimed one can still miss. The 50% base just means your offhand operates in a tighter effective range.
```

### Cooldown Penalty

The offhand also attacks slower than the main hand due to a **40% cooldown penalty**.

| Hand | Cooldown Calculation |
|------|---------------------|
| Main hand | Weapon Cooldown / (1 + Attack Speed / 50) |
| **Offhand** | **(Weapon Cooldown × 1.4)** / (1 + Attack Speed / 50) |

The 40% penalty is applied to the weapon's base cooldown **before** Attack Speed reductions kick in. This means Attack Speed is even more valuable for the offhand — it's reducing a larger base number.

**Example with two 4-second weapons that each add +3 Attack Speed, on a robot with 10 base Attack Speed:**

Effective Attack Speed = (10 + 3 + 3) × 1.30 = 20.8, so the speed divisor is 1 + 20.8 / 50 = 1.416.

| Hand | Base Cooldown | After Penalty | After Attack Speed | Final |
|------|--------------|---------------|-------------------|-------|
| Main | 4.0s | 4.0s (no penalty) | 4.0 / 1.416 | **2.82s** |
| Offhand | 4.0s | 5.6s (× 1.4) | 5.6 / 1.416 | **3.95s** |

The offhand attacks roughly 40% slower than the main hand with the same weapon. This is a significant difference that compounds over the course of a battle.

```callout-tip
The Dual-Wield loadout bonus of +30% Attack Speed partially compensates for the offhand cooldown penalty. It speeds up both hands, but the offhand will always be slower than the main hand. Investing in Attack Speed amplifies this compensation further.
```

### Malfunction Check

Each hand rolls its own malfunction check whenever it attacks, using your robot's shared effective Weapon Control:

> **Malfunction Chance = Max(0, 20% − Effective Weapon Control × 0.4%)**

Effective Weapon Control already includes both weapons' bonuses and the Dual-Wield loadout's +15% Weapon Control bonus, so it lowers the malfunction rate for both hands. But since you're rolling malfunction checks twice as often (two weapons), even a small malfunction rate adds up. Investing in Weapon Control is especially important for Dual-Wield builds.

### Damage Calculation

Dual-Wield applies a **0.90× loadout damage multiplier** to all attacks (both hands). Combined with the -10% Combat Power penalty from the loadout bonuses, each individual hit deals noticeably less damage than the same weapon in a Single or Weapon+Shield loadout.

This is the core trade-off: you hit more often but each hit is weaker. Over a full battle, the total damage output can exceed other loadouts — but only if your offhand attacks are actually landing.

### Reach per Hand

Each hand checks its own reach. A melee weapon (including energy melee weapons like the Shock Maul) only fires when its target is within 2 units; a ranged weapon fires at any distance with the normal range penalty. A hand that can't reach doesn't fire and stays ready, so it attacks as soon as a target is in reach.

**Example:** a Laser Pistol main hand and an Energy Blade offhand, 10 units from the opponent. Only the Laser Pistol fires, at 0.75× damage because 10 units is one band outside its short optimal range. The Energy Blade waits until the gap closes to 2 units.

In battles with more than two robots, each hand that can't reach its current target switches to the nearest opponent within that hand's own reach, if there is one. Your Laser Pistol can keep firing at a distant target while the Energy Blade hits an opponent standing next to you.

## The Dual-Wield Trade-Off

Here's the honest math of Dual-Wield:

| Advantage | Disadvantage |
|-----------|-------------|
| Two independent attack cycles | Offhand has 50% base hit chance (vs 70%) |
| +30% Attack Speed bonus | Offhand has 40% cooldown penalty |
| +15% Weapon Control (fewer malfunctions) | -20% Penetration (weaker vs armor) |
| Both weapons' attribute bonuses add up | -10% Combat Power (less damage per hit) |
| Flexible weapon pairing options | 0.90× damage multiplier on all attacks |

The loadout rewards robots with high base attributes — particularly **Attack Speed**, **Targeting Systems**, and **Weapon Control** — because these attributes help overcome the offhand penalties. A Dual-Wield robot with low attributes will struggle with missed offhand attacks and frequent malfunctions. A well-invested one becomes a relentless damage machine.

```callout-tip
Dual-Wield is a late-game loadout that gets stronger as your attributes grow. Early on, the offhand penalties can feel punishing. But once your Targeting Systems and Attack Speed are high enough to compensate, the sustained DPS advantage becomes significant. Consider starting with Single or Weapon+Shield and transitioning to Dual-Wield as your robot matures.
```

## Battle Log Indicators

When reviewing battle logs, Dual-Wield attacks are clearly labeled so you can track each hand's performance:

- Offhand attacks are marked with **[OFFHAND]** in the combat log
- At battle start, the log lists each hand's weapon with its base damage and base cooldown (before the offhand penalty and Attack Speed)
- Both hands draw on your robot's shared effective attributes, so differences between the hands come from the weapons themselves and the offhand penalties

Use the battle log to diagnose your Dual-Wield performance. If your offhand is missing too often, you need more Targeting Systems. If it's attacking too slowly, invest in Attack Speed. If weapons are malfunctioning, boost Weapon Control.

## Building for Dual-Wield

To make Dual-Wield work, prioritize these attributes:

| Priority | Attribute | Why |
|----------|-----------|-----|
| High | **Attack Speed** | Reduces cooldown for both hands, partially compensates for offhand penalty |
| High | **Targeting Systems** | Offhand's 50% base hit chance needs all the accuracy help it can get |
| High | **Weapon Control** | Two weapons = twice the malfunction opportunities. Keep both reliable. |
| Medium | **Combat Power** | Still your primary damage scaler, even with the -10% penalty |
| Lower | **Penetration** | The -20% penalty makes Penetration less efficient. Consider other damage paths. |

## What's Next?

- [Loadout Types](/guide/weapons/loadout-types) — Compare Dual-Wield against the other three loadout configurations
- [Battle Flow](/guide/combat/battle-flow) — Understand how each attack resolves step by step
- [Malfunctions](/guide/combat/malfunctions) — Why Weapon Control matters even more with two weapons
