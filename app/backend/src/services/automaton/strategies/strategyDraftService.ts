/**
 * Strategy_Drafts (Spec #55, R6.9–R6.14, design §14.0b, §17.1, tasks 9.8
 * and 9.10).
 *
 * A draft is a row of `automaton_strategy_drafts` holding a
 * Strategy_Definition_File in progress. It is never visible to the planner
 * and never assignable (R6.13): the Strategy_Registry reads files only.
 *
 * - Create blank (a new strategy, v1) or from `key.vN` (a new version: the
 *   copy of that version numbered `latestVersion(key) + 1`, key fixed).
 * - Every read and update returns the validation: definition schema, every
 *   builder rule (errors per Goal by `position`, Build_Order-level errors
 *   without one) and the key/version rule (R6.10, R6.11). A draft with errors
 *   can be saved; it cannot be exported or previewed.
 * - Export returns the Strategy_Definition_File when every rule passes
 *   (R6.14). For a new version of an existing strategy, every validation and
 *   the export also carry the upgrade warning: the profiles of that strategy
 *   that the §14.0a upgrade would reject, with their reason (decision 37).
 * - Preview (R6.12): the Turn_Preview path on one profile with the draft's
 *   Build_Order and default targets, and the opening build of a fresh
 *   ₡3,000,000 stable with the profile's blueprints. Read-only.
 */
import { z } from 'zod';
import prisma from '../../../lib/prisma';
import { Prisma } from '../../../../generated/prisma';
import { AutomatonError, AutomatonErrorCode } from '../../../errors/automatonErrors';
import { BUILD_FOCUS_WEIGHTS } from '../buildFocus';
import { buildTurnPreview, loadPreviewSubject, type TurnPreviewResult } from '../turnPreview';
import { getStrategyRegistry } from './defaultRegistry';
import { interpretStrategy, type StrategyRegistry } from './registry';
import { projectOpeningBuild, SCENARIO_STARTING_BALANCE, type ScenarioPurchase } from './scenarioProjector';
import {
  buildOrderEntrySchema,
  builderRuleIssues,
  checkKeyAndVersion,
  STRATEGY_DESCRIPTION_MAX_LENGTH,
  STRATEGY_DISPLAY_NAME_MAX_LENGTH,
  strategyDefinitionShape,
  strategyKeySchema,
  type StrategyRuleIssue,
} from './strategyDefinitionSchema';
import { defaultParameters } from './strategyParameters';
import type { FileBuildOrderEntry, StrategyDefinitionFile, UpgradeStrategy } from './strategyTypes';
import { upgradeWarningFor, type UpgradeWarningEntry } from './strategyUpgradeService';

// ── Shapes ───────────────────────────────────────────────────────────

/**
 * Upper bound on a stored Build_Order. Above the 40-Goal builder rule, so the
 * builder can show "40 goals at most." instead of refusing the save.
 */
export const DRAFT_MAX_STORED_GOALS = 100;

/** A draft's Build_Order as stored: structurally valid entries, builder rules not applied. */
export const draftBuildOrderSchema = z.array(buildOrderEntrySchema).max(DRAFT_MAX_STORED_GOALS);
export const draftDisplayNameSchema = z.string().max(STRATEGY_DISPLAY_NAME_MAX_LENGTH);
export const draftDescriptionSchema = z.string().max(STRATEGY_DESCRIPTION_MAX_LENGTH);

/** A stored draft definition (lenient: an empty name or a rule error is a draft in progress). */
const storedDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  key: strategyKeySchema,
  version: z.number().int().min(1),
  displayName: draftDisplayNameSchema,
  description: draftDescriptionSchema,
  buildOrder: draftBuildOrderSchema,
}).strict();

/** `key.vN` of an existing Strategy_Version. */
export const BASED_ON_PATTERN = /^([a-z0-9-]+)\.v([1-9]\d*)$/;

export type CreateDraftInput =
  | { basedOn: string }
  | { key: string; displayName?: string; description?: string };

export interface UpdateDraftInput {
  key?: string;
  displayName?: string;
  description?: string;
  buildOrder?: FileBuildOrderEntry[];
}

export interface DraftValidation {
  issues: StrategyRuleIssue[];
  errorCount: number;
  ready: boolean;
  /** New version of an existing strategy: profiles the upgrade would reject (empty = none); null otherwise. */
  upgradeWarning: UpgradeWarningEntry[] | null;
}

