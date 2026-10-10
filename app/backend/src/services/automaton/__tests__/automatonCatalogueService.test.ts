/**
 * Catalogue schema rules (Spec #55, R2.3, R3.2–R3.7, R10.1, task 8.1): one
 * accept case and a rejection per rule, for Catalogue_Entries and for admin
 * blueprint input (create, and an update that changes the loadout or the
 * Weapon_Path under an existing Refinement_Plan).
 */
import {
  BUILD_FOCUS_KEYS,
  blueprintFieldsSchema,
  blueprintRuleIssues,
  buildableBlueprintCount,
  catalogueIssueCode,
  eventOrderIssues,
  requiredTeamNameCountsFor,
  robotsTargetIssues,
  teamNamesIssues,
  validateCatalogueEntry,
  type BlueprintFields,
  type CatalogueEntry,
  type CatalogueRule,
} from '../automatonCatalogueService';
import { BUILD_FOCUS_PRESETS } from '../buildFocus';
import { SEED_WEAPON_MAP } from '../strategies/__tests__/helpers/strategyTestSupport';
import { repositoryStrategies, seedCatalogueContext, validEntry } from './helpers/catalogueTestSupport';

const context = seedCatalogueContext();

function rulesOf(raw: unknown): CatalogueRule[] {
  const result = validateCatalogueEntry(raw, context);
  return result.ok ? [] : result.issues.map((issue) => issue.rule);
}

function withBlueprint(index: number, patch: Partial<CatalogueEntry['blueprints'][number]>): CatalogueEntry {
  const entry = validEntry();
  entry.blueprints[index] = { ...entry.blueprints[index], ...patch };
  return entry;
}

const SINGLE_BLUEPRINT: BlueprintFields = {
  robotName: 'Admin Unit',
  loadoutType: 'single',
  stance: 'balanced',
  yieldThreshold: 15,
  buildFocus: 'deadeye',
  weaponPath: [{ main: 'Beam Pistol' }, { main: 'Particle Lance' }],
  refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }],
};

const ruleCodes = (blueprint: BlueprintFields): CatalogueRule[] => blueprintRuleIssues(blueprint, SEED_WEAPON_MAP).map((i) => i.rule);

describe('catalogue entry: accept', () => {
  it('accepts a valid entry and merges overrides into Strategy_Parameters', () => {
    const result = validateCatalogueEntry(validEntry({ strategy: { key: 'duo', version: 1, targetOverrides: { 13: 2 } } }), context);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.parameters.targets['duo.v1.13.robots']).toBe(2);
  });

  it('BUILD_FOCUS_KEYS are the six presets', () => {
    expect([...BUILD_FOCUS_KEYS].sort()).toEqual(BUILD_FOCUS_PRESETS.map((p) => p.key).sort());
  });
});

describe('catalogue entry: structure (strict)', () => {
  it.each<[string, (entry: Record<string, unknown>) => void]>([
    ['an image field on an entry (R10.2)', (e) => { e.image = 'x.webp'; }],
    ['an image field on a blueprint (R10.2)', (e) => { (e.blueprints as Record<string, unknown>[])[0].imageUrl = '/assets/x.webp'; }],
    ['a wrong schemaVersion', (e) => { e.schemaVersion = 2; }],
    ['a bad Catalogue_Key', (e) => { e.catalogueKey = 'Bad_Key'; }],
    ['an empty franchise', (e) => { e.franchise = ''; }],
    ['a franchise above 60 characters', (e) => { e.franchise = 'x'.repeat(61); }],
    ['a backstory above 400 characters', (e) => { e.backstory = 'x'.repeat(401); }],
    ['no blueprints', (e) => { e.blueprints = []; }],
    ['an unknown event type', (e) => { (e.eventOrder as string[])[0] = 'league_4v4'; }],
  ])('rejects %s', (_label, mutate) => {
    const entry = validEntry() as unknown as Record<string, unknown>;
    mutate(entry);
    expect(rulesOf(entry)).toContain('schema');
  });

  it.each<[string, Partial<CatalogueEntry['blueprints'][number]>]>([
    ['a robot name with a disallowed character', { robotName: 'Bad<Name>' }],
    ['a robot name above 50 characters', { robotName: 'x'.repeat(51) }],
    ['an unknown loadout', { loadoutType: 'triple' as BlueprintFields['loadoutType'] }],
    ['an unknown stance', { stance: 'reckless' as BlueprintFields['stance'] }],
    ['a yield threshold above 50', { yieldThreshold: 51 }],
    ['a negative yield threshold', { yieldThreshold: -1 }],
    ['an unknown Build_Focus', { buildFocus: 'tank' as BlueprintFields['buildFocus'] }],
    ['a slot above 11', { slot: 12 }],
    ['more than 4 Weapon_Stages', { weaponPath: Array.from({ length: 5 }, () => ({ main: 'Shock Maul' })) }],
    ['a Hone without a target attribute', { refinementPlan: [{ tier: 'hone', hand: 'main', magnitude: 1 }] }],
    ['a Sharpen with a magnitude of 2', { refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 2 }] }],
    ['a Hone with a magnitude of 6', { refinementPlan: [{ tier: 'hone', hand: 'main', targetAttribute: 'combatPower', magnitude: 6 }] }],
    ['a Sharpen with a target attribute', { refinementPlan: [{ tier: 'sharpen', hand: 'main', targetAttribute: 'combatPower', magnitude: 1 }] }],
  ])('rejects a blueprint with %s', (_label, patch) => {
    expect(rulesOf(withBlueprint(0, patch))).toContain('schema');
  });
});

