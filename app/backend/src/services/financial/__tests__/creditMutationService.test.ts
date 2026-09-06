import type { BattleIncomeBreakdown } from '../../../types';

const mockTx = {
  user: { update: jest.fn() },
  financialLedger: { findUnique: jest.fn(), create: jest.fn() },
  auditLog: { findFirst: jest.fn(), create: jest.fn() },
};

const mockPrisma = {
  $transaction: jest.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
};

jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../../lib/creditGuard', () => ({ lockUserForSpending: jest.fn() }));
jest.mock('../../common/auditSequence', () => ({ withAuditSequence: jest.fn() }));

import { lockUserForSpending } from '../../../lib/creditGuard';
import { withAuditSequence } from '../../common/auditSequence';
import { FinancialError, FinancialErrorCode } from '../../../errors';
import { applyCreditMutation, applyCreditMutationInTransaction } from '../creditMutationService';

const mockLockUser = lockUserForSpending as jest.MockedFunction<typeof lockUserForSpending>;
const mockWithAuditSequence = withAuditSequence as jest.MockedFunction<typeof withAuditSequence>;

const breakdown: BattleIncomeBreakdown = {
  schemaVersion: 1,
  formula: 'battle.reward',
  formulaVersion: '1',
  inputs: [{ name: 'participationFloor', value: 100, unit: 'credits', source: 'battle' }],
  modifiers: [],
  rounding: { precision: 0, mode: 'round', operationOrder: ['base'], scope: 'aggregate' },
  finalAmount: 100,
  sourceEventId: 'battle:1:stable:2:battle_income',
  transactionType: 'battle_income',
  mode: 'league_1v1',
  tier: 1,
  outcome: 'win',
  placement: null,
  participationFloor: 100,
  winComponent: 0,
  teamSize: 1,
  stableAggregation: 'stable',
  isBye: false,
};

const input = {
  cycleNumber: 0,
  userId: 2,
  amount: 100,
  description: 'Battle reward',
  financialEventId: 'battle:1:stable:2:battle_income',
  transactionType: 'battle_income' as const,
  breakdown,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTx.financialLedger.findUnique.mockResolvedValue(null);
  mockTx.auditLog.findFirst.mockResolvedValue(null);
  mockTx.user.update.mockResolvedValue({ id: 2, currency: 1100 });
  mockTx.financialLedger.create.mockResolvedValue({
    id: 11,
    cycleNumber: input.cycleNumber,
    userId: 2,
    robotId: null,
    transactionType: 'battle_income',
    amount: 100,
    balanceAfter: 1100,
    description: 'Battle reward',
    metadata: breakdown,
    financialEventId: input.financialEventId,
  });
  mockTx.auditLog.create.mockResolvedValue({ id: 12n });
  mockLockUser.mockResolvedValue({ id: 2, currency: 1000 });
  mockWithAuditSequence.mockImplementation(async (_cycle, _count, callback, tx) => callback(1, tx ?? (mockTx as never)));
});

describe('Credit_Mutation_Service', () => {
  it('should write an atomic financial pair immediately for every valid cycle', async () => {
    const result = await applyCreditMutation(input);

    expect(result).toMatchObject({
      created: true,
      financialEventId: input.financialEventId,
      ledgerId: 11,
      auditLogId: 12n,
      balanceBefore: 1000,
      balanceAfter: 1100,
    });
    expect(mockTx.user.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { currency: 1100 } });
    expect(mockTx.financialLedger.create).toHaveBeenCalledTimes(1);
    expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 30_000 },
    );
  });

  it('should use the paired writer inside an existing transaction without a rollout dependency', async () => {
    const result = await applyCreditMutationInTransaction(mockTx as never, { ...input, cycleNumber: 9 });

    expect(result.created).toBe(true);
    expect(mockTx.financialLedger.create).toHaveBeenCalledTimes(1);
    expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('should return the original result for an identical retry without another delta', async () => {
    const first = await applyCreditMutation(input);
    mockTx.financialLedger.findUnique.mockResolvedValue({
      id: first.ledgerId,
      cycleNumber: input.cycleNumber,
      userId: input.userId,
      robotId: null,
      transactionType: input.transactionType,
      amount: input.amount,
      balanceAfter: first.balanceAfter,
      description: input.description,
      metadata: input.breakdown,
      financialEventId: input.financialEventId,
    });
    mockTx.auditLog.findFirst.mockResolvedValue({
      id: first.auditLogId,
      metadata: null,
      payload: {
        financialEventId: input.financialEventId,
        transactionType: input.transactionType,
        amount: input.amount,
        balanceAfter: first.balanceAfter,
        description: input.description,
        breakdown: input.breakdown,
      },
    });

    const retry = await applyCreditMutation(input);

    expect(retry).toMatchObject({ created: false, ledgerId: first.ledgerId, auditLogId: first.auditLogId });
    expect(mockTx.user.update).toHaveBeenCalledTimes(1);
    expect(mockTx.financialLedger.create).toHaveBeenCalledTimes(1);
  });

  it('should reject a conflicting identity before changing the balance', async () => {
    mockTx.financialLedger.findUnique.mockResolvedValue({
      id: 11,
      cycleNumber: input.cycleNumber,
      userId: input.userId,
      robotId: null,
      transactionType: input.transactionType,
      amount: 200,
      balanceAfter: 1200,
      description: input.description,
      metadata: { ...input.breakdown, finalAmount: 200 },
      financialEventId: input.financialEventId,
    });
    mockTx.auditLog.findFirst.mockResolvedValue({
      id: 12n,
      metadata: null,
      payload: {
        financialEventId: input.financialEventId,
        transactionType: input.transactionType,
        amount: 200,
        balanceAfter: 1200,
        description: input.description,
        breakdown: { ...input.breakdown, finalAmount: 200 },
      },
    });

    await expect(applyCreditMutation(input)).rejects.toMatchObject({ code: FinancialErrorCode.EVENT_CONFLICT });
    expect(mockTx.user.update).not.toHaveBeenCalled();
  });

  it('should fail the transaction when the required audit write fails', async () => {
    mockTx.auditLog.create.mockRejectedValue(new Error('audit unavailable'));

    await expect(applyCreditMutation(input)).rejects.toThrow('audit unavailable');
    expect(mockTx.user.update).toHaveBeenCalledTimes(1);
  });

  it('should reject obsolete transaction labels before opening a transaction', async () => {
    const obsoleteInput = {
      ...input,
      transactionType: 'prestige_award' as never,
      breakdown: { ...breakdown, transactionType: 'prestige_award' } as never,
    };

    await expect(applyCreditMutation(obsoleteInput)).rejects.toBeInstanceOf(FinancialError);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
