import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../utils/api';
import { ApiError } from '../../utils/ApiError';
import type { StableData } from './types';

export type StablePageState = 'loading' | 'success' | 'not-found' | 'error';

interface StableProfile {
  state: StablePageState;
  data: StableData | null;
  /** Refetch; `silent` keeps the current page on screen while it loads. */
  reload: (silent?: boolean) => Promise<void>;
}

/** Loads `/api/stables/:userId`; a stale response (the user navigated on) is ignored. */
export function useStableProfile(userId: string | undefined): StableProfile {
  const [state, setState] = useState<StablePageState>('loading');
  const [data, setData] = useState<StableData | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async (silent = false): Promise<void> => {
    const id = ++requestId.current;
    if (!silent) {
      setState('loading');
      setData(null);
    }
    try {
      const result = await api.get<StableData>(`/api/stables/${userId}`);
      if (id !== requestId.current) return;
      setData(result);
      setState('success');
    } catch (err: unknown) {
      // A failed background refresh keeps the page that is already showing.
      if (id !== requestId.current || silent) return;
      setState(err instanceof ApiError && err.statusCode === 404 ? 'not-found' : 'error');
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, data, reload };
}
