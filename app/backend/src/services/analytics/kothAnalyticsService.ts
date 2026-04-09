/**
 * KotH (King of the Hill) Analytics Service
 *
 * Retrieves cumulative KotH performance stats for a robot.
 */

import prisma from '../../lib/prisma';

export interface KothPerformance {
  robotId: number;
  robotName: string;
  kothMatches: number;
  kothWins: number;
  podiumRate: number;
  avgZoneScore: number;
  kothTotalZoneTime: number;
  kothKills: number;
  kothBestPlacement: number | null;
  kothCurrentWinStreak: number;
  kothBestWinStreak: number;
}

/**
 * Get KotH performance stats for a robot.
 * Returns null if the robot has no KotH data.
 */
export async function getKothPerformance(robotId: number): Promise<KothPerformance | null> {
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: {
      id: true,
      name: true,
      kothMatches: true,
      kothWins: true,
      kothTotalZoneScore: true,
      kothTotalZoneTime: true,
      kothKills: true,
      kothBestPlacement: true,
      kothCurrentWinStreak: true,
      kothBestWinStreak: true,
    },
  });

  if (!robot || robot.kothMatches === 0) {
    return null;
  }

  return {
    robotId: robot.id,
    robotName: robot.name,
    kothMatches: robot.kothMatches,
    kothWins: robot.kothWins,
    podiumRate:
      robot.kothMatches > 0
        ? Number(((robot.kothWins / robot.kothMatches) * 100).toFixed(1))
        : 0,
    avgZoneScore:
      robot.kothMatches > 0
        ? Number((robot.kothTotalZoneScore / robot.kothMatches).toFixed(1))
        : 0,
    kothTotalZoneTime: robot.kothTotalZoneTime,
    kothKills: robot.kothKills,
    kothBestPlacement: robot.kothBestPlacement,
    kothCurrentWinStreak: robot.kothCurrentWinStreak,
    kothBestWinStreak: robot.kothBestWinStreak,
  };
}
