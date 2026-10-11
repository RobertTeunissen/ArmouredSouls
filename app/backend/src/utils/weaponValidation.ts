// Weapon compatibility and validation logic

import { Weapon } from '../../generated/prisma';

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
 * based on its type and the robot's loadout configuration. The rule lives in
 * `app/shared/utils/weaponSlots.ts` (the admin Automaton editor uses it too).
 */
import { canEquipToSlot } from '../shared/utils/weaponSlots';

export { canEquipToSlot };

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

/**
 * Validate that a weapon is not already equipped in the other slot on the same robot.
 * Prevents the same weapon inventory item from being used as both main and offhand.
 */
export function validateNoDuplicateEquip(
  weaponInventoryId: number,
  targetSlot: 'main' | 'offhand',
  robot: { mainWeaponId: number | null; offhandWeaponId: number | null }
): { valid: boolean; reason?: string } {
  if (targetSlot === 'main' && robot.offhandWeaponId === weaponInventoryId) {
    return { valid: false, reason: 'This weapon is already equipped as your offhand weapon' };
  }
  if (targetSlot === 'offhand' && robot.mainWeaponId === weaponInventoryId) {
    return { valid: false, reason: 'This weapon is already equipped as your main weapon' };
  }
  return { valid: true };
}
