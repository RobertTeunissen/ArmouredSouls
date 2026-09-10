import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  financePeriodKey,
  getRobotFinancialEvents,
  getRobotFinancialSummaries,
} from '../utils/financeApi';
import type {
  FinancePeriodSelection,
  RobotDetailResponse,
  RobotSummaryResponse,
} from '../utils/financeApi';
import type { FinanceResource } from './useFinanceReport';

const DEFAULT_PAGE_SIZE = 20;

interface RobotResourceOptions<T> {
  enabled: boolean;
  key: string;
  refreshToken: number;
  load: (signal: AbortSignal, fresh: boolean) => Promise<T>;
  fallbackMessage: string;
}

function useRobotResource<T>({
  enabled,
  key,
  refreshToken,
  load,
  fallbackMessage,
}: RobotResourceOptions<T>): FinanceResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [localRefreshToken, setLocalRefreshToken] = useState(0);
  const consumedExternalRefreshToken = useRef(0);
  const consumedLocalRefreshToken = useRef(0);
  const generationRef = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return undefined;

    const generation = ++generationRef.current;
    const controller = new AbortController();
    const fresh = refreshToken > consumedExternalRefreshToken.current
      || localRefreshToken > consumedLocalRefreshToken.current;
    setData(null);
    setIsLoading(true);
    setError(null);

    void loadRef.current(controller.signal, fresh)
      .then((response) => {
        if (controller.signal.aborted || generationRef.current !== generation) return;
        setData(response);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted || generationRef.current !== generation) return;
        setError(caught instanceof Error && caught.message ? caught.message : fallbackMessage);
      })
      .finally(() => {
        if (controller.signal.aborted || generationRef.current !== generation) return;
        if (fresh) {
          consumedExternalRefreshToken.current = refreshToken;
          consumedLocalRefreshToken.current = localRefreshToken;
        }
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [enabled, fallbackMessage, key, localRefreshToken, refreshToken, retryToken]);

  const retry = useCallback((): void => setRetryToken((token) => token + 1), []);
  const refresh = useCallback((): void => setLocalRefreshToken((token) => token + 1), []);
  return { data, isLoading, error, retry, refresh };
}

export interface UseRobotDeploymentResult {
  summaries: FinanceResource<RobotSummaryResponse>;
  detail: FinanceResource<RobotDetailResponse>;
  selectedRobotId: number | null;
  page: number;
  pageSize: number;
  selectRobot: (robotId: number) => void;
  closeDetail: () => void;
  setPage: (page: number) => void;
}

export function useRobotDeployment(
  period: FinancePeriodSelection,
  enabled: boolean,
  refreshToken = 0,
): UseRobotDeploymentResult {
  const periodKey = financePeriodKey(period);
  const [selectedRobotId, setSelectedRobotId] = useState<number | null>(null);
  const [page, setPageState] = useState(1);

  useEffect(() => {
    setSelectedRobotId(null);
    setPageState(1);
  }, [periodKey]);

  const summaries = useRobotResource<RobotSummaryResponse>({
    enabled,
    key: `robots:${periodKey}`,
    refreshToken,
    load: (signal, fresh) => fresh
      ? getRobotFinancialSummaries(period, signal, { fresh: true })
      : getRobotFinancialSummaries(period, signal),
    fallbackMessage: 'Failed to load robot deployment results.',
  });

  const detail = useRobotResource<RobotDetailResponse>({
    enabled: enabled && selectedRobotId !== null,
    key: `robot-detail:${periodKey}:${selectedRobotId ?? 'none'}:${page}:${DEFAULT_PAGE_SIZE}`,
    refreshToken,
    load: (signal, fresh) => {
      if (selectedRobotId === null) throw new Error('Select a robot to load detail.');
      return fresh
        ? getRobotFinancialEvents(
          selectedRobotId,
          period,
          page,
          DEFAULT_PAGE_SIZE,
          signal,
          { fresh: true },
        )
        : getRobotFinancialEvents(selectedRobotId, period, page, DEFAULT_PAGE_SIZE, signal);
    },
    fallbackMessage: 'Failed to load robot financial events.',
  });

  const selectRobot = useCallback((robotId: number): void => {
    setSelectedRobotId((current) => current === robotId ? null : robotId);
    setPageState(1);
  }, []);

  const closeDetail = useCallback((): void => {
    setSelectedRobotId(null);
    setPageState(1);
  }, []);

  const setPage = useCallback((nextPage: number): void => {
    setPageState(Math.max(1, nextPage));
  }, []);

  return useMemo(() => ({
    summaries,
    detail,
    selectedRobotId,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    selectRobot,
    closeDetail,
    setPage,
  }), [closeDetail, detail, page, selectRobot, selectedRobotId, setPage, summaries]);
}
