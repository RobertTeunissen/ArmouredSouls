/**
 * Strategy_Registry (Spec #55, R6.2, R6.6, R6.8, design §14.0, §14.0a,
 * task 3.7).
 *
 * Loads every `config/automaton-strategies/*.json`, validates each file with
 * `strategyDefinitionSchema` (structure + builder rules), derives the Goal ids
 * and builds each Strategy_Version through the Goal factories. A new file
 * needs no code change: dropping `{key}.v{n}.json` into the directory is the
 * whole change (R6.8). The directory is injectable so tests can point it at a
 * fixture directory.
 *
 * Startup check: the server refuses to start on an invalid file, or when a
 * stored `(strategyKey, strategyVersion)` has no file (R6.2, R6.6).
 */
import fs from 'fs';
import path from 'path';
import logger from '../../../config/logger';
import { sendStartupFailureAlert } from '../../../utils/startupAlert';
import type { BuildFocusWeightTable } from '../buildFocus';
import { createAttributeGoal } from '../goals/attributeGoal';
import { createFacilityGoal } from '../goals/facilityGoal';
import { createRefinementGoal } from '../goals/refinementGoal';
import { createRobotCountGoal } from '../goals/robotCountGoal';
import { createWeaponStageGoal } from '../goals/weaponStageGoal';
import type { Goal } from '../goals/goalTypes';
import { deriveGoalSpecs, validateStrategyDefinition, type StrategyRuleIssue } from './strategyDefinitionSchema';
import { buildParameterSchema } from './strategyParameters';
import type { GoalDefinition, GoalSpec, StrategyDefinitionFile, UpgradeStrategy } from './strategyTypes';

/** `src/config/automaton-strategies` (and `dist/config/automaton-strategies` after `pnpm run build`). */
export const STRATEGY_DIRECTORY = path.resolve(__dirname, '..', '..', '..', 'config', 'automaton-strategies');

export interface StrategyFileProblem {
  /** File name within the strategy directory (or the directory itself). */
  file: string;
  issues: StrategyRuleIssue[];
}

export interface StrategyDirectoryLoad {
  definitions: StrategyDefinitionFile[];
  problems: StrategyFileProblem[];
}

/**
 * Read and validate every `*.json` file of `directory`, in file-name order.
 * The file name must be `{key}.v{version}.json` of its own content.
 */
export function readStrategyDirectory(directory: string = STRATEGY_DIRECTORY): StrategyDirectoryLoad {
  if (!fs.existsSync(directory)) {
    return {
      definitions: [],
      problems: [{ file: directory, issues: [{ rule: 'schema', message: 'Strategy directory does not exist.', path: [] }] }],
    };
  }
  const definitions: StrategyDefinitionFile[] = [];
  const problems: StrategyFileProblem[] = [];
  const files = fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort();

  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      problems.push({ file, issues: [{ rule: 'schema', message: `Not valid JSON: ${message}`, path: [] }] });
      continue;
    }
    const result = validateStrategyDefinition(raw);
    if (!result.ok) {
      problems.push({ file, issues: result.issues });
      continue;
    }
    const expected = `${result.definition.key}.v${result.definition.version}.json`;
    if (file !== expected) {
      problems.push({
        file,
        issues: [{ rule: 'file_name', message: `File name must be ${expected}.`, path: [] }],
      });
      continue;
    }
    definitions.push(result.definition);
  }
  return { definitions, problems };
}

export interface StrategyRegistryOptions {
  /** Build_Focus group weights the attributes Goals use. */
  weightTable: BuildFocusWeightTable;
}

/** The Goal_Library instance of one Build_Order entry. */
export function createGoal(spec: GoalSpec, options: StrategyRegistryOptions): Goal {
  switch (spec.type) {
    case 'robots':
      return createRobotCountGoal(spec.id);
    case 'facility':
      if (!spec.facilityType) throw new Error(`Facility Goal ${spec.id} has no facility type`);
      return createFacilityGoal(spec.id, spec.facilityType);
    case 'attributes':
      return createAttributeGoal(spec.id, { isMax: spec.isMax, weightTable: options.weightTable });
    case 'weapons':
      return createWeaponStageGoal(spec.id);
    case 'refine':
      return createRefinementGoal(spec.id);
  }
}

/** Interpret a validated file as an UpgradeStrategy. */
export function interpretStrategy(definition: StrategyDefinitionFile, options: StrategyRegistryOptions): UpgradeStrategy {
  const specs = deriveGoalSpecs(definition);
  const buildOrder: GoalDefinition[] = specs.map((spec) => ({ ...spec, goal: createGoal(spec, options) }));
  return {
    key: definition.key,
    version: definition.version,
    displayName: definition.displayName,
    description: definition.description,
    buildOrder,
    parameterSchema: buildParameterSchema(specs),
    definition,
  };
}

export interface StrategyRegistry {
  /** key → version → strategy. */
  readonly byKey: ReadonlyMap<string, ReadonlyMap<number, UpgradeStrategy>>;
  getStrategy(key: string, version: number): UpgradeStrategy | undefined;
  latestVersion(key: string): number | undefined;
  /** key → latest version, for the Strategy_Builder key/version rule. */
  latestVersions(): ReadonlyMap<string, number>;
  /** Every version of every strategy, by key then version. */
  all(): UpgradeStrategy[];
}

