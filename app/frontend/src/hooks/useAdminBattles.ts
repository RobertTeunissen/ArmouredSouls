/**
 * Data hooks of the admin Battles page. Each request has its own
 * AbortController, so a slow response for old filters (or an old battle) can
 * never overwrite a newer one.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import { getBattleDetail, getBattleList, getBattleLog } from '../utils/adminBattlesApi';
import type { BattleDetail, BattleFilters, BattleListResponse, BattleLogResponse } from '../components/admin/battles/types';

export interface Loadable<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function message(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return 'You are not authorized to view battles.';
    if (error.statusCode === 404) return 'This battle no longer exists.';
    if (error.message) return error.message;
  }
  return fallback;
}

function useLoader<T>(
  load: ((signal: AbortSignal) => Promise<T>) | null,
  deps: readonly unknown[],
  fallback: string,
): Loadable<T> & { reload: () => void } {
  const [state, setState] = useState<Loadable<T>>({ data: null, loading: load !== null, error: null });
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (!load) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null }));
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (isAbortError(error, controller.signal)) return;
        setState((previous) => ({ ...previous, loading: false, error: message(error, fallback) }));
      },
    );
    return () => controller.abort();
    // `load` is rebuilt every render; `deps` says when it actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, token]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  return { ...state, reload };
}

export function useBattleList(filters: BattleFilters): Loadable<BattleListResponse> & { reload: () => void } {
  return useLoader(
    (signal) => getBattleList(filters, signal),
    [filters.mode, filters.stable, filters.outcome, filters.range, filters.q, filters.page],
    'Could not load battles.',
  );
}

export function useBattleDetail(battleId: number | null): Loadable<BattleDetail> & { reload: () => void } {
  return useLoader(
    battleId === null ? null : (signal) => getBattleDetail(battleId, signal),
    [battleId],
    'Could not load this battle.',
  );
}

/** The combat log loads only when asked for (and when the battle still has one). */
export function useBattleLog(battleId: number | null, enabled: boolean): Loadable<BattleLogResponse> & { reload: () => void } {
  return useLoader(
    battleId === null || !enabled ? null : (signal) => getBattleLog(battleId, signal),
    [battleId, enabled],
    'Could not load the combat log.',
  );
}
