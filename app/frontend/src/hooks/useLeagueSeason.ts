/**
 * Data hook of the League Health "This season" block: one request per mode,
 * stable type and reload. A change aborts the previous request; data is kept
 * with the mode and stable type it was loaded for, so data for an older
 * selection is never shown.
 */
import { useEffect } from 'react';
import { apiErrorMessage } from '../utils/ApiError';
import type { StableScope } from '../utils/adminStableScope';
import { getLeagueSeason } from '../utils/adminLeagueHealthApi';
import { useApiQuery } from './useApiQuery';
import type { LeagueSeasonOverview, TieredLeagueMode } from '@shared/types';

export interface LeagueSeasonState {
  data: LeagueSeasonOverview | null;
  loading: boolean;
  error: string | null;
}

/** `reloadToken` changes when the page's Refresh is used. */
export function useLeagueSeason(mode: TieredLeagueMode, stable: StableScope, reloadToken: number): LeagueSeasonState {
  const key = `${mode}:${stable}`;
  const query = useApiQuery(
    async (signal) => ({ key, season: await getLeagueSeason(mode, stable, signal) }),
    [mode, stable, key],
  );
  const { refetch } = query;
  // The page's Refresh: reload with the current selection (0 is the first load).
  useEffect(() => {
    if (reloadToken > 0) refetch();
  }, [reloadToken, refetch]);
  return {
    data: query.data && query.data.key === key ? query.data.season : null,
    loading: query.loading,
    error: apiErrorMessage(query.error, 'Could not load this season.'),
  };
}
