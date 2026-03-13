---
title: "Weapon Malfunctions"
description: "How the Weapon Control attribute prevents misfires, with examples at different investment levels and strategies for managing reliability."
order: 2
lastUpdated: "2026-03-11"
relatedArticles:
  - combat/battle-flow
  - robots/attributes-overview
  - weapons/loadout-types
  - strategy/build-archetypes
---

## Overview

Every weapon in Armoured Souls has a chance to malfunction when it fires. A malfunction means the attack fails completely — no damage dealt, no critical hit possible, and no counter-attack triggered on the defender. It's as if the attack never happened, except your robot still spent the time trying.

The **Weapon Control** attribute is your primary defense against malfunctions. Higher Weapon Control means fewer wasted attacks and more consistent damage output over the course of a battle.

## How Malfunctions Work

At the start of every attack, before hit chance or damage is calculated, the game checks whether the weapon fires reliably. This is the very first step in the [attack order of operations](/guide/combat/battle-flow).

When a weapon malfunctions:

- ❌ The attack fails immediately
- ❌ No damage is dealt (zero HP, zero shield damage)
- ❌ No critical hit is possible
- ❌ No counter-attack is triggered on the defender
- ⚠️ The event appears in your battle log as a malfunction

```callout-warning
Malfunctions are the most punishing outcome in combat. A missed attack still forces the defender to dodge (and might trigger positioning advantages). A malfunction does absolutely nothing — your robot just wastes its turn.
```

## The Role of Weapon Control

Weapon Control reduces malfunction chance from a base rate down toward zero. The relationship is straightforward: every point of Weapon Control you invest in makes your weapons more reliable.

- **Low Weapon Control (1–10):** Weapons are noticeably unreliable. Expect roughly 1 in 5 to 1 in 6 attacks to misfire. Over a full battle, that's a significant amount of lost damage.
- **Mid Weapon Control (20–30):** Reliability improves substantially. Misfires drop to roughly 1 in 8 to 1 in 12 attacks. Your damage output becomes much more consistent.
- **High Weapon Control (40–50):** Weapons become extremely reliable. At the maximum level of 50, malfunctions are eliminated entirely — every attack attempt will at least get to the hit chance check.

```callout-info
Weapon bonuses from your equipped weapon can also affect your effective Weapon Control. A high-quality weapon with a positive Weapon Control bonus makes your robot even more reliable, while a crude weapon with a negative bonus increases malfunction risk.
```

## Examples at Different Levels

Here's how malfunction chance scales with Weapon Control investment:

| Weapon Control Level | Approximate Malfunction Chance | What It Feels Like |
|---------------------|-------------------------------|-------------------|
| 1 | ~19.6% | Nearly 1 in 5 attacks fail. Very unreliable. |
| 5 | ~18.0% | Still rough. You'll notice misfires regularly. |
| 10 | ~16.0% | Slightly better, but still losing attacks frequently. |
| 20 | ~12.0% | Noticeably more consistent. About 1 in 8 attacks fail. |
| 25 | ~10.0% | Solid reliability. Misfires happen but aren't crippling. |
| 30 | ~8.0% | Good reliability. Roughly 1 in 12 attacks misfire. |
| 40 | ~4.0% | Excellent. Misfires are rare events. |
| 45 | ~2.0% | Near-perfect. Almost every attack fires. |
| 50 | 0% | Perfect reliability. No malfunctions ever. |

```callout-tip
The jump from level 1 to level 25 cuts your malfunction rate nearly in half. That's a massive improvement in effective damage output for a moderate attribute investment.
```

## Malfunctions and Dual-Wield

In a [Dual-Wield](/guide/weapons/loadout-types) configuration, each hand's weapon is checked independently for malfunctions. Your main hand uses the main weapon's Weapon Control bonus, and your offhand uses the offhand weapon's bonus.

This means:

- A malfunction on your main hand doesn't affect your offhand (and vice versa)
- If one weapon has a negative Weapon Control bonus, only that hand suffers increased malfunction risk
- Investing in base Weapon Control benefits both hands equally

For Dual-Wield builds, reliability matters even more because you're making twice as many attack attempts per cycle. Each malfunction is a wasted opportunity from one of your two damage sources.

## Strategic Considerations

### When to Prioritize Weapon Control

- **Dual-Wield builds** — More attacks means more chances for malfunctions. Reliability is critical.
- **Offensive stance builds** — You're already sacrificing defense for damage. Wasting attacks to malfunctions undermines the entire strategy.
- **Builds with expensive weapons** — If your weapon has high base damage, each malfunction wastes more potential damage.

### When Weapon Control Can Wait

- **Defensive/counter-attack builds** — Your damage comes partly from counter-attacks, which bypass the malfunction check entirely (counters always fire reliably).
- **Early game with limited budget** — If you can only afford a few attribute upgrades, Combat Power or Targeting Systems might give you more immediate impact. But don't neglect Weapon Control for long.

### The Dual Benefit

Weapon Control doesn't just prevent malfunctions — it also provides a secondary damage multiplier. Every point of Weapon Control slightly increases your damage output on successful attacks. This makes it a two-for-one investment: fewer wasted attacks *and* harder-hitting attacks when they land.

```callout-tip
Think of Weapon Control as your robot's "consistency stat." Combat Power determines your ceiling (maximum damage per hit), while Weapon Control determines your floor (how often you actually deal that damage). The best builds invest in both.
```

## Reading Your Battle Log

When reviewing battle results, look for malfunction events. They appear as warning messages showing which weapon failed:

- Frequent malfunctions on your main weapon → prioritize Weapon Control upgrades
- Malfunctions only on your offhand → consider a weapon with better Weapon Control bonus for that hand
- Zero malfunctions → your Weapon Control investment is paying off; consider reallocating future points elsewhere

## What's Next?

- [Battle Flow](/guide/combat/battle-flow) — See where malfunctions fit in the full attack sequence
- [Stances](/guide/combat/stances) — How stance choice interacts with your damage output
- [Robot Attributes Overview](/guide/robots/attributes-overview) — Full breakdown of all 23 attributes
