/**
 * Streaming Revenue Service
 * 
 * Calculates and awards streaming revenue for battles based on robot fame,
 * battle count, and Streaming Studio facility level.
 * 
 * Formula: 1000 × (1 + battles/1000) × (1 + fame/5000) × (1 + level×0.1)
 */

import prisma from '../lib/prisma';
import { trackStreamingRevenue } from './robotAnalyticsService';

/**
 * Streaming revenue calculation result for a single robot
 */
export interface StreamingRevenueCalculation {
  baseAmount: number;              // Always 1000
  battleMultiplier: number;        // 1 + (battles / 1000)
  fameMultiplier: number;          // 1 + (fame / 5000)
  studioMultiplier: number;        // 1 + (level * 0.1)
  totalRevenue: number;            // Final calculated amount
  robotId: number;                 // Robot that earned the revenue
  robotName: string;               // For logging
  robotBattles: number;            // Battle count used
  robotFame: number;               // Fame used
  studioLevel: number;             // Facility level used
}

/**
 * Streaming revenue calculation result for Tag Team battles
 */
export interface TagTeamStreamingCalculation {
  team1Revenue: StreamingRevenueCalculation;
  team2Revenue: StreamingRevenueCalculation;
  team1MaxBattlesRobot: { id: number; name: string; battles: number };
  team1MaxFameRobot: { id: number; name: string; fame: number };
  team2MaxBattlesRobot: { id: number; name: string; battles: number };
  team2MaxFameRobot: { id: number; name: string; fame: number };
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
 * Calculate streaming revenue for a 1v1 battle
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
      fame: true,
    },
  });

  if (!robot) {
    throw new Error(`Robot ${robotId} not found`);
  }

  // Get Streaming Studio level
  const studioLevel = await getStreamingStudioLevel(userId);

  // Calculate total battles including all battle types
  // Requirement 2.7: total battle count = 1v1 + Tag Team + Tournament
  // In schema: totalBattles = 1v1 + Tournament, totalTagTeamBattles = Tag Team
  const totalBattleCount = robot.totalBattles + robot.totalTagTeamBattles;

  // Calculate multipliers
  const baseAmount = 1000;
  const battleMultiplier = 1 + (totalBattleCount / 1000);
  const fameMultiplier = 1 + (robot.fame / 5000);
  const studioMultiplier = 1 + (studioLevel * 0.1);

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
 * Calculate streaming revenue for a Tag Team battle
 * Uses the highest battle count and highest fame from each team
 * @param team1RobotIds - Robot IDs for team 1 [active, reserve]
 * @param team1UserId - User ID for team 1
 * @param team2RobotIds - Robot IDs for team 2 [active, reserve]
 * @param team2UserId - User ID for team 2
 * @returns Streaming revenue calculations for both teams
 */
