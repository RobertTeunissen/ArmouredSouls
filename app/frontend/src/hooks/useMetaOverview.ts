/**
 * Data hooks of the admin Meta page: the choice distributions
 * (`useMetaOverview`) and the build sections (`useMetaBuilds`).
 *
 * One request per (filter, reload) each. A filter change aborts the previous
 * request and its late response is ignored, and the data is kept with the
 * filter it was loaded for, so data for another filter is never shown. The
 * two load independently, so one slow or failing request does not hold up
 * the other sections.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import { getMetaBuilds, getMetaChoices, type MetaBuilds, type MetaChoices } from '../utils/adminMetaApi';
import type { StableScope } from '../utils/adminStableScope';

export interface FilteredLoad<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** When the current data arrived (ISO), or null. */
  fetchedAt: string | null;
  reload: () => void;
}

export type MetaOverview = FilteredLoad<MetaChoices>;

interface Loaded<T> {
  filter: StableScope;
  value: T;
  fetchedAt: string;
}

function useFilteredLoad<T>(
  filter: StableScope,
  load: (filter: StableScope, signal: AbortSignal) => Promise<T>,
  fallbackError: string,
): FilteredLoad<T> {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    load(filter, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setLoaded({ filter, value, fetchedAt: new Date().toISOString() });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.message) || fallbackError);
        setLoading(false);
      });
    return () => controller.abort();
  }, [filter, token, load, fallbackError]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  const current = loaded && loaded.filter === filter ? loaded : null;

  return { data: current?.value ?? null, loading, error, fetchedAt: current?.fetchedAt ?? null, reload };
}

export function useMetaOverview(filter: StableScope): MetaOverview {
  return useFilteredLoad(filter, getMetaChoices, 'Could not load the meta overview.');
}

export function useMetaBuilds(filter: StableScope): FilteredLoad<MetaBuilds> {
  return useFilteredLoad(filter, getMetaBuilds, 'Could not load tuning, refinements and event entry.');
}
