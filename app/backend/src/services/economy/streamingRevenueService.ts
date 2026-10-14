/**
 * Streaming Revenue Service
 * 
 * Calculates and awards streaming revenue for battles based on robot fame,
 * battle count, and Streaming Studio facility level.
 * 
 * Formula: 1000 × (1 + battles/1000) × (1 + fame/5000) × (1 + level×1.0)
 *
 * `battles` is the all-modes battle count: robots.total_battles + KotH and
 * Grand Melee standings.total_matches (services/robot/all-modes-battle-count.ts).
 * 
 * Studio Multiplier: Each level adds 100% (L1 = 2×, L2 = 3×, L3 = 4×, etc.)
 */

import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { RobotError, RobotErrorCode, FinancialError, FinancialErrorCode } from '../../errors';
import { applyCreditMutation, applyCreditMutationInTransaction } from '../financial/creditMutationService';
import { buildStreamingEventId } from '../financial/financialEventIdentity';
import type { StreamingRevenueBreakdown as FinancialStreamingRevenueBreakdown } from '../../types';
import {
  combineAllModesBattleCount,
  getAllModesBattleCount,
  getPlacementMatchCounts,
} from '../robot/all-modes-battle-count';

/**
 * Streaming revenue calculation result for a single robot
 */
export interface StreamingRevenueCalculation {
  baseAmount: number;              // Always 1000
  battleMultiplier: number;        // 1 + (battles / 1000)
  fameMultiplier: number;          // 1 + (fame / 5000)
  studioMultiplier: number;        // 1 + (level * 1.0) - Each level doubles, triples, etc.
  totalRevenue: number;            // Final calculated amount
  robotId: number;                 // Robot that earned the revenue
  robotName: string;               // For logging
  robotBattles: number;            // Battle count used
  robotFame: number;               // Fame used
  studioLevel: number;             // Facility level used
}

// ─── Streaming_Revenue_Formula — the single source of truth ──────────

/** Base award per battle, before any multiplier. */
export const STREAMING_BASE_AMOUNT = 1000;

/** Battle count divisor: every 1000 battles adds 100% to the battle multiplier. */
export const STREAMING_BATTLE_DIVISOR = 1000;

/** Fame divisor: every 5000 fame adds 100% to the fame multiplier. */
export const STREAMING_FAME_DIVISOR = 5000;

/** Studio Multiplier per level: L1 = ×2, L2 = ×3, L10 = ×11. */
export const STREAMING_STUDIO_PER_LEVEL = 1.0;

/** The multiplier and total breakdown, with no identity or IO attached. */
export interface StreamingRevenueBreakdown {
  baseAmount: number;
  battleMultiplier: number;
  fameMultiplier: number;
  studioMultiplier: number;
  totalRevenue: number;
}

/**
 * The Streaming_Revenue_Formula. Pure — no IO, no side effects.
 *
 * ```
 * 1000 × (1 + battles/1000) × (1 + fame/5000) × (1 + level)
 * ```
 *
 * Spec #46 R10: this used to be written out four more times — in
 * `calculateStreamingRevenue()`, in `calculateStreamingRevenueBatch()`, in
 * `financialReportService.ts`, and approximated twice more in the facility ROI
 * and recommendation services. Each copy disagreed with the award path in a
 * different way:
 *
 * - The financial report applied caps of 3.0 and 2.0 to the battle and fame
 *   multipliers. The award path applies none, so a robot past 2000 battles or
 *   5000 fame was shown less than it was paid. (Its divisor arithmetic was
 *   equivalent — `1 + battles/100 × 0.1` is algebraically `1 + battles/1000` —
 *   so the caps were the whole discrepancy.)
 * - `facilityRecommendationService.ts` used `1 + level × 0.1` for the Studio
 *   Multiplier, a tenth of the real `1 + level`, so an upgrade that doubles
 *   revenue was projected as a 10% gain.
 * - `unifiedFacilityROIService.ts` used `1000 × (1 + level)`, dropping the
 *   battle and fame multipliers entirely.
 *
 * Every display path now derives from this function, so a projection cannot
 * disagree with what a player is actually paid.
 *
 * The multipliers are uncapped by design: the caps in the old display code were
 * invented there and never existed in the award path.
 *
 * @param totalBattleCount Battles across every mode: `robots.total_battles` plus
 *   the KotH and Grand Melee `standings.total_matches`. Callers obtain it from
 *   the shared `services/robot/all-modes-battle-count.ts` helper (#530, #532).
 * @param fame Robot fame.
 * @param studioLevel Streaming Studio facility level (0-10).
 */
