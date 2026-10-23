/**
 * Data hook of the admin dashboard.
 *
 * Three independent sections, each with its own loading and error state, so a
 * failing endpoint never blanks the whole page:
 * - status (global): fetched on mount and on refresh, never on a filter change;
 * - KPIs and battle activity (filtered): fetched on mount, filter change and refresh.
 *
 * A filter change aborts the requests of the previous filter, so a slow
 * response for an old filter can never overwrite the current one.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../utils/ApiError';
import { isAbortError } from '../utils/abort';
import {
  getBattleActivity,
  getDashboardKpis,
  getDashboardStatus,
  type BattleActivity,
  type DashboardKpis,
  type DashboardStatus,
} from '../utils/adminDashboardApi';
import type { UserFilterType } from '../components/admin/shared';

export interface DashboardSection<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface AdminDashboardData {
  status: DashboardSection<DashboardStatus>;
  kpis: DashboardSection<DashboardKpis>;
  activity: DashboardSection<BattleActivity>;
  /** Newest server timestamp of the loaded sections, or null. */
  lastUpdated: string | null;
  refresh: () => void;
}

const EMPTY = { data: null, loading: true, error: null };

function errorMessage(error: unknown, fallback: string): string {
  return (error instanceof ApiError && error.message) || fallback;
}

function newest(...timestamps: Array<string | undefined>): string | null {
  const values = timestamps.filter((value): value is string => typeof value === 'string');
  if (values.length === 0) return null;
  return values.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));
}

export function useAdminDashboard(filter: UserFilterType): AdminDashboardData {
  const [status, setStatus] = useState<DashboardSection<DashboardStatus>>(EMPTY);
  const [kpis, setKpis] = useState<DashboardSection<DashboardKpis>>(EMPTY);
  const [activity, setActivity] = useState<DashboardSection<BattleActivity>>(EMPTY);

  const statusController = useRef<AbortController | null>(null);
  const filteredController = useRef<AbortController | null>(null);

  const loadStatus = useCallback(async (): Promise<void> => {
    statusController.current?.abort();
    const controller = new AbortController();
    statusController.current = controller;
    setStatus((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await getDashboardStatus(controller.signal);
      if (!controller.signal.aborted) setStatus({ data, loading: false, error: null });
    } catch (error) {
      if (isAbortError(error, controller.signal)) return;
      setStatus((prev) => ({ ...prev, loading: false, error: errorMessage(error, 'Could not load the system status.') }));
    }
  }, []);

  const loadFiltered = useCallback(async (current: UserFilterType, fresh: boolean): Promise<void> => {
    filteredController.current?.abort();
    const controller = new AbortController();
    filteredController.current = controller;
    const { signal } = controller;

    setKpis((prev) => ({ ...prev, loading: true, error: null }));
    setActivity((prev) => ({ ...prev, loading: true, error: null }));

    const kpiRequest = getDashboardKpis(current, signal).then(
      (data) => { if (!signal.aborted) setKpis({ data, loading: false, error: null }); },
      (error: unknown) => {
        if (isAbortError(error, signal)) return;
        setKpis((prev) => ({ ...prev, loading: false, error: errorMessage(error, 'Could not load the player and robot figures.') }));
      },
    );
    const activityRequest = getBattleActivity(current, fresh, signal).then(
      (data) => { if (!signal.aborted) setActivity({ data, loading: false, error: null }); },
      (error: unknown) => {
        if (isAbortError(error, signal)) return;
        setActivity((prev) => ({ ...prev, loading: false, error: errorMessage(error, 'Could not load the battle activity.') }));
      },
    );
    await Promise.all([kpiRequest, activityRequest]);
  }, []);

  useEffect(() => {
    void loadStatus();
    return () => statusController.current?.abort();
  }, [loadStatus]);

  useEffect(() => {
    void loadFiltered(filter, false);
    return () => filteredController.current?.abort();
  }, [filter, loadFiltered]);

  const refresh = useCallback((): void => {
    void loadStatus();
    void loadFiltered(filter, true);
  }, [filter, loadFiltered, loadStatus]);

  return {
    status,
    kpis,
    activity,
    lastUpdated: newest(status.data?.timestamp, kpis.data?.timestamp, activity.data?.timestamp),
    refresh,
  };
}
