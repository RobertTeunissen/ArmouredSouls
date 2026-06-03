/**
 * SubscriptionAnalyticsPage — Admin subscription analytics dashboard.
 *
 * Shows per-event subscriber counts, trend over last 30 cycles, and per-Stable breakdown.
 * Fetches from GET /api/subscriptions/admin/analytics.
 *
 * Requirements: R11.5
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
} from '../../components/admin/shared';
import { api } from '../../utils/api';
import { ApiError } from '../../utils/ApiError';

/* ------------------------------------------------------------------ */
/*  Types (matches backend admin analytics response)                   */
/* ------------------------------------------------------------------ */

interface EventCount {
  eventType: string;
  subscriberCount: number;
  [key: string]: unknown;
}

interface TrendEntry {
  cycleNumber: number;
  eventType: string;
  subscribes: number;
  unsubscribes: number;
  [key: string]: unknown;
}

interface StableBreakdown {
  stableId: number;
  stableName: string;
  eventType: string;
  robotCount: number;
  [key: string]: unknown;
}

interface AnalyticsData {
  eventCounts: EventCount[];
  trends: TrendEntry[];
  stableBreakdown: StableBreakdown[];
  totalSubscriptions: number;
  totalRobots: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function SubscriptionAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-Stable Breakdown filters
  const [stableFilter, setStableFilter] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'robotCount', direction: 'desc' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<AnalyticsData>('/api/subscriptions/admin/analytics');
      setData(result);
    } catch (err: unknown) {
      const msg = (err instanceof ApiError && err.message) || 'Failed to load subscription analytics';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const averageSubscriptionsPerRobot = data && data.totalRobots > 0
    ? (data.totalSubscriptions / data.totalRobots).toFixed(1)
    : '0';

  // Unique event types from the breakdown for the filter dropdown
  const uniqueEventTypes = useMemo(() => {
    if (!data?.stableBreakdown) return [];
    return [...new Set(data.stableBreakdown.map((r) => r.eventType))].sort();
  }, [data?.stableBreakdown]);

  // Filtered and sorted stable breakdown
  const filteredStableBreakdown = useMemo(() => {
    if (!data?.stableBreakdown) return [];
    let result = data.stableBreakdown;
    if (stableFilter.trim()) {
      const query = stableFilter.trim().toLowerCase();
      result = result.filter((r) => r.stableName.toLowerCase().includes(query));
    }
    if (eventFilter !== 'all') {
      result = result.filter((r) => r.eventType === eventFilter);
    }
    // Sort
    const { key, direction } = sortState;
    const sorted = [...result].sort((a, b) => {
      const aVal = a[key as keyof StableBreakdown];
      const bVal = b[key as keyof StableBreakdown];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sorted;
  }, [data?.stableBreakdown, stableFilter, eventFilter, sortState]);

  const handleSort = (key: string) => {
    setSortState((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  return (
    <div data-testid="subscription-analytics-page" className="space-y-6">
      <AdminPageHeader
        title="Subscription Analytics"
        subtitle="Event subscription distribution, trends, and per-Stable breakdown"
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminStatCard
          label="Total Subscriptions"
          value={data?.totalSubscriptions ?? 0}
          color="primary"
          icon={<span>📋</span>}
        />
        <AdminStatCard
          label="Total Robots"
          value={data?.totalRobots ?? 0}
          color="info"
          icon={<span>🤖</span>}
        />
        <AdminStatCard
          label="Avg per Robot"
          value={averageSubscriptionsPerRobot}
          color="success"
          icon={<span>📊</span>}
        />
        <AdminStatCard
          label="Event Types"
          value={data?.eventCounts?.length ?? 0}
          color="info"
          icon={<span>🎯</span>}
        />
      </div>

      {/* Per-Event Subscriber Counts */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Subscribers per Event</h3>
        <p className="text-sm text-secondary mb-4">Current subscriber count for each event type</p>
        <AdminDataTable<EventCount>
          columns={[
            {
              key: 'eventType',
              label: 'Event',
              render: (row) => (
                <span className="capitalize font-medium">{row.eventType.replace(/_/g, ' ')}</span>
              ),
            },
            {
              key: 'subscriberCount',
              label: 'Subscribers',
              align: 'right',
              render: (row) => row.subscriberCount.toLocaleString(),
            },
          ]}
          data={data?.eventCounts ?? []}
          loading={loading}
          emptyMessage="No subscription data available"
        />
      </div>

      {/* Trend over last 30 cycles */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Subscription Trends (Last 30 Cycles)</h3>
        <p className="text-sm text-secondary mb-4">Subscribe and unsubscribe activity per cycle per event</p>
        {data?.trends && data.trends.length > 0 ? (
          <div className="overflow-x-auto">
            <AdminDataTable<TrendEntry>
              columns={[
                {
                  key: 'cycleNumber',
                  label: 'Cycle',
                  render: (row) => `#${row.cycleNumber}`,
                },
                {
                  key: 'eventType',
                  label: 'Event',
                  render: (row) => (
                    <span className="capitalize">{row.eventType.replace(/_/g, ' ')}</span>
                  ),
                },
                {
                  key: 'subscribes',
                  label: 'Subscribes',
                  align: 'right',
                  render: (row) => (
                    <span className="text-green-400">+{row.subscribes}</span>
                  ),
                },
                {
                  key: 'unsubscribes',
                  label: 'Unsubscribes',
                  align: 'right',
                  render: (row) => (
                    <span className="text-red-400">-{row.unsubscribes}</span>
                  ),
                },
              ]}
              data={data.trends}
              loading={loading}
              emptyMessage="No trend data available"
            />
          </div>
        ) : (
          <p className="text-secondary text-sm text-center py-4">No trend data available yet</p>
        )}
      </div>

      {/* Per-Stable Breakdown */}
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Per-Stable Breakdown</h3>
        <p className="text-sm text-secondary mb-4">How many robots each Stable has subscribed per event</p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            value={stableFilter}
            onChange={(e) => setStableFilter(e.target.value)}
            placeholder="Search stable…"
            className="bg-surface-elevated text-white px-3 py-2 rounded w-48 text-sm"
          />
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="bg-surface-elevated text-white px-3 py-2 rounded text-sm"
          >
            <option value="all">All Events</option>
            {uniqueEventTypes.map((et) => (
              <option key={et} value={et}>{et.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <AdminDataTable<StableBreakdown>
          columns={[
            {
              key: 'stableName',
              label: 'Stable',
              sortable: true,
              render: (row) => row.stableName || `Stable #${row.stableId}`,
            },
            {
              key: 'eventType',
              label: 'Event',
              sortable: true,
              render: (row) => (
                <span className="capitalize">{row.eventType.replace(/_/g, ' ')}</span>
              ),
            },
            {
              key: 'robotCount',
              label: 'Robots',
              sortable: true,
              align: 'right',
              render: (row) => row.robotCount.toString(),
            },
          ]}
          data={filteredStableBreakdown}
          loading={loading}
          emptyMessage="No matching data — try adjusting filters"
          sortState={sortState}
          onSort={handleSort}
        />
      </div>
    </div>
  );
}

export default SubscriptionAnalyticsPage;
