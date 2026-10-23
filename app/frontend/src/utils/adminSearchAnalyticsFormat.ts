/**
 * Pure helpers of the admin Search Analytics page: URL state, period presets,
 * and the derivations shown in the cards. Unit-tested without rendering.
 */
import type {
  AdminSearchAnalyticsCountMode,
  AdminSearchAnalyticsReport,
  AdminSearchAnalyticsReportQuery,
  AdminSearchResultCategory,
} from './adminSearchAnalyticsApi';
import { computeTrend, type Trend } from './adminDashboardFormat';

export type SearchPeriod = 'this' | 'last7' | 'season' | 'custom';
export type PhraseTab = 'all' | 'noResult';

/** Everything the page keeps in the URL. */
export interface SearchAnalyticsUrlState {
  period: SearchPeriod;
  /** Custom range only. */
  from: number | null;
  to: number | null;
  mode: AdminSearchAnalyticsCountMode;
  tab: PhraseTab;
  q: string;
  /** Phrase table page. */
  page: number;
}

export const DEFAULT_SEARCH_ANALYTICS_STATE: SearchAnalyticsUrlState = {
  period: 'last7',
  from: null,
  to: null,
  mode: 'settled',
  tab: 'all',
  q: '',
  page: 1,
};

function readCycle(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function readPositive(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

/** Read the URL; unknown or invalid values fall back to the defaults. */
export function readSearchAnalyticsState(params: URLSearchParams): SearchAnalyticsUrlState {
  const period = params.get('period');
  const knownPeriod: SearchPeriod = period === 'this' || period === 'season' || period === 'custom' ? period : 'last7';
  const from = readCycle(params.get('from'));
  const to = readCycle(params.get('to'));
  const validCustom = knownPeriod === 'custom' && (from !== null || to !== null) && (from === null || to === null || from <= to);
  return {
    period: knownPeriod === 'custom' && !validCustom ? DEFAULT_SEARCH_ANALYTICS_STATE.period : knownPeriod,
    from: validCustom ? from : null,
    to: validCustom ? to : null,
    mode: params.get('count') === 'all' ? 'all' : 'settled',
    tab: params.get('tab') === 'noResult' ? 'noResult' : 'all',
    q: (params.get('q') ?? '').slice(0, 100),
    page: readPositive(params.get('page'), 1),
  };
}

/** Write the state, omitting defaults so URLs stay short. */
export function writeSearchAnalyticsState(state: SearchAnalyticsUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.period !== DEFAULT_SEARCH_ANALYTICS_STATE.period) params.set('period', state.period);
  if (state.period === 'custom') {
    if (state.from !== null) params.set('from', String(state.from));
    if (state.to !== null) params.set('to', String(state.to));
  }
  if (state.mode !== 'settled') params.set('count', state.mode);
  if (state.tab !== 'all') params.set('tab', state.tab);
  if (state.q.trim() !== '') params.set('q', state.q.trim());
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

/** The report scope of a period. Presets resolve on the server. */
export function periodToQuery(state: Pick<SearchAnalyticsUrlState, 'period' | 'from' | 'to'>): Pick<AdminSearchAnalyticsReportQuery, 'cycleFrom' | 'cycleTo' | 'lastCycles'> {
  switch (state.period) {
    case 'this': return { lastCycles: 1 };
    case 'last7': return { lastCycles: 7 };
    case 'season': return {};
    case 'custom': return {
      ...(state.from !== null ? { cycleFrom: state.from } : {}),
      ...(state.to !== null ? { cycleTo: state.to } : {}),
    };
  }
}

/** Validate a custom range typed by the admin; returns an error message or null. */
export function validateCustomRange(from: string, to: string, currentCycle: number | null): string | null {
  const parsedFrom = readCycle(from);
  const parsedTo = readCycle(to);
  if ((from.trim() !== '' && parsedFrom === null) || (to.trim() !== '' && parsedTo === null)) {
    return 'Cycles must be whole numbers of 0 or more.';
  }
  if (parsedFrom === null && parsedTo === null) return 'Enter a starting or an ending cycle.';
  if (parsedFrom !== null && parsedTo !== null && parsedFrom > parsedTo) {
    return 'The starting cycle cannot be after the ending cycle.';
  }
  if (currentCycle !== null && ((parsedFrom ?? 0) > currentCycle || (parsedTo ?? 0) > currentCycle)) {
    return `The season is at cycle ${currentCycle}.`;
  }
  return null;
}

/** "Season 2 · cycles 32–38" / "Season 2 · cycle 38" / "Season 2 · whole season (cycles 0–38)". */
export function describePeriod(report: AdminSearchAnalyticsReport): string {
  const { seasonNumber, cycleFrom, cycleTo, cycleNumber } = report.period;
  if (cycleFrom === null && cycleTo === null) return `Season ${seasonNumber} · whole season (up to cycle ${cycleNumber})`;
  const from = cycleFrom ?? 0;
  const to = cycleTo ?? cycleNumber;
  return from === to ? `Season ${seasonNumber} · cycle ${from}` : `Season ${seasonNumber} · cycles ${from}–${to}`;
}

/** Caption of a comparison ("vs cycles 25–31"), or null when there is none. */
export function describeComparison(report: AdminSearchAnalyticsReport): string | null {
  const comparison = report.comparison;
  if (!comparison) return null;
  return comparison.cycleFrom === comparison.cycleTo
    ? `vs cycle ${comparison.cycleFrom}`
    : `vs cycles ${comparison.cycleFrom}–${comparison.cycleTo}`;
}

export function searchVolumeTrend(report: AdminSearchAnalyticsReport): Trend | null {
  return report.comparison ? computeTrend(report.overview.totalSearches, report.comparison.totalSearches, 'higher-is-better') : null;
}

/** No-result trend in percentage points (one decimal); lower is better. */
export function noResultTrend(report: AdminSearchAnalyticsReport): Trend | null {
  const current = report.overview.noResultRate;
  const previous = report.comparison?.noResultRate ?? null;
  if (current === null || previous === null) return null;
  const trend = computeTrend(current, previous, 'lower-is-better');
  return trend ? { ...trend, delta: Math.round(trend.delta * 10) / 10 } : null;
}

export const CATEGORY_LABELS: Readonly<Record<AdminSearchResultCategory, string>> = {
  robots: 'Robots',
  stables: 'Stables',
  guide: 'Guide articles',
};

export const CATEGORY_SINGULAR: Readonly<Record<AdminSearchResultCategory, string>> = {
  robots: 'Robot',
  stables: 'Stable',
  guide: 'Guide',
};

/** Percentage text with one decimal, or the fallback. */
export function formatShare(value: number | null, fallback = '—'): string {
  return value === null ? fallback : `${value.toFixed(1)}%`;
}

/** Save a Blob as a download (the CSV export). */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
