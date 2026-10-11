import {
  ATTRIBUTE_GROUPS,
  academyLevelForTarget,
  attributeTarget,
  attributesOfGroup,
  computeTuningSplit,
  groupOfAttribute,
  groupTargets,
  planAttributeStep,
  priorityOrder,
  type AcademyQuote,
  type AttributePlanInput,
  type AttributePlanRobot,
  type GroupWeights,
} from '../buildFocus';
import { ROBOT_ATTRIBUTES, type RobotAttribute } from '../../../shared/utils/robotAttributes';
import type { AttributeGroup } from '../../../types/automaton';
import { TEST_WEIGHTS, attributesAt } from './helpers/automatonFixtures';

const NO_ACADEMIES: Record<AttributeGroup, number> = { combat: 0, defense: 0, mobility: 0, ai: 0 };
const open = (): AcademyQuote => ({ kind: 'available', cost: 100_000 });

function input(robots: AttributePlanRobot[], overrides: Partial<AttributePlanInput> = {}): AttributePlanInput {
  return {
    robots,
    milestone: 2,
    isMax: false,
    academyLevels: NO_ACADEMIES,
    quoteAcademy: open,
    incrementCost: () => 1_000,
    balance: 10_000_000,
    ...overrides,
  };
}

const r = (slotIndex: number, weights: GroupWeights, attributes = attributesAt(1)): AttributePlanRobot =>
  ({ slotIndex, weights, attributes });

function maxes(value: number, overrides: Partial<Record<RobotAttribute, number>> = {}): Record<RobotAttribute, number> {
  return attributesAt(value, overrides);
}

