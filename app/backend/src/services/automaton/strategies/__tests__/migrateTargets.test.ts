import { migrateTargets } from '../migrateTargets';
import { deriveGoalSpecs } from '../strategyDefinitionSchema';
import type { FileBuildOrderEntry, StrategyDefinitionFile } from '../strategyTypes';

function definition(version: number, buildOrder: Omit<FileBuildOrderEntry, 'position'>[]): StrategyDefinitionFile {
  return {
    schemaVersion: 1,
    key: 'demo',
    version,
    displayName: 'Demo',
    description: 'Migration test strategy.',
    buildOrder: buildOrder.map((entry, i) => ({ position: i + 1, ...entry })),
  };
}

const robots = (defaultTarget: number, min: number, max: number): Omit<FileBuildOrderEntry, 'position'> =>
  ({ goal: { type: 'robots' }, defaultTarget, bounds: { min, max } });
const booking = (defaultTarget: number, max = 6): Omit<FileBuildOrderEntry, 'position'> =>
  ({ goal: { type: 'facility', facilityType: 'booking_office' }, defaultTarget, bounds: { min: 0, max } });
const repair = (defaultTarget: number): Omit<FileBuildOrderEntry, 'position'> =>
  ({ goal: { type: 'facility', facilityType: 'repair_bay' }, defaultTarget, bounds: { min: 0, max: 10 } });
const attributes = (defaultTarget: number | 'max'): Omit<FileBuildOrderEntry, 'position'> => (defaultTarget === 'max'
  ? { goal: { type: 'attributes' }, defaultTarget, bounds: { min: 'max', max: 'max' } }
  : { goal: { type: 'attributes' }, defaultTarget, bounds: { min: 1, max: 50 } });
const refine = (defaultTarget: number): Omit<FileBuildOrderEntry, 'position'> =>
  ({ goal: { type: 'refine' }, defaultTarget, bounds: { min: 0, max: 10 } });

const v1 = deriveGoalSpecs(definition(1, [robots(3, 1, 3), booking(1), attributes(5), booking(3), repair(2), attributes('max')]));

describe('migrateTargets (R6.6, R14.1, design §14.0a)', () => {
  it('matches Goals by type, facility type and occurrence, wherever they move', () => {
    // v2 swaps the two Booking Office Goals' surroundings and moves the repair Goal to the top.
    const v2 = deriveGoalSpecs(definition(2, [repair(1), robots(3, 1, 3), attributes(5), booking(2), booking(4), attributes('max')]));
    const params = { targets: { 'demo.v1.02.facility.booking_office': 0, 'demo.v1.04.facility.booking_office': 5, 'demo.v1.05.facility.repair_bay': 7 } };
    const { params: migrated, changes } = migrateTargets(v1, v2, params);
    expect(migrated.targets).toEqual({
      'demo.v2.01.facility.repair_bay': 7,
      'demo.v2.02.robots': 3,
      'demo.v2.03.attributes': 5,
      'demo.v2.04.facility.booking_office': 0,
      'demo.v2.05.facility.booking_office': 5,
      'demo.v2.06.attributes': 50,
    });
    expect(changes.every((c) => c.status === 'kept')).toBe(true);
    expect(changes.find((c) => c.toGoalId === 'demo.v2.01.facility.repair_bay')).toMatchObject({ fromGoalId: 'demo.v1.05.facility.repair_bay', oldTarget: 7, newTarget: 7 });
  });

  it('clamps a matched target to the new bounds', () => {
    const v2 = deriveGoalSpecs(definition(2, [robots(2, 1, 2), booking(1, 3), attributes(5), booking(3), repair(2), attributes('max')]));
    const { params, changes } = migrateTargets(v1, v2, { targets: { 'demo.v1.01.robots': 3, 'demo.v1.02.facility.booking_office': 6 } });
    expect(params.targets['demo.v2.01.robots']).toBe(2);
    expect(params.targets['demo.v2.02.facility.booking_office']).toBe(3);
    expect(changes[0]).toEqual({
      status: 'clamped', type: 'robots', fromGoalId: 'demo.v1.01.robots', toGoalId: 'demo.v2.01.robots', position: 1, oldTarget: 3, newTarget: 2,
    });
    expect(changes[1]).toMatchObject({ status: 'clamped', facilityType: 'booking_office', oldTarget: 6, newTarget: 3 });
  });

  it('gives a new Goal its default and drops a removed Goal', () => {
    const v2 = deriveGoalSpecs(definition(2, [robots(3, 1, 3), booking(1), attributes(5), refine(8), attributes('max')]));
    const { params, changes } = migrateTargets(v1, v2, { targets: { 'demo.v1.04.facility.booking_office': 4, 'demo.v1.05.facility.repair_bay': 9 } });
    expect(params.targets).toEqual({
      'demo.v2.01.robots': 3,
      'demo.v2.02.facility.booking_office': 1,
      'demo.v2.03.attributes': 5,
      'demo.v2.04.refine': 8,
      'demo.v2.05.attributes': 50,
    });
    expect(changes.filter((c) => c.status === 'new')).toEqual([
      { status: 'new', type: 'refine', fromGoalId: null, toGoalId: 'demo.v2.04.refine', position: 4, oldTarget: null, newTarget: 8 },
    ]);
    expect(changes.filter((c) => c.status === 'removed')).toEqual([
      { status: 'removed', type: 'facility', facilityType: 'booking_office', fromGoalId: 'demo.v1.04.facility.booking_office', toGoalId: null, position: null, oldTarget: 4, newTarget: null },
      { status: 'removed', type: 'facility', facilityType: 'repair_bay', fromGoalId: 'demo.v1.05.facility.repair_bay', toGoalId: null, position: null, oldTarget: 9, newTarget: null },
    ]);
    // The second attributes Goal of v1 is Max; in v2 the second attributes Goal is Max too.
    expect(changes.find((c) => c.toGoalId === 'demo.v2.05.attributes')).toMatchObject({ status: 'kept', oldTarget: 50, newTarget: 50 });
  });

  it('uses the old default for a target the profile never stored', () => {
    const v2 = deriveGoalSpecs(definition(2, [robots(1, 1, 3), booking(1), attributes(5), booking(3), repair(2), attributes('max')]));
    const { params } = migrateTargets(v1, v2, { targets: {} });
    expect(params.targets['demo.v2.01.robots']).toBe(3);
  });

  it('produces parameters that pass the new version schema', () => {
    const v2 = deriveGoalSpecs(definition(2, [robots(2, 1, 2), booking(1, 3), attributes(5), refine(8), attributes('max')]));
    const { params } = migrateTargets(v1, v2, { targets: { 'demo.v1.01.robots': 3, 'demo.v1.02.facility.booking_office': 6 } });
    // Every target is within its new bounds.
    for (const spec of v2) {
      expect(params.targets[spec.id]).toBeGreaterThanOrEqual(spec.bounds.min);
      expect(params.targets[spec.id]).toBeLessThanOrEqual(spec.bounds.max);
    }
  });
});
