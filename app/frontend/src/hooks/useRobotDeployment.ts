import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  financePeriodKey,
  getRobotFinancialEvents,
  getRobotFinancialSummaries,
} from '../utils/financeApi';
import type {
  FinancePeriodSelection,
} from '../utils/financeApi';
import { useFinanceResource, type FinanceResource } from './useFinanceReport';
import type { RobotDetailResponse, RobotSummaryResponse } from '@shared/types';

const DEFAULT_PAGE_SIZE = 20;

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

  const summaries = useFinanceResource<RobotSummaryResponse>({
    enabled,
    key: `robots:${periodKey}`,
    refreshToken,
    load: (signal, fresh) => fresh
      ? getRobotFinancialSummaries(period, signal, { fresh: true })
      : getRobotFinancialSummaries(period, signal),
    errorMessage: 'Failed to load robot deployment results.',
  });

  const detail = useFinanceResource<RobotDetailResponse>({
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
    errorMessage: 'Failed to load robot financial events.',
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
