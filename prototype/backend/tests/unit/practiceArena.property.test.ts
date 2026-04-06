/**
 * Property-based tests for the Practice Arena
 *
 * Uses fast-check to verify correctness properties across random inputs.
 * Each test tagged: Feature: practice-arena, Property {N}: {title}
 * Minimum 100 iterations per property.
 *
 * Requirements: 5.1, 5.4, 6.5, 6.6, 7.1, 7.7, 10.5, 13.1, 13.4
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
  practiceArenaDailyStats: {
    upsert: jest.fn(),
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

jest.mock('../../src/services/practice-arena/practiceArenaMetrics', () => {
  const actual = jest.requireActual('../../src/services/practice-arena/practiceArenaMetrics');
  return {
    ...actual,
    practiceArenaMetrics: {
      recordBattle: jest.fn(),
    },
  };
});

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import fc from 'fast-check';
import {
  buildSparringPartner,
  executePracticeBattle,
  resetSyntheticIdCounter,
  resetFullWeaponCache,
} from '../../src/services/practice-arena/practiceArenaService';
import type { SparringPartnerConfig, BotTier } from '../../src/services/practice-arena/practiceArenaService';
import type { WeaponRecord } from '../../src/utils/weaponSelection';
import { PracticeArenaMetrics } from '../../src/services/practice-arena/practiceArenaMetrics';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared Fixtures
// ---------------------------------------------------------------------------

/** Weapon catalog covering all price tiers and types */
function buildWeaponCatalog(): WeaponRecord[] {
  return [
    // Budget tier (WimpBot: 0–99,999)
    { id: 1, name: 'Practice Sword', cost: 0, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
    { id: 2, name: 'Practice Blaster', cost: 500, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'short' },
    { id: 3, name: 'Light Shield', cost: 1000, handsRequired: 'shield', weaponType: 'shield', rangeBand: null },
    { id: 4, name: 'War Club', cost: 2000, handsRequired: 'two', weaponType: 'melee', rangeBand: 'melee' },
    { id: 5, name: 'Budget Mid', cost: 3000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'mid' },
    { id: 6, name: 'Budget Long', cost: 4000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'long' },
    // Standard tier (AverageBot: 100,000–250,000)
    { id: 10, name: 'Energy Blade', cost: 120000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
    { id: 11, name: 'Machine Gun', cost: 150000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'mid' },
    { id: 12, name: 'Barrier Shield', cost: 180000, handsRequired: 'shield', weaponType: 'shield', rangeBand: null },
    { id: 13, name: 'Shock Maul', cost: 200000, handsRequired: 'two', weaponType: 'melee', rangeBand: 'melee' },
    { id: 14, name: 'Avg Short', cost: 130000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'short' },
    { id: 15, name: 'Avg Long', cost: 140000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'long' },
    // Premium tier (ExpertBot: 250,000–400,000)
    { id: 20, name: 'Power Sword', cost: 300000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
    { id: 21, name: 'Assault Rifle', cost: 350000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'long' },
    { id: 22, name: 'Fortress Shield', cost: 380000, handsRequired: 'shield', weaponType: 'shield', rangeBand: null },
    { id: 23, name: 'Thermal Lance', cost: 390000, handsRequired: 'two', weaponType: 'melee', rangeBand: 'melee' },
    { id: 24, name: 'Expert Short', cost: 260000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'short' },
    { id: 25, name: 'Expert Mid', cost: 270000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'mid' },
    // Ultimate tier (UltimateBot: 400,000+)
    { id: 30, name: 'Battle Axe', cost: 450000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
    { id: 31, name: 'Railgun', cost: 500000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'long' },
    { id: 32, name: 'Aegis Bulwark', cost: 600000, handsRequired: 'shield', weaponType: 'shield', rangeBand: null },
    { id: 33, name: 'Heavy Hammer', cost: 700000, handsRequired: 'two', weaponType: 'melee', rangeBand: 'melee' },
    { id: 34, name: 'Lux Short', cost: 420000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'short' },
    { id: 35, name: 'Lux Mid', cost: 430000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'mid' },
  ];
}

/** Price tier lookup by bot tier */
const PRICE_TIERS: Record<BotTier, { min: number; max: number }> = {
  WimpBot: { min: 0, max: 99999 },
  AverageBot: { min: 100000, max: 250000 },
  ExpertBot: { min: 250000, max: 400000 },
  UltimateBot: { min: 400000, max: Infinity },
};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbBotTier = fc.constantFrom<BotTier>('WimpBot', 'AverageBot', 'ExpertBot', 'UltimateBot');
const arbLoadoutType = fc.constantFrom<SparringPartnerConfig['loadoutType']>('single', 'weapon_shield', 'two_handed', 'dual_wield');
const arbRangeBand = fc.constantFrom<SparringPartnerConfig['rangeBand']>('melee', 'short', 'mid', 'long');
const arbStance = fc.constantFrom<SparringPartnerConfig['stance']>('offensive', 'defensive', 'balanced');
const arbYieldThreshold = fc.integer({ min: 0, max: 50 });

const arbSparringConfig = fc.record({
  botTier: arbBotTier,
  loadoutType: arbLoadoutType,
  rangeBand: arbRangeBand,
  stance: arbStance,
  yieldThreshold: arbYieldThreshold,
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Practice Arena Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSyntheticIdCounter();
    resetFullWeaponCache();
    mockPrisma.weapon.findMany.mockResolvedValue(buildWeaponCatalog());
  });

  // =========================================================================
  // Property 5: Zero database side effects
  // =========================================================================
  describe('Feature: practice-arena, Property 5: Zero database side effects', () => {
    it('for any valid sparring-vs-sparring battle, zero Prisma write calls', async () => {
      await fc.assert(
        fc.asyncProperty(arbSparringConfig, arbSparringConfig, async (config1, config2) => {
          jest.clearAllMocks();
          resetSyntheticIdCounter();

          mockSimulateBattle.mockReturnValue({
            winnerId: -1,
            robot1FinalHP: 50,
            robot2FinalHP: 0,
            robot1FinalShield: 0,
            robot2FinalShield: 0,
            robot1Damage: 50,
            robot2Damage: 100,
            robot1DamageDealt: 100,
            robot2DamageDealt: 50,
            durationSeconds: 30,
            isDraw: false,
            events: [{ timestamp: 0, type: 'attack', message: 'Hit' }],
          });
          mockConvertSimulatorEvents.mockReturnValue([]);
          mockPrisma.weapon.findMany.mockResolvedValue(buildWeaponCatalog());

          await executePracticeBattle(1, {
            robot1: { type: 'sparring', config: config1 },
            robot2: { type: 'sparring', config: config2 },
          });

          // Assert zero write operations on any table
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
        }),
        { numRuns: 100 },
      );
    });

    /**
     * Validates: Requirements 5.1
     */
  });

  // =========================================================================
  // Property 7: Sparring partner weapon auto-selection validity
  // =========================================================================
  describe('Feature: practice-arena, Property 7: Sparring partner weapon auto-selection validity', () => {
    it('for any (botTier, loadoutType, rangeBand), auto-selected weapons are within price tier and compatible with loadout', async () => {
      const weapons = buildWeaponCatalog();

      await fc.assert(
        fc.asyncProperty(arbSparringConfig, async (config) => {
          resetSyntheticIdCounter();
          const robot = await buildSparringPartner(config, weapons);
          const priceTier = PRICE_TIERS[config.botTier];

          // Main weapon must exist
          expect(robot.mainWeapon).toBeDefined();
          const mainWeaponCost = robot.mainWeapon!.weapon.cost;

          // Main weapon cost within price tier
          expect(mainWeaponCost).toBeGreaterThanOrEqual(priceTier.min);
          if (priceTier.max !== Infinity) {
            expect(mainWeaponCost).toBeLessThanOrEqual(priceTier.max);
          }

          // Main weapon should not be a shield
          expect(robot.mainWeapon!.weapon.weaponType).not.toBe('shield');

          // Loadout compatibility
          if (config.loadoutType === 'two_handed') {
            expect(robot.mainWeapon!.weapon.handsRequired).toBe('two');
          } else {
            expect(robot.mainWeapon!.weapon.handsRequired).toBe('one');
          }

          // Offhand checks
          if (config.loadoutType === 'weapon_shield') {
            expect(robot.offhandWeapon).toBeDefined();
            expect(robot.offhandWeapon!.weapon.weaponType).toBe('shield');
            expect(robot.offhandWeapon!.weapon.handsRequired).toBe('shield');
            const offhandCost = robot.offhandWeapon!.weapon.cost;
            expect(offhandCost).toBeGreaterThanOrEqual(priceTier.min);
            if (priceTier.max !== Infinity) {
              expect(offhandCost).toBeLessThanOrEqual(priceTier.max);
            }
          } else if (config.loadoutType === 'dual_wield') {
            expect(robot.offhandWeapon).toBeDefined();
            expect(robot.offhandWeapon!.weapon.weaponType).not.toBe('shield');
          } else if (config.loadoutType === 'single' || config.loadoutType === 'two_handed') {
            expect(robot.offhandWeapon).toBeNull();
          }
        }),
        { numRuns: 100 },
      );
    });

    /**
     * Validates: Requirements 6.5
     */
  });

  // =========================================================================
  // Property 8: What-If override application
  // =========================================================================
  describe('Feature: practice-arena, Property 8: What-If override application', () => {
    it('for any valid overrides, built sparring partner reflects overridden stance/yield while preserving tier attributes', async () => {
      const weapons = buildWeaponCatalog();

      await fc.assert(
        fc.asyncProperty(arbBotTier, arbStance, arbYieldThreshold, arbLoadoutType, arbRangeBand, async (botTier, stance, yieldThreshold, loadoutType, rangeBand) => {
          resetSyntheticIdCounter();
          const config: SparringPartnerConfig = {
            botTier,
            loadoutType,
            rangeBand,
            stance,
            yieldThreshold,
          };

          const robot = await buildSparringPartner(config, weapons);

          // Overridden values should be reflected
          expect(robot.stance).toBe(stance);
          expect(robot.yieldThreshold).toBe(yieldThreshold);
          expect(robot.loadoutType).toBe(loadoutType);

          // Tier attributes should be preserved (not overridden)
          const expectedAttr = botTier === 'WimpBot' ? 1 : botTier === 'AverageBot' ? 5 : botTier === 'ExpertBot' ? 10 : 15;
          expect(Number(robot.combatPower)).toBe(expectedAttr);
          expect(Number(robot.armorPlating)).toBe(expectedAttr);
          expect(Number(robot.hullIntegrity)).toBe(expectedAttr);
        }),
        { numRuns: 100 },
      );
    });

    /**
     * Validates: Requirements 7.1
     */
  });

  // =========================================================================
  // Property 9: Upgrade cost estimation non-negative
  // =========================================================================
  describe('Feature: practice-arena, Property 9: Upgrade cost estimation non-negative', () => {
    /**
     * The attribute upgrade cost formula from robots.ts:
     * baseCost = (level + 1) * 1500 per level step.
     * Total cost = sum of baseCost for each level from current to target-1.
     */
    function estimateUpgradeCost(currentLevel: number, targetLevel: number): number {
      if (currentLevel >= targetLevel) return 0;
      let cost = 0;
      for (let level = currentLevel; level < targetLevel; level++) {
        cost += (level + 1) * 1500;
      }
      return cost;
    }

    it('for any (current, target) in [1, 50], cost >= 0 and cost == 0 when current >= target', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 50 }),
          (current, target) => {
            const cost = estimateUpgradeCost(current, target);
            expect(cost).toBeGreaterThanOrEqual(0);
            if (current >= target) {
              expect(cost).toBe(0);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * Validates: Requirements 7.7
     */
  });

  // =========================================================================
  // Property 13: Invalid configuration rejection
  // =========================================================================
  describe('Feature: practice-arena, Property 13: Invalid configuration rejection', () => {
    // Zod schemas from the route
    const sparringPartnerConfigSchema = z.object({
      botTier: z.enum(['WimpBot', 'AverageBot', 'ExpertBot', 'UltimateBot']),
      loadoutType: z.enum(['single', 'weapon_shield', 'two_handed', 'dual_wield']),
      rangeBand: z.enum(['melee', 'short', 'mid', 'long']),
      stance: z.enum(['offensive', 'defensive', 'balanced']),
      yieldThreshold: z.number().int().min(0).max(50),
    });

    const attributeOverridesSchema = z.object({
      combatPower: z.number().int().min(1).max(50).optional(),
      targetingSystems: z.number().int().min(1).max(50).optional(),
      criticalSystems: z.number().int().min(1).max(50).optional(),
      penetration: z.number().int().min(1).max(50).optional(),
      weaponControl: z.number().int().min(1).max(50).optional(),
      attackSpeed: z.number().int().min(1).max(50).optional(),
      armorPlating: z.number().int().min(1).max(50).optional(),
      shieldCapacity: z.number().int().min(1).max(50).optional(),
      evasionThrusters: z.number().int().min(1).max(50).optional(),
      damageDampeners: z.number().int().min(1).max(50).optional(),
      counterProtocols: z.number().int().min(1).max(50).optional(),
      hullIntegrity: z.number().int().min(1).max(50).optional(),
      servoMotors: z.number().int().min(1).max(50).optional(),
      gyroStabilizers: z.number().int().min(1).max(50).optional(),
      hydraulicSystems: z.number().int().min(1).max(50).optional(),
      powerCore: z.number().int().min(1).max(50).optional(),
      combatAlgorithms: z.number().int().min(1).max(50).optional(),
      threatAnalysis: z.number().int().min(1).max(50).optional(),
      adaptiveAI: z.number().int().min(1).max(50).optional(),
      logicCores: z.number().int().min(1).max(50).optional(),
      syncProtocols: z.number().int().min(1).max(50).optional(),
      supportSystems: z.number().int().min(1).max(50).optional(),
      formationTactics: z.number().int().min(1).max(50).optional(),
    });

    const whatIfOverridesSchema = z.object({
      attributes: attributeOverridesSchema.optional(),
      mainWeaponId: z.number().int().min(1).optional(),
      offhandWeaponId: z.number().int().min(1).optional(),
      loadoutType: z.enum(['single', 'weapon_shield', 'two_handed', 'dual_wield']).optional(),
      stance: z.enum(['offensive', 'defensive', 'balanced']).optional(),
      yieldThreshold: z.number().int().min(0).max(50).optional(),
    });

    it('for any attribute value outside [1, 50], validation rejects', () => {
      const attributes = [
        'combatPower', 'targetingSystems', 'criticalSystems', 'penetration',
        'weaponControl', 'attackSpeed', 'armorPlating', 'shieldCapacity',
        'evasionThrusters', 'damageDampeners', 'counterProtocols', 'hullIntegrity',
        'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
        'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
        'syncProtocols', 'supportSystems', 'formationTactics',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...attributes),
          fc.oneof(
            fc.integer({ min: -100, max: 0 }),  // below min
            fc.integer({ min: 51, max: 200 }),   // above max
          ),
          (attr, value) => {
            const result = whatIfOverridesSchema.safeParse({ attributes: { [attr]: value } });
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('for any yield threshold outside [0, 50], sparring config validation rejects', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -100, max: -1 }),  // below min
            fc.integer({ min: 51, max: 200 }),    // above max
          ),
          (yieldThreshold) => {
            const result = sparringPartnerConfigSchema.safeParse({
              botTier: 'WimpBot',
              loadoutType: 'single',
              rangeBand: 'melee',
              stance: 'balanced',
              yieldThreshold,
            });
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * Validates: Requirements 10.5
     */
  });

  // =========================================================================
  // Property 14: Metrics counter accuracy
  // =========================================================================
  describe('Feature: practice-arena, Property 14: Metrics counter accuracy', () => {
    it('for any random sequence of recordBattle/recordRateLimitHit calls, getStats returns correct counts', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.record({ type: fc.constant('battle' as const), userId: fc.integer({ min: 1, max: 100 }) }),
              fc.record({ type: fc.constant('rateLimit' as const) }),
            ),
            { minLength: 0, maxLength: 50 },
          ),
          (actions) => {
            const metrics = new PracticeArenaMetrics();
            let expectedBattles = 0;
            let expectedRateLimitHits = 0;
            const uniqueUsers = new Set<number>();

            for (const action of actions) {
              if (action.type === 'battle') {
                metrics.recordBattle(action.userId);
                expectedBattles++;
                uniqueUsers.add(action.userId);
              } else {
                metrics.recordRateLimitHit();
                expectedRateLimitHits++;
              }
            }

            const stats = metrics.getStats();
            expect(stats.totalBattlesSinceStart).toBe(expectedBattles);
            expect(stats.battlesToday).toBe(expectedBattles);
            expect(stats.rateLimitHitsToday).toBe(expectedRateLimitHits);
            expect(stats.uniquePlayersToday).toBe(uniqueUsers.size);
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * Validates: Requirements 13.1
     */
  });

  // =========================================================================
  // Property 15: Metrics daily flush preserves lifetime counter
  // =========================================================================
  describe('Feature: practice-arena, Property 15: Metrics daily flush preserves lifetime counter', () => {
    it('for any metrics state, after flushAndReset, daily counters are zero but totalBattlesSinceStart is unchanged', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({ type: fc.constant('battle' as const), userId: fc.integer({ min: 1, max: 100 }) }),
            { minLength: 1, maxLength: 30 },
          ),
          fc.integer({ min: 0, max: 10 }),
          async (battles, rateLimitHits) => {
            mockPrisma.practiceArenaDailyStats.upsert.mockResolvedValue({});

            const metrics = new PracticeArenaMetrics();

            for (const b of battles) {
              metrics.recordBattle(b.userId);
            }
            for (let i = 0; i < rateLimitHits; i++) {
              metrics.recordRateLimitHit();
            }

            const preFlush = metrics.getStats();
            const expectedLifetime = preFlush.totalBattlesSinceStart;

            await metrics.flushAndReset();

            const postFlush = metrics.getStats();
            expect(postFlush.battlesToday).toBe(0);
            expect(postFlush.rateLimitHitsToday).toBe(0);
            expect(postFlush.uniquePlayersToday).toBe(0);
            expect(postFlush.totalBattlesSinceStart).toBe(expectedLifetime);
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * Validates: Requirements 13.4
     */
  });
});
