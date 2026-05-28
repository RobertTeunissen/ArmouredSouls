/**
 * Unit tests for subscriptionService.ts
 *
 * Tests the core subscription service functions with mocked Prisma client.
 * Covers cap enforcement, duplicate prevention, tournament lock checking,
 * ownership verification, audit logging, and the isRobotSubscribedTo helper.
 *
 * Two-state model: subscriptions start as 'pending' and are activated by matchmakers.
 * Only tournament has a lock (can't unsubscribe while alive in bracket).
 *
 * _Requirements: R3.2, R3.3, R3.5, R4.3, R4.4, R10.2_
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockTx = {
  robot: { findUnique: jest.fn() },
  subscription: {
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  facility: { findUnique: jest.fn() },
  auditLog: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

const mockPrisma = {
  subscription: {
    count: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
};

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock the event registry — we control what's registered
const mockIsRegisteredEvent = jest.fn();
jest.mock('../../../src/services/subscription/eventRegistry', () => ({
  __esModule: true,
  isRegisteredEvent: (...args: unknown[]) => mockIsRegisteredEvent(...args),
  getRegisteredEvents: jest.fn(() => []),
}));

// Mock the tournament locking predicate (the only lock that still applies)
const mockTournamentLockingPredicate = jest.fn();
jest.mock('../../../src/services/subscription/lockingPredicates', () => ({
  __esModule: true,
  tournamentLockingPredicate: (...args: unknown[]) => mockTournamentLockingPredicate(...args),
}));

import {
  isRobotSubscribedTo,
  subscribeRobot,
  unsubscribeRobot,
} from '../../../src/services/subscription/subscriptionService';
import { SubscriptionError, SubscriptionErrorCode } from '../../../src/errors/subscriptionErrors';

// ── Tests ────────────────────────────────────────────────────────────

describe('subscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsRegisteredEvent.mockReturnValue(true);
    mockTournamentLockingPredicate.mockResolvedValue(false);
    mockTx.auditLog.findFirst.mockResolvedValue(null);
    mockTx.auditLog.create.mockResolvedValue({});
  });

  // ── isRobotSubscribedTo ──────────────────────────────────────────

  describe('isRobotSubscribedTo', () => {
    it('should return true when active subscription exists', async () => {
      mockPrisma.subscription.count.mockResolvedValue(1);

      const result = await isRobotSubscribedTo(1, 'league');

      expect(result).toBe(true);
      expect(mockPrisma.subscription.count).toHaveBeenCalledWith({
        where: { robotId: 1, eventType: 'league', status: 'active' },
      });
    });

    it('should return false when subscription does not exist', async () => {
      mockPrisma.subscription.count.mockResolvedValue(0);

      const result = await isRobotSubscribedTo(1, 'tournament');

      expect(result).toBe(false);
      expect(mockPrisma.subscription.count).toHaveBeenCalledWith({
        where: { robotId: 1, eventType: 'tournament', status: 'active' },
      });
    });

    it('should return false for pending subscriptions (only active counts)', async () => {
      // A pending subscription should not make the robot eligible
      mockPrisma.subscription.count.mockResolvedValue(0);

      const result = await isRobotSubscribedTo(1, 'league');

      expect(result).toBe(false);
    });
  });

  // ── subscribeRobot ───────────────────────────────────────────────

  describe('subscribeRobot', () => {
    it('should throw ACCESS_DENIED when robot is owned by different user', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 99 });

      await expect(subscribeRobot(1, 'league', 42)).rejects.toThrow(SubscriptionError);
      await expect(subscribeRobot(1, 'league', 42)).rejects.toMatchObject({
        code: SubscriptionErrorCode.ACCESS_DENIED,
        statusCode: 403,
      });
    });

    it('should throw ACCESS_DENIED when robot does not exist', async () => {
      mockTx.robot.findUnique.mockResolvedValue(null);

      await expect(subscribeRobot(999, 'league', 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.ACCESS_DENIED,
      });
    });

    it('should throw SUBSCRIPTION_UNKNOWN_EVENT for unregistered event type', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockIsRegisteredEvent.mockReturnValue(false);

      await expect(subscribeRobot(1, 'nonexistent_event', 1)).rejects.toThrow(SubscriptionError);
      await expect(subscribeRobot(1, 'nonexistent_event', 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.SUBSCRIPTION_UNKNOWN_EVENT,
      });
    });

    it('should throw SUBSCRIPTION_DUPLICATE when already subscribed', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockTx.subscription.findUnique.mockResolvedValue({ id: 1, robotId: 1, eventType: 'league' });

      await expect(subscribeRobot(1, 'league', 1)).rejects.toThrow(SubscriptionError);
      await expect(subscribeRobot(1, 'league', 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.SUBSCRIPTION_DUPLICATE,
      });
    });

    it('should throw SUBSCRIPTION_CAP_EXCEEDED when at cap', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockTx.subscription.findUnique.mockResolvedValue(null); // no duplicate
      mockTx.subscription.count.mockResolvedValue(3); // already at cap for L0
      mockTx.facility.findUnique.mockResolvedValue(null); // L0

      await expect(subscribeRobot(1, 'league', 1)).rejects.toThrow(SubscriptionError);
      await expect(subscribeRobot(1, 'league', 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.SUBSCRIPTION_CAP_EXCEEDED,
      });
    });

    it('should create subscription row with pending status and audit log on success', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockTx.subscription.findUnique.mockResolvedValue(null);
      mockTx.subscription.count.mockResolvedValue(2); // below cap
      mockTx.facility.findUnique.mockResolvedValue({ level: 1 }); // cap = 4
      mockTx.subscription.create.mockResolvedValue({ id: 10, robotId: 1, eventType: 'league', status: 'pending' });

      await subscribeRobot(1, 'league', 1);

      expect(mockTx.subscription.create).toHaveBeenCalledWith({
        data: { robotId: 1, eventType: 'league', status: 'pending' },
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

    it('should succeed when subscription count is below cap', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockTx.subscription.findUnique.mockResolvedValue(null);
      mockTx.subscription.count.mockResolvedValue(1);
      mockTx.facility.findUnique.mockResolvedValue({ level: 0 }); // cap = 3
      mockTx.subscription.create.mockResolvedValue({});

      await expect(subscribeRobot(1, 'tournament', 1)).resolves.toBeUndefined();
    });
  });

  // ── unsubscribeRobot ─────────────────────────────────────────────

  describe('unsubscribeRobot', () => {
    it('should throw ACCESS_DENIED when robot is owned by different user', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 99 });

      await expect(unsubscribeRobot(1, 'league', 42)).rejects.toMatchObject({
        code: SubscriptionErrorCode.ACCESS_DENIED,
        statusCode: 403,
      });
    });

    it('should throw EVENT_SUBSCRIPTION_LOCKED when tournament robot is alive in bracket', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockTx.subscription.findUnique.mockResolvedValue({ id: 1, robotId: 1, eventType: 'tournament' });
      mockTournamentLockingPredicate.mockResolvedValue(true);

      await expect(unsubscribeRobot(1, 'tournament', 1)).rejects.toThrow(SubscriptionError);
      await expect(unsubscribeRobot(1, 'tournament', 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.EVENT_SUBSCRIPTION_LOCKED,
        statusCode: 409,
      });
    });

    it('should permit unsubscribe from league without any lock check', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockTx.subscription.findUnique.mockResolvedValue({ id: 1, robotId: 1, eventType: 'league' });
      mockTx.subscription.delete.mockResolvedValue({});
      mockTx.subscription.count.mockResolvedValue(2);

      await expect(unsubscribeRobot(1, 'league', 1)).resolves.toBeUndefined();
      expect(mockTx.subscription.delete).toHaveBeenCalled();
      // Tournament lock should NOT be called for league events
      expect(mockTournamentLockingPredicate).not.toHaveBeenCalled();
    });

    it('should permit unsubscribe from tournament when not alive in bracket', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockTx.subscription.findUnique.mockResolvedValue({ id: 1, robotId: 1, eventType: 'tournament' });
      mockTournamentLockingPredicate.mockResolvedValue(false);
      mockTx.subscription.delete.mockResolvedValue({});
      mockTx.subscription.count.mockResolvedValue(1);

      await expect(unsubscribeRobot(1, 'tournament', 1)).resolves.toBeUndefined();
      expect(mockTournamentLockingPredicate).toHaveBeenCalledWith(1);
    });

    it('should delete subscription row and create audit log on success', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockTx.subscription.findUnique.mockResolvedValue({ id: 1, robotId: 1, eventType: 'league' });
      mockTx.subscription.delete.mockResolvedValue({});
      mockTx.subscription.count.mockResolvedValue(1);

      await unsubscribeRobot(1, 'league', 1);

      expect(mockTx.subscription.delete).toHaveBeenCalledWith({
        where: { subscription_robot_event: { robotId: 1, eventType: 'league' } },
      });
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'subscription_remove',
            userId: 1,
            robotId: 1,
          }),
        }),
      );
    });

    it('should throw SUBSCRIPTION_NOT_FOUND when not subscribed', async () => {
      mockTx.robot.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockTx.subscription.findUnique.mockResolvedValue(null);

      await expect(unsubscribeRobot(1, 'league', 1)).rejects.toMatchObject({
        code: SubscriptionErrorCode.SUBSCRIPTION_NOT_FOUND,
        statusCode: 404,
      });
    });
  });
});
