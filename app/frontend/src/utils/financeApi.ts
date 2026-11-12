import { api } from './api';
import type {
  FinanceHistoryResponse,
  FinanceOverviewResponse,
  FinanceReportEnvelope,
  ReportScope,
  RobotDetailResponse,
  RobotSummaryResponse,
} from '@shared/types';

/**
 * Finance Center requests. The response shapes are wire contracts in
 * `@shared/types` (finance-report.ts); this module adds the request-side
 * period selection and the version-1 envelope check.
 */

export type PresetReportScope = Exclude<ReportScope, 'custom'>;
export type FinancePeriodSelection =
  | { scope: PresetReportScope }
  | { scope: 'custom'; fromCycle: number; toCycle: number };

export interface FinanceRequestOptions {
  fresh?: boolean;
}

export function financePeriodKey(period: FinancePeriodSelection): string {
  return period.scope === 'custom'
    ? `custom:${period.fromCycle}:${period.toCycle}`
    : period.scope;
}

export function buildFinancePeriodParams(period: FinancePeriodSelection): Record<string, number | string> {
  if (period.scope === 'custom') {
    return { fromCycle: period.fromCycle, toCycle: period.toCycle };
  }
  return { scope: period.scope };
}

function assertVersionOne<TData>(response: FinanceReportEnvelope<TData>): FinanceReportEnvelope<TData> {
  if (
    response.version !== 1
    || response.period === undefined
    || response.reconciliation === undefined
    || response.data === undefined
    || !Array.isArray(response.provenance)
    || !Array.isArray(response.limitations)
  ) {
    throw new Error('Unsupported Finance Center response');
  }
  return response;
}

export async function getFinanceOverview(
  period: FinancePeriodSelection,
  signal?: AbortSignal,
  options?: FinanceRequestOptions,
): Promise<FinanceOverviewResponse> {
  const response = await api.get<FinanceOverviewResponse>('/api/finances/report', {
    params: buildFinancePeriodParams(period),
    signal,
    ...(options?.fresh === true ? { headers: { 'Cache-Control': 'no-cache' } } : {}),
  });
  return assertVersionOne(response);
}

export async function getFinanceHistory(
  period: FinancePeriodSelection,
  signal?: AbortSignal,
  options?: FinanceRequestOptions,
): Promise<FinanceHistoryResponse> {
  const response = await api.get<FinanceHistoryResponse>('/api/finances/history', {
    params: buildFinancePeriodParams(period),
    signal,
    ...(options?.fresh === true ? { headers: { 'Cache-Control': 'no-cache' } } : {}),
  });
  return assertVersionOne(response);
}

export async function getRobotFinancialSummaries(
  period: FinancePeriodSelection,
  signal?: AbortSignal,
  options?: FinanceRequestOptions,
): Promise<RobotSummaryResponse> {
  const response = await api.get<RobotSummaryResponse>('/api/finances/robots', {
    params: buildFinancePeriodParams(period),
    signal,
    ...(options?.fresh === true ? { headers: { 'Cache-Control': 'no-cache' } } : {}),
  });
  return assertVersionOne(response);
}

export async function getRobotFinancialEvents(
  robotId: number,
  period: FinancePeriodSelection,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
  options?: FinanceRequestOptions,
): Promise<RobotDetailResponse> {
  const response = await api.get<RobotDetailResponse>(`/api/finances/robots/${robotId}/events`, {
    params: { ...buildFinancePeriodParams(period), page, pageSize },
    signal,
    ...(options?.fresh === true ? { headers: { 'Cache-Control': 'no-cache' } } : {}),
  });
  return assertVersionOne(response);
}
