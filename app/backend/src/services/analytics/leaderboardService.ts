/**
 * Leaderboard Service
 *
 * Handles leaderboard queries for fame, losses (kills), and prestige.
 * Extracted from routes/leaderboards.ts to follow the thin-route pattern.
 */

import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import { getPrestigeRank, getFameTier } from '../../utils/prestigeUtils';


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
  /** Destructions split by battle type. Always carries every tracked mode. */
  killsByMode: Record<string, number>;
  stableId: number;
  stableName: string;
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
}

// ── Fame Leaderboard ─────────────────────────────────────────────────

export interface FameLeaderboardParams {
  page: number;
  limit: number;
}

/**
 * Rank all robots by `fame` descending.
 *
 * Spec #46 R5: no league filter and no minimum-battles threshold. Both
 * suppressed entrants rather than narrowing a complete list — `robots.total_battles`
 * is never incremented for KotH or Grand Melee, so a minimum-battles default
 * excluded robots whose fame came from those modes, and the league filter joined
 * `standings` on `league_1v1` only. Fame is earned in every mode, so the ranking
 * covers every robot.
 */
export async function getFameLeaderboard(params: FameLeaderboardParams): Promise<{
  leaderboard: FameLeaderboardEntry[];
  pagination: LeaderboardPagination;
}> {
  const { page, limit } = params;
  const skip = (page - 1) * limit;

  // Single raw SQL query with JOIN replaces the previous 3-4 Prisma calls:
  // 1) standings filter, 2) robot.count, 3) robot.findMany, 4) standings for tiers
  interface FameRow {
    id: number;
    name: string;
    fame: number;
    elo: number;
    total_battles: number;
    wins: number;
    losses: number;
    draws: number;
    kills: number;
    damage_dealt_lifetime: number;
    user_id: number;
    username: string;
    stable_name: string | null;
    total_count: bigint;
  }

  // The LEFT JOIN on `standings` is gone with the League column — nothing is
  // projected from it, and its presence also excluded robots without a
  // league_1v1 standing whenever a tier filter was applied (Spec #46 R5.4).
  const rows = await prisma.$queryRaw<FameRow[]>`
    SELECT
      r.id,
      r.name,
      r.fame,
      r.elo,
      r."total_battles",
      r.wins,
      r.losses,
      r.draws,
      r.kills,
      r."damage_dealt_lifetime",
      r."user_id",
      u.username,
      u."stable_name",
      COUNT(*) OVER() AS total_count
    FROM "robots" r
    JOIN "users" u ON u.id = r."user_id"
    ORDER BY r.fame DESC, r.id ASC
    LIMIT ${limit} OFFSET ${skip}
  `;

  const totalRobots = rows.length > 0 ? Number(rows[0].total_count) : 0;

  const leaderboard: FameLeaderboardEntry[] = rows.map((row, index) => ({
    rank: skip + index + 1,
    robotId: row.id,
    robotName: row.name,
    fame: row.fame,
    fameTier: getFameTier(row.fame),
    stableId: row.user_id,
    stableName: row.stable_name || row.username,
    elo: row.elo,
    totalBattles: row.total_battles,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    winRate: row.total_battles > 0
      ? Number((row.wins / row.total_battles * 100).toFixed(1))
      : 0,
    kills: row.kills,
    damageDealtLifetime: row.damage_dealt_lifetime,
  }));

  return {
    leaderboard,
    pagination: {
      page,
      limit,
      total: totalRobots,
      totalPages: Math.ceil(totalRobots / limit),
      hasMore: skip + rows.length < totalRobots,
    },
  };
}

// ── Losses (Kills) Leaderboard ───────────────────────────────────────

/**
 * Battle types the destruction leaderboard breaks out, in display order.
 *
 * Mirrors the `StandingsMode` enum. Every value is a valid enum member, so the
 * pivot below interpolates them into SQL safely.
 */
export const KILL_MODES = [
  'league_1v1',
  'league_2v2',
  'league_3v3',
  'tag_team',
  'koth',
  'grand_melee',
  'tournament_1v1',
  'tournament_2v2',
  'tournament_3v3',
] as const;

export type KillMode = (typeof KILL_MODES)[number];

/** Columns the destruction leaderboard can be ordered by. */
export const LOSSES_SORT_KEYS = ['total', ...KILL_MODES] as const;

export type LossesSortKey = (typeof LOSSES_SORT_KEYS)[number];

export interface LossesLeaderboardParams {
  page: number;
  limit: number;
  /** Which column to rank by. Defaults to the lifetime total across all modes. */
  sortBy?: LossesSortKey;
}

