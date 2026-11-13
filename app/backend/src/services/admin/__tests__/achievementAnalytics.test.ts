/**
 * Unit tests of the admin Achievements analytics: season-scoped rates out of
 * the players active this season, the median unlock day, the "all accounts"
 * count, and the stable-type scoping of the queries.
 */
const mockPrisma = {
  user: { findMany: jest.fn() },
  userAchievement: { findMany: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../season/seasonService', () => ({ getCurrentSeason: jest.fn().mockResolvedValue({ seasonNumber: 1 }) }));
jest.mock('../../season/dormantStables', () => ({
  ...jest.requireActual('../../season/dormantStables'),
  seasonStartedAt: jest.fn().mockResolvedValue(new Date('2026-08-01T00:00:00Z')),
}));

import type { AchievementDefinition } from '../../../config/achievements';
import { buildStableScopeFilter } from '../../../utils/stableScope';
import { getAchievementAnalytics } from '../achievements';
import { seasonDay, summarizeAchievements } from '../achievements/achievementAnalyticsService';

const START = new Date('2026-08-01T00:00:00Z');
const at = (iso: string): Date => new Date(iso);

const catalogue = [
  { id: 'C1', name: 'First win', description: 'Win once', category: 'combat', tier: 'easy', hidden: false },
  { id: 'C8', name: 'Hundred wins', description: 'Win 100', category: 'combat', tier: 'very_hard', hidden: false },
  { id: 'S1', name: 'Secret', description: 'Hidden', category: 'style', tier: 'secret', hidden: true },
] as unknown as AchievementDefinition[];

// Players 1–3 logged in this season; 4 last logged in before it started (dormant).
const users = [
  { id: 1, lastLoginAt: at('2026-10-30T10:00:00Z'), createdAt: at('2026-01-01T00:00:00Z') },
  { id: 2, lastLoginAt: at('2026-08-02T10:00:00Z'), createdAt: at('2026-01-01T00:00:00Z') },
  { id: 3, lastLoginAt: null, createdAt: at('2026-09-10T00:00:00Z') },
  { id: 4, lastLoginAt: at('2026-07-15T00:00:00Z'), createdAt: at('2026-01-01T00:00:00Z') },
];

const unlocks = [
  { userId: 1, achievementId: 'C1', unlockedAt: at('2026-07-31T23:00:00Z') }, // rollover re-award / preparation
  { userId: 2, achievementId: 'C1', unlockedAt: at('2026-08-03T12:00:00Z') }, // day 3
  { userId: 3, achievementId: 'C1', unlockedAt: at('2026-09-11T00:00:00Z') }, // day 42
  { userId: 4, achievementId: 'C1', unlockedAt: at('2026-07-20T00:00:00Z') }, // dormant: all accounts only
  { userId: 4, achievementId: 'C8', unlockedAt: at('2026-07-20T00:00:00Z') },
];

describe('seasonDay', () => {
  it('is 1 on the start day and 0 or less before it', () => {
    expect(seasonDay(START, START)).toBe(1);
    expect(seasonDay(at('2026-08-01T23:59:59Z'), START)).toBe(1);
    expect(seasonDay(at('2026-08-02T00:00:00Z'), START)).toBe(2);
    expect(seasonDay(at('2026-07-31T23:00:00Z'), START)).toBe(0);
  });
});

describe('summarizeAchievements', () => {
  it('rates players out of those active this season and keeps dormant unlocks in the all-accounts count', () => {
    const result = summarizeAchievements({ stables: 'players', catalogue, users, unlocks, seasonNumber: 1, startedAt: START });

    expect(result).toMatchObject({
      stables: 'players', seasonNumber: 1, seasonStartedAt: START.toISOString(),
      population: 3, totalStables: 4, totalAchievements: 3, unlockedBySomeone: 1, unlocks: 3,
    });
    const [c1, c8, s1] = result.achievements;
    expect(c1).toMatchObject({ achievementId: 'C1', unlocked: 3, rate: 100, medianDay: 3, unlockedAll: 4, tier: 'easy', hidden: false });
    expect(c8).toMatchObject({ achievementId: 'C8', unlocked: 0, rate: 0, medianDay: null, unlockedAll: 1 });
    expect(s1).toMatchObject({ achievementId: 'S1', unlocked: 0, unlockedAll: 0, hidden: true, tier: 'secret' });
  });

  it('counts every stable for Automatons and generated stables (they never log in)', () => {
    const result = summarizeAchievements({ stables: 'automatons', catalogue, users, unlocks, seasonNumber: 1, startedAt: START });

    expect(result.population).toBe(4);
    expect(result.achievements[0]).toMatchObject({ achievementId: 'C1', unlocked: 4, rate: 100 });
  });

  it('counts a stable once per achievement and is empty-safe', () => {
    const doubled = [...unlocks, { userId: 2, achievementId: 'C1', unlockedAt: at('2026-08-20T00:00:00Z') }];
    expect(summarizeAchievements({ stables: 'players', catalogue, users, unlocks: doubled, seasonNumber: 1, startedAt: START }).achievements[0].unlocked).toBe(3);

    const empty = summarizeAchievements({ stables: 'players', catalogue, users: [], unlocks: [], seasonNumber: 1, startedAt: START });
    expect(empty).toMatchObject({ population: 0, unlocks: 0, unlockedBySomeone: 0 });
    expect(empty.achievements.every((row) => row.rate === 0)).toBe(true);
  });

  it('counts every player and leaves the median day empty without a season start', () => {
    const result = summarizeAchievements({ stables: 'players', catalogue, users, unlocks, seasonNumber: 0, startedAt: null });
    expect(result.population).toBe(4);
    expect(result.achievements[0]).toMatchObject({ unlocked: 4, medianDay: null });
  });
});

describe('getAchievementAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findMany.mockResolvedValue(users);
    mockPrisma.userAchievement.findMany.mockResolvedValue(unlocks);
  });

  it.each(['players', 'automatons', 'generated'] as const)('scopes the queries for %s to the shared stable-type filter', async (stables) => {
    const result = await getAchievementAnalytics(stables);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: buildStableScopeFilter(stables) }));
    expect(mockPrisma.userAchievement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { user: buildStableScopeFilter(stables) } }));
    expect(result.stables).toBe(stables);
    expect(result.seasonStartedAt).toBe(START.toISOString());
  });
});
