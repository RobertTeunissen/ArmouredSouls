/**
 * Training Facility roster-dependent discount — Spec #46 Requirement 11, Season 2 #526
 *
 * Spec #46 R11 made the rate `max(0, 10 − Roster_Capacity)` points per level
 * (a 90% ceiling at L10 with one slot). Season 2 (#526) scales the whole curve
 * by 0.75:
 *
 *   discount% = clamp(level, 0, 10) × max(0, 10 − Roster_Capacity) × 0.75
 *
 * so L6/C1 54% → 40.5%, L10/C1 90% → 67.5%, L10/C4 60% → 45%, C ≥ 10 → 0%.
 * The dead 90% ceiling is gone. Fractional percentages must be exact, and the
 * planner, the server preview, the transaction-time charge and the Automaton
 * planner must all agree to the credit.
 *
 * Every expected value below is computed by hand, not by the function under test.
 *
 * **Validates: Requirements 11.1–11.7; #526**
 */

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../src/lib/creditGuard', () => ({
  lockUserForSpending: jest.fn(),
}));

import * as fc from 'fast-check';
import * as discounts from '../../src/shared/utils/discounts';
import {
  calculateTrainingFacilityDiscount,
  applyTrainingDiscount,
  TRAINING_DISCOUNT_BASE_PER_LEVEL,
  TRAINING_DISCOUNT_PER_SLOT,
  TRAINING_DISCOUNT_FACTOR,
  TRAINING_FACILITY_MAX_LEVEL,
} from '../../src/shared/utils/discounts';
import { getRosterCapacity } from '../../src/shared/utils/rosterCapacity';
import {
  calculateDiscountedUpgradeCost,
  calculateBaseCost,
  calculateTrainingDiscountedUpgradeCost,
} from '../../src/shared/utils/upgradeCosts';
import { attributeIncrementCost } from '../../src/services/automaton/pricing';
import {
  validateAndCalculateUpgrades,
  validateUpgradesFresh,
} from '../../src/services/robot/robotUpgradeService';

/**
 * Hand-computed table: rows are levels 0–10, columns are Roster_Capacity
 * 1 / 4 / 9 / 10 / 11. Per-level rate = (10 − C) × 0.75 = 6.75 / 4.5 / 0.75 / 0 / 0.
 */
const CAPACITIES = [1, 4, 9, 10, 11] as const;
const TABLE: ReadonlyArray<readonly [level: number, c1: number, c4: number, c9: number, c10: number, c11: number]> = [
  [0, 0, 0, 0, 0, 0],
  [1, 6.75, 4.5, 0.75, 0, 0],
  [2, 13.5, 9, 1.5, 0, 0],
  [3, 20.25, 13.5, 2.25, 0, 0],
  [4, 27, 18, 3, 0, 0],
  [5, 33.75, 22.5, 3.75, 0, 0],
  [6, 40.5, 27, 4.5, 0, 0],
  [7, 47.25, 31.5, 5.25, 0, 0],
  [8, 54, 36, 6, 0, 0],
  [9, 60.75, 40.5, 6.75, 0, 0],
  [10, 67.5, 45, 7.5, 0, 0],
];

