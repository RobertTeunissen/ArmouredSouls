import express, { Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { calculateStorageCapacity, getStorageStatus } from '../utils/storageCalculations';
import prisma from '../lib/prisma';
import { lockUserForSpending } from '../lib/creditGuard';
import { eventLogger } from '../services/common/eventLogger';
import { trackSpending } from '../services/economy/spendingTracker';
import logger from '../config/logger';
import { AppError, EconomyError, EconomyErrorCode, AuthError, AuthErrorCode } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam, safeName } from '../utils/securityValidation';
import { verifyWeaponOwnership } from '../middleware/ownership';
import { securityMonitor } from '../services/security/securityMonitor';
import { achievementService, type UnlockedAchievement } from '../services/achievement';
import { calculateWeaponWorkshopDiscount, applyDiscount, calculateWeaponResaleRate, applyResaleRate } from '../shared/utils/discounts';
import {
  calculateRefinementCost,
  validateRefinementSlotAvailable,
  validateAttributeStackCap,
  validateAttributeOnWeapon,
  validateShieldCompatibility,
  type RefinementTier,
} from '../shared/utils/weaponRefinement';
import { ROBOT_ATTRIBUTES } from '../shared/utils/robotAttributes';
import type { Weapon } from '../../generated/prisma';

const router = express.Router();

// ── Spec #34 helpers (refinement) ─────────────────────────────────────

/**
 * Read a numeric `<attribute>Bonus` field from a weapon catalog row.
 *
 * The Prisma `Weapon` type has 23 explicit `<attr>Bonus` fields, but indexed
 * access requires a structural cast. Encapsulated here so the route handler
 * stays readable.
 */
function getCatalogBonus(weapon: Weapon, attribute: string): number {
  const v = (weapon as unknown as Record<string, unknown>)[`${attribute}Bonus`];
  return typeof v === 'number' ? v : 0;
}

// --- Zod schemas for weapon inventory routes ---

const purchaseBodySchema = z.object({
  weaponId: z.coerce.number().int().positive(),
});

const inventoryIdParamsSchema = z.object({
  id: positiveIntParam,
});

/**
 * Body schema for the custom-name endpoint (Spec #34, R10).
 *
 * Accepts either `null` or a non-empty `safeName` (existing 50-char primitive
 * with the project's standard character allowlist). Empty strings sent by the
 * client are rejected by `safeName.min(1)`; clients clear the customName by
 * sending an explicit `null`. The transform normalises any null/empty input
 * to `null` so the route handler does not have to special-case it.
 */
const customNameBodySchema = z.object({
  customName: z
    .union([z.null(), safeName])
    .transform((v) => (v === null || v === '' ? null : v)),
});

/**
 * Per-user rate limiter for weapon resale (Spec #33 R3.10).
 *
 * Resale is a destructive endpoint that deletes a row and emits credits.
 * The general 300 req/min limiter is too lax for this — a determined caller
 * could flood audit_log. 30 sales per 5 minutes is generous for genuine
 * experimentation while capping abuse.
 *
 * Defined at module scope so a single instance is shared across requests
 * (otherwise each request would get its own counter).
 */
const resaleRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `weapon-resale:${authReq.user?.userId?.toString() || req.ip || 'unknown'}`;
  },
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    if (authReq.user?.userId) {
      securityMonitor.trackRateLimitViolation(authReq.user.userId, req.originalUrl);
    }
    res.status(429).json({
      error: 'Too many resale attempts. Try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 300,
    });
  },
});

/**
 * Per-user rate limiter for weapon refinement (Spec #34 R3.10).
 *
 * Refinement is a deliberate, costly action — 10 attempts per 5 minutes is
 * well above any reasonable manual cadence and well below an abuse threshold.
 * Tracked via `securityMonitor` so violations surface in the admin Security
 * dashboard.
 */
const refineRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `weapon-refine:${authReq.user?.userId?.toString() || req.ip || 'unknown'}`;
  },
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    if (authReq.user?.userId) {
      securityMonitor.trackRateLimitViolation(authReq.user.userId, req.originalUrl);
    }
    res.status(429).json({
      error: 'Too many refinement attempts. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 300,
    });
  },
});

/**
 * Zod schema for the refinement request body (Spec #34 R3.2).
 *
 * - `tier` is one of the four refinement tiers.
 * - `magnitude` is an int in [1,5].
 * - `targetAttribute` is restricted to the 23 known robot attributes.
 *
 * Cross-field rules enforced via `.refine()`:
 *  - hone / augment require `targetAttribute`.
 *  - sharpen / forge reject `targetAttribute` and require `magnitude === 1`.
 */
