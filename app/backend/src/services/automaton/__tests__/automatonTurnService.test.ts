/**
 * Turn runner (Spec #55 task 6.2; R2.7, R5.11, R6.6, R7.5–R7.10, R11.8).
 *
 * The real `runTurnStep`, `runAutomatonTurn`, `claimTurnRecord`,
 * `withTurnStepLease`, Program_Switch, planner and Turn_Budget, over an
 * in-memory Turn_Record store (`helpers/fakeTurnDb.ts`) with the facts
 * loader, Free_Upkeep and the action executor mocked. A scripted Goal decides
 * what the planner sees. The database-backed flows (real stables, retries
 * without duplicate charges, call sites) are the integration tests of task
 * 6.7.
 */
import { z } from 'zod';
import { AutomatonError, AutomatonErrorCode } from '../../../errors/automatonErrors';
import { EconomyError, EconomyErrorCode } from '../../../errors/economyErrors';
import { resolveCanonicalCycleIdentity } from '../../cycle/canonicalCycleIdentity';
import { executeAction } from '../actionExecutor';
import { loadStableFacts } from '../stableFacts';
import { runFreeUpkeep, type FreeUpkeepIssue } from '../upkeep/freeUpkeep';
import { chargedStepCount } from '../factProjector';
import { createStrategyRegistry, type StrategyRegistry } from '../strategies/registry';
import type { UpgradeStrategy } from '../strategies/strategyTypes';
import type { Goal, GoalOutcome, PlannedAction } from '../goals/goalTypes';
import type { ExecutionCursor } from '../executionSteps';
import type { StableFacts } from '../stableFacts';
import { setAlertSender } from '../automatonObservability';
import { resumeIncompleteFitouts } from '../fitoutRecovery';
import {
  runTurnStep,
  runTurnStepNonFatal,
  withTurnStepLease,
  STEP_BUDGET_EXHAUSTED,
  TURN_ACTION_LIMIT,
  TURN_BUDGET_EXHAUSTED,
  CUTOVER_IN_PROGRESS,
  TURN_STEP_LEASE_LOST,
  TURN_STEP_LEASE_RENEW_MS,
  TURN_STEP_LEASE_TTL_MS,
  TURN_STEP_MIN_BUDGET_MS,
  type TurnStepDependencies,
  type TurnStepInput,
} from '../automatonTurnService';
import { setProgramSwitch } from '../programSwitch';
import logger from '../../../config/logger';
import { fakeDb, fakePrisma, resetFakeDb, seedTurn, type FakeProfileRow } from './helpers/fakeTurnDb';
import { facilities, stable } from './helpers/automatonFixtures';

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: jest.requireActual('./helpers/fakeTurnDb').fakePrisma,
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../cycle/canonicalCycleIdentity', () => ({ resolveCanonicalCycleIdentity: jest.fn() }));
jest.mock('../stableFacts', () => ({
  ...jest.requireActual('../stableFacts'),
  loadStableFacts: jest.fn(),
  loadBlueprintFacts: jest.fn(async () => []),
  loadWeaponCatalogue: jest.fn(async () => new Map()),
}));
jest.mock('../upkeep/freeUpkeep', () => ({ runFreeUpkeep: jest.fn() }));
jest.mock('../actionExecutor', () => ({
  createExecutionCursor: () => ({ chargedSteps: 0, creditsSpent: 0, creditsReceived: 0, steps: [] }),
  executeAction: jest.fn(),
}));
// The real fit-out recovery (a no-op for these robot-less stables), spied on for call order.
jest.mock('../fitoutRecovery', () => {
  const actual = jest.requireActual<typeof import('../fitoutRecovery')>('../fitoutRecovery');
  return { ...actual, resumeIncompleteFitouts: jest.fn(actual.resumeIncompleteFitouts) };
});

const mockIdentity = resolveCanonicalCycleIdentity as jest.MockedFunction<typeof resolveCanonicalCycleIdentity>;
const mockLoadFacts = loadStableFacts as jest.MockedFunction<typeof loadStableFacts>;
const mockUpkeep = runFreeUpkeep as jest.MockedFunction<typeof runFreeUpkeep>;
const mockExecute = executeAction as jest.MockedFunction<typeof executeAction>;
const mockLoggerError = logger.error as jest.MockedFunction<typeof logger.error>;
const mockResume = jest.mocked(resumeIncompleteFitouts);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const GOAL_ID = 'fixture.v1.01.facility.training_facility';
const STEP_COST = 1_000;
const INPUT: TurnStepInput = { trigger: 'settlement', seasonNumber: 3, slot: 42, source: 'scheduler' };

/** What the scripted Goal returns for each stable's facts. */
let script: (facts: StableFacts) => GoalOutcome;
const goal: Goal = { id: GOAL_ID, evaluate: (facts) => script(facts) };

const strategy: UpgradeStrategy = {
  key: 'fixture',
  version: 1,
  displayName: 'Fixture',
  description: 'Scripted test strategy',
  buildOrder: [{
    id: GOAL_ID, position: 1, type: 'facility', facilityType: 'training_facility',
    defaultTarget: 1, bounds: { min: 0, max: 10 }, isMax: false, goal,
  }],
  parameterSchema: z.object({ targets: z.object({ [GOAL_ID]: z.number().int().min(0).max(10) }).strict() }).strict(),
  definition: { schemaVersion: 1, key: 'fixture', version: 1, displayName: 'Fixture', description: '', buildOrder: [] },
};
const registry: StrategyRegistry = createStrategyRegistry([strategy]);

/**
 * Dependencies of the sequential tests: one turn at a time (so ordering and
 * fake-clock assertions keep their meaning) and no scheduled job, so the
 * deadline is the AUTOMATON_TURN_STEP_MAX_MS cap whatever the local `.env` says.
 */
