/**
 * Streaming Revenue Service
 *
 * Calculates and awards streaming revenue for battles based on robot fame,
 * battle count, and Streaming Studio facility level.
 *
 * Formula (Season 2, #524; formula version '2'):
 *
 *   floor(1000 × (1 + battles/2000 + fame/10000) × (1 + 0.5 × studioLevel))
 *
 * The battle and fame terms are additive (one audience multiplier) and there
 * are no caps. `battles` is the all-modes battle count: robots.total_battles +
 * KotH and Grand Melee standings.total_matches
 * (services/robot/all-modes-battle-count.ts).
 *
 * Studio Multiplier: each level adds 50% (L1 = 1.5×, L2 = 2×, L10 = 6×).
 * Team matches split a robot's award across the team exactly once
 * (applyStreamingTeamShare). Byes award nothing.
 */

import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { RobotError, RobotErrorCode, FinancialError, FinancialErrorCode } from '../../errors';
import { applyCreditMutation, applyCreditMutationInTransaction } from '../financial/creditMutationService';
import { buildStreamingEventId } from '../financial/financialEventIdentity';
import type { StreamingRevenueBreakdownV2 as FinancialStreamingRevenueBreakdownV2 } from '../../types';
import {
  combineAllModesBattleCount,
  getAllModesBattleCount,
  getPlacementMatchCounts,
} from '../robot/all-modes-battle-count';

// ─── Streaming_Revenue_Formula — the single source of truth ──────────

/** Base award per battle, before any multiplier. */
export const STREAMING_BASE_AMOUNT = 1000;

/** Battle count divisor: every 2000 battles adds 100% to the audience multiplier. */
export const STREAMING_BATTLE_DIVISOR = 2000;

/** Fame divisor: every 10000 fame adds 100% to the audience multiplier. */
export const STREAMING_FAME_DIVISOR = 10000;

/** Studio Multiplier per level: L1 = ×1.5, L2 = ×2, L10 = ×6. */
export const STREAMING_STUDIO_PER_LEVEL = 0.5;

/** Formula version recorded on every new streaming award (#524). Version '1' rows are historical. */
export const STREAMING_FORMULA_VERSION = '2';

/** Studio levels per +100%: the Studio Multiplier is `(STUDIO_DENOMINATOR + level) / STUDIO_DENOMINATOR`. */
const STREAMING_STUDIO_DENOMINATOR = 1 / STREAMING_STUDIO_PER_LEVEL;

/** The contributions, multipliers and total, with no identity or IO attached. */
export interface StreamingRevenueBreakdown {
  baseAmount: number;
  /** battles / 2000 */
  battleContribution: number;
  /** fame / 10000 */
  fameContribution: number;
  /** 1 + battleContribution + fameContribution */
  audienceMultiplier: number;
  /** 1 + 0.5 × studioLevel */
  studioMultiplier: number;
  totalRevenue: number;
}

/**
 * Streaming revenue calculation result for a single robot.
 *
 * `revenueBeforeTeamShare` is the formula total for one robot;
 * `totalRevenue` is what this robot is paid after the team share
 * (equal to `revenueBeforeTeamShare` while `teamSize` is 1).
 */
export interface StreamingRevenueCalculation extends StreamingRevenueBreakdown {
  robotId: number;                 // Robot that earned the revenue
  robotName: string;               // For logging
  robotBattles: number;            // All-modes battle count used
  robotFame: number;               // Fame used
  studioLevel: number;             // Facility level used
  teamSize: number;                // Robots sharing the award (1 = solo)
  revenueBeforeTeamShare: number;  // Formula total before the team share
}

/**
 * Exact `floor(BASE × audience × studio)` over the common denominator
 * `BATTLE_DIVISOR × FAME_DIVISOR × STUDIO_DENOMINATOR`, which with the
 * Season 2 constants is `floor((20000 + 10·B + 2·F) × (2 + L) / 40)`.
 *
 * Evaluating the product in floating point is off by one for ordinary inputs:
 * (B=0, F=130, L=0) is exactly 1013 but `Math.floor(1000 × 1.013 × 1)` is 1012.
 * Battles, fame and level are integers (Prisma `Int`), so the BigInt path is
 * exact for every stored value. Non-integer inputs (never produced by the
 * award or display paths) fall back to the floating-point product.
 */
function computeStreamingTotal(
  totalBattleCount: number,
  fame: number,
  studioLevel: number,
  audienceMultiplier: number,
  studioMultiplier: number,
): number {
  if (!Number.isSafeInteger(totalBattleCount) || !Number.isSafeInteger(fame) || !Number.isSafeInteger(studioLevel)) {
    return Math.floor(STREAMING_BASE_AMOUNT * audienceMultiplier * studioMultiplier);
  }

  const battleDivisor = BigInt(STREAMING_BATTLE_DIVISOR);
  const fameDivisor = BigInt(STREAMING_FAME_DIVISOR);
  const studioDenominator = BigInt(STREAMING_STUDIO_DENOMINATOR);
  const audienceNumerator = battleDivisor * fameDivisor
    + BigInt(totalBattleCount) * fameDivisor
    + BigInt(fame) * battleDivisor;
  const numerator = BigInt(STREAMING_BASE_AMOUNT) * audienceNumerator * (studioDenominator + BigInt(studioLevel));
  const denominator = battleDivisor * fameDivisor * studioDenominator;

  // BigInt division truncates toward zero; step down once for a negative non-exact quotient.
  const quotient = numerator / denominator;
  const floored = numerator < 0n && quotient * denominator !== numerator ? quotient - 1n : quotient;
  return Number(floored);
}

