/**
 * Feature: universal-search, Property 9: Recent history bound, uniqueness, order, and idempotence
 *
 * **Validates: Design Property 9; Requirements 6.3–6.6, 9.3, 9.6**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addRecentSearch,
  clearSearchHistory,
  MAXIMUM_QUERY_LENGTH,
  MAX_RECENT_SEARCHES,
  sanitizeRecentSearches,
} from '../searchHistory';

const queryCoreArbitrary = fc
  .string({ minLength: 1, maxLength: 24 })
  .filter((value) => value.trim().length > 0 && value.length <= 24);

const queryArbitrary = fc
  .tuple(
    fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 2 }),
    queryCoreArbitrary,
    fc.array(fc.constantFrom(' ', '\t', '\n'), { maxLength: 2 }),
  )
  .map(([leading, query, trailing]) => `${leading.join('')}${query}${trailing.join('')}`);

describe('Property 9: Recent history bound, uniqueness, order, and idempotence', () => {
  it('keeps submitted and selected queries normalized, bounded, unique, newest-first, and clearable', () => {
    fc.assert(
      fc.property(fc.array(queryArbitrary, { maxLength: 30 }), (queries) => {
        const history = queries.reduce<string[]>(
          (currentHistory, query) => addRecentSearch(currentHistory, query),
          [],
        );
        const expectedHistory = sanitizeRecentSearches([...queries].reverse());
        const normalizedKeys = history.map((entry) => entry.toLowerCase());

        expect(history).toEqual(expectedHistory);
        expect(history).toHaveLength(Math.min(5, expectedHistory.length));
        expect(new Set(normalizedKeys).size).toBe(history.length);
        expect(sanitizeRecentSearches(history)).toEqual(history);
        expect(addRecentSearch(history, history[0] ?? '')).toEqual(history);
        expect(clearSearchHistory()).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });
});

const validHistoryStringArbitrary = fc
  .string({ minLength: 1, maxLength: MAXIMUM_QUERY_LENGTH })
  .filter((value) => value.trim().length > 0);

const blankHistoryStringArbitrary = fc
  .string({ maxLength: 12 })
  .filter((value) => value.trim().length === 0);

const overlengthHistoryStringArbitrary = fc
  .integer({ min: MAXIMUM_QUERY_LENGTH + 1, max: MAXIMUM_QUERY_LENGTH + 20 })
  .map((length) => 'x'.repeat(length));

const nonStringHistoryValueArbitrary: fc.Arbitrary<unknown> = fc.oneof(
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.constant({}),
  fc.array(fc.integer(), { maxLength: 2 }),
);

const historyEntryArbitrary: fc.Arbitrary<unknown> = fc.oneof(
  validHistoryStringArbitrary,
  blankHistoryStringArbitrary,
  overlengthHistoryStringArbitrary,
  nonStringHistoryValueArbitrary,
);

const duplicateCoreArbitrary = fc.stringMatching(/^[A-Za-z0-9]{1,24}$/);

const malformedHistoryPayloadArbitrary: fc.Arbitrary<unknown> = fc.oneof(
  fc.constantFrom<unknown>(null, undefined, '', '{not-json', 42, false, true),
  fc.record({ searches: fc.array(fc.string({ maxLength: 8 }), { maxLength: 3 }) }),
  fc.record({ value: fc.integer(), entries: fc.array(fc.boolean(), { maxLength: 3 }) }),
);

const historyPayloadArbitrary: fc.Arbitrary<unknown> = fc.oneof(
  fc.tuple(
    validHistoryStringArbitrary,
    blankHistoryStringArbitrary,
    overlengthHistoryStringArbitrary,
    nonStringHistoryValueArbitrary,
    duplicateCoreArbitrary,
    fc.array(historyEntryArbitrary, { maxLength: 20 }),
  ).map(([valid, blank, overlength, nonString, duplicate, rest]) => [
    ` ${valid} `,
    blank,
    overlength,
    nonString,
    duplicate,
    ` ${duplicate.toUpperCase()} `,
    ...rest,
    duplicate.toLowerCase(),
  ]),
  malformedHistoryPayloadArbitrary,
);

function expectedSanitizedHistory(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];

  const seen = new Set<string>();
  const expected: string[] = [];

  for (const value of payload) {
    if (typeof value !== 'string') continue;

    const normalized = value.trim();
    if (normalized.length === 0 || normalized.length > MAXIMUM_QUERY_LENGTH) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    expected.push(normalized);
    if (expected.length === MAX_RECENT_SEARCHES) break;
  }

  return expected;
}

/**
 * Feature: universal-search, Property 10: Malformed history sanitization
 *
 * **Validates: Design Property 10; Requirement 6.12, 9.3, 9.6**
 */
describe('Property 10: Malformed history sanitization', () => {
  it('retains only normalized valid values in newest-first, unique, bounded order', () => {
    fc.assert(
      fc.property(historyPayloadArbitrary, (payload) => {
        const sanitized = sanitizeRecentSearches(payload);
        const expected = expectedSanitizedHistory(payload);
        const normalizedKeys = sanitized.map((entry) => entry.toLowerCase());

        expect(sanitized).toEqual(expected);
        expect(sanitized.every((entry) => (
          entry === entry.trim()
          && entry.length > 0
          && entry.length <= MAXIMUM_QUERY_LENGTH
        ))).toBe(true);
        expect(new Set(normalizedKeys).size).toBe(sanitized.length);
        expect(sanitized.length).toBeLessThanOrEqual(MAX_RECENT_SEARCHES);

        if (Array.isArray(payload)) {
          const firstAcceptedPositions = expected.map((entry) => payload.findIndex(
            (value) => typeof value === 'string'
              && value.trim().toLowerCase() === entry.toLowerCase(),
          ));
          expect(firstAcceptedPositions).toEqual(
            [...firstAcceptedPositions].sort((left, right) => left - right),
          );
        }
      }),
      { numRuns: 200 },
    );
  });
});
