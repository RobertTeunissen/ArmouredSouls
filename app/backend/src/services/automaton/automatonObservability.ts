/**
 * Automaton_Observability (Spec #55, R11.7, R11.8, design §19, task 6.6).
 *
 * - One Turn_Step summary log line (`[automaton-turns]` prefix).
 * - Operator alerts through `sendMonitoringAlert` (the helper the rollover's
 *   `notify` wraps; it never throws) plus `logger.error`, for: a failed turn,
 *   a Turn_Step that reached its deadline (kind
 *   `automaton_step_budget_exhausted`), the same Goal Saving for more than 14
 *   consecutive turns (informational), a negative balance at turn start,
 *   `invalid_parameters`, Free_Upkeep issues (the product owner asked to be
 *   told whenever something fails), a failed Turn_Step call (also a cutover
 *   or a lost lease that stopped a running step), a rejected
 *   Strategy_Version upgrade (one alert per profile, task 9.9) and
 *   Catalogue_Sync conflicts (task 8.2).
 *
 * Every alert names the Catalogue_Key (or the step) and a reason, never
 * secrets: messages carry error codes and the domain services' own
 * player-facing messages, truncated.
 *
 * Inside a Turn_Step the per-stable alerts (failed turn, invalid parameters,
 * negative balance, saving streak, upkeep issues) go through an
 * `AutomatonAlertDigest`: logged at once, sent as one webhook message per
 * kind when the step ends. Step-level alerts are sent at once.
 */
import logger from '../../config/logger';
import { sendMonitoringAlert } from '../../utils/monitoringWebhook';
import type { AutomatonTurnTrigger } from '../../../generated/prisma';
import type { TurnStepDeadlineSource } from './turnBudget';

export const AUTOMATON_ALERT_KINDS = [
  'automaton_turn_failed',
  'automaton_step_budget_exhausted',
  'automaton_saving_streak',
  'automaton_negative_balance',
  'automaton_invalid_parameters',
  'automaton_upkeep_issues',
  'automaton_turn_step_failed',
  'automaton_upgrade_rejected',
  'automaton_catalogue_sync_conflicts',
] as const;
export type AutomatonAlertKind = (typeof AUTOMATON_ALERT_KINDS)[number];

/** Longest free-text part of an alert (error messages, issue lists). */
export const ALERT_TEXT_LIMIT = 300;

const TITLES: Record<AutomatonAlertKind, string> = {
  automaton_turn_failed: '🚨 Automaton turn failed',
  automaton_step_budget_exhausted: '🚨 Automaton Turn_Step deadline reached',
  automaton_saving_streak: 'ℹ️ Automaton saving for the same goal',
  automaton_negative_balance: '⚠️ Automaton balance negative at turn start',
  automaton_invalid_parameters: '🚨 Automaton strategy parameters invalid',
  automaton_upkeep_issues: '⚠️ Automaton upkeep issue',
  automaton_turn_step_failed: '🚨 Automaton Turn_Step failed',
  automaton_upgrade_rejected: '⚠️ Automaton strategy upgrade rejected',
  automaton_catalogue_sync_conflicts: '⚠️ Automaton catalogue sync conflicts',
};

/** Turn identity shown in alerts. */
export interface TurnLabel {
  trigger: AutomatonTurnTrigger;
  seasonNumber: number;
  slot: number;
}

export function truncate(text: string, limit = ALERT_TEXT_LIMIT): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

export function describeTurn(turn: TurnLabel): string {
  switch (turn.trigger) {
    case 'settlement':
      return `season ${turn.seasonNumber} cycle ${turn.slot}`;
    case 'preparation':
      return `season ${turn.seasonNumber} prep ${turn.slot}`;
    case 'season_open':
      return `season ${turn.seasonNumber} start`;
  }
}

export type AlertSender = (message: string) => Promise<unknown>;

let alertSender: AlertSender = sendMonitoringAlert;

/** Test seam: replace the webhook sender (returns the previous one). */
export function setAlertSender(sender: AlertSender): AlertSender {
  const previous = alertSender;
  alertSender = sender;
  return previous;
}

