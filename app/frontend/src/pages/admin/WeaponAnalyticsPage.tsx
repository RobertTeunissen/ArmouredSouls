/**
 * WeaponAnalyticsPage — Weapon ownership breakdown by type and per-weapon stats.
 *
 * Fetches from GET /api/admin/weapons/analytics.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5
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
/*  Types — matching actual API response                               */
/* ------------------------------------------------------------------ */

interface WeaponEntry {
  weaponId: number;
  name: string;
  type: string;
  cost: number;
  baseDamage: number;
  owned: number;
  [key: string]: unknown;
}

interface WeaponAnalyticsData {
  weapons: WeaponEntry[];
  typeBreakdown: Record<string, number>;
  totalWeaponsOwned: number;
}

type UserFilter = 'all' | 'real' | 'auto';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function WeaponAnalyticsPage() {
  const [data, setData] = useState<WeaponAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<UserFilter>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<WeaponAnalyticsData>(
        `/api/admin/weapons/analytics?filter=${userFilter}`,
      );
      setData(res.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load weapon analytics';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const weapons = data?.weapons ?? [];
  const totalOwned = data?.totalWeaponsOwned ?? 0;
  const typeBreakdown = data?.typeBreakdown ?? {};
  const neverOwned = weapons.filter((w) => w.owned === 0).length;

  return (
    <div data-testid="weapon-analytics-page" className="space-y-6">
      <AdminPageHeader
        title="Weapon Analytics"
        subtitle="Weapon ownership and type distribution"
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminStatCard label="Total Owned" value={totalOwned} color="primary" icon={<span>🗡️</span>} />
        <AdminStatCard label="Weapon Types" value={weapons.length} color="info" icon={<span>📋</span>} />
        <AdminStatCard label="Never Owned" value={neverOwned} color={neverOwned > 0 ? 'warning' : 'success'} icon={<span>🚫</span>} />
        <AdminStatCard label="Most Popular Type" value={Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'} color="success" icon={<span>⭐</span>} />
      </div>

      {/* User Filter */}
      <AdminFilterBar
        filters={[
          { key: 'all', label: 'All Users', active: userFilter === 'all' },
          { key: 'real', label: 'Real Players', active: userFilter === 'real' },
          { key: 'auto', label: 'Auto-Generated', active: userFilter === 'auto' },
        ]}
        onFilterToggle={(key) => setUserFilter(key as UserFilter)}
      />

      {/* Type Breakdown */}
      {Object.keys(typeBreakdown).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <div key={type} className="bg-surface rounded-lg p-4">
              <div className="text-2xl font-bold text-primary">{count}</div>
              <div className="text-sm text-secondary capitalize">{type}</div>
            </div>
          ))}
        </div>
      )}

      {/* Weapons Table */}
      <AdminDataTable<WeaponEntry>
        columns={[
          { key: 'name', label: 'Weapon' },
          { key: 'type', label: 'Type', render: (row) => <span className="capitalize">{row.type}</span> },
          { key: 'cost', label: 'Cost', align: 'right', render: (row) => `₡${row.cost.toLocaleString()}` },
          { key: 'baseDamage', label: 'Base Damage', align: 'right' },
          {
            key: 'owned',
            label: 'Owned',
            align: 'right',
            render: (row) => (
              <span className={row.owned === 0 ? 'text-secondary' : 'text-white font-medium'}>
                {row.owned}
              </span>
            ),
          },
        ]}
        data={weapons}
        loading={loading}
        emptyMessage="No weapon data available"
      />
    </div>
  );
}

export default WeaponAnalyticsPage;
