import prisma from '../../lib/prisma';
import { calculateRepairCost, calculateAttributeSum } from '../../utils/robotCalculations';
import { eventLogger } from '../common/eventLogger';
import logger from '../../config/logger';



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

/**
 * Repair all robots that need repair, optionally deducting costs from user balances
 * Uses the proper repair cost formula from PRD_ECONOMY_SYSTEM.md:
 * base_repair = (sum_of_all_23_attributes × 100)
 * damage_percentage = damage_taken / max_hp
 * multiplier = 2.0 if HP=0, 1.5 if HP<10%, else 1.0
 * repair_cost = base_repair × damage_percentage × multiplier × (1 - repair_bay_discount)
 * 
 * @param deductCosts - Whether to deduct repair costs from user currency
 * @param cycleNumber - The current cycle number for logging (optional, will query if not provided)
 * @returns Summary of repairs performed
 */
export async function repairAllRobots(deductCosts: boolean = true, cycleNumber?: number): Promise<RepairSummary> {
  // Get all robots that need repair with all attributes for cost calculation
  const robots = await prisma.robot.findMany({
    where: {
      currentHP: {
        lt: prisma.robot.fields.maxHP,
      },
      NOT: {
        name: 'Bye Robot',
      },
    },
  });

  if (robots.length === 0) {
    return {
      robotsRepaired: 0,
      totalBaseCost: 0,
      totalFinalCost: 0,
      costsDeducted: deductCosts,
      userSummaries: [],
    };
  }

  // Group robots by user to apply facility discounts
  const robotsByUser = new Map<number, typeof robots>();
  for (const robot of robots) {
    if (!robotsByUser.has(robot.userId)) {
      robotsByUser.set(robot.userId, []);
    }
    robotsByUser.get(robot.userId)!.push(robot);
  }

  // Batch-load all facilities and robot counts for all affected users (2 queries instead of 2N)
  const affectedUserIds = Array.from(robotsByUser.keys());
  const [allFacilities, robotCounts] = await Promise.all([
    prisma.facility.findMany({
      where: {
        userId: { in: affectedUserIds },
        facilityType: 'repair_bay',
      },
    }),
    prisma.robot.groupBy({
      by: ['userId'],
      where: {
        userId: { in: affectedUserIds },
        NOT: { name: 'Bye Robot' },
      },
      _count: { id: true },
    }),
  ]);

  // Build lookup maps
  const facilitiesByUser = new Map<number, typeof allFacilities>();
  for (const f of allFacilities) {
    if (!facilitiesByUser.has(f.userId)) facilitiesByUser.set(f.userId, []);
    facilitiesByUser.get(f.userId)!.push(f);
  }
  const robotCountByUser = new Map(robotCounts.map(r => [r.userId, r._count.id]));

  let totalBaseCost = 0;
  let totalFinalCost = 0;
  const userSummaries: RepairSummary['userSummaries'] = [];

  // Collect all DB operations for batching
  const robotUpdates: ReturnType<typeof prisma.robot.update>[] = [];
  const userDeductions: ReturnType<typeof prisma.user.update>[] = [];
  const repairEvents: Array<{
    userId: number;
    robotId: number;
    robotName: string;
    repairCost: number;
    damageTaken: number;
    repairBayDiscount: number;
  }> = [];

  for (const [userId, userRobots] of robotsByUser.entries()) {
    const facilities = facilitiesByUser.get(userId) || [];

    const repairBay = facilities.find(f => f.facilityType === 'repair_bay');
    
    const repairBayLevel = repairBay?.level || 0;
    const activeRobotCount = robotCountByUser.get(userId) || 0;
    
    // Calculate discount using new formula: repairBayLevel × (5 + activeRobotCount), capped at 90%
    const rawDiscount = repairBayLevel * (5 + activeRobotCount);
    const repairBayDiscount = Math.min(rawDiscount, 90);

    let userBaseCost = 0;
    let userFinalCost = 0;

    for (const robot of userRobots) {
      // Calculate sum of all 23 attributes
      const sumOfAllAttributes = calculateAttributeSum(robot);
      
      // Calculate damage percentage
      const damageTaken = robot.maxHP - robot.currentHP;
      const damagePercent = (damageTaken / robot.maxHP) * 100;
      
      // Calculate HP percentage for multiplier
      const hpPercent = (robot.currentHP / robot.maxHP) * 100;
      
      // Use the proper repair cost formula
      const repairCost = calculateRepairCost(
        sumOfAllAttributes,
        damagePercent,
        hpPercent,
        repairBayLevel,
        0,
        activeRobotCount
      );
      
      // Calculate base cost (without discounts) for reporting
      const baseRepairCost = sumOfAllAttributes * 100;
      let multiplier = 1.0;
      if (hpPercent === 0) {
        multiplier = 2.0;
      } else if (hpPercent < 10) {
        multiplier = 1.5;
      }
      const baseCost = Math.round(baseRepairCost * (damagePercent / 100) * multiplier);

      userBaseCost += baseCost;
      userFinalCost += repairCost;

      // Collect robot update for batching
      robotUpdates.push(prisma.robot.update({
        where: { id: robot.id },
        data: {
          currentHP: robot.maxHP,
          currentShield: robot.maxShield,
          repairCost: 0,
          battleReadiness: 100,
          totalRepairsPaid: {
            increment: repairCost,
          },
        },
      }));

      // Collect repair event data for logging after transaction
      repairEvents.push({
        userId,
        robotId: robot.id,
        robotName: robot.name,
        repairCost,
        damageTaken,
        repairBayDiscount,
      });
    }

    totalBaseCost += userBaseCost;
    totalFinalCost += userFinalCost;

    // Collect user currency deduction for batching
    if (deductCosts && userFinalCost > 0) {
      userDeductions.push(prisma.user.update({
        where: { id: userId },
        data: {
          currency: {
            decrement: userFinalCost,
          },
        },
      }));
    }

    userSummaries.push({
      userId,
      robotsRepaired: userRobots.length,
      totalCost: userFinalCost,
      repairBayDiscount,
    });
  }

  // Execute robot updates and user deductions in chunked transactions
  // to avoid exceeding Prisma's interactive transaction timeout on large rosters.
  const CHUNK_SIZE = 200;
  for (let i = 0; i < robotUpdates.length; i += CHUNK_SIZE) {
    const chunk = robotUpdates.slice(i, i + CHUNK_SIZE);
    await prisma.$transaction(chunk, { timeout: 30000 });
  }
  for (let i = 0; i < userDeductions.length; i += CHUNK_SIZE) {
    const chunk = userDeductions.slice(i, i + CHUNK_SIZE);
    await prisma.$transaction(chunk, { timeout: 30000 });
  }

  // Log repair events sequentially (audit trail, non-critical)
  for (const event of repairEvents) {
    try {
      await eventLogger.logRobotRepair(
        event.userId,
        event.robotId,
        event.repairCost,
        event.damageTaken,
        event.repairBayDiscount,
        cycleNumber,
        'automatic'
      );
      
      logger.info(`[RepairService] | User ${event.userId} | Robot ${event.robotId} (${event.robotName}) | Cost: ₡${event.repairCost.toLocaleString()} | Discount: ${event.repairBayDiscount}%`);
    } catch (logError) {
      logger.error(`[RepairService] | ERROR | User ${event.userId} | Robot ${event.robotId} | Failed to log repair event:`, logError instanceof Error ? logError.message : logError);
    }
  }

  return {
    robotsRepaired: robots.length,
    totalBaseCost,
    totalFinalCost,
    costsDeducted: deductCosts,
    userSummaries,
  };
}
