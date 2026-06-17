export { calculateWeaponWorkshopDiscount, calculateTrainingFacilityDiscount, applyDiscount, calculateWeaponResaleRate, applyResaleRate } from './discounts';
export { getCapForLevel, ACADEMY_CAP_MAP } from './academyCaps';
export { calculateBaseCost, calculateDiscountedUpgradeCost, calculateUpgradeCostRange } from './upgradeCosts';
export { ROBOT_ATTRIBUTES, isRobotAttribute, type RobotAttribute } from './robotAttributes';
export {
  calculateRepairCost,
  calculateRobotRepairCost,
  calculateRepairBayDiscount,
  sumAttributes,
  MANUAL_REPAIR_DISCOUNT,
  type RepairCostRobot,
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
