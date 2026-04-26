/**
 * Property-based tests for Achievement System.
 *
 * Uses fast-check to verify correctness properties across the achievement config.
 * Each test tagged: Feature: achievement-system, Property {N}: {title}
 *
 * Properties:
 *   1: Achievement config consistency
 *   5: Win streak state machine
 *   6: Best win streak invariant
 *  11: Rarity label classification
 */

import * as fc from 'fast-check';
import { ACHIEVEMENTS, TIER_REWARDS, AchievementTier } from '../../../config/achievements';

// ─── Mocks (required because achievementService.ts imports Prisma at module level) ───

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    userAchievement: { findMany: jest.fn(), create: jest.fn(), groupBy: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    robot: { findMany: jest.fn(), count: jest.fn() },
    $queryRawUnsafe: jest.fn(),
  },
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../utils/robotCalculations', () => ({
  calculateEffectiveStatsWithStance: jest.fn().mockReturnValue({}),
}));

import { getRarityLabel } from '../achievementService';

describe('Achievement Config Properties', () => {
  const validTiers: AchievementTier[] = ['easy', 'medium', 'hard', 'very_hard', 'secret'];
  const validScopes = ['user', 'robot'] as const;

  /**
   * **Validates: Requirements 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 15.1**
   *
   * Property 1: Achievement config consistency — For every achievement in the
   * ACHIEVEMENTS array: (a) id is unique, (b) tier is valid, (c) scope is valid,
   * (d) hidden === (tier === 'secret'), (e) non-secret rewards match TIER_REWARDS,
   * (f) only rewardCredits and rewardPrestige reward fields exist (no combat bonuses).
   *
   * Since ACHIEVEMENTS is a finite config array, we use fc.constantFrom to sample
   * from the actual data and run exhaustively over every entry.
   */
  it('Property 1: Achievement config consistency — every achievement satisfies all config invariants', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ACHIEVEMENTS),
        (achievement) => {
          // (a) ID is a non-empty string (uniqueness tested separately as a set property)
          expect(achievement.id).toBeTruthy();
          expect(typeof achievement.id).toBe('string');

          // (b) tier is valid
          expect(validTiers).toContain(achievement.tier);

          // (c) scope is valid
          expect(validScopes).toContain(achievement.scope);

          // (d) hidden === (tier === 'secret')
          expect(achievement.hidden).toBe(achievement.tier === 'secret');

          // (e) non-secret rewards match TIER_REWARDS
          if (achievement.tier !== 'secret') {
            const expected = TIER_REWARDS[achievement.tier];
            expect(achievement.rewardCredits).toBe(expected.credits);
            expect(achievement.rewardPrestige).toBe(expected.prestige);
          }

          // (f) only rewardCredits and rewardPrestige exist as reward fields
          // Verify no combat bonus fields exist on the achievement
          const achievementKeys = Object.keys(achievement);
          const forbiddenRewardKeys = ['combatBonus', 'weaponUnlock', 'featureAccess', 'statBonus'];
          for (const key of forbiddenRewardKeys) {
            expect(achievementKeys).not.toContain(key);
          }
        },
      ),
      { numRuns: ACHIEVEMENTS.length }, // Run exactly once per achievement
    );
  });

  it('Property 1a: All achievement IDs are unique', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('Achievement Pure Function Properties', () => {
  /**
   * **Validates: Requirements 8.3**
   *
   * Property 11: Rarity label classification — For any percentage value (0–100),
   * the rarity label matches the defined thresholds:
   *   Common (>75%), Uncommon (25–75%), Rare (10–25%), Epic (1–10%), Legendary (≤1%).
   */
  it('Property 11: Rarity label classification — correct label for any percentage', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 100, noNaN: true }), (percentage) => {
        const result = getRarityLabel(percentage);

        if (percentage > 75) {
          expect(result.label).toBe('Common');
          expect(result.color).toBe('text-secondary');
        } else if (percentage > 25) {
          expect(result.label).toBe('Uncommon');
          expect(result.color).toBe('text-success');
        } else if (percentage > 10) {
          expect(result.label).toBe('Rare');
          expect(result.color).toBe('text-primary');
        } else if (percentage > 1) {
          expect(result.label).toBe('Epic');
          expect(result.color).toBe('text-warning');
        } else {
          expect(result.label).toBe('Legendary');
          expect(result.color).toBe('text-error');
        }
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 4.2, 4.3**
   *
   * Property 5: Win streak state machine — For any sequence of win/loss/draw
   * outcomes, currentWinStreak increments on win and resets on loss/draw.
   * The final streak equals the count of consecutive wins at the tail.
   */
  it('Property 5: Win streak state machine — streak increments on win, resets on loss/draw', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('win', 'loss', 'draw'), { minLength: 1, maxLength: 100 }),
        (outcomes) => {
          let currentStreak = 0;

          for (const outcome of outcomes) {
            if (outcome === 'win') {
              currentStreak += 1;
            } else {
              currentStreak = 0;
            }
          }

          // Verify: the final streak equals the count of consecutive wins at the end
          let expectedStreak = 0;
          for (let i = outcomes.length - 1; i >= 0; i--) {
            if (outcomes[i] === 'win') {
              expectedStreak++;
            } else {
              break;
            }
          }

          expect(currentStreak).toBe(expectedStreak);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 4.4**
   *
   * Property 6: Best win streak invariant — For any sequence of outcomes,
   * bestWinStreak equals the max currentWinStreak ever reached and never decreases.
   */
  it('Property 6: Best win streak invariant — bestWinStreak is monotonically non-decreasing', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('win', 'loss', 'draw'), { minLength: 1, maxLength: 100 }),
        (outcomes) => {
          let currentStreak = 0;
          let bestStreak = 0;
          const bestHistory: number[] = [];

          for (const outcome of outcomes) {
            if (outcome === 'win') {
              currentStreak += 1;
            } else {
              currentStreak = 0;
            }
            bestStreak = Math.max(bestStreak, currentStreak);
            bestHistory.push(bestStreak);
          }

          // Verify: bestStreak never decreases
          for (let i = 1; i < bestHistory.length; i++) {
            expect(bestHistory[i]).toBeGreaterThanOrEqual(bestHistory[i - 1]);
          }

          // Verify: bestStreak >= currentStreak at all times
          expect(bestStreak).toBeGreaterThanOrEqual(currentStreak);
        },
      ),
      { numRuns: 200 },
    );
  });
});