const refineBodySchema = z.object({
  tier: z.enum(['hone', 'augment', 'sharpen', 'forge']),
  magnitude: z.number().int().min(1).max(5),
  targetAttribute: z.enum([...ROBOT_ATTRIBUTES] as [string, ...string[]]).optional(),
}).refine(
  (b) => {
    if (b.tier === 'sharpen' || b.tier === 'forge') {
      return b.magnitude === 1 && b.targetAttribute === undefined;
    }
    // hone / augment
    return b.targetAttribute !== undefined;
  },
  {
    message:
      'targetAttribute is required for hone/augment and forbidden for sharpen/forge; magnitude must be 1 for sharpen/forge',
  },
);

/**
 * Per-user rate limiter for weapon custom-name edits (Spec #34, R10).
 *
 * Custom name is non-economic — no credit movement, no row lock, no combat
 * impact. The limiter exists to bound abuse (e.g., a script renaming the same
 * weapon thousands of times). 30 edits per 10 minutes is generous for genuine
 * iteration on a weapon's name while capping flood traffic.
 *
 * Defined at module scope so a single counter is shared across requests.
 */
const customNameRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `customName:${authReq.user?.userId?.toString() || req.ip || 'unknown'}`;
  },
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    if (authReq.user?.userId) {
      securityMonitor.trackRateLimitViolation(authReq.user.userId, req.originalUrl);
    }
    res.status(429).json({
      error: 'Too many custom name edits. Try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 600,
    });
  },
});

// Get user's weapon inventory
router.get('/', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  const inventory = await prisma.weaponInventory.findMany({
    where: { userId },
    include: {
      weapon: true,
      robotsMain: { select: { id: true, name: true } },
      robotsOffhand: { select: { id: true, name: true } },
      // Spec #34: include refinements so the My Inventory tab can render the
      // slot bar and rank-prefixed weapon name. Ordered by slotIndex for
      // stable display.
      refinements: { orderBy: { slotIndex: 'asc' } },
    },
    orderBy: { purchasedAt: 'desc' },
  });

  res.json(inventory);
});

// Purchase a weapon into inventory
router.post('/purchase', authenticateToken, validateRequest({ body: purchaseBodySchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { weaponId } = req.body;

  const weaponIdNum = Number(weaponId);

  // Get weapon details
  const weapon = await prisma.weapon.findUnique({
    where: { id: weaponIdNum },
  });

  if (!weapon) {
    throw new EconomyError(EconomyErrorCode.WEAPON_NOT_FOUND, 'Weapon not found', 404);
  }

  // Get user's current currency, Weapon Workshop level, and Storage Facility level
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

  // Get Storage Facility level
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

  // Check if user has enough currency
  if (user.currency < finalCost) {
    throw new EconomyError(EconomyErrorCode.INSUFFICIENT_CREDITS, 'Insufficient credits', 400, {
      required: finalCost,
      available: user.currency,
    });
  }

  // Purchase weapon in a transaction with row-level locking
  const result = await prisma.$transaction(async (tx) => {
    const lockedUser = await lockUserForSpending(tx, userId);

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

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { currency: { decrement: finalCost } },
    });

    const weaponInventory = await tx.weaponInventory.create({
      data: { userId, weaponId: weaponIdNum, pricePaid: finalCost },
      include: { weapon: true },
    });

    return { user: updatedUser, weaponInventory };
  });

  // Log weapon purchase event (non-blocking)
  try {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;

    await eventLogger.logWeaponPurchase(currentCycle, userId, weaponIdNum, finalCost);

    const discountInfo = discountPercent > 0 ? ` | Discount: ${discountPercent}% (base: ₡${weapon.cost.toLocaleString()})` : '';
    const previousBalance = result.user.currency + finalCost;
    logger.info(`[Weapon] User ${userId} | Purchased: ${weapon.name} | Cost: ₡${finalCost.toLocaleString()}${discountInfo} | Balance: ₡${previousBalance.toLocaleString()} → ₡${result.user.currency.toLocaleString()}`);

    await trackSpending(userId, 'weapons', finalCost);
    securityMonitor.trackSpending(userId, finalCost, { sourceIp: req.ip || undefined, endpoint: req.originalUrl });
  } catch (logError) {
    logger.error('Failed to log weapon purchase event:', logError);
  }

  // Record financial ledger entry (non-blocking)
  try {
    const { getCurrentCycleNumber } = await import('../services/battle/baseOrchestrator');
    const financialService = (await import('../services/financial/financialService')).default;
    const cycleNumber = await getCurrentCycleNumber();
    await financialService.recordTransaction({
      cycleNumber, userId, transactionType: 'weapon_purchase',
      amount: -finalCost, balanceAfter: result.user.currency,
      description: `Purchased weapon: ${weapon.name}`,
      metadata: { weaponId: weapon.id, weaponName: weapon.name },
    });
  } catch {}

  res.status(201).json({
    weaponInventory: result.weaponInventory,
    currency: result.user.currency,
    message: 'Weapon purchased successfully',
    achievementUnlocks: await (async (): Promise<UnlockedAchievement[]> => {
      try {
        return await achievementService.checkAndAward(userId, null, {
          type: 'weapon_purchased',
          data: { weaponId: weaponIdNum, weaponType: weapon.weaponType, weaponName: weapon.name },
        });
      } catch { return []; }
    })(),
  });
});

