/**
 * Turn runner (Spec #55, R2.7, R5.11, R6.6, R7.5–R7.9, R11.7, R11.8,
 * design §5.2, §11.1, §11.2, task 6.2; R7.10's fixed 300 s Turn_Step budget
 * is superseded by the turn-budget plan "DESIGN (Part B)" D1–D5).
 *
 * `runTurnStep` runs one Automaton_Turn for every Active_Automaton of one
 * Turn_Trigger and Turn_Slot:
 * - never while a Serialized_Cycle_Cutover is in progress (R7.5): checked at
 *   the start and again before each stable; a cutover seen mid-step records
 *   the remaining stables `skipped` / `cutover_in_progress` and alerts;
 * - under the Turn_Step lease (`withTurnStepLease`, a 120 s heartbeat lease
 *   renewed every 30 s), so a scheduler step and an admin bulk cycle run one
 *   after the other, across processes; a lost lease starts no further stables;
 * - over a cohort fixed at the start; turns START in ascending `User.id`
 *   order (R7.9), at most `effectiveTurnConcurrency` at once
 *   (AUTOMATON_TURN_CONCURRENCY clamped to the pg pool);
 * - until the Turn_Step deadline (`resolveTurnStepDeadline`: the next
 *   scheduled job minus a margin, capped, never under 300 s); stables not
 *   started by then are recorded `skipped` / `step_budget_exhausted` and one
 *   "Turn_Step deadline reached" alert is raised;
 * - one Turn_Record per profile and key (`claimTurnRecord`, R7.6);
 * - Program_Switch off: every due turn `skipped` / `program_off`, nothing
 *   upkept or bought (R2.7);
 * - one failing Automaton is recorded `failed` with its error code and an
 *   alert, and the others continue (R7.8).
 *
 * `runAutomatonTurn` is one stable's turn (design §11.2): the pinned
 * Strategy_Version and its stored Goal_Targets (a missing version or invalid
 * targets end the turn `failed` / `invalid_parameters` with an alert; no
 * automatic migration, R6.6), facts, Free_Upkeep, the planner loop under the
 * Turn_Budget (an action starts only when all its charged steps fit,
 * `checkTurnBudget(…, chargedStepCount(action))`), Free_Upkeep again, and the
 * completed Turn_Record. Committed actions are kept when a turn fails (R7.8).
 *
 * `runTurnStepNonFatal` is what the settlement, rollover and admin bulk call
 * sites use: it never throws (R7.8, design §11.3).
 */
import { z } from 'zod';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { AppError } from '../../errors/AppError';
import { AutomatonError, AutomatonErrorCode } from '../../errors/automatonErrors';
import { getConfig } from '../../config/env';
import { resolveDbPoolMax } from '../../lib/dbPoolConfig';
import { resolveCanonicalCycleIdentity } from '../cycle/canonicalCycleIdentity';
import { nextScheduledJobRunAt } from '../cycle/schedulerWindow';
import { SUBSCRIBABLE_EVENT_TYPES } from '../subscription/eventRegistry';
import type { AutomatonTurnTrigger, Prisma } from '../../../generated/prisma';
import type { EventOrder, StrategyParametersV1, TeamNames } from '../../types/automaton';
import { createExecutionCursor, executeAction, type ExecutionContext } from './actionExecutor';
import { chargedStepCount } from './factProjector';
import { planNextStep, type PlanResult } from './turnPlanner';
import {
  checkTurnBudget,
  effectiveTurnConcurrency,
  isStepDeadlineReached,
  resolveTurnStepDeadline,
  STEP_BUDGET_EXHAUSTED,
  TURN_BUDGET_EXHAUSTED,
  type TurnStepDeadline,
} from './turnBudget';
import { runWithConcurrency } from './turnStepPool';
import { loadBlueprintFacts, loadStableFacts, loadWeaponCatalogue, type StableFacts, type WeaponFacts } from './stableFacts';
import { runFreeUpkeep, type FreeUpkeepIssue } from './upkeep/freeUpkeep';
import { ensureProgramSettings, isProgramEnabled, PROGRAM_SETTINGS_ID } from './programSwitch';
import type { StrategyRegistry } from './strategies/registry';
import { getStrategyRegistry } from './strategies/defaultRegistry';
import {
  alertInvalidParameters,
  alertNegativeBalance,
  alertSavingStreak,
  alertStepBudgetExhausted,
  alertTurnFailed,
  alertTurnStepFailed,
  alertUpkeepIssues,
  emptyTurnStepSummary,
  logTurnStepSummary,
  truncate,
  type TurnLabel,
  type TurnStepSummary,
} from './automatonObservability';
import {
  claimTurnRecord,
  CUTOVER_IN_PROGRESS,
  finishTurnRecord,
  INVALID_PARAMETERS,
  markTurnFailed,
  markTurnSkipped,
  PROGRAM_OFF,
  recordStartBalance,
  SAVING_ALERT_TURNS,
  savingStreakLength,
  toActionRecords,
  toGoalOutcomeRecords,
  toUpkeepIssueRecords,
  type ClaimedTurnRecord,
  type TurnRecordClaimInput,
} from './turnRecords';

