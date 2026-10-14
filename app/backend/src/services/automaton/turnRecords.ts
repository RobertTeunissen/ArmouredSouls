/**
 * Turn_Record persistence (Spec #55, R7.6, R7.8, R11.7, R11.8, design §11.1,
 * §11.2, task 6.2).
 *
 * At most one `automaton_turns` row per (profile, season number,
 * Turn_Trigger, Turn_Slot) (R7.6). `claimTurnRecord` inserts it as
 * `in_progress` / attempt 1, or, for a retried Turn_Step, returns
 * `alreadyFinal` for a `completed` / `skipped` row and re-opens an
 * `in_progress` / `failed` row with attempt + 1 so the turn re-plans from
 * fresh facts under new request keys. Callers run inside the Turn_Step
 * lease, so no two claims for one key race.
 */
import { z } from 'zod';
import prisma from '../../lib/prisma';
import type { AutomatonTurnStatus, AutomatonTurnTrigger, Prisma } from '../../../generated/prisma';
import type { TurnActionRecord, TurnGoalOutcome, TurnUpkeepIssue } from '../../types/automaton';
import type { GoalOutcome } from './goals/goalTypes';
import type { ExecutedChargedStep } from './executionSteps';
import type { FreeUpkeepIssue } from './upkeep/freeUpkeep';

/** Longest stored reason (`automaton_turns.reason` is VarChar(40)). */
export const TURN_REASON_MAX_LENGTH = 40;

/** Reason of a turn skipped while the Program_Switch is off (R2.7). */
export const PROGRAM_OFF = 'program_off';

/**
 * Reason of a turn not started because a Serialized_Cycle_Cutover began
 * while the Turn_Step was running (R7.5, AUTOMATON_TURN_STEP_DEADLINE.md,
 * "Mid-step cutover guard").
 */
export const CUTOVER_IN_PROGRESS = 'cutover_in_progress';

/** Reason of a turn whose pinned Strategy_Version or Goal_Targets are invalid (R6.6). */
export const INVALID_PARAMETERS = 'invalid_parameters';

/** The Turn_Record key plus the strategy snapshot written at claim time. */
export interface TurnRecordKey {
  profileId: number;
  seasonNumber: number;
  trigger: AutomatonTurnTrigger;
  slot: number;
}

export interface TurnRecordClaimInput extends TurnRecordKey {
  strategyKey: string;
  strategyVersion: number;
  /** Balance read with the cohort; replaced by the turn's loaded balance. */
  startBalance: number;
}

export type ClaimedTurnRecord =
  | { alreadyFinal: true; id: number; status: AutomatonTurnStatus }
  | { alreadyFinal: false; id: number; attempt: number };

function uniqueKey(key: TurnRecordKey): Prisma.AutomatonTurnWhereUniqueInput {
  return {
    profileId_seasonNumber_trigger_slot: {
      profileId: key.profileId,
      seasonNumber: key.seasonNumber,
      trigger: key.trigger,
      slot: key.slot,
    },
  };
}

/** Claim the Turn_Record of one profile for one Turn_Step (design §11.1). */
export async function claimTurnRecord(input: TurnRecordClaimInput): Promise<ClaimedTurnRecord> {
  const created = await prisma.automatonTurn.createMany({
    data: [{
      profileId: input.profileId,
      seasonNumber: input.seasonNumber,
      trigger: input.trigger,
      slot: input.slot,
      attempt: 1,
      status: 'in_progress',
      strategyKey: input.strategyKey,
      strategyVersion: input.strategyVersion,
      startBalance: input.startBalance,
    }],
    skipDuplicates: true,
  });
  const row = await prisma.automatonTurn.findUniqueOrThrow({
    where: uniqueKey(input),
    select: { id: true, status: true, attempt: true },
  });
  if (created.count === 1) return { alreadyFinal: false, id: row.id, attempt: row.attempt };
  if (row.status === 'completed' || row.status === 'skipped') {
    return { alreadyFinal: true, id: row.id, status: row.status };
  }
  const reopened = await prisma.automatonTurn.update({
    where: { id: row.id },
    data: {
      attempt: row.attempt + 1,
      status: 'in_progress',
      reason: null,
      strategyKey: input.strategyKey,
      strategyVersion: input.strategyVersion,
      startBalance: input.startBalance,
      startedAt: new Date(),
      finishedAt: null,
      durationMs: null,
    },
    select: { id: true, attempt: true },
  });
  return { alreadyFinal: false, id: reopened.id, attempt: reopened.attempt };
}

export function clampReason(reason: string | null): string | null {
  return reason === null ? null : reason.slice(0, TURN_REASON_MAX_LENGTH);
}

/** Record a turn that did not run (`skipped`) without touching its other columns. */
export async function markTurnSkipped(id: number, reason: string): Promise<void> {
  await prisma.automatonTurn.update({
    where: { id },
    data: { status: 'skipped', reason: clampReason(reason), finishedAt: new Date(), durationMs: 0 },
  });
}

