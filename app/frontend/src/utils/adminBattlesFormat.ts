/**
 * Labels, formatting and URL filter handling of the admin Battles page.
 */
import {
  BATTLE_MODES,
  type BattleFilters,
  type BattleListRow,
  type BattleModeFilter,
  type BattleOutcomeFilter,
  type BattleRangeFilter,
  type BattleResult,
  type BattleStableFilter,
  type EndedBy,
  type StableKind,
} from '../components/admin/battles/types';
import { modeLabel } from './adminDashboardFormat';

export { modeLabel };

export const DEFAULT_FILTERS: BattleFilters = { mode: 'all', stable: 'all', outcome: 'all', range: '7d', q: '', page: 1 };

export const MODE_GROUPS: ReadonlyArray<{ label: string; modes: readonly string[] }> = [
  { label: 'League', modes: ['league_1v1', 'league_2v2', 'league_3v3', 'tag_team'] },
  { label: 'Tournament', modes: ['tournament_1v1', 'tournament_2v2', 'tournament_3v3'] },
  { label: 'Multi-robot', modes: ['koth', 'grand_melee'] },
];

export const STABLE_FILTER_OPTIONS: ReadonlyArray<{ key: BattleStableFilter; label: string; description?: string }> = [
  { key: 'all', label: 'All' },
  { key: 'human', label: 'Players', description: 'Battles with at least one robot from a human player’s stable.' },
  { key: 'generated', label: 'Generated', description: 'Battles with at least one robot from a generated (bot) stable.' },
  { key: 'automaton', label: 'Automatons', description: 'Battles with at least one robot from an Automaton stable.' },
];

export const OUTCOME_FILTER_OPTIONS: ReadonlyArray<{ key: BattleOutcomeFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'draw', label: 'Draws' },
  { key: 'bye', label: 'Byes' },
  { key: 'forfeit', label: 'Forfeits' },
  { key: 'time_limit', label: 'Time limit' },
];

export const RANGE_OPTIONS: ReadonlyArray<{ key: BattleRangeFilter; label: string }> = [
  { key: '24h', label: 'Last 24 hours' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'season', label: 'This season' },
];

const STABLE_LABELS: Record<StableKind, string> = { human: 'Player', generated: 'Generated', automaton: 'Automaton' };

export function stableTypeLabel(kind: StableKind): string {
  return STABLE_LABELS[kind];
}

const RESULT_LABELS: Record<BattleResult, string> = { win: 'Win', draw: 'Draw', bye: 'Bye', forfeit: 'Forfeit' };

export function resultLabel(result: BattleResult): string {
  return RESULT_LABELS[result];
}

const ENDED_BY_LABELS: Record<EndedBy, string> = {
  destroyed: 'Destroyed',
  yield: 'Yield',
  team_eliminated: 'Team eliminated',
  time_limit: 'Time limit',
  score_reached: 'Score reached',
  last_standing: 'Last standing',
};

export function endedByLabel(endedBy: EndedBy | null): string {
  return endedBy ? ENDED_BY_LABELS[endedBy] : '—';
}

/** Battle length as "48s" or "1m 52s". */
export function formatBattleDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Combat event time as "12.4s" or "1m 4.3s". */
export function formatEventTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  return `${m}m ${(seconds - m * 60).toFixed(1)}s`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "25 Oct 08:26" in UTC. */
export function formatBattleTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${hh}:${mm}`;
}

/** "25 Oct 2026, 08:24 UTC". */
export function formatBattleDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${formatBattleTime(iso).split(' ')[2]} UTC`;
}

/** "1 Nov" in UTC. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatCredits(value: number | null): string {
  return value === null ? '—' : `₡${Math.round(value).toLocaleString('en-US')}`;
}

export function formatNumber(value: number | null): string {
  return value === null ? '—' : Math.round(value).toLocaleString('en-US');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const capitalize = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Second line under the mode: tournament and round, field size, or tier and league instance. */
