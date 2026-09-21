/**
 * Feature: universal-search, Property 1: Normalization and case invariance
 *
 * **Validates: Design Property 1; Requirements 2.1, 2.2, 4.5, 9.1, 9.6**
 */

import fc from 'fast-check';
import { describe, expect, it } from '@jest/globals';
import {
  buildGuideSearchResult,
  buildRobotSearchResult,
  buildStableSearchResult,
} from '../searchReferenceBuilder';
import {
  classifyMatch,
  limitCategoryResults,
  normalizeSearchQuery,
  rankGuideSources,
  rankRobotSources,
  rankStableSources,
} from '../searchRanking';
import {
  GuideSearchSource,
  MATCH_RANK_ORDER,
  MAX_RESULTS_PER_CATEGORY,
  MAX_TOTAL_RESULTS,
  RobotSearchSource,
  SearchResponse,
  StableSearchSource,
} from '../searchTypes';

const edgeWhitespaceArbitrary = fc.array(
  fc.constantFrom(' ', '\t', '\n', '\r'),
  { maxLength: 4 },
).map((characters) => characters.join(''));

const tokenArbitrary = fc.stringMatching(/^[A-Za-z0-9]{1,12}$/);

const meaningfulQueryArbitrary = fc
  .tuple(
    tokenArbitrary,
    fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 4 }),
    tokenArbitrary,
  )
  .map(([left, internalWhitespace, right]) => `${left}${internalWhitespace.join('')}${right}`);

describe('Property 1: Normalization and case invariance', () => {
  it('trims only edges, is idempotent, and preserves case-invariant matching identity', () => {
    fc.assert(
      fc.property(
        edgeWhitespaceArbitrary,
        meaningfulQueryArbitrary,
        edgeWhitespaceArbitrary,
        (leadingWhitespace, meaningfulQuery, trailingWhitespace) => {
          const rawQuery = `${leadingWhitespace}${meaningfulQuery}${trailingWhitespace}`;
          const normalizedQuery = normalizeSearchQuery(rawQuery);
          const upperCaseQuery = meaningfulQuery.toUpperCase();

          expect(normalizedQuery).toBe(meaningfulQuery);
          expect(normalizeSearchQuery(normalizedQuery)).toBe(normalizedQuery);
          expect(normalizedQuery).toContain(meaningfulQuery.match(/[ \t\n\r]+/)?.[0] ?? '');
          expect(normalizeSearchQuery(`${leadingWhitespace}${upperCaseQuery}${trailingWhitespace}`)).toBe(
            upperCaseQuery,
          );

          expect(classifyMatch(meaningfulQuery, meaningfulQuery)).toBe('exact');
          expect(classifyMatch(upperCaseQuery, upperCaseQuery)).toBe('exact');
          expect(classifyMatch(meaningfulQuery, `${meaningfulQuery} suffix`)).toBe('prefix');
          expect(classifyMatch(upperCaseQuery, `${upperCaseQuery} suffix`)).toBe('prefix');
          expect(classifyMatch(meaningfulQuery, `prefix ${meaningfulQuery}`)).toBe('substring');
          expect(classifyMatch(upperCaseQuery, `prefix ${upperCaseQuery}`)).toBe('substring');
        },
      ),
      { numRuns: 200 },
    );
  });
});
/**
 * Feature: universal-search, Property 2: Scope conservation and no fuzzy matches
 *
 * **Validates: Design Property 2; Requirements 1.3–1.7, 2.5, 2.12, 9.1, 9.6**
 */

type ForbiddenSearchDecoys = {
  username: string;
  teamName: string;
  weaponName: string;
  navigationPath: string;
  battleHistory: string;
};

const queryWithVowelArbitrary = fc.stringMatching(/^[a-z]{3,12}$/).filter((value) => /[aeiou]/.test(value));

function replaceFirstCharacter(value: string): string {
  const replacement = value[0] === 'a' ? 'b' : 'a';
  return `${replacement}${value.slice(1)}`;
}

