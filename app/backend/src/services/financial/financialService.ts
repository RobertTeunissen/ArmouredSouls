import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { isEnabled } from '../migration/featureFlags';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TransactionType =
  | 'battle_income'
  | 'streaming_revenue'
  | 'repair_cost'
  | 'facility_upgrade'
  | 'weapon_purchase'
  | 'weapon_sale'
  | 'weapon_refinement'
  | 'robot_creation'
  | 'subscription_cost'
  | 'prestige_award'
  | 'attribute_upgrade'
  | 'settlement_adjustment';

interface RecordTransactionParams {
  cycleNumber: number;
  userId: number;
  robotId?: number;
  transactionType: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  metadata?: Record<string, unknown>;
}

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

// ---------------------------------------------------------------------------
// Income types (positive amounts)
// ---------------------------------------------------------------------------

const INCOME_TYPES: Set<TransactionType> = new Set([
  'battle_income',
  'streaming_revenue',
  'weapon_sale',
  'prestige_award',
  'settlement_adjustment',
]);

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

/**
 * Records a single ledger entry for a credit-changing event.
 *
 * Checks the `financial_ledger_active` feature flag before writing.
 * Returns the created row or `null` if the flag is disabled.
 */
async function recordTransaction(params: RecordTransactionParams) {
  const flagActive = await isEnabled('financial_ledger_active');

  if (!flagActive) {
    return null;
  }

  const entry = await prisma.financialLedger.create({
    data: {
      cycleNumber: params.cycleNumber,
      userId: params.userId,
      robotId: params.robotId ?? null,
      transactionType: params.transactionType,
      amount: params.amount,
      balanceAfter: params.balanceAfter,
      description: params.description,
      metadata: (params.metadata ?? undefined) as Parameters<typeof prisma.financialLedger.create>[0]['data']['metadata'],
    },
  });

  logger.debug(
    `[FinancialService] Recorded ${params.transactionType} for user ${params.userId}: amount=${params.amount}, balanceAfter=${params.balanceAfter}`,
  );

  return entry;
}

/**
 * Returns a financial report for a user aggregated by cycle and transaction type.
 *
 * Accepts optional `fromCycle` / `toCycle` bounds. When omitted the query
 * includes all cycles for the user.
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

  // Organize rows into per-cycle buckets
  const cycleMap = new Map<
    number,
    { income: number; expenses: number; transactions: TransactionSummary[] }
  >();

  for (const row of grouped) {
    const cycle = row.cycleNumber;
    if (!cycleMap.has(cycle)) {
      cycleMap.set(cycle, { income: 0, expenses: 0, transactions: [] });
    }

    const bucket = cycleMap.get(cycle)!;
    const totalAmount = row._sum.amount ?? 0;
    const count = row._count.id;

    bucket.transactions.push({
      transactionType: row.transactionType,
      totalAmount,
      count,
    });

    if (INCOME_TYPES.has(row.transactionType as TransactionType)) {
      bucket.income += totalAmount;
    } else {
      bucket.expenses += Math.abs(totalAmount);
    }
  }

  const cycles = Array.from(cycleMap.entries()).map(([cycleNumber, data]) => ({
    cycleNumber,
    income: data.income,
    expenses: data.expenses,
    netProfit: data.income - data.expenses,
    transactions: data.transactions,
  }));

  return { cycles };
}

/**
 * Returns aggregated transaction summaries for a specific user and cycle.
 */
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

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

const financialService = {
  recordTransaction,
  getReport,
  getAggregatedTotals,
};

export default financialService;
export type { RecordTransactionParams, TransactionSummary, FinancialReport, GetReportParams, TransactionType };
