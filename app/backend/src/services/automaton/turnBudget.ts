/**
 * Turn_Budget and Turn_Step deadline (Spec #55, R5.11, design §8.8; the
 * Turn_Step rule supersedes spec 55 R7.10 and the 300 s hard limit of
 * design §8.8 / §19, see docs/implementation_notes/
 * AUTOMATON_TURN_STEP_DEADLINE.md, "Deadline" and "Bounded concurrency").
 *
 * - One Automaton_Turn: at most 60 charged actions and 10 s (unchanged).
 * - One Turn_Step: keeps starting turns until a deadline = the earlier of
 *   step start + AUTOMATON_TURN_STEP_MAX_MS and the next scheduled
 *   cycle-scheduler job − AUTOMATON_TURN_STEP_SCHEDULE_MARGIN_MS, but never
 *   less than 300 s (the former hard limit, now the floor). Stables not
 *   started by then are recorded `step_budget_exhausted`.
 * - Turns run in parallel up to a concurrency clamped to the pg pool, so
 *   PLAYER_POOL_RESERVE connections always stay free for players.
 *
 * Pure functions; re-exported by `automatonTurnService.ts` so tests
 * reference the same constants.
 */

/** Charged actions per Automaton_Turn. Free_Upkeep does not count. */
export const TURN_ACTION_LIMIT = 60;

/** Wall-clock budget per Automaton_Turn, Free_Upkeep included. */
export const TURN_TIME_BUDGET_MS = 10_000;

/** Shortest Turn_Step deadline: spec 55's former hard limit, now the floor. */
export const TURN_STEP_MIN_BUDGET_MS = 300_000;

/** pg pool connections a Turn_Step always leaves for players. */
export const PLAYER_POOL_RESERVE = 5;

/**
 * pg pool connections one running turn may hold at once: an interactive
 * transaction plus one read on the global client. Every turn write path
 * (purchases, team registration, subscriptions with their standings
 * placement) runs only on its transaction client; the subscription path
 * reads the audit cycle before it opens the transaction. One connection is
 * the sustained need and the second is headroom for reads outside a
 * transaction; brief parallel reads beyond it (achievement checks) wait in
 * the pool.
 */
export const CONNECTIONS_PER_TURN = 2;

/** Reason recorded when a turn stops on its own budget. */
export const TURN_BUDGET_EXHAUSTED = 'turn_budget_exhausted';

/** Reason recorded for profiles a Turn_Step skips once its deadline is reached. */
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
 * Whether the turn may start the next action, which has `nextChargedSteps`
 * charged steps (`chargedStepCount`; default 1). An action runs all its steps
 * in the same turn (R5.4), so it starts only when all of them fit under the
 * 60-action limit (R5.11); otherwise the turn stops before it and the next
 * turn plans it again. The action limit is checked first, so a turn at 60
 * actions reports `actions` even when it is also out of time.
 */
export function checkTurnBudget(state: TurnBudgetState, nowMs: number, nextChargedSteps = 1): TurnBudgetCheck {
  if (state.chargedActions >= TURN_ACTION_LIMIT || state.chargedActions + nextChargedSteps > TURN_ACTION_LIMIT) {
    return { exhausted: true, reason: TURN_BUDGET_EXHAUSTED, limit: 'actions' };
  }
  if (nowMs - state.startedAtMs >= TURN_TIME_BUDGET_MS) {
    return { exhausted: true, reason: TURN_BUDGET_EXHAUSTED, limit: 'time' };
  }
  return { exhausted: false };
}

// ─── Turn_Step deadline ──────────────────────────────────────────────

/**
 * What set the deadline: the next scheduled job minus the margin, the
 * AUTOMATON_TURN_STEP_MAX_MS cap, or the 300 s floor.
 */
export type TurnStepDeadlineSource = 'schedule' | 'cap' | 'floor';

export interface TurnStepDeadline {
  startedAtMs: number;
  /** No turn starts at or after this instant. */
  deadlineAtMs: number;
  /** deadlineAtMs − startedAtMs. */
  budgetMs: number;
  source: TurnStepDeadlineSource;
  /** The next scheduled cycle-scheduler job, or null when none is known. */
  nextScheduledJobAtMs: number | null;
}

export interface TurnStepDeadlineInput {
  stepStartedAtMs: number;
  /** AUTOMATON_TURN_STEP_MAX_MS. */
  maxMs: number;
  /** AUTOMATON_TURN_STEP_SCHEDULE_MARGIN_MS. */
  scheduleMarginMs: number;
  /** `nextScheduledJobRunAt`; null when the scheduler is off or no schedule parses. */
  nextScheduledJobAtMs: number | null;
}

/**
 * The Turn_Step deadline: min(start + maxMs, next job − margin), never less
 * than start + TURN_STEP_MIN_BUDGET_MS. The source is `schedule` only when
 * the scheduled end is strictly earlier than the cap.
 */
export function resolveTurnStepDeadline(input: TurnStepDeadlineInput): TurnStepDeadline {
  const { stepStartedAtMs: start, maxMs, scheduleMarginMs, nextScheduledJobAtMs } = input;
  const cap = start + maxMs;
  let end = cap;
  let source: TurnStepDeadlineSource = 'cap';
  if (nextScheduledJobAtMs !== null) {
    const scheduled = nextScheduledJobAtMs - scheduleMarginMs;
    if (scheduled < cap) {
      end = scheduled;
      source = 'schedule';
    }
  }
  if (end - start < TURN_STEP_MIN_BUDGET_MS) {
    end = start + TURN_STEP_MIN_BUDGET_MS;
    source = 'floor';
  }
  return { startedAtMs: start, deadlineAtMs: end, budgetMs: end - start, source, nextScheduledJobAtMs };
}

/** Whether the Turn_Step may no longer start a turn (checked before each stable). */
export function isStepDeadlineReached(deadline: TurnStepDeadline, nowMs: number): boolean {
  return nowMs >= deadline.deadlineAtMs;
}

// ─── Concurrency ─────────────────────────────────────────────────────

/**
 * Turns a Turn_Step runs at once: `configured` (floored; 1 when not finite)
 * clamped to [1, max(1, ⌊(poolMax − PLAYER_POOL_RESERVE) / CONNECTIONS_PER_TURN⌋)].
 */
export function effectiveTurnConcurrency(configured: number, poolMax: number): number {
  const requested = Number.isFinite(configured) ? Math.floor(configured) : 1;
  const poolLimit = Number.isFinite(poolMax)
    ? Math.max(1, Math.floor((poolMax - PLAYER_POOL_RESERVE) / CONNECTIONS_PER_TURN))
    : 1;
  return Math.min(Math.max(requested, 1), poolLimit);
}
