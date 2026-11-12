/**
 * What each recorded admin action is, in plain words: its area (for the
 * Admin actions page filters), a title, a one-line detail and the admin page
 * the action was taken on. Pure; the operation names are the ones written by
 * `recordAction` across the admin routes and services.
 */
import type { AdminActionArea } from '../../../shared/types';

export const ADMIN_ACTION_AREAS = ['cycles', 'season', 'automatons', 'moderation', 'players', 'changelog', 'other'] as const satisfies readonly AdminActionArea[];
/** Operations of every area except Automatons (those are matched by the `automaton.` prefix). */
const AREA_OF: Readonly<Record<string, AdminActionArea>> = {
  scheduler_trigger: 'cycles',
  cycles_bulk: 'cycles',
  // Written by admin trigger routes that no longer exist; kept so their rows still read well.
  battles_run: 'cycles',
  matchmaking_run: 'cycles',
  leagues_rebalance: 'cycles',
  rebalancing_run: 'cycles',
  repair_run: 'cycles',
  repair_all: 'cycles',
  finances_run: 'cycles',
  koth_run: 'cycles',
  tournament_run: 'cycles',
  settlement_run: 'cycles',
  daily_finances_process: 'cycles',
  team_battle: 'cycles',
  team_tournament_trigger: 'cycles',
  season_rollover: 'season',
  season_extend: 'season',
  season_preparation_cycles: 'season',
  image_removed: 'moderation',
  image_cleanup: 'moderation',
  password_reset: 'players',
  changelog_create: 'changelog',
  changelog_update: 'changelog',
  changelog_publish: 'changelog',
  changelog_delete: 'changelog',
};

const AREA_LINK: Readonly<Record<AdminActionArea, string | null>> = {
  cycles: '/admin/cycles',
  season: '/admin/seasons',
  automatons: '/admin/automatons',
  moderation: '/admin/image-uploads',
  players: '/admin/players',
  changelog: '/admin/changelog',
  other: null,
};

/** Display names of the scheduler jobs (the Cycle Controls labels). */
const JOB_LABELS: Readonly<Record<string, string>> = {
  league: '1v1 League',
  tournament: 'Tournament',
  tagTeam: 'Tag Team',
  settlement: 'Settlement',
  koth: 'King of the Hill',
  team2v2League: '2v2 League',
  team3v3League: '3v3 League',
  team2v2Tournament: '2v2 Tournament',
  team3v3Tournament: '3v3 Tournament',
  grandMelee: 'Grand Melee',
  seasonRollover: 'Season rollover',
  bulkCycles: 'Bulk cycles',
};

/** Automaton operations (after the `automaton.` prefix) and what they did. */
const AUTOMATON_TITLES: Readonly<Record<string, string>> = {
  activate: 'Activated an Automaton stable',
  activate_all: 'Activated all Automaton drafts',
  add_blueprint: 'Added a blueprint',
  create_draft: 'Created an Automaton draft',
  delete_blueprint: 'Deleted a blueprint',
  delete_draft: 'Deleted an Automaton draft',
  program_switch: 'Switched the Automaton program',
  strategy_draft_create: 'Created a strategy draft',
  strategy_draft_delete: 'Deleted a strategy draft',
  strategy_draft_update: 'Edited a strategy draft',
  update_blueprint: 'Edited a blueprint',
  update_profile: 'Edited an Automaton profile',
  update_strategy: 'Changed an Automaton strategy',
  upgrade_strategy: 'Upgraded an Automaton strategy',
  upload_image: 'Uploaded an Automaton image',
};

/**
 * A catalogue entry by own key only. Operation names are stored strings (the
 * removed audit-log POST accepted any), so `constructor` or `__proto__` must
 * not resolve to an inherited Object property.
 */
function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

export function areaOf(operationType: string): AdminActionArea {
  if (operationType.startsWith('automaton.')) return 'automatons';
  return own(AREA_OF, operationType) ?? 'other';
}

