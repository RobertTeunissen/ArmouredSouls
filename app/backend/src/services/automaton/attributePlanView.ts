/**
 * Attributes plan of the Editor's Build order panel (Spec #55, R11.10,
 * PLAYER_FACING_TEXT §6.5 "Show plan / Hide plan", task 10.3).
 *
 * For an attributes Goal: per robot, the Attribute_Groups in Build_Focus
 * priority order with the target each group reaches at the Goal's milestone
 * and the academy level that target needs; plus the academy levels the stable
 * still has to buy on the way. Pure: the Build_Focus maths of `buildFocus.ts`,
 * no reads.
 */
import type { AttributeGroup, BuildFocusKey } from '../../types/automaton';
import {
  ATTRIBUTE_GROUPS,
  BUILD_FOCUS_PRESETS,
  GROUP_ACADEMY,
  academyLevelForTarget,
  groupTargets,
  priorityOrder,
  type BuildFocusWeightTable,
} from './buildFocus';
import type { FacilityType } from './stableFacts';

export interface AttributePlanGroup {
  group: AttributeGroup;
  target: number;
  /** Academy level the target needs (0 = none). */
  academyLevel: number;
  /** This robot is the first in the plan that needs an academy level the stable lacks ("▸ academy bought on the way"). */
  buysAcademy: boolean;
}

export interface AttributePlanRobotView {
  slot: number;
  robotName: string;
  buildFocus: BuildFocusKey;
  groups: AttributePlanGroup[];
}

export interface AttributePlanView {
  goalId: string;
  robots: AttributePlanRobotView[];
  /** Academy levels bought on the way, in group order (Combat, Defense, Mobility, AI). */
  academies: { group: AttributeGroup; level: number }[];
}

export interface AttributePlanSubject {
  slot: number;
  robotName: string;
  buildFocus: BuildFocusKey;
}

/** One attributes Goal's plan for the given robots and current academy levels. */
export function attributePlanView(
  goal: { goalId: string; target: number; isMax: boolean },
  robots: readonly AttributePlanSubject[],
  academyLevels: Readonly<Partial<Record<FacilityType, number>>>,
  weights: BuildFocusWeightTable,
): AttributePlanView {
  const held = new Map<AttributeGroup, number>(ATTRIBUTE_GROUPS.map((g) => [g, academyLevels[GROUP_ACADEMY[g]] ?? 0]));
  const bought = new Map<AttributeGroup, number>(held);
  const robotViews = robots.map((robot): AttributePlanRobotView => {
    const robotWeights = weights[robot.buildFocus];
    const targets = groupTargets(robotWeights, goal.target, goal.isMax);
    return {
      slot: robot.slot,
      robotName: robot.robotName,
      buildFocus: robot.buildFocus,
      groups: priorityOrder(robotWeights).map((group): AttributePlanGroup => {
        const academyLevel = academyLevelForTarget(targets[group]);
        const buysAcademy = academyLevel > (bought.get(group) ?? 0);
        if (buysAcademy) bought.set(group, academyLevel);
        return { group, target: targets[group], academyLevel, buysAcademy };
      }),
    };
  });
  const academies = ATTRIBUTE_GROUPS
    .filter((group) => (bought.get(group) ?? 0) > (held.get(group) ?? 0))
    .map((group) => ({ group, level: bought.get(group) ?? 0 }));
  return { goalId: goal.goalId, robots: robotViews, academies };
}

/** Build_Focus options of the blueprint editor (admin-only names and descriptions). */
export function buildFocusOptions(): { key: BuildFocusKey; displayName: string; description: string }[] {
  return BUILD_FOCUS_PRESETS.map((preset) => ({ key: preset.key, displayName: preset.displayName, description: preset.description }));
}
