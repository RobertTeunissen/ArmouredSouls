/**
 * Scenario projector (Spec #55, R6.7, R6.12, R14.1, design §14.0b, §14.1,
 * task 3.7).
 *
 * Pure projection of a stable over a sequence of Automaton_Turns, built on
 * `simulateTurn`. The draft preview and the fixture tests project a fresh
 * stable with ₡3,000,000 over the opening (two preparation turns and the
 * first competitive turn); the generic scenario test runs two seasons with an
 * income model it supplies through `betweenTurns`. Nothing is written.
 */
import { AUTOMATON_FACILITY_TYPES, type FacilityType, type StableFacts } from '../stableFacts';
import { facilityLabel } from './strategyDefinitionSchema';
import type { PlannedAction } from '../goals/goalTypes';
import { simulateTurn, type SimulatedTurn, type SimulationContext } from '../turnPlanner';
import type { GoalDefinition } from './strategyTypes';

/** Starting balance of every new stable (onboarding budget). */
export const SCENARIO_STARTING_BALANCE = 3_000_000;

/** The opening: two preparation turns, then the first competitive turn (design §14.0b). */
export const OPENING_PHASES: readonly StableFacts['phase'][] = ['preparation', 'preparation', 'competitive'];

/** A stable with no robots, no facilities and `balance` credits. */
export function freshStableFacts(balance: number = SCENARIO_STARTING_BALANCE): StableFacts {
  const facilities = {} as Record<FacilityType, number>;
  for (const type of AUTOMATON_FACILITY_TYPES) facilities[type] = 0;
  return {
    profileId: 0,
    userId: 0,
    catalogueKey: 'scenario',
    seasonNumber: 1,
    phase: 'preparation',
    balance,
    prestige: 0,
    facilities,
    robots: [],
    inventory: [],
    teams: [],
    takenRobotNames: [],
  };
}

export type ScenarioPurchaseKind =
  | 'robot_creation'
  | 'facility_upgrade'
  | 'attribute_upgrade'
  | 'weapon_purchase'
  | 'weapon_sale'
  | 'weapon_refinement';

/** One charged step, in execution order. */
export interface ScenarioPurchase {
  turnIndex: number;
  goalId: string;
  kind: ScenarioPurchaseKind;
  label: string;
  /** Credits spent; a sale is negative (its proceeds). */
  cost: number;
}

function chargedSteps(action: PlannedAction): Omit<ScenarioPurchase, 'turnIndex' | 'goalId'>[] {
  const facility = (type: FacilityType, toLevel: number, cost: number): Omit<ScenarioPurchase, 'turnIndex' | 'goalId'> =>
    ({ kind: 'facility_upgrade', label: `${facilityLabel(type)} L${toLevel}`, cost });
  const sale = (inventoryId: number, proceeds: number): Omit<ScenarioPurchase, 'turnIndex' | 'goalId'> =>
    ({ kind: 'weapon_sale', label: `Sell weapon #${inventoryId}`, cost: -proceeds });
  const weapon = (weaponName: string, hand: string, cost: number): Omit<ScenarioPurchase, 'turnIndex' | 'goalId'> =>
    ({ kind: 'weapon_purchase', label: `${weaponName} (${hand})`, cost });

  switch (action.kind) {
    case 'facility_upgrade':
      return [facility(action.facilityType, action.toLevel, action.cost)];
    case 'attribute_upgrade': {
      const levels = Object.values(action.increments).reduce<number>((sum, n) => sum + (n ?? 0), 0);
      return [{ kind: 'attribute_upgrade', label: `Robot ${action.robotSlot}: ${levels} attribute level(s)`, cost: action.cost }];
    }
    case 'robot_chain':
      return action.steps.flatMap((step) => {
        switch (step.kind) {
          case 'weapon_sale': return [sale(step.inventoryId, step.proceeds)];
          case 'facility_upgrade': return [facility(step.facilityType, step.toLevel, step.cost)];
          case 'robot_purchase': return [{ kind: 'robot_creation' as const, label: `Robot ${step.robotName}`, cost: step.cost }];
          case 'fitout': return step.purchases.map((p) => weapon(p.weaponName, p.hand, p.cost));
        }
      });
    case 'weapon_stage':
      return action.steps.flatMap((step) => {
        switch (step.kind) {
          case 'facility_upgrade': return [facility(step.facilityType, step.toLevel, step.cost)];
          case 'weapon_sale': return [sale(step.inventoryId, step.proceeds)];
          case 'weapon_purchase': return [weapon(step.weaponName, step.hand, step.cost)];
          default: return [];
        }
      });
    case 'weapon_refinement':
      return [
        ...action.chain.map((step) => facility(step.facilityType, step.toLevel, step.cost)),
        {
          kind: 'weapon_refinement',
          label: `Robot ${action.robotSlot}: ${action.step.tier} (${action.step.hand})`,
          cost: action.refinementCost,
        },
      ];
  }
}

export interface ScenarioOptions extends SimulationContext {
  strategy: { buildOrder: readonly GoalDefinition[] };
  /** Facts before the first turn; a fresh ₡3,000,000 stable when absent. */
  initialFacts?: StableFacts;
  /** Phase of each turn, in order. */
  phases: readonly StableFacts['phase'][];
  /** Applied after every turn but the last (income, prestige, season change). */
  betweenTurns?: (facts: StableFacts, turnIndex: number) => StableFacts;
}

export interface ScenarioTurn {
  turnIndex: number;
  phase: StableFacts['phase'];
  turn: SimulatedTurn;
}

export interface ScenarioResult {
  /** Facts after the last turn. */
  facts: StableFacts;
  turns: ScenarioTurn[];
  purchases: ScenarioPurchase[];
}

/** Project the stable over `phases.length` turns. */
export function projectScenario(options: ScenarioOptions): ScenarioResult {
  let facts = options.initialFacts ?? freshStableFacts();
  const turns: ScenarioTurn[] = [];
  const purchases: ScenarioPurchase[] = [];

  options.phases.forEach((phase, turnIndex) => {
    const turn = simulateTurn({ ...facts, phase }, options.strategy, options);
    turns.push({ turnIndex, phase, turn });
    for (const step of turn.steps) {
      for (const purchase of chargedSteps(step.action)) purchases.push({ turnIndex, goalId: step.goalId, ...purchase });
    }
    facts = turn.facts;
    if (options.betweenTurns && turnIndex < options.phases.length - 1) facts = options.betweenTurns(facts, turnIndex);
  });
  return { facts, turns, purchases };
}

/** The opening build of a fresh ₡3,000,000 stable (draft preview, fixture tests). */
export function projectOpeningBuild(options: Omit<ScenarioOptions, 'phases' | 'betweenTurns'>): ScenarioResult {
  return projectScenario({ ...options, phases: OPENING_PHASES });
}
