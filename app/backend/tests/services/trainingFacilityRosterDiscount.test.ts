/**
 * Training Facility roster-dependent discount — Spec #46 Requirement 11
 *
 * The discount was `min(level × 10, 90)`, which saturated at level 9 and made the
 * facility's own maximum level buy nothing. It also ignored roster size, so a
 * ten-robot stable got the same per-level rate as a one-robot stable while having
 * ten times as many attributes to pay for.
 *
 * The rate is now `max(0, 10 - Roster_Capacity)` percentage points per level,
 * clamped to 90%.
 *
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7**
 */

import * as fc from 'fast-check';
import {
  calculateTrainingFacilityDiscount,
  TRAINING_DISCOUNT_BASE_PER_LEVEL,
  TRAINING_DISCOUNT_PER_SLOT,
  TRAINING_DISCOUNT_MAX,
} from '../../src/shared/utils/discounts';
import { getRosterCapacity } from '../../src/shared/utils/rosterCapacity';
import { calculateDiscountedUpgradeCost, calculateBaseCost } from '../../src/shared/utils/upgradeCosts';

describe('The worked examples from the requirement', () => {
  it('L5 with 4 robot slots gives 30%', () => {
    // (10 - 4) = 6 percentage points per level, × 5 levels
    expect(calculateTrainingFacilityDiscount(5, 4)).toBe(30);
  });

  it('L8 with 2 robot slots gives 64%', () => {
    // (10 - 2) = 8 percentage points per level, × 8 levels
    expect(calculateTrainingFacilityDiscount(8, 2)).toBe(64);
  });
});

describe('Level 10 is now worth reaching (R11.2)', () => {
  it('a single-robot stable reaches the 90% maximum only at level 10', () => {
    expect(calculateTrainingFacilityDiscount(10, 1)).toBe(90);
    expect(calculateTrainingFacilityDiscount(9, 1)).toBe(81);
  });

  it('level 10 beats level 9 at every roster capacity that earns a discount', () => {
    for (let capacity = 1; capacity <= 9; capacity++) {
      expect(calculateTrainingFacilityDiscount(10, capacity))
        .toBeGreaterThan(calculateTrainingFacilityDiscount(9, capacity));
    }
  });

  it('under the old formula level 10 was worth exactly nothing over level 9', () => {
    const oldFormula = (level: number) => Math.min(level * 10, 90);
    expect(oldFormula(10)).toBe(oldFormula(9));
  });
});

describe('Roster concentration (R11.3)', () => {
  it('discount is non-increasing as roster capacity grows, at every level', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (level) => {
        for (let capacity = 1; capacity < 12; capacity++) {
          expect(calculateTrainingFacilityDiscount(level, capacity + 1))
            .toBeLessThanOrEqual(calculateTrainingFacilityDiscount(level, capacity));
        }
      }),
      { numRuns: 50 },
    );
  });

  it('a 10-slot roster earns no discount at any level', () => {
    for (let level = 0; level <= 10; level++) {
      expect(calculateTrainingFacilityDiscount(level, 10)).toBe(0);
    }
  });

  it('never returns a negative discount, even beyond the current capacity cap', () => {
    // roster_expansion caps at level 10 → capacity 11 today. If that cap rises, a
    // wider roster must mean "no discount", never a cost penalty.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 1, max: 50 }),
        (level, capacity) => {
          expect(calculateTrainingFacilityDiscount(level, capacity)).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('Bounds (R11.4)', () => {
  it('never exceeds the 90% ceiling', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 20 }),
        (level, capacity) => {
          expect(calculateTrainingFacilityDiscount(level, capacity)).toBeLessThanOrEqual(TRAINING_DISCOUNT_MAX);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('level 0 gives no discount regardless of roster', () => {
    for (let capacity = 1; capacity <= 11; capacity++) {
      expect(calculateTrainingFacilityDiscount(0, capacity)).toBe(0);
    }
  });

  it('exposes its constants so UI copy cannot drift from the formula', () => {
    expect(TRAINING_DISCOUNT_BASE_PER_LEVEL).toBe(10);
    expect(TRAINING_DISCOUNT_PER_SLOT).toBe(1);
    expect(TRAINING_DISCOUNT_MAX).toBe(90);
  });
});

describe('Roster_Capacity derivation (R11.5)', () => {
  it('is roster_expansion level + 1, with a floor of 1', () => {
    expect(getRosterCapacity(0)).toBe(1);
    expect(getRosterCapacity(3)).toBe(4);
    expect(getRosterCapacity(9)).toBe(10);
  });

  it('a brand-new stable gets the best per-level rate', () => {
    // Capacity 1 → 9 percentage points per level.
    expect(calculateTrainingFacilityDiscount(1, getRosterCapacity(0))).toBe(9);
  });

  it('the maximum roster expansion lands the rate exactly on zero, not negative', () => {
    expect(calculateTrainingFacilityDiscount(10, getRosterCapacity(9))).toBe(0);
  });
});

describe('Upgrade cost integration (R11.6)', () => {
  it('applies the discount to the base cost', () => {
    // L5 facility, 4 slots → 30% off.
    const base = calculateBaseCost(5);
    expect(calculateDiscountedUpgradeCost(5, 5, 4)).toBe(Math.floor(base * 0.70));
  });

  it('a concentrated stable pays less than a wide one for the same upgrade', () => {
    const narrow = calculateDiscountedUpgradeCost(5, 8, 2);
    const wide = calculateDiscountedUpgradeCost(5, 8, 8);
    expect(narrow).toBeLessThan(wide);
  });

  it('charges full price when the roster is at capacity 10', () => {
    expect(calculateDiscountedUpgradeCost(5, 10, 10)).toBe(calculateBaseCost(5));
  });

  it('never returns a cost above base or below 10% of base', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (attrLevel, facilityLevel, capacity) => {
          const base = calculateBaseCost(attrLevel);
          const cost = calculateDiscountedUpgradeCost(attrLevel, facilityLevel, capacity);
          expect(cost).toBeLessThanOrEqual(base);
          expect(cost).toBeGreaterThanOrEqual(Math.floor(base * 0.10));
        },
      ),
      { numRuns: 300 },
    );
  });
});
