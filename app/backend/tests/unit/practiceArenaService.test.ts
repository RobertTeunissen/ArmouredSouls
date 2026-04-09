/**
 * Unit tests for the Practice Arena Service
 *
 * Tests buildOwnedRobot, buildSparringPartner, executePracticeBattle,
 * and getSparringPartnerDefinitions. All external dependencies (Prisma,
 * combat simulator, combat message generator, ownership middleware) are mocked.
 *
 * Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.3, 4.1, 5.1, 5.2, 5.3, 5.4, 5.5,
 *               6.1, 6.5, 6.6, 6.8, 7.1, 12.3
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockPrisma = {
  robot: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateMany: jest.fn(),
    createMany: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  weapon: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  battle: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  battleParticipant: {
    create: jest.fn(),
    createMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
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

const mockSimulateBattle = jest.fn();
jest.mock('../../src/services/battle/combatSimulator', () => ({
  simulateBattle: mockSimulateBattle,
}));

const mockConvertSimulatorEvents = jest.fn();
jest.mock('../../src/services/battle/combatMessageGenerator', () => ({
  CombatMessageGenerator: {
    convertSimulatorEvents: mockConvertSimulatorEvents,
  },
}));

const mockRecordBattle = jest.fn();
jest.mock('../../src/services/practice-arena/practiceArenaMetrics', () => ({
  practiceArenaMetrics: {
    recordBattle: mockRecordBattle,
  },
}));

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  buildOwnedRobot,
  buildSparringPartner,
  executePracticeBattle,
  getSparringPartnerDefinitions,
  resetSyntheticIdCounter,
  resetFullWeaponCache,
  ULTIMATE_BOT_CONFIG,
} from '../../src/services/practice-arena/practiceArenaService';
import type { SparringPartnerConfig } from '../../src/services/practice-arena/practiceArenaService';
import { AppError } from '../../src/errors';
import { TIER_CONFIGS } from '../../src/utils/tierConfig';
import type { WeaponRecord } from '../../src/utils/weaponSelection';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

/** Minimal weapon catalog covering all price tiers and types */
function buildWeaponCatalog(): WeaponRecord[] {
  return [
    // Budget tier (WimpBot: 0–99,999)
    { id: 1, name: 'Practice Sword', cost: 0, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
    { id: 2, name: 'Practice Blaster', cost: 500, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'short' },
    { id: 3, name: 'Light Shield', cost: 1000, handsRequired: 'shield', weaponType: 'shield', rangeBand: null },
    { id: 4, name: 'War Club', cost: 2000, handsRequired: 'two', weaponType: 'melee', rangeBand: 'melee' },
    // Standard tier (AverageBot: 100,000–250,000)
    { id: 10, name: 'Energy Blade', cost: 120000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
    { id: 11, name: 'Machine Gun', cost: 150000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'mid' },
    { id: 12, name: 'Barrier Shield', cost: 180000, handsRequired: 'shield', weaponType: 'shield', rangeBand: null },
    { id: 13, name: 'Shock Maul', cost: 200000, handsRequired: 'two', weaponType: 'melee', rangeBand: 'melee' },
    // Premium tier (ExpertBot: 250,000–400,000)
    { id: 20, name: 'Power Sword', cost: 300000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
    { id: 21, name: 'Assault Rifle', cost: 350000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'long' },
    { id: 22, name: 'Fortress Shield', cost: 380000, handsRequired: 'shield', weaponType: 'shield', rangeBand: null },
    { id: 23, name: 'Thermal Lance', cost: 390000, handsRequired: 'two', weaponType: 'melee', rangeBand: 'melee' },
    // Ultimate tier (UltimateBot: 400,000+)
    { id: 30, name: 'Battle Axe', cost: 450000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
    { id: 31, name: 'Railgun', cost: 500000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'long' },
    { id: 32, name: 'Aegis Bulwark', cost: 600000, handsRequired: 'shield', weaponType: 'shield', rangeBand: null },
    { id: 33, name: 'Heavy Hammer', cost: 700000, handsRequired: 'two', weaponType: 'melee', rangeBand: 'melee' },
  ];
}

/**
 * Build a mock DB robot with weapon includes.
 * Uses plain numbers for attributes (not Prisma.Decimal) so that
 * structuredClone works in the test environment. The service code
 * wraps overrides in Prisma.Decimal, and the combat engine reads
 * via Number() coercion, so plain numbers work correctly.
 */
function buildMockDbRobot(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    userId: 1,
    name: 'Test Robot',
    frameId: 1,
    paintJob: null,
    combatPower: 5,
    targetingSystems: 5,
    criticalSystems: 5,
    penetration: 5,
    weaponControl: 5,
    attackSpeed: 5,
    armorPlating: 5,
    shieldCapacity: 5,
    evasionThrusters: 5,
    damageDampeners: 5,
    counterProtocols: 5,
    hullIntegrity: 5,
    servoMotors: 5,
    gyroStabilizers: 5,
    hydraulicSystems: 5,
    powerCore: 5,
    combatAlgorithms: 5,
    threatAnalysis: 5,
    adaptiveAI: 5,
    logicCores: 5,
    syncProtocols: 5,
    supportSystems: 5,
    formationTactics: 5,
    currentHP: 50,
    maxHP: 100,
    currentShield: 10,
    maxShield: 20,
    damageTaken: 0,
    elo: 1200,
    totalBattles: 10,
    wins: 5,
    draws: 1,
    losses: 4,
    damageDealtLifetime: 500,
    damageTakenLifetime: 300,
    kills: 2,
    currentLeague: 'bronze',
    leagueId: 'bronze_1',
    leaguePoints: 50,
    cyclesInCurrentLeague: 3,
    fame: 100,
    titles: null,
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
    repairCost: 0,
    battleReadiness: 100,
    totalRepairsPaid: 0,
    yieldThreshold: 20,
    loadoutType: 'single',
    stance: 'balanced',
    mainWeaponId: 100,
    offhandWeaponId: null,
    imageUrl: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    mainWeapon: {
      id: 100,
      weaponId: 1,
      userId: 1,
      customName: null,
      purchasedAt: new Date(),
      weapon: {
        id: 1,
        name: 'Practice Sword',
        weaponType: 'melee',
        baseDamage: 5,
        cooldown: 3,
        cost: 0,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
        specialProperty: null,
        description: null,
        rangeBand: 'melee',
        combatPowerBonus: 0,
        targetingSystemsBonus: 0,
        criticalSystemsBonus: 0,
        penetrationBonus: 0,
        weaponControlBonus: 0,
        attackSpeedBonus: 0,
        armorPlatingBonus: 0,
        shieldCapacityBonus: 0,
        evasionThrustersBonus: 0,
        damageDampenersBonus: 0,
        counterProtocolsBonus: 0,
        hullIntegrityBonus: 0,
        servoMotorsBonus: 0,
        gyroStabilizersBonus: 0,
        hydraulicSystemsBonus: 0,
        powerCoreBonus: 0,
        combatAlgorithmsBonus: 0,
        threatAnalysisBonus: 0,
        adaptiveAIBonus: 0,
        logicCoresBonus: 0,
        syncProtocolsBonus: 0,
        supportSystemsBonus: 0,
        formationTacticsBonus: 0,
        createdAt: new Date(),
      },
    },
    offhandWeapon: null,
    ...overrides,
  };
}

/** Build a mock CombatResult */
function buildMockCombatResult() {
  return {
    winnerId: 42,
    robot1FinalHP: 80,
    robot2FinalHP: 0,
    robot1FinalShield: 5,
    robot2FinalShield: 0,
    robot1Damage: 20,
    robot2Damage: 100,
    robot1DamageDealt: 100,
    robot2DamageDealt: 20,
    durationSeconds: 45.5,
    isDraw: false,
    events: [
      { timestamp: 0, type: 'attack', message: 'Battle start' },
      { timestamp: 1.5, type: 'attack', message: 'Hit', damage: 10 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Practice Arena Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSyntheticIdCounter();
    resetFullWeaponCache();
  });

  // =========================================================================
  // getSparringPartnerDefinitions
  // =========================================================================
  describe('getSparringPartnerDefinitions', () => {
    it('should return exactly 4 entries', () => {
      const defs = getSparringPartnerDefinitions();
      expect(defs).toHaveLength(4);
    });

    it('should return correct attribute levels for each tier', () => {
      const defs = getSparringPartnerDefinitions();
      const byTier = Object.fromEntries(defs.map((d) => [d.botTier, d]));

      expect(byTier['WimpBot'].attributeLevel).toBe(TIER_CONFIGS[0].attributeLevel);
      expect(byTier['AverageBot'].attributeLevel).toBe(TIER_CONFIGS[1].attributeLevel);
      expect(byTier['ExpertBot'].attributeLevel).toBe(TIER_CONFIGS[2].attributeLevel);
      expect(byTier['UltimateBot'].attributeLevel).toBe(ULTIMATE_BOT_CONFIG.attributeLevel);
    });

    it('should return correct price tiers matching tierConfig and UltimateBot', () => {
      const defs = getSparringPartnerDefinitions();
      const byTier = Object.fromEntries(defs.map((d) => [d.botTier, d]));

      expect(byTier['WimpBot'].priceTier).toEqual(TIER_CONFIGS[0].priceTier);
      expect(byTier['AverageBot'].priceTier).toEqual(TIER_CONFIGS[1].priceTier);
      expect(byTier['ExpertBot'].priceTier).toEqual(TIER_CONFIGS[2].priceTier);
      expect(byTier['UltimateBot'].priceTier).toEqual({ min: ULTIMATE_BOT_CONFIG.priceTier.min, max: null });
    });

    it('should include all loadout, range band, and stance options', () => {
      const defs = getSparringPartnerDefinitions();
      for (const def of defs) {
        expect(def.loadoutOptions).toEqual(['single', 'weapon_shield', 'two_handed', 'dual_wield']);
        expect(def.rangeBandOptions).toEqual(['melee', 'short', 'mid', 'long']);
        expect(def.stanceOptions).toEqual(['offensive', 'defensive', 'balanced']);
      }
    });
  });

  // =========================================================================
  // buildSparringPartner
  // =========================================================================
  describe('buildSparringPartner', () => {
    const weapons = buildWeaponCatalog();

    beforeEach(() => {
      mockPrisma.weapon.findMany.mockResolvedValue(weapons);
    });

    const tiers: Array<{ tier: SparringPartnerConfig['botTier']; expectedAttr: number }> = [
      { tier: 'WimpBot', expectedAttr: 1 },
      { tier: 'AverageBot', expectedAttr: 5 },
      { tier: 'ExpertBot', expectedAttr: 10 },
      { tier: 'UltimateBot', expectedAttr: 15 },
    ];

    it.each(tiers)(
      'should construct a valid RobotWithWeapons for $tier with attribute level $expectedAttr',
      async ({ tier, expectedAttr }) => {
        const config: SparringPartnerConfig = {
          botTier: tier,
          loadoutType: 'single',
          rangeBand: 'melee',
          stance: 'balanced',
          yieldThreshold: 20,
        };

        const robot = await buildSparringPartner(config, weapons);

        // All 23 attributes should equal the tier's attribute level
        expect(Number(robot.combatPower)).toBe(expectedAttr);
        expect(Number(robot.targetingSystems)).toBe(expectedAttr);
        expect(Number(robot.hullIntegrity)).toBe(expectedAttr);
        expect(Number(robot.shieldCapacity)).toBe(expectedAttr);
        expect(Number(robot.formationTactics)).toBe(expectedAttr);

        // Should have a main weapon
        expect(robot.mainWeapon).toBeDefined();
        expect(robot.mainWeapon!.weapon).toBeDefined();

        // HP/shield should be set (maxHP = currentHP, maxShield = currentShield)
        expect(robot.maxHP).toBeGreaterThan(0);
        expect(robot.currentHP).toBe(robot.maxHP);
        expect(robot.currentShield).toBe(robot.maxShield);

        // Synthetic negative IDs
        expect(robot.id).toBeLessThan(0);
        expect(robot.userId).toBe(-1);

        // Config applied
        expect(robot.stance).toBe('balanced');
        expect(robot.yieldThreshold).toBe(20);
        expect(robot.loadoutType).toBe('single');
      },
    );

    it('should auto-select a shield for weapon_shield loadout', async () => {
      const config: SparringPartnerConfig = {
        botTier: 'WimpBot',
        loadoutType: 'weapon_shield',
        rangeBand: 'melee',
        stance: 'defensive',
        yieldThreshold: 30,
      };

      const robot = await buildSparringPartner(config, weapons);

      expect(robot.mainWeapon).toBeDefined();
      expect(robot.offhandWeapon).toBeDefined();
      // The offhand should be a shield (weaponType === 'shield')
      expect(robot.offhandWeapon!.weapon.weaponType).toBe('shield');
    });

    it('should auto-select a second weapon for dual_wield loadout', async () => {
      const config: SparringPartnerConfig = {
        botTier: 'AverageBot',
        loadoutType: 'dual_wield',
        rangeBand: 'mid',
        stance: 'offensive',
        yieldThreshold: 10,
      };

      const robot = await buildSparringPartner(config, weapons);

      expect(robot.mainWeapon).toBeDefined();
      expect(robot.offhandWeapon).toBeDefined();
      // Dual wield offhand should NOT be a shield
      expect(robot.offhandWeapon!.weapon.weaponType).not.toBe('shield');
    });

    it('should not assign an offhand weapon for single loadout', async () => {
      const config: SparringPartnerConfig = {
        botTier: 'ExpertBot',
        loadoutType: 'single',
        rangeBand: 'long',
        stance: 'balanced',
        yieldThreshold: 25,
      };

      const robot = await buildSparringPartner(config, weapons);

      expect(robot.mainWeapon).toBeDefined();
      expect(robot.offhandWeapon).toBeNull();
    });

    it('should select weapons within the correct price tier', async () => {
      const config: SparringPartnerConfig = {
        botTier: 'ExpertBot',
        loadoutType: 'weapon_shield',
        rangeBand: 'melee',
        stance: 'balanced',
        yieldThreshold: 20,
      };

      const robot = await buildSparringPartner(config, weapons);
      const mainCost = robot.mainWeapon!.weapon.cost;
      const offhandCost = robot.offhandWeapon!.weapon.cost;

      // ExpertBot price tier: 250,000–400,000
      expect(mainCost).toBeGreaterThanOrEqual(250000);
      expect(mainCost).toBeLessThanOrEqual(400000);
      expect(offhandCost).toBeGreaterThanOrEqual(250000);
      expect(offhandCost).toBeLessThanOrEqual(400000);
    });
  });

  // =========================================================================
  // buildOwnedRobot
  // =========================================================================
  describe('buildOwnedRobot', () => {
    it('should clone robot data and apply attribute overrides correctly', async () => {
      const dbRobot = buildMockDbRobot();
      mockVerifyRobotOwnership.mockResolvedValue(undefined);
      mockPrisma.robot.findUnique.mockResolvedValue(dbRobot);

      const result = await buildOwnedRobot(1, 42, {
        attributes: { combatPower: 25, targetingSystems: 30 },
      });

      // Overridden attributes should reflect new values
      expect(Number(result.combatPower)).toBe(25);
      expect(Number(result.targetingSystems)).toBe(30);

      // Non-overridden attributes should retain original values
      expect(Number(result.armorPlating)).toBe(5);
      expect(Number(result.evasionThrusters)).toBe(5);

      // Original DB object should not be mutated (we cloned)
      expect(Number(dbRobot.combatPower)).toBe(5);
    });

    it('should set currentHP = maxHP and currentShield = maxShield even for damaged robots', async () => {
      // Robot with currentHP below maxHP (damaged)
      const dbRobot = buildMockDbRobot({ currentHP: 30, currentShield: 5 });
      mockVerifyRobotOwnership.mockResolvedValue(undefined);
      mockPrisma.robot.findUnique.mockResolvedValue(dbRobot);

      const result = await buildOwnedRobot(1, 42);

      // Practice battles always start at full health
      expect(result.currentHP).toBe(result.maxHP);
      expect(result.currentShield).toBe(result.maxShield);
      expect(result.maxHP).toBeGreaterThan(0);
    });

    it('should reject non-owned robots with 403', async () => {
      mockVerifyRobotOwnership.mockRejectedValue(
        new AppError('FORBIDDEN', 'Access denied', 403),
      );

      await expect(buildOwnedRobot(999, 42)).rejects.toThrow(AppError);
      await expect(buildOwnedRobot(999, 42)).rejects.toMatchObject({
        statusCode: 403,
      });

      expect(mockVerifyRobotOwnership).toHaveBeenCalledWith(
        expect.anything(), // prisma client
        42,
        999,
      );
    });

    it('should reject robots with no weapon and no weapon override with 400', async () => {
      const dbRobot = buildMockDbRobot({
        mainWeapon: null,
        mainWeaponId: null,
      });
      mockVerifyRobotOwnership.mockResolvedValue(undefined);
      mockPrisma.robot.findUnique.mockResolvedValue(dbRobot);

      await expect(buildOwnedRobot(1, 42)).rejects.toThrow(AppError);
      await expect(buildOwnedRobot(1, 42)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should apply loadout, stance, and yieldThreshold overrides', async () => {
      const dbRobot = buildMockDbRobot();
      mockVerifyRobotOwnership.mockResolvedValue(undefined);
      mockPrisma.robot.findUnique.mockResolvedValue(dbRobot);

      const result = await buildOwnedRobot(1, 42, {
        loadoutType: 'dual_wield',
        stance: 'offensive',
        yieldThreshold: 40,
      });

      expect(result.loadoutType).toBe('dual_wield');
      expect(result.stance).toBe('offensive');
      expect(result.yieldThreshold).toBe(40);
    });

    it('should swap main weapon when mainWeaponId override is provided', async () => {
      const dbRobot = buildMockDbRobot();
      mockVerifyRobotOwnership.mockResolvedValue(undefined);
      mockPrisma.robot.findUnique.mockResolvedValue(dbRobot);
      mockPrisma.weapon.findUnique.mockResolvedValue({
        id: 99,
        name: 'Override Weapon',
        weaponType: 'ballistic',
        baseDamage: 15,
        cooldown: 2,
        cost: 50000,
        handsRequired: 'one',
        damageType: 'ballistic',
        loadoutType: 'single',
        specialProperty: null,
        description: null,
        rangeBand: 'mid',
        combatPowerBonus: 0,
        targetingSystemsBonus: 0,
        criticalSystemsBonus: 0,
        penetrationBonus: 0,
        weaponControlBonus: 0,
        attackSpeedBonus: 0,
        armorPlatingBonus: 0,
        shieldCapacityBonus: 0,
        evasionThrustersBonus: 0,
        damageDampenersBonus: 0,
        counterProtocolsBonus: 0,
        hullIntegrityBonus: 0,
        servoMotorsBonus: 0,
        gyroStabilizersBonus: 0,
        hydraulicSystemsBonus: 0,
        powerCoreBonus: 0,
        combatAlgorithmsBonus: 0,
        threatAnalysisBonus: 0,
        adaptiveAIBonus: 0,
        logicCoresBonus: 0,
        syncProtocolsBonus: 0,
        supportSystemsBonus: 0,
        formationTacticsBonus: 0,
        createdAt: new Date(),
      });

      const result = await buildOwnedRobot(1, 42, { mainWeaponId: 99 });

      expect(result.mainWeapon!.weapon.name).toBe('Override Weapon');
      expect(result.mainWeapon!.weaponId).toBe(99);
    });
  });

  // =========================================================================
  // executePracticeBattle
  // =========================================================================
  describe('executePracticeBattle', () => {
    it('should return a PracticeBattleResult with combatResult, battleLog, and robot info', async () => {
      // Setup: sparring vs sparring (no DB reads for robots)
      const mockCombatResult = buildMockCombatResult();
      mockSimulateBattle.mockReturnValue(mockCombatResult);
      mockConvertSimulatorEvents.mockReturnValue([
        { timestamp: 0, type: 'battle_start', message: 'Battle begins!' },
      ]);
      mockPrisma.weapon.findMany.mockResolvedValue(buildWeaponCatalog());

      const result = await executePracticeBattle(1, {
        robot1: {
          type: 'sparring',
          config: {
            botTier: 'WimpBot',
            loadoutType: 'single',
            rangeBand: 'melee',
            stance: 'balanced',
            yieldThreshold: 20,
          },
        },
        robot2: {
          type: 'sparring',
          config: {
            botTier: 'ExpertBot',
            loadoutType: 'weapon_shield',
            rangeBand: 'melee',
            stance: 'defensive',
            yieldThreshold: 30,
          },
        },
      });

      // Verify result structure
      expect(result.combatResult).toBeDefined();
      expect(result.combatResult.winnerId).toBe(42);
      expect(result.combatResult.durationSeconds).toBe(45.5);
      expect(result.battleLog).toBeDefined();
      expect(result.battleLog).toHaveLength(1);
      expect(result.robot1Info).toBeDefined();
      expect(result.robot1Info.name).toContain('WimpBot');
      expect(result.robot1Info.maxHP).toBeGreaterThan(0);
      expect(result.robot2Info).toBeDefined();
      expect(result.robot2Info.name).toContain('ExpertBot');
      expect(result.robot2Info.maxHP).toBeGreaterThan(0);

      // Verify simulateBattle was called with two robot objects
      expect(mockSimulateBattle).toHaveBeenCalledTimes(1);
      expect(mockSimulateBattle).toHaveBeenCalledWith(
        expect.objectContaining({ name: expect.stringContaining('WimpBot') }),
        expect.objectContaining({ name: expect.stringContaining('ExpertBot') }),
      );

      // Verify metrics were recorded
      expect(mockRecordBattle).toHaveBeenCalledWith(1);
    });
  });

  // =========================================================================
  // Zero database writes
  // =========================================================================
  describe('Zero database side effects', () => {
    it('should NOT call any Prisma write operations during practice battle execution', async () => {
      const mockCombatResult = buildMockCombatResult();
      mockSimulateBattle.mockReturnValue(mockCombatResult);
      mockConvertSimulatorEvents.mockReturnValue([]);
      mockPrisma.weapon.findMany.mockResolvedValue(buildWeaponCatalog());

      await executePracticeBattle(1, {
        robot1: {
          type: 'sparring',
          config: {
            botTier: 'WimpBot',
            loadoutType: 'single',
            rangeBand: 'melee',
            stance: 'balanced',
            yieldThreshold: 20,
          },
        },
        robot2: {
          type: 'sparring',
          config: {
            botTier: 'AverageBot',
            loadoutType: 'single',
            rangeBand: 'short',
            stance: 'offensive',
            yieldThreshold: 15,
          },
        },
      });

      // Verify NO write operations on any table
      expect(mockPrisma.robot.create).not.toHaveBeenCalled();
      expect(mockPrisma.robot.update).not.toHaveBeenCalled();
      expect(mockPrisma.robot.delete).not.toHaveBeenCalled();
      expect(mockPrisma.robot.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.robot.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.robot.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.robot.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
      expect(mockPrisma.battle.create).not.toHaveBeenCalled();
      expect(mockPrisma.battle.update).not.toHaveBeenCalled();
      expect(mockPrisma.battle.delete).not.toHaveBeenCalled();
      expect(mockPrisma.battleParticipant.create).not.toHaveBeenCalled();
      expect(mockPrisma.battleParticipant.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // battlePostCombat never imported
  // =========================================================================
  describe('Architectural independence', () => {
    it('should not import battlePostCombat functions', () => {
      // Read the source file and verify no battlePostCombat imports
      const fs = require('fs');
      const path = require('path');
      const serviceSource = fs.readFileSync(
        path.resolve(__dirname, '../../src/services/practice-arena/practiceArenaService.ts'),
        'utf-8',
      );

      expect(serviceSource).not.toContain('battlePostCombat');
      expect(serviceSource).not.toContain('updateRobotCombatStats');
      expect(serviceSource).not.toContain('awardCreditsToUser');
      expect(serviceSource).not.toContain('awardPrestigeToUser');
      expect(serviceSource).not.toContain('awardFameToRobot');
      expect(serviceSource).not.toContain('logBattleAuditEvent');
      expect(serviceSource).not.toContain('awardStreamingRevenueForParticipant');
    });
  });
});
