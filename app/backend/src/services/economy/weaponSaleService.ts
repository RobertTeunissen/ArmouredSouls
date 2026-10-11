/**
 * Weapon resale (Spec #33).
 *
 * Spec #55 Domain_Service_Extraction (task 2.3, design §10): moved unchanged
 * from the `DELETE /api/weapon-inventory/:id` route handler (equipped-item
 * refusal, resale rate on `pricePaid`, `weapon_sale` mutation). The route keeps
 * request validation, the rate limiter and the achievement check.
 *
 * Resale price = pricePaid × resaleRate(workshopLevel) where pricePaid is the
 * actual credits paid (not catalogue price — anti-exploit anchor).
 *
 * Two-tier locking:
 *   1. lockUserForSpending — serializes against any concurrent currency mutation
 *      for this user (purchase, resale, repair, etc.).
 *   2. SELECT ... FOR UPDATE on weapon_inventory — serializes against concurrent
 *      resale of the same weapon AND concurrent equip of the same weapon (the
 *      equip handler in robotWeaponService.ts acquires the same lock).
 *
 * The FK Robot.main_weapon_id uses ON DELETE SET NULL, so the lock is the sole
 * authoritative guard against silent corruption (selling an equipped weapon
 * would otherwise just null the robot's mainWeaponId with no error).
 */
import prisma from '../../lib/prisma';
import { lockUserForSpending } from '../../lib/creditGuard';
import logger from '../../config/logger';
import { AppError, EconomyError, EconomyErrorCode } from '../../errors';
import { verifyWeaponOwnership } from '../../middleware/ownership';
import { calculateWeaponResaleRate, applyResaleRate } from '../../shared/utils/discounts';
import { eventLogger } from '../common/eventLogger';
import { securityMonitor } from '../security/securityMonitor';
import { applyCreditMutationInTransaction } from '../financial/creditMutationService';
import { runFinancialWriteTransaction } from '../cycle/financialWriteTransaction';
import {
  createEconomicRequestIdentity,
  findCompletedEconomicRequest,
  findEconomicRequestReplay,
  buildEconomicAuditMetadata,
  type EconomicServiceOptions,
} from '../financial/economicRequestReplayService';
import { buildPurchaseBreakdown } from '../financial/financialBreakdowns';

/** Stored replay response (`coreResponse` of the original request). */
export interface WeaponSaleReplayResponse {
  salePrice: number;
  currency: number;
  weaponName: string;
  message: string;
}

/**
 * A replay answers with exactly the body the route sent before the extraction:
 * the stored response, plus (for the in-transaction replay) the placeholder
 * fields the route's result object carried.
 */
export interface WeaponSaleReplayBody extends WeaponSaleReplayResponse {
  weaponId?: number;
  pricePaid?: number;
  workshopLevel?: number;
  resaleRate?: number;
  previousBalance?: number;
  replayed?: true;
}

export type WeaponSaleResult =
  | { replayed: true; response: WeaponSaleReplayBody }
  | {
    replayed: false;
    /** Credits received (the design's `proceeds`). */
    salePrice: number;
    currency: number;
    weaponName: string;
    message: string;
    weaponId: number;
    pricePaid: number;
    workshopLevel: number;
    resaleRate: number;
    previousBalance: number;
  };

/**
 * Sell inventory row `inventoryId` owned by `userId`. Refuses an equipped
 * weapon with `WEAPON_EQUIPPED` (409) exactly as the route did.
 */
