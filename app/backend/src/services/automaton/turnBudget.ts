/**
 * Turn_Budget (Spec #55, R5.11, design §8.8).
 *
 * The limits that bound one Automaton_Turn and one Turn_Step. Re-exported by
 * `automatonTurnService.ts` so tests reference the same constants.
 */

/** Charged actions per Automaton_Turn. Free_Upkeep does not count. */
export const TURN_ACTION_LIMIT = 60;

/** Wall-clock budget per Automaton_Turn, Free_Upkeep included. */
export const TURN_TIME_BUDGET_MS = 10_000;

/** Wall-clock budget per Turn_Step (all Active_Automatons of one trigger). */
export const TURN_STEP_BUDGET_MS = 300_000;

/** Reason recorded when a turn stops on its own budget. */
export const TURN_BUDGET_EXHAUSTED = 'turn_budget_exhausted';

/** Reason recorded for profiles a Turn_Step skips once its budget is spent. */
export const STEP_BUDGET_EXHAUSTED = 'step_budget_exhausted';

export interface TurnBudgetState {
  /** Charged actions already executed in this turn. */
  chargedActions: number;
  /** `Date.now()` when the turn started. */
  startedAtMs: number;
}

export type TurnBudgetCheck =
  | { exhausted: false }
  | { exhausted: true; reason: typeof TURN_BUDGET_EXHAUSTED; limit: 'actions' | 'time' };

/**
 * Whether the turn may start another charged action. The action limit is
 * checked first, so a turn at 60 actions reports `actions` even when it is
 * also out of time.
 */
export function checkTurnBudget(state: TurnBudgetState, nowMs: number): TurnBudgetCheck {
  if (state.chargedActions >= TURN_ACTION_LIMIT) {
    return { exhausted: true, reason: TURN_BUDGET_EXHAUSTED, limit: 'actions' };
  }
  if (nowMs - state.startedAtMs >= TURN_TIME_BUDGET_MS) {
    return { exhausted: true, reason: TURN_BUDGET_EXHAUSTED, limit: 'time' };
  }
  return { exhausted: false };
}

/** Whether a Turn_Step started at `stepStartedAtMs` has used its budget (R7.10). */
export function isStepBudgetExhausted(stepStartedAtMs: number, nowMs: number): boolean {
  return nowMs - stepStartedAtMs > TURN_STEP_BUDGET_MS;
}
