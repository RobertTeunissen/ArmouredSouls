/**
 * Robot ranking calculations.
 *
 * Category sums and rank/percentile helpers. The public `/:id/rankings`
 * endpoint that ranked attribute totals against every robot was removed in
 * the robot pages revamp (#504): builds stay hidden from visitors.
 */

import type { Prisma } from '../../../generated/prisma';

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
