# Ranged vs Melee Rebalance

**Date**: March 26, 2026  
**Status**: ✅ Implemented  
**Priority**: High - Combat balance

---

## Summary

This balance update addresses melee weapon dominance by:
1. Adding a **Ranged Kiting Bonus** to help ranged robots maintain distance
2. Reducing the **Hydraulic Systems melee damage bonus** from 2.5× to 2.0× max

---

## Problem Statement

Melee builds were too dominant due to asymmetric movement mechanics:

| Mechanic | Melee Robots | Ranged Robots |
|----------|--------------|---------------|
| Closing Bonus | +15% speed (exempt from strain) | None |
| Servo Strain | Exempt when closing | Accumulates when kiting |
| Hydraulic Bonus | Up to +150% damage at melee | None at mid/long range |

Once a melee robot closed distance, ranged robots had no effective way to re-establish their preferred range. The servo strain system (designed to prevent "camping") asymmetrically punished ranged builds trying to kite.

---

## Changes

### 1. Ranged Kiting Bonus (New)

Ranged robots now receive a speed bonus when retreating from melee opponents, mirroring the melee closing bonus but slightly weaker.

**Activation Conditions:**
- Robot has a ranged weapon (not melee, not shield)
- Current distance < weapon's optimal range midpoint
- Opponent has a melee weapon

**Formula:**
```
speedGap = max(0, opponentSpeed - baseSpeed)
kitingBonus = 1.10 + speedGap × 0.008
effectiveSpeed = baseSpeed × stanceModifier × kitingBonus
```

**Comparison to Melee Closing Bonus:**

| Aspect | Melee Closing | Ranged Kiting |
|--------|---------------|---------------|
| Base Bonus | +15% | +10% |
| Per-Speed-Diff | +1.0% | +0.8% |
| Strain Exempt | Yes | Yes |

The kiting bonus is intentionally weaker because:
- Ranged weapons can still deal damage while kiting (at range penalty)
- Melee weapons deal 0 damage until they close

**Example:**
- Long-range robot (Servo Motors 25, base speed 12.0) vs melee robot (speed 15.0)
- Distance: 5 units (inside optimal range of 16 for long-range)
- Speed gap: 15 - 12 = 3
- Kiting bonus: 1.10 + 3 × 0.008 = 1.124
- Effective speed: 12.0 × 1.124 = 13.49 units/second

### 2. Hydraulic Systems Bonus Reduction

The melee-range damage bonus from Hydraulic Systems has been reduced.

**Old Formula:**
```
Melee range: 1 + hydraulicSystems × 0.03
Range: 1.03 (hydro=1) to 2.5 (hydro=50)
```

**New Formula:**
```
Melee range: 1 + hydraulicSystems × 0.02
Range: 1.02 (hydro=1) to 2.0 (hydro=50)
```

**Impact by Hydraulic Systems Level:**

| Hydraulic Systems | Old Bonus | New Bonus | Change |
|-------------------|-----------|-----------|--------|
| 10 | +30% | +20% | -10% |
| 25 | +75% | +50% | -25% |
| 40 | +120% | +80% | -40% |
| 50 | +150% | +100% | -50% |

**Short range bonus unchanged:** 1 + hydraulicSystems × 0.015 (up to 1.75×)

---

## Expected Impact

### Build Diversity
- Long-range builds become viable against melee rushdown
- Positioning becomes a two-way battle (close vs kite)
- Servo Motors matters for both playstyles

### Combat Flow
- Battles have more dynamic range transitions
- Melee robots still have closing advantage (+15% vs +10%)
- Ranged robots can create space but not indefinitely

### Attribute Value
- Hydraulic Systems still valuable but not mandatory for melee
- Servo Motors more important for ranged builds
- Threat Analysis helps predict opponent movement

### Strategic Depth
- Melee: Close fast, deal burst damage before opponent escapes
- Ranged: Kite to maintain optimal range, chip damage over time
- Mixed: Dual-wield builds can adapt to either playstyle

---

## Implementation Details

### Files Modified

| File | Change |
|------|--------|
| `arena/servoStrain.ts` | Added `hasRangedWeapon`, `weaponOptimalRangeMidpoint` to state; added kiting bonus logic |
| `arena/hydraulicBonus.ts` | Reduced `MELEE_COEFFICIENT` from 0.03 to 0.02 |
| `combatSimulator.ts` | Pass new state fields to `calculateEffectiveSpeed` |
| `arena/movementAI.ts` | Export `RANGE_BAND_MIDPOINTS` constant |

### ServoStrainState Interface

```typescript
interface ServoStrainState {
  servoMotors: number;
  servoStrain: number;
  sustainedMovementTime: number;
  isUsingClosingBonus: boolean;  // Now also true for kiting bonus
  stance: 'defensive' | 'offensive' | 'balanced';
  hasMeleeWeapon: boolean;
  hasRangedWeapon: boolean;       // NEW
  weaponOptimalRangeMidpoint: number;  // NEW
  distanceToTarget: number;
  currentSpeedRatio: number;
}
```

### calculateEffectiveSpeed Signature

```typescript
function calculateEffectiveSpeed(
  state: ServoStrainState,
  opponentSpeed: number,
  hasRangedOpponent: boolean,
  hasMeleeOpponent: boolean = false,  // NEW parameter
): { effectiveSpeed: number; isClosingBonus: boolean }
```

---

## Testing

New unit tests added to `servoStrain.test.ts`:
- Kiting bonus activation conditions
- Kiting bonus formula verification
- Strain exemption when kiting
- Comparison to closing bonus (weaker)
- Priority when both bonuses could apply (melee closing wins)

Property tests in `task7modules.property.test.ts` continue to pass:
- Hydraulic melee bonus ≥ short bonus (still true)
- Mid/long bonus = 1.0 (unchanged)

---

## Balance Notes

This change creates a rock-paper-scissors dynamic:

1. **Melee beats Short-Range**: Can close quickly, short-range can't kite effectively
2. **Long-Range beats Melee**: Can kite effectively, melee takes chip damage while closing
3. **Short/Mid-Range is versatile**: Can adapt to either matchup

The asymmetry (15% closing vs 10% kiting) ensures melee robots will eventually close on equal-speed opponents, but it takes longer and costs HP. This rewards:
- Melee builds investing in Servo Motors to close faster
- Ranged builds investing in Servo Motors to kite longer
- Both builds investing in damage to win the attrition race

---

## Version History

- **2026-03-26**: Initial implementation
  - Added ranged kiting bonus (10% base + 0.8% per speed diff)
  - Reduced hydraulic melee coefficient from 0.03 to 0.02
  - Updated combat simulator to pass new state fields
