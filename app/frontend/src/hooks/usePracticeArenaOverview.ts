/**
 * Data hook of the admin Practice Arena page: the overview, refetched every
 * 60 s and on Refresh. A newer request aborts the older one.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import { getPracticeArenaOverview, type PracticeArenaOverview } from '../utils/adminPracticeArenaApi';
import type { Section } from './useCycleControls';

export const POLL_MS = 60_000;

export interface PracticeArenaOverviewData {
  overview: Section<PracticeArenaOverview>;
  refresh: () => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return 'You are not authorized to view Practice Arena usage.';
    if (error.message) return error.message;
  }
  return 'Could not load Practice Arena usage.';
}

export function usePracticeArenaOverview(): PracticeArenaOverviewData {
  const [overview, setOverview] = useState<Section<PracticeArenaOverview>>({ data: null, loading: true, error: null });
  const [token, setToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setOverview((previous) => ({ ...previous, loading: true, error: null }));
    getPracticeArenaOverview(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setOverview({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (isAbortError(error, controller.signal)) return;
        setOverview((previous) => ({ ...previous, loading: false, error: errorMessage(error) }));
      },
    );
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (overview.loading) return undefined;
    const timer = setTimeout(() => setToken((value) => value + 1), POLL_MS);
    return () => clearTimeout(timer);
  }, [overview.loading]);

  const refresh = useCallback(() => setToken((value) => value + 1), []);

  return { overview, refresh };
}
