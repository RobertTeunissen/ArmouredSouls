---
title: "Team Battles Overview"
description: "How 2v2 and 3v3 League Team Battles work — team registration, simultaneous combat, coordination effects, matchmaking, rewards, and daily schedule."
order: 1
lastUpdated: "2026-06-15"
relatedArticles:
  - facilities/booking-office
  - leagues/matchmaking
  - leagues/league-tiers
  - combat/battle-flow
---

## What Are Team Battles?

Team Battles are league modes where teams of robots fight simultaneously in the arena. Unlike Tag Team (where one robot is active and the other waits in reserve), **all robots on both sides are active at the same time**. Two sizes are available:

- **2v2 League** — Two robots per side (4 robots in the arena)
- **3v3 League** — Three robots per side (6 robots in the arena)

Each size has its own league standings, matchmaking, and rewards. Both run daily.

```callout-tip
Team Battles are separate from Tag Team. In Tag Team, robots take turns — one fights while the other waits. In Team Battles, everyone fights at once. Your robots coordinate, focus fire, and protect each other in real time.
```

## How It Works

1. **Subscribe** your robots to `2v2 League` or `3v3 League` via the [Booking Office](/guide/facilities/booking-office)
2. **Register a Team** from your subscribed robots on the [Team Battles](/team-battles) page
3. **Matchmaking** pairs your team against an opponent in the same league tier (daily)
4. **Battle** — all robots fight simultaneously with coordination effects active
5. **Rewards** — credits, fame, prestige, and LP/ELO updates based on outcome

## Daily Schedule

| Time (UTC) | Event |
|------------|-------|
| 09:00 | 2v2 League — battles execute, leagues rebalance, next-day matchmaking runs |
| 14:00 | 3v3 League — battles execute, leagues rebalance, next-day matchmaking runs |

Both modes run every day. You don't need to be online — make your team decisions beforehand and the system handles the rest.

## Team Registration

Teams are persistent — once registered, your team keeps its name, LP, league tier, and history across battles. Think of it like an F1 team: the team identity persists even if you swap out a driver.

You can form a team **immediately after subscribing** your robots — there's no need to wait for the next matchmaker cycle. As soon as a robot has a pending or active subscription to the relevant league, it's eligible for team registration.

### Rules

- A **2v2 team** requires exactly 2 robots
- A **3v3 team** requires exactly 3 robots
- All robots must be owned by your Stable (no cross-stable teams)
- All robots must hold the corresponding subscription (`2v2 League` or `3v3 League`)
- A robot can be on **one team per size** (but can be on both a 2v2 team and a 3v3 team simultaneously)
- You can own **multiple teams** of the same size if you have enough subscribed robots (e.g. 4 robots → 2 teams of 2)
- Team names must be 3–32 characters

### Managing Your Team

From the [Team Battles](/team-battles) page you can:

- **Swap a member** — Replace one robot with another subscribed robot (blocked while a battle is scheduled)
- **Rename** — Change your team's name at any time
- **Disband** — Delete the team entirely (blocked while a battle is scheduled)

```callout-warning
You cannot swap members or disband a team while it has a scheduled battle. Wait for the battle to complete, then make changes before the next matchmaking window.
```

### Incomplete Rosters

If a team member loses their subscription or is destroyed, the team becomes **ineligible** for matchmaking until the roster is filled again. The team's LP, tier, and history are preserved — just fill the empty slot to resume competing.

### Eligibility Warnings

If your team can't fight, you'll see a warning on both the **Dashboard** and the **Team Management** page explaining why. The system provides a specific reason for each ineligible team (e.g. a member lost their subscription, a robot was destroyed, or the roster is incomplete) so you know exactly what to fix.

## Team Coordination Effects

Three robot attributes — previously minor in 1v1 — become powerful in Team Battles:

### Sync Protocols → Focus Fire Bonus

When two or more of your robots target the same enemy in the same tick, they deal bonus damage. Higher `syncProtocols` across your team means a bigger bonus.

| Avg Sync Protocols | 2v2 Bonus (2/2 focus) | 3v3 Bonus (3/3 focus) |
|--------------------|----------------------|----------------------|
| 5 | +7.9% damage | +7.9% damage |
| 15 | +13.7% damage | +13.7% damage |
| 25 | +17.7% damage | +17.7% damage |
| 50 (max) | +25.0% damage | +25.0% damage |

### Support Systems → Ally Shield Regeneration

Each robot passively regenerates shields on all allies. Higher `supportSystems` means faster shield recovery for your teammates.

| Support Systems | Shield Regen Per Ally |
|-----------------|---------------------|
| 5 | 0.25/sec |
| 15 | 0.44/sec |
| 25 | 0.57/sec |
| 50 (max) | 0.80/sec |

### Formation Tactics → Formation Damage Reduction

When allies are within 8 grid units of each other, they reduce incoming damage. Higher `formationTactics` on nearby allies means better protection.

