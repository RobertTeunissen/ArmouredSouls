/**
 * Data hook of the admin League Health page.
 *
 * One request per load or Refresh. A new request aborts the previous one, and
 * an aborted request's late response is ignored. The last good data stays on
 * screen while a refresh is in flight.
 */
import { useCallback, useState } from 'react';
import { apiErrorMessage } from '../utils/ApiError';
import { getLeagueHealth } from '../utils/adminLeagueHealthApi';
import { useApiQuery } from './useApiQuery';
import type { LeagueHealthOverview } from '@shared/types';

export interface LeagueHealthState {
  data: LeagueHealthOverview | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Increments on every reload, so dependent sections can reload too. */
  reloadToken: number;
}

export function useLeagueHealth(): LeagueHealthState {
  const [reloadToken, setReloadToken] = useState(0);
  const query = useApiQuery((signal) => getLeagueHealth(signal), []);
  const { refetch } = query;
  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
    refetch();
  }, [refetch]);
  return {
    data: query.data,
    loading: query.loading,
    error: apiErrorMessage(query.error, 'Could not load league health.'),
    reload,
    reloadToken,
  };
}
