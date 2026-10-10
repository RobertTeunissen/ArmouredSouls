import { blueprintDrift } from '../upkeep/blueprintSync';
import { desiredTuningAllocation, tuningChanges, tuningDiffers } from '../upkeep/tuningUpkeep';
import { ROBOT_ATTRIBUTES } from '../../../shared/utils/robotAttributes';
import { TEST_WEIGHTS, blueprint, facilities, robot, stable } from './helpers/automatonFixtures';

describe('blueprint sync (R3.11)', () => {
  it('reports only the stance and yield threshold that differ', () => {
    const facts = stable({
      robots: [
        robot(1, { stance: 'balanced', yieldThreshold: 10 }),
        robot(2, { stance: 'defensive', yieldThreshold: 10 }),
        robot(3, { stance: 'balanced', yieldThreshold: 25 }),
      ],
    });
    const blueprints = [blueprint(1), blueprint(2, { stance: 'offensive' }), blueprint(3, { yieldThreshold: 0 })];
    expect(blueprintDrift(facts, blueprints)).toEqual([
      { robotId: 1002, slotIndex: 2, stance: 'offensive' },
      { robotId: 1003, slotIndex: 3, yieldThreshold: 0 },
    ]);
  });
});

describe('tuning upkeep (R4.5)', () => {
  it('uses the Tuning Bay pool and the per-attribute limits of setTuningAllocation', () => {
    const facts = stable({ facilities: facilities({ tuning_bay: 2 }), robots: [robot(1)] });
    const allocation = desiredTuningAllocation(facts, facts.robots[0], TEST_WEIGHTS.versatile);
    const total = Math.round(ROBOT_ATTRIBUTES.reduce((s, a) => s + allocation[a], 0) * 100) / 100;
    expect(total).toBe(30);
    // Base 1, cap 10 at academy L0: at most 14 per attribute.
    for (const a of ROBOT_ATTRIBUTES) expect(allocation[a]).toBeLessThanOrEqual(14);
  });

  it('compares allocations at 2 decimals, absent = 0', () => {
    expect(tuningDiffers({ combatPower: 1.004 }, { combatPower: 1 })).toBe(false);
    expect(tuningDiffers({}, { combatPower: 0 })).toBe(false);
    expect(tuningDiffers({ combatPower: 1 }, { combatPower: 1.01 })).toBe(true);
  });

  it('writes only robots whose allocation differs', () => {
    const base = stable({ robots: [robot(1), robot(2)] });
    const current = desiredTuningAllocation(base, base.robots[0], TEST_WEIGHTS.versatile);
    const facts = stable({ robots: [robot(1, { tuning: current }), robot(2)] });
    const changes = tuningChanges(facts, [blueprint(1), blueprint(2)], TEST_WEIGHTS);
    expect(changes.map((c) => c.robotId)).toEqual([1002]);
  });
});
