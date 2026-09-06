jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    financialLedger: { groupBy: jest.fn() },
  },
}));

import prisma from '../../../lib/prisma';
import financialService from '../financialService';

const mockGroupBy = prisma.financialLedger.groupBy as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FinancialService reporting', () => {
  it('should return ledger totals grouped by cycle and transaction type', async () => {
    mockGroupBy.mockResolvedValue([
      { transactionType: 'battle_income', cycleNumber: 1, _sum: { amount: 3000 }, _count: { id: 3 } },
      { transactionType: 'repair_cost', cycleNumber: 1, _sum: { amount: -1500 }, _count: { id: 2 } },
      { transactionType: 'battle_income', cycleNumber: 2, _sum: { amount: 2000 }, _count: { id: 2 } },
    ]);

    const report = await financialService.getReport(42);

    expect(report.cycles).toEqual([
      expect.objectContaining({ cycleNumber: 1, income: 3000, expenses: 1500, netProfit: 1500 }),
      expect.objectContaining({ cycleNumber: 2, income: 2000, expenses: 0, netProfit: 2000 }),
    ]);
  });

  it('should apply optional cycle bounds to the reporting query', async () => {
    mockGroupBy.mockResolvedValue([]);

    await financialService.getReport(42, { fromCycle: 3, toCycle: 7 });

    expect(mockGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 42, cycleNumber: { gte: 3, lte: 7 } },
    }));
  });

  it('should return a per-cycle transaction summary', async () => {
    mockGroupBy.mockResolvedValue([
      { transactionType: 'weapon_purchase', _sum: { amount: -3000 }, _count: { id: 6 } },
      { transactionType: 'weapon_sale', _sum: { amount: 1500 }, _count: { id: 3 } },
    ]);

    await expect(financialService.getAggregatedTotals(42, 2)).resolves.toEqual([
      { transactionType: 'weapon_purchase', totalAmount: -3000, count: 6 },
      { transactionType: 'weapon_sale', totalAmount: 1500, count: 3 },
    ]);
  });
});
