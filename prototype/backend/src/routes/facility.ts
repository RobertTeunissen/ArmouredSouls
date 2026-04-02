import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { FACILITY_TYPES, getFacilityUpgradeCost, getFacilityConfig } from '../config/facilities';
import prisma from '../lib/prisma';
import { eventLogger } from '../services/common/eventLogger';
import { trackSpending } from '../services/economy/spendingTracker';
import logger from '../config/logger';
import { AuthError, AuthErrorCode } from '../errors/authErrors';
import { EconomyError, EconomyErrorCode } from '../errors/economyErrors';

const router = express.Router();

// Get all facility types and user's current levels
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;

    // Get user's current facilities and prestige
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prestige: true, currency: true },
    });

    if (!user) {
      throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404, { userId });
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

      // Calculate operating costs
      let currentOperatingCost = 0;
      let nextOperatingCost = 0;
      
      if (config.type === 'training_facility') {
        currentOperatingCost = currentLevel * 250;
        nextOperatingCost = nextLevel * 250;
      } else if (config.type === 'repair_bay') {
        currentOperatingCost = currentLevel > 0 ? 100 * currentLevel : 0;
        nextOperatingCost = nextLevel > 0 ? 100 * nextLevel : 0;
      } else if (config.type === 'weapons_workshop') {
        currentOperatingCost = currentLevel > 0 ? 100 * currentLevel : 0;
        nextOperatingCost = nextLevel > 0 ? 100 * nextLevel : 0;
      } else if (config.type === 'merchandising_hub') {
        currentOperatingCost = currentLevel * 200;
        nextOperatingCost = nextLevel * 200;
      } else if (config.type === 'streaming_studio') {
        currentOperatingCost = currentLevel * 100;
        nextOperatingCost = nextLevel * 100;
      } else if (config.type === 'storage_facility') {
        currentOperatingCost = currentLevel > 0 ? 500 + (currentLevel - 1) * 250 : 0;
        nextOperatingCost = nextLevel > 0 ? 500 + (nextLevel - 1) * 250 : 0;
      } else if (config.type === 'combat_training_academy' || config.type === 'defense_training_academy' || config.type === 'mobility_training_academy' || config.type === 'ai_training_academy') {
        currentOperatingCost = currentLevel * 250;
        nextOperatingCost = nextLevel * 250;
      } else if (config.type === 'research_lab' || config.type === 'medical_bay') {
        currentOperatingCost = currentLevel > 0 ? 2000 + (currentLevel - 1) * 1000 : 0;
        nextOperatingCost = nextLevel > 0 ? 2000 + (nextLevel - 1) * 1000 : 0;
      } else if (config.type === 'roster_expansion') {
        // Roster Expansion costs ₡500/day per robot slot beyond the first.
        // robotCount is already fetched above.
        currentOperatingCost = Math.max(0, (robotCount - 1)) * 500;
        // Next level adds one more slot — show cost assuming the slot is filled
        nextOperatingCost = robotCount * 500;
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
        currentOperatingCost,
        nextOperatingCost,
      };
    });

    res.json({
      facilities,
      userPrestige: user.prestige,
      userCurrency: user.currency,
      robotCount, // Include for frontend display
    });
});

