/**
 * Robot Analytics Service
 * 
 * Tracks and retrieves streaming revenue analytics per robot per cycle.
 * Provides data for robot performance analysis and streaming revenue trends.
 */

import prisma from '../lib/prisma';

/**
 * Robot streaming analytics data
 */
export interface RobotStreamingAnalytics {
  robotId: number;
  totalStreamingRevenue: number;
  averageRevenuePerBattle: number;
  revenueByCycle: { cycleNumber: number; revenue: number }[];
  currentBattleMultiplier: number;
  currentFameMultiplier: number;
  currentStudioMultiplier: number;
}

/**
 * Track streaming revenue earned by a robot in a cycle
 * @param robotId - Robot ID
 * @param cycleNumber - Cycle number
 * @param revenue - Streaming revenue earned
 */
export async function trackStreamingRevenue(
  robotId: number,
  cycleNumber: number,
  revenue: number
): Promise<void> {
  // Check if record already exists for this robot and cycle
  const existing = await prisma.robotStreamingRevenue.findUnique({
    where: {
      robotId_cycleNumber: {
        robotId,
        cycleNumber,
      },
    },
  });

  if (existing) {
    // Update existing record by adding to the revenue and incrementing battles
    await prisma.robotStreamingRevenue.update({
      where: {
        robotId_cycleNumber: {
          robotId,
          cycleNumber,
        },
      },
      data: {
        streamingRevenue: {
          increment: revenue,
        },
        battlesInCycle: {
          increment: 1,
        },
      },
    });
  } else {
    // Create new record
    await prisma.robotStreamingRevenue.create({
      data: {
        robotId,
        cycleNumber,
        streamingRevenue: revenue,
        battlesInCycle: 1,
      },
    });
  }
}

/**
 * Get streaming revenue analytics for a robot
 * @param robotId - Robot ID
 * @returns Robot streaming analytics
 */
export async function getRobotStreamingAnalytics(
  robotId: number
): Promise<RobotStreamingAnalytics> {
  // Get robot data for current multipliers
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: {
      id: true,
      userId: true,
      totalBattles: true,
      totalTagTeamBattles: true,
      fame: true,
    },
  });

  if (!robot) {
    throw new Error(`Robot ${robotId} not found`);
  }

  // Get Streaming Studio level for the robot's stable
  const facility = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId: robot.userId,
        facilityType: 'streaming_studio',
      },
    },
  });

  const studioLevel = facility?.level ?? 0;

  // Calculate current multipliers
  const totalBattleCount = robot.totalBattles + robot.totalTagTeamBattles;
  const currentBattleMultiplier = 1 + (totalBattleCount / 1000);
  const currentFameMultiplier = 1 + (robot.fame / 5000);
  const currentStudioMultiplier = 1 + (studioLevel * 0.1);

  // Get all streaming revenue records for this robot
  const revenueRecords = await prisma.robotStreamingRevenue.findMany({
    where: { robotId },
    orderBy: { cycleNumber: 'asc' },
  });

  // Calculate total streaming revenue
  const totalStreamingRevenue = revenueRecords.reduce(
    (sum, record) => sum + record.streamingRevenue,
    0
  );

  // Calculate total battles in all cycles
  const totalBattlesInCycles = revenueRecords.reduce(
    (sum, record) => sum + record.battlesInCycle,
    0
  );

  // Calculate average revenue per battle
  const averageRevenuePerBattle =
    totalBattlesInCycles > 0 ? totalStreamingRevenue / totalBattlesInCycles : 0;

  // Format revenue by cycle
  const revenueByCycle = revenueRecords.map((record) => ({
    cycleNumber: record.cycleNumber,
    revenue: record.streamingRevenue,
  }));

  return {
    robotId,
    totalStreamingRevenue,
    averageRevenuePerBattle,
    revenueByCycle,
    currentBattleMultiplier,
    currentFameMultiplier,
    currentStudioMultiplier,
  };
}
