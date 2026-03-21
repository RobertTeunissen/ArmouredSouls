---
title: "Tournament Rewards"
description: "What you earn from tournament competition — credits, prestige, fame, championship titles, and how tournament size and round progression scale your rewards."
order: 3
lastUpdated: "2026-03-12"
relatedArticles:
  - tournaments/tournament-format
  - tournaments/eligibility
  - prestige-fame/prestige-ranks
  - prestige-fame/fame-tiers
  - economy/battle-rewards
---

## Overview

Tournaments offer rewards that go beyond what regular league battles provide. Every round you survive earns credits, prestige, and fame — and the deeper you go, the bigger those rewards get. Win the whole thing and you earn a **championship title** that marks your robot as a proven champion.

The reward structure is designed to make every round meaningful. Even a first-round exit earns something, but the real payoff comes from deep tournament runs.

Tournament rewards are independent of your robot's league tier. Instead, they scale based on two factors: how many robots entered the tournament, and how far you've progressed through the bracket.

## Reward Types

Tournament participation earns four types of rewards:

### Credits (₡)

Cash rewards for each tournament battle won. These start from a base of ₡20,000 and scale up based on tournament size and round progression. The further you advance in a larger tournament, the more credits each win is worth.

### Prestige

[Prestige](/guide/prestige-fame/prestige-ranks) is your stable's long-term reputation score. Tournament wins earn prestige that scales with tournament size and round progression. Winning the finals awards a massive +500 championship prestige bonus on top of the normal amount.

### Fame

[Fame](/guide/prestige-fame/fame-tiers) is your robot's individual reputation. Tournament fame is driven by exclusivity — the fewer robots remaining when you win, the more fame you earn. Performance bonuses also apply to fame:

| Performance | Bonus | Condition |
|------------|-------|-----------|
| Perfect Victory | 2.0× | Win with 100% HP remaining |
| Dominating | 1.5× | Win with more than 80% HP remaining |
| Comeback | 1.25× | Win with less than 20% HP remaining |
| Normal | 1.0× | Everything else |

```callout-info
Performance bonuses affect fame only, not credits or prestige. Fame rewards exclusivity and how convincingly you win, while credits and prestige reward progression through the bracket.
```

### Championship Title

The tournament winner earns a **championship title** — a permanent distinction attached to your robot's record. Championship titles are the most prestigious achievement in Armoured Souls and cannot be earned through any other means.

```callout-tip
Championship titles are permanent and cumulative. A robot that wins multiple tournaments collects multiple titles. These are visible on your robot's profile and serve as proof of tournament dominance.
```

## How Rewards Scale

Tournament rewards are calculated using two multipliers that combine together:

### Tournament Size Multiplier

Larger tournaments mean tougher competition and bigger rewards. The size multiplier uses a logarithmic formula that scales conservatively:

| Participants | Size Multiplier |
|-------------|----------------|
| ~130 | 1.06× |
| ~250 | 1.20× |
| ~500 | 1.43× |
| ~1,000 | 1.50× |
| ~10,000 | 2.00× |
| ~100,000 | 3.00× |

### Round Progression Multiplier

Each round is worth more than the last. The progression multiplier equals your current round divided by the total number of rounds:

For a typical 7-round tournament (128 participants):

| Round | Progression Multiplier |
|-------|----------------------|
| Round 1 (of 7) | 0.14× |
| Round 2 (of 7) | 0.29× |
| Round 3 (of 7) | 0.43× |
| Round 4 (of 7) | 0.57× |
| Round 5 (of 7) | 0.71× |
| Round 6 (of 7) | 0.86× |
| Round 7 — Final | 1.00× |

Early rounds earn modest rewards. The real payoff comes in the later rounds as the progression multiplier approaches 1.0×.

### Combined Formula

Credits for a tournament win are calculated as:

**₡20,000 × size multiplier × round progression multiplier**

For example, in a 128-robot tournament (size multiplier ~1.06×):

