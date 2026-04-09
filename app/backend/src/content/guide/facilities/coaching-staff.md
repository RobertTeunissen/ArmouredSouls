---
title: "Coaching Staff System"
description: "How to hire coaches that provide stable-wide attribute bonuses — coach types, bonus percentages, switching costs, and the one-active-coach limitation."
order: 4
lastUpdated: "2026-03-11"
relatedArticles:
  - facilities/facility-overview
  - facilities/facility-progression
  - facilities/training-academies
  - robots/attributes-overview
  - strategy/build-archetypes
---

## Overview

```callout-warning
The Coaching Staff facility is not yet implemented. The information below describes the planned system design. You can purchase the facility, but coach hiring and bonuses are not yet active.
```

The Coaching Staff facility lets you hire a coach who provides **stable-wide attribute bonuses** to all your robots. A good coach can give your entire roster a meaningful edge in combat — but you can only have **one active coach at a time**, and switching coaches costs Credits.

![Coaching staff system](/images/guide/facilities/coaching-staff-system.png)

## How Coaching Works

Once you purchase the Coaching Staff facility, you can hire coaches from a pool of available specialists. Each coach provides percentage-based bonuses to specific attribute categories. The bonus applies to all robots in your stable simultaneously.

### The One-Active-Coach Rule

You can only have **one coach active** at any time. If you want to switch to a different coach, you must dismiss your current coach first and pay a switching fee. This means you need to commit to a coaching strategy rather than constantly swapping.

```callout-warning
Switching coaches isn't free. The switching cost increases with your Coaching Staff facility level, so frequent changes get expensive. Choose a coach that complements your overall stable strategy and stick with them.
```

## Coach Types

Each coach specializes in a different attribute category, providing bonuses that scale with your Coaching Staff facility level:

| Coach Type | Attribute Category | Bonus Range | Best For |
|-----------|-------------------|-------------|----------|
| **Combat Instructor** | Combat Systems | +3% to +7% | Aggressive builds focused on damage output |
| **Defense Specialist** | Defensive Systems | +3% to +7% | Tank builds and survival-focused strategies |
| **Mobility Expert** | Chassis & Mobility | +3% to +7% | Speed builds and evasion-focused robots |
| **AI Strategist** | AI Processing + Team Coordination | +3% to +7% | Smart builds and team-mode competitors |
| **Generalist Coach** | All categories | +1% to +3% | Balanced stables with mixed build types |

```callout-info
The percentage bonus applies to your robots' current attribute values. A +5% Combat Systems bonus on a robot with 40 Combat Power effectively gives it 42 Combat Power in battle. The bonus doesn't change the displayed attribute level — it's applied during combat calculations.
```

## Coaching Staff Facility Levels

The facility level determines the strength of your active coach's bonus and unlocks access to higher-tier coaches:

| Level | Cost | Prestige Required | Coach Bonus | Coaches Available | Operating Cost/Day |
|-------|------|-------------------|-------------|-------------------|-------------------|
| 1 | ₡250,000 | — | +3% | Combat, Defense, Generalist | ₡3,000 |
| 2 | ₡350,000 | — | +3.5% | + Mobility | ₡3,000 |
| 3 | ₡450,000 | 2,000 | +4% | + AI Strategist | ₡3,000 |
| 4 | ₡600,000 | — | +4.5% | All coaches | ₡3,000 |
| 5 | ₡750,000 | — | +5% | All coaches | ₡3,000 |
| 6 | ₡900,000 | 5,000 | +5.5% | All coaches | ₡3,000 |
| 7 | ₡1,100,000 | — | +6% | All coaches | ₡3,000 |
| 8 | ₡1,300,000 | — | +6.5% | All coaches | ₡3,000 |
| 9 | ₡1,500,000 | 10,000 | +7% | All coaches | ₡3,000 |

```callout-tip
The Coaching Staff has a flat operating cost of ₡3,000/day regardless of level. This makes higher levels increasingly cost-effective — you pay the same daily fee but get a bigger bonus.
```

## Switching Costs

Changing your active coach incurs a one-time switching fee:

| Coaching Staff Level | Switching Cost |
|---------------------|---------------|
| Level 1–3 | ₡50,000 |
| Level 4–6 | ₡100,000 |
| Level 7–9 | ₡150,000 |

The switching cost is paid when you dismiss your current coach and hire a new one. There's no cooldown — you can switch immediately if you have the Credits.

```callout-tip
If you're unsure which coach to pick, start with the Generalist Coach. The +1–3% bonus to all categories is smaller per category but benefits every robot regardless of build. You can switch to a specialist later once your stable's strategy is more defined.
```

## Choosing the Right Coach

Your coach choice should align with your stable's dominant build strategy:

### Single Build Type Stable

If most of your robots follow the same archetype (e.g., all tanks or all glass cannons), pick the specialist coach that matches. A Defense Specialist giving +7% to all defensive attributes across 5 tank robots is a massive cumulative advantage.

### Mixed Build Stable

If your robots use different archetypes, the Generalist Coach provides the most balanced value. The per-category bonus is lower, but it benefits every robot equally.

### Tournament-Focused Stable

For tournament competition, consider which attribute category gives the biggest edge in your league tier. In higher tiers where battles are closer, even a +5% bonus to the right category can be the difference between winning and losing.

## Coach Bonuses in Practice

Here's how a Level 5 Combat Instructor (+5% Combat Systems) affects a robot with mid-range attributes:

| Attribute | Base Level | With Coach (+5%) | Effective Level |
|-----------|-----------|-----------------|----------------|
| Combat Power | 30 | +1.5 | 31.5 |
| Targeting Systems | 25 | +1.25 | 26.25 |
| Critical Systems | 20 | +1.0 | 21.0 |
| Penetration | 28 | +1.4 | 29.4 |
| Weapon Control | 35 | +1.75 | 36.75 |
| Attack Speed | 22 | +1.1 | 23.1 |

The bonuses are applied during combat calculations and don't affect displayed attribute levels or upgrade costs.

## What's Next?

- [Facility Overview](/guide/facilities/facility-overview) — All 15 facility types at a glance
- [Training Academies](/guide/facilities/training-academies) — Raise attribute caps to unlock higher levels
- [Investment Strategy](/guide/facilities/investment-strategy) — When to invest in coaching vs other facilities
- [Build Archetypes](/guide/strategy/build-archetypes) — Match your coach to your build strategy
