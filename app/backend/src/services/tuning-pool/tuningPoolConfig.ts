/**
 * Tuning Pool Configuration
 *
 * Pure functions and constants for the Tuning Bay facility system.
 * Defines pool size formulas, per-attribute maximums, and the canonical
 * list of robot attributes used throughout the tuning pool module.
 *
 * No external dependencies — all functions are deterministic and side-effect free.
 */

/**
 * The 23 robot attribute names, matching the keys in
 * `ATTRIBUTE_TO_ACADEMY` from `robotUpgradeService.ts`.
 *
 * Grouped by category:
 * - Combat Systems (6): combatPower, targetingSystems, criticalSystems, penetration, weaponControl, attackSpeed
 * - Defensive Systems (5): armorPlating, shieldCapacity, evasionThrusters, damageDampeners, counterProtocols
 * - Chassis & Mobility (5): hullIntegrity, servoMotors, gyroStabilizers, hydraulicSystems, powerCore
 * - AI Processing & Team Coordination (7): combatAlgorithms, threatAnalysis, adaptiveAI, logicCores, syncProtocols, supportSystems, formationTactics
 */
export const ROBOT_ATTRIBUTES = [
  // Combat Systems
  'combatPower',
  'targetingSystems',
  'criticalSystems',
  'penetration',
  'weaponControl',
  'attackSpeed',
  // Defensive Systems
  'armorPlating',
  'shieldCapacity',
  'evasionThrusters',
  'damageDampeners',
  'counterProtocols',
  // Chassis & Mobility
  'hullIntegrity',
  'servoMotors',
  'gyroStabilizers',
  'hydraulicSystems',
  'powerCore',
  // AI Processing & Team Coordination
  'combatAlgorithms',
  'threatAnalysis',
  'adaptiveAI',
  'logicCores',
  'syncProtocols',
  'supportSystems',
  'formationTactics',
] as const;

/**
 * Union type of all 23 robot attribute names.
 * Derived from the `ROBOT_ATTRIBUTES` constant array.
 */
export type RobotAttribute = (typeof ROBOT_ATTRIBUTES)[number];

/**
 * Calculate the total tuning pool size for a given facility level.
 *
 * Every player gets a base pool of 10 points (level 0 / no facility).
 * Each Tuning Bay level adds 10 more points.
 *
 * @param facilityLevel - The Tuning Bay facility level (0–10). 0 means no facility.
 *                        Negative values are clamped to 0.
 * @returns The total number of tuning points available. Always ≥ 10.
 *
 * @example
 * getPoolSize(0)  // 10  — base pool, no facility
 * getPoolSize(1)  // 20
 * getPoolSize(5)  // 60
 * getPoolSize(10) // 110 — maximum
 */
export function getPoolSize(facilityLevel: number): number {
  return (Math.max(0, facilityLevel) + 1) * 10;
}

/**
 * Calculate the maximum tuning allocation for a single attribute.
 *
 * The per-attribute cap ensures that `baseValue + tuningBonus ≤ academyCap + 5`.
 * The "+5" represents the overclock window — the engineering team can push
 * 5 points beyond the academy's rated specs for a specific fight.
 *
 * @param academyCap - The academy cap for this attribute's category (typically 10–50).
 * @param baseValue  - The robot's current base value for this attribute.
 * @returns The maximum tuning points that can be allocated to this attribute.
 *          Always ≥ 0, rounded to 2 decimal places.
 *
 * @example
 * getPerAttributeMax(15, 15) // 5   — at cap, overclock only
 * getPerAttributeMax(15, 10) // 10  — 5 to cap + 5 overclock
 * getPerAttributeMax(25, 20) // 10  — 5 to cap + 5 overclock
 * getPerAttributeMax(50, 50) // 5   — at cap, overclock only
 * getPerAttributeMax(10, 5)  // 10  — no academy, 5 to cap + 5 overclock
 */
export function getPerAttributeMax(academyCap: number, baseValue: number): number {
  return Math.round(Math.max(0, academyCap + 5 - baseValue) * 100) / 100;
}
