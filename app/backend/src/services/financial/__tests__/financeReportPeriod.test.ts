import type { Prisma } from '../../../../generated/prisma';
import { FinancialErrorCode } from '../../../errors';

const mockResolveCanonicalCycleIdentity = jest.fn();

jest.mock('../../cycle/canonicalCycleIdentity', () => ({
  resolveCanonicalCycleIdentity: (...args: unknown[]) => mockResolveCanonicalCycleIdentity(...args),
}));

import { normalizeFinanceReportPeriod } from '../financeReportPeriod';

function identity(completedCycles: number) {
  return {
    completedCycles,
    activeCycle: completedCycles + 1,
    seasonNumber: 3,
    phase: 'competitive' as const,
    competitiveCyclesCompleted: completedCycles,
    preparationCyclesCompleted: 0,
    seasonStartedAt: new Date('2026-05-01T00:00:00.000Z'),
    isClosing: false,
    closingCycle: null,
  };
}

const tx = {
  auditLog: { findFirst: jest.fn() },
} as unknown as Prisma.TransactionClient;

const AS_OF = new Date('2026-05-05T12:00:00.000Z');

describe('normalizeFinanceReportPeriod unavailable ranges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject a well-formed future range as a typed financial 400', async () => {
    mockResolveCanonicalCycleIdentity.mockResolvedValue(identity(3));

    await expect(normalizeFinanceReportPeriod(
      tx,
      { fromCycle: 4, toCycle: 4 },
      AS_OF,
    )).rejects.toMatchObject({
      code: FinancialErrorCode.INVALID_REPORT_PERIOD,
      statusCode: 400,
      message: 'Completed cycle range must be between 1 and 3',
    });
    expect(tx.auditLog.findFirst).not.toHaveBeenCalled();
  });

  it('should return an actionable typed error when no completed cycle exists', async () => {
    mockResolveCanonicalCycleIdentity.mockResolvedValue(identity(0));

    await expect(normalizeFinanceReportPeriod(
      tx,
      { fromCycle: 1, toCycle: 1 },
      AS_OF,
    )).rejects.toMatchObject({
      code: FinancialErrorCode.INVALID_REPORT_PERIOD,
      statusCode: 400,
      message: 'No completed financial cycles are available yet. Use Current cycle, or try again after Cycle 1 closes.',
    });
  });
});