// Get available robots for a weapon
router.get('/:id/available', authenticateToken, validateRequest({ params: inventoryIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const inventoryId = parseInt(String(req.params.id));

  await verifyWeaponOwnership(prisma, inventoryId, userId);

  const weaponInv = await prisma.weaponInventory.findUnique({
    where: { id: inventoryId },
    include: { weapon: true },
  });

  if (!weaponInv) {
    throw new EconomyError(EconomyErrorCode.WEAPON_NOT_FOUND, 'Weapon not found in your inventory', 404);
  }

  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true, name: true, mainWeaponId: true, offhandWeaponId: true },
  });

  res.json({
    weapon: weaponInv.weapon,
    robots,
    currentlyEquippedTo: robots.find(r => r.mainWeaponId === inventoryId || r.offhandWeaponId === inventoryId)?.id || null,
  });
});

// Get storage capacity status
router.get('/storage-status', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;

  const storageFacility = await prisma.facility.findUnique({
    where: {
      userId_facilityType: { userId, facilityType: 'storage_facility' },
    },
  });

  const storageFacilityLevel = storageFacility?.level || 0;
  const currentWeaponCount = await prisma.weaponInventory.count({ where: { userId } });
  const storageStatus = getStorageStatus(currentWeaponCount, storageFacilityLevel);

  res.json(storageStatus);
});

