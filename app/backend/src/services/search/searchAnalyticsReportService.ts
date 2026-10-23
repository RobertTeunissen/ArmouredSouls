/**
 * Admin-only aggregate reporting for Search_Analytics_Event values.
 *
 * The report deliberately reads aggregates rather than event rows. The active
 * season is resolved on the server for every request, and every query is
 * parameterized through Prisma's tagged SQL API. Only the bounded player
 * analysis joins current stable display context.
 *
 * Counting modes:
 * - `settled` (default): a search is dropped when the same player's NEXT search
 *   follows within SETTLED_SEARCH_WINDOW_SECONDS and is a longer phrase that
 *   starts with it — the palette sends a request after every typing pause, so
 *   "la", "laser", "laser c" are one search for "laser cannon".
 * - `all`: every recorded request (the stored data is the same in both modes).
 */

import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { getCurrentSeason } from '../season/seasonService';
import { hasSearchAnalyticsPersistenceFailure } from './searchAnalyticsStore';
import type {
  SearchAnalyticsCategoryResults,
  SearchAnalyticsCategoryUsage,
  SearchAnalyticsComparison,
  SearchAnalyticsCountMode,
  SearchAnalyticsLimitation,
  SearchAnalyticsPhraseSummary,
  SearchAnalyticsPlayerAnalysis,
  SearchAnalyticsPlayerAnalysisEntry,
  SearchAnalyticsReport,
  SearchAnalyticsReportQuery,
  SearchAnalyticsSelectionSummary,
  SearchAnalyticsTrend,
} from './searchAnalyticsTypes';

export const SEARCH_ANALYTICS_REPORT_DEFAULT_PAGE = 1;
export const SEARCH_ANALYTICS_REPORT_MAX_PAGE = 10_000;
export const SEARCH_ANALYTICS_REPORT_DEFAULT_LIMIT = 50;
export const SEARCH_ANALYTICS_REPORT_MAX_LIMIT = 100;
export const SEARCH_ANALYTICS_REPORT_MAX_CYCLE = 100_000;
export const SEARCH_ANALYTICS_REPORT_PHRASE_LIMIT = 100;

/** A longer phrase this soon after a shorter one it extends means "still typing". */
export const SETTLED_SEARCH_WINDOW_SECONDS = 5;

const INCOMPLETE_TELEMETRY_LIMITATION: SearchAnalyticsLimitation = {
  code: 'analyticsDataIncomplete',
  message: 'Search analytics data may be incomplete because persistence failed.',
};

interface OverviewRow {
  total_searches: bigint | number;
  raw_requests: bigint | number;
  admin_searchers?: bigint | number;
  unique_searchers: bigint | number;
  no_result_searches: bigint | number;
  robots: bigint | number | null;
  stables: bigint | number | null;
  guide: bigint | number | null;
  returned_robots: bigint | number;
  returned_stables: bigint | number;
  returned_guide: bigint | number;
  tracked: bigint | number;
  selected_robots: bigint | number;
  selected_stables: bigint | number;
  selected_guide: bigint | number;
  tracked_since_cycle: number | null;
}

interface TrendRow {
  cycle_number: number;
  total_searches: bigint | number;
  unique_searchers: bigint | number;
  no_result_searches: bigint | number;
}

interface PhraseRow {
  phrase: string;
  count: bigint | number;
}

interface PlayerAnalysisRow {
  user_id: number;
  stable_name: string | null;
  search_count: bigint | number;
  no_result_count: bigint | number;
  total_count: bigint | number;
}

/** Server-resolved, validated scope of one report query. */
export interface ActiveReportScope {
  seasonNumber: number;
  cycleFrom: number | null;
  cycleTo: number | null;
  currentCycle: number;
}

export function asCount(value: bigint | number | null | undefined): number {
  return Number(value ?? 0);
}

function asInteger(value: number): number {
  return Number.isSafeInteger(value) ? value : Math.trunc(value);
}