export function modeDetail(row: Pick<BattleListRow, 'battleType' | 'leagueType' | 'leagueInstanceId' | 'tournament' | 'participantCount'>): string {
  if (row.tournament) {
    return row.tournament.round !== null ? `${row.tournament.name} · Round ${row.tournament.round}` : row.tournament.name;
  }
  if (row.battleType === 'koth') return `${row.participantCount} robots`;
  if (row.battleType === 'grand_melee') return `${row.participantCount} robots · ${capitalize(row.leagueType)}`;
  return row.leagueInstanceId ? `${capitalize(row.leagueType)} · ${row.leagueInstanceId}` : capitalize(row.leagueType);
}

/** "3 Player, 2 Generated" for the rest of a placement field. */
export function fieldBreakdown(byType: Record<StableKind, number>): string {
  return (['human', 'generated', 'automaton'] as const)
    .filter((k) => byType[k] > 0)
    .map((k) => `${byType[k]} ${STABLE_LABELS[k]}`)
    .join(', ');
}

/** Stored combat messages start with an emoji; the admin UI shows the words only. */
export function displayMessage(message: string | undefined): string {
  return (message ?? '').replace(/^(?:\p{Extended_Pictographic}|[\u2190-\u21FF\u2600-\u27BF]|\uFE0F|\u200D|\s)+/u, '').trim();
}

// ── URL filters ───────────────────────────────────────────────────────

const RANGES: readonly string[] = RANGE_OPTIONS.map((o) => o.key);
const OUTCOMES: readonly string[] = OUTCOME_FILTER_OPTIONS.map((o) => o.key);
const STABLES: readonly string[] = STABLE_FILTER_OPTIONS.map((o) => o.key);
const MODES: readonly string[] = ['all', ...BATTLE_MODES];

/** Filters from the query string; unknown values fall back to the defaults. */
export function readBattleFilters(params: URLSearchParams): BattleFilters {
  const pick = <T extends string>(key: string, allowed: readonly string[], fallback: T): T => {
    const value = params.get(key);
    return value !== null && allowed.includes(value) ? (value as T) : fallback;
  };
  const page = Number(params.get('page'));
  return {
    mode: pick<BattleModeFilter>('mode', MODES, DEFAULT_FILTERS.mode),
    stable: pick<BattleStableFilter>('stable', STABLES, DEFAULT_FILTERS.stable),
    outcome: pick<BattleOutcomeFilter>('outcome', OUTCOMES, DEFAULT_FILTERS.outcome),
    range: pick<BattleRangeFilter>('range', RANGES, DEFAULT_FILTERS.range),
    q: (params.get('q') ?? '').slice(0, 100),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Write filters into the query string, leaving defaults out and other params untouched. */
export function writeBattleFilters(params: URLSearchParams, filters: BattleFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  // Rewritten in a fixed order, so the same view always has the same link.
  for (const key of ['mode', 'stable', 'outcome', 'range', 'q', 'page']) next.delete(key);
  for (const key of ['mode', 'stable', 'outcome', 'range'] as const) {
    if (filters[key] !== DEFAULT_FILTERS[key]) next.set(key, filters[key]);
  }
  if (filters.q.trim()) next.set('q', filters.q.trim());
  if (filters.page > 1) next.set('page', String(filters.page));
  return next;
}

export function isDefaultFilters(filters: BattleFilters): boolean {
  return filters.mode === 'all' && filters.stable === 'all' && filters.outcome === 'all' && filters.range === '7d' && !filters.q.trim();
}

/** "1,284 battles · All stables · All modes · Last 7 days". */
export function scopeParts(filters: BattleFilters): string[] {
  const parts = [
    filters.stable === 'all' ? 'All stables' : `With ${STABLE_FILTER_OPTIONS.find((o) => o.key === filters.stable)?.label.toLowerCase()}`,
    filters.mode === 'all' ? 'All modes' : modeLabel(filters.mode),
  ];
  if (filters.outcome !== 'all') parts.push(OUTCOME_FILTER_OPTIONS.find((o) => o.key === filters.outcome)?.label ?? filters.outcome);
  const searchById = /^#?\d+$/.test(filters.q.trim());
  if (!searchById) parts.push(RANGE_OPTIONS.find((o) => o.key === filters.range)?.label ?? filters.range);
  if (filters.q.trim()) parts.push(searchById ? `Battle ${filters.q.trim().replace(/^#?/, '#')}` : `Matching “${filters.q.trim()}”`);
  return parts;
}
