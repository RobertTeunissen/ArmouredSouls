import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdminDataTable,
  AdminPageHeader,
  AdminStatCard,
} from '../../components/admin/shared';
import { ApiError } from '../../utils/ApiError';
import {
  getAdminSearchAnalyticsReport,
  type AdminSearchAnalyticsPlayerAnalysisEntry,
  type AdminSearchAnalyticsReport,
  type AdminSearchAnalyticsReportQuery,
  type AdminSearchAnalyticsTrend,
} from '../../utils/adminSearchAnalyticsApi';
import { SearchAnalyticsPagination } from '../../components/admin/search-analytics/SearchAnalyticsPagination';
import { SearchAnalyticsPhraseList } from '../../components/admin/search-analytics/SearchAnalyticsPhraseList';

const DEFAULT_PAGE_SIZE = 50;

interface CycleFilters {
  cycleFrom: string;
  cycleTo: string;
}

interface TrendRow extends AdminSearchAnalyticsTrend {
  [key: string]: unknown;
}

interface PlayerRow extends AdminSearchAnalyticsPlayerAnalysisEntry {
  [key: string]: unknown;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return 'You are not authorized to view search analytics.';
    }
    if (error.statusCode === 400) {
      return 'The selected cycle filters are not valid for the active season.';
    }
  }
  return 'Unable to load search analytics. Try again.';
}

