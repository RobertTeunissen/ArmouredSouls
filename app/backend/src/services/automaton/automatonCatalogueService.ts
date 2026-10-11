/**
 * Automaton_Catalogue schema (Spec #55, R3.2–R3.7, R10.1, design §15.1,
 * task 8.1).
 *
 * One schema for Catalogue_Entries, used by the repository tests, the
 * Catalogue_Sync script, the Catalogue_Unpack script and (as the source of the
 * shared field rules) the admin blueprint and profile endpoints. Structure is
 * checked by strict Zod shapes, so an unknown key such as `image` is rejected
 * (R10.2). The rules that need the weapon catalogue or the Strategy_Registry
 * run in `catalogueEntrySchema(context)` and are exported one by one so the
 * admin endpoints apply exactly the same checks:
 *
 * - `blueprintRuleIssues`: Weapon_Path (R3.3) and Refinement_Plan (R3.4,
 *   decision 35), for a catalogue blueprint or a merged admin blueprint;
 * - `eventOrderIssues` (R3.5);
 * - `teamNamesIssues` with `requiredTeamNameCountsFor` (R3.6);
 * - `strategyIssues` and `robotsTargetIssues` (R3.7, R6.4).
 *
 * Each issue carries a `rule`, a message naming the field and a `path`.
 */
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { canEquipToSlot } from '../../utils/weaponValidation';
import { safeName } from '../../utils/securityValidation';
import { validateStableName } from '../../utils/validation';
import { ROBOT_ATTRIBUTES } from '../../shared/utils/robotAttributes';
import {
  getRefinementMagnitudeRange,
  validateAttributeOnWeapon,
  validateAttributeStackCap,
  validateRefinementSlotAvailable,
  validateShieldCompatibility,
  type RefinementRow,
} from '../../shared/utils/weaponRefinement';
import { SUBSCRIBABLE_EVENT_TYPES } from '../subscription/eventRegistry';
import type { BuildFocusKey, StrategyParametersV1, TeamNames } from '../../types/automaton';
import type { Hand, LoadoutType, Stance, WeaponFacts } from './stableFacts';
import { requiredTeamNameCounts } from './teamRule';
import {
  buildableBlueprintCount,
  highestRobotsBound as buildOrderRobotsBound,
  MAX_AUTOMATON_BLUEPRINTS,
  teamNameMaxRobots,
} from '../../shared/utils/automatonTeamRule';
import { facilityLabel } from './strategies/strategyDefinitionSchema';
import { defaultParameters } from './strategies/strategyParameters';
import type { StrategyRegistry } from './strategies/registry';
import type { GoalSpec, UpgradeStrategy } from './strategies/strategyTypes';

// ── Constants ────────────────────────────────────────────────────────

/** `app/backend/prisma/automaton-catalogue`. */
export const CATALOGUE_DIRECTORY = path.resolve(__dirname, '..', '..', '..', 'prisma', 'automaton-catalogue');
/** Repository_Images: `app/frontend/public/assets/automatons` (ACC: `/opt/armouredsouls/frontend/...`). */
export const REPOSITORY_IMAGE_DIRECTORY = path.resolve(__dirname, '..', '..', '..', '..', 'frontend', 'public', 'assets', 'automatons');
/** URL prefix of Repository_Images (frontend static assets). */
export const REPOSITORY_IMAGE_URL_PREFIX = '/assets/automatons';

export const CATALOGUE_SCHEMA_VERSION = 1;
/** Lowercase letters, digits and hyphens, 3–40 characters (`review/CATALOGUE.md` §2). */
export const CATALOGUE_KEY_PATTERN = /^[a-z0-9-]{3,40}$/;

/**
 * Ascending Catalogue_Key order (R2.5, R10.7, R11.2): plain code-point
 * comparison, so `-` < `0-9` < `a-z`.
 *
 * Never rely on database collation or `localeCompare` for this order: they
 * differ per platform. PostgreSQL on glibc (`en_US.utf8`) ignores hyphens at
 * the first comparison level and sorts `t55e-draft` before `t-exp`, while
 * musl (Alpine) and code-point order put `t-exp` first. Sort in JS with this
 * comparator wherever the order is observable.
 */
