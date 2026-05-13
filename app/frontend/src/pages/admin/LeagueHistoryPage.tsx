/**
 * AdminLeagueHistoryPage — League tier change history dashboard.
 *
 * Sections:
 * 1. Summary cards (total promotions/demotions for most recent cycle)
 * 2. Filter bar (cycle range inputs + entity type dropdown)
 * 3. Per-tier breakdown grid
 * 4. Paginated events table
 * 5. Timeline slide-over panel (opens on row click)
 * 6. Yo-yo candidates section
 */
import { useState, useEffect, useCallback } from 'react';
import {
  AdminPageHeader,
  AdminStatCard,
  AdminDataTable,
  AdminSlideOver,
} from '../../components/admin/shared';
import LeagueTimeline from '../../components/LeagueTimeline';
import type { LeagueHistoryEntry } from '../../components/LeagueTimeline';
import apiClient from '../../utils/apiClient';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LeagueHistoryEvent {
  id: number;
  entityType: string;
  entityId: number;
  entityName?: string;
  changeType: string;
  sourceTier: string;
  destinationTier: string;
  leaguePoints: number;
  cycleNumber: number;
  [key: string]: unknown;
}

interface AggregateResult {
  tier: string;
  promotions: number;
  demotions: number;
}

interface YoYoCandidate {
  entityType: string;
  entityId: number;
  entityName: string;
  changeCount: number;
  tiersInvolved: string[];
}

