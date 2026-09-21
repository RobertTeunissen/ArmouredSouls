/**
 * Feature: universal-search, Property 8: Approved route construction
 *
 * **Validates: Design Property 8; Requirements 8.1–8.8, 9.3, 9.6**
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildSearchResultRoute } from '../searchRoutes';

const arbitraryTextArb = fc.string({ maxLength: 50 });
const arbitraryRouteArb = fc.string({ maxLength: 80 });
const positiveSafeIntegerArb = fc.integer({ min: 1, max: 1_000_000 });
const safeSlugArb = fc.stringMatching(/^[A-Za-z0-9_-]{1,24}$/);

const invalidNumericIdArb = fc.oneof(
  fc.integer({ min: -1_000, max: 0 }),
  fc
    .double({ min: -1_000, max: 1_000, noNaN: true, noDefaultInfinity: true })
    .filter((value) => value <= 0 || !Number.isSafeInteger(value)),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '42', null, undefined),
);

const unsafeSlugArb = fc.oneof(
  fc.constantFrom('', ' ', '.', '..', '../robots', 'combat/article', 'combat?tab=1', 'combat#section', 'café'),
  fc.tuple(safeSlugArb, safeSlugArb).map(([first, second]) => `${first}/${second}`),
  fc.tuple(safeSlugArb, safeSlugArb).map(([first, second]) => `${first}?${second}`),
  fc.tuple(safeSlugArb, safeSlugArb).map(([first, second]) => `${first}#${second}`),
);

const unknownCategoryArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((category) => !['robots', 'stables', 'guide'].includes(category));

type ValidSearchReference =
  | { category: 'robots'; id: number; label: string }
  | { category: 'stables'; userId: number; label: string }
  | {
      category: 'guide';
      title: string;
      sectionTitle: string;
      sectionSlug: string;
      articleSlug: string;
    };

const validSearchReferenceArb: fc.Arbitrary<ValidSearchReference> = fc.oneof(
  fc.record({
    category: fc.constant('robots' as const),
    id: positiveSafeIntegerArb,
    label: arbitraryTextArb,
  }),
  fc.record({
    category: fc.constant('stables' as const),
    userId: positiveSafeIntegerArb,
    label: arbitraryTextArb,
  }),
  fc.record({
    category: fc.constant('guide' as const),
    title: arbitraryTextArb,
    sectionTitle: arbitraryTextArb,
    sectionSlug: safeSlugArb,
    articleSlug: safeSlugArb,
  }),
);

const invalidSearchReferenceArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.record({
    category: fc.constant('robots' as const),
    id: invalidNumericIdArb,
    label: arbitraryTextArb,
  }),
  fc.record({
    category: fc.constant('stables' as const),
    userId: invalidNumericIdArb,
    label: arbitraryTextArb,
  }),
  fc.record({
    category: fc.constant('guide' as const),
    sectionSlug: unsafeSlugArb,
    articleSlug: safeSlugArb,
  }),
  fc.record({
    category: fc.constant('guide' as const),
    sectionSlug: safeSlugArb,
    articleSlug: unsafeSlugArb,
  }),
  fc.record({
    category: fc.constant('guide' as const),
    sectionSlug: safeSlugArb,
  }),
  fc.record({
    category: unknownCategoryArb,
    id: positiveSafeIntegerArb,
  }),
  fc.constantFrom<unknown>(null, undefined, 'robots', {}, []),
);

function addArbitraryDecoys(
  reference: unknown,
  query: string,
  label: string,
  username: string,
  route: string,
): unknown {
  if (typeof reference !== 'object' || reference === null || Array.isArray(reference)) {
    return reference;
  }

  return {
    ...(reference as Record<string, unknown>),
    query,
    label,
    username,
    route,
  };
}

describe('Property 8: Approved route construction', () => {
  it('builds only the approved route for every valid discriminated reference', () => {
    fc.assert(
      fc.property(
        validSearchReferenceArb,
        arbitraryTextArb,
        arbitraryTextArb,
        arbitraryTextArb,
        arbitraryRouteArb,
        (reference, query, label, username, arbitraryRoute) => {
          const candidate = addArbitraryDecoys(reference, query, label, username, arbitraryRoute);
          const resultRoute = buildSearchResultRoute(candidate);

          const expectedRoute = reference.category === 'robots'
            ? `/robots/${reference.id}`
            : reference.category === 'stables'
              ? `/stables/${reference.userId}`
              : `/guide/${reference.sectionSlug}/${reference.articleSlug}`;

          expect(resultRoute).toBe(expectedRoute);
          expect(resultRoute).toMatch(
            /^\/(robots|stables)\/\d+$|^\/guide\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('rejects invalid identities before unsafe slugs, invalid ids, or arbitrary text can form a route', () => {
    fc.assert(
      fc.property(
        invalidSearchReferenceArb,
        arbitraryTextArb,
        arbitraryTextArb,
        arbitraryTextArb,
        arbitraryRouteArb,
        (reference, query, label, username, arbitraryRoute) => {
          const candidate = addArbitraryDecoys(reference, query, label, username, arbitraryRoute);

          expect(buildSearchResultRoute(candidate)).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });
});
