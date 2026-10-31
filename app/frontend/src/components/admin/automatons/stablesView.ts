/**
 * Stables tab view model: status chip, strategy filter, search and sort over
 * the full stables list. Everything is client-side (the list is loaded whole)
 * and pure, so the toolbar's behaviour is unit-tested here.
 *
 * - Chip counts follow the strategy filter and the search text, not the
 *   status chip itself and not the sort.
 * - Sorting puts null values (drafts, never played, no cycle yet) last in both
 *   directions; ties fall back to the catalogue key. Without a sort the list
 *   is in catalogue key order, like the API returns it.
 * - The tier sort uses `compareHighestTier` from the shared module, which
 *   compares the tier only: the same tier in any mode is a tie, so within a
 *   tier the catalogue key decides, ascending in both directions.
 */
import { compareHighestTier, type HighestTier } from '@shared/utils/automatonStandingsTier';
import type { LibraryStrategy, NeedAttentionReason, ProfileListItem } from '../../../utils/automatonAdminApi';

export type NeedAttentionCode = NeedAttentionReason['code'];
export const NEED_ATTENTION_CODES: readonly NeedAttentionCode[] = ['balance_negative', 'last_cycle_failed', 'nothing_bought'];
export const NEED_ATTENTION_LABELS: Readonly<Record<NeedAttentionCode, string>> = {
  balance_negative: 'Balance negative',
  last_cycle_failed: 'Last cycle failed',
  nothing_bought: 'Nothing bought 14+ cycles',
};

export type StablesFilter = 'all' | 'active' | 'draft' | 'attention';
export type StableSortKey = 'name' | 'strategy' | 'robots' | 'credits' | 'prestige' | 'tier' | 'lastCycle';
export type SortDirection = 'asc' | 'desc';

export interface StableSort {
  key: StableSortKey;
  direction: SortDirection;
}

export interface StrategyOption {
  key: string;
  displayName: string;
}

export interface StablesViewInput {
  filter: StablesFilter;
  strategy: string | null;
  query: string;
  sort: StableSort | null;
  /** With the attention filter: only stables with this reason. */
  reason?: NeedAttentionCode | null;
}

export interface StablesView {
  rows: ProfileListItem[];
  counts: Record<StablesFilter, number>;
  /** Every stable, before any filter. */
  total: number;
}

export const STABLE_SORT_OPTIONS: readonly { key: StableSortKey; label: string }[] = [
  { key: 'name', label: 'Stable name' },
  { key: 'strategy', label: 'Strategy' },
  { key: 'robots', label: 'Robots' },
  { key: 'credits', label: 'Credits' },
  { key: 'prestige', label: 'Prestige' },
  { key: 'tier', label: 'Highest tier' },
  { key: 'lastCycle', label: 'Last cycle' },
];

/** Names start A→Z; numbers start with the largest value. */
const DEFAULT_DIRECTION: Readonly<Record<StableSortKey, SortDirection>> = {
  name: 'asc',
  strategy: 'asc',
  robots: 'desc',
  credits: 'desc',
  prestige: 'desc',
  tier: 'desc',
  lastCycle: 'desc',
};

const SORT_KEYS = new Set<string>(STABLE_SORT_OPTIONS.map((o) => o.key));

/** `credits:desc` → `{ key: 'credits', direction: 'desc' }`; anything else → null. */
export function parseStableSort(raw: string | null): StableSort | null {
  if (!raw) return null;
  const [key, direction, ...rest] = raw.split(':');
  if (rest.length > 0 || !SORT_KEYS.has(key) || (direction !== 'asc' && direction !== 'desc')) return null;
  return { key: key as StableSortKey, direction };
}

export function serializeStableSort(sort: StableSort): string {
  return `${sort.key}:${sort.direction}`;
}

