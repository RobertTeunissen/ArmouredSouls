import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { calculateStorageCapacity, getStorageStatus } from '../utils/storageCalculations';
import prisma from '../lib/prisma';
import { eventLogger } from '../services/eventLogger';
// import { calculateWeaponWorkshopDiscount, applyDiscount } from '../../../shared/utils/discounts';

// Temporary stub implementations
const calculateWeaponWorkshopDiscount = (level: number): number => {
  return level * 5; // 5% per level
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
    console.error('Weapon inventory list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Purchase a weapon into inventory
router.post('/purchase', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { weaponId } = req.body;

    if (!weaponId || isNaN(parseInt(weaponId))) {
      return res.status(400).json({ error: 'Valid weapon ID is required' });
    }

    const weaponIdNum = parseInt(weaponId);

    // Get weapon details
    const weapon = await prisma.weapon.findUnique({
      where: { id: weaponIdNum },
    });

    if (!weapon) {
      return res.status(404).json({ error: 'Weapon not found' });
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
      return res.status(404).json({ error: 'User not found' });
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
      return res.status(400).json({ 
        error: 'Storage capacity full',
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
      return res.status(400).json({ 
        error: 'Insufficient credits',
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
      console.log(`[Weapon] User ${userId} | Purchased: ${weapon.name} | Cost: ₡${finalCost.toLocaleString()}${discountInfo} | Balance: ₡${user.currency.toLocaleString()} → ₡${result.user.currency.toLocaleString()}`);
    } catch (logError) {
      console.error('Failed to log weapon purchase event:', logError);
      // Don't fail the request if logging fails
    }

    res.status(201).json({
      weaponInventory: result.weaponInventory,
      currency: result.user.currency,
      message: 'Weapon purchased successfully',
    });
  } catch (error) {
    console.error('Weapon purchase error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available robots for a weapon (robots that can equip this weapon)
router.get('/:id/available', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const inventoryId = parseInt(req.params.id);

    if (isNaN(inventoryId)) {
      return res.status(400).json({ error: 'Invalid weapon inventory ID' });
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
      return res.status(404).json({ error: 'Weapon not found in your inventory' });
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
    console.error('Available robots error:', error);
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
    console.error('Storage status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