function parseCycle(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function SearchAnalyticsPage(): React.ReactElement {
  const [report, setReport] = useState<AdminSearchAnalyticsReport | null>(null);
  const [query, setQuery] = useState<AdminSearchAnalyticsReportQuery>({ limit: DEFAULT_PAGE_SIZE, page: 1 });
  const [filters, setFilters] = useState<CycleFilters>({ cycleFrom: '', cycleTo: '' });
  const [filterError, setFilterError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (requestQuery: AdminSearchAnalyticsReportQuery, signal: AbortSignal): Promise<void> => {
    try {
      const result = await getAdminSearchAnalyticsReport(requestQuery, signal);
      setReport(result);
      setError(null);
    } catch (requestError: unknown) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      setError(safeErrorMessage(requestError));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void loadReport(query, controller.signal);
    return () => controller.abort();
  }, [loadReport, query]);

  const handleApplyFilters = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const cycleFrom = parseCycle(filters.cycleFrom);
    const cycleTo = parseCycle(filters.cycleTo);
    const hasInvalidFrom = filters.cycleFrom.trim() !== '' && cycleFrom === undefined;
    const hasInvalidTo = filters.cycleTo.trim() !== '' && cycleTo === undefined;

    if (hasInvalidFrom || hasInvalidTo) {
      setFilterError('Cycle filters must be whole numbers greater than or equal to zero.');
      return;
    }
    if (cycleFrom !== undefined && cycleTo !== undefined && cycleFrom > cycleTo) {
      setFilterError('The starting cycle cannot be greater than the ending cycle.');
      return;
    }

    setFilterError(null);
    setQuery((current) => ({
      cycleFrom,
      cycleTo,
      page: 1,
      limit: current.limit ?? DEFAULT_PAGE_SIZE,
    }));
  };

  const handlePageChange = (page: number): void => {
    setQuery((current) => ({ ...current, page }));
  };

  const trendRows = useMemo<TrendRow[]>(
    () => (report?.trends ?? []).map((trend) => ({ ...trend })),
    [report?.trends],
  );
  const playerRows = useMemo<PlayerRow[]>(
    () => (report?.playerAnalysis.entries ?? []).map((entry) => ({ ...entry })),
    [report?.playerAnalysis.entries],
  );
  const playerAnalysis = report?.playerAnalysis;
  const categoryUsage = report?.categoryUsage;
  const limitations = report?.limitations ?? [];

  return (
    <div data-testid="search-analytics-page" className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <AdminPageHeader
        title="Search Analytics"
        subtitle="Active-season search usage and discovery gaps"
        actions={(
          <button
            type="button"
            onClick={() => setQuery((current) => ({ ...current }))}
            disabled={loading}
            className="min-h-11 rounded bg-surface-elevated px-3 text-sm text-secondary transition-colors hover:text-white disabled:opacity-50"
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        )}
      />

      {loading && (
        <div role="status" aria-live="polite" className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-secondary">
          Loading search analytics…
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-error sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setQuery((current) => ({ ...current }))}
            className="min-h-11 shrink-0 rounded bg-error/20 px-3 text-sm text-error transition-colors hover:bg-error/30"
          >
            Retry
          </button>
        </div>
      )}

      <section className="rounded-lg bg-surface p-4 sm:p-6" aria-labelledby="search-analytics-period-heading">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h3 id="search-analytics-period-heading" className="text-lg font-semibold text-white">Active season and cycle filters</h3>
            <p className="text-sm text-secondary">Reports are always scoped to the active season.</p>
          </div>
          <p className="text-sm text-secondary" data-testid="active-season-context">
            {report ? `Season ${report.period.seasonNumber} · Current cycle ${report.period.cycleNumber}` : 'Season and cycle unavailable'}
          </p>
        </div>
        <form data-testid="search-analytics-filters" className="mt-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end" onSubmit={handleApplyFilters}>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-secondary lg:min-w-40">
            From cycle
            <input
              type="number"
              min="0"
              value={filters.cycleFrom}
              onChange={(event) => setFilters((current) => ({ ...current, cycleFrom: event.target.value }))}
              className="min-h-11 rounded border border-white/10 bg-surface-elevated px-3 text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Filter from cycle"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-secondary lg:min-w-40">
            To cycle
            <input
              type="number"
              min="0"
              value={filters.cycleTo}
              onChange={(event) => setFilters((current) => ({ ...current, cycleTo: event.target.value }))}
              className="min-h-11 rounded border border-white/10 bg-surface-elevated px-3 text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Filter to cycle"
            />
          </label>
          <button type="submit" className="min-h-11 rounded bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-dark">
            Apply filters
          </button>
          {filterError && <p role="alert" className="basis-full text-sm text-error">{filterError}</p>}
        </form>
      </section>

      <div data-testid="search-analytics-stats" className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <AdminStatCard label="Total searches" value={formatCount(report?.overview.totalSearches ?? 0)} color="primary" icon={<span aria-hidden="true">⌕</span>} />
        <AdminStatCard label="Unique searchers" value={formatCount(report?.overview.uniqueSearchers ?? 0)} color="info" icon={<span aria-hidden="true">◎</span>} />
        <AdminStatCard label="No-result searches" value={formatCount(report?.overview.noResultSearches ?? 0)} color="warning" icon={<span aria-hidden="true">?</span>} />
        <AdminStatCard label="Current cycle" value={report?.period.cycleNumber ?? '—'} color="success" icon={<span aria-hidden="true">◷</span>} />
      </div>

      {limitations.length > 0 && (
        <section role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm" aria-labelledby="search-analytics-limitations-heading">
          <h3 id="search-analytics-limitations-heading" className="font-semibold text-warning">Reporting limitations</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
            {limitations.map((limitation) => (
              <li key={`${limitation.code}-${limitation.message}`}>
                <span className="font-medium text-warning">{limitation.code}:</span> {limitation.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SearchAnalyticsPhraseList title="Top phrases" phrases={report?.topPhrases ?? []} emptyMessage="No phrase data is available for this period." />
        <SearchAnalyticsPhraseList title="No-result phrases" phrases={report?.noResultPhrases ?? []} emptyMessage="No no-result phrases are available for this period." />
      </div>

      <section className="rounded-lg bg-surface p-4 sm:p-6" aria-labelledby="search-analytics-category-heading">
        <h3 id="search-analytics-category-heading" className="text-lg font-semibold text-white">Category usage</h3>
        <div data-testid="search-analytics-category-usage" className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded bg-surface-elevated p-4"><p className="text-sm text-secondary">Robots</p><p className="mt-1 text-2xl font-bold tabular-nums text-white">{formatCount(categoryUsage?.robots ?? 0)}</p></div>
          <div className="rounded bg-surface-elevated p-4"><p className="text-sm text-secondary">Stables</p><p className="mt-1 text-2xl font-bold tabular-nums text-white">{formatCount(categoryUsage?.stables ?? 0)}</p></div>
          <div className="rounded bg-surface-elevated p-4"><p className="text-sm text-secondary">Guide articles</p><p className="mt-1 text-2xl font-bold tabular-nums text-white">{formatCount(categoryUsage?.guide ?? 0)}</p></div>
        </div>
      </section>

      <section className="rounded-lg bg-surface p-4 sm:p-6" aria-labelledby="search-analytics-trends-heading">
        <h3 id="search-analytics-trends-heading" className="text-lg font-semibold text-white">Cycle trends</h3>
        <p className="mb-4 mt-1 text-sm text-secondary">Search volume and no-result counts within the selected active-season range.</p>
        <AdminDataTable<TrendRow>
          columns={[
            { key: 'cycleNumber', label: 'Cycle', render: (row) => `#${row.cycleNumber}` },
            { key: 'totalSearches', label: 'Searches', align: 'right', render: (row) => formatCount(row.totalSearches) },
            { key: 'uniqueSearchers', label: 'Unique searchers', align: 'right', render: (row) => formatCount(row.uniqueSearchers) },
            { key: 'noResultSearches', label: 'No results', align: 'right', render: (row) => formatCount(row.noResultSearches) },
          ]}
          data={trendRows}
          loading={loading && !report}
          emptyMessage="No cycle trend data is available for this period."
        />
      </section>

      <section className="rounded-lg bg-surface p-4 sm:p-6" aria-labelledby="search-analytics-player-heading">
        <h3 id="search-analytics-player-heading" className="text-lg font-semibold text-white">Player and stable analysis</h3>
        <p className="mb-4 mt-1 text-sm text-secondary">Bounded aggregate analysis only; raw search event rows are not exposed.</p>
        <AdminDataTable<PlayerRow>
          columns={[
            { key: 'userId', label: 'Player', render: (row) => `User #${row.userId}` },
            { key: 'stableName', label: 'Stable', render: (row) => row.stableName?.trim() || 'Unnamed stable' },
            { key: 'searchCount', label: 'Searches', align: 'right', render: (row) => formatCount(row.searchCount) },
            { key: 'noResultCount', label: 'No results', align: 'right', render: (row) => formatCount(row.noResultCount) },
          ]}
          data={playerRows}
          loading={loading && !report}
          emptyMessage="No player analysis is available for this period."
        />
        {playerAnalysis && (
          <SearchAnalyticsPagination
            page={playerAnalysis.page}
            total={playerAnalysis.total}
            limit={playerAnalysis.limit}
            loading={loading}
            onPageChange={handlePageChange}
          />
        )}
      </section>
    </div>
  );
}

export default SearchAnalyticsPage;
