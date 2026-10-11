/**
 * Weapons → stage k Goal (Spec #55, R3.11, R5.5, design §8.6).
 *
 * The next robot in Blueprint_Slot order whose `stageIndex` is below
 * `min(target, last stage)` moves one stage up (from −1 to 0 after a loadout
 * or Weapon_Path edit). Per hand: a hand already holding the stage's weapon
 * keeps it; otherwise Weapon_Reuse equips an unequipped item of that name and
 * only a missing weapon is bought. Replaced weapons stay in storage; room for
 * purchases follows the Storage_Overflow_Rule.
 *
 * Step order: sales → storage levels → purchases → (loadout change: unequip
 * the hands that change, change loadout) → equip main → equip offhand.
 */
import { discountedWeaponPrice } from '../pricing';
import type { Hand, RobotFacts, StableFacts } from '../stableFacts';
import type { BlueprintFacts } from '../stableFacts';
import {
  handHoldsWeapon,
  planStorageRoom,
  stageHands,
  takeReusable,
  unequippedItems,
  weaponByName,
} from './goalSupport';
import { savingOrActionable, type Goal, type GoalContext, type GoalOutcome, type StageStep } from './goalTypes';

function currentInventoryId(robot: RobotFacts, hand: Hand): number | null {
  return hand === 'main' ? robot.mainInventoryId : robot.offhandInventoryId;
}

/** The final stage index of a blueprint's Weapon_Path. */
export function finalStageIndex(blueprint: BlueprintFacts): number {
  return blueprint.weaponPath.length - 1;
}

/** Create the Goal "Weapons → stage k" (a target above the path length means "final"). */
export function createWeaponStageGoal(id: string): Goal {
  return {
    id,
    evaluate(facts: StableFacts, ctx: GoalContext): GoalOutcome {
      for (const robot of facts.robots) {
        const blueprint = ctx.blueprints.find((b) => b.blueprintId === robot.blueprintId);
        if (!blueprint) continue;
        const goalStage = Math.min(ctx.target, finalStageIndex(blueprint));
        if (robot.stageIndex >= goalStage) continue;

        const toStage = robot.stageIndex + 1;
        const stage = blueprint.weaponPath[toStage];
        const loadoutChanges = robot.loadoutType !== blueprint.loadoutType;
        const pool = unequippedItems(facts);
        const reserved = new Set<number>();
        const purchases: StageStep[] = [];
        const equips: StageStep[] = [];
        const changingHands: Hand[] = [];
        const workshopLevel = facts.facilities.weapons_workshop;

        for (const { hand, weaponName } of stageHands(stage)) {
          if (handHoldsWeapon(facts, currentInventoryId(robot, hand), weaponName)) continue;
          changingHands.push(hand);
          const reused = takeReusable(pool, weaponName);
          if (reused) {
            reserved.add(reused.inventoryId);
            equips.push({ kind: 'equip', hand, weaponName, source: { kind: 'inventory', inventoryId: reused.inventoryId } });
          } else {
            const cost = discountedWeaponPrice(weaponByName(ctx, weaponName).cost, workshopLevel);
            purchases.push({ kind: 'weapon_purchase', weaponName, hand, cost });
            equips.push({ kind: 'equip', hand, weaponName, source: { kind: 'purchase' } });
          }
        }

        const storage = planStorageRoom(facts, ctx.blueprints, purchases.length, reserved);
        if (storage.kind === 'blocked') {
          return { kind: 'blocked', goalId: id, reason: storage.reason, detail: { ...storage.detail, robotSlot: robot.slotIndex } };
        }

        // A stage without an off-hand weapon frees the off hand.
        const unequipHands: Hand[] = [];
        if (stage.offhand === undefined && robot.offhandInventoryId !== null) unequipHands.push('offhand');
        if (loadoutChanges) {
          for (const hand of changingHands) {
            if (currentInventoryId(robot, hand) !== null && !unequipHands.includes(hand)) unequipHands.push(hand);
          }
          unequipHands.sort((a, b) => (a === b ? 0 : a === 'main' ? -1 : 1));
        }

        const steps: StageStep[] = [
          ...storage.steps,
          ...purchases,
          ...unequipHands.map((hand): StageStep => ({ kind: 'unequip', hand })),
          ...(loadoutChanges ? [{ kind: 'loadout_change', loadoutType: blueprint.loadoutType } as StageStep] : []),
          ...equips,
        ];
        const purchaseCost = purchases.reduce((sum, step) => sum + (step.kind === 'weapon_purchase' ? step.cost : 0), 0);
        const cost = storage.cost + purchaseCost;
        return savingOrActionable(
          id,
          { kind: 'weapon_stage', robotSlot: robot.slotIndex, toStage, steps },
          cost,
          ctx.balance,
          { robotSlot: robot.slotIndex, toStage },
        );
      }
      return { kind: 'satisfied', goalId: id };
    },
  };
}
