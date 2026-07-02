/**
 * Robot Stats — Re-export from shared module.
 *
 * The calculation logic lives in app/shared/utils/robotStats.ts (single source of truth).
 * This file preserves the existing import paths for all frontend consumers.
 * New code can import directly from '@shared/utils/robotStats'.
 */

export {
  LOADOUT_BONUSES,
  STANCE_MODIFIERS,
  BASE_HP,
  HP_MULTIPLIER,
  SHIELD_MULTIPLIER,
  calculateAttributeBonus,
  getLoadoutBonus,
  getStanceModifier,
  calculateEffectiveStat,
  calculateEffectiveStats,
  calculateMaxHP,
  calculateMaxShield,
  getLoadoutModifiedAttributes,
  formatLoadoutName,
  getLoadoutDescription,
  getAttributeDisplay,
  isValidStance,
  isValidYieldThreshold,
  type WeaponBonuses,
  type WeaponInventoryLike,
  type RobotStatsInput,
  type TuningAttributeMap,
} from '@shared/utils/robotStats';
