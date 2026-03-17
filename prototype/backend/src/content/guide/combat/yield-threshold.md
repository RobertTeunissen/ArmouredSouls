---
title: "Yield Threshold"
description: "How the yield threshold mechanic works — when your robot surrenders, how it affects battle outcomes, and the HP percentage settings that control it."
order: 7
lastUpdated: "2026-03-13"
relatedArticles:
  - combat/battle-flow
  - combat/stances
  - economy/repair-costs
  - strategy/yield-strategy
---

## Overview

The **Yield Threshold** is the HP percentage at which your robot automatically surrenders during battle. When hull HP drops to or below this value, your robot concedes the fight. You lose the battle, but your robot survives with its remaining HP — and that directly affects how much you pay in repairs.

Yield threshold ranges from **0% to 50%** and defaults to **10%** for new robots. You can change it freely between battles at no cost.

## How It Works

After every attack resolves and hull damage is applied, the game checks your robot's current HP against its yield threshold:

- **HP ≤ yield threshold** → Robot surrenders. Battle ends. You lose.
- **HP > yield threshold** → Battle continues.

The check happens after each individual attack, including counter-attacks. This means a robot can yield mid-round if a counter-attack pushes it below the threshold.

```callout-info
Yielding is always a loss — you don't earn victory rewards. But your robot keeps whatever HP it had at the moment of surrender, which means lower repair bills compared to fighting to destruction.
```

## Threshold Settings

| Setting | Behavior | Risk Level |
|---------|----------|------------|
| **0%** | Never yields — fights to destruction | Maximum risk, maximum chance to win |
| **10%** (default) | Yields at 10% HP remaining | Low risk, slight chance of losing winnable fights |
| **25%** | Yields at quarter HP | Moderate — preserves HP but concedes earlier |
| **50%** | Yields at half HP | Conservative — minimizes repair costs but loses many close fights |

## The Trade-Off

Yield threshold creates a fundamental tension between winning battles and managing repair costs:

- **Lower threshold** → More fights go to completion, more wins, but higher repair bills when you lose
- **Higher threshold** → Fewer catastrophic losses, lower average repair costs, but you concede fights you might have won

The optimal setting depends on your robot's build, league tier, and financial situation. A Tank with high armor can afford a low threshold because it takes less hull damage per hit. A Glass Cannon might want a higher threshold to avoid ruinous repair bills from fights that go wrong.

```callout-tip
Your yield threshold should match your build archetype. Tanks can safely run 0–10%. Glass Cannons often benefit from 15–25%. See the [Yield Strategy Guide](/guide/strategy/yield-strategy) for archetype-specific recommendations.
```

## Yield vs. Destruction

When a robot is destroyed (HP reaches exactly 0), the repair cost is based on full damage taken. When a robot yields, repair cost is based on damage taken up to the yield point — which is always less than full destruction.

The savings compound over many battles. A robot that yields at 10% HP across 30 battles in a cycle will spend significantly less on repairs than one that fights to 0% every time, even if the yielding robot loses a few extra fights.

## What's Next?

- [Yielding & Repair Costs](/guide/combat/yielding-and-repair-costs) — Detailed repair cost calculations and how yielding affects your bottom line
- [Battle Flow](/guide/combat/battle-flow) — The complete attack resolution sequence
- [Yield Strategy](/guide/strategy/yield-strategy) — Optimizing your threshold for different builds and situations