export interface DraftSummary {
  id: number;
  key: string;
  version: number;
  basedOn: string | null;
  displayName: string;
  goalCount: number;
  errorCount: number;
  ready: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface DraftView extends DraftValidation {
  id: number;
  basedOn: string | null;
  definition: StrategyDefinitionFile;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface DraftExport {
  fileName: string;
  definition: StrategyDefinitionFile;
  upgradeWarning: UpgradeWarningEntry[] | null;
}

export interface DraftPreview {
  draftId: number;
  catalogueKey: string;
  /** (a) the chosen profile: Turn_Preview statuses with the draft's Build_Order and default targets. */
  profile: TurnPreviewResult;
  /** (b) a fresh ₡3,000,000 stable with the profile's blueprints: the opening purchases in order. */
  freshStable: { startBalance: number; endBalance: number; purchases: ScenarioPurchase[] };
}

export interface StrategyDraftDeps {
  registry?: StrategyRegistry;
}

type DraftRow = Prisma.AutomatonStrategyDraftGetPayload<Record<string, never>>;

// ── Validation ───────────────────────────────────────────────────────

function registryOf(deps: StrategyDraftDeps): StrategyRegistry {
  return deps.registry ?? getStrategyRegistry();
}

/**
 * Every rule of a draft: the definition schema (e.g. an empty display name),
 * every builder rule and the key/version rule (R6.11).
 */
export function draftIssues(definition: StrategyDefinitionFile, latestVersions: ReadonlyMap<string, number>): StrategyRuleIssue[] {
  const issues: StrategyRuleIssue[] = [];
  const shape = strategyDefinitionShape.safeParse(definition);
  if (!shape.success) {
    for (const issue of shape.error.issues) {
      issues.push({ rule: 'schema', message: issue.message, path: issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p)) });
    }
  }
  issues.push(...builderRuleIssues(definition), ...checkKeyAndVersion(definition, latestVersions));
  return issues;
}

/** The interpreted draft when it passes the schema and the builder rules (preview, upgrade warning). */
function interpretable(definition: StrategyDefinitionFile, issues: readonly StrategyRuleIssue[]): UpgradeStrategy | null {
  const blocking = issues.filter((i) => i.rule !== 'key_exists' && i.rule !== 'version_not_next');
  return blocking.length === 0 ? interpretStrategy(definition, { weightTable: BUILD_FOCUS_WEIGHTS }) : null;
}

async function validate(definition: StrategyDefinitionFile, registry: StrategyRegistry): Promise<DraftValidation> {
  const issues = draftIssues(definition, registry.latestVersions());
  let upgradeWarning: UpgradeWarningEntry[] | null = null;
  const latest = registry.latestVersion(definition.key);
  if (latest !== undefined && definition.version > latest) {
    const strategy = interpretable(definition, issues);
    if (strategy) upgradeWarning = await upgradeWarningFor(strategy, registry);
  }
  return { issues, errorCount: issues.length, ready: issues.length === 0, upgradeWarning };
}

function storedDefinition(row: DraftRow): StrategyDefinitionFile {
  const parsed = storedDefinitionSchema.safeParse(row.definition);
  if (parsed.success) return parsed.data as StrategyDefinitionFile;
  // Defensive: a row written by hand; keep what is readable so the builder can repair it.
  const raw = (row.definition ?? {}) as Partial<StrategyDefinitionFile>;
  return {
    schemaVersion: 1,
    key: row.key,
    version: row.version,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    buildOrder: draftBuildOrderSchema.safeParse(raw.buildOrder).success ? (raw.buildOrder as FileBuildOrderEntry[]) : [],
  };
}

function notFound(id: number): AutomatonError {
  return new AutomatonError(AutomatonErrorCode.AUTOMATON_STRATEGY_DRAFT_NOT_FOUND, `No strategy draft ${id}`, 404);
}

function draftExists(key: string, version: number): AutomatonError {
  return new AutomatonError(AutomatonErrorCode.AUTOMATON_STRATEGY_DRAFT_EXISTS, `A draft of ${key} v${version} already exists.`, 409);
}

