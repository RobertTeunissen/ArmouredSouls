/**
 * Meta snapshot: what players (or Automatons) choose — stances, loadouts,
 * yield thresholds, facilities and weapons. Tier distributions are results,
 * not choices, and live on League Health. Collapsed by default;
 * `/api/admin/stats` is only fetched once it is opened, by a loader scoped to
 * the current filter rather than the shared admin store slot.
 */
import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../../utils/ApiError';
import { isAbortError } from '../../../utils/abort';
import { getMetaStats } from '../../../utils/adminDashboardApi';
import { ADMIN_FOCUS_RING, type UserFilterType } from '../shared';
import type { SystemStats } from '../types';
import { formatCount, formatDecimal } from '../../../utils/adminDashboardFormat';
import { PanelError, PanelSkeleton } from '../shared/AdminPanel';

export interface MetaSnapshotProps {
  filter: UserFilterType;
  /** Changes when the page's Refresh is pressed; refetches while open. */
  refreshToken: number;
}

interface DistributionItem {
  label: string;
  value: number;
}

function label(raw: string): string {
  const spaced = raw.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function Distribution({ title, items, unit = '' }: { title: string; items: DistributionItem[]; unit?: string }): ReactNode {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-secondary">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-tertiary">No data</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const share = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <li key={item.label} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-white">{item.label}{unit}</span>
                  <span className="tabular-nums text-secondary">
                    {formatCount(item.value)} <span className="text-tertiary">({formatDecimal(share)}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-1 rounded bg-white/5" aria-hidden="true">
                  <div className="h-1 rounded bg-primary/60" style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MetaContent({ stats }: { stats: SystemStats }): ReactNode {
  const equipped = stats.weapons.equippedInventoryItems ?? stats.weapons.equipped;
  const equipRate = stats.weapons.totalBought > 0 ? (equipped / stats.weapons.totalBought) * 100 : 0;

  return (
    <div className="grid gap-6 p-5 sm:grid-cols-2 xl:grid-cols-3">
      <Distribution title="Stances" items={stats.stances.map((s) => ({ label: label(s.stance), value: s.count }))} />
      <Distribution title="Loadouts" items={stats.loadouts.map((l) => ({ label: label(l.type), value: l.count }))} />
      <Distribution
        title="Yield thresholds"
        unit="%"
        items={stats.yieldThresholds.distribution.map((y) => ({ label: String(y.threshold), value: y.count }))}
      />
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-secondary">Facilities (stables owning)</h3>
        {stats.facilities.summary.length === 0 ? (
          <p className="text-sm text-tertiary">No facilities owned yet</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Facilities by number of stables owning them</caption>
            <thead>
              <tr className="text-xs text-secondary">
                <th scope="col" className="pb-1 text-left font-medium">Facility</th>
                <th scope="col" className="pb-1 text-right font-medium">Stables</th>
                <th scope="col" className="pb-1 text-right font-medium">Avg level</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {stats.facilities.summary.map((facility) => (
                <tr key={facility.type}>
                  <th scope="row" className="py-0.5 text-left font-normal text-white">{label(facility.type)}</th>
                  <td className="py-0.5 text-right text-white">{formatCount(facility.purchaseCount)}</td>
                  <td className="py-0.5 text-right text-secondary">{formatDecimal(facility.avgLevel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-secondary">Weapons</h3>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div><dt className="text-xs text-secondary">Owned</dt><dd className="tabular-nums text-white">{formatCount(stats.weapons.totalBought)}</dd></div>
          <div><dt className="text-xs text-secondary">Equipped</dt><dd className="tabular-nums text-white">{formatCount(equipped)}</dd></div>
          <div><dt className="text-xs text-secondary">Equip rate</dt><dd className="tabular-nums text-white">{formatDecimal(equipRate)}%</dd></div>
        </dl>
        <p className="mt-1 text-xs text-tertiary">Equipped counts main and offhand slots.</p>
      </div>
    </div>
  );
}

export function MetaSnapshot({ filter, refreshToken }: MetaSnapshotProps): ReactNode {
  const [open, setOpen] = useState(false);
  // Stats are kept with the filter they were loaded for, so data for another
  // filter is never shown, even for a moment.
  const [loaded, setLoaded] = useState<{ filter: UserFilterType; stats: SystemStats } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentId = useId();

  // One request per (open, filter, refresh). A filter change or close aborts
  // the previous request and its late response is ignored, so a slow response
  // for an old filter can never replace the current one.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getMetaStats(filter, controller.signal)
      .then((stats) => {
        if (controller.signal.aborted) return;
        setLoaded({ filter, stats });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.message) || 'Could not load the meta snapshot.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [open, filter, refreshToken]);

  const current = loaded && loaded.filter === filter ? loaded.stats : null;

  return (
    <section className="rounded-lg border border-white/10 bg-surface">
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
          className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-5 py-4 text-left hover:bg-white/5 ${ADMIN_FOCUS_RING}`}
        >
          <span aria-hidden="true" className="text-secondary">{open ? '▾' : '▸'}</span>
          <span className="text-base font-semibold text-white">Meta snapshot</span>
          <span className="text-sm font-normal text-secondary">Stances, loadouts, yield thresholds, facilities, weapons</span>
        </button>
      </h2>
      <div id={contentId} hidden={!open} className="border-t border-white/10">
        {error && <PanelError message={error} />}
        {!current && loading && <PanelSkeleton rows={6} />}
        {current && <MetaContent stats={current} />}
        <p className="px-5 pb-4 text-xs text-tertiary">
          Full detail:{' '}
          <Link to="/admin/league-health" className={`text-primary hover:underline ${ADMIN_FOCUS_RING}`}>League Health</Link>
          {' · '}
          <Link to="/admin/robot-stats" className={`text-primary hover:underline ${ADMIN_FOCUS_RING}`}>Robot Stats</Link>
          {' · '}
          <Link to="/admin/economy" className={`text-primary hover:underline ${ADMIN_FOCUS_RING}`}>Economy</Link>
          {' · '}
          <Link to="/admin/weapons" className={`text-primary hover:underline ${ADMIN_FOCUS_RING}`}>Weapons</Link>
        </p>
      </div>
    </section>
  );
}
