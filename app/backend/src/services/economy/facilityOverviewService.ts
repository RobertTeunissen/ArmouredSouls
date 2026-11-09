/**
 * The player Facilities overview (`GET /api/facilities`): every implemented
 * facility with the stable's level, next-level cost, prestige gate,
 * affordability, current/next benefit text and operating costs. Moved out of
 * `routes/facility.ts`; the response shape is unchanged.
 */
import prisma from '../../lib/prisma';
import { FACILITY_TYPES, getFacilityUpgradeCost } from '../../config/facilities';
import { calculateFacilityOperatingCost, getRosterCapacity } from '../../utils/economyFormulas';
import { AuthError, AuthErrorCode } from '../../errors/authErrors';
// Spec #46 R11: Training Facility discount is roster-dependent.
import { calculateTrainingFacilityDiscount } from '../../shared/utils/discounts';
// Season 2 #525: Repair Bay discount is 6% per level, independent of robot count.
import { calculateRepairBayDiscountPercent } from '../../shared/utils/repairCost';

export async function getFacilityOverview(userId: number) {
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

  // Robot count for the Roster Expansion operating cost and the frontend display
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
      const currentDiscount = calculateRepairBayDiscountPercent(currentLevel);
      currentBenefit = `${currentDiscount}% discount on repair costs`;
      
      if (nextLevel <= config.maxLevel) {
        const nextDiscount = calculateRepairBayDiscountPercent(nextLevel);
        nextBenefit = `${nextDiscount}% discount on repair costs`;
      }
    }

    // Training Facility discount depends on Roster_Capacity as well as level
    // (Spec #46 R11), so the static benefit strings — which quote the
    // single-robot best case — are replaced with the player's actual figure.
    // Without this a 5-robot stable at L5 would read "up to 45%" while
    // actually receiving 25%.
    if (config.type === 'training_facility') {
      // The per-level rate is the shared discount at level 1 (#526: 0.75 ×
      // (10 − capacity), e.g. 6.75% at 1 slot), never a local copy.
      const ratePerLevel = calculateTrainingFacilityDiscount(1, rosterCapacity);
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

  return {
    facilities,
    userPrestige: user.prestige,
    userCurrency: user.currency,
    robotCount, // Include for frontend display
    rosterCapacity, // Drives the Training Facility discount and merchandising (Spec #46)
  };
}