export function compareCatalogueKeys(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
export const MAX_BLUEPRINTS = MAX_AUTOMATON_BLUEPRINTS;
export const MAX_WEAPON_STAGES = 4;
export const MAX_REFINEMENT_STEPS_PER_WEAPON = 5;
export const MAX_YIELD_THRESHOLD = 50;
export const FRANCHISE_MAX_LENGTH = 60;
export const BACKSTORY_MAX_LENGTH = 400;
export const TEAM_NAME_MIN_LENGTH = 3;
export const TEAM_NAME_MAX_LENGTH = 32;

export const LOADOUT_TYPES = ['single', 'weapon_shield', 'dual_wield', 'two_handed'] as const satisfies readonly LoadoutType[];
export const STANCES = ['offensive', 'defensive', 'balanced'] as const satisfies readonly Stance[];
export const BUILD_FOCUS_KEYS = ['bruiser', 'deadeye', 'warden', 'sprinter', 'tactician', 'versatile'] as const satisfies readonly BuildFocusKey[];

/** The Repository_Image path of a Blueprint_Slot, relative to the image directory. */
export function repositoryImageRelativePath(catalogueKey: string, slot: number): string {
  return path.join(catalogueKey, `${slot}.webp`);
}

/** The Repository_Image URL stored on a blueprint. */
export function repositoryImageUrl(catalogueKey: string, slot: number): string {
  return `${REPOSITORY_IMAGE_URL_PREFIX}/${catalogueKey}/${slot}.webp`;
}

// ── Structure ────────────────────────────────────────────────────────

const trimmedText = (max: number): z.ZodString => z.string()
  .min(1)
  .max(max)
  .refine((value) => value.trim() === value && value.length > 0, 'Must not start or end with spaces.');

export const catalogueKeySchema = z.string().regex(CATALOGUE_KEY_PATTERN, 'Use 3–40 lowercase letters, digits and hyphens.');

const robotNameSchema = safeName.refine((value) => value.trim() === value, 'Robot name must not start or end with spaces.');

/** Franchise: admin-only grouping text, 1–60 characters. */
export const franchiseSchema = trimmedText(FRANCHISE_MAX_LENGTH);
/** Backstory: admin-only flavour text, 1–400 characters. */
export const backstorySchema = trimmedText(BACKSTORY_MAX_LENGTH);

export const refinementStepSchema = z.object({
  tier: z.enum(['hone', 'augment', 'sharpen', 'forge']),
  hand: z.enum(['main', 'offhand']),
  targetAttribute: z.enum(ROBOT_ATTRIBUTES).optional(),
  magnitude: z.number().int(),
}).strict().superRefine((step, ctx) => {
  const [min, max] = getRefinementMagnitudeRange(step.tier);
  if (step.magnitude < min || step.magnitude > max) {
    ctx.addIssue({ code: 'custom', path: ['magnitude'], message: `${step.tier} magnitude must be ${min === max ? min : `${min}–${max}`}.` });
  }
  const needsAttribute = step.tier === 'hone' || step.tier === 'augment';
  if (needsAttribute && step.targetAttribute === undefined) {
    ctx.addIssue({ code: 'custom', path: ['targetAttribute'], message: `${step.tier} needs a target attribute.` });
  }
  if (!needsAttribute && step.targetAttribute !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['targetAttribute'], message: `${step.tier} takes no target attribute.` });
  }
});

export const weaponStageSchema = z.object({
  main: z.string().min(1).max(100),
  offhand: z.string().min(1).max(100).optional(),
}).strict();

