/**
 * Feature: universal-search, Property 12: Latest-query presentation
 *
 * **Validates: Design Property 12; Requirements 5.13–5.15, 7.1–7.2, 9.3, 9.6**
 */

import { act, renderHook } from '@testing-library/react';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useSearchPalette, {
  MINIMUM_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
} from '../useSearchPalette';
import { search } from '../../../utils/searchApi';
import type { SearchResponse } from '../../../utils/searchTypes';

vi.mock('../../../utils/searchApi', () => ({
  search: vi.fn(),
}));

const mockedSearch = vi.mocked(search);

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

interface PendingSearch extends Deferred<SearchResponse> {
  query: string;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

function responseFor(query: string): SearchResponse {
  return {
    robots: [{ category: 'robots', id: 1, label: `Result for ${query}` }],
    stables: [],
    guide: [],
  };
}

const eligibleQueryArbitrary = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: MINIMUM_QUERY_LENGTH,
    maxLength: 16,
  })
  .map((characters) => characters.join(''));

const distinctEligibleQueriesArbitrary = fc
  .tuple(eligibleQueryArbitrary, eligibleQueryArbitrary)
  .filter(([firstQuery, latestQuery]) => firstQuery !== latestQuery);

describe('Property 12: Latest-query presentation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedSearch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('presents only the latest eligible request when out-of-order results and errors settle', async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctEligibleQueriesArbitrary,
        fc.boolean(),
        fc.boolean(),
        async ([firstQuery, latestQuery], latestSucceeds, staleSucceeds) => {
          mockedSearch.mockReset();
          const pendingSearches: PendingSearch[] = [];
          mockedSearch.mockImplementation((query) => {
            const request = deferred<SearchResponse>();
            pendingSearches.push({ query, ...request });
            return request.promise;
          });

          const { result, unmount } = renderHook(() => useSearchPalette());

          try {
            act(() => {
              result.current.openSearch();
              result.current.onQueryChange(firstQuery);
            });
            act(() => {
              vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
            });

            act(() => {
              result.current.onQueryChange(latestQuery);
            });
            act(() => {
              vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
            });

            expect(pendingSearches).toHaveLength(2);
            expect(pendingSearches.map(({ query }) => query)).toEqual([
              firstQuery,
              latestQuery,
            ]);

            const firstRequest = pendingSearches[0];
            const latestRequest = pendingSearches[1];
            if (!firstRequest || !latestRequest) {
              throw new Error('Expected both debounced searches to be issued');
            }

            if (latestSucceeds) {
              await act(async () => {
                latestRequest.resolve(responseFor(latestQuery));
                await Promise.resolve();
              });
            } else {
              await act(async () => {
                latestRequest.reject(new Error('latest request failed'));
                await Promise.resolve();
              });
            }

            expect(result.current.normalizedQuery).toBe(latestQuery);
            expect(result.current.state).toBe(latestSucceeds ? 'results' : 'error');
            expect(result.current.response).toEqual(
              latestSucceeds ? responseFor(latestQuery) : null,
            );

            if (staleSucceeds) {
              await act(async () => {
                firstRequest.resolve(responseFor(firstQuery));
                await Promise.resolve();
              });
            } else {
              await act(async () => {
                firstRequest.reject(new Error('stale request failed'));
                await Promise.resolve();
              });
            }

            expect(result.current.normalizedQuery).toBe(latestQuery);
            expect(result.current.state).toBe(latestSucceeds ? 'results' : 'error');
            expect(result.current.response).toEqual(
              latestSucceeds ? responseFor(latestQuery) : null,
            );
          } finally {
            unmount();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
