/**
 * Pure validation of Automaton_Profile edits (Spec #55, R2.3, R3.2–R3.7,
 * R6.4, R6.5, design §17.1, task 9.1).
 *
 * The admin service loads rows and calls these; they reuse the Catalogue_Entry
 * rules rule by rule (`automatonCatalogueService.ts`), so an admin edit, a
 * catalogue file and Activation are checked identically. Each returns
 * `CatalogueIssue`s; `issuesError` turns them into the one error the endpoint
 * returns.
 */
import { AutomatonError, AutomatonErrorCode, type AutomatonErrorCodeType } from '../../errors/automatonErrors';
import type { StrategyParametersV1, TeamNames } from '../../types/automaton';
import {
  blueprintFieldsSchema,
  blueprintRuleIssues,
  eventOrderIssues,
  MAX_BLUEPRINTS,
  requiredTeamNameCountsFor,
  robotsTargetIssues,
  teamNamesIssues,
  type BlueprintFields,
  type CatalogueIssue,
  type WeaponCatalogue,
} from './automatonCatalogueService';
import { defaultParameters } from './strategies/strategyParameters';
import { facilityLabel } from './strategies/strategyDefinitionSchema';
import type { UpgradeStrategy } from './strategies/strategyTypes';

/** A stored blueprint in the shape the rules read. */
export interface BlueprintRecord extends BlueprintFields {
  slot: number;
}

/**
 * The error for a non-empty issue list. The code follows the most specific
 * rule: too few blueprints (R3.7), then the Team_Names count (R3.6), else the
 * generic catalogue code. The message is the first issue of that rule; every
 * issue is in `details.issues`.
 */
export function issuesError(issues: readonly CatalogueIssue[]): AutomatonError {
  const pick = (rule: CatalogueIssue['rule']): CatalogueIssue | undefined => issues.find((i) => i.rule === rule);
  const tooFew = pick('blueprints_too_few');
  const teamCount = pick('team_names_count');
  const [code, lead]: [AutomatonErrorCodeType, CatalogueIssue] = tooFew
    ? [AutomatonErrorCode.AUTOMATON_BLUEPRINTS_TOO_FEW, tooFew]
    : teamCount
      ? [AutomatonErrorCode.AUTOMATON_TEAM_NAMES_MISMATCH, teamCount]
      : [AutomatonErrorCode.AUTOMATON_CATALOGUE_INVALID, issues[0]];
  return new AutomatonError(code, lead.message, 400, { issues });
}

/** Throw `issuesError` when there is any issue. */
export function assertNoIssues(issues: readonly CatalogueIssue[]): void {
  if (issues.length > 0) throw issuesError(issues);
}

/** Every rule of one blueprint plus robot-name uniqueness within the profile. */
export function blueprintIssues(
  blueprint: BlueprintRecord,
  others: readonly BlueprintRecord[],
  weapons: WeaponCatalogue,
): CatalogueIssue[] {
  const issues: CatalogueIssue[] = [];
  // Strict: any key besides the blueprint fields (e.g. an image) is rejected (R3.2, R3.10).
  const fields = Object.fromEntries(Object.entries(blueprint).filter(([key]) => key !== 'slot'));
  const shape = blueprintFieldsSchema.strict().safeParse(fields);
  if (!shape.success) {
    return shape.error.issues.map((issue) => ({
      rule: 'schema' as const,
      message: `Blueprint ${blueprint.slot}: ${issue.message}`,
      path: ['blueprints', blueprint.slot, ...issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p))],
    }));
  }
  if (blueprint.slot < 1 || blueprint.slot > MAX_BLUEPRINTS || !Number.isInteger(blueprint.slot)) {
    issues.push({ rule: 'blueprint_slot', message: `Blueprint slot must be 1–${MAX_BLUEPRINTS}.`, path: ['slot'] });
  }
  if (others.some((other) => other.slot !== blueprint.slot && other.robotName === blueprint.robotName)) {
    issues.push({ rule: 'robot_name_duplicate', message: `Robot name "${blueprint.robotName}" is used by another blueprint of this stable.`, path: ['robotName'] });
  }
  issues.push(...blueprintRuleIssues(shape.data, weapons, ['blueprints', blueprint.slot]));
  return issues;
}

/** Team_Names for a strategy and blueprint count (R3.6). */
export function teamNamesIssuesFor(strategy: UpgradeStrategy, blueprintCount: number, teamNames: TeamNames): CatalogueIssue[] {
  return teamNamesIssues(teamNames, requiredTeamNameCountsFor(strategy, blueprintCount));
}

/** Label of a Goal for messages: "Goal 4 (Booking Office)". */
function goalLabel(strategy: UpgradeStrategy, goalId: string): string {
  const definition = strategy.buildOrder.find((d) => d.id === goalId);
  if (!definition) return 'Goal';
  const name = definition.type === 'facility' && definition.facilityType
    ? facilityLabel(definition.facilityType)
    : definition.type.charAt(0).toUpperCase() + definition.type.slice(1);
  return `Goal ${definition.position} (${name})`;
}

