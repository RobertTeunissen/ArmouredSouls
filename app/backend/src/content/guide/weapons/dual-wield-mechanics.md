---
title: "Dual-Wield Mechanics"
description: "How per-hand weapon bonuses work, offhand attack penalties, and the tactical considerations of running two weapons in Armoured Souls."
order: 3
lastUpdated: "2026-03-11"
relatedArticles:
  - weapons/loadout-types
  - combat/battle-flow
  - combat/malfunctions
  - robots/attributes-overview
---

## Overview

Dual-Wield is the most mechanically complex loadout in Armoured Souls. Running two weapons gives your robot two independent attack cycles — effectively doubling your attack opportunities. But this power comes with significant trade-offs that you need to understand to make it work.

The key concept is **per-hand independence**. Each weapon operates on its own attack timer, applies its own attribute bonuses, and has its own hit chance. Your main hand and offhand are essentially two separate attackers sharing the same robot body.

![Dual-wield mechanics](/images/guide/weapons/dual-wield-mechanics.png)

## Per-Hand Weapon Bonuses

This is the most important rule of Dual-Wield: **weapon attribute bonuses only apply to the hand that weapon is equipped in.**

When your main hand attacks, only the main hand weapon's bonuses are used to calculate damage, hit chance, malfunction rate, and cooldown. When your offhand attacks, only the offhand weapon's bonuses apply. There is no mixing, stacking, or sharing of bonuses between hands.

| Attack | Bonuses Used | Example |
|--------|-------------|---------|
| Main hand attack | Main hand weapon bonuses only | Main hand Machine Gun: +3 Combat Power, +5 Attack Speed |
| Offhand attack | Offhand hand weapon bonuses only | Offhand Machine Gun: +3 Combat Power, +5 Attack Speed |

This means the effective attribute for any calculation during an attack is:

> **Effective Attribute = Robot Base Attribute + Weapon Bonus (for the attacking hand only)**

```callout-info
This per-hand rule applies to every attribute bonus on the weapon — Combat Power, Targeting Systems, Attack Speed, Weapon Control, and all others. If your main hand weapon has +5 Targeting Systems and your offhand weapon has +2, your main hand attacks use base + 5 while your offhand attacks use base + 2.
```

### Why Per-Hand Matters

Per-hand bonuses create meaningful weapon pairing decisions. You're not just picking "two good weapons" — you're building two complementary attack profiles:

- **Symmetric pairing** — Two copies of the same weapon. Both hands perform identically. Simple and effective.
- **Asymmetric pairing** — Different weapons in each hand. Your main hand might prioritize raw damage while your offhand focuses on accuracy or speed. This lets you cover different combat roles with a single robot.

```callout-tip
An asymmetric Dual-Wield setup can be surprisingly effective. Consider pairing a high-damage weapon in your main hand (where hit chance is better) with a fast, reliable weapon in your offhand (where the cooldown penalty makes speed bonuses more valuable).
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

**Example with a 4-second weapon and 10 base Attack Speed + 3 weapon bonus:**

| Hand | Base Cooldown | After Penalty | After Attack Speed | Final |
|------|--------------|---------------|-------------------|-------|
| Main | 4.0s | 4.0s (no penalty) | 4.0 / 1.26 | **3.17s** |
| Offhand | 4.0s | 5.6s (× 1.4) | 5.6 / 1.26 | **4.44s** |

The offhand attacks roughly 40% slower than the main hand with the same weapon. This is a significant difference that compounds over the course of a battle.

```callout-tip
The Dual-Wield loadout bonus of +30% Attack Speed partially compensates for the offhand cooldown penalty. This is by design — the loadout bonus helps close the gap, but the offhand will always be slower than the main hand. Investing in Attack Speed attributes amplifies this compensation further.
```

### Malfunction Check

Each hand's malfunction chance is calculated independently using only that hand's weapon bonuses:

> **Malfunction Chance = Max(0, 20% - (Robot Weapon Control + Weapon Bonus for attacking hand) × 0.4%)**

The Dual-Wield loadout's +15% Weapon Control bonus helps here — it reduces malfunction rates for both hands. But since you're rolling malfunction checks twice as often (two weapons), even a small malfunction rate adds up. Investing in Weapon Control is especially important for Dual-Wield builds.

### Damage Calculation

Dual-Wield applies a **0.90× loadout damage multiplier** to all attacks (both hands). Combined with the -10% Combat Power penalty from the loadout bonuses, each individual hit deals noticeably less damage than the same weapon in a Single or Weapon+Shield loadout.

This is the core trade-off: you hit more often but each hit is weaker. Over a full battle, the total damage output can exceed other loadouts — but only if your offhand attacks are actually landing.

## The Dual-Wield Trade-Off

Here's the honest math of Dual-Wield:

| Advantage | Disadvantage |
|-----------|-------------|
| Two independent attack cycles | Offhand has 50% base hit chance (vs 70%) |
| +30% Attack Speed bonus | Offhand has 40% cooldown penalty |
| +15% Weapon Control (fewer malfunctions) | -20% Penetration (weaker vs armor) |
| Two sets of weapon attribute bonuses | -10% Combat Power (less damage per hit) |
| Flexible weapon pairing options | 0.90× damage multiplier on all attacks |

The loadout rewards robots with high base attributes — particularly **Attack Speed**, **Targeting Systems**, and **Weapon Control** — because these attributes help overcome the offhand penalties. A Dual-Wield robot with low attributes will struggle with missed offhand attacks and frequent malfunctions. A well-invested one becomes a relentless damage machine.

```callout-tip
Dual-Wield is a late-game loadout that gets stronger as your attributes grow. Early on, the offhand penalties can feel punishing. But once your Targeting Systems and Attack Speed are high enough to compensate, the sustained DPS advantage becomes significant. Consider starting with Single or Weapon+Shield and transitioning to Dual-Wield as your robot matures.
```

## Battle Log Indicators

When reviewing battle logs, Dual-Wield attacks are clearly labeled so you can track each hand's performance:

- Offhand attacks are marked with **[OFFHAND]** in the combat log
- At battle start, the log shows the offhand cooldown with a note: "(40% penalty applied)"
- Each weapon's bonuses are displayed separately for main and offhand

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
