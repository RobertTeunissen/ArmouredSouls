/**
 * Build an approved destination route from a player-safe search reference.
 *
 * Search results are received over the network, so the runtime checks here
 * intentionally do not rely on the TypeScript `SearchResult` union alone. A
 * rejected reference returns `null`; callers must not navigate when no safe
 * route can be built. Display labels, usernames, query text, and arbitrary
 * route fields are never used.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * Match the same path-safe slug alphabet enforced by the guide backend.
 * Restricting slugs to one path segment prevents traversal, query, and
 * fragment delimiters from entering a destination route.
 */
function isSafeSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
}

/**
 * Build a route only from the validated identity fields of a search result.
 *
 * @param result Runtime search-result data from the Search_Backend.
 * @returns An approved destination route, or `null` for an invalid reference.
 */
export function buildSearchResultRoute(result: unknown): string | null {
  if (!isRecord(result) || typeof result.category !== 'string') {
    return null;
  }

  switch (result.category) {
    case 'robots':
      return isPositiveSafeInteger(result.id) ? `/robots/${result.id}` : null;
    case 'stables':
      return isPositiveSafeInteger(result.userId) ? `/stables/${result.userId}` : null;
    case 'guide':
      return isSafeSlug(result.sectionSlug) && isSafeSlug(result.articleSlug)
        ? `/guide/${result.sectionSlug}/${result.articleSlug}`
        : null;
    default:
      return null;
  }
}
