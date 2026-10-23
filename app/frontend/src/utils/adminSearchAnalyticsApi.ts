import { api } from './api';

/**
 * Typed API of the admin Search Analytics page (`/admin/search-analytics`).
 *
 * Mirrors `app/backend/src/services/search/searchAnalyticsTypes.ts`. Every
 * endpoint is aggregate-only: no raw search event rows, event identifiers,
 * audit payloads or player Search_Response DTOs.
 */

/** `settled` drops half-typed prefixes; `all` counts every recorded request. */
export type AdminSearchAnalyticsCountMode = 'settled' | 'all';

/**
 * Active-season cycle, counting-mode and pagination filters of the report.
 * The backend remains authoritative for range validation and season resolution.
 */
export interface AdminSearchAnalyticsReportQuery {
  cycleFrom?: number;
  cycleTo?: number;
  /** The last N cycles up to the current one, resolved on the server. */
  lastCycles?: number;
  page?: number;
  limit?: number;
  mode?: AdminSearchAnalyticsCountMode;
}

export interface AdminSearchAnalyticsReportPeriod {
  seasonNumber: number;
  cycleNumber: number;
  cycleFrom: number | null;
  cycleTo: number | null;
  mode: AdminSearchAnalyticsCountMode;
}

export interface AdminSearchAnalyticsSelectionSummary {
  trackedSearches: number;
  ledToResult: number;
  /** One decimal; null until a tracked search exists. */
  rate: number | null;
  trackedSinceCycle: number | null;
}

export interface AdminSearchAnalyticsReportOverview {
  /** Searches counted in the report's mode. */
  totalSearches: number;
  uniqueSearchers: number;
  noResultSearches: number;
  /** Every recorded request, whatever the mode. */
  rawRequests: number;
  /** How many of the unique searchers are admin accounts (they are included). */
  adminSearchers: number;
  noResultRate: number | null;
  selection: AdminSearchAnalyticsSelectionSummary;
}

export interface AdminSearchAnalyticsComparison {
  cycleFrom: number;
  cycleTo: number;
  totalSearches: number;
  noResultRate: number | null;
}

export interface AdminSearchAnalyticsCategoryShare {
  returnedShare: number | null;
  chosenShare: number | null;
}

export interface AdminSearchAnalyticsCategoryResults {
  robots: AdminSearchAnalyticsCategoryShare;
  stables: AdminSearchAnalyticsCategoryShare;
  guide: AdminSearchAnalyticsCategoryShare;
  openedNothingShare: number | null;
}

export interface AdminSearchAnalyticsTrend {
  cycleNumber: number;
  totalSearches: number;
  uniqueSearchers: number;
  noResultSearches: number;
  noResultRate: number | null;
}

export interface AdminSearchAnalyticsPhraseSummary {
  phrase: string;
  count: number;
}

/** @deprecated Sums of result counts; use `categoryResults`. */
export interface AdminSearchAnalyticsCategoryUsage {
  robots: number;
  stables: number;
  guide: number;
}

export interface AdminSearchAnalyticsPlayerAnalysisEntry {
  userId: number;
  stableName: string | null;
  searchCount: number;
  noResultCount: number;
}

export interface AdminSearchAnalyticsPlayerAnalysis {
  entries: AdminSearchAnalyticsPlayerAnalysisEntry[];
  page: number;
  limit: number;
  total: number;
}

export type AdminSearchAnalyticsLimitationCode = 'analyticsDataIncomplete';

export interface AdminSearchAnalyticsLimitation {
  code: AdminSearchAnalyticsLimitationCode;
  message: string;
}

export interface AdminSearchAnalyticsReport {
  period: AdminSearchAnalyticsReportPeriod;
  overview: AdminSearchAnalyticsReportOverview;
  comparison: AdminSearchAnalyticsComparison | null;
  trends: AdminSearchAnalyticsTrend[];
  topPhrases: AdminSearchAnalyticsPhraseSummary[];
  noResultPhrases: AdminSearchAnalyticsPhraseSummary[];
  categoryUsage: AdminSearchAnalyticsCategoryUsage;
  categoryResults: AdminSearchAnalyticsCategoryResults;
  playerAnalysis: AdminSearchAnalyticsPlayerAnalysis;
  limitations: AdminSearchAnalyticsLimitation[];
}

