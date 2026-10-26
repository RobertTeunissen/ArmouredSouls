/**
 * Data hook of the admin Attributes page. Each request has its own
 * AbortController, so a slow response for an older range or toggle set can
 * never overwrite a newer one. The first analysis of a window can take several
 * seconds (the backend fits the models, then caches them).
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import { getAttributeAnalysis } from '../utils/adminAttributesApi';
import { LAYER_KEYS, type AnalysisRange, type AttributeAnalysisResponse, type LayerToggles } from '../components/admin/attributes/types';

export interface AttributeAnalysisState {
  data: AttributeAnalysisResponse | null;
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

export function useAttributeAnalysis(range: AnalysisRange, toggles: LayerToggles): AttributeAnalysisState {
  const [state, setState] = useState<Omit<AttributeAnalysisState, 'reload'>>({ data: null, loading: true, error: null });
  const [token, setToken] = useState(0);
  const togglesKey = LAYER_KEYS.map((key) => (toggles[key] ? '1' : '0')).join('');

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null }));
    getAttributeAnalysis(range, toggles, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (isAbortError(error, controller.signal)) return;
        setState((previous) => ({ ...previous, loading: false, error: message(error) }));
      },
    );
    return () => controller.abort();
    // `toggles` is a new object each render; `togglesKey` says when it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, togglesKey, token]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  return { ...state, reload };
}
