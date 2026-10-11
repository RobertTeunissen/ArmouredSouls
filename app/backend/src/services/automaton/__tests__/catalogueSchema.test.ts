/**
 * Repository Automaton_Catalogue (Spec #55, R3.4, R10.1, R10.2, R10.9,
 * task 8.6): exactly the 11 approved starter Catalogue_Entries, each valid
 * against the catalogue schema with the seed weapon catalogue, and every
 * blueprint with a Refinement_Plan that covers each non-shield weapon of its
 * final stage and passes the shared refinement validators per weapon.
 */
import fs from 'fs';
import path from 'path';
import {
  CATALOGUE_DIRECTORY,
  blueprintRuleIssues,
  loadCatalogueDirectory,
} from '../automatonCatalogueService';
import { SEED_WEAPON_MAP } from '../strategies/__tests__/helpers/strategyTestSupport';
import { STARTER_CATALOGUE_KEYS, seedCatalogueContext } from './helpers/catalogueTestSupport';

const load = loadCatalogueDirectory(seedCatalogueContext());
const entries = load.entries.map((loaded) => loaded.entry);

describe('repository Automaton_Catalogue (R10.1, R10.9)', () => {
  it('every file is valid (schema, weapons, strategies, Team_Names, Event_Order, Refinement_Plans)', () => {
    expect(load.problems).toEqual([]);
  });

  it('holds exactly the 11 approved starter stables', () => {
    const files = fs.readdirSync(CATALOGUE_DIRECTORY).filter((file) => file.endsWith('.json')).sort();
    expect(files).toEqual(STARTER_CATALOGUE_KEYS.map((key) => `${key}.json`));
    expect(entries.map((entry) => entry.catalogueKey)).toEqual([...STARTER_CATALOGUE_KEYS]);
  });

  it('has 50 blueprints with slots 1..n per stable', () => {
    expect(entries.reduce((sum, entry) => sum + entry.blueprints.length, 0)).toBe(50);
    for (const entry of entries) {
      expect(entry.blueprints.map((b) => b.slot)).toEqual(entry.blueprints.map((_b, i) => i + 1));
    }
  });

  it('stores no image field anywhere (R10.2, decision 28)', () => {
    for (const key of STARTER_CATALOGUE_KEYS) {
      const text = fs.readFileSync(path.join(CATALOGUE_DIRECTORY, `${key}.json`), 'utf8');
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

  it('keeps robot, team and stable names distinct across the catalogue (review/CATALOGUE.md §15)', () => {
    const robotNames = entries.flatMap((entry) => entry.blueprints.map((b) => b.robotName));
    const teamNames = entries.flatMap((entry) => [...entry.teamNames.twoVsTwo, ...entry.teamNames.threeVsThree]);
    const stableNames = entries.map((entry) => entry.stableName);
    expect(new Set(robotNames).size).toBe(50);
    expect(new Set(teamNames).size).toBe(teamNames.length);
    expect(teamNames).toHaveLength(35);
    expect(new Set(stableNames).size).toBe(11);
  });

  it('uses the approved strategies and Goal_Target overrides (decisions 21, 30)', () => {
    const strategies = Object.fromEntries(entries.map((entry) => [entry.catalogueKey, entry.strategy]));
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
