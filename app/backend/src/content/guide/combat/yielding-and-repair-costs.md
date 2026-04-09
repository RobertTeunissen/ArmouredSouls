---
title: "Yielding & Repair Costs"
description: "How the yield system works, how it affects repair costs, and the strategic trade-offs between aggressive and conservative surrender settings."
order: 5
lastUpdated: "2026-03-16"
relatedArticles:
  - combat/stances
  - combat/battle-flow
  - economy/repair-costs
  - economy/credits-and-income
  - strategy/yield-strategy
---

## Overview

The **Yield Threshold** is the HP percentage at which your robot will attempt to surrender during battle. When your robot's HP drops to or below this threshold, it stops fighting and concedes the match. You lose the battle, but your robot survives with its remaining HP — and that matters because repair costs scale with how much damage your robot took.

Yield threshold is set before battle and ranges from **0% to 50%**. New robots default to **10%**. You can change it freely between battles.

![Yield threshold trade-off](/images/guide/combat/yield-threshold-tradeoff.png)

## How Yielding Works

During battle, after each attack resolves and damage is applied to your robot's hull, the game checks whether your HP has dropped to or below your yield threshold.

- **If HP ≤ yield threshold** → Your robot surrenders. The battle ends. You lose.
- **If HP > yield threshold** → The battle continues.

Yielding is a loss — you don't earn victory rewards. But your robot survives with whatever HP it had when it surrendered, which directly affects your repair bill.

```callout-info
Yielding is not the same as being destroyed. A robot that yields walks away damaged but intact. A robot that reaches 0 HP is destroyed, which triggers a much more expensive repair multiplier.
```

## Repair Cost Implications

This is where yield threshold becomes an economic decision. Repair costs are calculated based on three factors:

1. **How much damage your robot took** — More damage means higher base repair cost.
2. **Whether your robot was destroyed** — Reaching 0 HP triggers a 2× repair cost multiplier.
3. **Whether your robot was heavily damaged** — Dropping below 10% HP (but not destroyed) triggers a 1.5× multiplier.

Here's how different yield thresholds affect your repair bill for a typical robot:

| Scenario | HP Remaining | Repair Multiplier | Relative Cost |
|----------|:-----------:|:-----------------:|:-------------:|
| Victory at 40% HP | 40% | 1.0× | Low |
| Yield at 20% HP | 20% | 1.0× | Moderate |
| Yield at 15% HP | 15% | 1.0× | Moderate-High |
| Yield at 5% HP | 5% | 1.5× (heavily damaged) | High |
| Destroyed (0% HP) | 0% | 2.0× | Very High |

```callout-warning
The jump from "yield at 5% HP" to "destroyed at 0% HP" is massive. The destruction multiplier doubles your repair cost compared to normal damage. Setting your yield threshold to 0% means your robot will never surrender — and if it loses, you pay the maximum price.
```

## The Strategic Trade-Off

Yield threshold is fundamentally a risk/reward decision:

### Low Threshold (0–10%): Aggressive

- Your robot fights until it's nearly destroyed (or actually destroyed at 0%)
- **Upside:** More chances to win close fights. Your robot stays in the battle longer, which means more opportunities to land the finishing blow.
- **Downside:** When you lose, repair costs are brutal. At 0%, you always pay the destruction multiplier. At 5%, you often trigger the heavy damage multiplier.
- **Best for:** Robots you're confident will win most fights, or when the battle rewards outweigh the repair risk.

### Mid Threshold (10–25%): Balanced

- Your robot surrenders when significantly damaged but not critically so.
- **Upside:** Avoids the worst repair multipliers while still giving your robot a fair chance to fight back.
- **Downside:** You'll occasionally yield in fights you might have won if you'd held on a bit longer.
- **Best for:** Most situations. The default of 10% is a reasonable starting point.

### High Threshold (25–50%): Conservative

