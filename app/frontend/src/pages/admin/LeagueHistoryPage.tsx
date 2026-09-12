/**
 * AdminLeagueHistoryPage — League tier change history dashboard.
 *
 * Sections:
 * 1. Summary cards (total promotions/demotions for most recent cycle)
 * 2. Filter bar (cycle range, entity type, and mode)
 * 3. Per-mode/per-tier breakdown grid
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
import { api } from '../../utils/api';
import { ApiError } from '../../utils/ApiError';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type LeagueHistoryMode =
  | 'league_1v1'
  | 'league_2v2'
  | 'league_3v3'
  | 'tag_team'
  | 'koth'
  | 'grand_melee';

const MODE_LABELS: Record<LeagueHistoryMode, string> = {
  league_1v1: '1v1 League',
  league_2v2: '2v2 League',
  league_3v3: '3v3 League',
  tag_team: 'Tag Team',
  koth: 'King of the Hill',
  grand_melee: 'Grand Melee',
};

function formatMode(mode: string | null): string {
  if (!mode) return 'Legacy / Unknown';
  return MODE_LABELS[mode as LeagueHistoryMode] ?? mode.replaceAll('_', ' ');
}

interface LeagueHistoryEvent {
  id: number;
  entityType: string;
  entityId: number;
  entityName?: string;
  stableName?: string;
  changeType: string;
  mode: string | null;
  sourceTier: string;
  destinationTier: string;
  leaguePoints: number;
  cycleNumber: number;
  [key: string]: unknown;
}

interface AggregateResult {
  mode: string | null;
  tier: string;
  promotions: number;
  demotions: number;
}

interface YoYoCandidate {
  entityType: string;
  entityId: number;
  entityName: string;
  mode: string | null;
  changeCount: number;
  tiersInvolved: string[];
}

interface PaginatedResponse {
  data: LeagueHistoryEvent[];
  pagination: {
    page: number;
    pageSize: number;
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
  const [mode, setMode] = useState<LeagueHistoryMode | ''>('');
  const [page, setPage] = useState(1);

  // Data state
  const [events, setEvents] = useState<PaginatedResponse | null>(null);
  const [aggregates, setAggregates] = useState<AggregateResult[]>([]);
  const [yoyoCandidates, setYoyoCandidates] = useState<YoYoCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Slide-over state
  const [selectedEntity, setSelectedEntity] = useState<{
    type: string;
    id: number;
    name: string;
    mode: string | null;
  } | null>(null);
  const [entityHistory, setEntityHistory] = useState<LeagueHistoryEntry[]>([]);
  const [slideOverOpen, setSlideOverOpen] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Data Fetching                                                    */
  /* ---------------------------------------------------------------- */

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        startCycle,
        endCycle,
        page,
        perPage: 50,
      };
      if (entityType) params.entityType = entityType;
      if (mode) params.mode = mode;

      const data = await api.get<PaginatedResponse>('/api/admin/league-history', { params });
      setEvents(data);
    } catch (err: unknown) {
      const msg = (err instanceof ApiError && err.message) || 'Failed to load league history';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [startCycle, endCycle, entityType, mode, page]);

  const fetchAggregates = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { startCycle, endCycle };
      if (entityType) params.entityType = entityType;
      if (mode) params.mode = mode;

      const data = await api.get<AggregateResult[]>('/api/admin/league-history/aggregates', { params });
      setAggregates(data);
    } catch {
      // Non-critical — don't block the page
    }
  }, [startCycle, endCycle, entityType, mode]);

  const fetchYoYo = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (mode) params.mode = mode;
      const data = await api.get<YoYoCandidate[]>('/api/admin/league-history/yo-yo', { params });
      setYoyoCandidates(data);
    } catch {
      // Non-critical
    }
  }, [mode]);

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
      mode: row.mode,
    });
    setEntityHistory([]); // Clear stale data immediately
    setSlideOverOpen(true);

    if (!row.mode) return;

    try {
      const data = await api.get<{ data: LeagueHistoryEvent[] }>(
        `/api/admin/league-history/entity/${row.entityType}/${row.entityId}`,
        { params: { mode: row.mode } },
      );
      setEntityHistory(
        data.data.map((record) => ({
          cycleNumber: record.cycleNumber,
          destinationTier: record.destinationTier,
          changeType: record.changeType as 'promotion' | 'demotion',
          leaguePoints: record.leaguePoints,
          mode: record.mode,
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
            <option value="team_battle">Team Battles</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-secondary mb-1">Mode</label>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as LeagueHistoryMode | '')}
            className="bg-surface text-white text-sm rounded px-3 py-1.5 border border-white/10"
            data-testid="mode-select"
          >
            <option value="">All modes</option>
            {Object.entries(MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
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

      {/* Per-Mode / Per-Tier Breakdown */}
      {aggregates.length > 0 && (
        <div data-testid="tier-breakdown">
          <h3 className="text-sm font-semibold text-secondary mb-3">Per-Mode / Per-Tier Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {aggregates.map((aggregate) => (
              <div
                key={`${aggregate.mode ?? 'legacy'}:${aggregate.tier}`}
                className="bg-surface-elevated rounded-lg p-3 text-center"
              >
                <div className="text-xs text-secondary mb-1">{formatMode(aggregate.mode)}</div>
                <div className="text-sm font-semibold text-white capitalize mb-2">{aggregate.tier}</div>
                <div className="flex justify-center gap-3 text-xs">
                  <span className="text-green-400">↑{aggregate.promotions}</span>
                  <span className="text-red-400">↓{aggregate.demotions}</span>
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
              label: 'Name',
              render: (row) => row.entityName || `${row.entityType} #${row.entityId}`,
            },
            {
              key: 'stableName',
              label: 'Stable',
              render: (row) => row.stableName ?? <span className="text-secondary">—</span>,
            },
            {
              key: 'entityType',
              label: 'Type',
              render: (row) => (
                <span className="capitalize">{row.entityType.replace('_', ' ')}</span>
              ),
            },
            {
              key: 'mode',
              label: 'Mode',
              render: (row) => formatMode(row.mode),
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
                key={`${candidate.entityType}-${candidate.entityId}-${candidate.mode ?? 'legacy'}`}
                className="bg-surface-elevated rounded-lg p-4 border border-warning/20"
              >
                <div className="font-semibold text-white mb-1">{candidate.entityName}</div>
                <div className="text-xs text-secondary capitalize mb-1">
                  {candidate.entityType.replace('_', ' ')} · {formatMode(candidate.mode)}
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
        title={selectedEntity
          ? `${selectedEntity.name} — ${formatMode(selectedEntity.mode)} Timeline`
          : 'League Timeline'}
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
