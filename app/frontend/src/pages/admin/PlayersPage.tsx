/**
 * PlayersPage — human stables: who plays, who dropped off, who needs help
 * (`/admin/players`).
 *
 * Sections: a search for any stable (player, Automaton or generated), the
 * segment cards (Active / Inactive / Dormant, plus the issue filters Stuck in
 * onboarding and Low balance), and the list of every human stable, filtered,
 * searched, sorted and paged on the client. Any stable opens the detail
 * panel. State lives in the URL (`segment`, `q`, `sort`, `page`, `user`); the
 * old `?tab=at-risk` link opens Low balance.
 * Data: `GET /api/admin/players`, `GET /api/admin/users/:id`.
 *
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Players.
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ADMIN_FOCUS_RING, AdminPageHeader, PanelError, PanelSkeleton } from '../../components/admin/shared';
import { PlayerDetailPanel, PlayerSegmentCards, PlayersTable, StableSearch } from '../../components/admin/players';
import { BattlesPagination } from '../../components/admin/battles/BattlesTable';
import { ApiError } from '../../utils/ApiError';
import { isAbortError } from '../../utils/abort';
import { getPlayersOverview, type PlayersOverview } from '../../utils/adminPlayersApi';
import {
  PLAYERS_PAGE_SIZE,
  SEGMENT_LABELS,
  derivePlayersRows,
  readPlayersView,
  writePlayersView,
  type PlayersViewState,
} from '../../utils/adminPlayersFormat';
import { formatUtcTime } from '../../utils/adminDashboardFormat';

/** Low-balance threshold until the overview arrives (the same as the server's). */
const FALLBACK_LOW_BALANCE = 10_000;

function PlayersPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const view = readPlayersView(params);
  const listSearchId = useId();
  const [data, setData] = useState<PlayersOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const now = useMemo(() => (data ? new Date(data.timestamp) : new Date()), [data]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getPlayersOverview(controller.signal)
      .then((overview) => {
        if (controller.signal.aborted) return;
        setData(overview);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.message) || 'Could not load the players.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [token]);

  const update = useCallback((patch: Partial<PlayersViewState>): void => {
    setParams((current) => writePlayersView(current, patch), { replace: true });
  }, [setParams]);

  const { segment, q, sort } = view;
  const rows = useMemo(() => (data ? derivePlayersRows(data.players, { segment, q, sort }) : []), [data, segment, q, sort]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PLAYERS_PAGE_SIZE));
  const page = Math.min(view.page, totalPages);
  const pageRows = rows.slice((page - 1) * PLAYERS_PAGE_SIZE, page * PLAYERS_PAGE_SIZE);
  const refreshing = loading && data !== null;

  return (
    <div data-testid="players-page" className="space-y-6">
      <AdminPageHeader
        title="Players"
        subtitle="Human stables: who plays, who dropped off, who needs help"
        actions={(
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-xs text-secondary" aria-live="polite">
              {refreshing ? 'Refreshing…' : data ? `Last updated ${formatUtcTime(data.timestamp, true)}` : ''}
            </span>
            <button
              type="button"
              onClick={() => setToken((t) => t + 1)}
              disabled={loading}
              className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
            >
              <span aria-hidden="true">↻ </span>Refresh
            </button>
          </div>
        )}
      />

      <StableSearch onOpen={(userId) => update({ user: userId })} />

      {error && (
        <div className="rounded-lg border border-white/10 bg-surface">
          <PanelError message={error} onRetry={() => setToken((t) => t + 1)} />
        </div>
      )}

      {!data && loading && <div className="rounded-lg border border-white/10 bg-surface"><PanelSkeleton rows={8} /></div>}

      {data && (
        <>
          <PlayerSegmentCards overview={data} segment={view.segment} onSegment={(segment) => update({ segment, page: 1 })} />

          <section aria-labelledby="players-list-heading" className="rounded-lg border border-white/10 bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 id="players-list-heading" className="text-base font-semibold text-white">Human stables</h2>
                <p className="text-xs text-secondary" role="status">
                  {view.segment === 'all' ? 'All' : SEGMENT_LABELS[view.segment]} · {rows.length.toLocaleString('en-US')} of {data.counts.all.toLocaleString('en-US')}
                </p>
              </div>
              <div className="w-full sm:w-64">
                <label htmlFor={listSearchId} className="sr-only">Search this list</label>
                <input
                  id={listSearchId}
                  type="search"
                  value={view.q}
                  maxLength={50}
                  onChange={(e) => update({ q: e.target.value, page: 1 })}
                  placeholder="Search this list"
                  className={`min-h-11 w-full rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white placeholder:text-secondary ${ADMIN_FOCUS_RING}`}
                />
              </div>
            </div>
            {rows.length === 0 ? (
              <div className="flex flex-wrap items-center gap-3 px-5 py-6">
                <p className="text-sm text-secondary">No human stable matches these filters.</p>
                <button type="button" onClick={() => update({ segment: 'all', q: '', page: 1 })} className={`min-h-11 rounded-md bg-surface-elevated px-3 text-sm text-white ${ADMIN_FOCUS_RING}`}>
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <PlayersTable rows={pageRows} sort={view.sort} now={now} onSort={(sort) => update({ sort, page: 1 })} onOpen={(userId) => update({ user: userId })} />
                {rows.length > PLAYERS_PAGE_SIZE && (
                  <div className="border-t border-white/10 px-5 py-3">
                    <BattlesPagination page={page} totalPages={totalPages} total={rows.length} pageSize={PLAYERS_PAGE_SIZE} loading={false} noun="stables" onPage={(next) => update({ page: next })} />
                  </div>
                )}
              </>
            )}
          </section>

          <p className="text-xs text-secondary">
            Battles count each battle once per stable, this season. Low balance is below {data.thresholds.lowBalance.toLocaleString('en-US')} credits, the same threshold as the dashboard&apos;s
            bankruptcy item, which links here. Automatons and generated stables are on their own pages and in the search above.
          </p>
        </>
      )}

      <PlayerDetailPanel
        userId={view.user}
        lowBalanceThreshold={data?.thresholds.lowBalance ?? FALLBACK_LOW_BALANCE}
        onClose={() => update({ user: null })}
      />
    </div>
  );
}

export default PlayersPage;
