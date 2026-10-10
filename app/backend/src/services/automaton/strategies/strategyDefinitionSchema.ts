/**
 * Strategy_Definition_File schema and builder rules (Spec #55, R6.2, R6.11,
 * design §14.0, §14.0b, task 3.7).
 *
 * One Zod schema validates the file structure; the builder rules run inside
 * it (`superRefine`), so a hand-edited file is held to the same rules as a
 * Strategy_Draft. The key/version rule needs the registry's latest versions
 * and is checked separately by `checkKeyAndVersion`.
 *
 * Every issue carries a `rule` code and, for a Goal-level issue, the Goal's
 * `position`, so the Strategy_Builder can show it next to the Goal or above
 * the Build_Order (R6.10). Messages use the approved texts of
 * `review/PLAYER_FACING_TEXT.md` §6.4b where one exists.
 */
import { z } from 'zod';
import { getFacilityConfig } from '../../../config/facilities';
import { ATTRIBUTE_MAX_LEVEL } from '../buildFocus';
import { AUTOMATON_FACILITY_TYPES, type FacilityType } from '../stableFacts';
import {
  type FileBuildOrderEntry,
  type FileTargetValue,
  type GoalSpec,
  type GoalType,
  type StrategyDefinitionFile,
} from './strategyTypes';

/** Lowercase letters, digits and hyphens (approved help text, §6.4b). */
export const STRATEGY_KEY_PATTERN = /^[a-z0-9-]+$/;
export const STRATEGY_KEY_MAX_LENGTH = 40;
export const STRATEGY_DISPLAY_NAME_MAX_LENGTH = 60;
export const STRATEGY_DESCRIPTION_MAX_LENGTH = 500;
export const MIN_BUILD_ORDER_GOALS = 1;
export const MAX_BUILD_ORDER_GOALS = 40;

/** Goal_Target limits per Goal type (R6.11). */
export const BOOKING_OFFICE_MAX_TARGET = 6;
export const FACILITY_MAX_TARGET = 10;
export const ROBOTS_MIN_TARGET = 1;
export const ROBOTS_MAX_TARGET = 11;
export const ATTRIBUTES_MIN_TARGET = 1;
export const WEAPONS_MAX_TARGET = 3;
export const REFINE_MAX_TARGET = 10;

/** Academies are bought by attributes Goals (R4.4) and may not be a facility Goal. */
export const ACADEMY_FACILITY_TYPES: readonly FacilityType[] = [
  'combat_training_academy',
  'defense_training_academy',
  'mobility_training_academy',
  'ai_training_academy',
];

/** Facility types every strategy needs a Goal for, with a default above 0 (decision 29). */
export const REQUIRED_FACILITY_TYPES: readonly FacilityType[] = [
  'repair_bay',
  'training_facility',
  'weapons_workshop',
  'booking_office',
  'merchandising_hub',
  'streaming_studio',
  'tuning_bay',
];

/** Non-facility Goal types every strategy needs, with a default above 0. */
export const REQUIRED_GOAL_TYPES: readonly Exclude<GoalType, 'facility'>[] = ['robots', 'attributes', 'weapons', 'refine'];

export type StrategyRule =
  | 'schema'
  | 'goal_count'
  | 'position_sequence'
  | 'bounds_limit'
  | 'bounds_order'
  | 'max_target_type'
  | 'default_out_of_bounds'
  | 'academy_facility_goal'
  | 'robots_goal_first'
  | 'required_goal_type'
  | 'last_goal_attributes_max'
  | 'key_exists'
  | 'version_not_next'
  | 'file_name'
  | 'duplicate_version';

export interface StrategyRuleIssue {
  rule: StrategyRule;
  message: string;
  /** Build_Order position of the Goal the issue belongs to; absent for Build_Order-level issues. */
  position?: number;
  path: (string | number)[];
}

// ── Structure ────────────────────────────────────────────────────────

const targetValueSchema = z.union([z.number().int(), z.literal('max')]);

const goalReferenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('robots') }).strict(),
  z.object({ type: z.literal('facility'), facilityType: z.enum(AUTOMATON_FACILITY_TYPES) }).strict(),
  z.object({ type: z.literal('attributes') }).strict(),
  z.object({ type: z.literal('weapons') }).strict(),
  z.object({ type: z.literal('refine') }).strict(),
]);

