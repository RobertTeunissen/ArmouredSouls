/**
 * Tuning Pool Service
 *
 * Core service managing tuning point allocation, validation, and retrieval
 * for the Tuning Bay facility system. Enforces pool size limits based on
 * facility level and validates that allocations don't exceed the pool budget
 * or per-attribute maximums.
 *
 * @module services/tuning-pool/tuningPoolService
 */

import prisma from '../../lib/prisma';
import { AppError } from '../../errors';
import { verifyRobotOwnership } from '../../middleware/ownership';
import { getPoolSize, getPerAttributeMax, ROBOT_ATTRIBUTES, type RobotAttribute } from './tuningPoolConfig';
import { getCapForLevel } from '../../shared/utils/academyCaps';
import { ATTRIBUTE_TO_ACADEMY } from '../robot/robotUpgradeService';

// ── Types ────────────────────────────────────────────────────────────

/** Sparse map of attribute → tuning bonus. Only non-zero attributes included. */
export type TuningAttributeMap = Partial<Record<RobotAttribute, number>>;

/** Full state returned to the frontend */
export interface TuningAllocationState {
  robotId: number;
  facilityLevel: number;
  poolSize: number;
  allocated: number;
  remaining: number;
  perAttributeMaxes: Record<RobotAttribute, number>;
  allocations: TuningAttributeMap;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Extract a sparse TuningAttributeMap from a TuningAllocation DB row.
 * Only includes attributes with non-zero values.
 */
function rowToAllocations(row: Record<string, unknown>): TuningAttributeMap {
  const map: TuningAttributeMap = {};
  for (const attr of ROBOT_ATTRIBUTES) {
    const val = Number(row[attr]);
    if (val > 0) {
      map[attr] = val;
    }
  }
  return map;
}

/**
 * Build the per-attribute max map for a robot given its base attributes
 * and the user's academy facility levels.
 */
function buildPerAttributeMaxes(
  robot: Record<string, unknown>,
  academyLevels: Record<string, number>,
): Record<RobotAttribute, number> {
  const maxes = {} as Record<RobotAttribute, number>;
  for (const attr of ROBOT_ATTRIBUTES) {
    const academyType = ATTRIBUTE_TO_ACADEMY[attr];
    const academyLevel = academyLevels[academyType] ?? 0;
    const academyCap = getCapForLevel(academyLevel);
    const baseValue = Number(robot[attr]);
    maxes[attr] = getPerAttributeMax(academyCap, baseValue);
  }
  return maxes;
}

/**
 * Look up the user's academy facility levels as a map of facilityType → level.
 */
async function getAcademyLevels(userId: number): Promise<Record<string, number>> {
  const academyTypes = [
    'combat_training_academy',
    'defense_training_academy',
    'mobility_training_academy',
    'ai_training_academy',
  ];
  const facilities = await prisma.facility.findMany({
    where: { userId, facilityType: { in: academyTypes } },
    select: { facilityType: true, level: true },
  });
  const levels: Record<string, number> = {};
  for (const f of facilities) {
    levels[f.facilityType] = f.level;
  }
  return levels;
}

/**
 * Look up the user's Tuning Bay facility level. Returns 0 if no facility exists.
 */
async function getTuningBayLevel(userId: number): Promise<number> {
  const facility = await prisma.facility.findFirst({
    where: { userId, facilityType: 'tuning_bay' },
    select: { level: true },
  });
  return facility?.level ?? 0;
}

/**
 * Proportionally scale down allocations to fit within a pool size.
 * All values are rounded to 2 decimal places.
 */
function scaleDownAllocations(allocations: TuningAttributeMap, poolSize: number): TuningAttributeMap {
  const total = Object.values(allocations).reduce((sum, v) => sum + (v ?? 0), 0);
  if (total <= poolSize) return allocations;

  const ratio = poolSize / total;
  const scaled: TuningAttributeMap = {};
  for (const [attr, value] of Object.entries(allocations)) {
    if (value && value > 0) {
      scaled[attr as RobotAttribute] = Math.round(value * ratio * 100) / 100;
    }
  }
  return scaled;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Get the current tuning allocation state for a robot.
 *
 * Verifies ownership, reads the user's facility level, reads the current
 * allocation (or empty if none), calculates pool size and per-attribute maxes,
 * and returns the full state. If the current allocation exceeds the pool
 * (e.g., after a facility downgrade), allocations are proportionally scaled down.
 *
 * @param robotId - The robot to get tuning allocation for
 * @param userId - The authenticated user's ID (for ownership verification)
 * @returns Full tuning allocation state including pool metadata
 * @throws AppError with code FORBIDDEN (403) if the user doesn't own the robot
 */
export async function getTuningAllocation(robotId: number, userId: number): Promise<TuningAllocationState> {
  await verifyRobotOwnership(prisma, robotId, userId);

  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: Object.fromEntries([
      ...ROBOT_ATTRIBUTES.map((attr) => [attr, true]),
      ['userId', true],
    ]),
  });

