import fs from 'fs';
import path from 'path';
import {
  checkKeyAndVersion,
  deriveGoalSpecs,
  goalIdFor,
  validateStrategyDefinition,
  type StrategyRule,
} from '../strategyDefinitionSchema';
import type { FileBuildOrderEntry, StrategyDefinitionFile } from '../strategyTypes';
import { FIXTURE_STRATEGY_DIRECTORY } from './helpers/strategyTestSupport';

const FIXTURE: StrategyDefinitionFile = JSON.parse(
  fs.readFileSync(path.join(FIXTURE_STRATEGY_DIRECTORY, 'fixture.v1.json'), 'utf8'),
) as StrategyDefinitionFile;

function clone(): StrategyDefinitionFile {
  return structuredClone(FIXTURE);
}

/** Renumber positions 1..n after an edit. */
function renumber(def: StrategyDefinitionFile): StrategyDefinitionFile {
  def.buildOrder.forEach((entry, i) => { entry.position = i + 1; });
  return def;
}

function withEntry(index: number, patch: Partial<FileBuildOrderEntry>): StrategyDefinitionFile {
  const def = clone();
  def.buildOrder[index] = { ...def.buildOrder[index], ...patch };
  return def;
}

function insertBefore(index: number, entry: Omit<FileBuildOrderEntry, 'position'>): StrategyDefinitionFile {
  const def = clone();
  def.buildOrder.splice(index, 0, { position: 0, ...entry });
  return renumber(def);
}

function rulesOf(raw: unknown): StrategyRule[] {
  const result = validateStrategyDefinition(raw);
  return result.ok ? [] : result.issues.map((issue) => issue.rule);
}

/** A Repair Bay Goal to pad a Build_Order (position fixed by `renumber`). */
const filler = (): FileBuildOrderEntry =>
  ({ position: 0, goal: { type: 'facility', facilityType: 'repair_bay' }, defaultTarget: 1, bounds: { min: 0, max: 10 } });

