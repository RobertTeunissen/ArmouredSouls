/**
 * Shared building blocks of the Goal_Library (Spec #55, design §8.5–§8.6):
 * facility Goal_Chains, Weapon_Reuse and the Storage_Overflow_Rule.
 *
 * All functions are pure and deterministic for identical inputs (R5.10).
 */
import { AutomatonError, AutomatonErrorCode } from '../../../errors/automatonErrors';
import { calculateStorageCapacity } from '../../../utils/storageCalculations';
import { quoteFacilityLevel, weaponResaleValue, type FacilityLevelQuote } from '../pricing';
import {
  equippedInventoryIds,
  storageCapacityOf,
  type BlueprintFacts,
  type FacilityType,
  type Hand,
  type InventoryFacts,
  type StableFacts,
  type WeaponFacts,
} from '../stableFacts';
import type { WeaponStage } from '../../../types/automaton';
import type { BlockedReason, FacilityLevelStep, GoalContext, GoalDetail, WeaponSaleStep } from './goalTypes';

export type ChainResult<TStep> =
  | { kind: 'ok'; steps: TStep[]; cost: number }
  | { kind: 'blocked'; reason: BlockedReason; detail: GoalDetail };

/** Blocked detail for a facility level that cannot be bought. */
export function blockedFromQuote(quote: Exclude<FacilityLevelQuote, { kind: 'available' }>): { reason: BlockedReason; detail: GoalDetail } {
  if (quote.kind === 'max_level') {
    return {
      reason: 'max_level',
      detail: { facilityType: quote.facilityType, level: quote.currentLevel, maxLevel: quote.maxLevel },
    };
  }
  return {
    reason: 'prestige_gate',
    detail: {
      facilityType: quote.facilityType,
      level: quote.toLevel,
      prestigeRequired: quote.prestigeRequired,
      prestigeHeld: quote.prestigeHeld,
    },
  };
}

/**
 * The facility levels from the current level up to `toLevel`, each checked
 * against its Prestige_Gate and the maximum level. `atMaxReason` names the
 * Blocked reason when `toLevel` is beyond the facility's maximum (Roster
 * Expansion → `roster_limit`, Storage Facility → `storage_limit`).
 */
export function facilityChain(
  facts: StableFacts,
  facilityType: FacilityType,
  toLevel: number,
  atMaxReason: BlockedReason = 'max_level',
): ChainResult<FacilityLevelStep> {
  const steps: FacilityLevelStep[] = [];
  let cost = 0;
  for (let level = facts.facilities[facilityType]; level < toLevel; level++) {
    const quote = quoteFacilityLevel(facilityType, level, facts.prestige);
    if (quote.kind !== 'available') {
      const blocked = blockedFromQuote(quote);
      return { kind: 'blocked', reason: quote.kind === 'max_level' ? atMaxReason : blocked.reason, detail: blocked.detail };
    }
    steps.push({ kind: 'facility_upgrade', facilityType, toLevel: quote.toLevel, cost: quote.cost });
    cost += quote.cost;
  }
  return { kind: 'ok', steps, cost };
}

/** Catalogue weapon by name; a name missing from the catalogue fails the turn (R7.8). */
export function weaponByName(ctx: Pick<GoalContext, 'weapons'>, weaponName: string): WeaponFacts {
  const weapon = ctx.weapons.get(weaponName);
  if (!weapon) {
    throw new AutomatonError(
      AutomatonErrorCode.AUTOMATON_WEAPON_UNKNOWN,
      `Weapon "${weaponName}" is not in the weapon catalogue`,
      500,
      { weaponName },
    );
  }
  return weapon;
}

/** The hands a Weapon_Stage fills, main first. */
export function stageHands(stage: WeaponStage): { hand: Hand; weaponName: string }[] {
  const hands: { hand: Hand; weaponName: string }[] = [{ hand: 'main', weaponName: stage.main }];
  if (stage.offhand !== undefined) hands.push({ hand: 'offhand', weaponName: stage.offhand });
  return hands;
}

/** Unequipped inventory items, excluding `reserved`, in inventory id order. */
export function unequippedItems(facts: StableFacts, reserved: ReadonlySet<number> = new Set()): InventoryFacts[] {
  const equipped = equippedInventoryIds(facts);
  return facts.inventory
    .filter((item) => !equipped.has(item.inventoryId) && !reserved.has(item.inventoryId))
    .sort((a, b) => a.inventoryId - b.inventoryId);
}

