// Shared constants for weapons and attributes

export const ATTRIBUTE_LABELS = [
  { key: 'combatPowerBonus', label: 'Combat Power' },
  { key: 'targetingSystemsBonus', label: 'Targeting' },
  { key: 'criticalSystemsBonus', label: 'Critical' },
  { key: 'penetrationBonus', label: 'Penetration' },
  { key: 'weaponControlBonus', label: 'Control' },
  { key: 'attackSpeedBonus', label: 'Attack Speed' },
  { key: 'armorPlatingBonus', label: 'Armor' },
  { key: 'shieldCapacityBonus', label: 'Shield' },
  { key: 'evasionThrustersBonus', label: 'Evasion' },
  { key: 'counterProtocolsBonus', label: 'Counter' },
  { key: 'servoMotorsBonus', label: 'Servos' },
  { key: 'gyroStabilizersBonus', label: 'Gyro' },
  { key: 'hydraulicSystemsBonus', label: 'Hydraulics' },
  { key: 'powerCoreBonus', label: 'Power' },
  { key: 'threatAnalysisBonus', label: 'Threat Analysis' },
] as const;

/**
 * Calculate DPS from the actual database cooldown value.
 * Returns DPS with one decimal place precision.
 */
export function calculateDPS(baseDamage: number, cooldown: number): string {
  if (cooldown <= 0) return '0.0';
  return (baseDamage / cooldown).toFixed(1);
}
