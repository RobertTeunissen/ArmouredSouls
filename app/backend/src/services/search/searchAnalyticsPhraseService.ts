/**
 * Admin phrase table and CSV export for Search Analytics.
 *
 * Reads aggregates only, over the same active-season scope and counting mode
 * as the report (`buildSource`). Every value is parameterized; the phrase
 * filter escapes LIKE wildcards so a typed `%` or `_` matches literally.
 */
import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { MAXIMUM_QUERY_LENGTH } from './searchTypes';
import {
  asCount,
  buildSource,
  percentage,
  resolveActiveScope,
  validateCycleBounds,
} from './searchAnalyticsReportService';
import type {
  SearchAnalyticsPhrasePage,
  SearchAnalyticsPhraseQuery,
  SearchAnalyticsPhraseRow,
  SearchAnalyticsResultCategory,
} from './searchAnalyticsTypes';

export const SEARCH_PHRASES_DEFAULT_LIMIT = 20;
export const SEARCH_PHRASES_MAX_LIMIT = 100;
export const SEARCH_PHRASES_MAX_PAGE = 10_000;
/** Most rows a CSV export contains. */
export const SEARCH_PHRASES_EXPORT_MAX_ROWS = 5_000;

interface PhraseStatsRow {
  phrase: string;
  searches: bigint | number;
  no_results: bigint | number;
  returned_robots: boolean;
  returned_stables: boolean;
  returned_guide: boolean;
  tracked: bigint | number;
  selected_robots: bigint | number;
  selected_stables: bigint | number;
  selected_guide: bigint | number;
  all_searches: bigint | number;
}

/** Escape `\`, `%` and `_` for a LIKE/ILIKE pattern with `ESCAPE '\'`. Pure. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Map one SQL row to a table row. Pure. */
export function toPhraseRow(row: PhraseStatsRow): SearchAnalyticsPhraseRow {
  const searches = asCount(row.searches);
  const tracked = asCount(row.tracked);
  const selected: Array<[SearchAnalyticsResultCategory, number]> = [
    ['robots', asCount(row.selected_robots)],
    ['stables', asCount(row.selected_stables)],
    ['guide', asCount(row.selected_guide)],
  ];
  // Highest count wins; ties keep the robots → stables → guide order.
  const [topCategory, topCount] = selected.reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  return {
    phrase: row.phrase,
    searches,
    share: percentage(searches, asCount(row.all_searches)) ?? 0,
    noResultRate: percentage(asCount(row.no_results), searches) ?? 0,
    returned: { robots: row.returned_robots, stables: row.returned_stables, guide: row.returned_guide },
    mostChosen: tracked === 0
      ? null
      : topCount === 0
        ? { category: null, share: 0 }
        : { category: topCategory, share: percentage(topCount, tracked) ?? 0 },
  };
}

function validatePhraseQuery(query: SearchAnalyticsPhraseQuery, maxLimit: number): Required<Pick<SearchAnalyticsPhraseQuery, 'page' | 'limit'>> {
  validateCycleBounds(query);
  const page = query.page ?? 1;
  const limit = query.limit ?? SEARCH_PHRASES_DEFAULT_LIMIT;
  if (!Number.isSafeInteger(page) || page < 1 || page > SEARCH_PHRASES_MAX_PAGE) {
    throw new AppError('VALIDATION_ERROR', `Page must be between 1 and ${SEARCH_PHRASES_MAX_PAGE}`, 400);
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new AppError('VALIDATION_ERROR', `Limit must be between 1 and ${maxLimit}`, 400);
  }
  if (query.q !== undefined && query.q.length > MAXIMUM_QUERY_LENGTH) {
    throw new AppError('VALIDATION_ERROR', `Filter cannot exceed ${MAXIMUM_QUERY_LENGTH} characters`, 400);
  }
  return { page, limit };
}

