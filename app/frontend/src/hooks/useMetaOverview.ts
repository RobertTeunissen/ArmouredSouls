/**
 * Data hook of the admin Meta page.
 *
 * One request per (filter, reload). A filter change aborts the previous
 * request and its late response is ignored, and the data is kept with the
 * filter it was loaded for, so data for another filter is never shown.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import { getMetaStats } from '../utils/adminMetaApi';
import type { UserFilterType } from '../components/admin/shared';
import type { SystemStats } from '../components/admin/types';

export interface MetaOverview {
  data: SystemStats | null;
  loading: boolean;
  error: string | null;
  /** When the current data arrived (ISO), or null. */
  fetchedAt: string | null;
  reload: () => void;
}

interface Loaded {
  filter: UserFilterType;
  stats: SystemStats;
  fetchedAt: string;
}

export function useMetaOverview(filter: UserFilterType): MetaOverview {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getMetaStats(filter, controller.signal)
      .then((stats) => {
        if (controller.signal.aborted) return;
        setLoaded({ filter, stats, fetchedAt: new Date().toISOString() });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.message) || 'Could not load the meta overview.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [filter, token]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  const current = loaded && loaded.filter === filter ? loaded : null;

  return { data: current?.stats ?? null, loading, error, fetchedAt: current?.fetchedAt ?? null, reload };
}
