// Shared constants for weapons and attributes

export const WEAPON_COOLDOWN_BASES: { [key: string]: number } = {
  'melee': 2.0,
  'ballistic': 3.0,
  'energy': 2.5,
  'explosive': 4.0,
};

export const WEAPON_DAMAGE_SCALING: { [key: string]: number } = {
  'melee': 15,
  'ballistic': 20,
  'energy': 18,
  'explosive': 25,
};

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
 * Calculate weapon cooldown in seconds based on weapon type and base damage
 */
export function calculateWeaponCooldown(weaponType: string, baseDamage: number): string {
  const baseCooldown = WEAPON_COOLDOWN_BASES[weaponType] || 3.0;
  const scaling = WEAPON_DAMAGE_SCALING[weaponType] || 20;
  return (baseCooldown + (baseDamage / scaling)).toFixed(1);
}
