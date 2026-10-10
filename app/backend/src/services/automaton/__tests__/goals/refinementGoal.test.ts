import { createRefinementGoal } from '../../goals/refinementGoal';
import type { GoalOutcome } from '../../goals/goalTypes';
import type { RefinementStep } from '../../../../types/automaton';
import type { RefinementRow } from '../../../../shared/utils/weaponRefinement';
import type { StableFacts } from '../../stableFacts';
import { blueprint, context, facilities, item, refinements, robot, stable } from '../helpers/automatonFixtures';

const goal = createRefinementGoal('test.v1.23.refine');
const S: RefinementStep = { tier: 'sharpen', hand: 'main', magnitude: 1 };
const F: RefinementStep = { tier: 'forge', hand: 'main', magnitude: 1 };
const HONE_CP: RefinementStep = { tier: 'hone', hand: 'main', targetAttribute: 'combatPower', magnitude: 1 };
const off = (step: RefinementStep): RefinementStep => ({ ...step, hand: 'offhand' });

/** One robot (slot 1) on its final Volt Sabre (item 1) with the given refinements. */
function onFinal(rows: RefinementRow[], overrides: Partial<StableFacts> = {}): StableFacts {
  return stable({
    facilities: facilities({ weapons_workshop: 8 }),
    prestige: 0,
    robots: [robot(1, { mainInventoryId: 1, stageIndex: 1 })],
    inventory: [item(1, 'Volt Sabre', { refinements: rows })],
    ...overrides,
  });
}

function planned(outcome: GoalOutcome) {
  if (outcome.kind !== 'actionable' || outcome.action.kind !== 'weapon_refinement') {
    throw new Error(`expected a refinement, got ${JSON.stringify(outcome)}`);
  }
  return { action: outcome.action, cost: outcome.cost };
}

const withPlan = (plan: RefinementStep[], extra: Parameters<typeof blueprint>[1] = {}) => [blueprint(1, { refinementPlan: plan, ...extra })];

