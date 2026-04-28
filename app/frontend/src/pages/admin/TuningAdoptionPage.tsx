/**
 * TuningAdoptionPage — Tuning allocation adoption stats and attribute ranking.
 *
 * Fetches from GET /api/admin/tuning/adoption.
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4
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
/*  Types (matches backend getTuningAdoption response)                 */
/* ------------------------------------------------------------------ */

interface AttributeRankEntry {
  attribute: string;
  totalPoints: number;
  [key: string]: unknown;
}

interface TuningAdoptionData {
  robotsWithTuning: number;
  totalRobots: number;
  adoptionRate: number;
  attributeRanking: AttributeRankEntry[];
  timestamp: string;
}

type UserFilter = 'all' | 'real' | 'auto';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function TuningAdoptionPage() {
  const [data, setData] = useState<TuningAdoptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<UserFilter>('real');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<TuningAdoptionData>(
        `/api/admin/tuning/adoption?filter=${userFilter}`,
      );
      setData(res.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load tuning adoption data';
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

  return (
    <div data-testid="tuning-adoption-page" className="space-y-6">
      <AdminPageHeader
        title="Tuning Adoption"
        subtitle="Tuning allocation adoption and attribute distribution"
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <AdminStatCard
          label="Robots with Tuning"
          value={data?.robotsWithTuning ?? 0}
          color="primary"
          icon={<span>🔧</span>}
        />
        <AdminStatCard
          label="Total Robots"
          value={data?.totalRobots ?? 0}
          color="info"
          icon={<span>🤖</span>}
        />
        <AdminStatCard
          label="Adoption Rate"
          value={data ? `${data.adoptionRate}%` : '0%'}
          color="success"
          icon={<span>📊</span>}
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

      {/* Attribute Ranking */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Attribute Tuning Ranking</h3>
        <p className="text-sm text-secondary mb-4">Which attributes players invest tuning points into most</p>
        <AdminDataTable<AttributeRankEntry>
          columns={[
            { key: 'attribute', label: 'Attribute', render: (row) => (
              <span className="capitalize">{row.attribute.replace(/([A-Z])/g, ' $1').trim()}</span>
            )},
            { key: 'totalPoints', label: 'Total Points', align: 'right', render: (row) => row.totalPoints.toFixed(1) },
          ]}
          data={data?.attributeRanking ?? []}
          loading={loading}
          emptyMessage="No tuning data available"
        />
      </div>
    </div>
  );
}

export default TuningAdoptionPage;
