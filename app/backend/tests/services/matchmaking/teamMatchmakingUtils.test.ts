import {
  calculateMatchScore,
  createByeTeam,
  getRecentOpponentsBatch,
  MatchScoreInput,
  LP_MATCH_IDEAL,
  LP_MATCH_FALLBACK,
  ELO_MATCH_IDEAL,
  ELO_MATCH_FALLBACK,
  RECENT_OPPONENT_PENALTY,
  SAME_STABLE_PENALTY,
  RECENT_OPPONENT_LIMIT,
} from '../../../src/services/matchmaking/teamMatchmakingUtils';

/**
 * Unit tests for the shared matchmaking module.
 * Tests LP-primary scoring, ELO secondary scoring, penalties, and utility functions.
 *
 * Validates: Requirements R4.1, R4.1a, R4.3, R4.5
 */

function makeInput(overrides: Partial<MatchScoreInput> = {}): MatchScoreInput {
  return {
    entity1LP: 100,
    entity2LP: 100,
    entity1ELO: 1200,
    entity2ELO: 1200,
    recentOpponents1: [],
    recentOpponents2: [],
    entity1Id: 1,
    entity2Id: 2,
    entity1StableId: 10,
    entity2StableId: 20,
    ...overrides,
  };
}

describe('teamMatchmakingUtils', () => {
  describe('calculateMatchScore — LP-primary scoring', () => {
    it('should use ×1 multiplier when LP diff ≤ 10 (ideal range)', () => {
      const input = makeInput({ entity1LP: 100, entity2LP: 105 });
      const score = calculateMatchScore(input);
      // LP component: 5 * 1 = 5, ELO component: 0 * 0.1 = 0
      expect(score).toBe(5);
    });

    it('should use ×1 multiplier at exactly LP diff = 10', () => {
      const input = makeInput({ entity1LP: 100, entity2LP: 110 });
      const score = calculateMatchScore(input);
      // LP component: 10 * 1 = 10, ELO component: 0
      expect(score).toBe(10);
    });

    it('should use ×5 multiplier when LP diff ≤ 20 (fallback range)', () => {
      const input = makeInput({ entity1LP: 100, entity2LP: 115 });
      const score = calculateMatchScore(input);
      // LP component: 15 * 5 = 75, ELO component: 0
      expect(score).toBe(75);
    });

    it('should use ×5 multiplier at exactly LP diff = 20', () => {
      const input = makeInput({ entity1LP: 100, entity2LP: 120 });
      const score = calculateMatchScore(input);
      // LP component: 20 * 5 = 100, ELO component: 0
      expect(score).toBe(100);
    });

    it('should use ×20 multiplier when LP diff > 20 (heavy penalty)', () => {
      const input = makeInput({ entity1LP: 100, entity2LP: 130 });
      const score = calculateMatchScore(input);
      // LP component: 30 * 20 = 600, ELO component: 0
      expect(score).toBe(600);
    });

    it('should handle LP diff symmetrically (entity2 > entity1)', () => {
      const input1 = makeInput({ entity1LP: 100, entity2LP: 125 });
      const input2 = makeInput({ entity1LP: 125, entity2LP: 100 });
      expect(calculateMatchScore(input1)).toBe(calculateMatchScore(input2));
    });

    it('should return 0 LP component when LP diff is 0', () => {
      const input = makeInput({ entity1LP: 100, entity2LP: 100 });
      const score = calculateMatchScore(input);
      // LP component: 0, ELO component: 0
      expect(score).toBe(0);
    });
  });

  describe('calculateMatchScore — ELO secondary scoring', () => {
    it('should use ×0.1 multiplier when ELO diff ≤ 150 (ideal range)', () => {
      const input = makeInput({ entity1ELO: 1200, entity2ELO: 1300 });
      const score = calculateMatchScore(input);
      // LP component: 0, ELO component: 100 * 0.1 = 10
      expect(score).toBe(10);
    });

    it('should use ×0.1 multiplier at exactly ELO diff = 150', () => {
      const input = makeInput({ entity1ELO: 1200, entity2ELO: 1350 });
      const score = calculateMatchScore(input);
      // LP component: 0, ELO component: 150 * 0.1 = 15
      expect(score).toBe(15);
    });

    it('should use ×0.5 multiplier when ELO diff ≤ 300 (fallback range)', () => {
      const input = makeInput({ entity1ELO: 1200, entity2ELO: 1400 });
      const score = calculateMatchScore(input);
      // LP component: 0, ELO component: 200 * 0.5 = 100
      expect(score).toBe(100);
    });

    it('should use ×0.5 multiplier at exactly ELO diff = 300', () => {
      const input = makeInput({ entity1ELO: 1200, entity2ELO: 1500 });
      const score = calculateMatchScore(input);
      // LP component: 0, ELO component: 300 * 0.5 = 150
      expect(score).toBe(150);
    });

    it('should use ×1.0 multiplier when ELO diff > 300 (beyond — no hard reject)', () => {
      const input = makeInput({ entity1ELO: 1200, entity2ELO: 1600 });
      const score = calculateMatchScore(input);
      // LP component: 0, ELO component: 400 * 1.0 = 400
      expect(score).toBe(400);
    });

    it('should NOT apply a +1000 cliff for large ELO differences (no hard reject)', () => {
      const input = makeInput({ entity1ELO: 1000, entity2ELO: 2000 });
      const score = calculateMatchScore(input);
      // ELO diff = 1000, multiplier ×1.0 → 1000. No +1000 cliff penalty.
      expect(score).toBe(1000);
      // Verify it's exactly eloDiff * 1.0, not eloDiff * 1.0 + 1000
      expect(score).not.toBe(2000);
    });

    it('should handle ELO diff symmetrically', () => {
      const input1 = makeInput({ entity1ELO: 1200, entity2ELO: 1500 });
      const input2 = makeInput({ entity1ELO: 1500, entity2ELO: 1200 });
      expect(calculateMatchScore(input1)).toBe(calculateMatchScore(input2));
    });

    it('should return 0 ELO component when ELO diff is 0', () => {
      const input = makeInput({ entity1ELO: 1200, entity2ELO: 1200 });
      const score = calculateMatchScore(input);
      // LP component: 0, ELO component: 0
      expect(score).toBe(0);
    });
  });

  describe('calculateMatchScore — recent-opponent penalty', () => {
    it('should add +400 when entity2 is in entity1 recent opponents', () => {
      const input = makeInput({ recentOpponents1: [2], entity2Id: 2 });
      const score = calculateMatchScore(input);
      expect(score).toBe(RECENT_OPPONENT_PENALTY);
    });

    it('should add +400 when entity1 is in entity2 recent opponents', () => {
      const input = makeInput({ recentOpponents2: [1], entity1Id: 1 });
      const score = calculateMatchScore(input);
      expect(score).toBe(RECENT_OPPONENT_PENALTY);
    });

    it('should add +800 when both directions have recent opponent match', () => {
      const input = makeInput({
        recentOpponents1: [2],
        recentOpponents2: [1],
        entity1Id: 1,
        entity2Id: 2,
      });
      const score = calculateMatchScore(input);
      expect(score).toBe(RECENT_OPPONENT_PENALTY * 2);
    });

    it('should not add penalty when recent opponents are empty', () => {
      const input = makeInput({ recentOpponents1: [], recentOpponents2: [] });
      const score = calculateMatchScore(input);
      expect(score).toBe(0);
    });

    it('should not add penalty when recent opponents do not include the other entity', () => {
      const input = makeInput({
        recentOpponents1: [3, 4, 5],
        recentOpponents2: [6, 7, 8],
        entity1Id: 1,
        entity2Id: 2,
      });
      const score = calculateMatchScore(input);
      expect(score).toBe(0);
    });
  });

  describe('calculateMatchScore — same-stable penalty', () => {
    it('should add +10000 when both entities are from the same stable', () => {
      const input = makeInput({ entity1StableId: 10, entity2StableId: 10 });
      const score = calculateMatchScore(input);
      expect(score).toBe(SAME_STABLE_PENALTY);
    });

    it('should not add penalty when entities are from different stables', () => {
      const input = makeInput({ entity1StableId: 10, entity2StableId: 20 });
      const score = calculateMatchScore(input);
      expect(score).toBe(0);
    });
  });

  describe('calculateMatchScore — combined scoring', () => {
    it('should combine LP, ELO, recent-opponent, and same-stable penalties', () => {
      const input = makeInput({
        entity1LP: 100,
        entity2LP: 115, // LP diff = 15 → 15 * 5 = 75
        entity1ELO: 1200,
        entity2ELO: 1300, // ELO diff = 100 → 100 * 0.1 = 10
        recentOpponents1: [2],
        recentOpponents2: [1],
        entity1Id: 1,
        entity2Id: 2, // Both directions → +800
        entity1StableId: 10,
        entity2StableId: 10, // Same stable → +10000
      });
      const score = calculateMatchScore(input);
      expect(score).toBe(75 + 10 + 800 + 10000);
    });

    it('should produce equal scores for two opponents with identical stats (tie-breaking scenario)', () => {
      const baseInput = makeInput({ entity1LP: 100, entity1ELO: 1200 });

      const scoreVsOpponent1 = calculateMatchScore({
        ...baseInput,
        entity2LP: 105,
        entity2ELO: 1250,
        entity2Id: 2,
        entity2StableId: 20,
      });

      const scoreVsOpponent2 = calculateMatchScore({
        ...baseInput,
        entity2LP: 105,
        entity2ELO: 1250,
        entity2Id: 3,
        entity2StableId: 30,
      });

      // Equal scores are possible — tie-breaking by creation timestamp is handled by the caller
      expect(scoreVsOpponent1).toBe(scoreVsOpponent2);
    });
  });

  describe('calculateMatchScore — edge cases', () => {
    it('should handle zero LP diff and zero ELO diff', () => {
      const input = makeInput({
        entity1LP: 50,
        entity2LP: 50,
        entity1ELO: 1000,
        entity2ELO: 1000,
      });
      expect(calculateMatchScore(input)).toBe(0);
    });

    it('should handle very large LP differences', () => {
      const input = makeInput({ entity1LP: 0, entity2LP: 100 });
      const score = calculateMatchScore(input);
      // LP diff = 100 → 100 * 20 = 2000
      expect(score).toBe(2000);
    });

    it('should handle very large ELO differences without hard reject', () => {
      const input = makeInput({ entity1ELO: 800, entity2ELO: 2500 });
      const score = calculateMatchScore(input);
      // ELO diff = 1700 → 1700 * 1.0 = 1700 (no cliff, no hard reject)
      expect(score).toBe(1700);
    });
  });

  describe('calculateMatchScore — constants verification', () => {
    it('should export correct constant values', () => {
      expect(LP_MATCH_IDEAL).toBe(10);
      expect(LP_MATCH_FALLBACK).toBe(20);
      expect(ELO_MATCH_IDEAL).toBe(150);
      expect(ELO_MATCH_FALLBACK).toBe(300);
      expect(RECENT_OPPONENT_PENALTY).toBe(400);
      expect(SAME_STABLE_PENALTY).toBe(10000);
      expect(RECENT_OPPONENT_LIMIT).toBe(5);
    });
  });

  describe('createByeTeam', () => {
    it('should call the factory with correct league and leagueId args', () => {
      const factory = jest.fn().mockReturnValue({ id: 99, name: 'Bye Team' });

      const result = createByeTeam(factory, 'bronze', 'bronze_1');

      expect(factory).toHaveBeenCalledWith('bronze', 'bronze_1');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: 99, name: 'Bye Team' });
    });

    it('should return whatever the factory returns', () => {
      const customObj = { teamId: 42, teamSize: 2, isBye: true };
      const factory = jest.fn().mockReturnValue(customObj);

      const result = createByeTeam(factory, 'gold', 'gold_2');

      expect(result).toBe(customObj);
    });

    it('should work with different league tiers', () => {
      const factory = jest.fn((league: string, leagueId: string) => ({
        league,
        leagueId,
      }));

      const result = createByeTeam(factory, 'champion', 'champion_1');

      expect(result).toEqual({ league: 'champion', leagueId: 'champion_1' });
    });
  });

  describe('getRecentOpponentsBatch', () => {
    it('should delegate to the query function and return its result', async () => {
      const expectedResult = new Map<number, number[]>([
        [1, [3, 4, 5]],
        [2, [6, 7]],
      ]);
      const queryFn = jest.fn().mockResolvedValue(expectedResult);

      const result = await getRecentOpponentsBatch([1, 2], queryFn);

      expect(queryFn).toHaveBeenCalledWith([1, 2], RECENT_OPPONENT_LIMIT);
      expect(result).toBe(expectedResult);
    });

    it('should pass custom limit to query function', async () => {
      const queryFn = jest.fn().mockResolvedValue(new Map());

      await getRecentOpponentsBatch([1, 2, 3], queryFn, 10);

      expect(queryFn).toHaveBeenCalledWith([1, 2, 3], 10);
    });

    it('should return empty map for empty entity IDs without calling query function', async () => {
      const queryFn = jest.fn().mockResolvedValue(new Map());

      const result = await getRecentOpponentsBatch([], queryFn);

      expect(queryFn).not.toHaveBeenCalled();
      expect(result).toEqual(new Map());
    });

    it('should use default limit of RECENT_OPPONENT_LIMIT when not specified', async () => {
      const queryFn = jest.fn().mockResolvedValue(new Map());

      await getRecentOpponentsBatch([1], queryFn);

      expect(queryFn).toHaveBeenCalledWith([1], 5);
    });
  });
});