describe('buildFocus mathematics (R4.2–R4.5)', () => {
  describe('groups and priority', () => {
    it('maps the 23 attributes onto four groups in ATTRIBUTE_TO_ACADEMY order', () => {
      expect(ATTRIBUTE_GROUPS.flatMap(attributesOfGroup)).toEqual([...ROBOT_ATTRIBUTES]);
      expect(attributesOfGroup('combat')).toHaveLength(6);
      expect(attributesOfGroup('ai')).toHaveLength(7);
      expect(groupOfAttribute('formationTactics')).toBe('ai');
      expect(groupOfAttribute('hullIntegrity')).toBe('mobility');
    });

    it('orders groups by weight, ties Combat → Defense → Mobility → AI', () => {
      expect(priorityOrder(TEST_WEIGHTS.deadeye)).toEqual(['combat', 'ai', 'mobility', 'defense']);
      expect(priorityOrder(TEST_WEIGHTS.versatile)).toEqual(['combat', 'defense', 'mobility', 'ai']);
      expect(priorityOrder({ combat: 0.5, defense: 0.5, mobility: 1, ai: 0.5 })).toEqual(['mobility', 'combat', 'defense', 'ai']);
    });
  });

  describe('targets (R4.2)', () => {
    it.each([
      [1, 10, 10], [0.7, 10, 7], [0.8, 10, 8], [0.4, 1, 1], [0.25, 3, 1], [0.8, 25, 20], [0.35, 10, 4], [0.6, 15, 9],
    ])('weight %f at milestone %i gives %i', (weight, milestone, expected) => {
      expect(attributeTarget(weight, milestone, false)).toBe(expected);
    });

    it('gives 50 for every group at Max', () => {
      expect(groupTargets(TEST_WEIGHTS.deadeye, 25, true)).toEqual({ combat: 50, defense: 50, mobility: 50, ai: 50 });
      expect(groupTargets(TEST_WEIGHTS.deadeye, 10, false)).toEqual({ combat: 10, defense: 4, mobility: 5, ai: 8 });
    });

    it.each([[10, 0], [11, 1], [15, 1], [16, 2], [41, 7], [42, 7], [43, 8], [50, 10]])(
      'needs academy level for target %i: L%i', (target, level) => {
        expect(academyLevelForTarget(target)).toBe(level);
      },
    );
  });

  describe('increment selection (R4.3)', () => {
    it('raises every attribute of a single robot to its target as one batch', () => {
      const plan = planAttributeStep(input([r(1, TEST_WEIGHTS.versatile)]));
      expect(plan.kind).toBe('increments');
      if (plan.kind !== 'increments') return;
      expect(plan.robotSlot).toBe(1);
      expect(Object.keys(plan.increments)).toHaveLength(23);
      expect(plan.cost).toBe(23_000);
    });

    it('finishes every robot’s first-priority group before any second-priority group', () => {
      // Robot 1 Bruiser (Combat first), robot 2 Warden (Defense first); 8 increments affordable.
      const plan = planAttributeStep(input([r(1, TEST_WEIGHTS.bruiser), r(2, TEST_WEIGHTS.warden)], { balance: 8_000 }));
      expect(plan).toEqual({
        kind: 'increments',
        robotSlot: 1,
        increments: Object.fromEntries(attributesOfGroup('combat').map((a) => [a, 1])),
        cost: 6_000,
      });
    });

    it('takes the lowest attribute first across robots, even from a higher slot', () => {
      const plan = planAttributeStep(input(
        [r(1, TEST_WEIGHTS.versatile, attributesAt(5)), r(2, TEST_WEIGHTS.versatile, attributesAt(2))],
        { milestone: 6, balance: 1_000 },
      ));
      expect(plan).toMatchObject({ kind: 'increments', robotSlot: 2, increments: { combatPower: 1 } });
    });

    it('breaks ties by lower slot, then attribute order', () => {
      const plan = planAttributeStep(input(
        [r(1, TEST_WEIGHTS.versatile, attributesAt(2, { combatPower: 3 })), r(2, TEST_WEIGHTS.versatile, attributesAt(2))],
        { milestone: 3, balance: 1_000 },
      ));
      expect(plan).toMatchObject({ kind: 'increments', robotSlot: 1, increments: { targetingSystems: 1 } });
    });

    it('is affordable at exactly balance = cost and Saving one credit below', () => {
      const robots = [r(1, TEST_WEIGHTS.versatile)];
      expect(planAttributeStep(input(robots, { balance: 1_000 }))).toMatchObject({ kind: 'increments', cost: 1_000 });
      expect(planAttributeStep(input(robots, { balance: 999 }))).toEqual({
        kind: 'saving', cost: 1_000, next: 'increment', robotSlot: 1, attribute: 'combatPower',
      });
    });

    it('is satisfied when every attribute reaches its target', () => {
      expect(planAttributeStep(input([r(1, TEST_WEIGHTS.versatile, attributesAt(2))]))).toEqual({ kind: 'satisfied' });
    });

    it('targets 50 for every attribute at Max', () => {
      const plan = planAttributeStep(input([r(1, TEST_WEIGHTS.deadeye, attributesAt(9))], { isMax: true, academyLevels: { combat: 10, defense: 10, mobility: 10, ai: 10 } }));
      expect(plan.kind).toBe('increments');
      if (plan.kind === 'increments') expect(plan.increments.armorPlating).toBe(41);
    });
  });

  describe('academies (R4.4)', () => {
    it('plans the academy level when the next increment is at the cap', () => {
      const plan = planAttributeStep(input([r(1, TEST_WEIGHTS.versatile, attributesAt(10))], { milestone: 12 }));
      expect(plan).toEqual({ kind: 'academy', group: 'combat', toLevel: 1, cost: 100_000 });
    });

    it('returns the increments bought before the cap first', () => {
      const plan = planAttributeStep(input(
        [r(1, TEST_WEIGHTS.versatile, attributesAt(10, { combatPower: 9 }))], { milestone: 12 },
      ));
      expect(plan).toMatchObject({ kind: 'increments', increments: { combatPower: 1 } });
    });

    it('saves for an unaffordable academy level', () => {
      const plan = planAttributeStep(input([r(1, TEST_WEIGHTS.versatile, attributesAt(10))], { milestone: 12, balance: 50_000 }));
      expect(plan).toEqual({ kind: 'saving', cost: 100_000, next: 'academy', group: 'combat' });
    });

    it('raises a gated group to its current cap and moves on to the next group', () => {
      const quoteAcademy = (group: AttributeGroup): AcademyQuote => (group === 'combat'
        ? { kind: 'unavailable', detail: { facilityType: 'combat_training_academy', level: 1 } }
        : { kind: 'available', cost: 100_000 });
      const plan = planAttributeStep(input(
        [r(1, TEST_WEIGHTS.versatile, attributesAt(10, { combatPower: 8 }))], { milestone: 12, quoteAcademy },
      ));
      // combatPower 8 → 10 (the cap) first, then the next group.
      expect(plan).toMatchObject({ kind: 'increments', increments: { combatPower: 2 } });

      const afterwards = planAttributeStep(input([r(1, TEST_WEIGHTS.versatile, attributesAt(10))], { milestone: 12, quoteAcademy }));
      expect(afterwards).toEqual({ kind: 'academy', group: 'defense', toLevel: 1, cost: 100_000 });
    });

    it('is Blocked only when all remaining work is behind gated academies', () => {
      const gatedAll = (group: AttributeGroup): AcademyQuote => ({ kind: 'unavailable', detail: { group, level: 1 } });
      const plan = planAttributeStep(input([r(1, TEST_WEIGHTS.versatile, attributesAt(10))], { milestone: 12, quoteAcademy: gatedAll }));
      expect(plan).toEqual({ kind: 'blocked', group: 'combat', detail: { group: 'combat', level: 1 } });
    });

    it('uses the highest target of any robot for a stable-wide academy', () => {
      // Robot 1 needs only Combat 10 (within the cap); robot 2 needs Combat 12, so the Combat academy is planned.
      const combatAt10 = Object.fromEntries(attributesOfGroup('combat').map((a) => [a, 10]));
      const plan = planAttributeStep(input(
        [r(1, { combat: 0.8, defense: 1, mobility: 1, ai: 1 }, attributesAt(12, combatAt10)), r(2, TEST_WEIGHTS.versatile, attributesAt(12, { combatPower: 10 }))],
        { milestone: 12, academyLevels: { combat: 0, defense: 1, mobility: 1, ai: 1 } },
      ));
      expect(plan).toEqual({ kind: 'academy', group: 'combat', toLevel: 1, cost: 100_000 });
    });
  });

  describe('tuning split (R4.5)', () => {
    const sum = (values: Record<RobotAttribute, number>): number =>
      Math.round(ROBOT_ATTRIBUTES.reduce((s, a) => s + values[a], 0) * 100) / 100;

    it('gives each group pool × w / Σw, split evenly within the group', () => {
      // 23 points, equal weights: 5.75 per group over 6, 5, 5 and 7 attributes.
      const split = computeTuningSplit(TEST_WEIGHTS.versatile, 23, maxes(15));
      for (const a of attributesOfGroup('combat')) expect(split[a]).toBe(0.96);
      for (const a of attributesOfGroup('defense')) expect(split[a]).toBe(1.15);
      for (const a of attributesOfGroup('mobility')) expect(split[a]).toBe(1.15);
      for (const a of attributesOfGroup('ai')) expect(split[a]).toBe(0.82);
      expect(sum(split)).toBe(23);
    });

    it('weights groups and keeps the total at the pool size, 2 decimals', () => {
      const split = computeTuningSplit(TEST_WEIGHTS.bruiser, 10, maxes(15));
      expect(sum(split)).toBe(10);
      for (const a of ROBOT_ATTRIBUTES) expect(Math.round(split[a] * 100)).toBeCloseTo(split[a] * 100, 6);
      expect(split.combatPower).toBeGreaterThan(split.armorPlating);
      expect(split.armorPlating).toBeGreaterThan(split.combatAlgorithms);
    });

    it('clips at the per-attribute maximum and redistributes in group order', () => {
      const split = computeTuningSplit(
        TEST_WEIGHTS.bruiser,
        30,
        maxes(15, Object.fromEntries(attributesOfGroup('combat').map((a) => [a, 0.5]))),
      );
      for (const a of attributesOfGroup('combat')) expect(split[a]).toBe(0.5);
      expect(sum(split)).toBe(30);
      // The Combat surplus goes to Defense (second priority), not to AI.
      const even = computeTuningSplit(TEST_WEIGHTS.bruiser, 30, maxes(15));
      expect(split.armorPlating).toBeGreaterThan(even.armorPlating);
      expect(Math.abs(split.combatAlgorithms - even.combatAlgorithms)).toBeLessThanOrEqual(0.01);
    });

    it('allocates only what fits when every attribute is clipped', () => {
      expect(sum(computeTuningSplit(TEST_WEIGHTS.versatile, 110, maxes(1)))).toBe(23);
    });

    it('rounds by largest remainder with attribute order as tie-break', () => {
      // 1 point: AI attributes get 3.57 hundredths each; the 5 spare hundredths
      // go to the largest remainders (all AI, equal), first in attribute order.
      const split = computeTuningSplit(TEST_WEIGHTS.versatile, 1, maxes(15));
      expect(sum(split)).toBe(1);
      attributesOfGroup('ai').forEach((a, i) => expect(split[a]).toBe(i < 5 ? 0.04 : 0.03));
      for (const a of attributesOfGroup('combat')) expect(split[a]).toBe(0.04);
      for (const a of attributesOfGroup('defense')) expect(split[a]).toBe(0.05);
    });

    it('is deterministic', () => {
      expect(computeTuningSplit(TEST_WEIGHTS.tactician, 60, maxes(12))).toEqual(computeTuningSplit(TEST_WEIGHTS.tactician, 60, maxes(12)));
    });
  });
});