/**
 * Weapon_Reuse: take an item named `weaponName` from `pool` (removing it), the
 * one with the most refinements first, then the lowest inventory id.
 */
export function takeReusable(pool: InventoryFacts[], weaponName: string): InventoryFacts | null {
  let bestIndex = -1;
  for (let i = 0; i < pool.length; i++) {
    const item = pool[i];
    if (item.weaponName !== weaponName) continue;
    if (bestIndex === -1) { bestIndex = i; continue; }
    const best = pool[bestIndex];
    if (item.refinements.length > best.refinements.length
      || (item.refinements.length === best.refinements.length && item.inventoryId < best.inventoryId)) {
      bestIndex = i;
    }
  }
  if (bestIndex === -1) return null;
  const [taken] = pool.splice(bestIndex, 1);
  return taken;
}

/**
 * Whether `weaponName` is still on some Weapon_Path of the stable at a stage
 * at or above the current stage of that blueprint's robot (stage 0 for a
 * blueprint not yet built or a robot that matches no stage).
 */
function isStillOnAPath(facts: StableFacts, blueprints: readonly BlueprintFacts[], weaponName: string): boolean {
  return blueprints.some((blueprint) => {
    const robot = facts.robots.find((r) => r.blueprintId === blueprint.blueprintId);
    const fromStage = robot ? Math.max(0, robot.stageIndex) : 0;
    return blueprint.weaponPath
      .slice(fromStage)
      .some((stage) => stage.main === weaponName || stage.offhand === weaponName);
  });
}

/**
 * Storage_Overflow_Rule (design §8.6 item 2): room for `purchases` new items.
 * Sells unequipped, unreserved items first — those on no Weapon_Path first,
 * then the lowest resale value, ties oldest — and plans a Storage Facility
 * level only when nothing unequipped is left. Sale proceeds are not part of
 * the cost.
 */
export function planStorageRoom(
  facts: StableFacts,
  blueprints: readonly BlueprintFacts[],
  purchases: number,
  reserved: ReadonlySet<number>,
): ChainResult<WeaponSaleStep | (FacilityLevelStep & { facilityType: 'storage_facility' })> {
  let needed = purchases - (storageCapacityOf(facts) - facts.inventory.length);
  if (needed <= 0) return { kind: 'ok', steps: [], cost: 0 };

  const workshopLevel = facts.facilities.weapons_workshop;
  const candidates = unequippedItems(facts, reserved)
    .map((item) => ({
      item,
      onPath: isStillOnAPath(facts, blueprints, item.weaponName) ? 1 : 0,
      resale: weaponResaleValue(item.pricePaid, workshopLevel),
    }))
    .sort((a, b) => a.onPath - b.onPath
      || a.resale - b.resale
      || a.item.createdAtMs - b.item.createdAtMs
      || a.item.inventoryId - b.item.inventoryId);

  const steps: (WeaponSaleStep | (FacilityLevelStep & { facilityType: 'storage_facility' }))[] = [];
  for (const candidate of candidates) {
    if (needed <= 0) break;
    steps.push({ kind: 'weapon_sale', inventoryId: candidate.item.inventoryId, proceeds: candidate.resale });
    needed--;
  }

  let cost = 0;
  let level = facts.facilities.storage_facility;
  while (needed > 0) {
    const quote = quoteFacilityLevel('storage_facility', level, facts.prestige);
    if (quote.kind !== 'available') {
      const blocked = blockedFromQuote(quote);
      return { kind: 'blocked', reason: quote.kind === 'max_level' ? 'storage_limit' : blocked.reason, detail: blocked.detail };
    }
    steps.push({ kind: 'facility_upgrade', facilityType: 'storage_facility', toLevel: quote.toLevel, cost: quote.cost });
    cost += quote.cost;
    needed -= calculateStorageCapacity(quote.toLevel) - calculateStorageCapacity(level);
    level = quote.toLevel;
  }
  return { kind: 'ok', steps, cost };
}

/** Whether the robot's loadout and hands already hold the stage's weapons. */
export function handHoldsWeapon(facts: StableFacts, inventoryId: number | null, weaponName: string): boolean {
  if (inventoryId === null) return false;
  return facts.inventory.some((item) => item.inventoryId === inventoryId && item.weaponName === weaponName);
}
