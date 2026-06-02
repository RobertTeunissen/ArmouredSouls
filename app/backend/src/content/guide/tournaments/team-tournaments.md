---
title: "Team Tournaments (2v2 & 3v3)"
description: "How team tournaments work in Armoured Souls — 2v2 and 3v3 single-elimination brackets with daily round cadence, team eligibility, and championship rewards."
order: 5
lastUpdated: "2026-06-20"
relatedArticles:
  - tournaments/tournament-format
  - tournaments/eligibility
  - tournaments/rewards
  - team-battles/overview
  - facilities/booking-office
---

## Overview

Team tournaments bring bracketed single-elimination competition to 2v2 and 3v3 teams. Your persistent team — the same one you use in team league battles — competes in a tournament bracket where one loss means elimination. Win every round and your team earns a championship title.

Team tournaments use the same bracket format as 1v1 tournaments but with teams as participants instead of individual robots. Combat uses the Team Battle Engine with full Team Coordination Effects (focus fire bonus, ally shield regen, formation defence) — identical to team league battles.

## Tournament Formats

Armoured Souls runs three tournament formats simultaneously:

| Format | Participants | Daily Time | Subscription |
|--------|-------------|------------|--------------|
| **1v1 Tournament** | Individual robots | 10:00 UTC | `tournament_1v1` |
| **2v2 Tournament** | 2-robot teams | 15:00 UTC | `tournament_2v2` |
| **3v3 Tournament** | 3-robot teams | 18:00 UTC | `tournament_3v3` |

Each format runs independently with its own bracket, seeding, and championship titles.

## Bracket Format

Team tournaments use **single-elimination brackets** with power-of-2 sizing:

- Bracket sizes: 4, 8, 16, 32, or 64 teams (maximum 64)
- Non-power-of-2 participant counts receive **bye matches** for top seeds
- Seeding is by combined ELO (sum of all member robot ELOs), highest first
- Equal combined ELO is tie-broken by team creation date (older team seeded higher)

The bracket structure works identically to 1v1 tournaments — top seeds face bottom seeds in early rounds, and the #1 and #2 seeds can only meet in the final.

```callout-info
Your team's combined ELO determines seeding. A 2v2 team with robots at 1200 and 1400 ELO has a combined ELO of 2600. Keep your team members performing well in league play to earn better tournament seeds.
```

## Daily Round Cadence

Team tournaments advance **one round per daily cycle**:

- **2v2 Tournament** rounds execute at **15:00 UTC**
- **3v3 Tournament** rounds execute at **18:00 UTC**

A tournament with 8 teams (3 rounds) takes 3 cycles to complete. A 16-team tournament takes 4 cycles. Once a tournament finishes, a new one is auto-created when enough eligible teams are available.

| Teams | Bracket Size | Rounds | Days to Complete |
|-------|-------------|--------|-----------------|
| 4 | 4 | 2 | 2 cycles |
| 5–8 | 8 | 3 | 3 cycles |
| 9–16 | 16 | 4 | 4 cycles |
| 17–32 | 32 | 5 | 5 cycles |
| 33–64 | 64 | 6 | 6 cycles |

## Eligibility Requirements

For your team to enter a team tournament, **all** of the following must be true:

1. **Team eligibility** — Your team's eligibility status must be `ELIGIBLE` (team is complete, no dissolved members, no destroyed robots)
2. **All members subscribed** — Every robot in the team must hold an active subscription to the corresponding event type (`tournament_2v2` for 2v2, `tournament_3v3` for 3v3) via the [Booking Office](/guide/facilities/booking-office)
3. **All members scheduling-ready** — Every robot must have a complete weapon loadout

If any single member robot lacks the subscription or has an incomplete loadout, the entire team is excluded from the tournament bracket.

```callout-warning
Unlike league battles where only the subscribed robot matters, team tournaments require ALL member robots to be subscribed. Make sure every robot on your team has the tournament subscription active before the next tournament starts.
```

## How to Enter

Team tournament entry is automatic — there's no manual sign-up. Here's how to get your team into a tournament:

1. **Subscribe your robots** — Visit the [Booking Office](/guide/facilities/booking-office) and subscribe each team member to `tournament_2v2` or `tournament_3v3`
2. **Form a team** — Create a persistent team via the Team Management page (same teams used for team league)
3. **Stay eligible** — Keep all members equipped and the team in `ELIGIBLE` status
4. **Wait for auto-creation** — When 4 or more eligible teams exist and no active tournament is running, a new tournament is automatically created

The system checks eligibility at tournament creation time. If your team qualifies, it's seeded into the bracket automatically.

```callout-tip
A minimum of 4 eligible teams is required to start a tournament. If fewer than 4 teams are eligible, no tournament is created that cycle. Build your team early and subscribe — the more eligible teams in the game, the more frequently tournaments run.
```

## Rewards

Team tournament rewards follow the same structure as 1v1 tournaments, multiplied by team size:

### Credits

Each robot on the winning team earns: `₡20,000 × sizeMultiplier × roundProgressMultiplier × teamSize`

In a 2v2 tournament, each robot earns 2× the base formula. In 3v3, each robot earns 3×. Losing teams earn 30% of the winner's reward per robot.

### Prestige (Per Round Won)

Prestige uses a stepped curve — deeper rounds earn more:

| Round | Prestige (winner) | Prestige (loser) |
|-------|-------------------|------------------|
| Round 1 | 20 | 0 |
| Round 2 | 30 | 0 |
| Round 3 | 40 | 0 |
| Round 4 | 50 | 0 |
| Round 5+ | 60 (capped) | 0 |

Winning the final awards an additional **+150 championship prestige bonus**. Losers earn zero prestige — it's exclusively a reward for winning.

### Championship Title

The tournament champion earns a championship title tracked on the team owner's account. Titles are tracked per type (`championshipTitles2v2` and `championshipTitles3v3`) and displayed with distinct visual representations.

### Fame

Fame is awarded to each robot on the winning team based on exclusivity (fewer teams remaining = more fame) and performance (HP remaining after battle).

### ELO

ELO changes use the team battle formula — the same delta is applied to each member robot on both teams based on combined team ELO difference.

```callout-tip
Bye matches award zero rewards. If your team receives a first-round bye due to high seeding, you advance but earn nothing for that round. The real rewards start when you actually fight.
```

## Combat Rules

Team tournament battles use the exact same combat system as team league battles:

- All team members fight simultaneously (not phased like Tag Team)
- **Team Coordination Effects** are active: focus fire bonus, ally shield regen, formation defence
- All robots are restored to full HP and full shield before each tournament match
- Draws are resolved by total remaining HP comparison, then by seed position (higher seed wins)

## What's Next?

- [Tournament Format](/guide/tournaments/tournament-format) — Bracket generation and seeding details
- [Tournament Rewards](/guide/tournaments/rewards) — Full reward formula breakdown
- [Team Battles Overview](/guide/team-battles/overview) — How team combat works
- [Booking Office](/guide/facilities/booking-office) — Managing event subscriptions
