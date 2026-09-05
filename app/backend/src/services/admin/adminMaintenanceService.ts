import prisma from '../../lib/prisma';
import { lockUserForSpending } from '../../lib/creditGuard';
import logger from '../../config/logger';
import { calculateMaxHP, calculateAttributeSum } from '../../utils/robotCalculations';
import {
  calculateRepairQuote,
  calculateRepairBayDiscountPercent,
} from '../../shared/utils/repairCost';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import {
  applyRepairCreditMutationInTransaction,
  buildRepairOperationId,
} from '../financial/repairMutationService';

/** Shape returned by repairAllRobotsAdmin — matches the existing admin response. */
export interface AdminRepairResult {
  success: boolean;
  robotsRepaired: number;
  totalBaseCost: number;
  totalFinalCost: number;
  costsDeducted: boolean;
  repairs: Array<{
    robotId: number;
    robotName: string;
    userId: number;
    hpRestored: number;
    baseCost: number;
    discount: number;
    finalCost: number;
    costDeducted: boolean;
  }>;
  timestamp: string;
}

/** Shape returned by recalculateAllRobotHP — matches the existing admin response. */
export interface AdminRecalculateHPResult {
  success: boolean;
  robotsUpdated: number;
  updates: Array<{
    robotId: number;
    robotName: string;
    hullIntegrity: number;
    oldMaxHP: number;
    newMaxHP: number;
    change: number;
  }>;
  timestamp: string;
}

/**
 * Repair all damaged robots to full HP/shield via the admin panel.
 *
 * An explicitly charged admin run is an Automatic_Repair operation: every
 * robot gets its own financial identity, financial pair and robot_repair source
 * row inside the same transaction as its state and lifetime update. The
 * existing `deductCosts: false` compatibility mode remains nonfinancial.
 */
export async function repairAllRobotsAdmin(deductCosts: boolean): Promise<AdminRepairResult> {
  logger.info('[Admin] Auto-repairing all robots...');
  const cycleNumber = await getCurrentCycleNumber();

  const result = await prisma.$transaction(async (tx) => {
    const where = { currentHP: { lt: prisma.robot.fields.maxHP } };
    const initialRobots = await tx.robot.findMany({ where });
    if (initialRobots.length === 0) {
      return { robotsRepaired: 0, repairs: [] as AdminRepairResult['repairs'] };
    }

    const initialUserIds = [...new Set(initialRobots.map((robot) => robot.userId))].sort((a, b) => a - b);
    for (const userId of initialUserIds) {
      await lockUserForSpending(tx, userId);
    }

    const robots = await tx.robot.findMany({ where });
    if (robots.length === 0) {
      return { robotsRepaired: 0, repairs: [] as AdminRepairResult['repairs'] };
    }

    const robotsByUser = new Map<number, typeof robots>();
    for (const robot of robots) {
      const existing = robotsByUser.get(robot.userId);
      if (existing) existing.push(robot);
      else robotsByUser.set(robot.userId, [robot]);
    }

    const userIds = [...robotsByUser.keys()].sort((a, b) => a - b);
    const [facilities, robotCounts] = await Promise.all([
      tx.facility.findMany({
        where: { userId: { in: userIds }, facilityType: 'repair_bay' },
      }),
      tx.robot.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { id: true },
      }),
    ]);
    const facilityByUser = new Map(facilities.map((facility) => [facility.userId, facility]));
    const robotCountByUser = new Map(robotCounts.map((row) => [row.userId, row._count.id]));
    const repairs: AdminRepairResult['repairs'] = [];

    for (const userId of userIds) {
      const userRobots = [...(robotsByUser.get(userId) ?? [])].sort((a, b) => a.id - b.id);
      const repairBayLevel = facilityByUser.get(userId)?.level ?? 0;
      const activeRobotCount = robotCountByUser.get(userId) ?? 0;
      const repairBayDiscount = calculateRepairBayDiscountPercent({ repairBayLevel, activeRobotCount });
      const operationId = buildRepairOperationId('admin', cycleNumber, userId, userRobots);

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

        let created = true;
        if (deductCosts) {
          const financialResult = await applyRepairCreditMutationInTransaction({
            tx,
            cycleNumber,
            operationId,
            userId,
            robotId: robot.id,
            repairType: 'automatic',
            charge: repairCost,
            description: 'Administrative automatic repair of 1 robot',
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
              operationType: 'admin_maintenance_repair',
              repairType: 'automatic',
              adminMaintenance: true,
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

        repairs.push({
          robotId: robot.id,
          robotName: robot.name,
          userId: robot.userId,
          hpRestored: damageRepaired,
          // The compatibility response has always exposed the already
          // Repair-Bay-discounted quote in both cost fields.
          baseCost: repairCost,
          discount: 0,
          finalCost: repairCost,
          costDeducted: deductCosts,
        });
      }
    }

    return { robotsRepaired: robots.length, repairs };
  });

  return {
    success: true,
    robotsRepaired: result.robotsRepaired,
    totalBaseCost: result.repairs.reduce((sum, repair) => sum + repair.baseCost, 0),
    totalFinalCost: result.repairs.reduce((sum, repair) => sum + repair.finalCost, 0),
    costsDeducted: deductCosts,
    repairs: result.repairs,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Recalculate maxHP for all robots using the formula and adjust currentHP proportionally.
 * Extracted from the POST /api/admin/recalculate-hp route handler.
 */
export async function recalculateAllRobotHP(): Promise<AdminRecalculateHPResult> {
  logger.info('[Admin] Recalculating HP for all robots using new formula...');

  const robots = await prisma.robot.findMany({
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  const updates: AdminRecalculateHPResult['updates'] = [];
  for (const robot of robots) {
    const oldMaxHP = robot.maxHP;
    const newMaxHP = calculateMaxHP(robot);
    const hpPercentage = robot.maxHP > 0 ? robot.currentHP / robot.maxHP : 1;
    const newCurrentHP = Math.round(newMaxHP * hpPercentage);

    await prisma.robot.update({
      where: { id: robot.id },
      data: {
        maxHP: newMaxHP,
        currentHP: Math.min(newCurrentHP, newMaxHP),
      },
    });

    updates.push({
      robotId: robot.id,
      robotName: robot.name,
      hullIntegrity: Number(robot.hullIntegrity),
      oldMaxHP,
      newMaxHP,
      change: newMaxHP - oldMaxHP,
    });
  }

  return {
    success: true,
    robotsUpdated: robots.length,
    updates,
    timestamp: new Date().toISOString(),
  };
}