describe('strategyDefinitionSchema (R6.2, R6.11, design §14.0, §14.0b)', () => {
  it('accepts the fixture strategy (every builder rule, every required Goal type)', () => {
    expect(validateStrategyDefinition(FIXTURE)).toEqual({ ok: true, definition: FIXTURE, issues: [] });
  });

  describe('structure', () => {
    it.each([
      ['an unknown top-level field', { ...FIXTURE, extra: 1 }],
      ['a key with upper case', { ...FIXTURE, key: 'Swarm' }],
      ['a key with a dot', { ...FIXTURE, key: 'swarm.v2' }],
      ['schemaVersion 2', { ...FIXTURE, schemaVersion: 2 }],
      ['version 0', { ...FIXTURE, version: 0 }],
      ['an empty display name', { ...FIXTURE, displayName: ' ' }],
      ['an unknown Goal type', withEntry(0, { goal: { type: 'income' } as unknown as FileBuildOrderEntry['goal'] })],
      ['an unknown facility type', withEntry(1, { goal: { type: 'facility', facilityType: 'casino' } as unknown as FileBuildOrderEntry['goal'] })],
      ['a fractional target', withEntry(2, { defaultTarget: 5.5 })],
    ])('rejects %s', (_label, raw) => {
      expect(rulesOf(raw)).toContain('schema');
    });

    it('accepts a key with digits and hyphens', () => {
      expect(rulesOf({ ...FIXTURE, key: 'swarm-2' })).toEqual([]);
    });
  });

  describe('1–40 Goals', () => {
    it('rejects an empty Build_Order', () => {
      expect(rulesOf({ ...FIXTURE, buildOrder: [] })).toContain('goal_count');
    });

    it('accepts 40 Goals and rejects 41', () => {
      const forty = clone();
      while (forty.buildOrder.length < 40) forty.buildOrder.splice(1, 0, filler());
      expect(rulesOf(renumber(forty))).toEqual([]);
      const fortyOne = structuredClone(forty);
      fortyOne.buildOrder.splice(1, 0, filler());
      expect(rulesOf(renumber(fortyOne))).toContain('goal_count');
    });
  });

  it('rejects positions that are not numbered 1, 2, 3 … in order', () => {
    const def = clone();
    def.buildOrder[3].position = 9;
    expect(rulesOf(def)).toContain('position_sequence');
  });

  describe('bounds within the Goal type limits', () => {
    it.each([
      ['Booking Office L6', 1, { min: 0, max: 6 }, true],
      ['Booking Office L7', 1, { min: 0, max: 7 }, false],
      ['another facility L10', 3, { min: 0, max: 10 }, true],
      ['another facility L11', 3, { min: 0, max: 11 }, false],
      ['robots 1–11', 0, { min: 1, max: 11 }, true],
      ['robots 0', 0, { min: 0, max: 3 }, false],
      ['robots 12', 0, { min: 1, max: 12 }, false],
      ['attributes 1–50', 2, { min: 1, max: 50 }, true],
      ['attributes 51', 2, { min: 1, max: 51 }, false],
      ['attributes 0', 2, { min: 0, max: 10 }, false],
      ['weapons stage 0–3', 11, { min: 0, max: 3 }, true],
      ['weapons stage 4', 11, { min: 0, max: 4 }, false],
      ['refine 0–10 steps', 14, { min: 0, max: 10 }, true],
      ['refine 11 steps', 14, { min: 0, max: 11 }, false],
    ])('%s', (_label, index, bounds, accepted) => {
      const rules = rulesOf(withEntry(index as number, { bounds: bounds as FileBuildOrderEntry['bounds'] }));
      if (accepted) expect(rules).toEqual([]);
      else expect(rules).toContain('bounds_limit');
    });

    it('uses the approved message for a refine bound of 11', () => {
      const result = validateStrategyDefinition(withEntry(14, { bounds: { min: 0, max: 11 } }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toContainEqual(expect.objectContaining({ rule: 'bounds_limit', message: 'Refine allows 0–10 steps.', position: 15 }));
      }
    });

    it('rejects an empty range', () => {
      expect(rulesOf(withEntry(3, { defaultTarget: 2, bounds: { min: 3, max: 2 } }))).toContain('bounds_order');
    });
  });

  describe('Max', () => {
    it('accepts Max only as the whole range of an attributes Goal', () => {
      expect(rulesOf(withEntry(12, { defaultTarget: 'max', bounds: { min: 'max', max: 'max' } }))).toEqual([]);
      expect(rulesOf(withEntry(12, { defaultTarget: 15, bounds: { min: 1, max: 'max' } }))).toContain('max_target_type');
      expect(rulesOf(withEntry(0, { defaultTarget: 'max', bounds: { min: 'max', max: 'max' } }))).toContain('max_target_type');
    });
  });

  describe('default within bounds', () => {
    it('accepts a default on either bound and rejects one outside', () => {
      expect(rulesOf(withEntry(9, { defaultTarget: 11, bounds: { min: 1, max: 11 } }))).toEqual([]);
      expect(rulesOf(withEntry(9, { defaultTarget: 1, bounds: { min: 1, max: 11 } }))).toEqual([]);
      const result = validateStrategyDefinition(withEntry(9, { defaultTarget: 12, bounds: { min: 1, max: 11 } }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toContainEqual(expect.objectContaining({
          rule: 'default_out_of_bounds', message: 'Default is outside the allowed range.', position: 10,
        }));
      }
    });
  });

  describe('no facility Goal for an academy (R4.4)', () => {
    it('rejects a combat_training_academy facility Goal', () => {
      const def = insertBefore(3, { goal: { type: 'facility', facilityType: 'combat_training_academy' }, defaultTarget: 1, bounds: { min: 0, max: 10 } });
      expect(rulesOf(def)).toContain('academy_facility_goal');
    });

    it('accepts optional roster_expansion and storage_facility Goals', () => {
      const def = insertBefore(3, { goal: { type: 'facility', facilityType: 'roster_expansion' }, defaultTarget: 1, bounds: { min: 0, max: 10 } });
      const both = insertBefore(3, { goal: { type: 'facility', facilityType: 'storage_facility' }, defaultTarget: 1, bounds: { min: 0, max: 10 } });
      expect(rulesOf(def)).toEqual([]);
      expect(rulesOf(both)).toEqual([]);
    });
  });

  describe('a robots Goal before the first attributes, weapons or refine Goal', () => {
    it.each(['attributes', 'weapons', 'refine'] as const)('rejects %s above every robots Goal', (type) => {
      const def = insertBefore(0, { goal: { type }, defaultTarget: 1, bounds: { min: 1, max: 3 } });
      const result = validateStrategyDefinition(def);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toContainEqual(expect.objectContaining({ rule: 'robots_goal_first', message: 'Needs a robots goal above it.', position: 1 }));
      }
    });

    it('accepts a facility Goal above the first robots Goal', () => {
      const def = insertBefore(0, { goal: { type: 'facility', facilityType: 'repair_bay' }, defaultTarget: 1, bounds: { min: 0, max: 10 } });
      expect(rulesOf(def)).toEqual([]);
    });
  });

  describe('every required Goal type with a default above 0 (decision 29)', () => {
    it('rejects a draft without a Tuning Bay Goal, as a Build_Order-level issue', () => {
      const def = clone();
      def.buildOrder = def.buildOrder.filter((e) => !(e.goal.type === 'facility' && e.goal.facilityType === 'tuning_bay'));
      const result = validateStrategyDefinition(renumber(def));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual([{
          rule: 'required_goal_type',
          message: 'Every strategy needs a Tuning Bay goal with a default above 0.',
          position: undefined,
          path: ['buildOrder'],
        }]);
      }
    });

    it('rejects a draft whose only Refine Goal defaults to 0 steps', () => {
      expect(rulesOf(withEntry(14, { defaultTarget: 0 }))).toEqual(['required_goal_type']);
    });

    it('accepts a required type whose first Goal is 0 when another Goal of that type is above 0', () => {
      expect(rulesOf(withEntry(1, { defaultTarget: 0 }))).toEqual([]);
    });

    it.each([
      ['robots', (e: FileBuildOrderEntry) => e.goal.type === 'robots'],
      ['weapons', (e: FileBuildOrderEntry) => e.goal.type === 'weapons'],
      ['repair_bay', (e: FileBuildOrderEntry) => e.goal.type === 'facility' && e.goal.facilityType === 'repair_bay'],
      ['training_facility', (e: FileBuildOrderEntry) => e.goal.type === 'facility' && e.goal.facilityType === 'training_facility'],
      ['weapons_workshop', (e: FileBuildOrderEntry) => e.goal.type === 'facility' && e.goal.facilityType === 'weapons_workshop'],
      ['booking_office', (e: FileBuildOrderEntry) => e.goal.type === 'facility' && e.goal.facilityType === 'booking_office'],
      ['merchandising_hub', (e: FileBuildOrderEntry) => e.goal.type === 'facility' && e.goal.facilityType === 'merchandising_hub'],
      ['streaming_studio', (e: FileBuildOrderEntry) => e.goal.type === 'facility' && e.goal.facilityType === 'streaming_studio'],
    ])('rejects a draft without a %s Goal', (_label, matches) => {
      const def = clone();
      def.buildOrder = def.buildOrder.filter((e) => !matches(e));
      expect(rulesOf(renumber(def))).toContain('required_goal_type');
    });
  });

  describe('last Goal "Attributes → Max"', () => {
    it('rejects a Build_Order ending in another Goal', () => {
      const def = clone();
      def.buildOrder.push({ position: def.buildOrder.length + 1, goal: { type: 'facility', facilityType: 'repair_bay' }, defaultTarget: 2, bounds: { min: 0, max: 10 } });
      expect(rulesOf(def)).toContain('last_goal_attributes_max');
    });

    it('rejects a last attributes Goal with a milestone target', () => {
      const def = clone();
      def.buildOrder[def.buildOrder.length - 1] = { ...def.buildOrder[def.buildOrder.length - 1], defaultTarget: 50, bounds: { min: 1, max: 50 } };
      expect(rulesOf(def)).toContain('last_goal_attributes_max');
    });
  });

  describe('unique key or next version (checkKeyAndVersion)', () => {
    const latest = new Map([['swarm', 2]]);
    it.each([
      ['a new key at v1', { key: 'raider', version: 1 }, []],
      ['a new key at v2', { key: 'raider', version: 2 }, ['version_not_next']],
      ['an existing key at v1', { key: 'swarm', version: 1 }, ['key_exists']],
      ['the next version', { key: 'swarm', version: 3 }, []],
      ['a skipped version', { key: 'swarm', version: 4 }, ['version_not_next']],
    ])('%s', (_label, def, rules) => {
      expect(checkKeyAndVersion(def, latest).map((i) => i.rule)).toEqual(rules);
    });

    it('is applied by validateStrategyDefinition when latest versions are given', () => {
      const result = validateStrategyDefinition(FIXTURE, { latestVersions: new Map([['fixture', 1]]) });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues[0]).toMatchObject({ rule: 'key_exists', message: 'Key "fixture" already exists.' });
    });
  });

  describe('Goal ids and numeric targets', () => {
    it('derives {key}.v{version}.{position:02}.{type}[.{facilityType}]', () => {
      expect(goalIdFor('swarm', 1, { position: 10, goal: { type: 'robots' } })).toBe('swarm.v1.10.robots');
      expect(goalIdFor('swarm', 1, { position: 2, goal: { type: 'facility', facilityType: 'booking_office' } }))
        .toBe('swarm.v1.02.facility.booking_office');
    });

    it('stores Max as 50 with isMax', () => {
      const specs = deriveGoalSpecs(FIXTURE);
      expect(specs[specs.length - 1]).toEqual({
        id: 'fixture.v1.16.attributes', position: 16, type: 'attributes', defaultTarget: 50, bounds: { min: 50, max: 50 }, isMax: true,
      });
      expect(specs[1]).toMatchObject({ id: 'fixture.v1.02.facility.booking_office', facilityType: 'booking_office', isMax: false });
      expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length);
    });
  });
});
