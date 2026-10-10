import fc from 'fast-check';
import { createFacilityGoal } from '../goals/facilityGoal';
import { createRobotCountGoal } from '../goals/robotCountGoal';
import { createAttributeGoal } from '../goals/attributeGoal';
import type { Goal, GoalOutcome } from '../goals/goalTypes';
import { quoteFacilityLevel } from '../pricing';
import type { FacilityType, StableFacts } from '../stableFacts';
import type { GoalDefinition, GoalType } from '../strategies/strategyTypes';
import { planNextStep, simulateTurn, type SimulationContext } from '../turnPlanner';
import { TURN_ACTION_LIMIT, TURN_BUDGET_EXHAUSTED } from '../turnBudget';
import { ProjectionError } from '../factProjector';
import {
  TEST_WEIGHTS,
  armedRobot,
  blueprint,
  facilities,
  item,
  robot,
  stable,
  weaponMap,
} from './helpers/automatonFixtures';

const blueprints = Array.from({ length: 11 }, (_, i) => blueprint(i + 1));

function ctx(overrides: Partial<SimulationContext> = {}): SimulationContext {
  return { params: { targets: {} }, blueprints, weapons: weaponMap(), teamNames: null, ...overrides };
}

function definition(goal: Goal, position: number, defaultTarget: number, type: GoalType = 'facility'): GoalDefinition {
  return { id: goal.id, position, type, defaultTarget, bounds: { min: 0, max: 11 }, isMax: false, goal };
}

function facilityDef(position: number, facilityType: FacilityType, target: number): GoalDefinition {
  return definition(createFacilityGoal(`t.v1.${String(position).padStart(2, '0')}.facility.${facilityType}`, facilityType), position, target);
}

/** A Goal that always returns `outcome` and counts its evaluations. */
function stubGoal(id: string, outcome: (facts: StableFacts) => GoalOutcome): Goal & { calls: number } {
  const goal = { id, calls: 0, evaluate: (facts: StableFacts) => { goal.calls++; return outcome(facts); } };
  return goal;
}

const level1Cost = (type: FacilityType): number => {
  const quote = quoteFacilityLevel(type, 0, 0);
  if (quote.kind !== 'available') throw new Error(`${type} L1 is not available`);
  return quote.cost;
};

// A dear and a cheap ungated L1 facility, for the stop-on-Saving properties.
const CANDIDATES: FacilityType[] = ['repair_bay', 'training_facility', 'weapons_workshop', 'merchandising_hub', 'streaming_studio', 'tuning_bay'];
const sortedByCost = [...CANDIDATES].sort((a, b) => level1Cost(a) - level1Cost(b));
const CHEAP = sortedByCost[0];
const DEAR = sortedByCost[sortedByCost.length - 1];

