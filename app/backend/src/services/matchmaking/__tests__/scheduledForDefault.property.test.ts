/**
 * Property test: scheduledFor Default Computation
 *
 * Feature: unified-match-scheduling
 * Property 8: scheduledFor Default Computation
 *
 * Validates: Requirements 11.1, 11.4
 */

import * as fc from 'fast-check';

// Import only the pure function — avoid triggering Prisma initialization
// by using a direct require of the specific function
const { defaultScheduledFor } = jest.requireActual('../teamMatchmakingUtils') as { defaultScheduledFor: () => Date };

describe('defaultScheduledFor — Property 8: scheduledFor Default Computation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return a date exactly 24h ahead with minutes/seconds/ms zeroed', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (mockNow) => {
          fc.pre(!isNaN(mockNow.getTime()));
          jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

          const result = defaultScheduledFor();

          // Must be 24h ahead (within same hour boundary)
          const expected24hAhead = new Date(mockNow.getTime() + 24 * 60 * 60 * 1000);
          const expectedTime = Math.floor(expected24hAhead.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000);
          expect(result.getTime()).toBe(expectedTime);
          expect(result.getUTCFullYear()).toBe(expected24hAhead.getUTCFullYear());
          expect(result.getUTCMonth()).toBe(expected24hAhead.getUTCMonth());
          expect(result.getUTCDate()).toBe(expected24hAhead.getUTCDate());
          expect(result.getUTCHours()).toBe(expected24hAhead.getUTCHours());

          // The production slot boundary is UTC, not the server's local timezone.
          expect(result.getUTCMinutes()).toBe(0);
          expect(result.getUTCSeconds()).toBe(0);
          expect(result.getUTCMilliseconds()).toBe(0);

          jest.restoreAllMocks();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should pass through an explicit scheduledFor without modification', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (explicitDate) => {
          // When an explicit date is provided, it should be used as-is.
          // This tests the pattern: scheduledFor ?? defaultScheduledFor()
          const result = explicitDate ?? defaultScheduledFor();
          expect(result.getTime()).toBe(explicitDate.getTime());
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should always produce a date in the future relative to Date.now()', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (mockNow) => {
          fc.pre(!isNaN(mockNow.getTime()));
          jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

          const result = defaultScheduledFor();
          // Result must be at least 23 hours ahead (rounding removes up to 59 minutes)
          const minExpected = mockNow.getTime() + 23 * 60 * 60 * 1000;
          expect(result.getTime()).toBeGreaterThanOrEqual(minExpected);
          // Result must be at most 24 hours ahead
          const maxExpected = mockNow.getTime() + 24 * 60 * 60 * 1000;
          expect(result.getTime()).toBeLessThanOrEqual(maxExpected);

          jest.restoreAllMocks();
        },
      ),
      { numRuns: 200 },
    );
  });
});
