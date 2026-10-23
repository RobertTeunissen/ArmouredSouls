import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { getStableBattleOverlapsByUser } from '../auth/stable-battle-overlap';
import { BANKRUPTCY_RISK_THRESHOLD } from './adminThresholds';
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

/**
 * Classify a user's churn risk based on activity signals.
 */
export function classifyChurnRisk(user: {
  lastLoginAt: Date | null;
  createdAt: Date;
  robots: { totalBattles: number }[];
}): 'low' | 'medium' | 'high' {
  const now = Date.now();
  const lastActive = user.lastLoginAt?.getTime() ?? user.createdAt.getTime();
  const daysSinceActive = (now - lastActive) / (1000 * 60 * 60 * 24);
  const totalBattles = user.robots.reduce((sum, r) => sum + r.totalBattles, 0);

  if (daysSinceActive > 14 || (totalBattles === 0 && daysSinceActive > 3)) return 'high';
  if (daysSinceActive > 7 || totalBattles < 5) return 'medium';
  return 'low';
}

/**
 * Get player engagement data with churn risk classification.
 */
export async function getEngagementPlayers(
  userFilter: Prisma.UserWhereInput = {},
  page = 1,
  limit = 50,
) {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: userFilter,
      select: {
        id: true,
        username: true,
        stableName: true,
        currency: true,
        lastLoginAt: true,
        createdAt: true,
        hasCompletedOnboarding: true,
        robots: {
          select: {
            totalBattles: true,
            wins: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where: userFilter }),
  ]);

  // Stable totals count each battle once per stable, as on the dashboard: the
  // robot counters count a team battle once per member, so the shared-side
  // overlap is subtracted. One query for the whole page.
  const overlaps = await getStableBattleOverlapsByUser(users.map((u) => u.id));

  const players = users.map((u) => {
    const overlap = overlaps.get(u.id);
    const totalBattles = u.robots.reduce((sum, r) => sum + r.totalBattles, 0) - (overlap?.battles ?? 0);
    const totalWins = u.robots.reduce((sum, r) => sum + r.wins, 0) - (overlap?.wins ?? 0);
    return {
      userId: u.id,
      username: u.username,
      stableName: u.stableName,
      currency: u.currency,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      onboardingComplete: u.hasCompletedOnboarding,
      robotCount: u.robots.length,
      totalBattles,
      totalWins,
      winRate: totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0,
      churnRisk: classifyChurnRisk(u),
    };
  });

  return {
    players,
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get economy overview metrics.
 */
export async function getEconomyOverview(userFilter: Prisma.UserWhereInput = {}) {
  const users = await prisma.user.findMany({
    where: userFilter,
    select: {
      currency: true,
      facilities: { select: { facilityType: true, level: true } },
    },
  });

  const balances = users.map((u) => u.currency);
  const totalCredits = balances.reduce((sum, b) => sum + b, 0);
  const avgBalance = users.length > 0 ? Math.round(totalCredits / users.length) : 0;
  const medianBalance = balances.length > 0
    ? [...balances].sort((a, b) => a - b)[Math.floor(balances.length / 2)]
    : 0;
  const bankruptcyRisk = users.filter((u) => u.currency < BANKRUPTCY_RISK_THRESHOLD).length;

  // Facility adoption — aggregate stats + per-level breakdown
  const facilityStats: Record<string, { count: number; totalLevel: number; levels: Record<number, number> }> = {};
  users.forEach((user) => {
    user.facilities.forEach((f) => {
      if (f.level > 0) {
        if (!facilityStats[f.facilityType]) {
          facilityStats[f.facilityType] = { count: 0, totalLevel: 0, levels: {} };
        }
        facilityStats[f.facilityType].count++;
        facilityStats[f.facilityType].totalLevel += f.level;
        facilityStats[f.facilityType].levels[f.level] = (facilityStats[f.facilityType].levels[f.level] || 0) + 1;
      }
    });
  });

  const facilities = Object.entries(facilityStats)
    .map(([type, stats]) => ({
      type,
      owners: stats.count,
      avgLevel: stats.count > 0 ? Number((stats.totalLevel / stats.count).toFixed(1)) : 0,
      maxLevel: Math.max(...Object.keys(stats.levels).map(Number), 0),
      levelDistribution: Object.entries(stats.levels)
        .map(([level, count]) => ({ level: Number(level), count }))
        .sort((a, b) => a.level - b.level),
    }))
    .sort((a, b) => b.owners - a.owners);

  return {
    totalCreditsInCirculation: totalCredits,
    averageBalance: avgBalance,
    medianBalance,
    usersAtBankruptcyRisk: bankruptcyRisk,
    totalUsers: users.length,
    facilities,
    timestamp: new Date().toISOString(),
  };
}
