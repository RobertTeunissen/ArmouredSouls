---
title: "Tag Team Battles"
description: "How Tag Team combat works — phased 1v1 battles with tag-in mechanics, Active/Reserve roles, rewards, LP, and how it differs from simultaneous 2v2 League."
order: 2
lastUpdated: "2026-08-02"
relatedArticles:
  - team-battles/overview
  - facilities/booking-office
  - leagues/league-tiers
  - combat/battle-flow
---

## What Is Tag Team?

Tag Team is a **combat mode** for 2v2 teams. Unlike 2v2 League (where both robots fight simultaneously), Tag Team battles are **phased**: one robot per side is Active at a time, while the other waits in Reserve. When the Active robot yields or is destroyed, the Reserve robot tags in and continues the fight.

Your existing 2v2 team IS your tag team — no separate registration needed. To enter tag team matchmaking, subscribe both team members to the `tag_team` event via the [Booking Office](/guide/facilities/booking-office).

```callout-info
The same 2v2 team can participate in both 2v2 League (simultaneous) and Tag Team (phased). They're different combat modes, not different teams. Subscribe to both events if you want to compete in both.
```

## How a Tag Team Battle Plays Out

1. **Round 1** — Both teams' Slot 1 (Active) robots face off in a 1v1 fight
2. **Tag-in trigger** — When the Active robot yields (HP drops below yield threshold) or is destroyed, the Reserve robot tags in
3. **Round 2** — The winning robot continues with its current HP against the fresh Reserve robot
4. **Resolution** — The battle ends when one side has no robots left (both Active and Reserve defeated)

### Slot Roles

Your team's slot order determines the roles:

- **Slot 1** (first member) = **Active** — starts the fight
- **Slot 2** (second member) = **Reserve** — tags in when Active yields or is destroyed

You can swap slot positions on the [Team Battles](/team-battles) page to change which robot leads.

```callout-tip
Position your tankier robot in Slot 1 (Active) to absorb early damage, and a high-damage robot in Slot 2 (Reserve) to finish off a weakened opponent. Or do the opposite — lead with a glass cannon to deal burst damage, then tag in a defensive robot to clean up.
```

## Key Differences from 2v2 League

| Aspect | 2v2 League | Tag Team |
|--------|-----------|----------|
| Combat style | All 4 robots fight simultaneously | 1v1 phased — one active per side |
| Team coordination effects | Active (focus fire, shield regen, formation) | Not active (only 1 robot fighting at a time) |
| HP carries over | N/A (simultaneous) | Yes — winning robot keeps its HP for the next round |
| Relevant attributes | Team attributes (Sync, Support, Formation) | Individual combat attributes |
| Subscription event | `league_2v2` | `tag_team` |

## Matchmaking

Tag Team uses the same LP-primary matchmaking as other leagues:

- Teams are paired within the same **tag team league tier and instance**
- LP difference is the primary scoring factor
- Recent opponents are penalised to force variety
- Same-stable teams cannot be matched against each other
- Byes are issued when an odd number of teams are eligible

Tag Team has its own **separate LP and league tier** (`tagTeamLp`, `tagTeamLeague`) — independent from 2v2 League standings.

## Daily Schedule

| Time (UTC) | What happens |
|------------|-------------|
| 11:00 | All robots repaired → tag team battles executed → leagues rebalanced → next-day matchmaking |

Tag team runs daily. Matches scheduled today execute tomorrow at 11:00 UTC.

## Rewards

Tag Team pays **2× standard league rewards** per robot (same multiplier as 2v2 League):

| Tier | Winner (per robot) | Loser/Draw (per robot) |
|------|-------------------|----------------------|
| Bronze | ₡18,000 | ₡3,600 |
| Silver | ₡36,000 | ₡7,200 |
| Gold | ₡72,000 | ₡14,400 |
| Platinum | ₡144,000 | ₡28,800 |
| Diamond | ₡276,000 | ₡55,200 |
| Champion | ₡540,000 | ₡108,000 |

### LP Changes

- **Win**: +3 LP
- **Draw**: +1 LP
- **Loss**: −1 LP (minimum 0)

### Prestige

Tag Team prestige is **1.6× standard** individual match prestige. Only winners earn prestige.

### Fame & Streaming

Both robots earn fame and streaming revenue based on their individual performance, same as other modes.

### ELO

ELO changes are calculated from the combined team ELO (sum of both members' ELO). The change is applied equally to both robots on the team — even the Reserve robot who may not have fought.

## League System

Tag Team has its own 6-tier league, independent from 2v2 League:

- New teams start in **Bronze**
- Promotion/demotion thresholds are the same as other leagues (top/bottom 10%)
- Requires 5 cycles in a tier before promotion/demotion applies
- Your tag team tier has no effect on your 2v2 League tier and vice versa

## Strategy Tips

- **Yield threshold matters more in Tag Team** — a higher threshold means your Active robot tags out earlier with more HP preserved for the Reserve to benefit from a weakened opponent. A lower threshold means your Active fights longer but the Reserve faces a stronger opponent.
- **Slot order is tactical** — lead with a robot built for endurance (high armor, shield, HP) to soften the opponent, then finish with a damage dealer.
- **Tuning is per-robot** — tune your Active robot for the expected first matchup and your Reserve for a different profile.
- **Tag Team rewards stack with 2v2 League** — subscribe to both events on the same team to earn from both modes daily.

## What's Next?

- [Team Battles Overview](/guide/team-battles/overview) — How simultaneous 2v2/3v3 League battles work
- [Booking Office](/guide/facilities/booking-office) — Manage subscriptions for tag team
- [Battle Flow](/guide/combat/battle-flow) — The combat resolution system used by all modes
- [Tactical Tuning](/guide/strategy/tactical-tuning) — How to tune robots differently for tag team
