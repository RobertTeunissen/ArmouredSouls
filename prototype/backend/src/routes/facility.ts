import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { FACILITY_TYPES, getFacilityUpgradeCost, getFacilityConfig } from '../config/facilities';
import prisma from '../lib/prisma';

const router = express.Router();

// Get all facility types and user's current levels
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get user's current facilities and prestige
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prestige: true, currency: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userFacilities = await prisma.facility.findMany({
      where: { userId },
    });

    // Get robot count for repair bay discount calculation
    const robotCount = await prisma.robot.count({
      where: { 
        userId,
        name: { not: 'Bye Robot' } // Exclude system robots
      },
    });

    // Create a map of facility types to levels
    const facilityLevels = userFacilities.reduce((acc, facility) => {
      acc[facility.facilityType] = facility.level;
      return acc;
    }, {} as Record<string, number>);

    // Combine with facility configs
    const facilities = FACILITY_TYPES.map((config) => {
      const currentLevel = facilityLevels[config.type] || 0;
      const nextLevel = currentLevel + 1;
      const upgradeCost = getFacilityUpgradeCost(config.type, currentLevel);
      
      // Check prestige requirement for next level
      let nextLevelPrestigeRequired = 0;
      if (config.prestigeRequirements && nextLevel <= config.maxLevel) {
        nextLevelPrestigeRequired = config.prestigeRequirements[nextLevel - 1] || 0;
      }

      // Calculate dynamic benefits for repair bay
      let currentBenefit = config.benefits[currentLevel - 1] || 'No benefit yet';
      let nextBenefit = config.benefits[nextLevel - 1] || 'Maximum level reached';
      
      if (config.type === 'repair_bay' && currentLevel > 0) {
        const currentDiscount = Math.min(90, currentLevel * (5 + robotCount));
        currentBenefit = `${currentDiscount}% discount on repair costs`;
        
        if (nextLevel <= config.maxLevel) {
          const nextDiscount = Math.min(90, nextLevel * (5 + robotCount));
          nextBenefit = `${nextDiscount}% discount on repair costs`;
        }
      }

      return {
        ...config,
        currentLevel,
        upgradeCost,
        canUpgrade: currentLevel < config.maxLevel,
        nextLevelPrestigeRequired,
        hasPrestige: user.prestige >= nextLevelPrestigeRequired,
        canAfford: user.currency >= upgradeCost,
        currentBenefit,
        nextBenefit,
      };
    });

    res.json({
      facilities,
      userPrestige: user.prestige,
      userCurrency: user.currency,
      robotCount, // Include for frontend display
    });
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

    // Get facility config
    const config = getFacilityConfig(facilityType);
    if (!config) {
      return res.status(400).json({ error: 'Invalid facility type' });
    }

    // Get user's current currency, prestige, and facility level
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
    const targetLevel = currentLevel + 1;

    // Check if already at max level
    if (currentLevel >= config.maxLevel) {
      return res.status(400).json({ error: 'Facility is already at maximum level' });
    }

    // Validate prestige requirement
    if (config.prestigeRequirements && config.prestigeRequirements[targetLevel - 1]) {
      const requiredPrestige = config.prestigeRequirements[targetLevel - 1];
      if (user.prestige < requiredPrestige) {
        return res.status(403).json({
          error: 'Insufficient prestige',
          required: requiredPrestige,
          current: user.prestige,
          message: `${config.name} Level ${targetLevel} requires ${requiredPrestige.toLocaleString()} prestige`,
        });
      }
    }

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
