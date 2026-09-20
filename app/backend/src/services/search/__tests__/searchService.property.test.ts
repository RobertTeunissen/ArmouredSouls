/**
 * Feature: universal-search, Property 11: Short-query source conservation
 *
 * **Validates: Design Property 11; Requirements 1.9, 5.15, 9.1, 9.6**
 */

import fc from 'fast-check';
import { describe, expect, it } from '@jest/globals';
import { normalizeSearchQuery } from '../searchRanking';
import {
  GuideSearchIndexProvider,
  SearchDatabase,
  SearchService,
} from '../searchService';
import { MINIMUM_QUERY_LENGTH, SearchResponse } from '../searchTypes';

const edgeWhitespaceArbitrary = fc.array(
  fc.constantFrom(' ', '\t', '\n', '\r'),
  { maxLength: 4 },
).map((characters) => characters.join(''));

const shortNormalizedQueryArbitrary = fc
  .string({ maxLength: 1 })
  .map((query) => normalizeSearchQuery(query))
  .filter((query) => query.length < MINIMUM_QUERY_LENGTH);

const shortQueryArbitrary = fc
  .tuple(edgeWhitespaceArbitrary, shortNormalizedQueryArbitrary, edgeWhitespaceArbitrary)
  .map(([leadingWhitespace, normalizedQuery, trailingWhitespace]) =>
    `${leadingWhitespace}${normalizedQuery}${trailingWhitespace}`,
  );

function createDependencies(): {
  database: SearchDatabase;
  guideIndex: GuideSearchIndexProvider;
} {
  return {
    database: {
      robot: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
    },
    guideIndex: { getSearchIndex: jest.fn() },
  };
}

describe('Property 11: Short-query source conservation', () => {
  it('should avoid the endpoint and all search sources while returning three empty groups', async () => {
    await fc.assert(
      fc.asyncProperty(shortQueryArbitrary, async (rawQuery) => {
        const { database, guideIndex } = createDependencies();
        const service = new SearchService({ database, guideIndex });
        const endpointRequest = jest.fn();
        const clientRequest = (query: string): Promise<SearchResponse> | unknown =>
          normalizeSearchQuery(query).length < MINIMUM_QUERY_LENGTH
            ? service.search(query)
            : endpointRequest(query);

        const response = await clientRequest(rawQuery);

        expect(response).toEqual({
          robots: [],
          stables: [],
          guide: [],
        });
        expect(endpointRequest).not.toHaveBeenCalled();
        expect(database.robot.findMany).not.toHaveBeenCalled();
        expect(database.user.findMany).not.toHaveBeenCalled();
        expect(guideIndex.getSearchIndex).not.toHaveBeenCalled();
      }),
      { numRuns: 200 },
    );
  });
});
