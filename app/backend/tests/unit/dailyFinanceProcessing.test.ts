/**
 * Unit tests for daily finance processing (processAllDailyFinances / processDailyFinances)
 *
 * These test the most critical economic function: daily deduction of operating
 * costs from all users. A bug here means either players lose money incorrectly
 * or the economy inflates.
 */

import { calculateFacilityOperatingCost, calculateFinancialHealth, getPrestigeMultiplier, getLeagueWinReward, getParticipationReward } from '../../src/utils/economyCalculations';

// Silence logger during tests
jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('Daily Finance Processing - Pure Calculations', () => {
  describe('calculateFacilityOperatingCost', () => {
    it('should return 0 for level 0 (not purchased)', () => {
      expect(calculateFacilityOperatingCost('repair_bay', 0)).toBe(0);
      expect(calculateFacilityOperatingCost('weapons_workshop', 0)).toBe(0);
      expect(calculateFacilityOperatingCost('streaming_studio', 0)).toBe(0);
    });

    it('should calculate repair_bay cost correctly', () => {
      expect(calculateFacilityOperatingCost('repair_bay', 1)).toBe(1000);
      expect(calculateFacilityOperatingCost('repair_bay', 2)).toBe(1500);
      expect(calculateFacilityOperatingCost('repair_bay', 5)).toBe(3000);
    });

    it('should calculate training_facility cost correctly', () => {
      expect(calculateFacilityOperatingCost('training_facility', 1)).toBe(250);
      expect(calculateFacilityOperatingCost('training_facility', 5)).toBe(1250);
      expect(calculateFacilityOperatingCost('training_facility', 10)).toBe(2500);
    });

    it('should calculate weapons_workshop cost correctly', () => {
      expect(calculateFacilityOperatingCost('weapons_workshop', 1)).toBe(100);
      expect(calculateFacilityOperatingCost('weapons_workshop', 10)).toBe(1000);
    });

    it('should return 0 for roster_expansion (calculated separately)', () => {
      expect(calculateFacilityOperatingCost('roster_expansion', 5)).toBe(0);
    });

    it('should calculate storage_facility cost correctly', () => {
      expect(calculateFacilityOperatingCost('storage_facility', 1)).toBe(500);
      expect(calculateFacilityOperatingCost('storage_facility', 3)).toBe(1000);
    });

    it('should calculate booking_office cost correctly', () => {
      expect(calculateFacilityOperatingCost('booking_office', 1)).toBe(150);
      expect(calculateFacilityOperatingCost('booking_office', 5)).toBe(750);
    });

    it('should calculate academy costs correctly (all identical formula)', () => {
      const academies = ['combat_training_academy', 'defense_training_academy', 'mobility_training_academy', 'ai_training_academy'];
      for (const academy of academies) {
        expect(calculateFacilityOperatingCost(academy, 1)).toBe(250);
        expect(calculateFacilityOperatingCost(academy, 5)).toBe(1250);
      }
    });

    it('should calculate merchandising_hub cost correctly', () => {
      expect(calculateFacilityOperatingCost('merchandising_hub', 1)).toBe(200);
      expect(calculateFacilityOperatingCost('merchandising_hub', 10)).toBe(2000);
    });

    it('should calculate streaming_studio cost correctly', () => {
      expect(calculateFacilityOperatingCost('streaming_studio', 1)).toBe(100);
      expect(calculateFacilityOperatingCost('streaming_studio', 10)).toBe(1000);
    });

    it('should calculate tuning_bay cost correctly', () => {
      expect(calculateFacilityOperatingCost('tuning_bay', 1)).toBe(300);
      expect(calculateFacilityOperatingCost('tuning_bay', 5)).toBe(1500);
    });

    it('should return 0 for unknown facility types', () => {
      expect(calculateFacilityOperatingCost('nonexistent', 5)).toBe(0);
      expect(calculateFacilityOperatingCost('', 1)).toBe(0);
    });

    it('should handle all levels from 1 to 10 without NaN', () => {
      const facilities = [
        'repair_bay', 'training_facility', 'weapons_workshop', 'storage_facility',
        'booking_office', 'combat_training_academy', 'merchandising_hub',
        'streaming_studio', 'tuning_bay',
      ];
      for (const facility of facilities) {
        for (let level = 1; level <= 10; level++) {
          const cost = calculateFacilityOperatingCost(facility, level);
          expect(Number.isFinite(cost)).toBe(true);
          expect(cost).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('calculateFinancialHealth', () => {
    it('should return critical for very low balance', () => {
      expect(calculateFinancialHealth(10000, 5000)).toBe('critical');
      expect(calculateFinancialHealth(49999, 10000)).toBe('critical');
    });

    it('should return warning for low balance', () => {
      expect(calculateFinancialHealth(50000, 1000)).toBe('warning');
      expect(calculateFinancialHealth(99999, 1000)).toBe('warning');
    });

    it('should return warning for low balance with negative income', () => {
      expect(calculateFinancialHealth(200000, -5000)).toBe('warning');
    });

    it('should return stable for moderate balance with negative income', () => {
      expect(calculateFinancialHealth(500000, -1000)).toBe('stable');
    });

    it('should return stable for moderate positive balance', () => {
      expect(calculateFinancialHealth(100000, 1000)).toBe('stable');
    });

    it('should return good for high balance', () => {
      expect(calculateFinancialHealth(500000, 1000)).toBe('good');
    });

    it('should return excellent for very high balance', () => {
      expect(calculateFinancialHealth(1000000, 5000)).toBe('excellent');
    });
  });

  describe('getPrestigeMultiplier', () => {
    it('should return 1.0 for 0 prestige', () => {
      expect(getPrestigeMultiplier(0)).toBe(1);
    });

    it('should scale linearly with prestige', () => {
      expect(getPrestigeMultiplier(10000)).toBeCloseTo(1.2);
      expect(getPrestigeMultiplier(25000)).toBeCloseTo(1.5);
    });

    it('should cap at 1.50', () => {
      expect(getPrestigeMultiplier(25000)).toBe(1.5);
      expect(getPrestigeMultiplier(50000)).toBe(1.5);
      expect(getPrestigeMultiplier(100000)).toBe(1.5);
    });
  });

  describe('getLeagueWinReward', () => {
    it('should return correct rewards for each tier', () => {
      expect(getLeagueWinReward('bronze')).toBe(7500);
      expect(getLeagueWinReward('silver')).toBe(15000);
      expect(getLeagueWinReward('gold')).toBe(30000);
      expect(getLeagueWinReward('platinum')).toBe(60000);
      expect(getLeagueWinReward('diamond')).toBe(115000);
      expect(getLeagueWinReward('champion')).toBe(225000);
    });

    it('should be case-insensitive', () => {
      expect(getLeagueWinReward('Bronze')).toBe(7500);
      expect(getLeagueWinReward('GOLD')).toBe(30000);
    });

    it('should default to bronze for unknown tiers', () => {
      expect(getLeagueWinReward('unknown')).toBe(7500);
    });
  });

  describe('getParticipationReward', () => {
    it('should be 20% of win reward', () => {
      expect(getParticipationReward('bronze')).toBe(1500);
      expect(getParticipationReward('champion')).toBe(45000);
    });
  });
});
