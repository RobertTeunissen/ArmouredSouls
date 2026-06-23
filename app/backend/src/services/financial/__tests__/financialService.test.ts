import { createLedgerEntry, createLedgerEntryForType, TRANSACTION_TYPES, INCOME_TYPES, EXPENSE_TYPES } from '../../../../tests/factories/financialLedgerFactory';

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    financialLedger: {
      create: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../migration/featureFlags', () => ({
  __esModule: true,
  isEnabled: jest.fn(),
}));

import prisma from '../../../lib/prisma';
import { isEnabled } from '../../migration/featureFlags';
import financialService from '../financialService';

const mockIsEnabled = isEnabled as jest.MockedFunction<typeof isEnabled>;
const mockCreate = prisma.financialLedger.create as jest.Mock;
const mockGroupBy = prisma.financialLedger.groupBy as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsEnabled.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// recordTransaction
// ---------------------------------------------------------------------------

describe('recordTransaction', () => {
  it('should create a ledger entry when feature flag is active', async () => {
    const entry = createLedgerEntry();
    mockCreate.mockResolvedValue(entry);

    const result = await financialService.recordTransaction({
      cycleNumber: entry.cycleNumber,
      userId: entry.userId,
      robotId: entry.robotId ?? undefined,
      transactionType: entry.transactionType as any,
      amount: entry.amount,
      balanceAfter: entry.balanceAfter,
      description: entry.description,
    });

    expect(result).toEqual(entry);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should return null when feature flag is disabled', async () => {
    mockIsEnabled.mockResolvedValue(false);

    const result = await financialService.recordTransaction({
      cycleNumber: 1,
      userId: 100,
      transactionType: 'battle_income',
      amount: 1000,
      balanceAfter: 11000,
      description: 'Test',
    });

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should pass correct data to prisma.financialLedger.create', async () => {
    const entry = createLedgerEntry({
      cycleNumber: 5,
      userId: 42,
      robotId: 99,
      transactionType: 'repair_cost',
      amount: -500,
      balanceAfter: 9500,
      description: 'Robot repair after battle',
    });
    mockCreate.mockResolvedValue(entry);

    await financialService.recordTransaction({
      cycleNumber: 5,
      userId: 42,
      robotId: 99,
      transactionType: 'repair_cost',
      amount: -500,
      balanceAfter: 9500,
      description: 'Robot repair after battle',
      metadata: { battleId: 123 },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        cycleNumber: 5,
        userId: 42,
        robotId: 99,
        transactionType: 'repair_cost',
        amount: -500,
        balanceAfter: 9500,
        description: 'Robot repair after battle',
        metadata: { battleId: 123 },
      },
    });
  });

  it('should handle all 12 transaction types', async () => {
    for (const type of TRANSACTION_TYPES) {
      const entry = createLedgerEntryForType(type);
      mockCreate.mockResolvedValue(entry);

      const result = await financialService.recordTransaction({
        cycleNumber: entry.cycleNumber,
        userId: entry.userId,
        robotId: entry.robotId ?? undefined,
        transactionType: type,
        amount: entry.amount,
        balanceAfter: entry.balanceAfter,
        description: entry.description,
      });

      expect(result).not.toBeNull();
    }

    expect(mockCreate).toHaveBeenCalledTimes(TRANSACTION_TYPES.length);
  });
});

// ---------------------------------------------------------------------------
// getReport
// ---------------------------------------------------------------------------