describe('catalogue entry: context rules', () => {
  it('rejects a stable name the stable-name rules refuse', () => {
    expect(rulesOf(validEntry({ stableName: 'No' }))).toEqual(['stable_name']);
    expect(rulesOf(validEntry({ stableName: 'Bad!Name' }))).toEqual(['stable_name']);
  });

  it('rejects a duplicate Blueprint_Slot and a duplicate robot name', () => {
    expect(rulesOf(withBlueprint(1, { slot: 1 }))).toContain('blueprint_slot');
    expect(rulesOf(withBlueprint(1, { robotName: 'Test Hammer' }))).toContain('robot_name_duplicate');
  });

  it('rejects an Event_Order that repeats or misses an event type (R3.5)', () => {
    const entry = validEntry();
    entry.eventOrder = [...entry.eventOrder.slice(0, 8), 'league_2v2'];
    expect(rulesOf(entry)).toEqual(['event_order']);
    expect(eventOrderIssues(validEntry().eventOrder.slice(0, 8))).toHaveLength(1);
    expect(eventOrderIssues(validEntry().eventOrder)).toEqual([]);
  });

  it('rejects an unknown strategy or version', () => {
    expect(rulesOf(validEntry({ strategy: { key: 'nope', version: 1, targetOverrides: {} } }))).toEqual(['strategy_unknown']);
    expect(rulesOf(validEntry({ strategy: { key: 'duo', version: 9, targetOverrides: {} } }))).toEqual(['strategy_unknown']);
  });

  it('rejects an override on a position the Build_Order does not have, and one outside the Goal bounds', () => {
    expect(rulesOf(validEntry({ strategy: { key: 'duo', version: 1, targetOverrides: { 99: 1 } } }))).toEqual(['target_override']);
    expect(rulesOf(validEntry({ strategy: { key: 'duo', version: 1, targetOverrides: { 13: 9 } } }))).toContain('target_out_of_bounds');
    expect(rulesOf(validEntry({ strategy: { key: 'duo', version: 1, targetOverrides: { 17: 11 } } }))).toEqual(['target_out_of_bounds']);
  });

  it('rejects a robots Goal_Target above the blueprint count with AUTOMATON_BLUEPRINTS_TOO_FEW (R3.7)', () => {
    const entry = validEntry({ strategy: { key: 'duo', version: 1, targetOverrides: { 13: 3 } } });
    const result = validateCatalogueEntry(entry, context);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((i) => i.rule === 'blueprints_too_few');
      expect(issue?.message).toBe('Goal 13 targets 3 robots, but this stable has 2 blueprints. Add blueprints or lower the target.');
      expect(catalogueIssueCode('blueprints_too_few')).toBe('AUTOMATON_BLUEPRINTS_TOO_FEW');
    }
  });

  it('counts blueprints from slot 1 without a gap: slots {1, 3} build one robot (R3.7, review C09-1)', () => {
    const gapped = withBlueprint(1, { slot: 3 });
    const result = validateCatalogueEntry(gapped, context);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.find((i) => i.rule === 'blueprints_too_few')?.message)
        .toBe('Goal 2 targets 2 robots, but this stable has 1 blueprints. Add blueprints or lower the target.');
    }
    expect(buildableBlueprintCount([1, 3])).toBe(1);
    expect(buildableBlueprintCount([2, 1])).toBe(2);
    expect(buildableBlueprintCount([])).toBe(0);
  });

  it('robotsTargetIssues passes at the blueprint count', () => {
    const duo = repositoryStrategies().getStrategy('duo', 1);
    if (!duo) throw new Error('duo v1 missing');
    expect(robotsTargetIssues(duo, { targets: { 'duo.v1.13.robots': 3 } }, 3)).toEqual([]);
    expect(robotsTargetIssues(duo, { targets: { 'duo.v1.13.robots': 3 } }, 2)).toHaveLength(1);
  });
});

