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
import {
  planLeagueInstanceRebalancing,
  planLeagueTierRebalancing,
} from '../../../src/services/league/league-rebalancing-planner';
import { HEAD_TO_HEAD_LEAGUE_RULES } from '../../../src/services/league/league-rules';

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


describe('canonical head-to-head league rebalancing planner', () => {
  interface TestStanding {
    entityId: number;
    leaguePoints: number;
    cyclesInTier: number;
  }

  const selectors = {
    getEntityId: (standing: TestStanding): number => standing.entityId,
    getLeaguePoints: (standing: TestStanding): number => standing.leaguePoints,
    getCyclesInTier: (standing: TestStanding): number => standing.cyclesInTier,
  };

  const modes = ['league_1v1', 'league_2v2', 'league_3v3', 'tag_team'] as const;

  it.each(modes)(
    'should select the same five Silver candidates from 78 total entities in %s',
    () => {
      const standings: TestStanding[] = Array.from({ length: 78 }, (_, index) => ({
        entityId: index + 1,
        leaguePoints: 200 - index,
        // Five of the seven fixed-zone positions qualify. Another 21 residents
        // sit below the zone, giving 26 residents without affecting its size.
        cyclesInTier: index < 5 || (index >= 7 && index < 28) ? 5 : 4,
      }));

      const plan = planLeagueInstanceRebalancing(
        'silver_1',
        'silver',
        standings,
        HEAD_TO_HEAD_LEAGUE_RULES,
        selectors,
      );

      expect(plan.totalEntities).toBe(78);
      expect(plan.eligibleEntities).toBe(26);
      expect(plan.promotionSlots).toBe(7);
      expect(plan.promotionCandidates.map(standing => standing.entityId)).toEqual([1, 2, 3, 4, 5]);
    },
  );

  it('should select opposite ends of one canonical ranking when all LP values are tied', () => {
    const standings: TestStanding[] = Array.from({ length: 20 }, (_, index) => ({
      entityId: index + 1,
      leaguePoints: 100,
      cyclesInTier: 5,
    }));

    const plan = planLeagueInstanceRebalancing(
      'silver_1',
      'silver',
      standings,
      HEAD_TO_HEAD_LEAGUE_RULES,
      selectors,
    );

    expect(plan.promotionZone.map(standing => standing.entityId)).toEqual([1, 2]);
    expect(plan.demotionZone.map(standing => standing.entityId)).toEqual([20, 19]);
  });

  it('should not backfill promotion positions when a top-zone entity is ineligible', () => {
    const standings: TestStanding[] = Array.from({ length: 20 }, (_, index) => ({
      entityId: index + 1,
      leaguePoints: 100 - index,
      cyclesInTier: index === 0 ? 4 : 5,
    }));

    const plan = planLeagueInstanceRebalancing(
      'silver_1',
      'silver',
      standings,
      HEAD_TO_HEAD_LEAGUE_RULES,
      selectors,
    );

    expect(plan.promotionZone.map(standing => standing.entityId)).toEqual([1, 2]);
    expect(plan.promotionCandidates.map(standing => standing.entityId)).toEqual([2]);
    expect(plan.promotionCandidates).not.toContainEqual(expect.objectContaining({ entityId: 3 }));
  });

  it('should not backfill demotion positions when a bottom-zone entity is ineligible', () => {
    const standings: TestStanding[] = Array.from({ length: 20 }, (_, index) => ({
      entityId: index + 1,
      leaguePoints: index,
      cyclesInTier: index === 0 ? 4 : 5,
    }));

    const plan = planLeagueInstanceRebalancing(
      'silver_1',
      'silver',
      standings,
      HEAD_TO_HEAD_LEAGUE_RULES,
      selectors,
    );

    expect(plan.demotionZone.map(standing => standing.entityId)).toEqual([1, 2]);
    expect(plan.demotionCandidates.map(standing => standing.entityId)).toEqual([2]);
    expect(plan.demotionCandidates).not.toContainEqual(expect.objectContaining({ entityId: 3 }));
  });

  it('should block two candidates but open an empty destination with three', () => {
    const twoCandidatePlan = planLeagueInstanceRebalancing(
      'bronze_1',
      'bronze',
      Array.from({ length: 20 }, (_, index) => ({
        entityId: index + 1,
        leaguePoints: 100 - index,
        cyclesInTier: 5,
      })),
      HEAD_TO_HEAD_LEAGUE_RULES,
      selectors,
    );
    const threeCandidatePlan = planLeagueInstanceRebalancing(
      'bronze_1',
      'bronze',
      Array.from({ length: 30 }, (_, index) => ({
        entityId: index + 1,
        leaguePoints: 100 - index,
        cyclesInTier: 5,
      })),
      HEAD_TO_HEAD_LEAGUE_RULES,
      selectors,
    );

    const blocked = planLeagueTierRebalancing(
      'bronze',
      [twoCandidatePlan],
      0,
      HEAD_TO_HEAD_LEAGUE_RULES,
    );
    const opened = planLeagueTierRebalancing(
      'bronze',
      [threeCandidatePlan],
      0,
      HEAD_TO_HEAD_LEAGUE_RULES,
    );

    expect(blocked.promotionCandidates).toHaveLength(2);
    expect(blocked.effectivePromotionCandidates).toEqual([]);
    expect(blocked.promotionBlockReason).toBe('destination_cohort_too_small');
    expect(opened.effectivePromotionCandidates).toHaveLength(3);
    expect(opened.promotionBlockReason).toBeNull();
  });
});