/**
 * Robot battle settings: stance and yield threshold.
 *
 * Spec #55 Domain_Service_Extraction (task 2.5, design §10): moved unchanged
 * from the `PATCH /api/robots/:id/stance` and `PATCH /api/robots/:id/yield-threshold`
 * route handlers (normalisation, range checks, ownership check, update). The
 * routes keep request validation and the `stance_changed` achievement check.
 */
import prisma from '../../lib/prisma';
import { RobotError, RobotErrorCode } from '../../errors/robotErrors';
import { verifyRobotOwnership } from '../../middleware/ownership';
import type { Prisma } from '../../../generated/prisma';

export const ROBOT_STANCES = ['offensive', 'defensive', 'balanced'] as const;
export type RobotStance = typeof ROBOT_STANCES[number];

export const YIELD_THRESHOLD_MIN = 0;
export const YIELD_THRESHOLD_MAX = 50;

const ROBOT_WEAPON_INCLUDE = {
  // Spec #34: refinements drive rank prefix + slot bar in the
  // robot detail page response.
  mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
  offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
} satisfies Prisma.RobotInclude;

export type RobotWithWeapons = Prisma.RobotGetPayload<{ include: typeof ROBOT_WEAPON_INCLUDE }>;

export interface StanceUpdateResult {
  robot: RobotWithWeapons;
  /** The stored, lower-cased stance. */
  stance: RobotStance;
}

export interface YieldThresholdUpdateResult {
  robot: RobotWithWeapons;
  /** The stored threshold (percent). */
  yieldThreshold: number;
}

function isRobotStance(value: string): value is RobotStance {
  return (ROBOT_STANCES as readonly string[]).includes(value);
}

/**
 * Set the stance of robot `robotId` owned by `userId`. The value is
 * lower-cased first, so 'OFFENSIVE' is accepted (route behaviour).
 */
export async function updateStance(userId: number, robotId: number, stance: unknown): Promise<StanceUpdateResult> {
  if (!stance || typeof stance !== 'string') {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Stance is required and must be a string', 400);
  }

  const normalizedStance = stance.toLowerCase();
  if (!isRobotStance(normalizedStance)) {
    throw new RobotError(
      RobotErrorCode.INVALID_ROBOT_ATTRIBUTES,
      'Invalid stance. Must be one of: offensive, defensive, balanced',
      400
    );
  }

  await verifyRobotOwnership(prisma, robotId, userId);

  const robot = await prisma.robot.update({
    where: { id: robotId },
    data: { stance: normalizedStance },
    include: ROBOT_WEAPON_INCLUDE,
  });

  return { robot, stance: normalizedStance };
}

/**
 * Set the yield threshold (0–50 %) of robot `robotId` owned by `userId`.
 * Accepts any value `Number()` turns into a number in range (route behaviour).
 */
export async function updateYieldThreshold(userId: number, robotId: number, yieldThreshold: unknown): Promise<YieldThresholdUpdateResult> {
  if (yieldThreshold === undefined || yieldThreshold === null) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Yield threshold is required', 400);
  }

  const threshold = Number(yieldThreshold);
  if (isNaN(threshold)) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Yield threshold must be a number', 400);
  }

  if (threshold < YIELD_THRESHOLD_MIN || threshold > YIELD_THRESHOLD_MAX) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Yield threshold must be between 0 and 50', 400);
  }

  await verifyRobotOwnership(prisma, robotId, userId);

  const robot = await prisma.robot.update({
    where: { id: robotId },
    data: { yieldThreshold: threshold },
    include: ROBOT_WEAPON_INCLUDE,
  });

  return { robot, yieldThreshold: threshold };
}
