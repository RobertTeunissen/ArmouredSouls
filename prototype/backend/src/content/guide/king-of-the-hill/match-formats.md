---
title: "Match Formats"
description: "Free-for-all format with 5-6 robots, fixed and rotating zone variants."
order: 3
lastUpdated: "2026-03-18"
relatedArticles:
  - king-of-the-hill/zone-control-basics
  - king-of-the-hill/entry-requirements
---

## Free-For-All

Every KotH match is a **free-for-all** with 5 or 6 robots. There are no teams — every robot fights for themselves. Robots are distributed into groups using ELO-balanced snake-draft matchmaking.

## Zone Variants

### Fixed Zone (Monday & Friday)
The Control Zone stays at the arena center for the entire match. Default settings: score threshold 30, time limit 150 seconds.

### Rotating Zone (Wednesday)
The zone periodically moves to a new random position. Before moving, a 5-second warning fires. The zone then goes inactive for 3 seconds during transition, then reactivates at its new position.

Rotating zone constraints:
- New position must be at least 6 units from the arena boundary
- New position must be at least 8 units from the previous position
- Default settings: score threshold 45, time limit 210 seconds

The higher thresholds compensate for the scoring interruptions during zone transitions.

## Spawn Positions

Robots spawn at equal angular spacing around the arena at a distance of (arenaRadius - 2) from the center. For 6 robots, that's 60° apart. For 5 robots, 72° apart.
