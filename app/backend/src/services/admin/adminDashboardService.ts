import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { countHumanPlayerActivity } from './adminPlayerActivityService';
import { findPreviousKpiSnapshot } from './adminKpiSnapshotService';

/** Human-player activity block of the dashboard KPIs (always human stables). */
export interface DashboardHumanPlayers {
  total: number;
  active7d: number;
  new7d: number;
  inactive3d: number;
  /**
   * The same counts about seven days ago. `new7d` is exact (from `createdAt`);
   * `active7d`/`inactive3d` come from the settlement snapshot and are null until
   * one exists for that day.
   */
  previous: { active7d: number | null; new7d: number; inactive3d: number | null };
}

/** Robot block of the dashboard KPIs (respects the dashboard filter). */
export interface DashboardRobots {
  total: number;
  battleReady: number;
  /** One decimal. */
  battleReadyPercentage: number;
}

export interface DashboardKpis {
  totalUsers: number;
  newUsersLast7d: number;
  totalRobots: number;
  battlesLast24h: number;
  totalBattles: number;
  /**
   * @deprecated Counts users with a robot updated in 7 days, which battles do
   * for nearly every stable. Use `humanPlayers.active7d` (login-based).
   */
  activeUsersLast7d: number;
  currentCycle: number;
  lastCycleAt: string | null;
  humanPlayers: DashboardHumanPlayers;
  robots: DashboardRobots;
  timestamp: string;
}

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
