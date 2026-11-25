/**
 * Row lock on a player's weapon_inventory row, shared by the credit-affecting
 * weapon writers (sale, refinement).
 *
 * Callers lock the user row first (`lockUserForSpending`), then this row, which
 * keeps the Spec #33 lock acquisition order.
 */
import type { Prisma } from '../../../generated/prisma';
import logger from '../../config/logger';
import { AppError, EconomyError, EconomyErrorCode } from '../../errors';
import { securityMonitor } from '../security/securityMonitor';

export interface LockedWeaponInventory {
  id: number;
  userId: number;
  weaponId: number;
  pricePaid: number;
}

/**
 * Locks inventory row `inventoryId` FOR UPDATE and re-checks, under the lock,
 * that `userId` owns it (TOCTOU) and that its price paid is not negative.
 *
 * @param logTag prefix for the invariant-violation log line, e.g. "Weapon".
 * @throws EconomyError WEAPON_NOT_FOUND (404) when the row is gone,
 *   AppError FORBIDDEN (403) when another player owns it,
 *   EconomyError INVALID_TRANSACTION (500) on a negative price paid.
 */
export async function lockOwnedWeaponInventory(
  tx: Prisma.TransactionClient,
  userId: number,
  inventoryId: number,
  logTag: string,
): Promise<LockedWeaponInventory> {
  const rows = await tx.$queryRaw<LockedWeaponInventory[]>`
    SELECT id, user_id as "userId", weapon_id as "weaponId", price_paid as "pricePaid"
    FROM weapon_inventory WHERE id = ${inventoryId} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new EconomyError(EconomyErrorCode.WEAPON_NOT_FOUND, 'Weapon not found', 404);
  }
  const weaponInv = rows[0];

  if (weaponInv.userId !== userId) {
    securityMonitor.logAuthorizationFailure(userId, 'weapon', inventoryId);
    throw new AppError('FORBIDDEN', 'Access denied', 403);
  }

  if (weaponInv.pricePaid < 0) {
    logger.error(`[${logTag}] Invariant violation: negative pricePaid (${weaponInv.pricePaid}) on inventory ${inventoryId}`);
    throw new EconomyError(EconomyErrorCode.INVALID_TRANSACTION, 'Invalid weapon state', 500);
  }

  return weaponInv;
}
