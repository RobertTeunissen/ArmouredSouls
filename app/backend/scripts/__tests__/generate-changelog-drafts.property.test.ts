/**
 * Property-based tests for the changelog auto-generator script.
 *
 * Property 10: Auto-generator creates correct drafts from specs
 * Property 11: Auto-generator category heuristics
 * Property 12: Auto-generator idempotency
 *
 * Uses fast-check for property-based testing with Jest.
 */

import fc from 'fast-check';
import {
  categorizeSpec,
  generateDrafts,
  DraftEntry,
} from '../generate-changelog-drafts';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a lowercase alpha word */
const lowerWordArb = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 2,
    maxLength: 12,
  })
  .map((chars) => chars.join(''));

/** Generate a valid spec directory name (number-kebab-case) */
const specNameArb = fc
  .tuple(
    fc.integer({ min: 1, max: 999 }),
    fc.array(lowerWordArb, { minLength: 1, maxLength: 4 }),
  )
  .map(([num, words]) => `${num}-${words.join('-')}`);

/** Generate a spec directory path */
const specDirArb = specNameArb.map(
  (name) => `.kiro/specs/done-april26/${name}`,
);

/** Generate a set of unique spec directories */
const specDirsArb = fc
  .uniqueArray(specDirArb, {
    minLength: 1,
    maxLength: 10,
    comparator: (a, b) => a === b,
  });

/** Generate a spec name that contains "fix" or "bug" */
const bugfixSpecNameArb = fc.oneof(
  specNameArb.map((name) => name + '-fix'),
  specNameArb.map((name) => name + '-bug'),
  fc.constant('15-hotfix-combat'),
  fc.constant('3-bugfix-credits'),
);

/** Generate a spec name that contains "balance" */
const balanceSpecNameArb = fc.oneof(
  specNameArb.map((name) => name + '-balance'),
  fc.constant('8-weapon-balance-pass'),
);

/** Generate a spec name that is a generic feature (no fix/bug/balance) */
const featureSpecNameArb = specNameArb.filter((name) => {
  const lower = name.toLowerCase();
  return !lower.includes('fix') && !lower.includes('bug') && !lower.includes('balance');
});

// ---------------------------------------------------------------------------
// Property 10: Auto-generator creates correct drafts from specs
// ---------------------------------------------------------------------------
describe('Property 10: Auto-generator creates correct drafts from specs', () => {
  /**
   * **Validates: Requirements 8.4, 8.7**
   *
   * For any set of completed spec directories, creates exactly one draft
   * per spec with sourceType "spec" and sourceRef = spec directory name.
   */
  it('should create exactly one draft per spec with correct sourceType and sourceRef', () => {
    fc.assert(
      fc.property(specDirsArb, (specDirs) => {
        const mockReadIntro = (): string => 'Test introduction text.';
        const drafts = generateDrafts(specDirs, [], new Set(), mockReadIntro);

        // Exactly one draft per spec
        expect(drafts).toHaveLength(specDirs.length);

        // Each draft has sourceType "spec"
        for (const draft of drafts) {
          expect(draft.sourceType).toBe('spec');
          expect(draft.status).toBe('draft');
        }

        // sourceRef matches the spec directory basename
        const expectedRefs = specDirs.map((d) => {
          const parts = d.split('/');
          return parts[parts.length - 1];
        });
        const actualRefs = drafts.map((d) => d.sourceRef);
        expect(actualRefs.sort()).toEqual(expectedRefs.sort());
      }),
      { numRuns: 100 },
    );
  });

  it('should set non-empty title and body for each spec draft', () => {
    fc.assert(
      fc.property(specDirsArb, (specDirs) => {
        const mockReadIntro = (): string => 'Some introduction.';
        const drafts = generateDrafts(specDirs, [], new Set(), mockReadIntro);

        for (const draft of drafts) {
          expect(draft.title.length).toBeGreaterThan(0);
          expect(draft.body.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});

/** Generate a hex-like SHA string */
const shaArb = fc
  .array(fc.constantFrom(...'0123456789abcdef'.split('')), {
    minLength: 10,
    maxLength: 10,
  })
  .map((chars) => chars.join(''));

/** Generate a commit info object */
const commitArb = fc.tuple(shaArb, fc.string({ minLength: 1, maxLength: 80 })).map(
  ([sha, message]) => ({ sha, message }),
);

// ---------------------------------------------------------------------------
// Property 11: Auto-generator category heuristics
// ---------------------------------------------------------------------------
describe('Property 11: Auto-generator category heuristics', () => {
  /**
   * **Validates: Requirements 8.6**
   *
   * For any spec name, assigns "bugfix" when name contains "fix"/"bug",
   * "balance" when contains "balance", "feature" otherwise.
   * Commit entries default to "bugfix".
   */
  it('should assign bugfix when spec name contains "fix" or "bug"', () => {
    fc.assert(
      fc.property(bugfixSpecNameArb, (specName) => {
        expect(categorizeSpec(specName)).toBe('bugfix');
      }),
      { numRuns: 100 },
    );
  });

  it('should assign balance when spec name contains "balance"', () => {
    fc.assert(
      fc.property(balanceSpecNameArb, (specName) => {
        expect(categorizeSpec(specName)).toBe('balance');
      }),
      { numRuns: 100 },
    );
  });

  it('should assign feature for spec names without fix/bug/balance', () => {
    fc.assert(
      fc.property(featureSpecNameArb, (specName) => {
        expect(categorizeSpec(specName)).toBe('feature');
      }),
      { numRuns: 100 },
    );
  });

  it('should default commit-based entries to bugfix', () => {
    fc.assert(
      fc.property(
        fc.array(commitArb, { minLength: 1, maxLength: 5 }),
        (commits) => {
          const drafts = generateDrafts([], commits, new Set(), () => '');
          const commitDrafts = drafts.filter((d) => d.sourceType === 'commit');
          for (const draft of commitDrafts) {
            expect(draft.category).toBe('bugfix');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Auto-generator idempotency
// ---------------------------------------------------------------------------
describe('Property 12: Auto-generator idempotency', () => {
  /**
   * **Validates: Requirements 8.10**
   *
   * Running twice with same inputs produces same number of entries as
   * running once (no duplicates, verified by sourceRef uniqueness).
   */
  it('should produce no duplicates when run twice with same inputs', () => {
    fc.assert(
      fc.property(
        specDirsArb,
        fc.array(commitArb, { minLength: 0, maxLength: 5 }),
        (specDirs, commits) => {
          const mockReadIntro = (): string => 'Test intro.';

          // First run
          const firstRun = generateDrafts(
            specDirs,
            commits,
            new Set(),
            mockReadIntro,
          );

          // Collect sourceRefs from first run
          const existingRefs = new Set(firstRun.map((d) => d.sourceRef));

          // Second run with existing refs
          const secondRun = generateDrafts(
            specDirs,
            commits,
            existingRefs,
            mockReadIntro,
          );

          // Second run should produce zero new entries
          expect(secondRun).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should have unique sourceRefs within a single run', () => {
    fc.assert(
      fc.property(specDirsArb, (specDirs) => {
        const mockReadIntro = (): string => 'Test intro.';
        const drafts = generateDrafts(specDirs, [], new Set(), mockReadIntro);

        const refs = drafts.map((d) => d.sourceRef);
        const uniqueRefs = new Set(refs);
        expect(uniqueRefs.size).toBe(refs.length);
      }),
      { numRuns: 100 },
    );
  });
});
