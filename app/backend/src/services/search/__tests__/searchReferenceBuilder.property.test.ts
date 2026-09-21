/**
 * Feature: universal-search, Property 6: Player-safe reference shaping
 *
 * **Validates: Design Property 6; Requirements 3.1, 3.4–3.7, 3.11–3.15, 8.8, 9.1, 9.6**
 */

import fc from 'fast-check';
import { describe, expect, it } from '@jest/globals';
import {
  buildGuideSearchResult,
  buildRobotSearchResult,
  buildStableSearchResult,
} from '../searchReferenceBuilder';
import type {
  GuideSearchSource,
  RobotSearchSource,
  StableSearchSource,
} from '../searchTypes';

const arbitraryText = fc.string({ maxLength: 40 });
const arbitraryValue = fc.oneof(
  arbitraryText,
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
);

const sourceFields = new Set([
  'id',
  'name',
  'stableName',
  'userId',
  'slug',
  'title',
  'sectionSlug',
  'sectionTitle',
  'description',
  'bodyText',
]);

const extraFieldsArbitrary = fc
  .array(
    fc.tuple(
      fc.stringMatching(/^[A-Za-z][A-Za-z0-9_]{0,12}$/).filter((key) => !sourceFields.has(key)),
      arbitraryValue,
    ),
    { maxLength: 8 },
  )
  .map((entries) => Object.fromEntries(entries) as Record<string, unknown>);

const positiveIdArbitrary = fc.integer({ min: 1, max: 1_000_000 });

function addPrivateDecoys<T extends Record<string, unknown>>(
  source: T,
  extraFields: Record<string, unknown>,
): T {
  return {
    ...source,
    ...extraFields,
    username: 'private-username',
    password: 'hashed-password',
    credentials: { token: 'secret-token' },
    route: '/admin/arbitrary-route',
    targetRoute: '/robots/999',
    privateMetadata: { email: 'private@example.test' },
  } as T;
}

describe('Property 6: Player-safe reference shaping', () => {
  it('emits only approved robot fields for arbitrary private source data', () => {
    fc.assert(
      fc.property(
        positiveIdArbitrary,
        arbitraryText,
        fc.oneof(fc.constant(null), arbitraryText),
        extraFieldsArbitrary,
        (id, name, stableName, extraFields) => {
          const source = addPrivateDecoys<RobotSearchSource & Record<string, unknown>>(
            { id, name, stableName },
            extraFields,
          );
          const result = buildRobotSearchResult(source);
          const approvedKeys = stableName?.trim()
            ? ['category', 'id', 'label', 'subtitle']
            : ['category', 'id', 'label'];

          expect(Object.keys(result).sort()).toEqual(approvedKeys.sort());
          expect(result.category).toBe('robots');
          expect(result.id).toBe(id);
          expect(result.label).toBe(name);
          expect(result).not.toHaveProperty('username');
          expect(result).not.toHaveProperty('password');
          expect(result).not.toHaveProperty('credentials');
          expect(result).not.toHaveProperty('route');
          expect(result).not.toHaveProperty('targetRoute');
          expect(result).not.toHaveProperty('privateMetadata');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('emits only approved stable fields and never uses private account data', () => {
    fc.assert(
      fc.property(
        positiveIdArbitrary,
        arbitraryText.filter((value) => value.trim().length > 0),
        extraFieldsArbitrary,
        (userId, stableName, extraFields) => {
          const source = addPrivateDecoys<StableSearchSource & Record<string, unknown>>(
            { userId, stableName },
            extraFields,
          );
          const result = buildStableSearchResult(source);

          expect(result).toEqual({
            category: 'stables',
            userId,
            label: stableName.trim(),
          });
          expect(Object.keys(result ?? {}).sort()).toEqual(['category', 'label', 'userId']);
          expect(result).not.toHaveProperty('username');
          expect(result).not.toHaveProperty('password');
          expect(result).not.toHaveProperty('credentials');
          expect(result).not.toHaveProperty('route');
          expect(result).not.toHaveProperty('targetRoute');
          expect(result).not.toHaveProperty('privateMetadata');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('emits only approved guide fields and never returns body or arbitrary routes', () => {
    fc.assert(
      fc.property(
        arbitraryText,
        arbitraryText,
        arbitraryText,
        arbitraryText,
        arbitraryText,
        arbitraryText,
        extraFieldsArbitrary,
        (slug, title, sectionSlug, sectionTitle, description, bodyText, extraFields) => {
          const source = addPrivateDecoys<GuideSearchSource & Record<string, unknown>>(
            { slug, title, sectionSlug, sectionTitle, description, bodyText },
            extraFields,
          );
          const result = buildGuideSearchResult(source);

          expect(result).toEqual({
            category: 'guide',
            title,
            sectionTitle,
            sectionSlug,
            articleSlug: slug,
          });
          expect(Object.keys(result).sort()).toEqual([
            'articleSlug',
            'category',
            'sectionSlug',
            'sectionTitle',
            'title',
          ]);
          expect(result).not.toHaveProperty('bodyText');
          expect(result).not.toHaveProperty('description');
          expect(result).not.toHaveProperty('username');
          expect(result).not.toHaveProperty('password');
          expect(result).not.toHaveProperty('credentials');
          expect(result).not.toHaveProperty('route');
          expect(result).not.toHaveProperty('targetRoute');
          expect(result).not.toHaveProperty('privateMetadata');
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Feature: universal-search, Property 7: Stable eligibility independence
 *
 * **Validates: Design Property 7; Requirements 1.4, 1.6, 3.9–3.10, 9.1, 9.6**
 */
const stableNameArbitrary = fc.oneof(
  fc.constant(null),
  fc.constant(''),
  fc
    .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 8 })
    .map((characters) => characters.join('')),
  fc.string({ minLength: 1, maxLength: 40 }).filter((value) => value.trim().length > 0),
);

const stableMetadataArbitrary = fc.constantFrom(
  { profileVisibility: 'public' as const, isGenerated: false },
  { profileVisibility: 'public' as const, isGenerated: true },
  { profileVisibility: 'private' as const, isGenerated: false },
  { profileVisibility: 'private' as const, isGenerated: true },
);

describe('Property 7: Stable eligibility independence', () => {
  it('depends only on the trimmed stable name, not visibility or generated metadata', () => {
    fc.assert(
      fc.property(
        positiveIdArbitrary,
        stableNameArbitrary,
        stableMetadataArbitrary,
        (userId, stableName, metadata) => {
          const expected = stableName?.trim()
            ? {
                category: 'stables' as const,
                userId,
                label: stableName.trim(),
              }
            : null;
          const source: StableSearchSource & Record<string, unknown> = {
            userId,
            stableName,
            ...metadata,
          };

          expect(buildStableSearchResult(source)).toEqual(expected);
          expect(buildStableSearchResult({ userId, stableName })).toEqual(expected);
        },
      ),
      { numRuns: 200 },
    );
  });
});
