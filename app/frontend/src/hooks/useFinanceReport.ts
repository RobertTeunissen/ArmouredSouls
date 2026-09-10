import { useCallback, useEffect, useRef, useState } from 'react';
import {
  financePeriodKey,
  getFinanceHistory,
  getFinanceOverview,
} from '../utils/financeApi';
import type {
  FinanceHistoryResponse,
  FinanceOverviewResponse,
  FinancePeriodSelection,
} from '../utils/financeApi';

export interface FinanceResource<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  refresh: () => void;
}

interface AsyncResourceOptions<T> {
  enabled: boolean;
  key: string;
  load: (signal: AbortSignal, fresh: boolean) => Promise<T>;
  errorMessage: string;
}

function useAsyncFinanceResource<T>({
  enabled,
  key,
  load,
  errorMessage,
}: AsyncResourceOptions<T>): FinanceResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);
  const consumedRefreshToken = useRef(0);
  const requestGeneration = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return undefined;

    const generation = ++requestGeneration.current;
    const controller = new AbortController();
    const fresh = refreshToken > consumedRefreshToken.current;
    setData(null);
    setIsLoading(true);
    setError(null);

    void loadRef.current(controller.signal, fresh)
      .then((response) => {
        if (controller.signal.aborted || requestGeneration.current !== generation) return;
        setData(response);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted || requestGeneration.current !== generation) return;
        setError(caught instanceof Error && caught.message ? caught.message : errorMessage);
      })
      .finally(() => {
        if (controller.signal.aborted || requestGeneration.current !== generation) return;
        if (fresh) consumedRefreshToken.current = refreshToken;
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [enabled, errorMessage, key, refreshToken, retryToken]);

  const retry = useCallback((): void => {
    setRetryToken((token) => token + 1);
  }, []);
  const refresh = useCallback((): void => {
    setRefreshToken((token) => token + 1);
  }, []);

  return { data, isLoading, error, retry, refresh };
}

export interface UseFinanceReportResult {
  overview: FinanceResource<FinanceOverviewResponse>;
  history: FinanceResource<FinanceHistoryResponse>;
}

export function useFinanceReport(
  period: FinancePeriodSelection,
  historyEnabled: boolean,
): UseFinanceReportResult {
  const periodKey = financePeriodKey(period);

  const overview = useAsyncFinanceResource<FinanceOverviewResponse>({
    enabled: true,
    key: `overview:${periodKey}`,
    load: (signal, fresh) => fresh
      ? getFinanceOverview(period, signal, { fresh: true })
      : getFinanceOverview(period, signal),
    errorMessage: 'Failed to load the finance overview.',
  });

  const history = useAsyncFinanceResource<FinanceHistoryResponse>({
    enabled: historyEnabled,
    key: `history:${periodKey}`,
    load: (signal, fresh) => fresh
      ? getFinanceHistory(period, signal, { fresh: true })
      : getFinanceHistory(period, signal),
    errorMessage: 'Failed to load finance history.',
  });

  return { overview, history };
}
