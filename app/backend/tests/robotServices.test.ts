/**
 * Unit tests for pure (non-database) robot service functions.
 * Tests calculateCategorySum, calculateRanking, sanitizeRobotForPublic,
 * and validateAndCalculateUpgrades.
 */

import { calculateCategorySum, calculateRanking, COMBAT_ATTRIBUTES } from '../src/services/robot/robotRankingService';
import { sanitizeRobotForPublic, SENSITIVE_ROBOT_FIELDS } from '../src/services/robot/robotSanitizer';
import {
  validateAndCalculateUpgrades,
  VALID_ATTRIBUTES,
  type AcademyLevels,
} from '../src/services/robot/robotUpgradeService';
import { RobotError } from '../src/errors/robotErrors';

// ── calculateCategorySum ─────────────────────────────────────────────

describe('calculateCategorySum', () => {
  it('should sum plain number values', () => {
    const robot = { a: 10, b: 20, c: 30 };
    expect(calculateCategorySum(robot, ['a', 'b', 'c'])).toBe(60);
  });

  it('should handle Prisma Decimal-like objects via Number()', () => {
    // Prisma Decimal has a toString() that Number() can parse
    const decimalLike = { toString: () => '15.5', toFixed: () => '15.50' };
    const robot = { x: decimalLike as any, y: 4.5 };
    expect(calculateCategorySum(robot, ['x', 'y'])).toBe(20);
  });

  it('should return 0 for empty attributes list', () => {
    const robot = { a: 10 };
    expect(calculateCategorySum(robot, [])).toBe(0);
  });

  it('should work with the real COMBAT_ATTRIBUTES constant', () => {
    const robot: Record<string, number> = {};
    for (const attr of COMBAT_ATTRIBUTES) robot[attr] = 5;
    // 6 combat attributes × 5 = 30
    expect(calculateCategorySum(robot, COMBAT_ATTRIBUTES)).toBe(30);
  });
});

// ── calculateRanking ─────────────────────────────────────────────────

describe('calculateRanking', () => {
  it('should return rank 1 for the highest value', () => {
    const result = calculateRanking(100, [50, 100, 75], 3);
    expect(result.rank).toBe(1);
    expect(result.total).toBe(3);
    expect(result.value).toBe(100);
  });

  it('should return correct rank for middle value', () => {
    const result = calculateRanking(75, [50, 100, 75], 3);
    expect(result.rank).toBe(2);
  });

  it('should return last rank for lowest value', () => {
    const result = calculateRanking(50, [50, 100, 75], 3);
    expect(result.rank).toBe(3);
  });

  it('should calculate percentile correctly', () => {
    // rank 1 of 4: percentile = (1 - (1-1)/4) * 100 = 100
    const result = calculateRanking(100, [25, 50, 75, 100], 4);
    expect(result.percentile).toBe(100);

    // rank 4 of 4: percentile = (1 - (4-1)/4) * 100 = 25
    const last = calculateRanking(25, [25, 50, 75, 100], 4);
    expect(last.percentile).toBe(25);
  });

  it('should handle single-element array', () => {
    const result = calculateRanking(42, [42], 1);
    expect(result.rank).toBe(1);
    expect(result.percentile).toBe(100);
  });
});


// ── sanitizeRobotForPublic ───────────────────────────────────────────

describe('sanitizeRobotForPublic', () => {
  it('should return null for null input', () => {
    expect(sanitizeRobotForPublic(null)).toBeNull();
  });

  it('should return undefined for undefined input', () => {
    expect(sanitizeRobotForPublic(undefined)).toBeUndefined();
  });

  it('should strip all sensitive fields', () => {
    const robot: Record<string, unknown> = {
      id: 1,
      name: 'TestBot',
      elo: 1200,
    };
    // Add all sensitive fields
    for (const field of SENSITIVE_ROBOT_FIELDS) {
      robot[field] = 99;
    }

    const sanitized = sanitizeRobotForPublic(robot)!;

    for (const field of SENSITIVE_ROBOT_FIELDS) {
      expect(sanitized).not.toHaveProperty(field);
    }
  });

  it('should preserve non-sensitive fields', () => {
    const robot = {
      id: 1,
      name: 'TestBot',
      elo: 1200,
      currentLeague: 'gold',
      wins: 10,
      losses: 5,
      combatPower: 25,
      armorPlating: 15,
    };

    const sanitized = sanitizeRobotForPublic(robot)!;

    expect(sanitized.id).toBe(1);
    expect(sanitized.name).toBe('TestBot');
    expect(sanitized.elo).toBe(1200);
    expect(sanitized.currentLeague).toBe('gold');
    expect(sanitized.wins).toBe(10);
    expect(sanitized.losses).toBe(5);
  });

  it('should not mutate the original object', () => {
    const robot = { id: 1, combatPower: 25 };
    sanitizeRobotForPublic(robot);
    expect(robot.combatPower).toBe(25);
  });
});

