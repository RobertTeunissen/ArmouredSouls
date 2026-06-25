/**
 * KotH (King of the Hill) Analytics Service
 *
 * Retrieves cumulative KotH performance stats for a robot
 * from the unified standings table (mode = 'koth').
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
 * Reads from the unified standings table (Spec #40).
 * Returns null if the robot has no KotH standings entry or zero matches.
 */
export async function getKothPerformance(robotId: number): Promise<KothPerformance | null> {
  const [robot, standing] = await Promise.all([
    prisma.robot.findUnique({
      where: { id: robotId },
      select: { id: true, name: true },
    }),
    prisma.standing.findUnique({
      where: { entityType_entityId_mode: { entityType: 'robot', entityId: robotId, mode: 'koth' } },
    }),
  ]);

  if (!robot || !standing || (standing.totalMatches ?? 0) === 0) {
    return null;
  }

  const totalMatches = standing.totalMatches ?? 0;

  return {
    robotId: robot.id,
    robotName: robot.name,
    kothMatches: totalMatches,
    kothWins: standing.wins,
    podiumRate:
      totalMatches > 0
        ? Number(((standing.wins / totalMatches) * 100).toFixed(1))
        : 0,
    avgZoneScore:
      totalMatches > 0
        ? Number(((standing.totalZoneScore ?? 0) / totalMatches).toFixed(1))
        : 0,
    kothTotalZoneTime: standing.totalZoneTime ?? 0,
    kothKills: standing.totalKills ?? 0,
    kothBestPlacement: standing.bestPlacement,
    kothCurrentWinStreak: standing.currentWinStreak,
    kothBestWinStreak: standing.bestWinStreak,
  };
}
