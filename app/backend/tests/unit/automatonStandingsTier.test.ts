/**
 * Shared Automaton standings-tier rules (admin Automatons page): played-only
 * highest tier with its mode, tie-break order, sort comparison and the
 * low-sample rule. The module lives in app/shared/utils and is reached through
 * the backend symlink.
 */
import {
  compareHighestTier,
  highestTierOf,
  isLowSample,
  isPlacementMode,
  isPlayedStanding,
  isTieredMode,
  matchesPlayed,
  tierRank,
  type StandingPlayInput,
} from '../../src/shared/utils/automatonStandingsTier';

const row = (mode: string, tier: string, played: Partial<Omit<StandingPlayInput, 'mode' | 'tier'>> = {}): StandingPlayInput => ({
  mode,
  tier,
  wins: 0,
  losses: 0,
  draws: 0,
  totalMatches: null,
  ...played,
});

describe('automatonStandingsTier', () => {
  describe('basic helpers', () => {
    it('ranks known tiers and returns -1 for unknown ones', () => {
      expect(tierRank('bronze')).toBe(0);
      expect(tierRank('champion')).toBe(5);
      expect(tierRank('mythic')).toBe(-1);
    });

    it('recognises tiered and placement modes', () => {
      expect(isTieredMode('league_1v1')).toBe(true);
      expect(isTieredMode('grand_melee')).toBe(true);
      expect(isTieredMode('tournament_1v1')).toBe(false);
      expect(isPlacementMode('koth')).toBe(true);
      expect(isPlacementMode('grand_melee')).toBe(true);
      expect(isPlacementMode('tag_team')).toBe(false);
    });

    it('counts matches from W+L+D for head-to-head modes and totalMatches for placement modes', () => {
      expect(matchesPlayed(row('league_2v2', 'gold', { wins: 3, losses: 1, draws: 1 }))).toBe(5);
      expect(matchesPlayed(row('koth', 'gold', { wins: 1, totalMatches: 5 }))).toBe(5);
      expect(matchesPlayed(row('grand_melee', 'gold'))).toBe(0);
    });
  });

  describe('isPlayedStanding', () => {
    it('treats default rows as unplayed (W/L/D 0, totalMatches null or 0)', () => {
      expect(isPlayedStanding(row('league_1v1', 'bronze'))).toBe(false);
      expect(isPlayedStanding(row('koth', 'bronze', { totalMatches: 0 }))).toBe(false);
    });

    it('counts draws-only and totalMatches-only rows as played', () => {
      expect(isPlayedStanding(row('tag_team', 'bronze', { draws: 1 }))).toBe(true);
      expect(isPlayedStanding(row('grand_melee', 'bronze', { totalMatches: 4 }))).toBe(true);
    });
  });

  describe('highestTierOf', () => {
    it('returns null for no rows and for unplayed rows only', () => {
      expect(highestTierOf([])).toBeNull();
      expect(highestTierOf([row('league_1v1', 'bronze'), row('koth', 'champion', { totalMatches: 0 })])).toBeNull();
    });

    it('ignores tournament modes and unknown tiers', () => {
      expect(highestTierOf([row('tournament_1v1', 'champion', { wins: 3 }), row('league_1v1', 'mythic', { wins: 3 })])).toBeNull();
      expect(highestTierOf([row('tournament_1v1', 'champion', { wins: 3 }), row('league_1v1', 'silver', { wins: 1 })])).toEqual({
        tier: 'silver',
        mode: 'league_1v1',
      });
    });

    it('ignores an unplayed higher-tier row', () => {
      expect(highestTierOf([row('koth', 'diamond'), row('league_1v1', 'silver', { wins: 2, losses: 1 })])).toEqual({
        tier: 'silver',
        mode: 'league_1v1',
      });
    });

    it('prefers the highest tier over a more-played lower tier', () => {
      expect(highestTierOf([row('league_1v1', 'silver', { wins: 40, losses: 30 }), row('league_3v3', 'gold', { wins: 1 })])).toEqual({
        tier: 'gold',
        mode: 'league_3v3',
      });
    });

    it('breaks a top-tier tie by most matches at that tier', () => {
      expect(highestTierOf([row('league_1v1', 'gold', { wins: 2, losses: 1 }), row('koth', 'gold', { wins: 1, totalMatches: 5 })])).toEqual({
        tier: 'gold',
        mode: 'koth',
      });
    });

    it('sums matches per mode across rows at the top tier', () => {
      expect(
        highestTierOf([
          row('league_1v1', 'gold', { wins: 2 }),
          row('league_1v1', 'gold', { wins: 2 }),
          row('koth', 'gold', { totalMatches: 3 }),
          row('league_1v1', 'silver', { wins: 50 }),
        ]),
      ).toEqual({ tier: 'gold', mode: 'league_1v1' });
    });

    it('breaks equal matches by the fixed mode order', () => {
      expect(highestTierOf([row('league_3v3', 'gold', { wins: 2 }), row('league_1v1', 'gold', { losses: 2 })])).toEqual({
        tier: 'gold',
        mode: 'league_1v1',
      });
      expect(highestTierOf([row('koth', 'diamond', { totalMatches: 1 }), row('tag_team', 'diamond', { draws: 1 })])).toEqual({
        tier: 'diamond',
        mode: 'tag_team',
      });
    });
  });

  describe('compareHighestTier', () => {
    const silver1v1 = { tier: 'silver', mode: 'league_1v1' } as const;
    const gold1v1 = { tier: 'gold', mode: 'league_1v1' } as const;
    const gold3v3 = { tier: 'gold', mode: 'league_3v3' } as const;
    const goldGrandMelee = { tier: 'gold', mode: 'grand_melee' } as const;
    const diamondKoth = { tier: 'diamond', mode: 'koth' } as const;

    it('orders by tier rank', () => {
      expect(compareHighestTier(silver1v1, gold1v1)).toBeLessThan(0);
      expect(compareHighestTier(diamondKoth, goldGrandMelee)).toBeGreaterThan(0);
      expect([diamondKoth, gold1v1, silver1v1].sort(compareHighestTier)).toEqual([silver1v1, gold1v1, diamondKoth]);
      expect(compareHighestTier(gold1v1, gold1v1)).toBe(0);
    });

    it('treats the same tier in different modes as a tie (callers break it)', () => {
      expect(compareHighestTier(gold1v1, gold3v3)).toBe(0);
      expect(compareHighestTier(gold3v3, gold1v1)).toBe(0);
      expect(compareHighestTier(goldGrandMelee, gold1v1)).toBe(0);
    });
  });

  describe('isLowSample', () => {
    it('is low below 5 stables or below 20 matches', () => {
      expect(isLowSample(4, 100)).toBe(true);
      expect(isLowSample(5, 19)).toBe(true);
      expect(isLowSample(5, 20)).toBe(false);
    });
  });
});
