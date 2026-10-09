/**
 * Weapon refinement (Spec #34, R3).
 *
 * Spec #55 Domain_Service_Extraction (task 2.4, design §10): moved unchanged
 * from the `POST /api/weapon-inventory/:id/refine` route handler. Uses the
 * shared validators and `calculateRefinementCost` from
 * `app/shared/utils/weaponRefinement.ts`. The route keeps request validation,
 * the rate limiter and the achievement check.
 *
 * Permanently improves a single `WeaponInventory` row by inserting a
 * `WeaponRefinement` slot, decrementing the user's currency by the cost, and
 * incrementing `weapon_inventory.price_paid` by the same amount so resale at
 * any future Workshop level recovers a fraction of the spend.
 *
 * Tier gating (Workshop level): hone L1, augment L3, sharpen L5, forge L8.
 *
 * Two-tier locking (matches the resale handler's order): `lockUserForSpending`
 * first, then `SELECT ... FOR UPDATE` on `weapon_inventory`.
 *
 * Validation chain (each step throws an `EconomyError` on failure):
 *  - Request shape (R8.7, before any read or write; the route's Zod schema
 *    rejects these first, so only non-HTTP callers can reach them):
 *    unknown tier → WEAPON_REFINEMENT_INVALID_TIER; magnitude not an integer in
 *    `getRefinementMagnitudeRange(tier)` → WEAPON_REFINEMENT_MAGNITUDE_OUT_OF_RANGE;
 *    hone/augment without a `ROBOT_ATTRIBUTES` target, or sharpen/forge with a
 *    target → WEAPON_REFINEMENT_INVALID_TARGET_ATTRIBUTE
 *  - Tier locked vs Workshop level → WEAPON_REFINEMENT_TIER_LOCKED
 *  - Slot cap (≥ 5) / per-tier cap (Sharpen, Forge ≥ 2) → SLOT_/TIER_CAP_EXCEEDED
 *  - Shield + Sharpen/Forge → SHIELD_CANNOT_TAKE_DPS_TIER
 *  - (hone/augment) target attribute on/off the weapon → ATTRIBUTE_NOT_/ALREADY_ON_WEAPON
 *  - (hone/augment) per-attribute stack cap → ATTRIBUTE_STACK_CAP_EXCEEDED
 *  - User currency < cost → INSUFFICIENT_CREDITS (HTTP 402)
 */
import prisma from '../../lib/prisma';
import { lockUserForSpending } from '../../lib/creditGuard';
import logger from '../../config/logger';
import { AppError, EconomyError, EconomyErrorCode } from '../../errors';
import { verifyWeaponOwnership } from '../../middleware/ownership';
import type { Prisma, Weapon, WeaponRefinement } from '../../../generated/prisma';
import {
  calculateRefinementCost,
  getRefinementMagnitudeRange,
  validateRefinementSlotAvailable,
  validateAttributeStackCap,
  validateAttributeOnWeapon,
  validateShieldCompatibility,
  type RefinementTier,
} from '../../shared/utils/weaponRefinement';
import { isRobotAttribute, type RobotAttribute } from '../../shared/utils/robotAttributes';
import { eventLogger } from '../common/eventLogger';
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

/** Workshop level required per refinement tier. */
const REQUIRED_WORKSHOP_LEVELS: Record<RefinementTier, number> = {
  hone: 1, augment: 3, sharpen: 5, forge: 8,
};

export interface RefinementRequest {
  tier: RefinementTier;
  /** Required for hone/augment; absent for sharpen/forge. */
  targetAttribute?: RobotAttribute;
  /** 1–5 for hone/augment; sharpen/forge always store 1. */
  magnitude: number;
}

export type RefinedWeaponInventory = Prisma.WeaponInventoryGetPayload<{
  include: { weapon: true; refinements: true };
}>;

/** Stored replay response (`coreResponse` of the original request). */
export interface WeaponRefinementReplayResponse {
  weaponInventory: unknown;
  currency: number;
  cost: number;
  message: string;
}

export type WeaponRefinementResult =
  | { replayed: true; response: WeaponRefinementReplayResponse }
  | {
    replayed: false;
    weaponInventory: RefinedWeaponInventory;
    currency: number;
    cost: number;
    message: string;
    weapon: Weapon;
    refinement: WeaponRefinement;
    workshopLevel: number;
    /** Magnitude as stored (1 for sharpen/forge). */
    magnitude: number;
    targetAttribute: string | null;
  };

/**
 * Read a numeric `<attribute>Bonus` field from a weapon catalogue row.
 * The Prisma `Weapon` type has 23 explicit `<attr>Bonus` fields; indexed access
 * needs a structural cast.
 */
function getCatalogBonus(weapon: Weapon, attribute: string): number {
  const v = (weapon as unknown as Record<string, unknown>)[`${attribute}Bonus`];
  return typeof v === 'number' ? v : 0;
}

