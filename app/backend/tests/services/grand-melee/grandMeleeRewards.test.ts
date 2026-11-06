/**
 * Property-based and unit tests for Grand Melee Reward Calculation.
 *
 * Uses fast-check to verify correctness properties across all placements and tiers.
 * Each property test tagged: Feature: grand-melee-rewards, Property {N}: {title}
 *
 * Properties:
 *   P6: LP scale — LP delta matches GRAND_MELEE_LP_SCALE for top 10, 0 for 11+
 *   P7: Credit floor — Credits never fall below floor(TIER_CREDIT_BASE[tier] × 2.5 × 0.2)
 *   P8: Prestige band — top 10 earn tier-scaled prestige, 11+ earn none (#576)
 *
 * Unit tests:
 *   Specific placement/tier combinations with expected reward values
 *   Prestige HP bonus threshold behavior
 */

import {
  calculateGrandMeleeRewards,
  GRAND_MELEE_BASE_MULTIPLIER,
  GRAND_MELEE_BASE_PRESTIGE,
  GRAND_MELEE_LP_SCALE,
} from '../../../src/services/grand-melee/grandMeleeRewards';
import { getTierFactor } from '../../../src/utils/economyFormulas';
import * as fc from 'fast-check';

// ─── Constants for property assertions ───────────────────────────────────────

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;

/** floor(TIER_CREDIT_BASE[tier] × 2.5 × 0.2) — minimum credits any placement can yield */
const TIER_CREDIT_FLOOR: Record<string, number> = {
  bronze: 3750,
  silver: 7500,
  gold: 15000,
  platinum: 30000,
  diamond: 57500,
  champion: 112500,
};

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe('Grand Melee Rewards — Property Tests', () => {
  /**
   * Property P6: LP scale
   *
   * For any placement 1-20, LP delta equals GRAND_MELEE_LP_SCALE[placement-1]
   * for positions 1-10, and 0 for positions 11-20.
   */
  it('P6: LP scale — LP delta matches F1 scale for top 10, 0 for 11-20', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.constantFrom(...TIERS),
        (placement, tier) => {
          const result = calculateGrandMeleeRewards(placement, tier, 20);

          if (placement <= 10) {
            expect(result.lpDelta).toBe(GRAND_MELEE_LP_SCALE[placement - 1]);
          } else {
            expect(result.lpDelta).toBe(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Property P7: Credit floor
   *
   * For any placement 1-20 and any tier, credits are always at least
   * floor(TIER_CREDIT_BASE[tier] × 2.5 × 0.2), which is the participation floor.
   */
  it('P7: Credit floor — credits >= floor(tierBase × 2.5 × 0.2) for any placement and tier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.constantFrom(...TIERS),
        (placement, tier) => {
          const result = calculateGrandMeleeRewards(placement, tier, 20);
          const floor = TIER_CREDIT_FLOOR[tier];

          expect(result.credits).toBeGreaterThanOrEqual(floor);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Property P8: Prestige band (#576)
   *
   * Places 1–10 earn floor(base × tier factor) (the winner's >50% HP bonus
   * aside); places 11–20 earn none.
   */
  it('P8: Prestige band — top 10 earn tier-scaled prestige, 11-20 earn none', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.constantFrom(...TIERS),
        (placement, tier) => {
          const result = calculateGrandMeleeRewards(placement, tier, 20);
          if (placement <= 10) {
            const expected = Math.floor(GRAND_MELEE_BASE_PRESTIGE[placement] * getTierFactor(tier));
            expect(result.prestige).toBe(expected);
            expect(result.prestige).toBeGreaterThan(0);
          } else {
            expect(result.prestige).toBe(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Grand Melee prestige curve (#576)', () => {
  it('pays 20/10/5/4/3/3/2/2/1/1 base prestige to places 1-10', () => {
    expect(Array.from({ length: 10 }, (_, i) => GRAND_MELEE_BASE_PRESTIGE[i + 1])).toEqual([20, 10, 5, 4, 3, 3, 2, 2, 1, 1]);
    expect(GRAND_MELEE_BASE_PRESTIGE[11]).toBeUndefined();
  });

  it.each([
    // tier, places 1..10 (no HP bonus)
    ['bronze', [20, 10, 5, 4, 3, 3, 2, 2, 1, 1]],
    ['silver', [30, 15, 7, 6, 4, 4, 3, 3, 1, 1]],
    ['gold', [40, 20, 10, 8, 6, 6, 4, 4, 2, 2]],
    ['platinum', [60, 30, 15, 12, 9, 9, 6, 6, 3, 3]],
    ['diamond', [90, 45, 22, 18, 13, 13, 9, 9, 4, 4]],
    ['champion', [140, 70, 35, 28, 21, 21, 14, 14, 7, 7]],
  ] as const)('%s pays %j', (tier, expected) => {
    expect(Array.from({ length: 10 }, (_, i) => calculateGrandMeleeRewards(i + 1, tier, 20).prestige)).toEqual(expected);
  });
});

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe('Grand Melee Rewards — Unit Tests', () => {
  it('should return correct rewards for 1st place bronze', () => {
    const result = calculateGrandMeleeRewards(1, 'bronze', 20);

    expect(result.credits).toBe(18750);
    expect(result.fame).toBe(12);
    expect(result.prestige).toBe(20);
    expect(result.lpDelta).toBe(25);
  });

  it('should return correct rewards for 4th place silver', () => {
    const result = calculateGrandMeleeRewards(4, 'silver', 20);

    expect(result.credits).toBe(20625);
    expect(result.fame).toBe(6);
    expect(result.prestige).toBe(6); // floor(4 × 1.5); 0 before #576
    expect(result.lpDelta).toBe(12);
  });

  it('should return correct rewards for 10th place gold', () => {
    const result = calculateGrandMeleeRewards(10, 'gold', 20);

    expect(result.credits).toBe(16500);
    expect(result.fame).toBe(2);
    expect(result.prestige).toBe(2); // floor(1 × 2.0); 0 before #576
    expect(result.lpDelta).toBe(1);
  });

  it('should return correct rewards for 20th place champion', () => {
    const result = calculateGrandMeleeRewards(20, 'champion', 20);

    expect(result.credits).toBe(112500);
    expect(result.fame).toBe(0);
    expect(result.prestige).toBe(0);
    expect(result.lpDelta).toBe(0);
  });

  it('should return participation floor rewards for 11th place bronze', () => {
    const result = calculateGrandMeleeRewards(11, 'bronze', 20);

    expect(result.credits).toBe(3750);
    expect(result.fame).toBe(0);
    expect(result.prestige).toBe(0);
    expect(result.lpDelta).toBe(0);
  });

  it('should apply prestige HP bonus when winner HP > 50%', () => {
    // 1st place diamond, HP=80% → prestige = floor(20 × 4.5 × 1.5) = 135
    const result = calculateGrandMeleeRewards(1, 'diamond', 20, 80);

    expect(result.prestige).toBe(135);
  });

  it('should NOT apply prestige HP bonus when winner HP <= 50%', () => {
    // 1st place diamond, HP=40% → prestige = floor(20 × 4.5) = 90
    const result = calculateGrandMeleeRewards(1, 'diamond', 20, 40);

    expect(result.prestige).toBe(90);
  });
});
