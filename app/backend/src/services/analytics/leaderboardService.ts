/**
 * Leaderboard Service
 *
 * Handles leaderboard queries for fame, losses (kills), and prestige.
 * Extracted from routes/leaderboards.ts to follow the thin-route pattern.
 */

import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { getPrestigeRank, getFameTier } from '../../utils/prestigeUtils';
import { getPrestigeMultiplier } from '../../utils/economyCalculations';

// ── Types ────────────────────────────────────────────────────────────

export interface LeaderboardPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface FameLeaderboardEntry {
  rank: number;
  robotId: number;
  robotName: string;
  fame: number;
  fameTier: string;
  stableId: number;
  stableName: string;
  currentLeague: string;
  elo: number;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  kills: number;
  damageDealtLifetime: number;
}

export interface LossesLeaderboardEntry {
  rank: number;
  robotId: number;
  robotName: string;
  totalLosses: number;
  stableId: number;
  stableName: string;
  currentLeague: string;
  elo: number;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  lossRatio: number;
  damageDealtLifetime: number;
}

export interface PrestigeLeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  stableName: string;
  prestige: number;
  prestigeRank: string;
  totalRobots: number;
  totalBattles: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number;
  highestELO: number;
  championshipTitles: number;
  battleWinningsBonus: number;
  merchandisingMultiplier: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Derive battle winnings bonus percentage from the canonical prestige multiplier. */
export function calculateBattleWinningsBonus(prestige: number): number {
  return Math.round((getPrestigeMultiplier(prestige) - 1) * 100);
}

// ── Fame Leaderboard ─────────────────────────────────────────────────

export interface FameLeaderboardParams {
  page: number;
  limit: number;
  league?: string;
  minBattles: number;
}

export async function getFameLeaderboard(params: FameLeaderboardParams): Promise<{
  leaderboard: FameLeaderboardEntry[];
  pagination: LeaderboardPagination;
  filters: { league: string; minBattles: number };
}> {
  const { page, limit, league, minBattles } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.RobotWhereInput = {
    NOT: { name: 'Bye Robot' },
    totalBattles: { gte: minBattles },
  };

  if (league && league !== 'all') {
    where.currentLeague = league;
  }

  const totalRobots = await prisma.robot.count({ where });

  const robots = await prisma.robot.findMany({
    where,
    orderBy: { fame: 'desc' },
    skip,
    take: limit,
    include: {
      user: { select: { id: true, username: true, stableName: true } },
    },
  });

  const leaderboard: FameLeaderboardEntry[] = robots.map((robot, index) => ({
    rank: skip + index + 1,
    robotId: robot.id,
    robotName: robot.name,
    fame: robot.fame,
    fameTier: getFameTier(robot.fame),
    stableId: robot.userId,
    stableName: robot.user.stableName || robot.user.username,
    currentLeague: robot.currentLeague,
    elo: robot.elo,
    totalBattles: robot.totalBattles,
    wins: robot.wins,
    losses: robot.losses,
    draws: robot.draws,
    winRate: robot.totalBattles > 0
      ? Number((robot.wins / robot.totalBattles * 100).toFixed(1))
      : 0,
    kills: robot.kills,
    damageDealtLifetime: robot.damageDealtLifetime,
  }));

  return {
    leaderboard,
    pagination: {
      page,
      limit,
      total: totalRobots,
      totalPages: Math.ceil(totalRobots / limit),
      hasMore: skip + robots.length < totalRobots,
    },
    filters: { league: league || 'all', minBattles },
  };
}

// ── Losses (Kills) Leaderboard ───────────────────────────────────────

export interface LossesLeaderboardParams {
  page: number;
  limit: number;
  league?: string;
}

