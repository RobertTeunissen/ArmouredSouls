import {
  STEP_BUDGET_EXHAUSTED,
  TURN_ACTION_LIMIT,
  TURN_BUDGET_EXHAUSTED,
  TURN_STEP_BUDGET_MS,
  TURN_TIME_BUDGET_MS,
  TURN_STEP_MIN_BUDGET_MS,
  PLAYER_POOL_RESERVE,
  CONNECTIONS_PER_TURN,
  checkTurnBudget,
  effectiveTurnConcurrency,
  isStepBudgetExhausted,
  isStepDeadlineReached,
  resolveTurnStepDeadline,
} from '../turnBudget';

describe('turnBudget (R5.11, design §8.8)', () => {
  it('defines the design limits', () => {
    expect(TURN_ACTION_LIMIT).toBe(60);
    expect(TURN_TIME_BUDGET_MS).toBe(10_000);
    expect(TURN_STEP_BUDGET_MS).toBe(300_000);
    expect(TURN_BUDGET_EXHAUSTED).toBe('turn_budget_exhausted');
    expect(STEP_BUDGET_EXHAUSTED).toBe('step_budget_exhausted');
  });

  it('allows a 60th action and stops at 60 executed actions', () => {
    expect(checkTurnBudget({ chargedActions: 59, startedAtMs: 0 }, 0)).toEqual({ exhausted: false });
    expect(checkTurnBudget({ chargedActions: 60, startedAtMs: 0 }, 0)).toEqual({
      exhausted: true, reason: 'turn_budget_exhausted', limit: 'actions',
    });
  });

  it('stops at 10 seconds of wall-clock time', () => {
    expect(checkTurnBudget({ chargedActions: 0, startedAtMs: 1_000 }, 10_999)).toEqual({ exhausted: false });
    expect(checkTurnBudget({ chargedActions: 0, startedAtMs: 1_000 }, 11_000)).toEqual({
      exhausted: true, reason: 'turn_budget_exhausted', limit: 'time',
    });
  });

  it('starts a multi-step action only when all its charged steps fit under the limit (R5.4 + R5.11)', () => {
    expect(checkTurnBudget({ chargedActions: 56, startedAtMs: 0 }, 0, 4)).toEqual({ exhausted: false });
    expect(checkTurnBudget({ chargedActions: 57, startedAtMs: 0 }, 0, 4)).toEqual({
      exhausted: true, reason: 'turn_budget_exhausted', limit: 'actions',
    });
    // A free action (0 charged steps) still stops once 60 actions ran.
    expect(checkTurnBudget({ chargedActions: 59, startedAtMs: 0 }, 0, 0)).toEqual({ exhausted: false });
    expect(checkTurnBudget({ chargedActions: 60, startedAtMs: 0 }, 0, 0)).toMatchObject({ exhausted: true, limit: 'actions' });
  });

  it('reports the action limit first when both limits are reached', () => {
    expect(checkTurnBudget({ chargedActions: 60, startedAtMs: 0 }, 20_000)).toMatchObject({ limit: 'actions' });
  });

  it('marks a Turn_Step exhausted only after 300 seconds', () => {
    expect(isStepBudgetExhausted(0, 300_000)).toBe(false);
    expect(isStepBudgetExhausted(0, 300_001)).toBe(true);
  });
});

