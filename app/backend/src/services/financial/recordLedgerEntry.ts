/**
 * Non-blocking financial ledger recording helper.
 *
 * Encapsulates the repeated pattern of fetching the current cycle number
 * and writing a ledger entry via financialService.recordTransaction().
 * Failures are silently swallowed — the ledger is an enrichment layer,
 * never a critical path.
 *
 * Usage:
 *   import { recordLedgerEntry } from '../services/financial/recordLedgerEntry';
 *   await recordLedgerEntry({ userId, transactionType: 'weapon_purchase', amount: -cost, balanceAfter, description, metadata });
 */

import financialService from './financialService';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import logger from '../../config/logger';
import type { TransactionType } from './financialService';

export interface LedgerEntryParams {
  userId: number;
  robotId?: number;
  transactionType: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record a financial ledger entry. Non-blocking — catches and logs errors
 * without propagating them. Safe to call without try-catch in route handlers.
 */
export async function recordLedgerEntry(params: LedgerEntryParams): Promise<void> {
  try {
    const cycleNumber = await getCurrentCycleNumber();
    await financialService.recordTransaction({
      cycleNumber,
      userId: params.userId,
      robotId: params.robotId,
      transactionType: params.transactionType,
      // Normalise negative zero. Callers write `amount: -cost`, and a cost of zero is
      // reachable: a manual repair of a low-attribute robot behind a high Repair Bay
      // discount quotes 1 credit and floors to 0 after the manual discount. `-0` is
      // harmless once it reaches Postgres, but it is not harmless in JavaScript —
      // `Object.is(-0, 0)` is false, so it silently breaks any strict-equality check on a
      // ledger total, which is exactly how it was found.
      amount: params.amount === 0 ? 0 : params.amount,
      balanceAfter: params.balanceAfter,
      description: params.description,
      metadata: params.metadata,
    });
  } catch (error) {
    logger.debug(`[Ledger] Failed to record ${params.transactionType} for user ${params.userId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
