/**
 * Robot creation logic.
 *
 * Extracted from the POST / route handler.
 */

import prisma from '../../lib/prisma';
import { lockUserForSpending } from '../../lib/creditGuard';
import { RobotError, RobotErrorCode } from '../../errors/robotErrors';
import { assignLeagueInstance } from '../league/leagueInstanceService';

export const ROBOT_CREATION_COST = 500000;

/**
 * Validate robot name: length, safe characters, global uniqueness.
 */
export async function validateRobotName(name: string): Promise<string> {
  if (!name || typeof name !== 'string') {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Robot name is required', 400);
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 1 || trimmedName.length > 50) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Robot name must be between 1 and 50 characters', 400);
  }

  const safeNamePattern = /^[a-zA-Z0-9 _\-'.!]+$/;
  if (!safeNamePattern.test(trimmedName)) {
    throw new RobotError(
      RobotErrorCode.INVALID_ROBOT_ATTRIBUTES,
      'Robot name can only contain letters, numbers, spaces, hyphens, underscores, apostrophes, periods, and exclamation marks',
      400,
    );
  }

  const existingRobot = await prisma.robot.findFirst({ where: { name: trimmedName } });
  if (existingRobot) {
    throw new RobotError(RobotErrorCode.ROBOT_NAME_TAKEN, 'A robot with this name already exists. Please choose a different name.', 400);
  }

  return trimmedName;
}

/**
 * Check roster capacity (pre-transaction optimistic check).
 */
export async function checkRosterCapacity(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { facilities: { where: { facilityType: 'roster_expansion' } } },
  });

  if (!user) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'User not found', 404);
  }

  if (user.currency < ROBOT_CREATION_COST) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Insufficient credits', 400);
  }

  const rosterLevel = user.facilities[0]?.level || 0;
  const maxRobots = rosterLevel + 1;

  const currentRobotCount = await prisma.robot.count({ where: { userId } });
  if (currentRobotCount >= maxRobots) {
    throw new RobotError(
      RobotErrorCode.MAX_ROBOTS_REACHED,
      `Robot limit reached. Upgrade Roster Expansion facility to create more robots. Current limit: ${maxRobots}`,
      400,
    );
  }

  return user;
}

/**
 * Create a robot inside a locked transaction.
 * Returns the created robot and updated user.
 */
export async function createRobotTransaction(userId: number, trimmedName: string) {
  return prisma.$transaction(async (tx) => {
    const lockedUser = await lockUserForSpending(tx, userId);

    if (lockedUser.currency < ROBOT_CREATION_COST) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Insufficient credits', 400);
    }

    // Re-verify roster limit inside transaction
    const freshRobotCount = await tx.robot.count({ where: { userId } });
    const freshRosterFacility = await tx.facility.findFirst({
      where: { userId, facilityType: 'roster_expansion' },
    });
    const freshRosterLevel = freshRosterFacility?.level || 0;
    const freshMaxRobots = freshRosterLevel + 1;
    if (freshRobotCount >= freshMaxRobots) {
      throw new RobotError(
        RobotErrorCode.MAX_ROBOTS_REACHED,
        `Robot limit reached. Upgrade Roster Expansion facility to create more robots. Current limit: ${freshMaxRobots}`,
        400,
      );
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { currency: { decrement: ROBOT_CREATION_COST } },
    });

    const hullIntegrity = 1;
    const shieldCapacity = 1;
    const maxHP = 50 + (hullIntegrity * 5);
    const maxShield = shieldCapacity * 4;

    const bronzeLeagueId = await assignLeagueInstance('bronze');

    const robot = await tx.robot.create({
      data: {
        userId,
        name: trimmedName,
        currentHP: maxHP,
        maxHP,
        currentShield: maxShield,
        maxShield,
        leagueId: bronzeLeagueId,
      },
      include: {
        mainWeapon: { include: { weapon: true } },
        offhandWeapon: { include: { weapon: true } },
      },
    });

    return { user: updatedUser, robot };
  });
}
