---
title: "Bye Matches"
description: "How bye matches work in tournaments — why top seeds advance without fighting, how byes are assigned, and the no-rewards rule for bye rounds."
order: 4
lastUpdated: "2026-03-11"
relatedArticles:
  - tournaments/tournament-format
  - tournaments/rewards
  - tournaments/eligibility
  - leagues/matchmaking
---

## Overview

When a tournament doesn't have a perfect power-of-two number of participants (8, 16, 32, etc.), some robots need to skip the first round to make the bracket work. These skipped rounds are called **bye matches** — the robot advances to the next round without fighting.

Byes are assigned to the **top seeds** as a reward for their strong ELO performance. It's an advantage, but it comes with a trade-off: no battle means no rewards for that round.

## How Byes Are Assigned

The number of byes in a tournament depends on how many participants there are relative to the next power of two:

| Participants | Next Power of 2 | Byes Needed |
|-------------|-----------------|-------------|
| 5 | 8 | 3 |
| 10 | 16 | 6 |
| 12 | 16 | 4 |
| 20 | 32 | 12 |
| 24 | 32 | 8 |

The formula is simple: **byes = next power of 2 − number of participants**.

Byes are assigned in seed order, starting from the #1 seed. In a 12-robot tournament with 4 byes, seeds #1 through #4 receive first-round byes. Seeds #5 through #12 play in the first round.

```callout-info
Byes reward consistent league performance. Since seeding is based on [ELO rating](/guide/tournaments/tournament-format), robots that have been winning regularly in league play earn higher seeds and are more likely to receive byes. Your league results directly influence your tournament path.
```

## What Happens During a Bye

When your robot receives a bye:

1. **No battle occurs** — Your robot doesn't fight in that round
2. **Automatic advancement** — You move directly to the next round
3. **No damage taken** — Your robot enters the next round at full health
4. **No rewards earned** — You receive zero credits, prestige, and fame for the bye round

The robot simply waits while the other first-round matches play out, then enters the bracket in the second round against a first-round winner.

```callout-warning
Byes grant no rewards. A robot that receives a first-round bye and then wins its next match earns the progression multiplier for that round — but nothing for the bye round. Over a full tournament, this means bye recipients earn rewards for fewer rounds than robots who fight from the start.
```

## The Bye Trade-Off

Byes are generally advantageous, but they're not purely beneficial. Here's the full picture:

### Advantages

- **No risk of early elimination** — You can't lose a match you don't play. A bye guarantees you reach at least the second round.
- **No damage** — Your robot enters the next round with full HP, while your opponent may have taken damage in their first-round battle.
- **Rest cycle** — While others fight, your robot is fresh and ready for the next round.

### Disadvantages

- **No rewards for the bye round** — You miss out on the base (1.0×) rewards for the first round. Over many tournaments, this adds up.
- **Cold start** — Your first actual battle is against a robot that's already warmed up with a win. Some argue there's a psychological (or strategic) disadvantage to entering mid-tournament.

```callout-tip
The no-reward trade-off is usually worth it. Avoiding a first-round loss is more valuable than the modest rewards you'd earn from a first-round win. The real money is in the later rounds where the progression multiplier is higher, and a bye gets you there safely.
```

## Byes and Bracket Balance

The bye system ensures that the second round always has a clean power-of-two number of participants. After the first round:

- All bye recipients enter the bracket
- All first-round winners enter the bracket
- The total equals the next power of two, divided by two

For example, in a 12-robot tournament:
- 4 bye recipients advance to round 2
- 8 robots play in round 1, producing 4 winners
- Round 2 has 8 robots (4 + 4) — a clean bracket from here on

This means byes only occur in the first round. From the second round onward, every robot must fight to advance.

## Multiple Byes

In rare cases with very small tournaments, a robot might effectively benefit from bracket structure, but the system only assigns byes for the **first round**. There are no multi-round byes. Every participant must fight at least once before reaching the final.

```callout-info
The system is designed so that byes never create an unfair path to the championship. Even the #1 seed must win multiple battles to claim the title. Byes simply reduce the number of battles required by one.
```

## What's Next?

- [Tournament Format](/guide/tournaments/tournament-format) — How brackets and seeding work
- [Rewards](/guide/tournaments/rewards) — How round multipliers scale your earnings
- [Eligibility](/guide/tournaments/eligibility) — What your robot needs to enter
- [Matchmaking](/guide/leagues/matchmaking) — How regular league matching compares to tournament seeding