export interface DescribedAction {
  area: AdminActionArea;
  title: string;
  /** One line for the list; empty when there is nothing to add. */
  details: string;
  /** Admin page the action was taken on, or null. */
  link: string | null;
}

type Summary = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const count = (value: number): string => value.toLocaleString('en-US');
const humanize = (raw: string): string => {
  const spaced = raw.replace(/[._]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** First items of a list, then "…". */
function listPreview(value: unknown, limit = 3): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items = value.filter((item): item is string => typeof item === 'string');
  if (items.length === 0) return null;
  return `${count(items.length)}: ${items.slice(0, limit).join(', ')}${items.length > limit ? ', …' : ''}`;
}

function jobLabel(name: unknown): string {
  const job = text(name);
  return job ? own(JOB_LABELS, job) ?? humanize(job) : 'a job';
}

const QUEUED_DETAILS = 'queued; the outcome is in Run history';

function describeCycles(op: string, failed: boolean, s: Summary): Pick<DescribedAction, 'title' | 'details'> {
  // Background starts are recorded when the run is queued, before it executes: the outcome is in Run history.
  const queued = !failed && s.background === true;
  if (op === 'scheduler_trigger') {
    if (failed) return { title: `Manual run of ${jobLabel(s.jobName)} failed`, details: text(s.error) ?? '' };
    return queued
      ? { title: `Started ${jobLabel(s.jobName)} manually`, details: QUEUED_DETAILS }
      : { title: `Ran ${jobLabel(s.jobName)} manually`, details: '' };
  }
  if (op === 'cycles_bulk') {
    const requested = num(s.cyclesRequested);
    const completed = num(s.cyclesCompleted);
    const what = requested === null ? 'bulk cycles' : `${count(requested)} bulk ${requested === 1 ? 'cycle' : 'cycles'}`;
    if (failed) return { title: 'Bulk run failed', details: text(s.error) ?? '' };
    if (queued) return { title: `Started ${what}`, details: QUEUED_DETAILS };
    return { title: `Ran ${what}`, details: completed !== null ? `${count(completed)} completed` : '' };
  }
  return { title: humanize(op), details: text(s.error) ?? '' };
}

function describeSeason(op: string, failed: boolean, s: Summary): Pick<DescribedAction, 'title' | 'details'> {
  const season = num(s.seasonNumber) ?? num(s.completedSeasonNumber);
  if (op === 'season_rollover') {
    if (failed) return { title: `Rollover${season === null ? '' : ` of season ${season}`} failed`, details: text(s.error) ?? '' };
    const durations = (s.durations ?? null) as Summary | null;
    const totalMs = durations ? num(durations.totalMs) : null;
    const parts = [
      totalMs === null ? null : `${(totalMs / 1000).toFixed(1)} s`,
      num(s.snapshotRows) === null ? null : `${count(num(s.snapshotRows)!)} snapshot rows`,
      num(s.accoladeRows) === null ? null : `${count(num(s.accoladeRows)!)} accolades`,
    ].filter((part): part is string => part !== null);
    return { title: season === null ? 'Rolled over the season' : `Rolled over season ${season} → ${season + 1}`, details: parts.join(' · ') };
  }
  if (op === 'season_extend') {
    const cycles = num(s.additionalCycles);
    return { title: cycles === null ? 'Extended the season' : `Extended the season by ${count(cycles)} ${cycles === 1 ? 'cycle' : 'cycles'}`, details: '' };
  }
  const remaining = num(s.remainingCycles);
  return { title: 'Set remaining preparation cycles', details: remaining === null ? '' : `${count(remaining)} remaining` };
}

function describeAutomatons(op: string, failed: boolean, s: Summary): Pick<DescribedAction, 'title' | 'details'> {
  const name = op.slice('automaton.'.length);
  const base = own(AUTOMATON_TITLES, name) ?? humanize(name);
  const key = text(s.catalogueKey);
  const stable = key && key !== 'all' && key !== 'none' && key !== 'invalid' ? key : null;
  if (failed) return { title: `${base}: rejected`, details: [stable, text(s.code)].filter(Boolean).join(' · ') };
  if (name === 'activate_all') {
    // Recorded as success even when drafts were rejected; never claim all were activated then.
    const activated = Array.isArray(s.activated) ? s.activated.length : 0;
    const rejectedKeys = Array.isArray(s.rejected)
      ? s.rejected.map((r) => (r !== null && typeof r === 'object' ? text((r as Summary).catalogueKey) : null)).filter((k): k is string => k !== null)
      : [];
    const rejected = Array.isArray(s.rejected) ? s.rejected.length : 0;
    if (rejected === 0) return { title: base, details: listPreview(s.activated) ?? 'nothing left to activate' };
    const rejectedPreview = listPreview(rejectedKeys);
    return {
      title: `Activated ${count(activated)} of ${count(activated + rejected)} Automaton drafts`,
      details: [`${count(activated)} activated`, rejectedPreview ? `rejected ${rejectedPreview}` : `${count(rejected)} rejected`].join(' · '),
    };
  }
  return { title: base, details: stable ?? '' };
}

function describeModeration(op: string, failed: boolean, s: Summary): Pick<DescribedAction, 'title' | 'details'> {
  if (op === 'image_removed') {
    const robots = num(s.robotsCleared);
    const parts = [text(s.reason), robots === null ? null : `${count(robots)} ${robots === 1 ? 'robot' : 'robots'} reset`];
    return { title: 'Removed an image', details: parts.filter(Boolean).join(' · ') };
  }
  const files = num(s.filesDeleted);
  const archived = (s.referencesCleared ?? null) as Summary | null;
  const parts = [
    files === null ? null : `${count(files)} ${files === 1 ? 'file' : 'files'} deleted`,
    archived && num(archived.archived) ? `${count(num(archived.archived)!)} archived references cleared` : null,
  ];
  return { title: failed ? 'Storage clean-up finished with errors' : 'Cleaned up image storage', details: parts.filter(Boolean).join(' · ') };
}

function describePlayers(_op: string, _failed: boolean, s: Summary): Pick<DescribedAction, 'title' | 'details'> {
  const who = text(s.stableName) ?? text(s.username);
  return { title: 'Reset a player\'s password', details: who ? `${who}${text(s.username) && who !== text(s.username) ? ` · @${text(s.username)}` : ''}` : '' };
}

function describeChangelog(op: string, _failed: boolean, s: Summary): Pick<DescribedAction, 'title' | 'details'> {
  const titles: Record<string, string> = {
    changelog_create: 'Created a changelog entry',
    changelog_update: 'Edited a changelog entry',
    changelog_publish: 'Published a changelog entry',
    changelog_delete: 'Deleted a changelog entry',
  };
  const entry = text(s.title) ?? (num(s.entryId) === null ? null : `#${num(s.entryId)}`);
  return { title: titles[op] ?? humanize(op), details: entry ?? '' };
}

/** The list line of one recorded action. Unknown operations fall back to a humanized name. */
export function describeAdminAction(operationType: string, operationResult: string, summary: unknown): DescribedAction {
  const area = areaOf(operationType);
  const failed = operationResult === 'failure';
  const s: Summary = summary !== null && typeof summary === 'object' && !Array.isArray(summary) ? (summary as Summary) : {};
  const describe = {
    cycles: describeCycles,
    season: describeSeason,
    automatons: describeAutomatons,
    moderation: describeModeration,
    players: describePlayers,
    changelog: describeChangelog,
    other: (op: string, _f: boolean, sum: Summary) => ({ title: humanize(op), details: text(sum.error) ?? '' }),
  }[area];
  const { title, details } = describe(operationType, failed, s);
  const targetUser = num(s.targetUserId);
  const link = area === 'players' && targetUser !== null ? `/admin/players?user=${targetUser}` : AREA_LINK[area];
  return { area, title, details, link };
}
