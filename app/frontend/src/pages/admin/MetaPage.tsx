/**
 * MetaPage — what stables choose, for the selected stable type, in three
 * groups: combat settings (stances, loadouts, yield thresholds), robot builds
 * (tuning, weapons and refinements) and stable investments (event entry,
 * facilities).
 *
 * Moved off the Dashboard so the landing page stays short; the old Tuning,
 * Refinement and Subscriptions pages were merged in and redirect here. The
 * filter (`?stables=`, default Players) is shared with the Dashboard.
 * Tier distributions are on League Health; what wins is on Attributes and
 * Weapons.
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Meta.
 */
import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PanelError } from '../../components/admin/shared';
import { DashboardToolbar } from '../../components/admin/dashboard';
import { EventEntryCard, FacilitiesCard, ShareCard, TuningCard, WeaponsCard, YieldHistogram } from '../../components/admin/meta';
import { useMetaBuilds, useMetaOverview } from '../../hooks/useMetaOverview';
import { readStableScope, STABLE_SCOPES, writeStableScope, type StableScope } from '../../utils/adminStableScope';
import { humanizeKey } from '../../utils/adminMetaFormat';

function MetaGroup({ id, title, note, children }: { id: string; title: string; note: string; children: ReactNode }): ReactNode {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-xs text-secondary">{note}</p>
      </div>
      {children}
    </section>
  );
}

function MetaPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = readStableScope(searchParams, STABLE_SCOPES, 'players');
  const overview = useMetaOverview(filter);
  const builds = useMetaBuilds(filter);
  const { data } = overview;

  const changeFilter = useCallback((next: StableScope): void => {
    setSearchParams((params) => writeStableScope(params, next, 'players'), { replace: true });
  }, [setSearchParams]);

  const { reload: reloadOverview } = overview;
  const { reload: reloadBuilds } = builds;
  const reloadAll = useCallback((): void => {
    reloadOverview();
    reloadBuilds();
  }, [reloadOverview, reloadBuilds]);

  const stances = data ? data.stances.map((s) => ({ label: humanizeKey(s.stance), value: s.count })) : null;
  const loadouts = data ? data.loadouts.map((l) => ({ label: humanizeKey(l.type), value: l.count })) : null;
  const buildsLoading = builds.loading && !builds.data;

  return (
    <div data-testid="meta-page" className="space-y-8">
      <DashboardToolbar
        filter={filter}
        onFilterChange={changeFilter}
        scopeNote="Robots and stables of the selected type"
        lastUpdated={overview.fetchedAt}
        refreshing={(overview.loading && overview.data !== null) || (builds.loading && builds.data !== null)}
        onRefresh={reloadAll}
      />

      {overview.error && (
        <div className="rounded-lg border border-white/10 bg-surface">
          <PanelError message={overview.error} onRetry={overview.reload} />
        </div>
      )}

      <MetaGroup id="meta-combat-settings" title="Combat settings" note="Set per robot and changed any time">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ShareCard title="Stances" items={stances} loading={overview.loading} />
          <ShareCard title="Loadouts" items={loadouts} loading={overview.loading} />
          <YieldHistogram
            distribution={data?.yieldThresholds.distribution ?? null}
            loading={overview.loading}
            className="md:col-span-2 xl:col-span-1"
          />
        </div>
      </MetaGroup>

      <MetaGroup id="meta-robot-builds" title="Robot builds" note="Upgrades put into each robot">
        <div className="grid gap-5 xl:grid-cols-2">
          <TuningCard tuning={builds.data?.tuning ?? null} loading={buildsLoading} error={builds.error} onRetry={builds.reload} />
          <WeaponsCard
            weapons={data?.weapons ?? null}
            refinements={builds.data?.refinements ?? null}
            loading={overview.loading}
            refinementsLoading={buildsLoading}
            refinementsError={builds.error}
            onRetryRefinements={builds.reload}
          />
        </div>
      </MetaGroup>

      <MetaGroup id="meta-stable-investments" title="Stable investments" note="What each stable has built and entered">
        <div className="grid gap-5 xl:grid-cols-2">
          <EventEntryCard eventEntry={builds.data?.eventEntry ?? null} loading={buildsLoading} error={builds.error} onRetry={builds.reload} />
          <FacilitiesCard facilities={data?.facilities ?? null} loading={overview.loading} />
        </div>
      </MetaGroup>
    </div>
  );
}

export default MetaPage;
