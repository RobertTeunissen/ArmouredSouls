/**
 * Repository Automaton_Catalogue (Spec #55, R3.4, R10.1, R10.2, R10.9,
 * task 8.6; Spec #57 R3.4, R4.2, R5.1): every Catalogue_Entry in the folder —
 * the Starter_Stables plus the Expansion_Stables, whatever their number — is
 * valid against the catalogue schema with the seed weapon catalogue, every
 * blueprint has a Refinement_Plan that covers each non-shield weapon of its
 * final stage and passes the shared refinement validators per weapon, and
 * Catalogue_Keys, stable names (case-insensitive), robot names and team names
 * are unique across all entries. Counts are derived from the folder.
 */
import fs from 'fs';
import path from 'path';
import {
  CATALOGUE_DIRECTORY,
  blueprintRuleIssues,
  loadCatalogueDirectory,
  type CatalogueEntry,
} from '../automatonCatalogueService';
import { SEED_WEAPON_MAP } from '../strategies/__tests__/helpers/strategyTestSupport';
import {
  STARTER_CATALOGUE_KEYS,
  crossEntryDuplicates,
  repositoryStrategies,
  seedCatalogueContext,
  validEntry,
} from './helpers/catalogueTestSupport';

const load = loadCatalogueDirectory(seedCatalogueContext());
const entries = load.entries.map((loaded) => loaded.entry);
const files = fs.readdirSync(CATALOGUE_DIRECTORY).filter((file) => file.endsWith('.json')).sort();

describe('repository Automaton_Catalogue (R10.1, Spec #57 R4.2)', () => {
  it('every file is valid (schema, weapons, strategies, Team_Names, Event_Order, Refinement_Plans)', () => {
    expect(load.problems).toEqual([]);
  });

  it('loads one Catalogue_Entry per file in the folder', () => {
    expect(entries).toHaveLength(files.length);
    expect(entries.map((entry) => `${entry.catalogueKey}.json`).sort()).toEqual(files);
  });

  it('holds every approved Starter_Stable', () => {
    const keys = new Set(entries.map((entry) => entry.catalogueKey));
    expect(STARTER_CATALOGUE_KEYS.filter((key) => !keys.has(key))).toEqual([]);
  });

  it('numbers the blueprint slots 1..n per stable', () => {
    for (const entry of entries) {
      expect(entry.blueprints.map((b) => b.slot)).toEqual(entry.blueprints.map((_b, i) => i + 1));
    }
  });

  it('stores no image field anywhere (R10.2, decision 28)', () => {
    for (const file of files) {
      const text = fs.readFileSync(path.join(CATALOGUE_DIRECTORY, file), 'utf8');
      expect(text).not.toMatch(/image/i);
    }
  });

  it('every blueprint has a Refinement_Plan with a step on each non-shield final weapon (decision 35)', () => {
    for (const entry of entries) {
      for (const blueprint of entry.blueprints) {
        expect(blueprint.refinementPlan.length).toBeGreaterThan(0);
        const final = blueprint.weaponPath[blueprint.weaponPath.length - 1];
        const hands = [['main', final.main], ['offhand', final.offhand]] as const;
        for (const [hand, name] of hands) {
          if (name === undefined) continue;
          if (SEED_WEAPON_MAP.get(name)?.handsRequired === 'shield') continue;
          expect(blueprint.refinementPlan.some((step) => step.hand === hand)).toBe(true);
        }
        expect(blueprintRuleIssues(blueprint, SEED_WEAPON_MAP)).toEqual([]);
      }
    }
  });

  it('keeps Catalogue_Keys, stable, robot and team names unique across the catalogue (Spec #57 R5.1)', () => {
    expect(crossEntryDuplicates(entries)).toEqual([]);
  });

  it('resolves every entry\'s strategy in the repository strategies', () => {
    const unresolved = entries
      .filter((entry) => repositoryStrategies().getStrategy(entry.strategy.key, entry.strategy.version) === undefined)
      .map((entry) => `${entry.catalogueKey}: ${entry.strategy.key} v${entry.strategy.version}`);
    expect(unresolved).toEqual([]);
  });

  it('keeps the approved starter strategies and Goal_Target overrides (decisions 21, 30)', () => {
    const starterKeys: readonly string[] = STARTER_CATALOGUE_KEYS;
    const strategies = Object.fromEntries(entries
      .filter((entry) => starterKeys.includes(entry.catalogueKey))
      .map((entry) => [entry.catalogueKey, entry.strategy]));
    expect(strategies).toEqual({
      'autobots-ark': { key: 'generalist', version: 1, targetOverrides: { 14: 3 } },
      'clone-legion': { key: 'swarm', version: 1, targetOverrides: {} },
      'dalek-empire': { key: 'swarm', version: 1, targetOverrides: {} },
      'decepticon-armada': { key: 'trio', version: 1, targetOverrides: {} },
      'jaeger-corps': { key: 'duo', version: 1, targetOverrides: {} },
      'light-labs': { key: 'duo', version: 1, targetOverrides: {} },
      'planet-express': { key: 'tycoon', version: 1, targetOverrides: {} },
      'robocop-precinct': { key: 'paragon', version: 1, targetOverrides: {} },
      'skynet-terminators': { key: 'paragon', version: 1, targetOverrides: {} },
      'white-base': { key: 'trio', version: 1, targetOverrides: {} },
      'world-robot-boxing': { key: 'tycoon', version: 1, targetOverrides: { 20: 3 } },
    });
  });
});

describe('cross-entry uniqueness fixtures (Spec #57 R5.1)', () => {
  const alpha = validEntry({ catalogueKey: 'alpha-works', stableName: 'Alpha Works' });
  const beta = (overrides: Partial<CatalogueEntry> = {}): CatalogueEntry => validEntry({
    catalogueKey: 'beta-works',
    stableName: 'Beta Works',
    teamNames: { twoVsTwo: ['Beta Pair'], threeVsThree: [] },
    blueprints: validEntry().blueprints.map((b) => ({ ...b, robotName: `Beta ${b.robotName}` })),
    ...overrides,
  });

  it('accepts two entries with distinct keys and names', () => {
    expect(crossEntryDuplicates([alpha, beta()])).toEqual([]);
  });

  it.each([
    ['the same Catalogue_Key', { catalogueKey: 'alpha-works' }, 'Catalogue_Key "alpha-works"'],
    ['a stable name differing only in case', { stableName: 'ALPHA works' }, 'stable name "ALPHA works"'],
    ['the same robot name', { blueprints: validEntry().blueprints.map((b, i) => ({ ...b, robotName: i === 0 ? 'Test Hammer' : `Beta ${b.robotName}` })) }, 'robot name "Test Hammer"'],
    ['the same team name', { teamNames: { twoVsTwo: ['Test Pair'], threeVsThree: [] } }, 'team name "Test Pair"'],
  ] as const)('rejects %s, naming both entries', (_case, overrides, value) => {
    const other = beta(overrides as Partial<CatalogueEntry>);
    const problems = crossEntryDuplicates([alpha, other]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(value);
    expect(problems[0]).toContain('alpha-works ("Alpha Works")');
    expect(problems[0]).toContain(`${other.catalogueKey} ("${other.stableName}")`);
  });
});