export {
  TURN_ACTION_LIMIT,
  TURN_TIME_BUDGET_MS,
  TURN_STEP_MIN_BUDGET_MS,
  TURN_BUDGET_EXHAUSTED,
  STEP_BUDGET_EXHAUSTED,
} from './turnBudget';
export { claimTurnRecord, CUTOVER_IN_PROGRESS, PROGRAM_OFF, INVALID_PARAMETERS } from './turnRecords';
export type { TurnStepSummary } from './automatonObservability';

/** Error code of the alert raised when a running Turn_Step lost its lease (plan D2). */
export const TURN_STEP_LEASE_LOST = 'TURN_STEP_LEASE_LOST';

/**
 * Lifetime of one Turn_Step lease claim or renewal: a crashed holder blocks
 * other callers for at most this long (turn-budget plan D2).
 */
export const TURN_STEP_LEASE_TTL_MS = 120_000;
/** How often the holder renews its lease while the step runs (plan D2). */
export const TURN_STEP_LEASE_RENEW_MS = 30_000;
/** How often a waiting caller retries the lease (design §11.1). */
export const TURN_STEP_LEASE_POLL_MS = 1_000;

/** What the step sees of its lease while it runs. */
export interface TurnStepLease {
  /** True once a renewal found the lease taken over; start no further turns. */
  readonly lost: boolean;
}

export type TurnStepSource = TurnStepSummary['source'];

export interface TurnStepInput extends TurnLabel {
  source: TurnStepSource;
}

/** Injectable dependencies (tests); production uses the defaults. */
export interface TurnStepDependencies {
  /** Strategy_Registry; the repository strategies with the approved Build_Focus weights by default. */
  registry?: StrategyRegistry;
  /** Clock in ms; `Date.now` by default. */
  now?: () => number;
  /** Lease poll interval; TURN_STEP_LEASE_POLL_MS by default. */
  leasePollMs?: number;
  /** Lease lifetime per claim or renewal; TURN_STEP_LEASE_TTL_MS by default. */
  leaseTtlMs?: number;
  /** Lease renewal interval; TURN_STEP_LEASE_RENEW_MS by default. */
  leaseRenewMs?: number;
  /** Requested parallel turns; AUTOMATON_TURN_CONCURRENCY by default (always clamped to the pool). */
  concurrency?: number;
  /** pg pool size the concurrency is clamped to; DB_POOL_MAX (`resolveDbPoolMax`) by default. */
  poolMax?: number;
  /** Deadline cap from the step start (ms); AUTOMATON_TURN_STEP_MAX_MS by default. */
  maxMs?: number;
  /** Stop this long before the next scheduled job (ms); AUTOMATON_TURN_STEP_SCHEDULE_MARGIN_MS by default. */
  scheduleMarginMs?: number;
  /**
   * Epoch ms of the next scheduled cycle-scheduler job after `nowMs`, or
   * null when none is known; `nextScheduledJobRunAt(getConfig(), nowMs)` by default.
   */
  nextScheduledJobAt?: (nowMs: number) => number | null;
  /**
   * Tests on a shared database: which Active_Automatons of the cohort take
   * part (default: all), so a test never runs turns for stables it did not
   * create. Applied to the cohort read at the start (R7.9).
   */
  cohortFilter?: (profile: CohortProfile) => boolean;
}