function replaceFirstVowel(value: string): string {
  const vowelIndex = value.search(/[aeiou]/);
  const currentVowel = value[vowelIndex];
  const replacement = currentVowel === 'a' ? 'e' : 'a';
  return `${value.slice(0, vowelIndex)}${replacement}${value.slice(vowelIndex + 1)}`;
}

describe('Property 2: Scope conservation and no fuzzy matches', () => {
  it('should rank only approved source fields and reject forbidden or approximate-only decoys', () => {
    fc.assert(
      fc.property(queryWithVowelArbitrary, (query) => {
        const editDistanceDecoy = replaceFirstCharacter(query);
        const phoneticDecoy = replaceFirstVowel(query);
        const forbiddenFields: ForbiddenSearchDecoys = {
          username: query,
          teamName: query,
          weaponName: query,
          navigationPath: query,
          battleHistory: query,
        };
        const nonSearchableValue = editDistanceDecoy;

        const robots = [
          {
            id: 1,
            name: query,
            stableName: query,
            ...forbiddenFields,
          },
          {
            id: 2,
            name: `${query} robot`,
            stableName: nonSearchableValue,
            ...forbiddenFields,
          },
          {
            id: 3,
            name: `robot ${query}`,
            stableName: null,
            ...forbiddenFields,
          },
          {
            id: 99,
            name: editDistanceDecoy,
            stableName: nonSearchableValue,
            ...forbiddenFields,
          },
          {
            id: 100,
            name: phoneticDecoy,
            stableName: nonSearchableValue,
            ...forbiddenFields,
          },
        ];

        const stables = [
          {
            userId: 101,
            stableName: query,
            ...forbiddenFields,
            isGenerated: true,
          },
          {
            userId: 102,
            stableName: `Generated ${query}`,
            ...forbiddenFields,
            isGenerated: true,
          },
          {
            userId: 103,
            stableName: `Test ${query}`,
            ...forbiddenFields,
            isGenerated: true,
          },
          {
            userId: 199,
            stableName: editDistanceDecoy,
            ...forbiddenFields,
          },
          {
            userId: 200,
            stableName: null,
            ...forbiddenFields,
          },
          {
            userId: 201,
            stableName: '   ',
            ...forbiddenFields,
          },
        ];

        const guides = [
          {
            slug: `title-${query}`,
            title: query,
            sectionSlug: `title-section-${query}`,
            sectionTitle: `Title section ${query}`,
            description: `${editDistanceDecoy} title description`,
            bodyText: `${phoneticDecoy} title body`,
            ...forbiddenFields,
          },
          {
            slug: `description-${query}`,
            title: `${editDistanceDecoy} description title`,
            sectionSlug: `description-section-${query}`,
            sectionTitle: `Description section ${query}`,
            description: `Guide ${query}`,
            bodyText: `${phoneticDecoy} description body`,
            ...forbiddenFields,
          },
          {
            slug: `body-${query}`,
            title: `${editDistanceDecoy} body title`,
            sectionSlug: `body-section-${query}`,
            sectionTitle: `Body section ${query}`,
            description: `${phoneticDecoy} body description`,
            bodyText: `Guide body ${query}`,
            ...forbiddenFields,
          },
          {
            slug: query,
            title: editDistanceDecoy,
            sectionSlug: query,
            sectionTitle: query,
            description: editDistanceDecoy,
            bodyText: phoneticDecoy,
            ...forbiddenFields,
          },
        ];

        const rankedRobots = rankRobotSources(query, robots);
        const rankedStables = rankStableSources(query, stables);
        const rankedGuides = rankGuideSources(query, guides);

        expect(new Set(rankedRobots.map(({ source }) => source.id))).toEqual(new Set([1, 2, 3]));
        expect(new Set(rankedStables.map(({ source }) => source.userId))).toEqual(new Set([101, 102, 103]));
        expect(new Set(rankedGuides.map(({ source }) => source.slug))).toEqual(
          new Set([
            `title-${query}`,
            `description-${query}`,
            `body-${query}`,
          ]),
        );

        expect(classifyMatch(query, editDistanceDecoy)).toBeNull();
        expect(classifyMatch(query, phoneticDecoy)).toBeNull();
        expect(rankRobotSources(query, [{ id: 301, name: editDistanceDecoy, stableName: null }])).toEqual([]);
        expect(rankStableSources(query, [{ userId: 302, stableName: phoneticDecoy }])).toEqual([]);
        expect(
          rankGuideSources(query, [
            {
              slug: 'fuzzy-only',
              title: editDistanceDecoy,
              sectionSlug: 'fuzzy',
              sectionTitle: 'Fuzzy',
              description: phoneticDecoy,
              bodyText: editDistanceDecoy,
            },
          ]),
        ).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });
});
/**
 * Feature: universal-search, Property 3: Rank monotonicity and guide maximum rank
 *
 * **Validates: Design Property 3; Requirements 2.3, 2.4, 2.6, 9.1, 9.6**
 */

type GeneratedMatchRank = (typeof MATCH_RANK_ORDER)[number];

type RankFixture = {
  query: string;
  exact: string;
  prefix: string;
  substring: string;
};

const rankArbitrary = fc.constantFrom(...MATCH_RANK_ORDER);

const rankFixtureArbitrary: fc.Arbitrary<RankFixture> = fc
  .tuple(tokenArbitrary, tokenArbitrary, tokenArbitrary)
  .map(([query, prefixSeed, suffix]) => ({
    query,
    exact: query,
    prefix: `${query}${suffix}`,
    // The leading marker guarantees the query occurs away from position zero,
    // even when prefixSeed differs only by case from query.
    substring: `!${prefixSeed}${query}${suffix}`,
  }));

function valueForRank(fixture: RankFixture, rank: GeneratedMatchRank): string {
  return fixture[rank];
}

function strongestGuideRank(query: string, values: readonly string[]): GeneratedMatchRank | null {
  return (
    MATCH_RANK_ORDER.find((rank) =>
      values.some((value) => classifyMatch(query, value) === rank),
    ) ?? null
  );
}

function expectMonotonicRanks(
  rankedSources: readonly { rank: GeneratedMatchRank }[],
): void {
  const rankIndexes = rankedSources.map(({ rank }) => MATCH_RANK_ORDER.indexOf(rank));

  expect(rankIndexes).toEqual([...rankIndexes].sort((left, right) => left - right));
}

describe('Property 3: Rank monotonicity and guide maximum rank', () => {
  it('should order exact, prefix, and substring matches in every category and use the guide maximum rank', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          rankFixtureArbitrary,
          rankArbitrary,
          rankArbitrary,
          rankArbitrary,
        ),
        ([fixture, titleRank, descriptionRank, bodyRank]) => {
          const { query } = fixture;
          const robots = [
            { id: 3, name: fixture.substring, stableName: null },
            { id: 2, name: fixture.prefix, stableName: null },
            { id: 1, name: fixture.exact, stableName: null },
          ];
          const stables = [
            { userId: 103, stableName: fixture.substring },
            { userId: 102, stableName: fixture.prefix },
            { userId: 101, stableName: fixture.exact },
          ];
          const guides = [
            {
              slug: 'substring',
              title: fixture.substring,
              sectionSlug: 'rank-tests',
              sectionTitle: 'Rank Tests',
              description: fixture.substring,
              bodyText: fixture.substring,
            },
            {
              slug: 'prefix',
              title: fixture.prefix,
              sectionSlug: 'rank-tests',
              sectionTitle: 'Rank Tests',
              description: fixture.substring,
              bodyText: fixture.prefix,
            },
            {
              slug: 'exact',
              title: fixture.exact,
              sectionSlug: 'rank-tests',
              sectionTitle: 'Rank Tests',
              description: fixture.prefix,
              bodyText: fixture.substring,
            },
            {
              slug: 'generated',
              title: valueForRank(fixture, titleRank),
              sectionSlug: 'rank-tests',
              sectionTitle: 'Rank Tests',
              description: valueForRank(fixture, descriptionRank),
              bodyText: valueForRank(fixture, bodyRank),
            },
          ];

          const rankedRobots = rankRobotSources(query, robots);
          const rankedStables = rankStableSources(query, stables);
          const rankedGuides = rankGuideSources(query, guides);

          for (const rankedSources of [rankedRobots, rankedStables, rankedGuides]) {
            expectMonotonicRanks(rankedSources);
            expect(new Set(rankedSources.map(({ rank }) => rank))).toEqual(
              new Set(MATCH_RANK_ORDER),
            );
          }

          for (const { source, rank } of rankedGuides) {
            expect(rank).toBe(
              strongestGuideRank(query, [source.title, source.description, source.bodyText]),
            );
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
/**
 * Feature: universal-search, Property 4: Deterministic ordering
 *
 * **Validates: Design Property 4; Requirement 2.7, 9.1, 9.6**
 */

type MatchKind = 'exact' | 'prefix' | 'substring';

type MatchSeed = {
  kind: MatchKind;
  suffix: string;
  useUpperCase: boolean;
};

type SearchSourceCollection = {
  query: string;
  robots: RobotSearchSource[];
  stables: StableSearchSource[];
  guides: GuideSearchSource[];
};

type DeterministicOrderingFixture = SearchSourceCollection & {
  robotPermutation: RobotSearchSource[];
  stablePermutation: StableSearchSource[];
  guidePermutation: GuideSearchSource[];
};

const matchSeedArbitrary: fc.Arbitrary<MatchSeed> = fc.record({
  kind: fc.constantFrom<MatchKind>('exact', 'prefix', 'substring'),
  suffix: tokenArbitrary,
  useUpperCase: fc.boolean(),
});

function createMatchValue(query: string, seed: MatchSeed): string {
  const value = seed.kind === 'exact'
    ? query
    : seed.kind === 'prefix'
      ? `${query}${seed.suffix}`
      : `!${query}${seed.suffix}`;

  return seed.useUpperCase ? value.toUpperCase() : value;
}

function createRobotSources(query: string, seeds: readonly MatchSeed[]): RobotSearchSource[] {
  return seeds.map((seed, index) => ({
    id: index + 1,
    name: createMatchValue(query, seed),
    stableName: index % 2 === 0 ? `Stable ${index}` : null,
  }));
}

function createStableSources(query: string, seeds: readonly MatchSeed[]): StableSearchSource[] {
  return seeds.map((seed, index) => ({
    userId: index + 1001,
    stableName: createMatchValue(query, seed),
  }));
}

function createGuideSources(query: string, seeds: readonly MatchSeed[]): GuideSearchSource[] {
  return seeds.map((seed, index) => ({
    slug: `article-${index}-${seed.suffix}`,
    title: createMatchValue(query, seed),
    sectionSlug: `section-${index % 2}`,
    sectionTitle: `Section ${index % 2}`,
    description: `Description ${index}`,
    bodyText: `Body ${index}`,
  }));
}

function prependTieSeeds(extraSeeds: readonly MatchSeed[]): MatchSeed[] {
  const guaranteedTieSeeds: MatchSeed[] = [
    { kind: 'exact', suffix: 'a', useUpperCase: false },
    { kind: 'exact', suffix: 'b', useUpperCase: true },
    { kind: 'prefix', suffix: 'a', useUpperCase: false },
    { kind: 'prefix', suffix: 'b', useUpperCase: true },
    { kind: 'substring', suffix: 'a', useUpperCase: false },
    { kind: 'substring', suffix: 'b', useUpperCase: true },
  ];

  return [...guaranteedTieSeeds, ...extraSeeds];
}

const sourceSeedsArbitrary: fc.Arbitrary<MatchSeed[]> = fc
  .array(matchSeedArbitrary, { maxLength: 12 })
  .map((extraSeeds): MatchSeed[] => prependTieSeeds(extraSeeds));

const sourceCollectionArbitrary: fc.Arbitrary<SearchSourceCollection> = fc
  .tuple(tokenArbitrary, sourceSeedsArbitrary, sourceSeedsArbitrary, sourceSeedsArbitrary)
  .map(([query, robotSeeds, stableSeeds, guideSeeds]) => ({
    query,
    robots: createRobotSources(query, robotSeeds),
    stables: createStableSources(query, stableSeeds),
    guides: createGuideSources(query, guideSeeds),
  }));

const deterministicOrderingFixtureArbitrary: fc.Arbitrary<DeterministicOrderingFixture> =
  sourceCollectionArbitrary.chain((collection) =>
    fc
      .tuple(
        fc.shuffledSubarray(collection.robots, { minLength: collection.robots.length }),
        fc.shuffledSubarray(collection.stables, { minLength: collection.stables.length }),
        fc.shuffledSubarray(collection.guides, { minLength: collection.guides.length }),
      )
      .map(([robotPermutation, stablePermutation, guidePermutation]) => ({
        ...collection,
        robotPermutation,
        stablePermutation,
        guidePermutation,
      })),
  );

function rankAndShapeSources(query: string, sources: SearchSourceCollection): SearchResponse {
  return {
    robots: rankRobotSources(query, sources.robots).map(({ source }) => buildRobotSearchResult(source)),
    stables: rankStableSources(query, sources.stables)
      .map(({ source }) => buildStableSearchResult(source))
      .filter((result): result is NonNullable<ReturnType<typeof buildStableSearchResult>> => result !== null),
    guide: rankGuideSources(query, sources.guides).map(({ source }) => buildGuideSearchResult(source)),
  };
}

describe('Property 4: Deterministic ordering', () => {
  it('should preserve ranked safe result order across source permutations without mutating inputs', () => {
    fc.assert(
      fc.property(deterministicOrderingFixtureArbitrary, (fixture) => {
        const originalSnapshots = {
          robots: fixture.robots.map((source) => ({ ...source })),
          stables: fixture.stables.map((source) => ({ ...source })),
          guides: fixture.guides.map((source) => ({ ...source })),
        };
        const permutationSnapshots = {
          robots: fixture.robotPermutation.map((source) => ({ ...source })),
          stables: fixture.stablePermutation.map((source) => ({ ...source })),
          guides: fixture.guidePermutation.map((source) => ({ ...source })),
        };

        const rankedOriginal = rankAndShapeSources(fixture.query, fixture);
        const rankedPermutation = rankAndShapeSources(fixture.query, {
          query: fixture.query,
          robots: fixture.robotPermutation,
          stables: fixture.stablePermutation,
          guides: fixture.guidePermutation,
        });

        expect(rankedPermutation).toEqual(rankedOriginal);
        expect(fixture.robots).toEqual(originalSnapshots.robots);
        expect(fixture.stables).toEqual(originalSnapshots.stables);
        expect(fixture.guides).toEqual(originalSnapshots.guides);
        expect(fixture.robotPermutation).toEqual(permutationSnapshots.robots);
        expect(fixture.stablePermutation).toEqual(permutationSnapshots.stables);
        expect(fixture.guidePermutation).toEqual(permutationSnapshots.guides);
      }),
      { numRuns: 200 },
    );
  });
});
/**
 * Feature: universal-search, Property 5: Independent bounds and top-N selection
 *
 * **Validates: Design Property 5; Requirements 2.8–2.11, 4.7, 9.1, 9.6**
 */

type OversizedSourceCollection = SearchSourceCollection;

const oversizedSuffixesArbitrary = fc.array(tokenArbitrary, {
  minLength: MAX_RESULTS_PER_CATEGORY + 1,
  maxLength: MAX_RESULTS_PER_CATEGORY + 12,
});

function createOversizedMatchSeeds(
  suffixes: readonly string[],
  lateExactSuffix: string,
): MatchSeed[] {
  return [
    ...suffixes.map((suffix): MatchSeed => ({
      kind: 'substring',
      suffix,
      useUpperCase: false,
    })),
    {
      kind: 'exact',
      suffix: lateExactSuffix,
      useUpperCase: true,
    },
  ];
}

const oversizedSourceCollectionArbitrary: fc.Arbitrary<OversizedSourceCollection> = fc
  .tuple(
    tokenArbitrary,
    oversizedSuffixesArbitrary,
    oversizedSuffixesArbitrary,
    oversizedSuffixesArbitrary,
    tokenArbitrary,
    tokenArbitrary,
    tokenArbitrary,
  )
  .map(
    ([
      query,
      robotSuffixes,
      stableSuffixes,
      guideSuffixes,
      lateRobotSuffix,
      lateStableSuffix,
      lateGuideSuffix,
    ]) => ({
      query,
      robots: createRobotSources(
        query,
        createOversizedMatchSeeds(robotSuffixes, lateRobotSuffix),
      ),
      stables: createStableSources(
        query,
        createOversizedMatchSeeds(stableSuffixes, lateStableSuffix),
      ),
      guides: createGuideSources(
        query,
        createOversizedMatchSeeds(guideSuffixes, lateGuideSuffix),
      ),
    }),
  );

function rankAndBoundSources(query: string, sources: SearchSourceCollection): SearchResponse {
  const rankedRobots = rankRobotSources(query, sources.robots);
  const rankedStables = rankStableSources(query, sources.stables);
  const rankedGuides = rankGuideSources(query, sources.guides);

  return {
    robots: limitCategoryResults(rankedRobots).map(({ source }) => buildRobotSearchResult(source)),
    stables: limitCategoryResults(rankedStables)
      .map(({ source }) => buildStableSearchResult(source))
      .filter((result): result is NonNullable<ReturnType<typeof buildStableSearchResult>> => result !== null),
    guide: limitCategoryResults(rankedGuides).map(({ source }) => buildGuideSearchResult(source)),
  };
}

describe('Property 5: Independent bounds and top-N selection', () => {
  it('should bound each independently ranked category and retain late higher-ranked matches', () => {
    fc.assert(
      fc.property(oversizedSourceCollectionArbitrary, (fixture) => {
        const rankedRobots = rankRobotSources(fixture.query, fixture.robots);
        const rankedStables = rankStableSources(fixture.query, fixture.stables);
        const rankedGuides = rankGuideSources(fixture.query, fixture.guides);
        const response = rankAndBoundSources(fixture.query, fixture);

        expect(response.robots).toHaveLength(MAX_RESULTS_PER_CATEGORY);
        expect(response.stables).toHaveLength(MAX_RESULTS_PER_CATEGORY);
        expect(response.guide).toHaveLength(MAX_RESULTS_PER_CATEGORY);

        const totalResultCount = response.robots.length + response.stables.length + response.guide.length;
        expect(totalResultCount).toBeLessThanOrEqual(MAX_TOTAL_RESULTS);

        expect(response.robots.map(({ id }) => id)).toEqual(
          rankedRobots
            .slice(0, MAX_RESULTS_PER_CATEGORY)
            .map(({ source }) => source.id),
        );
        expect(response.stables.map(({ userId }) => userId)).toEqual(
          rankedStables
            .slice(0, MAX_RESULTS_PER_CATEGORY)
            .map(({ source }) => source.userId),
        );
        expect(response.guide.map(({ articleSlug }) => articleSlug)).toEqual(
          rankedGuides
            .slice(0, MAX_RESULTS_PER_CATEGORY)
            .map(({ source }) => source.slug),
        );

        // The exact match is deliberately appended after lower-ranked sources;
        // ranking the complete collection must select it before the category cap.
        expect(response.robots[0]?.id).toBe(fixture.robots[fixture.robots.length - 1]?.id);
        expect(response.stables[0]?.userId).toBe(fixture.stables[fixture.stables.length - 1]?.userId);
        expect(response.guide[0]?.articleSlug).toBe(fixture.guides[fixture.guides.length - 1]?.slug);
      }),
      { numRuns: 200 },
    );
  });
});
