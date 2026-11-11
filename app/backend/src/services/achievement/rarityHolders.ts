/**
 * Holder counts shown under achievement badges (trophy cabinet, robot profile).
 *
 * @module services/achievement/rarityHolders
 */

import type { AchievementRarityCache } from './achievementTypes';

/**
 * Human stables holding an achievement, according to the rarity cache, or
 * null when that is unknown.
 *
 * The cache only lists achievements someone held when it was built (daily
 * settlement, backend start, end of a Season_Rollover). A missing achievement
 * therefore means "no human holder" only if the cache is newer than this
 * unlock. If the unlock came later (a first unlock since the last refresh),
 * the cache simply has not seen it yet: report unknown rather than claiming
 * nobody holds a badge that is on screen. Achievements only Automatons hold
 * stay at 0 once the cache has refreshed, because rarity counts human stables
 * only (Spec #55 R1.8).
 */
export function holderCount(
  cache: AchievementRarityCache | null,
  achievementId: string,
  unlockedAt: Date,
): number | null {
  if (!cache || cache.counts.size === 0) return null;
  const count = cache.counts.get(achievementId);
  if (count !== undefined) return count;
  return unlockedAt > cache.refreshedAt ? null : 0;
}
