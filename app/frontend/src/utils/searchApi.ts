import { api } from './api';
import type { SearchResponse, SearchResult } from './searchTypes';

/**
 * Search robots, stables, and guide articles through the single authenticated
 * search endpoint.
 *
 * The helper accepts only the query and cancellation signal. Browser-local
 * history, account identity, result selections, and analytics are deliberately
 * not part of this request contract (a selection's category goes through
 * `recordSearchSelection` instead).
 */
export async function search(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  return api.get<SearchResponse>('/api/search', {
    params: { q: query },
    signal,
  });
}

/**
 * Privacy-light selection telemetry: report only the CATEGORY of the result
 * the player opened. No result id, label, position, route or query is sent.
 *
 * Fire-and-forget: never awaited by navigation, and every failure is
 * swallowed so telemetry can never affect the player.
 */
export function recordSearchSelection(category: SearchResult['category']): void {
  void api.post<void>('/api/search/selection', { category }).catch(() => undefined);
}
