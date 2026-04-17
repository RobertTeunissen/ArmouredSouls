---
title: "Tuning Bay"
description: "How the Tuning Bay facility works — pool size per level, operating costs, prestige requirements, and how tuning points boost your robot's attributes in combat."
order: 6
lastUpdated: "2026-04-16"
relatedArticles:
  - strategy/tactical-tuning
  - facilities/facility-overview
  - facilities/facility-progression
  - robots/attributes-overview
  - combat/battle-flow
---

## Overview

The **Tuning Bay** lets you fine-tune your robots for specific matchups by allocating bonus attribute points from a shared tuning pool. Unlike permanent attribute upgrades, tuning points can be reallocated freely at any time — before every battle if you want.

Every player starts with a **free base pool of 10 tuning points** per robot, no facility required. Investing in the Tuning Bay facility increases this pool up to 110 points at Level 10.

```callout-tip
You don't need to build the Tuning Bay to start tuning. Every player gets 10 free points per robot — enough to give a meaningful boost to 2–3 key attributes. The facility just makes the pool bigger.
```

## Pool Size Per Level

Each Tuning Bay level adds 10 more points to every robot's tuning pool.

| Level | Pool Size | Upgrade Cost | Operating Cost | Prestige Required |
|-------|-----------|-------------|----------------|-------------------|
| 0 (free) | 10 | — | — | — |
| 1 | 20 | ₡200,000 | ₡300/day | — |
| 2 | 30 | ₡400,000 | ₡600/day | — |
| 3 | 40 | ₡600,000 | ₡900/day | 1,000 |
| 4 | 50 | ₡800,000 | ₡1,200/day | — |
| 5 | 60 | ₡1,000,000 | ₡1,500/day | 3,000 |
| 6 | 70 | ₡1,200,000 | ₡1,800/day | — |
| 7 | 80 | ₡1,400,000 | ₡2,100/day | 5,000 |
| 8 | 90 | ₡1,600,000 | ₡2,400/day | — |
| 9 | 100 | ₡1,800,000 | ₡2,700/day | 10,000 |
| 10 | 110 | ₡2,000,000 | ₡3,000/day | 15,000 |

**Total investment to max**: ₡11,000,000.

## How Tuning Points Work

Tuning points are bonus attribute points that stack on top of your robot's base attributes and weapon bonuses. They're applied in combat using the formula:

```
effective stat = (base + weapon bonus + tuning bonus) × loadout multiplier
```

### Per-Attribute Cap

You can't dump all your points into one attribute. Each attribute has a tuning cap based on your academy level:

```
max tuning = academy cap + 5 − base attribute level
```

The "+5" is the overclock window — your engineering team can push 5 points beyond academy-rated specs. If your attribute is already at the academy cap, you can still tune +5. If it's below cap, you have more room.

### Persistence

Tuning allocations stick until you change them. No decay, no reset between battles, no cost to reallocate. Set it once and forget it, or tweak before every matchup — your choice.

## What's Next?

- [Tactical Tuning Strategy](/guide/strategy/tactical-tuning) — How to allocate tuning points effectively
- [All Facility Types](/guide/facilities/facility-overview) — Compare the Tuning Bay with other facility investments
- [Robot Attributes](/guide/robots/attributes-overview) — Understand the 23 attributes you can tune
- [Battle Flow](/guide/combat/battle-flow) — See how tuning bonuses factor into combat
