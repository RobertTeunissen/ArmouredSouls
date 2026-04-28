/**
 * EconomyOverviewPage — Credits in circulation, balance stats, bankruptcy risk,
 * facility popularity with per-level breakdown.
 *
 * Fetches from GET /api/admin/economy/overview.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */
import { useState, useEffect, useCallback } from 'react';
import {
  AdminPageHeader,
  AdminStatCard,
} from '../../components/admin/shared';
import apiClient from '../../utils/apiClient';

/* ------------------------------------------------------------------ */
/*  Types (matches backend getEconomyOverview response)                */
/* ------------------------------------------------------------------ */

interface LevelCount {
  level: number;
  count: number;
}

interface FacilityEntry {
  type: string;
  owners: number;
  avgLevel: number;
  maxLevel: number;
  levelDistribution: LevelCount[];
  [key: string]: unknown;
}

interface EconomyOverview {
  totalCreditsInCirculation: number;
  averageBalance: number;
  medianBalance: number;
  usersAtBankruptcyRisk: number;
  totalUsers: number;
  facilities: FacilityEntry[];
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCredits(value: number): string {
  if (value >= 1_000_000) return `₡${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₡${(value / 1_000).toFixed(1)}K`;
  return `₡${value.toLocaleString()}`;
}

function formatFacilityName(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/*  Level distribution bar                                             */
/* ------------------------------------------------------------------ */

function LevelBar({ distribution, owners }: { distribution: LevelCount[]; owners: number }) {
  if (distribution.length === 0) return <span className="text-secondary">—</span>;
  const maxCount = Math.max(...distribution.map(d => d.count));

  return (
    <div className="flex items-end gap-px h-6">
      {distribution.map(({ level, count }) => (
        <div
          key={level}
          className="bg-primary/70 hover:bg-primary rounded-t transition-colors relative group min-w-[8px]"
          style={{ height: `${Math.max(15, (count / maxCount) * 100)}%`, flex: 1 }}
          title={`Level ${level}: ${count} player${count !== 1 ? 's' : ''} (${Math.round((count / owners) * 100)}%)`}
        >
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-surface-elevated text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 border border-white/10">
            Lv.{level}: {count} ({Math.round((count / owners) * 100)}%)
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function EconomyOverviewPage() {
  const [data, setData] = useState<EconomyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFacility, setExpandedFacility] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<EconomyOverview>('/api/admin/economy/overview');
      setData(res.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load economy data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const bankruptcyPct = data && data.totalUsers > 0
    ? ((data.usersAtBankruptcyRisk / data.totalUsers) * 100).toFixed(1)
    : '0';

  return (
    <div data-testid="economy-overview-page" className="space-y-6">
      <AdminPageHeader
        title="Economy Overview"
        subtitle="Credit circulation, balance distribution, and facility adoption"
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminStatCard
          label="Credits in Circulation"
          value={loading ? '...' : formatCredits(data?.totalCreditsInCirculation ?? 0)}
          color="primary"
          icon={<span>💰</span>}
        />
        <AdminStatCard
          label="Average Balance"
          value={loading ? '...' : formatCredits(data?.averageBalance ?? 0)}
          color="info"
          icon={<span>📊</span>}
        />
        <AdminStatCard
          label="Median Balance"
          value={loading ? '...' : formatCredits(data?.medianBalance ?? 0)}
          color="info"
          icon={<span>📈</span>}
        />
        <AdminStatCard
          label="Bankruptcy Risk"
          value={loading ? '...' : `${data?.usersAtBankruptcyRisk ?? 0} (${bankruptcyPct}%)`}
          color={data && data.usersAtBankruptcyRisk > 0 ? 'error' : 'success'}
          icon={<span>⚠️</span>}
        />
      </div>

      {/* Facility Popularity */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-1">Facility Popularity</h3>
        <p className="text-sm text-secondary mb-4">Click a row to see the level distribution. Hover the bars for details.</p>

        {loading ? (
          <div className="text-center py-8 text-secondary">Loading...</div>
        ) : !data || data.facilities.length === 0 ? (
          <div className="text-center py-8 text-secondary">No facility data available</div>
        ) : (
          <div className="space-y-0 divide-y divide-white/5">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-secondary">
              <div className="col-span-3">Facility</div>
              <div className="col-span-1 text-right">Owners</div>
              <div className="col-span-1 text-right">Avg Lv</div>
              <div className="col-span-1 text-right">Max Lv</div>
              <div className="col-span-6">Level Distribution</div>
            </div>

            {data.facilities.map((facility) => {
              const isExpanded = expandedFacility === facility.type;
              return (
                <div key={facility.type}>
                  <button
                    type="button"
                    onClick={() => setExpandedFacility(isExpanded ? null : facility.type)}
                    className="w-full grid grid-cols-12 gap-2 px-4 py-3 text-sm hover:bg-white/5 transition-colors items-center text-left"
                  >
                    <div className="col-span-3 font-medium">{formatFacilityName(facility.type)}</div>
                    <div className="col-span-1 text-right">{facility.owners}</div>
                    <div className="col-span-1 text-right">{facility.avgLevel}</div>
                    <div className="col-span-1 text-right">{facility.maxLevel}</div>
                    <div className="col-span-6">
                      <LevelBar distribution={facility.levelDistribution} owners={facility.owners} />
                    </div>
                  </button>

                  {/* Expanded level detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1">
                      <div className="bg-surface-elevated rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-secondary mb-3">
                          {formatFacilityName(facility.type)} — Level Breakdown
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                          {facility.levelDistribution.map(({ level, count }) => {
                            const pct = facility.owners > 0 ? Math.round((count / facility.owners) * 100) : 0;
                            return (
                              <div key={level} className="bg-surface rounded p-2 text-center">
                                <p className="text-xs text-secondary">Level {level}</p>
                                <p className="text-lg font-bold">{count}</p>
                                <p className="text-xs text-tertiary">{pct}% of owners</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default EconomyOverviewPage;
