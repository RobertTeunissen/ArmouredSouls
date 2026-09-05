/**
 * Non-blocking financial ledger recording helper.
 *
 * Encapsulates the repeated pattern of fetching the current cycle number
 * and writing a ledger entry via financialService.recordTransaction().
 * Pre-cutover callers may still use this compatibility wrapper while their
 * rows remain outside the completeness claim. Post-cutover callers must use
 * the atomic Credit_Mutation_Service path; required errors are propagated.
 *
 * Usage:
 *   import { recordLedgerEntry } from '../services/financial/recordLedgerEntry';
 *   await recordLedgerEntry({ userId, transactionType: 'weapon_purchase', amount: -cost, balanceAfter, description, metadata });
 */

import financialService from './financialService';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import logger from '../../config/logger';
import { classifyCycle, getFinancialRolloutState } from '../migration/financialRollout';
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
 * Record a legacy financial ledger entry.
 *
 * Only a recording failure after a successful pre-cutover classification is
 * non-blocking: those rows are outside the completeness claim. Cycle lookup,
 * rollout lookup, and classification failures always propagate because the
 * helper cannot prove that legacy compatibility applies. Post-cutover callers
 * likewise receive every error, preventing a balance mutation from appearing
 * successful while its paired evidence is missing.
 */
export async function recordLedgerEntry(params: LedgerEntryParams): Promise<void> {
  let establishedPreCutover = false;

  try {
    const cycleNumber = await getCurrentCycleNumber();
    const rollout = await getFinancialRolloutState();
    establishedPreCutover = classifyCycle(cycleNumber, rollout) === 'pre_cutover';

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
    if (!establishedPreCutover) throw error;
    logger.debug(`[Ledger] Failed to record ${params.transactionType} for user ${params.userId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