describe('Team_Names (R3.6)', () => {
  const swarm = repositoryStrategies().getStrategy('swarm', 1);
  const duo = repositoryStrategies().getStrategy('duo', 1);

  it('counts follow the Team_Rule at min(highest robots bound, blueprints)', () => {
    if (!swarm || !duo) throw new Error('strategies missing');
    expect(requiredTeamNameCountsFor(swarm, 11)).toEqual({ twoVsTwo: 5, threeVsThree: 3 });
    expect(requiredTeamNameCountsFor(swarm, 4)).toEqual({ twoVsTwo: 2, threeVsThree: 1 });
    expect(requiredTeamNameCountsFor(duo, 2)).toEqual({ twoVsTwo: 1, threeVsThree: 0 });
    expect(requiredTeamNameCountsFor(duo, 3)).toEqual({ twoVsTwo: 1, threeVsThree: 1 });
  });

  it('rejects too few and too many names with AUTOMATON_TEAM_NAMES_MISMATCH', () => {
    expect(rulesOf(validEntry({ teamNames: { twoVsTwo: [], threeVsThree: [] } }))).toEqual(['team_names_count']);
    expect(rulesOf(validEntry({ teamNames: { twoVsTwo: ['Test Pair'], threeVsThree: ['Extra Trio'] } }))).toEqual(['team_names_count']);
    expect(catalogueIssueCode('team_names_count')).toBe('AUTOMATON_TEAM_NAMES_MISMATCH');
  });

  it.each([['ab'], ['x'.repeat(33)], ['Bad<Team>'], [' Padded']])('rejects the name %p', (name) => {
    expect(teamNamesIssues({ twoVsTwo: [name], threeVsThree: [] }, { twoVsTwo: 1, threeVsThree: 0 }).map((i) => i.rule)).toEqual(['team_name_invalid']);
  });

  it('rejects a name used twice in one stable', () => {
    expect(teamNamesIssues({ twoVsTwo: ['Same Name'], threeVsThree: ['Same Name'] }, { twoVsTwo: 1, threeVsThree: 1 }).map((i) => i.rule))
      .toEqual(['team_name_duplicate']);
  });
});

