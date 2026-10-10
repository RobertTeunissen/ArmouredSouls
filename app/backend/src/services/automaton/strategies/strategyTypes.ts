/**
 * Strategy layer types (Spec #55, design §14.0).
 *
 * A Strategy_Definition_File is data; `registry.ts` interprets it into an
 * UpgradeStrategy whose Build_Order holds one Goal (from the Goal_Library) per
 * entry. Shared by the registry, the planner, the parameter schema and the
 * target migration so none of them import each other for types.
 */
import type { z } from 'zod';
import type { StrategyParametersV1 } from '../../../types/automaton';
import type { Goal } from '../goals/goalTypes';
import type { FacilityType } from '../stableFacts';

/** Goal_Library types a Build_Order entry can reference. */
export const GOAL_TYPES = ['robots', 'facility', 'attributes', 'weapons', 'refine'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/** A target as written in a Strategy_Definition_File: a number, or `"max"` (attributes only). */
export type FileTargetValue = number | 'max';

/** The `goal` of a Build_Order entry. */
export type FileGoalReference =
  | { type: 'robots' }
  | { type: 'facility'; facilityType: FacilityType }
  | { type: 'attributes' }
  | { type: 'weapons' }
  | { type: 'refine' };

export interface FileBuildOrderEntry {
  position: number;
  goal: FileGoalReference;
  defaultTarget: FileTargetValue;
  bounds: { min: FileTargetValue; max: FileTargetValue };
}

/** One Strategy_Definition_File (`config/automaton-strategies/{key}.v{version}.json`). */
export interface StrategyDefinitionFile {
  schemaVersion: 1;
  key: string;
  version: number;
  displayName: string;
  description: string;
  buildOrder: FileBuildOrderEntry[];
}

/** Numeric Goal_Target bounds; a `Max` attributes Goal stores 50..50. */
export interface TargetBounds {
  min: number;
  max: number;
}

/** A Build_Order entry with its derived id and numeric targets (no Goal instance). */
export interface GoalSpec {
  /** `{key}.v{version}.{position:02}.{type}[.{facilityType}]`. */
  id: string;
  position: number;
  type: GoalType;
  facilityType?: FacilityType;
  defaultTarget: number;
  bounds: TargetBounds;
  /** The Goal_Target is `Max` (stored as 50). */
  isMax: boolean;
}

/** A GoalSpec with its Goal_Library instance. */
export interface GoalDefinition extends GoalSpec {
  goal: Goal;
}

/** One interpreted Strategy_Version in the Strategy_Registry. */
export interface UpgradeStrategy {
  key: string;
  version: number;
  displayName: string;
  description: string;
  buildOrder: readonly GoalDefinition[];
  /** Generated from the Build_Order bounds (`strategyParameters.ts`). */
  parameterSchema: z.ZodType<StrategyParametersV1>;
  /** The validated file this version was built from. */
  definition: StrategyDefinitionFile;
}
