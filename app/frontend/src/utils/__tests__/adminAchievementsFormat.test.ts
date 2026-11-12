import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  NOTE_LIMIT,
  TIER_ORDER,
  easierThanTier,
  formatRate,
  harderThanTier,
  medianDayLabel,
  readAchievementStables,
  sortAchievements,
  tierStrips,
  writeAchievementStables,
} from '../adminAchievementsFormat';
import type { AchievementAnalyticsRow, AchievementTier } from '@shared/types';

const row = (over: Partial<AchievementAnalyticsRow>): AchievementAnalyticsRow => ({
  achievementId: 'C1', name: 'A', description: '', category: 'combat', tier: 'easy', hidden: false,
  unlocked: 0, rate: 0, medianDay: null, unlockedAll: 0, ...over,
});

describe('URL state', () => {
  it('reads a known stable type and defaults to players', () => {
    expect(readAchievementStables(new URLSearchParams('stables=automatons'))).toBe('automatons');
    expect(readAchievementStables(new URLSearchParams('stables=all'))).toBe('players');
    expect(readAchievementStables(new URLSearchParams())).toBe('players');
  });

  it('keeps players out of the URL and other params intact', () => {
    expect(writeAchievementStables(new URLSearchParams('x=1'), 'generated').toString()).toBe('x=1&stables=generated');
    expect(writeAchievementStables(new URLSearchParams('stables=generated&x=1'), 'players').toString()).toBe('x=1');
  });
});

describe('labels', () => {
  it('names the median day, before the start, or nothing', () => {
    expect(medianDayLabel(12)).toBe('day 12');
    expect(medianDayLabel(1)).toBe('day 1');
    expect(medianDayLabel(0)).toBe('before start');
    expect(medianDayLabel(-2)).toBe('before start');
    expect(medianDayLabel(null)).toBe('—');
  });

  it('keeps one decimal only for small rates', () => {
    expect(formatRate(76.9)).toBe('77%');
    expect(formatRate(3.8)).toBe('3.8%');
    expect(formatRate(0)).toBe('0%');
    expect(formatRate(100)).toBe('100%');
  });
});

describe('tierStrips', () => {
  it('gives every tier in order with sorted rates and the lower median', () => {
    const strips = tierStrips([
      row({ tier: 'easy', rate: 90 }), row({ tier: 'easy', rate: 10 }), row({ tier: 'easy', rate: 50 }), row({ tier: 'easy', rate: 70 }),
      row({ tier: 'secret', rate: 4 }),
    ]);
    expect(strips.map((strip) => strip.tier)).toEqual([...TIER_ORDER]);
    expect(strips[0]).toEqual({ tier: 'easy', count: 4, rates: [10, 50, 70, 90], median: 50 });
    expect(strips[1]).toEqual({ tier: 'medium', count: 0, rates: [], median: null });
    expect(strips[4].median).toBe(4);
  });

  it('accounts for every achievement exactly once', () => {
    const tier = fc.constantFrom<AchievementTier>(...TIER_ORDER);
    fc.assert(fc.property(fc.array(fc.record({ tier, rate: fc.integer({ min: 0, max: 100 }) }), { maxLength: 60 }), (input) => {
      const strips = tierStrips(input.map((entry) => row(entry)));
      expect(strips.reduce((sum, strip) => sum + strip.count, 0)).toBe(input.length);
    }));
  });
});

describe('balance notes', () => {
  const rows = [
    row({ achievementId: 'H1', tier: 'hard', rate: 80 }),
    row({ achievementId: 'H2', tier: 'very_hard', rate: 95 }),
    row({ achievementId: 'H3', tier: 'hard', rate: 79.9 }),
    row({ achievementId: 'S1', tier: 'secret', rate: 100 }),
    row({ achievementId: 'E1', tier: 'easy', rate: 25 }),
    row({ achievementId: 'M1', tier: 'medium', rate: 0 }),
    row({ achievementId: 'E2', tier: 'easy', rate: 25.1 }),
  ];

  it('lists hard and very hard achievements at 80%+, highest first, never secrets', () => {
    expect(easierThanTier(rows).map((r) => r.achievementId)).toEqual(['H2', 'H1']);
  });

  it('lists easy and medium achievements at 25% or less, lowest first', () => {
    expect(harderThanTier(rows).map((r) => r.achievementId)).toEqual(['M1', 'E1']);
  });

  it('caps each note', () => {
    const many = Array.from({ length: 10 }, (_, index) => row({ achievementId: `E${index}`, tier: 'easy', rate: index }));
    expect(harderThanTier(many)).toHaveLength(NOTE_LIMIT);
  });
});

describe('sortAchievements', () => {
  const rows = [
    row({ achievementId: 'C2', name: 'Bravo', category: 'league', tier: 'hard', unlocked: 5, medianDay: 9, unlockedAll: 9 }),
    row({ achievementId: 'C10', name: 'Alpha', category: 'combat', tier: 'easy', unlocked: 5, medianDay: null, unlockedAll: 7 }),
    row({ achievementId: 'C1', name: 'Charlie', category: 'style', tier: 'medium', unlocked: 8, medianDay: 2, unlockedAll: 8 }),
  ];
  const ids = (sorted: AchievementAnalyticsRow[]) => sorted.map((r) => r.achievementId);

  it('sorts numbers and text, breaking ties by numeric id', () => {
    expect(ids(sortAchievements(rows, 'unlocked', 'desc'))).toEqual(['C1', 'C2', 'C10']);
    expect(ids(sortAchievements(rows, 'name', 'asc'))).toEqual(['C10', 'C2', 'C1']);
    expect(ids(sortAchievements(rows, 'tier', 'asc'))).toEqual(['C10', 'C1', 'C2']);
    expect(ids(sortAchievements(rows, 'category', 'asc'))).toEqual(['C10', 'C2', 'C1']);
    expect(ids(sortAchievements(rows, 'unlockedAll', 'desc'))).toEqual(['C2', 'C1', 'C10']);
  });

  it('keeps achievements nobody unlocked last by median day in both directions', () => {
    expect(ids(sortAchievements(rows, 'medianDay', 'asc'))).toEqual(['C1', 'C2', 'C10']);
    expect(ids(sortAchievements(rows, 'medianDay', 'desc'))).toEqual(['C2', 'C1', 'C10']);
  });

  it('does not mutate its input', () => {
    const before = ids(rows);
    sortAchievements(rows, 'name', 'desc');
    expect(ids(rows)).toEqual(before);
  });
});