describe('planNextStep (R5.1, R5.3, R5.6, R5.10, design §8.3)', () => {
  it('walks the Build_Order top-down past Satisfied and Blocked Goals and stops at the first Actionable', () => {
    const satisfied = stubGoal('g1', () => ({ kind: 'satisfied', goalId: 'g1' }));
    const blocked = stubGoal('g2', () => ({ kind: 'blocked', goalId: 'g2', reason: 'prestige_gate', detail: {} }));
    const below = stubGoal('g4', () => ({ kind: 'satisfied', goalId: 'g4' }));
    const strategy = {
      buildOrder: [
        definition(satisfied, 1, 1),
        definition(blocked, 2, 1),
        facilityDef(3, 'repair_bay', 1),
        definition(below, 4, 1),
      ],
    };
    const facts = stable({ balance: 10_000_000 });
    const result = planNextStep(facts, strategy, ctx());
    expect(result.outcomes.map((o) => o.kind)).toEqual(['satisfied', 'blocked', 'actionable']);
    expect(result.next).toMatchObject({ kind: 'actionable', goalId: 't.v1.03.facility.repair_bay' });
    expect(below.calls).toBe(0);
  });

  it('stops at a Saving Goal and never evaluates the Goals below it', () => {
    const below = stubGoal('g3', () => ({ kind: 'satisfied', goalId: 'g3' }));
    const strategy = { buildOrder: [facilityDef(1, DEAR, 1), facilityDef(2, CHEAP, 1), definition(below, 3, 1)] };
    const facts = stable({ balance: level1Cost(DEAR) - 1 });
    const result = planNextStep(facts, strategy, ctx());
    expect(result.next).toMatchObject({ kind: 'saving', cost: level1Cost(DEAR) });
    expect(result.outcomes).toHaveLength(1);
    expect(below.calls).toBe(0);
  });

  it('returns next = null when every Goal is Satisfied or Blocked', () => {
    const strategy = {
      buildOrder: [
        facilityDef(1, 'repair_bay', 0),
        definition(stubGoal('g2', () => ({ kind: 'blocked', goalId: 'g2', reason: 'max_level', detail: {} })), 2, 1),
      ],
    };
    const result = planNextStep(stable(), strategy, ctx());
    expect(result.next).toBeNull();
    expect(result.outcomes.map((o) => o.kind)).toEqual(['satisfied', 'blocked']);
  });

  it('is Actionable at exactly balance = cost and Saving one credit below (R5.3)', () => {
    const strategy = { buildOrder: [facilityDef(1, CHEAP, 1)] };
    const cost = level1Cost(CHEAP);
    expect(planNextStep(stable({ balance: cost }), strategy, ctx()).next?.kind).toBe('actionable');
    expect(planNextStep(stable({ balance: cost - 1 }), strategy, ctx()).next?.kind).toBe('saving');
  });

  it('reads each Goal_Target from Strategy_Parameters, falling back to the default', () => {
    const def = facilityDef(1, CHEAP, 0);
    const facts = stable({ balance: 10_000_000 });
    expect(planNextStep(facts, { buildOrder: [def] }, ctx()).next).toBeNull();
    const result = planNextStep(facts, { buildOrder: [def] }, ctx({ params: { targets: { [def.id]: 2 } } }));
    expect(result.next).toMatchObject({ kind: 'actionable', goalId: def.id });
  });

  it('passes the facts balance as the only affordability input', () => {
    let seen = -1;
    const goal = stubGoal('g1', () => ({ kind: 'satisfied', goalId: 'g1' }));
    goal.evaluate = (facts, goalCtx) => { seen = goalCtx.balance; expect(goalCtx.balance).toBe(facts.balance); return { kind: 'satisfied', goalId: 'g1' }; };
    planNextStep(stable({ balance: 123_456 }), { buildOrder: [definition(goal, 1, 1)] }, ctx());
    expect(seen).toBe(123_456);
  });

  it('is deterministic for tied inputs (R5.10)', () => {
    const attributes = definition(createAttributeGoal('t.v1.01.attributes', { isMax: false, weightTable: TEST_WEIGHTS }), 1, 5, 'attributes');
    const facts = stable({ robots: [robot(1), robot(2), robot(3)], balance: 40_000 });
    const first = planNextStep(facts, { buildOrder: [attributes] }, ctx());
    const second = planNextStep(structuredClone(facts), { buildOrder: [attributes] }, ctx());
    expect(second).toEqual(first);
    // Ties between identical robots go to the lower slot.
    expect(first.next).toMatchObject({ kind: 'actionable', action: { kind: 'attribute_upgrade', robotSlot: 1 } });
  });

  it('never buys a lower affordable Goal while a higher Goal is Saving, across any number of turns (R5.6)', () => {
    const strategy = { buildOrder: [facilityDef(1, DEAR, 1), facilityDef(2, CHEAP, 1)] };
    const dearCost = level1Cost(DEAR);
    const cheapCost = level1Cost(CHEAP);
    fc.assert(fc.property(
      fc.integer({ min: cheapCost, max: dearCost - 1 }),
      fc.array(fc.integer({ min: 0, max: 50_000 }), { minLength: 1, maxLength: 40 }),
      (start, incomes) => {
        const [dearId, cheapId] = strategy.buildOrder.map((d) => d.id);
        let facts = stable({ balance: start });
        for (const income of incomes) {
          const turn = simulateTurn(facts, strategy, ctx());
          const ids = turn.steps.map((s) => s.goalId);
          if (facts.facilities[DEAR] === 0) {
            if (ids.includes(cheapId)) {
              // The cheap Goal is bought only after the dear one, in the same turn.
              expect(ids.indexOf(dearId)).toBeGreaterThanOrEqual(0);
              expect(ids.indexOf(dearId)).toBeLessThan(ids.indexOf(cheapId));
            }
            if (!ids.includes(dearId)) {
              expect(facts.balance).toBeLessThan(dearCost);
              expect(turn.stop.kind).toBe('saving');
            }
          }
          facts = { ...turn.facts, balance: turn.facts.balance + income };
        }
      },
    ), { numRuns: 100 });
  });
});

