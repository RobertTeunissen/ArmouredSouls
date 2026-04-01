import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { calculateStorageCapacity, getStorageStatus } from '../utils/storageCalculations';
import prisma from '../lib/prisma';
import { eventLogger } from '../services/eventLogger';
import { trackSpending } from '../services/spendingTracker';
import logger from '../config/logger';
import { AppError, EconomyError, EconomyErrorCode, AuthError, AuthErrorCode } from '../errors';

// Discount helpers (local until shared/utils/discounts is available)
const calculateWeaponWorkshopDiscount = (level: number): number => {
  return level * 10; // 10% per level
};

const applyDiscount = (cost: number, discountPercent: number): number => {
  return Math.floor(cost * (1 - discountPercent / 100));
};

const router = express.Router();

// Get user's weapon inventory
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const inventory = await prisma.weaponInventory.findMany({
      where: { userId },
      include: {
        weapon: true,
        robotsMain: {
          select: {
            id: true,
            name: true,
          },
        },
        robotsOffhand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { purchasedAt: 'desc' },
    });

    res.json(inventory);
  } catch (error) {
    logger.error('Weapon inventory list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Purchase a weapon into inventory
router.post('/purchase', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { weaponId } = req.body;

    if (!weaponId || isNaN(parseInt(weaponId))) {
      throw new AppError('INVALID_WEAPON_ID', 'Valid weapon ID is required', 400);
    }

    const weaponIdNum = parseInt(weaponId);

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
          where: { 
            facilityType: { 
              in: ['weapons_workshop', 'storage_facility'] 
            } 
          },
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
    const currentWeaponCount = await prisma.weaponInventory.count({
      where: { userId },
    });

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

    // Purchase weapon in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct currency (with discount applied)
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { currency: user.currency - finalCost },
      });

      // Add weapon to inventory
      const weaponInventory = await tx.weaponInventory.create({
        data: {
          userId,
          weaponId: weaponIdNum,
        },
        include: {
          weapon: true,
        },
      });

      return { user: updatedUser, weaponInventory };
    });

    // Log weapon purchase event
    try {
      const cycleMetadata = await prisma.cycleMetadata.findUnique({
        where: { id: 1 },
      });
      const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;

      await eventLogger.logWeaponPurchase(
        currentCycle,
        userId,
        weaponIdNum,
        finalCost
      );

      // Console log for cycle logs
      const discountInfo = discountPercent > 0 ? ` | Discount: ${discountPercent}% (base: ₡${weapon.cost.toLocaleString()})` : '';
      logger.info(`[Weapon] User ${userId} | Purchased: ${weapon.name} | Cost: ₡${finalCost.toLocaleString()}${discountInfo} | Balance: ₡${user.currency.toLocaleString()} → ₡${result.user.currency.toLocaleString()}`);

      // Track spending for onboarding budget comparison
      await trackSpending(userId, 'weapons', finalCost);
    } catch (logError) {
      logger.error('Failed to log weapon purchase event:', logError);
      // Don't fail the request if logging fails
    }

    res.status(201).json({
      weaponInventory: result.weaponInventory,
      currency: result.user.currency,
      message: 'Weapon purchased successfully',
    });
  } catch (error) {
    logger.error('Weapon purchase error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available robots for a weapon (robots that can equip this weapon)
router.get('/:id/available', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const inventoryId = parseInt(String(req.params.id));

    if (isNaN(inventoryId)) {
      throw new AppError('INVALID_INVENTORY_ID', 'Invalid weapon inventory ID', 400);
    }

    // Verify weapon inventory belongs to user
    const weaponInv = await prisma.weaponInventory.findFirst({
      where: {
        id: inventoryId,
        userId,
      },
      include: {
        weapon: true,
      },
    });

    if (!weaponInv) {
      throw new EconomyError(EconomyErrorCode.WEAPON_NOT_FOUND, 'Weapon not found in your inventory', 404);
    }

    // Get all user's robots
    const robots = await prisma.robot.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        mainWeaponId: true,
        offhandWeaponId: true,
      },
    });

    res.json({
      weapon: weaponInv.weapon,
      robots,
      currentlyEquippedTo: robots.find(r => r.mainWeaponId === inventoryId || r.offhandWeaponId === inventoryId)?.id || null,
    });
  } catch (error) {
    logger.error('Available robots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get storage capacity status
router.get('/storage-status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get Storage Facility level
    const storageFacility = await prisma.facility.findUnique({
      where: { 
        userId_facilityType: {
          userId,
          facilityType: 'storage_facility',
        },
      },
    });

    const storageFacilityLevel = storageFacility?.level || 0;

    // Count current weapons
    const currentWeaponCount = await prisma.weaponInventory.count({
      where: { userId },
    });

    const storageStatus = getStorageStatus(currentWeaponCount, storageFacilityLevel);

    res.json(storageStatus);
  } catch (error) {
    logger.error('Storage status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
