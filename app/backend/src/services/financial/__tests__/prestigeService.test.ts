import type { Prisma } from '../../../../generated/prisma';
import type { PrestigeAwardBreakdown } from '../../../types';

const mockTx = {
  user: { update: jest.fn() },
  auditLog: { findFirst: jest.fn(), create: jest.fn() },
  $queryRaw: jest.fn(),
};

const mockPrisma = {
  $transaction: jest.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
  financialLedger: { create: jest.fn() },
};

jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../common/auditSequence', () => ({
  withAuditSequence: jest.fn(),
}));

import { withAuditSequence } from '../../common/auditSequence';
import { FinancialErrorCode } from '../../../errors';
import { applyPrestigeAward } from '../prestigeService';

const mockWithAuditSequence = withAuditSequence as jest.MockedFunction<typeof withAuditSequence>;
const transactionClient = mockTx as unknown as Prisma.TransactionClient;

const input = {
  cycleNumber: 8,
  userId: 7,
  amount: 25,
  source: 'battle' as const,
  sourceEventId: 'battle:10:7:league_1v1:prestige',
  mode: 'league_1v1',
  battleId: 10,
  breakdown: {
    schemaVersion: 1 as const,
    formula: 'battle.prestige',
    formulaVersion: '1',
    inputs: [{ name: 'awardAmount', value: 25, unit: 'prestige', source: 'battle' }],
    modifiers: [],
    rounding: { precision: 0, mode: 'none' as const, operationOrder: ['awardAmount'], scope: 'aggregate' as const },
    sourceEventId: 'battle:10:7:league_1v1:prestige',
    source: 'battle' as const,
    awardAmount: 25,
    mode: 'league_1v1',
    battleId: 10,
    achievementId: null,
  } satisfies PrestigeAwardBreakdown,
};

function committedPayload(resultingPrestige = 125): Record<string, unknown> {
  return {
    eventTimestamp: '2026-09-04T12:00:00.000Z',
    cycleNumber: input.cycleNumber,
    userId: input.userId,
    amount: input.amount,
    source: input.source,
    sourceEventId: input.sourceEventId,
    mode: input.mode,
    battleId: input.battleId,
    achievementId: null,
    resultingPrestige,
    breakdown: input.breakdown,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTx.auditLog.findFirst.mockResolvedValue(null);
  mockTx.auditLog.create.mockResolvedValue({ id: 99n });
  mockTx.$queryRaw.mockResolvedValue([{ id: input.userId, prestige: 100 }]);
  mockTx.user.update.mockResolvedValue({ id: input.userId, prestige: 125 });
  mockWithAuditSequence.mockImplementation(async (_cycle, _count, callback, tx) => (
    callback(4, tx ?? transactionClient)
  ));
});

describe('Prestige_Service', () => {
  it('should update stable prestige and write one graphable prestige_change record', async () => {
    const result = await applyPrestigeAward({ ...input, timestamp: new Date('2026-09-04T12:00:00.000Z') });

    expect(result).toMatchObject({
      created: true,
      sourceEventId: input.sourceEventId,
      cycleNumber: input.cycleNumber,
      userId: input.userId,
      amount: input.amount,
      prestigeBefore: 100,
      prestigeAfter: 125,
    });
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: input.userId },
      data: { prestige: 125 },
    });
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cycleNumber: input.cycleNumber,
        eventType: 'prestige_change',
        sequenceNumber: 4,
        userId: input.userId,
        sourceEventId: input.sourceEventId,
        payload: expect.objectContaining({
          eventTimestamp: '2026-09-04T12:00:00.000Z',
          amount: input.amount,
          resultingPrestige: 125,
          sourceEventId: input.sourceEventId,
        }),
      }),
      select: { id: true },
    });
    expect(mockPrisma.financialLedger.create).not.toHaveBeenCalled();
  });

  it('should return the committed result for an identical sourceEventId retry', async () => {
    const first = await applyPrestigeAward({ ...input, timestamp: new Date('2026-09-04T12:00:00.000Z') });
    mockTx.auditLog.findFirst.mockResolvedValue({
      id: first.auditLogId,
      payload: committedPayload(),
      metadata: null,
    });

    const retry = await applyPrestigeAward({ ...input, timestamp: new Date('2030-01-01T00:00:00.000Z') });

    expect(retry.created).toBe(false);
    expect(retry.prestigeAfter).toBe(125);
    expect(retry.eventTimestamp).toEqual(new Date('2026-09-04T12:00:00.000Z'));
    expect(mockTx.user.update).toHaveBeenCalledTimes(1);
    expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('should reject a conflicting sourceEventId reuse without changing prestige', async () => {
    mockTx.auditLog.findFirst.mockResolvedValue({
      id: 99n,
      payload: { ...committedPayload(), amount: 50, resultingPrestige: 150 },
      metadata: null,
    });

    await expect(applyPrestigeAward(input)).rejects.toMatchObject({
      code: FinancialErrorCode.PRESTIGE_EVENT_CONFLICT,
    });
    expect(mockTx.user.update).not.toHaveBeenCalled();
    expect(mockTx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject zero or negative awards before opening a transaction', async () => {
    await expect(applyPrestigeAward({ ...input, amount: 0 })).rejects.toMatchObject({
      code: FinancialErrorCode.INVALID_PRESTIGE_BREAKDOWN,
    });
    await expect(applyPrestigeAward({ ...input, amount: -1 })).rejects.toMatchObject({
      code: FinancialErrorCode.INVALID_PRESTIGE_BREAKDOWN,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
