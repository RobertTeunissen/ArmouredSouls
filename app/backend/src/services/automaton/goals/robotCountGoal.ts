/**
 * Robots → N Goal and its Robot_Chain (Spec #55, R3.7, R3.9, R5.2, R5.4,
 * design §8.5, §9.1–§9.2).
 *
 * One evaluation plans the whole chain for the next Blueprint_Slot: missing
 * Roster Expansion levels, room in storage for the starting weapons
 * (Storage_Overflow_Rule), the robot and its fit-out. The chain is one step:
 * Blocked if any part is Blocked, Saving if its total cost exceeds the
 * balance, otherwise Actionable.
 */
import { discountedWeaponPrice, robotPurchaseCost } from '../pricing';
import { chooseRobotName } from '../robotNaming';
import { blueprintForSlot, type Hand, type InventoryFacts, type StableFacts } from '../stableFacts';
import type { WeaponStage } from '../../../types/automaton';
import {
  facilityChain,
  planStorageRoom,
  stageHands,
  takeReusable,
  unequippedItems,
  weaponByName,
} from './goalSupport';
import {
  savingOrActionable,
  type ChainStep,
  type EquipSource,
  type Goal,
  type GoalContext,
  type GoalOutcome,
  type WeaponPurchasePart,
} from './goalTypes';

/** Most robots a stable can own (Roster Expansion L10). */
export const MAX_ROBOTS = 11;

interface StartingStagePlan {
  stageIndex: number;
  equip: { hand: Hand; weaponName: string; source: EquipSource }[];
  reusedIds: Set<number>;
  toBuy: { hand: Hand; weaponName: string }[];
}

function planStageFromPool(stage: WeaponStage, stageIndex: number, pool: InventoryFacts[]): StartingStagePlan {
  const equip: StartingStagePlan['equip'] = [];
  const reusedIds = new Set<number>();
  const toBuy: StartingStagePlan['toBuy'] = [];
  for (const { hand, weaponName } of stageHands(stage)) {
    const reused = takeReusable(pool, weaponName);
    if (reused) {
      reusedIds.add(reused.inventoryId);
      equip.push({ hand, weaponName, source: { kind: 'inventory', inventoryId: reused.inventoryId } });
    } else {
      toBuy.push({ hand, weaponName });
      equip.push({ hand, weaponName, source: { kind: 'purchase' } });
    }
  }
  return { stageIndex, equip, reusedIds, toBuy };
}

/**
 * Starting stage (design §8.5 step 2): the highest stage of the path that
 * Weapon_Reuse fills for every hand from unequipped inventory; otherwise
 * stage 0, reusing what it can per hand.
 */
export function planStartingStage(facts: StableFacts, weaponPath: readonly WeaponStage[]): StartingStagePlan {
  for (let stageIndex = weaponPath.length - 1; stageIndex > 0; stageIndex--) {
    const plan = planStageFromPool(weaponPath[stageIndex], stageIndex, unequippedItems(facts));
    if (plan.toBuy.length === 0) return plan;
  }
  return planStageFromPool(weaponPath[0], 0, unequippedItems(facts));
}

/** Lowest Blueprint_Slot without a live robot (k + 1 for contiguous slots). */
function nextFreeSlot(facts: StableFacts): number {
  const used = new Set(facts.robots.map((r) => r.slotIndex));
  let slot = 1;
  while (used.has(slot)) slot++;
  return slot;
}

/** Create the Goal "Robots → N". */
export function createRobotCountGoal(id: string): Goal {
  return {
    id,
    evaluate(facts: StableFacts, ctx: GoalContext): GoalOutcome {
      const liveRobots = facts.robots.length;
      if (liveRobots >= ctx.target) return { kind: 'satisfied', goalId: id };

      if (liveRobots >= MAX_ROBOTS) {
        return { kind: 'blocked', goalId: id, reason: 'roster_limit', detail: { robots: liveRobots, maxRobots: MAX_ROBOTS } };
      }
      const slotIndex = nextFreeSlot(facts);
      const blueprint = blueprintForSlot(ctx.blueprints, slotIndex);
      if (!blueprint) {
        return { kind: 'blocked', goalId: id, reason: 'no_blueprint', detail: { slotIndex } };
      }

      // Roster capacity k + 1 means roster_expansion level k.
      const roster = facilityChain(facts, 'roster_expansion', liveRobots, 'roster_limit');
      if (roster.kind === 'blocked') return { kind: 'blocked', goalId: id, reason: roster.reason, detail: roster.detail };

      const starting = planStartingStage(facts, blueprint.weaponPath);
      const workshopLevel = facts.facilities.weapons_workshop;
      const purchases: WeaponPurchasePart[] = starting.toBuy.map(({ hand, weaponName }) => ({
        hand,
        weaponName,
        cost: discountedWeaponPrice(weaponByName(ctx, weaponName).cost, workshopLevel),
      }));

      const storage = planStorageRoom(facts, ctx.blueprints, purchases.length, starting.reusedIds);
      if (storage.kind === 'blocked') return { kind: 'blocked', goalId: id, reason: storage.reason, detail: storage.detail };

      const robotName = chooseRobotName(blueprint.robotName, new Set(facts.takenRobotNames));
      if (robotName === null) {
        return { kind: 'blocked', goalId: id, reason: 'name_unavailable', detail: { slotIndex, robotName: blueprint.robotName } };
      }

      const robotCost = robotPurchaseCost();
      const purchaseCost = purchases.reduce((sum, p) => sum + p.cost, 0);
      const steps: ChainStep[] = [
        ...roster.steps.map((step) => ({ ...step, facilityType: 'roster_expansion' as const })),
        ...storage.steps,
        { kind: 'robot_purchase', robotName, cost: robotCost },
        {
          kind: 'fitout',
          stageIndex: starting.stageIndex,
          loadoutType: blueprint.loadoutType,
          equip: starting.equip,
          purchases,
        },
      ];
      const cost = roster.cost + storage.cost + robotCost + purchaseCost;
      return savingOrActionable(id, { kind: 'robot_chain', slotIndex, steps }, cost, ctx.balance, { slotIndex });
    },
  };
}
