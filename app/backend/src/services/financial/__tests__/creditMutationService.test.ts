import type { BattleIncomeBreakdown } from '../../../types';
import type { FinancialRolloutState } from '../../migration/financialRollout';

const mockTx = {
  user: { update: jest.fn() },
  financialLedger: { findUnique: jest.fn(), create: jest.fn() },
  auditLog: { findFirst: jest.fn(), create: jest.fn() },
};

const mockPrisma = {
  $transaction: jest.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
};

jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../../lib/creditGuard', () => ({
  lockUserForSpending: jest.fn(),
}));
jest.mock('../../common/auditSequence', () => ({
  withAuditSequence: jest.fn(),
}));
jest.mock('../../migration/financialRollout', () => ({
  assertPairedCaptureForCycle: jest.fn(),
  getFinancialRolloutState: jest.fn(),
  classifyCycle: jest.fn(),
}));
jest.mock('../../migration/featureFlags', () => ({
  isEnabled: jest.fn(),
}));

import { lockUserForSpending } from '../../../lib/creditGuard';
import { withAuditSequence } from '../../common/auditSequence';
import { FinancialError, FinancialErrorCode } from '../../../errors';
import {
  assertPairedCaptureForCycle,
  classifyCycle,
  getFinancialRolloutState,
} from '../../migration/financialRollout';
import { isEnabled } from '../../migration/featureFlags';
import { applyCreditMutation, applyCreditMutationInTransaction } from '../creditMutationService';

const mockLockUser = lockUserForSpending as jest.MockedFunction<typeof lockUserForSpending>;
const mockWithAuditSequence = withAuditSequence as jest.MockedFunction<typeof withAuditSequence>;
const mockAssertPairedCapture = assertPairedCaptureForCycle as jest.MockedFunction<typeof assertPairedCaptureForCycle>;
const mockGetFinancialRolloutState = getFinancialRolloutState as jest.MockedFunction<typeof getFinancialRolloutState>;
const mockClassifyCycle = classifyCycle as jest.MockedFunction<typeof classifyCycle>;
const mockIsEnabled = isEnabled as jest.MockedFunction<typeof isEnabled>;

