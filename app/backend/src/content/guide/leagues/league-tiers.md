---
title: "League Tiers & Instances"
description: "The six competitive tiers in Armoured Souls — from Bronze to Champion — and how the instance system keeps leagues balanced and competitive."
order: 1
lastUpdated: "2026-11-19"
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
| **Bronze** | 🥉 | The starting tier for every robot and team entering a league. Competition is forgiving, rewards are modest, and it's the best place to learn the game. |
| **Silver** | 🥈 | A step up in competition. Robots here have proven they can win consistently and are starting to specialize their builds. |
| **Gold** | 🥇 | The middle ground. Gold-tier robots are well-built and strategically configured. Battles become noticeably tougher. |
| **Platinum** | 💎 | Elite competition begins here. Robots in Platinum have optimized builds and strong attribute investments. |
| **Diamond** | 💠 | Near the top. Diamond-tier robots are finely tuned machines with high-level attributes and carefully chosen loadouts. |
| **Champion** | 🏆 | The pinnacle. Only the best robots reach Champion tier. There's no promotion beyond this — Champion is the endgame. |

A robot enters a league's **Bronze** tier with 0 League Points the first time you subscribe it to that league in the [Booking Office](/guide/facilities/booking-office). Robots start with a default ELO of 1200. Until a robot is subscribed to the 1v1 League it shows as **Unranked** there. Unsubscribing later keeps its tier and LP — it simply stops being matched. From there, performance determines whether you climb or fall.

```callout-tip
Don't rush to leave Bronze. It's the safest place to experiment with different builds, stances, and loadouts. The lower rewards are offset by lower repair costs and weaker opponents — giving you room to learn without going bankrupt.
```

## The Instance System

Each league tier is divided into **instances** — smaller groups of robots that compete directly against each other. An instance holds a maximum of **100 robots**.

When every instance in a tier is full, the tier is split into more instances automatically. A tier is always spread so each instance keeps room for new arrivals. For example, 250 robots in Bronze are spread over four instances:

- `Bronze 1` — ~63 robots
- `Bronze 2` — ~63 robots
- `Bronze 3` — ~62 robots
- `Bronze 4` — ~62 robots

### Why Instances Exist

Instances serve two purposes:

1. **Matchmaking quality** — With 100 or fewer robots, the matchmaking algorithm can find fair opponents within a tight LP and ELO range. Larger pools would dilute match quality.
2. **Meaningful standings** — Being ranked #5 out of 100 is more tangible than being #50 out of 5,000. Instances create a local leaderboard where your position matters.

### How Robots Are Placed

- **Newly subscribed robots** are placed in the Bronze instance with the most free spots.
- **Promoted/demoted robots** are also placed in the instance with the most available space in their new tier.
- **During the season your instance is fixed.** You keep the same group of opponents and only move when you are promoted or demoted, or when your tier's instances need fixing. That is checked after every league's daily promotions and demotions:
  - **Split or uneven tier** — when every instance is full, or one instance is much bigger or smaller than the others, the whole tier is reshuffled: all robots are sorted by LP and dealt round-robin over the instances, so each gets a mix of high, medium, and low performers.
  - **Shrinking tier** — promotions take the best robots out of every instance, so a tier (Bronze first) gets smaller over a season. Once it fits in fewer instances, the highest-numbered instance is closed and its robots join the other instances. Everyone else stays where they are.
  - Otherwise nobody moves.
- **At the start of a season** the tiers are reshuffled at the rollover and on each preparation day, when no battles run. Everyone starts on 0 LP then, so robots that entered late are dealt over all the instances instead of ending up together in one.

```callout-info
A reshuffle or a closed instance preserves your League Points and ELO — only your instance changes. Because instances stay fixed, they can drift apart in strength over a season: the LP you need to reach your instance's promotion zone depends on who is in it. You will also meet the same opponents more often than in a reshuffled league, although matchmaking still avoids your most recent opponents where it can.
```

### Instance Independence

Each instance is evaluated independently for [promotion and demotion](/guide/leagues/promotion-demotion). The top 10% of `bronze_1` might get promoted while `bronze_2` promotes a different set of robots. Your competition is the robots in your instance, not the entire tier.

Matchmaking also prefers opponents within your own instance, though it can fall back to adjacent instances if needed.

## League Tier Rewards

Higher tiers mean bigger rewards. Each tier has a fixed base win reward — the amount you earn for winning a battle. Losers receive a **participation reward: 20% of that tier's base win reward**.

| Tier | Base Win Reward | Participation Reward |
|------|----------------|---------------------|
| Bronze | ₡7,500 | ₡1,500 |
| Silver | ₡15,000 | ₡3,000 |
| Gold | ₡30,000 | ₡6,000 |
| Platinum | ₡60,000 | ₡12,000 |
| Diamond | ₡115,000 | ₡24,000 |
| Champion | ₡225,000 | ₡45,000 |

These rewards are the same for every stable: [Prestige](/guide/prestige-fame/prestige-ranks) doesn't change what a battle pays.

```callout-tip
The jump from Bronze to Silver doubles your base win reward. Even a single tier promotion has a meaningful impact on your stable's income. See the [Economy Guide](/guide/economy/battle-rewards) for the full breakdown of how rewards are calculated.
```

## What's Next?

- [Matchmaking](/guide/leagues/matchmaking) — How the system pairs opponents within your league
- [League Points](/guide/leagues/league-points) — How LP is earned and why it matters for promotion
- [Promotion & Demotion](/guide/leagues/promotion-demotion) — The rules for moving between tiers, LP retention, and the full path from Bronze to Champion
