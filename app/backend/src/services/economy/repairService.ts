import prisma from '../../lib/prisma';
import { calculateAttributeSum } from '../../utils/robotCalculations';
import { calculateRepairQuote, calculateRepairBayDiscountPercent } from '../../shared/utils/repairCost';
import logger from '../../config/logger';
import { resolveRobotIdsForEvent } from './repairScope';
import type { SubscribableEventType } from '../subscription/eventRegistry';
import { runFinancialWriteTransaction } from '../cycle/financialWriteTransaction';
import { lockUserForSpending } from '../../lib/creditGuard';
import {
  applyRepairCreditMutationInTransaction,
  buildRepairOperationId,
} from '../financial/repairMutationService';

export interface RepairSummary {
  robotsRepaired: number;
  totalBaseCost: number;
  totalFinalCost: number;
  costsDeducted: boolean;
  userSummaries: Array<{
    userId: number;
    robotsRepaired: number;
    totalCost: number;
    repairBayDiscount: number;
  }>;
}

type RepairLogEvent = {
  userId: number;
  robotId: number;
  robotName: string;
  repairCost: number;
  damageTaken: number;
  repairBayDiscount: number;
};

type InternalRepairSummary = RepairSummary & { logEvents: RepairLogEvent[] };

function emptySummary(costsDeducted: boolean): RepairSummary {
  return {
    robotsRepaired: 0,
    totalBaseCost: 0,
    totalFinalCost: 0,
    costsDeducted,
    userSummaries: [],
  };
}

/**
 * Repair the robots queued for one battle type, before that battle type runs.
 *
 * This is the single pre-battle repair entry point for all nine battle types.
 * Scope resolution remains in `resolveRobotIdsForEvent`, which intentionally
 * includes real participants in bye matches.
 */
export async function repairRobotsForEvent(
  eventType: SubscribableEventType,
  deductCosts: boolean = true,
  cycleNumber?: number,
): Promise<RepairSummary> {
  const robotIds = await resolveRobotIdsForEvent(eventType);

  logger.info(
    `[RepairService] Pre-battle repair scoped to ${eventType}: ${robotIds.length} robot(s) with a queued match`,
  );

  return repairRobots(robotIds, deductCosts, cycleNumber);
}

/** Repair every damaged robot in the game for an explicit maintenance trigger. */
export async function repairAllRobots(
  deductCosts: boolean = true,
  cycleNumber?: number,
): Promise<RepairSummary> {
  return repairRobots(null, deductCosts, cycleNumber);
}

/**
 * Repair one stable's damaged robots atomically.
 *
 * A repair financial pair, its canonical `robot_repair` audit record, and the
 * repaired robot state must commit together. Limiting the transaction to one
 * owner avoids retaining the cycle-wide audit lock and prior owners' row locks
 * for an entire event-wide repair batch.
 */
