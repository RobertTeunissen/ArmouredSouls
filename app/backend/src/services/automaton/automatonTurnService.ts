/**
 * Turn runner (Spec #55, R2.7, R5.11, R6.6, R7.5–R7.10, R11.7, R11.8,
 * design §5.2, §11.1, §11.2, task 6.2).
 *
 * `runTurnStep` runs one Automaton_Turn for every Active_Automaton of one
 * Turn_Trigger and Turn_Slot:
 * - never while a Serialized_Cycle_Cutover is in progress (R7.5);
 * - under the Turn_Step lease (`withTurnStepLease`), so a scheduler step and
 *   an admin bulk cycle run one after the other, across processes;
 * - over a cohort fixed at the start, in ascending `User.id` order (R7.9);
 * - within the 300 s Turn_Step budget; later profiles are recorded
 *   `skipped` / `step_budget_exhausted` and an alert is raised (R7.10);
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
import { resolveCanonicalCycleIdentity } from '../cycle/canonicalCycleIdentity';
import { SUBSCRIBABLE_EVENT_TYPES } from '../subscription/eventRegistry';
import type { AutomatonTurnTrigger, Prisma } from '../../../generated/prisma';
import type { EventOrder, StrategyParametersV1, TeamNames } from '../../types/automaton';
import { BUILD_FOCUS_WEIGHTS } from './buildFocus';
import { createExecutionCursor, executeAction, type ExecutionContext } from './actionExecutor';
import { chargedStepCount } from './factProjector';
import { planNextStep, type PlanResult } from './turnPlanner';
import { checkTurnBudget, isStepBudgetExhausted, STEP_BUDGET_EXHAUSTED, TURN_BUDGET_EXHAUSTED, TURN_STEP_BUDGET_MS } from './turnBudget';
import { loadBlueprintFacts, loadStableFacts, loadWeaponCatalogue, type StableFacts, type WeaponFacts } from './stableFacts';
import { runFreeUpkeep, type FreeUpkeepIssue } from './upkeep/freeUpkeep';
import { ensureProgramSettings, isProgramEnabled, PROGRAM_SETTINGS_ID } from './programSwitch';
import { loadStrategyRegistry, type StrategyRegistry } from './strategies/registry';
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
} from './turnRecords';

export {
  TURN_ACTION_LIMIT,
  TURN_TIME_BUDGET_MS,
  TURN_STEP_BUDGET_MS,
  TURN_BUDGET_EXHAUSTED,
  STEP_BUDGET_EXHAUSTED,
} from './turnBudget';
export { claimTurnRecord, PROGRAM_OFF, INVALID_PARAMETERS } from './turnRecords';
export type { TurnStepSummary } from './automatonObservability';

/** Extra lease time beyond the Turn_Step budget, so a slow last turn keeps the lease (design §11.1). */
export const TURN_STEP_LEASE_MARGIN_MS = 60_000;
/** How often a waiting caller retries the lease (design §11.1). */
export const TURN_STEP_LEASE_POLL_MS = 1_000;

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
}

// ─── Strategy_Registry ───────────────────────────────────────────────

let defaultRegistry: StrategyRegistry | null = null;

/** The repository Strategy_Registry, loaded once (the startup check has validated the files). */
export function getStrategyRegistry(): StrategyRegistry {
  if (!defaultRegistry) defaultRegistry = loadStrategyRegistry({ weightTable: BUILD_FOCUS_WEIGHTS });
  return defaultRegistry;
}

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
 * turnStepLeaseUntil`, design §11.1). One conditional update claims it when
 * it is empty or expired (a crashed holder's lease is taken over); otherwise
 * the caller polls. The lease is cleared in `finally`, only if still ours.
 * Raw parameterised SQL keeps the switch's `updatedAt` for switch changes.
 */
export async function withTurnStepLease<T>(fn: () => Promise<T>, deps: TurnStepDependencies = {}): Promise<T> {
  const now = deps.now ?? Date.now;
  const pollMs = deps.leasePollMs ?? TURN_STEP_LEASE_POLL_MS;
  await ensureProgramSettings();
  for (;;) {
    const current = new Date(now());
    const until = new Date(current.getTime() + TURN_STEP_BUDGET_MS + TURN_STEP_LEASE_MARGIN_MS);
    const claimed = await prisma.$executeRaw`
      UPDATE "automaton_program_settings"
      SET "turn_step_lease_until" = ${until}
      WHERE "id" = ${PROGRAM_SETTINGS_ID}
        AND ("turn_step_lease_until" IS NULL OR "turn_step_lease_until" < ${current})`;
    if (claimed === 1) {
      try {
        return await fn();
      } finally {
        await prisma.$executeRaw`
          UPDATE "automaton_program_settings"
          SET "turn_step_lease_until" = NULL
          WHERE "id" = ${PROGRAM_SETTINGS_ID} AND "turn_step_lease_until" = ${until}`;
      }
    }
    await sleep(pollMs);
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

/** One Turn_Step (design §11.1). Throws on a cutover in progress or an infrastructure failure. */
export async function runTurnStep(input: TurnStepInput, deps: TurnStepDependencies = {}): Promise<TurnStepSummary> {
  const now = deps.now ?? Date.now;
  const turn: TurnLabel = { trigger: input.trigger, seasonNumber: input.seasonNumber, slot: input.slot };
  await assertNoCutoverInProgress();
  return withTurnStepLease(async () => {
    // A cutover may have started while this caller waited for the lease.
    const phase = await assertNoCutoverInProgress();
    const started = now();
    const summary = emptyTurnStepSummary(turn, input.source);
    const enabled = await isProgramEnabled();
    const cohort = await listActiveProfilesOrderedByUserId();
    summary.processed = cohort.length;
    const env: TurnEnvironment | null = enabled && cohort.length > 0
      ? { registry: deps.registry ?? getStrategyRegistry(), weapons: await loadWeaponCatalogue(), phase, now }
      : null;

    for (const profile of cohort) {
      const claimInput = {
        profileId: profile.profileId,
        seasonNumber: turn.seasonNumber,
        trigger: turn.trigger,
        slot: turn.slot,
        strategyKey: profile.strategyKey,
        strategyVersion: profile.strategyVersion,
        startBalance: profile.balance,
      };
      if (isStepBudgetExhausted(started, now())) {
        summary.budgetExhausted = true;
        const record = await claimTurnRecord(claimInput);
        if (record.alreadyFinal) {
          summary.alreadyFinal++;
          continue;
        }
        await markTurnSkipped(record.id, STEP_BUDGET_EXHAUSTED);
        addSkipped(summary, STEP_BUDGET_EXHAUSTED);
        continue;
      }
      const record = await claimTurnRecord(claimInput);
      if (record.alreadyFinal) {
        summary.alreadyFinal++;
        continue;
      }
      if (!env) {
        await markTurnSkipped(record.id, PROGRAM_OFF);
        addSkipped(summary, PROGRAM_OFF);
        continue;
      }
      try {
        addResult(summary, await runAutomatonTurn(profile, record, turn, env));
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

    summary.durationMs = now() - started;
    logTurnStepSummary(summary);
    if (summary.budgetExhausted) {
      await alertStepBudgetExhausted(turn, summary.skipped[STEP_BUDGET_EXHAUSTED] ?? 0, summary.durationMs);
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
