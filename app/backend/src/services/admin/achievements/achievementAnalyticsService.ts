/**
 * Achievement analytics of the admin Achievements page: per achievement, how
 * many stables of one type unlocked it this season and on which day.
 *
 * Unlocks are season-scoped (the rollover deletes every `user_achievements`
 * row), so every row read here belongs to the current season. For players
 * the rate is out of the human stables that logged in since the season
 * started; dormant accounts would otherwise drag every rate down. Read-only.
 */
import prisma from '../../../lib/prisma';
import { ACHIEVEMENTS, type AchievementDefinition } from '../../../config/achievements';
import { buildStableScopeFilter } from '../../../utils/stableScope';
import { getCurrentSeason } from '../../season/seasonService';
import { isDormant, seasonStartedAt } from '../../season/dormantStables';
import type {
  AchievementAnalytics,
  AchievementAnalyticsRow,
  AchievementStableScope,
} from '../../../shared/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AchievementStable {
  id: number;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface AchievementUnlock {
  userId: number;
  achievementId: string;
  unlockedAt: Date;
}

/** 1-based day of the season `at` falls on; 0 or less is before the start. */
export function seasonDay(at: Date, startedAt: Date): number {
  return Math.floor((at.getTime() - startedAt.getTime()) / DAY_MS) + 1;
}

/** Lower median of a list of numbers, or null when it is empty. */
function lowerMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/** Pure aggregation, exported for tests. */
export function summarizeAchievements(input: {
  stables: AchievementStableScope;
  catalogue: ReadonlyArray<AchievementDefinition>;
  users: ReadonlyArray<AchievementStable>;
  unlocks: ReadonlyArray<AchievementUnlock>;
  seasonNumber: number;
  startedAt: Date | null;
}): AchievementAnalytics {
  const { stables, catalogue, users, unlocks, seasonNumber, startedAt } = input;
  const counted = new Set(
    users
      .filter((user) => stables !== 'players' || startedAt === null || !isDormant(user, startedAt))
      .map((user) => user.id),
  );

  const perAchievement = new Map<string, { unlocked: Set<number>; all: Set<number>; days: number[] }>();
  for (const unlock of unlocks) {
    const entry = perAchievement.get(unlock.achievementId) ?? { unlocked: new Set<number>(), all: new Set<number>(), days: [] };
    entry.all.add(unlock.userId);
    if (counted.has(unlock.userId) && !entry.unlocked.has(unlock.userId)) {
      entry.unlocked.add(unlock.userId);
      if (startedAt) entry.days.push(seasonDay(unlock.unlockedAt, startedAt));
    }
    perAchievement.set(unlock.achievementId, entry);
  }

  const population = counted.size;
  const achievements: AchievementAnalyticsRow[] = catalogue
    .map((definition) => {
      const entry = perAchievement.get(definition.id);
      const unlocked = entry?.unlocked.size ?? 0;
      return {
        achievementId: definition.id,
        name: definition.name,
        description: definition.description,
        category: definition.category,
        tier: definition.tier,
        hidden: definition.hidden === true,
        unlocked,
        rate: population > 0 ? Math.round((unlocked / population) * 1000) / 10 : 0,
        medianDay: entry ? lowerMedian(entry.days) : null,
        unlockedAll: entry?.all.size ?? 0,
      };
    })
    .sort((a, b) => b.unlocked - a.unlocked || a.achievementId.localeCompare(b.achievementId, undefined, { numeric: true }));

  return {
    stables,
    seasonNumber,
    seasonStartedAt: startedAt?.toISOString() ?? null,
    population,
    totalStables: users.length,
    totalAchievements: catalogue.length,
    unlockedBySomeone: achievements.filter((row) => row.unlocked > 0).length,
    unlocks: achievements.reduce((sum, row) => sum + row.unlocked, 0),
    achievements,
  };
}

export async function getAchievementAnalytics(stables: AchievementStableScope): Promise<AchievementAnalytics> {
  const userFilter = buildStableScopeFilter(stables);
  const season = await getCurrentSeason();
  const [startedAt, users, unlocks] = await Promise.all([
    seasonStartedAt(season.seasonNumber),
    prisma.user.findMany({ where: userFilter, select: { id: true, lastLoginAt: true, createdAt: true } }),
    prisma.userAchievement.findMany({ where: { user: userFilter }, select: { userId: true, achievementId: true, unlockedAt: true } }),
  ]);
  return summarizeAchievements({ stables, catalogue: ACHIEVEMENTS, users, unlocks, seasonNumber: season.seasonNumber, startedAt });
}
