import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import {
  buildFinancePeriodParams,
  financePeriodKey,
  getFinanceHistory,
  getFinanceOverview,
  getRobotFinancialEvents,
  getRobotFinancialSummaries,
} from '../financeApi';
import {
  HISTORY_RESPONSE,
  OVERVIEW_RESPONSE,
  ROBOT_DETAIL_RESPONSE,
  ROBOT_SUMMARY_RESPONSE,
} from '../../components/finance/__tests__/fixtures';

vi.mock('../api', () => ({
  api: { get: vi.fn() },
}));

const mockedGet = vi.mocked(api.get);

describe('financeApi', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('builds stable request keys and sends custom ranges without a conflicting scope', async () => {
    const period = { scope: 'custom' as const, fromCycle: 4, toCycle: 10 };
    const signal = new AbortController().signal;
    mockedGet.mockResolvedValueOnce(OVERVIEW_RESPONSE);

    expect(financePeriodKey(period)).toBe('custom:4:10');
    expect(buildFinancePeriodParams(period)).toEqual({ fromCycle: 4, toCycle: 10 });
    await expect(getFinanceOverview(period, signal)).resolves.toBe(OVERVIEW_RESPONSE);
    expect(mockedGet).toHaveBeenCalledWith('/api/finances/report', {
      params: { fromCycle: 4, toCycle: 10 },
      signal,
    });
  });

  it('uses the four version-1 report endpoints with the exact preset and page parameters', async () => {
    const period = { scope: 'season_to_date' as const };
    mockedGet
      .mockResolvedValueOnce(HISTORY_RESPONSE)
      .mockResolvedValueOnce(ROBOT_SUMMARY_RESPONSE)
      .mockResolvedValueOnce(ROBOT_DETAIL_RESPONSE);

    await getFinanceHistory(period);
    await getRobotFinancialSummaries(period);
    await getRobotFinancialEvents(7, period, 2, 20);

    expect(mockedGet).toHaveBeenNthCalledWith(1, '/api/finances/history', {
      params: { scope: 'season_to_date' },
      signal: undefined,
    });
    expect(mockedGet).toHaveBeenNthCalledWith(2, '/api/finances/robots', {
      params: { scope: 'season_to_date' },
      signal: undefined,
    });
    expect(mockedGet).toHaveBeenNthCalledWith(3, '/api/finances/robots/7/events', {
      params: { scope: 'season_to_date', page: 2, pageSize: 20 },
      signal: undefined,
    });
  });

  it('adds no-cache only when a caller explicitly requests fresh Finance resources', async () => {
    const period = { scope: 'current' as const };
    const signal = new AbortController().signal;
    mockedGet
      .mockResolvedValueOnce(OVERVIEW_RESPONSE)
      .mockResolvedValueOnce(HISTORY_RESPONSE)
      .mockResolvedValueOnce(ROBOT_SUMMARY_RESPONSE)
      .mockResolvedValueOnce(ROBOT_DETAIL_RESPONSE);

    await getFinanceOverview(period, signal, { fresh: true });
    await getFinanceHistory(period, signal, { fresh: true });
    await getRobotFinancialSummaries(period, signal, { fresh: true });
    await getRobotFinancialEvents(7, period, 1, 20, signal, { fresh: true });

    expect(mockedGet).toHaveBeenNthCalledWith(1, '/api/finances/report', {
      params: { scope: 'current' },
      signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    expect(mockedGet).toHaveBeenNthCalledWith(2, '/api/finances/history', {
      params: { scope: 'current' },
      signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    expect(mockedGet).toHaveBeenNthCalledWith(3, '/api/finances/robots', {
      params: { scope: 'current' },
      signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    expect(mockedGet).toHaveBeenNthCalledWith(4, '/api/finances/robots/7/events', {
      params: { scope: 'current', page: 1, pageSize: 20 },
      signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
  });

  it('rejects unsupported or incomplete envelopes instead of rendering ambiguous data', async () => {
    mockedGet.mockResolvedValueOnce({ ...OVERVIEW_RESPONSE, version: 2 });
    await expect(getFinanceOverview({ scope: 'current' })).rejects.toThrow('Unsupported Finance Center response');

    mockedGet.mockResolvedValueOnce({ ...OVERVIEW_RESPONSE, provenance: undefined });
    await expect(getFinanceOverview({ scope: 'current' })).rejects.toThrow('Unsupported Finance Center response');
  });
});
