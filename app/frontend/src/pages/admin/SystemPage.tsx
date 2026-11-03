/**
 * SystemPage — is the server healthy, and is anything failing (`/admin/system`)?
 *
 * Sections: toolbar (times in UTC, last updated, Refresh), six status cards
 * (disk, database, memory, last backup, backend uptime, failing requests),
 * failing and slow requests (`request_metrics`), backend starts (deploys and
 * restarts), scheduler job durations with the lock time per day, and the
 * largest tables. Status only: alerts stay with their single emitters in
 * Discord. Refreshes every 60 s.
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §System.
 */
import {
  BackendStarts,
  FailingRequests,
  LargestTables,
  SchedulerJobs,
  SlowRequests,
  SystemStatusCards,
} from '../../components/admin/system';
import { ADMIN_FOCUS_RING } from '../../components/admin/shared';
import { useSystemOverview } from '../../hooks/useSystemOverview';
import { formatUtcTime } from '../../utils/adminDashboardFormat';

function AdminSystemPage(): React.ReactElement {
  const { overview, refresh } = useSystemOverview();
  const data = overview.data;
  const refreshing = overview.loading && data !== null;
  const now = data ? new Date(data.generatedAt) : new Date();

  return (
    <div data-testid="system-page" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/10 bg-surface-elevated px-3 py-1 text-xs text-secondary">All times UTC</span>
          <span className="text-xs text-secondary">Status only: alerts stay in Discord</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs text-secondary" aria-live="polite">
            {refreshing ? 'Refreshing…' : data ? `Last updated ${formatUtcTime(data.generatedAt, true)}` : 'Not loaded yet'}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
          >
            Refresh
          </button>
        </div>
      </div>

      <SystemStatusCards overview={data} now={now} loading={overview.loading} error={overview.error} />

      <FailingRequests requests={data?.requests ?? null} now={now} loading={overview.loading} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SlowRequests requests={data?.requests ?? null} now={now} loading={overview.loading} />
        <BackendStarts starts={data?.starts ?? null} now={now} loading={overview.loading} />
      </div>

      <SchedulerJobs jobs={data?.jobs ?? null} loading={overview.loading} />

      <LargestTables database={data ? data.database : undefined} loading={overview.loading} />
    </div>
  );
}

export default AdminSystemPage;