// ─── Strategy_Registry ───────────────────────────────────────────────

export { getStrategyRegistry };

// ─── Errors ──────────────────────────────────────────────────────────

/** Error code recorded on a failed Turn_Record. */
export function errorCodeOf(error: unknown): string {
  if (error instanceof AppError) return error.code;
  return 'UNEXPECTED_ERROR';
}

function errorMessageOf(error: unknown): string {
  return truncate(error instanceof Error ? error.message : String(error));
}

// ─── Cutover guard and lease ─────────────────────────────────────────

/**
 * Refuse to run while a Serialized_Cycle_Cutover is in progress (R7.5).
 * Defensive: every call site already runs after `completeSerializedCycleCutover`.
 * Returns the season phase the identity reports.
 */
export async function assertNoCutoverInProgress(): Promise<StableFacts['phase']> {
  const identity = await resolveCanonicalCycleIdentity();
  if (identity.isClosing) {
    throw new AutomatonError(
      AutomatonErrorCode.AUTOMATON_CUTOVER_IN_PROGRESS,
      `Cycle ${identity.closingCycle ?? identity.activeCycle} is closing; Automaton turns wait for the cutover to finish`,
      409,
    );
  }
  return identity.phase;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn` while holding the Turn_Step lease (`automaton_program_settings.
 * turnStepLeaseUntil`, design §11.1, heartbeat per turn-budget plan D2).
 *
 * One conditional update claims it for TURN_STEP_LEASE_TTL_MS when it is
 * empty or expired (a crashed holder's lease is taken over); otherwise the
 * caller polls. While `fn` runs, the holder renews it every
 * TURN_STEP_LEASE_RENEW_MS with an update that matches only its own value.
 * A renewal that matches no row means another caller took the lease over:
 * `lease.lost` turns true and renewing stops. A renewal that throws is logged
 * and retried at the next tick. The lease is cleared in `finally`, only if
 * still ours. Raw parameterised SQL keeps the switch's `updatedAt` for switch
 * changes.
 */
export async function withTurnStepLease<T>(fn: (lease: TurnStepLease) => Promise<T>, deps: TurnStepDependencies = {}): Promise<T> {
  const now = deps.now ?? Date.now;
  const pollMs = deps.leasePollMs ?? TURN_STEP_LEASE_POLL_MS;
  const ttlMs = deps.leaseTtlMs ?? TURN_STEP_LEASE_TTL_MS;
  await ensureProgramSettings();
  for (;;) {
    const current = new Date(now());
    const until = new Date(current.getTime() + ttlMs);
    const claimed = await prisma.$executeRaw`
      UPDATE "automaton_program_settings"
      SET "turn_step_lease_until" = ${until}
      WHERE "id" = ${PROGRAM_SETTINGS_ID}
        AND ("turn_step_lease_until" IS NULL OR "turn_step_lease_until" < ${current})`;
    if (claimed === 1) return holdTurnStepLease(fn, until, deps);
    await sleep(pollMs);
  }
}

/** Run `fn` under a claimed lease (value `claimedUntil`), renewing it until `fn` settles. */
async function holdTurnStepLease<T>(
  fn: (lease: TurnStepLease) => Promise<T>,
  claimedUntil: Date,
  deps: TurnStepDependencies,
): Promise<T> {
  const now = deps.now ?? Date.now;
  const ttlMs = deps.leaseTtlMs ?? TURN_STEP_LEASE_TTL_MS;
  const renewMs = deps.leaseRenewMs ?? TURN_STEP_LEASE_RENEW_MS;
  const state: { current: Date; lost: boolean; renewal: Promise<void> | null } = { current: claimedUntil, lost: false, renewal: null };
  const lease: TurnStepLease = {
    get lost(): boolean {
      return state.lost;
    },
  };

  const renew = async (): Promise<void> => {
    const next = new Date(now() + ttlMs);
    try {
      const renewed = await prisma.$executeRaw`
        UPDATE "automaton_program_settings"
        SET "turn_step_lease_until" = ${next}
        WHERE "id" = ${PROGRAM_SETTINGS_ID} AND "turn_step_lease_until" = ${state.current}`;
      if (renewed === 1) {
        state.current = next;
        return;
      }
      state.lost = true;
      clearInterval(timer);
      logger.error('[automaton-turns] Turn_Step lease lost: another caller took it over; no further turns start');
    } catch (error) {
      // Not lost: the lease is still ours until it expires; retry at the next tick.
      logger.error(`[automaton-turns] Turn_Step lease renewal failed, retrying — ${errorMessageOf(error)}`);
    }
  };

  const timer = setInterval(() => {
    // Never overlap renewals: each one compares against the value the previous one wrote.
    if (state.lost || state.renewal !== null) return;
    state.renewal = renew().finally(() => {
      state.renewal = null;
    });
  }, renewMs);
  timer.unref();

  try {
    return await fn(lease);
  } finally {
    clearInterval(timer);
    if (state.renewal !== null) await state.renewal;
    if (!state.lost) {
      await prisma.$executeRaw`
        UPDATE "automaton_program_settings"
        SET "turn_step_lease_until" = NULL
        WHERE "id" = ${PROGRAM_SETTINGS_ID} AND "turn_step_lease_until" = ${state.current}`;
    }
  }
}

// ─── Cohort ──────────────────────────────────────────────────────────

/** One Active_Automaton of the fixed cohort. */
export interface CohortProfile {
  profileId: number;
  userId: number;
  catalogueKey: string;
  strategyKey: string;
  strategyVersion: number;
  strategyParameters: Prisma.JsonValue;
  teamNames: Prisma.JsonValue;
  eventOrder: Prisma.JsonValue;
  /** Balance when the cohort was read. */
  balance: number;
}

/** Active_Automatons in ascending `User.id` order (R7.9). */
export async function listActiveProfilesOrderedByUserId(): Promise<CohortProfile[]> {
  const rows = await prisma.automatonProfile.findMany({
    where: { status: 'active', userId: { not: null } },
    select: {
      id: true,
      userId: true,
      catalogueKey: true,
      strategyKey: true,
      strategyVersion: true,
      strategyParameters: true,
      teamNames: true,
      eventOrder: true,
      user: { select: { currency: true } },
    },
    orderBy: { userId: 'asc' },
  });
  return rows.flatMap((row) => (row.userId === null || row.user === null ? [] : [{
    profileId: row.id,
    userId: row.userId,
    catalogueKey: row.catalogueKey,
    strategyKey: row.strategyKey,
    strategyVersion: row.strategyVersion,
    strategyParameters: row.strategyParameters,
    teamNames: row.teamNames,
    eventOrder: row.eventOrder,
    balance: row.user.currency,
  }]));
}

// ─── One Automaton_Turn ──────────────────────────────────────────────

const teamNamesSchema = z.object({ twoVsTwo: z.array(z.string()), threeVsThree: z.array(z.string()) });
const eventOrderSchema = z.array(z.enum(SUBSCRIBABLE_EVENT_TYPES));

function parseProfileShapes(profile: CohortProfile): { teamNames: TeamNames; eventOrder: EventOrder } {
  const teamNames = teamNamesSchema.safeParse(profile.teamNames);
  const eventOrder = eventOrderSchema.safeParse(profile.eventOrder);
  if (!teamNames.success || !eventOrder.success) {
    throw new AutomatonError(
      AutomatonErrorCode.AUTOMATON_PROFILE_INVALID,
      `Stored ${teamNames.success ? 'Event_Order' : 'Team_Names'} of ${profile.catalogueKey} is invalid`,
      500,
    );
  }
  return { teamNames: teamNames.data as unknown as TeamNames, eventOrder: eventOrder.data as unknown as EventOrder };
}

export interface TurnEnvironment {
  registry: StrategyRegistry;
  weapons: ReadonlyMap<string, WeaponFacts>;
  phase: StableFacts['phase'];
  now: () => number;
}

export interface AutomatonTurnResult {
  status: 'completed' | 'failed';
  reason: string | null;
  creditsSpent: number;
  creditsReceived: number;
  actionsByKind: Record<string, number>;
  /** The Goal the turn ended Saving on. */
  savingGoalId: string | null;
  /** Blocked Goals in the final evaluation. */
  blocked: number;
}

type ResolvedStrategy =
  | { ok: true; strategy: NonNullable<ReturnType<StrategyRegistry['getStrategy']>>; params: StrategyParametersV1 }
  | { ok: false; detail: string };

function resolveStrategy(profile: CohortProfile, registry: StrategyRegistry): ResolvedStrategy {
  const label = `${profile.strategyKey}.v${profile.strategyVersion}`;
  const strategy = registry.getStrategy(profile.strategyKey, profile.strategyVersion);
  if (!strategy) return { ok: false, detail: `pinned Strategy_Version ${label} has no Strategy_Definition_File` };
  const parsed = strategy.parameterSchema.safeParse(profile.strategyParameters);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    return { ok: false, detail: `stored Goal_Targets fail ${label}: ${issues}` };
  }
  return { ok: true, strategy, params: parsed.data };
}

function countByKind(kinds: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const kind of kinds) counts[kind] = (counts[kind] ?? 0) + 1;
  return counts;
}

/**
 * One Automaton_Turn (design §11.2). Writes its own Turn_Record outcome and
 * alerts; throws only when that write itself fails.
 */
export async function runAutomatonTurn(
  profile: CohortProfile,
  record: Extract<ClaimedTurnRecord, { alreadyFinal: false }>,
  turn: TurnLabel,
  env: TurnEnvironment,
): Promise<AutomatonTurnResult> {
  const started = env.now();
  const empty: Omit<AutomatonTurnResult, 'status' | 'reason'> = {
    creditsSpent: 0, creditsReceived: 0, actionsByKind: {}, savingGoalId: null, blocked: 0,
  };

  // 1. Pinned Strategy_Version and stored Goal_Targets (R6.6).
  const resolved = resolveStrategy(profile, env.registry);
  if (!resolved.ok) {
    await finishTurnRecord(record.id, {
      status: 'failed', reason: INVALID_PARAMETERS, endBalance: profile.balance, creditsSpent: 0, creditsReceived: 0,
      actions: [], goalOutcomes: [], upkeepIssues: [], durationMs: env.now() - started,
    });
    await alertInvalidParameters(profile.catalogueKey, turn, resolved.detail);
    return { ...empty, status: 'failed', reason: INVALID_PARAMETERS };
  }
  const { strategy, params } = resolved;

  const cursor = createExecutionCursor();
  const issues: FreeUpkeepIssue[] = [];
  let facts: StableFacts;
  let lastPlan: PlanResult | null = null;
  let reason: string | null = null;

  try {
    const { teamNames, eventOrder } = parseProfileShapes(profile);
    const blueprints = await loadBlueprintFacts(prisma, profile.profileId);
    const season = { seasonNumber: turn.seasonNumber, phase: env.phase };

    // 2. Facts and start balance (R11.8: alert on a negative start).
    facts = await loadStableFacts(prisma, profile.profileId, { season, blueprints });
    await recordStartBalance(record.id, facts.balance);
    if (facts.balance < 0) await alertNegativeBalance(profile.catalogueKey, turn, facts.balance);

    const upkeepCtx = { userId: profile.userId, blueprints, teamNames, eventOrder };
    const execCtx: ExecutionContext = {
      identity: {
        profileId: profile.profileId,
        userId: profile.userId,
        catalogueKey: profile.catalogueKey,
        strategyKey: strategy.key,
        strategyVersion: strategy.version,
        seasonNumber: turn.seasonNumber,
        trigger: turn.trigger,
        slot: turn.slot,
        attempt: record.attempt,
      },
      blueprints,
      weapons: env.weapons,
      teamNames,
      eventOrder,
    };

    // 3. Free_Upkeep at turn start.
    const startUpkeep = await runFreeUpkeep(facts, upkeepCtx);
    facts = startUpkeep.facts;
    issues.push(...startUpkeep.issues);

    // 4. Planner loop under the Turn_Budget (R5.11).
    for (;;) {
      const plan = planNextStep(facts, strategy, { params, blueprints, weapons: env.weapons });
      lastPlan = plan;
      const next = plan.next;
      if (next === null || next.kind === 'saving') break;
      const budget = checkTurnBudget({ chargedActions: cursor.chargedSteps, startedAtMs: started }, env.now(), chargedStepCount(next.action));
      if (budget.exhausted) {
        reason = TURN_BUDGET_EXHAUSTED;
        break;
      }
      const stepsBefore = cursor.chargedSteps;
      const factsBefore = JSON.stringify(facts);
      const execution = await executeAction(next.action, next.goalId, facts, execCtx, cursor);
      issues.push(...execution.upkeepIssues);
      if (cursor.chargedSteps === stepsBefore && JSON.stringify(execution.facts) === factsBefore) {
        throw new AutomatonError(
          AutomatonErrorCode.AUTOMATON_NO_PROGRESS,
          `Goal ${next.goalId} planned ${next.action.kind}, which changed nothing`,
          500,
        );
      }
      facts = execution.facts;
    }

    // 5. Free_Upkeep at turn end.
    const endUpkeep = await runFreeUpkeep(facts, upkeepCtx);
    facts = endUpkeep.facts;
    issues.push(...endUpkeep.issues);
  } catch (error) {
    const code = errorCodeOf(error);
    const upkeepIssues = toUpkeepIssueRecords(issues);
    // Committed actions stay recorded (R7.8); the next attempt re-plans from facts.
    await finishTurnRecord(record.id, {
      status: 'failed',
      reason: code,
      endBalance: await currentBalance(profile.userId),
      creditsSpent: cursor.creditsSpent,
      creditsReceived: cursor.creditsReceived,
      actions: toActionRecords(cursor.steps),
      goalOutcomes: lastPlan ? toGoalOutcomeRecords(lastPlan.outcomes) : [],
      upkeepIssues,
      durationMs: env.now() - started,
    });
    await alertTurnFailed(profile.catalogueKey, turn, code, errorMessageOf(error));
    if (upkeepIssues.length > 0) await alertUpkeepIssues(profile.catalogueKey, turn, upkeepIssues);
    return {
      ...empty,
      status: 'failed',
      reason: code,
      creditsSpent: cursor.creditsSpent,
      creditsReceived: cursor.creditsReceived,
      actionsByKind: countByKind(cursor.steps.map((s) => s.kind)),
    };
  }

  // 6. Completed Turn_Record.
  const outcomes = lastPlan ? lastPlan.outcomes : [];
  const goalOutcomes = toGoalOutcomeRecords(outcomes);
  const upkeepIssues = toUpkeepIssueRecords(issues);
  const final = outcomes[outcomes.length - 1];
  const savingGoalId = reason === null && final?.kind === 'saving' ? final.goalId : null;
  await finishTurnRecord(record.id, {
    status: 'completed',
    reason,
    endBalance: facts.balance,
    creditsSpent: cursor.creditsSpent,
    creditsReceived: cursor.creditsReceived,
    actions: toActionRecords(cursor.steps),
    goalOutcomes,
    upkeepIssues,
    durationMs: env.now() - started,
  });
  if (upkeepIssues.length > 0) await alertUpkeepIssues(profile.catalogueKey, turn, upkeepIssues);
  if (savingGoalId !== null) {
    // Informational (R11.8): alert once, when the run first passes 14 turns.
    const streak = await savingStreakLength(profile.profileId, record.id, savingGoalId);
    if (streak === SAVING_ALERT_TURNS + 1) await alertSavingStreak(profile.catalogueKey, savingGoalId, streak);
  }
  return {
    status: 'completed',
    reason,
    creditsSpent: cursor.creditsSpent,
    creditsReceived: cursor.creditsReceived,
    actionsByKind: countByKind(cursor.steps.map((s) => s.kind)),
    savingGoalId,
    blocked: outcomes.filter((o) => o.kind === 'blocked').length,
  };
}

async function currentBalance(userId: number): Promise<number | null> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });
    return user?.currency ?? null;
  } catch {
    return null;
  }
}

// ─── Turn_Step ───────────────────────────────────────────────────────

function addResult(summary: TurnStepSummary, result: AutomatonTurnResult): void {
  if (result.status === 'completed') summary.completed++;
  else summary.failed++;
  summary.creditsSpent += result.creditsSpent;
  summary.creditsReceived += result.creditsReceived;
  for (const [kind, n] of Object.entries(result.actionsByKind)) {
    summary.actionsByKind[kind] = (summary.actionsByKind[kind] ?? 0) + n;
  }
  if (result.savingGoalId !== null) summary.saving++;
  summary.blocked += result.blocked;
}

function addSkipped(summary: TurnStepSummary, reason: string): void {
  summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
}

/** Why a running Turn_Step stopped starting turns before its deadline. */
type TurnStepStop = 'cutover' | 'lease_lost' | null;

/** Shared, mutable state of one running Turn_Step (counters change synchronously between awaits). */
interface TurnStepRun {
  turn: TurnLabel;
  summary: TurnStepSummary;
  deadline: TurnStepDeadline;
  lease: TurnStepLease;
  env: TurnEnvironment | null;
  now: () => number;
  stop: TurnStepStop;
  /** Profiles left unclaimed after the lease was lost. */
  notStarted: number;
}

/** Claim the record of a profile that will not run and record it `skipped` (unless already final). */
async function skipProfile(run: TurnStepRun, claimInput: TurnRecordClaimInput, reason: string): Promise<void> {
  const record = await claimTurnRecord(claimInput);
  if (record.alreadyFinal) {
    run.summary.alreadyFinal++;
    return;
  }
  await markTurnSkipped(record.id, reason);
  addSkipped(run.summary, reason);
}

/**
 * One profile of the Turn_Step, in this order: lease lost (leave it
 * unclaimed: another holder may be running the key) → cutover started
 * mid-step (`cutover_in_progress`, R7.5) → deadline reached
 * (`step_budget_exhausted`) → the turn itself.
 */
async function runCohortProfile(run: TurnStepRun, profile: CohortProfile): Promise<void> {
  const { summary, turn } = run;
  if (run.lease.lost) {
    run.stop = 'lease_lost';
    run.notStarted++;
    return;
  }
  const claimInput: TurnRecordClaimInput = {
    profileId: profile.profileId,
    seasonNumber: turn.seasonNumber,
    trigger: turn.trigger,
    slot: turn.slot,
    strategyKey: profile.strategyKey,
    strategyVersion: profile.strategyVersion,
    startBalance: profile.balance,
  };
  // An admin bulk cycle can start a cutover while a scheduler step runs; once seen, it sticks.
  if (run.stop !== 'cutover' && (await resolveCanonicalCycleIdentity()).isClosing) run.stop = 'cutover';
  if (run.stop === 'cutover') {
    await skipProfile(run, claimInput, CUTOVER_IN_PROGRESS);
    return;
  }
  if (isStepDeadlineReached(run.deadline, run.now())) {
    summary.budgetExhausted = true;
    await skipProfile(run, claimInput, STEP_BUDGET_EXHAUSTED);
    return;
  }
  const record = await claimTurnRecord(claimInput);
  if (record.alreadyFinal) {
    summary.alreadyFinal++;
    return;
  }
  if (!run.env) {
    await markTurnSkipped(record.id, PROGRAM_OFF);
    addSkipped(summary, PROGRAM_OFF);
    return;
  }
  try {
    addResult(summary, await runAutomatonTurn(profile, record, turn, run.env));
  } catch (error) {
    // The turn could not even record its own outcome.
    const code = errorCodeOf(error);
    logger.error(`[automaton-turns] ${profile.catalogueKey}: turn record write failed — ${errorMessageOf(error)}`);
    try {
      await markTurnFailed(record.id, code);
    } catch (markError) {
      logger.error(`[automaton-turns] ${profile.catalogueKey}: could not mark the turn failed — ${errorMessageOf(markError)}`);
    }
    await alertTurnFailed(profile.catalogueKey, turn, code, errorMessageOf(error));
    summary.failed++;
  }
}

/**
 * One Turn_Step (design §11.1, turn-budget plan D1–D5). Throws on a cutover
 * in progress at the start or an infrastructure failure (after in-flight
 * turns settle); a cutover that starts mid-step only stops new turns.
 */
export async function runTurnStep(input: TurnStepInput, deps: TurnStepDependencies = {}): Promise<TurnStepSummary> {
  const now = deps.now ?? Date.now;
  const turn: TurnLabel = { trigger: input.trigger, seasonNumber: input.seasonNumber, slot: input.slot };
  await assertNoCutoverInProgress();
  return withTurnStepLease(async (lease) => {
    // A cutover may have started while this caller waited for the lease.
    const phase = await assertNoCutoverInProgress();
    const started = now();
    const config = getConfig();
    const concurrency = effectiveTurnConcurrency(
      deps.concurrency ?? config.automatonTurnConcurrency,
      deps.poolMax ?? resolveDbPoolMax(),
    );
    const nextScheduledJobAt = deps.nextScheduledJobAt ?? ((ms: number): number | null => nextScheduledJobRunAt(config, ms));
    const deadline = resolveTurnStepDeadline({
      stepStartedAtMs: started,
      maxMs: deps.maxMs ?? config.automatonTurnStepMaxMs,
      scheduleMarginMs: deps.scheduleMarginMs ?? config.automatonTurnStepScheduleMarginMs,
      nextScheduledJobAtMs: nextScheduledJobAt(started),
    });
    const summary = emptyTurnStepSummary(turn, input.source, {
      concurrency,
      budgetMs: deadline.budgetMs,
      deadlineSource: deadline.source,
    });
    const enabled = await isProgramEnabled();
    const cohort = (await listActiveProfilesOrderedByUserId()).filter(deps.cohortFilter ?? ((): boolean => true));
    summary.processed = cohort.length;
    const env: TurnEnvironment | null = enabled && cohort.length > 0
      ? { registry: deps.registry ?? getStrategyRegistry(), weapons: await loadWeaponCatalogue(), phase, now }
      : null;
    const run: TurnStepRun = { turn, summary, deadline, lease, env, now, stop: null, notStarted: 0 };

    // Starts in ascending User.id order (R7.9); at most `concurrency` turns at once.
    await runWithConcurrency(cohort, concurrency, (profile) => runCohortProfile(run, profile));

    summary.durationMs = now() - started;
    summary.leaseLost = lease.lost;
    logTurnStepSummary(summary);
    const seconds = Math.round(summary.durationMs / 1000);
    if (summary.budgetExhausted) {
      await alertStepBudgetExhausted(turn, {
        skipped: summary.skipped[STEP_BUDGET_EXHAUSTED] ?? 0,
        durationMs: summary.durationMs,
        budgetMs: deadline.budgetMs,
        deadlineSource: deadline.source,
        nextScheduledJobAtMs: deadline.nextScheduledJobAtMs,
        concurrency,
      });
    }
    if (run.stop === 'cutover') {
      await alertTurnStepFailed(
        turn,
        AutomatonErrorCode.AUTOMATON_CUTOVER_IN_PROGRESS,
        `${summary.skipped[CUTOVER_IN_PROGRESS] ?? 0} stable(s) skipped (${CUTOVER_IN_PROGRESS}) after ${seconds} s`,
      );
    }
    if (summary.leaseLost) {
      await alertTurnStepFailed(turn, TURN_STEP_LEASE_LOST, `${run.notStarted} stable(s) not started after ${seconds} s`);
    }
    return summary;
  }, deps);
}

export type TurnStepOutcome =
  | { ok: true; summary: TurnStepSummary }
  | { ok: false; code: string; message: string };

/**
 * `runTurnStep` for the settlement, rollover and admin bulk call sites: logs
 * and alerts on failure and never throws (R7.8, design §11.3).
 */
export async function runTurnStepNonFatal(input: TurnStepInput, deps: TurnStepDependencies = {}): Promise<TurnStepOutcome> {
  try {
    return { ok: true, summary: await runTurnStep(input, deps) };
  } catch (error) {
    const code = errorCodeOf(error);
    const message = errorMessageOf(error);
    logger.error(`[automaton-turns] Turn_Step ${input.trigger} season ${input.seasonNumber} slot ${input.slot} (${input.source}) failed — ${code}: ${message}`);
    await alertTurnStepFailed(input, code, message);
    return { ok: false, code, message };
  }
}

/** Trigger values, re-exported for call sites. */
export type { AutomatonTurnTrigger };
