/**
 * Unit tests for the Practice Arena Metrics module
 *
 * Tests recordBattle, recordRateLimitHit, getStats, flushAndReset, and getHistory.
 *
 * Requirements: 13.1, 13.4, 13.5
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockPrismaUpsert = jest.fn();
const mockPrismaFindMany = jest.fn();

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    practiceArenaDailyStats: {
      upsert: mockPrismaUpsert,
      findMany: mockPrismaFindMany,
    },
  },
}));

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PracticeArenaMetrics } from '../../src/services/practice-arena/practiceArenaMetrics';

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('PracticeArenaMetrics', () => {
  let metrics: PracticeArenaMetrics;

  beforeEach(() => {
    jest.clearAllMocks();
    metrics = new PracticeArenaMetrics();
  });

  // =========================================================================
  // recordBattle
  // =========================================================================
  describe('recordBattle', () => {
    it('should increment totalBattlesSinceStart and battlesToday', () => {
      metrics.recordBattle(1);
      metrics.recordBattle(2);
      metrics.recordBattle(3);

      const stats = metrics.getStats();
      expect(stats.totalBattlesSinceStart).toBe(3);
      expect(stats.battlesToday).toBe(3);
    });

    it('should track unique player IDs correctly', () => {
      metrics.recordBattle(1);
      metrics.recordBattle(2);
      metrics.recordBattle(1); // duplicate
      metrics.recordBattle(3);
      metrics.recordBattle(2); // duplicate

      const stats = metrics.getStats();
      expect(stats.uniquePlayersToday).toBe(3);
      expect(stats.totalBattlesSinceStart).toBe(5);
    });
  });

  // =========================================================================
  // recordRateLimitHit
  // =========================================================================
  describe('recordRateLimitHit', () => {
    it('should increment rateLimitHitsToday', () => {
      metrics.recordRateLimitHit();
      metrics.recordRateLimitHit();
      metrics.recordRateLimitHit();

      const stats = metrics.getStats();
      expect(stats.rateLimitHitsToday).toBe(3);
    });
  });

  // =========================================================================
  // getStats
  // =========================================================================
  describe('getStats', () => {
    it('should return correct values after mixed operations', () => {
      // Record some battles
      metrics.recordBattle(10);
      metrics.recordBattle(20);
      metrics.recordBattle(10); // duplicate player
      metrics.recordBattle(30);

      // Record some rate limit hits
      metrics.recordRateLimitHit();
      metrics.recordRateLimitHit();

      const stats = metrics.getStats();
      expect(stats.totalBattlesSinceStart).toBe(4);
      expect(stats.battlesToday).toBe(4);
      expect(stats.rateLimitHitsToday).toBe(2);
      expect(stats.uniquePlayersToday).toBe(3); // 10, 20, 30
    });

    it('should return zeros for a fresh instance', () => {
      const stats = metrics.getStats();
      expect(stats.totalBattlesSinceStart).toBe(0);
      expect(stats.battlesToday).toBe(0);
      expect(stats.rateLimitHitsToday).toBe(0);
      expect(stats.uniquePlayersToday).toBe(0);
    });
  });

  // =========================================================================
  // flushAndReset
  // =========================================================================
  describe('flushAndReset', () => {
    it('should persist daily counters to practice_arena_daily_stats table including playerIds as JSON array', async () => {
      mockPrismaUpsert.mockResolvedValue({});

      metrics.recordBattle(10);
      metrics.recordBattle(20);
      metrics.recordBattle(10); // duplicate player, still counts as a battle
      metrics.recordRateLimitHit();

      await metrics.flushAndReset();

      expect(mockPrismaUpsert).toHaveBeenCalledTimes(1);
      const upsertCall = mockPrismaUpsert.mock.calls[0][0];
      expect(upsertCall.create.totalBattles).toBe(3);
      expect(upsertCall.create.uniquePlayers).toBe(2);
      expect(upsertCall.create.rateLimitHits).toBe(1);
      expect(upsertCall.create.playerIds).toEqual(expect.arrayContaining([10, 20]));
      expect(upsertCall.create.playerIds).toHaveLength(2);
      expect(upsertCall.where.date).toBeInstanceOf(Date);
    });

    it('should zero daily counters but preserve totalBattlesSinceStart', async () => {
      mockPrismaUpsert.mockResolvedValue({});

      metrics.recordBattle(1);
      metrics.recordBattle(2);
      metrics.recordBattle(3);
      metrics.recordRateLimitHit();
      metrics.recordRateLimitHit();

      const beforeFlush = metrics.getStats();
      expect(beforeFlush.totalBattlesSinceStart).toBe(3);

      await metrics.flushAndReset();

      const afterFlush = metrics.getStats();
      expect(afterFlush.totalBattlesSinceStart).toBe(3); // preserved
      expect(afterFlush.battlesToday).toBe(0);
      expect(afterFlush.rateLimitHitsToday).toBe(0);
      expect(afterFlush.uniquePlayersToday).toBe(0);
    });
  });

  // =========================================================================
  // getHistory
  // =========================================================================
  describe('getHistory', () => {
    it('should return rows ordered by date descending', async () => {
      const mockRows = [
        { date: new Date('2026-04-03'), totalBattles: 50, uniquePlayers: 10, rateLimitHits: 2, playerIds: [1, 2] },
        { date: new Date('2026-04-02'), totalBattles: 30, uniquePlayers: 8, rateLimitHits: 1, playerIds: [3] },
        { date: new Date('2026-04-01'), totalBattles: 20, uniquePlayers: 5, rateLimitHits: 0, playerIds: [] },
      ];
      mockPrismaFindMany.mockResolvedValue(mockRows);

      const history = await metrics.getHistory(30);

      expect(mockPrismaFindMany).toHaveBeenCalledTimes(1);
      const findManyCall = mockPrismaFindMany.mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ date: 'desc' });
      expect(findManyCall.select).toEqual({
        date: true,
        totalBattles: true,
        uniquePlayers: true,
        rateLimitHits: true,
        playerIds: true,
      });

      expect(history).toHaveLength(3);
      expect(history[0].totalBattles).toBe(50);
      expect(history[2].totalBattles).toBe(20);
    });
  });
});
