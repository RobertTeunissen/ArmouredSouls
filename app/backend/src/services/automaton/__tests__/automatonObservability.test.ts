/**
 * Automaton_Observability (Spec #55 task 6.6; R11.7, R11.8).
 */
import logger from '../../../config/logger';
import { sendMonitoringAlert } from '../../../utils/monitoringWebhook';
import {
  ALERT_TEXT_LIMIT,
  alertCatalogueSyncConflicts,
  alertInvalidParameters,
  alertNegativeBalance,
  alertSavingStreak,
  alertStepBudgetExhausted,
  alertTurnFailed,
  alertUpgradeRejected,
  alertUpkeepIssues,
  emptyTurnStepSummary,
  formatTurnStepSummary,
  logTurnStepSummary,
  raiseAutomatonAlert,
  setAlertSender,
} from '../automatonObservability';

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../utils/monitoringWebhook', () => ({ sendMonitoringAlert: jest.fn(async () => true) }));

const TURN = { trigger: 'settlement' as const, seasonNumber: 4, slot: 17 };

beforeEach(() => {
  jest.clearAllMocks();
  setAlertSender(sendMonitoringAlert);
});

describe('alerts (R11.8)', () => {
  it('sends every alert through sendMonitoringAlert and logger.error', async () => {
    const message = await alertTurnFailed('dalek-empire', TURN, 'INSUFFICIENT_CREDITS', 'Insufficient credits');

    expect(sendMonitoringAlert).toHaveBeenCalledWith(message);
    expect(message).toBe('🚨 Automaton turn failed — dalek-empire: season 4 cycle 17 failed with INSUFFICIENT_CREDITS: Insufficient credits');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('automaton_turn_failed dalek-empire'));
  });

  it('names the stable and reason for each condition', async () => {
    const messages = [
      await alertInvalidParameters('light-labs', { trigger: 'preparation', seasonNumber: 4, slot: 2 }, 'pinned Strategy_Version duo.v3 has no Strategy_Definition_File'),
      await alertNegativeBalance('white-base', { trigger: 'season_open', seasonNumber: 5, slot: 0 }, -12_500),
      await alertSavingStreak('planet-express', 'tycoon.v1.07.facility.training_facility', 15),
      await alertUpkeepIssues('clone-legion', TURN, [{ part: 'teams', code: 'AUTOMATON_TEAM_NAME_MISSING', message: 'No Team_Names entry for 2v2 team 3' }]),
      await alertStepBudgetExhausted(TURN, {
        // Late settlement: a step starting at 04:00 gets 08:00 − 15 min, earlier than the 6 h cap.
        skipped: 4, durationMs: 13_501_000, budgetMs: 13_500_000, deadlineSource: 'schedule',
        nextScheduledJobAtMs: Date.UTC(2026, 9, 20, 8, 0), concurrency: 3,
      }),
      await alertCatalogueSyncConflicts(['jaeger-corps: stable name taken']),
    ];

    expect(messages[0]).toContain('light-labs: season 4 prep 2 ended invalid_parameters: pinned Strategy_Version duo.v3');
    expect(messages[1]).toContain('white-base: season 5 start started at ₡-12,500');
    expect(messages[2]).toContain('planet-express: saving for tycoon.v1.07.facility.training_facility for 15 consecutive turns (informational');
    expect(messages[3]).toContain('clone-legion: season 4 cycle 17: 1 issue(s), retried next turn: teams AUTOMATON_TEAM_NAME_MISSING');
    expect(messages[4]).toBe(
      '🚨 Automaton Turn_Step deadline reached — Turn_Step season 4 cycle 17: 4 stable(s) not started before the deadline '
      + 'after 13501 s and skipped (step_budget_exhausted); they act at their next turn. '
      + 'Deadline: before the next scheduled job at 08:00 UTC, budget 13500 s, 3 in parallel',
    );
    expect(messages[5]).toContain('Catalogue_Sync: 1 conflict(s): jaeger-corps: stable name taken');
    expect(sendMonitoringAlert).toHaveBeenCalledTimes(6);
  });

  it('names the cap or the 300 s floor when they set the Turn_Step deadline', async () => {
    const cap = await alertStepBudgetExhausted(TURN, {
      skipped: 2, durationMs: 600_400, budgetMs: 600_000, deadlineSource: 'cap', nextScheduledJobAtMs: null, concurrency: 1,
    });
    const floor = await alertStepBudgetExhausted(TURN, {
      skipped: 7, durationMs: 300_200, budgetMs: 300_000, deadlineSource: 'floor',
      nextScheduledJobAtMs: Date.UTC(2026, 9, 20, 0, 1), concurrency: 5,
    });

    expect(cap).toContain('2 stable(s) not started before the deadline after 600 s');
    expect(cap).toContain('Deadline: AUTOMATON_TURN_STEP_MAX_MS, budget 600 s, 1 in parallel');
    expect(floor).toContain('Deadline: 300 s minimum, budget 300 s, 5 in parallel');
    expect(floor.startsWith('🚨 Automaton Turn_Step deadline reached — ')).toBe(true);
  });

  it('raises one alert per rejected Strategy_Version upgrade (decision 37)', async () => {
    const messages = await alertUpgradeRejected([
      { catalogueKey: 'a', stableName: 'Alpha', strategyKey: 'duo', fromVersion: 1, toVersion: 2, reason: 'AUTOMATON_BLUEPRINTS_TOO_FEW' },
      { catalogueKey: 'b', stableName: 'Beta', strategyKey: 'duo', fromVersion: 1, toVersion: 2, reason: 'AUTOMATON_TEAM_NAMES_MISMATCH' },
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('a: Alpha: duo v1 → v2 rejected: AUTOMATON_BLUEPRINTS_TOO_FEW');
    expect(sendMonitoringAlert).toHaveBeenCalledTimes(2);
  });

  it('truncates long detail text', async () => {
    const message = await raiseAutomatonAlert('automaton_turn_failed', 'x', 'y'.repeat(1_000));
    expect(message.length).toBeLessThan(ALERT_TEXT_LIMIT + 60);
    expect(message.endsWith('…')).toBe(true);
  });

  it('never throws when the sender fails', async () => {
    setAlertSender(async () => { throw new Error('webhook down'); });
    await expect(raiseAutomatonAlert('automaton_turn_failed', 'x', 'y')).resolves.toContain('x: y');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('alert dispatch failed: webhook down'));
  });
});

