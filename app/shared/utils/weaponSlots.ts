/**
 * Which weapon fits which hand of which loadout. Shared by the backend
 * equip/catalogue validation and the admin Automaton Weapon_Path picker
 * (Spec #55, task 10.3), so both apply the same rule.
 */

export interface WeaponHandsLike {
  handsRequired: string;
  weaponType: string;
}

/**
 * Check if a weapon can be equipped to a specific slot (main or offhand)
 * based on its type and the robot's loadout configuration
 */
export function canEquipToSlot(
  weapon: WeaponHandsLike,
  slot: 'main' | 'offhand',
  loadoutType: string
): { canEquip: boolean; reason?: string } {
  const { handsRequired } = weapon;

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