/** A registry over already interpreted strategies. */
export function createStrategyRegistry(strategies: readonly UpgradeStrategy[]): StrategyRegistry {
  const byKey = new Map<string, Map<number, UpgradeStrategy>>();
  for (const strategy of strategies) {
    const versions = byKey.get(strategy.key) ?? new Map<number, UpgradeStrategy>();
    if (versions.has(strategy.version)) throw new Error(`Duplicate strategy ${strategy.key}.v${strategy.version}`);
    versions.set(strategy.version, strategy);
    byKey.set(strategy.key, versions);
  }
  const latestVersion = (key: string): number | undefined => {
    const versions = byKey.get(key);
    return versions ? Math.max(...versions.keys()) : undefined;
  };
  return {
    byKey,
    getStrategy: (key, version) => byKey.get(key)?.get(version),
    latestVersion,
    latestVersions: () => new Map([...byKey.keys()].map((key) => [key, latestVersion(key) as number])),
    all: () => [...byKey.keys()].sort().flatMap((key) =>
      [...(byKey.get(key) as Map<number, UpgradeStrategy>).values()].sort((a, b) => a.version - b.version)),
  };
}

/** Thrown when a strategy file is invalid. */
export class StrategyRegistryError extends Error {
  constructor(readonly problems: StrategyFileProblem[]) {
    super(`Invalid Strategy_Definition_File(s): ${formatProblems(problems).join('; ')}`);
    this.name = 'StrategyRegistryError';
  }
}

function formatProblems(problems: readonly StrategyFileProblem[]): string[] {
  return problems.flatMap((problem) => problem.issues.map((issue) => {
    const where = issue.position !== undefined ? ` (goal ${issue.position})` : '';
    return `${problem.file}${where}: ${issue.message}`;
  }));
}

/** Load the registry from `directory`; throws `StrategyRegistryError` on any invalid file. */
export function loadStrategyRegistry(options: StrategyRegistryOptions & { directory?: string }): StrategyRegistry {
  const load = readStrategyDirectory(options.directory);
  if (load.problems.length > 0) throw new StrategyRegistryError(load.problems);
  return createStrategyRegistry(load.definitions.map((definition) => interpretStrategy(definition, options)));
}

export interface StoredStrategyVersion {
  strategyKey: string;
  strategyVersion: number;
}

export interface StrategyStartupCheck {
  passed: boolean;
  /** Number of valid Strategy_Definition_Files. */
  strategyFiles: number;
  /** One line per problem, safe to log. */
  problems: string[];
}

/** Validate the directory and that every stored version has a file (pure apart from reading the directory). */
export function checkStrategyDirectory(
  storedVersions: readonly StoredStrategyVersion[],
  directory: string = STRATEGY_DIRECTORY,
): StrategyStartupCheck {
  const load = readStrategyDirectory(directory);
  const problems = formatProblems(load.problems);
  const available = new Set(load.definitions.map((d) => `${d.key}.v${d.version}`));
  const missing = new Set<string>();
  for (const stored of storedVersions) {
    const name = `${stored.strategyKey}.v${stored.strategyVersion}`;
    if (!available.has(name)) missing.add(name);
  }
  for (const name of [...missing].sort()) {
    problems.push(`${name}.json: an Automaton_Profile uses this Strategy_Version but the file is missing`);
  }
  return { passed: problems.length === 0, strategyFiles: load.definitions.length, problems };
}

export interface StrategyStartupCheckOptions {
  /** Distinct `(strategyKey, strategyVersion)` pairs stored on Automaton_Profiles. */
  listStoredVersions(): Promise<StoredStrategyVersion[]>;
  directory?: string;
  alert?: (message: string) => Promise<unknown>;
}

/**
 * Server-start check (R6.2, R6.6). Logs and alerts on failure; the caller
 * exits. When the stored versions cannot be read (database unreachable at
 * boot), only the files are checked and a warning is logged: the server
 * already starts without a database today, and a missing version is still
 * caught at turn time (`failed` / `invalid_parameters` plus an alert, R6.6).
 */
export async function runStrategyStartupCheck(options: StrategyStartupCheckOptions): Promise<StrategyStartupCheck> {
  let storedVersions: StoredStrategyVersion[] = [];
  try {
    storedVersions = await options.listStoredVersions();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[strategy-startup-check] Could not read stored strategy versions; checking files only: ${message}`);
  }
  const result = checkStrategyDirectory(storedVersions, options.directory);
  if (!result.passed) {
    const message = `🚨 STARTUP FAILED: Strategy_Definition_File check failed: ${result.problems.join('; ')}. Server did not start.`;
    logger.error(`[strategy-startup-check] CRITICAL: ${message}`);
    // Once per failure, not once per PM2 restart (startupAlert.ts).
    await (options.alert ?? ((m: string): Promise<boolean> => sendStartupFailureAlert(m)))(message);
    return result;
  }
  logger.info(`[strategy-startup-check] ${result.strategyFiles} strategy file(s) valid; every stored version has a file.`);
  return result;
}
