export { calculateWeaponWorkshopDiscount, calculateTrainingFacilityDiscount, applyDiscount, applyTrainingDiscount, calculateWeaponResaleRate, applyResaleRate, TRAINING_DISCOUNT_BASE_PER_LEVEL, TRAINING_DISCOUNT_PER_SLOT, TRAINING_DISCOUNT_FACTOR, TRAINING_FACILITY_MAX_LEVEL } from './discounts';
export { getRosterCapacity } from './rosterCapacity';
export { getCapForLevel, ACADEMY_CAP_MAP } from './academyCaps';
export { calculateBaseCost, calculateDiscountedUpgradeCost, calculateTrainingDiscountedUpgradeCost, calculateUpgradeCostRange } from './upgradeCosts';
export { ROBOT_ATTRIBUTES, isRobotAttribute, type RobotAttribute } from './robotAttributes';
export {
  calculateRepairQuote,
  applyManualRepairDiscount,
  calculateRepairBayDiscountPercent,
  sumAttributes,
  MANUAL_REPAIR_DISCOUNT,
  MAX_REPAIR_BAY_DISCOUNT_PERCENT,
  REPAIR_BAY_DISCOUNT_PER_LEVEL_PERCENT,
  REPAIR_BAY_MAX_LEVEL,
  type RepairCostRobot,
  type RepairQuoteSubject,
} from './repairCost';
export {
  calculateRefinementCost,
  getRefinementMagnitudeRange,
  validateRefinementSlotAvailable,
  validateAttributeStackCap,
  validateAttributeOnWeapon,
  validateShieldCompatibility,
  applyRefinementsToWeapon,
  calculateRankPrefix,
  formatWeaponDisplayName,
  type RefinementTier,
  type RankPrefix,
  type RefinementRow,
  type EffectiveWeaponStats,
  type WeaponLike,
  type ValidatorResult,
} from './weaponRefinement';
export {
  computeBattleStatistics,
  createRobotStats,
  type BattleLogEvent,
  type BattleStatistics,
  type RobotCombatStats,
  type TeamCombatStats,
  type DamageFlow,
  type HandStats,
  type CounterStats,
  type HitGrades,
} from './battleStatistics';
export {
  LOADOUT_BONUSES,
  STANCE_MODIFIERS,
  BASE_HP,
  HP_MULTIPLIER,
  SHIELD_MULTIPLIER,
  calculateAttributeBonus,
  getLoadoutBonus,
  getStanceModifier,
  COMBAT_STAT_DECIMALS,
  roundToCombatPrecision,
  calculateCombatEffectiveStat,
  calculateCombatEffectiveStats,
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
} from './robotStats';

export {
  evaluateLoadoutReadiness,
  LOADOUT_READINESS_REASONS,
  type ReadinessLoadoutType,
  type LoadoutReadinessInput,
  type LoadoutReadinessResult,
} from './loadout-readiness';

export {
  WEAPON_BASE_COST,
  STARTER_WEAPON_COST,
  BASELINE_DPS,
  DPS_COST_MULTIPLIER,
  ATTRIBUTE_COST_MULTIPLIER,
  HAND_MULTIPLIERS,
  sumWeaponBonuses,
  calculateWeaponDpsCost,
  calculateWeaponAttributeCost,
  isStarterWeapon,
  calculateWeaponPrice,
  type WeaponHands,
  type WeaponPricingInput,
} from './weaponPricing';
export { PRESTIGE_GATES, PRESTIGE_GATES_10, getUnlockedFacilityLevel, getNextPrestigeThreshold } from './prestigeGates';
