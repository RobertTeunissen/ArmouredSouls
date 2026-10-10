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
      await alertStepBudgetExhausted(TURN, 4, 301_000),
      await alertCatalogueSyncConflicts(['jaeger-corps: stable name taken']),
    ];

    expect(messages[0]).toContain('light-labs: season 4 prep 2 ended invalid_parameters: pinned Strategy_Version duo.v3');
    expect(messages[1]).toContain('white-base: season 5 start started at ₡-12,500');
    expect(messages[2]).toContain('planet-express: saving for tycoon.v1.07.facility.training_facility for 15 consecutive turns (informational');
    expect(messages[3]).toContain('clone-legion: season 4 cycle 17: 1 issue(s), retried next turn: teams AUTOMATON_TEAM_NAME_MISSING');
    expect(messages[4]).toContain('Turn_Step season 4 cycle 17: 4 stable(s) skipped with step_budget_exhausted after 301 s');
    expect(messages[5]).toContain('Catalogue_Sync: 1 conflict(s): jaeger-corps: stable name taken');
    expect(sendMonitoringAlert).toHaveBeenCalledTimes(6);
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
      ...emptyTurnStepSummary(TURN, 'admin_bulk'),
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
      + 'spent=2500000 received=40000 saving=6 blocked=2 durationMs=4321',
    );
  });

  it('prints none for empty counts', () => {
    expect(formatTurnStepSummary(emptyTurnStepSummary(TURN, 'scheduler'))).toContain('skipped=none failed=0 alreadyFinal=0 actions=none');
  });
});
