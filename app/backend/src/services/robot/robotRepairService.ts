/**
 * Robot repair logic — the Manual_Repair_Path.
 *
 * Manual repair is one atomic operation: the per-robot financial pair, the
 * subtype-bearing robot_repair source row, robot state, lifetime spend and user
 * balance all commit or roll back together.
 */

import prisma from '../../lib/prisma';
import { lockUserForSpending } from '../../lib/creditGuard';
import { RobotError, RobotErrorCode } from '../../errors/robotErrors';
import { calculateAttributeSum } from '../../utils/robotCalculations';
import {
  calculateRepairQuote,
  applyManualRepairDiscount,
  calculateRepairBayDiscountPercent,
} from '../../shared/utils/repairCost';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import {
  applyRepairCreditMutationInTransaction,
  buildRepairOperationId,
} from '../financial/repairMutationService';

interface RobotNeedingRepair {
  id: number;
  name: string;
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  /** The Cached_Repair_Quote column. Recomputed below, so read only for completeness. */
  repairQuoteCredits: number;
  /** The Repair_Quote computed now: post-Repair-Bay-discount, pre-manual-discount. */
  calculatedRepairCost: number;
}

/** What one robot in a manual batch is actually charged. */
export interface RobotChargedAmount {
  robotId: number;
  charged: number;
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
  /** Per-robot charged amounts, in the same order as `robotsNeedingRepair`. */
  chargedPerRobot: RobotChargedAmount[];
}

/**
 * Repair all damaged robots for a user.
 *
 * The operation keeps the existing response figures and negative-balance rule,
 * but moves all required writes into one transaction. Quote arithmetic remains
 * entirely in the shared repair module and is captured before the batch sum.
 */
export async function repairAllRobots(userId: number): Promise<RepairAllResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'User not found', 404);
  }

  const cycleNumber = await getCurrentCycleNumber();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock before reading the damaged roster so overlapping manual requests
      // cannot quote the same robot and then charge it twice.
      const lockedUser = await lockUserForSpending(tx, userId);
      const repairBay = await tx.facility.findUnique({
        where: { userId_facilityType: { userId, facilityType: 'repair_bay' } },
      });
      const repairBayLevel = repairBay?.level || 0;
      const allRobots = await tx.robot.findMany({ where: { userId } });
      const activeRobotCount = allRobots.length;
      const bayContext = { repairBayLevel, activeRobotCount };

      const quotedRobots = allRobots
        .filter((robot) => robot.currentHP < robot.maxHP)
        .map((robot) => {
          const attributeTotal = calculateAttributeSum(robot);
          const damageRepaired = robot.maxHP - robot.currentHP;
          const damagePercent = (damageRepaired / robot.maxHP) * 100;
          const hpPercent = (robot.currentHP / robot.maxHP) * 100;
          const quoteBeforeManualDiscount = calculateRepairQuote(
            { attributeTotal, damagePercent, hpPercent },
            bayContext,
          );
          const baseQuote = calculateRepairQuote(
            { attributeTotal, damagePercent, hpPercent },
            { repairBayLevel: 0, activeRobotCount: 0 },
          );

          return {
            robot,
            attributeTotal,
            damageRepaired,
            damagePercent,
            hpPercent,
            baseQuote,
            quoteBeforeManualDiscount,
          };
        })
        .filter((entry) => entry.quoteBeforeManualDiscount > 0);

      if (quotedRobots.length === 0) {
        throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'No robots need repair', 400);
      }

      const operationId = buildRepairOperationId(
        'manual',
        cycleNumber,
        userId,
        quotedRobots.map(({ robot }) => robot),
      );
      const repairBayDiscount = calculateRepairBayDiscountPercent(bayContext);
      const chargedPerRobot = quotedRobots.map((entry) => ({
        robotId: entry.robot.id,
        charged: applyManualRepairDiscount(entry.quoteBeforeManualDiscount),
      }));
      const chargedByRobotId = new Map(chargedPerRobot.map((entry) => [entry.robotId, entry.charged]));
      const totalBaseCost = quotedRobots.reduce(
        (sum, entry) => sum + entry.quoteBeforeManualDiscount,
        0,
      );
      const finalCost = chargedPerRobot.reduce((sum, entry) => sum + entry.charged, 0);

      let newCurrency = lockedUser.currency;
      for (const entry of quotedRobots) {
        const charge = chargedByRobotId.get(entry.robot.id) ?? 0;
        const financialResult = await applyRepairCreditMutationInTransaction({
          tx,
          cycleNumber,
          operationId,
          userId,
          robotId: entry.robot.id,
          repairType: 'manual',
          charge,
          description: `Manual repair of 1 robot (batch of ${quotedRobots.length})`,
          baseQuote: entry.baseQuote,
          damageRepaired: entry.damageRepaired,
          repairBayLevel,
          activeRobotCount,
          repairBayDiscountPercent: repairBayDiscount,
          manualRepairDiscountPercent: 50,
          quoteBeforeManualDiscount: entry.quoteBeforeManualDiscount,
          attributeTotal: entry.attributeTotal,
          damagePercent: entry.damagePercent,
          hpPercent: entry.hpPercent,
          auditContext: {
            operationType: 'manual_repair',
            batchSize: quotedRobots.length,
            repairType: 'manual',
          },
        });
        newCurrency = financialResult.balanceAfter;

        // An identical committed identity is a retry, not a second repair. A
        // fresh operation gets a new fingerprint when the robot is damaged again.
        if (financialResult.created) {
          await tx.robot.update({
            where: { id: entry.robot.id },
            data: {
              currentHP: entry.robot.maxHP,
              currentShield: entry.robot.maxShield,
              repairQuoteCredits: 0,
              battleReadiness: 100,
              lifetimeRepairCreditsPaid: { increment: charge },
            },
          });
        }
      }

      return {
        repairedCount: quotedRobots.length,
        totalBaseCost,
        repairBayDiscount,
        finalCost,
        newCurrency,
        chargedPerRobot,
        robotsNeedingRepair: quotedRobots.map((entry) => ({
          ...entry.robot,
          calculatedRepairCost: entry.quoteBeforeManualDiscount,
        })) as RobotNeedingRepair[],
      };
    });

    return {
      repairedCount: result.repairedCount,
      totalBaseCost: result.totalBaseCost,
      discount: result.repairBayDiscount,
      manualRepairDiscount: 50,
      preDiscountCost: result.totalBaseCost,
      finalCost: result.finalCost,
      newCurrency: result.newCurrency,
      robotsNeedingRepair: result.robotsNeedingRepair,
      chargedPerRobot: result.chargedPerRobot,
    };
  } catch (error) {
    if (error instanceof RangeError) {
      throw new RobotError(
        RobotErrorCode.INVALID_ROBOT_ATTRIBUTES,
        `Cannot price repair: ${error.message}`,
        400,
      );
    }
    throw error;
  }
}
