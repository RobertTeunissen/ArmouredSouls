/**
 * EconomyOverviewPage — where credits come from, where they go, and where
 * they pile up (`/admin/economy`).
 *
 * A toolbar picks the stable type (Players by default, Automatons, Generated,
 * All) and the window (7 / 14 / 30 closed cycles, or the season); both live in
 * the URL (`stables`, `window`). Blocks: KPIs, sources and sinks from the
 * financial ledger, earned vs spent per cycle, balance bands and the
 * per-stable-type table. Facility adoption is on Meta, bankruptcy risk on
 * Players (Low balance).
 * Data: `GET /api/admin/economy`.
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Economy.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ADMIN_FOCUS_RING, AdminPageHeader, PanelError, PanelSkeleton } from '../../components/admin/shared';
import { ToggleChip } from '../../components/admin/automatons/ui';
import { EconomyBalances, EconomyByStableType, EconomyFlows, EconomyKpis, EconomyPerCycle } from '../../components/admin/economy/EconomyBlocks';
import { SCOPE_LABELS, scopeNoun } from '../../utils/adminEconomyFormat';
import { ApiError } from '../../utils/ApiError';
import { isAbortError } from '../../utils/abort';
import { getEconomyOverview, type EconomyOverview, type EconomyStableScope, type EconomyWindow } from '../../utils/adminEconomyApi';
import { formatUtcTime } from '../../utils/adminDashboardFormat';

const SCOPES: readonly EconomyStableScope[] = ['players', 'automatons', 'generated', 'all'];
const WINDOWS: readonly { key: EconomyWindow; label: string }[] = [
  { key: '7', label: '7 cycles' },
  { key: '14', label: '14 cycles' },
  { key: '30', label: '30 cycles' },
  { key: 'season', label: 'Season' },
];

function readScope(value: string | null): EconomyStableScope {
  return SCOPES.find((s) => s === value) ?? 'players';
}

function readWindow(value: string | null): EconomyWindow {
  return WINDOWS.find((w) => w.key === value)?.key ?? '7';
}

function ChipGroup<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { key: T; label: string }[]; value: T; onChange: (value: T) => void }): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <span className="text-xs text-secondary" aria-hidden="true">{label}</span>
      {options.map((option) => (
        <ToggleChip key={option.key} pressed={value === option.key} onClick={() => onChange(option.key)} className="px-3">
          {option.label}
        </ToggleChip>
      ))}
    </div>
  );
}

function EconomyOverviewPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const stables = readScope(params.get('stables'));
  const cycleWindow = readWindow(params.get('window'));
  const [data, setData] = useState<EconomyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getEconomyOverview(stables, cycleWindow, { fresh: refresh > 0, signal: controller.signal })
      .then((overview) => {
        if (controller.signal.aborted) return;
        setData(overview);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.message) || 'Could not load the economy.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [stables, cycleWindow, refresh]);

  const set = (name: 'stables' | 'window', value: string, fallback: string): void => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === fallback) next.delete(name);
      else next.set(name, value);
      return next;
    }, { replace: true });
  };

  const shown = data && data.scope.stables === stables && data.scope.window === cycleWindow ? data : null;

  return (
    <div data-testid="economy-overview-page" className="space-y-6">
      <AdminPageHeader
        title="Economy"
        subtitle="Where credits come from, where they go, and where they pile up"
        actions={(
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-xs text-secondary" aria-live="polite">
              {loading && data ? 'Refreshing…' : data ? `Last updated ${formatUtcTime(data.timestamp, true)}` : ''}
            </span>
            <button
              type="button"
              onClick={() => setRefresh((r) => r + 1)}
              disabled={loading}
              className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
            >
              <span aria-hidden="true">↻ </span>Refresh
            </button>
          </div>
        )}
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ChipGroup label="Stables" options={SCOPES.map((key) => ({ key, label: SCOPE_LABELS[key] }))} value={stables} onChange={(v) => set('stables', v, 'players')} />
        <ChipGroup label="Window" options={WINDOWS} value={cycleWindow} onChange={(v) => set('window', v, '7')} />
      </div>

      {error && <div className="rounded-lg border border-white/10 bg-surface"><PanelError message={error} onRetry={() => setRefresh((r) => r + 1)} /></div>}
      {!shown && loading && <div className="rounded-lg border border-white/10 bg-surface"><PanelSkeleton rows={8} /></div>}

      {shown && (
        <>
          <p className="text-xs text-secondary" role="status">
            {shown.scope.cycles === 0
              ? `Scope: ${scopeNoun(shown.scope.stables)}. No closed cycle yet this season, so there are no flows; balances are as of now.`
              : `Scope: ${scopeNoun(shown.scope.stables)}, ledger cycles ${shown.scope.fromCycle}–${shown.scope.toCycle} (${shown.scope.cycles} closed cycles; the cycle in progress is left out). Per cycle = window total ÷ ${shown.scope.cycles}.`}
          </p>
          <EconomyKpis data={shown} />
          <EconomyFlows data={shown} />
          <EconomyPerCycle data={shown} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <EconomyBalances data={shown} />
            <EconomyByStableType data={shown} />
          </div>
          <p className="text-xs text-secondary">
            Flows come from the financial ledger, which holds the current season only. Facility adoption is on Meta; stables below the low-balance threshold are on Players.
          </p>
        </>
      )}
    </div>
  );
}

export default EconomyOverviewPage;
