jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    cycleMetadata: { update: jest.fn() },
  },
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import prisma from '../../../lib/prisma';
import { purgeHistory } from '../seasonPurgeService';

describe('purgeHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(0);
    (prisma.cycleMetadata.update as jest.Mock).mockResolvedValue(undefined);
  });

  it('counts and truncates search analytics events with the active-season history tables', async () => {
    (prisma.$queryRawUnsafe as jest.Mock).mockImplementation(async (query: string) => {
      const table = query.match(/FROM "([^"]+)"/)?.[1];
      return [{ count: BigInt(table === 'search_analytics_events' ? 7 : 0) }];
    });

    const rowsDeleted = await purgeHistory();

    expect(rowsDeleted.search_analytics_events).toBe(7);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(9);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('"search_analytics_events"'),
    );
    expect(prisma.cycleMetadata.update).toHaveBeenCalledTimes(1);
  });

  it('does not truncate or advance the cycle counter when a required table count fails', async () => {
    const purgeError = new Error('search analytics count failed');
    (prisma.$queryRawUnsafe as jest.Mock).mockImplementation(async (query: string) => {
      if (query.includes('"search_analytics_events"')) {
        throw purgeError;
      }
      return [{ count: BigInt(0) }];
    });

    await expect(purgeHistory()).rejects.toThrow(purgeError);

    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.cycleMetadata.update).not.toHaveBeenCalled();
  });
});
