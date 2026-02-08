import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { FACILITY_TYPES, getFacilityUpgradeCost } from '../config/facilities';

const router = express.Router();
const prisma = new PrismaClient();

// Get all facility types and user's current levels
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get user's current facilities
    const userFacilities = await prisma.facility.findMany({
      where: { userId },
    });

    // Create a map of facility types to levels
    const facilityLevels = userFacilities.reduce((acc, facility) => {
      acc[facility.facilityType] = facility.level;
      return acc;
    }, {} as Record<string, number>);

    // Combine with facility configs
    const facilities = FACILITY_TYPES.map((config) => ({
      ...config,
      currentLevel: facilityLevels[config.type] || 0,
      upgradeCost: getFacilityUpgradeCost(config.type, facilityLevels[config.type] || 0),
      canUpgrade: (facilityLevels[config.type] || 0) < config.maxLevel,
    }));

    res.json(facilities);
  } catch (error) {
    console.error('Facility list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upgrade a facility
router.post('/upgrade', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { facilityType } = req.body;

    if (!facilityType) {
      return res.status(400).json({ error: 'Facility type is required' });
    }

    // Get user's current currency and facility level
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get or create facility
    const facility = await prisma.facility.findUnique({
      where: {
        userId_facilityType: {
          userId,
          facilityType,
        },
      },
    });

    const currentLevel = facility?.level || 0;

    // Calculate upgrade cost
    const upgradeCost = getFacilityUpgradeCost(facilityType, currentLevel);

    if (upgradeCost === 0) {
      return res.status(400).json({ error: 'Facility is already at maximum level' });
    }

    // Check if user has enough currency
    if (user.currency < upgradeCost) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    // Perform upgrade in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct currency
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { currency: user.currency - upgradeCost },
      });

      // Upgrade or create facility
      let updatedFacility;
      if (facility) {
        updatedFacility = await tx.facility.update({
          where: { id: facility.id },
          data: { level: currentLevel + 1 },
        });
      } else {
        updatedFacility = await tx.facility.create({
          data: {
            userId,
            facilityType,
            level: 1,
          },
        });
      }

      return { user: updatedUser, facility: updatedFacility };
    });

    res.json({
      facility: result.facility,
      currency: result.user.currency,
      message: 'Facility upgraded successfully',
    });
  } catch (error) {
    console.error('Facility upgrade error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
