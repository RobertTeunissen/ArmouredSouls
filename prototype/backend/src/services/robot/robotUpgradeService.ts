/**
 * Robot attribute upgrade validation and cost calculation.
 *
 * Extracted from the POST /:id/upgrades route handler. The Prisma
 * transaction itself stays in the route; this module handles the pure
 * validation + cost math that runs both before and inside the transaction.
 */

import { getCapForLevel } from '../../../../shared/utils/academyCaps';
import { calculateBaseCost } from '../../../../shared/utils/upgradeCosts';
import { calculateTrainingFacilityDiscount } from '../../../../shared/utils/discounts';
import { RobotError, RobotErrorCode } from '../../errors/robotErrors';

// ── Valid attribute names ────────────────────────────────────────────

export const VALID_ATTRIBUTES = [
  'combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed',
  'armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols',
  'hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
  'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
  'syncProtocols', 'supportSystems', 'formationTactics',
] as const;

// ── Types ────────────────────────────────────────────────────────────

export interface UpgradeRequest {
  currentLevel: number;
  plannedLevel: number;
}

export interface UpgradeOperation {
  attribute: string;
  fromLevel: number;
  toLevel: number;
  cost: number;
}

export interface AcademyLevels {
  combat_training_academy: number;
  defense_training_academy: number;
  mobility_training_academy: number;
  ai_training_academy: number;
}

export interface ValidateUpgradesResult {
  totalCost: number;
  upgradeOperations: UpgradeOperation[];
}

// ── Map attribute → academy type ─────────────────────────────────────

export const ATTRIBUTE_TO_ACADEMY: Record<string, string> = {
  // Combat Systems
  combatPower: 'combat_training_academy',
  targetingSystems: 'combat_training_academy',
  criticalSystems: 'combat_training_academy',
  penetration: 'combat_training_academy',
  weaponControl: 'combat_training_academy',
  attackSpeed: 'combat_training_academy',
  // Defensive Systems
  armorPlating: 'defense_training_academy',
  shieldCapacity: 'defense_training_academy',
  evasionThrusters: 'defense_training_academy',
  damageDampeners: 'defense_training_academy',
  counterProtocols: 'defense_training_academy',
  // Chassis & Mobility
  hullIntegrity: 'mobility_training_academy',
  servoMotors: 'mobility_training_academy',
  gyroStabilizers: 'mobility_training_academy',
  hydraulicSystems: 'mobility_training_academy',
  powerCore: 'mobility_training_academy',
  // AI Processing + Team Coordination
  combatAlgorithms: 'ai_training_academy',
  threatAnalysis: 'ai_training_academy',
  adaptiveAI: 'ai_training_academy',
  logicCores: 'ai_training_academy',
  syncProtocols: 'ai_training_academy',
  supportSystems: 'ai_training_academy',
  formationTactics: 'ai_training_academy',
};

// ── Pre-transaction validation ───────────────────────────────────────

/**
 * Validate upgrade requests and calculate total cost.
 *
 * Called once before the transaction (optimistic check) and once inside
 * the transaction with fresh data (authoritative check).
 *
 * @param upgrades       Map of attribute → { currentLevel, plannedLevel }
 * @param robot          The robot record (needs attribute fields)
 * @param trainingLevel  Training Facility level (for discount)
 * @param academyLevels  Academy levels per type (for caps)
 * @param verifyCurrentLevel  If true, verify currentLevel matches robot data
 */
