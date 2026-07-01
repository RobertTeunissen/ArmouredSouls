/**
 * Unit tests for Robot services: upgrade validation, ranking calculations,
 * creation validation, and query services.
 *
 * Focuses on pure functions and mocked DB interactions.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn() },
    facility: { findMany: jest.fn() },
    standing: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../src/lib/creditGuard', () => ({
  lockUserForSpending: jest.fn(),
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  validateAndCalculateUpgrades,
  validateUpgradesFresh,
  VALID_ATTRIBUTES,
  ATTRIBUTE_TO_ACADEMY,
} from '../../../src/services/robot/robotUpgradeService';
import {
  calculateCategorySum,
  calculateRanking,
  COMBAT_ATTRIBUTES,
  DEFENSE_ATTRIBUTES,
  CHASSIS_ATTRIBUTES,
  AI_ATTRIBUTES,
  TEAM_ATTRIBUTES,
} from '../../../src/services/robot/robotRankingService';
import { validateRobotName, checkRosterCapacity } from '../../../src/services/robot/robotCreationService';
import { RobotError } from '../../../src/errors/robotErrors';
import * as fc from 'fast-check';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRobot(attrs: Record<string, number> = {}) {
  const base: Record<string, number> = {};
  for (const attr of VALID_ATTRIBUTES) {
    base[attr] = 1;
  }
  return { ...base, ...attrs };
}

const defaultAcademyLevels = {
  combat_training_academy: 5,
  defense_training_academy: 5,
  mobility_training_academy: 5,
  ai_training_academy: 5,
};

// ═══ robotUpgradeService ═════════════════════════════════════════════════════

describe('robotUpgradeService', () => {
  describe('validateAndCalculateUpgrades', () => {
    it('should calculate cost for a single attribute upgrade', () => {
      const robot = makeRobot({ combatPower: 3 });
      const upgrades = { combatPower: { currentLevel: 3, plannedLevel: 5 } };

      const result = validateAndCalculateUpgrades(upgrades, robot, 0, defaultAcademyLevels);

      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.upgradeOperations).toHaveLength(1);
      expect(result.upgradeOperations[0]).toMatchObject({
        attribute: 'combatPower',
        fromLevel: 3,
        toLevel: 5,
      });
    });

    it('should calculate costs for multiple attribute upgrades', () => {
      const robot = makeRobot({ combatPower: 2, armorPlating: 3 });
      const upgrades = {
        combatPower: { currentLevel: 2, plannedLevel: 4 },
        armorPlating: { currentLevel: 3, plannedLevel: 5 },
      };

      const result = validateAndCalculateUpgrades(upgrades, robot, 0, defaultAcademyLevels);

      expect(result.upgradeOperations).toHaveLength(2);
      expect(result.totalCost).toBe(
        result.upgradeOperations[0].cost + result.upgradeOperations[1].cost,
      );
    });

    it('should apply training facility discount', () => {
      const robot = makeRobot({ combatPower: 1 });
      const upgrades = { combatPower: { currentLevel: 1, plannedLevel: 3 } };

      const noDiscount = validateAndCalculateUpgrades(upgrades, robot, 0, defaultAcademyLevels);
      const withDiscount = validateAndCalculateUpgrades(upgrades, robot, 5, defaultAcademyLevels);

      expect(withDiscount.totalCost).toBeLessThan(noDiscount.totalCost);
    });

    it('should throw on invalid attribute name', () => {
      const robot = makeRobot();
      const upgrades = { invalidAttr: { currentLevel: 1, plannedLevel: 2 } };

      expect(() =>
        validateAndCalculateUpgrades(upgrades, robot, 0, defaultAcademyLevels),
      ).toThrow(RobotError);
    });

    it('should throw when plannedLevel <= currentLevel', () => {
      const robot = makeRobot({ combatPower: 5 });
      const upgrades = { combatPower: { currentLevel: 5, plannedLevel: 5 } };

      expect(() =>
        validateAndCalculateUpgrades(upgrades, robot, 0, defaultAcademyLevels),
      ).toThrow('Planned level must be greater');
    });

    it('should throw when level mismatch with verifyCurrentLevel=true', () => {
      const robot = makeRobot({ combatPower: 3 });
      const upgrades = { combatPower: { currentLevel: 2, plannedLevel: 5 } };

      expect(() =>
        validateAndCalculateUpgrades(upgrades, robot, 0, defaultAcademyLevels, true),
      ).toThrow('Current level mismatch');
    });

    it('should throw when exceeding academy cap', () => {
      const robot = makeRobot({ combatPower: 1 });
      const upgrades = { combatPower: { currentLevel: 1, plannedLevel: 999 } };
      const lowAcademy = { ...defaultAcademyLevels, combat_training_academy: 1 };

      expect(() =>
        validateAndCalculateUpgrades(upgrades, robot, 0, lowAcademy),
      ).toThrow('exceeds cap');
    });

    it('should not throw level mismatch when verifyCurrentLevel=false', () => {
      const robot = makeRobot({ combatPower: 3 });
      const upgrades = { combatPower: { currentLevel: 1, plannedLevel: 5 } };

      // Should not throw — uses robot's actual level (3) for cost calculation
      const result = validateAndCalculateUpgrades(upgrades, robot, 0, defaultAcademyLevels, false);
      expect(result.upgradeOperations[0].fromLevel).toBe(3);
    });
  });

  describe('validateUpgradesFresh', () => {
    it('should recalculate costs from fresh robot data', () => {
      const freshRobot = makeRobot({ combatPower: 2 });
      const upgrades = { combatPower: { currentLevel: 1, plannedLevel: 4 } };

      const result = validateUpgradesFresh(upgrades, freshRobot, 0, defaultAcademyLevels);

      // Should use fresh level 2 as fromLevel, not the request's currentLevel 1
      expect(result.upgradeOperations[0].fromLevel).toBe(2);
      expect(result.upgradeOperations[0].toLevel).toBe(4);
    });

    it('should throw conflict (409) when attribute already at planned level', () => {
      const freshRobot = makeRobot({ combatPower: 5 });
      const upgrades = { combatPower: { currentLevel: 3, plannedLevel: 5 } };

      expect(() =>
        validateUpgradesFresh(upgrades, freshRobot, 0, defaultAcademyLevels),
      ).toThrow('already at level');
    });
  });

  describe('ATTRIBUTE_TO_ACADEMY mapping', () => {
    it('should map all valid attributes to an academy', () => {
      for (const attr of VALID_ATTRIBUTES) {
        expect(ATTRIBUTE_TO_ACADEMY[attr]).toBeDefined();
      }
    });

    it('should only map to known academy types', () => {
      const validAcademies = new Set([
        'combat_training_academy',
        'defense_training_academy',
        'mobility_training_academy',
        'ai_training_academy',
      ]);
      for (const academy of Object.values(ATTRIBUTE_TO_ACADEMY)) {
        expect(validAcademies.has(academy)).toBe(true);
      }
    });
  });

  describe('property: cost increases with level', () => {
    it('should always produce higher total cost for higher target levels', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 5 }),
          (startLevel, increment) => {
            const robot = makeRobot({ combatPower: startLevel });
            const lowTarget = startLevel + increment;
            const highTarget = startLevel + increment + 1;

            const academyLevels = { ...defaultAcademyLevels, combat_training_academy: 10 };

            const lowResult = validateAndCalculateUpgrades(
              { combatPower: { currentLevel: startLevel, plannedLevel: lowTarget } },
              robot, 0, academyLevels,
            );
            const highResult = validateAndCalculateUpgrades(
              { combatPower: { currentLevel: startLevel, plannedLevel: highTarget } },
              robot, 0, academyLevels,
            );

            expect(highResult.totalCost).toBeGreaterThan(lowResult.totalCost);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});

// ═══ robotRankingService ═════════════════════════════════════════════════════

describe('robotRankingService', () => {
  describe('calculateCategorySum', () => {
    it('should sum combat attributes', () => {
      const robot: Record<string, number> = {};
      for (const attr of COMBAT_ATTRIBUTES) robot[attr] = 5;

      expect(calculateCategorySum(robot, COMBAT_ATTRIBUTES)).toBe(30); // 6 attrs × 5
    });

    it('should sum defense attributes', () => {
      const robot: Record<string, number> = {};
      for (const attr of DEFENSE_ATTRIBUTES) robot[attr] = 3;

      expect(calculateCategorySum(robot, DEFENSE_ATTRIBUTES)).toBe(15); // 5 attrs × 3
    });

    it('should sum chassis attributes', () => {
      const robot: Record<string, number> = {};
      for (const attr of CHASSIS_ATTRIBUTES) robot[attr] = 4;

      expect(calculateCategorySum(robot, CHASSIS_ATTRIBUTES)).toBe(20); // 5 attrs × 4
    });

    it('should sum AI attributes', () => {
      const robot: Record<string, number> = {};
      for (const attr of AI_ATTRIBUTES) robot[attr] = 2;

      expect(calculateCategorySum(robot, AI_ATTRIBUTES)).toBe(8); // 4 attrs × 2
    });

    it('should sum team coordination attributes', () => {
      const robot: Record<string, number> = {};
      for (const attr of TEAM_ATTRIBUTES) robot[attr] = 7;

      expect(calculateCategorySum(robot, TEAM_ATTRIBUTES)).toBe(21); // 3 attrs × 7
    });

    it('should handle mixed values correctly', () => {
      const robot = { combatPower: 10, targetingSystems: 5, criticalSystems: 3, penetration: 7, weaponControl: 2, attackSpeed: 8 };
      expect(calculateCategorySum(robot, COMBAT_ATTRIBUTES)).toBe(35);
    });

    it('should handle 0 values', () => {
      const robot: Record<string, number> = {};
      for (const attr of COMBAT_ATTRIBUTES) robot[attr] = 0;

      expect(calculateCategorySum(robot, COMBAT_ATTRIBUTES)).toBe(0);
    });
  });

  describe('calculateRanking', () => {
    it('should rank the highest value as #1', () => {
      const result = calculateRanking(100, [100, 80, 60, 40, 20], 5);
      expect(result.rank).toBe(1);
      expect(result.value).toBe(100);
    });

    it('should rank the lowest value as last', () => {
      const result = calculateRanking(20, [100, 80, 60, 40, 20], 5);
      expect(result.rank).toBe(5);
    });

    it('should calculate correct percentile for top rank', () => {
      const result = calculateRanking(100, [100, 80, 60, 40, 20], 5);
      // percentile = (1 - (1-1)/5) * 100 = 100
      expect(result.percentile).toBe(100);
    });

    it('should calculate correct percentile for bottom rank', () => {
      const result = calculateRanking(20, [100, 80, 60, 40, 20], 5);
      // percentile = (1 - (5-1)/5) * 100 = 20
      expect(result.percentile).toBeCloseTo(20);
    });

    it('should handle single robot (rank 1, 100%)', () => {
      const result = calculateRanking(50, [50], 1);
      expect(result.rank).toBe(1);
      expect(result.percentile).toBe(100);
    });

    it('property: rank is always between 1 and totalRobots', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 50 }),
          (values) => {
            const total = values.length;
            const target = values[0];
            const result = calculateRanking(target, values, total);
            expect(result.rank).toBeGreaterThanOrEqual(1);
            expect(result.rank).toBeLessThanOrEqual(total);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('property: percentile is always between 0 and 100 (exclusive of 0 for non-empty)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 50 }),
          (values) => {
            const total = values.length;
            const target = values[0];
            const result = calculateRanking(target, values, total);
            expect(result.percentile).toBeGreaterThan(0);
            expect(result.percentile).toBeLessThanOrEqual(100);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ═══ robotCreationService ════════════════════════════════════════════════════

describe('robotCreationService', () => {
  describe('validateRobotName', () => {
    it('should trim whitespace and return valid name', async () => {
      const result = await validateRobotName('  Iron Giant  ');
      expect(result).toBe('Iron Giant');
    });

    it('should reject empty names', async () => {
      await expect(validateRobotName('')).rejects.toThrow();
    });

    it('should reject whitespace-only names', async () => {
      await expect(validateRobotName('   ')).rejects.toThrow();
    });

    it('should reject names that are too long (>50 chars)', async () => {
      const longName = 'A'.repeat(51);
      await expect(validateRobotName(longName)).rejects.toThrow();
    });

    it('should accept names at maximum length (50 chars)', async () => {
      const maxName = 'A'.repeat(50);
      const result = await validateRobotName(maxName);
      expect(result).toBe(maxName);
    });
  });

  describe('checkRosterCapacity', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const prisma = require('../../../src/lib/prisma').default;

    it('should not throw when under capacity', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1, currency: 1000000,
        facilities: [{ facilityType: 'roster_expansion', level: 5 }],
      });
      prisma.robot.count.mockResolvedValue(2); // 2 robots, max = 5+1=6

      await expect(checkRosterCapacity(1)).resolves.toBeDefined();
    });

    it('should throw when at maximum capacity', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1, currency: 1000000,
        facilities: [{ facilityType: 'roster_expansion', level: 0 }],
      });
      prisma.robot.count.mockResolvedValue(1); // max = 0+1=1, current = 1

      await expect(checkRosterCapacity(1)).rejects.toThrow('Robot limit reached');
    });

    it('should throw when user has insufficient credits', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1, currency: 100, // below 500000
        facilities: [{ facilityType: 'roster_expansion', level: 5 }],
      });

      await expect(checkRosterCapacity(1)).rejects.toThrow('Insufficient credits');
    });

    it('should throw when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(checkRosterCapacity(1)).rejects.toThrow('User not found');
    });
  });
});
