import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import {
  buildAdminSearchAnalyticsReportParams,
  getAdminSearchAnalyticsReport,
} from '../adminSearchAnalyticsApi';
import type { AdminSearchAnalyticsReport } from '../adminSearchAnalyticsApi';

vi.mock('../api', () => ({
  api: { get: vi.fn() },
}));

const mockedGet = vi.mocked(api.get);

const REPORT: AdminSearchAnalyticsReport = {
  period: {
    seasonNumber: 4,
    cycleNumber: 17,
    cycleFrom: 5,
    cycleTo: 12,
  },
  overview: {
    totalSearches: 10,
    uniqueSearchers: 3,
    noResultSearches: 2,
  },
  trends: [
    {
      cycleNumber: 5,
      totalSearches: 4,
      uniqueSearchers: 2,
      noResultSearches: 1,
    },
  ],
  topPhrases: [{ phrase: 'atlas', count: 4 }],
  noResultPhrases: [{ phrase: 'unknown', count: 2 }],
  categoryUsage: { robots: 4, stables: 3, guide: 1 },
  playerAnalysis: {
    entries: [
      {
        userId: 42,
        stableName: 'North Star',
        searchCount: 5,
        noResultCount: 1,
      },
    ],
    page: 1,
    limit: 50,
    total: 1,
  },
  limitations: [],
};

describe('adminSearchAnalyticsApi', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('forwards active-season filters, pagination, and AbortSignal to the single report endpoint', async () => {
    const signal = new AbortController().signal;
    const query = { cycleFrom: 5, cycleTo: 12, page: 2, limit: 25 };
    mockedGet.mockResolvedValueOnce(REPORT);

    await expect(getAdminSearchAnalyticsReport(query, signal)).resolves.toBe(REPORT);

    expect(mockedGet).toHaveBeenCalledWith('/api/admin/search-analytics/report', {
      params: query,
      signal,
    });
  });

  it('omits undefined filters and never adds player search request fields', () => {
    expect(buildAdminSearchAnalyticsReportParams({ page: 1 })).toEqual({ page: 1 });
    expect(buildAdminSearchAnalyticsReportParams()).toEqual({});

    mockedGet.mockResolvedValueOnce(REPORT);
    return getAdminSearchAnalyticsReport({ page: 1 }).then(() => {
      const requestConfig = mockedGet.mock.calls[0]?.[1];
      expect(requestConfig).toEqual({ params: { page: 1 }, signal: undefined });
      expect(requestConfig?.params).not.toHaveProperty('q');
      expect(requestConfig?.params).not.toHaveProperty('history');
      expect(requestConfig?.params).not.toHaveProperty('selection');
      expect(requestConfig?.params).not.toHaveProperty('eventRows');
    });
  });
});
