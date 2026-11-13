/**
 * Economy System Unit Tests
 * Tests for economyCalculations.ts utilities
 */

import { calculateFacilityOperatingCost, calculateMerchandisingIncome, getLeagueWinReward, getParticipationReward } from '../src/utils/economyCalculations';
import { getMerchandisingBaseRate } from '../src/utils/economyFormulas';

describe('Economy Calculations', () => {
  afterAll(() => {
    // Pure unit test - no cleanup needed
  });

  describe('Facility Operating Costs', () => {
    it('should calculate Repair Bay operating costs correctly', () => {
      expect(calculateFacilityOperatingCost('repair_bay', 0)).toBe(0); // Not purchased
      expect(calculateFacilityOperatingCost('repair_bay', 1)).toBe(1000);
      expect(calculateFacilityOperatingCost('repair_bay', 5)).toBe(3000); // 1000 + (4 * 500)
      expect(calculateFacilityOperatingCost('repair_bay', 10)).toBe(5500); // 1000 + (9 * 500)
    });

    it('should calculate Training Facility operating costs correctly', () => {
      expect(calculateFacilityOperatingCost('training_facility', 1)).toBe(250);  // 250 * level
      expect(calculateFacilityOperatingCost('training_facility', 5)).toBe(1250); // 250 * level
    });

    it('should calculate Merchandising Hub operating costs correctly', () => {
      expect(calculateFacilityOperatingCost('merchandising_hub', 1)).toBe(200);
      expect(calculateFacilityOperatingCost('merchandising_hub', 10)).toBe(2000); // 200 * 10
    });

    it('should calculate Streaming Studio operating costs correctly', () => {
      expect(calculateFacilityOperatingCost('streaming_studio', 0)).toBe(0); // Not purchased
      expect(calculateFacilityOperatingCost('streaming_studio', 1)).toBe(100); // level × 100
      expect(calculateFacilityOperatingCost('streaming_studio', 5)).toBe(500); // level × 100
      expect(calculateFacilityOperatingCost('streaming_studio', 10)).toBe(1000); // level × 100
    });

    it('should return 0 for facilities with no operating cost', () => {
      expect(calculateFacilityOperatingCost('roster_expansion', 5)).toBe(0); // Handled separately
    });

    it('should return level × 150 for booking_office', () => {
      expect(calculateFacilityOperatingCost('booking_office', 1)).toBe(150);
      expect(calculateFacilityOperatingCost('booking_office', 5)).toBe(750);
      expect(calculateFacilityOperatingCost('booking_office', 10)).toBe(1500);
    });
  });

  describe('League Rewards', () => {
    it('should return correct win rewards for each league', () => {
      expect(getLeagueWinReward('bronze')).toBe(7500);
      expect(getLeagueWinReward('silver')).toBe(15000);
      expect(getLeagueWinReward('gold')).toBe(30000);
      expect(getLeagueWinReward('platinum')).toBe(60000);
      expect(getLeagueWinReward('diamond')).toBe(115000);
      expect(getLeagueWinReward('champion')).toBe(225000);
    });

    it('should return participation rewards (20% of win reward)', () => {
      expect(getParticipationReward('bronze')).toBe(1500); // 20% of 7500
      expect(getParticipationReward('silver')).toBe(3000); // 20% of 15000
      expect(getParticipationReward('gold')).toBe(6000); // 20% of 30000
    });
  });

  describe('Merchandising Income (Spec #46 R2)', () => {
    // Signature is (level, prestige, rosterCapacity). Base rate is ₡25,000/level
    // (Season 2, #524) and the multiplier divides prestige by Roster_Capacity.
    it('should return 0 when the Merchandising Hub is not purchased', () => {
      expect(calculateMerchandisingIncome(0, 10000, 1)).toBe(0);
    });

    it('should calculate base merchandising income at level 1', () => {
      expect(calculateMerchandisingIncome(1, 0, 1)).toBe(25000); // Season 2 base rate
    });

    it('should scale merchandising with prestige per slot', () => {
      // L1, capacity 1: 25000 × (1 + 10000/1/10000) = 25000 × 2 = 50000
      expect(calculateMerchandisingIncome(1, 10000, 1)).toBe(50000);

      // L5, capacity 1: 125000 × (1 + 15000/1/10000) = 125000 × 2.5 = 312500
      expect(calculateMerchandisingIncome(5, 15000, 1)).toBe(312500);
    });

    it('should divide the same prestige across a larger roster', () => {
      // Capacity 5 with 5× the prestige yields the same multiplier as capacity 1
      expect(calculateMerchandisingIncome(1, 50000, 5)).toBe(
        calculateMerchandisingIncome(1, 10000, 1),
      );
    });
  });

  describe('Passive Income Calculations (Requirements 13.1-13.8)', () => {
    it('should only include merchandising income from the Merchandising Hub', () => {
      // L1, capacity 1, no prestige
      expect(calculateMerchandisingIncome(1, 0, 1)).toBe(25000);

      // L5, capacity 1, prestige 10000 = 125000 × (1 + 1) = 250000
      expect(calculateMerchandisingIncome(5, 10000, 1)).toBe(250000);

      // L10, capacity 1, prestige 20000 = 250000 × (1 + 2) = 750000
      expect(calculateMerchandisingIncome(10, 20000, 1)).toBe(750000);
    });

    it('should not include streaming revenue in merchandising calculation', () => {
      // Merchandising income should only depend on Income Generator level and prestige
      // It should NOT include any streaming revenue component
      
      // Test that merchandising formula is: base_rate × (1 + prestige/10000)
      // NOT: base_rate × (1 + prestige/10000) + streaming_component
      
      const level = 5;
      const prestige = 15000;
      const rosterCapacity = 1;
      const baseRate = getMerchandisingBaseRate(level); // 125000
      const expectedMerchandising = Math.round(
        baseRate * (1 + prestige / rosterCapacity / 10000),
      ); // 125000 * 2.5 = 312500

      expect(calculateMerchandisingIncome(level, prestige, rosterCapacity)).toBe(expectedMerchandising);
      expect(calculateMerchandisingIncome(level, prestige, rosterCapacity)).toBe(312500);
    });

    it('should return 0 merchandising when Income Generator not purchased', () => {
      expect(calculateMerchandisingIncome(0, 0, 1)).toBe(0);
      expect(calculateMerchandisingIncome(0, 10000, 1)).toBe(0);
      expect(calculateMerchandisingIncome(0, 50000, 5)).toBe(0);
    });
  });
});
