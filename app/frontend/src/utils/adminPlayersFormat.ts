/**
 * View rules of the admin Players page: URL state (segment, search, sort,
 * page), filtering and sorting the human stables, and display text.
 */
import type { PlayerRow, PlayerSegment, StableKind } from './adminPlayersApi';

export type PlayersSegmentFilter = 'all' | PlayerSegment | 'onboarding' | 'low-balance';
export const PLAYER_SEGMENT_FILTERS: readonly PlayersSegmentFilter[] = ['all', 'active', 'inactive', 'dormant', 'onboarding', 'low-balance'];

export type PlayersSortKey = 'stable' | 'robots' | 'battles' | 'winRate' | 'balance' | 'lastLogin' | 'joined' | 'issues';
export const PLAYER_SORT_KEYS: readonly PlayersSortKey[] = ['stable', 'robots', 'battles', 'winRate', 'balance', 'lastLogin', 'joined', 'issues'];
export interface PlayersSort {
  key: PlayersSortKey;
  direction: 'asc' | 'desc';
}
export const DEFAULT_PLAYERS_SORT: PlayersSort = { key: 'lastLogin', direction: 'desc' };
export const PLAYERS_PAGE_SIZE = 25;

export interface PlayersViewState {
  segment: PlayersSegmentFilter;
  q: string;
  sort: PlayersSort;
  page: number;
  /** Detail panel of this stable id. */
  user: number | null;
}

/** Read the page state from the URL. `?tab=at-risk` (old dashboard link) opens Low balance. */
export function readPlayersView(params: URLSearchParams): PlayersViewState {
  const rawSegment = params.get('segment') ?? (params.get('tab') === 'at-risk' ? 'low-balance' : null);
  const segment = PLAYER_SEGMENT_FILTERS.find((value) => value === rawSegment) ?? 'all';
  const [sortKey, sortDirection] = (params.get('sort') ?? '').split(':');
  const key = PLAYER_SORT_KEYS.find((value) => value === sortKey);
  const sort: PlayersSort = key ? { key, direction: sortDirection === 'asc' ? 'asc' : 'desc' } : DEFAULT_PLAYERS_SORT;
  const page = Number(params.get('page'));
  const user = Number(params.get('user'));
  return {
    segment,
    q: (params.get('q') ?? '').slice(0, 50),
    sort,
    page: Number.isSafeInteger(page) && page > 1 ? page : 1,
    user: Number.isSafeInteger(user) && user > 0 ? user : null,
  };
}

/** Write a patch of the page state into the URL; defaults are left out. */
export function writePlayersView(params: URLSearchParams, patch: Partial<PlayersViewState>): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('tab');
  const set = (name: string, value: string | null): void => {
    if (value === null) next.delete(name);
    else next.set(name, value);
  };
  if (patch.segment !== undefined) set('segment', patch.segment === 'all' ? null : patch.segment);
  if (patch.q !== undefined) set('q', patch.q.trim() === '' ? null : patch.q);
  if (patch.sort !== undefined) {
    const isDefault = patch.sort.key === DEFAULT_PLAYERS_SORT.key && patch.sort.direction === DEFAULT_PLAYERS_SORT.direction;
    set('sort', isDefault ? null : `${patch.sort.key}:${patch.sort.direction}`);
  }
  if (patch.page !== undefined) set('page', patch.page > 1 ? String(patch.page) : null);
  if (patch.user !== undefined) set('user', patch.user === null ? null : String(patch.user));
  return next;
}

export function matchesSegment(row: PlayerRow, segment: PlayersSegmentFilter): boolean {
  switch (segment) {
    case 'all': return true;
    case 'onboarding': return row.issues.some((issue) => issue.code === 'onboarding_stuck');
    case 'low-balance': return row.issues.some((issue) => issue.code === 'low_balance');
    default: return row.segment === segment;
  }
}

export function displayName(row: { stableName: string | null; username: string }): string {
  return row.stableName ?? row.username;
}

function matchesQuery(row: PlayerRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (needle === '') return true;
  return row.username.toLowerCase().includes(needle)
    || (row.stableName ?? '').toLowerCase().includes(needle)
    || `#${row.userId}` === needle || String(row.userId) === needle;
}

function sortValue(row: PlayerRow, key: PlayersSortKey): number | string {
  switch (key) {
    case 'stable': return displayName(row).toLowerCase();
    case 'robots': return row.robots;
    case 'battles': return row.battles;
    case 'winRate': return row.winRate ?? -1;
    case 'balance': return row.currency;
    case 'lastLogin': return new Date(row.lastLoginAt ?? row.createdAt).getTime();
    case 'joined': return new Date(row.createdAt).getTime();
    case 'issues': return row.issues.length;
  }
}

/** Filter, search and sort (stable name breaks ties). */
export function derivePlayersRows(rows: readonly PlayerRow[], view: Pick<PlayersViewState, 'segment' | 'q' | 'sort'>): PlayerRow[] {
  const factor = view.sort.direction === 'asc' ? 1 : -1;
  return rows
    .filter((row) => matchesSegment(row, view.segment) && matchesQuery(row, view.q))
    .sort((a, b) => {
      const va = sortValue(a, view.sort.key);
      const vb = sortValue(b, view.sort.key);
      if (va < vb) return -1 * factor;
      if (va > vb) return 1 * factor;
      return displayName(a).localeCompare(displayName(b));
    });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "15 min ago", "3 h ago", "4 days ago", "Never". */
export function lastSeenText(iso: string | null, now: Date): string {
  if (!iso) return 'Never';
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  const days = Math.floor(diff / DAY);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "28 Mar 2026" (UTC). */
export function shortDateText(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** ₡7,442 / −₡12,400. */
export function creditsText(value: number): string {
  const rounded = Math.round(value);
  return `${rounded < 0 ? '−' : ''}₡${Math.abs(rounded).toLocaleString('en-US')}`;
}

/** ₡1.31M / ₡920k / ₡850. */
export function compactCreditsText(value: number): string {
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}₡${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}₡${(abs / 1_000_000).toFixed(abs >= 100_000_000 ? 0 : abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 10_000) return `${sign}₡${Math.round(abs / 1_000)}k`;
  return `${sign}₡${Math.round(abs).toLocaleString('en-US')}`;
}

export const SEGMENT_LABELS: Readonly<Record<PlayersSegmentFilter, string>> = {
  all: 'All',
  active: 'Active',
  inactive: 'Inactive',
  dormant: 'Dormant',
  onboarding: 'Stuck in onboarding',
  'low-balance': 'Low balance',
};

export const STABLE_KIND_LABELS: Readonly<Record<StableKind, string>> = {
  human: 'Player',
  automaton: 'Automaton',
  generated: 'Generated',
};

const LOADOUT_LABELS: Readonly<Record<string, string>> = {
  single: 'Single',
  weapon_shield: 'Weapon + shield',
  two_handed: 'Two-handed',
  dual_wield: 'Dual wield',
};

export function loadoutText(loadout: string): string {
  return LOADOUT_LABELS[loadout] ?? loadout;
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

/** Battles of a stable this season with links: the Battles page searches participants by stable name. */
export function stableBattlesHref(row: { stableName: string | null; username: string }): string {
  return `/admin/battles?q=${encodeURIComponent(row.stableName ?? row.username)}&range=7d`;
}

/** The server's password rules (`utils/validation.ts` validatePassword). */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}