function sequential(extra: TurnStepDependencies = {}): TurnStepDependencies {
  return { registry, concurrency: 1, nextScheduledJobAt: () => null, ...extra };
}

const facilityAction = (toLevel: number): PlannedAction => ({ kind: 'facility_upgrade', facilityType: 'training_facility', toLevel, cost: STEP_COST });
const actionable = (action: PlannedAction): GoalOutcome => ({ kind: 'actionable', goalId: GOAL_ID, action, cost: STEP_COST });
const saving: GoalOutcome = { kind: 'saving', goalId: GOAL_ID, cost: 10_000_000, detail: { actionKind: 'facility_upgrade' } };
/** Buy until training level `target`, then Saving. */
const buyUntil = (target: number) => (facts: StableFacts): GoalOutcome =>
  facts.facilities.training_facility < target ? actionable(facilityAction(facts.facilities.training_facility + 1)) : saving;

const alerts: string[] = [];
const upkeepIssues = new Map<number, FreeUpkeepIssue[]>();
const factsByProfile = new Map<number, StableFacts>();

function addProfile(id: number, userId: number, overrides: Partial<FakeProfileRow> = {}): FakeProfileRow {
  const profile: FakeProfileRow = {
    id,
    userId,
    catalogueKey: `stable-${id}`,
    strategyKey: 'fixture',
    strategyVersion: 1,
    strategyParameters: { targets: { [GOAL_ID]: 1 } },
    teamNames: { twoVsTwo: [], threeVsThree: [] },
    eventOrder: ['league_1v1'],
    status: 'active',
    currency: 3_000_000,
    ...overrides,
  };
  fakeDb.profiles.push(profile);
  factsByProfile.set(id, stable({ profileId: id, userId, catalogueKey: profile.catalogueKey, balance: profile.currency, facilities: facilities() }));
  return profile;
}

function turnsOf(profileId: number) {
  return fakeDb.turns.filter((t) => t.profileId === profileId);
}

/** The executor: one charged step per `chargedStepCount`, training level + 1, balance − cost. */
function executeScripted(action: PlannedAction, goalId: string, facts: StableFacts, _ctx: unknown, cursor: ExecutionCursor) {
  const steps = chargedStepCount(action);
  for (let i = 0; i < steps; i++) {
    cursor.chargedSteps++;
    cursor.creditsSpent += STEP_COST;
    cursor.steps.push({
      ordinal: cursor.chargedSteps, requestKey: `key-${cursor.chargedSteps}`, kind: 'facility_upgrade',
      goalId, spent: STEP_COST, received: 0, replayed: false, detail: {},
    });
  }
  const next: StableFacts = {
    ...facts,
    balance: facts.balance - STEP_COST * steps,
    facilities: { ...facts.facilities, training_facility: facts.facilities.training_facility + 1 },
  };
  factsByProfile.set(facts.profileId, next);
  return Promise.resolve({ facts: next, upkeepIssues: [] });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetFakeDb();
  alerts.length = 0;
  upkeepIssues.clear();
  factsByProfile.clear();
  setAlertSender(async (message) => { alerts.push(message); });
  script = () => saving;
  mockIdentity.mockResolvedValue({
    activeCycle: 43, completedCycles: 42, seasonNumber: 3, phase: 'competitive', competitiveCyclesCompleted: 12,
    preparationCyclesCompleted: 0, seasonStartedAt: new Date(0), isClosing: false, closingCycle: null,
  });
  mockLoadFacts.mockImplementation(async (_db, profileId) => {
    const facts = factsByProfile.get(profileId);
    if (!facts) throw new Error(`no facts for ${profileId}`);
    return facts;
  });
  mockUpkeep.mockImplementation(async (facts) => ({
    facts, teamsRegistered: 0, subscriptionsChanged: 0, settingsChanged: 0, tuningChanged: 0,
    issues: upkeepIssues.get(facts.profileId) ?? [],
  }));
  mockExecute.mockImplementation(executeScripted);
});

