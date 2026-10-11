import fs from 'fs';
import path from 'path';
import { deriveGoalSpecs } from '../strategyDefinitionSchema';
import {
  buildParameterSchema,
  defaultParameters,
  describeBuildOrder,
  resolveGoalTarget,
} from '../strategyParameters';
import type { StrategyDefinitionFile } from '../strategyTypes';
import { FIXTURE_STRATEGY_DIRECTORY } from './helpers/strategyTestSupport';

const FIXTURE: StrategyDefinitionFile = JSON.parse(
  fs.readFileSync(path.join(FIXTURE_STRATEGY_DIRECTORY, 'fixture.v1.json'), 'utf8'),
) as StrategyDefinitionFile;
const specs = deriveGoalSpecs(FIXTURE);
const schema = buildParameterSchema(specs);
const defaults = defaultParameters(specs);

describe('Strategy_Parameters (R6.3, R6.4, design §14.0)', () => {
  it('holds every Goal default and validates against its own schema', () => {
    expect(Object.keys(defaults.targets)).toEqual(specs.map((s) => s.id));
    expect(defaults.targets['fixture.v1.10.robots']).toBe(4);
    expect(defaults.targets['fixture.v1.16.attributes']).toBe(50);
    expect(schema.safeParse(defaults).success).toBe(true);
  });

  it('accepts any target within the bounds, on either bound', () => {
    const edited = { targets: { ...defaults.targets, 'fixture.v1.10.robots': 11, 'fixture.v1.02.facility.booking_office': 0 } };
    expect(schema.safeParse(edited).success).toBe(true);
  });

  it.each([
    ['above the bounds', 'fixture.v1.10.robots', 12, 'Allowed 1–11'],
    ['below the bounds', 'fixture.v1.03.attributes', 0, 'Allowed 1–10'],
    ['a fraction', 'fixture.v1.15.refine', 2.5, 'Allowed 0–10'],
    ['not Max on the Max Goal', 'fixture.v1.16.attributes', 49, 'Allowed: Max'],
  ])('rejects a target %s with a per-field error', (_label, goalId, value, message) => {
    const result = schema.safeParse({ targets: { ...defaults.targets, [goalId]: value } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([expect.objectContaining({ path: ['targets', goalId], message })]);
    }
  });

  it('rejects an unknown Goal id and a missing Goal id (the set of Goals is fixed, R6.3)', () => {
    expect(schema.safeParse({ targets: { ...defaults.targets, 'fixture.v1.17.robots': 3 } }).success).toBe(false);
    const { ['fixture.v1.01.robots']: _dropped, ...rest } = defaults.targets;
    expect(schema.safeParse({ targets: rest }).success).toBe(false);
  });

  it('resolves a target from the parameters, falling back to the default', () => {
    const spec = specs[0];
    expect(resolveGoalTarget(spec, { targets: { [spec.id]: 3 } })).toBe(3);
    expect(resolveGoalTarget(spec, { targets: {} })).toBe(spec.defaultTarget);
    expect(resolveGoalTarget(spec, { targets: { [spec.id]: 0 } })).toBe(0);
  });

  it('describes the numbered Build_Order for the admin panels', () => {
    const descriptors = describeBuildOrder(specs);
    expect(descriptors).toHaveLength(specs.length);
    expect(descriptors[0]).toEqual({
      position: 1,
      goalId: 'fixture.v1.01.robots',
      type: 'robots',
      label: 'Robots',
      defaultTarget: 2,
      bounds: { min: 1, max: 3 },
      isMax: false,
      buys: 'Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons',
    });
    expect(descriptors[1]).toMatchObject({ label: 'Booking Office', facilityType: 'booking_office', buys: expect.stringContaining('useful level') });
    expect(descriptors[15]).toMatchObject({ label: 'Attributes', isMax: true, buys: expect.stringContaining('to 50') });
    expect(descriptors.map((d) => d.label)).toContain('Refine');
    expect(descriptors.map((d) => d.label)).toContain('Weapons');
    expect(descriptors.map((d) => d.label)).toContain('Tuning Bay');
  });
});
