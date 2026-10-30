/**
 * Data hook of the admin Weapons page. Each request has its own
 * AbortController, so a slow response for an older range or strength can never
 * overwrite a newer one. The first analysis of a window can take several
 * seconds (the backend fits the models, then caches them).
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import { getWeaponAnalysis } from '../utils/adminWeaponsApi';
import type { AnalysisRange, AnalysisStrength, WeaponAnalysisResponse } from '../components/admin/weapons/types';

export interface WeaponAnalysisState {
  data: WeaponAnalysisResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function message(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return 'You are not authorized to view this analysis.';
    if (error.statusCode === 502 || error.statusCode === 504) return 'The analysis took too long to answer. It keeps running on the server; retry in a moment.';
    if (error.message) return error.message;
  }
  return 'Could not load the analysis.';
}

export function useWeaponAnalysis(range: AnalysisRange, strength: AnalysisStrength): WeaponAnalysisState {
  const [state, setState] = useState<Omit<WeaponAnalysisState, 'reload'>>({ data: null, loading: true, error: null });
  const [token, setToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null }));
    getWeaponAnalysis(range, strength, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (isAbortError(error, controller.signal)) return;
        setState((previous) => ({ ...previous, loading: false, error: message(error) }));
      },
    );
    return () => controller.abort();
  }, [range, strength, token]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  return { ...state, reload };
}