describe('getReport', () => {
  it('should return aggregated totals grouped by cycle and transaction type', async () => {
    mockGroupBy.mockResolvedValue([
      { transactionType: 'battle_income', cycleNumber: 1, _sum: { amount: 3000 }, _count: { id: 3 } },
      { transactionType: 'repair_cost', cycleNumber: 1, _sum: { amount: -1500 }, _count: { id: 2 } },
      { transactionType: 'battle_income', cycleNumber: 2, _sum: { amount: 2000 }, _count: { id: 2 } },
    ]);

    const report = await financialService.getReport(42);

    expect(report.cycles).toHaveLength(2);
    expect(report.cycles[0].cycleNumber).toBe(1);
    expect(report.cycles[0].transactions).toHaveLength(2);
    expect(report.cycles[1].cycleNumber).toBe(2);
    expect(report.cycles[1].transactions).toHaveLength(1);
  });

  it('should classify income vs expense types correctly', async () => {
    mockGroupBy.mockResolvedValue([
      { transactionType: 'battle_income', cycleNumber: 1, _sum: { amount: 2000 }, _count: { id: 2 } },
      { transactionType: 'streaming_revenue', cycleNumber: 1, _sum: { amount: 1000 }, _count: { id: 1 } },
      { transactionType: 'repair_cost', cycleNumber: 1, _sum: { amount: -800 }, _count: { id: 1 } },
      { transactionType: 'weapon_purchase', cycleNumber: 1, _sum: { amount: -500 }, _count: { id: 1 } },
    ]);

    const report = await financialService.getReport(42);
    const cycle = report.cycles[0];

    // Income = battle_income (2000) + streaming_revenue (1000) = 3000
    expect(cycle.income).toBe(3000);
    // Expenses = |repair_cost| (800) + |weapon_purchase| (500) = 1300
    expect(cycle.expenses).toBe(1300);
  });

  it('should calculate netProfit as income minus expenses', async () => {
    mockGroupBy.mockResolvedValue([
      { transactionType: 'battle_income', cycleNumber: 1, _sum: { amount: 5000 }, _count: { id: 5 } },
      { transactionType: 'repair_cost', cycleNumber: 1, _sum: { amount: -2000 }, _count: { id: 3 } },
    ]);

    const report = await financialService.getReport(42);
    const cycle = report.cycles[0];

    expect(cycle.netProfit).toBe(cycle.income - cycle.expenses);
    expect(cycle.netProfit).toBe(5000 - 2000);
  });

  it('should filter by fromCycle and toCycle when provided', async () => {
    mockGroupBy.mockResolvedValue([]);

    await financialService.getReport(42, { fromCycle: 3, toCycle: 7 });

    expect(mockGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 42,
          cycleNumber: { gte: 3, lte: 7 },
        },
      }),
    );
  });

  it('should return empty cycles array when no data', async () => {
    mockGroupBy.mockResolvedValue([]);

    const report = await financialService.getReport(42);

    expect(report.cycles).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getAggregatedTotals
// ---------------------------------------------------------------------------

describe('getAggregatedTotals', () => {
  it('should return summaries for a single cycle', async () => {
    mockGroupBy.mockResolvedValue([
      { transactionType: 'battle_income', _sum: { amount: 4000 }, _count: { id: 4 } },
      { transactionType: 'repair_cost', _sum: { amount: -1200 }, _count: { id: 2 } },
    ]);

    const totals = await financialService.getAggregatedTotals(42, 1);

    expect(totals).toHaveLength(2);
    expect(totals[0]).toEqual({
      transactionType: 'battle_income',
      totalAmount: 4000,
      count: 4,
    });
    expect(totals[1]).toEqual({
      transactionType: 'repair_cost',
      totalAmount: -1200,
      count: 2,
    });
  });

  it('should group by transaction type', async () => {
    mockGroupBy.mockResolvedValue([
      { transactionType: 'weapon_purchase', _sum: { amount: -3000 }, _count: { id: 6 } },
      { transactionType: 'weapon_sale', _sum: { amount: 1500 }, _count: { id: 3 } },
      { transactionType: 'weapon_refinement', _sum: { amount: -800 }, _count: { id: 2 } },
    ]);

    const totals = await financialService.getAggregatedTotals(42, 2);

    expect(mockGroupBy).toHaveBeenCalledWith({
      by: ['transactionType'],
      where: { userId: 42, cycleNumber: 2 },
      _sum: { amount: true },
      _count: { id: true },
    });

    expect(totals).toHaveLength(3);
    expect(totals.map((t) => t.transactionType)).toEqual([
      'weapon_purchase',
      'weapon_sale',
      'weapon_refinement',
    ]);
  });
});