/** Robot_Blueprint fields shared by Catalogue_Entries and admin input (R3.2). */
export const blueprintFieldsSchema = z.object({
  robotName: robotNameSchema,
  loadoutType: z.enum(LOADOUT_TYPES),
  stance: z.enum(STANCES),
  yieldThreshold: z.number().int().min(0).max(MAX_YIELD_THRESHOLD),
  buildFocus: z.enum(BUILD_FOCUS_KEYS),
  weaponPath: z.array(weaponStageSchema).min(1).max(MAX_WEAPON_STAGES),
  refinementPlan: z.array(refinementStepSchema).max(MAX_REFINEMENT_STEPS_PER_WEAPON * 2),
});

export const catalogueBlueprintSchema = blueprintFieldsSchema.extend({
  slot: z.number().int().min(1).max(MAX_BLUEPRINTS),
}).strict();

export const teamNamesSchema = z.object({
  twoVsTwo: z.array(z.string()),
  threeVsThree: z.array(z.string()),
}).strict();

export const eventOrderSchema = z.array(z.enum(SUBSCRIBABLE_EVENT_TYPES));

/** Catalogue_Entry structure (design §15.1) without the context rules. */
export const catalogueEntryShape = z.object({
  schemaVersion: z.literal(CATALOGUE_SCHEMA_VERSION),
  catalogueKey: catalogueKeySchema,
  stableName: z.string(),
  franchise: franchiseSchema,
  backstory: backstorySchema,
  strategy: z.object({
    key: z.string().min(1).max(40),
    version: z.number().int().min(1),
    /** Goal position → Goal_Target, merged over the strategy defaults. */
    targetOverrides: z.record(z.string().regex(/^[1-9]\d?$/, 'Override keys are Goal positions.'), z.number().int()),
  }).strict(),
  teamNames: teamNamesSchema,
  eventOrder: eventOrderSchema,
  blueprints: z.array(catalogueBlueprintSchema).min(1).max(MAX_BLUEPRINTS),
}).strict();

export type CatalogueBlueprint = z.infer<typeof catalogueBlueprintSchema>;
export type CatalogueEntry = z.infer<typeof catalogueEntryShape>;
export type BlueprintFields = z.infer<typeof blueprintFieldsSchema>;

// ── Rules ────────────────────────────────────────────────────────────

export type CatalogueRule =
  | 'schema'
  | 'stable_name'
  | 'blueprint_slot'
  | 'robot_name_duplicate'
  | 'weapon_unknown'
  | 'weapon_loadout'
  | 'refinement_hand'
  | 'refinement_step_count'
  | 'refinement_missing'
  | 'refinement_invalid'
  | 'event_order'
  | 'team_names_count'
  | 'team_name_invalid'
  | 'team_name_duplicate'
  | 'strategy_unknown'
  | 'target_override'
  | 'target_out_of_bounds'
  | 'blueprints_too_few';

export interface CatalogueIssue {
  rule: CatalogueRule;
  message: string;
  path: (string | number)[];
}

/** The error code an issue maps to on the admin endpoints (design §17.1). */
export function catalogueIssueCode(rule: CatalogueRule): 'AUTOMATON_BLUEPRINTS_TOO_FEW' | 'AUTOMATON_TEAM_NAMES_MISMATCH' | 'AUTOMATON_CATALOGUE_INVALID' {
  if (rule === 'blueprints_too_few') return 'AUTOMATON_BLUEPRINTS_TOO_FEW';
  if (rule === 'team_names_count') return 'AUTOMATON_TEAM_NAMES_MISMATCH';
  return 'AUTOMATON_CATALOGUE_INVALID';
}

export type WeaponCatalogue = ReadonlyMap<string, Pick<WeaponFacts, 'name' | 'weaponType' | 'handsRequired' | 'rangeBand' | 'bonuses'>>;

const HAND_LABEL: Readonly<Record<Hand, string>> = { main: 'main hand', offhand: 'off hand' };
const NEEDS_OFFHAND: ReadonlySet<LoadoutType> = new Set<LoadoutType>(['weapon_shield', 'dual_wield']);

