/**
 * Unit tests for battleMath — ELO calculation utilities.
 *
 * Validates: Requirements 4.1 (ELO system), critical combat math.
 *
 * Tests the ELO calculation functions that underpin all competitive
 * ranking in the game (1v1 league, tag team, tournaments).
 */

import {
  calculateExpectedScore,
  calculateELOChange,
  ELO_K_FACTOR,
  PRESTIGE_BY_LEAGUE,
  FAME_BY_LEAGUE,
} from '../../src/utils/battleMath';

describe('calculateExpectedScore', () => {
  it('should return 0.5 for equal ratings', () => {
    expect(calculateExpectedScore(1200, 1200)).toBeCloseTo(0.5);
  });

  it('should return > 0.5 for higher-rated player', () => {
    const expected = calculateExpectedScore(1400, 1200);
    expect(expected).toBeGreaterThan(0.5);
    expect(expected).toBeLessThan(1);
  });

  it('should return < 0.5 for lower-rated player', () => {
    const expected = calculateExpectedScore(1200, 1400);
    expect(expected).toBeLessThan(0.5);
    expect(expected).toBeGreaterThan(0);
  });

  it('should be symmetric (probabilities sum to 1)', () => {
    const expectedA = calculateExpectedScore(1200, 1500);
    const expectedB = calculateExpectedScore(1500, 1200);
    expect(expectedA + expectedB).toBeCloseTo(1.0);
  });

  it('should produce ~0.76 for 200-point advantage', () => {
    // Standard ELO: 200 point difference ≈ 76% expected
    const expected = calculateExpectedScore(1400, 1200);
    expect(expected).toBeCloseTo(0.76, 1);
  });

  it('should produce ~0.91 for 400-point advantage', () => {
    // Standard ELO: 400 point difference ≈ 91% expected
    const expected = calculateExpectedScore(1600, 1200);
    expect(expected).toBeCloseTo(0.91, 1);
  });
});

describe('calculateELOChange', () => {
  it('should give positive change to winner and negative to loser', () => {
    const { winnerChange, loserChange } = calculateELOChange(1200, 1200);
    expect(winnerChange).toBeGreaterThan(0);
    expect(loserChange).toBeLessThan(0);
  });

  it('should give larger change when upset occurs (lower beats higher)', () => {
    const upset = calculateELOChange(1000, 1400); // low ELO beats high ELO
    const expected = calculateELOChange(1400, 1000); // high ELO beats low ELO
    expect(upset.winnerChange).toBeGreaterThan(expected.winnerChange);
  });

  it('should give +16/-16 for equal ratings (win)', () => {
    const { winnerChange, loserChange } = calculateELOChange(1200, 1200);
    expect(winnerChange).toBe(16);
    expect(loserChange).toBe(-16);
  });

  it('should produce zero-sum changes for equal ratings', () => {
    const { winnerChange, loserChange } = calculateELOChange(1200, 1200);
    expect(winnerChange + loserChange).toBe(0);
  });

  it('should handle draws — both players move toward expected', () => {
    const { winnerChange, loserChange } = calculateELOChange(1200, 1200, true);
    // Equal ratings draw = 0 change for both
    expect(winnerChange).toBe(0);
    expect(loserChange).toBe(0);
  });

  it('should handle draws with rating difference', () => {
    // Higher-rated player draws against lower-rated = negative for higher
    const { winnerChange, loserChange } = calculateELOChange(1400, 1200, true);
    expect(winnerChange).toBeLessThan(0); // "winner" param loses points on draw
    expect(loserChange).toBeGreaterThan(0); // "loser" param gains points on draw
  });

  it('should use K-factor of 32', () => {
    expect(ELO_K_FACTOR).toBe(32);
    // For equal ratings: change = K * (1 - 0.5) = 32 * 0.5 = 16
    const { winnerChange } = calculateELOChange(1200, 1200);
    expect(winnerChange).toBe(16);
  });

  it('should produce integer results (rounded)', () => {
    const { winnerChange, loserChange } = calculateELOChange(1234, 1567);
    expect(Number.isInteger(winnerChange)).toBe(true);
    expect(Number.isInteger(loserChange)).toBe(true);
  });
});

describe('PRESTIGE_BY_LEAGUE', () => {
  it('should have increasing prestige values as tiers go up', () => {
    const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];
    for (let i = 1; i < tiers.length; i++) {
      expect(PRESTIGE_BY_LEAGUE[tiers[i]]).toBeGreaterThan(PRESTIGE_BY_LEAGUE[tiers[i - 1]]);
    }
  });

  it('should have all 6 tiers defined', () => {
    expect(Object.keys(PRESTIGE_BY_LEAGUE)).toHaveLength(6);
  });
});

describe('FAME_BY_LEAGUE', () => {
  it('should have increasing fame values as tiers go up', () => {
    const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];
    for (let i = 1; i < tiers.length; i++) {
      expect(FAME_BY_LEAGUE[tiers[i]]).toBeGreaterThan(FAME_BY_LEAGUE[tiers[i - 1]]);
    }
  });

  it('should have all 6 tiers defined', () => {
    expect(Object.keys(FAME_BY_LEAGUE)).toHaveLength(6);
  });
});
