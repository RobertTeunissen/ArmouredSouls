// Helper utilities for robot stats and weapon bonuses

interface Weapon {
  combatPowerBonus?: number;
  targetingSystemsBonus?: number;
  criticalSystemsBonus?: number;
  penetrationBonus?: number;
  weaponControlBonus?: number;
  attackSpeedBonus?: number;
  armorPlatingBonus?: number;
  shieldCapacityBonus?: number;
  evasionThrustersBonus?: number;
  counterProtocolsBonus?: number;
  servoMotorsBonus?: number;
  gyroStabilizersBonus?: number;
  hydraulicSystemsBonus?: number;
  powerCoreBonus?: number;
  threatAnalysisBonus?: number;
}

interface WeaponInventory {
  weapon: Weapon;
}

/**
 * Calculate total bonus for an attribute from equipped weapons
 */
export function calculateAttributeBonus(
  attributeKey: string,
  mainWeapon: WeaponInventory | null,
  offhandWeapon: WeaponInventory | null
): number {
  let bonus = 0;
  
  const bonusKey = `${attributeKey}Bonus` as keyof Weapon;
  
  if (mainWeapon?.weapon[bonusKey]) {
    bonus += mainWeapon.weapon[bonusKey] as number;
  }
  
  if (offhandWeapon?.weapon[bonusKey]) {
    bonus += offhandWeapon.weapon[bonusKey] as number;
  }
  
  return bonus;
}

/**
 * Get display string for attribute with bonuses
 */
export function getAttributeDisplay(
  baseValue: number,
  bonus: number
): { total: number; display: string; hasBonus: boolean } {
  const total = baseValue + bonus;
  const hasBonus = bonus !== 0;
  
  let display = `${baseValue}`;
  if (hasBonus) {
    display += ` (${bonus > 0 ? '+' : ''}${bonus})`;
  }
  
  return { total, display, hasBonus };
}
