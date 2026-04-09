---
title: "Anti-Passive Mechanics"
description: "Damage and accuracy penalties for staying outside the zone too long."
order: 5
lastUpdated: "2026-03-18"
relatedArticles:
  - king-of-the-hill/zone-control-basics
  - king-of-the-hill/koth-strategy
---

## Why Anti-Passive Exists

To prevent robots from camping outside the zone indefinitely, KotH applies escalating penalties to robots that stay outside the Control Zone for too long.

## Penalty Timeline

| Time Outside Zone | Effect |
|---|---|
| 0-19 seconds | No penalty |
| 20 seconds | Passive warning event fires |
| 30 seconds | Damage reduction begins: 3% per 5 seconds, capped at 30% |
| 60 seconds | Additional 15% accuracy penalty |

## Penalty Decay

When a penalized robot enters the zone, penalties decay linearly over 3 seconds and the outside-zone timer resets to 0. You don't need to stay in the zone long — just touching it resets the clock.

## Strategic Implications

The 20-second grace period is generous enough for tactical repositioning and ranged combat. But pure camping builds that never enter the zone will become increasingly ineffective as their damage and accuracy drop.
