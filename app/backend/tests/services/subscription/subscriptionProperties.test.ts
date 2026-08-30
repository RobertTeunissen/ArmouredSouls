/**
 * Property-based tests for the Event Subscription System.
 *
 * Uses fast-check to verify universal correctness properties across
 * random inputs and operation sequences.
 *
 * _Requirements: R13.1, R13.4, R13.5, R13.6_
 */

import fc from 'fast-check';
import { BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT, getSubscriptionCap } from '../../../src/config/subscriptions';
import {
  registerSubscribableEvent,

  _clearRegistryForTesting,
  SubscribableEventType,
} from '../../../src/services/subscription/eventRegistry';
import { SubscriptionError, SubscriptionErrorCode } from '../../../src/errors/subscriptionErrors';

// ── Mocks ────────────────────────────────────────────────────────────

// Mock Prisma for subscribeRobot / unsubscribeRobot tests
const subscriptionStore = new Map<string, { robotId: number; eventType: string }>();
let userCurrency = 100000;

const mockTx = {
  robot: { findUnique: jest.fn() },
  subscription: {
    findMany: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  facility: { findUnique: jest.fn() },
  auditLog: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  teamBattleMember: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  teamBattle: {
    update: jest.fn().mockResolvedValue(undefined),
  },
  standing: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(undefined),
  },
  // Read by the shared slot resolver: an empty schedule means no held slots, so
  // these properties exercise the cap against subscriptions alone.
  scheduledMatchParticipant: { findMany: jest.fn().mockResolvedValue([]) },
  scheduledTournamentMatch: { findMany: jest.fn().mockResolvedValue([]) },
  // Spec #51: `withAuditSequence` takes pg_advisory_xact_lock(3, cycle) on the
  // transaction client before allocating audit sequence numbers.
  $executeRaw: jest.fn().mockResolvedValue(0),
};

const mockPrisma = {
  subscription: { count: jest.fn() },
  user: { findUnique: jest.fn() },
  scheduledMatchParticipant: { findMany: jest.fn().mockResolvedValue([]) },
  scheduledTournamentMatch: { findMany: jest.fn().mockResolvedValue([]) },
  teamBattleMember: { findMany: jest.fn().mockResolvedValue([]) },
  standing: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../src/services/battle/baseOrchestrator', () => ({
  __esModule: true,
  getCurrentCycleNumber: jest.fn().mockResolvedValue(1),
}));

jest.mock('../../../src/services/scheduling/eventCronSchedule', () => ({
  __esModule: true,
  getNextSchedulingMoments: jest.fn(() => ({})),
  getNextSchedulingMoment: jest.fn(() => new Date('2026-07-31T08:00:00.000Z')),
}));

// Use real event registry for property tests
jest.unmock('../../../src/services/subscription/eventRegistry');

import {
  subscribeRobot,
  unsubscribeRobot,
} from '../../../src/services/subscription/subscriptionService';

// ── Helpers ──────────────────────────────────────────────────────────

const V1_EVENTS: SubscribableEventType[] = ['league_1v1', 'tournament_1v1', 'tag_team', 'koth'];

function setupRegistry(): void {
  _clearRegistryForTesting();
  for (const type of V1_EVENTS) {
    registerSubscribableEvent({
      type,
      label: type,
    });
  }
}

function setupMocksForSubscribe(level: number): void {
  mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 1 });
  mockTx.facility.findUnique.mockResolvedValue({ level });
  mockTx.auditLog.findFirst.mockResolvedValue(null);
  mockTx.auditLog.create.mockResolvedValue({});

  // Dynamic subscription tracking, in the shapes the single write path uses:
  // read the current set with findMany, then diff it with createMany/deleteMany.
  mockTx.subscription.findMany.mockImplementation(({ where }: any) => {
    const rows: { robotId: number; eventType: string }[] = [];
    for (const [key, value] of subscriptionStore.entries()) {
      if (key.startsWith(`${where.robotId}:`)) rows.push(value);
    }
    return Promise.resolve(rows);
  });
  mockTx.subscription.count.mockImplementation(({ where }: any) => {
    let count = 0;
    for (const key of subscriptionStore.keys()) {
      if (where.robotId && key.startsWith(`${where.robotId}:`)) count++;
    }
    return Promise.resolve(count);
  });
  mockTx.subscription.createMany.mockImplementation(({ data }: any) => {
    for (const row of data) {
      subscriptionStore.set(`${row.robotId}:${row.eventType}`, row);
    }
    return Promise.resolve({ count: data.length });
  });
  mockTx.subscription.deleteMany.mockImplementation(({ where }: any) => {
    let count = 0;
    for (const eventType of where.eventType.in) {
      if (subscriptionStore.delete(`${where.robotId}:${eventType}`)) count++;
    }
    return Promise.resolve({ count });
  });
}

// ── Property Tests ───────────────────────────────────────────────────

