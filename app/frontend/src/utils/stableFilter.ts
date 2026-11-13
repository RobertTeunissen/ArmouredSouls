/**
 * The "Stables" filter on the player overviews (#595): every stable, or human
 * players only. "Players" is the admin portal's word for human stables;
 * Automatons and generated bots are left out. Filtering never re-ranks: rows
 * keep their place among every stable.
 *
 * The choice is in the URL (`?stables=players`, so a shared link shows the
 * same list) and remembered on this device, so it carries across overviews.
 */
export type StableFilter = 'all' | 'players';

export const STABLE_FILTER_PARAM = 'stables';
const STABLE_FILTER_STORAGE_KEY = 'stableFilter';

export const STABLE_FILTER_OPTIONS: ReadonlyArray<{ key: StableFilter; label: string; description: string }> = [
  { key: 'all', label: 'All', description: 'Every stable: players, Automatons and bots.' },
  { key: 'players', label: 'Players', description: 'Human players’ stables only. Places still count every stable.' },
];

export function parseStableFilter(value: string | null | undefined): StableFilter | null {
  return value === 'players' || value === 'all' ? value : null;
}

export function readStoredStableFilter(): StableFilter {
  try {
    return parseStableFilter(localStorage.getItem(STABLE_FILTER_STORAGE_KEY)) ?? 'all';
  } catch {
    return 'all';
  }
}

export function storeStableFilter(filter: StableFilter): void {
  try {
    localStorage.setItem(STABLE_FILTER_STORAGE_KEY, filter);
  } catch {
    // Storage unavailable (private mode): the URL still carries the choice.
  }
}
