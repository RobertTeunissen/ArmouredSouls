/**
 * Labels, links and sentences of the admin Tournaments page.
 */
import type {
  ChampionStable,
  CurrentTournament,
  StableType,
  TournamentType,
  TournamentTypeOverview,
} from './adminTournamentsApi';

const TYPE_LABELS: Readonly<Record<TournamentType, string>> = { robot: '1v1', team_2v2: '2v2', team_3v3: '3v3' };
const BATTLE_MODES: Readonly<Record<TournamentType, string>> = {
  robot: 'tournament_1v1',
  team_2v2: 'tournament_2v2',
  team_3v3: 'tournament_3v3',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function typeLabel(type: TournamentType): string {
  return TYPE_LABELS[type];
}

/** "robots" for 1v1, "teams" otherwise. */
export function participantNoun(type: TournamentType, count = 2): string {
  if (type === 'robot') return count === 1 ? 'robot' : 'robots';
  return count === 1 ? 'team' : 'teams';
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** "Oct 19" (UTC) from an ISO timestamp or a YYYY-MM-DD date. */
export function shortDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** "46%", "<1%" for a non-zero share below 1%. */
export function formatShare(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  const percent = (part / whole) * 100;
  if (percent > 0 && percent < 1) return '<1%';
  return `${Math.round(percent)}%`;
}

/** Player tournament page with the bracket. */
export function bracketHref(tournamentId: number): string {
  return `/tournaments/${tournamentId}`;
}

/** Battles page filtered to the type's tournament mode over 30 days (a tournament spans under two weeks). */
export function tournamentBattlesHref(type: TournamentType): string {
  return `/admin/battles?mode=${BATTLE_MODES[type]}&range=30d`;
}

/** Admin player detail of a stable. */
export function stableHref(stableId: number): string {
  return `/admin/players?user=${stableId}`;
}

/** "Round 11: 0 of 2 matches · runs 10:00 UTC". */
export function currentRoundText(current: CurrentTournament, jobTime: string | null): string {
  const matches = `${formatCount(current.currentRound.done)} of ${formatCount(current.currentRound.matches)} match${current.currentRound.matches === 1 ? '' : 'es'}`;
  return `Round ${current.round}: ${matches}${jobTime ? ` · runs ${jobTime} UTC` : ''}`;
}

/** "936 of 2,048 (46%)". */
export function firstRoundByesText(current: CurrentTournament): string {
  const { byes, matches } = current.firstRound;
  return `${formatCount(byes)} of ${formatCount(matches)} (${formatShare(byes, matches)})`;
}

export interface StatusText {
  label: string;
  /** Sentence per reason, empty when on schedule. */
  details: string[];
}

/** Status of a running tournament in words. */
export function statusText(current: CurrentTournament, stalledAfterHours: number): StatusText {
  if (current.status.level === 'ok') return { label: 'On schedule', details: [] };
  if (current.status.reasons.includes('paused')) {
    return { label: 'Paused', details: ['The season is in its preparation phase; no tournament rounds run until it ends.'] };
  }
  const details: string[] = [];
  if (current.status.reasons.includes('stalled')) {
    details.push(`No match finished for more than ${stalledAfterHours} hours (last ${current.lastProgressAt ? shortDate(current.lastProgressAt) : 'unknown'}). Check the run history in Cycle Controls.`);
  }
  if (current.status.reasons.includes('left_behind')) {
    details.push(`${formatCount(current.leftBehind)} match${current.leftBehind === 1 ? '' : 'es'} of an earlier round never finished.`);
  }
  return { label: current.status.reasons.includes('stalled') ? 'Not advancing' : 'Matches left behind', details };
}

/** "8/8" players among champions. */
export function playerChampionsText(entry: TournamentTypeOverview): string {
  return `${entry.season.championsByStableType.human}/${entry.season.completed}`;
}

/** "9.9" days, or "—". */
export function averageDaysText(value: number | null): string {
  return value === null ? '—' : (Number.isInteger(value) ? String(value) : value.toFixed(1));
}

const STABLE_TYPE_LABELS: Readonly<Record<StableType, string>> = { human: 'Player', automaton: 'Automaton', generated: 'Generated' };

export function stableTypeLabel(type: StableType | null): string {
  return type ? STABLE_TYPE_LABELS[type] : 'Unknown';
}

export function stableName(stable: Pick<ChampionStable, 'stableName'>): string {
  return stable.stableName ?? 'Unknown stable';
}

export interface DominantStableNote {
  stableName: string;
  stableId: number | null;
  /** "7 of 8 1v1", one per type the stable dominates. */
  parts: string[];
}

export interface DominanceNote {
  stables: DominantStableNote[];
  /** True when no generated or Automaton stable won any completed tournament. */
  playersOnly: boolean;
}

/**
 * The balance note: per stable, the types in which it holds more than the
 * dominance share of titles ("7 of 8 1v1"); null when no stable does.
 */
export function dominanceNote(types: readonly TournamentTypeOverview[]): DominanceNote | null {
  const byStable = new Map<string, DominantStableNote>();
  for (const entry of types) {
    const top = entry.season.dominantStable;
    if (!top) continue;
    const key = top.stableId === null ? `name:${stableName(top)}` : String(top.stableId);
    const note = byStable.get(key) ?? { stableName: stableName(top), stableId: top.stableId, parts: [] };
    note.parts.push(`${top.titles} of ${entry.season.completed} ${typeLabel(entry.type)}`);
    byStable.set(key, note);
  }
  if (byStable.size === 0) return null;
  const totals = types.reduce((sum, entry) => sum + entry.season.completed, 0);
  const players = types.reduce((sum, entry) => sum + entry.season.championsByStableType.human, 0);
  return { stables: [...byStable.values()], playersOnly: totals > 0 && players === totals };
}
