/**
 * Streaming Revenue Service
 * 
 * Calculates and awards streaming revenue for battles based on robot fame,
 * battle count, and Streaming Studio facility level.
 * 
 * Formula: 1000 × (1 + battles/1000) × (1 + fame/5000) × (1 + level×1.0)
 * 
 * Studio Multiplier: Each level adds 100% (L1 = 2×, L2 = 3×, L3 = 4×, etc.)
 */

import prisma from '../lib/prisma';

/**
 * Streaming revenue calculation result for a single robot
 */
export interface StreamingRevenueCalculation {
  baseAmount: number;              // Always 1000
  battleMultiplier: number;        // 1 + (battles / 1000)
  fameMultiplier: number;          // 1 + (fame / 5000)
  studioMultiplier: number;        // 1 + (level * 1.0) - Each level doubles, triples, etc.
  totalRevenue: number;            // Final calculated amount
  robotId: number;                 // Robot that earned the revenue
  robotName: string;               // For logging
  robotBattles: number;            // Battle count used
  robotFame: number;               // Fame used
  studioLevel: number;             // Facility level used
}

/**
 * Get the Streaming Studio level for a user
 * @param userId - User ID to query
 * @returns Streaming Studio level (0-10), or 0 if not found
 */
export async function getStreamingStudioLevel(userId: number): Promise<number> {
  const facility = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId,
        facilityType: 'streaming_studio',
      },
    },
  });

  return facility?.level ?? 0;
}

/**
 * Calculate streaming revenue for a single robot in any battle type.
 * Used by all orchestrators via awardStreamingRevenueForParticipant() in battlePostCombat.
 * @param robotId - Robot ID
 * @param userId - User ID (owner of the robot)
 * @param isByeMatch - Whether this is a bye match (no revenue awarded)
 * @returns Streaming revenue calculation, or null if bye match
 */
export async function calculateStreamingRevenue(
  robotId: number,
  userId: number,
  isByeMatch: boolean
): Promise<StreamingRevenueCalculation | null> {
  // No streaming revenue for bye matches
  if (isByeMatch) {
    return null;
  }

  // Get robot data
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: {
      id: true,
      name: true,
      totalBattles: true,
      totalTagTeamBattles: true,
      kothMatches: true,
      fame: true,
    },
  });

  if (!robot) {
    throw new Error(`Robot ${robotId} not found`);
  }

  // Get Streaming Studio level
  const studioLevel = await getStreamingStudioLevel(userId);

  // Calculate total battles including all battle types
  // A battle is a battle — all modes count toward the streaming battle multiplier
  // In schema: totalBattles = 1v1 + Tournament, totalTagTeamBattles = Tag Team, kothMatches = KotH
  const totalBattleCount = robot.totalBattles + robot.totalTagTeamBattles + robot.kothMatches;

  // Calculate multipliers
  const baseAmount = 1000;
  const battleMultiplier = 1 + (totalBattleCount / 1000);
  const fameMultiplier = 1 + (robot.fame / 5000);
  const studioMultiplier = 1 + (studioLevel * 1.0); // 100% per level: L1=2×, L2=3×, L3=4×, etc.

  // Calculate total revenue
  const totalRevenue = Math.floor(
    baseAmount * battleMultiplier * fameMultiplier * studioMultiplier
  );

  return {
    baseAmount,
    battleMultiplier,
    fameMultiplier,
    studioMultiplier,
    totalRevenue,
    robotId: robot.id,
    robotName: robot.name,
    robotBattles: totalBattleCount,
    robotFame: robot.fame,
    studioLevel,
  };
}

/**
 * Award streaming revenue to a user's balance and track analytics
 * @param userId - User ID to award revenue to
 * @param calculation - Streaming revenue calculation result
 * @param cycleNumber - Current cycle number for analytics tracking
 */
export async function awardStreamingRevenue(
  userId: number,
  calculation: StreamingRevenueCalculation,
  _cycleNumber: number
): Promise<void> {
  // Update user balance
  await prisma.user.update({
    where: { id: userId },
    data: {
      currency: {
        increment: calculation.totalRevenue,
      },
    },
  });

  // Streaming revenue is tracked in BattleParticipant table
}
