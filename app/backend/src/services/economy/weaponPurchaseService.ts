/**
 * Weapon purchase into the stable's inventory.
 *
 * Spec #55 Domain_Service_Extraction (task 2.2, design §10): moved unchanged
 * from the `POST /api/weapon-inventory/purchase` route handler (storage check,
 * Weapons Workshop discount, `weapon_purchase` mutation, request identity).
 * The route keeps request validation and the achievement check.
 */
import prisma from '../../lib/prisma';
import { lockUserForSpending } from '../../lib/creditGuard';
import logger from '../../config/logger';
import { EconomyError, EconomyErrorCode, AuthError, AuthErrorCode } from '../../errors';
import type { Prisma, Weapon } from '../../../generated/prisma';
import { calculateStorageCapacity, getStorageStatus } from '../../utils/storageCalculations';
import { calculateWeaponWorkshopDiscount, applyDiscount } from '../../shared/utils/discounts';
import { eventLogger } from '../common/eventLogger';
import { trackSpending } from './spendingTracker';
import { securityMonitor } from '../security/securityMonitor';
import { applyCreditMutationInTransaction } from '../financial/creditMutationService';
import { runFinancialWriteTransaction } from '../cycle/financialWriteTransaction';
import {
  createEconomicRequestIdentity,
  findCompletedEconomicRequest,
  findEconomicRequestReplay,
  buildEconomicAuditMetadata,
} from '../financial/economicRequestReplayService';
import { buildPurchaseBreakdown } from '../financial/financialBreakdowns';
import type { PurchaseServiceOptions } from './purchaseOptions';

const PURCHASE_MESSAGE = 'Weapon purchased successfully';

export type PurchasedWeaponInventory = Prisma.WeaponInventoryGetPayload<{ include: { weapon: true } }>;

/** Stored replay response (`coreResponse` of the original request). */
export interface WeaponPurchaseReplayResponse {
  weaponInventory: unknown;
  currency: number;
  message: string;
}

export type WeaponPurchaseResult =
  | { replayed: true; response: WeaponPurchaseReplayResponse }
  | {
    replayed: false;
    weaponInventory: PurchasedWeaponInventory;
    currency: number;
    message: string;
    /** Catalogue row of the purchased weapon (the caller's achievement check uses its type and name). */
    weapon: Weapon;
    finalCost: number;
    discountPercent: number;
  };

/**
 * Buy one copy of catalogue weapon `weaponId` for `userId`.
 *
 * Validation order, errors, ledger/audit pair, replay behaviour and post-commit
 * logging are those of the original route handler.
 */
