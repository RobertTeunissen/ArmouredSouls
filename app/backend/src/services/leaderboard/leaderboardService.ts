import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { isEnabled } from '../migration/featureFlags';

// ─── Types ───────────────────────────────────────────────────────────────────

type LeaderboardCategory =
  | 'fame'
  | 'prestige'
  | 'losses'
  | 'koth_wins'
  | 'koth_zone_score'
  | 'career_wins'
  | 'team_wins';

interface LeaderboardEntry {
  rank: number;
  entityType: 'robot' | 'user';
  entityId: number;
  score: number;
}

interface LeaderboardResult {
  entries: LeaderboardEntry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  updatedAt: Date | null;
}

const ALL_CATEGORIES: LeaderboardCategory[] = [
  'fame',
  'prestige',
  'losses',
  'koth_wins',
  'koth_zone_score',
  'career_wins',
  'team_wins',
];

const MAX_ENTRIES_PER_CATEGORY = 200;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Read the active leaderboard generation from cycle_metadata.featureFlags JSON.
 * Defaults to 0 if not set.
 */
async function getActiveGeneration(): Promise<number> {
  try {
    const row = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
      select: { featureFlags: true },
    });
    if (!row) return 0;
    const flags = row.featureFlags as Record<string, unknown>;
    const gen = flags?.leaderboard_active_generation;
    return typeof gen === 'number' ? gen : 0;
  } catch {
    return 0;
  }
}

/**
 * Update the active generation pointer in cycle_metadata.featureFlags JSON.
 */
async function setActiveGeneration(generation: number): Promise<void> {
  const row = await prisma.cycleMetadata.findUnique({
    where: { id: 1 },
    select: { featureFlags: true },
  });

  const existing = (row?.featureFlags as Record<string, unknown>) ?? {};
  const updated = { ...existing, leaderboard_active_generation: generation };

  await prisma.cycleMetadata.upsert({
    where: { id: 1 },
    update: { featureFlags: updated },
    create: { id: 1, featureFlags: updated },
  });
}

// ─── Refresh Logic ───────────────────────────────────────────────────────────

interface RankRow {
  entityType: 'robot' | 'user';
  entityId: number;
  score: number;
}

/**
 * Compute the top-200 entries for a given category from source tables.
 */
