---
title: "Tournament Eligibility"
description: "What your robot needs to enter a tournament — weapon checks and how the continuous tournament cycle keeps competition flowing."
order: 2
lastUpdated: "2026-03-12"
relatedArticles:
  - tournaments/tournament-format
  - tournaments/rewards
  - combat/yielding-and-repair-costs
  - weapons/loadout-types
  - leagues/league-tiers
---

## Overview

Not every robot can enter a tournament. The system enforces eligibility requirements to ensure that only properly equipped robots compete. These checks prevent robots with incomplete loadouts from taking up bracket slots and creating uncompetitive matches.

Meeting the requirements is your responsibility as a stable manager. If your robot doesn't qualify when a tournament starts, it simply won't be included in the bracket.

## Eligibility Requirements

To enter a tournament, your robot must meet the following condition at the time the bracket is generated:

### 1. Weapons Equipped

Your robot must have the correct weapons equipped for its [loadout type](/guide/weapons/loadout-types):

| Loadout Type | Requirement |
|-------------|-------------|
| Single | Main weapon equipped |
| Dual-Wield | Main weapon AND offhand weapon equipped |
| Weapon+Shield | Main weapon AND shield equipped |
| Two-Handed | Two-handed main weapon equipped |

A robot with an incomplete loadout — say, a Dual-Wield configuration with only one weapon — will not be eligible. Make sure your equipment is complete before tournament registration closes.

Tournament eligibility does not check HP. Robots are fully repaired automatically before tournament matches execute — repairs always run before battles in the daily cycle. As long as your weapons are equipped, your robot will be included in the bracket.

```callout-tip
You can check whether your robots are battle-ready in several places: the Dashboard shows notifications for robots with incomplete loadouts, the Robot Detail page displays your current equipment status, and the robot list uses icons to indicate readiness at a glance.
```

## The Continuous Tournament Cycle

Tournaments in Armoured Souls run on a **continuous cycle**. There's no downtime between tournaments — as soon as one ends, the next one begins. This means there's always a tournament to compete in, and consistent preparation pays off over time.

### How the Cycle Works

1. **Registration** — The system checks all robots for eligibility and builds the participant list
2. **Bracket generation** — Eligible robots are seeded by ELO and placed into a [single elimination bracket](/guide/tournaments/tournament-format)
3. **Rounds** — Each round is processed during the daily cycle, one round per cycle
4. **Championship** — The final match determines the champion
5. **New tournament** — A new tournament begins immediately, starting from registration

```callout-info
The continuous cycle means you don't need to "sign up" for tournaments. If your robot meets the eligibility requirements when a new tournament starts, it's automatically included. Stay properly equipped and you'll never miss a tournament.
```

### Tournament Frequency

Because each round takes one cycle and tournaments vary in size, the length of a tournament depends on the number of participants:

| Participants | Rounds | Cycles to Complete |
|-------------|--------|--------------------|
| 128 | 7 | 7 cycles |
| 256 | 8 | 8 cycles |
| 512 | 9 | 9 cycles |
| 1,024 | 10 | 10 cycles |

Larger tournaments take more cycles to complete, but the rewards scale up to match. The pace of competition adapts naturally to the size of the active player base.
Smaller tournaments finish faster, meaning new tournaments start more frequently. The pace of competition adapts naturally to the size of the active player base.

## Preparing for Tournaments

Since tournaments run continuously and eligibility is checked automatically, the best strategy is to keep your robots tournament-ready at all times:

- **Keep loadouts complete** — Always have the right weapons equipped for your chosen loadout type.
- **Monitor your ELO** — Higher ELO means better seeding, which means easier early rounds and potential [byes](/guide/tournaments/bye-matches).
- **Consider your [yield threshold](/guide/combat/yielding-and-repair-costs)** — A lower yield threshold means your robot takes more damage in league battles, increasing repair costs between cycles.

## What's Next?

- [Tournament Format](/guide/tournaments/tournament-format) — How brackets and seeding work
- [Rewards](/guide/tournaments/rewards) — What you earn for tournament performance
- [Bye Matches](/guide/tournaments/bye-matches) — How top seeds get first-round advantages
- [Yielding & Repair Costs](/guide/combat/yielding-and-repair-costs) — Managing damage to stay tournament-eligible

