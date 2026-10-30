/**
 * Data hook of the admin Tournaments page. One request per load or Refresh;
 * a new request aborts the previous one and the last good data stays on screen.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import { getTournamentOverview, type TournamentOverview } from '../utils/adminTournamentsApi';

export interface TournamentOverviewState {
  data: TournamentOverview | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useTournamentOverview(): TournamentOverviewState {
  const [data, setData] = useState<TournamentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getTournamentOverview(controller.signal)
      .then((overview) => {
        if (controller.signal.aborted) return;
        setData(overview);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.message) || 'Could not load tournaments.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [token]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  return { data, loading, error, reload };
}