export function computeStreamingRevenue(
  totalBattleCount: number,
  fame: number,
  studioLevel: number,
): StreamingRevenueBreakdown {
  const baseAmount = STREAMING_BASE_AMOUNT;
  const battleMultiplier = 1 + (totalBattleCount / STREAMING_BATTLE_DIVISOR);
  const fameMultiplier = 1 + (fame / STREAMING_FAME_DIVISOR);
  const studioMultiplier = 1 + (studioLevel * STREAMING_STUDIO_PER_LEVEL);

  return {
    baseAmount,
    battleMultiplier,
    fameMultiplier,
    studioMultiplier,
    totalRevenue: Math.floor(baseAmount * battleMultiplier * fameMultiplier * studioMultiplier),
  };
}

/**
 * Get the Streaming Studio level for a user
 * @param userId - User ID to query
 * @returns Streaming Studio level (0-10), or 0 if not found
 */
export async function getStreamingStudioLevel(userId: number): Promise<number> {
  const facility = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId,
        facilityType: 'streaming_studio',
      },
    },
  });

  return facility?.level ?? 0;
}

/**
 * Calculate streaming revenue for a single robot in any battle type.
 * Used by all orchestrators via awardStreamingRevenueForParticipant() in battlePostCombat.
 * @param robotId - Robot ID
 * @param userId - User ID (owner of the robot)
 * @param isByeMatch - Whether this is a bye match (no revenue awarded)
 * @returns Streaming revenue calculation, or null if bye match
 */
export async function calculateStreamingRevenue(
  robotId: number,
  userId: number,
  isByeMatch: boolean
): Promise<StreamingRevenueCalculation | null> {
  // No streaming revenue for bye matches
  if (isByeMatch) {
    return null;
  }

  // Get robot data
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    select: {
      id: true,
      name: true,
      totalBattles: true,
      fame: true,
    },
  });

  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, `Robot ${robotId} not found`, 404, { robotId });
  }

  // Get Streaming Studio level
  const studioLevel = await getStreamingStudioLevel(userId);

  // Battles across every mode: robot.totalBattles (league, tournaments, tag team,
  // 2v2/3v3) + KotH and Grand Melee matches from standings (#530, #532).
  const totalBattleCount = await getAllModesBattleCount(robot);

  // Delegate to the single source of truth (Spec #46 R10)
  const breakdown = computeStreamingRevenue(totalBattleCount, robot.fame, studioLevel);

  return {
    ...breakdown,
    robotId: robot.id,
    robotName: robot.name,
    robotBattles: totalBattleCount,
    robotFame: robot.fame,
    studioLevel,
  };
}

/**
 * Apply one streaming award through the required paired financial path.
 * `battleId` and `mode` are source-boundary facts and are part of the retry
 * identity; callers must pass the same values when retrying the operation.
 */