export type AdminSearchResultCategory = 'robots' | 'stables' | 'guide';

export interface AdminSearchAnalyticsPhraseRow {
  phrase: string;
  searches: number;
  share: number;
  noResultRate: number;
  returned: Record<AdminSearchResultCategory, boolean>;
  /** Null when no search of the phrase was tracked; `category: null` = nothing opened. */
  mostChosen: { category: AdminSearchResultCategory | null; share: number } | null;
}

export interface AdminSearchAnalyticsPhrasePage {
  rows: AdminSearchAnalyticsPhraseRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminSearchAnalyticsPhraseQuery {
  cycleFrom?: number;
  cycleTo?: number;
  lastCycles?: number;
  mode?: AdminSearchAnalyticsCountMode;
  tab?: 'all' | 'noResult';
  q?: string;
  page?: number;
  limit?: number;
}

/**
 * Convert report filters to the query params accepted by the admin endpoint.
 * Undefined values are omitted so retries can reuse the same filter object
 * without sending placeholder values.
 */
export function buildAdminSearchAnalyticsReportParams(
  query: AdminSearchAnalyticsReportQuery = {},
): Record<string, number | string> {
  const params: Record<string, number | string> = {};

  if (query.cycleFrom !== undefined) params.cycleFrom = query.cycleFrom;
  if (query.cycleTo !== undefined) params.cycleTo = query.cycleTo;
  if (query.lastCycles !== undefined) params.lastCycles = query.lastCycles;
  if (query.page !== undefined) params.page = query.page;
  if (query.limit !== undefined) params.limit = query.limit;
  if (query.mode !== undefined) params.mode = query.mode;

  return params;
}

/** Same for the phrase table and export; an empty filter is omitted. */
export function buildAdminSearchAnalyticsPhraseParams(
  query: AdminSearchAnalyticsPhraseQuery = {},
): Record<string, number | string> {
  const params: Record<string, number | string> = {};
  if (query.cycleFrom !== undefined) params.cycleFrom = query.cycleFrom;
  if (query.cycleTo !== undefined) params.cycleTo = query.cycleTo;
  if (query.lastCycles !== undefined) params.lastCycles = query.lastCycles;
  if (query.mode !== undefined) params.mode = query.mode;
  if (query.tab !== undefined) params.tab = query.tab;
  if (query.q !== undefined && query.q.trim() !== '') params.q = query.q.trim();
  if (query.page !== undefined) params.page = query.page;
  if (query.limit !== undefined) params.limit = query.limit;
  return params;
}

/** Fetch the active-season admin search analytics report. */
export async function getAdminSearchAnalyticsReport(
  query: AdminSearchAnalyticsReportQuery = {},
  signal?: AbortSignal,
): Promise<AdminSearchAnalyticsReport> {
  return api.get<AdminSearchAnalyticsReport>('/api/admin/search-analytics/report', {
    params: buildAdminSearchAnalyticsReportParams(query),
    signal,
  });
}

/** Fetch one page of the phrase table. */
export async function getAdminSearchAnalyticsPhrases(
  query: AdminSearchAnalyticsPhraseQuery = {},
  signal?: AbortSignal,
): Promise<AdminSearchAnalyticsPhrasePage> {
  return api.get<AdminSearchAnalyticsPhrasePage>('/api/admin/search-analytics/phrases', {
    params: buildAdminSearchAnalyticsPhraseParams(query),
    signal,
  });
}

/** Download the filtered phrase table as CSV (page/limit are ignored by the export). */
export async function downloadAdminSearchAnalyticsPhrasesCsv(
  query: Omit<AdminSearchAnalyticsPhraseQuery, 'page' | 'limit'> = {},
): Promise<Blob> {
  return api.get<Blob>('/api/admin/search-analytics/phrases/export', {
    params: buildAdminSearchAnalyticsPhraseParams(query),
    responseType: 'blob',
  });
}