/** Percentage with one decimal; null for an empty population. */
export function percentage(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/** Validate cycle bounds (shared by the report, phrases and export). */
export function validateCycleBounds(query: { cycleFrom?: number; cycleTo?: number; lastCycles?: number }): void {
  if (query.lastCycles !== undefined) {
    if (!Number.isSafeInteger(query.lastCycles) || query.lastCycles < 1 || query.lastCycles > SEARCH_ANALYTICS_REPORT_MAX_CYCLE) {
      throw new AppError('VALIDATION_ERROR', `lastCycles must be between 1 and ${SEARCH_ANALYTICS_REPORT_MAX_CYCLE}`, 400);
    }
    if (query.cycleFrom !== undefined || query.cycleTo !== undefined) {
      throw new AppError('VALIDATION_ERROR', 'lastCycles cannot be combined with cycleFrom or cycleTo', 400);
    }
  }
  for (const [field, value] of [
    ['cycleFrom', query.cycleFrom],
    ['cycleTo', query.cycleTo],
  ] as const) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0 || value > SEARCH_ANALYTICS_REPORT_MAX_CYCLE)) {
      throw new AppError('VALIDATION_ERROR', `${field} must be between 0 and ${SEARCH_ANALYTICS_REPORT_MAX_CYCLE}`, 400);
    }
  }
  if (query.cycleFrom !== undefined && query.cycleTo !== undefined && query.cycleFrom > query.cycleTo) {
    throw new AppError('VALIDATION_ERROR', 'cycleFrom cannot be greater than cycleTo', 400);
  }
}

function validateReportQuery(query: SearchAnalyticsReportQuery): Required<Pick<SearchAnalyticsReportQuery, 'page' | 'limit'>> & SearchAnalyticsReportQuery {
  const page = query.page ?? SEARCH_ANALYTICS_REPORT_DEFAULT_PAGE;
  const limit = query.limit ?? SEARCH_ANALYTICS_REPORT_DEFAULT_LIMIT;

  if (!Number.isSafeInteger(page) || page < 1 || page > SEARCH_ANALYTICS_REPORT_MAX_PAGE) {
    throw new AppError('VALIDATION_ERROR', `Page must be between 1 and ${SEARCH_ANALYTICS_REPORT_MAX_PAGE}`, 400);
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > SEARCH_ANALYTICS_REPORT_MAX_LIMIT) {
    throw new AppError('VALIDATION_ERROR', `Limit must be between 1 and ${SEARCH_ANALYTICS_REPORT_MAX_LIMIT}`, 400);
  }
  validateCycleBounds(query);

  return { ...query, page, limit };
}

export async function resolveActiveScope(query: { cycleFrom?: number; cycleTo?: number; lastCycles?: number }): Promise<ActiveReportScope> {
  const season = await getCurrentSeason();
  const currentCycle = season.seasonCycle;
  // "Last N cycles" resolves against the server's current cycle. Cycle 0 holds
  // preparation-phase searches, so the window may start there.
  const cycleFrom = query.lastCycles !== undefined
    ? Math.max(0, currentCycle - query.lastCycles + 1)
    : query.cycleFrom ?? null;
  const cycleTo = query.lastCycles !== undefined ? currentCycle : query.cycleTo ?? null;

  if ((cycleFrom !== null && cycleFrom > currentCycle) || (cycleTo !== null && cycleTo > currentCycle)) {
    throw new AppError(
      'SEARCH_ANALYTICS_CYCLE_OUT_OF_RANGE',
      'The requested cycle range is outside the active season',
      400,
    );
  }

  return {
    seasonNumber: season.seasonNumber,
    cycleFrom,
    cycleTo,
    currentCycle,
  };
}

function buildWhere(scope: ActiveReportScope): Prisma.Sql {
  const predicates: Prisma.Sql[] = [
    Prisma.sql`"season_number" = ${scope.seasonNumber}`,
    // Never report rows written for a future cycle if a rollover or writer was
    // interrupted. The upper bound is server-owned, not client supplied.
    Prisma.sql`"cycle_number" <= ${scope.currentCycle}`,
  ];
  if (scope.cycleFrom !== null) predicates.push(Prisma.sql`"cycle_number" >= ${scope.cycleFrom}`);
  if (scope.cycleTo !== null) predicates.push(Prisma.sql`"cycle_number" <= ${scope.cycleTo}`);
  return Prisma.sql`WHERE ${Prisma.join(predicates, ' AND ')}`;
}

