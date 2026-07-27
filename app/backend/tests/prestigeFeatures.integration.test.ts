/**
 * Prestige Features Integration Tests
 * Tests end-to-end functionality of prestige gates and income multipliers
 */

import {
  getPrestigeMultiplier,
  calculateMerchandisingIncome,
  getNextPrestigeTier,
} from '../src/utils/economyCalculations';
import { getFacilityConfig } from '../src/config/facilities';

describe('Prestige Features Integration', () => {
  describe('Prestige Gates End-to-End', () => {
    test('should validate prestige requirements across multiple facilities', () => {
      const userPrestige = 5000;
      
      // Repair Bay Level 4 requires 1000 prestige - should pass
      const repairBayConfig = getFacilityConfig('repair_bay');
      const repairBayReq = repairBayConfig?.prestigeRequirements?.[3]; // Level 4
      expect(userPrestige >= (repairBayReq || 0)).toBe(true);
      
      // Booking Office Level 3 requires 5000 prestige - should pass
      const bookingConfig = getFacilityConfig('booking_office');
      const bookingReq = bookingConfig?.prestigeRequirements?.[2]; // Level 3
      expect(userPrestige >= (bookingReq || 0)).toBe(true);
      
      // Combat Training Academy Level 7 requires 7000 prestige - should fail
      const combatConfig = getFacilityConfig('combat_training_academy');
      const combatReq = combatConfig?.prestigeRequirements?.[6]; // Level 7
      expect(userPrestige >= (combatReq || 0)).toBe(false);
    });

    test('should correctly determine upgrade eligibility', () => {
      const userPrestige = 10000;
      const userCurrency = 2000000;
      
      const config = getFacilityConfig('combat_training_academy');
      const targetLevel = 9; // Requires 10000 prestige
      const upgradeCost = config?.costs[targetLevel - 1] || 0;
      const prestigeReq = config?.prestigeRequirements?.[targetLevel - 1] || 0;
      
      const hasPrestige = userPrestige >= prestigeReq;
      const canAfford = userCurrency >= upgradeCost;
      const canUpgrade = hasPrestige && canAfford;
      
      expect(hasPrestige).toBe(true);
      expect(canAfford).toBe(true);
      expect(canUpgrade).toBe(true);
    });
  });

  describe('Income Multipliers End-to-End', () => {
    test('should calculate complete income breakdown for a user', () => {
      const userPrestige = 15000;
      const incomeGeneratorLevel = 4;
      
      // Calculate all income streams
      const prestigeMultiplier = getPrestigeMultiplier(userPrestige);
      const merchandising = calculateMerchandisingIncome(incomeGeneratorLevel, userPrestige, 1);
      const nextTier = getNextPrestigeTier(userPrestige);
      
      // Verify calculations
      // Prestige multiplier: min(1.50, 1 + 15000/50000) = 1.30
      // Spec #46 R2: baseRate for level 4 = 40000, merchandising multiplier is
      // 1 + prestigePerSlot/10000 = 1 + 15000/1/10000 = 2.5
      expect(prestigeMultiplier).toBeCloseTo(1.30, 5); // 30% bonus
      expect(merchandising).toBe(100000); // 40000 * 2.5
      expect(nextTier).toEqual({ threshold: 25000, bonus: '+50% (max)' });
      
      const totalPassiveIncome = merchandising;
      expect(totalPassiveIncome).toBe(100000);
    });

    test('should show smooth progression of prestige multiplier', () => {
      const prestiges = [0, 1000, 5000, 10000, 25000, 50000];
      const expectedMultipliers = [1.0, 1.02, 1.10, 1.20, 1.50, 1.50];
      const expectedNextTiers = [
        { threshold: 25000, bonus: '+50% (max)' },
        { threshold: 25000, bonus: '+50% (max)' },
        { threshold: 25000, bonus: '+50% (max)' },
        { threshold: 25000, bonus: '+50% (max)' },
        null,
        null,
      ];
      
      prestiges.forEach((prestige, index) => {
        const multiplier = getPrestigeMultiplier(prestige);
        const nextTier = getNextPrestigeTier(prestige);
        
        expect(multiplier).toBeCloseTo(expectedMultipliers[index], 5);
        expect(nextTier).toEqual(expectedNextTiers[index]);
      });
    });

    test('should calculate realistic income scenario', () => {
      // Realistic mid-game scenario
      const userPrestige = 7500;
      const incomeGeneratorLevel = 5;
      
      const merchandising = calculateMerchandisingIncome(incomeGeneratorLevel, userPrestige, 1);
      
      // Expected: baseRate(5) = 50000, multiplier = 1 + 7500/1/10000 = 1.75
      // → 50000 * 1.75 = 87500
      expect(merchandising).toBe(87500);

      const totalIncome = merchandising;
      expect(totalIncome).toBe(87500);
    });
  });

  describe('Combined Features', () => {
    test('should validate facility upgrade with prestige and show income impact', () => {
      const userPrestige = 3000;
      const currentIncomeGenLevel = 3;
      const targetIncomeGenLevel = 4;
      
      // Check if upgrade is allowed
      const config = getFacilityConfig('merchandising_hub');
      const prestigeReq = config?.prestigeRequirements?.[targetIncomeGenLevel - 1] || 0;
      const canUpgrade = userPrestige >= prestigeReq;
      
      // Spec #46 R2.10: the L4 gate is 2000 Prestige_Per_Slot (was 3000 raw)
      expect(prestigeReq).toBe(2000);
      expect(canUpgrade).toBe(true);
      
      // Calculate income before and after
      const incomeBefore = calculateMerchandisingIncome(currentIncomeGenLevel, userPrestige, 1);
      const incomeAfter = calculateMerchandisingIncome(targetIncomeGenLevel, userPrestige, 1);
      
      expect(incomeBefore).toBe(39000); // 30000 * 1.3
      expect(incomeAfter).toBe(52000); // 40000 * 1.3

      const incomeIncrease = incomeAfter - incomeBefore;
      expect(incomeIncrease).toBe(13000);
    });

    test('should handle user at max prestige tier', () => {
      const userPrestige = 75000;
      const incomeGeneratorLevel = 10;
      
      const prestigeMultiplier = getPrestigeMultiplier(userPrestige);
      const nextTier = getNextPrestigeTier(userPrestige);
      const merchandising = calculateMerchandisingIncome(incomeGeneratorLevel, userPrestige, 1);
      
      expect(prestigeMultiplier).toBe(1.50); // Max tier
      expect(nextTier).toBeNull(); // No next tier
      expect(merchandising).toBeGreaterThan(0);
      
      // User should have access to all facilities
      const bookingOfficeConfig = getFacilityConfig('booking_office');
      const maxLevelReq = bookingOfficeConfig?.prestigeRequirements?.[9]; // Level 10
      expect(userPrestige >= (maxLevelReq || 0)).toBe(true);
    });
  });
});