export function validateAndCalculateUpgrades(
  upgrades: Record<string, UpgradeRequest>,
  robot: Record<string, unknown>,
  trainingLevel: number,
  academyLevels: AcademyLevels,
  verifyCurrentLevel: boolean = true,
): ValidateUpgradesResult {
  let totalCost = 0;
  const upgradeOperations: UpgradeOperation[] = [];

  for (const [attribute, upgrade] of Object.entries(upgrades)) {
    if (!VALID_ATTRIBUTES.includes(attribute as typeof VALID_ATTRIBUTES[number])) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, `Invalid attribute: ${attribute}`, 400);
    }

    const { currentLevel, plannedLevel } = upgrade;

    if (typeof currentLevel !== 'number' || typeof plannedLevel !== 'number') {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, `Invalid upgrade data for ${attribute}`, 400);
    }

    if (plannedLevel <= currentLevel) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, `Planned level must be greater than current level for ${attribute}`, 400);
    }

    // Get current level from robot
    const robotCurrentLevelValue = robot[attribute];
    const robotCurrentLevel = typeof robotCurrentLevelValue === 'number'
      ? robotCurrentLevelValue
      : Number(robotCurrentLevelValue);
    const robotCurrentLevelInt = Math.floor(robotCurrentLevel);

    if (verifyCurrentLevel && robotCurrentLevelInt !== Math.floor(currentLevel)) {
      throw new RobotError(
        RobotErrorCode.INVALID_ROBOT_ATTRIBUTES,
        `Current level mismatch for ${attribute}. Expected ${robotCurrentLevelInt}, got ${Math.floor(currentLevel)}`,
        400,
      );
    }

    // Check academy cap
    const academyType = ATTRIBUTE_TO_ACADEMY[attribute];
    const academyLevel = academyLevels[academyType as keyof AcademyLevels] || 0;
    const cap = getCapForLevel(academyLevel);

    if (plannedLevel > cap) {
      throw new RobotError(
        RobotErrorCode.INVALID_ROBOT_ATTRIBUTES,
        `Attribute ${attribute} exceeds cap of ${cap}. Upgrade the corresponding academy to increase the cap.`,
        400,
      );
    }

    // Calculate cost with Training Facility discount
    const discountPercent = calculateTrainingFacilityDiscount(trainingLevel);
    let attributeCost = 0;

    const fromLevel = verifyCurrentLevel ? Math.floor(currentLevel) : robotCurrentLevelInt;
    for (let level = fromLevel; level < plannedLevel; level++) {
      const baseCost = calculateBaseCost(level);
      const discountedCost = Math.floor(baseCost * (1 - discountPercent / 100));
      attributeCost += discountedCost;
    }

    totalCost += attributeCost;
    upgradeOperations.push({
      attribute,
      fromLevel,
      toLevel: plannedLevel,
      cost: attributeCost,
    });
  }

  return { totalCost, upgradeOperations };
}


// ── In-transaction validation (fresh data) ───────────────────────────

/**
 * Re-validate upgrades inside the locked transaction with fresh robot
 * and facility data. Throws on concurrent-upgrade conflicts (409).
 */
export function validateUpgradesFresh(
  upgrades: Record<string, UpgradeRequest>,
  freshRobot: Record<string, unknown>,
  freshTrainingLevel: number,
  freshAcademyLevels: AcademyLevels,
): ValidateUpgradesResult {
  let totalCost = 0;
  const upgradeOperations: UpgradeOperation[] = [];

  for (const [attribute, upgrade] of Object.entries(upgrades)) {
    const { plannedLevel } = upgrade;

    // Re-read current level from fresh robot data
    const freshCurrentLevelValue = freshRobot[attribute];
    const freshCurrentLevel = typeof freshCurrentLevelValue === 'number'
      ? freshCurrentLevelValue
      : Number(freshCurrentLevelValue);
    const freshCurrentLevelInt = Math.floor(freshCurrentLevel);

    // If attribute already at or above planned level, conflict
    if (freshCurrentLevelInt >= plannedLevel) {
      throw new RobotError(
        RobotErrorCode.INVALID_ROBOT_ATTRIBUTES,
        `Attribute ${attribute} already at level ${freshCurrentLevelInt}, cannot upgrade to ${plannedLevel}. Please refresh and retry.`,
        409,
      );
    }

    // Re-verify academy cap with fresh data
    const academyType = ATTRIBUTE_TO_ACADEMY[attribute];
    const freshAcademyLevel = freshAcademyLevels[academyType as keyof AcademyLevels] || 0;
    const freshCap = getCapForLevel(freshAcademyLevel);

    if (plannedLevel > freshCap) {
      throw new RobotError(
        RobotErrorCode.INVALID_ROBOT_ATTRIBUTES,
        `Attribute ${attribute} exceeds cap of ${freshCap}. Upgrade the corresponding academy to increase the cap.`,
        400,
      );
    }

    // Recalculate cost with fresh Training Facility discount
    const freshDiscountPercent = calculateTrainingFacilityDiscount(freshTrainingLevel);
    let attributeCost = 0;

    for (let level = freshCurrentLevelInt; level < plannedLevel; level++) {
      const baseCost = calculateBaseCost(level);
      const discountedCost = Math.floor(baseCost * (1 - freshDiscountPercent / 100));
      attributeCost += discountedCost;
    }

    totalCost += attributeCost;
    upgradeOperations.push({
      attribute,
      fromLevel: freshCurrentLevelInt,
      toLevel: plannedLevel,
      cost: attributeCost,
    });
  }

  return { totalCost, upgradeOperations };
}


// ── Full upgrade transaction ─────────────────────────────────────────

import prisma from '../../lib/prisma';
import { lockUserForSpending } from '../../lib/creditGuard';
import { calculateMaxHP, calculateMaxShield } from '../../utils/robotCalculations';

