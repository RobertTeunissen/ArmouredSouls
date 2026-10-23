/**
 * Shared fixtures of the Search Analytics page tests (shapes match the backend).
 */
import type {
  AdminSearchAnalyticsPhrasePage,
  AdminSearchAnalyticsReport,
} from '../../../utils/adminSearchAnalyticsApi';

export function makeReport(overrides: Partial<AdminSearchAnalyticsReport> = {}): AdminSearchAnalyticsReport {
  return {
    period: { seasonNumber: 2, cycleNumber: 38, cycleFrom: 32, cycleTo: 38, mode: 'settled' },
    overview: {
      totalSearches: 412,
      uniqueSearchers: 9,
      noResultSearches: 76,
      rawRequests: 1284,
      adminSearchers: 1,
      noResultRate: 18.4,
      selection: { trackedSearches: 120, ledToResult: 73, rate: 60.8, trackedSinceCycle: 36 },
    },
    comparison: { cycleFrom: 25, cycleTo: 31, totalSearches: 374, noResultRate: 21.5 },
    trends: [
      { cycleNumber: 37, totalSearches: 58, uniqueSearchers: 6, noResultSearches: 10, noResultRate: 17.2 },
      { cycleNumber: 38, totalSearches: 68, uniqueSearchers: 7, noResultSearches: 10, noResultRate: 14.7 },
    ],
    topPhrases: [],
    noResultPhrases: [],
    categoryUsage: { robots: 900, stables: 300, guide: 400 },
    categoryResults: {
      robots: { returnedShare: 74, chosenShare: 38 },
      stables: { returnedShare: 41, chosenShare: 14 },
      guide: { returnedShare: 52, chosenShare: 9 },
      openedNothingShare: 39,
    },
    playerAnalysis: {
      entries: [{ userId: 9, stableName: 'Iron House', searchCount: 40, noResultCount: 3 }],
      page: 1,
      limit: 25,
      total: 9,
    },
    limitations: [],
    ...overrides,
  };
}

export function makePhrases(overrides: Partial<AdminSearchAnalyticsPhrasePage> = {}): AdminSearchAnalyticsPhrasePage {
  return {
    rows: [
      {
        phrase: 'laser cannon',
        searches: 24,
        share: 5.8,
        noResultRate: 0,
        returned: { robots: true, stables: false, guide: true },
        mostChosen: { category: 'robots', share: 71.4 },
      },
      {
        phrase: 'plasma sheild',
        searches: 8,
        share: 1.9,
        noResultRate: 100,
        returned: { robots: false, stables: false, guide: false },
        mostChosen: null,
      },
    ],
    total: 2,
    page: 1,
    limit: 20,
    ...overrides,
  };
}
