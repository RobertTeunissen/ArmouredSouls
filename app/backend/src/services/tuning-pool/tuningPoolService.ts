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

/**
 * Pool budget only — no per-attribute detail.
 *
 * Enough to answer "does this robot have points left to spend?", which is all
 * the dashboard needs. See `getTuningAllocationSummaries`.
 */
export interface TuningAllocationSummary {
  robotId: number;
  poolSize: number;
  allocated: number;
  remaining: number;
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
 * All values are rounded to 2 decimal places. After rounding, the total
 * is verified and any overshoot is subtracted from the largest allocation
 * to guarantee total ≤ poolSize.
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

  // Fix rounding overshoot: if the rounded sum exceeds poolSize,
  // subtract the excess from the largest allocation
  const scaledTotal = Object.values(scaled).reduce((sum, v) => sum + (v ?? 0), 0);
  const roundedTotal = Math.round(scaledTotal * 100) / 100;
  if (roundedTotal > poolSize) {
    const excess = Math.round((roundedTotal - poolSize) * 100) / 100;
    let largestAttr: RobotAttribute | null = null;
    let largestVal = 0;
    for (const [attr, value] of Object.entries(scaled)) {
      if (value && value > largestVal) {
        largestVal = value;
        largestAttr = attr as RobotAttribute;
      }
    }
    if (largestAttr && scaled[largestAttr]) {
      scaled[largestAttr] = Math.round((scaled[largestAttr]! - excess) * 100) / 100;
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
 * Pool budget for every robot in a stable, in three queries.
 *
 * The dashboard previously called `getTuningAllocation` once per robot just to
 * read `remaining`, which on a full roster meant a request per robot and five
 * queries inside each. Pool size depends on the user's Tuning Bay level, not on
 * the robot, so it is looked up once here.
 *
 * Ownership is inherent: robots are selected by `userId`, so a caller can only
 * ever see their own.
 *
 * Deliberately read-only. `getTuningAllocation` repairs an over-budget row by
 * scaling allocations down and persisting the result; this function clamps
 * `allocated` to the pool for reporting but writes nothing. The reported
 * `remaining` is identical either way — a scale-down brings the total to exactly
 * the pool size, leaving 0 remaining, which is what clamping reports too. The
 * repair still happens whenever the tuning screen reads a robot's full state.
 *
 * @param userId - The authenticated user whose roster to summarise
 * @returns One summary per owned robot, in robot id order
 */
export async function getTuningAllocationSummaries(userId: number): Promise<TuningAllocationSummary[]> {
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  if (robots.length === 0) return [];

  const robotIds = robots.map((r) => r.id);

  const [facilityLevel, rows] = await Promise.all([
    getTuningBayLevel(userId),
    prisma.tuningAllocation.findMany({ where: { robotId: { in: robotIds } } }),
  ]);

  const poolSize = getPoolSize(facilityLevel);

  const allocatedByRobot = new Map<number, number>();
  for (const row of rows) {
    const allocations = rowToAllocations(row as unknown as Record<string, unknown>);
    const total = Object.values(allocations).reduce((sum, v) => sum + (v ?? 0), 0);
    allocatedByRobot.set(row.robotId, total);
  }

  return robotIds.map((robotId) => {
    const raw = allocatedByRobot.get(robotId) ?? 0;
    const allocated = Math.round(Math.min(raw, poolSize) * 100) / 100;
    return {
      robotId,
      poolSize,
      allocated,
      remaining: Math.round((poolSize - allocated) * 100) / 100,
    };
  });
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
 * Get tuning bonuses for multiple robots in a single query.
 *
 * Returns a Map of robotId → TuningAttributeMap. Robots without allocations
 * will have an empty map `{}` in the result.
 *
 * @param robotIds - Array of robot IDs to fetch tuning bonuses for
 * @returns Map of robotId → sparse attribute bonus map
 */
export async function getTuningBonusesBatch(robotIds: number[]): Promise<Map<number, TuningAttributeMap>> {
  if (robotIds.length === 0) return new Map();
  const rows = await prisma.tuningAllocation.findMany({
    where: { robotId: { in: robotIds } },
  });
  const result = new Map<number, TuningAttributeMap>();
  for (const row of rows) {
    result.set(row.robotId, rowToAllocations(row as unknown as Record<string, unknown>));
  }
  // Ensure all requested IDs have an entry (empty map for robots without allocations)
  for (const id of robotIds) {
    if (!result.has(id)) {
      result.set(id, {});
    }
  }
  return result;
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
