---
title: "Booking Office"
description: "How the Booking Office facility works — event subscriptions, per-robot caps, switching behaviour, lock rules, and how to manage which battle events your robots participate in."
order: 7
lastUpdated: "2026-06-15"
relatedArticles:
  - facilities/facility-overview
  - facilities/facility-progression
  - leagues/matchmaking
  - tournaments/eligibility
  - team-battles/overview
---

## Overview

The **Booking Office** controls which battle events each of your robots participates in. Instead of every robot being auto-enrolled in every event, you choose per robot — subscribe a duelist to 1v1 League and 1v1 Tournament, subscribe a team player to 2v2 League and 3v3 League, or mix and match however you like.

Every robot gets **3 free subscriptions** at Booking Office Level 0 (no facility purchase required). Each Booking Office level adds one more subscription slot per robot, up to 13 at Level 10.

```callout-tip
You don't need to buy the Booking Office to start playing. Every robot gets 3 subscriptions for free — enough for 1v1 League + 1v1 Tournament + KotH. The facility just lets you add more events per robot as new modes become available. With 8 events now available, upgrading the Booking Office lets your robots participate in more modes simultaneously.
```

## Subscribable Events

These are the 8 battle events you can subscribe your robots to:

| Event | Description | Eligibility |
|-------|-------------|-------------|
| **1v1 League** | Daily automated league matches with LP and ELO | Always eligible |
| **1v1 Tournament** | Multi-cycle bracket competitions with championship titles | Always eligible |
| **Tag Team** | 2v2 tag team battles daily (phased — one active robot per side at a time). Your existing 2v2 team participates when both members are subscribed. | Requires membership in a 2v2 team |
| **King of the Hill** | 5-6 robot free-for-all zone control battles | Always eligible |
| **2v2 League** | Daily 2v2 team battles — both robots fight simultaneously | Requires ≥ 2 robots in your Stable |
| **3v3 League** | Daily 3v3 team battles — all three robots fight simultaneously | Requires ≥ 3 robots in your Stable |
| **2v2 Tournament** | Single-elimination team tournament brackets (2-robot teams) | Requires ≥ 2 robots in your Stable |
| **3v3 Tournament** | Single-elimination team tournament brackets (3-robot teams) | Requires ≥ 3 robots in your Stable |

With 8 events available and a base cap of 3 subscriptions, choosing which events each robot participates in is a meaningful strategic decision. The Booking Office level becomes especially important for players who want to participate in multiple modes — upgrading unlocks more slots so your robots can compete across league, tournament, and special event formats simultaneously.

### Tag Team Mode

Tag Team is a **combat mode** that any 2v2 team can participate in — it's not a separate team type. Your existing 2v2 team IS your tag team. To enter tag team matchmaking, subscribe both team members to the `tag_team` event via the Booking Office.

The slot order on your 2v2 team determines tag team roles:
- **Slot 1** (first member) = Active robot — starts the fight
- **Slot 2** (second member) = Reserve robot — tags in when the active robot yields or is destroyed

Tag team combat is **phased**: one active robot per side fights at a time, rather than both robots fighting simultaneously like in 2v2 League. This means the same 2v2 team can participate in both modes — simultaneous combat in 2v2 League and sequential combat in Tag Team — depending on which events the members are subscribed to.

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

When you create your first robot, you'll pick 3 subscriptions from the available events. The defaults are 1v1 League, 1v1 Tournament, and KotH (team modes like 2v2 League and Tag Team aren't available until you form a 2v2 team).

If you want a 4th subscription right away, you can purchase Booking Office Level 1 during onboarding — but only if you have enough credits and there's a 4th event available to you.

## The Lock Rule

You **cannot unsubscribe** a robot from an event while that robot has a queued battle for that event. This prevents disruption to already-scheduled matchups.

For example:
- Your robot is on a 2v2 team that has a Tag Team battle scheduled for next cycle
- You try to unsubscribe it from Tag Team → **blocked** (error: `EVENT_SUBSCRIPTION_LOCKED`)
- The battle executes next cycle → lock released
- Now you can freely unsubscribe

The lock is **per robot only**. Other robots in your Stable can change their subscriptions freely, even if one robot is locked.

## Robot Specialisation

Per-robot subscriptions let you build specialised robots:

- **The Duelist** — subscribed to 1v1 League + 1v1 Tournament only. Tuned for solo combat.
- **The Team Player** — subscribed to Tag Team + 2v2 League + 3v3 League. Built for multi-robot scenarios where Team Coordination Attributes shine. The same 2v2 team competes in both simultaneous (2v2 League) and phased (Tag Team) combat.
- **The Brawler** — subscribed to KotH + 2v2 League. Thrives in chaotic multi-robot fights.
- **The All-Rounder** — subscribed to everything the cap allows. Versatile but spread thin.

This is entirely optional — you can subscribe every robot to the same events if you prefer.

## What's Next?

- [All Facility Types](/guide/facilities/facility-overview) — Compare the Booking Office with other facility investments
- [Facility Progression](/guide/facilities/facility-progression) — Understand upgrade costs and prestige requirements
- [Matchmaking](/guide/leagues/matchmaking) — How subscription affects which battles your robot gets
- [Tournament Eligibility](/guide/tournaments/eligibility) — How subscription interacts with tournament entry
- [Team Battles](/guide/team-battles/overview) — Learn about 2v2 and 3v3 League modes
