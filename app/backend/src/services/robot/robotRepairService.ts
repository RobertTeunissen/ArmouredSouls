/**
 * Robot repair logic — the Manual_Repair_Path.
 *
 * Extracted from the POST /repair-all route handler. Prices repairs with the same
 * formula as automatic repair (PRD_ECONOMY_SYSTEM.md § 5) and then applies the
 * manual repair discount, which exists to reward repairing before a robot's next
 * scheduled match rather than letting the pre-battle cron do it.
 *
 * Spec #48 Requirement 15: pricing comes from the Shared_Repair_Module and
 * nowhere else. Criteria 11 and 12 make the charge per-robot-then-sum rather than
 * a single floor on the batch total, because the per-robot figure is the one that
 * reconciles with the per-robot audit, lifetime and ledger records.
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
  /**
   * Per-robot charged amounts, in the same order as `robotsNeedingRepair`.
   *
   * Exposed so the route can write audit rows and ledger entries without
   * recomputing anything — Spec #48 Requirement 18 criterion 1 and Requirement 16
   * criterion 3 both need the exact figure charged for each robot, and recomputing
   * it at the call site is how the double-discount bug got written in the first
   * place.
   */
  chargedPerRobot: RobotChargedAmount[];
}

/**
 * Repair all damaged robots for a user.
 *
 * Throws `RobotError(INVALID_ROBOT_ATTRIBUTES)` if the Shared_Repair_Module
 * rejects a robot's attributes — it signals bad input with a plain `RangeError`
 * because the frontend imports it too, so the translation happens here
 * (Requirement 15 criterion 17).
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
  const bayContext = { repairBayLevel, activeRobotCount };

  let robotsNeedingRepair: RobotNeedingRepair[];
  try {
    robotsNeedingRepair = allRobots
      .filter(robot => robot.currentHP < robot.maxHP)
      .map(robot => {
        const sumOfAllAttributes = calculateAttributeSum(robot);
        const damageTaken = robot.maxHP - robot.currentHP;
        const damagePercent = (damageTaken / robot.maxHP) * 100;
        const hpPercent = (robot.currentHP / robot.maxHP) * 100;

        const quote = calculateRepairQuote(
          { attributeTotal: sumOfAllAttributes, damagePercent, hpPercent },
          bayContext,
        );

        return { ...robot, calculatedRepairCost: quote } as RobotNeedingRepair;
      })
      .filter(robot => robot.calculatedRepairCost > 0);
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

  if (robotsNeedingRepair.length === 0) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'No robots need repair', 400);
  }

  // Sum of Repair_Quotes — what automatic repair would have charged.
  const totalBaseCost = robotsNeedingRepair.reduce((sum, r) => sum + r.calculatedRepairCost, 0);

  // Requirement 15 criteria 11 and 12: quote each robot, discount each robot, THEN
  // sum. The previous code applied one floor to the batch total for the deduction
  // and a separate floor per robot for the lifetime increment, so the two could
  // disagree by up to N-1 credits for N robots. One figure now feeds all four
  // records: the deduction, the lifetime total, the audit row and the ledger entry.
  const chargedPerRobot: RobotChargedAmount[] = robotsNeedingRepair.map(robot => ({
    robotId: robot.id,
    charged: applyManualRepairDiscount(robot.calculatedRepairCost),
  }));
  const finalCost = chargedPerRobot.reduce((sum, entry) => sum + entry.charged, 0);

  const chargedByRobotId = new Map(chargedPerRobot.map(e => [e.robotId, e.charged]));

  const result = await prisma.$transaction(async (tx) => {
    // Acquire row lock to serialize concurrent spending transactions
    await lockUserForSpending(tx, userId);

    // Allow manual repair even if the player cannot fully afford it.
    // Manual repair grants a discount over automatic end-of-cycle repair,
    // so blocking it would punish active players by forcing them into the
    // more expensive auto-repair path. This is the only player action that
    // may result in a negative credit balance.

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { currency: { decrement: finalCost } },
    });

    await Promise.all(
      robotsNeedingRepair.map(robot => {
        const perRobotFinalCost = chargedByRobotId.get(robot.id) ?? 0;
        return tx.robot.update({
          where: { id: robot.id },
          data: {
            currentHP: robot.maxHP,
            currentShield: robot.maxShield,
            repairQuoteCredits: 0,
            battleReadiness: 100,
            lifetimeRepairCreditsPaid: { increment: perRobotFinalCost },
          },
        });
      }),
    );

    return updatedUser;
  });

  // The Repair Bay discount is already baked into each `calculatedRepairCost` by
  // `calculateRepairQuote`. It is returned here as a RECORD of what applied, not
  // as something for a caller to apply again — doing exactly that in
  // `routes/robots.ts` is the bug Requirement 18 fixes.
  const repairBayDiscount = calculateRepairBayDiscountPercent(bayContext);

  return {
    repairedCount: robotsNeedingRepair.length,
    totalBaseCost,
    discount: repairBayDiscount,
    manualRepairDiscount: 50,
    preDiscountCost: totalBaseCost,
    finalCost,
    newCurrency: result.currency,
    robotsNeedingRepair,
    chargedPerRobot,
  };
}
