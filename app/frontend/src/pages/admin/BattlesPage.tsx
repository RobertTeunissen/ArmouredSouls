/**
 * BattlesPage — find any battle across all stables and check it as an admin
 * (`/admin/battles`). Filters and the open battle live in the URL
 * (`?mode=&stable=&outcome=&range=&q=&page=&battle=`), so a view can be linked.
 *
 * Rows open the admin check (participants, payout check against the ledger,
 * combat log with formulas, export); ↗ opens the player battle report.
 * Definitions: docs/guides/ADMIN_PANEL_GUIDE.md §Battles.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BattleSlideOver, BattlesFilters, BattlesPagination, BattlesTable } from '../../components/admin/battles';
import type { BattleFilters } from '../../components/admin/battles';
import { ADMIN_FOCUS_RING, PanelError, PanelSkeleton } from '../../components/admin/shared';
import { useBattleList } from '../../hooks/useAdminBattles';
import { BATTLES_PAGE_SIZE } from '../../utils/adminBattlesApi';
import { DEFAULT_FILTERS, readBattleFilters, scopeParts, writeBattleFilters } from '../../utils/adminBattlesFormat';

function readBattleId(params: URLSearchParams): number | null {
  const value = Number(params.get('battle'));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function AdminBattlesPage(): React.ReactElement {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readBattleFilters(params), [params]);
  const openBattleId = readBattleId(params);
  const list = useBattleList(filters);

  const setFilters = useCallback((next: Partial<BattleFilters>) => {
    setParams((current) => writeBattleFilters(current, { ...readBattleFilters(current), ...next }));
  }, [setParams]);

  const setBattle = useCallback((battleId: number | null) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (battleId === null) next.delete('battle');
      else next.set('battle', String(battleId));
      return next;
    });
  }, [setParams]);

  const data = list.data;
  const refreshing = list.loading && data !== null;

  return (
    <div data-testid="battles-page" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          Every battle this season, across all stables. Select a battle for the admin check; <span aria-hidden="true">↗</span> opens the player report.
        </p>
        <button
          type="button"
          onClick={list.reload}
          disabled={list.loading}
          className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
        >
          <span aria-hidden="true">↻ </span>{refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <BattlesFilters filters={filters} onChange={setFilters} onReset={() => setFilters({ ...DEFAULT_FILTERS })} />

      <div className="flex flex-wrap items-baseline justify-between gap-2" aria-live="polite">
        <p className="text-sm text-secondary">
          {data ? (
            <>
              <span className="font-semibold text-white">{data.pagination.total.toLocaleString('en-US')} battle{data.pagination.total === 1 ? '' : 's'}</span>
              {' · '}{scopeParts(filters).join(' · ')} · Times in UTC
            </>
          ) : list.loading ? 'Loading battles…' : ' '}
        </p>
        <span className="text-xs text-secondary">Newest first</span>
      </div>

      {list.error && (
        <div className="rounded-lg border border-white/10 bg-surface"><PanelError message={list.error} onRetry={list.reload} /></div>
      )}
      {!data && list.loading && (
        <div className="rounded-lg border border-white/10 bg-surface"><PanelSkeleton rows={8} /></div>
      )}
      {data && data.battles.length === 0 && !list.error && (
        <p className="rounded-lg border border-white/10 bg-surface px-5 py-8 text-center text-sm text-secondary">
          No battles match these filters.
        </p>
      )}
      {data && data.battles.length > 0 && (
        <div className={refreshing ? 'opacity-70 transition-opacity motion-reduce:transition-none' : undefined}>
          <BattlesTable battles={data.battles} selectedId={openBattleId} onOpen={setBattle} />
        </div>
      )}
      {data && data.pagination.total > 0 && (
        <BattlesPagination
          page={filters.page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          pageSize={BATTLES_PAGE_SIZE}
          loading={list.loading}
          onPage={(page) => setFilters({ page })}
        />
      )}

      <BattleSlideOver battleId={openBattleId} onClose={() => setBattle(null)} />
    </div>
  );
}

export default AdminBattlesPage;