function weaponPathIssues(blueprint: BlueprintFields, weapons: WeaponCatalogue, at: (string | number)[]): CatalogueIssue[] {
  const issues: CatalogueIssue[] = [];
  blueprint.weaponPath.forEach((stage, index) => {
    const stagePath = [...at, 'weaponPath', index];
    const hands: [Hand, string | undefined][] = [['main', stage.main], ['offhand', stage.offhand]];
    if (NEEDS_OFFHAND.has(blueprint.loadoutType) && stage.offhand === undefined) {
      issues.push({ rule: 'weapon_loadout', message: `Stage ${index}: ${blueprint.loadoutType} needs an off-hand ${blueprint.loadoutType === 'weapon_shield' ? 'shield' : 'weapon'}.`, path: [...stagePath, 'offhand'] });
    }
    if (!NEEDS_OFFHAND.has(blueprint.loadoutType) && stage.offhand !== undefined) {
      issues.push({ rule: 'weapon_loadout', message: `Stage ${index}: ${blueprint.loadoutType} has no off hand.`, path: [...stagePath, 'offhand'] });
    }
    for (const [hand, name] of hands) {
      if (name === undefined) continue;
      const weapon = weapons.get(name);
      if (!weapon) {
        issues.push({ rule: 'weapon_unknown', message: `Stage ${index}: "${name}" is not in the weapon catalogue.`, path: [...stagePath, hand] });
        continue;
      }
      const fit = canEquipToSlot(weapon, hand, blueprint.loadoutType);
      if (!fit.canEquip) {
        issues.push({ rule: 'weapon_loadout', message: `Stage ${index}: ${name} does not fit the ${HAND_LABEL[hand]} of ${blueprint.loadoutType} (${fit.reason ?? 'not equippable'}).`, path: [...stagePath, hand] });
      }
    }
  });
  return issues;
}

const REFINEMENT_MESSAGES: Readonly<Record<string, string>> = {
  TIER_CAP_EXCEEDED: 'at most 2 of each of Sharpen and Forge per weapon',
  SLOT_CAP_EXCEEDED: 'at most 5 steps per weapon',
  SHIELD_CANNOT_TAKE_DPS_TIER: 'shields take no Sharpen or Forge',
  ATTRIBUTE_NOT_ON_WEAPON: 'Hone needs an attribute the weapon has',
  ATTRIBUTE_ALREADY_ON_WEAPON: 'Augment needs an attribute the weapon lacks',
  ATTRIBUTE_STACK_CAP_EXCEEDED: 'an attribute may total at most +10 on a weapon',
};

/**
 * Refinement_Plan rules (R3.4, decision 35, design §15.1): every step names
 * a weapon of the final stage, at most 5 steps per weapon, at least one step
 * on each non-shield weapon, and the shared validators pass cumulatively per
 * weapon against the catalogue bonuses.
 */
