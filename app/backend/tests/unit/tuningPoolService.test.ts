/**
 * Unit tests for tuningPoolService.ts
 *
 * Tests the core tuning pool service functions with mocked Prisma client,
 * ownership verification, and facility lookups.
 *
 * Covers:
 * - Valid allocation saves and returns correct state
 * - Over-budget rejection (sum > poolSize)
 * - Per-attribute max rejection (base + tuning > academyCap + 5)
 * - Negative value rejection
 * - Ownership verification (non-owner gets 403)
 * - Proportional scale-down on facility downgrade
 * - Independent per-robot allocations
 * - getTuningBonuses returns empty map when no allocation exists
 * - getTuningBonuses returns empty map for bot robots (no allocation row)
 */

import { AppError } from '../../src/errors';
import { ROBOT_ATTRIBUTES, type RobotAttribute } from '../../src/services/tuning-pool/tuningPoolConfig';

// ── Mocks ────────────────────────────────────────────────────────────

const mockPrisma = {
  robot: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  facility: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  tuningAllocation: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockVerifyRobotOwnership = jest.fn();
jest.mock('../../src/middleware/ownership', () => ({
  verifyRobotOwnership: mockVerifyRobotOwnership,
}));

import {
  getTuningAllocation,
  getTuningAllocationSummaries,
  setTuningAllocation,
  getTuningBonuses,
  clearTuningAllocation,
} from '../../src/services/tuning-pool/tuningPoolService';

// ── Test Helpers ─────────────────────────────────────────────────────

/** Build a mock robot with all 23 attributes set to a given base value. */
function buildMockRobot(baseValue = 10, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const robot: Record<string, unknown> = { userId: 1 };
  for (const attr of ROBOT_ATTRIBUTES) {
    // Prisma returns Decimal objects; we simulate with numbers
    robot[attr] = baseValue;
  }
  return { ...robot, ...overrides };
}

/** Build a mock TuningAllocation DB row. */
function buildMockAllocationRow(allocations: Partial<Record<RobotAttribute, number>> = {}): Record<string, unknown> {
  const row: Record<string, unknown> = { id: 1, robotId: 1 };
  for (const attr of ROBOT_ATTRIBUTES) {
    row[attr] = allocations[attr] ?? 0;
  }
  return row;
}

/** Set up standard mocks for a user with given facility levels. */
function setupStandardMocks(options: {
  baseValue?: number;
  tuningBayLevel?: number;
  academyLevels?: Record<string, number>;
  existingAllocation?: Partial<Record<RobotAttribute, number>> | null;
  robotOverrides?: Record<string, unknown>;
} = {}) {
  const {
    baseValue = 10,
    tuningBayLevel = 0,
    academyLevels = {},
    existingAllocation = null,
    robotOverrides = {},
  } = options;

  mockVerifyRobotOwnership.mockResolvedValue(undefined);

  mockPrisma.robot.findUnique.mockResolvedValue(buildMockRobot(baseValue, robotOverrides));

  // Tuning Bay facility lookup
  mockPrisma.facility.findFirst.mockResolvedValue(
    tuningBayLevel > 0 ? { level: tuningBayLevel } : null,
  );

  // Academy facility lookups
  const academyFacilities = Object.entries(academyLevels).map(([type, level]) => ({
    facilityType: type,
    level,
  }));
  mockPrisma.facility.findMany.mockResolvedValue(academyFacilities);

  // Existing allocation
  if (existingAllocation) {
    mockPrisma.tuningAllocation.findUnique.mockResolvedValue(
      buildMockAllocationRow(existingAllocation),
    );
  } else {
    mockPrisma.tuningAllocation.findUnique.mockResolvedValue(null);
  }

  mockPrisma.tuningAllocation.upsert.mockResolvedValue({});
  mockPrisma.tuningAllocation.update.mockResolvedValue({});
  mockPrisma.tuningAllocation.deleteMany.mockResolvedValue({ count: 1 });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('tuningPoolService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getTuningAllocation ──────────────────────────────────────────

  describe('getTuningAllocation', () => {
    it('should return correct state for a robot with no allocation (base pool)', async () => {
      setupStandardMocks({ tuningBayLevel: 0 });

      const state = await getTuningAllocation(1, 1);

      expect(state.robotId).toBe(1);
      expect(state.facilityLevel).toBe(0);
      expect(state.poolSize).toBe(10); // (0 + 1) * 10
      expect(state.allocated).toBe(0);
      expect(state.remaining).toBe(10);
      expect(state.allocations).toEqual({});
    });

    it('should return correct pool size for facility level 5', async () => {
      setupStandardMocks({ tuningBayLevel: 5 });

      const state = await getTuningAllocation(1, 1);

      expect(state.facilityLevel).toBe(5);
      expect(state.poolSize).toBe(60); // (5 + 1) * 10
    });

    it('should return existing allocations', async () => {
      setupStandardMocks({
        tuningBayLevel: 3,
        existingAllocation: { combatPower: 5, armorPlating: 3 },
      });

      const state = await getTuningAllocation(1, 1);

      expect(state.allocations).toEqual({ combatPower: 5, armorPlating: 3 });
      expect(state.allocated).toBe(8);
      expect(state.remaining).toBe(32); // 40 - 8
    });

    it('should calculate per-attribute maxes based on academy levels', async () => {
      setupStandardMocks({
        baseValue: 10,
        academyLevels: {
          combat_training_academy: 1,   // cap = 15
          defense_training_academy: 2,  // cap = 20
          mobility_training_academy: 0, // cap = 10
          ai_training_academy: 3,       // cap = 25
        },
      });

      const state = await getTuningAllocation(1, 1);

      // combatPower: academy cap 15, base 10 → max = 15 + 5 - 10 = 10
      expect(state.perAttributeMaxes.combatPower).toBe(10);
      // armorPlating: academy cap 20, base 10 → max = 20 + 5 - 10 = 15
      expect(state.perAttributeMaxes.armorPlating).toBe(15);
      // hullIntegrity: academy cap 10, base 10 → max = 10 + 5 - 10 = 5
      expect(state.perAttributeMaxes.hullIntegrity).toBe(5);
      // combatAlgorithms: academy cap 25, base 10 → max = 25 + 5 - 10 = 20
      expect(state.perAttributeMaxes.combatAlgorithms).toBe(20);
    });

    it('should proportionally scale down allocations on facility downgrade', async () => {
      // Simulate: user had L5 (pool=60), allocated 50 points, then downgraded to L1 (pool=20)
      setupStandardMocks({
        tuningBayLevel: 1, // pool = 20
        existingAllocation: {
          combatPower: 25,
          armorPlating: 25,
        }, // total = 50, exceeds pool of 20
      });

      const state = await getTuningAllocation(1, 1);

      expect(state.poolSize).toBe(20);
      // Scale factor: 20/50 = 0.4
      // combatPower: 25 * 0.4 = 10
      // armorPlating: 25 * 0.4 = 10
      expect(state.allocations.combatPower).toBe(10);
      expect(state.allocations.armorPlating).toBe(10);
      expect(state.allocated).toBe(20);
      expect(state.remaining).toBe(0);
    });

    it('should not exceed pool size after scale-down rounding', async () => {
      // Edge case: 3 attributes each at 1, scaled to pool=2
      // Naive rounding: 1 * (2/3) = 0.67 each → 0.67 * 3 = 2.01 > 2
      // The fix subtracts the excess from the largest allocation
      setupStandardMocks({
        tuningBayLevel: 0, // pool = 10, but we override via allocation total
        existingAllocation: {
          combatPower: 10,
          armorPlating: 10,
          hullIntegrity: 10,
        }, // total = 30, pool = 10
      });

      const state = await getTuningAllocation(1, 1);

      expect(state.poolSize).toBe(10);
      // Total allocated must not exceed pool size
      expect(state.allocated).toBeLessThanOrEqual(state.poolSize);
      expect(state.remaining).toBeGreaterThanOrEqual(0);
    });

    it('should not scale down when allocations fit within pool', async () => {
      setupStandardMocks({
        tuningBayLevel: 5, // pool = 60
        existingAllocation: { combatPower: 10, armorPlating: 5 }, // total = 15
      });

      const state = await getTuningAllocation(1, 1);

      expect(state.allocations.combatPower).toBe(10);
      expect(state.allocations.armorPlating).toBe(5);
      expect(state.allocated).toBe(15);
    });

    it('should throw 403 for non-owner', async () => {
      mockVerifyRobotOwnership.mockRejectedValue(
        new AppError('FORBIDDEN', 'Access denied', 403),
      );

      await expect(getTuningAllocation(1, 999)).rejects.toThrow(AppError);
      await expect(getTuningAllocation(1, 999)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  // ── setTuningAllocation ──────────────────────────────────────────

  describe('setTuningAllocation', () => {
    it('should save valid allocation and return correct state', async () => {
      setupStandardMocks({
        tuningBayLevel: 3, // pool = 40
        academyLevels: { combat_training_academy: 2 }, // cap = 20
      });

      const allocations = { combatPower: 5, targetingSystems: 3 };
      const state = await setTuningAllocation(1, 1, allocations);

      expect(state.robotId).toBe(1);
      expect(state.poolSize).toBe(40);
      expect(state.allocated).toBe(8);
      expect(state.remaining).toBe(32);
      expect(state.allocations).toEqual({ combatPower: 5, targetingSystems: 3 });

      // Verify upsert was called
      expect(mockPrisma.tuningAllocation.upsert).toHaveBeenCalledTimes(1);
      const upsertCall = mockPrisma.tuningAllocation.upsert.mock.calls[0][0];
      expect(upsertCall.where).toEqual({ robotId: 1 });
      expect(upsertCall.create.combatPower).toBe(5);
      expect(upsertCall.create.targetingSystems).toBe(3);
      expect(upsertCall.create.armorPlating).toBe(0); // unset attributes default to 0
    });

    it('should reject over-budget allocation (sum > poolSize)', async () => {
      setupStandardMocks({ tuningBayLevel: 0 }); // pool = 10

      const allocations = { combatPower: 6, armorPlating: 5 }; // total = 11 > 10

      await expect(setTuningAllocation(1, 1, allocations)).rejects.toThrow(AppError);
      await expect(setTuningAllocation(1, 1, allocations)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      });
    });

    it('should reject per-attribute max exceeded (base + tuning > academyCap + 5)', async () => {
      setupStandardMocks({
        baseValue: 15,
        tuningBayLevel: 5, // pool = 60
        academyLevels: { combat_training_academy: 1 }, // cap = 15
        // Per-attr max for combatPower: 15 + 5 - 15 = 5
      });

      const allocations = { combatPower: 6 }; // exceeds max of 5

      await expect(setTuningAllocation(1, 1, allocations)).rejects.toThrow(AppError);
      await expect(setTuningAllocation(1, 1, allocations)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      });
    });

    it('should reject negative values', async () => {
      setupStandardMocks({ tuningBayLevel: 3 });

      const allocations = { combatPower: -1 };

      await expect(setTuningAllocation(1, 1, allocations)).rejects.toThrow(AppError);
      await expect(setTuningAllocation(1, 1, allocations)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      });
    });

    it('should throw 403 for non-owner', async () => {
      mockVerifyRobotOwnership.mockRejectedValue(
        new AppError('FORBIDDEN', 'Access denied', 403),
      );

      await expect(setTuningAllocation(1, 999, { combatPower: 1 })).rejects.toThrow(AppError);
      await expect(setTuningAllocation(1, 999, { combatPower: 1 })).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should accept allocation exactly at pool size', async () => {
      setupStandardMocks({ tuningBayLevel: 0 }); // pool = 10

      const allocations = { combatPower: 5, armorPlating: 5 }; // total = 10 = pool
      const state = await setTuningAllocation(1, 1, allocations);

      expect(state.allocated).toBe(10);
      expect(state.remaining).toBe(0);
    });

    it('should accept empty allocation (clearing all)', async () => {
      setupStandardMocks({ tuningBayLevel: 3 });

      const state = await setTuningAllocation(1, 1, {});

      expect(state.allocated).toBe(0);
      expect(state.remaining).toBe(40);
      expect(state.allocations).toEqual({});
    });

    it('should accept allocation exactly at per-attribute max', async () => {
      setupStandardMocks({
        baseValue: 10,
        tuningBayLevel: 5, // pool = 60
        academyLevels: { combat_training_academy: 1 }, // cap = 15
        // Per-attr max for combatPower: 15 + 5 - 10 = 10
      });

      const allocations = { combatPower: 10 }; // exactly at max
      const state = await setTuningAllocation(1, 1, allocations);

      expect(state.allocated).toBe(10);
      expect(state.allocations).toEqual({ combatPower: 10 });
    });
  });

  // ── getTuningBonuses ─────────────────────────────────────────────

  describe('getTuningBonuses', () => {
    it('should return empty map when no allocation exists', async () => {
      mockPrisma.tuningAllocation.findUnique.mockResolvedValue(null);

      const bonuses = await getTuningBonuses(1);

      expect(bonuses).toEqual({});
    });

    it('should return empty map for bot robots (no allocation row)', async () => {
      // Bot robots never have allocation rows
      mockPrisma.tuningAllocation.findUnique.mockResolvedValue(null);

      const bonuses = await getTuningBonuses(500); // bot robot ID

      expect(bonuses).toEqual({});
    });

    it('should return non-zero allocations only', async () => {
      mockPrisma.tuningAllocation.findUnique.mockResolvedValue(
        buildMockAllocationRow({ combatPower: 5, armorPlating: 3 }),
      );

      const bonuses = await getTuningBonuses(1);

      expect(bonuses).toEqual({ combatPower: 5, armorPlating: 3 });
      // Zero-value attributes should not be in the map
      expect(bonuses).not.toHaveProperty('targetingSystems');
      expect(bonuses).not.toHaveProperty('hullIntegrity');
    });

    it('should not perform ownership verification', async () => {
      mockPrisma.tuningAllocation.findUnique.mockResolvedValue(null);

      await getTuningBonuses(1);

      expect(mockVerifyRobotOwnership).not.toHaveBeenCalled();
    });
  });

  // ── clearTuningAllocation ────────────────────────────────────────

  describe('clearTuningAllocation', () => {
    it('should delete the allocation row', async () => {
      mockPrisma.tuningAllocation.deleteMany.mockResolvedValue({ count: 1 });

      await clearTuningAllocation(1);

      expect(mockPrisma.tuningAllocation.deleteMany).toHaveBeenCalledWith({
        where: { robotId: 1 },
      });
    });

    it('should not throw when no allocation exists', async () => {
      mockPrisma.tuningAllocation.deleteMany.mockResolvedValue({ count: 0 });

      await expect(clearTuningAllocation(999)).resolves.toBeUndefined();
    });
  });

  // ── Independent per-robot allocations ────────────────────────────

  describe('independent per-robot allocations', () => {
    it('should maintain separate allocations for different robots', async () => {
      // Robot 1 has allocation
      setupStandardMocks({
        tuningBayLevel: 3,
        existingAllocation: { combatPower: 10 },
      });

      const state1 = await getTuningAllocation(1, 1);
      expect(state1.allocations).toEqual({ combatPower: 10 });

      // Robot 2 has different allocation
      jest.clearAllMocks();
      setupStandardMocks({
        tuningBayLevel: 3,
        existingAllocation: { armorPlating: 5 },
      });

      const state2 = await getTuningAllocation(2, 1);
      expect(state2.allocations).toEqual({ armorPlating: 5 });

      // They are independent — robot 2's allocation doesn't affect robot 1
      expect(state1.allocations).not.toEqual(state2.allocations);
    });
  });

  // ── getTuningAllocationSummaries ─────────────────────────────────

  describe('getTuningAllocationSummaries', () => {
    /** Roster of robot ids plus optional allocation rows keyed by robot id. */
    function setupSummaryMocks(options: {
      robotIds: number[];
      tuningBayLevel?: number;
      allocations?: Record<number, Partial<Record<RobotAttribute, number>>>;
    }) {
      const { robotIds, tuningBayLevel = 0, allocations = {} } = options;

      mockPrisma.robot.findMany.mockResolvedValue(robotIds.map((id) => ({ id })));
      mockPrisma.facility.findFirst.mockResolvedValue(
        tuningBayLevel > 0 ? { level: tuningBayLevel } : null,
      );
      mockPrisma.tuningAllocation.findMany.mockResolvedValue(
        Object.entries(allocations).map(([robotId, alloc]) => ({
          ...buildMockAllocationRow(alloc),
          robotId: Number(robotId),
        })),
      );
    }

    it('should return an empty array when the stable has no robots', async () => {
      mockPrisma.robot.findMany.mockResolvedValue([]);

      expect(await getTuningAllocationSummaries(1)).toEqual([]);
    });

    it('should not query allocations when the stable has no robots', async () => {
      mockPrisma.robot.findMany.mockResolvedValue([]);

      await getTuningAllocationSummaries(1);

      expect(mockPrisma.tuningAllocation.findMany).not.toHaveBeenCalled();
    });

    it('should report the full base pool as remaining for a robot with no allocation row', async () => {
      setupSummaryMocks({ robotIds: [1] });

      expect(await getTuningAllocationSummaries(1)).toEqual([
        { robotId: 1, poolSize: 10, allocated: 0, remaining: 10 },
      ]);
    });

    it('should scale the pool with the Tuning Bay level', async () => {
      setupSummaryMocks({ robotIds: [1], tuningBayLevel: 5 });

      const [summary] = await getTuningAllocationSummaries(1);

      expect(summary.poolSize).toBe(60);
      expect(summary.remaining).toBe(60);
    });

    it('should sum allocations across attributes', async () => {
      setupSummaryMocks({
        robotIds: [1],
        tuningBayLevel: 2,
        allocations: { 1: { combatPower: 5, armorPlating: 3.5 } },
      });

      expect(await getTuningAllocationSummaries(1)).toEqual([
        { robotId: 1, poolSize: 30, allocated: 8.5, remaining: 21.5 },
      ]);
    });

    it('should include robots that have no allocation row alongside those that do', async () => {
      setupSummaryMocks({
        robotIds: [1, 2, 3],
        tuningBayLevel: 1,
        allocations: { 2: { combatPower: 4 } },
      });

      expect(await getTuningAllocationSummaries(1)).toEqual([
        { robotId: 1, poolSize: 20, allocated: 0, remaining: 20 },
        { robotId: 2, poolSize: 20, allocated: 4, remaining: 16 },
        { robotId: 3, poolSize: 20, allocated: 0, remaining: 20 },
      ]);
    });

    it('should clamp an over-budget allocation to the pool instead of reporting negative remaining', async () => {
      // Mirrors a Tuning Bay downgrade: 25 points allocated, pool now 10.
      setupSummaryMocks({
        robotIds: [1],
        tuningBayLevel: 0,
        allocations: { 1: { combatPower: 15, armorPlating: 10 } },
      });

      expect(await getTuningAllocationSummaries(1)).toEqual([
        { robotId: 1, poolSize: 10, allocated: 10, remaining: 0 },
      ]);
    });

    it('should not write anything, leaving the scale-down repair to the detail read', async () => {
      setupSummaryMocks({
        robotIds: [1],
        allocations: { 1: { combatPower: 15, armorPlating: 10 } },
      });

      await getTuningAllocationSummaries(1);

      expect(mockPrisma.tuningAllocation.update).not.toHaveBeenCalled();
      expect(mockPrisma.tuningAllocation.upsert).not.toHaveBeenCalled();
    });

    it('should scope the roster query to the requesting user', async () => {
      setupSummaryMocks({ robotIds: [1] });

      await getTuningAllocationSummaries(42);

      expect(mockPrisma.robot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 42 } }),
      );
    });

    it('should look up the pool size once regardless of roster size', async () => {
      setupSummaryMocks({ robotIds: [1, 2, 3, 4, 5] });

      await getTuningAllocationSummaries(1);

      expect(mockPrisma.facility.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrisma.tuningAllocation.findMany).toHaveBeenCalledTimes(1);
    });

    it('should round a fractional total to two decimal places', async () => {
      setupSummaryMocks({
        robotIds: [1],
        tuningBayLevel: 1,
        allocations: { 1: { combatPower: 0.01, armorPlating: 0.02 } },
      });

      const [summary] = await getTuningAllocationSummaries(1);

      expect(summary.allocated).toBe(0.03);
      expect(summary.remaining).toBe(19.97);
    });
  });
});
