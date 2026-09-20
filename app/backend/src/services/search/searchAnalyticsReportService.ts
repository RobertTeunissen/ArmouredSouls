/**
 * Admin-only aggregate reporting for Search_Analytics_Event values.
 *
 * The report deliberately reads aggregates rather than event rows. The active
 * season is resolved on the server for every request, and every query is
 * parameterized through Prisma's tagged SQL API. Only the bounded player
 * analysis joins current stable display context.
 */

import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { getCurrentSeason } from '../season/seasonService';
import { hasSearchAnalyticsPersistenceFailure } from './searchAnalyticsStore';
import type {
  SearchAnalyticsCategoryUsage,
  SearchAnalyticsLimitation,
  SearchAnalyticsPhraseSummary,
  SearchAnalyticsPlayerAnalysis,
  SearchAnalyticsPlayerAnalysisEntry,
  SearchAnalyticsReport,
  SearchAnalyticsReportQuery,
  SearchAnalyticsTrend,
} from './searchAnalyticsTypes';

export const SEARCH_ANALYTICS_REPORT_DEFAULT_PAGE = 1;
export const SEARCH_ANALYTICS_REPORT_MAX_PAGE = 10_000;
export const SEARCH_ANALYTICS_REPORT_DEFAULT_LIMIT = 50;
export const SEARCH_ANALYTICS_REPORT_MAX_LIMIT = 100;
export const SEARCH_ANALYTICS_REPORT_MAX_CYCLE = 100_000;
export const SEARCH_ANALYTICS_REPORT_PHRASE_LIMIT = 100;

const INCOMPLETE_TELEMETRY_LIMITATION: SearchAnalyticsLimitation = {
  code: 'analyticsDataIncomplete',
  message: 'Search analytics data may be incomplete because persistence failed.',
};

