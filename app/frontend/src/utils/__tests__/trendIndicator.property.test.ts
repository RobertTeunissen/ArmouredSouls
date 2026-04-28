/**
 * Property-based tests for the trend indicator utility.
 * Uses fast-check to verify correctness across generated numeric pairs.
 *
 * Tagged with property number and validated requirements.
 * Minimum 100 iterations per property.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getTrendIndicator } from '../trendIndicator';

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 5: Trend indicator correctness', () => {
  /**
   * **Validates: Requirements 5.2**
   *
   * For any pair of numeric values (current, previous), the trend indicator
   * returns 'up' when current > previous, 'down' when current < previous,
   * and 'neutral' when current === previous.
   */

  it('returns "up" when current > previous (integers)', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        (a, b) => {
          // Ensure a > b by using sorted pair
          const current = Math.max(a, b);
          const previous = Math.min(a, b);
          if (current === previous) return; // skip equal pairs
          expect(getTrendIndicator(current, previous)).toBe('up');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns "down" when current < previous (integers)', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        (a, b) => {
          const current = Math.min(a, b);
          const previous = Math.max(a, b);
          if (current === previous) return; // skip equal pairs
          expect(getTrendIndicator(current, previous)).toBe('down');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns "neutral" when current === previous (integers)', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        (value) => {
          expect(getTrendIndicator(value, value)).toBe('neutral');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns correct direction for float pairs', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (current, previous) => {
          const result = getTrendIndicator(current, previous);
          if (current > previous) expect(result).toBe('up');
          else if (current < previous) expect(result).toBe('down');
          else expect(result).toBe('neutral');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns correct direction for any arbitrary number pair', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.double({ noNaN: true, noDefaultInfinity: true }),
        ),
        fc.oneof(
          fc.integer(),
          fc.double({ noNaN: true, noDefaultInfinity: true }),
        ),
        (current, previous) => {
          const result = getTrendIndicator(current, previous);
          if (current > previous) expect(result).toBe('up');
          else if (current < previous) expect(result).toBe('down');
          else expect(result).toBe('neutral');
        },
      ),
      { numRuns: 200 },
    );
  });
});