/**
 * Per-stable alerts collected during one Turn_Step and sent as one webhook
 * message per alert kind when the step ends (`flushAlertDigest`). Without it
 * a step with 100 stables in the same state posted 100 messages at once,
 * which Discord's per-webhook rate limit answers with HTTP 429 — dropping
 * alerts sent in the same burst. Each alert is still logged at once.
 */
export interface AutomatonAlertDigest {
  readonly entries: Map<AutomatonAlertKind, Array<{ subject: string; detail: string }>>;
}

export function createAlertDigest(): AutomatonAlertDigest {
  return { entries: new Map() };
}

/** Discord rejects messages over 2000 characters; stay below with margin. */
export const DIGEST_MESSAGE_LIMIT = 1900;

async function dispatch(message: string): Promise<void> {
  try {
    await alertSender(message);
  } catch (error) {
    logger.error(`[automaton-alert] alert dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Raise one operator alert: `logger.error` plus the monitoring webhook, or,
 * with a digest, `logger.error` now and the webhook when the digest is
 * flushed. Never throws; returns the single-alert message text.
 */
export async function raiseAutomatonAlert(
  kind: AutomatonAlertKind,
  subject: string,
  detail: string,
  digest?: AutomatonAlertDigest,
): Promise<string> {
  const message = `${TITLES[kind]} — ${subject}: ${truncate(detail)}`;
  logger.error(`[automaton-alert] ${kind} ${subject}: ${truncate(detail)}`);
  if (digest) {
    const list = digest.entries.get(kind) ?? [];
    list.push({ subject, detail: truncate(detail) });
    digest.entries.set(kind, list);
    return message;
  }
  await dispatch(message);
  return message;
}

/**
 * Format one digest message: the single-alert text for one stable, otherwise
 * a heading plus one line per stable, cut at DIGEST_MESSAGE_LIMIT with a
 * count of the lines left out (they are in the `[automaton-alert]` log).
 */
export function formatDigestMessage(
  kind: AutomatonAlertKind,
  turn: TurnLabel,
  entries: ReadonlyArray<{ subject: string; detail: string }>,
): string {
  if (entries.length === 1) return `${TITLES[kind]} — ${entries[0].subject}: ${entries[0].detail}`;
  let message = `${TITLES[kind]} — ${describeTurn(turn)}: ${entries.length} stable(s)`;
  for (let i = 0; i < entries.length; i++) {
    const line = `\n• ${entries[i].subject}: ${entries[i].detail}`;
    const rest = entries.length - i;
    const moreNote = `\n…and ${rest} more (see [automaton-alert] log lines)`;
    // Keep room for the "…and N more" note whenever lines may still follow.
    const reserve = i === entries.length - 1 ? 0 : moreNote.length;
    if (message.length + line.length + reserve > DIGEST_MESSAGE_LIMIT) {
      return `${message}${moreNote}`;
    }
    message += line;
  }
  return message;
}

/**
 * Send the collected alerts, one message per kind in the order the kinds
 * were first raised, and empty the digest. Never throws; returns the messages.
 */
export async function flushAlertDigest(digest: AutomatonAlertDigest, turn: TurnLabel): Promise<string[]> {
  const messages: string[] = [];
  for (const [kind, entries] of digest.entries) {
    const message = formatDigestMessage(kind, turn, entries);
    messages.push(message);
    await dispatch(message);
  }
  digest.entries.clear();
  return messages;
}

// ─── Typed helpers ───────────────────────────────────────────────────
// The per-stable helpers take an optional digest; a Turn_Step passes one.

export function alertTurnFailed(
  catalogueKey: string,
  turn: TurnLabel,
  code: string,
  message: string,
  digest?: AutomatonAlertDigest,
): Promise<string> {
  return raiseAutomatonAlert('automaton_turn_failed', catalogueKey, `${describeTurn(turn)} failed with ${code}: ${message}`, digest);
}

export function alertInvalidParameters(
  catalogueKey: string,
  turn: TurnLabel,
  detail: string,
  digest?: AutomatonAlertDigest,
): Promise<string> {
  return raiseAutomatonAlert('automaton_invalid_parameters', catalogueKey, `${describeTurn(turn)} ended invalid_parameters: ${detail}`, digest);
}

export function alertNegativeBalance(
  catalogueKey: string,
  turn: TurnLabel,
  balance: number,
  digest?: AutomatonAlertDigest,
): Promise<string> {
  return raiseAutomatonAlert(
    'automaton_negative_balance',
    catalogueKey,
    `${describeTurn(turn)} started at ₡${balance.toLocaleString('en-US')}; upkeep only, nothing can be bought`,
    digest,
  );
}

export function alertSavingStreak(
  catalogueKey: string,
  goalId: string,
  turns: number,
  digest?: AutomatonAlertDigest,
): Promise<string> {
  return raiseAutomatonAlert(
    'automaton_saving_streak',
    catalogueKey,
    `saving for ${goalId} for ${turns} consecutive turns (informational; the stable keeps saving)`,
    digest,
  );
}

export interface UpkeepIssueSummary {
  part: string;
  code: string;
  message: string;
}

export function alertUpkeepIssues(
  catalogueKey: string,
  turn: TurnLabel,
  issues: readonly UpkeepIssueSummary[],
  digest?: AutomatonAlertDigest,
): Promise<string> {
  const list = issues.map((issue) => `${issue.part} ${issue.code} (${issue.message})`).join('; ');
  return raiseAutomatonAlert(
    'automaton_upkeep_issues',
    catalogueKey,
    `${describeTurn(turn)}: ${issues.length} issue(s), retried next turn: ${list}`,
    digest,
  );
}

/** What `alertStepBudgetExhausted` reports about a Turn_Step that reached its deadline. */
export interface StepDeadlineAlertInfo {
  /** Stables recorded `step_budget_exhausted`. */
  skipped: number;
  durationMs: number;
  /** The deadline minus the step start. */
  budgetMs: number;
  deadlineSource: TurnStepDeadlineSource;
  nextScheduledJobAtMs: number | null;
  concurrency: number;
}

function utcClock(ms: number): string {
  const at = new Date(ms);
  return `${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')}`;
}

function describeDeadline(info: StepDeadlineAlertInfo): string {
  switch (info.deadlineSource) {
    case 'schedule':
      return info.nextScheduledJobAtMs === null
        ? 'before the next scheduled job'
        : `before the next scheduled job at ${utcClock(info.nextScheduledJobAtMs)} UTC`;
    case 'cap':
      return 'AUTOMATON_TURN_STEP_MAX_MS';
    case 'floor':
      return '300 s minimum';
  }
}

/** The Turn_Step reached its deadline before starting every stable (supersedes R7.10). */
export function alertStepBudgetExhausted(turn: TurnLabel, info: StepDeadlineAlertInfo): Promise<string> {
  return raiseAutomatonAlert(
    'automaton_step_budget_exhausted',
    `Turn_Step ${describeTurn(turn)}`,
    `${info.skipped} stable(s) not started before the deadline after ${Math.round(info.durationMs / 1000)} s and skipped `
      + `(step_budget_exhausted); they act at their next turn. Deadline: ${describeDeadline(info)}, `
      + `budget ${Math.round(info.budgetMs / 1000)} s, ${info.concurrency} in parallel`,
  );
}

export function alertTurnStepFailed(turn: TurnLabel, code: string, message: string): Promise<string> {
  return raiseAutomatonAlert('automaton_turn_step_failed', `Turn_Step ${describeTurn(turn)}`, `${code}: ${message}`);
}

export interface RejectedUpgrade {
  catalogueKey: string;
  stableName: string;
  strategyKey: string;
  fromVersion: number;
  toVersion: number;
  reason: string;
}

/** One alert per rejected profile (R11.8, decision 37; used by task 9.9). */
export async function alertUpgradeRejected(rejections: readonly RejectedUpgrade[]): Promise<string[]> {
  const messages: string[] = [];
  for (const r of rejections) {
    messages.push(await raiseAutomatonAlert(
      'automaton_upgrade_rejected',
      r.catalogueKey,
      `${r.stableName}: ${r.strategyKey} v${r.fromVersion} → v${r.toVersion} rejected: ${r.reason}`,
    ));
  }
  return messages;
}

export function alertCatalogueSyncConflicts(conflicts: readonly string[]): Promise<string> {
  return raiseAutomatonAlert('automaton_catalogue_sync_conflicts', 'Catalogue_Sync', `${conflicts.length} conflict(s): ${conflicts.join('; ')}`);
}

// ─── Turn_Step summary log (R11.7) ───────────────────────────────────

export interface TurnStepSummary extends TurnLabel {
  source: 'scheduler' | 'admin_bulk' | 'rollover';
  /** Profiles in the fixed cohort. */
  processed: number;
  completed: number;
  /** Skipped by reason (`program_off`, `step_budget_exhausted`, `cutover_in_progress`). */
  skipped: Record<string, number>;
  failed: number;
  /** Profiles whose record was already final (retried step). */
  alreadyFinal: number;
  /** Charged actions by kind across the step. */
  actionsByKind: Record<string, number>;
  creditsSpent: number;
  creditsReceived: number;
  /** Turns that ended on a Saving Goal. */
  saving: number;
  /** Blocked Goals in the final evaluations. */
  blocked: number;
  durationMs: number;
  /** True once the deadline stopped the step from starting a stable. */
  budgetExhausted: boolean;
  /** Turns run at once (`effectiveTurnConcurrency`). */
  concurrency: number;
  /** The Turn_Step deadline minus its start. */
  budgetMs: number;
  /** What set the deadline. */
  deadlineSource: TurnStepDeadlineSource;
  /** True once a lease renewal found the lease taken over. */
  leaseLost: boolean;
}

/** How the Turn_Step runs: concurrency and deadline. */
export interface TurnStepRunShape {
  concurrency: number;
  budgetMs: number;
  deadlineSource: TurnStepDeadlineSource;
}

export function emptyTurnStepSummary(turn: TurnLabel, source: TurnStepSummary['source'], run: TurnStepRunShape): TurnStepSummary {
  return {
    ...turn,
    source,
    processed: 0,
    completed: 0,
    skipped: {},
    failed: 0,
    alreadyFinal: 0,
    actionsByKind: {},
    creditsSpent: 0,
    creditsReceived: 0,
    saving: 0,
    blocked: 0,
    durationMs: 0,
    budgetExhausted: false,
    concurrency: run.concurrency,
    budgetMs: run.budgetMs,
    deadlineSource: run.deadlineSource,
    leaseLost: false,
  };
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  return entries.length === 0 ? 'none' : entries.map(([key, n]) => `${key}=${n}`).join(',');
}

/** The one-line Turn_Step summary (design §19). */
export function formatTurnStepSummary(summary: TurnStepSummary): string {
  return [
    '[automaton-turns]',
    `trigger=${summary.trigger}`,
    `season=${summary.seasonNumber}`,
    `slot=${summary.slot}`,
    `source=${summary.source}`,
    `processed=${summary.processed}`,
    `completed=${summary.completed}`,
    `skipped=${formatCounts(summary.skipped)}`,
    `failed=${summary.failed}`,
    `alreadyFinal=${summary.alreadyFinal}`,
    `actions=${formatCounts(summary.actionsByKind)}`,
    `spent=${summary.creditsSpent}`,
    `received=${summary.creditsReceived}`,
    `saving=${summary.saving}`,
    `blocked=${summary.blocked}`,
    `durationMs=${summary.durationMs}`,
    `concurrency=${summary.concurrency}`,
    `budgetMs=${summary.budgetMs}`,
    `deadline=${summary.deadlineSource}`,
  ].join(' ');
}

export function logTurnStepSummary(summary: TurnStepSummary): void {
  logger.info(formatTurnStepSummary(summary));
}