export async function sellWeapon(
  userId: number,
  inventoryId: number,
  requestKey: string,
  options: EconomicServiceOptions = {},
): Promise<WeaponSaleResult> {
  const identity = createEconomicRequestIdentity(userId, 'weapon_sale', requestKey, { inventoryId });
  const replay = await findCompletedEconomicRequest<WeaponSaleReplayResponse>(userId, 'weapon_sale', requestKey, { inventoryId });
  if (replay) {
    return { replayed: true, response: replay.response };
  }

  await verifyWeaponOwnership(prisma, inventoryId, userId);

  const result = await runFinancialWriteTransaction(async (tx, financialCycleNumber) => {
    // 1. Lock user row first (existing convention for credit-affecting endpoints)
    const lockedUser = await lockUserForSpending(tx, userId);
    const replayInTransaction = await findEconomicRequestReplay<WeaponSaleReplayResponse>(tx, identity);
    if (replayInTransaction) {
      return {
        replayed: true as const,
        response: {
          ...replayInTransaction.response,
          weaponId: 0,
          pricePaid: 0,
          workshopLevel: 0,
          resaleRate: 0,
          previousBalance: lockedUser.currency,
          replayed: true as const,
        },
      };
    }

    // 2. Lock the weapon_inventory row second.
    const lockedInvRows = await tx.$queryRaw<{
      id: number;
      userId: number;
      weaponId: number;
      pricePaid: number;
    }[]>`
      SELECT id, user_id as "userId", weapon_id as "weaponId", price_paid as "pricePaid"
      FROM weapon_inventory WHERE id = ${inventoryId} FOR UPDATE
    `;
    if (lockedInvRows.length === 0) {
      throw new EconomyError(EconomyErrorCode.WEAPON_NOT_FOUND, 'Weapon not found', 404);
    }
    const weaponInv = lockedInvRows[0];

    // 3. Re-verify ownership inside the transaction (TOCTOU)
    if (weaponInv.userId !== userId) {
      securityMonitor.logAuthorizationFailure(userId, 'weapon', inventoryId);
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    // 4. Defensive bounds check on pricePaid.
    if (weaponInv.pricePaid < 0) {
      logger.error(`[Weapon] Invariant violation: negative pricePaid (${weaponInv.pricePaid}) on inventory ${inventoryId}`);
      throw new EconomyError(EconomyErrorCode.INVALID_TRANSACTION, 'Invalid weapon state', 500);
    }

    // 5. Equipped check under both locks
    const equippedOn = await tx.robot.findFirst({
      where: {
        userId,
        OR: [{ mainWeaponId: inventoryId }, { offhandWeaponId: inventoryId }],
      },
      select: { id: true, name: true },
    });
    if (equippedOn) {
      throw new EconomyError(
        EconomyErrorCode.WEAPON_EQUIPPED,
        `Weapon is equipped on ${equippedOn.name}. Unequip before selling.`,
        409,
        { robotId: equippedOn.id, robotName: equippedOn.name },
      );
    }

    // 6. Workshop level + weapon details
    const [workshop, weaponMeta] = await Promise.all([
      tx.facility.findUnique({
        where: { userId_facilityType: { userId, facilityType: 'weapons_workshop' } },
        select: { level: true },
      }),
      tx.weapon.findUnique({
        where: { id: weaponInv.weaponId },
        select: { id: true, name: true },
      }),
    ]);
    const workshopLevel = workshop?.level || 0;

    const resaleRate = calculateWeaponResaleRate(workshopLevel);
    const salePrice = applyResaleRate(weaponInv.pricePaid, resaleRate);

    const financialEventId = identity.financialEventId;
    const coreResponse = {
      salePrice,
      currency: lockedUser.currency + salePrice,
      weaponName: weaponMeta?.name ?? 'Weapon',
      message: `Sold ${weaponMeta?.name ?? 'Weapon'} for ₡${salePrice.toLocaleString()}`,
    };
    const financialResult = await applyCreditMutationInTransaction(tx, {
      cycleNumber: financialCycleNumber,
      userId,
      transactionType: 'weapon_sale',
      amount: salePrice,
      description: `Sold weapon: ${weaponMeta?.name ?? 'Weapon'}`,
      financialEventId,
      breakdown: buildPurchaseBreakdown({
        transactionType: 'weapon_sale',
        sourceEventId: financialEventId,
        amount: salePrice,
        operation: 'weapon_sale',
        itemId: inventoryId,
        basePrice: weaponInv.pricePaid,
        discountAmount: weaponInv.pricePaid - salePrice,
        saleValue: salePrice,
        inputs: [
          { name: 'pricePaid', value: weaponInv.pricePaid, unit: 'credits', source: 'weapon_inventory' },
          { name: 'workshopLevel', value: workshopLevel, unit: 'levels', source: 'facility' },
          { name: 'resaleRate', value: resaleRate, unit: 'percent', source: 'shared_resale_formula' },
        ],
        modifiers: [{ name: 'resaleRate', value: resaleRate, unit: 'percent', source: 'shared_resale_formula', applied: true }],
        roundingMode: 'floor',
        operationOrder: ['pricePaid', 'resaleRate', 'saleValue'],
      }),
      auditContext: buildEconomicAuditMetadata(identity, coreResponse, options.auditContext),
    });

    await tx.weaponInventory.delete({ where: { id: inventoryId } });

    return {
      replayed: false as const,
      currency: financialResult.balanceAfter,
      weaponName: weaponMeta?.name ?? 'Weapon',
      weaponId: weaponInv.weaponId,
      salePrice,
      pricePaid: weaponInv.pricePaid,
      workshopLevel,
      resaleRate,
      previousBalance: lockedUser.currency,
    };
  });

  if (result.replayed) {
    return { replayed: true, response: result.response };
  }

  // Non-blocking audit log + structured log.
  // Note: does NOT call securityMonitor.trackSpending — resale is income,
  // not spending; audit_log is the canonical tracking surface.
  try {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;
    await eventLogger.logWeaponSale(currentCycle, userId, result.weaponId, result.salePrice);

    logger.info(
      `[Weapon] User ${userId} | Sold: ${result.weaponName} | ` +
      `Price: ₡${result.salePrice.toLocaleString()} (paid ₡${result.pricePaid.toLocaleString()}) | ` +
      `Workshop L${result.workshopLevel} (${result.resaleRate}% rate) | ` +
      `Balance: ₡${result.previousBalance.toLocaleString()} → ₡${result.currency.toLocaleString()}`,
    );
  } catch (logError) {
    logger.error('Failed to log weapon sale event:', logError);
  }

  return {
    ...result,
    message: `Sold ${result.weaponName} for ₡${result.salePrice.toLocaleString()}`,
  };
}
