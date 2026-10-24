/**
 * MetaPage — an overview of what stables choose: stances, loadouts, yield
 * thresholds, facilities and weapons, for the selected stable type.
 *
 * Moved off the Dashboard so the landing page stays short. Each section is a
 * compact summary; the filter (`?filter=`, default Real players) is shared
 * with the Dashboard. Tier distributions are on League Health.
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Meta.
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { UserFilterType } from '../../components/admin/shared';
import { PanelError } from '../../components/admin/shared';
import { DashboardToolbar } from '../../components/admin/dashboard';
import { FacilitiesCard, ShareCard, WeaponsCard, YieldHistogram } from '../../components/admin/meta';
import { useMetaOverview } from '../../hooks/useMetaOverview';
import { DEFAULT_DASHBOARD_FILTER, readDashboardFilter } from '../../utils/adminDashboardFormat';
import { humanizeKey } from '../../utils/adminMetaFormat';

function MetaPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = readDashboardFilter(searchParams.get('filter'));
  const { data, loading, error, fetchedAt, reload } = useMetaOverview(filter);

  const changeFilter = useCallback((next: UserFilterType): void => {
    setSearchParams((params) => {
      const updated = new URLSearchParams(params);
      if (next === DEFAULT_DASHBOARD_FILTER) updated.delete('filter');
      else updated.set('filter', next);
      return updated;
    }, { replace: true });
  }, [setSearchParams]);

  const stances = data ? data.stances.map((s) => ({ label: humanizeKey(s.stance), value: s.count })) : null;
  const loadouts = data ? data.loadouts.map((l) => ({ label: humanizeKey(l.type), value: l.count })) : null;

  return (
    <div data-testid="meta-page" className="space-y-5">
      <DashboardToolbar
        filter={filter}
        onFilterChange={changeFilter}
        scopeNote="Robots and stables of the selected type"
        lastUpdated={fetchedAt}
        refreshing={loading && data !== null}
        onRefresh={reload}
      />

      {error && (
        <div className="rounded-lg border border-white/10 bg-surface">
          <PanelError message={error} onRetry={reload} />
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ShareCard title="Stances" items={stances} loading={loading} />
        <ShareCard title="Loadouts" items={loadouts} loading={loading} />
        <WeaponsCard weapons={data?.weapons ?? null} loading={loading} className="md:col-span-2 xl:col-span-1" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <YieldHistogram distribution={data?.yieldThresholds.distribution ?? null} loading={loading} />
        <FacilitiesCard facilities={data?.facilities ?? null} loading={loading} />
      </div>
    </div>
  );
}

export default MetaPage;
