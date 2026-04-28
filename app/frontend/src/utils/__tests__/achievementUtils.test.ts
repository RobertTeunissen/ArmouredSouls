import { describe, it, expect } from 'vitest';
import {
  getTierColor,
  getTierLabel,
  getRarityLabel,
  filterAchievements,
  sortAchievements,
} from '../achievementUtils';
import type { AchievementWithProgress } from '../achievementUtils';

// Helper to create a mock achievement
function mockAchievement(overrides: Partial<AchievementWithProgress> = {}): AchievementWithProgress {
  return {
    id: 'C1',
    name: 'Test',
    description: 'Test achievement',
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

describe('getTierColor', () => {
  it('returns correct colors for each tier', () => {
    expect(getTierColor('easy')).toBe('#3fb950');
    expect(getTierColor('medium')).toBe('#58a6ff');
    expect(getTierColor('hard')).toBe('#d29922');
    expect(getTierColor('very_hard')).toBe('#f85149');
    expect(getTierColor('secret')).toBe('#a371f7');
    expect(getTierColor('unknown')).toBe('#8b949e');
  });
});

describe('getTierLabel', () => {
  it('returns correct labels for each tier', () => {
    expect(getTierLabel('easy')).toBe('Easy');
    expect(getTierLabel('medium')).toBe('Medium');
    expect(getTierLabel('hard')).toBe('Hard');
    expect(getTierLabel('very_hard')).toBe('Very Hard');
    expect(getTierLabel('secret')).toBe('Secret');
  });
});

describe('getRarityLabel', () => {
  it('returns correct labels for boundary values', () => {
    expect(getRarityLabel(100)).toEqual({ label: 'Common', color: 'text-secondary' });
    expect(getRarityLabel(76)).toEqual({ label: 'Common', color: 'text-secondary' });
    expect(getRarityLabel(75)).toEqual({ label: 'Uncommon', color: 'text-success' });
    expect(getRarityLabel(26)).toEqual({ label: 'Uncommon', color: 'text-success' });
    expect(getRarityLabel(25)).toEqual({ label: 'Rare', color: 'text-primary' });
    expect(getRarityLabel(11)).toEqual({ label: 'Rare', color: 'text-primary' });
    expect(getRarityLabel(10)).toEqual({ label: 'Epic', color: 'text-warning' });
    expect(getRarityLabel(2)).toEqual({ label: 'Epic', color: 'text-warning' });
    expect(getRarityLabel(1)).toEqual({ label: 'Legendary', color: 'text-error' });
    expect(getRarityLabel(0)).toEqual({ label: 'Legendary', color: 'text-error' });
  });
});

describe('filterAchievements', () => {
  const achievements = [
    mockAchievement({ id: 'C1', tier: 'easy', unlocked: true }),
    mockAchievement({ id: 'C2', tier: 'easy', unlocked: false }),
    mockAchievement({ id: 'C3', tier: 'medium', unlocked: true }),
    mockAchievement({ id: 'C4', tier: 'hard', unlocked: false }),
    mockAchievement({ id: 'C5', tier: 'secret', unlocked: false, hidden: true }),
  ];

  it('returns all when no filters applied', () => {
    const result = filterAchievements(achievements, { tier: 'all', status: 'all' });
    expect(result).toHaveLength(5);
  });

  it('filters by tier', () => {
    const result = filterAchievements(achievements, { tier: 'easy', status: 'all' });
    expect(result).toHaveLength(2);
    expect(result.every(a => a.tier === 'easy')).toBe(true);
  });

  it('filters by locked status', () => {
    const result = filterAchievements(achievements, { tier: 'all', status: 'locked' });
    expect(result).toHaveLength(3);
    expect(result.every(a => !a.unlocked)).toBe(true);
  });

  it('filters by unlocked status', () => {
    const result = filterAchievements(achievements, { tier: 'all', status: 'unlocked' });
    expect(result).toHaveLength(2);
    expect(result.every(a => a.unlocked)).toBe(true);
  });

  it('combines tier and status filters', () => {
    const result = filterAchievements(achievements, { tier: 'easy', status: 'unlocked' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('C1');
  });
});

describe('sortAchievements', () => {
  const achievements = [
    mockAchievement({ id: 'C1', tier: 'easy', unlocked: true }),
    mockAchievement({ id: 'C2', tier: 'hard', unlocked: false }),
    mockAchievement({ id: 'C3', tier: 'medium', unlocked: true }),
  ];

  it('returns same order for default sort', () => {
    const result = sortAchievements(achievements, 'default');
    expect(result.map(a => a.id)).toEqual(['C1', 'C2', 'C3']);
  });

  it('sorts by tier hardest first', () => {
    const result = sortAchievements(achievements, 'tier_hard');
    expect(result[0].tier).toBe('hard');
    expect(result[result.length - 1].tier).toBe('easy');
  });

  it('sorts by tier easiest first', () => {
    const result = sortAchievements(achievements, 'tier_easy');
    expect(result[0].tier).toBe('easy');
    expect(result[result.length - 1].tier).toBe('hard');
  });

  it('sorts by status unlocked first', () => {
    const result = sortAchievements(achievements, 'status_unlocked');
    expect(result[0].unlocked).toBe(true);
    expect(result[1].unlocked).toBe(true);
    expect(result[2].unlocked).toBe(false);
  });

  it('sorts by status locked first', () => {
    const result = sortAchievements(achievements, 'status_locked');
    expect(result[0].unlocked).toBe(false);
  });

  it('sorts by rarity rarest first', () => {
    const rarityCounts = { C1: 10, C2: 1, C3: 5 };
    const result = sortAchievements(achievements, 'rarity_asc', rarityCounts);
    expect(result[0].id).toBe('C2'); // 1 earner = rarest
    expect(result[2].id).toBe('C1'); // 10 earners = most common
  });
});
