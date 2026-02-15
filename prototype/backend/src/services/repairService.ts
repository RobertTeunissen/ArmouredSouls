import prisma from '../lib/prisma';
import { calculateRepairCost, calculateAttributeSum } from '../utils/robotCalculations';


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
 * @returns Summary of repairs performed
 */
export async function repairAllRobots(deductCosts: boolean = true): Promise<RepairSummary> {
  console.log(`[RepairService] Starting repair process (deductCosts: ${deductCosts})...`);

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
    console.log('[RepairService] No robots need repair');
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

  let totalBaseCost = 0;
  let totalFinalCost = 0;
  const userSummaries = [];

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
    
    // Query active robot count for multi-robot discount (exclude "Bye Robot")
    const activeRobotCount = await prisma.robot.count({
      where: {
        userId,
        NOT: { name: 'Bye Robot' }
      }
    });
    
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
        medicalBayLevel,
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
    }

    totalBaseCost += userBaseCost;
    totalFinalCost += userFinalCost;

    // Deduct costs if requested
    if (deductCosts && userFinalCost > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          currency: {
            decrement: userFinalCost,
          },
        },
      });
    }

    userSummaries.push({
      userId,
      robotsRepaired: userRobots.length,
      totalCost: userFinalCost,
      repairBayDiscount,
    });

    console.log(`[RepairService] User ${userId}: Repaired ${userRobots.length} robot(s) for ₡${userFinalCost.toLocaleString()} (${repairBayDiscount}% discount)`);
  }

  console.log(`[RepairService] Completed: ${robots.length} robots repaired, ₡${totalFinalCost.toLocaleString()} total cost`);

  return {
    robotsRepaired: robots.length,
    totalBaseCost,
    totalFinalCost,
    costsDeducted: deductCosts,
    userSummaries,
  };
}