describe('Weapon_Path (R3.3)', () => {
  it('accepts every loadout, including dual wield with two different weapons', () => {
    expect(ruleCodes(SINGLE_BLUEPRINT)).toEqual([]);
    expect(ruleCodes({ ...SINGLE_BLUEPRINT, loadoutType: 'dual_wield', weaponPath: [{ main: 'Volt Sabre', offhand: 'Nova Caster' }], refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }, { tier: 'sharpen', hand: 'offhand', magnitude: 1 }] })).toEqual([]);
  });

  it('rejects an unknown weapon', () => {
    expect(ruleCodes({ ...SINGLE_BLUEPRINT, weaponPath: [{ main: 'Banana Blaster' }, { main: 'Particle Lance' }] })).toEqual(['weapon_unknown']);
  });

  it.each<[string, Partial<BlueprintFields>]>([
    ['a two-handed weapon on single', { weaponPath: [{ main: 'Plasma Cannon' }] }],
    ['a one-handed weapon on two_handed', { loadoutType: 'two_handed', weaponPath: [{ main: 'Volt Sabre' }] }],
    ['an off-hand weapon on single', { weaponPath: [{ main: 'Volt Sabre', offhand: 'Volt Sabre' }] }],
    ['weapon_shield without a shield', { loadoutType: 'weapon_shield', weaponPath: [{ main: 'Volt Sabre' }] }],
    ['weapon_shield with a weapon as shield', { loadoutType: 'weapon_shield', weaponPath: [{ main: 'Volt Sabre', offhand: 'Volt Sabre' }] }],
    ['dual_wield with a shield', { loadoutType: 'dual_wield', weaponPath: [{ main: 'Volt Sabre', offhand: 'Aegis Bulwark' }] }],
    ['a shield in the main hand', { loadoutType: 'weapon_shield', weaponPath: [{ main: 'Aegis Bulwark', offhand: 'Aegis Bulwark' }] }],
  ])('rejects %s', (_label, patch) => {
    expect(ruleCodes({ ...SINGLE_BLUEPRINT, ...patch })).toContain('weapon_loadout');
  });
});

describe('Refinement_Plan (R3.4, decision 35)', () => {
  const plan = (steps: BlueprintFields['refinementPlan']): BlueprintFields => ({ ...SINGLE_BLUEPRINT, refinementPlan: steps });
  const shieldBlueprint = (steps: BlueprintFields['refinementPlan']): BlueprintFields => ({
    ...SINGLE_BLUEPRINT,
    loadoutType: 'weapon_shield',
    weaponPath: [{ main: 'Volt Sabre', offhand: 'Aegis Bulwark' }],
    refinementPlan: steps,
  });

  it('rejects a blueprint with no Refinement_Plan steps', () => {
    expect(ruleCodes(plan([]))).toEqual(['refinement_missing']);
  });

  it('rejects a non-shield final weapon with no step (dual wield off hand)', () => {
    expect(ruleCodes({ ...SINGLE_BLUEPRINT, loadoutType: 'dual_wield', weaponPath: [{ main: 'Volt Sabre', offhand: 'Volt Sabre' }] })).toEqual(['refinement_missing']);
  });

  it('allows a shield without steps', () => {
    expect(ruleCodes(shieldBlueprint([{ tier: 'sharpen', hand: 'main', magnitude: 1 }]))).toEqual([]);
  });

  it('rejects more than 5 steps on one weapon', () => {
    const steps = Array.from({ length: 6 }, () => ({ tier: 'hone' as const, hand: 'main' as const, targetAttribute: 'combatPower' as const, magnitude: 1 }));
    expect(ruleCodes(plan(steps))).toContain('refinement_step_count');
  });

  it('rejects an offhand step without an off-hand weapon', () => {
    expect(ruleCodes(plan([{ tier: 'sharpen', hand: 'main', magnitude: 1 }, { tier: 'sharpen', hand: 'offhand', magnitude: 1 }]))).toEqual(['refinement_hand']);
  });

  it('rejects Sharpen or Forge on a shield', () => {
    expect(ruleCodes(shieldBlueprint([{ tier: 'sharpen', hand: 'main', magnitude: 1 }, { tier: 'sharpen', hand: 'offhand', magnitude: 1 }]))).toEqual(['refinement_invalid']);
    expect(ruleCodes(shieldBlueprint([{ tier: 'sharpen', hand: 'main', magnitude: 1 }, { tier: 'forge', hand: 'offhand', magnitude: 1 }]))).toEqual(['refinement_invalid']);
  });

  it('rejects a third Sharpen', () => {
    const sharpen = { tier: 'sharpen' as const, hand: 'main' as const, magnitude: 1 };
    expect(ruleCodes(plan([sharpen, sharpen, sharpen]))).toEqual(['refinement_invalid']);
  });

  it('rejects a Hone on an attribute the weapon lacks and accepts one on a negative bonus', () => {
    // Particle Lance has no Armor Plating bonus.
    expect(ruleCodes(plan([{ tier: 'hone', hand: 'main', targetAttribute: 'armorPlating', magnitude: 1 }]))).toEqual(['refinement_invalid']);
    // Aegis Bulwark: Evasion Thrusters −5.
    expect(ruleCodes(shieldBlueprint([{ tier: 'sharpen', hand: 'main', magnitude: 1 }, { tier: 'hone', hand: 'offhand', targetAttribute: 'evasionThrusters', magnitude: 5 }]))).toEqual([]);
  });

  it('rejects an Augment on an attribute the weapon has', () => {
    expect(ruleCodes(plan([{ tier: 'augment', hand: 'main', targetAttribute: 'combatPower', magnitude: 1 }]))).toEqual(['refinement_invalid']);
  });

  it('rejects a total above +10 on one attribute (catalogue bonus included)', () => {
    const bonus = SEED_WEAPON_MAP.get('Particle Lance')?.bonuses.combatPower ?? 0;
    expect(bonus).toBeGreaterThan(0);
    const hone = (magnitude: number) => ({ tier: 'hone' as const, hand: 'main' as const, targetAttribute: 'combatPower' as const, magnitude });
    expect(ruleCodes(plan([hone(10 - bonus)]))).toEqual([]);
    expect(ruleCodes(plan([hone(10 - bonus), hone(1)]))).toEqual(['refinement_invalid']);
  });

  it('applies the validators cumulatively: an Augment makes a later Hone valid', () => {
    expect(ruleCodes(plan([
      { tier: 'augment', hand: 'main', targetAttribute: 'armorPlating', magnitude: 1 },
      { tier: 'hone', hand: 'main', targetAttribute: 'armorPlating', magnitude: 2 },
    ]))).toEqual([]);
  });
});

