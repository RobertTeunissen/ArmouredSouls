import prisma from '../../lib/prisma';
import type { TransactionType } from '../../types';

export { TRANSACTION_TYPES } from '../../types';
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

const INCOME_TYPES: ReadonlySet<TransactionType> = new Set([
  'battle_income',
  'streaming_revenue',
  'weapon_sale',
  'achievement_reward',
  'passive_income',
]);

/**
 * Reporting facade for immutable financial records.
 *
 * All current-economy writes go through Credit_Mutation_Service so each balance
 * change commits with its paired ledger and financial audit records.
 */
async function getReport(userId: number, params: GetReportParams = {}): Promise<FinancialReport> {
  const { fromCycle, toCycle } = params;
  const cycleFilter: Record<string, number> = {};
  if (fromCycle !== undefined) cycleFilter.gte = fromCycle;
  if (toCycle !== undefined) cycleFilter.lte = toCycle;

  const grouped = await prisma.financialLedger.groupBy({
    by: ['transactionType', 'cycleNumber'],
    where: {
      userId,
      ...(Object.keys(cycleFilter).length > 0 ? { cycleNumber: cycleFilter } : {}),
    },
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { cycleNumber: 'asc' },
  });

  const cycleMap = new Map<
    number,
    { income: number; expenses: number; transactions: TransactionSummary[] }
  >();

  for (const row of grouped) {
    const bucket = cycleMap.get(row.cycleNumber)
      ?? { income: 0, expenses: 0, transactions: [] };
    cycleMap.set(row.cycleNumber, bucket);

    const totalAmount = row._sum.amount ?? 0;
    bucket.transactions.push({
      transactionType: row.transactionType,
      totalAmount,
      count: row._count.id,
    });

    if (INCOME_TYPES.has(row.transactionType as TransactionType)) {
      bucket.income += totalAmount;
    } else {
      bucket.expenses += Math.abs(totalAmount);
    }
  }

  return {
    cycles: Array.from(cycleMap.entries()).map(([cycleNumber, data]) => ({
      cycleNumber,
      income: data.income,
      expenses: data.expenses,
      netProfit: data.income - data.expenses,
      transactions: data.transactions,
    })),
  };
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
  getReport,
  getAggregatedTotals,
};

export default financialService;
export type { TransactionSummary, FinancialReport, GetReportParams };
