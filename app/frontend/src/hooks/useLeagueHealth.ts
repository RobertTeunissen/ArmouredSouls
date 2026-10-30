/**
 * Data hook of the admin League Health page.
 *
 * One request per load or Refresh. A new request aborts the previous one, and
 * an aborted request's late response is ignored. The last good data stays on
 * screen while a refresh is in flight.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import { getLeagueHealth, type LeagueHealthOverview } from '../utils/adminLeagueHealthApi';

export interface LeagueHealthState {
  data: LeagueHealthOverview | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Increments on every reload, so dependent sections can reload too. */
  reloadToken: number;
}

export function useLeagueHealth(): LeagueHealthState {
  const [data, setData] = useState<LeagueHealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getLeagueHealth(controller.signal)
      .then((overview) => {
        if (controller.signal.aborted) return;
        setData(overview);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.message) || 'Could not load league health.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [token]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  return { data, loading, error, reload, reloadToken: token };
}