function isRefinementTier(value: unknown): value is RefinementTier {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(REQUIRED_WORKSHOP_LEVELS, value);
}

/**
 * Enforce the refinement request-shape rules (R8.7) that the route's
 * `refineBodySchema` also enforces, so a non-HTTP caller (the Automaton
 * executor) cannot bypass them. Runs before any read or write, so a rejection
 * leaves no refinement row, ledger row or balance change.
 *
 * Inputs are checked at runtime even though they are typed: callers may build
 * requests from JSON plans. Error details carry only the allowed range, never
 * the submitted values.
 *
 * @returns the validated target attribute (non-null exactly for hone/augment).
 */
function assertValidRefinementRequest(request: RefinementRequest): RobotAttribute | null {
  const { tier, magnitude, targetAttribute } = request;

  if (!isRefinementTier(tier)) {
    throw new EconomyError(
      EconomyErrorCode.WEAPON_REFINEMENT_INVALID_TIER,
      'Refinement tier must be hone, augment, sharpen or forge.',
      400,
    );
  }

  const [minMagnitude, maxMagnitude] = getRefinementMagnitudeRange(tier);
  if (!Number.isInteger(magnitude) || magnitude < minMagnitude || magnitude > maxMagnitude) {
    throw new EconomyError(
      EconomyErrorCode.WEAPON_REFINEMENT_MAGNITUDE_OUT_OF_RANGE,
      `Magnitude for ${tier} must be a whole number from ${minMagnitude} to ${maxMagnitude}.`,
      400,
      { minMagnitude, maxMagnitude },
    );
  }

  if (tier === 'hone' || tier === 'augment') {
    if (typeof targetAttribute !== 'string' || !isRobotAttribute(targetAttribute)) {
      throw new EconomyError(
        EconomyErrorCode.WEAPON_REFINEMENT_INVALID_TARGET_ATTRIBUTE,
        `${tier} requires a valid robot attribute as its target.`,
        400,
      );
    }
    return targetAttribute;
  }

  if (targetAttribute !== undefined) {
    throw new EconomyError(
      EconomyErrorCode.WEAPON_REFINEMENT_INVALID_TARGET_ATTRIBUTE,
      `${tier} does not take a target attribute.`,
      400,
    );
  }
  return null;
}

/** The magnitude stored for a request: Sharpen/Forge always store 1. */
export function refinementMagnitudeForStorage(tier: RefinementTier, magnitude: number): number {
  return (tier === 'sharpen' || tier === 'forge') ? 1 : magnitude;
}

/**
 * Apply one refinement to inventory row `inventoryId` owned by `userId`.
 *
 * Validation order, errors, ledger/audit pair, replay behaviour and post-commit
 * logging are those of the original route handler.
 */
