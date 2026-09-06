/** Unit tests for independently configurable migration feature flags. */

import { getFlags, invalidateFlagCache, isEnabled, setFlag } from '../../../src/services/migration/featureFlags';

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

  it('should return the leaderboard default when no row exists', async () => {
    (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getFlags()).resolves.toEqual({ leaderboard_cache_active: false });
  });

  it('should merge the stored leaderboard flag with its default', async () => {
    (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
      featureFlags: { leaderboard_cache_active: true },
    });

    await expect(getFlags()).resolves.toEqual({ leaderboard_cache_active: true });
  });

  it('should cache a successful read', async () => {
    (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
      featureFlags: { leaderboard_cache_active: true },
    });

    await getFlags();
    await getFlags();

    expect(mockPrisma.cycleMetadata.findUnique).toHaveBeenCalledTimes(1);
  });

  it('should fall back to the leaderboard default when storage is unavailable', async () => {
    (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    await expect(isEnabled('leaderboard_cache_active')).resolves.toBe(false);
  });

  it('should persist and invalidate the leaderboard flag cache', async () => {
    (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
      featureFlags: { leaderboard_cache_active: false },
    });
    (mockPrisma.cycleMetadata.upsert as jest.Mock).mockResolvedValue({});

    await setFlag('leaderboard_cache_active', true);

    expect(mockPrisma.cycleMetadata.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      update: expect.objectContaining({
        featureFlags: expect.objectContaining({ leaderboard_cache_active: true }),
      }),
      create: expect.objectContaining({
        featureFlags: expect.objectContaining({ leaderboard_cache_active: true }),
      }),
    }));
  });
});