function refinementPlanIssues(blueprint: BlueprintFields, weapons: WeaponCatalogue, at: (string | number)[]): CatalogueIssue[] {
  const issues: CatalogueIssue[] = [];
  const finalStage = blueprint.weaponPath[blueprint.weaponPath.length - 1];
  if (!finalStage) return issues;
  const names: Record<Hand, string | undefined> = { main: finalStage.main, offhand: finalStage.offhand };
  const rows: Record<Hand, RefinementRow[]> = { main: [], offhand: [] };
  const counts: Record<Hand, number> = { main: 0, offhand: 0 };

  blueprint.refinementPlan.forEach((step, index) => {
    const stepPath = [...at, 'refinementPlan', index];
    const name = names[step.hand];
    if (name === undefined) {
      issues.push({ rule: 'refinement_hand', message: `Step ${index + 1}: the final stage has no off-hand weapon.`, path: [...stepPath, 'hand'] });
      return;
    }
    counts[step.hand]++;
    if (counts[step.hand] > MAX_REFINEMENT_STEPS_PER_WEAPON) {
      issues.push({ rule: 'refinement_step_count', message: `${name} (${HAND_LABEL[step.hand]}) has more than ${MAX_REFINEMENT_STEPS_PER_WEAPON} refinement steps.`, path: stepPath });
      return;
    }
    const weapon = weapons.get(name);
    if (!weapon) return; // reported by the Weapon_Path rules
    const reject = (code: string): void => {
      issues.push({ rule: 'refinement_invalid', message: `Step ${index + 1} (${step.tier} on ${name}, ${HAND_LABEL[step.hand]}): ${REFINEMENT_MESSAGES[code] ?? code}.`, path: stepPath });
    };
    const slot = validateRefinementSlotAvailable(rows[step.hand], step.tier);
    if (!slot.ok) return reject(slot.code);
    const shield = validateShieldCompatibility(weapon.weaponType, step.tier);
    if (!shield.ok) return reject(shield.code);
    if (step.tier === 'hone' || step.tier === 'augment') {
      if (step.targetAttribute === undefined) return; // reported by the step schema
      const bonus = weapon.bonuses[step.targetAttribute] ?? 0;
      const onWeapon = validateAttributeOnWeapon(bonus, rows[step.hand], step.targetAttribute, step.tier);
      if (!onWeapon.ok) return reject(onWeapon.code);
      const cap = validateAttributeStackCap(bonus, rows[step.hand], step.targetAttribute, step.magnitude);
      if (!cap.ok) return reject(cap.code);
    }
    rows[step.hand].push({ tier: step.tier, magnitude: step.magnitude, targetAttribute: step.targetAttribute ?? null });
  });

  for (const hand of ['main', 'offhand'] as const) {
    const name = names[hand];
    if (name === undefined) continue;
    const weapon = weapons.get(name);
    if (!weapon || weapon.handsRequired === 'shield') continue;
    if (counts[hand] === 0) {
      issues.push({ rule: 'refinement_missing', message: `Every weapon of the last stage except a shield needs at least one refinement step: ${name} (${HAND_LABEL[hand]}).`, path: [...at, 'refinementPlan'] });
    }
  }
  return issues;
}

/**
 * Weapon_Path and Refinement_Plan rules of one Robot_Blueprint (R3.3, R3.4).
 * Admin endpoints call this on the merged blueprint, so a loadout or
 * Weapon_Path change that leaves a final weapon without steps is rejected.
 */
export function blueprintRuleIssues(blueprint: BlueprintFields, weapons: WeaponCatalogue, at: (string | number)[] = []): CatalogueIssue[] {
  return [...weaponPathIssues(blueprint, weapons, at), ...refinementPlanIssues(blueprint, weapons, at)];
}

/** Event_Order: exactly the 9 `SUBSCRIBABLE_EVENT_TYPES`, each once (R3.5). */
export function eventOrderIssues(eventOrder: readonly string[], at: (string | number)[] = ['eventOrder']): CatalogueIssue[] {
  const unique = new Set(eventOrder);
  const complete = SUBSCRIBABLE_EVENT_TYPES.every((event) => unique.has(event));
  if (eventOrder.length === SUBSCRIBABLE_EVENT_TYPES.length && unique.size === eventOrder.length && complete) return [];
  return [{ rule: 'event_order', message: `Event order must list all ${SUBSCRIBABLE_EVENT_TYPES.length} event types, each once.`, path: at }];
}

/** Highest robots bound of a Build_Order (the robot count Team_Names are sized for). */
export function highestRobotsBound(strategy: Pick<UpgradeStrategy, 'buildOrder'>): number {
  return buildOrderRobotsBound(strategy.buildOrder);
}

/**
 * The number of Robot_Blueprints a stable can build: the run of slots 1…k
 * with no gap. The N-th robot is built from slot N (glossary, Blueprint_Slot)
 * and the robots Goal stops with `no_blueprint` at the first missing slot, so
 * a blueprint above a gap is never built. R3.7 and the Team_Names count
 * (R3.6) use this count, which keeps `no_blueprint` defensive (design §8).
 * Shared with the admin Editor (`app/shared/utils/automatonTeamRule.ts`).
 */
export { buildableBlueprintCount };