// ── validateAndCalculateUpgrades ─────────────────────────────────────

describe('validateAndCalculateUpgrades', () => {
  const baseAcademyLevels: AcademyLevels = {
    combat_training_academy: 5,
    defense_training_academy: 5,
    mobility_training_academy: 5,
    ai_training_academy: 5,
  };

  const makeRobot = (overrides: Record<string, number> = {}): Record<string, unknown> => {
    const robot: Record<string, unknown> = {};
    for (const attr of VALID_ATTRIBUTES) robot[attr] = 5;
    return { ...robot, ...overrides };
  };

  it('should calculate cost for a valid single-attribute upgrade', () => {
    const robot = makeRobot({ combatPower: 5 });
    const upgrades = { combatPower: { currentLevel: 5, plannedLevel: 6 } };

    const result = validateAndCalculateUpgrades(upgrades, robot, 0, baseAcademyLevels);

    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.upgradeOperations).toHaveLength(1);
    expect(result.upgradeOperations[0].attribute).toBe('combatPower');
    expect(result.upgradeOperations[0].fromLevel).toBe(5);
    expect(result.upgradeOperations[0].toLevel).toBe(6);
  });

  it('should apply training facility discount', () => {
    const robot = makeRobot({ combatPower: 5 });
    const upgrades = { combatPower: { currentLevel: 5, plannedLevel: 6 } };

    const noDisco = validateAndCalculateUpgrades(upgrades, robot, 0, baseAcademyLevels);
    const withDisco = validateAndCalculateUpgrades(upgrades, robot, 3, baseAcademyLevels);

    // Training level 3 = 30% discount, so cost should be lower
    expect(withDisco.totalCost).toBeLessThan(noDisco.totalCost);
  });

  it('should throw for an invalid attribute name', () => {
    const robot = makeRobot();
    const upgrades = { invalidAttr: { currentLevel: 5, plannedLevel: 6 } };

    expect(() =>
      validateAndCalculateUpgrades(upgrades, robot, 0, baseAcademyLevels),
    ).toThrow(RobotError);
  });

  it('should throw when currentLevel does not match robot data', () => {
    const robot = makeRobot({ combatPower: 5 });
    // Client claims level 3, but robot is at 5
    const upgrades = { combatPower: { currentLevel: 3, plannedLevel: 6 } };

    expect(() =>
      validateAndCalculateUpgrades(upgrades, robot, 0, baseAcademyLevels),
    ).toThrow(/Current level mismatch/);
  });

  it('should throw when plannedLevel exceeds academy cap', () => {
    // Academy level 0 → cap = 10
    const lowAcademy: AcademyLevels = {
      combat_training_academy: 0,
      defense_training_academy: 0,
      mobility_training_academy: 0,
      ai_training_academy: 0,
    };
    const robot = makeRobot({ combatPower: 5 });
    const upgrades = { combatPower: { currentLevel: 5, plannedLevel: 11 } };

    expect(() =>
      validateAndCalculateUpgrades(upgrades, robot, 0, lowAcademy),
    ).toThrow(/exceeds cap/);
  });

  it('should throw when plannedLevel is not greater than currentLevel', () => {
    const robot = makeRobot({ combatPower: 5 });
    const upgrades = { combatPower: { currentLevel: 5, plannedLevel: 5 } };

    expect(() =>
      validateAndCalculateUpgrades(upgrades, robot, 0, baseAcademyLevels),
    ).toThrow(/Planned level must be greater/);
  });

  it('should sum costs for multi-level upgrades', () => {
    const robot = makeRobot({ combatPower: 5 });
    // Upgrade from 5 → 8 (3 levels)
    const upgrades = { combatPower: { currentLevel: 5, plannedLevel: 8 } };

    const result = validateAndCalculateUpgrades(upgrades, robot, 0, baseAcademyLevels);

    // Cost should be sum of base costs for levels 5, 6, 7
    // calculateBaseCost(5) = 9000, (6) = 10500, (7) = 12000 → total = 31500
    expect(result.totalCost).toBe(31500);
  });

  it('should handle multiple attributes in one call', () => {
    const robot = makeRobot({ combatPower: 5, armorPlating: 5 });
    const upgrades = {
      combatPower: { currentLevel: 5, plannedLevel: 6 },
      armorPlating: { currentLevel: 5, plannedLevel: 6 },
    };

    const result = validateAndCalculateUpgrades(upgrades, robot, 0, baseAcademyLevels);

    expect(result.upgradeOperations).toHaveLength(2);
    // Both attributes at same level → same cost each
    const singleCost = result.upgradeOperations[0].cost;
    expect(result.totalCost).toBe(singleCost * 2);
  });
});
