/**
 * Typed boundaries for server-side search analytics.
 *
 * These shapes are intentionally separate from the player Search_Response and
 * from AuditLog payloads. Event inputs are constructed from authenticated
 * server context only; the browser never supplies identity, season, cycle,
 * timestamp, or analytics fields.
 */

/** Server-captured season and cycle associated with an executed search. */
export interface ActiveSeasonContext {
  seasonNumber: number;
  cycleNumber: number;
}

/** Result counts captured after the grouped player search is complete. */
export interface SearchAnalyticsResultCounts {
  robotResultCount: number;
  stableResultCount: number;
  guideResultCount: number;
  totalResultCount: number;
  noResult: boolean;
}

/**
 * Complete server-owned input for one Search_Analytics_Event write.
 *
 * `normalizedPhrase` is already the exact trimmed query produced by the
 * Search_Backend. The store persists it without changing or reconstructing it.
 */
export interface SearchAnalyticsEventInput
  extends ActiveSeasonContext,
    SearchAnalyticsResultCounts {
  userId: number;
  eventTimestamp: Date;
  normalizedPhrase: string;
}

/** Bounded active-season filter used by the future admin report service. */
export interface SearchAnalyticsReportQuery {
  cycleFrom?: number;
  cycleTo?: number;
  page?: number;
  limit?: number;
}

/** Active-season period represented by an admin report. */
export interface SearchAnalyticsReportPeriod extends ActiveSeasonContext {
  cycleFrom: number | null;
  cycleTo: number | null;
}

/** Aggregate totals represented by an admin report. */
export interface SearchAnalyticsReportOverview {
  totalSearches: number;
  uniqueSearchers: number;
  noResultSearches: number;
}

/** Per-cycle search totals represented by an admin report. */
export interface SearchAnalyticsTrend {
  cycleNumber: number;
  totalSearches: number;
  uniqueSearchers: number;
  noResultSearches: number;
}

/** Phrase-count entry exposed only through authorized admin reporting. */
export interface SearchAnalyticsPhraseSummary {
  phrase: string;
  count: number;
}

/** Category usage totals represented by an admin report. */
export interface SearchAnalyticsCategoryUsage {
  robots: number;
  stables: number;
  guide: number;
}

/** Safe bounded per-player/stable aggregate row for admin reporting. */
export interface SearchAnalyticsPlayerAnalysisEntry {
  userId: number;
  stableName: string | null;
  searchCount: number;
  noResultCount: number;
}

/** Pagination metadata and bounded detail rows for an admin report. */
export interface SearchAnalyticsPlayerAnalysis {
  entries: SearchAnalyticsPlayerAnalysisEntry[];
  page: number;
  limit: number;
  total: number;
}

/** Typed report limitation used when telemetry persistence is incomplete. */
export type SearchAnalyticsLimitationCode = 'analyticsDataIncomplete';

export interface SearchAnalyticsLimitation {
  code: SearchAnalyticsLimitationCode;
  message: string;
}

/**
 * Player-safe aggregate contract for the future Admin_Search_Analytics_Resource.
 * It contains no raw event row, event identity, database payload, or player
 * Search_Response field.
 */
export interface SearchAnalyticsReport {
  period: SearchAnalyticsReportPeriod;
  overview: SearchAnalyticsReportOverview;
  trends: SearchAnalyticsTrend[];
  topPhrases: SearchAnalyticsPhraseSummary[];
  noResultPhrases: SearchAnalyticsPhraseSummary[];
  categoryUsage: SearchAnalyticsCategoryUsage;
  playerAnalysis: SearchAnalyticsPlayerAnalysis;
  limitations: SearchAnalyticsLimitation[];
}

/** Dedicated write-only boundary for Search_Analytics_Event persistence. */
export interface SearchAnalyticsStore {
  /**
   * Persist exactly one completed event attempt. Database failures propagate to
   * the caller so the orchestration layer can apply Telemetry_Fail_Open without
   * retrying or falling back to AuditLog.
   */
  createEvent(input: SearchAnalyticsEventInput): Promise<void>;
}
