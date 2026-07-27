import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { FACILITY_TYPES, getFacilityUpgradeCost, getFacilityConfig } from '../config/facilities';
import { calculateFacilityOperatingCost, getRosterCapacity } from '../utils/economyFormulas';
import prisma from '../lib/prisma';
import { lockUserForSpending } from '../lib/creditGuard';
import { eventLogger } from '../services/common/eventLogger';
import { trackSpending } from '../services/economy/spendingTracker';
import logger from '../config/logger';
import { AuthError, AuthErrorCode } from '../errors/authErrors';
import { EconomyError, EconomyErrorCode } from '../errors/economyErrors';
import { validateRequest } from '../middleware/schemaValidator';
import { recordLedgerEntry } from '../services/financial/recordLedgerEntry';
import { securityMonitor } from '../services/security/securityMonitor';
import { achievementService, type UnlockedAchievement } from '../services/achievement';
// Spec #46 R11: Training Facility discount is roster-dependent.
import { calculateTrainingFacilityDiscount } from '../shared/utils/discounts';

const router = express.Router();

// --- Zod schemas for facility routes ---

const upgradeBodySchema = z.object({
  facilityType: z.string().min(1).max(50),
});

// Get all facility types and user's current levels
router.get('/', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
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
      where: { userId },
    });

    // Create a map of facility types to levels
    const facilityLevels = userFacilities.reduce((acc, facility) => {
      acc[facility.facilityType] = facility.level;
      return acc;
    }, {} as Record<string, number>);

    // Roster_Capacity and Prestige_Per_Slot for per-slot prestige gates and for
    // the Booking Office / Merchandising Hub implication displays (Spec #46 R2)
    const rosterCapacity = getRosterCapacity(facilityLevels['roster_expansion'] ?? 0);
    const prestigePerSlot = user.prestige / rosterCapacity;

    // Filter to only implemented facilities, then combine with user data
    const implementedFacilities = FACILITY_TYPES.filter((f) => f.implemented);

    const facilities = implementedFacilities.map((config) => {
      const currentLevel = facilityLevels[config.type] || 0;
      const nextLevel = currentLevel + 1;
      const upgradeCost = getFacilityUpgradeCost(config.type, currentLevel);
      
      // Check prestige requirement for next level
      let nextLevelPrestigeRequired = 0;
      if (config.prestigeRequirements && nextLevel <= config.maxLevel) {
        nextLevelPrestigeRequired = config.prestigeRequirements[nextLevel - 1] || 0;
      }

      // Facilities flagged `prestigeGateIsPerSlot` gate on Prestige_Per_Slot
      // rather than raw prestige, matching the quantity their benefit scales
      // with (Spec #46 R2.11). Only merchandising_hub sets the flag today.
      const gateValue = config.prestigeGateIsPerSlot ? prestigePerSlot : user.prestige;

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

      // Training Facility discount depends on Roster_Capacity as well as level
      // (Spec #46 R11), so the static benefit strings — which quote the
      // single-robot best case — are replaced with the player's actual figure.
      // Without this a 5-robot stable at L5 would read "up to 45%" while
      // actually receiving 25%.
      if (config.type === 'training_facility') {
        const ratePerLevel = Math.max(0, 10 - rosterCapacity);
        const slotLabel = `${rosterCapacity} slot${rosterCapacity === 1 ? '' : 's'}`;

        if (currentLevel > 0) {
          const currentDiscount = calculateTrainingFacilityDiscount(currentLevel, rosterCapacity);
          currentBenefit = ratePerLevel > 0
            ? `${currentDiscount}% off attribute upgrades (${ratePerLevel}% per level × ${currentLevel} levels, at ${slotLabel})`
            : `No discount — a ${slotLabel} roster earns 0% per level. Merge into fewer robots to benefit.`;
        }

        if (nextLevel <= config.maxLevel) {
          const nextDiscount = calculateTrainingFacilityDiscount(nextLevel, rosterCapacity);
          nextBenefit = ratePerLevel > 0
            ? `${nextDiscount}% off attribute upgrades (${ratePerLevel}% per level × ${nextLevel} levels, at ${slotLabel})`
            : `Still no discount at ${slotLabel} — upgrading this facility adds nothing until your roster is smaller.`;
        }
      }

      // Operating costs come from the single shared formula (Spec #46 R6.1).
      //
      // This previously duplicated `calculateFacilityOperatingCost()` as a
      // per-type if/else chain, and the duplicate had drifted: `booking_office`
      // and `tuning_bay` were both absent, so the response reported ₡0/day for
      // two facilities that actually cost ₡150 and ₡300 per level.
      //
      // `roster_expansion` keeps its special case because its cost is charged
      // per *filled robot slot* rather than per facility level, which the
      // level-only shared formula cannot express — it returns 0 for this type
      // by design (R6.2).
      let currentOperatingCost: number;
      let nextOperatingCost: number;

      if (config.type === 'roster_expansion') {
        currentOperatingCost = Math.max(0, robotCount - 1) * 500;
        // Next level adds one more slot — show the cost assuming it gets filled
        nextOperatingCost = robotCount * 500;
      } else {
        currentOperatingCost = calculateFacilityOperatingCost(config.type, currentLevel);
        nextOperatingCost = calculateFacilityOperatingCost(config.type, nextLevel);
      }

      return {
        ...config,
        currentLevel,
        upgradeCost,
        canUpgrade: currentLevel < config.maxLevel,
        nextLevelPrestigeRequired,
        prestigeGateIsPerSlot: config.prestigeGateIsPerSlot ?? false,
        hasPrestige: gateValue >= nextLevelPrestigeRequired,
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
      rosterCapacity, // Drives the Training Facility discount and merchandising (Spec #46)
    });
});

