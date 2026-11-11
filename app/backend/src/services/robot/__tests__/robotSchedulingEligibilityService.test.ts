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
  facility: {
    findFirst: jest.fn(),
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
  userId: 7,
  name: 'TestBot',
  loadoutType: 'single',
  mainWeaponId: 1,
  offhandWeaponId: null,
  mainWeapon: { id: 1, name: 'Laser' },
  offhandWeapon: null,
  ...overrides,
});

/** An allocation row holding `points` in total (split over two attributes). */
const tuningRow = (combatPower: number, armorPlating = 0) => ({
  id: 1,
  robotId: ROBOT_ID,
  combatPower: combatPower.toFixed(2),
  armorPlating: armorPlating.toFixed(2),
});

const fullTuning = () => tuningRow(6, 4);

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
  // Tuning Bay level 0 → pool of 10 points, all allocated.
  mockPrisma.facility.findFirst.mockResolvedValue(null);
  mockPrisma.tuningAllocation.findUnique.mockResolvedValue(fullTuning());
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
        label: 'Equip a weapon',
        severity: 'hard',
        met: true,
        detail: null,
      });

      const subGate = report.gates.find((g) => g.id === 'event_subscribed');
      expect(subGate).toEqual({
        id: 'event_subscribed',
        label: 'Enter at least one battle event',
        severity: 'hard',
        met: true,
        detail: null,
      });

      const tuningGate = report.gates.find((g) => g.id === 'tuning_allocated');
      expect(tuningGate).toEqual({
        id: 'tuning_allocated',
        label: 'Allocate your tuning points',
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
      expect(report.gates[2].detail).toBe('10 of 10 free tuning points unallocated');
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

  describe('tuning gate counts allocated points (#582)', () => {
    it('treats an allocation row holding 0 points as unmet', async () => {
      mockPrisma.tuningAllocation.findUnique.mockResolvedValue(tuningRow(0));

      const report = await computeSchedulingEligibility(ROBOT_ID);

      expect(report.gates[2]).toMatchObject({ met: false, label: 'Allocate your tuning points', detail: '10 of 10 free tuning points unallocated' });
      expect(report.isFullyConfigured).toBe(false);
      expect(report.isEligible).toBe(true);
    });

    it('stays unmet while points are left, sized by the Tuning Bay level', async () => {
      mockPrisma.facility.findFirst.mockResolvedValue({ level: 2 });
      mockPrisma.tuningAllocation.findUnique.mockResolvedValue(tuningRow(12.5, 5));

      const report = await computeSchedulingEligibility(ROBOT_ID);

      expect(mockPrisma.facility.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 7, facilityType: 'tuning_bay' } }));
      expect(report.gates[2]).toMatchObject({ met: false, detail: '12.5 of 30 free tuning points unallocated' });
    });

    it('is met once the whole pool is allocated', async () => {
      mockPrisma.facility.findFirst.mockResolvedValue({ level: 1 });
      mockPrisma.tuningAllocation.findUnique.mockResolvedValue(tuningRow(15, 5));

      const report = await computeSchedulingEligibility(ROBOT_ID);

      expect(report.gates[2]).toMatchObject({ met: true, detail: null });
      expect(report.isFullyConfigured).toBe(true);
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
