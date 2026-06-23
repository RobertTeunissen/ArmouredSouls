/**
 * Achievement Queries
 * Read-only API methods: getRecentUnlocks, updatePinnedAchievements,
 * getStableAchievements, refreshRarityCache, getRarityLabel.
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { ACHIEVEMENTS, getAchievementById } from '../../config/achievements';
import { AchievementError, AchievementErrorCode } from '../../errors/achievementErrors';
import type {
  UnlockedAchievement,
  PinnedAchievement,
  StableAchievementData,
  AchievementRarityCache,
} from './achievementTypes';

// ─── Recent Unlocks ──────────────────────────────────────────────────

export async function getRecentUnlocks(
  userId: number,
  limit: number = 10,
  since?: Date,
): Promise<(UnlockedAchievement & { unlockedAt: string })[]> {
  const where: { userId: number; unlockedAt?: { gt: Date } } = { userId };
  if (since) {
    where.unlockedAt = { gt: since };
  }

  const recentRecords = await prisma.userAchievement.findMany({
    where,
    orderBy: { unlockedAt: 'desc' },
    take: limit,
    select: {
      achievementId: true, robotId: true, unlockedAt: true,
      robot: { select: { name: true } },
    },
  });

  const results: (UnlockedAchievement & { unlockedAt: string })[] = [];
  for (const record of recentRecords) {
    const definition = getAchievementById(record.achievementId);
    if (!definition) continue;
    results.push({
      id: definition.id, name: definition.name, description: definition.description,
      tier: definition.tier, rewardCredits: definition.rewardCredits,
      rewardPrestige: definition.rewardPrestige, badgeIconFile: definition.badgeIconFile,
      robotId: record.robotId, robotName: record.robot?.name ?? null,
      unlockedAt: record.unlockedAt.toISOString(),
    });
  }
  return results;
}

// ─── Pinned Achievements ─────────────────────────────────────────────

export async function updatePinnedAchievements(
  userId: number,
  achievementIds: string[],
): Promise<void> {
  if (achievementIds.length > 6) {
    throw new AchievementError(
      AchievementErrorCode.TOO_MANY_PINNED,
      'Cannot pin more than 6 achievements',
      400,
      { count: achievementIds.length, max: 6 },
    );
  }

  for (const id of achievementIds) {
    if (!getAchievementById(id)) {
      throw new AchievementError(
        AchievementErrorCode.INVALID_ACHIEVEMENT_ID,
        `Achievement ID "${id}" does not exist`,
        400,
        { achievementId: id },
      );
    }
  }

  const unlocks = await prisma.userAchievement.findMany({
    where: { userId, achievementId: { in: achievementIds } },
    select: { achievementId: true },
  });
  const unlockedIds = new Set(unlocks.map((u) => u.achievementId));

  for (const id of achievementIds) {
    if (!unlockedIds.has(id)) {
      throw new AchievementError(
        AchievementErrorCode.ACHIEVEMENT_NOT_UNLOCKED,
        `Achievement "${id}" is not unlocked`,
        400,
        { achievementId: id },
      );
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { pinnedAchievements: achievementIds },
  });
}

// ─── Stable Achievement Data ─────────────────────────────────────────

export async function getStableAchievements(userId: number): Promise<StableAchievementData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pinnedAchievements: true },
  });

  if (!user) {
    return { pinned: [], totalUnlocked: 0, totalAvailable: ACHIEVEMENTS.filter((a) => !a.hidden).length };
  }

  const pinnedIds = Array.isArray(user.pinnedAchievements)
    ? (user.pinnedAchievements as string[])
    : [];

  const pinnedUnlocks = pinnedIds.length > 0
    ? await prisma.userAchievement.findMany({
        where: { userId, achievementId: { in: pinnedIds } },
        select: { achievementId: true, unlockedAt: true },
      })
    : [];

  const unlockMap = new Map(
    pinnedUnlocks.map((u) => [u.achievementId, u.unlockedAt.toISOString()]),
  );

  const pinned: PinnedAchievement[] = [];
  for (const id of pinnedIds) {
    const definition = getAchievementById(id);
    const unlockedAt = unlockMap.get(id);
    if (definition && unlockedAt) {
      pinned.push({
        id: definition.id, name: definition.name, tier: definition.tier,
        badgeIconFile: definition.badgeIconFile, unlockedAt,
      });
    }
  }

  const totalUnlocked = await prisma.userAchievement.count({ where: { userId } });
  const earnedHiddenCount = await prisma.userAchievement.count({
    where: { userId, achievementId: { in: ACHIEVEMENTS.filter((a) => a.hidden).map((a) => a.id) } },
  });
  const nonHiddenCount = ACHIEVEMENTS.filter((a) => !a.hidden).length;
  const totalAvailable = nonHiddenCount + earnedHiddenCount;

  return { pinned, totalUnlocked, totalAvailable };
}

// ─── Rarity Cache ────────────────────────────────────────────────────

export async function refreshRarityCache(cache: AchievementRarityCache): Promise<AchievementRarityCache> {
  try {
    const achievementCounts = await prisma.userAchievement.groupBy({
      by: ['achievementId'],
      _count: { achievementId: true },
      where: {
        user: {
          username: { not: { startsWith: 'auto_' } },
          AND: { username: { not: { startsWith: 'test_user_' } } },
        },
      },
    });

    const counts = new Map<string, number>();
    for (const row of achievementCounts) {
      counts.set(row.achievementId, row._count.achievementId);
    }

    const activePlayerResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(DISTINCT r.user_id) as count
       FROM robots r
       JOIN users u ON u.id = r.user_id
       WHERE r.total_battles > 0
         
         AND u.username NOT LIKE 'auto\\_%'
         AND u.username NOT LIKE 'test\\_user\\_%'`
    );
    const totalActivePlayers = Number(activePlayerResult[0]?.count ?? 0);

    const newCache: AchievementRarityCache = {
      counts,
      totalActivePlayers,
      refreshedAt: new Date(),
    };

    logger.info(`Achievement rarity cache refreshed: ${counts.size} achievements, ${totalActivePlayers} active players`);
    return newCache;
  } catch (error) {
    logger.error(`Failed to refresh achievement rarity cache: ${error}`);
    // Keep the existing cache on failure (graceful degradation)
    return cache;
  }
}

// ─── Rarity Label Helper ─────────────────────────────────────────────

export function getRarityLabel(percentage: number): { label: string; color: string } {
  if (percentage > 75) return { label: 'Common', color: 'text-secondary' };
  if (percentage > 25) return { label: 'Uncommon', color: 'text-success' };
  if (percentage > 10) return { label: 'Rare', color: 'text-primary' };
  if (percentage > 1) return { label: 'Epic', color: 'text-warning' };
  return { label: 'Legendary', color: 'text-error' };
}