// Upgrade a facility
router.post('/upgrade', authenticateToken, async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { facilityType } = req.body;

    if (!facilityType) {
      throw new EconomyError(EconomyErrorCode.INVALID_FACILITY_TYPE, 'Facility type is required', 400);
    }

    // Get facility config
    const config = getFacilityConfig(facilityType);
    if (!config) {
      throw new EconomyError(EconomyErrorCode.INVALID_FACILITY_TYPE, 'Invalid facility type', 400, { facilityType });
    }

    // Get user's current currency, prestige, and facility level
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404, { userId });
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
      throw new EconomyError(
        EconomyErrorCode.FACILITY_MAX_LEVEL,
        'Facility is already at maximum level',
        400,
        { facilityType, currentLevel, maxLevel: config.maxLevel }
      );
    }

    // Validate prestige requirement
    if (config.prestigeRequirements && config.prestigeRequirements[targetLevel - 1]) {
      const requiredPrestige = config.prestigeRequirements[targetLevel - 1];
      if (user.prestige < requiredPrestige) {
        throw new AuthError(
          AuthErrorCode.FORBIDDEN,
          `${config.name} Level ${targetLevel} requires ${requiredPrestige.toLocaleString()} prestige`,
          403,
          { required: requiredPrestige, current: user.prestige }
        );
      }
    }

    // Calculate upgrade cost
    const upgradeCost = getFacilityUpgradeCost(facilityType, currentLevel);

    if (upgradeCost === 0) {
      throw new EconomyError(
        EconomyErrorCode.FACILITY_MAX_LEVEL,
        'Facility is already at maximum level',
        400,
        { facilityType, currentLevel }
      );
    }

    // Check if user has enough currency
    if (user.currency < upgradeCost) {
      throw new EconomyError(
        EconomyErrorCode.INSUFFICIENT_CREDITS,
        'Insufficient credits',
        400,
        { required: upgradeCost, current: user.currency }
      );
    }

    // Perform upgrade in a transaction with atomic currency check
    const result = await prisma.$transaction(async (tx) => {
      // Re-read user inside transaction to prevent race conditions
      const freshUser = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!freshUser || freshUser.currency < upgradeCost) {
        throw new EconomyError(
          EconomyErrorCode.INSUFFICIENT_CREDITS,
          'Insufficient credits',
          400,
          { required: upgradeCost, current: freshUser?.currency ?? 0 }
        );
      }

      // Re-read facility inside transaction to prevent concurrent level bumps
      const freshFacility = await tx.facility.findUnique({
        where: {
          userId_facilityType: {
            userId,
            facilityType,
          },
        },
      });

      const freshLevel = freshFacility?.level || 0;

      // Verify level hasn't changed since our initial read
      if (freshLevel !== currentLevel) {
        throw new EconomyError(
          EconomyErrorCode.FACILITY_MAX_LEVEL,
          'Facility level changed, please retry',
          409,
          { expected: currentLevel, actual: freshLevel }
        );
      }

      // Atomic currency decrement
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { currency: { decrement: upgradeCost } },
      });

      // Upgrade or create facility
      let updatedFacility;
      if (freshFacility) {
        updatedFacility = await tx.facility.update({
          where: { id: freshFacility.id },
          data: { level: freshLevel + 1 },
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

    // Log facility transaction event
    try {
      // Get current cycle number
      const cycleMetadata = await prisma.cycleMetadata.findUnique({
        where: { id: 1 },
      });
      const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;

      // Log the facility upgrade/purchase event with balance tracking
      await eventLogger.logFacilityTransaction(
        currentCycle,
        userId,
        facilityType,
        currentLevel,
        targetLevel,
        upgradeCost,
        currentLevel === 0 ? 'purchase' : 'upgrade',
        user.currency,
        result.user.currency
      );

      // Console log for cycle logs
      const action = currentLevel === 0 ? 'Purchased' : 'Upgraded';
      logger.info(`[Facility] User ${userId} | ${action}: ${config.name} | Level: ${targetLevel} | Cost: ₡${upgradeCost.toLocaleString()} | Balance: ₡${user.currency.toLocaleString()} → ₡${result.user.currency.toLocaleString()}`);

      // Track spending for onboarding budget comparison
      await trackSpending(userId, 'facilities', upgradeCost);
    } catch (logError) {
      logger.error('Failed to log facility transaction event:', logError);
      // Don't fail the request if logging fails
    }

    res.json({
      facility: result.facility,
      currency: result.user.currency,
      message: 'Facility upgraded successfully',
    });
});

export default router;
