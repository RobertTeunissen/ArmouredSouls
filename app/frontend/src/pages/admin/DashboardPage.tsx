/**
 * DashboardPage — admin landing page: is the game healthy, and does anything
 * need me?
 *
 * Sections: status strip (cycle, settlement, scheduler, queue), KPI cards,
 * "Needs attention" and battle activity per mode. The status strip and
 * "Needs attention" are system-wide; the filter (kept in the URL as
 * `?stables=`) applies to robots and battles. What stables choose (stances,
 * loadouts, yield thresholds, facilities, weapons) is on the Meta page.
 * The page title comes from AdminLayout's header.
 *
 * Definitions of every number: docs/guides/ADMIN_PANEL_GUIDE.md §Dashboard.
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readStableScope, STABLE_SCOPES, writeStableScope, type StableScope } from '../../utils/adminStableScope';
import {
  BattleActivityTable,
  DashboardToolbar,
  KpiRow,
  NeedsAttentionPanel,
  StatusStrip,
} from '../../components/admin/dashboard';
import { useAdminDashboard } from '../../hooks/useAdminDashboard';

function AdminDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = readStableScope(searchParams, STABLE_SCOPES, 'players');
  const { status, kpis, activity, lastUpdated, refresh } = useAdminDashboard(filter);

  const changeFilter = useCallback((next: StableScope): void => {
    setSearchParams((params) => writeStableScope(params, next, 'players'), { replace: true });
  }, [setSearchParams]);

  const refreshing = (status.loading && status.data !== null)
    || (kpis.loading && kpis.data !== null)
    || (activity.loading && activity.data !== null);
  const now = new Date();

  return (
    <div data-testid="dashboard-page" className="space-y-5">
      <DashboardToolbar
        filter={filter}
        onFilterChange={changeFilter}
        scopeNote="Filter applies to robots and battles"
        lastUpdated={lastUpdated}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      <StatusStrip status={status.data} loading={status.loading} error={status.error} now={now} />

      <KpiRow kpis={kpis.data} loading={kpis.loading} error={kpis.error} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
        <NeedsAttentionPanel
          status={status.data}
          loading={status.loading}
          error={status.error && !status.data ? 'The attention checks could not be loaded.' : null}
        />
        <BattleActivityTable activity={activity.data} loading={activity.loading} error={activity.error} />
      </div>
    </div>
  );
}

export default AdminDashboardPage;
