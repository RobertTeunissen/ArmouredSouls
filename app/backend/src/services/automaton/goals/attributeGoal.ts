/**
 * Attributes → level / Max Goal (Spec #55, R4.2–R4.4, R5.2, design §8.4).
 *
 * One Goal covers every Attribute_Group and buys the academy levels it needs
 * (Goal_Chain). The selection itself lives in `buildFocus.ts`; this Goal
 * supplies the facts, prices and gates. The Training Facility is never a
 * prerequisite.
 */
import {
  ATTRIBUTE_GROUPS,
  GROUP_ACADEMY,
  planAttributeStep,
  type AcademyQuote,
  type AttributePlanRobot,
  type BuildFocusWeightTable,
} from '../buildFocus';
import { attributeIncrementCost, quoteFacilityLevel } from '../pricing';
import { rosterCapacityOf, type StableFacts } from '../stableFacts';
import type { AttributeGroup } from '../../../types/automaton';
import { blockedFromQuote } from './goalSupport';
import { savingOrActionable, type Goal, type GoalContext, type GoalOutcome } from './goalTypes';

export interface AttributeGoalOptions {
  /** The Goal_Target is `Max` (every attribute to 50). */
  isMax: boolean;
  /** Build_Focus group weights per preset. */
  weightTable: BuildFocusWeightTable;
}

/** Create the Goal "Attributes → L" (or "→ Max"). */
export function createAttributeGoal(id: string, options: AttributeGoalOptions): Goal {
  return {
    id,
    evaluate(facts: StableFacts, ctx: GoalContext): GoalOutcome {
      const robots: AttributePlanRobot[] = [];
      for (const robot of facts.robots) {
        const blueprint = ctx.blueprints.find((b) => b.blueprintId === robot.blueprintId);
        if (!blueprint) continue;
        robots.push({ slotIndex: robot.slotIndex, attributes: robot.attributes, weights: options.weightTable[blueprint.buildFocus] });
      }
      const academyLevels = Object.fromEntries(
        ATTRIBUTE_GROUPS.map((group) => [group, facts.facilities[GROUP_ACADEMY[group]]]),
      ) as Record<AttributeGroup, number>;
      const trainingLevel = facts.facilities.training_facility;
      const rosterCapacity = rosterCapacityOf(facts);

      const plan = planAttributeStep({
        robots,
        milestone: ctx.target,
        isMax: options.isMax,
        academyLevels,
        quoteAcademy(group, currentLevel): AcademyQuote {
          const quote = quoteFacilityLevel(GROUP_ACADEMY[group], currentLevel, facts.prestige);
          if (quote.kind === 'available') return { kind: 'available', cost: quote.cost };
          return { kind: 'unavailable', detail: blockedFromQuote(quote).detail };
        },
        incrementCost: (fromLevel) => attributeIncrementCost(fromLevel, fromLevel + 1, trainingLevel, rosterCapacity),
        balance: ctx.balance,
      });

      switch (plan.kind) {
        case 'satisfied':
          return { kind: 'satisfied', goalId: id };
        case 'blocked':
          return { kind: 'blocked', goalId: id, reason: 'prestige_gate', detail: { ...plan.detail, group: plan.group } };
        case 'saving': {
          const detail: Record<string, number | string> = { next: plan.next };
          if (plan.robotSlot !== undefined) detail.robotSlot = plan.robotSlot;
          if (plan.attribute !== undefined) detail.attribute = plan.attribute;
          if (plan.group !== undefined) detail.group = plan.group;
          return { kind: 'saving', goalId: id, cost: plan.cost, detail };
        }
        case 'academy':
          return savingOrActionable(
            id,
            { kind: 'facility_upgrade', facilityType: GROUP_ACADEMY[plan.group], toLevel: plan.toLevel, cost: plan.cost },
            plan.cost,
            ctx.balance,
          );
        case 'increments':
          return savingOrActionable(
            id,
            { kind: 'attribute_upgrade', robotSlot: plan.robotSlot, increments: plan.increments, cost: plan.cost },
            plan.cost,
            ctx.balance,
          );
      }
    },
  };
}
