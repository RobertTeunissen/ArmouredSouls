// Feature: in-game-guide, Property 6: Search completeness and ranking
// **Validates: Requirements 14.1, 14.3**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterAndRankResults } from '../../components/guide/GuideSearch';
import { SearchIndexEntry } from '../../utils/guideApi';

/**
 * Arbitrary that generates a valid SearchIndexEntry with controlled text fields.
 */
const searchIndexEntryArb: fc.Arbitrary<SearchIndexEntry> = fc.record({
  slug: fc.stringMatching(/^[a-z][a-z0-9-]{1,20}$/),
  title: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,30}$/),
  sectionSlug: fc.stringMatching(/^[a-z][a-z0-9-]{1,15}$/),
  sectionTitle: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{2,25}$/),
  description: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{5,40}$/),
  bodyText: fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{10,60}$/),
});

/**
 * Arbitrary for a query string of at least 2 characters, using simple alpha strings.
 */
const queryArb: fc.Arbitrary<string> = fc.stringMatching(/^[a-z]{2,6}$/);

describe('GuideSearch — Property 6: Search completeness and ranking', () => {
  it('should return all matching entries and rank title > section > body matches', () => {
    fc.assert(
      fc.property(
        fc.array(searchIndexEntryArb, { minLength: 1, maxLength: 15 }),
        queryArb,
        (entries, query) => {
          const results = filterAndRankResults(entries, query);
          const lowerQuery = query.toLowerCase();

          // Compute expected matches manually
          const expectedTitleMatches: string[] = [];
          const expectedSectionMatches: string[] = [];
          const expectedBodyMatches: string[] = [];

          for (const entry of entries) {
            const titleMatch = entry.title.toLowerCase().includes(lowerQuery);
            const sectionMatch = entry.sectionTitle.toLowerCase().includes(lowerQuery);
            const bodyMatch = entry.bodyText.toLowerCase().includes(lowerQuery);

            const key = `${entry.sectionSlug}/${entry.slug}`;

            if (titleMatch) {
              expectedTitleMatches.push(key);
            } else if (sectionMatch) {
              expectedSectionMatches.push(key);
            } else if (bodyMatch) {
              expectedBodyMatches.push(key);
            }
          }

          const expectedTotal = expectedTitleMatches.length + expectedSectionMatches.length + expectedBodyMatches.length;

          // Completeness: all matching entries are returned
          expect(results.length).toBe(expectedTotal);

          // Ranking: title matches come first, then section, then body
          let phase: 'title' | 'section' | 'body' = 'title';
          for (const result of results) {
            if (phase === 'title') {
              if (result.matchType !== 'title') phase = 'section';
            }
            if (phase === 'section') {
              if (result.matchType !== 'section') phase = 'body';
            }
            if (phase === 'body') {
              expect(result.matchType).toBe('body');
            }
            if (phase === 'section') {
              expect(result.matchType).not.toBe('title');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
