import type { Prisma } from '../../../../generated/prisma';

const mockApplyCreditMutationInTransaction = jest.fn();
const mockLogRobotRepairInTransaction = jest.fn();

jest.mock('../creditMutationService', () => ({
  applyCreditMutationInTransaction: (...args: unknown[]) => mockApplyCreditMutationInTransaction(...args),
}));
jest.mock('../../common/eventLogger', () => ({
  eventLogger: {
    logRobotRepairInTransaction: (...args: unknown[]) => mockLogRobotRepairInTransaction(...args),
  },
}));

import {
  applyRepairCreditMutationInTransaction,
  buildRepairOperationId,
} from '../repairMutationService';

const tx = {} as Prisma.TransactionClient;

const baseInput = {
  tx,
  cycleNumber: 12,
  operationId: 'manual-12-7-fingerprint',
  userId: 7,
  robotId: 22,
  repairType: 'manual' as const,
  charge: 249,
  description: 'Manual repair of 1 robot',
  baseQuote: 1000,
  damageRepaired: 50,
  repairBayLevel: 2,
  activeRobotCount: 4,
  repairBayDiscountPercent: 18,
  manualRepairDiscountPercent: 50,
  quoteBeforeManualDiscount: 499,
  attributeTotal: 230,
  damagePercent: 50,
  hpPercent: 50,
  auditContext: { operationType: 'manual_repair' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApplyCreditMutationInTransaction.mockResolvedValue({
    created: true,
    balanceAfter: 751,
  });
  mockLogRobotRepairInTransaction.mockResolvedValue(undefined);
});

describe('repair financial mutation helper', () => {
  it('should create a stable operation identity from the damaged snapshot', () => {
    const first = buildRepairOperationId('manual', 12, 7, [
      { id: 22, updatedAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 5, updatedAt: new Date('2026-01-01T00:00:01.000Z') },
    ]);
    const retry = buildRepairOperationId('manual', 12, 7, [
      { id: 5, updatedAt: new Date('2026-01-01T00:00:01.000Z') },
      { id: 22, updatedAt: new Date('2026-01-01T00:00:00.000Z') },
    ]);

    expect(first).toBe(retry);
    expect(first).toHaveLength(76);
  });

  it('should write a signed repair mutation and canonical manual repair row', async () => {
    await applyRepairCreditMutationInTransaction(baseInput);

    expect(mockApplyCreditMutationInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: 7,
        robotId: 22,
        transactionType: 'repair_cost',
        amount: -249,
        financialEventId: 'repair:manual-12-7-fingerprint:22:manual:repair_cost',
        breakdown: expect.objectContaining({
          finalAmount: -249,
          repairType: 'manual',
          perRobotCharge: 249,
          repairBayDiscountPercent: 18,
          manualRepairDiscountPercent: 50,
          rounding: expect.objectContaining({ mode: 'floor' }),
        }),
      }),
    );
    expect(mockLogRobotRepairInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        repairType: 'manual',
        creditsCharged: 249,
        creditsBeforeManualDiscount: 499,
        sourceEventId: 'repair:manual-12-7-fingerprint:22:manual:repair_cost',
      }),
    );
  });

  it('should not duplicate the domain repair row for an idempotent financial retry', async () => {
    mockApplyCreditMutationInTransaction.mockResolvedValue({
      created: false,
      balanceAfter: 751,
    });

    await applyRepairCreditMutationInTransaction({
      ...baseInput,
      repairType: 'automatic',
      charge: 300,
      manualRepairDiscountPercent: 0,
      quoteBeforeManualDiscount: 600,
    });

    expect(mockLogRobotRepairInTransaction).not.toHaveBeenCalled();
  });
});
