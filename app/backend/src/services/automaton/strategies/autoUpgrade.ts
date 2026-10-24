/**
 * Automatic Strategy_Version upgrades (product owner, 24 October 2026).
 *
 * Every Automaton_Profile, draft or active, runs the latest version of its
 * strategy: a deploy that adds `{key}.v{n+1}.json` upgrades every profile of
 * that key on an older version. The ACC deploy runs this after Catalogue_Sync
 * (`pnpm run automaton:upgrade`), so drafts the sync just inserted are
 * upgraded too.
 *
 * It reuses the Strategy_Library upgrade (`confirmUpgrade`): targets migrate
 * by Goal type and occurrence, each profile in its own transaction under a
 * row lock, and a profile whose migrated targets break its own rules
 * (R3.6, R3.7) stays on its version and raises one
 * `automaton_upgrade_rejected` alert (decision 37). The strategy key is never
 * changed: moving a stable to another strategy stays an admin edit (Editor →
 * strategy), which pins the latest version of the new key.
 *
 * Idempotent: once every profile is on its latest version it writes nothing.
 */
import prisma from '../../../lib/prisma';
import logger from '../../../config/logger';
import { getStrategyRegistry } from './defaultRegistry';
import type { StrategyRegistry } from './registry';
import { confirmUpgrade, dryRunUpgrade, type RejectedProfile, type UpgradedProfile } from './strategyUpgradeService';

export interface AutoUpgradeOptions {
  registry?: StrategyRegistry;
  /** Report what would change and write nothing. */
  dryRun?: boolean;
  /** Tests on a shared database: limit to these Catalogue_Keys. */
  catalogueKeyFilter?: (catalogueKey: string) => boolean;
}

export interface AutoUpgradeStrategyResult {
  strategyKey: string;
  toVersion: number;
  upgraded: UpgradedProfile[];
  rejected: RejectedProfile[];
  /** Dry run: profiles that would be upgraded. */
  wouldUpgrade: string[];
}

export interface AutoUpgradeResult {
  dryRun: boolean;
  strategies: AutoUpgradeStrategyResult[];
  upgradedCount: number;
  rejectedCount: number;
}

/** Profiles on an older version than the latest of their strategy, by strategy key. */
async function outdatedProfiles(registry: StrategyRegistry, filter: (catalogueKey: string) => boolean): Promise<Map<string, string[]>> {
  const rows = await prisma.automatonProfile.findMany({
    select: { catalogueKey: true, strategyKey: true, strategyVersion: true },
    orderBy: { catalogueKey: 'asc' },
  });
  const byKey = new Map<string, string[]>();
  for (const row of rows) {
    const latest = registry.latestVersion(row.strategyKey);
    if (latest === undefined || row.strategyVersion >= latest || !filter(row.catalogueKey)) continue;
    byKey.set(row.strategyKey, [...(byKey.get(row.strategyKey) ?? []), row.catalogueKey]);
  }
  return byKey;
}

/** Upgrade every profile to the latest version of its strategy (see the file comment). */
export async function upgradeProfilesToLatest(options: AutoUpgradeOptions = {}): Promise<AutoUpgradeResult> {
  const registry = options.registry ?? getStrategyRegistry();
  const outdated = await outdatedProfiles(registry, options.catalogueKeyFilter ?? ((): boolean => true));
  const strategies: AutoUpgradeStrategyResult[] = [];

  for (const strategyKey of [...outdated.keys()].sort()) {
    const toVersion = registry.latestVersion(strategyKey) as number;
    const catalogueKeys = outdated.get(strategyKey) as string[];
    if (options.dryRun) {
      const dryRun = await dryRunUpgrade(strategyKey, { toVersion, catalogueKeys }, { registry });
      strategies.push({
        strategyKey,
        toVersion,
        upgraded: [],
        rejected: dryRun.profiles.filter((p) => p.rejection).map((p) => ({
          catalogueKey: p.catalogueKey, stableName: p.stableName, fromVersion: p.fromVersion, ...(p.rejection as NonNullable<typeof p.rejection>),
        })),
        wouldUpgrade: dryRun.profiles.filter((p) => p.passes).map((p) => p.catalogueKey),
      });
      continue;
    }
    const confirmation = await confirmUpgrade(strategyKey, { toVersion, catalogueKeys, confirm: true }, { registry });
    for (const profile of confirmation.upgraded) {
      logger.info(`[automaton-upgrade] ${profile.catalogueKey}: ${strategyKey} v${profile.fromVersion} → v${profile.toVersion}`);
    }
    strategies.push({ strategyKey, toVersion, upgraded: confirmation.upgraded, rejected: confirmation.rejected, wouldUpgrade: [] });
  }

  return {
    dryRun: options.dryRun ?? false,
    strategies,
    upgradedCount: strategies.reduce((sum, s) => sum + s.upgraded.length, 0),
    rejectedCount: strategies.reduce((sum, s) => sum + s.rejected.length, 0),
  };
}

/** Summary lines of a run (no secrets: Catalogue_Keys, versions and error codes only). */
export function formatAutoUpgradeSummary(result: AutoUpgradeResult): string[] {
  if (result.strategies.length === 0) return ['Automaton upgrade: every profile is on the latest version of its strategy.'];
  const lines: string[] = [];
  for (const s of result.strategies) {
    const done = result.dryRun ? `${s.wouldUpgrade.length} would be upgraded` : `${s.upgraded.length} upgraded`;
    lines.push(`Automaton upgrade${result.dryRun ? ' (dry run)' : ''}: ${s.strategyKey} → v${s.toVersion}: ${done}, ${s.rejected.length} rejected`);
    for (const r of s.rejected) lines.push(`  rejected ${r.catalogueKey} (v${r.fromVersion}): ${r.code}: ${r.reason}`);
  }
  return lines;
}

export interface AutoUpgradeCliIo {
  out(line: string): void;
  err(line: string): void;
}

const defaultIo: AutoUpgradeCliIo = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

/**
 * `pnpm run automaton:upgrade [--dry-run]`. Exit 0 also when profiles were
 * rejected (they stay on their version and are alerted); 1 on an unknown
 * argument.
 */
export async function runAutoUpgradeCli(argv: readonly string[], io: AutoUpgradeCliIo = defaultIo): Promise<number> {
  const unknown = argv.filter((arg) => arg !== '--dry-run' && arg !== '--');
  if (unknown.length > 0) {
    io.err(`Unknown argument(s): ${unknown.join(' ')}. Usage: pnpm run automaton:upgrade [--dry-run]`);
    return 1;
  }
  const result = await upgradeProfilesToLatest({ dryRun: argv.includes('--dry-run') });
  for (const line of formatAutoUpgradeSummary(result)) io.out(line);
  return 0;
}
