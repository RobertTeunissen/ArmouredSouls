/**
 * Unit tests for migration feature flags service.
 *
 * Tests the caching logic, default behavior, and fail-safe patterns
 * without touching the database (prisma is mocked).
 */

import { invalidateFlagCache, getFlags, setFlag, isEnabled } from '../../../src/services/migration/featureFlags';

// Mock prisma
jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    cycleMetadata: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

import prisma from '../../../src/lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Migration Feature Flags', () => {
  beforeEach(() => {
    invalidateFlagCache();
    jest.clearAllMocks();
  });

  describe('getFlags', () => {
    it('should return default flags when no row exists', async () => {
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue(null);

      const flags = await getFlags();

      expect(flags).toEqual({
        financial_ledger_active: false,
        leaderboard_cache_active: false,
      });
    });

    it('should merge stored flags with defaults', async () => {
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { financial_ledger_active: true },
      });

      const flags = await getFlags();

      expect(flags).toEqual({
        financial_ledger_active: true,
        leaderboard_cache_active: false,
      });
    });

    it('should cache results and not query DB again within TTL', async () => {
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { financial_ledger_active: true, leaderboard_cache_active: true },
      });

      await getFlags();
      await getFlags();
      await getFlags();

      expect(mockPrisma.cycleMetadata.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should return defaults on database error (fail-safe)', async () => {
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockRejectedValue(
        new Error('Connection refused'),
      );

      const flags = await getFlags();

      expect(flags).toEqual({
        financial_ledger_active: false,
        leaderboard_cache_active: false,
      });
    });

    it('should cache defaults on error to avoid hammering DB', async () => {
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockRejectedValue(
        new Error('Connection refused'),
      );

      await getFlags();
      await getFlags();

      expect(mockPrisma.cycleMetadata.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateFlagCache', () => {
    it('should force a fresh DB read on next getFlags call', async () => {
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { financial_ledger_active: true, leaderboard_cache_active: false },
      });

      await getFlags();
      expect(mockPrisma.cycleMetadata.findUnique).toHaveBeenCalledTimes(1);

      invalidateFlagCache();

      await getFlags();
      expect(mockPrisma.cycleMetadata.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('setFlag', () => {
    it('should upsert with the updated flag value', async () => {
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { financial_ledger_active: false, leaderboard_cache_active: false },
      });
      (mockPrisma.cycleMetadata.upsert as jest.Mock).mockResolvedValue({});

      await setFlag('financial_ledger_active', true);

      expect(mockPrisma.cycleMetadata.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          update: expect.objectContaining({
            featureFlags: expect.objectContaining({ financial_ledger_active: true }),
          }),
          create: expect.objectContaining({
            id: 1,
            featureFlags: expect.objectContaining({ financial_ledger_active: true }),
          }),
        }),
      );
    });

    it('should invalidate cache after setting a flag', async () => {
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { financial_ledger_active: false, leaderboard_cache_active: false },
      });
      (mockPrisma.cycleMetadata.upsert as jest.Mock).mockResolvedValue({});

      await setFlag('leaderboard_cache_active', true);

      // Next getFlags call should hit the DB again
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { financial_ledger_active: false, leaderboard_cache_active: true },
      });

      const flags = await getFlags();
      expect(flags.leaderboard_cache_active).toBe(true);
      // First call from setFlag internals + second from getFlags after invalidate
      expect(mockPrisma.cycleMetadata.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('isEnabled', () => {
    it('should return true when flag is enabled', async () => {
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { financial_ledger_active: true, leaderboard_cache_active: false },
      });

      expect(await isEnabled('financial_ledger_active')).toBe(true);
    });

    it('should return false when flag is disabled', async () => {
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
        featureFlags: { financial_ledger_active: false, leaderboard_cache_active: false },
      });

      expect(await isEnabled('leaderboard_cache_active')).toBe(false);
    });

    it('should return false on DB error (fail-safe)', async () => {
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockRejectedValue(
        new Error('timeout'),
      );

      expect(await isEnabled('financial_ledger_active')).toBe(false);
      expect(await isEnabled('leaderboard_cache_active')).toBe(false);
    });
  });
});