/**
 * `WITH scoped, ordered, src` — `src` holds the events counted in `mode`.
 * Callers append a statement that reads `src` (and may read `scoped`).
 *
 * The settled rule compares each event with the same player's next event in
 * the scope: dropped when it follows within the window and strictly extends
 * the phrase. `left(next, length(phrase)) = phrase` avoids LIKE wildcards in
 * user-typed phrases. A non-prefix correction ("lasr" → "laser") and an equal
 * phrase searched twice stay separate searches.
 */
export function buildSource(scope: ActiveReportScope, mode: SearchAnalyticsCountMode): Prisma.Sql {
  const where = buildWhere(scope);
  const settledFilter = mode === 'settled'
    ? Prisma.sql`WHERE NOT (
        o.next_at IS NOT NULL
        AND o.next_at - o.event_timestamp <= make_interval(secs => ${SETTLED_SEARCH_WINDOW_SECONDS})
        AND length(o.next_phrase) > length(o.normalized_phrase)
        AND left(o.next_phrase, length(o.normalized_phrase)) = o.normalized_phrase
      )`
    : Prisma.empty;
  return Prisma.sql`
    WITH scoped AS (
      SELECT "id", "user_id", "cycle_number", "event_timestamp", "normalized_phrase",
             "robot_result_count", "stable_result_count", "guide_result_count", "no_result",
             "selection_tracked", "selected_category"
      FROM "search_analytics_events"
      ${where}
    ),
    ordered AS (
      SELECT s.*,
             LEAD(s."normalized_phrase") OVER w AS next_phrase,
             LEAD(s."event_timestamp") OVER w AS next_at
      FROM scoped s
      WINDOW w AS (PARTITION BY s."user_id" ORDER BY s."event_timestamp", s."id")
    ),
    src AS (
      SELECT o.* FROM ordered o
      ${settledFilter}
    )
  `;
}

function mapPhraseRows(rows: PhraseRow[]): SearchAnalyticsPhraseSummary[] {
  return rows.map((row) => ({ phrase: row.phrase, count: asCount(row.count) }));
}

function mapTrendRows(rows: TrendRow[]): SearchAnalyticsTrend[] {
  return rows.map((row) => {
    const totalSearches = asCount(row.total_searches);
    const noResultSearches = asCount(row.no_result_searches);
    return {
      cycleNumber: asInteger(row.cycle_number),
      totalSearches,
      uniqueSearchers: asCount(row.unique_searchers),
      noResultSearches,
      noResultRate: percentage(noResultSearches, totalSearches),
    };
  });
}

function mapPlayerRows(
  rows: PlayerAnalysisRow[],
  page: number,
  limit: number,
  total: number,
): SearchAnalyticsPlayerAnalysis {
  const entries: SearchAnalyticsPlayerAnalysisEntry[] = rows.map((row) => ({
    userId: asInteger(row.user_id),
    stableName: row.stable_name,
    searchCount: asCount(row.search_count),
    noResultCount: asCount(row.no_result_count),
  }));
  return { entries, page, limit, total };
}

/** Selection summary from the overview row. Pure. */
export function mapSelection(row: OverviewRow | undefined): SearchAnalyticsSelectionSummary {
  const tracked = asCount(row?.tracked);
  const ledToResult = asCount(row?.selected_robots) + asCount(row?.selected_stables) + asCount(row?.selected_guide);
  return {
    trackedSearches: tracked,
    ledToResult,
    rate: percentage(ledToResult, tracked),
    trackedSinceCycle: row?.tracked_since_cycle ?? null,
  };
}

/** Returned / chosen shares per category from the overview row. Pure. */
export function mapCategoryResults(row: OverviewRow | undefined): SearchAnalyticsCategoryResults {
  const total = asCount(row?.total_searches);
  const tracked = asCount(row?.tracked);
  const selection = mapSelection(row);
  const category = (returned: bigint | number | undefined, selected: bigint | number | undefined) => ({
    returnedShare: percentage(asCount(returned), total),
    chosenShare: percentage(asCount(selected), tracked),
  });
  return {
    robots: category(row?.returned_robots, row?.selected_robots),
    stables: category(row?.returned_stables, row?.selected_stables),
    guide: category(row?.returned_guide, row?.selected_guide),
    openedNothingShare: percentage(tracked - selection.ledToResult, tracked),
  };
}

