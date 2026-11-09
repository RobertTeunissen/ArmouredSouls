/**
 * Shared loader for one API read: runs `load` when the hook mounts and again
 * whenever a value in `deps` changes or `refetch()` is called.
 *
 * - A newer request aborts the older one, so a slow earlier response can never
 *   overwrite the result of a later filter or page change.
 * - Cancellation (unmount, newer request) is never reported as an error.
 * - The previous `data` stays available while a refetch is in flight; `loading`
 *   tells the screen a request is pending.
 * - 401 handling (end the session, go to /login) already lives in the API
 *   client; callers only turn `error` into their own message.
 *
 * ESLint's `react-hooks/exhaustive-deps` checks `deps` against `load` for this
 * hook (see `additionalHooks` in eslint.config.js), exactly as for `useEffect`.
 */
import { useCallback, useEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react';
import { isAbortError } from '../utils/abort';

export interface ApiQueryOptions {
  /** When false the request is not sent (e.g. no robot selected yet). Defaults to true. */
  enabled?: boolean;
}

export interface ApiQuery<T> {
  /** Last successful result, or null before the first one arrives. */
  data: T | null;
  /** True while a request is pending. */
  loading: boolean;
  /** The last request's failure, or null. Cleared when a new request starts. */
  error: unknown;
  /** Send the request again with the current inputs. */
  refetch: () => void;
  /** Replace the cached result locally, e.g. after a mutation answered with fresh data. */
  setData: Dispatch<SetStateAction<T | null>>;
}

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
}

export function useApiQuery<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  options: ApiQueryOptions = {},
): ApiQuery<T> {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<QueryState<T>>({ data: null, loading: enabled, error: null });
  const [reloadToken, setReloadToken] = useState(0);

  // Keep the latest `load` without asking callers for a useCallback. Effects
  // run in declaration order, so the request effect below always calls the
  // `load` of the render whose `deps` change triggered it.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled) {
      setState((previous) => (previous.loading ? { ...previous, loading: false } : previous));
      return undefined;
    }
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null }));
    loadRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error, controller.signal)) return;
        setState((previous) => ({ ...previous, loading: false, error }));
      },
    );
    return () => controller.abort();
    // `deps` is the caller's dependency list, checked at the call site by
    // react-hooks/exhaustive-deps through `additionalHooks`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reloadToken, ...deps]);

  const refetch = useCallback(() => setReloadToken((value) => value + 1), []);
  const setData = useCallback<Dispatch<SetStateAction<T | null>>>((next) => {
    setState((previous) => ({
      ...previous,
      data: typeof next === 'function' ? (next as (value: T | null) => T | null)(previous.data) : next,
    }));
  }, []);

  return { data: state.data, loading: state.loading, error: state.error, refetch, setData };
}
