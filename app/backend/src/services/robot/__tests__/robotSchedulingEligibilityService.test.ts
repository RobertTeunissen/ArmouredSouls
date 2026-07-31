/**
 * Unit tests for computeSchedulingEligibility().
 *
 * Verifies each gate independently and in combination, ensuring
 * the function is read-only (no Prisma write operations).
 */

// ─── Mocks (must be before imports) ──────────────────────────────────

const mockPrisma = {
  robot: {
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  subscription: {
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  tuningAllocation: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockCheckSchedulingReadiness = jest.fn();

jest.mock('../../analytics/matchmakingService', () => ({
  __esModule: true,
  checkSchedulingReadiness: mockCheckSchedulingReadiness,
}));

// ─── Imports (after mocks) ───────────────────────────────────────────

import { computeSchedulingEligibility } from '../robotSchedulingEligibilityService';

// ─── Test Helpers ────────────────────────────────────────────────────

const ROBOT_ID = 42;

const makeRobot = (overrides = {}) => ({
  id: ROBOT_ID,
  name: 'TestBot',
  loadoutType: 'single',
  mainWeaponId: 1,
  offhandWeaponId: null,
  mainWeapon: { id: 1, name: 'Laser' },
  offhandWeapon: null,
  ...overrides,
});

const weaponReady = () => ({
  isReady: true,
  reasons: [],
  hpCheck: true,
  weaponCheck: true,
});

const weaponNotReady = (reasons: string[] = ['No main weapon equipped']) => ({
  isReady: false,
  reasons,
  hpCheck: true,
  weaponCheck: false,
});

beforeEach(() => {
  jest.clearAllMocks();

  // Defaults: fully configured robot
  mockPrisma.robot.findUniqueOrThrow.mockResolvedValue(makeRobot());
  mockCheckSchedulingReadiness.mockReturnValue(weaponReady());
  mockPrisma.subscription.count.mockResolvedValue(1);
  mockPrisma.tuningAllocation.findUnique.mockResolvedValue({ id: 1, robotId: ROBOT_ID });
});

// ─── Tests ───────────────────────────────────────────────────────────

describe('computeSchedulingEligibility', () => {
  describe('should return isEligible true and isFullyConfigured true when all gates are met', () => {
    it('should report all gates met with correct structure', async () => {
      const report = await computeSchedulingEligibility(ROBOT_ID);

      expect(report.robotId).toBe(ROBOT_ID);
      expect(report.isEligible).toBe(true);
      expect(report.isFullyConfigured).toBe(true);
      expect(report.gates).toHaveLength(3);

      const weaponGate = report.gates.find((g) => g.id === 'weapon_equipped');
      expect(weaponGate).toEqual({
        id: 'weapon_equipped',
        label: 'Weapon equipped',
        severity: 'hard',
        met: true,
        detail: null,
      });

      const subGate = report.gates.find((g) => g.id === 'event_subscribed');
      expect(subGate).toEqual({
        id: 'event_subscribed',
        label: 'Subscribed to at least one battle event',
        severity: 'hard',
        met: true,
        detail: null,
      });

      const tuningGate = report.gates.find((g) => g.id === 'tuning_allocated');
      expect(tuningGate).toEqual({
        id: 'tuning_allocated',
        label: 'Tuning points allocated',
        severity: 'soft',
        met: true,
        detail: null,
      });
    });
  });

  describe('should return isEligible false and isFullyConfigured false when no gates are met', () => {
    it('should report all gates unmet', async () => {
      mockCheckSchedulingReadiness.mockReturnValue(weaponNotReady());
      mockPrisma.subscription.count.mockResolvedValue(0);
      mockPrisma.tuningAllocation.findUnique.mockResolvedValue(null);

      const report = await computeSchedulingEligibility(ROBOT_ID);

      expect(report.isEligible).toBe(false);
      expect(report.isFullyConfigured).toBe(false);

      expect(report.gates[0].met).toBe(false);
      expect(report.gates[0].detail).toBe('No main weapon equipped');
      expect(report.gates[1].met).toBe(false);
      expect(report.gates[1].detail).toBe('No event subscriptions — robot will never be scheduled for battles');
      expect(report.gates[2].met).toBe(false);
      expect(report.gates[2].detail).toBe('Free stat bonuses available via Tuning Bay');
    });
  });

  describe('should return isEligible true and isFullyConfigured false when only hard gates are met', () => {
    it('should be eligible but not fully configured when tuning is missing', async () => {
      // Hard gates met: weapon + subscription
      mockCheckSchedulingReadiness.mockReturnValue(weaponReady());
      mockPrisma.subscription.count.mockResolvedValue(2);
      // Soft gate unmet: no tuning
      mockPrisma.tuningAllocation.findUnique.mockResolvedValue(null);

      const report = await computeSchedulingEligibility(ROBOT_ID);

      expect(report.isEligible).toBe(true);
      expect(report.isFullyConfigured).toBe(false);

      expect(report.gates[0].met).toBe(true); // weapon_equipped
      expect(report.gates[1].met).toBe(true); // event_subscribed
      expect(report.gates[2].met).toBe(false); // tuning_allocated
    });
  });

  describe('should return isEligible false when only weapon is equipped (no subscription, no tuning)', () => {
    it('should not be eligible without subscription', async () => {
      mockCheckSchedulingReadiness.mockReturnValue(weaponReady());
      mockPrisma.subscription.count.mockResolvedValue(0);
      mockPrisma.tuningAllocation.findUnique.mockResolvedValue(null);

      const report = await computeSchedulingEligibility(ROBOT_ID);

      expect(report.isEligible).toBe(false);
      expect(report.isFullyConfigured).toBe(false);
      expect(report.gates[0].met).toBe(true);  // weapon met
      expect(report.gates[1].met).toBe(false); // subscription unmet
      expect(report.gates[2].met).toBe(false); // tuning unmet
    });
  });

  describe('should return isEligible false when only subscription exists (no weapon, no tuning)', () => {
    it('should not be eligible without weapon', async () => {
      mockCheckSchedulingReadiness.mockReturnValue(weaponNotReady());
      mockPrisma.subscription.count.mockResolvedValue(3);
      mockPrisma.tuningAllocation.findUnique.mockResolvedValue(null);

      const report = await computeSchedulingEligibility(ROBOT_ID);

      expect(report.isEligible).toBe(false);
      expect(report.isFullyConfigured).toBe(false);
      expect(report.gates[0].met).toBe(false); // weapon unmet
      expect(report.gates[1].met).toBe(true);  // subscription met
      expect(report.gates[2].met).toBe(false); // tuning unmet
    });
  });

  describe('should always return exactly 3 gates with correct IDs', () => {
    it('should have gates in expected order with correct IDs', async () => {
      const report = await computeSchedulingEligibility(ROBOT_ID);

      expect(report.gates).toHaveLength(3);
      expect(report.gates[0].id).toBe('weapon_equipped');
      expect(report.gates[1].id).toBe('event_subscribed');
      expect(report.gates[2].id).toBe('tuning_allocated');
    });

    it('should have correct severity assignments', async () => {
      const report = await computeSchedulingEligibility(ROBOT_ID);

      expect(report.gates[0].severity).toBe('hard');
      expect(report.gates[1].severity).toBe('hard');
      expect(report.gates[2].severity).toBe('soft');
    });
  });

  describe('should not perform any Prisma write operations', () => {
    it('should never call create, update, or delete on any model', async () => {
      await computeSchedulingEligibility(ROBOT_ID);

      // Robot write operations
      expect(mockPrisma.robot.create).not.toHaveBeenCalled();
      expect(mockPrisma.robot.update).not.toHaveBeenCalled();
      expect(mockPrisma.robot.delete).not.toHaveBeenCalled();

      // Subscription write operations
      expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.delete).not.toHaveBeenCalled();

      // TuningAllocation write operations
      expect(mockPrisma.tuningAllocation.create).not.toHaveBeenCalled();
      expect(mockPrisma.tuningAllocation.update).not.toHaveBeenCalled();
      expect(mockPrisma.tuningAllocation.delete).not.toHaveBeenCalled();
    });

    it('should never call write operations even when all gates are unmet', async () => {
      mockCheckSchedulingReadiness.mockReturnValue(weaponNotReady());
      mockPrisma.subscription.count.mockResolvedValue(0);
      mockPrisma.tuningAllocation.findUnique.mockResolvedValue(null);

      await computeSchedulingEligibility(ROBOT_ID);

      expect(mockPrisma.robot.create).not.toHaveBeenCalled();
      expect(mockPrisma.robot.update).not.toHaveBeenCalled();
      expect(mockPrisma.robot.delete).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.delete).not.toHaveBeenCalled();
      expect(mockPrisma.tuningAllocation.create).not.toHaveBeenCalled();
      expect(mockPrisma.tuningAllocation.update).not.toHaveBeenCalled();
      expect(mockPrisma.tuningAllocation.delete).not.toHaveBeenCalled();
    });
  });

  describe('weapon gate detail handling', () => {
    it('should join multiple weapon reasons with semicolons', async () => {
      mockCheckSchedulingReadiness.mockReturnValue(
        weaponNotReady(['No main weapon equipped', 'No offhand weapon equipped']),
      );

      const report = await computeSchedulingEligibility(ROBOT_ID);

      expect(report.gates[0].detail).toBe('No main weapon equipped; No offhand weapon equipped');
    });

    it('should set detail to null when weapon check passes', async () => {
      mockCheckSchedulingReadiness.mockReturnValue(weaponReady());

      const report = await computeSchedulingEligibility(ROBOT_ID);

      expect(report.gates[0].detail).toBeNull();
    });
  });
});
