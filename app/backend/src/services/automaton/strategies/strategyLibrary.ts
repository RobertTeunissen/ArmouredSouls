/**
 * Strategy_Library read (Spec #55, R6.8, R6.9, design §14.0, §17.1
 * `GET /strategies`, task 9.8).
 *
 * Every strategy and version of the Strategy_Registry with its numbered
 * Build_Order (Goal, default target, bounds, what the Goal buys including its
 * Goal_Chain) and the number of Automaton_Profiles pinned to each version, so
 * the Library, Editor and Builder render without repeating a rule.
 */
import prisma from '../../../lib/prisma';
import { getStrategyRegistry } from './defaultRegistry';
import { describeBuildOrder, type BuildOrderDescriptor } from './strategyParameters';
import type { StrategyRegistry } from './registry';

export interface LibraryVersion {
  version: number;
  displayName: string;
  description: string;
  latest: boolean;
  /** Automaton_Profiles (drafts and active) on this version. */
  profileCount: number;
  buildOrder: BuildOrderDescriptor[];
}

export interface LibraryStrategy {
  key: string;
  /** Display name and description of the latest version. */
  displayName: string;
  description: string;
  latestVersion: number;
  profileCount: number;
  versions: LibraryVersion[];
}

export interface StrategyLibrary {
  strategies: LibraryStrategy[];
}

/** The Strategy_Library (R6.9): strategies by key, versions oldest first. */
export async function getStrategyLibrary(registry: StrategyRegistry = getStrategyRegistry()): Promise<StrategyLibrary> {
  const counts = await prisma.automatonProfile.groupBy({ by: ['strategyKey', 'strategyVersion'], _count: { _all: true } });
  const countOf = (key: string, version: number): number =>
    counts.find((c) => c.strategyKey === key && c.strategyVersion === version)?._count._all ?? 0;
  const strategies = [...registry.byKey.keys()].sort().map((key): LibraryStrategy => {
    const latestVersion = registry.latestVersion(key) as number;
    const versions = [...(registry.byKey.get(key)?.values() ?? [])]
      .sort((a, b) => a.version - b.version)
      .map((strategy): LibraryVersion => ({
        version: strategy.version,
        displayName: strategy.displayName,
        description: strategy.description,
        latest: strategy.version === latestVersion,
        profileCount: countOf(key, strategy.version),
        buildOrder: describeBuildOrder(strategy.buildOrder),
      }));
    const latest = versions[versions.length - 1];
    return {
      key,
      displayName: latest.displayName,
      description: latest.description,
      latestVersion,
      profileCount: versions.reduce((sum, v) => sum + v.profileCount, 0),
      versions,
    };
  });
  return { strategies };
}
