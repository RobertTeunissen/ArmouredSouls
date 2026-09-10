import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { FinancialError, FinancialErrorCode } from '../../errors';
import {
  FinancialCycleCutoverInProgressError,
  resolveFinancialWriteCycle,
} from './canonicalCycleIdentity';

export interface FinancialWriteTransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

export interface FinancialWriteRetryPolicy {
  maxAttempts: number;
  delayMs: number;
  delay?: (milliseconds: number) => Promise<void>;
}

export const DEFAULT_FINANCIAL_WRITE_RETRY_POLICY: Readonly<FinancialWriteRetryPolicy> = {
  maxAttempts: 61,
  delayMs: 500,
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Retry a complete domain transaction after Serialized_Cycle_Cutover rolls it
 * back. The delay always runs outside the interactive transaction, so no user,
 * domain, audit-sequence, or advisory transaction lock is retained while waiting.
 */
export async function runFinancialWriteTransaction<T>(
  operation: (tx: Prisma.TransactionClient, cycleNumber: number) => Promise<T>,
  transactionOptions: FinancialWriteTransactionOptions = {},
  retryPolicy: FinancialWriteRetryPolicy = DEFAULT_FINANCIAL_WRITE_RETRY_POLICY,
): Promise<T> {
  if (!Number.isInteger(retryPolicy.maxAttempts) || retryPolicy.maxAttempts < 1) {
    throw new RangeError('Financial write retry maxAttempts must be a positive integer');
  }
  if (!Number.isFinite(retryPolicy.delayMs) || retryPolicy.delayMs < 0) {
    throw new RangeError('Financial write retry delayMs must be non-negative');
  }

  for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const cycleNumber = await resolveFinancialWriteCycle(tx);
        return operation(tx, cycleNumber);
      }, transactionOptions);
    } catch (error) {
      if (!(error instanceof FinancialCycleCutoverInProgressError)) throw error;
      if (attempt === retryPolicy.maxAttempts) {
        throw new FinancialError(
          FinancialErrorCode.CYCLE_CUTOVER_TIMEOUT,
          'Financial cycle transition is still in progress; retry shortly',
          503,
          { attempts: retryPolicy.maxAttempts, closingCycle: error.closingCycle },
        );
      }
      await (retryPolicy.delay ?? wait)(retryPolicy.delayMs);
    }
  }

  throw new FinancialError(
    FinancialErrorCode.CYCLE_CUTOVER_TIMEOUT,
    'Financial cycle transition is still in progress; retry shortly',
    503,
  );
}