/** One Build_Order entry (structure only; the builder rules run over the whole list). */
export const buildOrderEntrySchema = z.object({
  position: z.number().int().min(1),
  goal: goalReferenceSchema,
  defaultTarget: targetValueSchema,
  bounds: z.object({ min: targetValueSchema, max: targetValueSchema }).strict(),
}).strict();

/** A strategy key: lowercase letters, digits and hyphens, at most 40 characters. */
export const strategyKeySchema = z.string().max(STRATEGY_KEY_MAX_LENGTH).regex(STRATEGY_KEY_PATTERN, 'Use lowercase letters, digits and hyphens.');

/** The file structure without the builder rules. */
export const strategyDefinitionShape = z.object({
  schemaVersion: z.literal(1),
  key: strategyKeySchema,
  version: z.number().int().min(1),
  displayName: z.string().trim().min(1).max(STRATEGY_DISPLAY_NAME_MAX_LENGTH),
  description: z.string().trim().min(1).max(STRATEGY_DESCRIPTION_MAX_LENGTH),
  buildOrder: z.array(buildOrderEntrySchema),
}).strict();

// ── Labels ───────────────────────────────────────────────────────────

const GOAL_TYPE_LABELS: Readonly<Record<Exclude<GoalType, 'facility'>, string>> = {
  robots: 'Robots',
  attributes: 'Attributes',
  weapons: 'Weapons',
  refine: 'Refine',
};

/** Display name of a facility type (`config/facilities.ts`). */
export function facilityLabel(facilityType: FacilityType): string {
  return getFacilityConfig(facilityType)?.name ?? facilityType;
}

/** Label of a Goal: "Robots", "Booking Office", "Attributes", … */
export function goalLabel(goal: FileBuildOrderEntry['goal']): string {
  return goal.type === 'facility' ? facilityLabel(goal.facilityType) : GOAL_TYPE_LABELS[goal.type];
}

// ── Builder rules ────────────────────────────────────────────────────

interface TypeLimits {
  min: number;
  max: number;
  allowsMax: boolean;
  message: string;
}

function limitsFor(goal: FileBuildOrderEntry['goal']): TypeLimits {
  switch (goal.type) {
    case 'robots':
      return { min: ROBOTS_MIN_TARGET, max: ROBOTS_MAX_TARGET, allowsMax: false, message: 'Robots allow 1–11.' };
    case 'attributes':
      return { min: ATTRIBUTES_MIN_TARGET, max: ATTRIBUTE_MAX_LEVEL, allowsMax: true, message: 'Attributes allow 1–50 or Max.' };
    case 'weapons':
      return { min: 0, max: WEAPONS_MAX_TARGET, allowsMax: false, message: 'Weapons allow stage 0–3.' };
    case 'refine':
      return { min: 0, max: REFINE_MAX_TARGET, allowsMax: false, message: 'Refine allows 0–10 steps.' };
    case 'facility':
      if (goal.facilityType === 'booking_office') {
        return { min: 0, max: BOOKING_OFFICE_MAX_TARGET, allowsMax: false, message: 'Booking Office cannot go above L6.' };
      }
      return {
        min: 0,
        max: FACILITY_MAX_TARGET,
        allowsMax: false,
        message: `${facilityLabel(goal.facilityType)} cannot go above L${FACILITY_MAX_TARGET}.`,
      };
  }
}

const isMaxValue = (value: FileTargetValue): value is 'max' => value === 'max';

