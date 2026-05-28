---
title: "Booking Office"
description: "How the Booking Office facility works — event subscriptions, per-robot caps, switching behaviour, lock rules, and how to manage which battle events your robots participate in."
order: 7
lastUpdated: "2026-06-01"
relatedArticles:
  - facilities/facility-overview
  - facilities/facility-progression
  - leagues/matchmaking
  - tournaments/eligibility
---

## Overview

The **Booking Office** controls which battle events each of your robots participates in. Instead of every robot being auto-enrolled in every event, you choose per robot — subscribe a duelist to 1v1 League and Tournament, subscribe a tank to Tag Team and KotH, or mix and match however you like.

Every robot gets **3 free subscriptions** at Booking Office Level 0 (no facility purchase required). Each Booking Office level adds one more subscription slot per robot, up to 13 at Level 10.

```callout-tip
You don't need to buy the Booking Office to start playing. Every robot gets 3 subscriptions for free — enough for League + Tournament + KotH. The facility just lets you add more events per robot as new modes become available.
```

## Subscribable Events

These are the battle events you can subscribe your robots to:

| Event | Description | Eligibility |
|-------|-------------|-------------|
| **1v1 League** | Daily automated league matches with LP and ELO | Always eligible |
| **1v1 Tournament** | Multi-cycle bracket competitions with championship titles | Always eligible |
| **Tag Team** | 2v2 tag team battles on odd cycles | Requires ≥ 2 robots in your Stable |
| **King of the Hill** | 5-6 robot free-for-all zone control battles | Always eligible |

More event types will be added in future updates. When they are, they'll appear automatically in your subscription options.

## Subscription Cap Per Level

| Level | Max Subscriptions Per Robot | Upgrade Cost |
|-------|----------------------------|-------------|
| 0 (free) | 3 | — |
| 1 | 4 | ₡75,000 |
| 2 | 5 | ₡150,000 |
| 3 | 6 | ₡225,000 |
| 4 | 7 | ₡300,000 |
| 5 | 8 | ₡375,000 |
| 6 | 9 | ₡450,000 |
| 7 | 10 | ₡525,000 |
| 8 | 11 | ₡600,000 |
| 9 | 12 | ₡675,000 |
| 10 | 13 (maximum) | ₡750,000 |

The cap applies **per robot** — every robot in your Stable gets the same cap based on your Booking Office level.

## How to Subscribe and Switch

You can manage subscriptions in two places:

1. **Robot Detail Page** — each robot has a subscription section showing its current events and available toggles.
2. **Booking Office Overview** (`/booking-office`) — a matrix view showing all your robots and all events at once, making it easy to manage your entire roster.

### Switching is Free

There's no credit cost to subscribe or unsubscribe. Change your mind as often as you like. Changes take effect at the **next cycle** — the current cycle's matchmaking has already been determined.

### During Onboarding

When you create your first robot, you'll pick 3 subscriptions from the available events. The defaults are League, Tournament, and KotH (Tag Team isn't available until you own a second robot).

If you want a 4th subscription right away, you can purchase Booking Office Level 1 during onboarding — but only if you have enough credits and there's a 4th event available to you.

## The Lock Rule

You **cannot unsubscribe** a robot from an event while that robot has a queued battle for that event. This prevents disruption to already-scheduled matchups.

For example:
- Your robot has a Tag Team match scheduled for next cycle
- You try to unsubscribe it from Tag Team → **blocked** (error: `EVENT_SUBSCRIPTION_LOCKED`)
- The match executes next cycle → lock released
- Now you can freely unsubscribe

The lock is **per robot only**. Other robots in your Stable can change their subscriptions freely, even if one robot is locked.

## Robot Specialisation

Per-robot subscriptions let you build specialised robots:

- **The Duelist** — subscribed to League + Tournament only. Tuned for 1v1 combat.
- **The Team Player** — subscribed to Tag Team + KotH. Built for multi-robot scenarios.
- **The All-Rounder** — subscribed to everything the cap allows. Versatile but spread thin.

This is entirely optional — you can subscribe every robot to the same events if you prefer.

## What's Next?

- [All Facility Types](/guide/facilities/facility-overview) — Compare the Booking Office with other facility investments
- [Facility Progression](/guide/facilities/facility-progression) — Understand upgrade costs and prestige requirements
- [Matchmaking](/guide/leagues/matchmaking) — How subscription affects which battles your robot gets
- [Tournament Eligibility](/guide/tournaments/eligibility) — How subscription interacts with tournament entry
