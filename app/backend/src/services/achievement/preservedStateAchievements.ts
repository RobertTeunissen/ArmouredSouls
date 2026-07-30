/**
 * Achievements that survive a Season_Rollover as facts rather than as unlocks.
 *
 * A rollover deletes every `user_achievements` row, so each achievement has to
 * be re-earned. That works for the whole catalogue except where the unlock
 * condition reads user state the rollover *preserves*: the condition is still
 * true in the new season, but nothing ever re-evaluates it, so the achievement
 * becomes permanently unreachable for a returning player (issue #419).
 *
 * `onboarding` is the only such trigger today. `hasCompletedOnboarding` is
 * preserved — a returning player is deliberately never walked through the
 * tutorial again — while the trigger's only event fires from the onboarding
 * completion route. Every other one-time trigger reads a counter the rollover
 * zeroes (`totalPracticeBattles`, the three championship counters), so those are
 * re-earnable by playing.
 *
 * The rollover replays the events below in Stage 4, which re-awards the
 * achievement along with its credits and prestige, exactly as if the player had
 * just triggered it.
 *
 * @module services/achievement/preservedStateAchievements
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import type { AchievementTriggerType } from '../../config/achievements';
import type { AchievementEventType } from './achievementTypes';
import { achievementService } from './achievementService';

/**
 * Trigger types whose condition reads user state a rollover preserves.
 *
 * Keep in step with `PRESERVED_STATE_EVENTS`: every trigger here must be
 * reachable from an event there, or the achievement stays unreachable. A test
 * asserts the two line up.
 */
export const PRESERVED_STATE_TRIGGERS: readonly AchievementTriggerType[] = ['onboarding'];

/** Events replayed after a rollover to re-award the achievements above. */
export const PRESERVED_STATE_EVENTS: readonly AchievementEventType[] = ['onboarding_complete'];

export interface ReawardResult {
  stablesChecked: number;
  achievementsAwarded: number;
}

/**
 * Re-award preserved-state achievements to every surviving Human_Stable.
 *
 * Safe to run at any time and as often as you like: `checkAndAward()` skips
 * achievements the player already holds and ignores unique-constraint races, so
 * a second run awards nothing and grants no duplicate rewards. That is what
 * makes it usable both from the rollover and as a one-off repair for a season
 * that rolled over before this existed.
 *
 * Generated_Stables are excluded. They are deleted rather than reset by a
 * rollover, so by Stage 4 they no longer exist, and awarding a bot an
 * achievement would only distort the rarity percentages.
 */
export async function reawardPreservedStateAchievements(): Promise<ReawardResult> {
  const stables = await prisma.user.findMany({
    where: { isGenerated: false, hasCompletedOnboarding: true },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  let achievementsAwarded = 0;

  for (const stable of stables) {
    for (const eventType of PRESERVED_STATE_EVENTS) {
      try {
        const unlocked = await achievementService.checkAndAward(stable.id, null, {
          type: eventType,
          data: {},
        });
        achievementsAwarded += unlocked.length;
      } catch (error) {
        // Per-stable failure must not abort the sweep for everyone else.
        logger.error(
          `[preserved-achievements] Replay of ${eventType} failed for stable ${stable.id} — ` +
          `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return { stablesChecked: stables.length, achievementsAwarded };
}
