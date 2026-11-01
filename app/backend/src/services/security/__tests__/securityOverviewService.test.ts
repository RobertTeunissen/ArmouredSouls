/**
 * Burst detection of the Security page. The SQL aggregation is covered by
 * tests/integration/adminSecurityModeration.test.ts.
 */
import fc from 'fast-check';

jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: {} }));

import { largestBurst } from '../securityOverviewService';

const at = (minutes: number): Date => new Date(Date.UTC(2026, 10, 1, 12, 0) + minutes * 60_000);
const WINDOW = 15 * 60_000;

describe('largestBurst', () => {
  it('finds the busiest 15-minute span and when it ended', () => {
    const burst = largestBurst([at(0), at(1), at(30), at(31), at(32), at(40), at(44)], WINDOW);
    expect(burst).toEqual({ count: 5, at: at(44) });
  });

  it('counts a span exactly 15 minutes long, and not one a minute longer', () => {
    expect(largestBurst([at(0), at(15)], WINDOW)?.count).toBe(2);
    expect(largestBurst([at(0), at(16)], WINDOW)?.count).toBe(1);
  });

  it('returns null without failed logins', () => {
    expect(largestBurst([], WINDOW)).toBeNull();
  });

  it('never exceeds the number of attempts, and equals it when they all fit in one window', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 600 }), { minLength: 1, maxLength: 40 }), (minutes) => {
        const sorted = [...minutes].sort((a, b) => a - b).map(at);
        const burst = largestBurst(sorted, WINDOW);
        expect(burst?.count).toBeLessThanOrEqual(sorted.length);
        if (Math.max(...minutes) - Math.min(...minutes) <= 15) expect(burst?.count).toBe(sorted.length);
      }),
      { numRuns: 100 },
    );
  });
});
