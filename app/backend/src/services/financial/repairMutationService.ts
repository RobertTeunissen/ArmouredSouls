import { createHash } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma';
import { eventLogger } from '../common/eventLogger';
import {
  applyCreditMutationInTransaction,
  type CreditMutationResult,
} from './creditMutationService';
import { buildRepairBreakdown } from './financialBreakdowns';
import { buildRepairEventId } from './financialEventIdentity';

export interface RepairOperationRobot {
  id: number;
  updatedAt?: Date | string | number | null;
}

/**
 * Build a retry-stable operation component from the exact damaged-robot snapshot
 * being repaired. The hash keeps the operation component within the identity
 * length limit even when a stable has a large roster.
 */
export function buildRepairOperationId(
  operationType: 'manual' | 'automatic' | 'admin',
  cycleNumber: number,
  userId: number,
  robots: readonly RepairOperationRobot[],
): string {
  const snapshot = [...robots]
    .sort((left, right) => left.id - right.id)
    .map((robot) => {
      const updatedAt = robot.updatedAt instanceof Date
        ? robot.updatedAt.getTime()
        : String(robot.updatedAt ?? '');
      return `${robot.id}@${updatedAt}`;
    })
    .join('|');
  const fingerprint = createHash('sha256').update(snapshot).digest('hex');
  return `${operationType}-${cycleNumber}-${userId}-${fingerprint}`;
}

export interface RepairCreditMutationInput {
  tx: Prisma.TransactionClient;
  cycleNumber: number;
  operationId: string;
  userId: number;
  robotId: number;
  repairType: 'manual' | 'automatic';
  charge: number;
  description: string;
  baseQuote: number;
  damageRepaired: number;
  repairBayLevel: number;
  activeRobotCount: number;
  repairBayDiscountPercent: number;
  manualRepairDiscountPercent: number;
  quoteBeforeManualDiscount: number;
  attributeTotal: number;
  damagePercent: number;
  hpPercent: number;
  auditContext?: Record<string, unknown>;
}

/**
 * Write one repair's required financial pair and canonical robot_repair row in
 * the caller's transaction. The caller owns robot state updates, so a failure
 * in either required record rolls back the complete multi-robot operation.
 */
export async function applyRepairCreditMutationInTransaction(
  input: RepairCreditMutationInput,
): Promise<CreditMutationResult> {
  if (!Number.isInteger(input.charge) || input.charge < 0) {
    throw new Error(`Repair charge must be a non-negative integer, received ${input.charge}`);
  }

  const financialEventId = buildRepairEventId(input.operationId, input.robotId, input.repairType);
  const amount = input.charge === 0 ? 0 : -input.charge;
  const breakdown = buildRepairBreakdown({
    sourceEventId: financialEventId,
    amount,
    repairType: input.repairType,
    robotId: input.robotId,
    baseQuote: input.baseQuote,
    damageRepaired: input.damageRepaired,
    repairBayLevel: input.repairBayLevel,
    activeRobotCount: input.activeRobotCount,
    repairBayDiscountPercent: input.repairBayDiscountPercent,
    manualRepairDiscountPercent: input.manualRepairDiscountPercent,
    quoteBeforeManualDiscount: input.quoteBeforeManualDiscount,
    attributeTotal: input.attributeTotal,
    damagePercent: input.damagePercent,
    hpPercent: input.hpPercent,
  });

  const result = await applyCreditMutationInTransaction(input.tx, {
    cycleNumber: input.cycleNumber,
    userId: input.userId,
    robotId: input.robotId,
    transactionType: 'repair_cost',
    amount,
    description: input.description,
    financialEventId,
    breakdown,
    auditContext: input.auditContext,
  });

  if (result.created) {
    await eventLogger.logRobotRepairInTransaction(input.tx, {
      cycleNumber: input.cycleNumber,
      userId: input.userId,
      robotId: input.robotId,
      creditsCharged: input.charge,
      damageRepaired: input.damageRepaired,
      discountPercent: input.repairBayDiscountPercent,
      repairType: input.repairType,
      manualRepairDiscount: input.repairType === 'manual'
        ? input.manualRepairDiscountPercent
        : undefined,
      creditsBeforeManualDiscount: input.repairType === 'manual'
        ? input.quoteBeforeManualDiscount
        : undefined,
      sourceEventId: financialEventId,
    });
  }

  return result;
}