/**
 * Sell a weapon from inventory (Spec #33).
 *
 * Resale price = pricePaid × resaleRate(workshopLevel) where pricePaid is the
 * actual credits the player paid (not catalog price — anti-exploit anchor)
 * and resaleRate scales 0%/L0 → 100%/L10.
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
router.delete(
  '/:id',
  authenticateToken,
  resaleRateLimiter, // After authenticateToken so req.user is populated for keyGenerator
  validateRequest({ params: inventoryIdParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const inventoryId = parseInt(String(req.params.id));

    await verifyWeaponOwnership(prisma, inventoryId, userId);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock user row first (existing convention for credit-affecting endpoints)
      const lockedUser = await lockUserForSpending(tx, userId);

      // 2. Lock the weapon_inventory row second.
      //    Serializes resale-vs-resale on the same row AND resale-vs-equip on
      //    the same weapon. The equip handlers acquire this same lock.
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
      //    NOT NULL is enforced by schema; this guards against migration
      //    tampering or future bugs that could write a negative value.
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

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { currency: { increment: salePrice } },
      });

      await tx.weaponInventory.delete({ where: { id: inventoryId } });

      return {
        user: updatedUser,
        weaponName: weaponMeta?.name ?? 'Weapon',
        weaponId: weaponInv.weaponId,
        salePrice,
        pricePaid: weaponInv.pricePaid,
        workshopLevel,
        resaleRate,
        previousBalance: lockedUser.currency,
      };
    });

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
        `Balance: ₡${result.previousBalance.toLocaleString()} → ₡${result.user.currency.toLocaleString()}`,
      );
    } catch (logError) {
      logger.error('Failed to log weapon sale event:', logError);
    }

    // Record financial ledger entry (non-blocking)
    try {
      const { getCurrentCycleNumber } = await import('../services/battle/baseOrchestrator');
      const financialService = (await import('../services/financial/financialService')).default;
      const cycleNumber = await getCurrentCycleNumber();
      await financialService.recordTransaction({
        cycleNumber, userId, transactionType: 'weapon_sale',
        amount: result.salePrice, balanceAfter: result.user.currency,
        description: `Sold weapon: ${result.weaponName}`,
        metadata: { weaponId: result.weaponId },
      });
    } catch {}

    // Achievement check (Spec #33 R7.10–R7.11)
    const achievementUnlocks = await (async (): Promise<UnlockedAchievement[]> => {
      try {
        return await achievementService.checkAndAward(userId, null, {
          type: 'weapon_sold',
          data: {
            weaponId: result.weaponId,
            salePrice: result.salePrice,
            pricePaid: result.pricePaid,
            workshopLevel: result.workshopLevel,
          },
        });
      } catch {
        return [];
      }
    })();

    res.json({
      salePrice: result.salePrice,
      currency: result.user.currency,
      weaponName: result.weaponName,
      message: `Sold ${result.weaponName} for ₡${result.salePrice.toLocaleString()}`,
      achievementUnlocks,
    });
  },
);

/**
 * Refine a weapon (Spec #34, R3).
 *
 * Permanently improves a single `WeaponInventory` row by inserting a
 * `WeaponRefinement` slot, decrementing the user's currency by the cost,
 * and incrementing `weapon_inventory.price_paid` by the same amount so
 * resale at any future Workshop level recovers a fraction of the spend.
 *
 * Tier gating (Workshop level): hone L1, augment L3, sharpen L5, forge L8.
 * The Workshop's existing prestige requirements implicitly gate higher
 * tiers — no separate prestige check is needed here.
 *
 * ## Two-tier locking (matches Spec #33 lock acquisition order)
 *
 *  1. `lockUserForSpending(tx, userId)` — serialises against any concurrent
 *     currency mutation for this user (purchase, resale, repair, etc.).
 *  2. `SELECT ... FOR UPDATE` on `weapon_inventory` — serialises against
 *     concurrent refinement, resale, and equip on the same weapon row.
 *
 * Acquiring the user lock FIRST and the weapon lock SECOND matches the
 * resale handler's order; mismatched orders would create deadlock potential.
 *
 * ## Validation chain (each step throws an `EconomyError` on failure)
 *
 *  - Tier locked vs Workshop level → WEAPON_REFINEMENT_TIER_LOCKED
 *  - Slot cap (≥ 5) / per-tier cap (Sharpen, Forge ≥ 2) → SLOT_/TIER_CAP_EXCEEDED
 *  - Shield + Sharpen/Forge → SHIELD_CANNOT_TAKE_DPS_TIER
 *  - (hone/augment) target attribute on/off the weapon → ATTRIBUTE_NOT_/ALREADY_ON_WEAPON
 *  - (hone/augment) per-attribute stack cap (catalog + prior refinements + this one ≤ +10) → ATTRIBUTE_STACK_CAP_EXCEEDED
 *  - User currency < cost → INSUFFICIENT_CREDITS (HTTP 402)
 *
 * Refinement IS spending — `securityMonitor.trackSpending` is called after
 * the transaction commits (resale skips this; purchase calls it).
 */