- Your robot surrenders relatively early when things go badly.
- **Upside:** Repair costs stay low. Your robot yields before taking catastrophic damage, keeping your finances healthy.
- **Downside:** You'll lose fights that a more aggressive setting might have won. Surrendering at 50% HP means giving up when you still have half your health.
- **Best for:** Expensive robots you can't afford to repair, or when you're managing a tight budget across multiple robots.

```callout-tip
There's no universally "correct" yield threshold. It depends on your robot's strength relative to its opponents, your financial situation, and your risk tolerance. Experiment and adjust based on your battle results.
```

## Yield Threshold and Stances

Your [stance choice](/guide/combat/stances) interacts with yield threshold in important ways:

- **Offensive stance + low yield** — Maximum aggression. You deal more damage and fight to the bitter end. High reward when you win, high cost when you lose.
- **Defensive stance + high yield** — Maximum conservation. You take less damage, regenerate shields faster, and surrender before things get expensive. Lower win rate but much lower repair bills.
- **Balanced stance + mid yield** — The safe middle ground. Consistent performance without extreme outcomes in either direction.

## Repair Bay and Yield Economics

The [Repair Bay](/guide/facilities/repair-bay) facility reduces repair costs through a discount that scales with both the facility level and the number of active robots in your stable. This discount applies *after* the damage and destruction multipliers.

On top of the Repair Bay discount, you can save even more by repairing manually. Using the **Repair All** button on the Robots page gives you a **50% manual repair discount** that stacks with the Repair Bay discount. Automatic repairs during the daily cycle don't receive this bonus. Manual repairs are also the only action available when your balance is negative — so even in tough financial times, you can keep your robots fighting.

With a well-upgraded Repair Bay, a large roster, and manual repairs, even aggressive yield thresholds become very affordable. Players running three robots with a high-level Repair Bay who repair manually can see their repair costs drop to a fraction of the base price.

```callout-info
The combination of Repair Bay discount and manual repair discount makes a dramatic difference for multi-robot stables. A player with 7+ robots, a level 5+ Repair Bay, and manual repairs can see repair costs drop far more than half, making aggressive play much more economically viable.
```

## Practical Guidelines

| Situation | Recommended Threshold | Reasoning |
|-----------|:--------------------:|-----------|
| New player, learning the game | 10–15% | Safe default. Avoids expensive mistakes while you learn. |
| Strong robot, favorable matchups | 5–10% | Let your robot fight — it's likely to win. |
| Weak robot, tough league tier | 20–30% | Preserve your budget. Live to fight another day. |
| Budget is tight, can't afford repairs | 25–40% | Prioritize survival over wins until finances recover. |
| Robot with high Repair Bay discount | 5–10% | The discount makes aggressive play affordable. |
| Repairing manually between cycles | 5–15% | The 50% manual repair discount cushions aggressive play. |
| Climbing the league rankings | 5–15% | You need wins to earn LP. Accept higher repair costs. |

## Reading Your Results

After each battle, check your repair costs in the financial summary. If you're consistently paying high repair bills:

- **Raise your yield threshold** by 5–10% and see if the savings outweigh the lost wins
- **Switch to Defensive stance** to reduce total damage taken
- **Invest in your Repair Bay** to get a better discount on all repairs

If you're yielding too often and missing out on wins:

- **Lower your yield threshold** by 5–10%
- **Switch to Offensive stance** to end fights faster before your HP drops
- **Upgrade defensive attributes** (Armor, Shields, Hull Integrity) so your robot can take more punishment

## What's Next?

- [Battle Flow](/guide/combat/battle-flow) — Understand the full attack sequence that determines damage
- [Stances](/guide/combat/stances) — How stance choice affects your damage taken and dealt
- [Counter-Attacks & Shield Regeneration](/guide/combat/counter-attacks) — Defensive mechanics that help you survive longer
- [Economy & Credits](/guide/economy/credits-and-income) — Managing your stable's finances
