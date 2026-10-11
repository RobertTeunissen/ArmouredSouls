/**
 * Shared support for the Automaton_Catalogue suites (Spec #55, Spec #57). Not a test file.
 *
 * The repository catalogue is validated against the seed weapon catalogue
 * (`WEAPON_DEFINITIONS`, design §15.1: "against `WEAPON_DEFINITIONS` in the
 * CI test") and the repository strategy files. The cross-entry and image
 * helpers are pure, so the suites run them on the repository folders and on
 * small fixtures alike (Spec #57 R5.1, R5.2).
 */
import fs from 'fs';
import path from 'path';
import { BUILD_FOCUS_WEIGHTS } from '../../buildFocus';
import { loadStrategyRegistry, type StrategyRegistry } from '../../strategies/registry';
import { SEED_WEAPON_MAP } from '../../strategies/__tests__/helpers/strategyTestSupport';
import type { CatalogueContext, CatalogueEntry } from '../../automatonCatalogueService';

/**
 * The Starter_Stable Catalogue_Keys of spec-55 `review/CATALOGUE.md` (decision 32).
 * Spec 57 adds Expansion_Stables beside them, so the suites use this list only
 * for starter-specific checks (the starter-only Coverage_Matrix, the approved
 * starter strategies); every count is derived from the catalogue folder.
 */
export const STARTER_CATALOGUE_KEYS = [
  'autobots-ark',
  'clone-legion',
  'dalek-empire',
  'decepticon-armada',
  'jaeger-corps',
  'light-labs',
  'planet-express',
  'robocop-precinct',
  'skynet-terminators',
  'white-base',
  'world-robot-boxing',
] as const;

let registry: StrategyRegistry | undefined;

/** The repository strategies with the approved Build_Focus weights. */
export function repositoryStrategies(): StrategyRegistry {
  registry ??= loadStrategyRegistry({ weightTable: BUILD_FOCUS_WEIGHTS });
  return registry;
}

export function seedCatalogueContext(): CatalogueContext {
  return { weapons: SEED_WEAPON_MAP, strategies: repositoryStrategies() };
}

/**
 * Cross-entry uniqueness (Spec #57 R3.4, R5.1): Catalogue_Key (exact), stable
 * name (case-insensitive), robot name (exact) and team name (exact, 2v2 and
 * 3v3 together). Returns one message per repeat, naming the value and both
 * entries; an empty list means the entries are unique.
 */
export function crossEntryDuplicates(entries: readonly CatalogueEntry[]): string[] {
  const problems: string[] = [];
  const check = (label: string, values: (entry: CatalogueEntry) => string[], normalise: (value: string) => string = (v) => v): void => {
    const firstOwner = new Map<string, CatalogueEntry>();
    for (const entry of entries) {
      for (const value of values(entry)) {
        const normalised = normalise(value);
        const owner = firstOwner.get(normalised);
        if (owner === undefined) {
          firstOwner.set(normalised, entry);
        } else {
          problems.push(`${label} "${value}" in ${owner.catalogueKey} ("${owner.stableName}") and ${entry.catalogueKey} ("${entry.stableName}")`);
        }
      }
    }
  };
  check('Catalogue_Key', (entry) => [entry.catalogueKey]);
  check('stable name', (entry) => [entry.stableName], (value) => value.toLowerCase());
  check('robot name', (entry) => entry.blueprints.map((b) => b.robotName));
  check('team name', (entry) => [...entry.teamNames.twoVsTwo, ...entry.teamNames.threeVsThree]);
  return problems;
}

/** One visible file under an image directory; `key` is '' for a loose top-level file. */
export interface ImageFile {
  key: string;
  file: string;
  absolute: string;
}

const visible = (name: string): boolean => !name.startsWith('.');

/** Every visible file one folder deep under `dir` (hidden files such as `.DS_Store` are ignored). */
export function listImageFiles(dir: string): ImageFile[] {
  return fs.readdirSync(dir)
    .filter(visible)
    .sort()
    .flatMap((key) => {
      const folder = path.join(dir, key);
      if (!fs.statSync(folder).isDirectory()) return [{ key: '', file: key, absolute: folder }];
      return fs.readdirSync(folder).filter(visible).sort().map((file) => ({ key, file, absolute: path.join(folder, file) }));
    });
}

/**
 * Repository_Image naming rules (Spec #55 R10.2, Spec #57 R4.4, R5.2): no loose
 * file, every folder is a Catalogue_Key, every file is `{slot}.webp` for a
 * Blueprint_Slot of that entry. Missing images are allowed.
 */
export function imageFolderProblems(files: readonly ImageFile[], slotsByKey: ReadonlyMap<string, ReadonlySet<number>>): string[] {
  const problems: string[] = [];
  for (const f of files) {
    if (f.key === '') {
      problems.push(`${f.file}: loose file at the top level`);
      continue;
    }
    const slots = slotsByKey.get(f.key);
    if (slots === undefined) {
      problems.push(`${f.key}/${f.file}: folder has no Catalogue_Entry with this Catalogue_Key`);
      continue;
    }
    const match = /^(\d{1,2})\.webp$/.exec(f.file);
    if (match === null) {
      problems.push(`${f.key}/${f.file}: not named {slot}.webp`);
      continue;
    }
    const slot = Number(match[1]);
    if (!slots.has(slot)) {
      problems.push(`${f.key}/${f.file}: slot ${slot} is beyond the entry's blueprints (${[...slots].sort((a, b) => a - b).join(', ')})`);
    }
  }
  return problems;
}

/** A small valid Catalogue_Entry (Duo, two blueprints) for rule tests. */
export function validEntry(overrides: Partial<CatalogueEntry> = {}): CatalogueEntry {
  return {
    schemaVersion: 1,
    catalogueKey: 'test-stable',
    stableName: 'Test Stable',
    franchise: 'Test Franchise',
    backstory: 'A stable used by tests.',
    strategy: { key: 'duo', version: 1, targetOverrides: {} },
    teamNames: { twoVsTwo: ['Test Pair'], threeVsThree: [] },
    eventOrder: ['league_2v2', 'tag_team', 'tournament_2v2', 'league_1v1', 'koth', 'grand_melee', 'tournament_1v1', 'league_3v3', 'tournament_3v3'],
    blueprints: [
      {
        slot: 1,
        robotName: 'Test Hammer',
        loadoutType: 'two_handed',
        stance: 'balanced',
        yieldThreshold: 10,
        buildFocus: 'bruiser',
        weaponPath: [{ main: 'Shock Maul' }, { main: 'Heavy Hammer' }],
        refinementPlan: [
          { tier: 'sharpen', hand: 'main', magnitude: 1 },
          { tier: 'forge', hand: 'main', magnitude: 1 },
        ],
      },
      {
        slot: 2,
        robotName: 'Test Shield',
        loadoutType: 'weapon_shield',
        stance: 'defensive',
        yieldThreshold: 20,
        buildFocus: 'warden',
        weaponPath: [{ main: 'Laser Pistol', offhand: 'Light Shield' }, { main: 'Volt Sabre', offhand: 'Aegis Bulwark' }],
        refinementPlan: [
          { tier: 'sharpen', hand: 'main', magnitude: 1 },
          { tier: 'hone', hand: 'offhand', targetAttribute: 'evasionThrusters', magnitude: 1 },
        ],
      },
    ],
    ...overrides,
  };
}