  if (!robot) {
    throw new AppError('ROBOT_NOT_FOUND', 'Robot not found', 404);
  }

  const [facilityLevel, academyLevels, allocationRow] = await Promise.all([
    getTuningBayLevel(userId),
    getAcademyLevels(userId),
    prisma.tuningAllocation.findUnique({ where: { robotId } }),
  ]);

  const poolSize = getPoolSize(facilityLevel);
  const perAttributeMaxes = buildPerAttributeMaxes(robot, academyLevels);

  let allocations: TuningAttributeMap = {};
  if (allocationRow) {
    allocations = rowToAllocations(allocationRow as unknown as Record<string, unknown>);

    // Proportional scale-down if allocation exceeds pool (facility downgrade)
    const total = Object.values(allocations).reduce((sum, v) => sum + (v ?? 0), 0);
    if (total > poolSize) {
      allocations = scaleDownAllocations(allocations, poolSize);

      // Persist the scaled-down allocations so future reads are consistent
      const updateData: Record<string, number> = {};
      for (const attr of ROBOT_ATTRIBUTES) {
        updateData[attr] = allocations[attr] ?? 0;
      }
      await prisma.tuningAllocation.update({
        where: { robotId },
        data: updateData,
      });
    }
  }

  const allocated = Math.round(Object.values(allocations).reduce((sum, v) => sum + (v ?? 0), 0) * 100) / 100;

  return {
    robotId,
    facilityLevel,
    poolSize,
    allocated,
    remaining: Math.round((poolSize - allocated) * 100) / 100,
    perAttributeMaxes,
    allocations,
  };
}

/**
 * Set or update the tuning allocation for a robot.
 *
 * Verifies ownership, validates the pool budget, validates per-attribute
 * maximums (academyCap + 5 - baseValue), and upserts the allocation row.
 *
 * @param robotId - The robot to set tuning allocation for
 * @param userId - The authenticated user's ID (for ownership verification)
 * @param allocations - Sparse map of attribute → tuning value
 * @returns Updated tuning allocation state
 * @throws AppError with code FORBIDDEN (403) if the user doesn't own the robot
 * @throws AppError with code VALIDATION_ERROR (400) if allocations exceed budget or per-attribute max
 */