function invalidDraft(message: string, issues: readonly StrategyRuleIssue[]): AutomatonError {
  return new AutomatonError(AutomatonErrorCode.AUTOMATON_STRATEGY_DRAFT_INVALID, message, 400, { issues });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function readRow(id: number): Promise<DraftRow> {
  const row = await prisma.automatonStrategyDraft.findUnique({ where: { id } });
  if (!row) throw notFound(id);
  return row;
}

async function view(row: DraftRow, registry: StrategyRegistry): Promise<DraftView> {
  const definition = storedDefinition(row);
  return {
    id: row.id,
    basedOn: row.basedOn,
    definition,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(await validate(definition, registry)),
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────

/** Drafts on this environment, newest first, each with its error count (R6.13). */
export async function listDrafts(deps: StrategyDraftDeps = {}): Promise<DraftSummary[]> {
  const registry = registryOf(deps);
  const latest = registry.latestVersions();
  const rows = await prisma.automatonStrategyDraft.findMany({ orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] });
  return rows.map((row) => {
    const definition = storedDefinition(row);
    const errorCount = draftIssues(definition, latest).length;
    return {
      id: row.id,
      key: row.key,
      version: row.version,
      basedOn: row.basedOn,
      displayName: definition.displayName,
      goalCount: definition.buildOrder.length,
      errorCount,
      ready: errorCount === 0,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

/** One draft with its validation. */
export async function getDraft(id: number, deps: StrategyDraftDeps = {}): Promise<DraftView> {
  return view(await readRow(id), registryOf(deps));
}

/** Create a blank draft (new strategy, v1) or a new version from `key.vN` (R6.10). */
export async function createDraft(input: CreateDraftInput, adminUserId: number, deps: StrategyDraftDeps = {}): Promise<DraftView> {
  const registry = registryOf(deps);
  let definition: StrategyDefinitionFile;
  let basedOn: string | null = null;
  if ('basedOn' in input) {
    const match = BASED_ON_PATTERN.exec(input.basedOn);
    const base = match ? registry.getStrategy(match[1], Number(match[2])) : undefined;
    if (!base) throw new AutomatonError(AutomatonErrorCode.AUTOMATON_STRATEGY_NOT_FOUND, `Strategy ${input.basedOn} does not exist.`, 404);
    const latest = registry.latestVersion(base.key) as number;
    definition = { ...structuredClone(base.definition), version: latest + 1 };
    basedOn = input.basedOn;
  } else {
    definition = {
      schemaVersion: 1,
      key: input.key,
      version: 1,
      displayName: input.displayName ?? '',
      description: input.description ?? '',
      buildOrder: [],
    };
  }
  try {
    const row = await prisma.automatonStrategyDraft.create({
      data: {
        key: definition.key,
        version: definition.version,
        basedOn,
        definition: definition as unknown as Prisma.InputJsonValue,
        createdBy: adminUserId,
      },
    });
    return await view(row, registry);
  } catch (error) {
    if (isUniqueViolation(error)) throw draftExists(definition.key, definition.version);
    throw error;
  }
}

/**
 * Update a draft and return it with its validation (R6.10). A new version
 * keeps its key; the version number never changes.
 */
export async function updateDraft(id: number, input: UpdateDraftInput, deps: StrategyDraftDeps = {}): Promise<DraftView> {
  const registry = registryOf(deps);
  const row = await readRow(id);
  const current = storedDefinition(row);
  if (input.key !== undefined && input.key !== current.key && row.basedOn !== null) {
    throw invalidDraft('A new version keeps the key.', [{ rule: 'schema', message: 'A new version keeps the key.', path: ['key'] }]);
  }
  const definition: StrategyDefinitionFile = {
    ...current,
    ...(input.key !== undefined ? { key: input.key } : {}),
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.buildOrder !== undefined ? { buildOrder: input.buildOrder } : {}),
  };
  try {
    const updated = await prisma.automatonStrategyDraft.update({
      where: { id },
      data: { key: definition.key, definition: definition as unknown as Prisma.InputJsonValue },
    });
    return await view(updated, registry);
  } catch (error) {
    if (isUniqueViolation(error)) throw draftExists(definition.key, definition.version);
    throw error;
  }
}

/** Delete a draft (R6.13). */
export async function deleteDraft(id: number): Promise<{ id: number; key: string; version: number }> {
  const row = await readRow(id);
  await prisma.automatonStrategyDraft.delete({ where: { id } });
  return { id, key: row.key, version: row.version };
}

// ── Export and preview ───────────────────────────────────────────────

/**
 * The Strategy_Definition_File of a draft that passes every rule (R6.14),
 * with the upgrade warning for a new version (a warning; export still works).
 */
export async function exportDraft(id: number, deps: StrategyDraftDeps = {}): Promise<DraftExport> {
  const registry = registryOf(deps);
  const definition = storedDefinition(await readRow(id));
  const validation = await validate(definition, registry);
  if (!validation.ready) {
    throw invalidDraft(`Export is disabled while the draft has errors (${validation.errorCount}).`, validation.issues);
  }
  return { fileName: `${definition.key}.v${definition.version}.json`, definition, upgradeWarning: validation.upgradeWarning };
}

/**
 * Draft preview (R6.12): per-Goal statuses on one profile and the opening
 * build of a fresh stable. Needs the schema and builder rules to pass (the
 * key/version rule does not matter for a preview).
 */
export async function previewDraft(id: number, catalogueKey: string, deps: StrategyDraftDeps = {}): Promise<DraftPreview> {
  const registry = registryOf(deps);
  const definition = storedDefinition(await readRow(id));
  const issues = draftIssues(definition, registry.latestVersions());
  const strategy = interpretable(definition, issues);
  if (!strategy) throw invalidDraft('Fix the draft errors before previewing it.', issues);
  const subject = await loadPreviewSubject(catalogueKey, registry);
  const ctx = {
    params: defaultParameters(strategy.buildOrder),
    blueprints: subject.blueprints,
    weapons: subject.weapons,
    teamNames: subject.teamNames,
  };
  const opening = projectOpeningBuild({ strategy, ...ctx });
  return {
    draftId: id,
    catalogueKey,
    profile: buildTurnPreview(subject.facts, strategy, ctx),
    freshStable: { startBalance: SCENARIO_STARTING_BALANCE, endBalance: opening.facts.balance, purchases: opening.purchases },
  };
}
