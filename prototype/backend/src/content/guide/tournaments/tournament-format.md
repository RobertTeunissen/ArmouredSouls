---
title: "Tournament Format & Brackets"
description: "How single elimination tournaments work in Armoured Souls — bracket generation, ELO-based seeding, and the path from first round to championship."
order: 1
lastUpdated: "2026-03-11"
relatedArticles:
  - tournaments/eligibility
  - tournaments/rewards
  - tournaments/bye-matches
  - leagues/league-tiers
---

## Overview

Tournaments are the ultimate test of your robots. Unlike regular league battles where you fight one opponent per cycle, tournaments pit the best robots against each other in a **single elimination bracket** — lose once and you're out. Win every round and you claim the championship title.

Tournaments run alongside the regular league system as a separate competitive track. They offer unique rewards, prestige, and bragging rights that can't be earned through league play alone.

![Example tournament bracket](/images/guide/tournaments/bracket-generation-example.png)

## Single Elimination Format

Every tournament in Armoured Souls uses a **single elimination** format. The rules are straightforward:

- Each round, two robots battle
- The winner advances to the next round
- The loser is eliminated from the tournament
- The last robot standing wins the championship

There are no second chances, no losers' brackets, and no rematches. A single bad performance ends your tournament run. This high-stakes format makes every battle count and rewards consistency across multiple rounds.

```callout-tip
Because one loss ends your run, tournament preparation matters more than in regular league play. Make sure your robot is fully repaired, properly equipped, and configured with the right stance before a tournament begins. See the [eligibility requirements](/guide/tournaments/eligibility) for the full checklist.
```

## Bracket Generation

When a tournament begins, the system generates a bracket by **seeding robots based on their ELO rating**. Higher-rated robots receive higher seeds, which provides two advantages:

1. **Favorable early matchups** — Top seeds face lower-seeded opponents in the first rounds, giving stronger robots an easier path to the later stages.
2. **Bye eligibility** — When the number of participants isn't a perfect power of two, top seeds receive [byes](/guide/tournaments/bye-matches) and advance to the second round without fighting.

### How Seeding Works

Robots are ranked by their current ELO rating from highest to lowest. The #1 seed is the robot with the highest ELO, the #2 seed has the second-highest, and so on.

The bracket is then structured so that the highest seeds are placed on opposite sides. This means the #1 and #2 seeds can only meet in the final — not in an early round. The classic bracket placement follows standard tournament seeding conventions:

| Seed | Bracket Position |
|------|-----------------|
| #1 | Top of upper bracket half |
| #2 | Bottom of lower bracket half |
| #3 | Top of lower bracket half |
| #4 | Bottom of upper bracket half |

This pattern continues for all participants, ensuring the strongest robots are spread evenly across the bracket.

```callout-info
ELO-based seeding rewards long-term performance. A robot that has been winning consistently in league play will earn a higher seed and a more favorable tournament path. Your league performance directly influences your tournament prospects.
```

### Non-Power-of-Two Brackets

Tournaments don't always have a perfect number of participants (8, 16, 32, etc.). When the count isn't a power of two, the system handles the gap with **bye matches** — the top seeds advance to the second round without fighting.

For example, in a 12-robot tournament:
- 4 robots receive first-round byes (seeds #1 through #4)
- 8 robots play in the first round, producing 4 winners
- The second round has 8 robots: 4 bye recipients + 4 first-round winners

See [Bye Matches](/guide/tournaments/bye-matches) for the full details on how byes are assigned and what they mean for rewards.

## Tournament Rounds

A tournament progresses through named rounds depending on the bracket size:

| Bracket Size | Rounds |
|-------------|--------|
| 8 robots | Quarter-finals → Semi-finals → Final |
| 16 robots | Round of 16 → Quarter-finals → Semi-finals → Final |
| 32 robots | Round of 32 → Round of 16 → Quarter-finals → Semi-finals → Final |

Each round is processed during the daily cycle, so a 16-robot tournament takes four cycles to complete. The deeper you go, the tougher the competition — and the bigger the [rewards](/guide/tournaments/rewards).

```callout-warning
Tournament battles follow the same combat rules as league battles — [stances](/guide/combat/stances), [weapon loadouts](/guide/weapons/loadout-types), [malfunctions](/guide/combat/malfunctions), and [yield thresholds](/guide/combat/yielding-and-repair-costs) all apply. There are no special tournament combat rules. The difference is purely in the stakes: lose and you're out.
```

## What's Next?

- [Eligibility](/guide/tournaments/eligibility) — What your robot needs to enter a tournament
- [Rewards](/guide/tournaments/rewards) — Credits, prestige, fame, and championship titles
- [Bye Matches](/guide/tournaments/bye-matches) — How byes work for top seeds
- [Battle Flow](/guide/combat/battle-flow) — How tournament battles are resolved

