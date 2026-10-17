/**
 * Unit tests for shared game formula modules
 * Tests academyCaps.ts, upgradeCosts.ts
 */

import { getCapForLevel, ACADEMY_CAP_MAP } from '../../shared/utils/academyCaps';
import {
  calculateBaseCost,
  calculateDiscountedUpgradeCost,
  calculateTrainingDiscountedUpgradeCost,
  calculateUpgradeCostRange,
} from '../../shared/utils/upgradeCosts';

describe('academyCaps', () => {
  describe('getCapForLevel', () => {
    it('should return correct caps for all levels 0–10', () => {
      const expected: Record<number, number> = {
        0: 10, 1: 15, 2: 20, 3: 25, 4: 30,
        5: 35, 6: 40, 7: 42, 8: 45, 9: 48, 10: 50,
      };
      for (const [level, cap] of Object.entries(expected)) {
        expect(getCapForLevel(Number(level))).toBe(cap);
      }
    });

    it('should return 10 for out-of-range levels', () => {
      expect(getCapForLevel(-1)).toBe(10);
      expect(getCapForLevel(11)).toBe(10);
      expect(getCapForLevel(100)).toBe(10);
    });

    it('should return 10 for non-integer levels not in the map', () => {
      expect(getCapForLevel(0.5)).toBe(10);
      expect(getCapForLevel(1.5)).toBe(10);
    });

    it('should have ACADEMY_CAP_MAP with exactly 11 entries (0–10)', () => {
      expect(Object.keys(ACADEMY_CAP_MAP)).toHaveLength(11);
    });
  });
});

describe('upgradeCosts', () => {
  describe('calculateBaseCost', () => {
    it('should return (floor(level) + 1) * 1500', () => {
      expect(calculateBaseCost(0)).toBe(1500);    // (0+1)*1500
      expect(calculateBaseCost(1)).toBe(3000);    // (1+1)*1500
      expect(calculateBaseCost(10)).toBe(16500);  // (10+1)*1500
      expect(calculateBaseCost(49)).toBe(75000);  // (49+1)*1500
    });

    it('should floor fractional levels', () => {
      expect(calculateBaseCost(0.5)).toBe(1500);  // floor(0.5)=0, (0+1)*1500
      expect(calculateBaseCost(9.9)).toBe(15000); // floor(9.9)=9, (9+1)*1500
    });
  });

  describe('calculateDiscountedUpgradeCost', () => {
    // Spec #46 R11 / Season 2 #526: the third argument is Roster_Capacity. The
    // discount is 0.75 × (10 − capacity) points per facility level, so these
    // cases pin a single-robot stable (capacity 1, the best rate: 6.75% per level).
    // Each level is floor(base × (100 − d) / 100), exact for quarter-percent d.
    it('should return base cost when training level is 0', () => {
      expect(calculateDiscountedUpgradeCost(0, 0, 1)).toBe(1500);
      expect(calculateDiscountedUpgradeCost(9, 0, 1)).toBe(15000);
    });

    it('should apply 6.75% per level for a single-robot stable', () => {
      // 1500 × 93.25% = 1398.75 → 1398
      expect(calculateDiscountedUpgradeCost(0, 1, 1)).toBe(1398);
      // 1500 × 66.25% (33.75% off) = 993.75 → 993
      expect(calculateDiscountedUpgradeCost(0, 5, 1)).toBe(993);
    });

    it('should reach the 67.5% maximum at training level 10 with one robot', () => {
      // 1500 × 32.5% = 487.5 → 487
      expect(calculateDiscountedUpgradeCost(0, 10, 1)).toBe(487);
      // Level 9: 60.75% off → 1500 × 39.25% = 588.75 → 588
      expect(calculateDiscountedUpgradeCost(0, 9, 1)).toBe(588);
    });

    it('should charge full price when the roster fills 10 slots', () => {
      expect(calculateDiscountedUpgradeCost(0, 10, 10)).toBe(1500);
    });

    it('should floor the result', () => {
      // Level 1 base cost = 3000, 22.5% discount (L5, capacity 4) = 2325 (exact)
      expect(calculateDiscountedUpgradeCost(1, 5, 4)).toBe(2325);
      // 3000 × 93.25% = 2797.5 → 2797
      expect(calculateDiscountedUpgradeCost(1, 1, 1)).toBe(2797);
    });
  });

  describe('calculateUpgradeCostRange', () => {
    it('should return 0 for same from and to level', () => {
      expect(calculateUpgradeCostRange(5, 5)).toBe(0);
    });

    it('should return base cost for single level upgrade', () => {
      expect(calculateUpgradeCostRange(0, 1)).toBe(1500);
      expect(calculateUpgradeCostRange(9, 10)).toBe(15000);
    });

    it('should sum base costs for multi-level range', () => {
      // 0→3: (1*1500) + (2*1500) + (3*1500) = 1500 + 3000 + 4500 = 9000
      expect(calculateUpgradeCostRange(0, 3)).toBe(9000);
    });

    it('should handle large ranges', () => {
      // 0→10: sum of (i+1)*1500 for i=0..9 = 1500*(1+2+...+10) = 1500*55 = 82500
      expect(calculateUpgradeCostRange(0, 10)).toBe(82500);
    });
  });

  // Spec #55 task 2.6: the charge formula of robotUpgradeService, shared with Automaton pricing.
  describe('calculateTrainingDiscountedUpgradeCost', () => {
    it('equals the undiscounted range at 0% discount', () => {
      expect(calculateTrainingDiscountedUpgradeCost(0, 10, 0)).toBe(calculateUpgradeCostRange(0, 10));
      expect(calculateTrainingDiscountedUpgradeCost(4, 4, 30)).toBe(0);
    });

    it('floors each level before summing', () => {
      // 6.75% off: level 0 → 1398.75 → 1398 and level 1 → 2797.5 → 2797
      expect(calculateTrainingDiscountedUpgradeCost(0, 2, 6.75)).toBe(1398 + 2797);
    });

    it('equals the exact integer floor for every quarter-percent rate (#526)', () => {
      // floor(base × (400 − 4d) / 400). The pre-#526 charge used
      // floor(base × (1 − d/100)), which dropped a credit to float drift on
      // some exact results (e.g. 10,500 at 30% gave 7,349 instead of 7,350).
      for (let quarterPoints = 0; quarterPoints <= 400; quarterPoints += 3) {
        const discount = quarterPoints / 4;
        for (const [from, to] of [[0, 1], [1, 10], [9, 25], [24, 50]] as const) {
          let reference = 0n;
          for (let level = from; level < to; level++) {
            reference += (BigInt(calculateBaseCost(level)) * BigInt(400 - quarterPoints)) / 400n;
          }
          expect(calculateTrainingDiscountedUpgradeCost(from, to, discount)).toBe(Number(reference));
        }
      }
    });
  });
});
