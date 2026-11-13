import prisma from '../../lib/prisma';

export type { TransactionType } from '../../types';

interface TransactionSummary {
  transactionType: string;
  totalAmount: number;
  count: number;
}

interface FinancialReport {
  cycles: Array<{
    cycleNumber: number;
    income: number;
    expenses: number;
    netProfit: number;
    transactions: TransactionSummary[];
  }>;
}

interface GetReportParams {
  fromCycle?: number;
  toCycle?: number;
}


/** Return aggregated transaction summaries for a specific user and cycle. */
async function getAggregatedTotals(
  userId: number,
  cycleNumber: number,
): Promise<TransactionSummary[]> {
  const grouped = await prisma.financialLedger.groupBy({
    by: ['transactionType'],
    where: { userId, cycleNumber },
    _sum: { amount: true },
    _count: { id: true },
  });

  return grouped.map((row) => ({
    transactionType: row.transactionType,
    totalAmount: row._sum.amount ?? 0,
    count: row._count.id,
  }));
}

const financialService = {
  getAggregatedTotals,
};

export default financialService;
export type { TransactionSummary, FinancialReport, GetReportParams };
