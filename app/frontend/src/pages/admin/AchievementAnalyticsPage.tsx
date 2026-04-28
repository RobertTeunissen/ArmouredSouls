/**
 * AchievementAnalyticsPage — Unlock rates and participation stats.
 *
 * Fetches from GET /api/admin/achievements/analytics with real/auto/all filter.
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
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
/*  Types (matches backend getAchievementAnalytics response)           */
/* ------------------------------------------------------------------ */

interface AchievementEntry {
  achievementId: string;
  unlockCount: number;
  unlockRate: number;
  [key: string]: unknown;
}

interface AchievementAnalyticsData {
  achievements: AchievementEntry[];
  totalUnlocks: number;
  uniquePlayersWithAchievements: number;
  totalUsers: number;
  participationRate: number;
  timestamp: string;
}

type UserFilter = 'all' | 'real' | 'auto';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function AchievementAnalyticsPage() {
  const [data, setData] = useState<AchievementAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<UserFilter>('real');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<AchievementAnalyticsData>(
        `/api/admin/achievements/analytics?filter=${userFilter}`,
      );
      setData(res.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load achievement analytics';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterToggle = (key: string) => {
    setUserFilter(key as UserFilter);
  };

  const zeroUnlocks = data?.achievements.filter(a => a.unlockCount === 0).length ?? 0;
  const highUnlocks = data?.achievements.filter(a => a.unlockRate > 90).length ?? 0;

  return (
    <div data-testid="achievement-analytics-page" className="space-y-6">
      <AdminPageHeader
        title="Achievement Analytics"
        subtitle="Unlock rates and player participation"
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
        <AdminStatCard
          label="Total Unlocks"
          value={data?.totalUnlocks ?? 0}
          color="primary"
          icon={<span>🏆</span>}
        />
        <AdminStatCard
          label="Participation"
          value={data ? `${data.participationRate}%` : '0%'}
          color="info"
          icon={<span>📊</span>}
        />
        <AdminStatCard
          label="Never Unlocked"
          value={zeroUnlocks}
          color={zeroUnlocks > 0 ? 'warning' : 'success'}
          icon={<span>🔒</span>}
        />
        <AdminStatCard
          label="High Unlock (>90%)"
          value={highUnlocks}
          color={highUnlocks > 0 ? 'warning' : 'success'}
          icon={<span>🎯</span>}
        />
      </div>

      {/* User Filter */}
      <AdminFilterBar
        filters={[
          { key: 'real', label: 'Real Players', active: userFilter === 'real' },
          { key: 'auto', label: 'Auto-Generated', active: userFilter === 'auto' },
          { key: 'all', label: 'All', active: userFilter === 'all' },
        ]}
        onFilterToggle={handleFilterToggle}
        onClearAll={() => setUserFilter('real')}
      />

      {/* Players with achievements */}
      {data && (
        <div className="bg-surface rounded-lg p-4 text-sm text-secondary">
          {data.uniquePlayersWithAchievements} of {data.totalUsers} players have unlocked at least one achievement
        </div>
      )}

      {/* Achievements Table */}
      <AdminDataTable<AchievementEntry>
        columns={[
          { key: 'achievementId', label: 'Achievement ID' },
          { key: 'unlockCount', label: 'Unlocks', align: 'right' },
          {
            key: 'unlockRate',
            label: 'Unlock Rate',
            align: 'right',
            render: (row) => {
              const pct = row.unlockRate;
              const color = pct === 0 ? 'text-error' : pct > 90 ? 'text-warning' : 'text-white';
              return <span className={color}>{pct}%</span>;
            },
          },
        ]}
        data={data?.achievements ?? []}
        loading={loading}
        emptyMessage="No achievement analytics data available"
      />
    </div>
  );
}

export default AchievementAnalyticsPage;