interface PaginatedResponse {
  data: LeagueHistoryEvent[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function LeagueHistoryPage(): React.ReactElement {
  // Filter state
  const [startCycle, setStartCycle] = useState('1');
  const [endCycle, setEndCycle] = useState('100');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  // Data state
  const [events, setEvents] = useState<PaginatedResponse | null>(null);
  const [aggregates, setAggregates] = useState<AggregateResult[]>([]);
  const [yoyoCandidates, setYoyoCandidates] = useState<YoYoCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Slide-over state
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: number; name: string } | null>(null);
  const [entityHistory, setEntityHistory] = useState<LeagueHistoryEntry[]>([]);
  const [slideOverOpen, setSlideOverOpen] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Data Fetching                                                    */
  /* ---------------------------------------------------------------- */

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startCycle,
        endCycle,
        page: String(page),
        perPage: '50',
      });
      if (entityType) params.set('entityType', entityType);

      const res = await apiClient.get<PaginatedResponse>(`/api/admin/league-history?${params.toString()}`);
      setEvents(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load league history';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [startCycle, endCycle, entityType, page]);

  const fetchAggregates = useCallback(async () => {
    try {
      const params = new URLSearchParams({ startCycle, endCycle });
      if (entityType) params.set('entityType', entityType);

      const res = await apiClient.get<AggregateResult[]>(`/api/admin/league-history/aggregates?${params.toString()}`);
      setAggregates(res.data);
    } catch {
      // Non-critical — don't block the page
    }
  }, [startCycle, endCycle, entityType]);

  const fetchYoYo = useCallback(async () => {
    try {
      const res = await apiClient.get<YoYoCandidate[]>('/api/admin/league-history/yo-yo');
      setYoyoCandidates(res.data);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchAggregates();
    fetchYoYo();
  }, [fetchEvents, fetchAggregates, fetchYoYo]);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                         */
  /* ---------------------------------------------------------------- */

  const handleRowClick = async (row: LeagueHistoryEvent) => {
    setSelectedEntity({
      type: row.entityType,
      id: row.entityId,
      name: row.entityName || `${row.entityType} #${row.entityId}`,
    });
    setEntityHistory([]); // Clear stale data immediately
    setSlideOverOpen(true);

    try {
      const res = await apiClient.get(`/api/admin/league-history/entity/${row.entityType}/${row.entityId}`);
      const records = res.data.data || res.data;
      setEntityHistory(
        (records as LeagueHistoryEvent[]).map((r) => ({
          cycleNumber: r.cycleNumber,
          destinationTier: r.destinationTier,
          changeType: r.changeType as 'promotion' | 'demotion',
          leaguePoints: r.leaguePoints,
        }))
      );
    } catch {
      setEntityHistory([]);
    }
  };

  const handleFilterApply = () => {
    setPage(1);
    // useEffect will re-run because fetchEvents/fetchAggregates deps changed
  };

  /* ---------------------------------------------------------------- */
  /*  Computed Values                                                   */
  /* ---------------------------------------------------------------- */

  const totalPromotions = aggregates.reduce((sum, a) => sum + a.promotions, 0);
  const totalDemotions = aggregates.reduce((sum, a) => sum + a.demotions, 0);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div data-testid="league-history-page" className="space-y-6">
      <AdminPageHeader
        title="League History"
        subtitle="Track all tier promotions and demotions"
      />

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="summary-cards">
        <AdminStatCard label="Promotions" value={totalPromotions} color="success" icon="⬆️" />
        <AdminStatCard label="Demotions" value={totalDemotions} color="error" icon="⬇️" />
        <AdminStatCard label="Total Events" value={totalPromotions + totalDemotions} color="primary" icon="📊" />
        <AdminStatCard label="Yo-Yo Candidates" value={yoyoCandidates.length} color="warning" icon="🔄" />
      </div>

      {/* Filter Bar */}
      <div className="bg-surface-elevated rounded-lg p-4 flex flex-wrap items-end gap-4" data-testid="filter-controls">
        <div>
          <label className="block text-xs text-secondary mb-1">Start Cycle</label>
          <input
            type="number"
            value={startCycle}
            onChange={(e) => setStartCycle(e.target.value)}
            className="bg-surface text-white text-sm rounded px-3 py-1.5 border border-white/10 w-24"
            data-testid="start-cycle-input"
            min="1"
          />
        </div>
        <div>
          <label className="block text-xs text-secondary mb-1">End Cycle</label>
          <input
            type="number"
            value={endCycle}
            onChange={(e) => setEndCycle(e.target.value)}
            className="bg-surface text-white text-sm rounded px-3 py-1.5 border border-white/10 w-24"
            data-testid="end-cycle-input"
            min="1"
          />
        </div>
        <div>
          <label className="block text-xs text-secondary mb-1">Entity Type</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="bg-surface text-white text-sm rounded px-3 py-1.5 border border-white/10"
            data-testid="entity-type-select"
          >
            <option value="">All</option>
            <option value="robot">Robots</option>
            <option value="tag_team">Tag Teams</option>
          </select>
        </div>
        <button
          type="button"
          onClick={handleFilterApply}
          className="px-4 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors"
          data-testid="apply-filters-btn"
        >
          Apply
        </button>
      </div>

      {/* Per-Tier Breakdown */}
      {aggregates.length > 0 && (
        <div data-testid="tier-breakdown">
          <h3 className="text-sm font-semibold text-secondary mb-3">Per-Tier Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {aggregates.map((agg) => (
              <div key={agg.tier} className="bg-surface-elevated rounded-lg p-3 text-center">
                <div className="text-sm font-semibold text-white capitalize mb-2">{agg.tier}</div>
                <div className="flex justify-center gap-3 text-xs">
                  <span className="text-green-400">↑{agg.promotions}</span>
                  <span className="text-red-400">↓{agg.demotions}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events Table */}
      <div data-testid="events-table">
        <AdminDataTable<LeagueHistoryEvent>
          columns={[
            {
              key: 'entityName',
              label: 'Entity Name',
              render: (row) => row.entityName || `${row.entityType} #${row.entityId}`,
            },
            {
              key: 'entityType',
              label: 'Type',
              render: (row) => (
                <span className="capitalize">{row.entityType.replace('_', ' ')}</span>
              ),
            },
            {
              key: 'changeType',
              label: 'Change',
              render: (row) => (
                <span className={row.changeType === 'promotion' ? 'text-green-400' : 'text-red-400'}>
                  {row.changeType === 'promotion' ? '▲ Promotion' : '▼ Demotion'}
                </span>
              ),
            },
            {
              key: 'tiers',
              label: 'From → To',
              render: (row) => (
                <span className="capitalize">
                  {row.sourceTier} → {row.destinationTier}
                </span>
              ),
            },
            {
              key: 'leaguePoints',
              label: 'LP',
            },
            {
              key: 'cycleNumber',
              label: 'Cycle',
            },
          ]}
          data={events?.data ?? []}
          loading={loading}
          emptyMessage="No league history events found"
          onRowClick={handleRowClick}
          pagination={
            events && events.pagination.totalPages > 1
              ? {
                  page: events.pagination.page,
                  totalPages: events.pagination.totalPages,
                  onPageChange: setPage,
                }
              : undefined
          }
        />
      </div>

      {/* Yo-Yo Candidates Section */}
      <div data-testid="yoyo-section">
        <h3 className="text-lg font-semibold text-white mb-3">🔄 Yo-Yo Candidates</h3>
        <p className="text-sm text-secondary mb-4">
          Entities with frequent tier oscillation (3+ changes within 20 cycles)
        </p>
        {yoyoCandidates.length === 0 ? (
          <div className="bg-surface-elevated rounded-lg p-4 text-center text-secondary text-sm">
            No yo-yo candidates detected
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {yoyoCandidates.map((candidate) => (
              <div
                key={`${candidate.entityType}-${candidate.entityId}`}
                className="bg-surface-elevated rounded-lg p-4 border border-warning/20"
              >
                <div className="font-semibold text-white mb-1">{candidate.entityName}</div>
                <div className="text-xs text-secondary capitalize mb-1">
                  {candidate.entityType.replace('_', ' ')}
                </div>
                <div className="text-sm text-warning">
                  {candidate.changeCount} changes
                </div>
                <div className="text-xs text-secondary mt-1 capitalize">
                  Tiers: {candidate.tiersInvolved.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline Slide-Over */}
      <AdminSlideOver
        open={slideOverOpen}
        onClose={() => {
          setSlideOverOpen(false);
          setSelectedEntity(null);
          setEntityHistory([]);
        }}
        title={selectedEntity ? `${selectedEntity.name} — League Timeline` : 'League Timeline'}
        width="xl"
      >
        <LeagueTimeline
          history={entityHistory}
          currentTier={entityHistory.length > 0 ? entityHistory[entityHistory.length - 1].destinationTier : 'bronze'}
          emptyMessage="No tier change history for this entity"
        />
      </AdminSlideOver>
    </div>
  );
}

export default LeagueHistoryPage;
