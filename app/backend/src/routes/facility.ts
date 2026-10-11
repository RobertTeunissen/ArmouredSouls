import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { FACILITY_TYPES, getFacilityUpgradeCost } from '../config/facilities';
import { calculateFacilityOperatingCost, getRosterCapacity } from '../utils/economyFormulas';
import prisma from '../lib/prisma';
import { AuthError, AuthErrorCode } from '../errors/authErrors';
import { validateRequest } from '../middleware/schemaValidator';
import { getIdempotencyKey, idempotencyHeadersSchema } from '../utils/idempotency';
import { upgradeFacility } from '../services/economy/facilityUpgradeService';
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

    // Roster_Capacity for Booking Office / Merchandising Hub implication displays (Spec #46 R2)
    const rosterCapacity = getRosterCapacity(facilityLevels['roster_expansion'] ?? 0);

    // Filter to only implemented facilities, then combine with user data
    const implementedFacilities = FACILITY_TYPES.filter((f) => f.implemented);

    const facilities = implementedFacilities.map((config) => {
      const currentLevel = facilityLevels[config.type] || 0;
      const nextLevel = currentLevel + 1;
      const upgradeCost = getFacilityUpgradeCost(config.type, currentLevel);
      
      // Check prestige requirement for next level (unified curve, raw prestige)
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
      rosterCapacity, // Drives the Training Facility discount and merchandising (Spec #46)
    });
});

// Upgrade a facility
router.post('/upgrade', authenticateToken, validateRequest({ body: upgradeBodySchema, headers: idempotencyHeadersSchema }), async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const { facilityType } = req.body;
    const requestKey = getIdempotencyKey(req.headers);

    // Spec #55 task 2.1: the purchase itself lives in facilityUpgradeService.
    const result = await upgradeFacility(userId, facilityType, requestKey, {
      spendingMonitor: { sourceIp: req.ip || undefined, endpoint: req.originalUrl },
    });

    if (result.replayed) {
      res.json({ ...result.response, achievementUnlocks: [], replayed: true });
      return;
    }

    res.json({
      facility: result.facility,
      currency: result.currency,
      message: result.message,
      achievementUnlocks: await (async (): Promise<UnlockedAchievement[]> => {
        try {
          return await achievementService.checkAndAward(userId, null, {
            type: 'facility_upgraded',
            data: { facilityType, newLevel: result.newLevel },
          });
        } catch { return []; }
      })(),
    });
});

export default router;
