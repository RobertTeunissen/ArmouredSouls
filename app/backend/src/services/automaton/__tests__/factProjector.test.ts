import {
  chargedStepCount,
  projectAction,
  projectTeamUpkeep,
  ProjectionError,
  type ProjectionContext,
} from '../factProjector';
import { createRobotCountGoal } from '../goals/robotCountGoal';
import { createWeaponStageGoal } from '../goals/weaponStageGoal';
import { createRefinementGoal } from '../goals/refinementGoal';
import type { GoalOutcome, PlannedAction } from '../goals/goalTypes';
import { matchedStageIndex } from '../stableFacts';
import {
  armedRobot,
  attributesAt,
  blueprint,
  context,
  facilities,
  item,
  refinements,
  robot,
  stable,
  team,
} from './helpers/automatonFixtures';

const blueprints = Array.from({ length: 11 }, (_, i) => blueprint(i + 1));
const projection: ProjectionContext = { blueprints, teamNames: null };

function actionOf(outcome: GoalOutcome): PlannedAction {
  if (outcome.kind !== 'actionable') throw new Error(`expected actionable, got ${outcome.kind}`);
  return outcome.action;
}

describe('factProjector (R11.4 support, design §8.3)', () => {
  describe('facility_upgrade', () => {
    it('raises the level and charges the cost', () => {
      const facts = stable({ balance: 1_000_000 });
      const next = projectAction(facts, { kind: 'facility_upgrade', facilityType: 'repair_bay', toLevel: 1, cost: 200_000 }, projection);
      expect(next.facilities.repair_bay).toBe(1);
      expect(next.balance).toBe(800_000);
    });

    it('refuses a level that does not follow the current one', () => {
      const facts = stable({ facilities: facilities({ repair_bay: 2 }) });
      expect(() => projectAction(facts, { kind: 'facility_upgrade', facilityType: 'repair_bay', toLevel: 4, cost: 1 }, projection))
        .toThrow(ProjectionError);
    });
  });

  describe('attribute_upgrade', () => {
    it('adds whole levels from the floor of the current value and charges the batch', () => {
      const facts = stable({ robots: [robot(1, { attributes: attributesAt(1, { combatPower: 3.7 }) })], balance: 100_000 });
      const next = projectAction(facts, {
        kind: 'attribute_upgrade', robotSlot: 1, increments: { combatPower: 2, armorPlating: 1 }, cost: 12_000,
      }, projection);
      expect(next.robots[0].attributes.combatPower).toBe(5);
      expect(next.robots[0].attributes.armorPlating).toBe(2);
      expect(next.robots[0].attributes.hullIntegrity).toBe(1);
      expect(next.balance).toBe(88_000);
    });

    it('refuses a slot without a live robot', () => {
      expect(() => projectAction(stable(), { kind: 'attribute_upgrade', robotSlot: 3, increments: {}, cost: 0 }, projection))
        .toThrow('No live robot in slot 3');
    });
  });

  describe('robot_chain', () => {
    const goal = createRobotCountGoal('test.v1.01.robots');

    it('buys, names, arms and stages the first robot', () => {
      const facts = stable({ balance: 3_000_000 });
      const action = actionOf(goal.evaluate(facts, context(facts, { target: 1, blueprints })));
      const next = projectAction(facts, action, projection);
      expect(next.robots).toHaveLength(1);
      const [rex] = next.robots;
      expect(rex).toMatchObject({ slotIndex: 1, blueprintId: 101, loadoutType: 'single', stance: 'balanced', yieldThreshold: 10, stageIndex: 0 });
      expect(rex.attributes.combatPower).toBe(1);
      expect(next.inventory).toEqual([{ inventoryId: 1, weaponName: 'Practice Blade', pricePaid: 50_000, createdAtMs: 1, refinements: [] }]);
      expect(rex.mainInventoryId).toBe(1);
      expect(next.takenRobotNames).toEqual(['Unit 1']);
      expect(next.balance).toBe(3_000_000 - 550_000);
      expect(next.teams).toEqual([]);
    });

    it('buys the roster levels and registers the 2v2 team the second robot completes', () => {
      const facts = stable({ robots: [armedRobot(1, 1)], inventory: [item(1, 'Practice Blade')], balance: 3_000_000 });
      const action = actionOf(goal.evaluate(facts, context(facts, { target: 2, blueprints })));
      const next = projectAction(facts, action, { blueprints, teamNames: { twoVsTwo: ['Red Pair'], threeVsThree: [] } });
      expect(next.facilities.roster_expansion).toBe(1);
      expect(next.robots.map((r) => r.slotIndex)).toEqual([1, 2]);
      expect(next.teams).toEqual([{ teamId: 1, size: 2, name: 'Red Pair', memberRobotIds: [1001, 1002] }]);
    });

    it('does not register a team that has no Team_Names entry', () => {
      const facts = stable({ robots: [armedRobot(1, 1)], inventory: [item(1, 'Practice Blade')], balance: 3_000_000 });
      const action = actionOf(goal.evaluate(facts, context(facts, { target: 2, blueprints })));
      const next = projectAction(facts, action, { blueprints, teamNames: { twoVsTwo: [], threeVsThree: [] } });
      expect(next.teams).toEqual([]);
    });

    it('reuses an unequipped weapon and applies Storage_Overflow_Rule sales', () => {
      // Storage L0 holds 5: four spare Volt Sabres fill it with the equipped blade.
      const spares = [2, 3, 4, 5].map((id) => item(id, 'Volt Sabre', { pricePaid: 400_000 }));
      const facts = stable({
        robots: [armedRobot(1, 1)],
        inventory: [item(1, 'Practice Blade'), ...spares],
        facilities: facilities({ roster_expansion: 1 }),
        balance: 3_000_000,
      });
      const action = actionOf(goal.evaluate(facts, context(facts, { target: 2, blueprints })));
      const next = projectAction(facts, action, projection);
      const second = next.robots[1];
      // The highest stage Weapon_Reuse can fill is stage 1 (Volt Sabre); no purchase, no sale needed.
      expect(second.stageIndex).toBe(1);
      expect(second.mainInventoryId).toBe(2);
      expect(next.inventory).toHaveLength(5);
      expect(next.balance).toBe(3_000_000 - 500_000);
    });

    it('sells for room before a purchase and credits the proceeds', () => {
      const facts = stable({
        robots: [armedRobot(1, 1)],
        inventory: [item(1, 'Practice Blade'), ...[2, 3, 4, 5].map((id) => item(id, 'Laser Pistol', { pricePaid: 60_000 }))],
        facilities: facilities({ roster_expansion: 1 }),
        balance: 3_000_000,
      });
      const action = actionOf(goal.evaluate(facts, context(facts, { target: 2, blueprints })));
      if (action.kind !== 'robot_chain') throw new Error('expected robot_chain');
      const sale = action.steps.find((step) => step.kind === 'weapon_sale');
      expect(sale).toBeDefined();
      const next = projectAction(facts, action, projection);
      expect(next.inventory).toHaveLength(5);
      expect(next.inventory.some((i) => sale?.kind === 'weapon_sale' && i.inventoryId === sale.inventoryId)).toBe(false);
      const proceeds = sale?.kind === 'weapon_sale' ? sale.proceeds : 0;
      expect(next.balance).toBe(3_000_000 + proceeds - 500_000 - 50_000);
    });
  });

  describe('weapon_stage', () => {
    const goal = createWeaponStageGoal('test.v1.05.weapons');

    it('buys and equips the next stage and keeps the replaced weapon in storage', () => {
      const facts = stable({ robots: [armedRobot(1, 1)], inventory: [item(1, 'Practice Blade')], balance: 1_000_000 });
      const action = actionOf(goal.evaluate(facts, context(facts, { target: 1, blueprints })));
      const next = projectAction(facts, action, projection);
      expect(next.robots[0].stageIndex).toBe(1);
      expect(next.robots[0].mainInventoryId).toBe(2);
      expect(next.inventory.map((i) => i.weaponName)).toEqual(['Practice Blade', 'Volt Sabre']);
      expect(next.balance).toBe(600_000);
    });

    it('unequips, changes the loadout and equips both hands for a loadout edit', () => {
      const shieldBlueprint = blueprint(1, { loadoutType: 'weapon_shield', weaponPath: [{ main: 'Practice Blade', offhand: 'Aegis Bulwark' }] });
      const facts = stable({
        robots: [armedRobot(1, 1, -1, { loadoutType: 'two_handed', mainInventoryId: 1 })],
        inventory: [item(1, 'Railgun'), item(2, 'Practice Blade')],
        balance: 1_000_000,
      });
      const ctx = context(facts, { target: 3, blueprints: [shieldBlueprint] });
      const action = actionOf(goal.evaluate(facts, ctx));
      const next = projectAction(facts, action, { blueprints: [shieldBlueprint], teamNames: null });
      const [r] = next.robots;
      expect(r.loadoutType).toBe('weapon_shield');
      expect(r.mainInventoryId).toBe(2);
      expect(next.inventory.find((i) => i.inventoryId === r.offhandInventoryId)?.weaponName).toBe('Aegis Bulwark');
      expect(r.stageIndex).toBe(0);
      expect(next.balance).toBe(700_000);
    });

    it('re-derives stageIndex with matchedStageIndex', () => {
      const facts = stable({ robots: [armedRobot(1, 1)], inventory: [item(1, 'Practice Blade')], balance: 1_000_000 });
      const next = projectAction(facts, actionOf(goal.evaluate(facts, context(facts, { target: 1, blueprints }))), projection);
      expect(next.robots[0].stageIndex).toBe(matchedStageIndex(next.robots[0], blueprints[0], next.inventory));
    });
  });

  describe('weapon_refinement', () => {
    const goal = createRefinementGoal('test.v1.06.refine');

    it('buys the Workshop chain, adds the refinement row and raises pricePaid', () => {
      const facts = stable({
        robots: [armedRobot(1, 1, 1)],
        inventory: [item(1, 'Volt Sabre', { pricePaid: 400_000 })],
        facilities: facilities({ weapons_workshop: 4 }),
        prestige: 10_000,
        balance: 5_000_000,
      });
      const outcome = goal.evaluate(facts, context(facts, { target: 1, blueprints }));
      if (outcome.kind !== 'actionable' || outcome.action.kind !== 'weapon_refinement') throw new Error('expected refinement');
      const { action, cost } = outcome;
      const next = projectAction(facts, action, projection);
      expect(next.facilities.weapons_workshop).toBe(5);
      expect(next.inventory[0].refinements).toEqual(refinements('sharpen'));
      expect(next.inventory[0].pricePaid).toBe(400_000 + action.refinementCost);
      expect(next.balance).toBe(5_000_000 - cost);
    });
  });

  it('never mutates its input', () => {
    const facts = stable({ robots: [armedRobot(1, 1)], inventory: [item(1, 'Practice Blade')], balance: 3_000_000 });
    const snapshot = JSON.stringify(facts);
    const goal = createRobotCountGoal('test.v1.01.robots');
    projectAction(facts, actionOf(goal.evaluate(facts, context(facts, { target: 3, blueprints }))), projection);
    projectAction(facts, { kind: 'attribute_upgrade', robotSlot: 1, increments: { combatPower: 1 }, cost: 1 }, projection);
    expect(JSON.stringify(facts)).toBe(snapshot);
  });

  describe('projectTeamUpkeep', () => {
    it('names teams from Team_Names, 2v2 before 3v3, and skips registered teams', () => {
      const facts = stable({
        robots: [robot(1), robot(2), robot(3)],
        teams: [team(7, 2, [1001, 1002], 'Existing')],
      });
      const next = projectTeamUpkeep(facts, { twoVsTwo: ['Ignored'], threeVsThree: ['Trio'] });
      expect(next.teams).toEqual([
        team(7, 2, [1001, 1002], 'Existing'),
        { teamId: 8, size: 3, name: 'Trio', memberRobotIds: [1001, 1002, 1003] },
      ]);
    });

    it('uses placeholder names without Team_Names', () => {
      const next = projectTeamUpkeep(stable({ robots: [robot(1), robot(2)] }), null);
      expect(next.teams).toEqual([{ teamId: 1, size: 2, name: '2v2 Team 1', memberRobotIds: [1001, 1002] }]);
    });
  });

  describe('chargedStepCount (R5.11, R8.1)', () => {
    it('counts every Financial_Pair step and no free step', () => {
      expect(chargedStepCount({ kind: 'facility_upgrade', facilityType: 'repair_bay', toLevel: 1, cost: 1 })).toBe(1);
      expect(chargedStepCount({ kind: 'attribute_upgrade', robotSlot: 1, increments: { combatPower: 3 }, cost: 1 })).toBe(1);
      expect(chargedStepCount({
        kind: 'robot_chain',
        slotIndex: 2,
        steps: [
          { kind: 'weapon_sale', inventoryId: 3, proceeds: 1 },
          { kind: 'facility_upgrade', facilityType: 'roster_expansion', toLevel: 1, cost: 1 },
          { kind: 'robot_purchase', robotName: 'X', cost: 1 },
          {
            kind: 'fitout', stageIndex: 0, loadoutType: 'dual_wield', equip: [],
            purchases: [{ hand: 'main', weaponName: 'A', cost: 1 }, { hand: 'offhand', weaponName: 'B', cost: 1 }],
          },
        ],
      })).toBe(5);
      expect(chargedStepCount({
        kind: 'weapon_stage',
        robotSlot: 1,
        toStage: 1,
        steps: [
          { kind: 'weapon_purchase', weaponName: 'A', hand: 'main', cost: 1 },
          { kind: 'unequip', hand: 'main' },
          { kind: 'loadout_change', loadoutType: 'single' },
          { kind: 'equip', hand: 'main', weaponName: 'A', source: { kind: 'purchase' } },
        ],
      })).toBe(1);
      expect(chargedStepCount({
        kind: 'weapon_refinement', robotSlot: 1, inventoryId: 1, step: { tier: 'hone', hand: 'main', magnitude: 1, targetAttribute: 'combatPower' },
        chain: [{ kind: 'facility_upgrade', facilityType: 'weapons_workshop', toLevel: 1, cost: 1 }], refinementCost: 1,
      })).toBe(2);
    });
  });
});
