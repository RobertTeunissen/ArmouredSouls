import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { lockUserForSpending } from '../../lib/creditGuard';
import { FinancialError, FinancialErrorCode } from '../../errors';
import {
  assertTransactionType,
  assertValidFinancialBreakdown,
  type FinancialAuditPayload,
  type FinancialBreakdown,
  type TransactionType,
} from '../../types';
import { withAuditSequence } from '../common/auditSequence';
import {
  assertPairedCaptureForCycle,
  classifyCycle,
  getFinancialRolloutState,
} from '../migration/financialRollout';
import { isEnabled } from '../migration/featureFlags';

const FINANCIAL_AUDIT_EVENT = 'financial_transaction';

type JsonRecord = Record<string, unknown>;

export interface CreditMutationInput {
  cycleNumber: number;
  userId: number;
  robotId?: number;
  transactionType: TransactionType;
  amount: number;
  description: string;
  financialEventId: string;
  breakdown: FinancialBreakdown;
  auditContext?: JsonRecord;
  timestamp?: Date;
}

export interface CreditMutationResult {
  created: boolean;
  financialEventId: string;
  ledgerId: number;
  auditLogId: bigint;
  userId: number;
  robotId: number | null;
  cycleNumber: number;
  transactionType: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
}

interface ExistingFinancialEvent {
  ledger: {
    id: number;
    cycleNumber: number;
    userId: number;
    robotId: number | null;
    transactionType: string;
    amount: number;
    balanceAfter: number;
    description: string;
    metadata: unknown;
    financialEventId: string | null;
  };
  audit: {
    id: bigint;
    metadata: unknown;
    payload: unknown;
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForComparison(item));
  }
  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalizeForComparison(value[key]);
        return result;
      }, {});
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeForComparison(value));
}

function isUniqueConstraintError(error: unknown): boolean {
  return isRecord(error) && error.code === 'P2002';
}

