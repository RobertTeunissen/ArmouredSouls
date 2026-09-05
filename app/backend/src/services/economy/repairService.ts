import prisma from '../../lib/prisma';
import { calculateAttributeSum } from '../../utils/robotCalculations';
import { calculateRepairQuote, calculateRepairBayDiscountPercent } from '../../shared/utils/repairCost';
import logger from '../../config/logger';
import { resolveRobotIdsForEvent } from './repairScope';
import type { SubscribableEventType } from '../subscription/eventRegistry';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
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
 * Repair damaged robots in one atomic multi-user operation.
 *
 * All owner locks are acquired in ascending order before the transaction takes
 * its final damaged-robot snapshot. This prevents overlapping repair operations
 * from charging or repairing the same robot twice while preserving the existing
 * negative-balance behavior for automatic repairs.
 */
async function repairRobots(
  robotIds: number[] | null,
  deductCosts: boolean,
  cycleNumber?: number,
): Promise<RepairSummary> {
  if (robotIds !== null && robotIds.length === 0) {
    return emptySummary(deductCosts);
  }

  const actualCycleNumber = cycleNumber ?? await getCurrentCycleNumber();
  const result = await prisma.$transaction(async (tx): Promise<InternalRepairSummary> => {
    const where = {
      ...(robotIds !== null ? { id: { in: robotIds } } : {}),
      currentHP: { lt: prisma.robot.fields.maxHP },
    };
    const initialRobots = await tx.robot.findMany({ where });
    if (initialRobots.length === 0) {
      return { ...emptySummary(deductCosts), logEvents: [] };
    }

    const initialUserIds = [...new Set(initialRobots.map((robot) => robot.userId))].sort((a, b) => a - b);
    for (const userId of initialUserIds) {
      await lockUserForSpending(tx, userId);
    }

    // Re-read after the owner locks. A concurrent repair that committed first
    // will have removed its robots from this snapshot.
    const robots = await tx.robot.findMany({ where });
    if (robots.length === 0) {
      return { ...emptySummary(deductCosts), logEvents: [] };
    }

    const robotsByUser = new Map<number, typeof robots>();
    for (const robot of robots) {
      const existing = robotsByUser.get(robot.userId);
      if (existing) existing.push(robot);
      else robotsByUser.set(robot.userId, [robot]);
    }

    const affectedUserIds = [...robotsByUser.keys()].sort((a, b) => a - b);
    const [facilities, robotCounts] = await Promise.all([
      tx.facility.findMany({
        where: { userId: { in: affectedUserIds }, facilityType: 'repair_bay' },
      }),
      tx.robot.groupBy({
        by: ['userId'],
        where: { userId: { in: affectedUserIds } },
        _count: { id: true },
      }),
    ]);

    const facilityByUser = new Map(facilities.map((facility) => [facility.userId, facility]));
    const robotCountByUser = new Map(robotCounts.map((row) => [row.userId, row._count.id]));
    const userSummaries: RepairSummary['userSummaries'] = [];
    const logEvents: RepairLogEvent[] = [];
    let totalBaseCost = 0;
    let totalFinalCost = 0;

    for (const userId of affectedUserIds) {
      const userRobots = [...(robotsByUser.get(userId) ?? [])].sort((a, b) => a.id - b.id);
      const repairBayLevel = facilityByUser.get(userId)?.level ?? 0;
      const activeRobotCount = robotCountByUser.get(userId) ?? 0;
      const repairBayDiscount = calculateRepairBayDiscountPercent({ repairBayLevel, activeRobotCount });
      const operationId = buildRepairOperationId('automatic', actualCycleNumber, userId, userRobots);
      let userBaseCost = 0;
      let userFinalCost = 0;

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

        userBaseCost += baseQuote;
        userFinalCost += repairCost;

        let created = true;
        if (deductCosts) {
          const financialResult = await applyRepairCreditMutationInTransaction({
            tx,
            cycleNumber: actualCycleNumber,
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
              cycleNumber: actualCycleNumber,
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

      totalBaseCost += userBaseCost;
      totalFinalCost += userFinalCost;
      userSummaries.push({
        userId,
        robotsRepaired: userRobots.length,
        totalCost: userFinalCost,
        repairBayDiscount,
      });
    }

    return {
      robotsRepaired: robots.length,
      totalBaseCost,
      totalFinalCost,
      costsDeducted: deductCosts,
      userSummaries,
      logEvents,
    };
  });

  for (const event of result.logEvents) {
    logger.info(
      `[RepairService] | User ${event.userId} | Robot ${event.robotId} (${event.robotName}) | Cost: ₡${event.repairCost.toLocaleString()} | Discount: ${event.repairBayDiscount}%`,
    );
  }

  const { logEvents: _logEvents, ...summary } = result;
  return summary;
}
