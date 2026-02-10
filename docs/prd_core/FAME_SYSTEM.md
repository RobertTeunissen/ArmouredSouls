# Fame System Documentation

**Last Updated**: February 4, 2026  
**Status**: ✅ Implemented

## Overview

The Fame system tracks individual robot renown based on their battle performance. Fame is awarded to winning robots and increases based on how impressively they won the battle.

## Fame Calculation

### Base Fame by League

Each league tier awards a different base amount of fame:

| League    | Base Fame |
|-----------|-----------|
| Bronze    | 2         |
| Silver    | 5         |
| Gold      | 10        |
| Platinum  | 15        |
| Diamond   | 25        |
| Champion  | 40        |

### Performance Multipliers

The base fame is multiplied based on victory performance (HP remaining after battle):

| Performance         | Condition            | Multiplier | Description           |
|--------------------|----------------------|------------|----------------------|
| Perfect Victory    | HP = 100%            | 2.0×       | No damage taken      |
| Dominating Victory | HP > 80%             | 1.5×       | Minimal damage taken |
| Comeback Victory   | HP < 20%             | 1.25×      | Won by a thread      |
| Standard Victory   | 20% ≤ HP ≤ 80%       | 1.0×       | Normal win           |

### Example Calculations

**Gold League, Perfect Victory:**
- Base fame: 10
- Multiplier: 2.0× (100% HP remaining)
- **Total: 20 fame**

**Diamond League, Dominating Victory:**
- Base fame: 25
- Multiplier: 1.5× (85% HP remaining)
- **Total: 37 fame** (rounded from 37.5)

**Champion League, Comeback Victory:**
- Base fame: 40
- Multiplier: 1.25× (15% HP remaining)
- **Total: 50 fame**

## Fame Tiers

As robots accumulate fame, they progress through tiers that represent their reputation:

| Tier       | Fame Required | Description                          |
|------------|---------------|--------------------------------------|
| Unknown    | 0-99          | New robot, no reputation             |
| Known      | 100-499       | Starting to be recognized            |
| Famous     | 500-999       | Well-known in their league           |
| Renowned   | 1,000-2,499   | Respected across multiple leagues    |
| Legendary  | 2,500-4,999   | Elite robot with major achievements  |
| Mythical   | 5,000+        | The stuff of legends                 |

## Battle Log Example

When a robot wins and earns fame, the system logs:

```
[Battle] Fame: +20 → RobotName (100% HP remaining, tier: Known)
```

This shows:
- **+20**: Fame points awarded
- **RobotName**: The robot that earned fame
- **100% HP remaining**: Performance metric (affects multiplier)
- **tier: Known**: Current fame tier (100-499 fame)

## When Fame is Awarded

Fame is **only** awarded in these conditions:
- ✅ Victory (robot won the battle)
- ❌ No fame for losses
- ❌ No fame for draws
- ❌ No fame for bye matches

## Future Enhancements

Potential additions to the fame system:
- Fame decay over time (use it or lose it)
- Fame-based matchmaking (match famous robots together)
- Fame bonuses to merchandising income
- Special titles or cosmetics at high fame tiers
- Hall of Fame for most famous robots

## Implementation Details

**Location**: `prototype/backend/src/services/battleOrchestrator.ts`

**Function**: `calculateFameForBattle()`

**Database**: Fame is stored on the `Robot` model in the `fame` field (integer)

**Related Systems**:
- Prestige System (user-level reputation)
- Battle Rewards (credits, prestige)
- League System (determines base fame)
