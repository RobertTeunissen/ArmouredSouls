/**
 * LeagueHealthPage — Robots per tier, ELO distribution.
 *
 * Fetches from GET /api/admin/league-health.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */
import { useState, useEffect, useCallback } from 'react';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
} from '../../components/admin/shared';
import apiClient from '../../utils/apiClient';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LeagueTier {
  league: string;
  robotCount: number;
  averageElo: number;
  instances: number;
  instanceDetails: { id: string; robotCount: number }[];
  [key: string]: unknown;
}

interface LeagueHealthData {
  leagues: LeagueTier[];
  totalRobots: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function LeagueHealthPage() {
  const [data, setData] = useState<LeagueHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<LeagueHealthData>('/api/admin/league-health');
      setData(res.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load league health data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const leagues = data?.leagues ?? [];
  const totalRobots = data?.totalRobots ?? 0;
  const emptyTiers = leagues.filter((l) => l.robotCount === 0).length;
  const activeTiers = leagues.filter((l) => l.robotCount > 0).length;

  return (
    <div data-testid="league-health-page" className="space-y-6">
      <AdminPageHeader
        title="League Health"
        subtitle="Tier distribution and ELO stats"
        actions={
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded transition-colors"
          >
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        }
      />

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <AdminStatCard label="Total Robots" value={totalRobots} color="primary" icon={<span>🤖</span>} />
        <AdminStatCard label="Active Tiers" value={activeTiers} color="success" icon={<span>🏆</span>} />
        <AdminStatCard label="Empty Tiers" value={emptyTiers} color={emptyTiers > 0 ? 'warning' : 'success'} icon={<span>📭</span>} />
      </div>

      {/* League Tiers Table */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">League Tiers</h3>
        <AdminDataTable<LeagueTier>
          columns={[
            {
              key: 'league',
              label: 'Tier',
              render: (row) => <span className="capitalize font-medium">{row.league}</span>,
            },
            { key: 'robotCount', label: 'Robots', align: 'right' },
            {
              key: 'instances',
              label: 'Instances',
              align: 'right',
              render: (row) => row.instances > 0 ? (
                <span title={row.instanceDetails.map((i: { id: string; robotCount: number }) => `${i.id}: ${i.robotCount}`).join(', ')}>
                  {row.instances}
                </span>
              ) : '—',
            },
            {
              key: 'averageElo',
              label: 'Avg ELO',
              align: 'right',
              render: (row) => row.robotCount > 0 ? row.averageElo.toLocaleString() : '—',
            },
          ]}
          data={leagues}
          loading={loading}
          emptyMessage="No league data available"
        />
      </div>
    </div>
  );
}

export default LeagueHealthPage;