export async function calculateTagTeamStreamingRevenue(
  team1RobotIds: [number, number],
  team1UserId: number,
  team2RobotIds: [number, number],
  team2UserId: number
): Promise<TagTeamStreamingCalculation> {
  // Get robot data for both teams
  const [team1Robot1, team1Robot2, team2Robot1, team2Robot2] = await Promise.all([
    prisma.robot.findUnique({
      where: { id: team1RobotIds[0] },
      select: { id: true, name: true, totalBattles: true, totalTagTeamBattles: true, fame: true },
    }),
    prisma.robot.findUnique({
      where: { id: team1RobotIds[1] },
      select: { id: true, name: true, totalBattles: true, totalTagTeamBattles: true, fame: true },
    }),
    prisma.robot.findUnique({
      where: { id: team2RobotIds[0] },
      select: { id: true, name: true, totalBattles: true, totalTagTeamBattles: true, fame: true },
    }),
    prisma.robot.findUnique({
      where: { id: team2RobotIds[1] },
      select: { id: true, name: true, totalBattles: true, totalTagTeamBattles: true, fame: true },
    }),
  ]);

  if (!team1Robot1 || !team1Robot2 || !team2Robot1 || !team2Robot2) {
    throw new Error('One or more robots not found for Tag Team match');
  }

  // Get Streaming Studio levels for both users
  const [team1StudioLevel, team2StudioLevel] = await Promise.all([
    getStreamingStudioLevel(team1UserId),
    getStreamingStudioLevel(team2UserId),
  ]);

  // Calculate total battles for each robot (1v1 + Tournament + Tag Team)
  const team1Robot1TotalBattles = team1Robot1.totalBattles + team1Robot1.totalTagTeamBattles;
  const team1Robot2TotalBattles = team1Robot2.totalBattles + team1Robot2.totalTagTeamBattles;
  const team2Robot1TotalBattles = team2Robot1.totalBattles + team2Robot1.totalTagTeamBattles;
  const team2Robot2TotalBattles = team2Robot2.totalBattles + team2Robot2.totalTagTeamBattles;

  // Find max battles and max fame for team 1
  const team1MaxBattlesRobot =
    team1Robot1TotalBattles >= team1Robot2TotalBattles
      ? { id: team1Robot1.id, name: team1Robot1.name, battles: team1Robot1TotalBattles }
      : { id: team1Robot2.id, name: team1Robot2.name, battles: team1Robot2TotalBattles };

  const team1MaxFameRobot =
    team1Robot1.fame >= team1Robot2.fame
      ? { id: team1Robot1.id, name: team1Robot1.name, fame: team1Robot1.fame }
      : { id: team1Robot2.id, name: team1Robot2.name, fame: team1Robot2.fame };

  // Find max battles and max fame for team 2
  const team2MaxBattlesRobot =
    team2Robot1TotalBattles >= team2Robot2TotalBattles
      ? { id: team2Robot1.id, name: team2Robot1.name, battles: team2Robot1TotalBattles }
      : { id: team2Robot2.id, name: team2Robot2.name, battles: team2Robot2TotalBattles };

  const team2MaxFameRobot =
    team2Robot1.fame >= team2Robot2.fame
      ? { id: team2Robot1.id, name: team2Robot1.name, fame: team2Robot1.fame }
      : { id: team2Robot2.id, name: team2Robot2.name, fame: team2Robot2.fame };

  // Calculate streaming revenue for team 1
  const baseAmount = 1000;
  const team1BattleMultiplier = 1 + (team1MaxBattlesRobot.battles / 1000);
  const team1FameMultiplier = 1 + (team1MaxFameRobot.fame / 5000);
  const team1StudioMultiplier = 1 + (team1StudioLevel * 0.1);
  const team1TotalRevenue = Math.floor(
    baseAmount * team1BattleMultiplier * team1FameMultiplier * team1StudioMultiplier
  );

  // Calculate streaming revenue for team 2
  const team2BattleMultiplier = 1 + (team2MaxBattlesRobot.battles / 1000);
  const team2FameMultiplier = 1 + (team2MaxFameRobot.fame / 5000);
  const team2StudioMultiplier = 1 + (team2StudioLevel * 0.1);
  const team2TotalRevenue = Math.floor(
    baseAmount * team2BattleMultiplier * team2FameMultiplier * team2StudioMultiplier
  );

  return {
    team1Revenue: {
      baseAmount,
      battleMultiplier: team1BattleMultiplier,
      fameMultiplier: team1FameMultiplier,
      studioMultiplier: team1StudioMultiplier,
      totalRevenue: team1TotalRevenue,
      robotId: team1MaxBattlesRobot.id, // Use max battles robot as representative
      robotName: `Team 1 (${team1Robot1.name} & ${team1Robot2.name})`,
      robotBattles: team1MaxBattlesRobot.battles,
      robotFame: team1MaxFameRobot.fame,
      studioLevel: team1StudioLevel,
    },
    team2Revenue: {
      baseAmount,
      battleMultiplier: team2BattleMultiplier,
      fameMultiplier: team2FameMultiplier,
      studioMultiplier: team2StudioMultiplier,
      totalRevenue: team2TotalRevenue,
      robotId: team2MaxBattlesRobot.id, // Use max battles robot as representative
      robotName: `Team 2 (${team2Robot1.name} & ${team2Robot2.name})`,
      robotBattles: team2MaxBattlesRobot.battles,
      robotFame: team2MaxFameRobot.fame,
      studioLevel: team2StudioLevel,
    },
    team1MaxBattlesRobot,
    team1MaxFameRobot,
    team2MaxBattlesRobot,
    team2MaxFameRobot,
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
  cycleNumber: number
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

  // Track streaming revenue for analytics
  await trackStreamingRevenue(
    calculation.robotId,
    cycleNumber,
    calculation.totalRevenue
  );
}