async function repairUserRobots(
  userId: number,
  scopedRobotIds: number[] | null,
  deductCosts: boolean,
): Promise<InternalRepairSummary> {
  return runFinancialWriteTransaction(async (tx, financialCycleNumber): Promise<InternalRepairSummary> => {
    await lockUserForSpending(tx, userId);

    const where = {
      userId,
      ...(scopedRobotIds !== null ? { id: { in: scopedRobotIds } } : {}),
      currentHP: { lt: prisma.robot.fields.maxHP },
    };
    // Re-read only after the owner lock. A concurrent repair that committed
    // first has removed its robots from this snapshot.
    const robots = await tx.robot.findMany({ where });
    if (robots.length === 0) {
      return { ...emptySummary(deductCosts), logEvents: [] };
    }

    const [facilities, robotCounts] = await Promise.all([
      tx.facility.findMany({
        where: { userId: { in: [userId] }, facilityType: 'repair_bay' },
      }),
      tx.robot.groupBy({
        by: ['userId'],
        where: { userId: { in: [userId] } },
        _count: { id: true },
      }),
    ]);
    const repairBayLevel = facilities[0]?.level ?? 0;
    const activeRobotCount = robotCounts[0]?._count.id ?? 0;
    const repairBayDiscount = calculateRepairBayDiscountPercent({ repairBayLevel, activeRobotCount });
    const userRobots = [...robots].sort((a, b) => a.id - b.id);
    const operationId = buildRepairOperationId('automatic', financialCycleNumber, userId, userRobots);
    const logEvents: RepairLogEvent[] = [];
    let totalBaseCost = 0;
    let totalFinalCost = 0;

    for (const robot of userRobots) {
      const attributeTotal = calculateAttributeSum(robot);
      const damageRepaired = robot.maxHP - robot.currentHP;
      const damagePercent = (damageRepaired / robot.maxHP) * 100;
      const hpPercent = (robot.currentHP / robot.maxHP) * 100;
      const baseQuote = calculateRepairQuote(
        { attributeTotal, damagePercent, hpPercent },
        { repairBayLevel: 0, activeRobotCount: 0 },
      );
      const repairCost = calculateRepairQuote(
        { attributeTotal, damagePercent, hpPercent },
        { repairBayLevel, activeRobotCount },
      );
      totalBaseCost += baseQuote;
      totalFinalCost += repairCost;

      let created = true;
      if (deductCosts) {
        const financialResult = await applyRepairCreditMutationInTransaction({
          tx,
          cycleNumber: financialCycleNumber,
          operationId,
          userId,
          robotId: robot.id,
          repairType: 'automatic',
          charge: repairCost,
          description: 'Automatic pre-battle repair of 1 robot',
          baseQuote,
          damageRepaired,
          repairBayLevel,
          activeRobotCount,
          repairBayDiscountPercent: repairBayDiscount,
          manualRepairDiscountPercent: 0,
          quoteBeforeManualDiscount: repairCost,
          attributeTotal,
          damagePercent,
          hpPercent,
          auditContext: {
            operationType: 'automatic_repair',
            eventType: 'pre_battle',
            cycleNumber: financialCycleNumber,
            repairType: 'automatic',
          },
        });
        created = financialResult.created;
      }

      if (!deductCosts || created) {
        await tx.robot.update({
          where: { id: robot.id },
          data: {
            currentHP: robot.maxHP,
            currentShield: robot.maxShield,
            repairQuoteCredits: 0,
            battleReadiness: 100,
            lifetimeRepairCreditsPaid: { increment: deductCosts ? repairCost : 0 },
          },
        });
      }

      logEvents.push({
        userId,
        robotId: robot.id,
        robotName: robot.name,
        repairCost,
        damageTaken: damageRepaired,
        repairBayDiscount,
      });
    }

    return {
      robotsRepaired: userRobots.length,
      totalBaseCost,
      totalFinalCost,
      costsDeducted: deductCosts,
      userSummaries: [{
        userId,
        robotsRepaired: userRobots.length,
        totalCost: totalFinalCost,
        repairBayDiscount,
      }],
      logEvents,
    };
  }, { timeout: 30_000 });
}

/**
 * Repair damaged robots with one bounded transaction per owner.
 *
 * Owners are processed in ascending order for deterministic reporting. Each
 * owner's transaction is idempotent at the repair financial-event layer, so a
 * partially completed batch safely resumes without charging repairs twice.
 */
async function repairRobots(
  robotIds: number[] | null,
  deductCosts: boolean,
  cycleNumber?: number,
): Promise<RepairSummary> {
  if (robotIds !== null && robotIds.length === 0) {
    return emptySummary(deductCosts);
  }

  // Financial identities are rebuilt from the authoritative cycle resolved
  // inside each fresh transaction attempt. The optional argument remains for
  // compatibility with cycle runners but cannot select an accounting cycle.
  void cycleNumber;
  const where = {
    ...(robotIds !== null ? { id: { in: robotIds } } : {}),
    currentHP: { lt: prisma.robot.fields.maxHP },
  };
  const initialRobots = await prisma.robot.findMany({ where });
  if (initialRobots.length === 0) {
    return emptySummary(deductCosts);
  }

  const robotIdsByUser = new Map<number, number[]>();
  for (const robot of initialRobots) {
    const userRobotIds = robotIdsByUser.get(robot.userId) ?? [];
    userRobotIds.push(robot.id);
    robotIdsByUser.set(robot.userId, userRobotIds);
  }

  const result: InternalRepairSummary = {
    ...emptySummary(deductCosts),
    logEvents: [],
  };
  const userIds = [...robotIdsByUser.keys()].sort((a, b) => a - b);
  for (const userId of userIds) {
    const userResult = await repairUserRobots(
      userId,
      robotIds === null ? null : robotIdsByUser.get(userId) ?? [],
      deductCosts,
    );
    result.robotsRepaired += userResult.robotsRepaired;
    result.totalBaseCost += userResult.totalBaseCost;
    result.totalFinalCost += userResult.totalFinalCost;
    result.userSummaries.push(...userResult.userSummaries);
    result.logEvents.push(...userResult.logEvents);
  }

  for (const event of result.logEvents) {
    logger.info(
      `[RepairService] | User ${event.userId} | Robot ${event.robotId} (${event.robotName}) | Cost: ₡${event.repairCost.toLocaleString()} | Discount: ${event.repairBayDiscount}%`,
    );
  }

  const { logEvents: _logEvents, ...summary } = result;
  return summary;
}
