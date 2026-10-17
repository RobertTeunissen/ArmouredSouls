import { createRobotCountGoal } from '../../goals/robotCountGoal';
import { robotNameCandidates } from '../../robotNaming';
import type { GoalOutcome } from '../../goals/goalTypes';
import { blueprint, context, facilities, item, robot, stable } from '../helpers/automatonFixtures';

const goal = createRobotCountGoal('test.v1.01.robots');
const blueprints = Array.from({ length: 11 }, (_, i) => blueprint(i + 1));

function actionOf(outcome: GoalOutcome) {
  if (outcome.kind !== 'actionable' || outcome.action.kind !== 'robot_chain') throw new Error(`expected a robot chain, got ${outcome.kind}`);
  return { action: outcome.action, cost: outcome.cost };
}

/** `count` live robots, each holding its own Practice Blade (inventory ids 1..count). */
function armedStable(count: number, overrides: Parameters<typeof stable>[0] = {}) {
  return stable({
    robots: Array.from({ length: count }, (_, i) => robot(i + 1, { mainInventoryId: i + 1 })),
    inventory: Array.from({ length: count }, (_, i) => item(i + 1, 'Practice Blade')),
    ...overrides,
  });
}

describe('robots Goal and Robot_Chain (R3.7, R5.2, R5.4, design §8.5)', () => {
  it('is Satisfied when live robots reach the target', () => {
    const facts = armedStable(2, { facilities: facilities({ roster_expansion: 1 }) });
    expect(goal.evaluate(facts, context(facts, { target: 2, blueprints })).kind).toBe('satisfied');
  });

  it('buys the first robot with its stage-0 weapon in one chain', () => {
    const facts = stable();
    const { action, cost } = actionOf(goal.evaluate(facts, context(facts, { target: 1, blueprints })));
    expect(action).toEqual({
      kind: 'robot_chain',
      slotIndex: 1,
      steps: [
        { kind: 'robot_purchase', robotName: 'Unit 1', cost: 500_000 },
        {
          kind: 'fitout',
          stageIndex: 0,
          loadoutType: 'single',
          equip: [{ hand: 'main', weaponName: 'Practice Blade', source: { kind: 'purchase' } }],
          purchases: [{ hand: 'main', weaponName: 'Practice Blade', cost: 50_000 }],
        },
      ],
    });
    expect(cost).toBe(550_000);
  });

  it('adds the missing Roster Expansion levels and the Workshop discount to the chain cost', () => {
    const facts = armedStable(2, { facilities: facilities({ roster_expansion: 0, weapons_workshop: 2 }) });
    const { action, cost } = actionOf(goal.evaluate(facts, context(facts, { target: 3, blueprints })));
    expect(action.steps.slice(0, 2)).toEqual([
      { kind: 'facility_upgrade', facilityType: 'roster_expansion', toLevel: 1, cost: 150_000 },
      { kind: 'facility_upgrade', facilityType: 'roster_expansion', toLevel: 2, cost: 300_000 },
    ]);
    // 450,000 roster + 500,000 robot + 45,000 blade at 10% off (Workshop L2, Season 2).
    expect(cost).toBe(995_000);
    expect(action.slotIndex).toBe(3);
  });

  it('saves for the whole chain and is Actionable at exactly balance = cost', () => {
    const short = stable({ balance: 549_999 });
    expect(goal.evaluate(short, context(short, { target: 1, blueprints }))).toMatchObject({ kind: 'saving', cost: 550_000 });
    const exact = stable({ balance: 550_000 });
    expect(goal.evaluate(exact, context(exact, { target: 1, blueprints })).kind).toBe('actionable');
  });

  it('is Blocked by a prestige-gated Roster Expansion level, whatever the balance', () => {
    const facts = armedStable(4, { facilities: facilities({ roster_expansion: 3 }), prestige: 640, balance: 50_000_000 });
    expect(goal.evaluate(facts, context(facts, { target: 11, blueprints }))).toEqual({
      kind: 'blocked',
      goalId: 'test.v1.01.robots',
      reason: 'prestige_gate',
      detail: { facilityType: 'roster_expansion', level: 4, prestigeRequired: 1000, prestigeHeld: 640 },
    });
  });

  it('is Blocked with roster_limit at 11 robots', () => {
    const facts = armedStable(11, { facilities: facilities({ roster_expansion: 10, storage_facility: 2 }) });
    expect(goal.evaluate(facts, context(facts, { target: 12, blueprints }))).toMatchObject({ kind: 'blocked', reason: 'roster_limit' });
  });

  it('is Blocked with the defensive no_blueprint when the next slot has no blueprint', () => {
    const facts = armedStable(2, { facilities: facilities({ roster_expansion: 1 }) });
    expect(goal.evaluate(facts, context(facts, { target: 3, blueprints: blueprints.slice(0, 2) }))).toMatchObject({
      kind: 'blocked', reason: 'no_blueprint', detail: { slotIndex: 3 },
    });
  });

  it('suffixes a taken name and is Blocked with name_unavailable when all are taken', () => {
    const taken = stable({ takenRobotNames: ['Unit 1'] });
    const { action } = actionOf(goal.evaluate(taken, context(taken, { target: 1, blueprints })));
    expect(action.steps[0]).toEqual({ kind: 'robot_purchase', robotName: 'Unit 1 Mk II', cost: 500_000 });

    const allTaken = stable({ takenRobotNames: robotNameCandidates('Unit 1') });
    expect(goal.evaluate(allTaken, context(allTaken, { target: 1, blueprints }))).toMatchObject({
      kind: 'blocked', reason: 'name_unavailable',
    });
  });

  describe('Weapon_Reuse', () => {
    it('starts a new robot at the highest stage storage can fill, buying nothing', () => {
      const facts = stable({
        facilities: facilities({ roster_expansion: 1 }),
        robots: [robot(1, { mainInventoryId: 1, stageIndex: 1 })],
        inventory: [item(1, 'Volt Sabre'), item(2, 'Practice Blade'), item(3, 'Volt Sabre')],
      });
      const { action, cost } = actionOf(goal.evaluate(facts, context(facts, { target: 2, blueprints })));
      expect(action.steps[1]).toEqual({
        kind: 'fitout',
        stageIndex: 1,
        loadoutType: 'single',
        equip: [{ hand: 'main', weaponName: 'Volt Sabre', source: { kind: 'inventory', inventoryId: 3 } }],
        purchases: [],
      });
      expect(cost).toBe(500_000);
    });

    it('reuses per hand at stage 0 and buys only the missing hand', () => {
      const dual = blueprint(1, { loadoutType: 'dual_wield', weaponPath: [{ main: 'Laser Pistol', offhand: 'Laser Pistol' }] });
      const facts = stable({ inventory: [item(7, 'Laser Pistol')] });
      const { action, cost } = actionOf(goal.evaluate(facts, context(facts, { target: 1, blueprints: [dual] })));
      expect(action.steps[1]).toMatchObject({
        stageIndex: 0,
        loadoutType: 'dual_wield',
        equip: [
          { hand: 'main', source: { kind: 'inventory', inventoryId: 7 } },
          { hand: 'offhand', source: { kind: 'purchase' } },
        ],
        purchases: [{ hand: 'offhand', weaponName: 'Laser Pistol', cost: 60_000 }],
      });
      expect(cost).toBe(560_000);
    });

    it('buys two different weapons for a dual_wield stage', () => {
      const dual = blueprint(1, { loadoutType: 'dual_wield', weaponPath: [{ main: 'Laser Pistol', offhand: 'Practice Blade' }] });
      const facts = stable();
      const { cost, action } = actionOf(goal.evaluate(facts, context(facts, { target: 1, blueprints: [dual] })));
      expect(cost).toBe(610_000);
      expect(action.steps[1]).toMatchObject({ purchases: [{ weaponName: 'Laser Pistol' }, { weaponName: 'Practice Blade' }] });
    });
  });

  describe('Storage_Overflow_Rule in the Robot_Chain', () => {
    // Robot 1 holds item 1; four unequipped items fill the 5 slots of Storage L0.
    const fullStorage = (inventory: ReturnType<typeof item>[]) => stable({
      facilities: facilities({ roster_expansion: 1, weapons_workshop: 1 }),
      robots: [robot(1, { mainInventoryId: 1 })],
      inventory: [item(1, 'Practice Blade'), ...inventory],
    });

    it('makes room with a sale before any Storage Facility level; proceeds are not subtracted', () => {
      const facts = fullStorage([
        item(2, 'Railgun', { pricePaid: 500_000 }),
        item(3, 'Laser Pistol', { pricePaid: 10_000 }),
        item(4, 'Laser Pistol', { pricePaid: 20_000 }),
        item(5, 'Laser Pistol', { pricePaid: 30_000 }),
      ]);
      const withPistolPath = [blueprint(1), blueprint(2), blueprint(3, { weaponPath: [{ main: 'Laser Pistol' }] })];
      const { action, cost } = actionOf(goal.evaluate(facts, context(facts, { target: 2, blueprints: withPistolPath })));
      // The Railgun is on no Weapon_Path, so it goes first despite the highest resale value.
      expect(action.steps.map((s) => s.kind)).toEqual(['weapon_sale', 'robot_purchase', 'fitout']);
      expect(action.steps[0]).toEqual({ kind: 'weapon_sale', inventoryId: 2, proceeds: 50_000 });
      // Workshop L1: 5% off the ₡50,000 pistol (Season 2).
      expect(cost).toBe(500_000 + 47_500);
    });

    it('sells the lowest resale value next, ties oldest first', () => {
      const facts = fullStorage([
        item(2, 'Laser Pistol', { pricePaid: 30_000, createdAtMs: 1 }),
        item(3, 'Laser Pistol', { pricePaid: 10_000, createdAtMs: 9 }),
        item(4, 'Laser Pistol', { pricePaid: 10_000, createdAtMs: 5 }),
        item(5, 'Laser Pistol', { pricePaid: 20_000, createdAtMs: 2 }),
      ]);
      const pistolPath = [blueprint(1), blueprint(2), blueprint(3, { weaponPath: [{ main: 'Laser Pistol' }] })];
      const { action } = actionOf(goal.evaluate(facts, context(facts, { target: 2, blueprints: pistolPath })));
      expect(action.steps[0]).toEqual({ kind: 'weapon_sale', inventoryId: 4, proceeds: 1_000 });
    });

    it('buys a Storage Facility level only when nothing unequipped is left', () => {
      const facts = stable({
        facilities: facilities({ roster_expansion: 5 }),
        prestige: 100_000,
        robots: Array.from({ length: 5 }, (_, i) => robot(i + 1, { mainInventoryId: i + 1 })),
        inventory: Array.from({ length: 5 }, (_, i) => item(i + 1, 'Practice Blade')),
      });
      const { action, cost } = actionOf(goal.evaluate(facts, context(facts, { target: 6, blueprints })));
      expect(action.steps.slice(0, 1)).toEqual([{ kind: 'facility_upgrade', facilityType: 'storage_facility', toLevel: 1, cost: 75_000 }]);
      expect(cost).toBe(75_000 + 500_000 + 50_000);
    });
  });
});
