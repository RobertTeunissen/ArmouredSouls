/**
 * Unit tests for guideSearchUtils — search filtering and ranking.
 */
import { describe, it, expect } from 'vitest';
import { filterAndRankResults } from './guideSearchUtils';
import type { SearchIndexEntry } from './guideApi';

function makeEntry(overrides: Partial<SearchIndexEntry> = {}): SearchIndexEntry {
  return {
    slug: 'test-article',
    title: 'Test Article',
    sectionSlug: 'basics',
    sectionTitle: 'Getting Started',
    description: 'A test article description',
    bodyText: 'This is the full body text of the article.',
    ...overrides,
  };
}

describe('filterAndRankResults', () => {
  it('should return empty array for queries shorter than 2 chars', () => {
    const entries = [makeEntry()];
    expect(filterAndRankResults(entries, '')).toEqual([]);
    expect(filterAndRankResults(entries, 'a')).toEqual([]);
  });

  it('should match by title first', () => {
    const entries = [
      makeEntry({ slug: 'combat', title: 'Combat Guide', bodyText: 'learn about battles' }),
      makeEntry({ slug: 'weapons', title: 'Weapons Overview', bodyText: 'combat weapons list' }),
    ];

    const results = filterAndRankResults(entries, 'combat');
    expect(results).toHaveLength(2);
    // Title match comes first
    expect(results[0].slug).toBe('combat');
    expect(results[0].matchType).toBe('title');
    // Body match comes second
    expect(results[1].slug).toBe('weapons');
    expect(results[1].matchType).toBe('body');
  });

  it('should rank: title > section > body', () => {
    const entries = [
      makeEntry({ slug: 'body-match', title: 'Something Else', sectionTitle: 'Other', bodyText: 'robot info here' }),
      makeEntry({ slug: 'title-match', title: 'Robot Guide', sectionTitle: 'Other', bodyText: 'no match' }),
      makeEntry({ slug: 'section-match', title: 'Something', sectionTitle: 'Robot Basics', bodyText: 'no match' }),
    ];

    const results = filterAndRankResults(entries, 'robot');
    expect(results).toHaveLength(3);
    expect(results[0].matchType).toBe('title');
    expect(results[1].matchType).toBe('section');
    expect(results[2].matchType).toBe('body');
  });

  it('should be case insensitive', () => {
    const entries = [makeEntry({ title: 'COMBAT GUIDE' })];
    const results = filterAndRankResults(entries, 'combat');
    expect(results).toHaveLength(1);
  });

  it('should return empty array when no matches', () => {
    const entries = [makeEntry({ title: 'Weapons', bodyText: 'guns and swords' })];
    const results = filterAndRankResults(entries, 'zzzzz');
    expect(results).toHaveLength(0);
  });

  it('should not duplicate entries across match types', () => {
    // If title matches, don't also add as body match even if body contains the query
    const entries = [makeEntry({ title: 'Robot Combat', bodyText: 'robot battles explained' })];
    const results = filterAndRankResults(entries, 'robot');
    expect(results).toHaveLength(1);
    expect(results[0].matchType).toBe('title');
  });
});
