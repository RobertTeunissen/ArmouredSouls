/**
 * Data hook of the admin System page: the overview, refetched every 60 s and
 * on Refresh. A newer request aborts the older one.
 */
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import { getSystemOverview, type SystemOverview } from '../utils/adminSystemApi';
import type { Section } from './useCycleControls';

export const SYSTEM_POLL_MS = 60_000;

export interface SystemOverviewData {
  overview: Section<SystemOverview>;
  refresh: () => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return 'You are not authorized to view the system status.';
    if (error.message) return error.message;
  }
  return 'Could not load the system status.';
}

export function useSystemOverview(): SystemOverviewData {
  const [overview, setOverview] = useState<Section<SystemOverview>>({ data: null, loading: true, error: null });
  const [token, setToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setOverview((previous) => ({ ...previous, loading: true, error: null }));
    getSystemOverview(controller.signal).then(
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
    const timer = setTimeout(() => setToken((value) => value + 1), SYSTEM_POLL_MS);
    return () => clearTimeout(timer);
  }, [overview.loading]);

  const refresh = useCallback(() => setToken((value) => value + 1), []);

  return { overview, refresh };
}
