/**
 * RefinementAdoptionPage — Weapon Refinement adoption stats and tier breakdown.
 *
 * Tracks Weapon Refinement (Spec #34) feature usage:
 *   - Aggregate adoption rate (users who refined ≥1 weapon)
 *   - Per-tier engagement (hone / augment / sharpen / forge)
 *   - Most-targeted attributes (which attributes get honed/augmented)
 *   - Top spenders (10 users by lifetime credits spent on refinement)
 *
 * Fetches from GET /api/admin/refinement/adoption.
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
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TierBreakdownEntry {
  tier: 'hone' | 'augment' | 'sharpen' | 'forge';
  refinementCount: number;
  uniqueUsers: number;
  totalMagnitude: number;
  [key: string]: unknown;
}

interface AttributeRankingEntry {
  attribute: string;
  refinementCount: number;
  uniqueUsers: number;
  totalMagnitude: number;
  [key: string]: unknown;
}

interface TopSpenderEntry {
  userId: number;
  username: string;
  totalSpent: number;
  weaponCount: number;
  [key: string]: unknown;
}

interface RefinementAdoptionData {
  usersWithRefinements: number;
  totalUsers: number;
  adoptionRate: number;
  totalRefinements: number;
  totalRefinedWeapons: number;
  totalCreditsSpent: number;
  tierBreakdown: TierBreakdownEntry[];
  attributeRanking: AttributeRankingEntry[];
  topSpenders: TopSpenderEntry[];
  timestamp: string;
}

type UserFilter = 'all' | 'real' | 'auto';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const TIER_LABELS: Record<TierBreakdownEntry['tier'], string> = {
  hone: 'Hone',
  augment: 'Augment',
  sharpen: 'Sharpen',
  forge: 'Forge',
};

const TIER_DESCRIPTIONS: Record<TierBreakdownEntry['tier'], string> = {
  hone: '+1 to +5 to an existing attribute',
  augment: '+1 to +5 to a new attribute',
  sharpen: '−0.25s cooldown',
  forge: '+1.0 base damage',
};

/**
 * Formats credit amounts with a fixed locale so the rendered output is
 * deterministic across dev/CI environments. We pin to `en-US` (matching
 * the rest of the player-facing UI) instead of using the runtime locale —
 * this keeps unit tests stable on developer machines that default to a
 * non-English locale (e.g., `de-DE` would render `4.500.000`).
 */
const CREDITS_FORMATTER = new Intl.NumberFormat('en-US');

function formatCredits(amount: number): string {
  return `₡${CREDITS_FORMATTER.format(amount)}`;
}

/** Formats integer counts with the same fixed locale as `formatCredits`. */
function formatCount(value: number): string {
  return CREDITS_FORMATTER.format(value);
}

function formatAttributeName(attr: string): string {
  // camelCase → "Camel Case"
  return attr.replace(/([A-Z])/g, ' $1').trim().replace(/^./, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function RefinementAdoptionPage() {
  const [data, setData] = useState<RefinementAdoptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<UserFilter>('real');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<RefinementAdoptionData>(
        `/api/admin/refinement/adoption?filter=${userFilter}`,
      );
      setData(res.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load refinement adoption data';
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
    <div data-testid="refinement-adoption-page" className="space-y-6">
      <AdminPageHeader
        title="Refinement Adoption"
        subtitle="Weapon Refinement system usage and tier engagement"
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
        <div
          role="alert"
          className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm flex justify-between items-center"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchData}
            className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      )}

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

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <AdminStatCard
          label="Users with Refinements"
          value={data?.usersWithRefinements ?? 0}
          color="primary"
          icon={<span>🔨</span>}
        />
        <AdminStatCard
          label="Total Users (in scope)"
          value={data?.totalUsers ?? 0}
          color="info"
          icon={<span>👥</span>}
        />
        <AdminStatCard
          label="Adoption Rate"
          value={data ? `${data.adoptionRate}%` : '0%'}
          color="success"
          icon={<span>📊</span>}
        />
        <AdminStatCard
          label="Refined Weapons"
          value={data?.totalRefinedWeapons ?? 0}
          color="info"
          icon={<span>⚔️</span>}
        />
        <AdminStatCard
          label="Total Refinement Slots"
          value={data?.totalRefinements ?? 0}
          color="info"
          icon={<span>🧱</span>}
        />
        <AdminStatCard
          label="Credits Spent (lifetime)"
          value={data ? formatCredits(data.totalCreditsSpent) : formatCredits(0)}
          color="warning"
          icon={<span>💰</span>}
        />
      </div>

      {/* Tier Breakdown */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Tier Breakdown</h3>
        <p className="text-sm text-secondary mb-4">
          Refinement slots filled per tier, with unique users per tier.
        </p>
        <AdminDataTable<TierBreakdownEntry>
          columns={[
            {
              key: 'tier',
              label: 'Tier',
              render: (row) => (
                <div>
                  <div className="font-semibold">{TIER_LABELS[row.tier]}</div>
                  <div className="text-xs text-tertiary">{TIER_DESCRIPTIONS[row.tier]}</div>
                </div>
              ),
            },
            {
              key: 'refinementCount',
              label: 'Slots Filled',
              align: 'right',
              render: (row) => formatCount(row.refinementCount),
            },
            {
              key: 'uniqueUsers',
              label: 'Unique Users',
              align: 'right',
              render: (row) => formatCount(row.uniqueUsers),
            },
            {
              key: 'totalMagnitude',
              label: 'Total Magnitude',
              align: 'right',
              render: (row) => formatCount(row.totalMagnitude),
            },
          ]}
          data={data?.tierBreakdown ?? []}
          loading={loading}
          emptyMessage="No refinement data available"
        />
      </div>

      {/* Attribute Ranking */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Most-Refined Attributes</h3>
        <p className="text-sm text-secondary mb-4">
          Which attributes players Hone or Augment most often. Sharpen and Forge slots are
          excluded — they don't target attributes.
        </p>
        <AdminDataTable<AttributeRankingEntry>
          columns={[
            {
              key: 'attribute',
              label: 'Attribute',
              render: (row) => formatAttributeName(row.attribute),
            },
            {
              key: 'refinementCount',
              label: 'Slots',
              align: 'right',
              render: (row) => formatCount(row.refinementCount),
            },
            {
              key: 'uniqueUsers',
              label: 'Unique Users',
              align: 'right',
              render: (row) => formatCount(row.uniqueUsers),
            },
            {
              key: 'totalMagnitude',
              label: 'Total Magnitude',
              align: 'right',
              render: (row) => formatCount(row.totalMagnitude),
            },
          ]}
          data={data?.attributeRanking ?? []}
          loading={loading}
          emptyMessage="No attribute refinements yet"
        />
      </div>

      {/* Top Spenders */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Top Spenders</h3>
        <p className="text-sm text-secondary mb-4">
          Top 10 users by lifetime credits spent on refinement.
        </p>
        <AdminDataTable<TopSpenderEntry>
          columns={[
            {
              key: 'username',
              label: 'Player',
              render: (row) => row.username,
            },
            {
              key: 'totalSpent',
              label: 'Credits Spent',
              align: 'right',
              render: (row) => formatCredits(row.totalSpent),
            },
            {
              key: 'weaponCount',
              label: 'Weapons Refined',
              align: 'right',
              render: (row) => formatCount(row.weaponCount),
            },
          ]}
          data={data?.topSpenders ?? []}
          loading={loading}
          emptyMessage="No refinement spending recorded yet"
        />
      </div>
    </div>
  );
}

export default RefinementAdoptionPage;
