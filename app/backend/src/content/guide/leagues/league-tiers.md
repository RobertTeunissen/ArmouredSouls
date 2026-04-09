---
title: "League Tiers & Instances"
description: "The six competitive tiers in Armoured Souls — from Bronze to Champion — and how the instance system keeps leagues balanced and competitive."
order: 1
lastUpdated: "2026-03-12"
relatedArticles:
  - leagues/matchmaking
  - leagues/league-points
  - leagues/promotion-demotion
  - economy/battle-rewards
---

## Overview

Every robot in Armoured Souls competes in a **league** — a competitive tier that determines who you fight, what rewards you earn, and how far you've progressed. There are six tiers, each representing a step up in competition and reward potential.

Leagues aren't just labels. Your tier directly affects your battle rewards, the strength of your opponents, and the prestige your stable earns. Climbing from Bronze to Champion is the long-term competitive journey at the heart of the game.

![League tier progression](/images/guide/leagues/league-tier-progression.png)

## The Six League Tiers

| Tier | Color | Description |
|------|-------|-------------|
| **Bronze** | 🥉 | The starting tier for all new robots. Competition is forgiving, rewards are modest, and it's the best place to learn the game. |
| **Silver** | 🥈 | A step up in competition. Robots here have proven they can win consistently and are starting to specialize their builds. |
| **Gold** | 🥇 | The middle ground. Gold-tier robots are well-built and strategically configured. Battles become noticeably tougher. |
| **Platinum** | 💎 | Elite competition begins here. Robots in Platinum have optimized builds and strong attribute investments. |
| **Diamond** | 💠 | Near the top. Diamond-tier robots are finely tuned machines with high-level attributes and carefully chosen loadouts. |
| **Champion** | 🏆 | The pinnacle. Only the best robots reach Champion tier. There's no promotion beyond this — Champion is the endgame. |

All new robots start in **Bronze** league with a default ELO of 1200 and 0 League Points. From there, performance determines whether you climb or fall.

```callout-tip
Don't rush to leave Bronze. It's the safest place to experiment with different builds, stances, and loadouts. The lower rewards are offset by lower repair costs and weaker opponents — giving you room to learn without going bankrupt.
```

## The Instance System

Each league tier is divided into **instances** — smaller groups of robots that compete directly against each other. An instance holds a maximum of **100 robots**.

When a tier has more than 100 robots, additional instances are created automatically. For example, if 250 robots are in Bronze, the system creates three instances:

- `Bronze 1` — ~83 robots
- `Bronze 2` — ~83 robots
- `Bronze 3` — ~84 robots

### Why Instances Exist

Instances serve two purposes:

1. **Matchmaking quality** — With 100 or fewer robots, the matchmaking algorithm can find fair opponents within a tight LP and ELO range. Larger pools would dilute match quality.
2. **Meaningful standings** — Being ranked #5 out of 100 is more tangible than being #50 out of 5,000. Instances create a local leaderboard where your position matters.

### How Robots Are Placed

- **New robots** are placed in the instance with the most free spots, keeping populations balanced naturally.
- **Promoted/demoted robots** are also placed in the instance with the most available space in their new tier.
- **Rebalancing** occurs when any instance exceeds 100 robots. All robots in that tier are sorted by LP and ELO, then redistributed round-robin across instances to maintain competitive balance.

```callout-info
Rebalancing preserves your League Points and ELO — only your instance assignment changes. Each instance ends up with a healthy mix of high, medium, and low performers, so no single instance becomes a "death group."
```

### Instance Independence

Each instance is evaluated independently for [promotion and demotion](/guide/leagues/promotion-demotion). The top 10% of `bronze_1` might get promoted while `bronze_2` promotes a different set of robots. Your competition is the robots in your instance, not the entire tier.

Matchmaking also prefers opponents within your own instance, though it can fall back to adjacent instances if needed.

## League Tier Rewards

Higher tiers mean bigger rewards. Each tier has a fixed base win reward — the amount you earn for winning a battle. Losers receive a participation reward (30% of the tier minimum).

| Tier | Base Win Reward | Participation Reward |
|------|----------------|---------------------|
| Bronze | ₡7,500 | ₡1,500 |
| Silver | ₡15,000 | ₡3,000 |
| Gold | ₡30,000 | ₡6,000 |
| Platinum | ₡60,000 | ₡12,000 |
| Diamond | ₡115,000 | ₡24,000 |
| Champion | ₡225,000 | ₡45,000 |

These base rewards are further modified by your stable's [Prestige](/guide/prestige-fame/prestige-ranks) level, which applies a bonus multiplier (up to +50%) to all battle winnings.

```callout-tip
The jump from Bronze to Silver doubles your base win reward. Even a single tier promotion has a meaningful impact on your stable's income. See the [Economy Guide](/guide/economy/battle-rewards) for the full breakdown of how rewards are calculated.
```

## What's Next?

- [Matchmaking](/guide/leagues/matchmaking) — How the system pairs opponents within your league
- [League Points](/guide/leagues/league-points) — How LP is earned and why it matters for promotion
- [Promotion & Demotion](/guide/leagues/promotion-demotion) — The rules for moving between tiers, LP retention, and the full path from Bronze to Champion
