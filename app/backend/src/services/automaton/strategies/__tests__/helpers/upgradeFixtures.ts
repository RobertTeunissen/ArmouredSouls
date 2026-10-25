/**
 * Strategy_Version upgrade fixtures (Spec #55 tasks 9.9, 9.10). Not a test
 * file.
 *
 * `duoV2Definition()` is Duo v1 with two changes, so a migration shows every
 * change kind and both rejections:
 *
 * - Goal 13 (robots) bounds 2–3 → 3–4, default 4: a stored 2 is clamped to 3,
 *   so a stable with fewer than 3 buildable blueprints fails R3.7; the highest
 *   robots bound becomes 4, so a stable with 4 or more blueprints needs a
 *   second 2v2 team name (R3.6);
 * - Goal 15 (Weapons Workshop L3) is replaced by a Roster Expansion goal: one
 *   Goal removed, one new.
 *
 * Both take an optional `key`, so an integration suite can run an "all"
 * upgrade on a strategy key no other profile on the shared database uses.
 */
import { BUILD_FOCUS_WEIGHTS } from '../../../buildFocus';
import { getStrategyRegistry } from '../../defaultRegistry';
import { createStrategyRegistry, interpretStrategy, type StrategyRegistry } from '../../registry';
import type { StrategyDefinitionFile } from '../../strategyTypes';

export function duoV1Definition(key = 'duo'): StrategyDefinitionFile {
  const duo = getStrategyRegistry().getStrategy('duo', 1);
  if (!duo) throw new Error('duo.v1.json is missing');
  return { ...structuredClone(duo.definition), key };
}

export function duoV2Definition(key = 'duo'): StrategyDefinitionFile {
  const definition = duoV1Definition(key);
  definition.version = 2;
  definition.buildOrder = definition.buildOrder.map((entry) => {
    if (entry.position === 13) return { ...entry, defaultTarget: 4, bounds: { min: 3, max: 4 } };
    if (entry.position === 15) return { ...entry, goal: { type: 'facility', facilityType: 'roster_expansion' }, defaultTarget: 2, bounds: { min: 0, max: 10 } };
    return entry;
  });
  return definition;
}

/**
 * The repository registry plus the given definitions (default: the synthetic
 * Duo v2 above). A given definition replaces a repository file of the same
 * key and version (the repository has its own `duo.v2.json`), and any later
 * repository version of that key is left out, so the synthetic version is the
 * latest one, as these suites assume.
 */
export function registryWith(definitions: readonly StrategyDefinitionFile[] = [duoV2Definition()]): StrategyRegistry {
  const base = getStrategyRegistry();
  const replaced = (key: string, version: number): boolean =>
    definitions.some((definition) => definition.key === key && version >= definition.version);
  return createStrategyRegistry([
    ...base.all().filter((strategy) => !replaced(strategy.key, strategy.version)),
    ...definitions.map((definition) => interpretStrategy(definition, { weightTable: BUILD_FOCUS_WEIGHTS })),
  ]);
}

/** The repository registry plus Duo v2. */
export function registryWithDuoV2(): StrategyRegistry {
  return registryWith();
}
