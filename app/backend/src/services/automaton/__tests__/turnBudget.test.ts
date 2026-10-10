import {
  STEP_BUDGET_EXHAUSTED,
  TURN_ACTION_LIMIT,
  TURN_BUDGET_EXHAUSTED,
  TURN_STEP_BUDGET_MS,
  TURN_TIME_BUDGET_MS,
  checkTurnBudget,
  isStepBudgetExhausted,
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

  it('reports the action limit first when both limits are reached', () => {
    expect(checkTurnBudget({ chargedActions: 60, startedAtMs: 0 }, 20_000)).toMatchObject({ limit: 'actions' });
  });

  it('marks a Turn_Step exhausted only after 300 seconds', () => {
    expect(isStepBudgetExhausted(0, 300_000)).toBe(false);
    expect(isStepBudgetExhausted(0, 300_001)).toBe(true);
  });
});
