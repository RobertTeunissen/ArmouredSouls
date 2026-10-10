/**
 * Turn planner (Spec #55, R5.1, R5.3, R5.6, R5.10, design §8.3, task 3.4).
 *
 * `planNextStep` walks the Build_Order top-down and stops at the first Goal
 * that is Saving or Actionable. Satisfied and Blocked Goals are passed over.
 * A Saving Goal ends the evaluation, so nothing below it is bought while it
 * saves (R5.6); there is no timeout and no counter. Pure and deterministic:
 * the inputs are plain data and every iteration order is fixed (R5.10).
 *
 * `simulateTurn` is the turn loop without a database: plan, project the
 * Actionable step with `factProjector`, restart from the first Goal, until a
 * Goal saves, every Goal is Satisfied or Blocked, or the Turn_Budget's action
 * limit is reached. Free_Upkeep's team part runs at turn start and end, as in
 * the real turn. Turn_Preview, the scenario projector and the conformance
 * suite share it.
 */
import type { StrategyParametersV1 } from '../../types/automaton';
import {
  chargedStepCount,
  projectAction,
  projectTeamUpkeep,
  ProjectionError,
  type ProjectionContext,
} from './factProjector';
import type { GoalOutcome, PlannedAction } from './goals/goalTypes';
import type { BlueprintFacts, StableFacts, WeaponFacts } from './stableFacts';
import { resolveGoalTarget } from './strategies/strategyParameters';
import type { GoalDefinition } from './strategies/strategyTypes';
import { checkTurnBudget, TURN_BUDGET_EXHAUSTED } from './turnBudget';

export interface PlannerContext {
  params: StrategyParametersV1;
  /** Ordered by slot. */
  blueprints: readonly BlueprintFacts[];
  /** Weapon catalogue keyed by name. */
  weapons: ReadonlyMap<string, WeaponFacts>;
}

export type NextStep = Extract<GoalOutcome, { kind: 'saving' } | { kind: 'actionable' }>;

export interface PlanResult {
  /** The Saving or Actionable outcome that ended the walk; null when every Goal is Satisfied or Blocked. */
  next: NextStep | null;
  /** Outcomes of the Goals evaluated, in Build_Order order, up to and including `next`. */
  outcomes: GoalOutcome[];
}

/** Evaluate the Build_Order top-down (design §8.3). */
export function planNextStep(
  facts: StableFacts,
  strategy: { buildOrder: readonly GoalDefinition[] },
  ctx: PlannerContext,
): PlanResult {
  const outcomes: GoalOutcome[] = [];
  for (const definition of strategy.buildOrder) {
    const outcome = definition.goal.evaluate(facts, {
      target: resolveGoalTarget(definition, ctx.params),
      params: ctx.params,
      blueprints: ctx.blueprints,
      weapons: ctx.weapons,
      balance: facts.balance,
    });
    outcomes.push(outcome);
    if (outcome.kind === 'saving' || outcome.kind === 'actionable') {
      return { next: outcome, outcomes };
    }
  }
  return { next: null, outcomes };
}

export interface SimulatedStep {
  goalId: string;
  action: PlannedAction;
  cost: number;
  /** Balance when the step was planned (`cost ≤ balanceBefore`). */
  balanceBefore: number;
  chargedSteps: number;
}

export type SimulationStop =
  | { kind: 'saving'; outcome: Extract<GoalOutcome, { kind: 'saving' }> }
  | { kind: 'build_order_done' }
  | { kind: typeof TURN_BUDGET_EXHAUSTED };

export interface SimulatedTurn {
  facts: StableFacts;
  steps: SimulatedStep[];
  chargedActions: number;
  stop: SimulationStop;
  /** The last planner result (the one that stopped the loop). */
  lastPlan: PlanResult;
}

export type SimulationContext = PlannerContext & ProjectionContext;

/**
 * One Automaton_Turn on projected facts: Actionable steps are applied and the
 * walk restarts at goal 1 after each (R5.1). The time budget is not modelled;
 * the action limit is (R5.11).
 */
export function simulateTurn(
  facts: StableFacts,
  strategy: { buildOrder: readonly GoalDefinition[] },
  ctx: SimulationContext,
): SimulatedTurn {
  let current = projectTeamUpkeep(facts, ctx.teamNames);
  const steps: SimulatedStep[] = [];
  let chargedActions = 0;

  const finish = (stop: SimulationStop, lastPlan: PlanResult): SimulatedTurn => ({
    facts: projectTeamUpkeep(current, ctx.teamNames),
    steps,
    chargedActions,
    stop,
    lastPlan,
  });

  for (;;) {
    const plan = planNextStep(current, strategy, ctx);
    const next = plan.next;
    if (next === null) return finish({ kind: 'build_order_done' }, plan);
    if (next.kind === 'saving') return finish({ kind: 'saving', outcome: next }, plan);
    if (checkTurnBudget({ chargedActions, startedAtMs: 0 }, 0).exhausted) {
      return finish({ kind: TURN_BUDGET_EXHAUSTED }, plan);
    }

    const { action, cost, goalId } = next;
    const projected = projectAction(current, action, ctx);
    if (JSON.stringify(projected) === JSON.stringify(current)) {
      throw new ProjectionError(`Goal ${goalId} planned ${action.kind} without changing the facts`);
    }
    const charged = chargedStepCount(action);
    steps.push({ goalId, action, cost, balanceBefore: current.balance, chargedSteps: charged });
    chargedActions += charged;
    current = projected;
  }
}