/**
 * The Streaming_Revenue_Formula. Pure — no IO, no side effects.
 *
 * ```
 * floor(1000 × (1 + battles/2000 + fame/10000) × (1 + 0.5 × level))
 * ```
 *
 * Season 2 (#524) replaced the multiplicative v1 formula
 * `1000 × (1 + battles/1000) × (1 + fame/5000) × (1 + level)`, which paid a
 * 552-battle, 10,492-fame robot with a L9 Studio 48,087 per battle; v2 pays
 * 12,788. There are no caps: every battle, fame point and Studio level counts.
 *
 * Spec #46 R10: every award and display path (single and batch award, daily
 * financial report, facility advisor, facility ROI) derives from this
 * function, so a projection cannot disagree with what a player is paid.
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
  const battleContribution = totalBattleCount / STREAMING_BATTLE_DIVISOR;
  const fameContribution = fame / STREAMING_FAME_DIVISOR;
  const audienceMultiplier = 1 + battleContribution + fameContribution;
  const studioMultiplier = 1 + (studioLevel * STREAMING_STUDIO_PER_LEVEL);

  return {
    baseAmount,
    battleContribution,
    fameContribution,
    audienceMultiplier,
    studioMultiplier,
    totalRevenue: computeStreamingTotal(totalBattleCount, fame, studioLevel, audienceMultiplier, studioMultiplier),
  };
}

/**
 * Split one robot's streaming award across its team: each teammate is paid
 * `floor(revenueBeforeTeamShare / teamSize)`. Derived from the pre-share
 * figure, so applying it twice cannot divide twice.
 *
 * @throws FinancialError when `teamSize` is not a positive integer.
 */
export function applyStreamingTeamShare(
  calculation: StreamingRevenueCalculation,
  teamSize: number,
): StreamingRevenueCalculation {
  if (!Number.isInteger(teamSize) || teamSize < 1) {
    throw new FinancialError(
      FinancialErrorCode.INVALID_BREAKDOWN,
      'Streaming teamSize must be a positive integer',
      400,
      { teamSize },
    );
  }

  return {
    ...calculation,
    teamSize,
    totalRevenue: Math.floor(calculation.revenueBeforeTeamShare / teamSize),
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
    teamSize: 1,
    revenueBeforeTeamShare: breakdown.totalRevenue,
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

  // Every v2 row must reconcile from its own facts; refuse to write one that does not.
  if (calculation.totalRevenue !== Math.floor(calculation.revenueBeforeTeamShare / calculation.teamSize)) {
    throw new FinancialError(
      FinancialErrorCode.INVALID_BREAKDOWN,
      'Streaming totalRevenue must equal floor(revenueBeforeTeamShare / teamSize)',
      400,
      {
        robotId: calculation.robotId,
        totalRevenue: calculation.totalRevenue,
        revenueBeforeTeamShare: calculation.revenueBeforeTeamShare,
        teamSize: calculation.teamSize,
      },
    );
  }

  const financialEventId = buildStreamingEventId(battleId, calculation.robotId, mode);
  const breakdown: FinancialStreamingRevenueBreakdownV2 = {
    schemaVersion: 1,
    formula: 'streaming_revenue',
    formulaVersion: STREAMING_FORMULA_VERSION,
    inputs: [
      { name: 'robotBattles', value: calculation.robotBattles, unit: 'battles', source: 'robot' },
      { name: 'robotFame', value: calculation.robotFame, unit: 'fame', source: 'robot' },
      { name: 'studioLevel', value: calculation.studioLevel, unit: 'levels', source: 'facility' },
      { name: 'teamSize', value: calculation.teamSize, unit: 'robots', source: 'battle' },
    ],
    modifiers: [
      { name: 'battleContribution', value: calculation.battleContribution, unit: 'fraction', source: 'streaming_formula', applied: true },
      { name: 'fameContribution', value: calculation.fameContribution, unit: 'fraction', source: 'streaming_formula', applied: true },
      { name: 'audienceMultiplier', value: calculation.audienceMultiplier, unit: 'multiplier', source: 'streaming_formula', applied: true },
      { name: 'studioMultiplier', value: calculation.studioMultiplier, unit: 'multiplier', source: 'streaming_formula', applied: true },
      { name: 'teamSize', value: calculation.teamSize, unit: 'divisor', source: 'battle', applied: calculation.teamSize > 1 },
    ],
    rounding: {
      precision: 0,
      mode: 'floor',
      operationOrder: ['baseAmount', 'audienceMultiplier', 'studioMultiplier', 'floor', 'teamSize', 'floor'],
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
    battleContribution: calculation.battleContribution,
    fameContribution: calculation.fameContribution,
    audienceMultiplier: calculation.audienceMultiplier,
    studioMultiplier: calculation.studioMultiplier,
    teamSize: calculation.teamSize,
    revenueBeforeTeamShare: calculation.revenueBeforeTeamShare,
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
      teamSize: 1,
      revenueBeforeTeamShare: breakdown.totalRevenue,
    });
  }

  return result;
}