function goalIssues(entry: FileBuildOrderEntry, index: number): StrategyRuleIssue[] {
  const issues: StrategyRuleIssue[] = [];
  const at = (rule: StrategyRule, message: string, ...path: (string | number)[]): void => {
    issues.push({ rule, message, position: entry.position, path: ['buildOrder', index, ...path] });
  };

  if (entry.goal.type === 'facility' && ACADEMY_FACILITY_TYPES.includes(entry.goal.facilityType)) {
    at('academy_facility_goal', 'Academies are bought by attributes goals, not as a facility goal.', 'goal', 'facilityType');
  }

  const limits = limitsFor(entry.goal);
  const { min, max } = entry.bounds;
  const values: [FileTargetValue, string][] = [[min, 'min'], [max, 'max'], [entry.defaultTarget, 'defaultTarget']];
  if (values.some(([value]) => isMaxValue(value))) {
    // "max" exists only as the whole range of an attributes Goal: Max–Max, default Max.
    const allMax = values.every(([value]) => isMaxValue(value));
    if (!limits.allowsMax || !allMax) {
      at('max_target_type', 'Only an attributes goal can target Max, with Max as its whole allowed range.', 'bounds');
    }
    return issues;
  }
  const numericMin = min as number;
  const numericMax = max as number;
  if (numericMin < limits.min || numericMax > limits.max) {
    at('bounds_limit', limits.message, 'bounds');
  }
  if (numericMin > numericMax) {
    at('bounds_order', 'The allowed range is empty: the minimum is above the maximum.', 'bounds');
  }
  const target = entry.defaultTarget as number;
  if (target < numericMin || target > numericMax) {
    at('default_out_of_bounds', 'Default is outside the allowed range.', 'defaultTarget');
  }
  return issues;
}

function defaultAboveZero(entry: FileBuildOrderEntry): boolean {
  return entry.defaultTarget === 'max' || entry.defaultTarget > 0;
}

/** Every builder rule of R6.11 except the key/version rule. */
export function builderRuleIssues(def: Pick<StrategyDefinitionFile, 'buildOrder'>): StrategyRuleIssue[] {
  const issues: StrategyRuleIssue[] = [];
  const { buildOrder } = def;

  if (buildOrder.length < MIN_BUILD_ORDER_GOALS) {
    issues.push({ rule: 'goal_count', message: 'Add at least one goal.', path: ['buildOrder'] });
  }
  if (buildOrder.length > MAX_BUILD_ORDER_GOALS) {
    issues.push({ rule: 'goal_count', message: '40 goals at most.', path: ['buildOrder'] });
  }
  buildOrder.forEach((entry, index) => {
    if (entry.position !== index + 1) {
      issues.push({
        rule: 'position_sequence',
        message: `Goals are numbered 1, 2, 3 … in order; expected ${index + 1}.`,
        position: entry.position,
        path: ['buildOrder', index, 'position'],
      });
    }
    issues.push(...goalIssues(entry, index));
  });

  // A robots Goal before the first attributes, weapons or refine Goal.
  const firstRobots = buildOrder.findIndex((entry) => entry.goal.type === 'robots');
  const firstDependent = buildOrder.findIndex((entry) =>
    entry.goal.type === 'attributes' || entry.goal.type === 'weapons' || entry.goal.type === 'refine');
  if (firstDependent !== -1 && (firstRobots === -1 || firstRobots > firstDependent)) {
    issues.push({
      rule: 'robots_goal_first',
      message: 'Needs a robots goal above it.',
      position: buildOrder[firstDependent].position,
      path: ['buildOrder', firstDependent],
    });
  }

  // Every required Goal type with a default above 0 (Build_Order-level).
  const requiredLabels: string[] = [];
  for (const type of REQUIRED_GOAL_TYPES) {
    const present = buildOrder.some((entry) => entry.goal.type === type && defaultAboveZero(entry));
    if (!present) requiredLabels.push(GOAL_TYPE_LABELS[type]);
  }
  for (const facilityType of REQUIRED_FACILITY_TYPES) {
    const present = buildOrder.some((entry) =>
      entry.goal.type === 'facility' && entry.goal.facilityType === facilityType && defaultAboveZero(entry));
    if (!present) requiredLabels.push(facilityLabel(facilityType));
  }
  for (const label of requiredLabels) {
    issues.push({
      rule: 'required_goal_type',
      message: `Every strategy needs a ${label} goal with a default above 0.`,
      path: ['buildOrder'],
    });
  }

  const last = buildOrder[buildOrder.length - 1];
  if (last && !(last.goal.type === 'attributes' && last.defaultTarget === 'max')) {
    issues.push({
      rule: 'last_goal_attributes_max',
      message: 'The last goal must be "Attributes → Max".',
      position: last.position,
      path: ['buildOrder', buildOrder.length - 1],
    });
  }
  return issues;
}