/** Team_Names counts for a strategy and blueprint count (R3.6): the Team_Rule at min(highest robots bound, blueprints) (shared `teamNameMaxRobots`). */
export function requiredTeamNameCountsFor(strategy: Pick<UpgradeStrategy, 'buildOrder'>, blueprintCount: number): { twoVsTwo: number; threeVsThree: number } {
  return requiredTeamNameCounts(teamNameMaxRobots(strategy.buildOrder, blueprintCount));
}

/** Approved text: review/PLAYER_FACING_TEXT.md §6.5 "Error: team names count". */
export function teamNamesCountMessage(required: { twoVsTwo: number; threeVsThree: number }): string {
  return `This stable needs ${required.twoVsTwo} team names for 2v2 and ${required.threeVsThree} for 3v3.`;
}

/** Team_Names rules (R3.6): counts, 3–32 characters accepted by `safeName`, distinct within the profile. */
export function teamNamesIssues(
  teamNames: TeamNames,
  required: { twoVsTwo: number; threeVsThree: number },
  at: (string | number)[] = ['teamNames'],
): CatalogueIssue[] {
  const issues: CatalogueIssue[] = [];
  const seen = new Set<string>();
  for (const [field, label] of [['twoVsTwo', '2v2'], ['threeVsThree', '3v3']] as const) {
    const names = teamNames[field];
    if (names.length !== required[field]) {
      issues.push({ rule: 'team_names_count', message: teamNamesCountMessage(required), path: [...at, field] });
    }
    names.forEach((name, index) => {
      const lengthOk = name.length >= TEAM_NAME_MIN_LENGTH && name.length <= TEAM_NAME_MAX_LENGTH;
      if (!lengthOk || !safeName.safeParse(name).success || name.trim() !== name) {
        issues.push({ rule: 'team_name_invalid', message: `${label} team name "${name}": use ${TEAM_NAME_MIN_LENGTH}–${TEAM_NAME_MAX_LENGTH} letters, numbers, spaces and - _ ' . !`, path: [...at, field, index] });
      }
      if (seen.has(name)) {
        issues.push({ rule: 'team_name_duplicate', message: `Team name "${name}" is used twice.`, path: [...at, field, index] });
      }
      seen.add(name);
    });
  }
  return issues;
}

/** Robots Goal_Targets at or below the blueprint count (R3.7); pass `buildableBlueprintCount`. */
export function robotsTargetIssues(
  strategy: Pick<UpgradeStrategy, 'buildOrder'>,
  params: StrategyParametersV1,
  blueprintCount: number,
  at: (string | number)[] = ['strategy'],
): CatalogueIssue[] {
  return strategy.buildOrder
    .filter((d) => d.type === 'robots')
    .filter((d) => (params.targets[d.id] ?? d.defaultTarget) > blueprintCount)
    .map((d) => ({
      rule: 'blueprints_too_few' as const,
      // Approved text: review/PLAYER_FACING_TEXT.md §6.5 "Error: too few blueprints".
      message: `Goal ${d.position} targets ${params.targets[d.id] ?? d.defaultTarget} robots, but this stable has ${blueprintCount} blueprints. Add blueprints or lower the target.`,
      path: at,
    }));
}

function goalSpecLabel(spec: Pick<GoalSpec, 'type' | 'facilityType'>): string {
  if (spec.type === 'facility' && spec.facilityType) return facilityLabel(spec.facilityType);
  return spec.type.charAt(0).toUpperCase() + spec.type.slice(1);
}

export interface StrategyResolution {
  strategy?: UpgradeStrategy;
  parameters?: StrategyParametersV1;
  issues: CatalogueIssue[];
}

