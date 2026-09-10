import type { Prisma } from '../../../../generated/prisma';
import type { ReportPeriodMetadata } from '../../../types';

const mockNormalizeFinanceReportPeriod = jest.fn();
const mockCreateReference = jest.fn((_userId: number, _seasonNumber: number, identity: string) => `FIN-${identity}`);

jest.mock('../financeReportPeriod', () => ({
  normalizeFinanceReportPeriod: (...args: unknown[]) => mockNormalizeFinanceReportPeriod(...args),
}));

jest.mock('../playerSafeSourceReference', () => ({
  createPlayerSafeSourceReference: (...args: [number, number, string]) => mockCreateReference(...args),
}));

import { loadFinanceEvidenceView } from '../financeReportQueryService';

const AS_OF = new Date('2026-04-03T12:00:00.000Z');

function period(): ReportPeriodMetadata {
  return {
    seasonNumber: 5,
    scope: 'custom',
    fromCycle: 1,
    toCycle: 2,
    activeCycle: 3,
    phase: 'competitive',
    containsCurrentCycle: false,
    startsAt: '2026-04-01T00:00:00.000Z',
    endsAt: '2026-04-03T00:00:00.000Z',
    asOf: AS_OF.toISOString(),
    finality: 'completed_historical',
  };
}

describe('loadFinanceEvidenceView limitation cycle scope', () => {
  it('should attach excluded ledger and orphan audit evidence to their actual cycles', async () => {
    mockNormalizeFinanceReportPeriod.mockResolvedValue({ period: period(), limitations: [] });
    const tx = {
      financialLedger: {
        findMany: jest.fn().mockResolvedValue([{
          financialEventId: 'ledger-without-audit',
          cycleNumber: 1,
          userId: 17,
          robotId: null,
          transactionType: 'battle_income',
          amount: 100,
          balanceAfter: 1_100,
          description: 'Excluded ledger',
          metadata: {},
          createdAt: AS_OF,
        }]),
      },
      auditLog: {
        findMany: jest.fn()
          .mockResolvedValueOnce([{
            financialEventId: 'audit-without-ledger',
            cycleNumber: 2,
            sequenceNumber: 1,
            eventTimestamp: AS_OF,
          }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      cycleSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findUnique: jest.fn().mockResolvedValue({ currency: 1_000 }) },
    };

    const view = await loadFinanceEvidenceView(
      tx as unknown as Prisma.TransactionClient,
      17,
      { fromCycle: 1, toCycle: 2 },
      AS_OF,
    );

    expect(view.records).toEqual([]);
    expect(view.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'missing_financial_pair',
        affectedCycleNumber: 1,
        affectedSourceReference: 'FIN-ledger-without-audit',
      }),
      expect.objectContaining({
        code: 'missing_financial_pair',
        affectedCycleNumber: 2,
        affectedSourceReference: 'FIN-audit-without-ledger',
      }),
    ]));
  });
});
