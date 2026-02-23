/**
 * Prestige Features Integration Tests
 * Tests end-to-end functionality of prestige gates and income multipliers
 */

import { PrismaClient } from '@prisma/client';
import {
  getPrestigeMultiplier,
  calculateMerchandisingIncome,
  getNextPrestigeTier,
} from '../../utils/economyCalculations';
import { getFacilityConfig } from '../../config/facilities';

const prisma = new PrismaClient();

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
      
      // Research Lab Level 7 requires 7500 prestige - should fail
      const researchConfig = getFacilityConfig('research_lab');
      const researchReq = researchConfig?.prestigeRequirements?.[6]; // Level 7
      expect(userPrestige >= (researchReq || 0)).toBe(false);
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
      const merchandising = calculateMerchandisingIncome(incomeGeneratorLevel, userPrestige);
      const nextTier = getNextPrestigeTier(userPrestige);
      
      // Verify calculations
      expect(prestigeMultiplier).toBe(1.10); // 10% bonus
      expect(merchandising).toBe(30000); // 12000 * 2.5
      expect(nextTier).toEqual({ threshold: 25000, bonus: '+15%' });
      
      const totalPassiveIncome = merchandising;
      expect(totalPassiveIncome).toBe(30000);
    });

    test('should show progression through prestige tiers', () => {
      const prestiges = [0, 5000, 10000, 25000, 50000];
      const expectedMultipliers = [1.0, 1.05, 1.10, 1.15, 1.20];
      const expectedNextTiers = [
        { threshold: 5000, bonus: '+5%' },
        { threshold: 10000, bonus: '+10%' },
        { threshold: 25000, bonus: '+15%' },
        { threshold: 50000, bonus: '+20%' },
        null,
      ];
      
      prestiges.forEach((prestige, index) => {
        const multiplier = getPrestigeMultiplier(prestige);
        const nextTier = getNextPrestigeTier(prestige);
        
        expect(multiplier).toBe(expectedMultipliers[index]);
        expect(nextTier).toEqual(expectedNextTiers[index]);
      });
    });

    test('should calculate realistic income scenario', () => {
      // Realistic mid-game scenario
      const userPrestige = 7500;
      const incomeGeneratorLevel = 5;
      
      const merchandising = calculateMerchandisingIncome(incomeGeneratorLevel, userPrestige);
      
      // Expected: 12000 * (1 + 7500/10000) = 12000 * 1.75 = 21000
      expect(merchandising).toBe(21000);
      
      const totalIncome = merchandising;
      expect(totalIncome).toBe(21000);
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
      
      expect(prestigeReq).toBe(3000);
      expect(canUpgrade).toBe(true);
      
      // Calculate income before and after
      const incomeBefore = calculateMerchandisingIncome(currentIncomeGenLevel, userPrestige);
      const incomeAfter = calculateMerchandisingIncome(targetIncomeGenLevel, userPrestige);
      
      expect(incomeBefore).toBe(10400); // 8000 * 1.3
      expect(incomeAfter).toBe(15600); // 12000 * 1.3
      
      const incomeIncrease = incomeAfter - incomeBefore;
      expect(incomeIncrease).toBe(5200);
    });

    test('should handle user at max prestige tier', () => {
      const userPrestige = 75000;
      const incomeGeneratorLevel = 10;
      
      const prestigeMultiplier = getPrestigeMultiplier(userPrestige);
      const nextTier = getNextPrestigeTier(userPrestige);
      const merchandising = calculateMerchandisingIncome(incomeGeneratorLevel, userPrestige);
      
      expect(prestigeMultiplier).toBe(1.20); // Max tier
      expect(nextTier).toBeNull(); // No next tier
      expect(merchandising).toBeGreaterThan(0);
      
      // User should have access to all facilities
      const bookingOfficeConfig = getFacilityConfig('booking_office');
      const maxLevelReq = bookingOfficeConfig?.prestigeRequirements?.[9]; // Level 10
      expect(userPrestige >= (maxLevelReq || 0)).toBe(true);
    });
  });
});
