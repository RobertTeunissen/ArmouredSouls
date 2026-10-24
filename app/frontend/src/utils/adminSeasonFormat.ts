/**
 * Pure helpers of Season Control (`/admin/seasons`): the timeline's estimated
 * dates, stage labels, purge-table groups and attempt text. Unit-tested
 * without rendering.
 *
 * Dates are estimates: they count forward from the scheduler's next settlement
 * at one cycle per day (the daily 00:00 settlement). Without a scheduled
 * settlement (automated scheduling off) there are no dates.
 */
import type { AdminSeasonState, RolloverAttempt, RolloverStageName, SeasonRolloverHistory } from './seasonApi';

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface SeasonTimelineDates {
  /** The settlement that closes the season (rollover), or null. */
  rolloverAt: Date | null;
  /** When the player countdown starts; null once it is showing or without dates. */
  countdownAt: Date | null;
  /** When the competitive phase of the next season (or of this one, while preparing) begins. */
  competitiveAt: Date | null;
}

type TimelineInput = Pick<AdminSeasonState, 'phase' | 'isLegacy' | 'remainingCompetitiveCycles' | 'remainingPreparationCycles' | 'seasonLengthCycles' | 'nextSettlementAt' | 'config'>;

const plusDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);

/**
 * Estimated dates of the timeline. The settlement at `nextSettlementAt` closes
 * the current cycle, so with `remaining` cycles left the rollover is the
 * settlement `remaining - 1` days after it, and the next competitive phase
 * starts `preparationLengthCycles` settlements after that.
 */
export function timelineDates(state: TimelineInput): SeasonTimelineDates {
  const none: SeasonTimelineDates = { rolloverAt: null, countdownAt: null, competitiveAt: null };
  if (!state.nextSettlementAt || state.isLegacy) return none;
  const next = new Date(state.nextSettlementAt);
  const prep = state.config.preparationLengthCycles;

  if (state.phase === 'competitive') {
    const remaining = state.remainingCompetitiveCycles;
    if (remaining < 1) return none;
    const rolloverAt = plusDays(next, remaining - 1);
    const countdown = state.config.countdownCycles;
    return {
      rolloverAt,
      countdownAt: remaining > countdown ? plusDays(next, remaining - countdown - 1) : null,
      competitiveAt: plusDays(rolloverAt, prep),
    };
  }
  if (state.phase === 'preparation') {
    const competitiveAt = plusDays(next, Math.max(0, state.remainingPreparationCycles - 1));
    return { rolloverAt: plusDays(competitiveAt, state.seasonLengthCycles), countdownAt: null, competitiveAt };
  }
  return none;
}

/** "16 Nov" (UTC); with the year when it is not `now`'s year. */
export function formatDate(value: Date | string, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const base = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return date.getUTCFullYear() === now.getUTCFullYear() ? base : `${base} ${date.getUTCFullYear()}`;
}

/** "16 Nov 00:00" (UTC). */
export function formatDateTime(value: Date | string, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const time = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  return `${formatDate(date, now)} ${time}`;
}

/** What extending the season by `cycles` does, before it is confirmed. */
export function extendEffect(state: TimelineInput, cycles: number, now: Date = new Date()): string {
  const length = state.seasonLengthCycles;
  const base = `${length} → ${length + cycles} cycles`;
  if (state.phase !== 'competitive') return base;
  const moved = timelineDates({ ...state, remainingCompetitiveCycles: state.remainingCompetitiveCycles + cycles });
  return moved.rolloverAt ? `${base} · rollover moves to ~${formatDate(moved.rolloverAt, now)}` : base;
}

export const STAGE_LABELS: Readonly<Record<RolloverStageName, string>> = {
  archive: 'Archive',
  verify: 'Verify',
  purge: 'Purge and reset',
  post: 'Clean up',
  automaton: 'Automaton turns',
};

export const STAGE_DESCRIPTIONS: Readonly<Record<RolloverStageName, string>> = {
  archive: 'Write the permanent season record. Nothing is deleted.',
  verify: 'Archive counts must match, or the rollover stops with all data intact.',
  purge: 'Delete generated stables, reset every other stable, empty season history, open the next season.',
  post: 'Image orphan sweep, preserved-state achievements, space reclamation. Failures here are warnings.',
  automaton: 'Automatons take their season-opening turn. Failures here are warnings.',
};

export interface PurgeGroup {
  label: string;
  tables: Array<{ table: string; rows: number }>;
  total: number;
}

const GROUPS: ReadonlyArray<{ label: string; tables: readonly string[] }> = [
  {
    label: 'Battles and summaries',
    tables: ['battles', 'battle_summaries', 'battle_participants', 'team_battles', 'team_battle_members', 'scheduled_matches_v2', 'scheduled_match_participants', 'robot_mode_kills'],
  },
  {
    label: 'Ledger, audit and snapshots',
    tables: ['financial_ledger', 'audit_logs', 'cycle_snapshots', 'league_history', 'leaderboard_cache', 'practice_arena_daily_stats', 'search_analytics_events', 'search_analytics_failures', 'automaton_turns', 'practice_arena_events'],
  },
];
const OTHER_LABEL = 'Standings, tournaments and other';

/** The preview's tables in three groups, largest first within each; unknown tables land in the last group. */
export function groupPurgeTables(rowsToPurge: Readonly<Record<string, number>>): PurgeGroup[] {
  const known = new Set(GROUPS.flatMap((group) => group.tables));
  const toGroup = (label: string, tables: string[]): PurgeGroup => {
    const rows = tables.map((table) => ({ table, rows: rowsToPurge[table] ?? 0 })).sort((a, b) => b.rows - a.rows || a.table.localeCompare(b.table));
    return { label, tables: rows, total: rows.reduce((sum, row) => sum + row.rows, 0) };
  };
  return [
    ...GROUPS.map((group) => toGroup(group.label, group.tables.filter((table) => table in rowsToPurge))),
    toGroup(OTHER_LABEL, Object.keys(rowsToPurge).filter((table) => !known.has(table))),
  ];
}

/** "Admin · robert", "Settlement". */
export function attemptTriggerLabel(attempt: Pick<RolloverAttempt, 'trigger' | 'triggeredBy'>): string {
  if (attempt.trigger === 'cron') return 'Settlement';
  const who = attempt.triggeredBy ? attempt.triggeredBy.username ?? `#${attempt.triggeredBy.userId}` : null;
  return who ? `Admin · ${who}` : 'Admin';
}

/** "Failed at Verify: Archive verification failed: …", "Interrupted: …". */
export function attemptProblemText(attempt: Pick<RolloverAttempt, 'status' | 'failedStage' | 'error'>): string {
  const prefix = attempt.status === 'interrupted' ? 'Interrupted' : 'Failed';
  const where = attempt.failedStage ? ` at ${STAGE_LABELS[attempt.failedStage]}` : '';
  return `${prefix}${where}${attempt.error ? `: ${attempt.error}` : ''}`;
}

/** The newest attempt in the history (what a rollover the page watched ended as). */
export function latestAttempt(history: SeasonRolloverHistory): RolloverAttempt | null {
  const all = [
    ...history.currentSeasonAttempts,
    ...history.seasons.flatMap((season) => [...(season.rollover ? [season.rollover] : []), ...season.failedAttempts]),
  ];
  return all.reduce<RolloverAttempt | null>((newest, attempt) => (!newest || new Date(attempt.at) > new Date(newest.at) ? attempt : newest), null);
}

/** "1,234". */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}
