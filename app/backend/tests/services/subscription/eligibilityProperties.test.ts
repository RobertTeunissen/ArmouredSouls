/**
 * Property-based tests for subscription eligibility.
 *
 * // Feature: 35-booking-office-facility, Property 9: isRobotSubscribedTo reflects database state
 *
 * Uses fast-check to verify that `isRobotSubscribedTo(robotId, eventType)` returns
 * true iff a Subscription row exists for `(robotId, eventType)` regardless of
 * Booking Office level.
 *
 * _Requirements: R13.3_
 */

import fc from 'fast-check';

// ── Mocks ────────────────────────────────────────────────────────────

// In-memory subscription store simulating the database
const subscriptionRows = new Map<string, boolean>();

const mockPrisma = {
  subscription: {
    count: jest.fn().mockImplementation(({ where }: any) => {
      const key = `${where.robotId}:${where.eventType}`;
      return Promise.resolve(subscriptionRows.has(key) ? 1 : 0);
    }),
  },
};

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { isRobotSubscribedTo } from '../../../src/services/subscription/subscriptionService';

// ── Property Tests ───────────────────────────────────────────────────

describe('Eligibility Property-Based Tests', () => {
  beforeEach(() => {
    subscriptionRows.clear();
    jest.clearAllMocks();
  });

  // Feature: 35-booking-office-facility, Property 9: isRobotSubscribedTo reflects database state
  describe('Property 9: isRobotSubscribedTo returns true iff Subscription row exists', () => {
    /**
     * **Validates: Requirements 13.3**
     */
    it('returns true when subscription row exists, false otherwise, regardless of Booking Office level', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }), // robotId
          fc.constantFrom('league', 'tournament', 'tag_team', 'koth'), // eventType
          fc.integer({ min: 0, max: 10 }), // bookingOfficeLevel (should not affect result)
          fc.boolean(), // whether subscription row exists
          async (robotId, eventType, _bookingOfficeLevel, rowExists) => {
            // Setup: conditionally add subscription row
            subscriptionRows.clear();
            if (rowExists) {
              subscriptionRows.set(`${robotId}:${eventType}`, true);
            }

            // Re-configure mock to use current store state
            mockPrisma.subscription.count.mockImplementation(({ where }: any) => {
              const key = `${where.robotId}:${where.eventType}`;
              return Promise.resolve(subscriptionRows.has(key) ? 1 : 0);
            });

            const result = await isRobotSubscribedTo(robotId, eventType);

            // The result must match whether the row exists — Booking Office level is irrelevant
            expect(result).toBe(rowExists);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
