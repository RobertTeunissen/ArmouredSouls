/**
 * Catalogue_Upgrade: move Catalogue_Entries to the latest version of their
 * strategy, so the repository catalogue matches what automatic upgrades
 * (`strategies/autoUpgrade.ts`) do to the profiles.
 *
 *   pnpm run automaton:catalogue-upgrade [--dry-run]
 *
 * A Catalogue_Entry stores its Goal_Target overrides by Goal position, and
 * positions move between versions. Each override is therefore carried by Goal
 * type and occurrence (`migrateTargets`, the rule profile upgrades use): the
 * second Robots Goal of v1 maps to the second Robots Goal of v2, wherever it
 * sits. Goals without an override take the new version's default. An
 * override whose Goal no longer exists or whose value falls outside the new
 * bounds stops the upgrade of that file, so nothing is silently changed.
 *
 * Only the `strategy` member of a file is rewritten; the rest of the file,
 * including its formatting, stays as it is. `catalogueUpgrade.test.ts` fails
 * while any repository entry is on an older version.
 */
import fs from 'fs';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import { CATALOGUE_DIRECTORY, strategyIssues, type CatalogueEntry } from './automatonCatalogueService';
import { targetOverrides } from './catalogueExport';
import { migrateTargets } from './strategies/migrateTargets';
import { getStrategyRegistry } from './strategies/defaultRegistry';
import type { StrategyRegistry } from './strategies/registry';
import { defaultParameters } from './strategies/strategyParameters';

export type CatalogueStrategy = CatalogueEntry['strategy'];

export type CatalogueStrategyUpgrade =
  | { kind: 'current' }
  | { kind: 'upgraded'; strategy: CatalogueStrategy }
  | { kind: 'invalid'; problems: string[] };

/** The latest-version `strategy` member of an entry, its overrides carried by Goal type and occurrence. */
export function upgradeCatalogueStrategy(strategy: CatalogueStrategy, registry: StrategyRegistry): CatalogueStrategyUpgrade {
  const latestVersion = registry.latestVersion(strategy.key);
  if (latestVersion === undefined) return { kind: 'invalid', problems: [`Strategy "${strategy.key}" does not exist.`] };
  if (strategy.version >= latestVersion) return { kind: 'current' };

  const resolution = strategyIssues({ strategy }, registry);
  if (!resolution.strategy || !resolution.parameters || resolution.issues.length > 0) {
    return { kind: 'invalid', problems: resolution.issues.map((issue) => issue.message) };
  }
  const from = resolution.strategy;
  const to = registry.getStrategy(strategy.key, latestVersion);
  if (!to) return { kind: 'invalid', problems: [`Strategy ${strategy.key} v${latestVersion} does not exist.`] };

  const overridden = new Set(from.buildOrder
    .filter((spec) => Object.hasOwn(strategy.targetOverrides, String(spec.position)))
    .map((spec) => spec.id));
  const migration = migrateTargets(from.buildOrder, to.buildOrder, resolution.parameters);
  const params = defaultParameters(to.buildOrder);
  const problems: string[] = [];
  for (const change of migration.changes) {
    if (change.fromGoalId === null || !overridden.has(change.fromGoalId)) continue;
    if (change.status === 'removed' || change.toGoalId === null) {
      problems.push(`The override of ${change.fromGoalId} has no Goal in ${strategy.key} v${latestVersion}.`);
      continue;
    }
    if (change.status === 'clamped') {
      problems.push(`The override of ${change.fromGoalId} (${change.oldTarget}) is outside the bounds of ${change.toGoalId}.`);
      continue;
    }
    params.targets[change.toGoalId] = change.newTarget as number;
  }
  if (problems.length > 0) return { kind: 'invalid', problems };
  return {
    kind: 'upgraded',
    strategy: { key: strategy.key, version: latestVersion, targetOverrides: targetOverrides(strategy.key, latestVersion, params, registry) },
  };
}

const COMPACT_STRATEGY = /"strategy": \{ "key": "[a-z0-9-]+", "version": \d+, "targetOverrides": \{[^{}]*\} \}/;

function compactStrategy(strategy: CatalogueStrategy): string {
  const entries = Object.entries(strategy.targetOverrides)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([position, target]) => `"${position}": ${target}`);
  const overrides = entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
  return `"strategy": { "key": "${strategy.key}", "version": ${strategy.version}, "targetOverrides": ${overrides} }`;
}

