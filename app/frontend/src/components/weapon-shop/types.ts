/**
 * Shared types for Weapon Shop page components.
 *
 * Extracted from WeaponShopPage.tsx during component splitting (Spec 18).
 */

import type { RangeBand } from '../../utils/weaponRange';

export interface Weapon {
  id: number;
  name: string;
  weaponType: string;
  loadoutType: string;
  handsRequired: string;
  description: string;
  rangeBand: RangeBand;
  baseDamage: number;
  cost: number;
  cooldown: number;
  // Attribute bonuses
  combatPowerBonus: number;
  targetingSystemsBonus: number;
  criticalSystemsBonus: number;
  penetrationBonus: number;
  weaponControlBonus: number;
  attackSpeedBonus: number;
  armorPlatingBonus: number;
  shieldCapacityBonus: number;
  evasionThrustersBonus: number;
  counterProtocolsBonus: number;
  servoMotorsBonus: number;
  gyroStabilizersBonus: number;
  hydraulicSystemsBonus: number;
  powerCoreBonus: number;
  threatAnalysisBonus: number;
  /** Allow dynamic attribute bonus access */
  [key: string]: unknown;
}

export interface WeaponFacility {
  id: number;
  type: string;
  facilityType: string;
  level: number;
  currentLevel: number;
}

export interface StorageStatus {
  currentWeapons: number;
  maxCapacity: number;
  remainingSlots: number;
  isFull: boolean;
  percentageFull: number;
}

export type ViewMode = 'card' | 'table';
