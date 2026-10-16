/**
 * Stable facts: the plain-data snapshot the Automaton planner reads
 * (Spec #55, design §8.1).
 *
 * This file holds the shapes, the pure derivations the Goal_Library needs and
 * the read-only loaders (task 5.1): `loadStableFacts` (a fixed, bounded set of
 * reads for one stable), `loadBlueprintFacts` and `loadWeaponCatalogue`. The
 * planner never touches the database; only these loaders do.
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
import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { calculateStorageCapacity } from '../../utils/storageCalculations';
import { getSubscriptionCap } from '../../config/subscriptions';
import { getRosterCapacity } from '../../shared/utils/rosterCapacity';
import type { RefinementRow, RefinementTier } from '../../shared/utils/weaponRefinement';
import { ROBOT_ATTRIBUTES, type RobotAttribute } from '../../shared/utils/robotAttributes';
import { SUBSCRIBABLE_EVENT_TYPES, type SubscribableEventType } from '../subscription/eventRegistry';
import { resolveOutstandingEventsForRobots } from '../scheduling/eventScheduleScope';
import { getCurrentSeason } from '../season/seasonService';
import logger from '../../config/logger';
import { robotNameCandidates } from './robotNaming';
import type { BuildFocusKey, RefinementStep, WeaponStage } from '../../types/automaton';

/** Facility types in the order of `FACILITY_TYPES` (`config/facilities.ts`); a unit test keeps them equal. */
export const AUTOMATON_FACILITY_TYPES = [
  'repair_bay',
  'training_facility',
  'weapons_workshop',
  'refinement_lab',
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

// ─── Loaders (task 5.1) ──────────────────────────────────────────────

/** A Prisma client or interactive-transaction client; the loaders only read. */
export type FactsDb = Prisma.TransactionClient;

/** Season facts a Turn_Step already knows; the loader reads them when omitted. */
export interface SeasonFacts {
  seasonNumber: number;
  phase: StableFacts['phase'];
}

export interface LoadStableFactsOptions {
  season?: SeasonFacts;
  /**
   * Robot_Blueprints of the profile (`loadBlueprintFacts`). Used to derive
   * `stageIndex` and the robot names that matter; read when omitted.
   */
  blueprints?: readonly BlueprintFacts[];
}

const LOADOUT_TYPES: readonly LoadoutType[] = ['single', 'weapon_shield', 'dual_wield', 'two_handed'];
const STANCES: readonly Stance[] = ['offensive', 'defensive', 'balanced'];
const SUBSCRIBABLE = new Set<string>(SUBSCRIBABLE_EVENT_TYPES);

function asLoadoutType(value: string): LoadoutType {
  return (LOADOUT_TYPES as readonly string[]).includes(value) ? (value as LoadoutType) : 'single';
}

function asStance(value: string): Stance {
  return (STANCES as readonly string[]).includes(value) ? (value as Stance) : 'balanced';
}

function asEventTypes(values: readonly string[]): SubscribableEventType[] {
  const set = new Set(values.filter((value) => SUBSCRIBABLE.has(value)));
  return SUBSCRIBABLE_EVENT_TYPES.filter((event) => set.has(event));
}

/** Catalogue row → planner WeaponFacts (bonuses: the non-zero `<attribute>Bonus` columns). */
export function weaponFactsFromRow(row: {
  id: number;
  name: string;
  cost: number;
  weaponType: string;
  handsRequired: string;
  rangeBand: string;
}): WeaponFacts {
  const record = row as unknown as Record<string, unknown>;
  const bonuses: Partial<Record<RobotAttribute, number>> = {};
  for (const attribute of ROBOT_ATTRIBUTES) {
    const value = record[`${attribute}Bonus`];
    if (typeof value === 'number' && value !== 0) bonuses[attribute] = value;
  }
  return {
    weaponId: row.id,
    name: row.name,
    cost: row.cost,
    weaponType: row.weaponType,
    handsRequired: row.handsRequired,
    rangeBand: row.rangeBand,
    bonuses,
  };
}

/** The weapon catalogue keyed by name, loaded once per Turn_Step (design §8.1). */
export async function loadWeaponCatalogue(db: FactsDb = prisma): Promise<Map<string, WeaponFacts>> {
  const rows = await db.weapon.findMany({ orderBy: { id: 'asc' } });
  const catalogue = new Map<string, WeaponFacts>();
  for (const row of rows) {
    // First row wins if two catalogue rows ever share a name, so the map is deterministic.
    if (!catalogue.has(row.name)) catalogue.set(row.name, weaponFactsFromRow(row));
  }
  return catalogue;
}

/** The profile's Robot_Blueprints as planner facts, ordered by Blueprint_Slot. */
export async function loadBlueprintFacts(db: FactsDb, profileId: number): Promise<BlueprintFacts[]> {
  const rows = await db.automatonRobotBlueprint.findMany({
    where: { profileId },
    orderBy: { slotIndex: 'asc' },
  });
  return rows.map((row) => ({
    blueprintId: row.id,
    slotIndex: row.slotIndex,
    robotName: row.robotName,
    imageUrl: row.imageUrl,
    loadoutType: asLoadoutType(row.loadoutType),
    stance: asStance(row.stance),
    yieldThreshold: row.yieldThreshold,
    buildFocus: row.buildFocus as BuildFocusKey,
    // Stored shapes are validated on write (catalogue schema, admin input).
    weaponPath: row.weaponPath as unknown as WeaponStage[],
    refinementPlan: row.refinementPlan as unknown as RefinementStep[],
  }));
}

const ROBOT_FACT_SELECT = {
  id: true,
  automatonSlotIndex: true,
  automatonBlueprintId: true,
  loadoutType: true,
  stance: true,
  yieldThreshold: true,
  mainWeaponId: true,
  offhandWeaponId: true,
  subscriptions: { select: { eventType: true } },
  tuningAllocation: true,
  ...Object.fromEntries(ROBOT_ATTRIBUTES.map((attribute) => [attribute, true])),
} as const satisfies Prisma.RobotSelect;

/**
 * Load the StableFacts of one Active_Automaton (design §8.1).
 *
 * Bounded: a fixed number of queries per stable (profile, user, facilities,
 * robots with subscriptions and tuning, inventory with refinements, teams,
 * held event types, names), none per robot. Robots without a Blueprint_Slot
 * are left out (invariant I4 says there are none) and logged.
 */
export async function loadStableFacts(
  db: FactsDb,
  profileId: number,
  options: LoadStableFactsOptions = {},
): Promise<StableFacts> {
  const profile = await db.automatonProfile.findUniqueOrThrow({
    where: { id: profileId },
    select: { id: true, userId: true, catalogueKey: true },
  });
  if (profile.userId === null) {
    throw new Error(`Automaton profile ${profileId} (${profile.catalogueKey}) is a draft and has no stable`);
  }
  const userId = profile.userId;
  const blueprints = options.blueprints ?? (await loadBlueprintFacts(db, profileId));
  const season = options.season ?? (await currentSeasonFacts());

  // Sequential on purpose: `db` may be an interactive-transaction client,
  // which must not run queries concurrently.
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { currency: true, prestige: true } });
  const facilityRows = await db.facility.findMany({ where: { userId }, select: { facilityType: true, level: true } });
  const robotRows = await db.robot.findMany({ where: { userId }, select: ROBOT_FACT_SELECT, orderBy: { id: 'asc' } });
  const inventoryRows = await db.weaponInventory.findMany({
    where: { userId },
    select: {
      id: true,
      pricePaid: true,
      purchasedAt: true,
      weapon: { select: { name: true } },
      refinements: { select: { tier: true, magnitude: true, targetAttribute: true }, orderBy: { slotIndex: 'asc' } },
    },
    orderBy: { id: 'asc' },
  });
  const teamRows = await db.teamBattle.findMany({
    where: { stableId: userId },
    select: { id: true, teamSize: true, teamName: true, members: { select: { robotId: true }, orderBy: { slotIndex: 'asc' } } },
    orderBy: { id: 'asc' },
  });

  const facilities = Object.fromEntries(AUTOMATON_FACILITY_TYPES.map((type) => [type, 0])) as Record<FacilityType, number>;
  for (const row of facilityRows) {
    if ((AUTOMATON_FACILITY_TYPES as readonly string[]).includes(row.facilityType)) {
      facilities[row.facilityType as FacilityType] = row.level;
    }
  }

  const inventory: InventoryFacts[] = inventoryRows.map((row) => ({
    inventoryId: row.id,
    weaponName: row.weapon.name,
    pricePaid: row.pricePaid,
    createdAtMs: row.purchasedAt.getTime(),
    refinements: row.refinements.map((r) => ({
      tier: r.tier as RefinementTier,
      magnitude: r.magnitude,
      targetAttribute: r.targetAttribute,
    })),
  }));

  const linkedRows = robotRows.filter((row) => row.automatonSlotIndex !== null);
  if (linkedRows.length !== robotRows.length) {
    logger.warn(`[Automaton] ${profile.catalogueKey}: ${robotRows.length - linkedRows.length} robot(s) without a Blueprint_Slot left out of the facts`);
  }
  const held = await resolveOutstandingEventsForRobots(linkedRows.map((row) => row.id), db);

  const robots: RobotFacts[] = linkedRows.map((row) => {
    const record = row as unknown as Record<string, unknown>;
    const tuningRecord = row.tuningAllocation as unknown as Record<string, unknown> | null;
    const attributes = {} as Record<RobotAttribute, number>;
    const tuning: Partial<Record<RobotAttribute, number>> = {};
    for (const attribute of ROBOT_ATTRIBUTES) {
      attributes[attribute] = Number(record[attribute]);
      const tuned = tuningRecord ? Number(tuningRecord[attribute]) : 0;
      if (tuned !== 0) tuning[attribute] = tuned;
    }
    const facts: RobotFacts = {
      robotId: row.id,
      slotIndex: row.automatonSlotIndex as number,
      blueprintId: row.automatonBlueprintId,
      attributes,
      loadoutType: asLoadoutType(row.loadoutType),
      stance: asStance(row.stance),
      yieldThreshold: row.yieldThreshold,
      mainInventoryId: row.mainWeaponId,
      offhandInventoryId: row.offhandWeaponId,
      stageIndex: -1,
      subscriptions: asEventTypes(row.subscriptions.map((s) => s.eventType)),
      heldEventTypes: asEventTypes(held.get(row.id) ?? []),
      tuning,
    };
    const blueprint = blueprints.find((b) => b.blueprintId === row.automatonBlueprintId);
    facts.stageIndex = blueprint ? matchedStageIndex(facts, blueprint, inventory) : -1;
    return facts;
  }).sort((a, b) => a.slotIndex - b.slotIndex);

  const teams: TeamFacts[] = teamRows
    .filter((row) => row.teamSize === 2 || row.teamSize === 3)
    .map((row) => ({
      teamId: row.id,
      size: row.teamSize as 2 | 3,
      name: row.teamName,
      memberRobotIds: row.members.map((m) => m.robotId),
    }));

  const candidates = [...new Set(blueprints.flatMap((b) => robotNameCandidates(b.robotName)))];
  const taken = candidates.length === 0
    ? []
    : await db.robot.findMany({ where: { name: { in: candidates } }, select: { name: true }, orderBy: { name: 'asc' } });

  return {
    profileId,
    userId,
    catalogueKey: profile.catalogueKey,
    seasonNumber: season.seasonNumber,
    phase: season.phase,
    balance: user.currency,
    prestige: user.prestige,
    facilities,
    robots,
    inventory,
    teams,
    takenRobotNames: taken.map((row) => row.name),
  };
}

async function currentSeasonFacts(): Promise<SeasonFacts> {
  const state = await getCurrentSeason();
  return { seasonNumber: state.seasonNumber, phase: state.phase === 'preparation' ? 'preparation' : 'competitive' };
}
