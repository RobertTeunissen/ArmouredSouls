const mockPrisma = {
  $queryRaw: jest.fn(),
};

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockGetCurrentSeason = jest.fn();
jest.mock('../../season/seasonService', () => ({
  getCurrentSeason: mockGetCurrentSeason,
}));

const mockHasPersistenceFailure = jest.fn();
jest.mock('../searchAnalyticsStore', () => ({
  hasSearchAnalyticsPersistenceFailure: mockHasPersistenceFailure,
}));

import { getSearchAnalyticsReport } from '../searchAnalyticsReportService';

describe('searchAnalyticsReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 4, seasonCycle: 12 });
    mockHasPersistenceFailure.mockReturnValue(false);
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{
        total_searches: BigInt(3),
        unique_searchers: BigInt(2),
        no_result_searches: BigInt(1),
        robots: BigInt(4),
        stables: BigInt(2),
        guide: BigInt(1),
      }])
      .mockResolvedValueOnce([{
        cycle_number: 12,
        total_searches: BigInt(3),
        unique_searchers: BigInt(2),
        no_result_searches: BigInt(1),
      }])
      .mockResolvedValueOnce([{ phrase: 'atlas', count: BigInt(2) }])
      .mockResolvedValueOnce([{ phrase: 'missing', count: BigInt(1) }])
      .mockResolvedValueOnce([{
        user_id: 9,
        stable_name: 'Iron House',
        search_count: BigInt(2),
        no_result_count: BigInt(1),
        total_count: BigInt(1),
      }]);
  });

  it('should return active-season aggregates with bounded player analysis and typed limitations', async () => {
    mockHasPersistenceFailure.mockReturnValue(true);

    const report = await getSearchAnalyticsReport({ cycleFrom: 1, cycleTo: 12, page: 2, limit: 10 });

    expect(mockGetCurrentSeason).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(5);
    expect(report).toEqual({
      period: { seasonNumber: 4, cycleNumber: 12, cycleFrom: 1, cycleTo: 12 },
      overview: { totalSearches: 3, uniqueSearchers: 2, noResultSearches: 1 },
      trends: [{ cycleNumber: 12, totalSearches: 3, uniqueSearchers: 2, noResultSearches: 1 }],
      topPhrases: [{ phrase: 'atlas', count: 2 }],
      noResultPhrases: [{ phrase: 'missing', count: 1 }],
      categoryUsage: { robots: 4, stables: 2, guide: 1 },
      playerAnalysis: {
        entries: [{ userId: 9, stableName: 'Iron House', searchCount: 2, noResultCount: 1 }],
        page: 2,
        limit: 10,
        total: 1,
      },
      limitations: [{
        code: 'analyticsDataIncomplete',
        message: 'Search analytics data may be incomplete because persistence failed.',
      }],
    });
  });

  it('should reject cycle filters beyond the server-resolved active cycle without querying events', async () => {
    await expect(getSearchAnalyticsReport({ cycleFrom: 13 })).rejects.toMatchObject({
      code: 'SEARCH_ANALYTICS_CYCLE_OUT_OF_RANGE',
      statusCode: 400,
    });
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });
});
