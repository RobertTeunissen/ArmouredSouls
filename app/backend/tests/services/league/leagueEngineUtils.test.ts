/**
 * Unit tests for league engine pure utilities and promotion thresholds.
 *
 * Validates: Requirements 3.1, 3.2 (league promotions/demotions)
 *
 * Tests the tier traversal logic and LP threshold configuration
 * that drives all league promotion decisions.
 */

// Import the pure functions directly from the module
// getNextTierUp and getNextTierDown are not exported, so we test via the thresholds
import { getMinLPForPromotion, PROMOTION_LP_THRESHOLDS } from '../../../src/services/league/leaguePromotionThresholds';

describe('PROMOTION_LP_THRESHOLDS', () => {
  it('should define thresholds for all 6 tiers', () => {
    expect(Object.keys(PROMOTION_LP_THRESHOLDS)).toHaveLength(6);
  });

  it('should have increasing LP requirements per tier', () => {
    const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    for (let i = 1; i < tiers.length; i++) {
      expect(PROMOTION_LP_THRESHOLDS[tiers[i]]).toBeGreaterThan(PROMOTION_LP_THRESHOLDS[tiers[i - 1]]);
    }
  });

  it('should have Infinity for champion (cannot promote further)', () => {
    expect(PROMOTION_LP_THRESHOLDS['champion']).toBe(Infinity);
  });

  it('should match documented values', () => {
    expect(PROMOTION_LP_THRESHOLDS['bronze']).toBe(25);
    expect(PROMOTION_LP_THRESHOLDS['silver']).toBe(50);
    expect(PROMOTION_LP_THRESHOLDS['gold']).toBe(75);
    expect(PROMOTION_LP_THRESHOLDS['platinum']).toBe(100);
    expect(PROMOTION_LP_THRESHOLDS['diamond']).toBe(125);
  });
});

describe('getMinLPForPromotion', () => {
  it('should return correct threshold for known tiers', () => {
    expect(getMinLPForPromotion('bronze')).toBe(25);
    expect(getMinLPForPromotion('silver')).toBe(50);
    expect(getMinLPForPromotion('gold')).toBe(75);
    expect(getMinLPForPromotion('platinum')).toBe(100);
    expect(getMinLPForPromotion('diamond')).toBe(125);
    expect(getMinLPForPromotion('champion')).toBe(Infinity);
  });

  it('should return 25 as safe default for unknown tiers', () => {
    expect(getMinLPForPromotion('unknown')).toBe(25);
    expect(getMinLPForPromotion('')).toBe(25);
  });
});