export async function getLossesLeaderboard(params: LossesLeaderboardParams): Promise<{
  leaderboard: LossesLeaderboardEntry[];
  pagination: LeaderboardPagination;
  sortBy: LossesSortKey;
}> {
  const { page, limit } = params;
  const skip = (page - 1) * limit;
  const sortBy: LossesSortKey =
    params.sortBy && LOSSES_SORT_KEYS.includes(params.sortBy) ? params.sortBy : 'total';

  // Single raw SQL query with JOIN replaces the previous 3-4 Prisma calls
  interface LossesRow {
    id: number;
    name: string;
    kills: number;
    elo: number;
    total_battles: number;
    wins: number;
    losses: number;
    draws: number;
    damage_dealt_lifetime: number;
    user_id: number;
    username: string;
    stable_name: string | null;
    total_count: bigint;
    [modeColumn: string]: unknown;
  }

  // Pivot robot_mode_kills into one column per battle type. Values come from the
  // KILL_MODES literal union, never from user input, so this cannot inject.
  const modeColumns = Prisma.join(
    KILL_MODES.map(
      (mode) => Prisma.sql`COALESCE(SUM(CASE WHEN k.mode = ${mode}::"StandingsMode" THEN k.kills END), 0)::int AS ${Prisma.raw(`"${mode}"`)}`,
    ),
    ', ',
  );

  // `total` ranks on the robot's lifetime counter; a mode ranks on its pivot.
  const orderBy =
    sortBy === 'total' ? Prisma.sql`r.kills DESC` : Prisma.sql`${Prisma.raw(`"${sortBy}"`)} DESC`;

  const rows = await prisma.$queryRaw<LossesRow[]>`
    SELECT
      r.id,
      r.name,
      r.kills,
      r.elo,
      r."total_battles",
      r.wins,
      r.losses,
      r.draws,
      r."damage_dealt_lifetime",
      r."user_id",
      u.username,
      u."stable_name",
      ${modeColumns},
      COUNT(*) OVER() AS total_count
    FROM "robots" r
    JOIN "users" u ON u.id = r."user_id"
    LEFT JOIN "robot_mode_kills" k ON k."robot_id" = r.id
    GROUP BY r.id, r.name, r.kills, r.elo, r."total_battles", r.wins, r.losses,
             r.draws, r."damage_dealt_lifetime", r."user_id", u.username, u."stable_name"
    ORDER BY ${orderBy}, r.kills DESC, r.id ASC
    LIMIT ${limit} OFFSET ${skip}
  `;

  const totalRobots = rows.length > 0 ? Number(rows[0].total_count) : 0;

  const leaderboard: LossesLeaderboardEntry[] = rows.map((row, index) => ({
    rank: skip + index + 1,
    robotId: row.id,
    robotName: row.name,
    totalLosses: row.kills,
    killsByMode: Object.fromEntries(
      KILL_MODES.map((mode) => [mode, Number(row[mode] ?? 0)]),
    ) as Record<KillMode, number>,
    stableId: row.user_id,
    stableName: row.stable_name || row.username,
    elo: row.elo,
    totalBattles: row.total_battles,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    winRate: row.total_battles > 0
      ? Number((row.wins / row.total_battles * 100).toFixed(1))
      : 0,
    lossRatio: row.losses > 0
      ? Number((row.kills / row.losses).toFixed(2))
      : row.kills,
    damageDealtLifetime: row.damage_dealt_lifetime,
  }));

  return {
    leaderboard,
    pagination: {
      page,
      limit,
      total: totalRobots,
      totalPages: Math.ceil(totalRobots / limit),
      hasMore: skip + rows.length < totalRobots,
    },
    sortBy,
  };
}

// ── Prestige Leaderboard ─────────────────────────────────────────────

export interface PrestigeLeaderboardParams {
  page: number;
  limit: number;
}

/**
 * Rank all stables by `prestige` descending.
 *
 * Spec #46 R5: no minimum-robot-count filter, which suppressed single-robot
 * stables from a ranking of stable prestige. Note that prestige accrues once
 * per winning robot, so a larger roster ranks higher; that is a property of
 * the metric and is deliberately not normalised here. Spec #46 R2 addresses
 * roster scaling only where prestige drives income.
 */
export async function getPrestigeLeaderboard(params: PrestigeLeaderboardParams): Promise<{
  leaderboard: PrestigeLeaderboardEntry[];
  pagination: LeaderboardPagination & { totalStables: number };
}> {
  const { page, limit } = params;
  const skip = (page - 1) * limit;

  // Raw SQL to aggregate robot stats per stable and paginate at DB level.
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
      SELECT COUNT(*)::bigint AS count FROM "users"
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
      ORDER BY u.prestige DESC, u.id ASC
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
  };
}