/** Resolve a Catalogue_Entry's strategy and merge its overrides over the defaults (design §15.1). */
export function strategyIssues(entry: Pick<CatalogueEntry, 'strategy'>, strategies: StrategyRegistry): StrategyResolution {
  const strategy = strategies.getStrategy(entry.strategy.key, entry.strategy.version);
  if (!strategy) {
    return { issues: [{ rule: 'strategy_unknown', message: `Strategy ${entry.strategy.key} v${entry.strategy.version} does not exist.`, path: ['strategy'] }] };
  }
  const issues: CatalogueIssue[] = [];
  const parameters = defaultParameters(strategy.buildOrder);
  for (const [positionText, target] of Object.entries(entry.strategy.targetOverrides)) {
    const definition = strategy.buildOrder.find((d) => d.position === Number(positionText));
    if (!definition) {
      issues.push({ rule: 'target_override', message: `Goal ${positionText} is not in ${strategy.key} v${strategy.version}.`, path: ['strategy', 'targetOverrides', positionText] });
      continue;
    }
    parameters.targets[definition.id] = target;
  }
  const parsed = strategy.parameterSchema.safeParse(parameters);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const goalId = issue.path[issue.path.length - 1];
      const definition = strategy.buildOrder.find((d) => d.id === goalId);
      const label = definition ? `Goal ${definition.position} (${goalSpecLabel(definition)})` : 'Goal';
      issues.push({ rule: 'target_out_of_bounds', message: `${label}: ${issue.message}.`, path: ['strategy', 'targetOverrides', definition ? String(definition.position) : ''] });
    }
  }
  return { strategy, parameters, issues };
}

// ── Whole entry ──────────────────────────────────────────────────────

export interface CatalogueContext {
  weapons: WeaponCatalogue;
  strategies: StrategyRegistry;
}

/** Every context rule of one structurally valid Catalogue_Entry. */
export function catalogueEntryIssues(entry: CatalogueEntry, context: CatalogueContext): { issues: CatalogueIssue[]; parameters?: StrategyParametersV1 } {
  const issues: CatalogueIssue[] = [];
  const stable = validateStableName(entry.stableName);
  if (!stable.valid) issues.push({ rule: 'stable_name', message: stable.error ?? 'Invalid stable name.', path: ['stableName'] });

  const slots = new Set<number>();
  const robotNames = new Set<string>();
  entry.blueprints.forEach((blueprint, index) => {
    const at = ['blueprints', index];
    if (slots.has(blueprint.slot)) issues.push({ rule: 'blueprint_slot', message: `Blueprint slot ${blueprint.slot} is used twice.`, path: [...at, 'slot'] });
    slots.add(blueprint.slot);
    if (robotNames.has(blueprint.robotName)) issues.push({ rule: 'robot_name_duplicate', message: `Robot name "${blueprint.robotName}" is used twice.`, path: [...at, 'robotName'] });
    robotNames.add(blueprint.robotName);
    issues.push(...blueprintRuleIssues(blueprint, context.weapons, at));
  });

  issues.push(...eventOrderIssues(entry.eventOrder));
  const resolved = strategyIssues(entry, context.strategies);
  issues.push(...resolved.issues);
  if (resolved.strategy) {
    const buildable = buildableBlueprintCount(slots);
    issues.push(...teamNamesIssues(entry.teamNames, requiredTeamNameCountsFor(resolved.strategy, buildable)));
    if (resolved.parameters) issues.push(...robotsTargetIssues(resolved.strategy, resolved.parameters, buildable));
  }
  return { issues, parameters: resolved.parameters };
}

/** The Catalogue_Entry schema with every context rule (R10.1). */
export function catalogueEntrySchema(context: CatalogueContext): z.ZodType<CatalogueEntry> {
  return catalogueEntryShape.superRefine((entry, ctx) => {
    for (const issue of catalogueEntryIssues(entry, context).issues) {
      ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path, params: { rule: issue.rule } });
    }
  });
}

export type CatalogueValidationResult =
  | { ok: true; entry: CatalogueEntry; parameters: StrategyParametersV1 }
  | { ok: false; issues: CatalogueIssue[] };

function ruleOf(params: unknown): CatalogueRule {
  if (params !== null && typeof params === 'object' && 'rule' in params) return (params as { rule: CatalogueRule }).rule;
  return 'schema';
}

