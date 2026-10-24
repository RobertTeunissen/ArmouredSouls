/**
 * Data hook of Season Control (`/admin/seasons`).
 *
 * - State (timeline, config, active rollover): polled every 5 s while a
 *   rollover is queued or running, every 60 s otherwise.
 * - History: fetched on load, on Refresh and when a rollover ends.
 * - Preview: loaded on demand (it counts every purged table).
 * - `finished` is set when a rollover the page watched ends, so the page can
 *   announce the outcome; `now` ticks every second while one runs.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import {
  extendSeason,
  getAdminSeasonState,
  getRolloverPreview,
  getSeasonRolloverHistory,
  setPreparationCycles,
  startRollover,
  type AdminSeasonState,
  type RolloverPreview,
  type SeasonRolloverHistory,
} from '../utils/seasonApi';
import type { Section, StartResult } from './useCycleControls';

export const ACTIVE_POLL_MS = 5_000;
export const IDLE_POLL_MS = 60_000;

export interface SeasonControlData {
  state: Section<AdminSeasonState>;
  history: Section<SeasonRolloverHistory>;
  preview: Section<RolloverPreview>;
  now: Date;
  /** When the state was last fetched. */
  updatedAt: Date | null;
  /** Set once a rollover this page watched has ended; cleared by `clearFinished`. */
  finished: boolean;
  clearFinished: () => void;
  refresh: () => void;
  loadPreview: () => void;
  startRollover: (seasonNumber: number) => Promise<StartResult>;
  extend: (cycles: number) => Promise<StartResult>;
  setPreparation: (remaining: number) => Promise<StartResult>;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return 'You are not authorized to manage seasons.';
    if (error.message) return error.message;
  }
  return fallback;
}

export function useSeasonControl(): SeasonControlData {
  const [state, setState] = useState<Section<AdminSeasonState>>({ data: null, loading: true, error: null });
  const [history, setHistory] = useState<Section<SeasonRolloverHistory>>({ data: null, loading: true, error: null });
  const [preview, setPreview] = useState<Section<RolloverPreview>>({ data: null, loading: false, error: null });
  const [stateToken, setStateToken] = useState(0);
  const [historyToken, setHistoryToken] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [finished, setFinished] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const wasActive = useRef(false);
  const previewController = useRef<AbortController | null>(null);

  const active = Boolean(state.data?.activeRollover);

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true }));
    getAdminSeasonState(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setState({ data, loading: false, error: null });
        const fetchedAt = new Date();
        setNow(fetchedAt);
        setUpdatedAt(fetchedAt);
        const isActive = data.activeRollover !== null;
        if (wasActive.current && !isActive) {
          // The rollover ended: its outcome is in the history, and the preview is stale.
          setFinished(true);
          setHistoryToken((value) => value + 1);
          setPreview({ data: null, loading: false, error: null });
        }
        wasActive.current = isActive;
      },
      (error: unknown) => {
        if (isAbortError(error, controller.signal)) return;
        setState((previous) => ({ ...previous, loading: false, error: errorMessage(error, 'Could not load the season state.') }));
      },
    );
    return () => controller.abort();
  }, [stateToken]);

  useEffect(() => {
    if (state.loading) return undefined;
    const timer = setTimeout(() => setStateToken((value) => value + 1), active ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    return () => clearTimeout(timer);
  }, [state.loading, active]);

  useEffect(() => {
    if (!active) return undefined;
    const ticker = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(ticker);
  }, [active]);

  useEffect(() => {
    const controller = new AbortController();
    setHistory((previous) => ({ ...previous, loading: true, error: null }));
    getSeasonRolloverHistory(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setHistory({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (isAbortError(error, controller.signal)) return;
        setHistory((previous) => ({ ...previous, loading: false, error: errorMessage(error, 'Could not load the rollover history.') }));
      },
    );
    return () => controller.abort();
  }, [historyToken]);

  useEffect(() => () => previewController.current?.abort(), []);

  const refresh = useCallback(() => {
    setStateToken((value) => value + 1);
    setHistoryToken((value) => value + 1);
  }, []);

  const loadPreview = useCallback(() => {
    previewController.current?.abort();
    const controller = new AbortController();
    previewController.current = controller;
    setPreview((previous) => ({ ...previous, loading: true, error: null }));
    getRolloverPreview(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setPreview({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (isAbortError(error, controller.signal)) return;
        setPreview((previous) => ({ ...previous, loading: false, error: errorMessage(error, 'Could not load the rollover preview.') }));
      },
    );
  }, []);

  const start = useCallback(async (seasonNumber: number): Promise<StartResult> => {
    try {
      await startRollover(seasonNumber);
      // Watch it from the first poll on, even if it finishes before that poll.
      wasActive.current = true;
      setStateToken((value) => value + 1);
      return { ok: true, message: null };
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) setStateToken((value) => value + 1);
      return { ok: false, message: errorMessage(error, 'The rollover could not be started.') };
    }
  }, []);

  const extend = useCallback(async (cycles: number): Promise<StartResult> => {
    try {
      await extendSeason(cycles);
      setStateToken((value) => value + 1);
      return { ok: true, message: null };
    } catch (error) {
      return { ok: false, message: errorMessage(error, 'The season could not be extended.') };
    }
  }, []);

  const setPreparation = useCallback(async (remaining: number): Promise<StartResult> => {
    try {
      await setPreparationCycles(remaining);
      setStateToken((value) => value + 1);
      return { ok: true, message: null };
    } catch (error) {
      return { ok: false, message: errorMessage(error, 'The preparation cycles could not be set.') };
    }
  }, []);

  const clearFinished = useCallback(() => setFinished(false), []);

  return { state, history, preview, now, updatedAt, finished, clearFinished, refresh, loadPreview, startRollover: start, extend, setPreparation };
}
