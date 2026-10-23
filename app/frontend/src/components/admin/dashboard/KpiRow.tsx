/**
 * KPI cards: three login-based human-player counts (with trends vs about seven
 * days ago) and battle-ready robots for the current filter.
 */
import type { ReactNode } from 'react';
import { AdminStatCard } from '../shared';
import type { DashboardKpis } from '../../../utils/adminDashboardApi';
import { computeTrend, formatCount, formatDecimal, type TrendIntent } from '../../../utils/adminDashboardFormat';
import { PanelError } from '../shared/AdminPanel';

export interface KpiRowProps {
  kpis: DashboardKpis | null;
  loading: boolean;
  error: string | null;
}

const COMPARISON = 'vs previous 7 days';

function trendProps(current: number, previous: number | null, intent: TrendIntent) {
  const trend = computeTrend(current, previous, intent);
  if (!trend) return { caption: 'No comparison yet' };
  return {
    trend: trend.direction,
    trendValue: trend.delta > 0 ? formatCount(trend.delta) : undefined,
    trendIntent: intent,
    caption: trend.direction === 'neutral' ? `Unchanged ${COMPARISON}` : COMPARISON,
  };
}

export function KpiRow({ kpis, loading, error }: KpiRowProps): ReactNode {
  const placeholder = loading ? '…' : '—';
  const players = kpis?.humanPlayers;
  const robots = kpis?.robots;

  return (
    <section aria-label="Players and robots" aria-busy={loading || undefined}>
      {error && <PanelError message={error} />}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <AdminStatCard
          label="Active players (7 days)"
          value={players ? formatCount(players.active7d) : placeholder}
          color="primary"
          {...(players ? trendProps(players.active7d, players.previous.active7d, 'higher-is-better') : {})}
        />
        <AdminStatCard
          label="New players (7 days)"
          value={players ? formatCount(players.new7d) : placeholder}
          color="info"
          {...(players ? trendProps(players.new7d, players.previous.new7d, 'higher-is-better') : {})}
        />
        <AdminStatCard
          label="Inactive players (3+ days)"
          value={players ? formatCount(players.inactive3d) : placeholder}
          color="warning"
          {...(players ? trendProps(players.inactive3d, players.previous.inactive3d, 'lower-is-better') : {})}
        />
        <AdminStatCard
          label="Battle-ready robots"
          value={robots ? `${formatDecimal(robots.battleReadyPercentage)}%` : placeholder}
          color="success"
          caption={robots ? `${formatCount(robots.battleReady)} of ${formatCount(robots.total)} robots` : undefined}
        />
      </div>
      <p className="mt-2 text-xs text-tertiary">
        Player counts are human stables (logins). Robots follow the filter.
      </p>
    </section>
  );
}
