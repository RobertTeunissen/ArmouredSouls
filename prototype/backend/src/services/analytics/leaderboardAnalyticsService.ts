/**
 * Leaderboard Analytics Service
 *
 * Orchestrates leaderboard queries including pagination count.
 *
 * Requirements: 10.3
 */

import prisma from '../../lib/prisma';
import { robotStatsViewService } from './robotStatsViewService';
import type { LeaderboardOptions, RobotStats } from './robotStatsViewService';

export interface LeaderboardResult {
  leaderboard: RobotStats[];
  orderBy: string;
  limit: number;
  offset: number;
  total: number;
}

/**
 * Get leaderboard data with total count for pagination.
 */
export async function getLeaderboardWithTotal(
  options: LeaderboardOptions,
): Promise<LeaderboardResult> {
  const orderBy = options.orderBy ?? 'elo';
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  const leaderboard = await robotStatsViewService.getLeaderboard({ orderBy, limit, offset });

  const totalResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    'SELECT COUNT(*) as count FROM robot_current_stats',
  );
  const total = Number(totalResult[0].count);

  return { leaderboard, orderBy, limit, offset, total };
}
