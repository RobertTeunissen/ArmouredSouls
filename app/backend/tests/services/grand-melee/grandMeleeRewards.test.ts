/**
 * Property-based and unit tests for Grand Melee Reward Calculation.
 *
 * Uses fast-check to verify correctness properties across all placements and tiers.
 * Each property test tagged: Feature: grand-melee-rewards, Property {N}: {title}
 *
 * Properties:
 *   P6: LP scale — LP delta matches GRAND_MELEE_LP_SCALE for top 10, 0 for 11+
 *   P7: Credit floor — Credits never fall below floor(TIER_CREDIT_BASE[tier] × 2.5 × 0.2)
 *
 * Unit tests:
 *   Specific placement/tier combinations with expected reward values
 *   Prestige HP bonus threshold behavior
 */

import { calculateGrandMeleeRewards, GRAND_MELEE_LP_SCALE, GRAND_MELEE_BASE_MULTIPLIER } from '../../../src/services/grand-melee/grandMeleeRewards';
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
    expect(result.prestige).toBe(0);
    expect(result.lpDelta).toBe(12);
  });

  it('should return correct rewards for 10th place gold', () => {
    const result = calculateGrandMeleeRewards(10, 'gold', 20);

    expect(result.credits).toBe(16500);
    expect(result.fame).toBe(2);
    expect(result.prestige).toBe(0);
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