/** Record the loaded start balance (design §11.2 step 2). */
export async function recordStartBalance(id: number, startBalance: number): Promise<void> {
  await prisma.automatonTurn.update({ where: { id }, data: { startBalance } });
}

export interface TurnRecordResult {
  status: Extract<AutomatonTurnStatus, 'completed' | 'failed'>;
  reason: string | null;
  endBalance: number | null;
  creditsSpent: number;
  creditsReceived: number;
  actions: readonly TurnActionRecord[];
  goalOutcomes: readonly TurnGoalOutcome[];
  upkeepIssues: readonly TurnUpkeepIssue[];
  durationMs: number;
}

/** Finish a turn as `completed` or `failed` (design §11.2 step 6). */
export async function finishTurnRecord(id: number, result: TurnRecordResult): Promise<void> {
  await prisma.automatonTurn.update({
    where: { id },
    data: {
      status: result.status,
      reason: clampReason(result.reason),
      endBalance: result.endBalance,
      creditsSpent: result.creditsSpent,
      creditsReceived: result.creditsReceived,
      actions: result.actions as unknown as Prisma.InputJsonValue,
      goalOutcomes: result.goalOutcomes as unknown as Prisma.InputJsonValue,
      upkeepIssues: result.upkeepIssues as unknown as Prisma.InputJsonValue,
      durationMs: Math.round(result.durationMs),
      finishedAt: new Date(),
    },
  });
}

/** Last-resort failure write when the turn itself could not write its record. */
export async function markTurnFailed(id: number, reason: string): Promise<void> {
  await prisma.automatonTurn.update({
    where: { id },
    data: { status: 'failed', reason: clampReason(reason), finishedAt: new Date() },
  });
}

// ─── Stored shapes ───────────────────────────────────────────────────

export function toActionRecords(steps: readonly ExecutedChargedStep[]): TurnActionRecord[] {
  return steps.map((step) => ({
    ordinal: step.ordinal,
    requestKey: step.requestKey,
    kind: step.kind,
    goalId: step.goalId,
    spent: step.spent,
    received: step.received,
    replayed: step.replayed,
    detail: { ...step.detail },
  }));
}

export function toGoalOutcomeRecords(outcomes: readonly GoalOutcome[]): TurnGoalOutcome[] {
  return outcomes.map((outcome): TurnGoalOutcome => {
    switch (outcome.kind) {
      case 'satisfied':
        return { goalId: outcome.goalId, kind: 'satisfied' };
      case 'blocked':
        return { goalId: outcome.goalId, kind: 'blocked', reason: outcome.reason, detail: { ...outcome.detail } };
      case 'saving':
        return { goalId: outcome.goalId, kind: 'saving', cost: outcome.cost, detail: { ...outcome.detail } };
      case 'actionable':
        return { goalId: outcome.goalId, kind: 'actionable', cost: outcome.cost, actionKind: outcome.action.kind };
    }
  });
}

function issueKey(issue: FreeUpkeepIssue): string {
  return [issue.part, issue.code, issue.robotId ?? '', issue.teamSize ?? '', issue.teamIndex ?? ''].join('|');
}

/** Upkeep issues without the repeats a start and end upkeep produce for the same cause. */
export function toUpkeepIssueRecords(issues: readonly FreeUpkeepIssue[]): TurnUpkeepIssue[] {
  const seen = new Set<string>();
  const records: TurnUpkeepIssue[] = [];
  for (const issue of issues) {
    const key = issueKey(issue);
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({ ...issue });
  }
  return records;
}

// ─── Saving streak (R11.8) ───────────────────────────────────────────

/** Alert once a Goal has been Saving for more than this many consecutive turns. */
export const SAVING_ALERT_TURNS = 14;

const storedOutcomesSchema = z.array(z.object({ goalId: z.string(), kind: z.string() }).passthrough());

/** The Goal a stored final evaluation ended Saving on, or null. */
export function savingGoalOf(goalOutcomes: Prisma.JsonValue): string | null {
  const parsed = storedOutcomesSchema.safeParse(goalOutcomes);
  if (!parsed.success || parsed.data.length === 0) return null;
  const last = parsed.data[parsed.data.length - 1];
  return last.kind === 'saving' ? last.goalId : null;
}

/**
 * Length of the profile's current run of `completed` turns ending Saving on
 * `goalId`, counting the turn just finished (`currentId`). Reads at most
 * SAVING_ALERT_TURNS + 1 earlier records, enough to tell whether the run has
 * just passed the threshold.
 */
export async function savingStreakLength(profileId: number, currentId: number, goalId: string): Promise<number> {
  const previous = await prisma.automatonTurn.findMany({
    where: { profileId, status: 'completed', id: { not: currentId } },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: SAVING_ALERT_TURNS + 1,
    select: { goalOutcomes: true },
  });
  let streak = 1;
  for (const row of previous) {
    if (savingGoalOf(row.goalOutcomes) !== goalId) break;
    streak++;
  }
  return streak;
}
