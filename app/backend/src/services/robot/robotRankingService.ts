/**
 * Robot ranking calculations.
 *
 * Extracts the ranking helper functions (category sums, rank/percentile
 * calculation) from the robots route handler so the route stays thin.
 */

import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';

// ── Attribute groups used for category sums ──────────────────────────

export const COMBAT_ATTRIBUTES = [
  'combatPower', 'targetingSystems', 'criticalSystems',
  'penetration', 'weaponControl', 'attackSpeed',
] as const;

export const DEFENSE_ATTRIBUTES = [
  'armorPlating', 'shieldCapacity', 'evasionThrusters',
  'damageDampeners', 'counterProtocols',
] as const;

export const CHASSIS_ATTRIBUTES = [
  'hullIntegrity', 'servoMotors', 'gyroStabilizers',
  'hydraulicSystems', 'powerCore',
] as const;

export const AI_ATTRIBUTES = [
  'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
] as const;

export const TEAM_ATTRIBUTES = [
  'syncProtocols', 'supportSystems', 'formationTactics',
] as const;

// ── Helpers ──────────────────────────────────────────────────────────

/** Sum attribute values for a category, handling both number and Prisma.Decimal. */
export function calculateCategorySum(
  robot: Record<string, number | Prisma.Decimal>,
  attributes: readonly string[],
): number {
  return attributes.reduce((sum, attr) => {
    const value = robot[attr];
    return sum + (typeof value === 'number' ? value : Number(value));
  }, 0);
}

/** Calculate rank and percentile for a value within a set of all values. */
export function calculateRanking(
  value: number,
  allValues: number[],
  totalRobots: number,
): { rank: number; total: number; percentile: number; value: number } {
  const sortedValues = [...allValues].sort((a, b) => b - a);
  const rank = sortedValues.findIndex(v => v === value) + 1;
  const percentile = (1 - (rank - 1) / totalRobots) * 100;
  return { rank, total: totalRobots, percentile, value };
}


// ── Select clause for ranking queries ────────────────────────────────

export const RANKING_ROBOT_SELECT = {
  id: true,
  combatPower: true,
  targetingSystems: true,
  criticalSystems: true,
  penetration: true,
  weaponControl: true,
  attackSpeed: true,
  armorPlating: true,
  shieldCapacity: true,
  evasionThrusters: true,
  damageDampeners: true,
  counterProtocols: true,
  hullIntegrity: true,
  servoMotors: true,
  gyroStabilizers: true,
  hydraulicSystems: true,
  powerCore: true,
  combatAlgorithms: true,
  threatAnalysis: true,
  adaptiveAI: true,
  logicCores: true,
  syncProtocols: true,
  supportSystems: true,
  formationTactics: true,
  damageDealtLifetime: true,
  wins: true,
  losses: true,
  elo: true,
  kills: true,
} as const;

interface RobotScores {
  id: number;
  combatSum: number;
  defenseSum: number;
  chassisSum: number;
  aiSum: number;
  teamSum: number;
  damageDealt: number;
  winRate: number;
  elo: number;
  kdRatio: number;
}

/**
 * Fetch all robots and compute rankings for the given robot.
 * Returns the rankings object ready to be sent as JSON.
 */
export async function getRobotRankings(robotId: number): Promise<Record<string, { rank: number; total: number; percentile: number; value: number }>> {
  const allRobots = await prisma.robot.findMany({ select: RANKING_ROBOT_SELECT });
  const totalRobots = allRobots.length;

  const robotsWithScores: RobotScores[] = allRobots.map(r => {
    const combatSum = calculateCategorySum(r as unknown as Record<string, number | Prisma.Decimal>, COMBAT_ATTRIBUTES);
    const defenseSum = calculateCategorySum(r as unknown as Record<string, number | Prisma.Decimal>, DEFENSE_ATTRIBUTES);
    const chassisSum = calculateCategorySum(r as unknown as Record<string, number | Prisma.Decimal>, CHASSIS_ATTRIBUTES);
    const aiSum = calculateCategorySum(r as unknown as Record<string, number | Prisma.Decimal>, AI_ATTRIBUTES);
    const teamSum = calculateCategorySum(r as unknown as Record<string, number | Prisma.Decimal>, TEAM_ATTRIBUTES);

    const totalBattles = r.wins + r.losses;
    const winRate = totalBattles > 0 ? (r.wins / totalBattles) * 100 : 0;
    const kdRatio = r.losses > 0 ? r.kills / r.losses : r.kills;

    return {
      id: r.id,
      combatSum,
      defenseSum,
      chassisSum,
      aiSum,
      teamSum,
      damageDealt: r.damageDealtLifetime,
      winRate,
      elo: r.elo,
      kdRatio,
    };
  });

  const current = robotsWithScores.find(r => r.id === robotId);
  if (!current) {
    return {};
  }

  return {
    combatCategory: calculateRanking(current.combatSum, robotsWithScores.map(r => r.combatSum), totalRobots),
    defenseCategory: calculateRanking(current.defenseSum, robotsWithScores.map(r => r.defenseSum), totalRobots),
    chassisCategory: calculateRanking(current.chassisSum, robotsWithScores.map(r => r.chassisSum), totalRobots),
    aiCategory: calculateRanking(current.aiSum, robotsWithScores.map(r => r.aiSum), totalRobots),
    teamCategory: calculateRanking(current.teamSum, robotsWithScores.map(r => r.teamSum), totalRobots),
    totalDamageDealt: calculateRanking(current.damageDealt, robotsWithScores.map(r => r.damageDealt), totalRobots),
    winRate: calculateRanking(current.winRate, robotsWithScores.map(r => r.winRate), totalRobots),
    elo: calculateRanking(current.elo, robotsWithScores.map(r => r.elo), totalRobots),
    kdRatio: calculateRanking(current.kdRatio, robotsWithScores.map(r => r.kdRatio), totalRobots),
  };
}
