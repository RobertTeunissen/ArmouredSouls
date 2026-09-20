import { describe, expect, it } from 'vitest';
import { buildSearchResultRoute } from '../searchRoutes';

describe('buildSearchResultRoute', () => {
  it('builds the approved robot route from a positive integer id', () => {
    expect(buildSearchResultRoute({
      category: 'robots',
      id: 42,
      label: 'Titan',
    })).toBe('/robots/42');
  });

  it('builds the approved stable route from a positive integer user id', () => {
    expect(buildSearchResultRoute({
      category: 'stables',
      userId: 7,
      label: 'Iron Wolves',
    })).toBe('/stables/7');
  });

  it('builds the approved guide route from safe path segments', () => {
    expect(buildSearchResultRoute({
      category: 'guide',
      title: 'Battle Flow',
      sectionTitle: 'Combat',
      sectionSlug: 'combat',
      articleSlug: 'battle-flow_v2',
    })).toBe('/guide/combat/battle-flow_v2');
  });

  it('rejects invalid or non-positive robot and stable ids', () => {
    const invalidIds: unknown[] = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '42', null];

    for (const id of invalidIds) {
      expect(buildSearchResultRoute({ category: 'robots', id })).toBeNull();
      expect(buildSearchResultRoute({ category: 'stables', userId: id })).toBeNull();
    }
  });

  it('rejects empty, unsafe, or multi-segment guide slugs', () => {
    const unsafeSlugs = ['', ' ', '.', '..', '../robots', 'combat/article', 'combat?tab=1', 'combat#section', 'café'];

    for (const slug of unsafeSlugs) {
      expect(buildSearchResultRoute({
        category: 'guide',
        sectionSlug: slug,
        articleSlug: 'battle-flow',
      })).toBeNull();
      expect(buildSearchResultRoute({
        category: 'guide',
        sectionSlug: 'combat',
        articleSlug: slug,
      })).toBeNull();
    }
  });

  it('ignores labels, usernames, query text, and arbitrary route fields', () => {
    expect(buildSearchResultRoute({
      category: 'robots',
      id: 9,
      label: '/robots/999?query=secret',
      username: 'private-player',
      query: '/stables/999',
      route: '/admin',
    })).toBe('/robots/9');

    expect(buildSearchResultRoute({
      category: 'stables',
      userId: 11,
      label: 'Stable',
      username: 'private-player',
      route: '/robots/11',
    })).toBe('/stables/11');
  });

  it('rejects malformed or unknown result discriminants', () => {
    const malformedResults: unknown[] = [
      null,
      undefined,
      'robots',
      {},
      { category: 'robots' },
      { category: 'stables' },
      { category: 'guide', sectionSlug: 'combat' },
      { category: 'users', id: 1 },
    ];

    for (const result of malformedResults) {
      expect(buildSearchResultRoute(result)).toBeNull();
    }
  });
});