describe('refine Goal (R3.11, R5.2, R5.4, design §8.6 item 7)', () => {
  it('skips the Goal at target 0', () => {
    const facts = onFinal([]);
    expect(goal.evaluate(facts, context(facts, { target: 0 })).kind).toBe('satisfied');
  });

  it('plans the first plan step at the refinement price', () => {
    const facts = onFinal([], { facilities: facilities({ weapons_workshop: 5 }) });
    expect(planned(goal.evaluate(facts, context(facts, { target: 8 })))).toEqual({
      action: { kind: 'weapon_refinement', robotSlot: 1, inventoryId: 1, step: S, chain: [], refinementCost: 300_000 },
      cost: 300_000,
    });
  });

  it('prices the second Sharpen at ₡900,000', () => {
    const facts = onFinal(refinements('sharpen'));
    expect(planned(goal.evaluate(facts, context(facts, { target: 8 }))).cost).toBe(900_000);
  });

  it('buys the Weapons Workshop levels the tier needs as its Goal_Chain', () => {
    const facts = onFinal([], { facilities: facilities({ weapons_workshop: 3 }), prestige: 3_000 });
    const { action, cost } = planned(goal.evaluate(facts, context(facts, { target: 8 })));
    expect(action.chain).toEqual([
      { kind: 'facility_upgrade', facilityType: 'weapons_workshop', toLevel: 4, cost: 300_000 },
      { kind: 'facility_upgrade', facilityType: 'weapons_workshop', toLevel: 5, cost: 375_000 },
    ]);
    expect(cost).toBe(975_000);
  });

  it('chains Workshop L6–L8 for the first Forge', () => {
    const facts = onFinal(refinements('sharpen', 'sharpen'), { facilities: facilities({ weapons_workshop: 5 }), prestige: 20_000 });
    const { action, cost } = planned(goal.evaluate(facts, context(facts, { target: 8 })));
    expect(action.step).toEqual(F);
    expect(action.chain.map((s) => s.toLevel)).toEqual([6, 7, 8]);
    expect(cost).toBe(450_000 + 525_000 + 600_000 + 400_000);
  });

  it('saves for step plus chain and is Actionable at exactly balance = cost', () => {
    const short = onFinal([], { facilities: facilities({ weapons_workshop: 5 }), balance: 299_999 });
    expect(goal.evaluate(short, context(short, { target: 8 }))).toMatchObject({ kind: 'saving', cost: 300_000 });
    const exact = onFinal([], { facilities: facilities({ weapons_workshop: 5 }), balance: 300_000 });
    expect(goal.evaluate(exact, context(exact, { target: 8 })).kind).toBe('actionable');
  });

  it('is Blocked by a prestige-gated Workshop level in the chain', () => {
    const facts = onFinal([], { facilities: facilities({ weapons_workshop: 3 }), prestige: 0 });
    expect(goal.evaluate(facts, context(facts, { target: 8 }))).toEqual({
      kind: 'blocked',
      goalId: 'test.v1.23.refine',
      reason: 'prestige_gate',
      detail: { facilityType: 'weapons_workshop', level: 4, prestigeRequired: 1000, prestigeHeld: 0, robotSlot: 1 },
    });
  });

  it('is Blocked with awaiting_final_weapon for a robot not on its final stage', () => {
    const facts = stable({ robots: [robot(1, { mainInventoryId: 1, stageIndex: 0 })], inventory: [item(1, 'Practice Blade')] });
    expect(goal.evaluate(facts, context(facts, { target: 8 }))).toMatchObject({
      kind: 'blocked', reason: 'awaiting_final_weapon', detail: { robotSlot: 1, stageIndex: 0, finalStage: 1 },
    });
  });

  describe('counting plan steps', () => {
    const plan5 = [S, S, F, F, HONE_CP];

    it('target 4 stops after the 4th step; target 5 plans the 5th', () => {
      const facts = onFinal(refinements('sharpen', 'sharpen', 'forge', 'forge'));
      expect(goal.evaluate(facts, context(facts, { target: 4, blueprints: withPlan(plan5) })).kind).toBe('satisfied');
      const { action, cost } = planned(goal.evaluate(facts, context(facts, { target: 5, blueprints: withPlan(plan5) })));
      expect(action.step).toEqual(HONE_CP);
      expect(cost).toBe(10_000);
    });

    it('is done when a plan shorter than the target is complete; target 10 applies the whole plan', () => {
      const facts = onFinal(refinements('sharpen', 'sharpen', 'forge', 'forge'));
      expect(goal.evaluate(facts, context(facts, { target: 10 })).kind).toBe('satisfied');
    });

    it('applies a dual_wield plan main and offhand interleaved', () => {
      const dual = withPlan([S, off(S), S, off(S), F, off(F), F, off(F)], {
        loadoutType: 'dual_wield',
        weaponPath: [{ main: 'Laser Pistol', offhand: 'Laser Pistol' }, { main: 'Volt Sabre', offhand: 'Plasma Cutter' }],
      });
      const facts = stable({
        facilities: facilities({ weapons_workshop: 8 }),
        robots: [robot(1, { loadoutType: 'dual_wield', mainInventoryId: 1, offhandInventoryId: 2, stageIndex: 1 })],
        inventory: [item(1, 'Volt Sabre', { refinements: refinements('sharpen') }), item(2, 'Plasma Cutter')],
      });
      expect(planned(goal.evaluate(facts, context(facts, { target: 10, blueprints: dual }))).action).toMatchObject({
        inventoryId: 2, step: off(S), refinementCost: 300_000,
      });
      const next = { ...facts, inventory: [facts.inventory[0], item(2, 'Plasma Cutter', { refinements: refinements('sharpen') })] };
      expect(planned(goal.evaluate(next, context(next, { target: 10, blueprints: dual }))).action).toMatchObject({
        inventoryId: 1, step: S, refinementCost: 900_000,
      });
    });
  });

  describe('across robots', () => {
    const twoRobots = (r1: Partial<Parameters<typeof robot>[1]>, rows1: RefinementRow[], overrides: Partial<StableFacts> = {}): StableFacts => stable({
      robots: [robot(1, { mainInventoryId: 1, stageIndex: 1, ...r1 }), robot(2, { mainInventoryId: 2, stageIndex: 1 })],
      inventory: [item(1, 'Volt Sabre', { refinements: rows1 }), item(2, 'Volt Sabre')],
      ...overrides,
    });

    it('does not let slot 1’s gated Forge hold back slot 2’s ungated Sharpen', () => {
      const facts = twoRobots({}, refinements('sharpen', 'sharpen'), { facilities: facilities({ weapons_workshop: 5 }), prestige: 3_000 });
      expect(planned(goal.evaluate(facts, context(facts, { target: 8 }))).action).toMatchObject({ robotSlot: 2, step: S });
    });

    it('skips a robot not yet on its final stage', () => {
      const facts = twoRobots({ stageIndex: 0 }, [], { facilities: facilities({ weapons_workshop: 5 }) });
      expect(planned(goal.evaluate(facts, context(facts, { target: 8 }))).action.robotSlot).toBe(2);
    });

    it('is Blocked only when every remaining step is skipped, with the first skipped robot’s reason', () => {
      const facts = stable({
        facilities: facilities({ weapons_workshop: 5 }),
        prestige: 3_000,
        robots: [robot(1, { mainInventoryId: 1, stageIndex: 0 }), robot(2, { mainInventoryId: 2, stageIndex: 1 })],
        inventory: [item(1, 'Practice Blade'), item(2, 'Volt Sabre', { refinements: refinements('sharpen', 'sharpen') })],
      });
      expect(goal.evaluate(facts, context(facts, { target: 8 }))).toMatchObject({
        kind: 'blocked', reason: 'awaiting_final_weapon', detail: { robotSlot: 1 },
      });
    });
  });

  describe('after a Refinement_Plan edit', () => {
    it('counts applied refinements by number, not by content', () => {
      const facts = onFinal([
        { tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' },
        { tier: 'hone', magnitude: 1, targetAttribute: 'attackSpeed' },
      ]);
      expect(planned(goal.evaluate(facts, context(facts, { target: 8 }))).action).toMatchObject({ step: F, refinementCost: 400_000 });
    });

    it('counts a changed fifth step on a 5/5 weapon as done; it never becomes Actionable', () => {
      const facts = onFinal([...refinements('sharpen', 'sharpen', 'forge', 'forge'), { tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' }]);
      const edited = withPlan([S, S, F, F, { tier: 'hone', hand: 'main', targetAttribute: 'attackSpeed', magnitude: 1 }]);
      expect(goal.evaluate(facts, context(facts, { target: 10, blueprints: edited })).kind).toBe('satisfied');
    });

    it('counts the first applied-count steps of a reordered plan as done', () => {
      const facts = onFinal(refinements('sharpen', 'sharpen', 'forge', 'forge'));
      const reordered = withPlan([S, F, S, F, HONE_CP]);
      expect(planned(goal.evaluate(facts, context(facts, { target: 10, blueprints: reordered }))).action.step).toEqual(HONE_CP);
    });

    it('leaves a hand complete when the plan is shortened below the applied count', () => {
      const facts = onFinal(refinements('sharpen', 'sharpen', 'forge', 'forge'));
      expect(goal.evaluate(facts, context(facts, { target: 10, blueprints: withPlan([S, S, F]) })).kind).toBe('satisfied');
    });

    it('treats a validator-rejected step as done and plans the later valid step in the same evaluation', () => {
      const facts = onFinal(refinements('sharpen', 'sharpen'));
      const { action } = planned(goal.evaluate(facts, context(facts, { target: 10, blueprints: withPlan([S, S, S, F]) })));
      expect(action.step).toEqual(F);
    });

    it('treats a Hone past the +10 stack cap as done', () => {
      // Volt Sabre has +8 Combat Power; +3 would make 11.
      const facts = onFinal([]);
      const plan = withPlan([{ tier: 'hone', hand: 'main', targetAttribute: 'combatPower', magnitude: 3 }]);
      expect(goal.evaluate(facts, context(facts, { target: 10, blueprints: plan })).kind).toBe('satisfied');
    });

    it('starts a stored weapon equipped through Weapon_Reuse from its existing refinements', () => {
      const facts = onFinal([], {
        robots: [robot(1, { mainInventoryId: 9, stageIndex: 1 })],
        inventory: [item(9, 'Volt Sabre', { refinements: refinements('sharpen') })],
      });
      expect(planned(goal.evaluate(facts, context(facts, { target: 8 }))).action).toMatchObject({ inventoryId: 9, step: S, refinementCost: 900_000 });
    });
  });

  describe('shields', () => {
    const shieldBlueprint = (plan: RefinementStep[]) => withPlan(plan, {
      loadoutType: 'weapon_shield',
      weaponPath: [{ main: 'Practice Blade', offhand: 'Aegis Bulwark' }, { main: 'Volt Sabre', offhand: 'Aegis Bulwark' }],
    });
    const shieldFacts = (): StableFacts => stable({
      facilities: facilities({ weapons_workshop: 8 }),
      robots: [robot(1, { loadoutType: 'weapon_shield', mainInventoryId: 1, offhandInventoryId: 2, stageIndex: 1 })],
      inventory: [item(1, 'Volt Sabre', { refinements: refinements('sharpen', 'sharpen', 'forge', 'forge') }), item(2, 'Aegis Bulwark')],
    });

    it('hones a negative shield bonus on the offhand', () => {
      const hone: RefinementStep = { tier: 'hone', hand: 'offhand', targetAttribute: 'evasionThrusters', magnitude: 1 };
      const facts = shieldFacts();
      expect(planned(goal.evaluate(facts, context(facts, { target: 10, blueprints: shieldBlueprint([S, S, F, F, hone]) })))).toMatchObject({
        action: { inventoryId: 2, step: hone }, cost: 10_000,
      });
    });

    it('treats a Sharpen on a shield as done (validateShieldCompatibility)', () => {
      const facts = shieldFacts();
      expect(goal.evaluate(facts, context(facts, { target: 10, blueprints: shieldBlueprint([S, S, F, F, off(S)]) })).kind).toBe('satisfied');
    });
  });
});
