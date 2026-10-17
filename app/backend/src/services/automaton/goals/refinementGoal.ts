/**
 * Refine → N plan steps Goal (Spec #55, R3.11, R5.2, R5.4, design §8.2,
 * §8.6 item 7).
 *
 * The Goal_Target counts Refinement_Plan steps per robot (0–10). Applied steps
 * are counted per weapon by number, not by content: a hand's first `count`
 * plan steps are done, where `count` is the number of refinement rows on the
 * equipped item. A step the shared validators reject on the current weapon
 * counts as done, so it can never become Actionable. Across robots the Goal
 * takes the next within-target step of the first robot (slot order) that is
 * on its final stage and whose Refinement Lab level is not prestige-gated;
 * it is Blocked only when every remaining within-target step is skipped.
 */
import {
  validateAttributeOnWeapon,
  validateAttributeStackCap,
  validateRefinementSlotAvailable,
  validateShieldCompatibility,
  type RefinementRow,
} from '../../../shared/utils/weaponRefinement';
import { refinementLabLevelForTier, refinementStepCost } from '../pricing';
import { inventoryItem, type Hand, type InventoryFacts, type RobotFacts, type StableFacts } from '../stableFacts';
import type { RefinementStep } from '../../../types/automaton';
import { facilityChain, weaponByName } from './goalSupport';
import { finalStageIndex } from './weaponStageGoal';
import {
  savingOrActionable,
  type BlockedReason,
  type Goal,
  type GoalContext,
  type GoalDetail,
  type GoalOutcome,
} from './goalTypes';

/** Most Refinement_Plan steps a robot can have (5 per weapon, two weapons). */
export const MAX_REFINE_STEPS = 10;

export type NextRefinement =
  | { kind: 'done' }
  | { kind: 'step'; step: RefinementStep; item: InventoryFacts; existingInstancesOfTier: number };

function stepIsApplicable(step: RefinementStep, rows: readonly RefinementRow[], weaponType: string, catalogueBonus: number): boolean {
  if (!validateRefinementSlotAvailable(rows, step.tier).ok) return false;
  if (!validateShieldCompatibility(weaponType, step.tier).ok) return false;
  if (step.tier === 'hone' || step.tier === 'augment') {
    if (step.targetAttribute === undefined) return false;
    if (!validateAttributeOnWeapon(catalogueBonus, rows, step.targetAttribute, step.tier).ok) return false;
    if (!validateAttributeStackCap(catalogueBonus, rows, step.targetAttribute, step.magnitude).ok) return false;
  }
  return true;
}

/**
 * The robot's next not-done step among the first `withinTarget` plan steps,
 * for a robot on its final stage (design §8.6 item 7).
 */
export function nextRefinementStep(
  facts: StableFacts,
  ctx: GoalContext,
  robot: RobotFacts,
  plan: readonly RefinementStep[],
  withinTarget: number,
): NextRefinement {
  const items: Record<Hand, InventoryFacts | undefined> = {
    main: inventoryItem(facts, robot.mainInventoryId),
    offhand: inventoryItem(facts, robot.offhandInventoryId),
  };
  const seenPerHand: Record<Hand, number> = { main: 0, offhand: 0 };

  for (const step of plan.slice(0, withinTarget)) {
    const handIndex = seenPerHand[step.hand]++;
    const item = items[step.hand];
    // No weapon in that hand: nothing can be applied, so the step counts as done.
    if (!item) continue;
    if (handIndex < item.refinements.length) continue;

    const weapon = weaponByName(ctx, item.weaponName);
    const catalogueBonus = step.targetAttribute !== undefined ? weapon.bonuses[step.targetAttribute] ?? 0 : 0;
    if (!stepIsApplicable(step, item.refinements, weapon.weaponType, catalogueBonus)) continue;

    return {
      kind: 'step',
      step,
      item,
      existingInstancesOfTier: item.refinements.filter((r) => r.tier === step.tier).length,
    };
  }
  return { kind: 'done' };
}

/** Create the Goal "Refine → N steps". */
export function createRefinementGoal(id: string): Goal {
  return {
    id,
    evaluate(facts: StableFacts, ctx: GoalContext): GoalOutcome {
      if (ctx.target <= 0) return { kind: 'satisfied', goalId: id };
      let firstSkip: { reason: BlockedReason; detail: GoalDetail } | null = null;

      for (const robot of facts.robots) {
        const blueprint = ctx.blueprints.find((b) => b.blueprintId === robot.blueprintId);
        if (!blueprint) continue;
        const withinTarget = Math.min(ctx.target, blueprint.refinementPlan.length);
        if (withinTarget === 0) continue;

        if (robot.stageIndex !== finalStageIndex(blueprint)) {
          firstSkip ??= {
            reason: 'awaiting_final_weapon',
            detail: { robotSlot: robot.slotIndex, stageIndex: robot.stageIndex, finalStage: finalStageIndex(blueprint) },
          };
          continue;
        }

        const next = nextRefinementStep(facts, ctx, robot, blueprint.refinementPlan, withinTarget);
        if (next.kind === 'done') continue;

        const chain = facilityChain(facts, 'refinement_lab', refinementLabLevelForTier(next.step.tier));
        if (chain.kind === 'blocked') {
          firstSkip ??= { reason: chain.reason, detail: { ...chain.detail, robotSlot: robot.slotIndex } };
          continue;
        }

        const refinementCost = refinementStepCost(next.step.tier, next.step.magnitude, next.existingInstancesOfTier);
        return savingOrActionable(
          id,
          {
            kind: 'weapon_refinement',
            robotSlot: robot.slotIndex,
            inventoryId: next.item.inventoryId,
            step: next.step,
            chain: chain.steps,
            refinementCost,
          },
          refinementCost + chain.cost,
          ctx.balance,
          { robotSlot: robot.slotIndex, tier: next.step.tier, hand: next.step.hand },
        );
      }

      if (firstSkip) return { kind: 'blocked', goalId: id, reason: firstSkip.reason, detail: firstSkip.detail };
      return { kind: 'satisfied', goalId: id };
    },
  };
}
