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
import { apiErrorMessage } from '../utils/ApiError';
import { getMetaBuilds, getMetaChoices } from '../utils/adminMetaApi';
import type { StableScope } from '../utils/adminStableScope';
import { useApiQuery } from './useApiQuery';
import type { MetaBuilds, MetaChoices } from '@shared/types';

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
  const query = useApiQuery(
    async (signal): Promise<Loaded<T>> => ({ filter, value: await load(filter, signal), fetchedAt: new Date().toISOString() }),
    [filter, load],
  );
  const current = query.data && query.data.filter === filter ? query.data : null;

  return {
    data: current?.value ?? null,
    loading: query.loading,
    error: apiErrorMessage(query.error, fallbackError),
    fetchedAt: current?.fetchedAt ?? null,
    reload: query.refetch,
  };
}

export function useMetaOverview(filter: StableScope): MetaOverview {
  return useFilteredLoad(filter, getMetaChoices, 'Could not load the meta overview.');
}

export function useMetaBuilds(filter: StableScope): FilteredLoad<MetaBuilds> {
  return useFilteredLoad(filter, getMetaBuilds, 'Could not load tuning, refinements and event entry.');
}