/** The Zod schema with every builder rule applied (R6.2, R6.11). */
export const strategyDefinitionSchema = strategyDefinitionShape.superRefine((def, ctx) => {
  for (const issue of builderRuleIssues(def)) {
    ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path, params: { rule: issue.rule, position: issue.position } });
  }
});

/**
 * Key/version rule (R6.11): a new strategy has a key no strategy uses and
 * version 1; a new version of an existing strategy is exactly the latest
 * version + 1.
 */
export function checkKeyAndVersion(
  def: Pick<StrategyDefinitionFile, 'key' | 'version'>,
  latestVersions: ReadonlyMap<string, number>,
): StrategyRuleIssue[] {
  const latest = latestVersions.get(def.key);
  if (latest === undefined) {
    if (def.version === 1) return [];
    return [{ rule: 'version_not_next', message: 'A new strategy starts at v1.', path: ['version'] }];
  }
  if (def.version === latest + 1) return [];
  if (def.version === 1) {
    return [{ rule: 'key_exists', message: `Key "${def.key}" already exists.`, path: ['key'] }];
  }
  return [{ rule: 'version_not_next', message: `The next version of "${def.key}" is v${latest + 1}.`, path: ['version'] }];
}

export type StrategyValidationResult =
  | { ok: true; definition: StrategyDefinitionFile; issues: [] }
  | { ok: false; issues: StrategyRuleIssue[] };

function ruleOf(params: unknown): StrategyRule {
  if (params !== null && typeof params === 'object' && 'rule' in params) {
    return (params as { rule: StrategyRule }).rule;
  }
  return 'schema';
}

function positionOf(params: unknown): number | undefined {
  if (params !== null && typeof params === 'object' && 'position' in params) {
    const { position } = params as { position?: unknown };
    return typeof position === 'number' ? position : undefined;
  }
  return undefined;
}

/**
 * Validate an unknown value as a Strategy_Definition_File. With
 * `latestVersions` (a Strategy_Draft), the key/version rule is checked too.
 */
export function validateStrategyDefinition(
  raw: unknown,
  options: { latestVersions?: ReadonlyMap<string, number> } = {},
): StrategyValidationResult {
  const parsed = strategyDefinitionSchema.safeParse(raw);
  const issues: StrategyRuleIssue[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const params = issue.code === 'custom' ? issue.params : undefined;
      issues.push({
        rule: ruleOf(params),
        message: issue.message,
        position: positionOf(params),
        path: issue.path.map((segment) => (typeof segment === 'symbol' ? String(segment) : segment)),
      });
    }
  }
  if (parsed.success && options.latestVersions) {
    issues.push(...checkKeyAndVersion(parsed.data, options.latestVersions));
  }
  if (!parsed.success || issues.length > 0) return { ok: false, issues };
  return { ok: true, definition: parsed.data as StrategyDefinitionFile, issues: [] };
}

// ── Goal ids and numeric targets ─────────────────────────────────────

/** `{key}.v{version}.{position:02}.{type}[.{facilityType}]` (design §14.0). */
export function goalIdFor(key: string, version: number, entry: Pick<FileBuildOrderEntry, 'position' | 'goal'>): string {
  const position = String(entry.position).padStart(2, '0');
  const suffix = entry.goal.type === 'facility' ? `facility.${entry.goal.facilityType}` : entry.goal.type;
  return `${key}.v${version}.${position}.${suffix}`;
}

const numeric = (value: FileTargetValue): number => (value === 'max' ? ATTRIBUTE_MAX_LEVEL : value);

/** Derive the GoalSpecs of a validated file (ids, numeric targets, `isMax`). */
export function deriveGoalSpecs(def: StrategyDefinitionFile): GoalSpec[] {
  return def.buildOrder.map((entry) => ({
    id: goalIdFor(def.key, def.version, entry),
    position: entry.position,
    type: entry.goal.type,
    ...(entry.goal.type === 'facility' ? { facilityType: entry.goal.facilityType } : {}),
    defaultTarget: numeric(entry.defaultTarget),
    bounds: { min: numeric(entry.bounds.min), max: numeric(entry.bounds.max) },
    isMax: entry.defaultTarget === 'max',
  }));
}
