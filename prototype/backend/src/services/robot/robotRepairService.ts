/**
 * Robot repair logic.
 *
 * Extracted from the POST /repair-all route handler.
 */

import prisma from '../../lib/prisma';
import { lockUserForSpending } from '../../lib/creditGuard';
import { RobotError, RobotErrorCode } from '../../errors/robotErrors';

const REPAIR_COST_PER_HP = 50;
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
 * Returns the result data needed for the response and event logging.
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
  const activeRobotCount = allRobots.filter(r => r.name !== 'Bye Robot').length;
  const discount = Math.min(90, repairBayLevel * (5 + activeRobotCount));

  const robotsNeedingRepair: RobotNeedingRepair[] = allRobots
    .map(robot => {
      let repairCost = 0;
      if (robot.repairCost > 0) {
        repairCost = robot.repairCost;
      } else if (robot.currentHP < robot.maxHP) {
        repairCost = (robot.maxHP - robot.currentHP) * REPAIR_COST_PER_HP;
      }
      return { ...robot, calculatedRepairCost: repairCost } as RobotNeedingRepair;
    })
    .filter(robot => robot.calculatedRepairCost > 0);

  if (robotsNeedingRepair.length === 0) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'No robots need repair', 400);
  }

  const totalBaseCost = robotsNeedingRepair.reduce((sum, r) => sum + r.calculatedRepairCost, 0);
  const costAfterRepairBay = Math.floor(totalBaseCost * (1 - discount / 100));
  const finalCost = Math.floor(costAfterRepairBay * MANUAL_REPAIR_DISCOUNT);

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
        const perRobotCostAfterRepairBay = Math.floor(robot.calculatedRepairCost * (1 - discount / 100));
        const perRobotFinalCost = Math.floor(perRobotCostAfterRepairBay * MANUAL_REPAIR_DISCOUNT);
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

  return {
    repairedCount: robotsNeedingRepair.length,
    totalBaseCost,
    discount,
    manualRepairDiscount: 50,
    preDiscountCost: costAfterRepairBay,
    finalCost,
    newCurrency: result.currency,
    robotsNeedingRepair,
  };
}