function overviewQuery(scope: ActiveReportScope, mode: SearchAnalyticsCountMode): Prisma.Sql {
  return Prisma.sql`
    ${buildSource(scope, mode)}
    SELECT
      COUNT(*)::bigint AS total_searches,
      (SELECT COUNT(*) FROM scoped)::bigint AS raw_requests,
      (
        SELECT COUNT(DISTINCT a."user_id") FROM src a
        INNER JOIN "users" u ON u.id = a."user_id"
        WHERE u."role" = 'admin'
      )::bigint AS admin_searchers,
      COUNT(DISTINCT "user_id")::bigint AS unique_searchers,
      COUNT(*) FILTER (WHERE "no_result")::bigint AS no_result_searches,
      COALESCE(SUM("robot_result_count"), 0)::bigint AS robots,
      COALESCE(SUM("stable_result_count"), 0)::bigint AS stables,
      COALESCE(SUM("guide_result_count"), 0)::bigint AS guide,
      COUNT(*) FILTER (WHERE "robot_result_count" > 0)::bigint AS returned_robots,
      COUNT(*) FILTER (WHERE "stable_result_count" > 0)::bigint AS returned_stables,
      COUNT(*) FILTER (WHERE "guide_result_count" > 0)::bigint AS returned_guide,
      COUNT(*) FILTER (WHERE "selection_tracked")::bigint AS tracked,
      COUNT(*) FILTER (WHERE "selection_tracked" AND "selected_category" = 'robots')::bigint AS selected_robots,
      COUNT(*) FILTER (WHERE "selection_tracked" AND "selected_category" = 'stables')::bigint AS selected_stables,
      COUNT(*) FILTER (WHERE "selection_tracked" AND "selected_category" = 'guide')::bigint AS selected_guide,
      MIN("cycle_number") FILTER (WHERE "selection_tracked") AS tracked_since_cycle
    FROM src
  `;
}

/**
 * The same-length cycle window just before the selected one, inside the
 * active season; null for "whole season" or when it would start before cycle 1.
 */
export function previousWindow(scope: ActiveReportScope): { cycleFrom: number; cycleTo: number } | null {
  if (scope.cycleFrom === null) return null;
  const to = scope.cycleTo ?? scope.currentCycle;
  const length = to - scope.cycleFrom + 1;
  const previousTo = scope.cycleFrom - 1;
  if (previousTo < 1 || length < 1) return null;
  return { cycleFrom: Math.max(1, previousTo - length + 1), cycleTo: previousTo };
}

/**
 * Build the active-season admin report without materializing raw analytics
 * events. The report is safe to serialize directly from the returned shape.
 */
