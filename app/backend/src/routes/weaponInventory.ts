import express, { Response } from 'express';
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
import { calculateWeaponWorkshopDiscount, applyDiscount } from '../shared/utils/discounts';

const router = express.Router();

// --- Zod schemas for weapon inventory routes ---

const purchaseBodySchema = z.object({
  weaponId: z.coerce.number().int().positive(),
});

const inventoryIdParamsSchema = z.object({
  id: positiveIntParam,
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
      data: { userId, weaponId: weaponIdNum },
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

export default router;
