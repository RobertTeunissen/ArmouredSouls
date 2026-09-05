import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { FinancialError, FinancialErrorCode } from '../../errors';
import { canonicalizeFinancialFacts } from './creditMutationService';
import { withAuditSequence } from '../common/auditSequence';
import {
  validatePrestigeAwardBreakdown,
  type PrestigeAuditPayload,
  type PrestigeAwardBreakdown,
  type PrestigeAwardSource,
} from '../../types';

const PRESTIGE_AUDIT_EVENT = 'prestige_change';

type JsonRecord = Record<string, unknown>;

export interface PrestigeAwardInput {
  cycleNumber: number;
  userId: number;
  amount: number;
  source: PrestigeAwardSource;
  sourceEventId: string;
  breakdown: PrestigeAwardBreakdown;
  mode?: string;
  battleId?: number | string;
  achievementId?: number | string;
  auditContext?: JsonRecord;
  timestamp?: Date;
}

export interface PrestigeAwardResult {
  created: boolean;
  sourceEventId: string;
  auditLogId: bigint;
  cycleNumber: number;
  userId: number;
  amount: number;
  prestigeBefore: number;
  prestigeAfter: number;
  eventTimestamp: Date;
}

interface ExistingPrestigeEvent {
  id: bigint;
  payload: unknown;
  metadata: unknown;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUniqueConstraintError(error: unknown): boolean {
  return isRecord(error) && error.code === 'P2002';
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function assertInput(input: PrestigeAwardInput): void {
  if (!Number.isInteger(input.cycleNumber) || input.cycleNumber < 0) {
    throw new FinancialError(FinancialErrorCode.INVALID_EVENT_IDENTITY, 'cycleNumber must be a non-negative integer');
  }
  if (!Number.isInteger(input.userId) || input.userId < 1) {
    throw new FinancialError(FinancialErrorCode.INVALID_EVENT_IDENTITY, 'userId must be a positive integer');
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new FinancialError(FinancialErrorCode.INVALID_PRESTIGE_BREAKDOWN, 'Prestige award amount must be a positive integer');
  }
  if (input.sourceEventId.length === 0 || input.sourceEventId.length > 191) {
    throw new FinancialError(FinancialErrorCode.INVALID_EVENT_IDENTITY, 'sourceEventId must contain 1 to 191 characters');
  }
  if (!validatePrestigeAwardBreakdown(input.breakdown)) {
    throw new FinancialError(FinancialErrorCode.INVALID_PRESTIGE_BREAKDOWN, 'Prestige breakdown is invalid');
  }
  if (
    input.breakdown.sourceEventId !== input.sourceEventId
    || input.breakdown.source !== input.source
    || input.breakdown.awardAmount !== input.amount
  ) {
    throw new FinancialError(FinancialErrorCode.INVALID_PRESTIGE_BREAKDOWN, 'Prestige breakdown does not match the award');
  }
}

async function findExisting(
  tx: Prisma.TransactionClient,
  sourceEventId: string,
): Promise<ExistingPrestigeEvent | null> {
  return tx.auditLog.findFirst({
    where: { eventType: PRESTIGE_AUDIT_EVENT, sourceEventId },
    select: { id: true, payload: true, metadata: true },
  });
}

function assertRetryMatches(
  existing: ExistingPrestigeEvent,
  input: PrestigeAwardInput,
): PrestigeAuditPayload {
  const payload = isRecord(existing.payload) ? existing.payload : null;
  const expected: Omit<PrestigeAuditPayload, 'eventTimestamp' | 'resultingPrestige'> = {
    cycleNumber: input.cycleNumber,
    userId: input.userId,
    amount: input.amount,
    source: input.source,
    sourceEventId: input.sourceEventId,
    mode: input.mode ?? null,
    battleId: input.battleId ?? null,
    achievementId: input.achievementId ?? null,
    breakdown: input.breakdown,
  };
  const actual = payload
    ? {
      cycleNumber: payload.cycleNumber,
      userId: payload.userId,
      amount: payload.amount,
      source: payload.source,
      sourceEventId: payload.sourceEventId,
      mode: payload.mode,
      battleId: payload.battleId,
      achievementId: payload.achievementId,
      breakdown: payload.breakdown,
    }
    : null;

  if (
    canonicalizeFinancialFacts(actual) !== canonicalizeFinancialFacts(expected)
    || canonicalizeFinancialFacts(existing.metadata) !== canonicalizeFinancialFacts(input.auditContext ?? null)
  ) {
    throw new FinancialError(
      FinancialErrorCode.PRESTIGE_EVENT_CONFLICT,
      `Prestige source event ${input.sourceEventId} was reused with different immutable facts`,
      409,
      { sourceEventId: input.sourceEventId },
    );
  }

  if (!payload || !Number.isInteger(payload.resultingPrestige) || typeof payload.eventTimestamp !== 'string') {
    throw new FinancialError(FinancialErrorCode.PAIR_MISSING, `Prestige source event ${input.sourceEventId} has an invalid payload`);
  }

  return payload as unknown as PrestigeAuditPayload;
}

function resultFromExisting(
  existing: ExistingPrestigeEvent,
  input: PrestigeAwardInput,
): PrestigeAwardResult {
  const payload = assertRetryMatches(existing, input);
  return {
    created: false,
    sourceEventId: input.sourceEventId,
    auditLogId: existing.id,
    cycleNumber: payload.cycleNumber,
    userId: payload.userId,
    amount: payload.amount,
    prestigeBefore: payload.resultingPrestige - payload.amount,
    prestigeAfter: payload.resultingPrestige,
    eventTimestamp: new Date(payload.eventTimestamp),
  };
}

async function applyInsideTransaction(
  tx: Prisma.TransactionClient,
  input: PrestigeAwardInput,
): Promise<PrestigeAwardResult> {
  const beforeLock = await findExisting(tx, input.sourceEventId);
  if (beforeLock) return resultFromExisting(beforeLock, input);

  const rows = await tx.$queryRaw<Array<{ id: number; prestige: number }>>`
    SELECT id, prestige FROM "users" WHERE id = ${input.userId} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new FinancialError(FinancialErrorCode.INVALID_EVENT_IDENTITY, `User ${input.userId} not found`, 404);
  }
  const prestigeBefore = rows[0].prestige;

  const afterLock = await findExisting(tx, input.sourceEventId);
  if (afterLock) return resultFromExisting(afterLock, input);

  const prestigeAfter = prestigeBefore + input.amount;
  await tx.user.update({
    where: { id: input.userId },
    data: { prestige: prestigeAfter },
  });

  const eventTimestamp = input.timestamp ?? new Date();
  let result: PrestigeAwardResult | undefined;
  await withAuditSequence(input.cycleNumber, 1, async (startSequence, sequenceTx) => {
    const payload: PrestigeAuditPayload = {
      eventTimestamp: eventTimestamp.toISOString(),
      cycleNumber: input.cycleNumber,
      userId: input.userId,
      amount: input.amount,
      source: input.source,
      sourceEventId: input.sourceEventId,
      mode: input.mode ?? null,
      battleId: input.battleId ?? null,
      achievementId: input.achievementId ?? null,
      resultingPrestige: prestigeAfter,
      breakdown: input.breakdown,
    };
    const audit = await sequenceTx.auditLog.create({
      data: {
        cycleNumber: input.cycleNumber,
        eventType: PRESTIGE_AUDIT_EVENT,
        eventTimestamp,
        sequenceNumber: startSequence,
        userId: input.userId,
        payload: toJson(payload),
        metadata: input.auditContext === undefined ? undefined : toJson(input.auditContext),
        sourceEventId: input.sourceEventId,
      },
      select: { id: true },
    });

    result = {
      created: true,
      sourceEventId: input.sourceEventId,
      auditLogId: audit.id,
      cycleNumber: input.cycleNumber,
      userId: input.userId,
      amount: input.amount,
      prestigeBefore,
      prestigeAfter,
      eventTimestamp,
    };
  }, tx);

  if (!result) {
    throw new FinancialError(FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE, 'Prestige mutation did not produce a result');
  }
  return result;
}

async function rereadAfterUniqueRace(
  input: PrestigeAwardInput,
): Promise<PrestigeAwardResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await findExisting(tx, input.sourceEventId);
    if (!existing) {
      throw new FinancialError(
        FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
        `Prestige source event ${input.sourceEventId} lost a uniqueness race but cannot be reread`,
      );
    }
    return resultFromExisting(existing, input);
  });
}

/** Apply one positive stable-level prestige award atomically. */
export async function applyPrestigeAward(
  input: PrestigeAwardInput,
): Promise<PrestigeAwardResult> {
  assertInput(input);
  try {
    return await prisma.$transaction((tx) => applyInsideTransaction(tx, input));
  } catch (error) {
    if (isUniqueConstraintError(error)) return rereadAfterUniqueRace(input);
    throw error;
  }
}

/** Apply a prestige award inside a caller-owned transaction. */
export async function applyPrestigeAwardInTransaction(
  tx: Prisma.TransactionClient,
  input: PrestigeAwardInput,
): Promise<PrestigeAwardResult> {
  assertInput(input);
  return applyInsideTransaction(tx, input);
}

export const prestigeService = {
  apply: applyPrestigeAward,
  applyInTransaction: applyPrestigeAwardInTransaction,
};