const FACILITY_TYPES = ['training_facility', 'combat_training_academy', 'defense_training_academy', 'mobility_training_academy', 'ai_training_academy'] as const;

function extractAcademyLevels(facilities: Array<{ facilityType: string; level: number }>): AcademyLevels {
  return {
    combat_training_academy: facilities.find(f => f.facilityType === 'combat_training_academy')?.level || 0,
    defense_training_academy: facilities.find(f => f.facilityType === 'defense_training_academy')?.level || 0,
    mobility_training_academy: facilities.find(f => f.facilityType === 'mobility_training_academy')?.level || 0,
    ai_training_academy: facilities.find(f => f.facilityType === 'ai_training_academy')?.level || 0,
  };
}

export interface UpgradeTransactionResult {
  user: { currency: number };
  robot: unknown;
  totalCost: number;
  upgradeOperations: UpgradeOperation[];
}

/**
 * Fetch user + facilities, run optimistic validation, then execute the
 * locked transaction with fresh-data re-validation.
 */
export async function executeUpgradeTransaction(
  userId: number,
  robotId: number,
  upgrades: Record<string, UpgradeRequest>,
): Promise<UpgradeTransactionResult> {
  const robot = await prisma.robot.findFirst({ where: { id: robotId, userId } });
  if (!robot) throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { facilities: { where: { facilityType: { in: [...FACILITY_TYPES] } } } },
  });
  if (!user) throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'User not found', 404);

  const trainingLevel = user.facilities.find(f => f.facilityType === 'training_facility')?.level || 0;
  const academyLevels = extractAcademyLevels(user.facilities);

  // Optimistic check
  let { totalCost, upgradeOperations } = validateAndCalculateUpgrades(
    upgrades, robot as unknown as Record<string, unknown>, trainingLevel, academyLevels,
  );

  if (user.currency < totalCost) {
    throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Insufficient credits', 400, { required: totalCost, current: user.currency });
  }

  const txResult = await prisma.$transaction(async (tx) => {
    const lockedUser = await lockUserForSpending(tx, userId);

    const freshFacilities = await tx.facility.findMany({
      where: { userId, facilityType: { in: [...FACILITY_TYPES] } },
    });
    const freshRobot = await tx.robot.findFirst({ where: { id: robotId, userId } });
    if (!freshRobot) throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, 'Robot not found', 404);

    const freshTrainingLevel = freshFacilities.find(f => f.facilityType === 'training_facility')?.level || 0;
    const freshAcademyLevels = extractAcademyLevels(freshFacilities);

    const fresh = validateUpgradesFresh(
      upgrades, freshRobot as unknown as Record<string, unknown>, freshTrainingLevel, freshAcademyLevels,
    );

    if (lockedUser.currency < fresh.totalCost) {
      throw new RobotError(RobotErrorCode.INVALID_ROBOT_ATTRIBUTES, 'Insufficient credits', 400, { required: fresh.totalCost, current: lockedUser.currency });
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { currency: { decrement: fresh.totalCost } },
    });

    const updateData: Record<string, number> = {};
    for (const op of fresh.upgradeOperations) updateData[op.attribute] = op.toLevel;

    totalCost = fresh.totalCost;
    upgradeOperations = fresh.upgradeOperations;

    const updatedRobot = await tx.robot.update({
      where: { id: robotId },
      data: updateData,
      include: { mainWeapon: { include: { weapon: true } }, offhandWeapon: { include: { weapon: true } } },
    });

    const needsHPUpdate = upgradeOperations.some(op => op.attribute === 'hullIntegrity' || op.attribute === 'shieldCapacity');
    if (needsHPUpdate) {
      const maxHP = calculateMaxHP(updatedRobot);
      const maxShield = calculateMaxShield(updatedRobot);
      const hpPct = freshRobot.maxHP > 0 ? freshRobot.currentHP / freshRobot.maxHP : 1;
      const shieldPct = freshRobot.maxShield > 0 ? freshRobot.currentShield / freshRobot.maxShield : 1;

      const finalRobot = await tx.robot.update({
        where: { id: robotId },
        data: {
          maxHP, maxShield,
          currentHP: Math.min(Math.round(maxHP * hpPct), maxHP),
          currentShield: Math.min(Math.round(maxShield * shieldPct), maxShield),
        },
        include: { mainWeapon: { include: { weapon: true } }, offhandWeapon: { include: { weapon: true } } },
      });
      return { user: updatedUser, robot: finalRobot };
    }

    return { user: updatedUser, robot: updatedRobot };
  });

  return { ...txResult, totalCost, upgradeOperations };
}
