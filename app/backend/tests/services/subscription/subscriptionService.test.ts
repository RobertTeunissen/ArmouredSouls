/**
 * Unit tests for subscriptionService.ts
 *
 * One rule governs all nine events:
 *
 * 1. Subscribing is allowed while the robot occupies fewer slots than its cap.
 * 2. Unsubscribing is always allowed — no event refuses it.
 * 3. A booked match still runs, and holds its slot until it has been fought.
 *
 * Rule 3 is what stops rule 2 becoming an exploit: a robot cannot leave a
 * tournament mid-bracket, spend the freed slot elsewhere, and still fight out
 * the bracket. These tests pin all three, plus ownership, duplicates and the
 * all-or-nothing bulk save.
 *
 * _Requirements: R3.2, R3.3, R3.5, R4.3, R4.4, R10.2_
 */

// ── Mocks ────────────────────────────────────────────────────────────

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
};

const mockPrisma = {
  subscription: { count: jest.fn() },
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

// The registry is mocked so these tests do not depend on app startup order.
const mockIsRegisteredEvent = jest.fn();
jest.mock('../../../src/services/subscription/eventRegistry', () => ({
  __esModule: true,
  isRegisteredEvent: (...args: unknown[]) => mockIsRegisteredEvent(...args),
  getRegisteredEvents: jest.fn(() => []),
  SUBSCRIBABLE_EVENT_TYPES: ['league_1v1', 'tournament_1v1', 'koth', 'grand_melee'],
}));

/** Events the robot still owes a match to — the shared "is a match booked?" question. */
const mockResolveOutstandingEventsForRobot = jest.fn();
jest.mock('../../../src/services/scheduling/eventScheduleScope', () => ({
  __esModule: true,
  resolveOutstandingEventsForRobot: (...args: unknown[]) =>
    mockResolveOutstandingEventsForRobot(...args),
  resolveOutstandingEventsForRobots: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('../../../src/services/scheduling/eventCronSchedule', () => ({
  __esModule: true,
  getNextSchedulingMoments: jest.fn(() => ({ league_1v1: '2026-07-31T08:00:00.000Z' })),
  getNextSchedulingMoment: jest.fn(() => new Date('2026-07-31T08:00:00.000Z')),
}));

jest.mock('../../../src/services/battle/baseOrchestrator', () => ({
  __esModule: true,
  getCurrentCycleNumber: jest.fn().mockResolvedValue(42),
}));

import {
  isRobotSubscribedTo,
  hasSubscription,
  subscribeRobot,
  unsubscribeRobot,
  setSubscriptionsForRobot,
} from '../../../src/services/subscription/subscriptionService';
import { SubscriptionError, SubscriptionErrorCode } from '../../../src/errors/subscriptionErrors';

/** Current subscriptions, in the shape `subscription.findMany` returns. */
function given(eventTypes: string[]): void {
  mockTx.subscription.findMany.mockResolvedValue(eventTypes.map((eventType) => ({ eventType })));
}

// ── Tests ────────────────────────────────────────────────────────────

describe('subscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsRegisteredEvent.mockReturnValue(true);
    mockResolveOutstandingEventsForRobot.mockResolvedValue([]);
    mockTx.robot.findUnique.mockResolvedValue({ userId: 1 });
    mockTx.facility.findUnique.mockResolvedValue({ level: 0 }); // cap = 3
    mockTx.auditLog.findFirst.mockResolvedValue(null);
    mockTx.auditLog.create.mockResolvedValue({});
    mockTx.teamBattleMember.findMany.mockResolvedValue([]);
    mockTx.subscription.createMany.mockResolvedValue({ count: 1 });
    mockTx.subscription.deleteMany.mockResolvedValue({ count: 1 });
    given([]);
  });

  // ── Eligibility helpers ──────────────────────────────────────────

  describe('isRobotSubscribedTo', () => {
    it('should return true when a subscription exists', async () => {
      mockPrisma.subscription.count.mockResolvedValue(1);

      await expect(isRobotSubscribedTo(1, 'league_1v1')).resolves.toBe(true);
      expect(mockPrisma.subscription.count).toHaveBeenCalledWith({
        where: { robotId: 1, eventType: 'league_1v1', status: 'active' },
      });
    });

    it('should return false when no subscription exists', async () => {
      mockPrisma.subscription.count.mockResolvedValue(0);

      await expect(isRobotSubscribedTo(1, 'tournament_1v1')).resolves.toBe(false);
    });
  });

  describe('hasSubscription', () => {
    it('should ask exactly the same question as isRobotSubscribedTo', async () => {
      mockPrisma.subscription.count.mockResolvedValue(1);

      await expect(hasSubscription(7, 'koth')).resolves.toBe(true);
      expect(mockPrisma.subscription.count).toHaveBeenCalledWith({
        where: { robotId: 7, eventType: 'koth', status: 'active' },
      });
    });
  });

  // ── subscribeRobot ───────────────────────────────────────────────

  describe('subscribeRobot', () => {
    it('should throw ACCESS_DENIED when robot is owned by a different user', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ userId: 99 });

      await expect(subscribeRobot(1, 'league_1v1', 42)).rejects.toMatchObject({
        code: SubscriptionErrorCode.ACCESS_DENIED,
        statusCode: 403,
      });
    });

    it('should throw ACCESS_DENIED when robot does not exist', async () => {
      mockTx.robot.findUnique.mockResolvedValue(null);

      await expect(subscribeRobot(999, 'league_1v1', 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.ACCESS_DENIED,
      });
    });

    it('should throw SUBSCRIPTION_UNKNOWN_EVENT for an unregistered event type', async () => {
      mockIsRegisteredEvent.mockReturnValue(false);

      await expect(subscribeRobot(1, 'nonexistent_event', 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.SUBSCRIPTION_UNKNOWN_EVENT,
      });
    });

    it('should throw SUBSCRIPTION_DUPLICATE when already subscribed', async () => {
      given(['league_1v1']);

      await expect(subscribeRobot(1, 'league_1v1', 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.SUBSCRIPTION_DUPLICATE,
      });
    });

    it('should throw SUBSCRIPTION_CAP_EXCEEDED when the cap is already full', async () => {
      given(['league_1v1', 'koth', 'tournament_1v1']); // cap for level 0 is 3

      await expect(subscribeRobot(1, 'grand_melee', 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.SUBSCRIPTION_CAP_EXCEEDED,
        statusCode: 400,
      });
      expect(mockTx.subscription.createMany).not.toHaveBeenCalled();
    });

    it('should create the row as active and write an audit entry', async () => {
      mockTx.facility.findUnique.mockResolvedValue({ level: 1 }); // cap = 4
      given(['league_1v1']);

      await subscribeRobot(1, 'koth', 1);

      expect(mockTx.subscription.createMany).toHaveBeenCalledWith({
        data: [{ robotId: 1, eventType: 'koth', status: 'active' }],
      });
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'subscription_create',
            userId: 1,
            robotId: 1,
          }),
        }),
      );
    });

    it('should seed a Standing for placement modes so the matchmaker can see the robot', async () => {
      await subscribeRobot(1, 'grand_melee', 1);

      expect(mockTx.standing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ entityType: 'robot', entityId: 1, mode: 'grand_melee' }),
        }),
      );
    });

    it('should not seed a Standing for non-placement modes', async () => {
      await subscribeRobot(1, 'league_1v1', 1);

      expect(mockTx.standing.create).not.toHaveBeenCalled();
    });
  });

  // ── unsubscribeRobot: the unified rule ───────────────────────────

  describe('unsubscribeRobot', () => {
    it('should throw ACCESS_DENIED when robot is owned by a different user', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ userId: 99 });

      await expect(unsubscribeRobot(1, 'league_1v1', 42)).rejects.toMatchObject({
        code: SubscriptionErrorCode.ACCESS_DENIED,
        statusCode: 403,
      });
    });

    it('should throw SUBSCRIPTION_NOT_FOUND when not subscribed', async () => {
      given([]);

      await expect(unsubscribeRobot(1, 'league_1v1', 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.SUBSCRIPTION_NOT_FOUND,
        statusCode: 404,
      });
    });

    it.each(['league_1v1', 'koth', 'grand_melee', 'tournament_1v1'])(
      'should allow unsubscribe from %s even with a match already booked',
      async (eventType) => {
        given([eventType]);
        mockResolveOutstandingEventsForRobot.mockResolvedValue([eventType]);

        const result = await unsubscribeRobot(1, eventType, 1);

        expect(result.removed).toEqual([eventType]);
        expect(mockTx.subscription.deleteMany).toHaveBeenCalledWith({
          where: { robotId: 1, eventType: { in: [eventType] } },
        });
      },
    );

    it('should report the booked match as a held slot', async () => {
      given(['grand_melee']);
      mockResolveOutstandingEventsForRobot.mockResolvedValue(['grand_melee']);

      const result = await unsubscribeRobot(1, 'grand_melee', 1);

      expect(result.heldSlots).toEqual(['grand_melee']);
      expect(result.occupiedCount).toBe(1);
    });

    it('should write a subscription_remove audit entry', async () => {
      given(['league_1v1']);

      await unsubscribeRobot(1, 'league_1v1', 1);

      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'subscription_remove', robotId: 1 }),
        }),
      );
    });
  });

  // ── Held slots keep the permissive rule honest ────────────────────

  describe('slot accounting', () => {
    it('should keep a slot occupied by a booked match the robot has unsubscribed from', async () => {
      // Left the tournament but is still alive in the bracket, plus two others.
      given(['league_1v1', 'koth']);
      mockResolveOutstandingEventsForRobot.mockResolvedValue(['tournament_1v1']);

      await expect(subscribeRobot(1, 'grand_melee', 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.SUBSCRIPTION_CAP_EXCEEDED,
        details: expect.objectContaining({
          cap: 3,
          currentCount: 4,
          heldSlots: ['tournament_1v1'],
        }),
      });
    });

    it('should free the slot as soon as the robot is out of the bracket', async () => {
      // Same roster, but eliminated — no outstanding match, so the slot is free.
      given(['league_1v1', 'koth']);
      mockResolveOutstandingEventsForRobot.mockResolvedValue([]);

      const result = await subscribeRobot(1, 'grand_melee', 1);

      expect(result.added).toEqual(['grand_melee']);
      expect(result.occupiedCount).toBe(3);
    });

    it('should not double-count a held slot the robot is still subscribed to', async () => {
      given(['league_1v1']);
      mockResolveOutstandingEventsForRobot.mockResolvedValue(['league_1v1']);

      const result = await subscribeRobot(1, 'koth', 1);

      expect(result.occupiedCount).toBe(2);
    });
  });

  // ── setSubscriptionsForRobot: the bulk save ───────────────────────

  describe('setSubscriptionsForRobot', () => {
    it('should add and remove in a single call', async () => {
      given(['league_1v1', 'koth']);

      const result = await setSubscriptionsForRobot(1, ['league_1v1', 'grand_melee'], 1);

      expect(result.added).toEqual(['grand_melee']);
      expect(result.removed).toEqual(['koth']);
      expect(mockTx.subscription.deleteMany).toHaveBeenCalledWith({
        where: { robotId: 1, eventType: { in: ['koth'] } },
      });
      expect(mockTx.subscription.createMany).toHaveBeenCalledWith({
        data: [{ robotId: 1, eventType: 'grand_melee', status: 'active' }],
      });
    });

    it('should write nothing at all when the requested set exceeds the cap', async () => {
      given(['league_1v1']);

      await expect(
        setSubscriptionsForRobot(1, ['league_1v1', 'koth', 'grand_melee', 'tournament_1v1'], 1),
      ).rejects.toMatchObject({
        code: SubscriptionErrorCode.SUBSCRIPTION_CAP_EXCEEDED,
        details: expect.objectContaining({ cap: 3, requestedCount: 4 }),
      });

      expect(mockTx.subscription.createMany).not.toHaveBeenCalled();
      expect(mockTx.subscription.deleteMany).not.toHaveBeenCalled();
    });

    it('should allow a straight swap at the cap when nothing is booked', async () => {
      given(['league_1v1', 'koth', 'grand_melee']);

      const result = await setSubscriptionsForRobot(1, ['league_1v1', 'koth', 'tournament_1v1'], 1);

      expect(result.added).toEqual(['tournament_1v1']);
      expect(result.removed).toEqual(['grand_melee']);
    });

    it('should refuse a swap that a booked match still occupies a slot for', async () => {
      given(['league_1v1', 'koth', 'grand_melee']);
      mockResolveOutstandingEventsForRobot.mockResolvedValue(['grand_melee']);

      await expect(
        setSubscriptionsForRobot(1, ['league_1v1', 'koth', 'tournament_1v1'], 1),
      ).rejects.toMatchObject({ code: SubscriptionErrorCode.SUBSCRIPTION_CAP_EXCEEDED });
    });

    it('should be a no-op when the requested set matches the current one', async () => {
      given(['league_1v1', 'koth']);

      const result = await setSubscriptionsForRobot(1, ['koth', 'league_1v1'], 1);

      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
      expect(mockTx.subscription.createMany).not.toHaveBeenCalled();
      expect(mockTx.subscription.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.auditLog.create).not.toHaveBeenCalled();
    });

    it('should ignore duplicates in the requested set', async () => {
      given([]);

      const result = await setSubscriptionsForRobot(1, ['koth', 'koth', 'koth'], 1);

      expect(result.added).toEqual(['koth']);
    });

    it('should reject the whole save when any event type is unknown', async () => {
      given([]);
      mockIsRegisteredEvent.mockImplementation((type: string) => type !== 'bogus');

      await expect(setSubscriptionsForRobot(1, ['koth', 'bogus'], 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.SUBSCRIPTION_UNKNOWN_EVENT,
      });
      expect(mockTx.subscription.createMany).not.toHaveBeenCalled();
    });

    it('should clear every subscription when given an empty set', async () => {
      given(['league_1v1', 'koth']);

      const result = await setSubscriptionsForRobot(1, [], 1);

      expect(result.removed).toEqual(['league_1v1', 'koth']);
      expect(result.added).toEqual([]);
    });
  });
});
