# Tuning Bay System

**Project**: Armoured Souls
**Document Type**: Game System Specification
**Version**: v1.0
**Last Updated**: April 16, 2026
**Status**: ✅ Implemented (Spec #25)

## Overview

The Tuning Bay system gives players a pool of bonus attribute points that can be freely allocated across a robot's 23 attributes before each battle. Unlike permanent attribute upgrades, tuning points can be reallocated at any time — letting players adapt their builds to counter specific opponents or experiment with different strategies without permanent cost.

Every player starts with a **free base pool of 10 tuning points** (no facility required). Investing in the Tuning Bay facility increases this pool up to 110 points at Level 10. Allocations persist until the player changes them — there is no decay or forced reset between battles.

**Key design goals:**
- Enrich the core loop's "Adjust" step with meaningful per-battle decisions
- Reward players who study opponents and adapt their builds
- Create a new facility investment path and credit sink for endgame players
- Layer on top of existing systems without invalidating permanent attribute investments

## Tuning Bay Facility Configuration

The Tuning Bay is facility type `tuning_bay` in `config/facilities.ts`. It follows the standard facility patterns for costs, prestige gates, and operating costs.

### Upgrade Costs

Follows the standard `L1 × n` cost pattern with a base price of ₡200,000.

| Level | Upgrade Cost | Cumulative | Pool Size |
|-------|-------------|------------|-----------|
| 0 (free) | — | — | 10 |
| 1 | ₡200,000 | ₡200,000 | 20 |
| 2 | ₡400,000 | ₡600,000 | 30 |
| 3 | ₡600,000 | ₡1,200,000 | 40 |
| 4 | ₡800,000 | ₡2,000,000 | 50 |
| 5 | ₡1,000,000 | ₡3,000,000 | 60 |
| 6 | ₡1,200,000 | ₡4,200,000 | 70 |
| 7 | ₡1,400,000 | ₡5,600,000 | 80 |
| 8 | ₡1,600,000 | ₡7,200,000 | 90 |
| 9 | ₡1,800,000 | ₡9,000,000 | 100 |
| 10 | ₡2,000,000 | ₡11,000,000 | 110 |

**Total investment to max**: ₡11,000,000.

### Operating Costs

**Formula**: `level × 300`

| Level | Daily Operating Cost |
|-------|---------------------|
| 1 | ₡300 |
| 2 | ₡600 |
| 3 | ₡900 |
| 4 | ₡1,200 |
| 5 | ₡1,500 |
| 6 | ₡1,800 |
| 7 | ₡2,100 |
| 8 | ₡2,400 |
| 9 | ₡2,700 |
| 10 | ₡3,000 |

### Prestige Requirements

| Level | Prestige Required |
|-------|------------------|
| 1–2 | 0 |
| 3 | 1,000 |
| 4 | 0 |
| 5 | 3,000 |
| 6 | 0 |
| 7 | 5,000 |
| 8 | 0 |
| 9 | 10,000 |
| 10 | 15,000 |

## Pool Size Formula

```
poolSize = (facilityLevel + 1) × 10
```

Every player gets a base pool of 10 points at level 0 (no facility). Each Tuning Bay level adds 10 more points.

| Level | Pool Size | Context |
|-------|-----------|---------|
| 0 (free) | 10 | Enough to meaningfully boost 2–3 attributes |
| 1 | 20 | Double the free pool |
| 5 | 60 | Mid-game sweet spot |
| 10 | 110 | Maximum — 110 bonus points per robot |

## Allocation Rules

### Budget Constraint

The sum of all tuning point allocations for a robot must not exceed the pool size. Allocations are decimal values with up to 2 decimal places (e.g., 3.50 points).

### Per-Attribute Maximum

Each attribute has an individual tuning cap based on the robot's academy cap and current base value:

```
perAttributeMax = max(0, academyCap + 5 - baseValue)
```

The "+5" is the **overclock window** — the engineering team can push 5 points beyond the academy-rated specs. This means:

- If your attribute is at academy cap, you can tune +5 max
- If your attribute is below cap, you can tune more (up to cap + 5 - base)
- Higher academy investment = more room for tuning in key stats
- Forces spreading at high pool sizes — you can't dump all points into one stat

**Examples:**
- Academy cap 15, attribute at 15 → max tuning = 5
- Academy cap 15, attribute at 10 → max tuning = 10
- Academy cap 50, attribute at 50 → max tuning = 5
- No academy (base cap 10), attribute at 5 → max tuning = 10

### Persistence

Tuning allocations persist until the player changes them. There is no decay, no per-battle reset, and no cost to reallocate. Players who set it once and leave it still benefit; players who reallocate before tough matchups get a tactical edge.

## Combat Integration

Tuning bonuses are integrated into the effective stat formula as a third additive term:

```
effectiveStat = (base + weaponBonus + tuningBonus) × loadoutMultiplier
```

- `base` — the robot's permanent attribute level
- `weaponBonus` — bonus from equipped weapon(s)
- `tuningBonus` — the robot's current tuning allocation for that attribute (0 if none)
- `loadoutMultiplier` — combined multiplier from loadout type, stance, and coaching bonuses

The tuning-boosted effective base (base + tuning) is capped at `academyCap + 5` per attribute before weapon bonuses and loadout multipliers are applied.

When tuning bonuses affect `hullIntegrity` or `shieldCapacity`, `maxHP` and `maxShield` are recalculated using the tuning-boosted effective stats.

## Launch Behaviour

- **Existing player robots** with no tuning allocation fight with zero tuning bonuses — identical to pre-launch behaviour. No data migration needed.
- **System bots** (WimpBot, AverageBot, ExpertBot) never receive tuning allocations and fight with zero tuning bonuses.
- **Robots with no allocation** (or all zeros) fight at exactly their current power level — no penalty for not engaging with the system.

## Interaction with Other Systems

### Practice Arena

When loading an owned robot for a practice battle, tuning bonuses are included in effective stats. What-if attribute overrides replace the robot's base attributes; tuning bonuses apply on top of the overridden base values. The WhatIfPanel displays the robot's current tuning allocation as a read-only summary.

### Tag Team Battles

Both the active and reserve robots have their own independent tuning allocations applied in combat. Each robot's tuning pool is separate — allocating points for one robot does not affect another.

### King of the Hill

Each robot enters KotH with its own tuning allocation. Since KotH opponents are not known in advance (5–6 robot free-for-all), players must choose between focused tuning for a specific counter-strategy or a balanced spread that works against multiple opponents.

### Facility Downgrade

If a player's Tuning Bay level decreases (e.g., future reset mechanic) and current allocations exceed the new pool size, the system proportionally scales down all allocations to fit the new budget on the next read.

### Onboarding

During onboarding, after a robot is created and a weapon is equipped, the system auto-allocates 10 tuning points proportionally into the same attributes the equipped weapon boosts. The Tuning Bay facility is not offered during onboarding.

## Data Model

Tuning allocations are stored in a dedicated `tuning_allocations` table with one row per robot. The table has 23 Decimal(5,2) columns (one per attribute, defaulting to 0.00), a unique foreign key to the Robot table with cascade delete, and an index on `robotId`.

Only player-owned robots that have been tuned get rows — bots and untuned robots have no row (treated as all zeros).

## Code Organization

- **Config**: `app/backend/src/services/tuning-pool/tuningPoolConfig.ts` — pure functions for `getPoolSize()` and `getPerAttributeMax()`
- **Service**: `app/backend/src/services/tuning-pool/tuningPoolService.ts` — allocation CRUD, validation, combat bonus retrieval
- **Route**: `app/backend/src/routes/tuningAllocation.ts` — GET/PUT endpoints with Zod validation
- **Frontend**: `app/frontend/src/components/TuningPoolEditor.tsx` — Tuning tab UI with sliders and budget bar
- **Combat**: `app/backend/src/utils/robotCalculations.ts` — `calculateEffectiveStats()` accepts optional `tuningBonuses` parameter
