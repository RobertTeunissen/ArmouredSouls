/**
 * PracticeArenaPage — Stats cards and daily usage trend table for the practice arena.
 *
 * Fetches from GET /api/admin/practice-arena/stats.
 * Backend returns { current: PracticeArenaStatsResponse, history: DailyStats[] }.
 *
 * Requirements: 7.1, 7.2, 7.3, 25.1, 25.2, 25.3, 25.4
 */
import { useState, useEffect, useCallback } from 'react';
import { AdminPageHeader, AdminStatCard, AdminDataTable } from '../../components/admin/shared';
import apiClient from '../../utils/apiClient';

/* ------------------------------------------------------------------ */
/*  Types (matches backend response)                                   */
/* ------------------------------------------------------------------ */

interface CurrentStats {
  totalBattlesSinceStart: number;
  battlesToday: number;
  rateLimitHitsToday: number;
  uniquePlayersToday: number;
}

interface DailyHistoryEntry {
  date: string;
  totalBattles: number;
  uniquePlayers: number;
  rateLimitHits: number;
  [key: string]: unknown;
}

interface PracticeArenaResponse {
  current: CurrentStats;
  history: DailyHistoryEntry[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function AdminPracticeArenaPage() {
  const [data, setData] = useState<PracticeArenaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<PracticeArenaResponse>('/api/admin/practice-arena/stats');
      setData(response.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load practice arena stats';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const current = data?.current;

  return (
    <div data-testid="practice-arena-page" className="space-y-6">
      <AdminPageHeader
        title="Practice Arena"
        subtitle="Practice battle usage and trends"
        actions={
          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded transition-colors"
          >
            ↻ Refresh
          </button>
        }
      />

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminStatCard
          label="Battles Today"
          value={loading ? '...' : (current?.battlesToday ?? 0)}
          color="success"
          icon={<span>⚔️</span>}
        />
        <AdminStatCard
          label="Unique Players Today"
          value={loading ? '...' : (current?.uniquePlayersToday ?? 0)}
          color="primary"
          icon={<span>👤</span>}
        />
        <AdminStatCard
          label="Rate Limit Hits"
          value={loading ? '...' : (current?.rateLimitHitsToday ?? 0)}
          color={current && current.rateLimitHitsToday > 0 ? 'warning' : 'info'}
          icon={<span>🚫</span>}
        />
        <AdminStatCard
          label="Total Since Start"
          value={loading ? '...' : (current?.totalBattlesSinceStart ?? 0)}
          color="info"
          icon={<span>📊</span>}
        />
      </div>

      {/* Daily Usage Trend Table */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Daily Usage Trend</h3>
        <AdminDataTable<DailyHistoryEntry>
          columns={[
            { key: 'date', label: 'Date', render: (row) => new Date(row.date).toLocaleDateString() },
            { key: 'totalBattles', label: 'Battles', align: 'right' },
            { key: 'uniquePlayers', label: 'Unique Players', align: 'right' },
            { key: 'rateLimitHits', label: 'Rate Limit Hits', align: 'right' },
          ]}
          data={data?.history ?? []}
          loading={loading}
          emptyMessage="No daily usage data available"
        />
      </div>
    </div>
  );
}

export default AdminPracticeArenaPage;