/** Clicking a header: the active column toggles, another column starts in its default direction. */
export function nextSort(current: StableSort | null, key: StableSortKey): StableSort {
  if (current?.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  return { key, direction: DEFAULT_DIRECTION[key] };
}

/** Case-insensitive, trimmed match on stable name, catalogue key or franchise; an empty query matches all. */
export function matchesSearch(item: Pick<ProfileListItem, 'stableName' | 'catalogueKey' | 'franchise'>, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return [item.stableName, item.catalogueKey, item.franchise].some((field) => field.toLowerCase().includes(needle));
}

export function strategyName(item: Pick<ProfileListItem, 'strategyKey' | 'strategyDisplayName'>): string {
  return item.strategyDisplayName ?? item.strategyKey;
}

/** Library strategies plus any strategy a stable uses, by display name. */
export function strategyOptions(profiles: readonly ProfileListItem[] | null, library: readonly LibraryStrategy[] | null): StrategyOption[] {
  const names = new Map<string, string>();
  for (const strategy of library ?? []) names.set(strategy.key, strategy.displayName);
  for (const item of profiles ?? []) if (!names.has(item.strategyKey)) names.set(item.strategyKey, strategyName(item));
  return [...names.entries()]
    .map(([key, displayName]) => ({ key, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'en') || codePointCompare(a.key, b.key));
}

function matchesFilter(item: ProfileListItem, filter: StablesFilter): boolean {
  if (filter === 'active') return item.status === 'active';
  if (filter === 'draft') return item.status === 'draft';
  if (filter === 'attention') return item.needAttention.length > 0;
  return true;
}

/** Code point order, as the backend orders catalogue keys. */
function codePointCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

type SortValue = string | number | HighestTier | null;

/** Last cycle: what it bought; a failed / skipped / running cycle sorts below "Bought nothing". */
function lastCycleValue(item: ProfileListItem): number | null {
  if (item.status === 'draft' || item.lastTurn === null) return null;
  return item.lastTurn.status === 'completed' ? item.lastTurn.actionCount : -1;
}

function sortValue(item: ProfileListItem, key: StableSortKey): SortValue {
  const draft = item.status === 'draft';
  switch (key) {
    case 'name':
      return item.stableName;
    case 'strategy':
      return strategyName(item);
    case 'robots':
      return draft ? null : item.robots.current;
    case 'credits':
      return item.credits;
    case 'prestige':
      return item.prestige;
    case 'tier':
      return draft || item.bestTier === null || item.bestTierMode === null ? null : { tier: item.bestTier, mode: item.bestTierMode };
    case 'lastCycle':
      return lastCycleValue(item);
  }
}

function compareValues(a: Exclude<SortValue, null>, b: Exclude<SortValue, null>): number {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'en', { sensitivity: 'base' });
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return compareHighestTier(a as HighestTier, b as HighestTier);
}

function compareRows(a: ProfileListItem, b: ProfileListItem, sort: StableSort | null): number {
  if (sort) {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    if (va === null && vb !== null) return 1;
    if (va !== null && vb === null) return -1;
    if (va !== null && vb !== null) {
      const order = compareValues(va, vb);
      if (order !== 0) return sort.direction === 'asc' ? order : -order;
    }
  }
  return codePointCompare(a.catalogueKey, b.catalogueKey);
}

export function deriveStablesView(profiles: readonly ProfileListItem[] | null, input: StablesViewInput): StablesView {
  const all = profiles ?? [];
  const scoped = all.filter((p) => (input.strategy === null || p.strategyKey === input.strategy) && matchesSearch(p, input.query));
  const counts: Record<StablesFilter, number> = {
    all: scoped.length,
    active: scoped.filter((p) => matchesFilter(p, 'active')).length,
    draft: scoped.filter((p) => matchesFilter(p, 'draft')).length,
    attention: scoped.filter((p) => matchesFilter(p, 'attention')).length,
  };
  const reason = input.filter === 'attention' ? input.reason ?? null : null;
  const rows = scoped
    .filter((p) => matchesFilter(p, input.filter) && (reason === null || p.needAttention.some((r) => r.code === reason)))
    .sort((a, b) => compareRows(a, b, input.sort));
  return { rows, counts, total: all.length };
}