export async function setTuningAllocation(
  robotId: number,
  userId: number,
  allocations: TuningAttributeMap,
): Promise<TuningAllocationState> {
  await verifyRobotOwnership(prisma, robotId, userId);

  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: Object.fromEntries([
      ...ROBOT_ATTRIBUTES.map((attr) => [attr, true]),
      ['userId', true],
    ]),
  });

  if (!robot) {
    throw new AppError('ROBOT_NOT_FOUND', 'Robot not found', 404);
  }

  const [facilityLevel, academyLevels] = await Promise.all([
    getTuningBayLevel(userId),
    getAcademyLevels(userId),
  ]);

  const poolSize = getPoolSize(facilityLevel);
  const perAttributeMaxes = buildPerAttributeMaxes(robot, academyLevels);

  // Validate allocations
  let totalAllocated = 0;
  const validAttributes = new Set<string>(ROBOT_ATTRIBUTES);

  for (const [attr, value] of Object.entries(allocations)) {
    if (!validAttributes.has(attr)) {
      throw new AppError('VALIDATION_ERROR', `Invalid attribute: ${attr}`, 400);
    }

    const attribute = attr as RobotAttribute;

    if (value === undefined || value === null) continue;

    if (value < 0) {
      throw new AppError('VALIDATION_ERROR', `${attribute} cannot be negative`, 400);
    }

    const maxForAttr = perAttributeMaxes[attribute];
    if (maxForAttr !== undefined && value > maxForAttr) {
      throw new AppError(
        'VALIDATION_ERROR',
        `${attribute} allocation ${value} exceeds per-attribute max of ${maxForAttr}`,
        400,
      );
    }

    totalAllocated += value;
  }

  if (totalAllocated > poolSize) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Total allocation ${totalAllocated} exceeds pool size ${poolSize}`,
      400,
    );
  }

  // Build the data object for upsert — set all 23 attributes, defaulting to 0
  const data: Record<string, number> = {};
  for (const attr of ROBOT_ATTRIBUTES) {
    data[attr] = allocations[attr] ?? 0;
  }

  await prisma.tuningAllocation.upsert({
    where: { robotId },
    create: { robotId, ...data },
    update: data,
  });

  const allocated = Math.round(totalAllocated * 100) / 100;

  // Return only non-zero allocations in the response
  const responseAllocations: TuningAttributeMap = {};
  for (const [attr, value] of Object.entries(allocations)) {
    if (value && value > 0) {
      responseAllocations[attr as RobotAttribute] = value;
    }
  }

  return {
    robotId,
    facilityLevel,
    poolSize,
    allocated,
    remaining: Math.round((poolSize - allocated) * 100) / 100,
    perAttributeMaxes,
    allocations: responseAllocations,
  };
}

/**
 * Get tuning bonuses for a robot (internal use, no auth check).
 *
 * Returns a sparse map of non-zero allocations. Returns an empty map `{}`
 * when no allocation row exists (bots and unset robots get zero bonuses).
 *
 * @param robotId - The robot to get tuning bonuses for
 * @returns Sparse map of attribute → tuning bonus value
 */
export async function getTuningBonuses(robotId: number): Promise<TuningAttributeMap> {
  const row = await prisma.tuningAllocation.findUnique({ where: { robotId } });
  if (!row) return {};
  return rowToAllocations(row as unknown as Record<string, unknown>);
}

/**
 * Clear all tuning allocations for a robot.
 *
 * Deletes the allocation row entirely. Used on robot reset or deletion cleanup.
 *
 * @param robotId - The robot to clear tuning allocation for
 */
export async function clearTuningAllocation(robotId: number): Promise<void> {
  await prisma.tuningAllocation.deleteMany({ where: { robotId } });
}


/**
 * Apply tuning bonuses to a robot's attribute values in-place.
 *
 * Mutates the robot object by adding tuning bonus values to each
 * Decimal attribute field. This ensures the combat simulator — which
 * reads attributes directly via Number(robot.combatPower) — sees the
 * tuning-boosted values without needing changes to the simulator itself.
 *
 * Call this after loading tuning bonuses and before passing the robot
 * to simulateBattle().
 *
 * @param robot - The robot object to mutate (must have Decimal attribute fields)
 * @param tuningBonuses - Sparse map of attribute → bonus value
 */
export function applyTuningToRobot(robot: Record<string, unknown>, tuningBonuses: TuningAttributeMap): void {
  if (!tuningBonuses || Object.keys(tuningBonuses).length === 0) return;

  for (const attr of ROBOT_ATTRIBUTES) {
    const bonus = tuningBonuses[attr];
    if (!bonus || bonus <= 0) continue;

    const current = robot[attr];
    if (current !== undefined && current !== null) {
      // Handle both Prisma Decimal and plain number
      const currentNum = typeof current === 'object' && 'toNumber' in (current as { toNumber?: () => number })
        ? (current as { toNumber(): number }).toNumber()
        : Number(current);
      // Store as a plain number — the combat simulator uses Number() to read it
      robot[attr] = currentNum + bonus;
    }
  }
}
