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
