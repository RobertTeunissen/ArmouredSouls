import { createAttributeGoal } from '../../goals/attributeGoal';
import { attributeIncrementCost } from '../../pricing';
import { attributesOfGroup } from '../../buildFocus';
import { TEST_WEIGHTS, attributesAt, blueprint, context, facilities, robot, stable } from '../helpers/automatonFixtures';

const milestone = createAttributeGoal('test.v1.03.attributes', { isMax: false, weightTable: TEST_WEIGHTS });
const max = createAttributeGoal('test.v1.25.attributes', { isMax: true, weightTable: TEST_WEIGHTS });

describe('attributes Goal (R4.2–R4.4, R5.2)', () => {
  it('prices increments with the Training Facility discount at the stable’s Roster_Capacity', () => {
    const facts = stable({ facilities: facilities({ training_facility: 4, roster_expansion: 2 }), robots: [robot(1)] });
    const outcome = milestone.evaluate(facts, context(facts, { target: 2 }));
    expect(outcome).toMatchObject({ kind: 'actionable', action: { kind: 'attribute_upgrade', robotSlot: 1 } });
    // 23 attributes 1 → 2 at Training L4 with Roster_Capacity 3.
    if (outcome.kind === 'actionable') expect(outcome.cost).toBe(23 * attributeIncrementCost(1, 2, 4, 3));
  });

  it('uses each robot’s Build_Focus for its targets', () => {
    // Deadeye at milestone 10: Combat 10, AI 8, Mobility 5, Defense 4.
    const facts = stable({ robots: [robot(1, { attributes: attributesAt(1) })] });
    const outcome = milestone.evaluate(facts, context(facts, { target: 10, blueprints: [blueprint(1, { buildFocus: 'deadeye' })] }));
    if (outcome.kind !== 'actionable' || outcome.action.kind !== 'attribute_upgrade') throw new Error('expected increments');
    expect(outcome.action.increments.combatPower).toBe(9);
    expect(outcome.action.increments.combatAlgorithms).toBe(7);
    expect(outcome.action.increments.hullIntegrity).toBe(4);
    expect(outcome.action.increments.armorPlating).toBe(3);
  });

  it('plans the academy level as a facility upgrade when an increment reaches the cap', () => {
    const facts = stable({ robots: [robot(1, { attributes: attributesAt(10) })] });
    expect(milestone.evaluate(facts, context(facts, { target: 12 }))).toEqual({
      kind: 'actionable',
      goalId: 'test.v1.03.attributes',
      action: { kind: 'facility_upgrade', facilityType: 'combat_training_academy', toLevel: 1, cost: 100_000 },
      cost: 100_000,
    });
  });

  it('is Blocked with prestige_gate only when every group with work is behind a gated academy', () => {
    const facts = stable({
      facilities: facilities({
        combat_training_academy: 3, defense_training_academy: 3, mobility_training_academy: 3, ai_training_academy: 3,
      }),
      robots: [robot(1, { attributes: attributesAt(25) })],
      prestige: 0,
    });
    expect(milestone.evaluate(facts, context(facts, { target: 30 }))).toEqual({
      kind: 'blocked',
      goalId: 'test.v1.03.attributes',
      reason: 'prestige_gate',
      detail: { facilityType: 'combat_training_academy', level: 4, prestigeRequired: 1000, prestigeHeld: 0, group: 'combat' },
    });
  });

  it('raises the other groups when only one academy is gated', () => {
    const facts = stable({
      facilities: facilities({ combat_training_academy: 3, defense_training_academy: 4 }),
      robots: [robot(1, { attributes: attributesAt(1, Object.fromEntries(attributesOfGroup('combat').map((a) => [a, 25]))) })],
      prestige: 0,
      balance: 50_000_000,
    });
    const outcome = milestone.evaluate(facts, context(facts, { target: 30 }));
    expect(outcome).toMatchObject({ kind: 'actionable', action: { kind: 'attribute_upgrade' } });
    if (outcome.kind === 'actionable' && outcome.action.kind === 'attribute_upgrade') {
      expect(outcome.action.increments.combatPower).toBeUndefined();
      expect(outcome.action.increments.armorPlating).toBe(29);
    }
  });

  it('saves when the next increment is unaffordable and never blocks for lack of credits', () => {
    const facts = stable({ robots: [robot(1)], balance: 0 });
    expect(milestone.evaluate(facts, context(facts, { target: 5 }))).toMatchObject({
      kind: 'saving', cost: attributeIncrementCost(1, 2, 0, 1), detail: { next: 'increment', robotSlot: 1, attribute: 'combatPower' },
    });
  });

  it('needs no Training Facility', () => {
    const facts = stable({ facilities: facilities({ training_facility: 0 }), robots: [robot(1)] });
    expect(milestone.evaluate(facts, context(facts, { target: 3 })).kind).toBe('actionable');
  });

  it('is Satisfied when every robot reaches its targets and targets 50 at Max', () => {
    const facts = stable({ robots: [robot(1, { attributes: attributesAt(10) })] });
    expect(milestone.evaluate(facts, context(facts, { target: 10 })).kind).toBe('satisfied');
    expect(max.evaluate(facts, context(facts, { target: 50 })).kind).toBe('actionable');
  });

  it('ignores a robot without a blueprint (defensive)', () => {
    const facts = stable({ robots: [robot(1, { blueprintId: null })] });
    expect(milestone.evaluate(facts, context(facts, { target: 10 })).kind).toBe('satisfied');
  });
});
