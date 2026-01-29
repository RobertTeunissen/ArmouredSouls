// Weapon compatibility and validation logic

import { Weapon } from '@prisma/client';

/**
 * Check if a weapon is compatible with a specific loadout type
 */
export function isWeaponCompatibleWithLoadout(weapon: Weapon, loadoutType: string): boolean {
  // Weapons with loadoutType 'any' work with all loadouts
  if (weapon.loadoutType === 'any') {
    return true;
  }

  // Otherwise, weapon must match the robot's loadout type
  return weapon.loadoutType === loadoutType;
}

/**
 * Check if a weapon can be equipped to a specific slot (main or offhand)
 * based on its type and the robot's loadout configuration
 */
export function canEquipToSlot(
  weapon: Weapon,
  slot: 'main' | 'offhand',
  loadoutType: string
): { canEquip: boolean; reason?: string } {
  const { handsRequired, weaponType } = weapon;

  // Shield weapons can ONLY go in offhand slot
  if (handsRequired === 'shield') {
    if (slot === 'main') {
      return { canEquip: false, reason: 'Shields can only be equipped in offhand slot' };
    }
    // Shields require weapon_shield loadout
    if (loadoutType !== 'weapon_shield') {
      return { canEquip: false, reason: 'Shields require weapon_shield loadout type' };
    }
    return { canEquip: true };
  }

  // Two-handed weapons can ONLY go in main slot
  if (handsRequired === 'two') {
    if (slot === 'offhand') {
      return { canEquip: false, reason: 'Two-handed weapons can only be equipped in main slot' };
    }
    if (loadoutType !== 'two_handed') {
      return { canEquip: false, reason: 'Two-handed weapons require two_handed loadout type' };
    }
    return { canEquip: true };
  }

  // One-handed weapons
  if (handsRequired === 'one') {
    // Main slot: Can equip one-handed weapons in any loadout except two_handed
    if (slot === 'main') {
      if (loadoutType === 'two_handed') {
        return { canEquip: false, reason: 'One-handed weapons cannot be used with two_handed loadout in main slot' };
      }
      return { canEquip: true };
    }

    // Offhand slot: Can only equip one-handed weapons in dual_wield loadout
    if (slot === 'offhand') {
      if (loadoutType !== 'dual_wield') {
        return { canEquip: false, reason: 'One-handed weapons in offhand require dual_wield loadout type' };
      }
      return { canEquip: true };
    }
  }

  return { canEquip: false, reason: 'Invalid weapon configuration' };
}

/**
 * Validate if an offhand weapon (especially shield) can be equipped
 * based on main weapon status
 */
export function validateOffhandEquipment(
  offhandWeapon: Weapon,
  hasMainWeapon: boolean,
  loadoutType: string
): { valid: boolean; reason?: string } {
  // Shield requires a main weapon to be equipped
  if (offhandWeapon.handsRequired === 'shield') {
    if (!hasMainWeapon) {
      return { valid: false, reason: 'Shield requires a main weapon to be equipped first' };
    }
    if (loadoutType !== 'weapon_shield') {
      return { valid: false, reason: 'Shield requires weapon_shield loadout type' };
    }
  }

  // Offhand weapon in dual_wield loadout requires main weapon
  if (loadoutType === 'dual_wield' && !hasMainWeapon) {
    return { valid: false, reason: 'Offhand weapon in dual_wield requires a main weapon' };
  }

  return { valid: true };
}

/**
 * Get all valid loadout types for a given weapon in a specific slot
 */
export function getValidLoadoutsForWeapon(weapon: Weapon, slot: 'main' | 'offhand'): string[] {
  const validLoadouts: string[] = [];

  const loadoutTypes = ['single', 'weapon_shield', 'two_handed', 'dual_wield'];

  for (const loadout of loadoutTypes) {
    const result = canEquipToSlot(weapon, slot, loadout);
    if (result.canEquip) {
      validLoadouts.push(loadout);
    }
  }

  return validLoadouts;
}

/**
 * Check if a loadout type change is valid given currently equipped weapons
 */
export function canChangeLoadout(
  newLoadoutType: string,
  mainWeapon: Weapon | null,
  offhandWeapon: Weapon | null
): { canChange: boolean; conflicts?: string[] } {
  const conflicts: string[] = [];

  // Check main weapon compatibility
  if (mainWeapon) {
    const mainResult = canEquipToSlot(mainWeapon, 'main', newLoadoutType);
    if (!mainResult.canEquip) {
      conflicts.push(`Main weapon (${mainWeapon.name}): ${mainResult.reason}`);
    }
  }

  // Check offhand weapon compatibility
  if (offhandWeapon) {
    const offhandResult = canEquipToSlot(offhandWeapon, 'offhand', newLoadoutType);
    if (!offhandResult.canEquip) {
      conflicts.push(`Offhand weapon (${offhandWeapon.name}): ${offhandResult.reason}`);
    }
  }

  return {
    canChange: conflicts.length === 0,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  };
}

/**
 * Validate if a slot should be available based on loadout type
 */
export function isSlotAvailable(slot: 'main' | 'offhand', loadoutType: string): boolean {
  // Main slot is always available
  if (slot === 'main') {
    return true;
  }

  // Offhand slot is only available for weapon_shield and dual_wield
  if (slot === 'offhand') {
    return loadoutType === 'weapon_shield' || loadoutType === 'dual_wield';
  }

  return false;
}
