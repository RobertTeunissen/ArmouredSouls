/**
 * RobotStatsViewService
 * 
 * Manages the robot_current_stats materialized view for fast leaderboard queries.
 * 
 * The materialized view aggregates robot statistics from the battles table:
 * - Current ELO
 * - Total battles, wins, losses, draws
 * - Win rate
 * - Total damage dealt/received
 * - Total kills
 * - Total credits and fame earned
 * - Last battle timestamp
 * 
 * Requirements: 10.3
 */

import prisma from '../lib/prisma';

export interface RobotStats {
  robotId: number;
  robotName: string;
  userId: number;
  currentElo: number;
  totalBattles: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  totalKills: number;
  totalCreditsEarned: number;
  totalFameEarned: number;
  lastBattleAt: Date | null;
}

export interface LeaderboardOptions {
  orderBy?: 'elo' | 'winRate' | 'battles' | 'kills' | 'damageDealt';
  limit?: number;
  offset?: number;
}

export class RobotStatsViewService {
  /**
   * Refresh the materialized view
   * Should be called after battles are completed or at cycle end
   */
  async refreshStats(): Promise<void> {
    try {
      await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW robot_current_stats');
      console.log('[RobotStatsView] Materialized view refreshed successfully');
    } catch (error) {
      console.error('[RobotStatsView] Error refreshing materialized view:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard data
   * Returns robots ordered by the specified metric
   */
  async getLeaderboard(options: LeaderboardOptions = {}): Promise<RobotStats[]> {
    const {
      orderBy = 'elo',
      limit = 100,
      offset = 0,
    } = options;

    // Map orderBy to SQL column names
    const orderByColumn = {
      elo: 'current_elo',
      winRate: 'win_rate',
      battles: 'total_battles',
      kills: 'total_kills',
      damageDealt: 'total_damage_dealt',
    }[orderBy];

    const query = `
      SELECT 
        robot_id as "robotId",
        robot_name as "robotName",
        user_id as "userId",
        current_elo as "currentElo",
        total_battles as "totalBattles",
        wins,
        draws,
        losses,
        win_rate as "winRate",
        total_damage_dealt as "totalDamageDealt",
        total_damage_received as "totalDamageReceived",
        total_kills as "totalKills",
        total_credits_earned as "totalCreditsEarned",
        total_fame_earned as "totalFameEarned",
        last_battle_at as "lastBattleAt"
      FROM robot_current_stats
      ORDER BY ${orderByColumn} DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `;

    const results = await prisma.$queryRawUnsafe<RobotStats[]>(query, limit, offset);
    return results;
  }

  /**
   * Get stats for a specific robot
   */
  async getRobotStats(robotId: number): Promise<RobotStats | null> {
    const query = `
      SELECT 
        robot_id as "robotId",
        robot_name as "robotName",
        user_id as "userId",
        current_elo as "currentElo",
        total_battles as "totalBattles",
        wins,
        draws,
        losses,
        win_rate as "winRate",
        total_damage_dealt as "totalDamageDealt",
        total_damage_received as "totalDamageReceived",
        total_kills as "totalKills",
        total_credits_earned as "totalCreditsEarned",
        total_fame_earned as "totalFameEarned",
        last_battle_at as "lastBattleAt"
      FROM robot_current_stats
      WHERE robot_id = $1
    `;

    const results = await prisma.$queryRawUnsafe<RobotStats[]>(query, robotId);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get stats for all robots owned by a user
   */
  async getUserRobotStats(userId: number): Promise<RobotStats[]> {
    const query = `
      SELECT 
        robot_id as "robotId",
        robot_name as "robotName",
        user_id as "userId",
        current_elo as "currentElo",
        total_battles as "totalBattles",
        wins,
        draws,
        losses,
        win_rate as "winRate",
        total_damage_dealt as "totalDamageDealt",
        total_damage_received as "totalDamageReceived",
        total_kills as "totalKills",
        total_credits_earned as "totalCreditsEarned",
        total_fame_earned as "totalFameEarned",
        last_battle_at as "lastBattleAt"
      FROM robot_current_stats
      WHERE user_id = $1
      ORDER BY current_elo DESC
    `;

    const results = await prisma.$queryRawUnsafe<RobotStats[]>(query, userId);
    return results;
  }

  /**
   * Get top robots by a specific metric
   */
  async getTopRobots(metric: 'elo' | 'winRate' | 'kills' | 'damageDealt', limit: number = 10): Promise<RobotStats[]> {
    return this.getLeaderboard({ orderBy: metric, limit, offset: 0 });
  }
}

// Export singleton instance
export const robotStatsViewService = new RobotStatsViewService();
