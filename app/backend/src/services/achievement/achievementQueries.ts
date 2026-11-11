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
  ShowcaseAchievement,
  StableAchievementData,
  AchievementRarityCache,
} from './achievementTypes';
import { holderCount } from './rarityHolders';

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
      trophy: definition.trophy === true,
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

/** Badges in the stable page's trophy cabinet. Matches the pin limit. */
export const SHOWCASE_SIZE = 6;

/** Achievement tiers, easiest first: the rarity tie-break prefers harder tiers. */
const ACHIEVEMENT_TIER_ORDER: readonly string[] = ['easy', 'medium', 'hard', 'very_hard', 'secret'];

interface UnlockRow {
  achievementId: string;
  unlockedAt: Date;
}

/**
 * The trophy cabinet: pins in the owner's order, then the rarest other
 * unlocks. Fewer than 1 in 80 human stables pin anything, so the cabinet
 * fills itself rather than showing empty slots. Hidden (secret)
 * achievements are only shown when the owner pinned them, so the
 * auto-fill never reveals one. Rarity is the human-stable holder count
 * from the rarity cache; until it has loaded, harder tiers come first.
 * Ties: harder tier, then the most recent unlock.
 */
export function buildShowcase(
  pinnedIds: readonly string[],
  unlocks: readonly UnlockRow[],
  rarityCache: AchievementRarityCache | null,
): ShowcaseAchievement[] {
  const unlockedAt = new Map(unlocks.map((u) => [u.achievementId, u.unlockedAt]));

  const toEntry = (id: string, pinned: boolean): ShowcaseAchievement | null => {
    const definition = getAchievementById(id);
    const at = unlockedAt.get(id);
    if (!definition || !at) return null;
    return {
      id: definition.id, name: definition.name, tier: definition.tier,
      badgeIconFile: definition.badgeIconFile, unlockedAt: at.toISOString(),
      pinned, holders: holderCount(rarityCache, id, at),
    };
  };

  const showcase: ShowcaseAchievement[] = [];
  for (const id of pinnedIds) {
    const entry = toEntry(id, true);
    if (entry && showcase.length < SHOWCASE_SIZE) showcase.push(entry);
  }

  const pinnedSet = new Set(showcase.map((s) => s.id));
  const candidates = unlocks
    .filter((u) => !pinnedSet.has(u.achievementId))
    .filter((u) => getAchievementById(u.achievementId)?.hidden === false)
    .map((u) => toEntry(u.achievementId, false))
    .filter((e): e is ShowcaseAchievement => e !== null)
    .sort((a, b) =>
      (a.holders ?? 0) - (b.holders ?? 0)
      || ACHIEVEMENT_TIER_ORDER.indexOf(b.tier) - ACHIEVEMENT_TIER_ORDER.indexOf(a.tier)
      || b.unlockedAt.localeCompare(a.unlockedAt));

  return [...showcase, ...candidates.slice(0, SHOWCASE_SIZE - showcase.length)];
}

export async function getStableAchievements(
  userId: number,
  rarityCache: AchievementRarityCache | null = null,
): Promise<StableAchievementData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pinnedAchievements: true },
  });

  if (!user) {
    return { pinned: [], showcase: [], totalUnlocked: 0, totalAvailable: ACHIEVEMENTS.filter((a) => !a.hidden).length };
  }

  const pinnedIds = Array.isArray(user.pinnedAchievements)
    ? (user.pinnedAchievements as string[])
    : [];

  const unlocks: UnlockRow[] = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true, unlockedAt: true },
  });
  const unlockMap = new Map(unlocks.map((u) => [u.achievementId, u.unlockedAt.toISOString()]));

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

  const hiddenIds = new Set(ACHIEVEMENTS.filter((a) => a.hidden).map((a) => a.id));
  const earnedHiddenCount = unlocks.filter((u) => hiddenIds.has(u.achievementId)).length;
  const nonHiddenCount = ACHIEVEMENTS.filter((a) => !a.hidden).length;
  const totalAvailable = nonHiddenCount + earnedHiddenCount;

  return {
    pinned,
    showcase: buildShowcase(pinnedIds, unlocks, rarityCache),
    totalUnlocked: unlocks.length,
    totalAvailable,
  };
}

// ─── Rarity Cache ────────────────────────────────────────────────────

export async function refreshRarityCache(cache: AchievementRarityCache): Promise<AchievementRarityCache> {
  try {
    // Taken before the holder query: an unlock committed while the queries run
    // is then newer than (or equal to) the snapshot, so `holderCount` reports
    // it as unknown instead of 0.
    const snapshotAt = new Date();
    const achievementCounts = await prisma.userAchievement.groupBy({
      by: ['achievementId'],
      _count: { achievementId: true },
      // Spec #55 R1.8: rarity counts Human_Stables only. Automatons and
      // generated filler stables (incl. the seeded test_user_* WimpBots) still
      // earn achievements but are left out of the percentage. The stable type
      // is the classification; usernames are never used to tell them apart.
      where: { user: { stableType: 'human' } },
    });

    const counts = new Map<string, number>();
    for (const row of achievementCounts) {
      counts.set(row.achievementId, row._count.achievementId);
    }

    // Active player = a Human_Stable with at least one robot that has fought.
    const totalActivePlayers = await prisma.user.count({
      where: { stableType: 'human', robots: { some: { totalBattles: { gt: 0 } } } },
    });

    const newCache: AchievementRarityCache = {
      counts,
      totalActivePlayers,
      refreshedAt: snapshotAt,
    };

    logger.info(`Achievement rarity cache refreshed: ${counts.size} achievements, ${totalActivePlayers} active players`);
    return newCache;
  } catch (error) {
    // Interpolating a PrismaClientKnownRequestError into a template string only
    // yields the code frame, which makes an unreachable database look like a
    // malformed query. Log the code and meta explicitly instead.
    const { code, meta } = error as { code?: string; meta?: unknown };
    const detail = code ? ` (code: ${code}, meta: ${JSON.stringify(meta)})` : '';
    logger.error(
      `Failed to refresh achievement rarity cache: ${error instanceof Error ? error.message.trim() : String(error)}${detail}`,
    );
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
