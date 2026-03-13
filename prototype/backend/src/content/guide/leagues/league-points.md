---
title: "League Points"
description: "How League Points (LP) are earned through wins, losses, and draws — and why LP is the primary currency of competitive progression."
order: 3
lastUpdated: "2026-03-12"
relatedArticles:
  - leagues/promotion-demotion
  - leagues/matchmaking
  - leagues/league-tiers
  - leagues/promotion-demotion
  - leagues/matchmaking
---

## Overview

**League Points (LP)** are the primary measure of your robot's competitive performance within its current league. LP determines your ranking in the instance standings, drives [matchmaking](/guide/leagues/matchmaking) pairings, and is one of the key requirements for [promotion](/guide/leagues/promotion-demotion).

Unlike ELO — which represents long-term skill and changes gradually — LP reflects your recent form. A winning streak pushes your LP up quickly, while a losing streak brings it down. This makes LP the most dynamic and actionable number on your robot's profile.

## Earning LP

LP is awarded after every battle based on the outcome:

| Result | LP Change | Description |
|--------|-----------|-------------|
| **Win** | +3 LP | A decisive reward for victory. Three points per win means consistent winners climb fast. |
| **Draw** | +1 LP | Draws occur when the battle reaches the maximum time limit (120 seconds of simulated combat) without either robot yielding or being destroyed. Both robots earn a point. |
| **Loss** | -1 LP | A mild penalty. Losing costs less than winning gains, so a 50% win rate still produces net LP growth. |

### LP Floor

League Points cannot drop below **0**. If your robot has 0 LP and loses a match, LP stays at 0. This floor prevents new or struggling robots from accumulating negative LP debt.

```callout-tip
The asymmetric LP system (+3 win / -1 loss) is intentionally generous. Even a robot that wins only 1 in 3 matches breaks even on LP. This means most robots will gradually accumulate LP over time — the question is how fast, not whether.
```

### No ELO-Based LP Modifiers

LP awards are strictly based on the battle outcome — win, loss, or draw. There are no bonus or penalty LP adjustments based on ELO difference between opponents. Every win is worth +3, every loss costs -1, and every draw earns +1, regardless of how strong or weak your opponent was.

## LP and Promotion

LP is one of three requirements for promotion to the next tier:

1. **Top 10%** of your instance by LP ranking
2. **≥25 League Points** accumulated
3. **≥5 cycles** spent in your current tier

All three must be met simultaneously. Having 30 LP doesn't help if you're not in the top 10% of your instance. Being ranked #1 doesn't help if you haven't reached 25 LP yet.

The 25 LP threshold ensures robots have demonstrated sustained performance — not just a lucky streak. At +3 LP per win, reaching 25 LP requires a minimum of 9 wins (assuming no losses), but realistically takes more cycles since most robots experience some losses along the way.

See [Promotion & Demotion](/guide/leagues/promotion-demotion) for the complete rules.

## LP and Matchmaking

The [matchmaking algorithm](/guide/leagues/matchmaking) uses LP as its **primary** matching criterion. The system first looks for opponents within ±10 LP of your robot, then expands to ±20 LP if needed. This means your LP directly determines who you fight.

As your LP climbs, you'll face increasingly strong opponents — robots that are also winning consistently. This creates a natural difficulty curve within each tier. Early in a tier (low LP), matches are easier. As you accumulate LP, competition intensifies.

## LP and Instance Standings

Your LP determines your rank within your [instance](/guide/leagues/league-tiers). The instance standings are sorted by LP (descending), with ELO as a tiebreaker when two robots have identical LP.

The standings show:
- **Promotion zone** — Top 10% of the instance, highlighted in green
- **Demotion zone** — Bottom 10% of the instance, highlighted in red
- Your robot's current rank, LP, ELO, win-loss record, and cycles in tier

```callout-tip
Check your instance standings regularly. Knowing where you sit relative to the promotion and demotion thresholds helps you decide whether to play aggressively (push for promotion) or conservatively (avoid demotion risk).
```

## LP Retention

When you're promoted or demoted, your LP **carries over** to the new tier. If you had 32 LP when promoted from Bronze to Silver, you start Silver with 32 LP. This preserves your momentum and gives newly promoted robots a buffer against immediate demotion.

See [Promotion & Demotion](/guide/leagues/promotion-demotion) for more on how LP retention works across tier changes.

## What's Next?

- [Promotion & Demotion](/guide/leagues/promotion-demotion) — The full rules for moving between tiers
- [Matchmaking](/guide/leagues/matchmaking) — How LP drives opponent selection
- [Battle Flow](/guide/combat/battle-flow) — How battles are resolved to determine your LP outcome
