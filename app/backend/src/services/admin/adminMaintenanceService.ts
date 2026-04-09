import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { calculateMaxHP } from '../../utils/robotCalculations';
import { calculateRepairCost, calculateAttributeSum } from '../../utils/robotCalculations';

/**
 * Shape returned by repairAllRobotsAdmin — matches the original inline response.
 */
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

/**
 * Shape returned by recalculateAllRobotHP — matches the original inline response.
 */
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
 * Repair all robots to full HP/shield via admin panel.
 * Extracted from the POST /api/admin/repair/all route handler.
 */
export async function repairAllRobotsAdmin(deductCosts: boolean): Promise<AdminRepairResult> {
  logger.info('[Admin] Auto-repairing all robots...');

  // Get all robots that need repair
  const robots = await prisma.robot.findMany({
    where: {
      currentHP: {
        lt: prisma.robot.fields.maxHP,
      },
      NOT: {
        name: 'Bye Robot',
      },
    },
    select: {
      id: true,
      name: true,
      userId: true,
      currentHP: true,
      maxHP: true,
      maxShield: true,
    },
  });

  const repairs: AdminRepairResult['repairs'] = [];

  // Group robots by user to apply facility discounts
  const robotsByUser = new Map<number, typeof robots>();
  for (const robot of robots) {
    if (!robotsByUser.has(robot.userId)) {
      robotsByUser.set(robot.userId, []);
    }
    robotsByUser.get(robot.userId)!.push(robot);
  }

  for (const [userId, userRobots] of robotsByUser.entries()) {
    // Get repair bay and medical bay facilities for discounts
    const facilities = await prisma.facility.findMany({
      where: {
        userId,
        facilityType: {
          in: ['repair_bay', 'medical_bay'],
        },
      },
    });

    const repairBay = facilities.find(f => f.facilityType === 'repair_bay');
    const medicalBay = facilities.find(f => f.facilityType === 'medical_bay');

    const repairBayLevel = repairBay?.level || 0;
    const medicalBayLevel = medicalBay?.level || 0;

    // Query active robot count for multi-robot discount
    const activeRobotCount = await prisma.robot.count({
      where: {
        userId,
        NOT: { name: 'Bye Robot' },
      },
    });

    let totalUserRepairCost = 0;

    for (const robot of userRobots) {
      // Fetch full robot data for attribute calculation
      const fullRobot = await prisma.robot.findUnique({
        where: { id: robot.id },
      });

      if (!fullRobot) continue;

      // Use the SAME calculation as repairService.ts
      const sumOfAllAttributes = calculateAttributeSum(fullRobot);
      const damageTaken = fullRobot.maxHP - fullRobot.currentHP;
      const damagePercent = (damageTaken / fullRobot.maxHP) * 100;
      const hpPercent = (fullRobot.currentHP / fullRobot.maxHP) * 100;

      const repairCost = calculateRepairCost(
        sumOfAllAttributes,
        damagePercent,
        hpPercent,
        repairBayLevel,
        medicalBayLevel,
        activeRobotCount,
      );

      const hpToRestore = robot.maxHP - robot.currentHP;

      // Update robot HP and set battle ready
      await prisma.robot.update({
        where: { id: robot.id },
        data: {
          currentHP: robot.maxHP,
          currentShield: robot.maxShield,
          repairCost: 0,
          battleReadiness: 100,
        },
      });

      totalUserRepairCost += repairCost;

      repairs.push({
        robotId: robot.id,
        robotName: robot.name,
        userId: robot.userId,
        hpRestored: hpToRestore,
        baseCost: repairCost,
        discount: 0, // Discount already included in calculation
        finalCost: repairCost,
        costDeducted: deductCosts,
      });
    }

    // Deduct costs if requested
    if (deductCosts && totalUserRepairCost > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          currency: {
            decrement: totalUserRepairCost,
          },
        },
      });
    }
  }

  return {
    success: true,
    robotsRepaired: robots.length,
    totalBaseCost: repairs.reduce((sum, r) => sum + r.baseCost, 0),
    totalFinalCost: repairs.reduce((sum, r) => sum + r.finalCost, 0),
    costsDeducted: deductCosts,
    repairs,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Recalculate maxHP for all robots using the formula and adjust currentHP proportionally.
 * Extracted from the POST /api/admin/recalculate-hp route handler.
 */
export async function recalculateAllRobotHP(): Promise<AdminRecalculateHPResult> {
  logger.info('[Admin] Recalculating HP for all robots using new formula...');

  // Get all robots with weapon includes (needed by calculateMaxHP)
  const robots = await prisma.robot.findMany({
    include: {
      mainWeapon: {
        include: {
          weapon: true,
        },
      },
      offhandWeapon: {
        include: {
          weapon: true,
        },
      },
    },
  });

  const updates: AdminRecalculateHPResult['updates'] = [];

  for (const robot of robots) {
    const oldMaxHP = robot.maxHP;

    // Calculate new maxHP using the formula
    const newMaxHP = calculateMaxHP(robot);

    // Calculate currentHP proportionally
    const hpPercentage = robot.maxHP > 0 ? robot.currentHP / robot.maxHP : 1;
    const newCurrentHP = Math.round(newMaxHP * hpPercentage);

    // Update robot
    await prisma.robot.update({
      where: { id: robot.id },
      data: {
        maxHP: newMaxHP,
        currentHP: Math.min(newCurrentHP, newMaxHP), // Cap at maxHP
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