describe('Season 2 discount table (#526)', () => {
  it.each(TABLE)('level %i at capacity 1/4/9/10/11', (level, ...expected) => {
    CAPACITIES.forEach((capacity, i) => {
      expect(calculateTrainingFacilityDiscount(level, capacity)).toBe(expected[i]);
    });
  });

  it('matches the decision examples', () => {
    expect(calculateTrainingFacilityDiscount(6, 1)).toBe(40.5); // was 54
    expect(calculateTrainingFacilityDiscount(10, 1)).toBe(67.5); // was 90
    expect(calculateTrainingFacilityDiscount(10, 4)).toBe(45); // was 60
    expect(calculateTrainingFacilityDiscount(10, 10)).toBe(0);
  });

  it('is exactly three quarters of the Spec #46 curve at every level and capacity', () => {
    const spec46 = (level: number, capacity: number): number =>
      Math.min(10, Math.max(0, level)) * Math.max(0, 10 - capacity);
    for (let level = 0; level <= 10; level++) {
      for (let capacity = 1; capacity <= 12; capacity++) {
        expect(calculateTrainingFacilityDiscount(level, capacity) * 4).toBe(spec46(level, capacity) * 3);
      }
    }
  });

  it('clamps the level to 0–10: above 10 counts as 10, below 0 as 0', () => {
    expect(calculateTrainingFacilityDiscount(11, 1)).toBe(67.5);
    expect(calculateTrainingFacilityDiscount(50, 1)).toBe(67.5);
    expect(calculateTrainingFacilityDiscount(-3, 1)).toBe(0);
  });

  it('exposes its constants and no longer exports the dead 90% ceiling', () => {
    expect(TRAINING_DISCOUNT_BASE_PER_LEVEL).toBe(10);
    expect(TRAINING_DISCOUNT_PER_SLOT).toBe(1);
    expect(TRAINING_DISCOUNT_FACTOR).toBe(0.75);
    expect(TRAINING_FACILITY_MAX_LEVEL).toBe(10);
    expect(Object.keys(discounts)).not.toContain('TRAINING_DISCOUNT_MAX');
  });

  it('never exceeds 67.5% and never goes negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (level, capacity) => {
          const d = calculateTrainingFacilityDiscount(level, capacity);
          expect(d).toBeGreaterThanOrEqual(0);
          expect(d).toBeLessThanOrEqual(67.5);
          // Always a whole number of quarter percents: exact, no rounding needed.
          expect(Number.isInteger(d * 4)).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('Roster concentration (R11.3)', () => {
  it('discount is non-increasing as roster capacity grows, at every level', () => {
    for (let level = 0; level <= 10; level++) {
      for (let capacity = 1; capacity < 12; capacity++) {
        expect(calculateTrainingFacilityDiscount(level, capacity + 1))
          .toBeLessThanOrEqual(calculateTrainingFacilityDiscount(level, capacity));
      }
    }
  });

  it('level 10 beats level 9 at every roster capacity that earns a discount', () => {
    for (let capacity = 1; capacity <= 9; capacity++) {
      expect(calculateTrainingFacilityDiscount(10, capacity))
        .toBeGreaterThan(calculateTrainingFacilityDiscount(9, capacity));
    }
  });
});

describe('Roster_Capacity derivation (R11.5)', () => {
  it('is purchased capacity: roster_expansion level + 1, with a floor of 1', () => {
    expect(getRosterCapacity(0)).toBe(1);
    expect(getRosterCapacity(3)).toBe(4);
    expect(getRosterCapacity(9)).toBe(10);
  });

  it('a brand-new stable gets the best per-level rate (6.75%)', () => {
    expect(calculateTrainingFacilityDiscount(1, getRosterCapacity(0))).toBe(6.75);
  });

  it('the maximum roster expansion lands the rate on zero, not negative', () => {
    expect(calculateTrainingFacilityDiscount(10, getRosterCapacity(9))).toBe(0);
    expect(calculateTrainingFacilityDiscount(10, getRosterCapacity(10))).toBe(0);
  });
});

describe('Exact per-level rounding (floor once per level)', () => {
  it('fractional rates are applied exactly', () => {
    // base(0) = 1,500 at 6.75%: 1,500 × 93.25 / 100 = 1,398.75 → 1,398
    expect(calculateDiscountedUpgradeCost(0, 1, 1)).toBe(1398);
    // base(1) = 3,000 at 40.5% (L6/C1): 3,000 × 59.5 / 100 = 1,785
    expect(calculateDiscountedUpgradeCost(1, 6, 1)).toBe(1785);
    // base(4) = 7,500 at 22.5% (L5/C4): 7,500 × 77.5 / 100 = 5,812.5 → 5,812
    expect(calculateDiscountedUpgradeCost(4, 5, 4)).toBe(5812);
  });

  it('an exact integer result is not floored down by float drift', () => {
    // base(1) = 3,000 at 67.5%: exactly 975. `floor(3000 × (1 − 0.675))` gives 974.
    expect(applyTrainingDiscount(3000, 67.5)).toBe(975);
    expect(calculateDiscountedUpgradeCost(1, 10, 1)).toBe(975);
    // base(6) = 10,500 at 30% (L5/C2): exactly 7,350; the float form gives 7,349.
    expect(calculateTrainingFacilityDiscount(5, 2)).toBe(30);
    expect(applyTrainingDiscount(10500, 30)).toBe(7350);
    // base(3) = 6,000 at 60.75% (L9/C1): exactly 2,355; the float form gives 2,354.
    expect(calculateDiscountedUpgradeCost(3, 9, 1)).toBe(2355);
  });

  it('equals the integer reference floor(base × (400 − 4d) / 400) for every reachable rate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 1, max: 11 }),
        (attrLevel, facilityLevel, capacity) => {
          const base = BigInt(calculateBaseCost(attrLevel));
          const quarterPoints = BigInt(facilityLevel * Math.max(0, 10 - capacity) * 3); // 4d
          const reference = Number((base * (400n - quarterPoints)) / 400n);
          expect(calculateDiscountedUpgradeCost(attrLevel, facilityLevel, capacity)).toBe(reference);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('charges full price at capacity 10 and never below 32.5% of base', () => {
    expect(calculateDiscountedUpgradeCost(5, 10, 10)).toBe(calculateBaseCost(5));
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 1, max: 11 }),
        (attrLevel, facilityLevel, capacity) => {
          const base = calculateBaseCost(attrLevel);
          const cost = calculateDiscountedUpgradeCost(attrLevel, facilityLevel, capacity);
          expect(cost).toBeLessThanOrEqual(base);
          expect(cost).toBeGreaterThanOrEqual(Math.floor((base * 325) / 1000));
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('Preview / purchase / planner parity', () => {
  const ACADEMIES = {
    combat_training_academy: 10,
    defense_training_academy: 10,
    mobility_training_academy: 10,
    ai_training_academy: 10,
  };

  it('server preview, transaction charge, Automaton planner and frontend per-level preview agree', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 1, max: 11 }),
        (from, steps, trainingLevel, capacity) => {
          const to = Math.min(from + steps, 50);
          if (to <= from) return;
          const robot = { combatPower: from };
          const upgrades = { combatPower: { currentLevel: from, plannedLevel: to } };
          const preview = validateAndCalculateUpgrades(upgrades, robot, trainingLevel, { ...ACADEMIES, combat_training_academy: 10 }, capacity, true);
          const charge = validateUpgradesFresh(upgrades, robot, trainingLevel, ACADEMIES, capacity);
          // The frontend planners sum calculateDiscountedUpgradeCost per level.
          let perLevel = 0;
          for (let level = from; level < to; level++) {
            perLevel += calculateDiscountedUpgradeCost(level, trainingLevel, capacity);
          }
          const automaton = attributeIncrementCost(from, to, trainingLevel, capacity);
          expect(charge.totalCost).toBe(preview.totalCost);
          expect(perLevel).toBe(preview.totalCost);
          expect(automaton).toBe(preview.totalCost);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('a hand-computed L1/C1 purchase: levels 1→3 cost 2,797 + 4,196 = 6,993', () => {
    // base(1) = 3,000 × 93.25% = 2,797.5 → 2,797; base(2) = 4,500 × 93.25% = 4,196.25 → 4,196
    const upgrades = { combatPower: { currentLevel: 1, plannedLevel: 3 } };
    const result = validateUpgradesFresh(upgrades, { combatPower: 1 }, 1, ACADEMIES, 1);
    expect(result.totalCost).toBe(6993);
    expect(calculateTrainingDiscountedUpgradeCost(1, 3, 6.75)).toBe(6993);
  });

  it('a capacity change between preview and purchase reprices at the fresh capacity', () => {
    // Preview at capacity 1 (L10 → 67.5%), purchase after a Roster Expansion to
    // capacity 4 (L10 → 45%): base(1) 3,000 + base(2) 4,500.
    const upgrades = { combatPower: { currentLevel: 1, plannedLevel: 3 } };
    const preview = validateAndCalculateUpgrades(upgrades, { combatPower: 1 }, 10, ACADEMIES, 1);
    const charge = validateUpgradesFresh(upgrades, { combatPower: 1 }, 10, ACADEMIES, 4);
    expect(preview.totalCost).toBe(975 + 1462); // 3,000 × 32.5% = 975; 4,500 × 32.5% = 1,462.5 → 1,462
    expect(charge.totalCost).toBe(1650 + 2475); // 3,000 × 55% = 1,650; 4,500 × 55% = 2,475
  });
});
