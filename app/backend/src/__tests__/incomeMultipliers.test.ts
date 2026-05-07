/**
 * Income Multipliers Unit Tests
 * Tests prestige and fame multiplier calculations
 */

import {
  getPrestigeMultiplier,
  calculateBattleWinnings,
  calculateMerchandisingIncome,
  getNextPrestigeTier,
  getMerchandisingBaseRate,
} from '../utils/economyCalculations';

describe('Income Multipliers', () => {
  describe('getPrestigeMultiplier', () => {
    test('should return 1.0 for zero prestige', () => {
      expect(getPrestigeMultiplier(0)).toBe(1.0);
    });

    test('should scale smoothly using formula min(1.50, 1 + prestige/50000)', () => {
      expect(getPrestigeMultiplier(1000)).toBeCloseTo(1.02, 5);
      expect(getPrestigeMultiplier(2500)).toBeCloseTo(1.05, 5);
      expect(getPrestigeMultiplier(5000)).toBeCloseTo(1.10, 5);
      expect(getPrestigeMultiplier(7500)).toBeCloseTo(1.15, 5);
      expect(getPrestigeMultiplier(10000)).toBeCloseTo(1.20, 5);
      expect(getPrestigeMultiplier(15000)).toBeCloseTo(1.30, 5);
    });

    test('should cap at 1.50 for prestige 25000+', () => {
      expect(getPrestigeMultiplier(25000)).toBe(1.50);
      expect(getPrestigeMultiplier(35000)).toBe(1.50);
      expect(getPrestigeMultiplier(50000)).toBe(1.50);
      expect(getPrestigeMultiplier(75000)).toBe(1.50);
      expect(getPrestigeMultiplier(100000)).toBe(1.50);
    });
  });

  describe('calculateBattleWinnings', () => {
    test('should apply no bonus for zero prestige', () => {
      const baseReward = 10000;
      const result = calculateBattleWinnings(baseReward, 0);
      
      expect(result).toBe(10000); // 10000 * 1.0
    });

    test('should apply smooth scaling bonus', () => {
      const baseReward = 10000;
      
      expect(calculateBattleWinnings(baseReward, 5000)).toBe(11000);  // +10%
      expect(calculateBattleWinnings(baseReward, 10000)).toBe(12000); // +20%
      expect(calculateBattleWinnings(baseReward, 25000)).toBe(15000); // +50% (cap)
    });

    test('should cap at 50% bonus for prestige 25000+', () => {
      const baseReward = 10000;
      
      expect(calculateBattleWinnings(baseReward, 25000)).toBe(15000);
      expect(calculateBattleWinnings(baseReward, 50000)).toBe(15000);
    });

    test('should round to nearest integer', () => {
      const baseReward = 10000;
      const prestige = 1000; // multiplier = 1.02
      const result = calculateBattleWinnings(baseReward, prestige);
      
      expect(result).toBe(10200); // Math.round(10000 * 1.02)
    });
  });

  describe('calculateMerchandisingIncome', () => {
    test('should return 0 for level 0', () => {
      const result = calculateMerchandisingIncome(0, 10000);
      expect(result).toBe(0);
    });

    test('should calculate correctly for level 1 with no prestige', () => {
      const result = calculateMerchandisingIncome(1, 0);
      const expected = Math.round(5000 * (1 + 0 / 10000)); // 5000 * 1.0
      expect(result).toBe(expected);
    });

    test('should calculate correctly for level 4 with 15000 prestige', () => {
      const result = calculateMerchandisingIncome(4, 15000);
      // 12000 * (1 + 15000 / 10000) = 12000 * 2.5 = 30000
      expect(result).toBe(30000);
    });

    test('should scale linearly with prestige', () => {
      const level = 4;
      const baseRate = 12000;
      
      const result1 = calculateMerchandisingIncome(level, 10000);
      const result2 = calculateMerchandisingIncome(level, 20000);
      
      expect(result1).toBe(Math.round(baseRate * 2.0)); // 24000
      expect(result2).toBe(Math.round(baseRate * 3.0)); // 36000
    });
  });

  describe('getNextPrestigeTier', () => {
    test('should return 25000 threshold for prestige below cap', () => {
      const result = getNextPrestigeTier(0);
      expect(result).toEqual({ threshold: 25000, bonus: '+50% (max)' });
      
      const result2 = getNextPrestigeTier(10000);
      expect(result2).toEqual({ threshold: 25000, bonus: '+50% (max)' });
      
      const result3 = getNextPrestigeTier(24999);
      expect(result3).toEqual({ threshold: 25000, bonus: '+50% (max)' });
    });

    test('should return null for prestige 25000+ (cap reached)', () => {
      const result = getNextPrestigeTier(25000);
      expect(result).toBeNull();
      
      const result2 = getNextPrestigeTier(50000);
      expect(result2).toBeNull();
      
      const result3 = getNextPrestigeTier(100000);
      expect(result3).toBeNull();
    });
  });

  describe('Base Rate Functions', () => {
    test('getMerchandisingBaseRate should return correct rates', () => {
      expect(getMerchandisingBaseRate(0)).toBe(0);
      expect(getMerchandisingBaseRate(1)).toBe(5000);
      expect(getMerchandisingBaseRate(2)).toBe(8000);
      expect(getMerchandisingBaseRate(4)).toBe(12000);
      expect(getMerchandisingBaseRate(10)).toBe(35000);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle zero prestige', () => {
      expect(getPrestigeMultiplier(0)).toBe(1.0);
      expect(calculateMerchandisingIncome(4, 0)).toBe(12000);
    });

    test('should handle very high prestige', () => {
      expect(getPrestigeMultiplier(1000000)).toBe(1.50);
      const result = calculateMerchandisingIncome(4, 1000000);
      expect(result).toBeGreaterThan(0);
    });

    test('should always return integers', () => {
      const result1 = calculateBattleWinnings(10001, 5000);
      expect(Number.isInteger(result1)).toBe(true);
      
      const result2 = calculateMerchandisingIncome(4, 15555);
      expect(Number.isInteger(result2)).toBe(true);
    });
  });
});