export type ParameterResolution =
  | { ok: true; params: StrategyParametersV1 }
  | { ok: false; issues: CatalogueIssue[] };

/**
 * Merge `targets` (Goal id → Goal_Target) over `base` and check the result
 * against the version's parameter schema (R6.4, R6.5). Unknown Goal ids and
 * out-of-bounds targets are reported per Goal.
 */
export function resolveParameters(
  strategy: UpgradeStrategy,
  base: StrategyParametersV1 | null,
  targets: Readonly<Record<string, number>> = {},
): ParameterResolution {
  const merged: StrategyParametersV1 = { targets: { ...(base ?? defaultParameters(strategy.buildOrder)).targets } };
  for (const definition of strategy.buildOrder) {
    if (merged.targets[definition.id] === undefined) merged.targets[definition.id] = definition.defaultTarget;
  }
  const issues: CatalogueIssue[] = [];
  for (const [goalId, target] of Object.entries(targets)) {
    if (!strategy.buildOrder.some((d) => d.id === goalId)) {
      issues.push({ rule: 'target_override', message: `Goal ${goalId} is not in ${strategy.key} v${strategy.version}.`, path: ['targets', goalId] });
      continue;
    }
    merged.targets[goalId] = target;
  }
  // Goals of another version (a stored base after a strategy change) are dropped.
  for (const goalId of Object.keys(merged.targets)) {
    if (!strategy.buildOrder.some((d) => d.id === goalId)) delete merged.targets[goalId];
  }
  const parsed = strategy.parameterSchema.safeParse(merged);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const goalId = String(issue.path[issue.path.length - 1] ?? '');
      issues.push({ rule: 'target_out_of_bounds', message: `${goalLabel(strategy, goalId)}: ${issue.message}.`, path: ['targets', goalId] });
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, params: merged };
}

/** Stored Goal_Targets of a profile, or null when they fail the version's schema. */
export function storedParameters(strategy: UpgradeStrategy, stored: unknown): StrategyParametersV1 | null {
  const parsed = strategy.parameterSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

export interface ProfileRuleInput {
  strategy: UpgradeStrategy;
  params: StrategyParametersV1;
  blueprints: readonly BlueprintRecord[];
  teamNames: TeamNames;
  eventOrder: readonly string[];
  weapons: WeaponCatalogue;
}

/**
 * Every profile rule Activation needs (R2.3): blueprints (at least one, each
 * valid), Event_Order, Team_Names count and names, robots Goal_Targets at or
 * below the blueprint count.
 */
export function profileIssues(input: ProfileRuleInput): CatalogueIssue[] {
  const issues: CatalogueIssue[] = [];
  if (input.blueprints.length === 0) {
    issues.push({ rule: 'blueprint_slot', message: 'A stable needs at least one robot blueprint.', path: ['blueprints'] });
  }
  for (const blueprint of input.blueprints) issues.push(...blueprintIssues(blueprint, input.blueprints, input.weapons));
  issues.push(...eventOrderIssues(input.eventOrder));
  issues.push(...teamNamesIssuesFor(input.strategy, input.blueprints.length, input.teamNames));
  issues.push(...robotsTargetIssues(input.strategy, input.params, input.blueprints.length));
  return issues;
}

/** Stored Team_Names of a profile, reading only well-formed string lists. */
export function profileTeamNames(profile: { teamNames: unknown }): TeamNames {
  const raw = profile.teamNames as Partial<TeamNames> | null;
  return {
    twoVsTwo: Array.isArray(raw?.twoVsTwo) ? raw.twoVsTwo.filter((n): n is string => typeof n === 'string') : [],
    threeVsThree: Array.isArray(raw?.threeVsThree) ? raw.threeVsThree.filter((n): n is string => typeof n === 'string') : [],
  };
}

/** Stored Event_Order of a profile (strings only; validated by `eventOrderIssues`). */
export function profileEventOrder(profile: { eventOrder: unknown }): string[] {
  const raw = profile.eventOrder;
  return Array.isArray(raw) ? raw.filter((e): e is string => typeof e === 'string') : [];
}

export const AUTOMATON_USERNAME_PREFIX = 'automaton_';

/** Username of an Activated stable (R2.2). */
export function automatonUsername(catalogueKey: string): string {
  return `${AUTOMATON_USERNAME_PREFIX}${catalogueKey}`;
}

/** The lowest free Blueprint_Slot from 1 to 11, or null. */
export function nextFreeSlot(taken: Iterable<number>): number | null {
  const used = new Set(taken);
  for (let slot = 1; slot <= MAX_BLUEPRINTS; slot++) if (!used.has(slot)) return slot;
  return null;
}