| Round | Calculation | Credits Earned |
|-------|-----------|---------------|
| Round 1 | ₡20,000 × 1.06 × 0.14 | ₡2,971 |
| Round 4 | ₡20,000 × 1.06 × 0.57 | ₡12,114 |
| Round 7 (Final) | ₡20,000 × 1.06 × 1.00 | ₡21,200 |

A full championship run through all 7 rounds would earn roughly **₡63,000** in credits — plus prestige, fame, and the championship title.

In a much larger tournament with 1,000 participants (10 rounds, size multiplier 1.50×):

| Round | Calculation | Credits Earned |
|-------|-----------|---------------|
| Round 1 | ₡20,000 × 1.50 × 0.10 | ₡3,000 |
| Round 5 | ₡20,000 × 1.50 × 0.50 | ₡15,000 |
| Round 10 (Final) | ₡20,000 × 1.50 × 1.00 | ₡30,000 |

```callout-warning
You only earn rewards for battles you actually fight and win. If you receive a [bye](/guide/tournaments/bye-matches) in the first round, you advance but earn nothing for that round.
```

## Championship Rewards

Winning the final earns everything a normal round win provides (with the full 1.0× progression multiplier), plus:

- A **+500 prestige championship bonus** on top of the normal prestige award
- A permanent **championship title** attached to your robot's record

The championship title includes the tournament identifier, the date, and your robot's name and stable. Championship titles are the most visible mark of tournament success and cannot be earned through any other means.

```callout-tip
The +500 prestige championship bonus is massive compared to normal prestige gains. A single tournament win can be worth more prestige than dozens of league battles. This makes deep tournament runs one of the fastest paths to higher prestige ranks.
```

## ELO Impact

Tournament battles **do** affect your robot's ELO rating. Wins and losses are calculated using the standard K=32 formula, the same one used in league battles. This means a strong tournament run will boost your ELO, which in turn influences your league matchmaking and future tournament seeding.

This is different from [King of the Hill](/guide/king-of-the-hill/rewards), where ELO is unaffected. The reasoning: tournaments are competitive, bracket-seeded events where results should carry weight. KotH is a more casual, free-for-all format where ELO is used only for matchmaking group balancing.

```callout-info
Since tournament seeding is based on ELO, doing well in tournaments creates a positive feedback loop — higher ELO means better seeding in the next tournament, which can mean easier early-round matchups and more byes.
```

## Losing Rewards

Losing a tournament battle still earns a participation reward — **30% of what the winner earns** for that round. Tournament losses don't penalize you beyond the elimination itself.

This means there's no downside to entering tournaments. Even a first-round loss earns something, and the potential upside of a deep run far outweighs the modest participation reward.

```callout-tip
Always enter tournaments when eligible. The worst case is a first-round loss with a small participation reward. The best case is a championship run with scaled rewards, a +500 prestige bonus, fame, and a title. The risk-reward ratio heavily favors participation.
```

## Fame and Exclusivity

Tournament fame works differently from credits and prestige. Instead of scaling with round progression, fame scales with **exclusivity** — how few robots remain when you win. The fewer survivors, the more impressive your victory.

| Robots Remaining | Exclusivity Multiplier |
|-----------------|----------------------|
| 50% of field | 1.41× |
| 25% of field | 2.00× |
| 10% of field | 3.16× |
| Final 2 | Highest multiplier |

This means a semi-final win (with very few robots left) generates far more fame than a first-round win, even without a separate round multiplier. Combined with performance bonuses for dominant or perfect victories, late-round wins can produce significant fame spikes.

## What's Next?

- [Tournament Format](/guide/tournaments/tournament-format) — How brackets and seeding determine your path
- [Eligibility](/guide/tournaments/eligibility) — Making sure your robot qualifies
- [Bye Matches](/guide/tournaments/bye-matches) — What happens when top seeds skip a round
- [Prestige Ranks](/guide/prestige-fame/prestige-ranks) — How tournament prestige feeds into your stable's reputation
- [Fame Tiers](/guide/prestige-fame/fame-tiers) — How tournament fame builds your robot's legacy
