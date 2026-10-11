/**
 * Automaton pricing (Spec #55, R5.3, design §8.4–§8.6, task 3.1).
 *
 * Pure cost functions for the planner. Every price comes from the function the
 * charging service itself uses, so a planned step costs exactly what the
 * domain service will charge; no formula is copied here. The domain service
 * stays the authority and re-validates every charge.
 */
import { getFacilityUpgradeRequirement } from '../economy/facilityUpgradeService';
import { REQUIRED_WORKSHOP_LEVELS, refinementMagnitudeForStorage } from '../economy/weaponRefinementService';
import { ROBOT_CREATION_COST } from '../robot/robotCreationService';
import {
  applyDiscount,
  applyResaleRate,
  calculateTrainingFacilityDiscount,
  calculateWeaponResaleRate,
  calculateWeaponWorkshopDiscount,
} from '../../shared/utils/discounts';
import { calculateTrainingDiscountedUpgradeCost } from '../../shared/utils/upgradeCosts';
import { calculateRefinementCost, type RefinementTier } from '../../shared/utils/weaponRefinement';
import type { FacilityType } from './stableFacts';

/** The next level of a facility as the upgrade service would sell it. */
export type FacilityLevelQuote =
  | { kind: 'available'; facilityType: FacilityType; toLevel: number; cost: number; prestigeRequired: number }
  | { kind: 'max_level'; facilityType: FacilityType; currentLevel: number; maxLevel: number }
  | {
    kind: 'prestige_gate';
    facilityType: FacilityType;
    toLevel: number;
    cost: number;
    prestigeRequired: number;
    prestigeHeld: number;
  };

/**
 * Quote the level after `currentLevel`: its cost and whether the stable's
 * prestige meets the Prestige_Gate (`prestige ≥ prestigeRequired`, the check
 * `upgradeFacility` makes).
 */
export function quoteFacilityLevel(facilityType: FacilityType, currentLevel: number, prestige: number): FacilityLevelQuote {
  const requirement = getFacilityUpgradeRequirement(facilityType, currentLevel);
  if (currentLevel >= requirement.maxLevel) {
    return { kind: 'max_level', facilityType, currentLevel, maxLevel: requirement.maxLevel };
  }
  const toLevel = currentLevel + 1;
  if (prestige < requirement.prestigeRequired) {
    return {
      kind: 'prestige_gate',
      facilityType,
      toLevel,
      cost: requirement.cost,
      prestigeRequired: requirement.prestigeRequired,
      prestigeHeld: prestige,
    };
  }
  return { kind: 'available', facilityType, toLevel, cost: requirement.cost, prestigeRequired: requirement.prestigeRequired };
}

/** Maximum level of a facility type. */
export function facilityMaxLevel(facilityType: FacilityType): number {
  return getFacilityUpgradeRequirement(facilityType, 0).maxLevel;
}

/** Price of one robot (`createRobotTransaction`). */
export function robotPurchaseCost(): number {
  return ROBOT_CREATION_COST;
}

/** Catalogue price after the Weapons Workshop discount (`purchaseWeapon`). */
export function discountedWeaponPrice(catalogueCost: number, workshopLevel: number): number {
  return applyDiscount(catalogueCost, calculateWeaponWorkshopDiscount(workshopLevel));
}

/** Credits a sale returns (`sellWeapon`): resale rate of the Workshop level on `pricePaid`. */
export function weaponResaleValue(pricePaid: number, workshopLevel: number): number {
  return applyResaleRate(pricePaid, calculateWeaponResaleRate(workshopLevel));
}

/**
 * Credits for raising one attribute from `fromLevel` to `toLevel`
 * (`executeUpgradeTransaction`): per level the base cost with the Training
 * Facility discount at the stable's Roster_Capacity.
 */
export function attributeIncrementCost(
  fromLevel: number,
  toLevel: number,
  trainingLevel: number,
  rosterCapacity: number,
): number {
  const discountPercent = calculateTrainingFacilityDiscount(trainingLevel, rosterCapacity);
  return calculateTrainingDiscountedUpgradeCost(Math.floor(fromLevel), toLevel, discountPercent);
}

/** Credits for one refinement (`refineWeapon`), given the instances of that tier already on the weapon. */
export function refinementStepCost(tier: RefinementTier, magnitude: number, existingInstancesOfTier: number): number {
  return calculateRefinementCost(tier, refinementMagnitudeForStorage(tier, magnitude), existingInstancesOfTier);
}

/** Weapons Workshop level a refinement tier needs (Hone L1, Augment L3, Sharpen L5, Forge L8). */
export function workshopLevelForTier(tier: RefinementTier): number {
  return REQUIRED_WORKSHOP_LEVELS[tier];
}