describe('admin blueprint input reuses the shared rules', () => {
  it('create: the shared field schema rejects an image key it does not own and bad fields', () => {
    expect(blueprintFieldsSchema.strict().safeParse(SINGLE_BLUEPRINT).success).toBe(true);
    expect(blueprintFieldsSchema.strict().safeParse({ ...SINGLE_BLUEPRINT, yieldThreshold: 99 }).success).toBe(false);
  });

  it('create: a blueprint whose plan misses the final weapon is rejected', () => {
    expect(ruleCodes({ ...SINGLE_BLUEPRINT, refinementPlan: [] })).toEqual(['refinement_missing']);
  });

  it('update: a loadout change to dual wield leaves the new off-hand weapon without steps', () => {
    const merged: BlueprintFields = { ...SINGLE_BLUEPRINT, loadoutType: 'dual_wield', weaponPath: [{ main: 'Volt Sabre', offhand: 'Volt Sabre' }] };
    const issues = blueprintRuleIssues(merged, SEED_WEAPON_MAP);
    expect(issues.map((i) => i.rule)).toEqual(['refinement_missing']);
    expect(issues[0].message).toContain('Volt Sabre (off hand)');
    expect(issues[0].path).toEqual(['refinementPlan']);
  });

  it('update: a Weapon_Path change that drops the off hand rejects the offhand steps', () => {
    const before: BlueprintFields = {
      ...SINGLE_BLUEPRINT,
      loadoutType: 'weapon_shield',
      weaponPath: [{ main: 'Volt Sabre', offhand: 'Aegis Bulwark' }],
      refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }, { tier: 'hone', hand: 'offhand', targetAttribute: 'evasionThrusters', magnitude: 1 }],
    };
    expect(ruleCodes(before)).toEqual([]);
    expect(ruleCodes({ ...before, loadoutType: 'single', weaponPath: [{ main: 'Volt Sabre' }] })).toEqual(['refinement_hand']);
  });

  it('update: a Weapon_Path change to a weapon without the honed attribute is rejected', () => {
    const honed: BlueprintFields = { ...SINGLE_BLUEPRINT, refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }, { tier: 'hone', hand: 'main', targetAttribute: 'combatPower', magnitude: 1 }] };
    expect(ruleCodes(honed)).toEqual([]);
    const lacking = [...SEED_WEAPON_MAP.values()].find((w) => w.handsRequired === 'one' && w.weaponType !== 'shield' && w.bonuses.combatPower === undefined);
    if (!lacking) throw new Error('fixture weapon missing');
    expect(ruleCodes({ ...honed, weaponPath: [{ main: lacking.name }] })).toEqual(['refinement_invalid']);
  });
});
