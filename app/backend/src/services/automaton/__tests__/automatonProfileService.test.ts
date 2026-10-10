/**
 * Automaton_Profile edit rules (Spec #55, R2.3, R3.2–R3.7, R6.4, R6.5,
 * task 9.1): the pure checks the admin profile service runs inside its
 * transactions. The database paths (Activation, renames, live-robot rules,
 * audit) are in `tests/integration/automatonProfile.test.ts`.
 */
import { SUBSCRIBABLE_EVENT_TYPES } from '../../subscription/eventRegistry';
import {
  blueprintIssues,
  issuesError,
  nextFreeSlot,
  profileIssues,
  resolveParameters,
  storedParameters,
  teamNamesIssuesFor,
  type BlueprintRecord,
  automatonUsername,
} from '../automatonProfileRules';
import type { CatalogueIssue } from '../automatonCatalogueService';
import { SEED_WEAPON_MAP } from '../strategies/__tests__/helpers/strategyTestSupport';
import { repositoryStrategies } from './helpers/catalogueTestSupport';

const registry = repositoryStrategies();
const paragon = registry.getStrategy('paragon', 1)!;
const duo = registry.getStrategy('duo', 1)!;

const HAMMER: BlueprintRecord = {
  slot: 1,
  robotName: 'Test Hammer',
  loadoutType: 'two_handed',
  stance: 'balanced',
  yieldThreshold: 10,
  buildFocus: 'bruiser',
  weaponPath: [{ main: 'Shock Maul' }, { main: 'Heavy Hammer' }],
  refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }],
};

const rules = (issues: readonly CatalogueIssue[]): string[] => issues.map((i) => i.rule);

describe('issuesError', () => {
  const tooFew: CatalogueIssue = { rule: 'blueprints_too_few', message: 'too few', path: [] };
  const count: CatalogueIssue = { rule: 'team_names_count', message: 'count', path: [] };
  const other: CatalogueIssue = { rule: 'weapon_unknown', message: 'unknown', path: [] };

  it('prefers AUTOMATON_BLUEPRINTS_TOO_FEW, then AUTOMATON_TEAM_NAMES_MISMATCH, else AUTOMATON_CATALOGUE_INVALID', () => {
    expect(issuesError([other, count, tooFew]).code).toBe('AUTOMATON_BLUEPRINTS_TOO_FEW');
    expect(issuesError([other, count]).code).toBe('AUTOMATON_TEAM_NAMES_MISMATCH');
    expect(issuesError([other]).code).toBe('AUTOMATON_CATALOGUE_INVALID');
  });

  it('is a 400 with the leading issue as message and every issue in details', () => {
    const error = issuesError([other, count]);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('count');
    expect(error.details).toEqual({ issues: [other, count] });
  });
});

describe('blueprintIssues', () => {
  it('accepts a valid blueprint', () => {
    expect(blueprintIssues(HAMMER, [HAMMER], SEED_WEAPON_MAP)).toEqual([]);
  });

  it('rejects an image or any unknown key (strict, R3.2)', () => {
    const withImage = { ...HAMMER, imageUrl: '/uploads/automatons/x/y.webp' } as BlueprintRecord;
    expect(rules(blueprintIssues(withImage, [], SEED_WEAPON_MAP))).toEqual(['schema']);
  });

  it('rejects a yield above 50 and an unknown Build_Focus', () => {
    expect(rules(blueprintIssues({ ...HAMMER, yieldThreshold: 51 }, [], SEED_WEAPON_MAP))).toEqual(['schema']);
    expect(rules(blueprintIssues({ ...HAMMER, buildFocus: 'tank' as BlueprintRecord['buildFocus'] }, [], SEED_WEAPON_MAP))).toEqual(['schema']);
  });

  it('rejects a robot name another blueprint of the stable uses', () => {
    const other = { ...HAMMER, slot: 2 };
    expect(rules(blueprintIssues(HAMMER, [HAMMER, other], SEED_WEAPON_MAP))).toEqual(['robot_name_duplicate']);
  });

  it('rejects a slot outside 1–11', () => {
    expect(rules(blueprintIssues({ ...HAMMER, slot: 12 }, [], SEED_WEAPON_MAP))).toEqual(['blueprint_slot']);
  });

  it('checks a loadout change against the Weapon_Path and Refinement_Plan (merged blueprint)', () => {
    const changed = rules(blueprintIssues({ ...HAMMER, loadoutType: 'weapon_shield' }, [], SEED_WEAPON_MAP));
    expect(changed).toContain('weapon_loadout');
  });

  it('rejects a final weapon without a refinement step (decision 35)', () => {
    expect(rules(blueprintIssues({ ...HAMMER, refinementPlan: [] }, [], SEED_WEAPON_MAP))).toEqual(['refinement_missing']);
  });
});

