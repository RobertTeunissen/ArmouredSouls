/**
 * Automaton_Observability (Spec #55, R11.7, R11.8, design §19, task 6.6).
 *
 * - One Turn_Step summary log line (`[automaton-turns]` prefix).
 * - Operator alerts through `sendMonitoringAlert` (the helper the rollover's
 *   `notify` wraps; it never throws) plus `logger.error`, for: a failed turn,
 *   an exhausted Turn_Step budget, the same Goal Saving for more than 14
 *   consecutive turns (informational), a negative balance at turn start,
 *   `invalid_parameters`, Free_Upkeep issues (the product owner asked to be
 *   told whenever something fails), a failed Turn_Step call, a rejected
 *   Strategy_Version upgrade (one alert per profile, task 9.9) and
 *   Catalogue_Sync conflicts (task 8.2).
 *
 * Every alert names the Catalogue_Key (or the step) and a reason, never
 * secrets: messages carry error codes and the domain services' own
 * player-facing messages, truncated.
 */
import logger from '../../config/logger';
import { sendMonitoringAlert } from '../../utils/monitoringWebhook';
import type { AutomatonTurnTrigger } from '../../../generated/prisma';

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
  automaton_step_budget_exhausted: '🚨 Automaton Turn_Step budget exhausted',
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
 * Raise one operator alert: `logger.error` plus the monitoring webhook.
 * Never throws; returns the message sent.
 */
export async function raiseAutomatonAlert(kind: AutomatonAlertKind, subject: string, detail: string): Promise<string> {
  const message = `${TITLES[kind]} — ${subject}: ${truncate(detail)}`;
  logger.error(`[automaton-alert] ${kind} ${subject}: ${truncate(detail)}`);
  try {
    await alertSender(message);
  } catch (error) {
    logger.error(`[automaton-alert] alert dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return message;
}

// ─── Typed helpers ───────────────────────────────────────────────────

export function alertTurnFailed(catalogueKey: string, turn: TurnLabel, code: string, message: string): Promise<string> {
  return raiseAutomatonAlert('automaton_turn_failed', catalogueKey, `${describeTurn(turn)} failed with ${code}: ${message}`);
}

export function alertInvalidParameters(catalogueKey: string, turn: TurnLabel, detail: string): Promise<string> {
  return raiseAutomatonAlert('automaton_invalid_parameters', catalogueKey, `${describeTurn(turn)} ended invalid_parameters: ${detail}`);
}

export function alertNegativeBalance(catalogueKey: string, turn: TurnLabel, balance: number): Promise<string> {
  return raiseAutomatonAlert(
    'automaton_negative_balance',
    catalogueKey,
    `${describeTurn(turn)} started at ₡${balance.toLocaleString('en-US')}; upkeep only, nothing can be bought`,
  );
}

export function alertSavingStreak(catalogueKey: string, goalId: string, turns: number): Promise<string> {
  return raiseAutomatonAlert(
    'automaton_saving_streak',
    catalogueKey,
    `saving for ${goalId} for ${turns} consecutive turns (informational; the stable keeps saving)`,
  );
}

export interface UpkeepIssueSummary {
  part: string;
  code: string;
  message: string;
}

export function alertUpkeepIssues(catalogueKey: string, turn: TurnLabel, issues: readonly UpkeepIssueSummary[]): Promise<string> {
  const list = issues.map((issue) => `${issue.part} ${issue.code} (${issue.message})`).join('; ');
  return raiseAutomatonAlert(
    'automaton_upkeep_issues',
    catalogueKey,
    `${describeTurn(turn)}: ${issues.length} issue(s), retried next turn: ${list}`,
  );
}

export function alertStepBudgetExhausted(turn: TurnLabel, skipped: number, durationMs: number): Promise<string> {
  return raiseAutomatonAlert(
    'automaton_step_budget_exhausted',
    `Turn_Step ${describeTurn(turn)}`,
    `${skipped} stable(s) skipped with step_budget_exhausted after ${Math.round(durationMs / 1000)} s`,
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
  /** Skipped by reason (`program_off`, `step_budget_exhausted`). */
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
  budgetExhausted: boolean;
}

export function emptyTurnStepSummary(turn: TurnLabel, source: TurnStepSummary['source']): TurnStepSummary {
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
  ].join(' ');
}

export function logTurnStepSummary(summary: TurnStepSummary): void {
  logger.info(formatTurnStepSummary(summary));
}
