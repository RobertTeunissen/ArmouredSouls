/**
 * PlayerEngagementPage — Player engagement data with churn risk classification.
 *
 * Fetches from GET /api/admin/engagement/players with pagination and
 * real/auto/all user filter support.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */
import { useState, useEffect, useCallback } from 'react';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
  AdminFilterBar,
} from '../../components/admin/shared';
import apiClient from '../../utils/apiClient';

/* ------------------------------------------------------------------ */
/*  Types (matches backend getEngagementPlayers response)              */
/* ------------------------------------------------------------------ */

interface PlayerEngagementEntry {
  userId: number;
  username: string;
  stableName: string | null;
  currency: number;
  lastLoginAt: string | null;
  createdAt: string;
  onboardingComplete: boolean;
  robotCount: number;
  totalBattles: number;
  totalWins: number;
  winRate: number;
  churnRisk: 'low' | 'medium' | 'high';
  [key: string]: unknown;
}

interface EngagementResponse {
  players: PlayerEngagementEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  timestamp: string;
}

type UserFilter = 'all' | 'real' | 'auto';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const CHURN_COLORS: Record<string, string> = {
  low: 'bg-green-500/20 text-green-400',
  medium: 'bg-amber-500/20 text-amber-400',
  high: 'bg-red-500/20 text-red-400',
};

function ChurnBadge({ risk }: { risk: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${CHURN_COLORS[risk] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {risk.toUpperCase()}
    </span>
  );
}

function daysSince(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function PlayerEngagementPage() {
  const [data, setData] = useState<EngagementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState<UserFilter>('real');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        filter: userFilter,
      });
      const res = await apiClient.get<EngagementResponse>(`/api/admin/engagement/players?${params.toString()}`);
      setData(res.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load engagement data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, userFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterToggle = (key: string) => {
    setUserFilter(key as UserFilter);
    setPage(1);
  };

  const players = data?.players ?? [];
  const highCount = players.filter((p) => p.churnRisk === 'high').length;
  const mediumCount = players.filter((p) => p.churnRisk === 'medium').length;
  const lowCount = players.filter((p) => p.churnRisk === 'low').length;

  return (
    <div data-testid="player-engagement-page" className="space-y-6">
      <AdminPageHeader
        title="Player Engagement"
        subtitle="Login recency, battle activity, and churn risk"
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
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={fetchData} className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm">
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminStatCard label="Total Players" value={data?.total ?? 0} color="primary" icon={<span>👥</span>} />
        <AdminStatCard label="High Risk" value={highCount} color="error" icon={<span>🚨</span>} />
        <AdminStatCard label="Medium Risk" value={mediumCount} color="warning" icon={<span>⚠️</span>} />
        <AdminStatCard label="Low Risk" value={lowCount} color="success" icon={<span>✓</span>} />
      </div>

      {/* User Filter */}
      <AdminFilterBar
        filters={[
          { key: 'real', label: 'Real Players', active: userFilter === 'real' },
          { key: 'auto', label: 'Auto-Generated', active: userFilter === 'auto' },
          { key: 'all', label: 'All', active: userFilter === 'all' },
        ]}
        onFilterToggle={handleFilterToggle}
        onClearAll={() => { setUserFilter('real'); setPage(1); }}
      />

      {/* Players Table */}
      <AdminDataTable<PlayerEngagementEntry>
        columns={[
          { key: 'username', label: 'Player', render: (row) => (
            <div>
              <span className="font-semibold">{row.stableName || row.username}</span>
              {row.stableName && <span className="text-secondary text-xs ml-1">@{row.username}</span>}
            </div>
          )},
          { key: 'robotCount', label: 'Robots', align: 'right' },
          { key: 'totalBattles', label: 'Battles', align: 'right' },
          { key: 'winRate', label: 'Win %', align: 'right', render: (row) => row.totalBattles > 0 ? `${row.winRate}%` : '—' },
          { key: 'currency', label: 'Balance', align: 'right', render: (row) => `₡${row.currency.toLocaleString()}` },
          {
            key: 'lastLoginAt',
            label: 'Last Login',
            render: (row) => row.lastLoginAt ? daysSince(row.lastLoginAt) : <span className="text-secondary">Never</span>,
          },
          {
            key: 'churnRisk',
            label: 'Churn Risk',
            render: (row) => <ChurnBadge risk={row.churnRisk} />,
          },
          {
            key: 'onboardingComplete',
            label: 'Onboarding',
            render: (row) => row.onboardingComplete
              ? <span className="text-success text-xs">✓ Done</span>
              : <span className="text-warning text-xs">In Progress</span>,
          },
        ]}
        data={players}
        loading={loading}
        emptyMessage="No player engagement data available"
        pagination={
          data && data.totalPages > 1
            ? { page: data.page, totalPages: data.totalPages, onPageChange: setPage }
            : undefined
        }
      />
    </div>
  );
}

export default PlayerEngagementPage;
