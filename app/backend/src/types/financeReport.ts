/**
 * Backend-internal Finance Center types. The response shapes the frontend
 * reads are wire contracts in `src/shared/types` (finance-report.ts).
 */
import type { FinancialBreakdown, TransactionType } from './financialTypes';
import type { ReportScope } from '../shared/types';

/** A requested period: a preset scope, or an explicit cycle range. */
export interface ReportPeriodSelection {
  scope?: Exclude<ReportScope, 'custom'>;
  fromCycle?: number;
  toCycle?: number;
}

/** Internal complete-pair projection. Raw identities never cross the report boundary. */
export interface FinancialRecordProjection {
  financialEventId: string;
  cycleNumber: number;
  sequenceNumber: number;
  userId: number;
  robotId: number | null;
  transactionType: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  breakdown: FinancialBreakdown;
  occurredAt: Date;
}