export async function getSearchAnalyticsReport(
  input: SearchAnalyticsReportQuery = {},
): Promise<SearchAnalyticsReport> {
  const query = validateReportQuery(input);
  const mode: SearchAnalyticsCountMode = query.mode ?? 'settled';
  const scope = await resolveActiveScope(query);
  const source = buildSource(scope, mode);
  const phraseLimit = SEARCH_ANALYTICS_REPORT_PHRASE_LIMIT;
  const offset = (query.page - 1) * query.limit;
  const previous = previousWindow(scope);
  const previousScope: ActiveReportScope | null = previous ? { ...scope, ...previous } : null;

  const [overviewRows, trendRows, topPhraseRows, noResultPhraseRows, playerRows, previousRows] = await Promise.all([
    prisma.$queryRaw<OverviewRow[]>(overviewQuery(scope, mode)),
    prisma.$queryRaw<TrendRow[]>(Prisma.sql`
      ${source}
      SELECT
        "cycle_number" AS cycle_number,
        COUNT(*)::bigint AS total_searches,
        COUNT(DISTINCT "user_id")::bigint AS unique_searchers,
        COUNT(*) FILTER (WHERE "no_result")::bigint AS no_result_searches
      FROM src
      GROUP BY "cycle_number"
      ORDER BY "cycle_number" ASC
    `),
    prisma.$queryRaw<PhraseRow[]>(Prisma.sql`
      ${source}
      SELECT "normalized_phrase" AS phrase, COUNT(*)::bigint AS count
      FROM src
      GROUP BY "normalized_phrase"
      ORDER BY count DESC, phrase ASC
      LIMIT ${phraseLimit}
    `),
    prisma.$queryRaw<PhraseRow[]>(Prisma.sql`
      ${source}
      SELECT "normalized_phrase" AS phrase, COUNT(*)::bigint AS count
      FROM src
      WHERE "no_result" = TRUE
      GROUP BY "normalized_phrase"
      ORDER BY count DESC, phrase ASC
      LIMIT ${phraseLimit}
    `),
    prisma.$queryRaw<PlayerAnalysisRow[]>(Prisma.sql`
      ${source}
      SELECT
        e."user_id" AS user_id,
        u."stable_name" AS stable_name,
        COUNT(*)::bigint AS search_count,
        COUNT(*) FILTER (WHERE e."no_result")::bigint AS no_result_count,
        COUNT(*) OVER ()::bigint AS total_count
      FROM src e
      INNER JOIN "users" u ON u.id = e."user_id"
      GROUP BY e."user_id", u."stable_name"
      ORDER BY search_count DESC, no_result_count DESC, user_id ASC
      LIMIT ${query.limit} OFFSET ${offset}
    `),
    previousScope
      ? prisma.$queryRaw<OverviewRow[]>(overviewQuery(previousScope, mode))
      : Promise.resolve<OverviewRow[]>([]),
  ]);

  const overview = overviewRows[0];
  const categoryUsage: SearchAnalyticsCategoryUsage = {
    robots: asCount(overview?.robots),
    stables: asCount(overview?.stables),
    guide: asCount(overview?.guide),
  };
  let telemetryFailureObserved: boolean;
  try {
    telemetryFailureObserved = await hasSearchAnalyticsPersistenceFailure({
      seasonNumber: scope.seasonNumber,
      cycleFrom: scope.cycleFrom,
      cycleTo: scope.cycleTo,
    });
  } catch {
    // A status read failure means the report cannot prove complete telemetry;
    // preserve the aggregate report and expose the typed limitation instead.
    telemetryFailureObserved = true;
  }
  const limitations = telemetryFailureObserved
    ? [INCOMPLETE_TELEMETRY_LIMITATION]
    : [];

  const totalSearches = asCount(overview?.total_searches);
  const noResultSearches = asCount(overview?.no_result_searches);
  const previousOverview = previousRows[0];
  const comparison: SearchAnalyticsComparison | null = previous && previousOverview
    ? {
        cycleFrom: previous.cycleFrom,
        cycleTo: previous.cycleTo,
        totalSearches: asCount(previousOverview.total_searches),
        noResultRate: percentage(asCount(previousOverview.no_result_searches), asCount(previousOverview.total_searches)),
      }
    : null;

  return {
    period: {
      seasonNumber: scope.seasonNumber,
      cycleNumber: scope.currentCycle,
      cycleFrom: scope.cycleFrom,
      cycleTo: scope.cycleTo,
      mode,
    },
    overview: {
      totalSearches,
      uniqueSearchers: asCount(overview?.unique_searchers),
      noResultSearches,
      rawRequests: asCount(overview?.raw_requests),
      adminSearchers: asCount(overview?.admin_searchers),
      noResultRate: percentage(noResultSearches, totalSearches),
      selection: mapSelection(overview),
    },
    comparison,
    trends: mapTrendRows(trendRows),
    topPhrases: mapPhraseRows(topPhraseRows),
    noResultPhrases: mapPhraseRows(noResultPhraseRows),
    categoryUsage,
    categoryResults: mapCategoryResults(overview),
    // The windowed player query has no row from which to read its total on an
    // empty page. The overview's distinct-searcher count is the authoritative
    // total for the same active-season/cycle scope in both cases.
    playerAnalysis: mapPlayerRows(
      playerRows,
      query.page,
      query.limit,
      asCount(overview?.unique_searchers),
    ),
    limitations,
  };
}

export default getSearchAnalyticsReport;
