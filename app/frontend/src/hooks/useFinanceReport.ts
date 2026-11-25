import { useCallback, useEffect, useRef, useState } from 'react';
import {
  financePeriodKey,
  getFinanceHistory,
  getFinanceOverview,
} from '../utils/financeApi';
import type {
  FinancePeriodSelection,
} from '../utils/financeApi';
import type { FinanceHistoryResponse, FinanceOverviewResponse } from '@shared/types';

export interface FinanceResource<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  refresh: () => void;
}

export interface FinanceResourceOptions<T> {
  enabled: boolean;
  /** A change starts a new request and clears the shown data. */
  key: string;
  /** Load; `fresh` asks the server to bypass its report cache (after Refresh). */
  load: (signal: AbortSignal, fresh: boolean) => Promise<T>;
  errorMessage: string;
  /** Changed by the caller to refresh from outside (e.g. the page's Refresh button). */
  refreshToken?: number;
}

/**
 * One Finance Center read. Every request (key change, retry, refresh) clears
 * the shown data first, so figures for another period never stay on screen;
 * a refresh (local or via `refreshToken`) loads with `fresh = true`.
 */
export function useFinanceResource<T>({
  enabled,
  key,
  load,
  errorMessage,
  refreshToken = 0,
}: FinanceResourceOptions<T>): FinanceResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [localRefreshToken, setLocalRefreshToken] = useState(0);
  const consumedRefreshTokens = useRef({ external: 0, local: 0 });
  const requestGeneration = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return undefined;

    const generation = ++requestGeneration.current;
    const controller = new AbortController();
    const consumed = consumedRefreshTokens.current;
    const fresh = refreshToken > consumed.external || localRefreshToken > consumed.local;
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
        if (fresh) consumedRefreshTokens.current = { external: refreshToken, local: localRefreshToken };
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [enabled, errorMessage, key, localRefreshToken, refreshToken, retryToken]);

  const retry = useCallback((): void => {
    setRetryToken((token) => token + 1);
  }, []);
  const refresh = useCallback((): void => {
    setLocalRefreshToken((token) => token + 1);
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

  const overview = useFinanceResource<FinanceOverviewResponse>({
    enabled: true,
    key: `overview:${periodKey}`,
    load: (signal, fresh) => fresh
      ? getFinanceOverview(period, signal, { fresh: true })
      : getFinanceOverview(period, signal),
    errorMessage: 'Failed to load the finance overview.',
  });

  const history = useFinanceResource<FinanceHistoryResponse>({
    enabled: historyEnabled,
    key: `history:${periodKey}`,
    load: (signal, fresh) => fresh
      ? getFinanceHistory(period, signal, { fresh: true })
      : getFinanceHistory(period, signal),
    errorMessage: 'Failed to load finance history.',
  });

  return { overview, history };
}