describe('Turn_Step summary log (R11.7)', () => {
  it('logs one [automaton-turns] line with every field', () => {
    const summary = {
      ...emptyTurnStepSummary(TURN, 'admin_bulk', { concurrency: 3, budgetMs: 21_600_000, deadlineSource: 'cap' }),
      processed: 11, completed: 9, failed: 1, alreadyFinal: 0,
      skipped: { step_budget_exhausted: 1 },
      actionsByKind: { robot_creation: 3, facility_upgrade: 7 },
      creditsSpent: 2_500_000, creditsReceived: 40_000, saving: 6, blocked: 2, durationMs: 4_321,
    };

    logTurnStepSummary(summary);

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(formatTurnStepSummary(summary)).toBe(
      '[automaton-turns] trigger=settlement season=4 slot=17 source=admin_bulk processed=11 completed=9 '
      + 'skipped=step_budget_exhausted=1 failed=1 alreadyFinal=0 actions=facility_upgrade=7,robot_creation=3 '
      + 'spent=2500000 received=40000 saving=6 blocked=2 durationMs=4321 '
      + 'concurrency=3 budgetMs=21600000 deadline=cap',
    );
  });

  it('prints none for empty counts', () => {
    const run = { concurrency: 1, budgetMs: 600_000, deadlineSource: 'cap' as const };
    expect(formatTurnStepSummary(emptyTurnStepSummary(TURN, 'scheduler', run))).toContain('skipped=none failed=0 alreadyFinal=0 actions=none');
  });

  it('starts a summary with the run shape and no lease loss', () => {
    expect(emptyTurnStepSummary(TURN, 'rollover', { concurrency: 2, budgetMs: 300_000, deadlineSource: 'floor' })).toMatchObject({
      concurrency: 2, budgetMs: 300_000, deadlineSource: 'floor', leaseLost: false, budgetExhausted: false,
    });
  });
});