async function computeCategory(category: LeaderboardCategory): Promise<RankRow[]> {
  switch (category) {
    case 'fame': {
      const rows = await prisma.robot.findMany({
        orderBy: { fame: 'desc' },
        take: MAX_ENTRIES_PER_CATEGORY,
        select: { id: true, fame: true },
      });
      return rows.map((r) => ({ entityType: 'robot', entityId: r.id, score: Number(r.fame) }));
    }

    case 'prestige': {
      const rows = await prisma.user.findMany({
        orderBy: { prestige: 'desc' },
        take: MAX_ENTRIES_PER_CATEGORY,
        select: { id: true, prestige: true },
      });
      return rows.map((r) => ({ entityType: 'user', entityId: r.id, score: Number(r.prestige) }));
    }

    case 'losses': {
      const rows = await prisma.robot.findMany({
        orderBy: { losses: 'desc' },
        take: MAX_ENTRIES_PER_CATEGORY,
        select: { id: true, losses: true },
      });
      return rows.map((r) => ({ entityType: 'robot', entityId: r.id, score: Number(r.losses) }));
    }

    case 'koth_wins': {
      const rows = await prisma.standing.findMany({
        where: { mode: 'koth' },
        orderBy: { wins: 'desc' },
        take: MAX_ENTRIES_PER_CATEGORY,
        select: { entityId: true, wins: true },
      });
      return rows.map((r) => ({ entityType: 'robot', entityId: r.entityId, score: Number(r.wins) }));
    }

    case 'koth_zone_score': {
      const rows = await prisma.standing.findMany({
        where: { mode: 'koth' },
        orderBy: { totalZoneScore: 'desc' },
        take: MAX_ENTRIES_PER_CATEGORY,
        select: { entityId: true, totalZoneScore: true },
      });
      return rows.map((r) => ({
        entityType: 'robot',
        entityId: r.entityId,
        score: Number(r.totalZoneScore ?? 0),
      }));
    }

    case 'career_wins': {
      const rows = await prisma.robot.findMany({
        orderBy: { wins: 'desc' },
        take: MAX_ENTRIES_PER_CATEGORY,
        select: { id: true, wins: true },
      });
      return rows.map((r) => ({ entityType: 'robot', entityId: r.id, score: Number(r.wins) }));
    }

    case 'team_wins': {
      const rows = await prisma.standing.findMany({
        where: { mode: { in: ['league_2v2', 'league_3v3', 'tag_team'] } },
        orderBy: { wins: 'desc' },
        take: MAX_ENTRIES_PER_CATEGORY,
        select: { entityId: true, wins: true },
      });
      return rows.map((r) => ({ entityType: 'robot' as const, entityId: r.entityId, score: Number(r.wins) }));
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Recompute all 7 leaderboard categories using generation-swap semantics.
 *
 * 1. Read current active generation
 * 2. Insert new rankings with generation = active + 1
 * 3. Update the active generation pointer to active + 1
 * 4. Delete old generation rows (generation < new active)
 */
async function refreshAll(): Promise<void> {
  const enabled = await isEnabled('leaderboard_cache_active');
  if (!enabled) {
    logger.warn('[LeaderboardService] leaderboard_cache_active flag is disabled — skipping refresh');
    return;
  }

  const currentGen = await getActiveGeneration();
  const nextGen = currentGen + 1;

  logger.info(`[LeaderboardService] Refreshing all categories (gen ${currentGen} → ${nextGen})`);

  for (const category of ALL_CATEGORIES) {
    const rows = await computeCategory(category);

    // Build bulk-insert data with rank = 1-based index
    const data = rows.map((row, idx) => ({
      category,
      rank: idx + 1,
      entityType: row.entityType,
      entityId: row.entityId,
      score: row.score,
      generation: nextGen,
    }));

    if (data.length > 0) {
      await prisma.leaderboardCache.createMany({ data });
    }
  }

  // Swap: update the active generation pointer
  await setActiveGeneration(nextGen);

  // Cleanup: delete all rows from old generations
  await prisma.leaderboardCache.deleteMany({
    where: { generation: { lt: nextGen } },
  });

  logger.info(`[LeaderboardService] Refresh complete — active generation is now ${nextGen}`);
}

/**
 * Serve paginated leaderboard entries for a category from the cache.
 */
async function getLeaderboard(
  category: LeaderboardCategory,
  page: number,
  limit: number,
): Promise<LeaderboardResult> {
  const enabled = await isEnabled('leaderboard_cache_active');
  if (!enabled) {
    logger.warn('[LeaderboardService] leaderboard_cache_active flag is disabled — returning empty result');
    return {
      entries: [],
      pagination: { page, pageSize: limit, total: 0, totalPages: 0 },
      updatedAt: null,
    };
  }

  const activeGen = await getActiveGeneration();

  const total = await prisma.leaderboardCache.count({
    where: { category, generation: activeGen },
  });

  if (total === 0) {
    return {
      entries: [],
      pagination: { page, pageSize: limit, total: 0, totalPages: 0 },
      updatedAt: null,
    };
  }

  const offset = (page - 1) * limit;

  const rows = await prisma.leaderboardCache.findMany({
    where: { category, generation: activeGen },
    orderBy: { rank: 'asc' },
    skip: offset,
    take: limit,
  });

  const entries: LeaderboardEntry[] = rows.map((r) => ({
    rank: r.rank,
    entityType: r.entityType as 'robot' | 'user',
    entityId: r.entityId,
    score: r.score,
  }));

  const updatedAt = rows.length > 0 ? rows[0].updatedAt : null;
  const totalPages = Math.ceil(total / limit);

  return {
    entries,
    pagination: { page, pageSize: limit, total, totalPages },
    updatedAt,
  };
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const leaderboardService = {
  refreshAll,
  getLeaderboard,
};

export type { LeaderboardCategory, LeaderboardEntry, LeaderboardResult };
