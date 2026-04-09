/**
 * Ownership Verification Helpers
 *
 * Reusable functions for verifying resource ownership before mutations.
 * Designed to work both outside and inside Prisma interactive transactions.
 *
 * All helpers throw a generic "Access denied" 403 on mismatch or not-found,
 * preventing resource enumeration (never reveals whether the resource exists).
 *
 * @module middleware/ownership
 */

import type { Prisma } from '../../generated/prisma';
import { AppError } from '../errors';
import { securityMonitor } from '../services/security/securityMonitor';

/**
 * Verify that a robot belongs to the authenticated user.
 *
 * @param tx - Prisma client or transaction client
 * @param robotId - The robot ID to check
 * @param userId - The authenticated user's ID
 * @throws AppError with code FORBIDDEN and status 403 on mismatch or not-found
 */
export async function verifyRobotOwnership(
  tx: Prisma.TransactionClient,
  robotId: number,
  userId: number
): Promise<void> {
  const robot = await tx.robot.findUnique({
    where: { id: robotId },
    select: { userId: true },
  });
  if (!robot || robot.userId !== userId) {
    securityMonitor.logAuthorizationFailure(userId, 'robot', robotId);
    throw new AppError('FORBIDDEN', 'Access denied', 403);
  }
}

/**
 * Verify that a weapon inventory item belongs to the authenticated user.
 *
 * @param tx - Prisma client or transaction client
 * @param inventoryId - The weapon inventory ID to check
 * @param userId - The authenticated user's ID
 * @throws AppError with code FORBIDDEN and status 403 on mismatch or not-found
 */
export async function verifyWeaponOwnership(
  tx: Prisma.TransactionClient,
  inventoryId: number,
  userId: number
): Promise<void> {
  const weapon = await tx.weaponInventory.findUnique({
    where: { id: inventoryId },
    select: { userId: true },
  });
  if (!weapon || weapon.userId !== userId) {
    securityMonitor.logAuthorizationFailure(userId, 'weapon', inventoryId);
    throw new AppError('FORBIDDEN', 'Access denied', 403);
  }
}

/**
 * Verify that a facility belongs to the authenticated user.
 *
 * @param tx - Prisma client or transaction client
 * @param facilityId - The facility ID to check
 * @param userId - The authenticated user's ID
 * @throws AppError with code FORBIDDEN and status 403 on mismatch or not-found
 */
export async function verifyFacilityOwnership(
  tx: Prisma.TransactionClient,
  facilityId: number,
  userId: number
): Promise<void> {
  const facility = await tx.facility.findUnique({
    where: { id: facilityId },
    select: { userId: true },
  });
  if (!facility || facility.userId !== userId) {
    securityMonitor.logAuthorizationFailure(userId, 'facility', facilityId);
    throw new AppError('FORBIDDEN', 'Access denied', 403);
  }
}
