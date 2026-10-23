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

import type { Prisma } from '../../../../generated/prisma';
import {
  buildSource,
  getSearchAnalyticsReport,
  mapCategoryResults,
  mapSelection,
  previousWindow,
  SETTLED_SEARCH_WINDOW_SECONDS,
} from '../searchAnalyticsReportService';

const overviewRow = (overrides: Record<string, unknown> = {}) => ({
  total_searches: BigInt(3),
  raw_requests: BigInt(8),
  admin_searchers: BigInt(1),
  unique_searchers: BigInt(2),
  no_result_searches: BigInt(1),
  robots: BigInt(4),
  stables: BigInt(2),
  guide: BigInt(1),
  returned_robots: BigInt(2),
  returned_stables: BigInt(1),
  returned_guide: BigInt(1),
  tracked: BigInt(2),
  selected_robots: BigInt(1),
  selected_stables: BigInt(0),
  selected_guide: BigInt(0),
  tracked_since_cycle: 11,
  ...overrides,
});

const sqlText = (sql: Prisma.Sql): string => sql.strings.join('?');

describe('searchAnalyticsReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 4, seasonCycle: 12 });
    mockHasPersistenceFailure.mockReturnValue(false);
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([overviewRow()])
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
    // No previous window before cycle 1, so no comparison query.
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(5);
    expect(report).toEqual({
      period: { seasonNumber: 4, cycleNumber: 12, cycleFrom: 1, cycleTo: 12, mode: 'settled' },
      overview: {
        totalSearches: 3,
        uniqueSearchers: 2,
        noResultSearches: 1,
        rawRequests: 8,
        adminSearchers: 1,
        noResultRate: 33.3,
        selection: { trackedSearches: 2, ledToResult: 1, rate: 50, trackedSinceCycle: 11 },
      },
      comparison: null,
      trends: [{ cycleNumber: 12, totalSearches: 3, uniqueSearchers: 2, noResultSearches: 1, noResultRate: 33.3 }],
      topPhrases: [{ phrase: 'atlas', count: 2 }],
      noResultPhrases: [{ phrase: 'missing', count: 1 }],
      categoryUsage: { robots: 4, stables: 2, guide: 1 },
      categoryResults: {
        robots: { returnedShare: 66.7, chosenShare: 50 },
        stables: { returnedShare: 33.3, chosenShare: 0 },
        guide: { returnedShare: 33.3, chosenShare: 0 },
        openedNothingShare: 50,
      },
      playerAnalysis: {
        entries: [{ userId: 9, stableName: 'Iron House', searchCount: 2, noResultCount: 1 }],
        page: 2,
        limit: 10,
        total: 2,
      },
      limitations: [{
        code: 'analyticsDataIncomplete',
        message: 'Search analytics data may be incomplete because persistence failed.',
      }],
    });
  });

  it('compares with the previous same-length window when one exists', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([overviewRow({ total_searches: BigInt(10), no_result_searches: BigInt(5) })]);

    const report = await getSearchAnalyticsReport({ cycleFrom: 6, cycleTo: 12 });

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(6);
    expect(report.comparison).toEqual({ cycleFrom: 1, cycleTo: 5, totalSearches: 10, noResultRate: 50 });
  });

  it('reports the authoritative player total when the requested page is empty', async () => {
    mockPrisma.$queryRaw.mockReset();
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([overviewRow({ unique_searchers: BigInt(3) })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const report = await getSearchAnalyticsReport({ page: 2, limit: 2 });

    expect(report.playerAnalysis).toEqual({ entries: [], page: 2, limit: 2, total: 3 });
  });

  it('resolves "last N cycles" against the server cycle and compares with the N before', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([overviewRow()]);

    const report = await getSearchAnalyticsReport({ lastCycles: 3 });

    expect(report.period).toMatchObject({ cycleFrom: 10, cycleTo: 12 });
    expect(report.comparison).toMatchObject({ cycleFrom: 7, cycleTo: 9 });
  });

  it('starts "last N cycles" at cycle 0 early in a season and rejects mixing it with a range', async () => {
    const report = await getSearchAnalyticsReport({ lastCycles: 30 });
    expect(report.period).toMatchObject({ cycleFrom: 0, cycleTo: 12 });

    await expect(getSearchAnalyticsReport({ lastCycles: 3, cycleFrom: 1 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(getSearchAnalyticsReport({ lastCycles: 0 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('should reject cycle filters beyond the server-resolved active cycle without querying events', async () => {
    await expect(getSearchAnalyticsReport({ cycleFrom: 13 })).rejects.toMatchObject({
      code: 'SEARCH_ANALYTICS_CYCLE_OUT_OF_RANGE',
      statusCode: 400,
    });
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('buildSource', () => {
  const scope = { seasonNumber: 4, cycleFrom: null, cycleTo: null, currentCycle: 12 };

  it('drops strict prefix extensions within the settled window in settled mode', () => {
    const sql = buildSource(scope, 'settled');
    const text = sqlText(sql);

    expect(text).toContain('LEAD(s."normalized_phrase") OVER w');
    expect(text).toContain('length(o.next_phrase) > length(o.normalized_phrase)');
    expect(text).toContain('left(o.next_phrase, length(o.normalized_phrase)) = o.normalized_phrase');
    expect(sql.values).toContain(SETTLED_SEARCH_WINDOW_SECONDS);
    expect(SETTLED_SEARCH_WINDOW_SECONDS).toBe(5);
  });

  it('keeps every event in all mode', () => {
    expect(sqlText(buildSource(scope, 'all'))).not.toContain('next_at - o.event_timestamp');
  });
});

describe('previousWindow', () => {
  it('returns the same-length window just before the selected one', () => {
    expect(previousWindow({ seasonNumber: 4, cycleFrom: 32, cycleTo: 38, currentCycle: 40 })).toEqual({ cycleFrom: 25, cycleTo: 31 });
    expect(previousWindow({ seasonNumber: 4, cycleFrom: 38, cycleTo: null, currentCycle: 38 })).toEqual({ cycleFrom: 37, cycleTo: 37 });
  });

  it('clamps at cycle 1 and is null for the whole season or the first cycle', () => {
    expect(previousWindow({ seasonNumber: 4, cycleFrom: 4, cycleTo: 10, currentCycle: 10 })).toEqual({ cycleFrom: 1, cycleTo: 3 });
    expect(previousWindow({ seasonNumber: 4, cycleFrom: null, cycleTo: null, currentCycle: 10 })).toBeNull();
    expect(previousWindow({ seasonNumber: 4, cycleFrom: 1, cycleTo: 5, currentCycle: 10 })).toBeNull();
  });
});

describe('selection and category mapping', () => {
  it('has null rates before selection tracking exists', () => {
    const row = overviewRow({ tracked: BigInt(0), selected_robots: BigInt(0), tracked_since_cycle: null });

    expect(mapSelection(row)).toEqual({ trackedSearches: 0, ledToResult: 0, rate: null, trackedSinceCycle: null });
    expect(mapCategoryResults(row)).toMatchObject({
      robots: { returnedShare: 66.7, chosenShare: null },
      openedNothingShare: null,
    });
  });

  it('keeps the chosen shares and "opened nothing" summing to 100%', () => {
    const results = mapCategoryResults(overviewRow({
      tracked: BigInt(10), selected_robots: BigInt(4), selected_stables: BigInt(2), selected_guide: BigInt(1),
    }));

    expect([results.robots.chosenShare, results.stables.chosenShare, results.guide.chosenShare, results.openedNothingShare])
      .toEqual([40, 20, 10, 30]);
  });
});
