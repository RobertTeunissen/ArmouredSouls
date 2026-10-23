/**
 * Data hook of Cycle Controls (`/admin/cycles`).
 *
 * - Overview (status strip, schedule, missed runs): polled every 10 s while a
 *   job is queued or running, every 60 s otherwise.
 * - History: refetched when its filters change, when a run starts or finishes
 *   (the set of active run ids changes) and on Refresh. A newer request aborts
 *   the older one, so a slow response never overwrites the current filters.
 * - `startRun` / `startBulk` start work in the background and refresh both.
 * - `now` ticks every second while a job runs, for the elapsed time.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import {
  getSchedulerHistory,
  getSchedulerOverview,
  startBulkCycles,
  startSchedulerRun,
  type BulkCycleOptions,
  type SchedulerHistoryPage,
  type SchedulerHistoryQuery,
  type SchedulerJobName,
  type SchedulerOverview,
} from '../utils/adminCycleApi';

export const BUSY_POLL_MS = 10_000;
export const IDLE_POLL_MS = 60_000;
export const HISTORY_PAGE_SIZE = 25;

export interface Section<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface StartResult {
  ok: boolean;
  /** Why it did not start (shown next to the button / in the dialog). */
  message: string | null;
}

export interface CycleControlsData {
  overview: Section<SchedulerOverview>;
  history: Section<SchedulerHistoryPage>;
  historyQuery: SchedulerHistoryQuery;
  setHistoryQuery: (patch: Partial<SchedulerHistoryQuery>) => void;
  /** Client time, ticking every second while a job runs. */
  now: Date;
  refresh: () => void;
  startRun: (jobName: SchedulerJobName) => Promise<StartResult>;
  startBulk: (options: BulkCycleOptions) => Promise<StartResult>;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 409) return error.message || 'That job is already queued or running.';
    if (error.statusCode === 401 || error.statusCode === 403) return 'You are not authorized to run scheduler jobs.';
    if (error.message) return error.message;
  }
  return fallback;
}

function activeKey(overview: SchedulerOverview | null): string {
  if (!overview) return '';
  return [overview.running, ...overview.queue].filter((run) => run !== null).map((run) => run!.id).join(',');
}

export function useCycleControls(): CycleControlsData {
  const [overview, setOverview] = useState<Section<SchedulerOverview>>({ data: null, loading: true, error: null });
  const [history, setHistory] = useState<Section<SchedulerHistoryPage>>({ data: null, loading: true, error: null });
  const [historyQuery, setHistoryQueryState] = useState<SchedulerHistoryQuery>({ problemsOnly: false, days: 7, page: 1, limit: HISTORY_PAGE_SIZE });
  const [overviewToken, setOverviewToken] = useState(0);
  const [historyToken, setHistoryToken] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const lastActiveKey = useRef<string | null>(null);

  const busy = Boolean(overview.data && (overview.data.running || overview.data.queue.length > 0));

  // Overview: fetch, then schedule the next poll at the busy or idle cadence.
  useEffect(() => {
    const controller = new AbortController();
    setOverview((previous) => ({ ...previous, loading: true }));
    getSchedulerOverview(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setOverview({ data, loading: false, error: null });
        setNow(new Date());
        const key = activeKey(data);
        if (lastActiveKey.current !== null && lastActiveKey.current !== key) setHistoryToken((value) => value + 1);
        lastActiveKey.current = key;
      },
      (error: unknown) => {
        if (isAbortError(error, controller.signal)) return;
        setOverview((previous) => ({ ...previous, loading: false, error: errorMessage(error, 'Could not load the scheduler status.') }));
      },
    );
    return () => controller.abort();
  }, [overviewToken]);

  useEffect(() => {
    if (overview.loading) return undefined;
    const timer = setTimeout(() => setOverviewToken((value) => value + 1), busy ? BUSY_POLL_MS : IDLE_POLL_MS);
    return () => clearTimeout(timer);
  }, [overview.loading, busy]);

  // Elapsed time of a running job.
  useEffect(() => {
    if (!busy) return undefined;
    const ticker = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(ticker);
  }, [busy]);

  // History.
  const queryKey = JSON.stringify(historyQuery);
  useEffect(() => {
    const controller = new AbortController();
    setHistory((previous) => ({ ...previous, loading: true, error: null }));
    getSchedulerHistory(historyQuery, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setHistory({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (isAbortError(error, controller.signal)) return;
        setHistory((previous) => ({ ...previous, loading: false, error: errorMessage(error, 'Could not load the run history.') }));
      },
    );
    return () => controller.abort();
    // `historyQuery` is captured through its serialized key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, historyToken]);

  const setHistoryQuery = useCallback((patch: Partial<SchedulerHistoryQuery>) => {
    setHistoryQueryState((previous) => ({ ...previous, page: 1, ...patch }));
  }, []);

  const refresh = useCallback(() => {
    setOverviewToken((value) => value + 1);
    setHistoryToken((value) => value + 1);
  }, []);

  const startRun = useCallback(async (jobName: SchedulerJobName): Promise<StartResult> => {
    try {
      await startSchedulerRun(jobName);
      refresh();
      return { ok: true, message: null };
    } catch (error) {
      return { ok: false, message: errorMessage(error, 'The run could not be started.') };
    }
  }, [refresh]);

  const startBulk = useCallback(async (options: BulkCycleOptions): Promise<StartResult> => {
    try {
      await startBulkCycles(options);
      refresh();
      return { ok: true, message: null };
    } catch (error) {
      return { ok: false, message: errorMessage(error, 'The bulk run could not be started.') };
    }
  }, [refresh]);

  return { overview, history, historyQuery, setHistoryQuery, now, refresh, startRun, startBulk };
}
