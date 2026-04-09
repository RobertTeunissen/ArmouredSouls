---
title: "Zone Control Basics"
description: "How the Control Zone works — occupation, contested vs uncontested states, and zone scoring mechanics."
order: 1
lastUpdated: "2026-03-18"
relatedArticles:
  - king-of-the-hill/scoring-and-win-conditions
  - king-of-the-hill/match-formats
  - combat/battle-flow
---

## The Control Zone

King of the Hill battles take place in the standard 2D circular arena with one key addition: a **Control Zone** at the center. This circular zone is the focal point of every KotH match.

The zone has a default radius of 5 units (configurable between 3-8) and starts at the arena center. Robots score points by occupying the zone — but only when they're the sole occupant.

## Zone Occupation

A robot is considered **inside the zone** when its Euclidean distance from the zone center is less than or equal to the zone radius. The system checks occupation every simulation tick.

### Zone States

- **Uncontested** — Exactly one robot inside the zone. That robot scores points at 1 point per second.
- **Contested** — Two or more robots inside the zone. Nobody scores. The zone pulses red in the battle viewer.
- **Empty** — No robots inside the zone. Nobody scores.

## Entering and Exiting

When a robot crosses the zone boundary, a `zone_enter` or `zone_exit` event fires. These transitions are tracked for analytics and displayed in the battle playback viewer with visual indicators.

Entering the zone also resets any anti-passive penalties that may have accumulated from staying outside too long.
