/**
 * Canonical list of the 23 robot attribute names used across the game.
 *
 * Lives in `app/shared/utils` so it's importable from both backend and frontend
 * code without crossing the runtime boundary. The backend already has two
 * duplicate definitions of this list (`VALID_ATTRIBUTES` in
 * `robotUpgradeService.ts` and `ROBOT_ATTRIBUTES` in `tuningPoolConfig.ts`);
 * new code should import from here instead of adding a third copy.
 *
 * Order matches the canonical category grouping used in `Weapon` catalog rows
 * and on the robot detail page:
 * - Combat Systems (6)
 * - Defensive Systems (5)
 * - Chassis & Mobility (5)
 * - AI Processing & Team Coordination (7)
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
 */
export type RobotAttribute = (typeof ROBOT_ATTRIBUTES)[number];

/**
 * Type guard that checks whether an arbitrary string is a valid robot attribute name.
 */
export function isRobotAttribute(value: string): value is RobotAttribute {
  return (ROBOT_ATTRIBUTES as readonly string[]).includes(value);
}
