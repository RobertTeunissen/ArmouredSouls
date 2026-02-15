/**
 * Economy System Unit Tests
 * Tests for economyCalculations.ts utilities
 */

import {
  calculateFacilityOperatingCost,
  getPrestigeMultiplier,
  calculateBattleWinnings,
  getMerchandisingBaseRate,
  calculateMerchandisingIncome,
  getStreamingBaseRate,
  calculateStreamingIncome,
  calculateFinancialHealth,
  getLeagueBaseReward,
  getParticipationReward,
} from '../src/utils/economyCalculations';

describe('Economy Calculations', () => {
  describe('Facility Operating Costs', () => {
    it('should calculate Repair Bay operating costs correctly', () => {
      expect(calculateFacilityOperatingCost('repair_bay', 0)).toBe(0); // Not purchased
      expect(calculateFacilityOperatingCost('repair_bay', 1)).toBe(1000);
      expect(calculateFacilityOperatingCost('repair_bay', 5)).toBe(3000); // 1000 + (4 * 500)
      expect(calculateFacilityOperatingCost('repair_bay', 10)).toBe(5500); // 1000 + (9 * 500)
    });

    it('should calculate Training Facility operating costs correctly', () => {
      expect(calculateFacilityOperatingCost('training_facility', 1)).toBe(1500);
      expect(calculateFacilityOperatingCost('training_facility', 5)).toBe(4500); // 1500 + (4 * 750)
    });

    it('should calculate Income Generator operating costs correctly', () => {
      expect(calculateFacilityOperatingCost('income_generator', 1)).toBe(1000);
      expect(calculateFacilityOperatingCost('income_generator', 10)).toBe(5500); // 1000 + (9 * 500)
    });

    it('should return 0 for facilities with no operating cost', () => {
      expect(calculateFacilityOperatingCost('booking_office', 5)).toBe(0);
      expect(calculateFacilityOperatingCost('roster_expansion', 5)).toBe(0); // Handled separately
    });
  });

  describe('Prestige Multipliers', () => {
    it('should return 1.0 for prestige below 5000', () => {
      expect(getPrestigeMultiplier(0)).toBe(1.0);
      expect(getPrestigeMultiplier(4999)).toBe(1.0);
    });

    it('should return correct multipliers for prestige tiers', () => {
      expect(getPrestigeMultiplier(5000)).toBe(1.05); // 5%
      expect(getPrestigeMultiplier(10000)).toBe(1.10); // 10%
      expect(getPrestigeMultiplier(25000)).toBe(1.15); // 15%
      expect(getPrestigeMultiplier(50000)).toBe(1.20); // 20%
    });

    it('should return highest multiplier for prestige over 50000', () => {
      expect(getPrestigeMultiplier(100000)).toBe(1.20);
    });
  });

  describe('Battle Winnings', () => {
    it('should calculate battle winnings with no prestige bonus', () => {
      expect(calculateBattleWinnings(10000, 0)).toBe(10000);
      expect(calculateBattleWinnings(10000, 4999)).toBe(10000);
    });

    it('should calculate battle winnings with prestige bonuses', () => {
      expect(calculateBattleWinnings(10000, 5000)).toBe(10500); // +5%
      expect(calculateBattleWinnings(10000, 10000)).toBe(11000); // +10%
      expect(calculateBattleWinnings(10000, 25000)).toBe(11500); // +15%
      expect(calculateBattleWinnings(10000, 50000)).toBe(12000); // +20%
    });
  });

  describe('League Rewards', () => {
    it('should return correct base rewards for each league', () => {
      expect(getLeagueBaseReward('bronze')).toEqual({ min: 5000, max: 10000, midpoint: 7500 });
      expect(getLeagueBaseReward('silver')).toEqual({ min: 10000, max: 20000, midpoint: 15000 });
      expect(getLeagueBaseReward('gold')).toEqual({ min: 20000, max: 40000, midpoint: 30000 });
      expect(getLeagueBaseReward('platinum')).toEqual({ min: 40000, max: 80000, midpoint: 60000 });
      expect(getLeagueBaseReward('diamond')).toEqual({ min: 80000, max: 150000, midpoint: 115000 });
      expect(getLeagueBaseReward('champion')).toEqual({ min: 150000, max: 300000, midpoint: 225000 });
    });

    it('should return participation rewards (30% of league base)', () => {
      expect(getParticipationReward('bronze')).toBe(1500); // 30% of 5000
      expect(getParticipationReward('silver')).toBe(3000); // 30% of 10000
      expect(getParticipationReward('gold')).toBe(6000); // 30% of 20000
    });
  });

  describe('Merchandising Income', () => {
    it('should return 0 when Income Generator not purchased', () => {
      expect(calculateMerchandisingIncome(0, 10000)).toBe(0);
    });

    it('should calculate base merchandising income at level 1', () => {
      expect(calculateMerchandisingIncome(1, 0)).toBe(5000); // Base rate, no prestige
    });

    it('should scale merchandising with prestige', () => {
      // Level 1: Base 5000, Prestige 10000 = 5000 * (1 + 10000/10000) = 5000 * 2 = 10000
      expect(calculateMerchandisingIncome(1, 10000)).toBe(10000);
      
      // Level 5: Base 12000, Prestige 15000 = 12000 * (1 + 15000/10000) = 12000 * 2.5 = 30000
      expect(calculateMerchandisingIncome(5, 15000)).toBe(30000);
    });
  });

  describe('Streaming Income', () => {
    it('should return 0 when Income Generator below level 3', () => {
      expect(calculateStreamingIncome(0, 1000, 5000)).toBe(0);
      expect(calculateStreamingIncome(2, 1000, 5000)).toBe(0);
    });

    it('should calculate base streaming income at level 3', () => {
      expect(calculateStreamingIncome(3, 0, 0)).toBe(3000); // Base rate, no battles/fame
    });

    it('should scale streaming with battles and fame', () => {
      // Level 3: Base 3000, 500 battles, 2500 fame
      // battle_mult = 1 + (500/1000) = 1.5
      // fame_mult = 1 + (2500/5000) = 1.5
      // result = 3000 * 1.5 * 1.5 = 6750
      expect(calculateStreamingIncome(3, 500, 2500)).toBe(6750);
    });
  });

  describe('Financial Health', () => {
    it('should return critical for balance < 50K', () => {
      expect(calculateFinancialHealth(40000, 5000)).toBe('critical');
      expect(calculateFinancialHealth(0, 0)).toBe('critical');
    });

    it('should return warning for balance < 100K', () => {
      expect(calculateFinancialHealth(75000, 5000)).toBe('warning');
      expect(calculateFinancialHealth(99999, -1000)).toBe('warning');
    });

    it('should return stable/warning for moderate balance or negative income', () => {
      // Balance 300K with negative income = warning (balance < 500K and negative income)
      expect(calculateFinancialHealth(300000, -5000)).toBe('warning');
      // Balance 400K with zero income = stable (balance between 100K-500K)
      expect(calculateFinancialHealth(400000, 0)).toBe('stable');
      // Balance 600K with negative income = stable (balance >= 500K, can sustain losses)
      expect(calculateFinancialHealth(600000, -5000)).toBe('stable');
    });

    it('should return good for balance >= 500K with positive income', () => {
      expect(calculateFinancialHealth(500000, 1000)).toBe('good');
      expect(calculateFinancialHealth(800000, 5000)).toBe('good');
    });

    it('should return excellent for balance >= 1M with positive income', () => {
      expect(calculateFinancialHealth(1000000, 10000)).toBe('excellent');
      expect(calculateFinancialHealth(5000000, 50000)).toBe('excellent');
    });
  });
});
