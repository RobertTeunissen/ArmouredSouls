/**
 * Unit tests for LeaderboardService.
 *
 * Tests refresh-all generation-swap logic and paginated getLeaderboard queries.
 * Mocks Prisma client and feature flags.
 */

// --- Mocks (before imports) ---

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    leaderboardCache: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    cycleMetadata: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    robot: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    standing: { findMany: jest.fn() },
  },
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../migration/featureFlags', () => ({
  __esModule: true,
  isEnabled: jest.fn(),
}));

// --- Imports ---

import prisma from '../../../lib/prisma';
import { leaderboardService } from '../leaderboardService';
import { isEnabled } from '../../migration/featureFlags';
import { createLeaderboard } from '../../../../tests/factories/leaderboardCacheFactory';

const mockIsEnabled = isEnabled as jest.MockedFunction<typeof isEnabled>;

// --- Tests ---

describe('LeaderboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── refreshAll ─────────────────────────────────────────────────────

  describe('refreshAll', () => {
    it('should skip refresh when feature flag is disabled', async () => {
      mockIsEnabled.mockResolvedValue(false);

      await leaderboardService.refreshAll();

      expect(mockIsEnabled).toHaveBeenCalledWith('leaderboard_cache_active');
      expect(prisma.leaderboardCache.createMany).not.toHaveBeenCalled();
      expect(prisma.cycleMetadata.upsert).not.toHaveBeenCalled();
    });

    it('should compute rankings for all 7 categories', async () => {
      mockIsEnabled.mockResolvedValue(true);
      (prisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { leaderboard_active_generation: 1 },
      });

      // Mock source data for each category
      (prisma.robot.findMany as jest.Mock).mockResolvedValue([
        { id: 1, fame: 500, losses: 10, wins: 20 },
      ]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 1, prestige: 300 },
      ]);
      (prisma.standing.findMany as jest.Mock).mockResolvedValue([
        { entityId: 1, wins: 15, totalZoneScore: 1000 },
      ]);
      (prisma.leaderboardCache.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      await leaderboardService.refreshAll();

      // 7 categories = 7 createMany calls
      expect(prisma.leaderboardCache.createMany).toHaveBeenCalledTimes(7);
    });

    it('should write entries with next generation number', async () => {
      mockIsEnabled.mockResolvedValue(true);
      (prisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { leaderboard_active_generation: 3 },
      });

      (prisma.robot.findMany as jest.Mock).mockResolvedValue([
        { id: 10, fame: 100, losses: 5, wins: 8 },
      ]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 20, prestige: 200 },
      ]);
      (prisma.standing.findMany as jest.Mock).mockResolvedValue([
        { entityId: 30, wins: 12, totalZoneScore: 500 },
      ]);
      (prisma.leaderboardCache.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      await leaderboardService.refreshAll();

      // All entries should be written with generation = 4 (current 3 + 1)
      const calls = (prisma.leaderboardCache.createMany as jest.Mock).mock.calls;
      for (const call of calls) {
        const data = call[0].data as Array<{ generation: number }>;
        for (const entry of data) {
          expect(entry.generation).toBe(4);
        }
      }
    });

    it('should update active generation pointer after insert', async () => {
      mockIsEnabled.mockResolvedValue(true);
      (prisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { leaderboard_active_generation: 2 },
      });

      (prisma.robot.findMany as jest.Mock).mockResolvedValue([
        { id: 1, fame: 100, losses: 0, wins: 5 },
      ]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 1, prestige: 50 },
      ]);
      (prisma.standing.findMany as jest.Mock).mockResolvedValue([
        { entityId: 1, wins: 3, totalZoneScore: 100 },
      ]);
      (prisma.leaderboardCache.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      await leaderboardService.refreshAll();

      // upsert should be called to set active generation to 3
      expect(prisma.cycleMetadata.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          update: { featureFlags: expect.objectContaining({ leaderboard_active_generation: 3 }) },
          create: { id: 1, featureFlags: expect.objectContaining({ leaderboard_active_generation: 3 }) },
        }),
      );
    });

    it('should delete old generation rows after swap', async () => {
      mockIsEnabled.mockResolvedValue(true);
      (prisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { leaderboard_active_generation: 5 },
      });

      (prisma.robot.findMany as jest.Mock).mockResolvedValue([
        { id: 1, fame: 100, losses: 0, wins: 5 },
      ]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 1, prestige: 50 },
      ]);
      (prisma.standing.findMany as jest.Mock).mockResolvedValue([
        { entityId: 1, wins: 3, totalZoneScore: 100 },
      ]);
      (prisma.leaderboardCache.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      await leaderboardService.refreshAll();

      // Should delete rows where generation < 6 (new active gen)
      expect(prisma.leaderboardCache.deleteMany).toHaveBeenCalledWith({
        where: { generation: { lt: 6 } },
      });
    });

    it('should limit to 200 entries per category', async () => {
      mockIsEnabled.mockResolvedValue(true);
      (prisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { leaderboard_active_generation: 0 },
      });

      // Return empty arrays so we can verify the take: 200 in source queries
      (prisma.robot.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.standing.findMany as jest.Mock).mockResolvedValue([]);

      await leaderboardService.refreshAll();

      // Check that all robot.findMany calls use take: 200
      const robotCalls = (prisma.robot.findMany as jest.Mock).mock.calls;
      for (const call of robotCalls) {
        expect(call[0].take).toBe(200);
      }

      // Check that user.findMany calls use take: 200
      const userCalls = (prisma.user.findMany as jest.Mock).mock.calls;
      for (const call of userCalls) {
        expect(call[0].take).toBe(200);
      }

      // Check that standing.findMany calls use take: 200
      const standingCalls = (prisma.standing.findMany as jest.Mock).mock.calls;
      for (const call of standingCalls) {
        expect(call[0].take).toBe(200);
      }
    });
  });

  // ── getLeaderboard ─────────────────────────────────────────────────

  describe('getLeaderboard', () => {
    it('should return empty result when feature flag is disabled', async () => {
      mockIsEnabled.mockResolvedValue(false);

      const result = await leaderboardService.getLeaderboard('fame', 1, 20);

      expect(result).toEqual({
        entries: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        updatedAt: null,
      });
      expect(prisma.leaderboardCache.findMany).not.toHaveBeenCalled();
    });

    it('should return empty result with updatedAt null when cache is empty', async () => {
      mockIsEnabled.mockResolvedValue(true);
      (prisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { leaderboard_active_generation: 1 },
      });
      (prisma.leaderboardCache.count as jest.Mock).mockResolvedValue(0);

      const result = await leaderboardService.getLeaderboard('fame', 1, 20);

      expect(result).toEqual({
        entries: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        updatedAt: null,
      });
      expect(prisma.leaderboardCache.findMany).not.toHaveBeenCalled();
    });

    it('should return paginated entries ordered by rank', async () => {
      mockIsEnabled.mockResolvedValue(true);
      (prisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { leaderboard_active_generation: 1 },
      });

      const entries = createLeaderboard('fame', 5, { generation: 1 });
      (prisma.leaderboardCache.count as jest.Mock).mockResolvedValue(50);
      (prisma.leaderboardCache.findMany as jest.Mock).mockResolvedValue(entries);

      const result = await leaderboardService.getLeaderboard('fame', 2, 5);

      expect(prisma.leaderboardCache.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'fame', generation: 1 },
          orderBy: { rank: 'asc' },
          skip: 5,
          take: 5,
        }),
      );
      expect(result.entries).toHaveLength(5);
      expect(result.pagination).toEqual({ page: 2, pageSize: 5, total: 50, totalPages: 10 });
    });

    it('should include updatedAt from first matching row', async () => {
      mockIsEnabled.mockResolvedValue(true);
      (prisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { leaderboard_active_generation: 1 },
      });

      const updatedAt = new Date('2025-07-01T10:00:00Z');
      const entries = createLeaderboard('prestige', 3, { generation: 1 });
      entries[0].updatedAt = updatedAt;
      (prisma.leaderboardCache.count as jest.Mock).mockResolvedValue(3);
      (prisma.leaderboardCache.findMany as jest.Mock).mockResolvedValue(entries);

      const result = await leaderboardService.getLeaderboard('prestige', 1, 20);

      expect(result.updatedAt).toEqual(updatedAt);
    });

    it('should calculate totalPages correctly', async () => {
      mockIsEnabled.mockResolvedValue(true);
      (prisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { leaderboard_active_generation: 1 },
      });

      const entries = createLeaderboard('career_wins', 10, { generation: 1 });
      (prisma.leaderboardCache.count as jest.Mock).mockResolvedValue(45);
      (prisma.leaderboardCache.findMany as jest.Mock).mockResolvedValue(entries);

      const result = await leaderboardService.getLeaderboard('career_wins', 1, 10);

      // 45 total / 10 per page = 5 pages (ceil)
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.total).toBe(45);
    });
  });
});