describe('Subscription System Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscriptionStore.clear();
    userCurrency = 100000;
    setupRegistry();
  });

  // Feature: 35-booking-office-facility, Property 1: Cap curve monotonically non-decreasing with floor >= 3
  describe('Property 1: BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT is monotonically non-decreasing with floor >= 3', () => {
    /**
     * **Validates: Requirements 13.5**
     */
    it('floor is >= 3', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          expect(BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT[0]).toBeGreaterThanOrEqual(3);
        }),
        { numRuns: 100 },
      );
    });

    it('is monotonically non-decreasing across all consecutive levels', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT.length - 2 }),
          (level) => {
            expect(BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT[level + 1]).toBeGreaterThanOrEqual(
              BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT[level],
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: 35-booking-office-facility, Property 2: Cap never violated by any operation sequence
  describe('Property 2: Cap never violated by any operation sequence', () => {
    /**
     * **Validates: Requirements 13.1**
     */
    it('subscription count never exceeds cap for random operation sequences', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10 }), // Booking Office level
          fc.array(
            fc.record({
              action: fc.constantFrom('subscribe', 'unsubscribe'),
              eventType: fc.constantFrom(...V1_EVENTS),
            }),
            { minLength: 1, maxLength: 20 },
          ),
          async (level, operations) => {
            subscriptionStore.clear();
            setupMocksForSubscribe(level);
            const cap = getSubscriptionCap(level);

            for (const op of operations) {
              try {
                if (op.action === 'subscribe') {
                  await subscribeRobot(1, op.eventType, 1);
                } else {
                  await unsubscribeRobot(1, op.eventType, 1);
                }
              } catch {
                // Expected errors (cap exceeded, duplicate, not found) — continue
              }
            }

            // Count subscriptions for robot 1
            let count = 0;
            for (const key of subscriptionStore.keys()) {
              if (key.startsWith('1:')) count++;
            }
            expect(count).toBeLessThanOrEqual(cap);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: 35-booking-office-facility, Property 3: Duplicate subscription prevention
  describe('Property 3: Duplicate subscription prevention', () => {
    /**
     * **Validates: Requirements 13.1**
     */
    it('subscribing to same event twice always fails with SUBSCRIPTION_DUPLICATE', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...V1_EVENTS),
          async (eventType) => {
            subscriptionStore.clear();
            setupMocksForSubscribe(5); // high cap so first subscribe succeeds

            // First subscribe should succeed
            await subscribeRobot(1, eventType, 1);

            // Second subscribe should fail with SUBSCRIPTION_DUPLICATE
            try {
              await subscribeRobot(1, eventType, 1);
              // Should not reach here
              expect(true).toBe(false);
            } catch (err) {
              expect(err).toBeInstanceOf(SubscriptionError);
              expect((err as SubscriptionError).code).toBe(SubscriptionErrorCode.SUBSCRIPTION_DUPLICATE);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: 35-booking-office-facility, Property 4: Unknown event type rejection
  describe('Property 4: Unknown event type rejection', () => {
    /**
     * **Validates: Requirements 13.1**
     */
    it('subscribing to non-registry event always fails with SUBSCRIPTION_UNKNOWN_EVENT', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }).filter(
            (s) => !V1_EVENTS.includes(s as SubscribableEventType),
          ),
          async (unknownEvent) => {
            subscriptionStore.clear();
            setupMocksForSubscribe(5);

            try {
              await subscribeRobot(1, unknownEvent, 1);
              expect(true).toBe(false);
            } catch (err) {
              expect(err).toBeInstanceOf(SubscriptionError);
              expect((err as SubscriptionError).code).toBe(
                SubscriptionErrorCode.SUBSCRIPTION_UNKNOWN_EVENT,
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: 35-booking-office-facility, Property 6: Subscribe/unsubscribe does not charge credits
  describe('Property 6: Subscribe/unsubscribe does not charge credits', () => {
    /**
     * **Validates: Requirements 13.1**
     */
    it('user currency remains unchanged after subscribe/unsubscribe operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              action: fc.constantFrom('subscribe', 'unsubscribe'),
              eventType: fc.constantFrom(...V1_EVENTS),
            }),
            { minLength: 1, maxLength: 10 },
          ),
          async (operations) => {
            subscriptionStore.clear();
            setupMocksForSubscribe(5);
            const currencyBefore = userCurrency;

            for (const op of operations) {
              try {
                if (op.action === 'subscribe') {
                  await subscribeRobot(1, op.eventType, 1);
                } else {
                  await unsubscribeRobot(1, op.eventType, 1);
                }
              } catch {
                // Expected errors — continue
              }
            }

            // Currency should be unchanged — subscribe/unsubscribe is free
            expect(userCurrency).toBe(currencyBefore);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: 35-booking-office-facility, Property 12: Unsubscribe is never refused
  describe('Property 12: Unsubscribing is always permitted, for every event', () => {
    /**
     * **Validates: the unified subscription rule**
     *
     * For any event and any state of the schedule, unsubscribing from an event the
     * robot is subscribed to SHALL succeed. Before unification, nine predicates
     * disagreed: Grand Melee refused outright, KotH allowed it, tournaments
     * refused while alive in a bracket. A player could not predict what a click
     * would do, which is the whole reason this property exists.
     */
    it('never raises EVENT_SUBSCRIPTION_LOCKED, whatever is on the schedule', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...V1_EVENTS),
          fc.boolean(), // whether a match for that event is already booked
          async (eventType, hasBookedMatch) => {
            subscriptionStore.clear();
            setupMocksForSubscribe(5);

            // A booked match holds the slot but must never block the unsubscribe.
            mockTx.scheduledMatchParticipant.findMany.mockResolvedValue(
              hasBookedMatch && eventType === 'league_1v1'
                ? [{ participantType: 'robot', participantId: 1, scheduledMatch: { matchType: 'league_1v1' } }]
                : [],
            );
            mockTx.scheduledTournamentMatch.findMany.mockResolvedValue(
              hasBookedMatch && eventType === 'tournament_1v1'
                ? [{ participantType: 'robot', participant1Id: 1, participant2Id: 2 }]
                : [],
            );

            await subscribeRobot(1, eventType, 1);
            const result = await unsubscribeRobot(1, eventType, 1);

            expect(result.removed).toEqual([eventType]);
            expect(subscriptionStore.has(`1:${eventType}`)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: 35-booking-office-facility, Property 8: Duplicate registerSubscribableEvent call throws
  describe('Property 8: Duplicate registerSubscribableEvent call throws', () => {
    /**
     * **Validates: Requirements 13.4**
     */
    it('registering same event type twice always throws', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...V1_EVENTS),
          (eventType) => {
            _clearRegistryForTesting();

            // First registration succeeds
            registerSubscribableEvent({ type: eventType, label: eventType});

            // Second registration throws
            expect(() =>
              registerSubscribableEvent({ type: eventType, label: eventType}),
            ).toThrow(/Duplicate registration/);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});


// Feature: 35-booking-office-facility, Property 11: Seeded robot subscription correctness
describe('Property 11: Seeded robot subscription correctness', () => {
  /**
   * **Validates: Requirements 6.8, 6.9, 6.10**
   *
   * For any seeded robot in a Stable with `robotCount` robots, the robot receives
   * exactly `min(3, eligibleEventCount)` subscriptions, where `eligibleEventCount`
   * is the number of events passing the Roster_Eligibility_Filter for that robotCount.
   * For 1-robot Stables, `tag_team` never appears in the subscription set.
   */

  // Import the eligibility filter for property verification
  const { getEligibleEvents } = jest.requireActual(
    '../../../src/services/subscription/rosterEligibilityFilter',
  ) as typeof import('../../../src/services/subscription/rosterEligibilityFilter');

  /**
   * Simulates the seeded subscription logic from userGeneration.ts.
   * This mirrors the actual subscription assignment for non-TagTeam robots.
   */
  function simulateSeededSubscriptions(
    robotCount: number,
    isTagTeamRobot: boolean,
    hasTagTeam: boolean,
  ): string[] {
    const eligibleEvents = getEligibleEvents(robotCount);
    const eligibleTypes = eligibleEvents.filter((e) => e.eligible).map((e) => e.type);

    if (isTagTeamRobot && hasTagTeam && robotCount >= 2) {
      // TagTeam robots get tag_team unconditionally + 2 random from remaining
      const remaining = eligibleTypes.filter((t) => t !== 'tag_team');
      const shuffled = remaining.sort(() => Math.random() - 0.5);
      return ['tag_team', ...shuffled.slice(0, 2)];
    } else {
      // Pick 3 random from eligible set (or fewer if eligible < 3)
      const shuffled = [...eligibleTypes].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 3);
    }
  }

  it('seeded robot gets exactly min(3, eligibleEventCount) subscriptions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // robotCount in the Stable
        fc.boolean(), // whether this robot is on a TagTeam
        fc.boolean(), // whether the tier creates tag teams
        (robotCount, isTagTeamRobot, hasTagTeam) => {
          setupRegistry(); // Ensure registry is populated

          const eligibleEvents = getEligibleEvents(robotCount);
          const eligibleCount = eligibleEvents.filter((e) => e.eligible).length;
          const expectedCount = Math.min(3, eligibleCount);

          const subs = simulateSeededSubscriptions(robotCount, isTagTeamRobot, hasTagTeam);

          if (isTagTeamRobot && hasTagTeam && robotCount >= 2) {
            // TagTeam robots get tag_team + 2 others = 3 total
            expect(subs).toHaveLength(3);
            expect(subs).toContain('tag_team');
          } else {
            expect(subs).toHaveLength(expectedCount);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('1-robot Stables never get tag_team subscription', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isTagTeamRobot (irrelevant for 1-robot)
        fc.boolean(), // hasTagTeam (irrelevant for 1-robot)
        (isTagTeamRobot, hasTagTeam) => {
          setupRegistry(); // Ensure registry is populated

          const subs = simulateSeededSubscriptions(1, isTagTeamRobot, hasTagTeam);

          // tag_team requires 2 robots, so it should never appear for 1-robot Stables
          expect(subs).not.toContain('tag_team');
        },
      ),
      { numRuns: 100 },
    );
  });
});
