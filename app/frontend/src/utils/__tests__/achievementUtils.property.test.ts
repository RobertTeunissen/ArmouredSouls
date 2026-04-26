/**
 * Property-based tests for achievement utility functions.
 * Uses fast-check to verify universal correctness properties across generated inputs.
 *
 * Each test tagged with the property number and validated requirements.
 * Minimum 100 iterations per property.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getRarityLabel, filterAchievements, sortAchievements } from '../achievementUtils';
import type { AchievementWithProgress, AchievementFilters, AchievementSortOption } from '../achievementUtils';

// ─── Generators ──────────────────────────────────────────────────────────────

const TIERS = ['easy', 'medium', 'hard', 'very_hard', 'secret'] as const;

function mockAchievement(overrides: Partial<AchievementWithProgress> = {}): AchievementWithProgress {
  return {
    id: 'X1',
    name: 'Test',
    description: 'Test',
    category: 'combat',
    tier: 'easy',
    rewardCredits: 25000,
    rewardPrestige: 25,
    hidden: false,
    unlocked: false,
    unlockedAt: null,
    robotId: null,
    robotName: null,
    progress: null,
    isPinned: false,
    ...overrides,
  };
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 11: Rarity label classification', () => {
  /**
   * **Validates: Requirements 8.3**
   *
   * For any percentage value 0–100, getRarityLabel returns the correct label
   * matching the defined thresholds: Common (>75%), Uncommon (25–75%),
   * Rare (10–25%), Epic (1–10%), Legendary (≤1%).
   */
  it('returns correct label for any percentage 0-100', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 100, noNaN: true }), (pct) => {
        const result = getRarityLabel(pct);
        if (pct > 75) expect(result.label).toBe('Common');
        else if (pct > 25) expect(result.label).toBe('Uncommon');
        else if (pct > 10) expect(result.label).toBe('Rare');
        else if (pct > 1) expect(result.label).toBe('Epic');
        else expect(result.label).toBe('Legendary');
      }),
      { numRuns: 200 },
    );
  });
});

describe('Property 12: Achievement filter correctness', () => {
  /**
   * **Validates: Requirements 7.3**
   *
   * For any combination of tier and status filters applied to any list of
   * achievements, the result contains exactly those achievements that match
   * both the selected tier (or all tiers) and the selected status (or all).
   */
  it('filtered results match both tier and status criteria', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            tier: fc.constantFrom(...TIERS),
            unlocked: fc.boolean(),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        fc.constantFrom('all', ...TIERS),
        fc.constantFrom('all', 'locked', 'unlocked'),
        (items, tierFilter, statusFilter) => {
          const achievements = items.map((item, i) =>
            mockAchievement({ id: `T${i}`, tier: item.tier, unlocked: item.unlocked }),
          );
          const filters: AchievementFilters = { tier: tierFilter as AchievementFilters['tier'], status: statusFilter as AchievementFilters['status'] };
          const result = filterAchievements(achievements, filters);

          // Every result must match both filters
          for (const a of result) {
            if (tierFilter !== 'all') expect(a.tier).toBe(tierFilter);
            if (statusFilter === 'locked') expect(a.unlocked).toBe(false);
            if (statusFilter === 'unlocked') expect(a.unlocked).toBe(true);
          }

          // Result count must equal the count of matching items in the input
          const expectedCount = achievements.filter(a => {
            if (tierFilter !== 'all' && a.tier !== tierFilter) return false;
            if (statusFilter === 'locked' && a.unlocked) return false;
            if (statusFilter === 'unlocked' && !a.unlocked) return false;
            return true;
          }).length;
          expect(result).toHaveLength(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 13: Achievement sort correctness', () => {
  /**
   * **Validates: Requirements 7.4**
   *
   * For any sort option and any list of achievements, the sorted result
   * preserves all elements (same length, same IDs) — sorting is a permutation.
   */
  const SORT_OPTIONS: AchievementSortOption[] = [
    'default', 'tier_hard', 'tier_easy', 'status_locked', 'status_unlocked',
  ];

  it('sorted results preserve all elements', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ tier: fc.constantFrom(...TIERS), unlocked: fc.boolean() }),
          { minLength: 0, maxLength: 20 },
        ),
        fc.constantFrom(...SORT_OPTIONS),
        (items, sortOption) => {
          const achievements = items.map((item, i) =>
            mockAchievement({ id: `T${i}`, tier: item.tier, unlocked: item.unlocked }),
          );
          const result = sortAchievements(achievements, sortOption);

          // Length preserved
          expect(result).toHaveLength(achievements.length);

          // Same set of IDs
          const resultIds = new Set(result.map(a => a.id));
          const inputIds = new Set(achievements.map(a => a.id));
          expect(resultIds).toEqual(inputIds);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('tier_hard sort produces non-increasing tier order', () => {
    const TIER_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2, very_hard: 3, secret: 4 };

    fc.assert(
      fc.property(
        fc.array(
          fc.record({ tier: fc.constantFrom(...TIERS), unlocked: fc.boolean() }),
          { minLength: 2, maxLength: 20 },
        ),
        (items) => {
          const achievements = items.map((item, i) =>
            mockAchievement({ id: `T${i}`, tier: item.tier, unlocked: item.unlocked }),
          );
          const result = sortAchievements(achievements, 'tier_hard');

          // Each element's tier order should be >= the next (descending)
          for (let i = 0; i < result.length - 1; i++) {
            expect(TIER_ORDER[result[i].tier] ?? 0).toBeGreaterThanOrEqual(
              TIER_ORDER[result[i + 1].tier] ?? 0,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('tier_easy sort produces non-decreasing tier order', () => {
    const TIER_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2, very_hard: 3, secret: 4 };

    fc.assert(
      fc.property(
        fc.array(
          fc.record({ tier: fc.constantFrom(...TIERS), unlocked: fc.boolean() }),
          { minLength: 2, maxLength: 20 },
        ),
        (items) => {
          const achievements = items.map((item, i) =>
            mockAchievement({ id: `T${i}`, tier: item.tier, unlocked: item.unlocked }),
          );
          const result = sortAchievements(achievements, 'tier_easy');

          for (let i = 0; i < result.length - 1; i++) {
            expect(TIER_ORDER[result[i].tier] ?? 0).toBeLessThanOrEqual(
              TIER_ORDER[result[i + 1].tier] ?? 0,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
