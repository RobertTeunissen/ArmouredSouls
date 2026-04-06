/**
 * Practice Arena Metrics
 *
 * In-memory singleton tracking usage counters for the Practice Arena.
 * Daily counters are flushed to the `practice_arena_daily_stats` table
 * during the settlement cycle via `flushAndReset()`. The lifetime counter
 * `totalBattlesSinceStart` resets only on server restart.
 *
 * @module services/practice-arena/practiceArenaMetrics
 */

import prisma from '../../lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PracticeArenaStats {
  totalBattlesSinceStart: number;
  battlesToday: number;
  rateLimitHitsToday: number;
  uniquePlayersToday: Set<number>;
}

export interface PracticeArenaStatsResponse {
  totalBattlesSinceStart: number;
  battlesToday: number;
  rateLimitHitsToday: number;
  uniquePlayersToday: number;
}

// ---------------------------------------------------------------------------
// PracticeArenaMetrics class
// ---------------------------------------------------------------------------

export class PracticeArenaMetrics {
  private stats: PracticeArenaStats;

  constructor() {
    this.stats = {
      totalBattlesSinceStart: 0,
      battlesToday: 0,
      rateLimitHitsToday: 0,
      uniquePlayersToday: new Set<number>(),
    };
  }

  /**
   * Record a practice battle for the given user.
   * Increments totalBattlesSinceStart and battlesToday,
   * and adds the userId to the unique players set.
   */
  recordBattle(userId: number): void {
    this.stats.totalBattlesSinceStart++;
    this.stats.battlesToday++;
    this.stats.uniquePlayersToday.add(userId);
  }

  /**
   * Record a rate limit hit (called when a user exceeds the practice battle rate limit).
   */
  recordRateLimitHit(): void {
    this.stats.rateLimitHitsToday++;
  }

  /**
   * Returns current metrics with uniquePlayersToday as a count number.
   */
  getStats(): PracticeArenaStatsResponse {
    return {
      totalBattlesSinceStart: this.stats.totalBattlesSinceStart,
      battlesToday: this.stats.battlesToday,
      rateLimitHitsToday: this.stats.rateLimitHitsToday,
      uniquePlayersToday: this.stats.uniquePlayersToday.size,
    };
  }

  /**
   * Persists current daily counters to the `practice_arena_daily_stats` table
   * (one INSERT with today's date), then zeroes daily counters.
   * Does NOT reset totalBattlesSinceStart.
   */
  async flushAndReset(): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const playerIds = Array.from(this.stats.uniquePlayersToday);

    await (prisma as any).practiceArenaDailyStats.create({
      data: {
        date: today,
        totalBattles: this.stats.battlesToday,
        uniquePlayers: this.stats.uniquePlayersToday.size,
        rateLimitHits: this.stats.rateLimitHitsToday,
        playerIds: playerIds,
      },
    });

    // Reset daily counters — totalBattlesSinceStart is preserved
    this.stats.battlesToday = 0;
    this.stats.rateLimitHitsToday = 0;
    this.stats.uniquePlayersToday = new Set<number>();
  }

  /**
   * Reads recent rows from `practice_arena_daily_stats` ordered by date descending.
   * @param days Number of days of history to retrieve (default 30)
   */
  async getHistory(days: number = 30): Promise<Array<{
    date: Date;
    totalBattles: number;
    uniquePlayers: number;
    rateLimitHits: number;
    playerIds: unknown;
  }>> {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - days);

    return (prisma as any).practiceArenaDailyStats.findMany({
      where: {
        date: { gte: since },
      },
      orderBy: { date: 'desc' },
      select: {
        date: true,
        totalBattles: true,
        uniquePlayers: true,
        rateLimitHits: true,
        playerIds: true,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const practiceArenaMetrics = new PracticeArenaMetrics();
