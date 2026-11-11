/**
 * Income Multipliers Unit Tests
 * Merchandising scales with prestige per roster slot. Battle winnings carry no
 * prestige bonus since #596: a win pays the same to every stable.
 */

import {
  calculateMerchandisingIncome,
  getMerchandisingBaseRate,
} from '../utils/economyCalculations';

describe('Income Multipliers', () => {
  describe('calculateMerchandisingIncome (Spec #46 R2)', () => {
    test('should return 0 for level 0', () => {
      expect(calculateMerchandisingIncome(0, 10000, 1)).toBe(0);
    });

    test('should calculate correctly for level 1 with no prestige', () => {
      // Season 2 (#524) base rate: ₡25,000/level
      expect(calculateMerchandisingIncome(1, 0, 1)).toBe(25000);
    });

    test('should calculate correctly for level 4 with 15000 prestige and one slot', () => {
      // 100000 * (1 + 15000/1/10000) = 100000 * 2.5 = 250000
      expect(calculateMerchandisingIncome(4, 15000, 1)).toBe(250000);
    });

    test('should scale linearly with prestige per slot', () => {
      const level = 4;
      const baseRate = 100000; // getMerchandisingBaseRate(4)

      expect(calculateMerchandisingIncome(level, 10000, 1)).toBe(Math.round(baseRate * 2.0));
      expect(calculateMerchandisingIncome(level, 20000, 1)).toBe(Math.round(baseRate * 3.0));
    });

    test('should be non-increasing as roster capacity rises', () => {
      const prev = calculateMerchandisingIncome(4, 20000, 1);
      for (let capacity = 2; capacity <= 10; capacity++) {
        expect(calculateMerchandisingIncome(4, 20000, capacity)).toBeLessThanOrEqual(prev);
      }
    });
  });

  describe('Base Rate Functions', () => {
    test('getMerchandisingBaseRate should return correct rates', () => {
      expect(getMerchandisingBaseRate(0)).toBe(0);
      expect(getMerchandisingBaseRate(1)).toBe(25000);
      expect(getMerchandisingBaseRate(2)).toBe(50000);
      expect(getMerchandisingBaseRate(4)).toBe(100000);
      expect(getMerchandisingBaseRate(10)).toBe(250000);
      expect(getMerchandisingBaseRate(11)).toBe(0);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle zero prestige', () => {
      expect(calculateMerchandisingIncome(4, 0, 1)).toBe(100000);
    });

    test('should handle very high prestige', () => {
      const result = calculateMerchandisingIncome(4, 1000000, 1);
      expect(result).toBeGreaterThan(0);
    });

    test('should always return integers', () => {
      const result2 = calculateMerchandisingIncome(4, 15555, 3);
      expect(Number.isInteger(result2)).toBe(true);
    });
  });
});
