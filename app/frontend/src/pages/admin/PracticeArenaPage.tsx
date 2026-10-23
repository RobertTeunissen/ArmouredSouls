/**
 * PracticeArenaPage — who practises, how much, how it is used, and how often
 * the arena turned players away (`/admin/practice-arena`).
 *
 * Sections: toolbar (times in UTC, recording note, last updated, Refresh),
 * status strip, the last 30 UTC days (chart and table), top practitioners this
 * season and how the arena is used. Data is persisted per request
 * (`practice_arena_events`), so it survives restarts and deploys; it is emptied
 * at season rollover. Refreshes every 60 s.
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Practice Arena.
 */
import {
  PracticeDailyTrend,
  PracticeStatusStrip,
  PracticeUsage,
  TopPractitioners,
} from '../../components/admin/practice-arena';
import { ADMIN_FOCUS_RING } from '../../components/admin/shared';
import { usePracticeArenaOverview } from '../../hooks/usePracticeArenaOverview';
import { formatUtcTime } from '../../utils/adminDashboardFormat';
import { shortDate } from '../../utils/adminPracticeArenaFormat';

function AdminPracticeArenaPage(): React.ReactElement {
  const { overview, refresh } = usePracticeArenaOverview();
  const data = overview.data;
  const refreshing = overview.loading && data !== null;
  const now = data ? new Date(data.timestamp) : new Date();

  return (
    <div data-testid="practice-arena-page" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/10 bg-surface-elevated px-3 py-1 text-xs text-secondary">All times UTC</span>
          <span className="text-xs text-tertiary">
            {data?.recordingSince
              ? `Recording since ${shortDate(data.recordingSince.slice(0, 10))} · emptied at season rollover`
              : 'Recorded per request · emptied at season rollover'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs text-secondary" aria-live="polite">
            {refreshing ? 'Refreshing…' : data ? `Last updated ${formatUtcTime(data.timestamp, true)}` : 'Not loaded yet'}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
          >
            <span aria-hidden="true">↻ </span>Refresh
          </button>
        </div>
      </div>

      <PracticeStatusStrip overview={data} loading={overview.loading} error={overview.error} />

      <PracticeDailyTrend days={data?.days ?? null} windowDays={data?.windowDays ?? 30} now={now} loading={overview.loading} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TopPractitioners overview={data} now={now} loading={overview.loading} />
        <PracticeUsage usage={data?.usage ?? null} windowDays={data?.windowDays ?? 30} loading={overview.loading} />
      </div>
    </div>
  );
}

export default AdminPracticeArenaPage;