router.post(
  '/:id/refine',
  authenticateToken,
  refineRateLimiter, // After authenticateToken so req.user is populated for keyGenerator
  validateRequest({ params: inventoryIdParamsSchema, body: refineBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const inventoryId = parseInt(String(req.params.id));
    const { tier, magnitude, targetAttribute } = req.body as z.infer<typeof refineBodySchema>;

    await verifyWeaponOwnership(prisma, inventoryId, userId);

    // Sharpen/Forge always store magnitude 1 (the Zod schema enforces this on
    // input; we mirror it on the storage path so an audit log of the row
    // never disagrees with the formula module's expectations).
    const magnitudeForStorage = (tier === 'sharpen' || tier === 'forge') ? 1 : magnitude;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock user row first (matches Spec #33 lock acquisition order)
      const lockedUser = await lockUserForSpending(tx, userId);

      // 2. Lock the weapon_inventory row second.
      //    Serialises refine-vs-refine, refine-vs-resale, and refine-vs-equip
      //    on the same weapon. Equip handlers acquire the same lock.
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
      const requiredLevels: Record<RefinementTier, number> = {
        hone: 1, augment: 3, sharpen: 5, forge: 8,
      };
      const requiredWorkshopLevel = requiredLevels[tier];
      if (workshopLevel < requiredWorkshopLevel) {
        throw new EconomyError(
          EconomyErrorCode.WEAPON_REFINEMENT_TIER_LOCKED,
          `Weapons Workshop level ${requiredWorkshopLevel} required to ${tier}.`,
          403,
          { requiredWorkshopLevel, currentWorkshopLevel: workshopLevel },
        );
      }

      // 7. Validation chain — each validator returns a discriminated union;
      //    we map failed results onto a specific EconomyError code.
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

      if (tier === 'hone' || tier === 'augment') {
        // Zod has already enforced targetAttribute is present for hone/augment.
        const attribute = targetAttribute as string;
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

      // 10. Compute the next available slotIndex (1..5, lowest unused).
      //     Stable per weapon — once filled, a slot's index never changes.
      const usedSlots = new Set(refinements.map((r) => r.slotIndex));
      let slotIndex = 1;
      while (usedSlots.has(slotIndex)) slotIndex++;
      // slotIndex is guaranteed to be in [1..5] because slotCheck above passed.

      // 11. Mutations: deduct currency, increment pricePaid, insert refinement row.
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { currency: { decrement: cost } },
      });

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

      return {
        user: updatedUser,
        weapon,
        weaponInventory: updatedInventory,
        newRefinement,
        cost,
        workshopLevel,
        previousBalance: lockedUser.currency,
      };
    });

    // ── Post-commit ───────────────────────────────────────────────────

    // Refinement IS spending — purchase tracks it, resale doesn't, refinement does.
    securityMonitor.trackSpending(userId, result.cost, {
      sourceIp: req.ip || undefined,
      endpoint: req.originalUrl,
    });

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
        `Balance: ₡${result.previousBalance.toLocaleString()} → ₡${result.user.currency.toLocaleString()}`,
      );
    } catch (logError) {
      logger.error('Failed to log weapon refinement event:', logError);
    }

    // Record financial ledger entry (non-blocking)
    try {
      const { getCurrentCycleNumber } = await import('../services/battle/baseOrchestrator');
      const financialService = (await import('../services/financial/financialService')).default;
      const cycleNumber = await getCurrentCycleNumber();
      await financialService.recordTransaction({
        cycleNumber, userId, transactionType: 'weapon_refinement',
        amount: -result.cost, balanceAfter: result.user.currency,
        description: `Refined weapon slot ${result.newRefinement.slotIndex}`,
        metadata: { weaponInventoryId: inventoryId, slotIndex: result.newRefinement.slotIndex },
      });
    } catch {}

    // Achievement check (wired in Task 14; the trigger map already includes
    // 'weapon_refined'). Failures must NOT block the response.
    const achievementUnlocks = await (async (): Promise<UnlockedAchievement[]> => {
      try {
        return await achievementService.checkAndAward(userId, null, {
          type: 'weapon_refined',
          data: {
            weaponInventoryId: result.weaponInventory.id,
            weaponId: result.weapon.id,
            tier,
            magnitude: magnitudeForStorage,
            targetAttribute: targetAttribute ?? null,
            costPaid: result.cost,
            workshopLevel: result.workshopLevel,
          },
        });
      } catch {
        return [];
      }
    })();

    const messageAttr = targetAttribute ? ` ${targetAttribute} +${magnitudeForStorage}` : '';
    res.json({
      weaponInventory: result.weaponInventory,
      currency: result.user.currency,
      cost: result.cost,
      message: `Refined ${result.weapon.name}: ${tier}${messageAttr}`,
      achievementUnlocks,
    });
  },
);

/**
 * Edit the custom (player-set) name on a weapon (Spec #34, R10).
 *
 * `customName` is a non-economic, well-bounded display field on the
 * `WeaponInventory` row. No credit movement, no combat impact, no `pricePaid`
 * change — so this endpoint deliberately runs without a row lock. The
 * per-user `customNameRateLimiter` (30 req / 10 min) is the only contention
 * guard, which is sufficient for a field whose only mutator is the player
 * themselves.
 *
 * The body schema accepts `null` to clear the name or a non-empty `safeName`
 * (50-char allowlist primitive). Empty strings are normalised to `null` by
 * the schema's transform so the database stores either a real name or NULL.
 */
router.patch(
  '/:id/custom-name',
  authenticateToken,
  customNameRateLimiter, // After authenticateToken so req.user is populated for keyGenerator
  validateRequest({ params: inventoryIdParamsSchema, body: customNameBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const inventoryId = parseInt(String(req.params.id));
    const { customName } = req.body as z.infer<typeof customNameBodySchema>;

    await verifyWeaponOwnership(prisma, inventoryId, userId);

    const updated = await prisma.weaponInventory.update({
      where: { id: inventoryId },
      data: { customName },
      include: {
        weapon: true,
        refinements: { orderBy: { slotIndex: 'asc' } },
      },
    });

    res.json({ weaponInventory: updated });
  },
);

export default router;