describe('resolveParameters', () => {
  it('merges targets over the defaults and accepts targets within bounds', () => {
    const goal = paragon.buildOrder.find((d) => d.type === 'robots' && d.bounds.max === 2)!;
    const result = resolveParameters(paragon, null, { [goal.id]: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.params.targets[goal.id]).toBe(2);
  });

  it('keeps stored targets for a parameter update', () => {
    const goal = paragon.buildOrder.find((d) => d.type === 'robots' && d.bounds.max === 2)!;
    const stored = resolveParameters(paragon, null, { [goal.id]: 2 });
    if (!stored.ok) throw new Error('setup');
    const again = resolveParameters(paragon, stored.params, {});
    expect(again.ok && again.params.targets[goal.id]).toBe(2);
  });

  it('rejects an out-of-bounds target with the Goal position (R6.4)', () => {
    const goal = paragon.buildOrder.find((d) => d.type === 'robots' && d.bounds.max === 2)!;
    const result = resolveParameters(paragon, null, { [goal.id]: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(rules(result.issues)).toEqual(['target_out_of_bounds']);
      expect(result.issues[0].message).toContain(`Goal ${goal.position} (Robots)`);
    }
  });

  it('rejects a Goal id of another strategy', () => {
    const result = resolveParameters(paragon, null, { 'swarm.v1.01.robots': 2 });
    expect(!result.ok && rules(result.issues)).toEqual(['target_override']);
  });

  it('drops Goal ids of another version from a stored base', () => {
    const result = resolveParameters(paragon, { targets: { 'old.v1.01.robots': 4 } });
    expect(result.ok && Object.keys(result.params.targets).every((id) => id.startsWith('paragon.v1.'))).toBe(true);
  });

  it('storedParameters returns null for targets that fail the version', () => {
    expect(storedParameters(paragon, { targets: {} })).toBeNull();
    const defaults = resolveParameters(paragon, null);
    expect(defaults.ok && storedParameters(paragon, defaults.params)).toEqual(defaults.ok ? defaults.params : null);
  });
});

describe('profileIssues (Activation, R2.3)', () => {
  const base = () => {
    const resolved = resolveParameters(paragon, null);
    if (!resolved.ok) throw new Error('setup');
    return {
      strategy: paragon,
      params: resolved.params,
      blueprints: [HAMMER],
      teamNames: { twoVsTwo: [], threeVsThree: [] },
      eventOrder: [...SUBSCRIBABLE_EVENT_TYPES],
      weapons: SEED_WEAPON_MAP,
    };
  };

  it('accepts a valid draft', () => {
    expect(profileIssues(base())).toEqual([]);
  });

  it('rejects no blueprints, with too few blueprints for the robots target', () => {
    // Paragon has two robots Goals (default 1 each): both exceed 0 blueprints.
    expect(rules(profileIssues({ ...base(), blueprints: [] }))).toEqual(['blueprint_slot', 'blueprints_too_few', 'blueprints_too_few']);
  });

  it('rejects an incomplete Event_Order', () => {
    expect(rules(profileIssues({ ...base(), eventOrder: SUBSCRIBABLE_EVENT_TYPES.slice(1) }))).toEqual(['event_order']);
  });

  it('rejects a wrong Team_Names count with the approved message', () => {
    const issues = profileIssues({ ...base(), teamNames: { twoVsTwo: ['Extra Pair'], threeVsThree: [] } });
    expect(rules(issues)).toEqual(['team_names_count']);
    expect(issues[0].message).toBe('This stable needs 0 team names for 2v2 and 0 for 3v3.');
  });

  it('rejects a robots target above the blueprint count with the approved message (R3.7)', () => {
    const goal = paragon.buildOrder.find((d) => d.type === 'robots' && d.bounds.max === 2)!;
    const resolved = resolveParameters(paragon, null, { [goal.id]: 2 });
    if (!resolved.ok) throw new Error('setup');
    const issues = profileIssues({ ...base(), params: resolved.params });
    expect(rules(issues)).toEqual(['blueprints_too_few']);
    expect(issues[0].message).toBe(`Goal ${goal.position} targets 2 robots, but this stable has 1 blueprints. Add blueprints or lower the target.`);
  });
});

describe('teamNamesIssuesFor', () => {
  it('sizes Team_Names by min(highest robots bound, blueprints) (R3.6)', () => {
    expect(teamNamesIssuesFor(duo, 1, { twoVsTwo: [], threeVsThree: [] })).toEqual([]);
    expect(rules(teamNamesIssuesFor(duo, 2, { twoVsTwo: [], threeVsThree: [] }))).toEqual(['team_names_count']);
    expect(teamNamesIssuesFor(duo, 2, { twoVsTwo: ['Pair One'], threeVsThree: [] })).toEqual([]);
  });
});

describe('nextFreeSlot and usernames', () => {
  it('returns the lowest free slot, null when all 11 are taken', () => {
    expect(nextFreeSlot([])).toBe(1);
    expect(nextFreeSlot([1, 2, 4])).toBe(3);
    expect(nextFreeSlot([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBeNull();
  });

  it('builds the Activation username automaton_{catalogueKey} (R2.2)', () => {
    expect(automatonUsername('clone-legion')).toBe('automaton_clone-legion');
  });
});
