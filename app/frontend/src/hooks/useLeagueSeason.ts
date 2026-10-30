/**
 * Data hook of the League Health "This season" block: one request per mode,
 * stable type and reload. A change aborts the previous request; data is kept
 * with the mode and stable type it was loaded for, so a late response for an
 * older selection is never shown.
 */
import { useEffect, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import {
  getLeagueSeason,
  type LeagueHealthMode,
  type LeagueSeasonOverview,
  type LeagueSeasonStableFilter,
} from '../utils/adminLeagueHealthApi';

export interface LeagueSeasonState {
  data: LeagueSeasonOverview | null;
  loading: boolean;
  error: string | null;
}

interface Loaded {
  key: string;
  season: LeagueSeasonOverview;
}

/** `reloadToken` changes when the page's Refresh is used. */
export function useLeagueSeason(mode: LeagueHealthMode, stable: LeagueSeasonStableFilter, reloadToken: number): LeagueSeasonState {
  const key = `${mode}:${stable}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getLeagueSeason(mode, stable, controller.signal)
      .then((season) => {
        if (controller.signal.aborted) return;
        setLoaded({ key, season });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err, controller.signal)) return;
        setError((err instanceof ApiError && err.message) || 'Could not load this season.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [mode, stable, key, reloadToken]);

  return { data: loaded && loaded.key === key ? loaded.season : null, loading, error };
}