/** Validate an unknown value as a Catalogue_Entry. */
export function validateCatalogueEntry(raw: unknown, context: CatalogueContext): CatalogueValidationResult {
  const parsed = catalogueEntrySchema(context).safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        rule: ruleOf(issue.code === 'custom' ? issue.params : undefined),
        message: issue.message,
        path: issue.path.map((segment) => (typeof segment === 'symbol' ? String(segment) : segment)),
      })),
    };
  }
  const { parameters } = catalogueEntryIssues(parsed.data, context);
  if (!parameters) return { ok: false, issues: [{ rule: 'strategy_unknown', message: 'Strategy could not be resolved.', path: ['strategy'] }] };
  return { ok: true, entry: parsed.data, parameters };
}

// ── Catalogue_Export document (design §15.4) ─────────────────────────

/** `{catalogueKey}/{slot}` image keys of an export document. */
export const EXPORT_IMAGE_KEY = /^([a-z0-9-]{3,40})\/(\d{1,2})$/;

/** Export document structure; entries are validated one by one with the catalogue schema. */
export const catalogueExportDocumentSchema = z.object({
  schemaVersion: z.literal(CATALOGUE_SCHEMA_VERSION),
  exportedAt: z.string(),
  environment: z.string(),
  entries: z.array(z.unknown()),
  images: z.record(
    z.string().regex(EXPORT_IMAGE_KEY, 'Image keys are {catalogueKey}/{slot}.'),
    z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Images are base64.'),
  ),
}).strict();

export interface CatalogueExportDocument {
  schemaVersion: typeof CATALOGUE_SCHEMA_VERSION;
  exportedAt: string;
  environment: string;
  entries: CatalogueEntry[];
  /** `{catalogueKey}/{slot}` → base64 WebP (admin uploads only). */
  images: Record<string, string>;
}

// ── Repository directory ─────────────────────────────────────────────

export interface LoadedCatalogueEntry {
  file: string;
  entry: CatalogueEntry;
  parameters: StrategyParametersV1;
}

export interface CatalogueDirectoryLoad {
  /** Valid entries ordered by Catalogue_Key. */
  entries: LoadedCatalogueEntry[];
  /** One line per problem; any problem makes the whole directory invalid (R10.4). */
  problems: string[];
}

/**
 * Read and validate every `*.json` of the Automaton_Catalogue directory. The
 * file name must be `{catalogueKey}.json` and stable names must be distinct
 * across the catalogue.
 */
export function loadCatalogueDirectory(context: CatalogueContext, directory: string = CATALOGUE_DIRECTORY): CatalogueDirectoryLoad {
  if (!fs.existsSync(directory)) return { entries: [], problems: [`${directory}: catalogue directory does not exist`] };
  const entries: LoadedCatalogueEntry[] = [];
  const problems: string[] = [];
  const files = fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort();
  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    } catch (error) {
      problems.push(`${file}: not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const result = validateCatalogueEntry(raw, context);
    if (!result.ok) {
      problems.push(...formatCatalogueIssues(file, result.issues));
      continue;
    }
    if (file !== `${result.entry.catalogueKey}.json`) {
      problems.push(`${file}: file name must be ${result.entry.catalogueKey}.json`);
      continue;
    }
    entries.push({ file, entry: result.entry, parameters: result.parameters });
  }
  const byStableName = new Map<string, string>();
  for (const { entry } of entries) {
    const other = byStableName.get(entry.stableName);
    if (other) problems.push(`${entry.catalogueKey}.json: stable name "${entry.stableName}" is also used by ${other}`);
    byStableName.set(entry.stableName, entry.catalogueKey);
  }
  entries.sort((a, b) => compareCatalogueKeys(a.entry.catalogueKey, b.entry.catalogueKey));
  return { entries, problems };
}

/** One line per issue, prefixed with the file or key. */
export function formatCatalogueIssues(source: string, issues: readonly CatalogueIssue[]): string[] {
  return issues.map((issue) => `${source}${issue.path.length > 0 ? ` [${issue.path.join('.')}]` : ''}: ${issue.message}`);
}
