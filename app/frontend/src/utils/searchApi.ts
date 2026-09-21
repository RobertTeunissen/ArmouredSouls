import { api } from './api';
import type { SearchResponse } from './searchTypes';

/**
 * Search robots, stables, and guide articles through the single authenticated
 * search endpoint.
 *
 * The helper accepts only the query and cancellation signal. Browser-local
 * history, account identity, result selections, and analytics are deliberately
 * not part of this request contract.
 */
export async function search(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  return api.get<SearchResponse>('/api/search', {
    params: { q: query },
    signal,
  });
}