export async function refineWeapon(
  userId: number,
  inventoryId: number,
  request: RefinementRequest,
  requestKey: string,
  options: PurchaseServiceOptions = {},
): Promise<WeaponRefinementResult> {
  const { tier, magnitude, targetAttribute } = request;
  // R8.7: request-shape rules are enforced here, before the replay probe and
  // the transaction, so a rejected request writes nothing.
  const validatedTarget = assertValidRefinementRequest(request);

  // Sharpen/Forge always store magnitude 1 (the request guard above and the
  // route's Zod schema enforce this on input; the storage path mirrors it so an
  // audit log of the row never disagrees with the formula module's expectations).
  const magnitudeForStorage = refinementMagnitudeForStorage(tier, magnitude);
  const requestFacts = { inventoryId, tier, magnitude: magnitudeForStorage, targetAttribute: targetAttribute ?? null };
  const identity = createEconomicRequestIdentity(userId, 'weapon_refinement', requestKey, requestFacts);
  const replay = await findCompletedEconomicRequest<WeaponRefinementReplayResponse>(userId, 'weapon_refinement', requestKey, requestFacts);
  if (replay) {
    return { replayed: true, response: replay.response };
  }

  await verifyWeaponOwnership(prisma, inventoryId, userId);

  const result = await runFinancialWriteTransaction(async (tx, financialCycleNumber) => {
    // 1. Lock user row first (matches Spec #33 lock acquisition order)
    const lockedUser = await lockUserForSpending(tx, userId);
    const replayInTransaction = await findEconomicRequestReplay<WeaponRefinementReplayResponse>(tx, identity);
    if (replayInTransaction) {
      return { replayed: true as const, response: replayInTransaction.response };
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
      logger.error(`[Refine] Invariant violation: negative pricePaid (${weaponInv.pricePaid}) on inventory ${inventoryId}`);
      throw new EconomyError(EconomyErrorCode.INVALID_TRANSACTION, 'Invalid weapon state', 500);
    }

    // 5. Fetch dependencies inside the transaction.
    const [weapon, refinements, workshop] = await Promise.all([
      tx.weapon.findUniqueOrThrow({ where: { id: weaponInv.weaponId } }),
      tx.weaponRefinement.findMany({ where: { weaponInventoryId: inventoryId } }),
      tx.facility.findUnique({
        where: { userId_facilityType: { userId, facilityType: 'weapons_workshop' } },
        select: { level: true },
      }),
    ]);
    const workshopLevel = workshop?.level ?? 0;

    // 6. Tier gating (Workshop-only, no separate prestige gates).
    const requiredWorkshopLevel = REQUIRED_WORKSHOP_LEVELS[tier];
    if (workshopLevel < requiredWorkshopLevel) {
      throw new EconomyError(
        EconomyErrorCode.WEAPON_REFINEMENT_TIER_LOCKED,
        `Weapons Workshop level ${requiredWorkshopLevel} required to ${tier}.`,
        403,
        { requiredWorkshopLevel, currentWorkshopLevel: workshopLevel },
      );
    }

    // 7. Validation chain — each validator returns a discriminated union;
    //    failed results map onto a specific EconomyError code.
    const refinementRows = refinements.map((r) => ({
      tier: r.tier as RefinementTier,
      magnitude: r.magnitude,
      targetAttribute: r.targetAttribute,
    }));

    const slotCheck = validateRefinementSlotAvailable(refinementRows, tier);
    if (!slotCheck.ok) {
      if (slotCheck.code === 'SLOT_CAP_EXCEEDED') {
        throw new EconomyError(
          EconomyErrorCode.WEAPON_REFINEMENT_SLOT_CAP_EXCEEDED,
          'Weapon already has the maximum of 5 refinements.',
          409,
          slotCheck.details,
        );
      }
      // TIER_CAP_EXCEEDED
      throw new EconomyError(
        EconomyErrorCode.WEAPON_REFINEMENT_TIER_CAP_EXCEEDED,
        `${tier} can only be applied a maximum of 2 times per weapon.`,
        409,
        slotCheck.details,
      );
    }

    const shieldCheck = validateShieldCompatibility(weapon.weaponType, tier);
    if (!shieldCheck.ok) {
      throw new EconomyError(
        EconomyErrorCode.WEAPON_REFINEMENT_SHIELD_CANNOT_TAKE_DPS_TIER,
        'Shields cannot be Sharpened or Forged.',
        400,
      );
    }

    // assertValidRefinementRequest returns a target exactly when the tier is
    // hone/augment, so the second condition only narrows the type.
    if ((tier === 'hone' || tier === 'augment') && validatedTarget !== null) {
      const attribute = validatedTarget;
      const catalogBonus = getCatalogBonus(weapon, attribute);

      const attrCheck = validateAttributeOnWeapon(catalogBonus, refinementRows, attribute, tier);
      if (!attrCheck.ok) {
        if (attrCheck.code === 'ATTRIBUTE_NOT_ON_WEAPON') {
          throw new EconomyError(
            EconomyErrorCode.WEAPON_REFINEMENT_ATTRIBUTE_NOT_ON_WEAPON,
            `Cannot Hone ${attribute}: this weapon does not grant that attribute.`,
            400,
            { attribute },
          );
        }
        // ATTRIBUTE_ALREADY_ON_WEAPON
        throw new EconomyError(
          EconomyErrorCode.WEAPON_REFINEMENT_ATTRIBUTE_ALREADY_ON_WEAPON,
          `Cannot Augment ${attribute}: this weapon already grants that attribute.`,
          400,
          { attribute },
        );
      }

      const stackCheck = validateAttributeStackCap(catalogBonus, refinementRows, attribute, magnitude);
      if (!stackCheck.ok) {
        throw new EconomyError(
          EconomyErrorCode.WEAPON_REFINEMENT_ATTRIBUTE_STACK_CAP_EXCEEDED,
          `Combined ${attribute} bonus would exceed the per-attribute cap of +10.`,
          409,
          {
            attribute,
            currentTotal: stackCheck.currentTotal,
            requestedAddition: magnitude,
          },
        );
      }
    }

    // 8. Cost calculation (shared formula module is the single source of truth).
    const existingInstancesOfTier = refinementRows.filter((r) => r.tier === tier).length;
    const cost = calculateRefinementCost(tier, magnitudeForStorage, existingInstancesOfTier);

    // 9. Affordability — generic INSUFFICIENT_CREDITS with HTTP 402 (Payment Required).
    if (lockedUser.currency < cost) {
      throw new EconomyError(
        EconomyErrorCode.INSUFFICIENT_CREDITS,
        'Insufficient credits for refinement.',
        402,
        { requiredCurrency: cost, availableCurrency: lockedUser.currency },
      );
    }

    // 10. Next available slotIndex (1..5, lowest unused). Stable per weapon.
    const usedSlots = new Set(refinements.map((r) => r.slotIndex));
    let slotIndex = 1;
    while (usedSlots.has(slotIndex)) slotIndex++;

    // 11. Mutations: increment pricePaid and insert refinement row.
    await tx.weaponInventory.update({
      where: { id: inventoryId },
      data: { pricePaid: { increment: cost } },
    });

    const newRefinement = await tx.weaponRefinement.create({
      data: {
        weaponInventoryId: inventoryId,
        tier,
        magnitude: magnitudeForStorage,
        targetAttribute: targetAttribute ?? null,
        costPaid: cost,
        slotIndex,
      },
    });

    // 12. Re-fetch the updated inventory with refinements for the response.
    const updatedInventory = await tx.weaponInventory.findUniqueOrThrow({
      where: { id: inventoryId },
      include: {
        weapon: true,
        refinements: { orderBy: { slotIndex: 'asc' } },
      },
    });

    const financialEventId = identity.financialEventId;
    const coreResponse = {
      weaponInventory: updatedInventory,
      currency: lockedUser.currency - cost,
      cost,
      message: `Refined ${weapon.name}: ${tier}${targetAttribute ? ` ${targetAttribute} +${magnitudeForStorage}` : ''}`,
    };
    const financialResult = await applyCreditMutationInTransaction(tx, {
      cycleNumber: financialCycleNumber,
      userId,
      transactionType: 'weapon_refinement',
      amount: -cost,
      description: `Refined weapon slot ${slotIndex}`,
      financialEventId,
      breakdown: buildPurchaseBreakdown({
        transactionType: 'weapon_refinement',
        sourceEventId: financialEventId,
        amount: -cost,
        operation: 'weapon_refinement',
        itemId: inventoryId,
        basePrice: cost,
        discountAmount: 0,
        inputs: [
          { name: 'tier', value: tier, unit: 'refinement_tier', source: 'request' },
          { name: 'magnitude', value: magnitudeForStorage, unit: 'points', source: 'request' },
          { name: 'workshopLevel', value: workshopLevel, unit: 'levels', source: 'facility' },
          { name: 'slotIndex', value: slotIndex, unit: 'slot', source: 'weapon_inventory' },
        ],
      }),
      auditContext: buildEconomicAuditMetadata(identity, coreResponse, options.auditContext),
    });

    return {
      replayed: false as const,
      currency: financialResult.balanceAfter,
      weapon,
      weaponInventory: updatedInventory,
      newRefinement,
      cost,
      workshopLevel,
      previousBalance: lockedUser.currency,
    };
  });

  if (result.replayed) {
    // The in-transaction replay answered with the stored inventory, cost and message.
    return {
      replayed: true,
      response: {
        weaponInventory: result.response.weaponInventory,
        currency: result.response.currency,
        cost: result.response.cost,
        message: result.response.message,
      },
    };
  }

  // ── Post-commit ───────────────────────────────────────────────────

  // Refinement IS spending — purchase tracks it, resale doesn't, refinement does.
  if (options.spendingMonitor) {
    securityMonitor.trackSpending(userId, result.cost, options.spendingMonitor);
  }

  // Non-blocking audit log + structured log.
  try {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;
    await eventLogger.logWeaponRefinement(currentCycle, userId, {
      weaponInventoryId: result.weaponInventory.id,
      weaponId: result.weapon.id,
      tier,
      magnitude: magnitudeForStorage,
      targetAttribute: targetAttribute ?? null,
      costPaid: result.cost,
      workshopLevel: result.workshopLevel,
    });

    const attrInfo = targetAttribute ? ` (${targetAttribute} +${magnitudeForStorage})` : '';
    logger.info(
      `[Refine] User ${userId} | Weapon: ${result.weapon.name} (inv ${result.weaponInventory.id}) | ` +
      `Tier: ${tier}${attrInfo} | ` +
      `Cost: ₡${result.cost.toLocaleString()} | ` +
      `Workshop L${result.workshopLevel} | ` +
      `Slot: ${result.newRefinement.slotIndex}/5 | ` +
      `Balance: ₡${result.previousBalance.toLocaleString()} → ₡${result.currency.toLocaleString()}`,
    );
  } catch (logError) {
    logger.error('Failed to log weapon refinement event:', logError);
  }

  const messageAttr = targetAttribute ? ` ${targetAttribute} +${magnitudeForStorage}` : '';
  return {
    replayed: false,
    weaponInventory: result.weaponInventory,
    currency: result.currency,
    cost: result.cost,
    message: `Refined ${result.weapon.name}: ${tier}${messageAttr}`,
    weapon: result.weapon,
    refinement: result.newRefinement,
    workshopLevel: result.workshopLevel,
    magnitude: magnitudeForStorage,
    targetAttribute: targetAttribute ?? null,
  };
}