function assertMutationInput(input: CreditMutationInput): void {
  if (!Number.isInteger(input.cycleNumber) || input.cycleNumber < 0) {
    throw new FinancialError(FinancialErrorCode.INVALID_EVENT_IDENTITY, 'cycleNumber must be a non-negative integer');
  }
  if (!Number.isInteger(input.userId) || input.userId < 1) {
    throw new FinancialError(FinancialErrorCode.INVALID_EVENT_IDENTITY, 'userId must be a positive integer');
  }
  if (input.robotId !== undefined && (!Number.isInteger(input.robotId) || input.robotId < 1)) {
    throw new FinancialError(FinancialErrorCode.INVALID_EVENT_IDENTITY, 'robotId must be a positive integer when supplied');
  }
  if (!Number.isInteger(input.amount)) {
    throw new FinancialError(FinancialErrorCode.INVALID_BREAKDOWN, 'credit amount must be a signed integer');
  }
  if (input.description.length === 0 || input.description.length > 255) {
    throw new FinancialError(FinancialErrorCode.INVALID_EVENT_IDENTITY, 'description must contain 1 to 255 characters');
  }
  if (input.financialEventId.length === 0 || input.financialEventId.length > 191) {
    throw new FinancialError(FinancialErrorCode.INVALID_EVENT_IDENTITY, 'financialEventId must contain 1 to 191 characters');
  }

  try {
    assertTransactionType(input.transactionType);
    assertValidFinancialBreakdown(input.breakdown, input.transactionType);
  } catch (error) {
    throw new FinancialError(
      FinancialErrorCode.INVALID_BREAKDOWN,
      error instanceof Error ? error.message : 'Invalid financial mutation breakdown',
    );
  }

  if (input.breakdown.finalAmount !== input.amount) {
    throw new FinancialError(
      FinancialErrorCode.INVALID_BREAKDOWN,
      'breakdown.finalAmount must equal the signed mutation amount',
    );
  }

  const incomeType = input.transactionType === 'battle_income'
    || input.transactionType === 'streaming_revenue'
    || input.transactionType === 'weapon_sale'
    || input.transactionType === 'achievement_reward'
    || input.transactionType === 'passive_income';
  if (incomeType && input.amount < 0) {
    throw new FinancialError(FinancialErrorCode.INVALID_BREAKDOWN, `${input.transactionType} cannot be a negative mutation`);
  }
  if (!incomeType && input.transactionType !== 'operating_costs' && input.amount > 0) {
    throw new FinancialError(FinancialErrorCode.INVALID_BREAKDOWN, `${input.transactionType} cannot be a positive mutation`);
  }
  if (input.transactionType === 'operating_costs' && input.amount > 0) {
    throw new FinancialError(FinancialErrorCode.INVALID_BREAKDOWN, 'operating_costs cannot be a positive mutation');
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function findExistingFinancialEvent(
  tx: Prisma.TransactionClient,
  financialEventId: string,
): Promise<ExistingFinancialEvent | null> {
  const ledger = await tx.financialLedger.findUnique({
    where: { financialEventId },
  });
  if (!ledger) return null;

  const audit = await tx.auditLog.findFirst({
    where: {
      eventType: FINANCIAL_AUDIT_EVENT,
      financialEventId,
    },
    select: { id: true, metadata: true, payload: true },
  });
  if (!audit) {
    throw new FinancialError(
      FinancialErrorCode.PAIR_MISSING,
      `Financial event ${financialEventId} has a ledger row but no paired audit row`,
    );
  }

  return { ledger, audit };
}

function assertRetryMatches(
  existing: ExistingFinancialEvent,
  input: CreditMutationInput,
): void {
  const payload = isRecord(existing.audit.payload) ? existing.audit.payload : null;
  const expectedPayload: FinancialAuditPayload = {
    financialEventId: input.financialEventId,
    transactionType: input.transactionType,
    amount: input.amount,
    balanceAfter: existing.ledger.balanceAfter,
    description: input.description,
    breakdown: input.breakdown,
  };
  const expectedLedgerFacts = {
    cycleNumber: input.cycleNumber,
    userId: input.userId,
    robotId: input.robotId ?? null,
    transactionType: input.transactionType,
    amount: input.amount,
    description: input.description,
    metadata: input.breakdown,
  };
  const actualLedgerFacts = {
    cycleNumber: existing.ledger.cycleNumber,
    userId: existing.ledger.userId,
    robotId: existing.ledger.robotId,
    transactionType: existing.ledger.transactionType,
    amount: existing.ledger.amount,
    description: existing.ledger.description,
    metadata: existing.ledger.metadata,
  };
  const actualAuditFacts = {
    financialEventId: payload?.financialEventId,
    transactionType: payload?.transactionType,
    amount: payload?.amount,
    balanceAfter: payload?.balanceAfter,
    description: payload?.description,
    breakdown: payload?.breakdown,
  };

  if (
    canonicalJson(actualLedgerFacts) !== canonicalJson(expectedLedgerFacts)
    || canonicalJson(actualAuditFacts) !== canonicalJson(expectedPayload)
    || canonicalJson(existing.audit.metadata) !== canonicalJson(input.auditContext ?? null)
  ) {
    throw new FinancialError(
      FinancialErrorCode.EVENT_CONFLICT,
      `Financial event ${input.financialEventId} was reused with different immutable facts`,
      409,
      { financialEventId: input.financialEventId },
    );
  }
}

function resultFromExisting(
  existing: ExistingFinancialEvent,
  input: CreditMutationInput,
): CreditMutationResult {
  assertRetryMatches(existing, input);
  return {
    created: false,
    financialEventId: input.financialEventId,
    ledgerId: existing.ledger.id,
    auditLogId: existing.audit.id,
    userId: existing.ledger.userId,
    robotId: existing.ledger.robotId,
    cycleNumber: existing.ledger.cycleNumber,
    transactionType: input.transactionType,
    amount: existing.ledger.amount,
    balanceBefore: existing.ledger.balanceAfter - existing.ledger.amount,
    balanceAfter: existing.ledger.balanceAfter,
  };
}

async function applyInsideTransaction(
  tx: Prisma.TransactionClient,
  input: CreditMutationInput,
): Promise<CreditMutationResult> {
  const beforeLock = await findExistingFinancialEvent(tx, input.financialEventId);
  if (beforeLock) return resultFromExisting(beforeLock, input);

  const lockedUser = await lockUserForSpending(tx, input.userId);
  const afterLock = await findExistingFinancialEvent(tx, input.financialEventId);
  if (afterLock) return resultFromExisting(afterLock, input);

  const balanceAfter = lockedUser.currency + input.amount;
  await tx.user.update({
    where: { id: input.userId },
    data: { currency: balanceAfter },
  });

  let result: CreditMutationResult | undefined;
  await withAuditSequence(input.cycleNumber, 1, async (startSequence, sequenceTx) => {
    const ledger = await sequenceTx.financialLedger.create({
      data: {
        cycleNumber: input.cycleNumber,
        userId: input.userId,
        robotId: input.robotId ?? null,
        transactionType: input.transactionType,
        amount: input.amount,
        balanceAfter,
        description: input.description,
        metadata: toJson(input.breakdown),
        financialEventId: input.financialEventId,
      },
    });

    const payload: FinancialAuditPayload = {
      financialEventId: input.financialEventId,
      transactionType: input.transactionType,
      amount: input.amount,
      balanceAfter,
      description: input.description,
      breakdown: input.breakdown,
    };
    const audit = await sequenceTx.auditLog.create({
      data: {
        cycleNumber: input.cycleNumber,
        eventType: FINANCIAL_AUDIT_EVENT,
        eventTimestamp: input.timestamp ?? new Date(),
        sequenceNumber: startSequence,
        userId: input.userId,
        robotId: input.robotId ?? null,
        payload: toJson(payload),
        metadata: input.auditContext === undefined ? undefined : toJson(input.auditContext),
        financialEventId: input.financialEventId,
      },
      select: { id: true },
    });

    result = {
      created: true,
      financialEventId: input.financialEventId,
      ledgerId: ledger.id,
      auditLogId: audit.id,
      userId: input.userId,
      robotId: input.robotId ?? null,
      cycleNumber: input.cycleNumber,
      transactionType: input.transactionType,
      amount: input.amount,
      balanceBefore: lockedUser.currency,
      balanceAfter,
    };
  }, tx);

  if (!result) {
    throw new FinancialError(FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE, 'Financial mutation did not produce a result');
  }
  return result;
}

async function shouldUsePairedCapture(cycleNumber: number): Promise<boolean> {
  const rollout = await getFinancialRolloutState();
  if (classifyCycle(cycleNumber, rollout) === 'pre_cutover') {
    return false;
  }
  await assertPairedCaptureForCycle(cycleNumber);
  return true;
}

/**
 * Preserve the pre-cutover economy without claiming a post-cutover financial
 * pair. The shared service still owns the balance mutation, while the old
 * feature flag retains its optional legacy-ledger enrichment behavior.
 */
async function applyLegacyInsideTransaction(
  tx: Prisma.TransactionClient,
  input: CreditMutationInput,
): Promise<CreditMutationResult> {
  const lockedUser = await lockUserForSpending(tx, input.userId);
  const balanceAfter = lockedUser.currency + input.amount;
  await tx.user.update({
    where: { id: input.userId },
    data: { currency: balanceAfter },
  });

  const legacyLedger = (await isEnabled('financial_ledger_active'))
    ? await tx.financialLedger.create({
      data: {
        cycleNumber: input.cycleNumber,
        userId: input.userId,
        robotId: input.robotId ?? null,
        transactionType: input.transactionType,
        amount: input.amount,
        balanceAfter,
        description: input.description,
        metadata: toJson(input.breakdown),
      },
    })
    : null;

  return {
    created: true,
    financialEventId: input.financialEventId,
    ledgerId: legacyLedger?.id ?? 0,
    auditLogId: 0n,
    userId: input.userId,
    robotId: input.robotId ?? null,
    cycleNumber: input.cycleNumber,
    transactionType: input.transactionType,
    amount: input.amount,
    balanceBefore: lockedUser.currency,
    balanceAfter,
  };
}

async function rereadAfterUniqueRace(
  input: CreditMutationInput,
): Promise<CreditMutationResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await findExistingFinancialEvent(tx, input.financialEventId);
    if (!existing) {
      throw new FinancialError(
        FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
        `Financial event ${input.financialEventId} lost a uniqueness race but cannot be reread`,
      );
    }
    return resultFromExisting(existing, input);
  });
}

/** Apply one financial mutation in a new interactive transaction. */
export async function applyCreditMutation(
  input: CreditMutationInput,
): Promise<CreditMutationResult> {
  assertMutationInput(input);
  const pairedCapture = await shouldUsePairedCapture(input.cycleNumber);
  if (!pairedCapture) {
    return prisma.$transaction((tx) => applyLegacyInsideTransaction(tx, input));
  }
  try {
    return await prisma.$transaction((tx) => applyInsideTransaction(tx, input));
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return rereadAfterUniqueRace(input);
    }
    throw error;
  }
}

/** Apply one mutation inside the caller's existing interactive transaction. */
export async function applyCreditMutationInTransaction(
  tx: Prisma.TransactionClient,
  input: CreditMutationInput,
): Promise<CreditMutationResult> {
  assertMutationInput(input);
  return (await shouldUsePairedCapture(input.cycleNumber))
    ? applyInsideTransaction(tx, input)
    : applyLegacyInsideTransaction(tx, input);
}

export function canonicalizeFinancialFacts(value: unknown): string {
  return canonicalJson(value);
}

export const creditMutationService = {
  apply: applyCreditMutation,
  applyInTransaction: applyCreditMutationInTransaction,
};
