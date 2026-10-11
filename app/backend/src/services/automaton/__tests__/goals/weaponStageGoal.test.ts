import { createWeaponStageGoal } from '../../goals/weaponStageGoal';
import { AutomatonError } from '../../../../errors/automatonErrors';
import { blueprint, context, facilities, item, robot, stable } from '../helpers/automatonFixtures';

const goal = createWeaponStageGoal('test.v1.18.weapons');
const FINAL = 3;

describe('weapons Goal (R3.11, R5.5, design §8.6)', () => {
  it('is Satisfied when every robot is on min(target, final stage)', () => {
    const facts = stable({
      robots: [robot(1, { mainInventoryId: 1, stageIndex: 1 }), robot(2, { mainInventoryId: 2, stageIndex: 1 })],
      inventory: [item(1, 'Volt Sabre'), item(2, 'Volt Sabre')],
    });
    expect(goal.evaluate(facts, context(facts, { target: FINAL })).kind).toBe('satisfied');
  });

  it('moves the next robot in slot order one stage up, buying at the Workshop discount', () => {
    const facts = stable({
      facilities: facilities({ weapons_workshop: 3 }),
      robots: [robot(1, { mainInventoryId: 1, stageIndex: 1 }), robot(2, { mainInventoryId: 2, stageIndex: 0 })],
      inventory: [item(1, 'Volt Sabre'), item(2, 'Practice Blade')],
    });
    expect(goal.evaluate(facts, context(facts, { target: FINAL }))).toEqual({
      kind: 'actionable',
      goalId: 'test.v1.18.weapons',
      action: {
        kind: 'weapon_stage',
        robotSlot: 2,
        toStage: 1,
        steps: [
          { kind: 'weapon_purchase', weaponName: 'Volt Sabre', hand: 'main', cost: 280_000 },
          { kind: 'equip', hand: 'main', weaponName: 'Volt Sabre', source: { kind: 'purchase' } },
        ],
      },
      cost: 280_000,
    });
  });

  it('saves for the stage and is Actionable at exactly balance = cost', () => {
    const base = {
      robots: [robot(1, { mainInventoryId: 1, stageIndex: 0 })],
      inventory: [item(1, 'Practice Blade')],
    };
    const short = stable({ ...base, balance: 399_999 });
    expect(goal.evaluate(short, context(short, { target: FINAL }))).toMatchObject({ kind: 'saving', cost: 400_000 });
    const exact = stable({ ...base, balance: 400_000 });
    expect(goal.evaluate(exact, context(exact, { target: FINAL })).kind).toBe('actionable');
  });

  it('equips a stored weapon of the same name instead of buying (Weapon_Reuse)', () => {
    const facts = stable({
      robots: [robot(1, { mainInventoryId: 1, stageIndex: 0 })],
      inventory: [item(1, 'Practice Blade'), item(2, 'Volt Sabre')],
    });
    expect(goal.evaluate(facts, context(facts, { target: FINAL }))).toMatchObject({
      kind: 'actionable',
      cost: 0,
      action: { steps: [{ kind: 'equip', hand: 'main', source: { kind: 'inventory', inventoryId: 2 } }] },
    });
  });

  it('keeps the hand whose weapon does not change', () => {
    const dual = blueprint(1, {
      loadoutType: 'dual_wield',
      weaponPath: [{ main: 'Laser Pistol', offhand: 'Practice Blade' }, { main: 'Volt Sabre', offhand: 'Practice Blade' }],
    });
    const facts = stable({
      robots: [robot(1, { loadoutType: 'dual_wield', mainInventoryId: 1, offhandInventoryId: 2, stageIndex: 0 })],
      inventory: [item(1, 'Laser Pistol'), item(2, 'Practice Blade')],
    });
    const outcome = goal.evaluate(facts, context(facts, { target: FINAL, blueprints: [dual] }));
    expect(outcome).toMatchObject({
      kind: 'actionable',
      action: {
        steps: [
          { kind: 'weapon_purchase', weaponName: 'Volt Sabre', hand: 'main' },
          { kind: 'equip', hand: 'main', weaponName: 'Volt Sabre' },
        ],
      },
    });
  });

  it('re-fits only the robot that matches no stage after a loadout edit (stage −1)', () => {
    const dual = blueprint(2, {
      loadoutType: 'dual_wield',
      weaponPath: [{ main: 'Laser Pistol', offhand: 'Plasma Cutter' }, { main: 'Volt Sabre', offhand: 'Plasma Cutter' }],
    });
    const facts = stable({
      robots: [
        robot(1, { mainInventoryId: 1, stageIndex: 1 }),
        robot(2, { loadoutType: 'single', mainInventoryId: 2, stageIndex: -1 }),
        robot(3, { mainInventoryId: 3, stageIndex: 1 }),
      ],
      inventory: [item(1, 'Volt Sabre'), item(2, 'Practice Blade'), item(3, 'Volt Sabre')],
    });
    const outcome = goal.evaluate(facts, context(facts, { target: FINAL, blueprints: [blueprint(1), dual, blueprint(3)] }));
    expect(outcome).toEqual({
      kind: 'actionable',
      goalId: 'test.v1.18.weapons',
      action: {
        kind: 'weapon_stage',
        robotSlot: 2,
        toStage: 0,
        steps: [
          { kind: 'weapon_purchase', weaponName: 'Laser Pistol', hand: 'main', cost: 60_000 },
          { kind: 'weapon_purchase', weaponName: 'Plasma Cutter', hand: 'offhand', cost: 380_000 },
          { kind: 'unequip', hand: 'main' },
          { kind: 'loadout_change', loadoutType: 'dual_wield' },
          { kind: 'equip', hand: 'main', weaponName: 'Laser Pistol', source: { kind: 'purchase' } },
          { kind: 'equip', hand: 'offhand', weaponName: 'Plasma Cutter', source: { kind: 'purchase' } },
        ],
      },
      cost: 440_000,
    });
  });

  it('frees the off hand when the new stage has none', () => {
    const twoHanded = blueprint(1, { loadoutType: 'two_handed', weaponPath: [{ main: 'Railgun' }] });
    const facts = stable({
      robots: [robot(1, { loadoutType: 'weapon_shield', mainInventoryId: 1, offhandInventoryId: 2, stageIndex: -1 })],
      inventory: [item(1, 'Practice Blade'), item(2, 'Aegis Bulwark'), item(3, 'Railgun')],
    });
    expect(goal.evaluate(facts, context(facts, { target: FINAL, blueprints: [twoHanded] }))).toMatchObject({
      action: {
        steps: [
          { kind: 'unequip', hand: 'main' },
          { kind: 'unequip', hand: 'offhand' },
          { kind: 'loadout_change', loadoutType: 'two_handed' },
          { kind: 'equip', hand: 'main', source: { kind: 'inventory', inventoryId: 3 } },
        ],
      },
      cost: 0,
    });
  });

  it('target 0 re-fits a stage −1 robot to stage 0 and leaves others alone', () => {
    const facts = stable({
      robots: [robot(1, { mainInventoryId: 1, stageIndex: 0 }), robot(2, { mainInventoryId: null, stageIndex: -1 })],
      inventory: [item(1, 'Practice Blade')],
    });
    expect(goal.evaluate(facts, context(facts, { target: 0 }))).toMatchObject({ action: { robotSlot: 2, toStage: 0 }, cost: 50_000 });
  });

  it('sells an unequipped weapon before buying when storage is full; proceeds are not subtracted', () => {
    const facts = stable({
      facilities: facilities({ weapons_workshop: 5 }),
      robots: [robot(1, { mainInventoryId: 1, stageIndex: 0 })],
      inventory: [item(1, 'Practice Blade'), ...[2, 3, 4, 5].map((id) => item(id, 'Railgun', { pricePaid: 100_000 * id }))],
    });
    expect(goal.evaluate(facts, context(facts, { target: FINAL }))).toMatchObject({
      action: {
        steps: [
          { kind: 'weapon_sale', inventoryId: 2, proceeds: 100_000 },
          { kind: 'weapon_purchase', weaponName: 'Volt Sabre', cost: 200_000 },
          { kind: 'equip' },
        ],
      },
      cost: 200_000,
    });
  });

  it('is Blocked by a prestige-gated Storage Facility level when nothing unequipped can be sold', () => {
    // Storage L3 holds 20 weapons, all equipped by 10 dual-wield robots.
    const dualPath = [{ main: 'Laser Pistol', offhand: 'Laser Pistol' }, { main: 'Volt Sabre', offhand: 'Volt Sabre' }];
    const blueprints = Array.from({ length: 10 }, (_, i) => blueprint(i + 1, { loadoutType: 'dual_wield', weaponPath: dualPath }));
    const facts = stable({
      facilities: facilities({ storage_facility: 3 }),
      robots: Array.from({ length: 10 }, (_, i) => robot(i + 1, {
        loadoutType: 'dual_wield', mainInventoryId: 2 * i + 1, offhandInventoryId: 2 * i + 2, stageIndex: 0,
      })),
      inventory: Array.from({ length: 20 }, (_, i) => item(i + 1, 'Laser Pistol')),
      balance: 50_000_000,
    });
    expect(goal.evaluate(facts, context(facts, { target: FINAL, blueprints }))).toEqual({
      kind: 'blocked',
      goalId: 'test.v1.18.weapons',
      reason: 'prestige_gate',
      detail: { facilityType: 'storage_facility', level: 4, prestigeRequired: 1000, prestigeHeld: 0, robotSlot: 1 },
    });
  });

  it('fails the turn with AUTOMATON_WEAPON_UNKNOWN for a weapon missing from the catalogue', () => {
    const facts = stable({ robots: [robot(1, { mainInventoryId: 1, stageIndex: 0 })], inventory: [item(1, 'Practice Blade')] });
    const ghost = blueprint(1, { weaponPath: [{ main: 'Practice Blade' }, { main: 'Ghost Blade' }] });
    let thrown: unknown;
    try {
      goal.evaluate(facts, context(facts, { target: FINAL, blueprints: [ghost] }));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AutomatonError);
    expect((thrown as AutomatonError).code).toBe('AUTOMATON_WEAPON_UNKNOWN');
  });
});