/**
 * The file text with its `strategy` member replaced. Supports the two layouts
 * of the catalogue: two-space `JSON.stringify` output (rewritten whole) and
 * the starter files' one-line `"strategy": { … }`. Throws for any other
 * layout rather than reformatting a reviewed file.
 */
export function rewriteCatalogueStrategy(text: string, strategy: CatalogueStrategy): string {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  let next: string;
  if (`${JSON.stringify(parsed, null, 2)}\n` === text) {
    next = `${JSON.stringify({ ...parsed, strategy: { ...strategy, targetOverrides: { ...strategy.targetOverrides } } }, null, 2)}\n`;
  } else if (COMPACT_STRATEGY.test(text)) {
    next = text.replace(COMPACT_STRATEGY, compactStrategy(strategy));
  } else {
    throw new Error('Unrecognised Catalogue_Entry layout: the strategy member could not be rewritten in place.');
  }
  const written = (JSON.parse(next) as { strategy: unknown }).strategy;
  if (!isDeepStrictEqual(written, strategy)) throw new Error('Rewriting the strategy member did not produce the expected value.');
  return next;
}

export interface CatalogueUpgradeFileResult {
  file: string;
  catalogueKey: string;
  outcome: 'current' | 'upgraded' | 'invalid';
  from?: CatalogueStrategy;
  to?: CatalogueStrategy;
  problems?: string[];
}

/** Upgrade every file of `directory` (writes only without `dryRun`, and only when no file is invalid). */
export function upgradeCatalogueDirectory(
  options: { directory?: string; registry?: StrategyRegistry; dryRun?: boolean } = {},
): CatalogueUpgradeFileResult[] {
  const directory = options.directory ?? CATALOGUE_DIRECTORY;
  const registry = options.registry ?? getStrategyRegistry();
  const results: (CatalogueUpgradeFileResult & { text?: string })[] = [];
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort()) {
    const text = fs.readFileSync(path.join(directory, file), 'utf8');
    const entry = JSON.parse(text) as CatalogueEntry;
    const upgrade = upgradeCatalogueStrategy(entry.strategy, registry);
    if (upgrade.kind === 'current') {
      results.push({ file, catalogueKey: entry.catalogueKey, outcome: 'current' });
    } else if (upgrade.kind === 'invalid') {
      results.push({ file, catalogueKey: entry.catalogueKey, outcome: 'invalid', problems: upgrade.problems });
    } else {
      results.push({
        file, catalogueKey: entry.catalogueKey, outcome: 'upgraded', from: entry.strategy, to: upgrade.strategy,
        text: rewriteCatalogueStrategy(text, upgrade.strategy),
      });
    }
  }
  const anyInvalid = results.some((r) => r.outcome === 'invalid');
  if (!options.dryRun && !anyInvalid) {
    for (const result of results) {
      if (result.text !== undefined) fs.writeFileSync(path.join(directory, result.file), result.text);
    }
  }
  return results.map(({ text: _text, ...result }) => result);
}

/** `pnpm run automaton:catalogue-upgrade [--dry-run]`: 1 on an unknown argument or an invalid file (nothing written). */
export function runCatalogueUpgradeCli(
  argv: readonly string[],
  io: { out(line: string): void; err(line: string): void } = {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  },
): number {
  const unknown = argv.filter((arg) => arg !== '--dry-run' && arg !== '--');
  if (unknown.length > 0) {
    io.err(`Unknown argument(s): ${unknown.join(' ')}. Usage: pnpm run automaton:catalogue-upgrade [--dry-run]`);
    return 1;
  }
  const dryRun = argv.includes('--dry-run');
  const results = upgradeCatalogueDirectory({ dryRun });
  const invalid = results.filter((r) => r.outcome === 'invalid');
  for (const r of invalid) io.err(`${r.file}: ${(r.problems ?? []).join('; ')}`);
  if (invalid.length > 0) {
    io.err('Catalogue_Upgrade aborted: nothing was written.');
    return 1;
  }
  const upgraded = results.filter((r) => r.outcome === 'upgraded');
  for (const r of upgraded) {
    io.out(`${r.file}: ${r.from?.key} v${r.from?.version} ${JSON.stringify(r.from?.targetOverrides)} → v${r.to?.version} ${JSON.stringify(r.to?.targetOverrides)}`);
  }
  io.out(`Catalogue_Upgrade${dryRun ? ' (dry run)' : ''}: ${upgraded.length} upgraded, ${results.length - upgraded.length} already current.`);
  return 0;
}
