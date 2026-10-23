/**
 * Data hook of the admin Search Analytics page.
 *
 * Two independent sections with their own loading/error state:
 * - the report (cards, chart, categories, searchers) — depends on period,
 *   counting mode and the searchers page;
 * - the phrase table — additionally depends on tab, filter and table page.
 *
 * A newer request aborts the older one of the same section, so a slow response
 * can never overwrite the current filters.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import {
  getAdminSearchAnalyticsPhrases,
  getAdminSearchAnalyticsReport,
  type AdminSearchAnalyticsPhrasePage,
  type AdminSearchAnalyticsReport,
} from '../utils/adminSearchAnalyticsApi';
import { periodToQuery, type SearchAnalyticsUrlState } from '../utils/adminSearchAnalyticsFormat';

export const SEARCHERS_PAGE_SIZE = 25;
export const PHRASES_PAGE_SIZE = 20;

export interface AsyncSection<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** When the current data arrived (ISO), or null. */
  fetchedAt: string | null;
}

function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return 'You are not authorized to view search analytics.';
    if (error.statusCode === 400) return 'The selected cycles are not valid for the active season.';
  }
  return fallback;
}

function useSection<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  fallbackError: string,
): ReloadableSection<T> {
  const [state, setState] = useState<AsyncSection<T>>({ data: null, loading: true, error: null, fetchedAt: null });
  const [token, setToken] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: null, fetchedAt: new Date().toISOString() });
      },
      (error: unknown) => {
        if (isAbortError(error, controller.signal)) return;
        setState((previous) => ({ ...previous, loading: false, error: safeErrorMessage(error, fallbackError) }));
      },
    );
    return () => controller.abort();
    // `load` is recreated every render; the explicit deps decide when to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, token]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  return { ...state, reload };
}

export type ReloadableSection<T> = AsyncSection<T> & { reload: () => void };

export interface SearchAnalyticsData {
  report: ReloadableSection<AdminSearchAnalyticsReport>;
  phrases: ReloadableSection<AdminSearchAnalyticsPhrasePage>;
  searchersPage: number;
  setSearchersPage: (page: number) => void;
  /** When the report last loaded (ISO), or null. */
  lastUpdated: string | null;
  refresh: () => void;
}

export function useSearchAnalytics(state: SearchAnalyticsUrlState): SearchAnalyticsData {
  const [searchersPage, setSearchersPage] = useState(1);
  const scope = periodToQuery(state);
  const scopeKey = JSON.stringify(scope);

  // A new period or counting mode starts the searchers list at page 1.
  useEffect(() => { setSearchersPage(1); }, [scopeKey, state.mode]);

  const report = useSection(
    (signal) => getAdminSearchAnalyticsReport({ ...scope, mode: state.mode, page: searchersPage, limit: SEARCHERS_PAGE_SIZE }, signal),
    [scopeKey, state.mode, searchersPage],
    'Unable to load search analytics. Try again.',
  );
  const phrases = useSection(
    (signal) => getAdminSearchAnalyticsPhrases({
      ...scope, mode: state.mode, tab: state.tab, q: state.q, page: state.page, limit: PHRASES_PAGE_SIZE,
    }, signal),
    [scopeKey, state.mode, state.tab, state.q, state.page],
    'Unable to load the phrases. Try again.',
  );

  const { reload: reloadReport } = report;
  const { reload: reloadPhrases } = phrases;
  const refresh = useCallback(() => {
    reloadReport();
    reloadPhrases();
  }, [reloadPhrases, reloadReport]);

  return { report, phrases, searchersPage, setSearchersPage, lastUpdated: report.fetchedAt, refresh };
}
