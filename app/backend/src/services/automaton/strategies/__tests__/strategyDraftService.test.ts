/**
 * Spec #55 task 9.8 — every builder rule of R6.11 through the
 * Strategy_Draft service validation (`draftIssues`), with the approved
 * messages of PLAYER_FACING_TEXT §6.4b: per Goal (with its position) or at
 * Build_Order level (without one).
 */
import { draftIssues } from '../strategyDraftService';
import { getStrategyRegistry } from '../defaultRegistry';
import type { FileBuildOrderEntry, StrategyDefinitionFile } from '../strategyTypes';
import { duoV1Definition } from './helpers/upgradeFixtures';

const latest = getStrategyRegistry().latestVersions();

/** A valid new strategy: Duo v1's Build_Order under a new key. */
function valid(): StrategyDefinitionFile {
  return { ...duoV1Definition(), key: 'draft-test', version: 1, displayName: 'Draft test', description: 'A test strategy.' };
}

function withEntry(position: number, change: Partial<FileBuildOrderEntry>): StrategyDefinitionFile {
  const def = valid();
  def.buildOrder = def.buildOrder.map((e) => (e.position === position ? { ...e, ...change } as FileBuildOrderEntry : e));
  return def;
}

function renumber(entries: FileBuildOrderEntry[]): FileBuildOrderEntry[] {
  return entries.map((e, i) => ({ ...e, position: i + 1 }));
}

const rules = (def: StrategyDefinitionFile) => draftIssues(def, latest).map((i) => i.rule);

