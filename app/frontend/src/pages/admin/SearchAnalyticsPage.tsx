/**
 * SearchAnalyticsPage — what players search for, what they don't find, and
 * whether a search led anywhere.
 *
 * Counts settled searches by default: the palette sends a request after every
 * typing pause, so a phrase followed within 5 s by a longer phrase starting
 * with it is "typing in progress" and not counted. Selection tracking records
 * only the category of an opened result. All filters live in the URL.
 *
 * Definitions of every number: docs/guides/ADMIN_PANEL_GUIDE.md §Search Analytics.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CategoryResults,
  CountingBanner,
  PhraseTable,
  SearchAnalyticsToolbar,
  SearchersPanel,
  SearchKpiRow,
  SearchTrendChart,
} from '../../components/admin/search-analytics';
import { useSearchAnalytics } from '../../hooks/useSearchAnalytics';
import { downloadAdminSearchAnalyticsPhrasesCsv } from '../../utils/adminSearchAnalyticsApi';
import {
  describePeriod,
  periodToQuery,
  readSearchAnalyticsState,
  saveBlob,
  writeSearchAnalyticsState,
  type SearchAnalyticsUrlState,
} from '../../utils/adminSearchAnalyticsFormat';

const FILTER_DEBOUNCE_MS = 300;

function SearchAnalyticsPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = readSearchAnalyticsState(searchParams);
  const { report, phrases, setSearchersPage, lastUpdated, refresh } = useSearchAnalytics(state);
  const [filterText, setFilterText] = useState(state.q);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const update = useCallback((patch: Partial<SearchAnalyticsUrlState>): void => {
    setSearchParams((params) => writeSearchAnalyticsState({ ...readSearchAnalyticsState(params), ...patch }), { replace: true });
  }, [setSearchParams]);

  // Push the phrase filter to the URL once typing pauses.
  useEffect(() => {
    if (filterText.trim() === state.q) return undefined;
    const timer = setTimeout(() => update({ q: filterText.trim(), page: 1 }), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filterText, state.q, update]);

  const exportCsv = async (): Promise<void> => {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await downloadAdminSearchAnalyticsPhrasesCsv({ ...periodToQuery(state), mode: state.mode, tab: state.tab, q: state.q });
      saveBlob(blob, 'search-phrases.csv');
    } catch {
      setExportError('The CSV export failed. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const data = report.data;
  const limitations = data?.limitations ?? [];
  const volumeLabel = state.mode === 'all' ? 'Search requests' : 'Settled searches';
  const refreshing = (report.loading && data !== null) || (phrases.loading && phrases.data !== null);

  return (
    <div data-testid="search-analytics-page" className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <SearchAnalyticsToolbar
        period={state.period}
        from={state.from}
        to={state.to}
        periodCaption={data ? describePeriod(data) : null}
        currentCycle={data?.period.cycleNumber ?? null}
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        onPresetChange={(period) => update({ period, from: null, to: null, page: 1 })}
        onCustomRange={(from, to) => update({ period: 'custom', from, to, page: 1 })}
        onRefresh={refresh}
      />

      <CountingBanner report={data} mode={state.mode} onModeChange={(mode) => update({ mode, page: 1 })} />

      {limitations.length > 0 && (
        <section role="status" aria-label="Reporting limitations" className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-semibold text-warning">Reporting limitations</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-secondary">
            {limitations.map((limitation) => (
              <li key={`${limitation.code}-${limitation.message}`}>{limitation.message}</li>
            ))}
          </ul>
        </section>
      )}

      <SearchKpiRow report={data} loading={report.loading} error={report.error} onRetry={report.reload} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,5fr)]">
        <SearchTrendChart trends={data?.trends ?? null} volumeLabel={volumeLabel} loading={report.loading} error={null} />
        <CategoryResults
          results={data?.categoryResults ?? null}
          tracked={(data?.overview.selection.trackedSearches ?? 0) > 0}
          loading={report.loading}
          error={null}
        />
      </div>

      <PhraseTable
        page={phrases.data}
        loading={phrases.loading}
        error={phrases.error}
        tab={state.tab}
        filter={filterText}
        exporting={exporting}
        exportError={exportError}
        onTabChange={(tab) => update({ tab, page: 1 })}
        onFilterChange={setFilterText}
        onPageChange={(page) => update({ page })}
        onExport={() => { void exportCsv(); }}
        onRetry={phrases.reload}
      />

      <SearchersPanel analysis={data?.playerAnalysis ?? null} loading={report.loading} onPageChange={setSearchersPage} />
    </div>
  );
}

export default SearchAnalyticsPage;
