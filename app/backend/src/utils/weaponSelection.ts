import logger from '../config/logger';

export interface WeaponRecord {
  id: number;
  name: string;
  cost: number;
  handsRequired: string;
  weaponType: string;
  rangeBand: string | null;
}

export interface WeaponSelectionParams {
  loadoutType: 'single' | 'weapon_shield' | 'dual_wield' | 'two_handed';
  rangeBand: 'melee' | 'short' | 'mid' | 'long';
  priceTier: { min: number; max: number };
}

/**
 * Determines the required handsRequired value based on loadout type.
 */
function getHandsRequired(loadoutType: WeaponSelectionParams['loadoutType']): string {
  return loadoutType === 'two_handed' ? 'two' : 'one';
}

/**
 * Selects a weapon using a 3-level fallback chain:
 * 1. loadout + range + price tier
 * 2. loadout + price tier (any range) — logs warning
 * 3. any non-shield weapon in price tier — logs warning
 *
 * Throws if no weapon can be found at all.
 */
export function selectWeapon(weapons: WeaponRecord[], params: WeaponSelectionParams): WeaponRecord {
  const { loadoutType, rangeBand, priceTier } = params;
  const handsRequired = getHandsRequired(loadoutType);

  // Base filter: price tier + non-shield
  const inTier = weapons.filter(
    (w) => w.cost >= priceTier.min && w.cost <= priceTier.max && w.weaponType !== 'shield'
  );

  // Filter by loadout compatibility
  const matchesLoadout = inTier.filter((w) => w.handsRequired === handsRequired);

  // Level 1: loadout + range + tier
  const exactMatch = matchesLoadout.filter((w) => w.rangeBand === rangeBand);
  if (exactMatch.length > 0) {
    return exactMatch[Math.floor(Math.random() * exactMatch.length)];
  }

  // Level 2: loadout + tier (any range)
  if (matchesLoadout.length > 0) {
    logger.warn(
      `[WeaponSelection] No weapon found for loadout=${loadoutType}, range=${rangeBand}, tier=${priceTier.min}-${priceTier.max}. Falling back to loadout+tier (any range).`
    );
    return matchesLoadout[Math.floor(Math.random() * matchesLoadout.length)];
  }

  // Level 3: any non-shield weapon in tier
  if (inTier.length > 0) {
    logger.warn(
      `[WeaponSelection] No weapon found for loadout=${loadoutType}, tier=${priceTier.min}-${priceTier.max}. Falling back to any weapon in tier.`
    );
    return inTier[Math.floor(Math.random() * inTier.length)];
  }

  throw new Error(
    `[WeaponSelection] No weapon found in price tier ${priceTier.min}-${priceTier.max}. Cannot equip robot.`
  );
}

/**
 * Selects a shield from the given price tier.
 * Filters for weapons with handsRequired = 'shield'.
 * Throws if no shield is found.
 */
export function selectShield(weapons: WeaponRecord[], priceTier: { min: number; max: number }): WeaponRecord {
  const shields = weapons.filter(
    (w) => w.cost >= priceTier.min && w.cost <= priceTier.max && w.handsRequired === 'shield'
  );

  if (shields.length > 0) {
    return shields[Math.floor(Math.random() * shields.length)];
  }

  throw new Error(
    `[WeaponSelection] No shield found in price tier ${priceTier.min}-${priceTier.max}. Cannot equip robot.`
  );
}