describe('simulateTurn (R5.1 restart, R5.11)', () => {
  it('restarts at goal 1 after every Actionable step', () => {
    // A second robot forms a 2v2 team, which raises the Booking Office useful level from L1 to L4,
    // so goal 1 re-opens and is bought before goal 3.
    const strategy = {
      buildOrder: [
        facilityDef(1, 'booking_office', 6),
        definition(createRobotCountGoal('t.v1.02.robots'), 2, 2, 'robots'),
        facilityDef(3, 'repair_bay', 1),
      ],
    };
    const facts = stable({
      robots: [armedRobot(1, 1)],
      inventory: [item(1, 'Practice Blade')],
      facilities: facilities({ booking_office: 1 }),
      prestige: 1_000,
      balance: 10_000_000,
    });
    const turn = simulateTurn(facts, strategy, ctx());
    expect(turn.steps.map((s) => s.goalId)).toEqual([
      't.v1.02.robots',
      't.v1.01.facility.booking_office',
      't.v1.01.facility.booking_office',
      't.v1.01.facility.booking_office',
      't.v1.03.facility.repair_bay',
    ]);
    expect(turn.facts.facilities.booking_office).toBe(4);
    expect(turn.stop).toEqual({ kind: 'build_order_done' });
    for (const step of turn.steps) expect(step.cost).toBeLessThanOrEqual(step.balanceBefore);
  });

  it('stops with turn_budget_exhausted at the charged-action limit', () => {
    const goal = stubGoal('g1', () => ({
      kind: 'actionable',
      goalId: 'g1',
      cost: 0,
      action: { kind: 'attribute_upgrade', robotSlot: 1, increments: { combatPower: 1 }, cost: 0 },
    }));
    const strategy = { buildOrder: [definition(goal, 1, 1)] };
    const turn = simulateTurn(stable({ robots: [robot(1)] }), strategy, ctx());
    expect(turn.chargedActions).toBe(TURN_ACTION_LIMIT);
    expect(turn.stop).toEqual({ kind: TURN_BUDGET_EXHAUSTED });
  });

  it('reports Saving as the stop when a Goal saves', () => {
    const strategy = { buildOrder: [facilityDef(1, DEAR, 1)] };
    const turn = simulateTurn(stable({ balance: 0 }), strategy, ctx());
    expect(turn.stop).toMatchObject({ kind: 'saving', outcome: { goalId: strategy.buildOrder[0].id } });
    expect(turn.steps).toEqual([]);
  });

  it('fails loudly when an Actionable step does not change the facts', () => {
    const goal = stubGoal('g1', () => ({
      kind: 'actionable', goalId: 'g1', cost: 0,
      action: { kind: 'attribute_upgrade', robotSlot: 1, increments: {}, cost: 0 },
    }));
    expect(() => simulateTurn(stable({ robots: [robot(1)] }), { buildOrder: [definition(goal, 1, 1)] }, ctx()))
      .toThrow(ProjectionError);
  });
});