| Avg Formation Tactics | 2v2 Reduction (1 ally nearby) | 3v3 Reduction (2 allies nearby) |
|----------------------|------------------------------|--------------------------------|
| 5 | 6.3% | 6.3% |
| 15 | 11.0% | 11.0% |
| 25 | 14.1% | 14.1% |
| 50 (max) | 20.0% | 20.0% |

```callout-tip
These effects scale with √(attribute/50), giving diminishing returns. You don't need to max them out — even moderate investment (15–25) provides meaningful team bonuses. The 1v1 self-bonuses from these attributes remain unchanged.
```

## Matchmaking

Team Battle matchmaking uses the same LP-primary system as other leagues:

- Teams are paired within the same **league tier and instance**
- **LP difference** is the primary factor (closer LP = better match)
- **ELO** is a secondary factor (no hard reject, just preference)
- **Recent opponents** are penalised to force variety (won't face the same team repeatedly)
- **Same-stable teams** are heavily penalised (effectively blocked unless no other option)
- If an odd number of teams are eligible, the last team receives a **bye** (automatic win with reduced rewards)

Team ELO is calculated as the sum of all member robots' individual ELOs. This means upgrading your robots' ELO through 1v1 battles also strengthens your team's matchmaking position.

## League System

Each team size has its own independent league with six tiers:

| Tier | Description |
|------|-------------|
| Bronze | Starting tier for new teams |
| Silver | First promotion target |
| Gold | Mid-tier competitive play |
| Platinum | High-level competition |
| Diamond | Elite tier |
| Champion | Top performers only |

- New teams start in **Bronze** with standard starting LP
- **Top 10%** of each tier promote at rebalancing
- **Bottom 10%** of each tier demote at rebalancing
- Rebalancing requires at least 5 cycles in the current tier
- Team LP and league tier are **independent** from your robots' individual 1v1 LP

## Rewards

Team Battles pay more per robot than 1v1 — the multiplier matches the team size:

| Tier | 2v2 Winner (per robot) | 3v3 Winner (per robot) | Loser/Draw (per robot) |
|------|------------------------|------------------------|------------------------|
| Bronze | ₡18,000 | ₡27,000 | 20% of winner |
| Silver | ₡36,000 | ₡54,000 | 20% of winner |
| Gold | ₡72,000 | ₡108,000 | 20% of winner |
| Platinum | ₡144,000 | ₡216,000 | 20% of winner |
| Diamond | ₡276,000 | ₡414,000 | 20% of winner |
| Champion | ₡540,000 | ₡810,000 | 20% of winner |

Additionally, each robot earns:
- **Fame** — Full fame for the tier (no splitting)
- **Prestige** — Full prestige for wins (no splitting)
- **Streaming revenue** — Per-robot streaming income
- **ELO** — Same delta applied equally to all team members

```callout-info
Team Battle rewards don't affect your robots' individual 1v1 LP or Tag Team LP. The only shared element is ELO — team battle ELO changes update each robot's individual ELO, which also affects their 1v1 matchmaking position.
```

## Eligibility Checklist

For a team to be matched, **all** of the following must be true:

- ✅ Team has exactly N members (2 for 2v2, 3 for 3v3)
- ✅ All members hold the corresponding subscription (`2v2 League` or `3v3 League`)
- ✅ All members are battle-ready (HP > 0, not destroyed)
- ✅ Team is not already scheduled for a battle
- ✅ Team eligibility status is `ELIGIBLE`

If any condition fails, the team is skipped for that cycle's matchmaking.

## Subscription Requirements

Team Battles require a [Booking Office](/guide/facilities/booking-office) subscription:

- `2v2 League` — requires at least 2 robots in your Stable
- `3v3 League` — requires at least 3 robots in your Stable

Each subscription uses one of your robot's subscription slots. At Booking Office Level 0 (free), each robot has 3 slots. With 6 total events available, you'll need to choose which events each robot participates in — or upgrade your Booking Office for more slots.

## Achievements

Team Battles unlock four new achievements:

| Achievement | Requirement | Difficulty |
|-------------|-------------|-----------|
| **"Daft Punk"** | Win your first 2v2 League battle | 🟢 Easy |
| **"Twins!"** | Win 25 2v2 League battles | 🟠 Hard |
| **"Three Laws Safe"** | Win your first 3v3 League battle | 🟢 Easy |
| **"Voltron"** | Win 25 3v3 League battles | 🟠 Hard |

Team Battle wins also count toward **"Autobots, Roll Out!"** (win in all battle modes).

## What's Next?

- [Booking Office](/guide/facilities/booking-office) — Manage subscriptions and understand the cap system
- [Matchmaking](/guide/leagues/matchmaking) — How LP-primary matchmaking works across all leagues
- [League Tiers](/guide/leagues/league-tiers) — Promotion, demotion, and tier structure
- [Battle Flow](/guide/combat/battle-flow) — How combat resolution works (Team Battles use the same engine)
