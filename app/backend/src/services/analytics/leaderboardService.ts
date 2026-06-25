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

    totalBattles: { gte: minBattles },
  };

  if (league && league !== 'all') {
    // Filter by league tier from standings (source of truth since Spec #40)
    const leagueRobotIds = await prisma.standing.findMany({
      where: { mode: 'league_1v1', tier: league, entityType: 'robot' },
      select: { entityId: true },
    });
    where.id = { in: leagueRobotIds.map(s => s.entityId) };
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

  // Fetch league tiers from standings for the response
  const robotIds = robots.map(r => r.id);
  const standings = robotIds.length > 0
    ? await prisma.standing.findMany({
        where: { entityType: 'robot', entityId: { in: robotIds }, mode: 'league_1v1' },
        select: { entityId: true, tier: true },
      })
    : [];
  const leagueMap = new Map(standings.map(s => [s.entityId, s.tier]));

  const leaderboard: FameLeaderboardEntry[] = robots.map((robot, index) => ({
    rank: skip + index + 1,
    robotId: robot.id,
    robotName: robot.name,
    fame: robot.fame,
    fameTier: getFameTier(robot.fame),
    stableId: robot.userId,
    stableName: robot.user.stableName || robot.user.username,
    currentLeague: leagueMap.get(robot.id) ?? 'bronze',
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

  };

  if (league && league !== 'all') {
    // Filter by league tier from standings (source of truth since Spec #40)
    const leagueRobotIds = await prisma.standing.findMany({
      where: { mode: 'league_1v1', tier: league, entityType: 'robot' },
      select: { entityId: true },
    });
    where.id = { in: leagueRobotIds.map(s => s.entityId) };
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

  // Fetch league tiers from standings for the response
  const robotIds = robots.map(r => r.id);
  const standings = robotIds.length > 0
    ? await prisma.standing.findMany({
        where: { entityType: 'robot', entityId: { in: robotIds }, mode: 'league_1v1' },
        select: { entityId: true, tier: true },
      })
    : [];
  const leagueMap = new Map(standings.map(s => [s.entityId, s.tier]));

  const leaderboard: LossesLeaderboardEntry[] = robots.map((robot, index) => ({
    rank: skip + index + 1,
    robotId: robot.id,
    robotName: robot.name,
    totalLosses: robot.kills,
    stableId: robot.userId,
    stableName: robot.user.stableName || robot.user.username,
    currentLeague: leagueMap.get(robot.id) ?? 'bronze',
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

  // Use raw SQL to filter by robot count at DB level and paginate efficiently.
  // This avoids loading all users into memory for large player bases.
  interface UserRow {
    id: number;
    username: string;
    stable_name: string | null;
    prestige: number;
    championship_titles: number;
    robot_count: bigint;
    highest_elo: number;
    total_battles: bigint;
    total_wins: bigint;
    total_losses: bigint;
    total_draws: bigint;
  }

  const [countResult, userRows] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT u.id FROM "users" u
        LEFT JOIN "robots" r ON r."user_id" = u.id
        GROUP BY u.id
        HAVING COUNT(r.id) >= ${minRobots}
      ) sub
    `,
    prisma.$queryRaw<UserRow[]>`
      SELECT
        u.id,
        u.username,
        u."stable_name",
        u.prestige,
        u."championship_titles",
        COUNT(r.id)::bigint AS robot_count,
        COALESCE(MAX(r.elo), 0) AS highest_elo,
        COALESCE(SUM(r."total_battles"), 0)::bigint AS total_battles,
        COALESCE(SUM(r.wins), 0)::bigint AS total_wins,
        COALESCE(SUM(r.losses), 0)::bigint AS total_losses,
        COALESCE(SUM(r.draws), 0)::bigint AS total_draws
      FROM "users" u
      LEFT JOIN "robots" r ON r."user_id" = u.id
      GROUP BY u.id
      HAVING COUNT(r.id) >= ${minRobots}
      ORDER BY u.prestige DESC
      LIMIT ${limit} OFFSET ${skip}
    `,
  ]);

  const totalStables = Number(countResult[0]?.count ?? 0);

  const leaderboard: PrestigeLeaderboardEntry[] = userRows.map((user, index) => {
    const totalBattles = Number(user.total_battles);
    const totalWins = Number(user.total_wins);
    const totalLosses = Number(user.total_losses);
    const totalDraws = Number(user.total_draws);
    const winRate = totalBattles > 0 ? (totalWins / totalBattles * 100) : 0;
    const prestige = user.prestige;

    return {
      rank: skip + index + 1,
      userId: user.id,
      username: user.username,
      stableName: user.stable_name || user.username,
      prestige,
      prestigeRank: getPrestigeRank(prestige),
      totalRobots: Number(user.robot_count),
      totalBattles,
      totalWins,
      totalLosses,
      totalDraws,
      winRate: Number(winRate.toFixed(1)),
      highestELO: user.highest_elo,
      championshipTitles: user.championship_titles,
      battleWinningsBonus: calculateBattleWinningsBonus(prestige),
      merchandisingMultiplier: Number((1 + prestige / 10000).toFixed(3)),
    };
  });

  return {
    leaderboard,
    pagination: {
      page,
      limit,
      total: totalStables,
      totalStables,
      totalPages: Math.ceil(totalStables / limit),
      hasMore: skip + leaderboard.length < totalStables,
    },
    filters: { minRobots },
  };
}