describe('runTurnStep — cohort, Turn_Records and retries (R7.6, R7.9)', () => {
  it('runs one completed turn per Active_Automaton in ascending User.id order', async () => {
    addProfile(1, 30);
    addProfile(2, 10);
    addProfile(3, 20, { status: 'draft' });
    script = buyUntil(2);

    const summary = await runTurnStep(INPUT, sequential());

    expect(summary).toMatchObject({ processed: 2, completed: 2, failed: 0, saving: 2, creditsSpent: 4 * STEP_COST });
    expect(summary.actionsByKind).toEqual({ facility_upgrade: 4 });
    // User 10 (profile 2) first, then user 30 (profile 1); the draft is not in the cohort.
    expect(mockLoadFacts.mock.calls.map((call) => call[1])).toEqual([2, 1]);
    expect(turnsOf(3)).toHaveLength(0);
    for (const profileId of [1, 2]) {
      const [row] = turnsOf(profileId);
      expect(row).toMatchObject({
        seasonNumber: 3, trigger: 'settlement', slot: 42, attempt: 1, status: 'completed', reason: null,
        strategyKey: 'fixture', strategyVersion: 1, startBalance: 3_000_000, endBalance: 3_000_000 - 2 * STEP_COST,
        creditsSpent: 2 * STEP_COST, creditsReceived: 0,
      });
      expect(row.actions).toHaveLength(2);
      expect(row.goalOutcomes).toEqual([{ goalId: GOAL_ID, kind: 'saving', cost: 10_000_000, detail: { actionKind: 'facility_upgrade' } }]);
      expect(row.durationMs).not.toBeNull();
    }
    // Free_Upkeep at turn start and end for each stable.
    expect(mockUpkeep).toHaveBeenCalledTimes(4);
  });

  it('skips completed and skipped records on a retried step and re-plans failed ones with attempt + 1', async () => {
    addProfile(1, 10);
    addProfile(2, 20);
    addProfile(3, 30);
    seedTurn({ profileId: 1, seasonNumber: 3, trigger: 'settlement', slot: 42, status: 'completed' });
    seedTurn({ profileId: 2, seasonNumber: 3, trigger: 'settlement', slot: 42, status: 'skipped', reason: 'program_off' });
    const failed = seedTurn({ profileId: 3, seasonNumber: 3, trigger: 'settlement', slot: 42, status: 'failed', reason: 'X', attempt: 1 });
    script = buyUntil(1);

    const summary = await runTurnStep(INPUT, sequential());

    expect(summary).toMatchObject({ processed: 3, alreadyFinal: 2, completed: 1 });
    expect(mockLoadFacts.mock.calls.map((call) => call[1])).toEqual([3]);
    expect(fakeDb.turns.filter((t) => t.profileId === 3)).toHaveLength(1);
    expect(failed).toMatchObject({ attempt: 2, status: 'completed', reason: null });
    // The executor ran under the new attempt, so its request keys are new.
    expect(mockExecute.mock.calls[0][3].identity).toMatchObject({ profileId: 3, attempt: 2, trigger: 'settlement', slot: 42, seasonNumber: 3 });
  });

  it('re-opens an in_progress record left by a crashed step', async () => {
    addProfile(1, 10);
    const stale = seedTurn({ profileId: 1, seasonNumber: 3, trigger: 'settlement', slot: 42, status: 'in_progress', attempt: 2 });

    await runTurnStep(INPUT, sequential());

    expect(stale).toMatchObject({ attempt: 3, status: 'completed' });
  });

  it('keys records by season, trigger and slot', async () => {
    addProfile(1, 10);
    await runTurnStep(INPUT, sequential());
    await runTurnStep({ ...INPUT, trigger: 'preparation', slot: 2 }, sequential());
    await runTurnStep({ ...INPUT, trigger: 'season_open', seasonNumber: 4, slot: 0, source: 'rollover' }, sequential());
    await runTurnStep(INPUT, sequential());

    expect(turnsOf(1).map((t) => `${t.seasonNumber}/${t.trigger}/${t.slot}/${t.status}`))
      .toEqual(['3/settlement/42/completed', '3/preparation/2/completed', '4/season_open/0/completed']);
  });
});

describe('runAutomatonTurn — fit-out recovery wiring (PR #534)', () => {
  it('resumes incomplete fit-outs before Free_Upkeep and the planner, and continues on its facts', async () => {
    addProfile(1, 10);
    const order: string[] = [];
    let recovered: StableFacts | undefined;
    mockResume.mockImplementationOnce(async (facts) => {
      order.push('recovery');
      recovered = { ...facts, balance: facts.balance - 1 };
      return { facts: recovered, resumed: [], unresolved: [] };
    });
    mockUpkeep.mockImplementation(async (facts) => {
      order.push('upkeep');
      return { facts, teamsRegistered: 0, subscriptionsChanged: 0, settingsChanged: 0, tuningChanged: 0, issues: [] };
    });
    script = () => {
      order.push('planner');
      return saving;
    };

    await runTurnStep(INPUT, { registry });

    expect(order.slice(0, 3)).toEqual(['recovery', 'upkeep', 'planner']);
    expect(mockResume).toHaveBeenCalledTimes(1);
    expect(mockResume).toHaveBeenCalledWith(
      factsByProfile.get(1),
      expect.objectContaining({ identity: expect.objectContaining({ profileId: 1, userId: 10 }) }),
      expect.objectContaining({ chargedSteps: 0 }),
      expect.objectContaining({ startedAtMs: expect.any(Number) }),
    );
    // Free_Upkeep runs on the facts recovery returned.
    expect(mockUpkeep.mock.calls[0][0]).toBe(recovered);
  });
});

