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
    test('should return 1.0 for prestige below 5000', () => {
      expect(getPrestigeMultiplier(0)).toBe(1.0);
      expect(getPrestigeMultiplier(4999)).toBe(1.0);
    });

    test('should return 1.05 for prestige 5000-9999', () => {
      expect(getPrestigeMultiplier(5000)).toBe(1.05);
      expect(getPrestigeMultiplier(7500)).toBe(1.05);
      expect(getPrestigeMultiplier(9999)).toBe(1.05);
    });

    test('should return 1.10 for prestige 10000-24999', () => {
      expect(getPrestigeMultiplier(10000)).toBe(1.10);
      expect(getPrestigeMultiplier(15000)).toBe(1.10);
      expect(getPrestigeMultiplier(24999)).toBe(1.10);
    });

    test('should return 1.15 for prestige 25000-49999', () => {
      expect(getPrestigeMultiplier(25000)).toBe(1.15);
      expect(getPrestigeMultiplier(35000)).toBe(1.15);
      expect(getPrestigeMultiplier(49999)).toBe(1.15);
    });

    test('should return 1.20 for prestige 50000+', () => {
      expect(getPrestigeMultiplier(50000)).toBe(1.20);
      expect(getPrestigeMultiplier(75000)).toBe(1.20);
      expect(getPrestigeMultiplier(100000)).toBe(1.20);
    });
  });

  describe('calculateBattleWinnings', () => {
    test('should apply no bonus for low prestige', () => {
      const baseReward = 10000;
      const prestige = 1000;
      const result = calculateBattleWinnings(baseReward, prestige);
      
      expect(result).toBe(10000); // 10000 * 1.0
    });

    test('should apply 5% bonus for 5000 prestige', () => {
      const baseReward = 10000;
      const prestige = 5000;
      const result = calculateBattleWinnings(baseReward, prestige);
      
      expect(result).toBe(10500); // 10000 * 1.05
    });

    test('should apply 10% bonus for 10000 prestige', () => {
      const baseReward = 10000;
      const prestige = 10000;
      const result = calculateBattleWinnings(baseReward, prestige);
      
      expect(result).toBe(11000); // 10000 * 1.10
    });

    test('should apply 20% bonus for 50000+ prestige', () => {
      const baseReward = 10000;
      const prestige = 50000;
      const result = calculateBattleWinnings(baseReward, prestige);
      
      expect(result).toBe(12000); // 10000 * 1.20
    });

    test('should round to nearest integer', () => {
      const baseReward = 10001;
      const prestige = 5000;
      const result = calculateBattleWinnings(baseReward, prestige);
      
      expect(result).toBe(10501); // Math.round(10001 * 1.05)
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
    test('should return 5000 threshold for prestige below 5000', () => {
      const result = getNextPrestigeTier(0);
      expect(result).toEqual({ threshold: 5000, bonus: '+5%' });
      
      const result2 = getNextPrestigeTier(4999);
      expect(result2).toEqual({ threshold: 5000, bonus: '+5%' });
    });

    test('should return 10000 threshold for prestige 5000-9999', () => {
      const result = getNextPrestigeTier(5000);
      expect(result).toEqual({ threshold: 10000, bonus: '+10%' });
      
      const result2 = getNextPrestigeTier(9999);
      expect(result2).toEqual({ threshold: 10000, bonus: '+10%' });
    });

    test('should return 25000 threshold for prestige 10000-24999', () => {
      const result = getNextPrestigeTier(10000);
      expect(result).toEqual({ threshold: 25000, bonus: '+15%' });
      
      const result2 = getNextPrestigeTier(24999);
      expect(result2).toEqual({ threshold: 25000, bonus: '+15%' });
    });

    test('should return 50000 threshold for prestige 25000-49999', () => {
      const result = getNextPrestigeTier(25000);
      expect(result).toEqual({ threshold: 50000, bonus: '+20%' });
      
      const result2 = getNextPrestigeTier(49999);
      expect(result2).toEqual({ threshold: 50000, bonus: '+20%' });
    });

    test('should return null for prestige 50000+ (max tier)', () => {
      const result = getNextPrestigeTier(50000);
      expect(result).toBeNull();
      
      const result2 = getNextPrestigeTier(100000);
      expect(result2).toBeNull();
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
      expect(getPrestigeMultiplier(1000000)).toBe(1.20);
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
