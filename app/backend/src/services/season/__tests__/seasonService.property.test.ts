/**
 * Property tests for Season_Cycle derivation (Spec #45 design Property 2).
 *
 * The cycle number is what players read to know how much of a season remains,
 * and it must be a pure function of the stored counters — never derived from
 * wall-clock time, so a restart or a clock change cannot shift it.
 */

import fc from 'fast-check';
import { deriveSeasonState, LEGACY_SEASON_NUMBER } from '../seasonService';

describe('deriveSeasonState — Property 2: Season_Cycle is a total function of the counters', () => {
  it('should report competitiveCyclesCompleted + 1 while competitive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 1, max: 1000 }),
        (seasonNumber, completed, length) => {
          const state = deriveSeasonState(
            {
              seasonNumber,
              phase: 'competitive',
              competitiveCyclesCompleted: completed,
              preparationCyclesCompleted: 0,
            },
            length,
            2,
          );
          expect(state.seasonCycle).toBe(completed + 1);
          expect(state.preparationDay).toBe(0);
          expect(state.seasonCycle).toBeGreaterThan(0);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('should report cycle 0 and a 1-based preparation day while preparing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        (seasonNumber, prepCompleted, prepLength) => {
          const state = deriveSeasonState(
            {
              seasonNumber,
              phase: 'preparation',
              competitiveCyclesCompleted: 0,
              preparationCyclesCompleted: prepCompleted,
            },
            100,
            prepLength,
          );
          expect(state.seasonCycle).toBe(0);
          expect(state.preparationDay).toBe(prepCompleted + 1);
          expect(state.remainingPreparationCycles).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('should never report a negative remaining count, even past the boundary', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 1, max: 100 }),
        (completed, length) => {
          const state = deriveSeasonState(
            {
              seasonNumber: 3,
              phase: 'competitive',
              competitiveCyclesCompleted: completed,
              preparationCyclesCompleted: 0,
            },
            length,
            2,
          );
          expect(state.remainingCompetitiveCycles).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should treat only season 0 as legacy and give it no remaining count', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), fc.integer({ min: 100, max: 400 }), (n, completed) => {
        const state = deriveSeasonState(
          {
            seasonNumber: n,
            phase: 'competitive',
            competitiveCyclesCompleted: completed,
            preparationCyclesCompleted: 0,
          },
          100,
          2,
        );
        expect(state.isLegacy).toBe(n === LEGACY_SEASON_NUMBER);
        if (state.isLegacy) {
          // Season_Zero has no fixed length, so it advertises no countdown even
          // though its completed count far exceeds Season_Length_Cycles.
          expect(state.remainingCompetitiveCycles).toBe(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('should apply a season length override without moving the cycle backwards', () => {
    // Regression: extending a season originally rewound
    // `competitiveCyclesCompleted`, which deferred the boundary but made the
    // cycle number the player reads go backwards and understated the cycle count
    // written to the archive.
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (completed, configuredLength, extension) => {
          const base = deriveSeasonState(
            {
              seasonNumber: 3,
              phase: 'competitive',
              competitiveCyclesCompleted: completed,
              preparationCyclesCompleted: 0,
            },
            configuredLength,
            2,
          );

          const extended = deriveSeasonState(
            {
              seasonNumber: 3,
              phase: 'competitive',
              competitiveCyclesCompleted: completed,
              preparationCyclesCompleted: 0,
              lengthOverrideCycles: configuredLength + extension,
            },
            configuredLength,
            2,
          );

          // The cycle the player reads is unchanged by an extension.
          expect(extended.seasonCycle).toBe(base.seasonCycle);
          // The denominator grows, and so does the remaining count.
          expect(extended.seasonLengthCycles).toBe(configuredLength + extension);
          expect(extended.remainingCompetitiveCycles).toBeGreaterThanOrEqual(
            base.remainingCompetitiveCycles,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should ignore a length override for the legacy season', () => {
    const state = deriveSeasonState(
      {
        seasonNumber: 0,
        phase: 'competitive',
        competitiveCyclesCompleted: 118,
        preparationCyclesCompleted: 0,
        lengthOverrideCycles: 200,
      },
      100,
      2,
    );
    // Season 0 has no fixed length, so it advertises no countdown regardless.
    expect(state.remainingCompetitiveCycles).toBe(0);
    expect(state.seasonCycle).toBe(119);
  });

  it('should report the true cycle for a legacy season past the configured length', () => {
    const state = deriveSeasonState(
      {
        seasonNumber: 0,
        phase: 'competitive',
        competitiveCyclesCompleted: 118,
        preparationCyclesCompleted: 0,
      },
      100,
      2,
    );
    expect(state.seasonCycle).toBe(119);
    expect(state.isLegacy).toBe(true);
    expect(state.remainingCompetitiveCycles).toBe(0);
  });
});