describe('runTurnStep — Program_Switch (R2.7, R2.8)', () => {
  it('records every due turn skipped / program_off and runs no upkeep or purchase', async () => {
    addProfile(1, 10);
    addProfile(2, 20);
    script = buyUntil(3);
    await setProgramSwitch(false, 99);

    const summary = await runTurnStep(INPUT, sequential());

    expect(summary).toMatchObject({ processed: 2, completed: 0, skipped: { program_off: 2 } });
    expect(fakeDb.turns.map((t) => [t.status, t.reason])).toEqual([['skipped', 'program_off'], ['skipped', 'program_off']]);
    expect(mockLoadFacts).not.toHaveBeenCalled();
    expect(mockUpkeep).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('applies a switch change from the next Turn_Step', async () => {
    addProfile(1, 10);
    await setProgramSwitch(false, 99);
    await runTurnStep(INPUT, sequential());
    await setProgramSwitch(true, 99);
    const summary = await runTurnStep({ ...INPUT, slot: 43 }, sequential());

    expect(summary.completed).toBe(1);
    expect(turnsOf(1).map((t) => t.status)).toEqual(['skipped', 'completed']);
  });
});

const MINUTE = 60_000;
const CLOCK_START = 1_000_000;

/** Three stables whose turns each take `turnMs` of the step's fake clock. */
function threeTimedStables(turnMs: number): { now: () => number } {
  addProfile(1, 10);
  addProfile(2, 20);
  addProfile(3, 30);
  let clock = CLOCK_START;
  mockLoadFacts.mockImplementation(async (_db, profileId) => {
    clock += turnMs;
    return factsByProfile.get(profileId) as StableFacts;
  });
  return { now: () => clock };
}

describe('runTurnStep — budgets (R5.11; Turn_Step deadline supersedes R7.10)', () => {
  it('stops starting stables before the next scheduled job minus the margin, records them step_budget_exhausted, and alerts', async () => {
    const { now } = threeTimedStables(25 * MINUTE);

    const summary = await runTurnStep(INPUT, sequential({
      now,
      maxMs: 6 * 60 * MINUTE,
      scheduleMarginMs: 15 * MINUTE,
      nextScheduledJobAt: (ms) => ms + 60 * MINUTE,
    }));

    // Deadline = start + 45 min: turns start at 0 and 25 min; the third would start at 50 min.
    expect(summary).toMatchObject({
      completed: 2, skipped: { [STEP_BUDGET_EXHAUSTED]: 1 }, budgetExhausted: true,
      deadlineSource: 'schedule', budgetMs: 45 * MINUTE, concurrency: 1, leaseLost: false,
    });
    expect(turnsOf(3)[0]).toMatchObject({ status: 'skipped', reason: STEP_BUDGET_EXHAUSTED });
    const deadlineAlerts = alerts.filter((a) => a.includes('Turn_Step deadline reached'));
    expect(deadlineAlerts).toHaveLength(1);
    expect(deadlineAlerts[0]).toContain('1 stable(s) not started before the deadline');
    expect(deadlineAlerts[0]).toContain('before the next scheduled job at');
    expect(deadlineAlerts[0]).toContain('budget 2700 s, 1 in parallel');
  });

  it('uses the AUTOMATON_TURN_STEP_MAX_MS cap when no scheduled job is known', async () => {
    const { now } = threeTimedStables(400_000);

    const summary = await runTurnStep(INPUT, sequential({ now, maxMs: 600_000, nextScheduledJobAt: () => null }));

    expect(summary).toMatchObject({ completed: 2, skipped: { [STEP_BUDGET_EXHAUSTED]: 1 }, deadlineSource: 'cap', budgetMs: 600_000 });
    expect(alerts.some((a) => a.includes('Turn_Step deadline reached') && a.includes('Deadline: AUTOMATON_TURN_STEP_MAX_MS'))).toBe(true);
  });

  it('still gives a late step the 300 s floor', async () => {
    const { now } = threeTimedStables(200_000);

    const summary = await runTurnStep(INPUT, sequential({
      now, maxMs: 6 * 60 * MINUTE, scheduleMarginMs: 15 * MINUTE, nextScheduledJobAt: (ms) => ms + MINUTE,
    }));

    expect(summary).toMatchObject({
      completed: 2, skipped: { [STEP_BUDGET_EXHAUSTED]: 1 }, deadlineSource: 'floor', budgetMs: TURN_STEP_MIN_BUDGET_MS,
    });
    expect(alerts.some((a) => a.includes('Turn_Step deadline reached') && a.includes('Deadline: 300 s minimum'))).toBe(true);
  });

  it('raises no deadline alert when every stable started in time', async () => {
    const { now } = threeTimedStables(MINUTE);

    const summary = await runTurnStep(INPUT, sequential({ now, maxMs: 600_000 }));

    expect(summary).toMatchObject({ completed: 3, skipped: {}, budgetExhausted: false, deadlineSource: 'cap' });
    expect(alerts.some((a) => a.includes('Turn_Step deadline reached'))).toBe(false);
  });

  it('never starts an action whose charged steps would pass the 60-action limit (multi-step action at 57)', async () => {
    addProfile(1, 10);
    const chain: PlannedAction = {
      kind: 'robot_chain',
      slotIndex: 2,
      steps: [
        { kind: 'facility_upgrade', facilityType: 'roster_expansion', toLevel: 1, cost: 1 },
        { kind: 'facility_upgrade', facilityType: 'storage_facility', toLevel: 1, cost: 1 },
        { kind: 'robot_purchase', robotName: 'Two', cost: 1 },
        { kind: 'fitout', stageIndex: 0, loadoutType: 'single', equip: [], purchases: [{ weaponName: 'Practice Blade', hand: 'main', cost: 1 }] },
      ],
    };
    expect(chargedStepCount(chain)).toBe(4);
    script = (facts) => (facts.facilities.training_facility < 57 ? actionable(facilityAction(facts.facilities.training_facility + 1)) : actionable(chain));

    const summary = await runTurnStep(INPUT, sequential());

    expect(mockExecute).toHaveBeenCalledTimes(57);
    expect(mockExecute.mock.calls.every((call) => call[0].kind === 'facility_upgrade')).toBe(true);
    const [row] = turnsOf(1);
    expect(row).toMatchObject({ status: 'completed', reason: TURN_BUDGET_EXHAUSTED, creditsSpent: 57 * STEP_COST });
    expect(row.actions).toHaveLength(57);
    expect(57 + chargedStepCount(chain)).toBeGreaterThan(TURN_ACTION_LIMIT);
    expect(summary.saving).toBe(0);
  });

  it('stops at exactly 60 single-step actions', async () => {
    addProfile(1, 10);
    script = buyUntil(100);

    await runTurnStep(INPUT, sequential());

    expect(mockExecute).toHaveBeenCalledTimes(TURN_ACTION_LIMIT);
    expect(turnsOf(1)[0]).toMatchObject({ status: 'completed', reason: TURN_BUDGET_EXHAUSTED });
  });
});

describe('runTurnStep — failures (R6.6, R7.8, R11.8)', () => {
  it('records a throwing Automaton failed with its code, keeps its committed actions, alerts, and continues', async () => {
    addProfile(1, 10);
    addProfile(2, 20);
    script = buyUntil(3);
    let calls = 0;
    mockExecute.mockImplementation((action, goalId, facts, ctx, cursor) => {
      if (facts.profileId === 1 && ++calls === 2) {
        return Promise.reject(new EconomyError(EconomyErrorCode.INSUFFICIENT_CREDITS, 'Insufficient credits', 400));
      }
      return executeScripted(action, goalId, facts, ctx, cursor);
    });

    const summary = await runTurnStep(INPUT, sequential());

    expect(summary).toMatchObject({ completed: 1, failed: 1 });
    expect(turnsOf(1)[0]).toMatchObject({ status: 'failed', reason: 'INSUFFICIENT_CREDITS', creditsSpent: STEP_COST });
    expect(turnsOf(1)[0].actions).toHaveLength(1);
    expect(turnsOf(2)[0]).toMatchObject({ status: 'completed', creditsSpent: 3 * STEP_COST });
    expect(alerts.filter((a) => a.includes('Automaton turn failed'))).toHaveLength(1);
    expect(alerts[0]).toContain('stable-1');
    expect(alerts[0]).toContain('INSUFFICIENT_CREDITS');
  });

  it('fails a turn with AUTOMATON_WEAPON_UNKNOWN when a blueprint names a weapon missing from the catalogue', async () => {
    addProfile(1, 10);
    script = () => {
      throw new AutomatonError(AutomatonErrorCode.AUTOMATON_WEAPON_UNKNOWN, 'Weapon "Ghost Blade" is not in the weapon catalogue', 500);
    };

    const summary = await runTurnStep(INPUT, sequential());

    expect(summary.failed).toBe(1);
    expect(turnsOf(1)[0]).toMatchObject({ status: 'failed', reason: 'AUTOMATON_WEAPON_UNKNOWN' });
    expect(alerts.some((a) => a.includes('AUTOMATON_WEAPON_UNKNOWN') && a.includes('Ghost Blade'))).toBe(true);
  });

  it('ends invalid_parameters with an alert when the pinned Strategy_Version has no file (no migration)', async () => {
    addProfile(1, 10, { strategyVersion: 2 });

    await runTurnStep(INPUT, sequential());

    expect(turnsOf(1)[0]).toMatchObject({ status: 'failed', reason: 'invalid_parameters', strategyVersion: 2 });
    expect(mockLoadFacts).not.toHaveBeenCalled();
    expect(alerts.some((a) => a.includes('strategy parameters invalid') && a.includes('fixture.v2'))).toBe(true);
  });

  it('ends invalid_parameters when the stored Goal_Targets fail the pinned version', async () => {
    addProfile(1, 10, { strategyParameters: { targets: { [GOAL_ID]: 11 } } });

    await runTurnStep(INPUT, sequential());

    expect(turnsOf(1)[0]).toMatchObject({ status: 'failed', reason: 'invalid_parameters' });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('fails AUTOMATON_PROFILE_INVALID on a malformed Event_Order', async () => {
    addProfile(1, 10, { eventOrder: ['not_an_event'] });

    await runTurnStep(INPUT, sequential());

    expect(turnsOf(1)[0]).toMatchObject({ status: 'failed', reason: 'AUTOMATON_PROFILE_INVALID' });
  });

  it('fails AUTOMATON_NO_PROGRESS instead of looping when an action changes nothing', async () => {
    addProfile(1, 10);
    script = () => actionable({ kind: 'weapon_stage', robotSlot: 1, toStage: 1, steps: [] });
    mockExecute.mockImplementation(async (_action, _goalId, facts) => ({ facts, upkeepIssues: [] }));

    await runTurnStep(INPUT, sequential());

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(turnsOf(1)[0]).toMatchObject({ status: 'failed', reason: 'AUTOMATON_NO_PROGRESS' });
  });

  it('runs upkeep but buys nothing on a negative start balance, and alerts', async () => {
    addProfile(1, 10, { currency: -5_000 });
    script = (facts) => (facts.balance >= STEP_COST ? actionable(facilityAction(1)) : saving);

    await runTurnStep(INPUT, sequential());

    expect(mockUpkeep).toHaveBeenCalledTimes(2);
    expect(mockExecute).not.toHaveBeenCalled();
    expect(turnsOf(1)[0]).toMatchObject({ status: 'completed', startBalance: -5_000, endBalance: -5_000 });
    expect(alerts.some((a) => a.includes('balance negative at turn start') && a.includes('stable-1'))).toBe(true);
  });

  it('records Free_Upkeep issues once on the Turn_Record and alerts them', async () => {
    addProfile(1, 10);
    upkeepIssues.set(1, [{ part: 'teams', code: 'AUTOMATON_TEAM_NAME_MISSING', message: 'No Team_Names entry for 2v2 team 1', teamSize: 2, teamIndex: 0 }]);

    await runTurnStep(INPUT, sequential());

    // Start and end upkeep both report it; the record keeps one.
    expect(turnsOf(1)[0].upkeepIssues).toEqual([
      { part: 'teams', code: 'AUTOMATON_TEAM_NAME_MISSING', message: 'No Team_Names entry for 2v2 team 1', teamSize: 2, teamIndex: 0 },
    ]);
    expect(turnsOf(1)[0].status).toBe('completed');
    expect(alerts.filter((a) => a.includes('upkeep issue') && a.includes('AUTOMATON_TEAM_NAME_MISSING'))).toHaveLength(1);
  });

  it('alerts once when the same Goal has been Saving for more than 14 consecutive turns', async () => {
    addProfile(1, 10);
    const savingOutcome = [{ goalId: GOAL_ID, kind: 'saving', cost: 1, detail: {} }];
    for (let slot = 1; slot <= 14; slot++) {
      seedTurn({ profileId: 1, seasonNumber: 3, trigger: 'settlement', slot, goalOutcomes: savingOutcome });
    }

    await runTurnStep(INPUT, sequential());
    expect(alerts.filter((a) => a.includes('saving for the same goal'))).toHaveLength(1);
    expect(alerts.find((a) => a.includes('saving for the same goal'))).toContain('15 consecutive turns');

    await runTurnStep({ ...INPUT, slot: 43 }, sequential());
    expect(alerts.filter((a) => a.includes('saving for the same goal'))).toHaveLength(1);
  });

  it('does not alert for a Saving run of 14 turns', async () => {
    addProfile(1, 10);
    for (let slot = 1; slot <= 13; slot++) {
      seedTurn({ profileId: 1, seasonNumber: 3, trigger: 'settlement', slot, goalOutcomes: [{ goalId: GOAL_ID, kind: 'saving', cost: 1, detail: {} }] });
    }
    await runTurnStep(INPUT, sequential());
    expect(alerts.some((a) => a.includes('saving for the same goal'))).toBe(false);
  });
});

describe('cutover guard (R7.5)', () => {
  it('refuses to run during a Serialized_Cycle_Cutover and claims nothing', async () => {
    addProfile(1, 10);
    mockIdentity.mockResolvedValue({
      activeCycle: 43, completedCycles: 42, seasonNumber: 3, phase: 'competitive', competitiveCyclesCompleted: 12,
      preparationCyclesCompleted: 0, seasonStartedAt: new Date(0), isClosing: true, closingCycle: 43,
    });

    await expect(runTurnStep(INPUT, sequential())).rejects.toMatchObject({ code: 'AUTOMATON_CUTOVER_IN_PROGRESS' });
    expect(fakeDb.turns).toHaveLength(0);
    expect(fakeDb.settings?.turnStepLeaseUntil).toBeNull();
  });

  it('runTurnStepNonFatal returns the failure and alerts instead of throwing', async () => {
    mockIdentity.mockRejectedValue(new Error('database unreachable'));

    const outcome = await runTurnStepNonFatal(INPUT, sequential());

    expect(outcome).toEqual({ ok: false, code: 'UNEXPECTED_ERROR', message: 'database unreachable' });
    expect(alerts.some((a) => a.includes('Turn_Step failed') && a.includes('season 3 cycle 42'))).toBe(true);
  });
});

/** Wait until `condition` holds, letting pending callbacks run (fails after `rounds`). */
async function until(condition: () => boolean, rounds = 200): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('condition not reached');
}

/** Executor whose turns block until the test opens their profile's gate; tracks turns in flight. */
function gatedExecutor(): { started: number[]; open: (profileId: number) => void; inFlight: () => number; peak: () => number } {
  const gates = new Map<number, () => void>();
  const waiting = new Map<number, Promise<void>>();
  const started: number[] = [];
  let running = 0;
  let peak = 0;
  const gateOf = (profileId: number): Promise<void> => {
    let gate = waiting.get(profileId);
    if (!gate) {
      gate = new Promise<void>((resolve) => { gates.set(profileId, resolve); });
      waiting.set(profileId, gate);
    }
    return gate;
  };
  mockExecute.mockImplementation(async (action, goalId, facts, ctx, cursor) => {
    started.push(facts.profileId);
    running++;
    peak = Math.max(peak, running);
    try {
      await gateOf(facts.profileId);
      return await executeScripted(action, goalId, facts, ctx, cursor);
    } finally {
      running--;
    }
  });
  return {
    started,
    open: (profileId) => {
      void gateOf(profileId);
      gates.get(profileId)?.();
    },
    inFlight: () => running,
    peak: () => peak,
  };
}

describe('runTurnStep — bounded concurrency', () => {
  it('runs at most N turns at once, starts them in ascending User.id order, one Turn_Record each', async () => {
    addProfile(1, 40);
    addProfile(2, 10);
    addProfile(3, 30);
    addProfile(4, 20);
    script = buyUntil(1);
    const gate = gatedExecutor();

    const step = runTurnStep(INPUT, { registry, concurrency: 2, nextScheduledJobAt: () => null });
    await until(() => gate.started.length === 2);
    // Users 10 and 20 first; nothing else starts while both are in flight.
    expect(gate.started).toEqual([2, 4]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(gate.started).toEqual([2, 4]);
    expect(fakeDb.turns.map((t) => t.profileId)).toEqual([2, 4]);

    gate.open(4);
    await until(() => gate.started.length === 3);
    expect(gate.started).toEqual([2, 4, 3]);
    gate.open(2);
    gate.open(3);
    gate.open(1);
    const summary = await step;

    expect(gate.started).toEqual([2, 4, 3, 1]);
    expect(gate.peak()).toBe(2);
    // Claims (Turn_Record ids) follow the start order.
    expect([...fakeDb.turns].sort((a, b) => a.id - b.id).map((t) => t.profileId)).toEqual([2, 4, 3, 1]);
    for (const profileId of [1, 2, 3, 4]) {
      expect(turnsOf(profileId)).toHaveLength(1);
      expect(turnsOf(profileId)[0]).toMatchObject({ status: 'completed', attempt: 1, creditsSpent: STEP_COST });
    }
    expect(summary).toMatchObject({
      processed: 4, completed: 4, failed: 0, skipped: {}, alreadyFinal: 0, saving: 4,
      creditsSpent: 4 * STEP_COST, concurrency: 2, leaseLost: false,
    });
    expect(summary.actionsByKind).toEqual({ facility_upgrade: 4 });
    expect(fakeDb.settings?.turnStepLeaseUntil).toBeNull();
  });

  it('clamps the requested concurrency to the pool (poolMax 7 → 1)', async () => {
    addProfile(1, 10);
    addProfile(2, 20);
    addProfile(3, 30);
    script = buyUntil(1);
    const gate = gatedExecutor();

    const step = runTurnStep(INPUT, { registry, concurrency: 3, poolMax: 7, nextScheduledJobAt: () => null });
    await until(() => gate.started.length === 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(gate.started).toEqual([1]);
    gate.open(1);
    await until(() => gate.started.length === 2);
    gate.open(2);
    gate.open(3);
    const summary = await step;

    expect(summary.concurrency).toBe(1);
    expect(gate.peak()).toBe(1);
    expect(summary.completed).toBe(3);
  });

  it('a claim that throws stops new starts, lets in-flight turns finish, and fails the step', async () => {
    addProfile(1, 10);
    addProfile(2, 20);
    addProfile(3, 30);
    addProfile(4, 40);
    script = buyUntil(1);
    const gate = gatedExecutor();
    const realCreateMany = fakePrisma.automatonTurn.createMany;
    const claimSpy = jest.spyOn(fakePrisma.automatonTurn, 'createMany').mockImplementation(async (args) => {
      if (args.data[0]?.profileId === 2) throw new Error('claim insert failed');
      return realCreateMany(args);
    });
    try {
      let settled = false;
      const step = runTurnStep(INPUT, { registry, concurrency: 2, nextScheduledJobAt: () => null });
      const outcome = step.then(() => 'resolved', (error: unknown) => error).finally(() => { settled = true; });
      await until(() => gate.started.length === 1);
      await new Promise((resolve) => setTimeout(resolve, 10));
      // Profile 2's claim failed; profile 1 is still in flight; 3 and 4 never start.
      expect(settled).toBe(false);
      expect(gate.started).toEqual([1]);
      gate.open(1);

      expect(await outcome).toMatchObject({ message: 'claim insert failed' });
      expect(turnsOf(1)[0]).toMatchObject({ status: 'completed' });
      expect(turnsOf(2)).toHaveLength(0);
      expect(turnsOf(3)).toHaveLength(0);
      expect(turnsOf(4)).toHaveLength(0);
      expect(fakeDb.settings?.turnStepLeaseUntil).toBeNull();

      mockExecute.mockImplementation(executeScripted);
      const nonFatal = await runTurnStepNonFatal({ ...INPUT, slot: 43 }, { registry, concurrency: 2, nextScheduledJobAt: () => null });
      expect(nonFatal).toEqual({ ok: false, code: 'UNEXPECTED_ERROR', message: 'claim insert failed' });
      expect(alerts.some((a) => a.includes('Turn_Step failed') && a.includes('claim insert failed'))).toBe(true);
    } finally {
      claimSpy.mockRestore();
    }
  });
});

describe('runTurnStep — mid-step cutover and lost lease', () => {
  const closing = {
    activeCycle: 43, completedCycles: 42, seasonNumber: 3, phase: 'competitive' as const, competitiveCyclesCompleted: 12,
    preparationCyclesCompleted: 0, seasonStartedAt: new Date(0), isClosing: true, closingCycle: 43,
  };
  const open = { ...closing, isClosing: false, closingCycle: null };

  it('records the remaining stables cutover_in_progress once a cutover starts mid-step, alerts, and resolves', async () => {
    addProfile(1, 10);
    addProfile(2, 20);
    addProfile(3, 30);
    // Step start, after the lease, before stable 1: open; from stable 2: closing.
    mockIdentity.mockReset();
    mockIdentity.mockResolvedValueOnce(open).mockResolvedValueOnce(open).mockResolvedValueOnce(open).mockResolvedValue(closing);

    const summary = await runTurnStep(INPUT, sequential());

    expect(summary).toMatchObject({ processed: 3, completed: 1, skipped: { [CUTOVER_IN_PROGRESS]: 2 }, budgetExhausted: false });
    expect(turnsOf(1)[0]).toMatchObject({ status: 'completed' });
    expect(turnsOf(2)[0]).toMatchObject({ status: 'skipped', reason: CUTOVER_IN_PROGRESS });
    expect(turnsOf(3)[0]).toMatchObject({ status: 'skipped', reason: CUTOVER_IN_PROGRESS });
    // Once seen, the cutover sticks: stable 3 does not re-read the identity.
    expect(mockIdentity).toHaveBeenCalledTimes(4);
    const cutoverAlerts = alerts.filter((a) => a.includes('Turn_Step failed') && a.includes('AUTOMATON_CUTOVER_IN_PROGRESS'));
    expect(cutoverAlerts).toHaveLength(1);
    expect(cutoverAlerts[0]).toContain('2 stable(s) skipped (cutover_in_progress)');
    expect(fakeDb.settings?.turnStepLeaseUntil).toBeNull();
  });

  it('starts no further stables after the lease is lost, leaves them unclaimed, and alerts', async () => {
    addProfile(1, 10);
    addProfile(2, 20);
    addProfile(3, 30);
    const other = new Date(Date.now() + 999_000);
    mockLoadFacts.mockImplementation(async (_db, profileId) => {
      if (profileId === 1) {
        // Another caller takes the lease over while stable 1 runs; the next renewal notices.
        if (fakeDb.settings) fakeDb.settings.turnStepLeaseUntil = other;
        await sleep(30);
      }
      return factsByProfile.get(profileId) as StableFacts;
    });

    const summary = await runTurnStep(INPUT, sequential({ leaseRenewMs: 5 }));

    expect(summary).toMatchObject({ processed: 3, completed: 1, leaseLost: true, skipped: {} });
    expect(turnsOf(1)[0]).toMatchObject({ status: 'completed' });
    expect(turnsOf(2)).toHaveLength(0);
    expect(turnsOf(3)).toHaveLength(0);
    expect(alerts.some((a) => a.includes('Turn_Step failed') && a.includes(TURN_STEP_LEASE_LOST) && a.includes('2 stable(s) not started'))).toBe(true);
    // The other holder's lease is untouched.
    expect(fakeDb.settings?.turnStepLeaseUntil).toEqual(other);
  });

  it('raises both the cutover and the lease-lost alert when a cutover is followed by a lost lease', async () => {
    addProfile(1, 10);
    addProfile(2, 20);
    addProfile(3, 30);
    const other = new Date(Date.now() + 999_000);
    // Step start, after the lease, stable 1: open. Stable 2 sees the cutover while
    // another caller takes the lease over; stable 3 then finds the lease lost.
    mockIdentity.mockReset();
    mockIdentity
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce(open)
      .mockImplementationOnce(async () => {
        if (fakeDb.settings) fakeDb.settings.turnStepLeaseUntil = other;
        await sleep(30);
        return closing;
      })
      .mockResolvedValue(closing);

    const summary = await runTurnStep(INPUT, sequential({ leaseRenewMs: 5 }));

    expect(summary).toMatchObject({ processed: 3, completed: 1, leaseLost: true, skipped: { [CUTOVER_IN_PROGRESS]: 1 } });
    expect(turnsOf(2)[0]).toMatchObject({ status: 'skipped', reason: CUTOVER_IN_PROGRESS });
    expect(turnsOf(3)).toHaveLength(0);
    const cutoverAlerts = alerts.filter((a) => a.includes('Turn_Step failed') && a.includes('AUTOMATON_CUTOVER_IN_PROGRESS'));
    expect(cutoverAlerts).toHaveLength(1);
    expect(cutoverAlerts[0]).toContain('1 stable(s) skipped (cutover_in_progress)');
    expect(alerts.some((a) => a.includes('Turn_Step failed') && a.includes(TURN_STEP_LEASE_LOST) && a.includes('1 stable(s) not started'))).toBe(true);
  });
});

describe('withTurnStepLease (design §11.1)', () => {
  it('serialises two callers: the second starts after the first releases', async () => {
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const first = withTurnStepLease(async () => {
      order.push('first:start');
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
      order.push('first:end');
    }, { leasePollMs: 2 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = withTurnStepLease(async () => { order.push('second:start'); }, { leasePollMs: 2 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(order).toEqual(['first:start']);
    releaseFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(['first:start', 'first:end', 'second:start']);
    expect(fakeDb.settings?.turnStepLeaseUntil).toBeNull();
  });

  it('takes over an expired lease of a crashed holder', async () => {
    let clock = 1_000_000;
    if (fakeDb.settings) fakeDb.settings.turnStepLeaseUntil = new Date(clock + 5_000);
    const ran = jest.fn(async () => 'done');

    const result = await withTurnStepLease(ran, { now: () => (clock += 3_000), leasePollMs: 0 });

    expect(result).toBe('done');
    expect(ran).toHaveBeenCalledTimes(1);
    expect(fakeDb.settings?.turnStepLeaseUntil).toBeNull();
  });

  it('releases the lease when the step throws', async () => {
    await expect(withTurnStepLease(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(fakeDb.settings?.turnStepLeaseUntil).toBeNull();
  });

  it('claims the lease for TURN_STEP_LEASE_TTL_MS, not for the step budget', async () => {
    const clock = 5_000_000;
    let held: Date | null | undefined;
    await withTurnStepLease(async () => { held = fakeDb.settings?.turnStepLeaseUntil; }, { now: () => clock });
    expect(TURN_STEP_LEASE_TTL_MS).toBe(120_000);
    expect(TURN_STEP_LEASE_RENEW_MS).toBe(30_000);
    expect(held?.getTime()).toBe(clock + TURN_STEP_LEASE_TTL_MS);
  });

  it('renews the lease while the step runs (heartbeat)', async () => {
    let first: number | undefined;
    let later: number | undefined;
    let lost: boolean | undefined;
    await withTurnStepLease(async (lease) => {
      first = fakeDb.settings?.turnStepLeaseUntil?.getTime();
      await sleep(40);
      later = fakeDb.settings?.turnStepLeaseUntil?.getTime();
      lost = lease.lost;
    }, { leaseRenewMs: 5 });

    expect(first).toBeDefined();
    expect(later).toBeGreaterThan(first as number);
    expect(lost).toBe(false);
    expect(fakeDb.settings?.turnStepLeaseUntil).toBeNull();
  });

  it('marks the lease lost when another caller took it over and never clears that caller\'s lease', async () => {
    const other = new Date(Date.now() + 999_000);
    let lostDuring: boolean | undefined;
    await withTurnStepLease(async (lease) => {
      expect(lease.lost).toBe(false);
      // Our lease expired and another caller claimed it.
      if (fakeDb.settings) fakeDb.settings.turnStepLeaseUntil = other;
      await sleep(30);
      lostDuring = lease.lost;
    }, { leaseRenewMs: 5 });

    expect(lostDuring).toBe(true);
    expect(fakeDb.settings?.turnStepLeaseUntil).toEqual(other);
    expect(mockLoggerError.mock.calls.some(([message]) => String(message).includes('Turn_Step lease lost'))).toBe(true);
  });

  it('retries a renewal that throws at the next tick instead of marking the lease lost', async () => {
    const original = fakePrisma.$executeRaw;
    const rawSpy = jest.spyOn(fakePrisma, '$executeRaw');
    let failures = 0;
    rawSpy.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (!sql.includes('IS NULL OR') && !sql.includes('= NULL') && failures === 0) {
        failures++;
        throw new Error('connection reset');
      }
      return original.call(fakePrisma, strings, ...values);
    });
    try {
      let first: number | undefined;
      let later: number | undefined;
      let lost: boolean | undefined;
      await withTurnStepLease(async (lease) => {
        first = fakeDb.settings?.turnStepLeaseUntil?.getTime();
        await sleep(40);
        later = fakeDb.settings?.turnStepLeaseUntil?.getTime();
        lost = lease.lost;
      }, { leaseRenewMs: 5 });

      expect(failures).toBe(1);
      expect(lost).toBe(false);
      expect(later).toBeGreaterThan(first as number);
      expect(mockLoggerError.mock.calls.some(([message]) => String(message).includes('lease renewal failed'))).toBe(true);
      expect(fakeDb.settings?.turnStepLeaseUntil).toBeNull();
    } finally {
      rawSpy.mockRestore();
    }
  });
});
