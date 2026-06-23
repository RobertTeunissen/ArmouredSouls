/**
 * Robot repair logic.
 *
 * Extracted from the POST /repair-all route handler.
 * Uses the same formula as automatic repair (PRD_ECONOMY_SYSTEM.md) with
 * a 50% manual repair discount as incentive for players to repair between cycles.
 */

import prisma from '../../lib/prisma';
import { lockUserForSpending } from '../../lib/creditGuard';
import { RobotError, RobotErrorCode } from '../../errors/robotErrors';
import { calculateRepairCost, calculateAttributeSum } from '../../utils/robotCalculations';

const MANUAL_REPAIR_DISCOUNT = 0.5;

interface RobotNeedingRepair {
  id: number;
  name: string;
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  repairCost: number;
  calculatedRepairCost: number;
}

export interface RepairAllResult {
  repairedCount: number;
  totalBaseCost: number;
  discount: number;
  manualRepairDiscount: number;
  preDiscountCost: number;
  finalCost: number;
  newCurrency: number;
  robotsNeedingRepair: RobotNeedingRepair[];
}

/**
 * Repair all damaged robots for a user.
 * Uses the same cost formula as automatic repair (attribute-based) with 50% manual discount.
 */
export async function repairAllRobots(userId: number): Promise<RepairAllResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'User not found', 404);
  }

  const repairBay = await prisma.facility.findUnique({
    where: { userId_facilityType: { userId, facilityType: 'repair_bay' } },
  });
  const repairBayLevel = repairBay?.level || 0;

  const allRobots = await prisma.robot.findMany({ where: { userId } });
  const activeRobotCount = allRobots.length;

  const robotsNeedingRepair: RobotNeedingRepair[] = allRobots
    .filter(robot => robot.currentHP < robot.maxHP)
    .map(robot => {
      // Use the same formula as automatic repair: attribute-based cost with repair bay discount
      const sumOfAllAttributes = calculateAttributeSum(robot);
      const damageTaken = robot.maxHP - robot.currentHP;
      const damagePercent = (damageTaken / robot.maxHP) * 100;
      const hpPercent = (robot.currentHP / robot.maxHP) * 100;

      const autoRepairCost = calculateRepairCost(
        sumOfAllAttributes,
        damagePercent,
        hpPercent,
        repairBayLevel,
        0,
        activeRobotCount
      );

      return { ...robot, calculatedRepairCost: autoRepairCost } as RobotNeedingRepair;
    })
    .filter(robot => robot.calculatedRepairCost > 0);

  if (robotsNeedingRepair.length === 0) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'No robots need repair', 400);
  }

  // Total cost before manual discount (same as what automatic repair would charge)
  const totalBaseCost = robotsNeedingRepair.reduce((sum, r) => sum + r.calculatedRepairCost, 0);
  // Apply 50% manual repair discount
  const finalCost = Math.floor(totalBaseCost * MANUAL_REPAIR_DISCOUNT);

  const result = await prisma.$transaction(async (tx) => {
    const lockedUser = await lockUserForSpending(tx, userId);

    if (lockedUser.currency < finalCost) {
      throw new RobotError(
        RobotErrorCode.INVALID_ROBOT_ATTRIBUTES,
        'Insufficient credits for manual repair',
        400,
        { required: finalCost, available: lockedUser.currency },
      );
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { currency: { decrement: finalCost } },
    });

    await Promise.all(
      robotsNeedingRepair.map(robot => {
        const perRobotFinalCost = Math.floor(robot.calculatedRepairCost * MANUAL_REPAIR_DISCOUNT);
        return tx.robot.update({
          where: { id: robot.id },
          data: {
            currentHP: robot.maxHP,
            currentShield: robot.maxShield,
            repairCost: 0,
            battleReadiness: 100,
            totalRepairsPaid: { increment: perRobotFinalCost },
          },
        });
      }),
    );

    return updatedUser;
  });

  // Repair bay discount is already baked into calculatedRepairCost via calculateRepairCost()
  const repairBayDiscount = Math.min(90, repairBayLevel * (5 + activeRobotCount));

  return {
    repairedCount: robotsNeedingRepair.length,
    totalBaseCost,
    discount: repairBayDiscount,
    manualRepairDiscount: 50,
    preDiscountCost: totalBaseCost,
    finalCost,
    newCurrency: result.currency,
    robotsNeedingRepair,
  };
}
