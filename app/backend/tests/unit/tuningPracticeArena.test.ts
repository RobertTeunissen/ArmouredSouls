/**
 * Unit tests for tuning bonuses in the Practice Arena
 *
 * Tests that `buildOwnedRobot()` from practiceArenaService correctly:
 * 1. Includes tuning bonuses in practice battle robot stats (maxHP/maxShield)
 * 2. Composes what-if attribute overrides with tuning bonuses correctly
 * 3. Leaves robot stats unchanged when tuning bonuses are empty
 *
 * **Validates: Requirements 5.1, 5.2**
 */

import { Prisma } from '../../generated/prisma';
import { ROBOT_ATTRIBUTES } from '../../src/services/tuning-pool/tuningPoolConfig';

// ── Mocks ────────────────────────────────────────────────────────────

const mockPrisma = {
  robot: {
    findUnique: jest.fn(),
  },
  weapon: {
    findUnique: jest.fn(),
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

const mockGetTuningBonuses = jest.fn();
jest.mock('../../src/services/tuning-pool', () => ({
  getTuningBonuses: mockGetTuningBonuses,
}));

import { buildOwnedRobot } from '../../src/services/practice-arena/practiceArenaService';

// ── Test Helpers ─────────────────────────────────────────────────────

/** Build a realistic mock weapon with all bonus fields. */
function buildMockWeapon(overrides: Record<string, unknown> = {}) {
  const weapon: Record<string, unknown> = {
    id: 1,
    name: 'Test Blade',
    weaponType: 'melee',
    baseDamage: 20,
    cooldown: 3,
    cost: 50000,
    handsRequired: 'one',
    damageType: 'physical',
    loadoutType: 'any',
    rangeBand: 'melee',
    specialProperty: null,
    description: null,
    createdAt: new Date(),
  };
  // Set all bonus fields to 0 by default
  for (const attr of ROBOT_ATTRIBUTES) {
    weapon[`${attr}Bonus`] = 0;
  }
  return { ...weapon, ...overrides };
}

/** Build a realistic mock robot with Prisma Decimal attributes and a weapon. */
function buildMockRobot(baseValue = 10, overrides: Record<string, unknown> = {}) {
  const weapon = buildMockWeapon(overrides.weaponOverrides as Record<string, unknown> ?? {});
  delete overrides.weaponOverrides;

  const robot: Record<string, unknown> = {
    id: 1,
    userId: 1,
    name: 'TestBot',
    frameId: 1,
    paintJob: null,
    currentHP: 100,
    maxHP: 100,
    currentShield: 40,
    maxShield: 40,
    damageTaken: 0,
    elo: new Prisma.Decimal(1200),
    totalBattles: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    currentLeague: 'bronze',
    leagueId: 'bronze_1',
    leaguePoints: 0,
    fame: 0,
    titles: null,
    repairCost: 0,
    battleReadiness: 100,
    totalRepairsPaid: 0,
    yieldThreshold: 10,
    loadoutType: 'single',
    stance: 'balanced',
    mainWeaponId: 1,
    offhandWeaponId: null,
    imageUrl: null,
    cyclesInCurrentLeague: 0,
    totalTagTeamBattles: 0,
    totalTagTeamWins: 0,
    totalTagTeamLosses: 0,
    totalTagTeamDraws: 0,
    timesTaggedIn: 0,
    timesTaggedOut: 0,
    kothWins: 0,
    kothMatches: 0,
    kothTotalZoneScore: 0,
    kothTotalZoneTime: 0,
    kothKills: 0,
    kothBestPlacement: null,
    kothCurrentWinStreak: 0,
    kothBestWinStreak: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    mainWeapon: {
      id: 1,
      userId: 1,
      weaponId: 1,
      customName: null,
      purchasedAt: new Date(),
      weapon,
    },
    offhandWeapon: null,
  };

  // Set all 23 attributes as Prisma Decimals
  for (const attr of ROBOT_ATTRIBUTES) {
    robot[attr] = new Prisma.Decimal(baseValue);
  }

  return { ...robot, ...overrides };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Practice Arena — Tuning Bonuses Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyRobotOwnership.mockResolvedValue(undefined);
  });

  describe('tuning bonuses included in practice battle robot stats', () => {
    it('should increase maxHP when tuning boosts hullIntegrity', async () => {
      const robot = buildMockRobot(10);
      mockPrisma.robot.findUnique.mockResolvedValue(robot);
      mockGetTuningBonuses.mockResolvedValue({ hullIntegrity: 5 });

      const result = await buildOwnedRobot(1, 1);

      // With tuning: effectiveHullIntegrity = (10 + 5) × 1.0 = 15
      // maxHP = BASE_HP(50) + 15 × HP_MULTIPLIER(5) = 50 + 75 = 125
      // Without tuning: maxHP = 50 + 10 × 5 = 100
      expect(result.maxHP).toBe(125);
      expect(result.maxHP).toBeGreaterThan(100);
      expect(result.currentHP).toBe(result.maxHP);
    });

    it('should increase maxShield when tuning boosts shieldCapacity', async () => {
      const robot = buildMockRobot(10);
      mockPrisma.robot.findUnique.mockResolvedValue(robot);
      mockGetTuningBonuses.mockResolvedValue({ shieldCapacity: 3 });

      const result = await buildOwnedRobot(1, 1);

      // With tuning: effectiveShieldCapacity = (10 + 3) × 1.0 = 13
      // maxShield = 13 × 4 = 52
      // Without tuning: maxShield = 10 × 4 = 40
      expect(result.maxShield).toBe(52);
      expect(result.maxShield).toBeGreaterThan(40);
      expect(result.currentShield).toBe(result.maxShield);
    });

    it('should boost both maxHP and maxShield when tuning affects both', async () => {
      const robot = buildMockRobot(10);
      mockPrisma.robot.findUnique.mockResolvedValue(robot);
      mockGetTuningBonuses.mockResolvedValue({
        hullIntegrity: 4,
        shieldCapacity: 2,
      });

      const result = await buildOwnedRobot(1, 1);

      // maxHP = 50 + (10 + 4) × 1.0 × 5 = 50 + 70 = 120
      expect(result.maxHP).toBe(120);
      // maxShield = (10 + 2) × 1.0 × 4 = 48
      expect(result.maxShield).toBe(48);
    });
  });

  describe('what-if overrides compose correctly with tuning bonuses', () => {
    it('should apply tuning on top of overridden base attributes', async () => {
      const robot = buildMockRobot(10);
      mockPrisma.robot.findUnique.mockResolvedValue(robot);
      // Tuning adds 5 to hullIntegrity
      mockGetTuningBonuses.mockResolvedValue({ hullIntegrity: 5 });

      // What-if override changes hullIntegrity base from 10 to 20
      const result = await buildOwnedRobot(1, 1, {
        attributes: { hullIntegrity: 20 },
      });

      // effectiveHullIntegrity = (overridden 20 + tuning 5) × 1.0 = 25
      // maxHP = 50 + 25 × 5 = 175
      expect(result.maxHP).toBe(175);
    });

    it('should apply tuning on top of overridden shieldCapacity', async () => {
      const robot = buildMockRobot(10);
      mockPrisma.robot.findUnique.mockResolvedValue(robot);
      mockGetTuningBonuses.mockResolvedValue({ shieldCapacity: 3 });

      // What-if override changes shieldCapacity base from 10 to 15
      const result = await buildOwnedRobot(1, 1, {
        attributes: { shieldCapacity: 15 },
      });

      // effectiveShieldCapacity = (overridden 15 + tuning 3) × 1.0 = 18
      // maxShield = 18 × 4 = 72
      expect(result.maxShield).toBe(72);
    });

    it('should compose attribute overrides and tuning for multiple attributes', async () => {
      const robot = buildMockRobot(10);
      mockPrisma.robot.findUnique.mockResolvedValue(robot);
      mockGetTuningBonuses.mockResolvedValue({
        hullIntegrity: 3,
        shieldCapacity: 2,
        combatPower: 4,
      });

      const result = await buildOwnedRobot(1, 1, {
        attributes: { hullIntegrity: 15, shieldCapacity: 12 },
      });

      // hullIntegrity: (overridden 15 + tuning 3) × 1.0 = 18 → maxHP = 50 + 18 × 5 = 140
      expect(result.maxHP).toBe(140);
      // shieldCapacity: (overridden 12 + tuning 2) × 1.0 = 14 → maxShield = 14 × 4 = 56
      expect(result.maxShield).toBe(56);
    });
  });

  describe('no tuning bonuses — robot stats unchanged from base', () => {
    it('should use stored DB maxHP/maxShield when tuning returns empty map', async () => {
      const robot = buildMockRobot(10, { maxHP: 100, maxShield: 40 });
      mockPrisma.robot.findUnique.mockResolvedValue(robot);
      mockGetTuningBonuses.mockResolvedValue({});

      const result = await buildOwnedRobot(1, 1);

      // No tuning, no overrides → use stored DB values
      expect(result.maxHP).toBe(100);
      expect(result.maxShield).toBe(40);
      expect(result.currentHP).toBe(100);
      expect(result.currentShield).toBe(40);
    });

    it('should recalculate stats with what-if overrides but no tuning', async () => {
      const robot = buildMockRobot(10, { maxHP: 100, maxShield: 40 });
      mockPrisma.robot.findUnique.mockResolvedValue(robot);
      mockGetTuningBonuses.mockResolvedValue({});

      const result = await buildOwnedRobot(1, 1, {
        attributes: { hullIntegrity: 20 },
      });

      // Attribute override triggers recalculation, but tuning is empty
      // effectiveHullIntegrity = (overridden 20 + tuning 0) × 1.0 = 20
      // maxHP = 50 + 20 × 5 = 150
      expect(result.maxHP).toBe(150);
    });

    it('should call getTuningBonuses with the correct robotId', async () => {
      const robot = buildMockRobot(10, { id: 42 });
      mockPrisma.robot.findUnique.mockResolvedValue(robot);
      mockGetTuningBonuses.mockResolvedValue({});

      await buildOwnedRobot(1, 42);

      expect(mockGetTuningBonuses).toHaveBeenCalledWith(42);
    });
  });
});