export async function getLossesLeaderboard(params: LossesLeaderboardParams): Promise<{
  leaderboard: LossesLeaderboardEntry[];
  pagination: LeaderboardPagination;
  filters: { league: string };
}> {
  const { page, limit, league } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.RobotWhereInput = {
    NOT: { name: 'Bye Robot' },
  };

  if (league && league !== 'all') {
    where.currentLeague = league;
  }

  const totalRobots = await prisma.robot.count({ where });

  const robots = await prisma.robot.findMany({
    where,
    orderBy: { kills: 'desc' },
    skip,
    take: limit,
    include: {
      user: { select: { id: true, username: true, stableName: true } },
    },
  });

  const leaderboard: LossesLeaderboardEntry[] = robots.map((robot, index) => ({
    rank: skip + index + 1,
    robotId: robot.id,
    robotName: robot.name,
    totalLosses: robot.kills,
    stableId: robot.userId,
    stableName: robot.user.stableName || robot.user.username,
    currentLeague: robot.currentLeague,
    elo: robot.elo,
    totalBattles: robot.totalBattles,
    wins: robot.wins,
    losses: robot.losses,
    draws: robot.draws,
    winRate: robot.totalBattles > 0
      ? Number((robot.wins / robot.totalBattles * 100).toFixed(1))
      : 0,
    lossRatio: robot.losses > 0
      ? Number((robot.kills / robot.losses).toFixed(2))
      : robot.kills,
    damageDealtLifetime: robot.damageDealtLifetime,
  }));

  return {
    leaderboard,
    pagination: {
      page,
      limit,
      total: totalRobots,
      totalPages: Math.ceil(totalRobots / limit),
      hasMore: skip + robots.length < totalRobots,
    },
    filters: { league: league || 'all' },
  };
}

// ── Prestige Leaderboard ─────────────────────────────────────────────

export interface PrestigeLeaderboardParams {
  page: number;
  limit: number;
  minRobots: number;
}

export async function getPrestigeLeaderboard(params: PrestigeLeaderboardParams): Promise<{
  leaderboard: PrestigeLeaderboardEntry[];
  pagination: LeaderboardPagination & { totalStables: number };
  filters: { minRobots: number };
}> {
  const { page, limit, minRobots } = params;
  const skip = (page - 1) * limit;

  const users = await prisma.user.findMany({
    orderBy: { prestige: 'desc' },
    select: {
      id: true,
      username: true,
      stableName: true,
      prestige: true,
      championshipTitles: true,
      robots: {
        where: { NOT: { name: 'Bye Robot' } },
        select: {
          elo: true,
          totalBattles: true,
          wins: true,
          losses: true,
          draws: true,
        },
      },
    },
  });

  const allEntries = users
    .map((user) => {
      const highestELO = user.robots.length > 0
        ? Math.max(...user.robots.map(r => r.elo), 0)
        : 0;
      const totalBattles = user.robots.reduce((sum, r) => sum + r.totalBattles, 0);
      const totalWins = user.robots.reduce((sum, r) => sum + r.wins, 0);
      const totalLosses = user.robots.reduce((sum, r) => sum + r.losses, 0);
      const totalDraws = user.robots.reduce((sum, r) => sum + r.draws, 0);
      const winRate = totalBattles > 0 ? (totalWins / totalBattles * 100) : 0;

      return {
        userId: user.id,
        username: user.username,
        stableName: user.stableName || user.username,
        prestige: user.prestige,
        prestigeRank: getPrestigeRank(user.prestige),
        totalRobots: user.robots.length,
        totalBattles,
        totalWins,
        totalLosses,
        totalDraws,
        winRate: Number(winRate.toFixed(1)),
        highestELO,
        championshipTitles: user.championshipTitles,
        battleWinningsBonus: calculateBattleWinningsBonus(user.prestige),
        merchandisingMultiplier: Number((1 + user.prestige / 10000).toFixed(3)),
      };
    })
    .filter(entry => entry.totalRobots >= minRobots);

  const totalStables = allEntries.length;
  const paginatedEntries = allEntries.slice(skip, skip + limit);

  const leaderboard: PrestigeLeaderboardEntry[] = paginatedEntries.map((entry, index) => ({
    rank: skip + index + 1,
    ...entry,
  }));

  return {
    leaderboard,
    pagination: {
      page,
      limit,
      total: totalStables,
      totalStables,
      totalPages: Math.ceil(totalStables / limit),
      hasMore: skip + paginatedEntries.length < totalStables,
    },
    filters: { minRobots },
  };
}