describe('Turn_Step deadline (supersedes R7.10; plan D1)', () => {
  const START = 1_000_000;
  const MIN = 60_000;
  const HOUR = 60 * MIN;

  it('defines the floor and pool constants', () => {
    expect(TURN_STEP_MIN_BUDGET_MS).toBe(300_000);
    expect(PLAYER_POOL_RESERVE).toBe(5);
    expect(CONNECTIONS_PER_TURN).toBe(2);
  });

  it('uses the next scheduled job minus the margin when it is earlier than the cap', () => {
    const next = START + 8 * HOUR;
    expect(resolveTurnStepDeadline({ stepStartedAtMs: START, maxMs: 6 * HOUR, scheduleMarginMs: 15 * MIN, nextScheduledJobAtMs: next }))
      .toMatchObject({ source: 'cap', deadlineAtMs: START + 6 * HOUR, budgetMs: 6 * HOUR, nextScheduledJobAtMs: next });
    expect(resolveTurnStepDeadline({ stepStartedAtMs: START, maxMs: 23 * HOUR, scheduleMarginMs: 15 * MIN, nextScheduledJobAtMs: next }))
      .toEqual({ startedAtMs: START, source: 'schedule', deadlineAtMs: next - 15 * MIN, budgetMs: 8 * HOUR - 15 * MIN, nextScheduledJobAtMs: next });
  });

  it('uses the cap when no scheduled job is known', () => {
    expect(resolveTurnStepDeadline({ stepStartedAtMs: START, maxMs: 600_000, scheduleMarginMs: 15 * MIN, nextScheduledJobAtMs: null }))
      .toEqual({ startedAtMs: START, source: 'cap', deadlineAtMs: START + 600_000, budgetMs: 600_000, nextScheduledJobAtMs: null });
  });

  it('reports the cap when the scheduled end equals the cap', () => {
    const next = START + HOUR + 15 * MIN;
    expect(resolveTurnStepDeadline({ stepStartedAtMs: START, maxMs: HOUR, scheduleMarginMs: 15 * MIN, nextScheduledJobAtMs: next }))
      .toMatchObject({ source: 'cap', deadlineAtMs: START + HOUR });
    expect(resolveTurnStepDeadline({ stepStartedAtMs: START, maxMs: HOUR, scheduleMarginMs: 15 * MIN, nextScheduledJobAtMs: next - 1 }))
      .toMatchObject({ source: 'schedule', deadlineAtMs: START + HOUR - 1 });
  });

  it('never gives less than 300 s (floor), but exactly 300 s is not the floor', () => {
    const exact = START + TURN_STEP_MIN_BUDGET_MS + 15 * MIN;
    expect(resolveTurnStepDeadline({ stepStartedAtMs: START, maxMs: 6 * HOUR, scheduleMarginMs: 15 * MIN, nextScheduledJobAtMs: exact }))
      .toMatchObject({ source: 'schedule', budgetMs: TURN_STEP_MIN_BUDGET_MS });
    expect(resolveTurnStepDeadline({ stepStartedAtMs: START, maxMs: 6 * HOUR, scheduleMarginMs: 15 * MIN, nextScheduledJobAtMs: exact - 1 }))
      .toMatchObject({ source: 'floor', budgetMs: TURN_STEP_MIN_BUDGET_MS, deadlineAtMs: START + TURN_STEP_MIN_BUDGET_MS });
    // A job already overdue (settlement ran late) still gets the floor.
    expect(resolveTurnStepDeadline({ stepStartedAtMs: START, maxMs: 6 * HOUR, scheduleMarginMs: 15 * MIN, nextScheduledJobAtMs: START - HOUR }))
      .toMatchObject({ source: 'floor', budgetMs: TURN_STEP_MIN_BUDGET_MS });
    // A cap below the floor (only possible from code; env.ts bounds it) is raised too.
    expect(resolveTurnStepDeadline({ stepStartedAtMs: START, maxMs: 1_000, scheduleMarginMs: 0, nextScheduledJobAtMs: null }))
      .toMatchObject({ source: 'floor', budgetMs: TURN_STEP_MIN_BUDGET_MS });
  });

  it('is reached at the deadline instant, not before', () => {
    const deadline = resolveTurnStepDeadline({ stepStartedAtMs: START, maxMs: 600_000, scheduleMarginMs: 0, nextScheduledJobAtMs: null });
    expect(isStepDeadlineReached(deadline, START + 599_999)).toBe(false);
    expect(isStepDeadlineReached(deadline, START + 600_000)).toBe(true);
  });
});

describe('effectiveTurnConcurrency (plan D3)', () => {
  it('clamps to ⌊(pool − 5) / 2⌋', () => {
    expect(effectiveTurnConcurrency(8, 15)).toBe(5);
    expect(effectiveTurnConcurrency(5, 15)).toBe(5);
    expect(effectiveTurnConcurrency(3, 15)).toBe(3);
    expect(effectiveTurnConcurrency(3, 7)).toBe(1);
    expect(effectiveTurnConcurrency(3, 1)).toBe(1);
  });

  it('floors fractions and falls back to 1 for 0, negative or non-finite values', () => {
    expect(effectiveTurnConcurrency(2.9, 15)).toBe(2);
    expect(effectiveTurnConcurrency(0, 15)).toBe(1);
    expect(effectiveTurnConcurrency(-2, 15)).toBe(1);
    expect(effectiveTurnConcurrency(Number.NaN, 15)).toBe(1);
    expect(effectiveTurnConcurrency(3, Number.NaN)).toBe(1);
  });
});
