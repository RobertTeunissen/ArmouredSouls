import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { countHumanPlayerActivity } from './adminPlayerActivityService';
import { findPreviousKpiSnapshot } from './adminKpiSnapshotService';
import type { DashboardKpis } from '../../shared/types';

/** Percentage with one decimal; 0 for an empty population. */
export function percentageOneDecimal(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Get high-level KPI metrics for the admin dashboard.
 *
 * `userFilter` scopes the legacy user/robot counts and the `robots` block.
 * `humanPlayers` is always over human stables: only they log in.
 */
export async function getDashboardKpis(userFilter: Prisma.UserWhereInput = {}): Promise<DashboardKpis> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersLast7d,
    totalRobots,
    battleReadyRobots,
    battlesLast24h,
    totalBattles,
    activeUsersLast7d,
    cycleMetadata,
    humanActivity,
    previousSnapshot,
  ] = await Promise.all([
    prisma.user.count({ where: userFilter }),
    prisma.user.count({ where: { ...userFilter, createdAt: { gte: sevenDaysAgo } } }),
    prisma.robot.count({ where: { user: userFilter } }),
    prisma.robot.count({
      where: {
        currentHP: { gte: prisma.robot.fields.maxHP },
        mainWeaponId: { not: null },
        user: userFilter,
      },
    }),
    prisma.battle.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.battle.count(),
    prisma.user.count({
      where: {
        ...userFilter,
        robots: { some: { updatedAt: { gte: sevenDaysAgo } } },
      },
    }),
    prisma.cycleMetadata.findUnique({ where: { id: 1 } }),
    countHumanPlayerActivity(now),
    findPreviousKpiSnapshot(now),
  ]);

  return {
    totalUsers,
    newUsersLast7d,
    totalRobots,
    battlesLast24h,
    totalBattles,
    activeUsersLast7d,
    currentCycle: cycleMetadata?.totalCycles ?? 0,
    lastCycleAt: cycleMetadata?.lastCycleAt?.toISOString() ?? null,
    humanPlayers: {
      total: humanActivity.total,
      active7d: humanActivity.active7d,
      new7d: humanActivity.new7d,
      inactive3d: humanActivity.inactive3d,
      previous: {
        active7d: previousSnapshot?.activePlayers7d ?? null,
        new7d: humanActivity.newPrevious7d,
        inactive3d: previousSnapshot?.inactivePlayers3d ?? null,
      },
    },
    robots: {
      total: totalRobots,
      battleReady: battleReadyRobots,
      battleReadyPercentage: percentageOneDecimal(battleReadyRobots, totalRobots),
    },
    timestamp: now.toISOString(),
  };
}
