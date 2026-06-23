/**
 * Factory for creating valid LeaderboardCache entries.
 *
 * Supports all 7 leaderboard categories with generation-based swap semantics.
 * Default generation is 1.
 *
 * Types defined locally to match the Prisma schema from Spec #40.
 * Once `prisma generate` is run after Tasks 1.1–1.5, these can be
 * replaced with imports from '../../generated/prisma'.
 */

export interface LeaderboardCache {
  id: number;
  category: string;
  rank: number;
  entityType: string;
  entityId: number;
  score: number;
  generation: number;
  updatedAt: Date;
}

let cacheIdCounter = 1000;

const LEADERBOARD_CATEGORIES = [
  'fame',
  'prestige',
  'losses',
  'koth_wins',
  'koth_zone_score',
  'career_wins',
  'team_wins',
] as const;

type LeaderboardCategory = (typeof LEADERBOARD_CATEGORIES)[number];

/**
 * Creates a valid LeaderboardCache entry with sensible defaults.
 * Default generation is 1, rank is 1, score is 100.
 */
export function createCacheEntry(overrides?: Partial<LeaderboardCache>): LeaderboardCache {
  const id = overrides?.id ?? ++cacheIdCounter;

  const base: LeaderboardCache = {
    id,
    category: 'fame',
    rank: 1,
    entityType: 'robot',
    entityId: id + 4000,
    score: 100,
    generation: 1,
    updatedAt: new Date(),
  };

  return { ...base, ...overrides };
}

/**
 * Creates N leaderboard entries for a given category with sequential ranks.
 * Scores descend from a high value, simulating a real leaderboard ordering.
 */
export function createLeaderboard(
  category: LeaderboardCategory,
  count: number,
  overrides?: Partial<Omit<LeaderboardCache, 'rank' | 'score' | 'category'>>
): LeaderboardCache[] {
  const entries: LeaderboardCache[] = [];
  const baseScore = 10000;
  const generation = overrides?.generation ?? 1;

  for (let i = 0; i < count; i++) {
    entries.push(
      createCacheEntry({
        ...overrides,
        category,
        rank: i + 1,
        entityId: (overrides?.entityId ?? 4000) + i,
        score: baseScore - i * 100,
        generation,
      })
    );
  }

  return entries;
}

export { LEADERBOARD_CATEGORIES, LeaderboardCategory };