describe('draftIssues (R6.11 builder rules through the draft service)', () => {
  it('accepts a valid new strategy', () => {
    expect(draftIssues(valid(), latest)).toEqual([]);
  });

  it('reports the definition schema: empty display name and description', () => {
    const issues = draftIssues({ ...valid(), displayName: '', description: '' }, latest);
    expect(issues.map((i) => [i.rule, i.path[0]])).toEqual([['schema', 'displayName'], ['schema', 'description']]);
  });

  it('key/version rule: a taken key, a new strategy not at v1, a version that is not next', () => {
    expect(draftIssues({ ...valid(), key: 'duo' }, latest)).toEqual([
      expect.objectContaining({ rule: 'key_exists', message: 'Key "duo" already exists.' }),
    ]);
    expect(rules({ ...valid(), version: 2 })).toEqual(['version_not_next']);
    expect(draftIssues({ ...valid(), key: 'duo', version: 4 }, latest)[0]).toMatchObject({ rule: 'version_not_next', message: 'The next version of "duo" is v3.' });
    expect(draftIssues({ ...valid(), key: 'duo', version: 3 }, latest)).toEqual([]);
  });

  it('goal count: at least 1, at most 40', () => {
    expect(draftIssues({ ...valid(), buildOrder: [] }, latest)).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'goal_count', message: 'Add at least one goal.' }),
    ]));
    const def = valid();
    const filler = def.buildOrder.slice(0, 1);
    def.buildOrder = renumber([...def.buildOrder.slice(0, -1), ...Array.from({ length: 20 }, () => filler[0]), def.buildOrder[def.buildOrder.length - 1]]);
    expect(def.buildOrder.length).toBeGreaterThan(40);
    expect(draftIssues(def, latest)).toEqual([expect.objectContaining({ rule: 'goal_count', message: '40 goals at most.' })]);
  });

  it('positions are 1, 2, 3 … in order', () => {
    expect(draftIssues(withEntry(4, { position: 9 }), latest)[0]).toMatchObject({ rule: 'position_sequence', position: 9 });
  });

  it.each([
    [3, { bounds: { min: 0, max: 7 }, defaultTarget: 1 }, 'Booking Office cannot go above L6.'],
    [8, { bounds: { min: 0, max: 11 }, defaultTarget: 2 }, 'Repair Bay cannot go above L10.'],
    [2, { bounds: { min: 1, max: 12 }, defaultTarget: 2 }, 'Robots allow 1–11.'],
    [14, { bounds: { min: 1, max: 51 }, defaultTarget: 20 }, 'Attributes allow 1–50 or Max.'],
    [16, { bounds: { min: 0, max: 4 }, defaultTarget: 3 }, 'Weapons allow stage 0–3.'],
    [17, { bounds: { min: 0, max: 11 }, defaultTarget: 10 }, 'Refine allows 0–10 steps.'],
  ])('bounds within the Goal type limits: goal %i', (position, change, message) => {
    expect(draftIssues(withEntry(position, change as Partial<FileBuildOrderEntry>), latest)).toEqual([
      expect.objectContaining({ rule: 'bounds_limit', position, message }),
    ]);
  });

  it('an empty allowed range and a default outside it', () => {
    expect(rules(withEntry(3, { bounds: { min: 4, max: 2 }, defaultTarget: 3 }))).toEqual(expect.arrayContaining(['bounds_order']));
    expect(draftIssues(withEntry(3, { defaultTarget: 6, bounds: { min: 0, max: 5 } }), latest)).toEqual([
      expect.objectContaining({ rule: 'default_out_of_bounds', position: 3, message: 'Default is outside the allowed range.' }),
    ]);
  });

  it('Max only as the whole range of an attributes goal', () => {
    expect(rules(withEntry(16, { defaultTarget: 'max', bounds: { min: 'max', max: 'max' } }))).toEqual(['max_target_type']);
    expect(rules(withEntry(14, { defaultTarget: 'max', bounds: { min: 1, max: 50 } }))).toEqual(['max_target_type']);
  });

  it('no facility goal for an academy (R4.4)', () => {
    expect(draftIssues(withEntry(12, { goal: { type: 'facility', facilityType: 'combat_training_academy' } }), latest)).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'academy_facility_goal', position: 12 }),
    ]));
  });

  it('a robots goal before the first attributes, weapons or refine goal', () => {
    const def = valid();
    const [first, robots, ...rest] = def.buildOrder;
    def.buildOrder = renumber([first, rest[1], robots, rest[0], ...rest.slice(2)]); // attributes (old 4) before robots
    expect(draftIssues(def, latest)).toEqual([expect.objectContaining({ rule: 'robots_goal_first', message: 'Needs a robots goal above it.', position: 2 })]);
  });

  it.each([
    ['robots', 'Robots'],
    ['weapons', 'Weapons'],
    ['refine', 'Refine'],
  ])('every required Goal type: missing %s is a Build_Order-level error', (type, label) => {
    const def = valid();
    def.buildOrder = renumber(def.buildOrder.filter((e) => e.goal.type !== type));
    const required = draftIssues(def, latest).filter((i) => i.rule === 'required_goal_type');
    expect(required).toEqual([expect.objectContaining({ message: `Every strategy needs a ${label} goal with a default above 0.`, path: ['buildOrder'] })]);
    expect(required[0].position).toBeUndefined();
  });

  it.each([
    'repair_bay',
    'training_facility',
    'weapons_workshop',
    'booking_office',
    'merchandising_hub',
    'streaming_studio',
    'tuning_bay',
  ])('every required facility Goal: %s with all defaults at 0 counts as missing', (facilityType) => {
    const def = valid();
    def.buildOrder = def.buildOrder.map((e) => (e.goal.type === 'facility' && e.goal.facilityType === facilityType ? { ...e, defaultTarget: 0 } : e));
    expect(draftIssues(def, latest)).toEqual([expect.objectContaining({ rule: 'required_goal_type', path: ['buildOrder'] })]);
  });

  it('refine with every default at 0 steps counts as missing (decision 36)', () => {
    expect(draftIssues(withEntry(17, { defaultTarget: 0 }), latest)).toEqual([
      expect.objectContaining({ rule: 'required_goal_type', message: 'Every strategy needs a Refine goal with a default above 0.' }),
    ]);
  });

  it('roster expansion and storage goals are allowed but never required', () => {
    const def = valid();
    const last = def.buildOrder[def.buildOrder.length - 1];
    def.buildOrder = renumber([
      ...def.buildOrder.slice(0, -1),
      { position: 0, goal: { type: 'facility', facilityType: 'roster_expansion' }, defaultTarget: 2, bounds: { min: 0, max: 10 } },
      { position: 0, goal: { type: 'facility', facilityType: 'storage_facility' }, defaultTarget: 2, bounds: { min: 0, max: 10 } },
      last,
    ]);
    expect(draftIssues(def, latest)).toEqual([]);
  });

  it('the last goal must be "Attributes → Max"', () => {
    const def = valid();
    def.buildOrder = def.buildOrder.slice(0, -1);
    expect(draftIssues(def, latest)).toEqual([expect.objectContaining({ rule: 'last_goal_attributes_max', message: 'The last goal must be "Attributes → Max".' })]);
  });
});
