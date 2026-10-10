/**
 * Stable facts: the plain-data snapshot the Automaton planner reads
 * (Spec #55, design §8.1).
 *
 * This file holds the shapes and the pure derivations the Goal_Library needs.
 * The loader (`loadStableFacts`, bounded reads for one stable) is added by
 * task 5.1. The planner never touches the database.
 *
 * Deviations from the design-level shape in §8.1, kept deliberately small:
 * - Roster_Capacity, Storage capacity and Booking_Cap are derived from the
 *   facility levels by the helpers below instead of being stored next to them,
 *   so a projected fact set (factProjector) can never carry a stale capacity.
 * - Refinements live on the inventory item (`InventoryFacts.refinements`), the
 *   one place they exist in the database; a robot's hands reference items by
 *   id. A weapon reused from storage therefore keeps its refinements.
 * - `takenRobotNames` carries the robot names already used anywhere in the
 *   game that matter for the next robot (its blueprint name and Mk suffixes),
 *   so the robots Goal can decide `name_unavailable` without a query.
 */
import { calculateStorageCapacity } from '../../utils/storageCalculations';
import { getSubscriptionCap } from '../../config/subscriptions';
import { getRosterCapacity } from '../../shared/utils/rosterCapacity';
import type { RefinementRow, RefinementTier } from '../../shared/utils/weaponRefinement';
import type { RobotAttribute } from '../../shared/utils/robotAttributes';
import type { SubscribableEventType } from '../subscription/eventRegistry';
import type { BuildFocusKey, RefinementStep, WeaponStage } from '../../types/automaton';

/** Facility types in the order of `FACILITY_TYPES` (`config/facilities.ts`); a unit test keeps them equal. */
export const AUTOMATON_FACILITY_TYPES = [
  'repair_bay',
  'training_facility',
  'weapons_workshop',
  'roster_expansion',
  'storage_facility',
  'booking_office',
  'combat_training_academy',
  'defense_training_academy',
  'mobility_training_academy',
  'ai_training_academy',
  'merchandising_hub',
  'streaming_studio',
  'tuning_bay',
] as const;

export type FacilityType = (typeof AUTOMATON_FACILITY_TYPES)[number];

export type LoadoutType = 'single' | 'weapon_shield' | 'dual_wield' | 'two_handed';
export type Stance = 'offensive' | 'defensive' | 'balanced';
export type Hand = 'main' | 'offhand';

/** One `weapon_inventory` row of the stable. */
export interface InventoryFacts {
  inventoryId: number;
  weaponName: string;
  pricePaid: number;
  /** Epoch milliseconds; Storage_Overflow_Rule ties sell the oldest first. */
  createdAtMs: number;
  /** Refinement rows on this item, in slot order. */
  refinements: RefinementRow[];
}

export interface RobotFacts {
  robotId: number;
  /** `Robot.automatonSlotIndex`. */
  slotIndex: number;
  blueprintId: number | null;
  /** Current base values (`Number(Decimal)`). */
  attributes: Record<RobotAttribute, number>;
  loadoutType: LoadoutType;
  stance: Stance;
  yieldThreshold: number;
  mainInventoryId: number | null;
  offhandInventoryId: number | null;
  /** Matched Weapon_Stage, −1 when no stage matches (design §8.1). */
  stageIndex: number;
  subscriptions: SubscribableEventType[];
  /** Event types still owed a booked match (held slots). */
  heldEventTypes: SubscribableEventType[];
  tuning: Partial<Record<RobotAttribute, number>>;
}

export interface TeamFacts {
  teamId: number;
  size: 2 | 3;
  name: string;
  /** Member robot ids in `TeamBattleMember.slotIndex` order. */
  memberRobotIds: number[];
}

