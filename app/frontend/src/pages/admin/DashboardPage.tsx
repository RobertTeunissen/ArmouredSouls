/**
 * DashboardPage — Admin operational overview with drill-down analytics.
 *
 * Displays KPI cards, battle statistics by type, facility investment breakdown,
 * weapon economy metrics, roster strategy breakdown, and collapsible distribution
 * sections (stances, loadouts, yield thresholds).
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 25.1, 25.2, 25.3, 25.4
 */
import { useState, useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AdminPageHeader, AdminStatCard, AdminFilterBar } from '../../components/admin/shared';
import { useAdminStore } from '../../stores/adminStore';
import apiClient from '../../utils/apiClient';
import type { SystemStats } from '../../components/admin/types';
import type { TrendDirection } from '../../utils/trendIndicator';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type UserFilterType = 'all' | 'real' | 'auto';

interface KpiData {
  inactivePlayers: number;
  battlesToday: number;
  scheduledMatches: number;
  currentCycle: number;
  trends: {
    inactivePlayers: TrendDirection;
    battlesToday: TrendDirection;
  };
}

/* ------------------------------------------------------------------ */
/*  Collapsible section helper                                         */
/* ------------------------------------------------------------------ */

function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-2 font-semibold text-lg hover:bg-surface-elevated transition-colors text-left"
      >
        <span className="text-sm">{open ? '▼' : '▶'}</span>
        <span>{icon}</span>
        <span>{title}</span>
      </button>
      {open && (
        <div className="p-6 border-t border-white/10">{children}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function AdminDashboardPage() {
  const { systemStats, statsLoading, fetchStats } = useAdminStore(useShallow((s) => ({
    systemStats: s.systemStats,
    statsLoading: s.statsLoading,
    fetchStats: s.fetchStats,
  })));

  const [filter, setFilter] = useState<UserFilterType>('real');
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);

  // Collapsible section state
  const [stancesOpen, setStancesOpen] = useState(false);
  const [loadoutsOpen, setLoadoutsOpen] = useState(false);
  const [yieldOpen, setYieldOpen] = useState(false);

  // Fetch KPI data
  const fetchKpis = useCallback(async (f: UserFilterType) => {
    try {
      setKpiLoading(true);
      setKpiError(null);
      const response = await apiClient.get<KpiData>(`/api/admin/dashboard/kpis?filter=${f}`);
      setKpis(response.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load KPI data';
      setKpiError(msg);
    } finally {
      setKpiLoading(false);
    }
  }, []);

  // Fetch stats from admin store (TTL-cached) and KPIs on mount
  useEffect(() => {
    fetchStats(filter);
    fetchKpis(filter);
  }, [fetchStats, fetchKpis, filter]);

  const handleRefresh = useCallback(() => {
    fetchStats(filter, true);
    fetchKpis(filter);
  }, [fetchStats, fetchKpis, filter]);

  // Filter toggle handler
  const handleFilterToggle = useCallback(
    (key: string) => {
      const newFilter = key as UserFilterType;
      if (newFilter !== filter) {
        setFilter(newFilter);
      }
    },
    [filter],
  );

  const stats: SystemStats | null = systemStats;
  const loading = statsLoading && !stats;

  if (loading && !kpis) {
    return (
      <div data-testid="dashboard-page" className="space-y-6">
        <AdminPageHeader title="Dashboard" subtitle="Operational overview" />
        <div className="text-center py-8 text-secondary">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page" className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        subtitle="Operational overview"
        actions={
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded transition-colors"
          >
            ↻ Refresh
          </button>
        }
      />

      {/* Global filter toggle: Real / Auto / All */}
      <AdminFilterBar
        filters={[
          { key: 'real', label: 'Real Players', active: filter === 'real' },
          { key: 'auto', label: 'Auto-Generated', active: filter === 'auto' },
          { key: 'all', label: 'All', active: filter === 'all' },
        ]}
        onFilterToggle={handleFilterToggle}
      />

      {/* KPI Error */}
      {kpiError && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
          {kpiError}
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <AdminStatCard
          label="Inactive Real Players (3+ days)"
          value={kpiLoading ? '...' : (kpis?.inactivePlayers ?? '—')}
          trend={kpis?.trends?.inactivePlayers}
          color="warning"
          icon={<span>👤</span>}
        />
        <AdminStatCard
          label="Battles Today"
          value={kpiLoading ? '...' : (kpis?.battlesToday ?? '—')}
          trend={kpis?.trends?.battlesToday}
          color="success"
          icon={<span>⚔️</span>}
        />
        <AdminStatCard
          label="Scheduled Matches"
          value={kpiLoading ? '...' : (kpis?.scheduledMatches ?? '—')}
          color="info"
          icon={<span>📅</span>}
        />
        <AdminStatCard
          label="Current Cycle"
          value={kpiLoading ? '...' : (kpis?.currentCycle ?? '—')}
          color="primary"
          icon={<span>🔄</span>}
        />
      </div>

      {/* Battle Statistics by Type */}
      {stats && <BattleStatsByType stats={stats} />}

      {/* Facility Investment Breakdown */}
      {stats && <FacilityBreakdown stats={stats} />}

      {/* Weapon Economy Metrics */}
      {stats && <WeaponEconomy stats={stats} />}

      {/* Roster Strategy Breakdown */}
      {stats && <RosterStrategy stats={stats} />}

      {/* Collapsible Distribution Sections */}
      <CollapsibleSection
        title="Stance Distribution"
        icon="🥊"
        open={stancesOpen}
        onToggle={() => setStancesOpen((o) => !o)}
      >
        {stats && stats.stances.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.stances.map((s) => (
              <div key={s.stance} className="bg-surface-elevated rounded-lg p-4">
                <div className="text-lg font-bold text-pink-400">{s.count}</div>
                <div className="text-sm text-secondary capitalize">{s.stance}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary">No stance data available</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Loadout Distribution"
        icon="🎒"
        open={loadoutsOpen}
        onToggle={() => setLoadoutsOpen((o) => !o)}
      >
        {stats && stats.loadouts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.loadouts.map((l) => (
              <div key={l.type} className="bg-surface-elevated rounded-lg p-4">
                <div className="text-lg font-bold text-teal-400">{l.count}</div>
                <div className="text-sm text-secondary">{l.type.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary">No loadout data available</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Yield Threshold Distribution"
        icon="🏳️"
        open={yieldOpen}
        onToggle={() => setYieldOpen((o) => !o)}
      >
        {stats && stats.yieldThresholds.distribution.length > 0 ? (
          <div>
            <p className="text-sm text-secondary mb-3">
              Most common: <span className="text-white font-medium">{stats.yieldThresholds.mostCommon}%</span>{' '}
              ({stats.yieldThresholds.mostCommonCount} robots)
            </p>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
              {stats.yieldThresholds.distribution.map((y) => (
                <div key={y.threshold} className="bg-surface-elevated rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-indigo-400">{y.count}</div>
                  <div className="text-xs text-secondary">{y.threshold}%</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-secondary">No yield threshold data available</p>
        )}
      </CollapsibleSection>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Battle Statistics by Type                                          */
/* ------------------------------------------------------------------ */

function BattleStatsByType({ stats }: { stats: SystemStats }) {
  const { battles, matches } = stats;
  const byType = matches.byType;

  // Overall battle stats card
  const overallCard = (
    <div className="bg-surface rounded-lg p-5">
      <h3 className="text-lg font-semibold mb-3 text-purple-400">Overall Battles</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-secondary">Total:</span>{' '}
          <span className="font-mono text-white">{battles.total.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-secondary">Last 24h:</span>{' '}
          <span className="font-mono text-white">{battles.last24Hours}</span>
        </div>
        <div>
          <span className="text-secondary">Draws:</span>{' '}
          <span className="font-mono text-white">{battles.draws} ({battles.drawPercentage}%)</span>
        </div>
        <div>
          <span className="text-secondary">Kills:</span>{' '}
          <span className="font-mono text-white">{battles.kills} ({battles.killPercentage}%)</span>
        </div>
        <div>
          <span className="text-secondary">Avg Duration:</span>{' '}
          <span className="font-mono text-white">{battles.avgDuration}s</span>
        </div>
      </div>
    </div>
  );

  // Per-type cards (League, Tournament, Tag Team, KotH)
  // We derive per-type stats from the matches.byType data
  // The full per-type battle breakdown (draws, kills, kill%, avg duration, victory margin)
  // requires data from the system stats endpoint. We display what's available.
  const typeCards = byType ? (
    <>
      <BattleTypeCard
        title="League"
        color="text-success"
        scheduled={byType.league.scheduled}
        completed={byType.league.completed}
        typeStats={battles.byType?.league}
      />
      <BattleTypeCard
        title="Tournament"
        color="text-yellow-400"
        scheduled={byType.tournament.scheduled}
        completed={byType.tournament.completed}
        typeStats={battles.byType?.tournament}
      />
      <BattleTypeCard
        title="Tag Team"
        color="text-cyan-400"
        scheduled={byType.tagTeam.scheduled}
        completed={byType.tagTeam.completed}
        typeStats={battles.byType?.tagTeam}
      />
      <BattleTypeCard
        title="KotH"
        color="text-orange-400"
        scheduled={byType.koth.scheduled}
        completed={byType.koth.completed}
        typeStats={battles.byType?.koth}
      />
    </>
  ) : null;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        ⚔️ Battle Statistics
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {overallCard}
        {typeCards}
      </div>
    </div>
  );
}

function BattleTypeCard({
  title,
  color,
  scheduled,
  completed,
  typeStats,
}: {
  title: string;
  color: string;
  scheduled: number;
  completed: number;
  typeStats?: { total: number; draws: number; drawPercentage: number; kills: number; killPercentage: number; avgDuration: number };
}) {
  return (
    <div className="bg-surface rounded-lg p-5">
      <h4 className={`text-base font-semibold mb-3 ${color}`}>{title}</h4>
      <div className="space-y-1 text-sm">
        <div>
          <span className="text-secondary">Scheduled:</span>{' '}
          <span className="font-mono text-white">{scheduled}</span>
        </div>
        <div>
          <span className="text-secondary">Completed:</span>{' '}
          <span className="font-mono text-white">{completed}</span>
        </div>
        {typeStats && typeStats.total > 0 && (
          <>
            <div className="border-t border-white/10 mt-2 pt-2">
              <span className="text-secondary">Battles:</span>{' '}
              <span className="font-mono text-white">{typeStats.total}</span>
            </div>
            <div>
              <span className="text-secondary">Draws:</span>{' '}
              <span className="font-mono text-white">{typeStats.draws} ({typeStats.drawPercentage}%)</span>
            </div>
            <div>
              <span className="text-secondary">Kills:</span>{' '}
              <span className="font-mono text-white">{typeStats.kills} ({typeStats.killPercentage}%)</span>
            </div>
            <div>
              <span className="text-secondary">Avg Duration:</span>{' '}
              <span className="font-mono text-white">{typeStats.avgDuration}s</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Facility Investment Breakdown                                      */
/* ------------------------------------------------------------------ */

function FacilityBreakdown({ stats }: { stats: SystemStats }) {
  const { facilities } = stats;

  if (facilities.summary.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          🏭 Facility Investment
        </h3>
        <div className="bg-surface rounded-lg p-5 text-sm text-secondary">
          No facilities purchased yet
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        🏭 Facility Investment
        <span className="text-sm font-normal text-secondary">
          ({facilities.totalPurchases} total purchases)
        </span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 px-3 text-secondary">Facility Type</th>
              <th className="text-right py-2 px-3 text-secondary">Purchases</th>
              <th className="text-right py-2 px-3 text-secondary">Avg Level</th>
            </tr>
          </thead>
          <tbody>
            {facilities.summary.map((facility) => (
              <tr key={facility.type} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-2 px-3 text-white capitalize">
                  {facility.type.replace(/_/g, ' ')}
                </td>
                <td className="py-2 px-3 text-right font-mono text-cyan-400">
                  {facility.purchaseCount}
                </td>
                <td className="py-2 px-3 text-right font-mono text-indigo-400">
                  {facility.avgLevel.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Weapon Economy Metrics                                             */
/* ------------------------------------------------------------------ */

function WeaponEconomy({ stats }: { stats: SystemStats }) {
  const { weapons } = stats;
  const equipRate =
    weapons.totalBought > 0
      ? Math.round((weapons.equipped / weapons.totalBought) * 100)
      : 0;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        🗡️ Weapon Economy
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-400">{weapons.totalBought}</div>
          <div className="text-sm text-secondary">Total Purchased</div>
        </div>
        <div className="bg-surface rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{weapons.equipped}</div>
          <div className="text-sm text-secondary">Equipped</div>
        </div>
        <div className="bg-surface rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{equipRate}%</div>
          <div className="text-sm text-secondary">Equip Rate</div>
        </div>
        <div className="bg-surface rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-400">
            {weapons.totalBought > 0 ? weapons.totalBought - weapons.equipped : 0}
          </div>
          <div className="text-sm text-secondary">Unequipped</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Roster Strategy Breakdown                                          */
/* ------------------------------------------------------------------ */

function RosterStrategy({ stats }: { stats: SystemStats }) {
  const { robots, finances } = stats;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        🤖 Roster Overview
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">{robots.total}</div>
          <div className="text-sm text-secondary">Total Robots</div>
        </div>
        <div className="bg-surface rounded-lg p-4">
          <div className="text-2xl font-bold text-success">
            {robots.battleReady} ({(robots.battleReadyPercentage ?? 0).toFixed(1)}%)
          </div>
          <div className="text-sm text-secondary">Battle Ready</div>
        </div>
        <div className="bg-surface rounded-lg p-4">
          <div className="text-2xl font-bold text-info">{finances.totalUsers}</div>
          <div className="text-sm text-secondary">Total Players</div>
        </div>
        <div className="bg-surface rounded-lg p-4">
          <div className="text-2xl font-bold text-warning">
            {finances.totalUsers > 0
              ? (robots.total / finances.totalUsers).toFixed(1)
              : '0'}
          </div>
          <div className="text-sm text-secondary">Avg Robots/Player</div>
        </div>
      </div>

      {/* Tier distribution */}
      {robots.byTier.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-secondary mb-2">Robots by Tier</h4>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
            {robots.byTier.map((tier) => (
              <div key={tier.league} className="bg-surface rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-primary">{tier.count}</div>
                <div className="text-xs text-secondary">{tier.league}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboardPage;