interface OverviewRow {
  total_searches: bigint | number;
  unique_searchers: bigint | number;
  no_result_searches: bigint | number;
  robots: bigint | number | null;
  stables: bigint | number | null;
  guide: bigint | number | null;
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

interface ActiveReportScope {
  seasonNumber: number;
  cycleFrom: number | null;
  cycleTo: number | null;
  currentCycle: number;
}

function asCount(value: bigint | number | null | undefined): number {
  return Number(value ?? 0);
}

function asInteger(value: number): number {
  return Number.isSafeInteger(value) ? value : Math.trunc(value);
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

  return { ...query, page, limit };
}

async function resolveActiveScope(query: SearchAnalyticsReportQuery): Promise<ActiveReportScope> {
  const season = await getCurrentSeason();
  const cycleFrom = query.cycleFrom ?? null;
  const cycleTo = query.cycleTo ?? null;
  const currentCycle = season.seasonCycle;

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

function mapPhraseRows(rows: PhraseRow[]): SearchAnalyticsPhraseSummary[] {
  return rows.map((row) => ({ phrase: row.phrase, count: asCount(row.count) }));
}

function mapTrendRows(rows: TrendRow[]): SearchAnalyticsTrend[] {
  return rows.map((row) => ({
    cycleNumber: asInteger(row.cycle_number),
    totalSearches: asCount(row.total_searches),
    uniqueSearchers: asCount(row.unique_searchers),
    noResultSearches: asCount(row.no_result_searches),
  }));
}

function mapPlayerRows(rows: PlayerAnalysisRow[], page: number, limit: number): SearchAnalyticsPlayerAnalysis {
  const total = asCount(rows[0]?.total_count);
  const entries: SearchAnalyticsPlayerAnalysisEntry[] = rows.map((row) => ({
    userId: asInteger(row.user_id),
    stableName: row.stable_name,
    searchCount: asCount(row.search_count),
    noResultCount: asCount(row.no_result_count),
  }));
  return { entries, page, limit, total };
}

/**
 * Build the active-season admin report without materializing raw analytics
 * events. The report is safe to serialize directly from the returned shape.
 */
export async function getSearchAnalyticsReport(
  input: SearchAnalyticsReportQuery = {},
): Promise<SearchAnalyticsReport> {
  const query = validateReportQuery(input);
  const scope = await resolveActiveScope(query);
  const where = buildWhere(scope);
  const phraseLimit = SEARCH_ANALYTICS_REPORT_PHRASE_LIMIT;
  const offset = (query.page - 1) * query.limit;

  const [overviewRows, trendRows, topPhraseRows, noResultPhraseRows, playerRows] = await Promise.all([
    prisma.$queryRaw<OverviewRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS total_searches,
        COUNT(DISTINCT "user_id")::bigint AS unique_searchers,
        COUNT(*) FILTER (WHERE "no_result")::bigint AS no_result_searches,
        COALESCE(SUM("robot_result_count"), 0)::bigint AS robots,
        COALESCE(SUM("stable_result_count"), 0)::bigint AS stables,
        COALESCE(SUM("guide_result_count"), 0)::bigint AS guide
      FROM "search_analytics_events"
      ${where}
    `),
    prisma.$queryRaw<TrendRow[]>(Prisma.sql`
      SELECT
        "cycle_number" AS cycle_number,
        COUNT(*)::bigint AS total_searches,
        COUNT(DISTINCT "user_id")::bigint AS unique_searchers,
        COUNT(*) FILTER (WHERE "no_result")::bigint AS no_result_searches
      FROM "search_analytics_events"
      ${where}
      GROUP BY "cycle_number"
      ORDER BY "cycle_number" ASC
    `),
    prisma.$queryRaw<PhraseRow[]>(Prisma.sql`
      SELECT "normalized_phrase" AS phrase, COUNT(*)::bigint AS count
      FROM "search_analytics_events"
      ${where}
      GROUP BY "normalized_phrase"
      ORDER BY count DESC, phrase ASC
      LIMIT ${phraseLimit}
    `),
    prisma.$queryRaw<PhraseRow[]>(Prisma.sql`
      SELECT "normalized_phrase" AS phrase, COUNT(*)::bigint AS count
      FROM "search_analytics_events"
      ${where} AND "no_result" = TRUE
      GROUP BY "normalized_phrase"
      ORDER BY count DESC, phrase ASC
      LIMIT ${phraseLimit}
    `),
    prisma.$queryRaw<PlayerAnalysisRow[]>(Prisma.sql`
      SELECT
        "user_id" AS user_id,
        u."stable_name" AS stable_name,
        COUNT(*)::bigint AS search_count,
        COUNT(*) FILTER (WHERE e."no_result")::bigint AS no_result_count,
        COUNT(*) OVER ()::bigint AS total_count
      FROM "search_analytics_events" e
      INNER JOIN "users" u ON u.id = e."user_id"
      ${where}
      GROUP BY e."user_id", u."stable_name"
      ORDER BY search_count DESC, no_result_count DESC, user_id ASC
      LIMIT ${query.limit} OFFSET ${offset}
    `),
  ]);

  const overview = overviewRows[0];
  const categoryUsage: SearchAnalyticsCategoryUsage = {
    robots: asCount(overview?.robots),
    stables: asCount(overview?.stables),
    guide: asCount(overview?.guide),
  };
  const telemetryFailureObserved = typeof hasSearchAnalyticsPersistenceFailure === 'function'
    && hasSearchAnalyticsPersistenceFailure({
      seasonNumber: scope.seasonNumber,
      cycleFrom: scope.cycleFrom,
      cycleTo: scope.cycleTo,
    });
  const limitations = telemetryFailureObserved
    ? [INCOMPLETE_TELEMETRY_LIMITATION]
    : [];

  return {
    period: {
      seasonNumber: scope.seasonNumber,
      cycleNumber: scope.currentCycle,
      cycleFrom: scope.cycleFrom,
      cycleTo: scope.cycleTo,
    },
    overview: {
      totalSearches: asCount(overview?.total_searches),
      uniqueSearchers: asCount(overview?.unique_searchers),
      noResultSearches: asCount(overview?.no_result_searches),
    },
    trends: mapTrendRows(trendRows),
    topPhrases: mapPhraseRows(topPhraseRows),
    noResultPhrases: mapPhraseRows(noResultPhraseRows),
    categoryUsage,
    playerAnalysis: mapPlayerRows(playerRows, query.page, query.limit),
    limitations,
  };
}

export default getSearchAnalyticsReport;
