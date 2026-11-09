/**
 * Small robot reads the robot routes need before (or instead of) a larger
 * service call. They used to be inline Prisma queries in `routes/robots.ts`;
 * routes stay thin: validate, authorize, call a service, respond.
 */
import prisma from '../../lib/prisma';
import type { StandingsMode } from '../../../generated/prisma';
import { RobotError, RobotErrorCode } from '../../errors/robotErrors';
import { getModeKills } from '../battle/modeKillsQueries';
import type { PlacementStanding } from '../../shared/types';

export interface RobotRef {
  id: number;
  name: string;
  userId: number;
}

function robotNotFound(): RobotError {
  return new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);
}

/** The robot's id, name and owner, or a 404 `ROBOT_NOT_FOUND`. */
export async function requireRobotRef(robotId: number): Promise<RobotRef> {
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: { id: true, name: true, userId: true },
  });
  if (!robot) throw robotNotFound();
  return robot;
}

/** Replace the robot's image (ownership is checked by the caller) and return it with its weapons. */
export async function updateRobotAppearance(robotId: number, imageUrl: string) {
  return prisma.robot.update({
    where: { id: robotId },
    data: { imageUrl },
    include: {
      mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
      offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
    },
  });
}

export type PlacementMode = Extract<StandingsMode, 'koth' | 'grand_melee'>;

/**
 * A robot's KotH or Grand Melee standing with its kills in that mode, or null
 * when it has never entered the mode. A missing robot is a 404.
 */
export async function getRobotPlacementStanding(robotId: number, mode: PlacementMode): Promise<PlacementStanding | null> {
  await requireRobotRef(robotId);
  const [standing, totalKills] = await Promise.all([
    prisma.standing.findFirst({ where: { entityType: 'robot', entityId: robotId, mode } }),
    getModeKills(robotId, mode),
  ]);
  if (!standing) return null;
  return {
    tier: standing.tier,
    leagueInstanceId: standing.leagueInstanceId,
    leaguePoints: standing.leaguePoints,
    wins: standing.wins,
    totalMatches: standing.totalMatches,
    totalKills,
    bestPlacement: standing.bestPlacement,
    currentWinStreak: standing.currentWinStreak,
    bestWinStreak: standing.bestWinStreak,
  };
}

/** Cycle number written on purchase/upgrade audit events: completed cycles + 1. */
export async function getEventLogCycleNumber(): Promise<number> {
  const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  return (cycleMetadata?.totalCycles || 0) + 1;
}

/** The stable name shown in the server log line, or null. */
export async function getStableNameForLog(userId: number): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stableName: true } });
  return user?.stableName ?? null;
}