export async function purchaseWeapon(
  userId: number,
  weaponId: number,
  requestKey: string,
  options: PurchaseServiceOptions = {},
): Promise<WeaponPurchaseResult> {
  const identity = createEconomicRequestIdentity(userId, 'weapon_purchase', requestKey, { weaponId });
  const replay = await findCompletedEconomicRequest<WeaponPurchaseReplayResponse>(userId, 'weapon_purchase', requestKey, { weaponId });
  if (replay) {
    return { replayed: true, response: replay.response };
  }

  const weapon = await prisma.weapon.findUnique({
    where: { id: weaponId },
  });

  if (!weapon) {
    throw new EconomyError(EconomyErrorCode.WEAPON_NOT_FOUND, 'Weapon not found', 404);
  }

  // Current currency, Weapon Workshop level, and Storage Facility level
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      facilities: {
        where: { facilityType: { in: ['weapons_workshop', 'storage_facility'] } },
      },
    },
  });

  if (!user) {
    throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404);
  }

  const storageFacility = user.facilities.find(f => f.facilityType === 'storage_facility');
  const storageFacilityLevel = storageFacility?.level || 0;

  // Check storage capacity before purchase
  const currentWeaponCount = await prisma.weaponInventory.count({ where: { userId } });
  const maxCapacity = calculateStorageCapacity(storageFacilityLevel);

  if (currentWeaponCount >= maxCapacity) {
    const storageStatus = getStorageStatus(currentWeaponCount, storageFacilityLevel);
    throw new EconomyError(EconomyErrorCode.STORAGE_CAPACITY_FULL, 'Storage capacity full', 400, {
      currentWeapons: storageStatus.currentWeapons,
      maxCapacity: storageStatus.maxCapacity,
      message: 'Upgrade Storage Facility to increase capacity',
    });
  }

  // Apply Weapon Workshop discount
  const weaponWorkshop = user.facilities.find(f => f.facilityType === 'weapons_workshop');
  const weaponWorkshopLevel = weaponWorkshop?.level || 0;
  const discountPercent = calculateWeaponWorkshopDiscount(weaponWorkshopLevel);
  const finalCost = applyDiscount(weapon.cost, discountPercent);

  if (user.currency < finalCost) {
    throw new EconomyError(EconomyErrorCode.INSUFFICIENT_CREDITS, 'Insufficient credits', 400, {
      required: finalCost,
      available: user.currency,
    });
  }

  // Purchase weapon in a transaction with row-level locking
  const result = await runFinancialWriteTransaction(async (tx, financialCycleNumber) => {
    const lockedUser = await lockUserForSpending(tx, userId);
    const replayInTransaction = await findEconomicRequestReplay<WeaponPurchaseReplayResponse>(tx, identity);
    if (replayInTransaction) {
      return { replayed: true as const, response: replayInTransaction.response };
    }

    if (lockedUser.currency < finalCost) {
      throw new EconomyError(EconomyErrorCode.INSUFFICIENT_CREDITS, 'Insufficient credits', 400, {
        required: finalCost,
        available: lockedUser.currency,
      });
    }

    // Re-verify workshop level hasn't changed (guards against concurrent facility upgrade race)
    const freshFacilities = await tx.facility.findMany({
      where: { userId, facilityType: { in: ['weapons_workshop', 'storage_facility'] } },
    });
    const freshWorkshop = freshFacilities.find(f => f.facilityType === 'weapons_workshop');
    const freshWorkshopLevel = freshWorkshop?.level || 0;
    if (freshWorkshopLevel !== weaponWorkshopLevel) {
      throw new EconomyError(EconomyErrorCode.INVALID_TRANSACTION, 'Facility level changed, please retry', 409);
    }

    // Re-verify storage capacity inside transaction
    const freshWeaponCount = await tx.weaponInventory.count({ where: { userId } });
    const freshStorage = freshFacilities.find(f => f.facilityType === 'storage_facility');
    const freshMaxCapacity = calculateStorageCapacity(freshStorage?.level || 0);
    if (freshWeaponCount >= freshMaxCapacity) {
      throw new EconomyError(EconomyErrorCode.STORAGE_CAPACITY_FULL, 'Storage capacity full', 400);
    }

    const weaponInventory = await tx.weaponInventory.create({
      data: { userId, weaponId, pricePaid: finalCost },
      include: { weapon: true },
    });

    const financialEventId = identity.financialEventId;
    const coreResponse = {
      weaponInventory,
      currency: lockedUser.currency - finalCost,
      message: PURCHASE_MESSAGE,
    };
    const financialResult = await applyCreditMutationInTransaction(tx, {
      cycleNumber: financialCycleNumber,
      userId,
      transactionType: 'weapon_purchase',
      amount: -finalCost,
      description: `Purchased weapon: ${weapon.name}`,
      financialEventId,
      breakdown: buildPurchaseBreakdown({
        transactionType: 'weapon_purchase',
        sourceEventId: financialEventId,
        amount: -finalCost,
        operation: 'weapon_purchase',
        itemId: weaponInventory.id,
        basePrice: weapon.cost,
        discountAmount: weapon.cost - finalCost,
        inputs: [
          { name: 'catalogPrice', value: weapon.cost, unit: 'credits', source: 'weapon_catalog' },
          { name: 'workshopLevel', value: freshWorkshopLevel, unit: 'levels', source: 'facility' },
          { name: 'finalCost', value: finalCost, unit: 'credits', source: 'shared_discount_formula' },
        ],
        modifiers: [{ name: 'workshopDiscount', value: discountPercent, unit: 'percent', source: 'shared_discount_formula', applied: discountPercent > 0 }],
        roundingMode: 'floor',
        operationOrder: ['catalogPrice', 'workshopDiscount', 'finalCost'],
      }),
      auditContext: buildEconomicAuditMetadata(identity, coreResponse, options.auditContext),
    });

    return { replayed: false as const, weaponInventory, currency: financialResult.balanceAfter };
  });

  if (result.replayed) {
    // The in-transaction replay answered with the stored inventory row and balance and the fixed message.
    return {
      replayed: true,
      response: { weaponInventory: result.response.weaponInventory, currency: result.response.currency, message: PURCHASE_MESSAGE },
    };
  }

  // Log weapon purchase event (non-blocking)
  try {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;

    await eventLogger.logWeaponPurchase(currentCycle, userId, weaponId, finalCost);

    const discountInfo = discountPercent > 0 ? ` | Discount: ${discountPercent}% (base: ₡${weapon.cost.toLocaleString()})` : '';
    const previousBalance = result.currency + finalCost;
    logger.info(`[Weapon] User ${userId} | Purchased: ${weapon.name} | Cost: ₡${finalCost.toLocaleString()}${discountInfo} | Balance: ₡${previousBalance.toLocaleString()} → ₡${result.currency.toLocaleString()}`);

    await trackSpending(userId, 'weapons', finalCost);
    if (options.spendingMonitor) {
      securityMonitor.trackSpending(userId, finalCost, options.spendingMonitor);
    }
  } catch (logError) {
    logger.error('Failed to log weapon purchase event:', logError);
  }

  return {
    replayed: false,
    weaponInventory: result.weaponInventory,
    currency: result.currency,
    message: PURCHASE_MESSAGE,
    weapon,
    finalCost,
    discountPercent,
  };
}
