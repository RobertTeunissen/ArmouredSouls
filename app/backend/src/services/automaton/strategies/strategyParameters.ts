/**
 * Strategy_Parameters (Spec #55, R6.3, R6.4, design §14.0, task 3.7).
 *
 * Strategy_Parameters are a map from Goal id to Goal_Target. The schema is
 * generated per Strategy_Version from its Build_Order bounds, so an admin can
 * change targets but never the order or the set of Goals (R6.3). The
 * descriptors feed the Library, Editor and Builder panels so the frontend
 * repeats no rule.
 */
import { z } from 'zod';
import type { StrategyParametersV1 } from '../../../types/automaton';
import { facilityLabel } from './strategyDefinitionSchema';
import type { GoalSpec, GoalType, TargetBounds } from './strategyTypes';
import type { FacilityType } from '../stableFacts';

function targetSchema(spec: GoalSpec): z.ZodNumber {
  const message = spec.isMax ? 'Allowed: Max' : `Allowed ${spec.bounds.min}–${spec.bounds.max}`;
  return z.number({ message })
    .int(message)
    .min(spec.bounds.min, message)
    .max(spec.bounds.max, message);
}

/**
 * Zod schema of the Strategy_Parameters of one Build_Order: every Goal id is
 * required, unknown ids are rejected, each target is a whole number within its
 * bounds (`Max` is stored as 50).
 */
export function buildParameterSchema(buildOrder: readonly GoalSpec[]): z.ZodType<StrategyParametersV1> {
  const shape: Record<string, z.ZodNumber> = {};
  for (const spec of buildOrder) shape[spec.id] = targetSchema(spec);
  return z.object({ targets: z.object(shape).strict() }).strict();
}

/** Strategy_Parameters holding every Goal's default target. */
export function defaultParameters(buildOrder: readonly GoalSpec[]): StrategyParametersV1 {
  const targets: Record<string, number> = {};
  for (const spec of buildOrder) targets[spec.id] = spec.defaultTarget;
  return { targets };
}

/** A Goal's Goal_Target: the stored value, or the strategy default when absent. */
export function resolveGoalTarget(spec: Pick<GoalSpec, 'id' | 'defaultTarget'>, params: StrategyParametersV1): number {
  return params.targets[spec.id] ?? spec.defaultTarget;
}

/** The highest robots Goal_Target of a Build_Order (a stable's robot target), or null without a robots Goal. */
export function highestRobotsTarget(buildOrder: readonly GoalSpec[], params: StrategyParametersV1): number | null {
  const targets = buildOrder.filter((spec) => spec.type === 'robots').map((spec) => resolveGoalTarget(spec, params));
  return targets.length > 0 ? Math.max(...targets) : null;
}

/** What a Goal buys (the Build_Order "What it buys" column). */
function buysText(type: GoalType, facilityType: FacilityType | undefined, isMax: boolean): string {
  switch (type) {
    case 'robots':
      return 'Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons';
    case 'attributes':
      return isMax
        ? 'Every attribute of every robot to 50, in Build Focus order, plus every academy level up to L10'
        : 'Attribute upgrades plus the academy levels the target needs';
    case 'weapons':
      return 'Each robot\'s weapons up to the target stage, plus room in storage';
    case 'refine':
      return 'Refinement plan steps of every robot up to the target, plus the Weapons Workshop level each step needs';
    case 'facility': {
      const label = facilityType ? facilityLabel(facilityType) : 'Facility';
      return facilityType === 'booking_office'
        ? `${label} levels up to the target; never above the useful level`
        : `${label} levels up to the target`;
    }
  }
}

export interface BuildOrderDescriptor {
  position: number;
  goalId: string;
  type: GoalType;
  facilityType?: FacilityType;
  /** "Robots", "Booking Office", "Attributes", "Weapons", "Refine". */
  label: string;
  defaultTarget: number;
  bounds: TargetBounds;
  isMax: boolean;
  /** What the Goal buys, including its Goal_Chain. */
  buys: string;
}

/** Numbered Build_Order descriptors for the admin panels (R6.3, R6.9). */
export function describeBuildOrder(buildOrder: readonly GoalSpec[]): BuildOrderDescriptor[] {
  return buildOrder.map((spec) => ({
    position: spec.position,
    goalId: spec.id,
    type: spec.type,
    ...(spec.facilityType ? { facilityType: spec.facilityType } : {}),
    label: spec.type === 'facility' && spec.facilityType
      ? facilityLabel(spec.facilityType)
      : spec.type.charAt(0).toUpperCase() + spec.type.slice(1),
    defaultTarget: spec.defaultTarget,
    bounds: { ...spec.bounds },
    isMax: spec.isMax,
    buys: buysText(spec.type, spec.facilityType, spec.isMax),
  }));
}
