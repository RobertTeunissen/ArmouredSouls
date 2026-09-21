import { api } from './api';

/**
 * Active-season cycle and pagination filters accepted by the admin report.
 *
 * These filters are intentionally separate from the player Search_Response
 * contract. The backend remains authoritative for range validation and active
 * season resolution.
 */
export interface AdminSearchAnalyticsReportQuery {
  cycleFrom?: number;
  cycleTo?: number;
  page?: number;
  limit?: number;
}

export interface AdminSearchAnalyticsReportPeriod {
  seasonNumber: number;
  cycleNumber: number;
  cycleFrom: number | null;
  cycleTo: number | null;
}

export interface AdminSearchAnalyticsReportOverview {
  totalSearches: number;
  uniqueSearchers: number;
  noResultSearches: number;
}

export interface AdminSearchAnalyticsTrend {
  cycleNumber: number;
  totalSearches: number;
  uniqueSearchers: number;
  noResultSearches: number;
}

export interface AdminSearchAnalyticsPhraseSummary {
  phrase: string;
  count: number;
}

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

/**
 * Safe aggregate report returned by the admin search analytics resource.
 *
 * The response deliberately contains aggregate reporting values only. It does
 * not model raw search event rows, event identifiers, audit payloads, or the
 * player-facing Search_Response DTOs.
 */
export interface AdminSearchAnalyticsReport {
  period: AdminSearchAnalyticsReportPeriod;
  overview: AdminSearchAnalyticsReportOverview;
  trends: AdminSearchAnalyticsTrend[];
  topPhrases: AdminSearchAnalyticsPhraseSummary[];
  noResultPhrases: AdminSearchAnalyticsPhraseSummary[];
  categoryUsage: AdminSearchAnalyticsCategoryUsage;
  playerAnalysis: AdminSearchAnalyticsPlayerAnalysis;
  limitations: AdminSearchAnalyticsLimitation[];
}

/**
 * Convert report filters to the query params accepted by the admin endpoint.
 * Undefined values are omitted so retries can reuse the same filter object
 * without sending placeholder values.
 */
export function buildAdminSearchAnalyticsReportParams(
  query: AdminSearchAnalyticsReportQuery = {},
): Record<string, number> {
  const params: Record<string, number> = {};

  if (query.cycleFrom !== undefined) params.cycleFrom = query.cycleFrom;
  if (query.cycleTo !== undefined) params.cycleTo = query.cycleTo;
  if (query.page !== undefined) params.page = query.page;
  if (query.limit !== undefined) params.limit = query.limit;

  return params;
}

/**
 * Fetch the active-season admin search analytics report.
 *
 * `api.get` preserves the existing admin authentication/error behavior and
 * converts transport failures to the shared safe ApiError shape. Callers can
 * pass the same query object to retry while retaining the active filters.
 */
export async function getAdminSearchAnalyticsReport(
  query: AdminSearchAnalyticsReportQuery = {},
  signal?: AbortSignal,
): Promise<AdminSearchAnalyticsReport> {
  return api.get<AdminSearchAnalyticsReport>('/api/admin/search-analytics/report', {
    params: buildAdminSearchAnalyticsReportParams(query),
    signal,
  });
}
