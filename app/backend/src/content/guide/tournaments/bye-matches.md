---
title: "Bye Matches"
description: "How tournament bye Matches work — why top seeds advance without fighting, when a bye is resolved, and what it pays."
order: 4
lastUpdated: "2026-09-01"
relatedArticles:
  - tournaments/tournament-format
  - tournaments/rewards
  - tournaments/eligibility
  - leagues/matchmaking
---

## Overview

When a tournament doesn't have a perfect power-of-two number of participants (8, 16, 32, etc.), some robots need to skip an early round to make the bracket work. These scheduled one-sided events are called **bye Matches**.

A bye is assigned to a top seed and is visible in **Upcoming Matches** as an expected walkover. It is not resolved, paid, or shown in **Recent Battles** when the bracket is generated. When the relevant round is processed, the bye resolves without combat, the existing bye reward is awarded once, and the robot advances to the next round.

Byes are assigned to the **top seeds** as a reward for their strong ELO performance. They avoid an elimination risk and take no damage, while the bye round still pays the same credits a loss would earn for that round.

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

Byes are assigned in seed order, starting from the #1 seed. In a 12-robot tournament with 4 byes, seeds #1 through #4 receive first-round bye Matches. Seeds #5 through #12 play in the first round.

```callout-info
Byes reward consistent league performance. Since seeding is based on [ELO rating](/guide/tournaments/tournament-format), robots that have been winning regularly in league play earn higher seeds and are more likely to receive byes. Your league results directly influence your tournament path.
```

## What Happens During a Bye

When your robot receives a bye:

1. **An expected Match appears** — The bracket creates an upcoming bye with your real robot as the subject, neutral “No opponent — walkover” copy, and an expected reward amount.
2. **Nothing is paid at generation** — Before the relevant round runs, the bye does not create a Battle, credit transaction, or Recent Battles entry. The expected amount is informational.
3. **The round processes the bye** — When the scheduled tournament round runs, the bye is resolved exactly once. No combat is simulated, so your robot takes no damage and no repair bill is created.
4. **The resolved Battle appears** — The awarded credit amount is shown in Recent Battles, with no opponent, prestige, fame, or streaming income. Your robot then becomes eligible for its next-round Match.

The same display treatment is used for all battle modes that can receive a bye: league and tournament robot Matches, league and tournament team Matches, tag team, King of the Hill, and Grand Melee. A `Bye_Placeholder` is a scheduling sentinel only; it is never shown as an opponent.

```callout-warning
A bye pays what a loss pays for that round — not what a win pays. The amount shown before processing is expected, not already credited. A robot that receives a first-round bye and then wins its next Match earns the progression reward for that later round plus the loss-equivalent credits for the bye round.
```

## The Bye Trade-Off

Byes are advantageous on balance. They remove the risk of an early elimination and preserve the robot's condition, but they do not provide a winner's reward for a round that was not fought.

### Advantages

- **No risk of early elimination** — You can't lose a Match you don't play. A bye guarantees you reach at least the next round.
- **No damage** — No combat is simulated, so your robot enters the next round without bye-related damage or repair spend.
- **Rest cycle** — While others fight, your robot is fresh and ready for the next Match.
- **Visible accounting** — The Upcoming Match shows an expected amount, and the resolved Battle shows the awarded amount after processing.

### Disadvantages

- **No win reward for the bye round** — You earn the loss-equivalent credits, not the winner's, and you earn no prestige, fame, or streaming income for it.
- **Cold start** — Your first actual Battle is against a robot that already fought in an earlier round. Some players may prefer the experience of an earlier fight.

```callout-tip
The bye reward is not a zero-credit result, but it is also not a win reward. Watch Upcoming Matches for the expected amount, then check Recent Battles after the round is processed to see the awarded credit entry.
```

## Byes and Bracket Balance

The bye system ensures that the next round has a clean power-of-two number of participants. After the first round has been processed:

- all resolved bye recipients advance;
- all first-round winners advance; and
- the total equals the next power of two, divided into the next round's Matches.

For example, in a 12-robot tournament:

- 4 bye recipients receive their awarded bye entries when round 1 is processed;
- 8 robots play in round 1, producing 4 winners; and
- round 2 has 8 robots (4 + 4) — a clean bracket from here on.

If a later generated bracket entry is also a bye, it follows the same expected-then-awarded lifecycle and is not auto-resolved merely because the bracket has been generated.

## Multiple Byes

A tournament can contain multiple first-round byes when the participant count is far from the next power of two. The bracket normally needs no additional byes after the first round, but any generated one-sided round entry follows the same rule: it stays in Upcoming Matches until that round is processed, then appears once in Recent Battles with its awarded reward.

```callout-info
The system is designed so that byes never create an unfair path to the championship. Byes reduce the number of Battles required, but the participant still has to win the remaining rounds to claim the title.
```

## What's Next?

- [Tournament Format](/guide/tournaments/tournament-format) — How brackets and seeding work
- [Rewards](/guide/tournaments/rewards) — How round multipliers scale your earnings
- [Eligibility](/guide/tournaments/eligibility) — What your robot needs to enter
- [Matchmaking](/guide/leagues/matchmaking) — How regular league matching compares to tournament seeding