const postCutoverState: FinancialRolloutState = {
  environment: 'ACC',
  phase: 'acc_cutover',
  schemaClientGenerated: true,
  writerManifestComplete: true,
  blockingTestsPassed: true,
  requiredCaptureActive: true,
  accCutoverRecorded: true,
  reconciliationPassed: false,
  documentationComplete: false,
  cutoverCycle: 7,
  cutoverRecordedAt: '2026-01-01T00:00:00.000Z',
  reconciledAt: null,
  documentedAt: null,
};

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
  cycleNumber: 7,
  userId: 2,
  amount: 100,
  description: 'Battle reward',
  financialEventId: 'battle:1:stable:2:battle_income',
  transactionType: 'battle_income' as const,
  breakdown,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAssertPairedCapture.mockResolvedValue(postCutoverState);
  mockGetFinancialRolloutState.mockResolvedValue(postCutoverState);
  mockClassifyCycle.mockReturnValue('post_cutover');
  mockIsEnabled.mockResolvedValue(false);
  mockTx.financialLedger.findUnique.mockResolvedValue(null);
  mockTx.auditLog.findFirst.mockResolvedValue(null);
  mockTx.user.update.mockResolvedValue({ id: 2, currency: 1100 });
  mockTx.financialLedger.create.mockResolvedValue({
    id: 11,
    cycleNumber: 7,
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
  it('should update currency and write exactly one paired ledger/audit record after cutover', async () => {
    const result = await applyCreditMutation(input);

    expect(mockAssertPairedCapture).toHaveBeenCalledWith(input.cycleNumber);
    expect(result).toMatchObject({
      created: true,
      financialEventId: input.financialEventId,
      amount: 100,
      balanceBefore: 1000,
      balanceAfter: 1100,
    });
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { currency: 1100 },
    });
    expect(mockTx.financialLedger.create).toHaveBeenCalledTimes(1);
    expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mockTx.financialLedger.create.mock.calls[0][0].data.financialEventId)
      .toBe(input.financialEventId);
    expect(mockTx.auditLog.create.mock.calls[0][0].data.financialEventId)
      .toBe(input.financialEventId);
  });

  it('should retain the pre-cutover compatibility mutation without creating a paired record', async () => {
    mockClassifyCycle.mockReturnValue('pre_cutover');

    const result = await applyCreditMutation({ ...input, cycleNumber: 6 });

    expect(result).toMatchObject({ created: true, balanceBefore: 1000, balanceAfter: 1100, ledgerId: 0, auditLogId: 0n });
    expect(mockAssertPairedCapture).not.toHaveBeenCalled();
    expect(mockTx.user.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { currency: 1100 } });
    expect(mockTx.financialLedger.create).not.toHaveBeenCalled();
    expect(mockTx.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject post-cutover writes when required paired capture is unavailable', async () => {
    mockAssertPairedCapture.mockRejectedValue(new FinancialError(
      FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
      'Paired financial capture is unavailable before the ACC Cutover_Cycle',
      503,
      { cycleNumber: input.cycleNumber, cutoverCycle: null },
    ));

    await expect(applyCreditMutation(input)).rejects.toMatchObject({
      code: FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockTx.user.update).not.toHaveBeenCalled();
    expect(mockTx.financialLedger.create).not.toHaveBeenCalled();
    expect(mockTx.auditLog.create).not.toHaveBeenCalled();
    expect(mockWithAuditSequence).not.toHaveBeenCalled();
  });

  it('should reject an in-transaction post-cutover write before mutating when paired capture is unavailable', async () => {
    mockAssertPairedCapture.mockRejectedValue(new FinancialError(
      FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
      'Paired financial capture is unavailable before the ACC Cutover_Cycle',
      503,
      { cycleNumber: 6, cutoverCycle: postCutoverState.cutoverCycle },
    ));

    await expect(applyCreditMutationInTransaction(mockTx as never, { ...input, cycleNumber: 6 }))
      .rejects.toMatchObject({ code: FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE });
    expect(mockTx.user.update).not.toHaveBeenCalled();
    expect(mockTx.financialLedger.create).not.toHaveBeenCalled();
    expect(mockTx.auditLog.create).not.toHaveBeenCalled();
    expect(mockWithAuditSequence).not.toHaveBeenCalled();
  });

  it('should return the original result for an identical retry without another delta', async () => {
    mockTx.financialLedger.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockTx.financialLedger.create.mock.results[0]?.value ?? null);

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

    expect(retry.created).toBe(false);
    expect(retry.balanceAfter).toBe(first.balanceAfter);
    expect(mockTx.user.update).toHaveBeenCalledTimes(1);
    expect(mockTx.financialLedger.create).toHaveBeenCalledTimes(1);
    expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
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

    await expect(applyCreditMutation(input)).rejects.toMatchObject({
      code: FinancialErrorCode.EVENT_CONFLICT,
    });
    expect(mockTx.user.update).not.toHaveBeenCalled();
    expect(mockTx.financialLedger.create).not.toHaveBeenCalled();
    expect(mockTx.auditLog.create).not.toHaveBeenCalled();
    expect(mockLockUser).not.toHaveBeenCalled();
  });

  it('should leave the transaction failed when a required audit write fails', async () => {
    mockTx.auditLog.create.mockRejectedValue(new Error('audit unavailable'));

    await expect(applyCreditMutation(input)).rejects.toThrow('audit unavailable');
    expect(mockTx.user.update).toHaveBeenCalledTimes(1);
    expect(mockTx.financialLedger.create).toHaveBeenCalledTimes(1);
  });

  it('should reject obsolete transaction labels at the mutation boundary', async () => {
    const obsoleteInput = {
      ...input,
      transactionType: 'prestige_award' as never,
      breakdown: { ...breakdown, transactionType: 'prestige_award' } as never,
    };

    await expect(applyCreditMutation(obsoleteInput)).rejects.toBeInstanceOf(FinancialError);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