export interface StableFacts {
  profileId: number;
  userId: number;
  catalogueKey: string;
  seasonNumber: number;
  phase: 'preparation' | 'competitive';
  /** `User.currency`. */
  balance: number;
  prestige: number;
  /** Facility level per type, 0 when absent. */
  facilities: Record<FacilityType, number>;
  /** Live robots ordered by `slotIndex`. */
  robots: RobotFacts[];
  /** Every `weapon_inventory` row of the user. */
  inventory: InventoryFacts[];
  teams: TeamFacts[];
  /** Robot names already taken in the game that the next robot could use. */
  takenRobotNames: string[];
}

/** Robot_Blueprint as the planner sees it. */
export interface BlueprintFacts {
  blueprintId: number;
  slotIndex: number;
  robotName: string;
  imageUrl: string | null;
  loadoutType: LoadoutType;
  stance: Stance;
  yieldThreshold: number;
  buildFocus: BuildFocusKey;
  weaponPath: WeaponStage[];
  refinementPlan: RefinementStep[];
}

/** Catalogue weapon as the planner sees it. */
export interface WeaponFacts {
  weaponId: number;
  name: string;
  cost: number;
  /** "energy" | "ballistic" | "melee" | "shield". */
  weaponType: string;
  /** "one" | "two" | "shield". */
  handsRequired: string;
  rangeBand: string;
  /** Catalogue `<attribute>Bonus` values, 0 when absent. */
  bonuses: Partial<Record<RobotAttribute, number>>;
}

export type { RefinementRow, RefinementTier };

/** Robot slots the stable has (`roster_expansion` level + 1). */
export function rosterCapacityOf(facts: StableFacts): number {
  return getRosterCapacity(facts.facilities.roster_expansion);
}

/** Weapons the stable can hold (Storage Facility). */
export function storageCapacityOf(facts: StableFacts): number {
  return calculateStorageCapacity(facts.facilities.storage_facility);
}

/** Events per robot (Booking Office). */
export function bookingCapOf(facts: StableFacts): number {
  return getSubscriptionCap(facts.facilities.booking_office);
}

/** Inventory ids equipped by any live robot. */
export function equippedInventoryIds(facts: StableFacts): Set<number> {
  const ids = new Set<number>();
  for (const robot of facts.robots) {
    if (robot.mainInventoryId !== null) ids.add(robot.mainInventoryId);
    if (robot.offhandInventoryId !== null) ids.add(robot.offhandInventoryId);
  }
  return ids;
}

/** Inventory item by id, or undefined. */
export function inventoryItem(facts: StableFacts, inventoryId: number | null): InventoryFacts | undefined {
  if (inventoryId === null) return undefined;
  return facts.inventory.find((item) => item.inventoryId === inventoryId);
}

/** The blueprint of a Blueprint_Slot, or undefined. */
export function blueprintForSlot(blueprints: readonly BlueprintFacts[], slotIndex: number): BlueprintFacts | undefined {
  return blueprints.find((b) => b.slotIndex === slotIndex);
}

/**
 * Matched Weapon_Stage (design §8.1): the highest stage whose weapons the
 * robot holds in every hand of that stage while its loadout equals the
 * blueprint loadout; −1 otherwise. Used by the facts loader and by
 * `factProjector`, so a projected robot's stage is derived exactly as a
 * loaded one.
 */
export function matchedStageIndex(
  robot: Pick<RobotFacts, 'loadoutType' | 'mainInventoryId' | 'offhandInventoryId'>,
  blueprint: Pick<BlueprintFacts, 'loadoutType' | 'weaponPath'>,
  inventory: readonly InventoryFacts[],
): number {
  if (robot.loadoutType !== blueprint.loadoutType) return -1;
  const nameOf = (inventoryId: number | null): string | undefined =>
    inventoryId === null ? undefined : inventory.find((item) => item.inventoryId === inventoryId)?.weaponName;
  const main = nameOf(robot.mainInventoryId);
  const offhand = nameOf(robot.offhandInventoryId);
  for (let stageIndex = blueprint.weaponPath.length - 1; stageIndex >= 0; stageIndex--) {
    const stage = blueprint.weaponPath[stageIndex];
    if (stage.main !== main) continue;
    if (stage.offhand !== undefined && stage.offhand !== offhand) continue;
    return stageIndex;
  }
  return -1;
}
