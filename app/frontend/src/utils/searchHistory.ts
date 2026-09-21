/**
 * Browser-local recent search history.
 *
 * This module deliberately has no API or analytics dependencies.  Search
 * history is a convenience of the current browser only and is never sent to
 * the backend.
 */

export const RECENT_SEARCH_STORAGE_KEY = 'armoured-souls:recent-searches';
export const MAXIMUM_QUERY_LENGTH = 100;
export const MAX_RECENT_SEARCHES = 5;

/**
 * Normalize one history value, returning null when it is not a valid entry.
 * Only edge whitespace is removed; internal whitespace and all other
 * characters remain unchanged.
 */
export function normalizeRecentSearch(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > MAXIMUM_QUERY_LENGTH) {
    return null;
  }

  return normalized;
}

function historyKey(value: string): string {
  return value.toLowerCase();
}

/**
 * Sanitize an arbitrary browser-local payload into the bounded history shape.
 * The first occurrence is retained because input history is newest-first.
 */
export function sanitizeRecentSearches(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const value of values) {
    const normalized = normalizeRecentSearch(value);
    if (normalized === null) continue;

    const key = historyKey(normalized);
    if (seen.has(key)) continue;

    seen.add(key);
    sanitized.push(normalized);
    if (sanitized.length === MAX_RECENT_SEARCHES) break;
  }

  return sanitized;
}

/**
 * Insert a submitted or selected search at the front of a history list.
 * Case-insensitive duplicates are removed before the new value is prepended.
 */
export function addRecentSearch(
  history: readonly unknown[],
  value: unknown,
): string[] {
  const normalized = normalizeRecentSearch(value);
  if (normalized === null) return sanitizeRecentSearches(history);

  const duplicateKey = historyKey(normalized);
  const withoutDuplicate = sanitizeRecentSearches(history).filter(
    (entry) => historyKey(entry) !== duplicateKey,
  );

  return [normalized, ...withoutDuplicate].slice(0, MAX_RECENT_SEARCHES);
}

/** Return the empty history value for callers that clear in-memory state. */
export function clearSearchHistory(): string[] {
  return [];
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read and sanitize the current browser's recent searches.
 * Unavailable storage, malformed JSON, and invalid payloads are treated as
 * empty history so current-query search can continue normally.
 */
export function readRecentSearches(): string[] {
  const storage = getLocalStorage();
  if (storage === null) return clearSearchHistory();

  try {
    const rawValue = storage.getItem(RECENT_SEARCH_STORAGE_KEY);
    if (rawValue === null) return clearSearchHistory();
    return sanitizeRecentSearches(JSON.parse(rawValue) as unknown);
  } catch {
    return clearSearchHistory();
  }
}

/**
 * Persist a sanitized, bounded history list.  The normalized list is returned
 * even when storage is unavailable or rejects the write.
 */
export function writeRecentSearches(values: unknown): string[] {
  const sanitized = sanitizeRecentSearches(values);
  const storage = getLocalStorage();
  if (storage === null) return sanitized;

  try {
    storage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Browser quota and privacy-mode failures must not block search.
  }

  return sanitized;
}

/** Remove all recent searches from the current browser, if possible. */
export function clearRecentSearches(): void {
  const storage = getLocalStorage();
  if (storage === null) return;

  try {
    storage.removeItem(RECENT_SEARCH_STORAGE_KEY);
  } catch {
    // Unavailable storage is intentionally a no-op.
  }
}
