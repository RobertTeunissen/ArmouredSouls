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

/**
 * How report queries count events: `settled` drops half-typed prefixes (a
 * longer phrase by the same player followed within 5 s); `all` counts every
 * recorded request.
 */
export type SearchAnalyticsCountMode = 'settled' | 'all';

/** Bounded active-season filter used by the admin report service. */
export interface SearchAnalyticsReportQuery {
  cycleFrom?: number;
  cycleTo?: number;
  /**
   * The last N cycles up to the current one, resolved on the server (the
   * "This cycle" / "Last 7 cycles" presets). Exclusive with cycleFrom/cycleTo.
   */
  lastCycles?: number;
  page?: number;
  limit?: number;
  mode?: SearchAnalyticsCountMode;
}

/** Active-season period represented by an admin report. */
export interface SearchAnalyticsReportPeriod extends ActiveSeasonContext {
  cycleFrom: number | null;
  cycleTo: number | null;
  mode: SearchAnalyticsCountMode;
}

/** Category-only selection tracking summary (searches recorded since tracking). */
export interface SearchAnalyticsSelectionSummary {
  /** Counted searches recorded while selection tracking existed. */
  trackedSearches: number;
  /** Of those, searches after which the player opened a result. */
  ledToResult: number;
  /** One decimal; null until a tracked search exists. */
  rate: number | null;
  /** Earliest cycle with a tracked search in scope; null when none. */
  trackedSinceCycle: number | null;
}

/** Aggregate totals represented by an admin report. */
export interface SearchAnalyticsReportOverview {
  /** Searches counted in the report's mode (settled by default). */
  totalSearches: number;
  uniqueSearchers: number;
  noResultSearches: number;
  /** Every recorded request in scope, whatever the mode. */
  rawRequests: number;
  /** How many of the unique searchers are admin accounts (they are included). */
  adminSearchers: number;
  /** One decimal; null without searches. */
  noResultRate: number | null;
  selection: SearchAnalyticsSelectionSummary;
}

/** The same-length window just before the selected one (active season only). */
export interface SearchAnalyticsComparison {
  cycleFrom: number;
  cycleTo: number;
  totalSearches: number;
  noResultRate: number | null;
}

/** Per-category result shares (percentages with one decimal, null when undefined). */
export interface SearchAnalyticsCategoryShare {
  /** Share of counted searches with at least one result in the category. */
  returnedShare: number | null;
  /** Share of tracked searches where the player opened a result of the category. */
  chosenShare: number | null;
}

export interface SearchAnalyticsCategoryResults {
  robots: SearchAnalyticsCategoryShare;
  stables: SearchAnalyticsCategoryShare;
  guide: SearchAnalyticsCategoryShare;
  /** Share of tracked searches after which nothing was opened. */
  openedNothingShare: number | null;
}

/** Per-cycle search totals represented by an admin report. */
export interface SearchAnalyticsTrend {
  cycleNumber: number;
  totalSearches: number;
  uniqueSearchers: number;
  noResultSearches: number;
  noResultRate: number | null;
}

/** Query of the paginated phrase table and its CSV export. */
export interface SearchAnalyticsPhraseQuery {
  cycleFrom?: number;
  cycleTo?: number;
  lastCycles?: number;
  mode?: SearchAnalyticsCountMode;
  tab?: 'all' | 'noResult';
  /** Case-insensitive substring filter on the phrase. */
  q?: string;
  page?: number;
  limit?: number;
}

export type SearchAnalyticsResultCategory = 'robots' | 'stables' | 'guide';

/** One row of the phrase table. */
export interface SearchAnalyticsPhraseRow {
  phrase: string;
  searches: number;
  /** Share of all counted searches in scope (one decimal). */
  share: number;
  noResultRate: number;
  /** Whether any of the phrase's searches returned results in the category. */
  returned: Record<SearchAnalyticsResultCategory, boolean>;
  /**
   * The category opened most often after this phrase, with its share of the
   * phrase's tracked searches. `category: null` = tracked but nothing opened;
   * the whole field is null when no search of the phrase was tracked.
   */
  mostChosen: { category: SearchAnalyticsResultCategory | null; share: number } | null;
}

export interface SearchAnalyticsPhrasePage {
  rows: SearchAnalyticsPhraseRow[];
  total: number;
  page: number;
  limit: number;
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
  comparison: SearchAnalyticsComparison | null;
  trends: SearchAnalyticsTrend[];
  topPhrases: SearchAnalyticsPhraseSummary[];
  noResultPhrases: SearchAnalyticsPhraseSummary[];
  /**
   * @deprecated Sums of returned result COUNTS per category (one search with 10
   * robots adds 10). Use `categoryResults`.
   */
  categoryUsage: SearchAnalyticsCategoryUsage;
  categoryResults: SearchAnalyticsCategoryResults;
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
