import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get user's weapon inventory
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const inventory = await prisma.weaponInventory.findMany({
      where: { userId },
      include: {
        weapon: true,
        robots: {
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

    // Get user's current currency and Weapon Workshop level
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        facilities: {
          where: { facilityType: 'weapons_workshop' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Apply Weapon Workshop discount
    const weaponWorkshopLevel = user.facilities[0]?.level || 0;
    const discountPercent = weaponWorkshopLevel * 5 + (weaponWorkshopLevel > 0 ? 5 : 0); // 10% at level 1, 15% at level 2, etc.
    const finalCost = Math.floor(weapon.cost * (1 - discountPercent / 100));

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
        weaponInventoryId: true,
      },
    });

    res.json({
      weapon: weaponInv.weapon,
      robots,
      currentlyEquippedTo: robots.find(r => r.weaponInventoryId === inventoryId)?.id || null,
    });
  } catch (error) {
    console.error('Available robots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
