import type { Prisma } from '../../../generated/prisma';
import { FinancialError, FinancialErrorCode } from '../../errors';
import prisma from '../../lib/prisma';
import { lockUserForSpending } from '../../lib/creditGuard';
import { canonicalizeFinancialFacts } from './creditMutationService';
import { buildEconomicOperationEventId } from './financialEventIdentity';

type JsonRecord = Record<string, unknown>;

export type EconomicOperation =
  | 'weapon_purchase'
  | 'weapon_sale'
  | 'weapon_refinement'
  | 'facility_upgrade'
  | 'robot_creation'
  | 'attribute_upgrade';

export interface EconomicRequestIdentity {
  financialEventId: string;
  operation: EconomicOperation;
  requestKey: string;
  requestFacts: JsonRecord;
}

export interface EconomicRequestReplay<T> {
  response: T;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Creates the immutable identity for a user-initiated economic request. The
 * request key is deliberately included before any domain row is created, so a
 * retry is recognisable even when the first request deleted or changed it.
 */
export function createEconomicRequestIdentity(
  userId: number,
  operation: EconomicOperation,
  requestKey: string,
  requestFacts: JsonRecord,
): EconomicRequestIdentity {
  return {
    financialEventId: buildEconomicOperationEventId(operation, requestKey, userId),
    operation,
    requestKey,
    requestFacts,
  };
}

/**
 * Checks the durable financial audit record after the caller has locked the
 * user and before it writes domain state. A matching completed request returns
 * its original core response; a reused key with different facts fails closed.
 */
export async function findEconomicRequestReplay<T>(
  tx: Prisma.TransactionClient,
  identity: EconomicRequestIdentity,
): Promise<EconomicRequestReplay<T> | null> {
  const ledger = await tx.financialLedger.findUnique({
    where: { financialEventId: identity.financialEventId },
    select: { id: true },
  });
  if (!ledger) return null;

  const audit = await tx.auditLog.findFirst({
    where: { eventType: 'financial_transaction', financialEventId: identity.financialEventId },
    select: { metadata: true },
  });
  const metadata = isRecord(audit?.metadata) ? audit.metadata : null;
  const request = metadata !== null && isRecord(metadata.idempotency)
    ? metadata.idempotency
    : null;
  if (!request || !isRecord(request.requestFacts) || request.operation !== identity.operation
    || request.requestKey !== identity.requestKey
    || canonicalizeFinancialFacts(request.requestFacts) !== canonicalizeFinancialFacts(identity.requestFacts)) {
    throw new FinancialError(
      FinancialErrorCode.EVENT_CONFLICT,
      'Idempotency-Key was reused with different request facts',
      409,
      { financialEventId: identity.financialEventId },
    );
  }
  if (!isRecord(request.response)) {
    throw new FinancialError(
      FinancialErrorCode.PAIR_MISSING,
      'Completed economic request is missing its replay response',
      500,
      { financialEventId: identity.financialEventId },
    );
  }
  return { response: request.response as unknown as T };
}

/** Attach request facts and a response snapshot to the existing audit pair. */
export function buildEconomicRequestAuditContext<T>(
  identity: EconomicRequestIdentity,
  response: T,
): JsonRecord {
  return {
    idempotency: {
      operation: identity.operation,
      requestKey: identity.requestKey,
      requestFacts: identity.requestFacts,
      response,
    },
  };
}

/**
 * Performs the early replay probe before optimistic validations that can become
 * false after the first successful request (for example a deleted inventory or
 * a newly-taken robot name). The mutation transaction repeats this check under
 * the same user lock immediately before domain writes to close the race.
 */
export async function findCompletedEconomicRequest<T>(
  userId: number,
  operation: EconomicOperation,
  requestKey: string,
  requestFacts: JsonRecord,
): Promise<EconomicRequestReplay<T> | null> {
  const identity = createEconomicRequestIdentity(userId, operation, requestKey, requestFacts);
  return prisma.$transaction(async (tx) => {
    await lockUserForSpending(tx, userId);
    return findEconomicRequestReplay<T>(tx, identity);
  });
}
