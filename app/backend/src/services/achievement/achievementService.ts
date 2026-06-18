/**
 * Achievement Service — Thin orchestrator façade.
 *
 * Single entry point: `checkAndAward(userId, robotId, event)` maps event types
 * to a subset of achievements to evaluate, reads existing unlocks, evaluates
 * conditions, inserts new UserAchievement records, awards credits and prestige,
 * and returns newly unlocked achievements.
 *
 * All heavy logic is delegated to focused sub-modules:
 * - triggerEvaluator.ts — trigger condition evaluation
 * - achievementCatalog.ts — player catalog with progress
 * - achievementQueries.ts — read-only API methods
 *
 * @module services/achievement/achievementService
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { getAchievementsByTriggerType } from '../../config/achievements';
import { eventLogger } from '../common/eventLogger';
import { getCurrentCycle } from '../analytics/cycleAnalyticsService';

import {
  type AchievementEvent,
  type AchievementEventType,
  type UnlockedAchievement,
  type AchievementsResponse,
  type AchievementWithProgress,
  type PinnedAchievement,
  type StableAchievementData,
  type AchievementRarityCache,
  type IAchievementService,
  EVENT_TRIGGER_MAP,
} from './achievementTypes';

import { evaluateTrigger } from './triggerEvaluator';
import { getPlayerAchievements as _getPlayerAchievements } from './achievementCatalog';
import {
  getRecentUnlocks as _getRecentUnlocks,
  updatePinnedAchievements as _updatePinnedAchievements,
  getStableAchievements as _getStableAchievements,
  refreshRarityCache as _refreshRarityCache,
  getRarityLabel,
} from './achievementQueries';

// Re-export all types for barrel compatibility
export {
  type AchievementEvent,
  type AchievementEventType,
  type UnlockedAchievement,
  type AchievementsResponse,
  type AchievementWithProgress,
  type PinnedAchievement,
  type StableAchievementData,
  type AchievementRarityCache,
  type IAchievementService,
} from './achievementTypes';
export { getRarityLabel };

// ─── Achievement Service Implementation ──────────────────────────────

class AchievementService implements IAchievementService {
  private rarityCache: AchievementRarityCache = {
    counts: new Map(),
    totalActivePlayers: 0,
    refreshedAt: new Date(0),
  };

  // ─── Core Entry Point ────────────────────────────────────────────

  async checkAndAward(
    userId: number,
    robotId: number | null,
    event: AchievementEvent,
  ): Promise<UnlockedAchievement[]> {
    try {
      const triggerTypes = EVENT_TRIGGER_MAP[event.type];
      if (!triggerTypes || triggerTypes.length === 0) return [];

      // Gather candidate achievements for this event's trigger types
      const candidates = triggerTypes.flatMap((t) => getAchievementsByTriggerType(t));
      if (candidates.length === 0) return [];

      // Read existing unlocks (single query)
      const existingUnlocks = await prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true },
      });
      const unlockedIds = new Set(existingUnlocks.map((u) => u.achievementId));

      // Filter out already-unlocked
      const unevaluated = candidates.filter((a) => !unlockedIds.has(a.id));
      if (unevaluated.length === 0) return [];

      // Pre-fetch robot and user data once
      const [cachedRobot, cachedUser] = await Promise.all([
        robotId ? prisma.robot.findUnique({ where: { id: robotId } }) : Promise.resolve(null),
        prisma.user.findUnique({ where: { id: userId } }),
      ]);

      // Evaluate each candidate
      const newlyUnlocked: UnlockedAchievement[] = [];

      for (const achievement of unevaluated) {
        const conditionMet = await evaluateTrigger(
          achievement, userId, robotId, event, cachedRobot, cachedUser,
        );

        if (conditionMet) {
          const effectiveRobotId = achievement.scope === 'robot' ? robotId : null;

          try {
            await prisma.userAchievement.create({
              data: { userId, achievementId: achievement.id, robotId: effectiveRobotId },
            });

            await prisma.user.update({
              where: { id: userId },
              data: {
                currency: { increment: achievement.rewardCredits },
                prestige: { increment: achievement.rewardPrestige },
              },
            });

            // Log audit event
            try {
              const { cycleNumber } = await getCurrentCycle();
              if (cycleNumber > 0) {
                await eventLogger.logAchievementUnlock(
                  cycleNumber, userId, achievement.id,
                  achievement.rewardCredits, achievement.rewardPrestige,
                  effectiveRobotId ?? undefined,
                );
              }
            } catch (auditError) {
              logger.error(`Failed to log achievement audit event for ${achievement.id} user ${userId}: ${auditError}`);
            }

            // Fetch robot name for the response
            let robotName: string | null = null;
            if (effectiveRobotId) {
              const robot = await prisma.robot.findUnique({
                where: { id: effectiveRobotId },
                select: { name: true },
              });
              robotName = robot?.name ?? null;
            }

            newlyUnlocked.push({
              id: achievement.id,
              name: achievement.name,
              description: achievement.description,
              tier: achievement.tier,
              rewardCredits: achievement.rewardCredits,
              rewardPrestige: achievement.rewardPrestige,
              badgeIconFile: achievement.badgeIconFile,
              robotId: effectiveRobotId,
              robotName,
            });
          } catch (insertError: unknown) {
            const err = insertError as { code?: string };
            if (err.code === 'P2002') continue; // unique constraint — already unlocked
            logger.error(`Failed to award achievement ${achievement.id} to user ${userId}: ${insertError}`);
          }
        }
      }

      return newlyUnlocked;
    } catch (error) {
      logger.error(`Achievement evaluation failed for user ${userId}, event ${event.type}: ${error}`);
      return [];
    }
  }

  // ─── Delegated Methods ───────────────────────────────────────────

  async getPlayerAchievements(userId: number): Promise<AchievementsResponse> {
    return _getPlayerAchievements(userId, this.rarityCache);
  }

  async getRecentUnlocks(userId: number, limit: number = 10, since?: Date): Promise<(UnlockedAchievement & { unlockedAt: string })[]> {
    return _getRecentUnlocks(userId, limit, since);
  }

  async updatePinnedAchievements(userId: number, achievementIds: string[]): Promise<void> {
    return _updatePinnedAchievements(userId, achievementIds);
  }

  async getStableAchievements(userId: number): Promise<StableAchievementData> {
    return _getStableAchievements(userId);
  }

  async refreshRarityCache(): Promise<void> {
    this.rarityCache = await _refreshRarityCache(this.rarityCache);
  }

  getRarityData(): AchievementRarityCache {
    return this.rarityCache;
  }
}

// ─── Singleton Export ────────────────────────────────────────────────

export const achievementService = new AchievementService();