async function queryPhrases(
  query: SearchAnalyticsPhraseQuery,
  page: number,
  limit: number,
): Promise<{ rows: SearchAnalyticsPhraseRow[]; total: number }> {
  const scope = await resolveActiveScope(query);
  const source = buildSource(scope, query.mode ?? 'settled');
  const noResultTab = query.tab === 'noResult';
  const filter = query.q?.trim() ?? '';

  const predicates: Prisma.Sql[] = [];
  if (noResultTab) predicates.push(Prisma.sql`p.no_results > 0`);
  if (filter !== '') predicates.push(Prisma.sql`p.phrase ILIKE ${`%${escapeLikePattern(filter)}%`} ESCAPE '\\'`);
  const where = predicates.length > 0 ? Prisma.sql`WHERE ${Prisma.join(predicates, ' AND ')}` : Prisma.empty;
  const order = noResultTab
    ? Prisma.sql`ORDER BY p.no_results DESC, p.searches DESC, p.phrase ASC`
    : Prisma.sql`ORDER BY p.searches DESC, p.phrase ASC`;

  const statsCte = Prisma.sql`
    ${source},
    phrase_stats AS (
      SELECT
        "normalized_phrase" AS phrase,
        COUNT(*)::bigint AS searches,
        COUNT(*) FILTER (WHERE "no_result")::bigint AS no_results,
        BOOL_OR("robot_result_count" > 0) AS returned_robots,
        BOOL_OR("stable_result_count" > 0) AS returned_stables,
        BOOL_OR("guide_result_count" > 0) AS returned_guide,
        COUNT(*) FILTER (WHERE "selection_tracked")::bigint AS tracked,
        COUNT(*) FILTER (WHERE "selection_tracked" AND "selected_category" = 'robots')::bigint AS selected_robots,
        COUNT(*) FILTER (WHERE "selection_tracked" AND "selected_category" = 'stables')::bigint AS selected_stables,
        COUNT(*) FILTER (WHERE "selection_tracked" AND "selected_category" = 'guide')::bigint AS selected_guide
      FROM src
      GROUP BY "normalized_phrase"
    )
  `;

  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<PhraseStatsRow[]>(Prisma.sql`
      ${statsCte}
      SELECT p.*, (SELECT COUNT(*) FROM src)::bigint AS all_searches
      FROM phrase_stats p
      ${where}
      ${order}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `),
    prisma.$queryRaw<Array<{ total: bigint | number }>>(Prisma.sql`
      ${statsCte}
      SELECT COUNT(*)::bigint AS total FROM phrase_stats p ${where}
    `),
  ]);

  return { rows: rows.map(toPhraseRow), total: asCount(totals[0]?.total) };
}

/** One page of the phrase table. */
export async function getSearchAnalyticsPhrases(query: SearchAnalyticsPhraseQuery = {}): Promise<SearchAnalyticsPhrasePage> {
  const { page, limit } = validatePhraseQuery(query, SEARCH_PHRASES_MAX_LIMIT);
  const { rows, total } = await queryPhrases(query, page, limit);
  return { rows, total, page, limit };
}

/**
 * Quote one CSV cell. Cells starting with `=`, `+`, `-`, `@`, tab or carriage
 * return get a leading apostrophe so a spreadsheet never evaluates them. Pure.
 */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const RETURNED_LETTERS: ReadonlyArray<[SearchAnalyticsResultCategory, string]> = [
  ['robots', 'R'],
  ['stables', 'S'],
  ['guide', 'G'],
];

/** Phrase rows as CSV text (header + rows, CRLF line ends). Pure. */
export function toPhrasesCsv(rows: readonly SearchAnalyticsPhraseRow[]): string {
  const header = ['Phrase', 'Searches', 'Share %', 'No-result %', 'Returned', 'Mostly chosen', 'Chosen %'];
  const lines = rows.map((row) => [
    csvCell(row.phrase),
    csvCell(row.searches),
    csvCell(row.share),
    csvCell(row.noResultRate),
    csvCell(RETURNED_LETTERS.filter(([category]) => row.returned[category]).map(([, letter]) => letter).join(' ')),
    csvCell(row.mostChosen === null ? 'not tracked' : row.mostChosen.category ?? 'nothing'),
    csvCell(row.mostChosen === null ? '' : row.mostChosen.share),
  ].join(','));
  return [header.map(csvCell).join(','), ...lines].join('\r\n');
}

/** CSV of every matching phrase (capped at SEARCH_PHRASES_EXPORT_MAX_ROWS). */
export async function exportSearchAnalyticsPhrasesCsv(query: SearchAnalyticsPhraseQuery = {}): Promise<string> {
  validatePhraseQuery({ ...query, page: 1, limit: SEARCH_PHRASES_EXPORT_MAX_ROWS }, SEARCH_PHRASES_EXPORT_MAX_ROWS);
  const { rows } = await queryPhrases(query, 1, SEARCH_PHRASES_EXPORT_MAX_ROWS);
  return toPhrasesCsv(rows);
}
