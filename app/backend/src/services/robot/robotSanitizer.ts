/**
 * Robot data sanitization for public viewing.
 *
 * Strips competitively sensitive fields (attributes, battle config, combat state,
 * equipment) from robot records before returning them to non-owner viewers.
 */

/** Fields stripped from robot data when viewed by non-owners. */
export const SENSITIVE_ROBOT_FIELDS = [
  // 23 core attributes
  'combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed',
  'armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols',
  'hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
  'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
  'syncProtocols', 'supportSystems', 'formationTactics',
  // Battle configuration
  'yieldThreshold', 'stance', 'loadoutType',
  // Current combat state
  'currentHP', 'currentShield', 'damageTaken',
  // Equipment details
  'mainWeaponId', 'offhandWeaponId', 'mainWeapon', 'offhandWeapon',
] as const;

/** Strip sensitive fields from a robot record for public display. */
export function sanitizeRobotForPublic<T extends Record<string, unknown>>(robot: T | null | undefined): T | null | undefined {
  if (!robot) return robot;
  const sanitized = { ...robot };
  for (const field of SENSITIVE_ROBOT_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}
