/**
 * Shared support for the Automaton_Catalogue suites (Spec #55). Not a test file.
 *
 * The repository catalogue is validated against the seed weapon catalogue
 * (`WEAPON_DEFINITIONS`, design §15.1: "against `WEAPON_DEFINITIONS` in the
 * CI test") and the repository strategy files.
 */
import { BUILD_FOCUS_WEIGHTS } from '../../buildFocus';
import { loadStrategyRegistry, type StrategyRegistry } from '../../strategies/registry';
import { SEED_WEAPON_MAP } from '../../strategies/__tests__/helpers/strategyTestSupport';
import type { CatalogueContext, CatalogueEntry } from '../../automatonCatalogueService';

/** The 11 starter Catalogue_Keys of `review/CATALOGUE.md` (decision 32). */
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
