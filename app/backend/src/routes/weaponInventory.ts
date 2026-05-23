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
import { positiveIntParam } from '../utils/securityValidation';
import { verifyWeaponOwnership } from '../middleware/ownership';
import { securityMonitor } from '../services/security/securityMonitor';
import { achievementService, type UnlockedAchievement } from '../services/achievement';
import { calculateWeaponWorkshopDiscount, applyDiscount, calculateWeaponResaleRate, applyResaleRate } from '../shared/utils/discounts';

const router = express.Router();

// --- Zod schemas for weapon inventory routes ---

const purchaseBodySchema = z.object({
  weaponId: z.coerce.number().int().positive(),
});

const inventoryIdParamsSchema = z.object({
  id: positiveIntParam,
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

export default router;