// Upgrade a facility
router.post('/upgrade', authenticateToken, validateRequest({ body: upgradeBodySchema }), async (req: AuthRequest, res: Response) => {
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

    // Validate prestige requirement.
    //
    // Facilities flagged `prestigeGateIsPerSlot` compare against Prestige_Per_Slot
    // rather than raw prestige, matching the quantity their benefit scales with
    // (Spec #46 R2.11). Note this runs only on the upgrade path, so a facility
    // already owned above its current gate keeps its level and continues
    // producing income — there is no downgrade or refund path (R2.12).
    if (config.prestigeRequirements && config.prestigeRequirements[targetLevel - 1]) {
      const requiredPrestige = config.prestigeRequirements[targetLevel - 1];

      let gateValue = user.prestige;
      let gateUnit = 'prestige';

      if (config.prestigeGateIsPerSlot) {
        const rosterExpansion = await prisma.facility.findUnique({
          where: { userId_facilityType: { userId, facilityType: 'roster_expansion' } },
          select: { level: true },
        });
        const rosterCapacity = getRosterCapacity(rosterExpansion?.level ?? 0);
        gateValue = user.prestige / rosterCapacity;
        gateUnit = `prestige per robot slot (you have ${user.prestige.toLocaleString()} prestige across ${rosterCapacity} slot${rosterCapacity === 1 ? '' : 's'})`;
      }

      if (gateValue < requiredPrestige) {
        throw new AuthError(
          AuthErrorCode.FORBIDDEN,
          `${config.name} Level ${targetLevel} requires ${requiredPrestige.toLocaleString()} ${gateUnit}`,
          403,
          { required: requiredPrestige, current: Math.floor(gateValue) }
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

    // Perform upgrade in a transaction with row-level locking
    const result = await prisma.$transaction(async (tx) => {
      // Acquire exclusive row lock — blocks concurrent purchases for this user
      const lockedUser = await lockUserForSpending(tx, userId);

      if (lockedUser.currency < upgradeCost) {
        throw new EconomyError(
          EconomyErrorCode.INSUFFICIENT_CREDITS,
          'Insufficient credits',
          400,
          { required: upgradeCost, current: lockedUser.currency }
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

      // Atomic currency decrement — safe because row is locked
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

      // Security monitoring: track spending
      securityMonitor.trackSpending(userId, upgradeCost, { sourceIp: req.ip || undefined, endpoint: req.originalUrl });
    } catch (logError) {
      logger.error('Failed to log facility transaction event:', logError);
      // Don't fail the request if logging fails
    }

    // Record financial ledger entry (non-blocking)
    recordLedgerEntry({
      userId, transactionType: 'facility_upgrade',
      amount: -upgradeCost, balanceAfter: result.user.currency,
      description: `Upgraded ${facilityType} to level ${targetLevel}`,
      metadata: { facilityType, newLevel: targetLevel },
    });

    res.json({
      facility: result.facility,
      currency: result.user.currency,
      message: 'Facility upgraded successfully',
      achievementUnlocks: await (async (): Promise<UnlockedAchievement[]> => {
        try {
          return await achievementService.checkAndAward(userId, null, {
            type: 'facility_upgraded',
            data: { facilityType, newLevel: targetLevel },
          });
        } catch { return []; }
      })(),
    });
});

export default router;
