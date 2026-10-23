/**
 * Four cards: searches, unique searchers, no-result rate and "led to a result".
 */
import type { ReactNode } from 'react';
import { AdminStatCard, PanelError } from '../shared';
import type { AdminSearchAnalyticsReport } from '../../../utils/adminSearchAnalyticsApi';
import { formatCount } from '../../../utils/adminDashboardFormat';
import {
  describeComparison,
  formatShare,
  noResultTrend,
  searchVolumeTrend,
} from '../../../utils/adminSearchAnalyticsFormat';

export interface SearchKpiRowProps {
  report: AdminSearchAnalyticsReport | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export function SearchKpiRow({ report, loading, error, onRetry }: SearchKpiRowProps): ReactNode {
  const placeholder = loading ? '…' : '—';
  const comparison = report ? describeComparison(report) : null;
  const volume = report ? searchVolumeTrend(report) : null;
  const noResults = report ? noResultTrend(report) : null;
  const selection = report?.overview.selection;
  const admins = report?.overview.adminSearchers ?? 0;

  return (
    <section aria-label="Search totals" aria-busy={loading || undefined}>
      {error && <PanelError message={error} onRetry={onRetry} />}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <AdminStatCard
          label={report?.period.mode === 'all' ? 'Search requests' : 'Settled searches'}
          value={report ? formatCount(report.overview.totalSearches) : placeholder}
          color="primary"
          trend={volume?.direction}
          trendValue={volume && volume.delta > 0 ? formatCount(volume.delta) : undefined}
          caption={report ? comparison ?? 'No earlier period to compare' : undefined}
        />
        <AdminStatCard
          label="Unique searchers"
          value={report ? formatCount(report.overview.uniqueSearchers) : placeholder}
          color="info"
          caption={report ? (admins > 0 ? `Includes ${admins} admin account${admins === 1 ? '' : 's'}` : 'No admin accounts') : undefined}
        />
        <AdminStatCard
          label="No-result rate"
          value={report ? formatShare(report.overview.noResultRate) : placeholder}
          color="warning"
          trend={noResults?.direction}
          trendValue={noResults && noResults.delta > 0 ? `${noResults.delta.toFixed(1)} pts` : undefined}
          trendIntent="lower-is-better"
          caption={report ? comparison ?? 'No earlier period to compare' : undefined}
        />
        <AdminStatCard
          label="Led to a result"
          value={report ? (selection?.rate === null || selection === undefined ? 'Not tracked yet' : formatShare(selection.rate)) : placeholder}
          color="success"
          caption={report
            ? selection?.trackedSinceCycle !== null && selection?.trackedSinceCycle !== undefined
              ? `Tracked since cycle ${selection.trackedSinceCycle}`
              : 'Starts counting with new searches'
            : undefined}
        />
      </div>
    </section>
  );
}