export async function awardStreamingRevenue(
  userId: number,
  calculation: StreamingRevenueCalculation,
  cycleNumber: number,
  battleId: number,
  mode: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  if (!Number.isInteger(battleId) || battleId < 1) {
    throw new FinancialError(FinancialErrorCode.INVALID_EVENT_IDENTITY, 'battleId is required for streaming revenue');
  }

  const financialEventId = buildStreamingEventId(battleId, calculation.robotId, mode);
  const breakdown: FinancialStreamingRevenueBreakdown = {
    schemaVersion: 1,
    formula: 'streaming_revenue',
    formulaVersion: '1',
    inputs: [
      { name: 'robotBattles', value: calculation.robotBattles, unit: 'battles', source: 'robot' },
      { name: 'robotFame', value: calculation.robotFame, unit: 'fame', source: 'robot' },
      { name: 'studioLevel', value: calculation.studioLevel, unit: 'levels', source: 'facility' },
    ],
    modifiers: [
      { name: 'battleMultiplier', value: calculation.battleMultiplier, unit: 'multiplier', source: 'streaming_formula', applied: true },
      { name: 'fameMultiplier', value: calculation.fameMultiplier, unit: 'multiplier', source: 'streaming_formula', applied: true },
      { name: 'studioMultiplier', value: calculation.studioMultiplier, unit: 'multiplier', source: 'streaming_formula', applied: true },
    ],
    rounding: {
      precision: 0,
      mode: 'floor',
      operationOrder: ['baseAmount', 'battleMultiplier', 'fameMultiplier', 'studioMultiplier', 'teamSize'],
      scope: 'per_item',
    },
    finalAmount: calculation.totalRevenue,
    sourceEventId: financialEventId,
    transactionType: 'streaming_revenue',
    battleId,
    robotId: calculation.robotId,
    mode,
    eligible: true,
    baseAmount: calculation.baseAmount,
    battleMultiplier: calculation.battleMultiplier,
    fameMultiplier: calculation.fameMultiplier,
    studioMultiplier: calculation.studioMultiplier,
    totalRevenue: calculation.totalRevenue,
  };

  const mutationInput = {
    cycleNumber,
    userId,
    robotId: calculation.robotId,
    transactionType: 'streaming_revenue' as const,
    amount: calculation.totalRevenue,
    description: `Streaming Studio revenue for robot ${calculation.robotId}`,
    financialEventId,
    breakdown,
    auditContext: {
      robotName: calculation.robotName,
      robotBattles: calculation.robotBattles,
      robotFame: calculation.robotFame,
      studioLevel: calculation.studioLevel,
    },
  };

  if (tx) {
    await applyCreditMutationInTransaction(tx, mutationInput);
  } else {
    await applyCreditMutation(mutationInput);
  }
}

/**
 * Calculate streaming revenue for multiple robots in batch (3 parallel queries total instead of 3N).
 *
 * Fetches all robot stats and facility levels upfront, then calculates in-memory.
 * Used by orchestrators processing multiple participants (KotH, tag team).
 *
 * @param participants - Array of { robotId, userId } pairs
 * @returns Map of robotId → StreamingRevenueCalculation (or null for missing robots)
 */
export async function calculateStreamingRevenueBatch(
  participants: Array<{ robotId: number; userId: number }>,
): Promise<Map<number, StreamingRevenueCalculation | null>> {
  if (participants.length === 0) return new Map();

  const robotIds = participants.map(p => p.robotId);
  const userIds = [...new Set(participants.map(p => p.userId))];

  // Batch fetch: robots, facilities and placement-mode (KotH + Grand Melee) match counts
  const [robots, facilities, placementMatches] = await Promise.all([
    prisma.robot.findMany({
      where: { id: { in: robotIds } },
      select: {
        id: true,
        name: true,
        totalBattles: true,
        fame: true,
      },
    }),
    prisma.facility.findMany({
      where: {
        userId: { in: userIds },
        facilityType: 'streaming_studio',
      },
      select: { userId: true, level: true },
    }),
    getPlacementMatchCounts(robotIds),
  ]);

  const robotMap = new Map(robots.map(r => [r.id, r]));
  const facilityMap = new Map(facilities.map(f => [f.userId, f.level]));

  const result = new Map<number, StreamingRevenueCalculation | null>();

  for (const { robotId, userId } of participants) {
    const robot = robotMap.get(robotId);
    if (!robot) {
      result.set(robotId, null);
      continue;
    }

    const studioLevel = facilityMap.get(userId) ?? 0;
    const totalBattleCount = combineAllModesBattleCount(robot.totalBattles, placementMatches.get(robotId) ?? 0);

    // Same delegation as the single path, so batch and single cannot diverge.
    const breakdown = computeStreamingRevenue(totalBattleCount, robot.fame, studioLevel);

    result.set(robotId, {
      ...breakdown,
      robotId: robot.id,
      robotName: robot.name,
      robotBattles: totalBattleCount,
      robotFame: robot.fame,
      studioLevel,
    });
  }

  return result;
}
