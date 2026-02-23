import {
  calculateEffectiveStatsWithStance,
  getStanceModifier,
  isValidStance,
  isValidYieldThreshold,
  calculateRepairCost,
  calculateAttributeSum,
  STANCE_MODIFIERS,
} from '../src/utils/robotCalculations';
import { Robot, WeaponInventory, Weapon, Prisma } from '@prisma/client';

// Mock robot data
const createMockRobot = (overrides?: Partial<Robot>): Robot => ({
  id: 1,
  userId: 1,
  name: 'TestBot',
  frameId: 1,
  paintJob: null,
  combatPower: new Prisma.Decimal(20),
  targetingSystems: new Prisma.Decimal(15),
  criticalSystems: new Prisma.Decimal(10),
  penetration: new Prisma.Decimal(10),
  weaponControl: new Prisma.Decimal(10),
  attackSpeed: new Prisma.Decimal(15),
  armorPlating: new Prisma.Decimal(20),
  shieldCapacity: new Prisma.Decimal(10),
  evasionThrusters: new Prisma.Decimal(18),
  damageDampeners: new Prisma.Decimal(10),
  counterProtocols: new Prisma.Decimal(15),
  hullIntegrity: new Prisma.Decimal(25),
  servoMotors: new Prisma.Decimal(10),
  gyroStabilizers: new Prisma.Decimal(10),
  hydraulicSystems: new Prisma.Decimal(10),
  powerCore: new Prisma.Decimal(10),
  combatAlgorithms: new Prisma.Decimal(10),
  threatAnalysis: new Prisma.Decimal(10),
  adaptiveAI: new Prisma.Decimal(10),
  logicCores: new Prisma.Decimal(10),
  syncProtocols: new Prisma.Decimal(10),
  supportSystems: new Prisma.Decimal(10),
  formationTactics: new Prisma.Decimal(10),
  currentHP: 250,
  maxHP: 250,
  currentShield: 20,
  maxShield: 20,
  damageTaken: 0,
  elo: 1200,
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
  cyclesInCurrentLeague: 0,
  fame: 0,
  titles: null,
  repairCost: 0,
  battleReadiness: 100,
  totalRepairsPaid: 0,
  yieldThreshold: 10,
  loadoutType: 'single',
  stance: 'balanced',
  mainWeaponId: null,
  offhandWeaponId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Stance Modifiers', () => {
  afterAll(() => {
    // Pure unit test - no cleanup needed
  });

  describe('getStanceModifier', () => {
    it('should return offensive stance modifiers', () => {
      expect(getStanceModifier('offensive', 'combatPower')).toBe(0.15);
      expect(getStanceModifier('offensive', 'attackSpeed')).toBe(0.10);
      expect(getStanceModifier('offensive', 'counterProtocols')).toBe(-0.10);
      expect(getStanceModifier('offensive', 'evasionThrusters')).toBe(-0.10);
    });

    it('should return defensive stance modifiers', () => {
      expect(getStanceModifier('defensive', 'armorPlating')).toBe(0.15);
      expect(getStanceModifier('defensive', 'counterProtocols')).toBe(0.15);
      expect(getStanceModifier('defensive', 'combatPower')).toBe(-0.10);
      expect(getStanceModifier('defensive', 'attackSpeed')).toBe(-0.10);
    });

    it('should return 0 for balanced stance', () => {
      expect(getStanceModifier('balanced', 'combatPower')).toBe(0);
      expect(getStanceModifier('balanced', 'attackSpeed')).toBe(0);
    });

    it('should return 0 for unknown attributes', () => {
      expect(getStanceModifier('offensive', 'unknownAttribute')).toBe(0);
    });
  });

  describe('calculateEffectiveStatsWithStance', () => {
    it('should calculate offensive stance modifiers correctly', () => {
      const robot = createMockRobot({ 
        stance: 'offensive',
        combatPower: new Prisma.Decimal(20),
        attackSpeed: new Prisma.Decimal(15),
        counterProtocols: new Prisma.Decimal(15),
        evasionThrusters: new Prisma.Decimal(18),
      });
      
      const stats = calculateEffectiveStatsWithStance(robot);
      
      // +15% to combatPower: 20 * 1.15 = 23
      expect(stats.combatPower).toBe(23);
      // +10% to attackSpeed: 15 * 1.10 = 16.5 (rounded to 2 decimals)
      expect(stats.attackSpeed).toBe(16.5);
      // -10% to counterProtocols: 15 * 0.90 = 13.5 (rounded to 2 decimals)
      expect(stats.counterProtocols).toBe(13.5);
      // -10% to evasionThrusters: 18 * 0.90 = 16.2 (rounded to 2 decimals)
      expect(stats.evasionThrusters).toBe(16.2);
    });

    it('should calculate defensive stance modifiers correctly', () => {
      const robot = createMockRobot({ 
        stance: 'defensive',
        armorPlating: new Prisma.Decimal(20),
        counterProtocols: new Prisma.Decimal(15),
        combatPower: new Prisma.Decimal(20),
        attackSpeed: new Prisma.Decimal(15),
      });
      
      const stats = calculateEffectiveStatsWithStance(robot);
      
      // +15% to armorPlating: 20 * 1.15 = 23
      expect(stats.armorPlating).toBe(23);
      // +15% to counterProtocols: 15 * 1.15 = 17.25 (rounded to 2 decimals)
      expect(stats.counterProtocols).toBe(17.25);
      // -10% to combatPower: 20 * 0.90 = 18
      expect(stats.combatPower).toBe(18);
      // -10% to attackSpeed: 15 * 0.90 = 13.5 (rounded to 2 decimals)
      expect(stats.attackSpeed).toBe(13.5);
    });

    it('should not apply modifiers for balanced stance', () => {
      const robot = createMockRobot({ 
        stance: 'balanced',
        combatPower: new Prisma.Decimal(20),
        attackSpeed: new Prisma.Decimal(15),
      });
      
      const stats = calculateEffectiveStatsWithStance(robot);
      
      expect(stats.combatPower).toBe(20);
      expect(stats.attackSpeed).toBe(15);
    });

    it('should apply stance modifiers after loadout modifiers', () => {
      const robot = createMockRobot({ 
        stance: 'offensive',
        loadoutType: 'two_handed',
        combatPower: new Prisma.Decimal(20), // base
        // two_handed gives +25% combatPower: 20 * 1.25 = 25
        // offensive gives +15% combatPower: 25 * 1.15 = 28.75 -> 28
      });
      
      const stats = calculateEffectiveStatsWithStance(robot);
      
      // Should be 28.75 (20 * 1.25 * 1.15 = 28.75, rounded to 2 decimals)
      expect(stats.combatPower).toBe(28.75);
    });
  });
});

describe('Validation Functions', () => {
  describe('isValidStance', () => {
    it('should accept valid stances', () => {
      expect(isValidStance('offensive')).toBe(true);
      expect(isValidStance('defensive')).toBe(true);
      expect(isValidStance('balanced')).toBe(true);
    });

    it('should accept case-insensitive stances', () => {
      expect(isValidStance('OFFENSIVE')).toBe(true);
      expect(isValidStance('Defensive')).toBe(true);
      expect(isValidStance('BALANCED')).toBe(true);
    });

    it('should reject invalid stances', () => {
      expect(isValidStance('aggressive')).toBe(false);
      expect(isValidStance('super_offensive')).toBe(false);
      expect(isValidStance('')).toBe(false);
    });
  });

  describe('isValidYieldThreshold', () => {
    it('should accept valid thresholds', () => {
      expect(isValidYieldThreshold(0)).toBe(true);
      expect(isValidYieldThreshold(10)).toBe(true);
      expect(isValidYieldThreshold(25)).toBe(true);
      expect(isValidYieldThreshold(50)).toBe(true);
    });

    it('should accept decimal values (will be rounded by database)', () => {
      expect(isValidYieldThreshold(12.5)).toBe(true);
      expect(isValidYieldThreshold(37.8)).toBe(true);
    });

    it('should reject values outside range', () => {
      expect(isValidYieldThreshold(-1)).toBe(false);
      expect(isValidYieldThreshold(51)).toBe(false);
      expect(isValidYieldThreshold(100)).toBe(false);
    });

    it('should reject non-numbers', () => {
      expect(isValidYieldThreshold(NaN)).toBe(false);
      expect(isValidYieldThreshold(Infinity)).toBe(false);
    });
  });
});

describe('Repair Cost Calculations', () => {
  const sumOfAllAttributes = 230; // Total of all 23 attributes
  const baseRepairCost = sumOfAllAttributes * 100; // 23,000

  describe('calculateRepairCost', () => {
    it('should calculate 2x multiplier for total destruction', () => {
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0); // 100% damage, 0% HP
      expect(cost).toBe(46000); // 23,000 * 1.0 * 2.0
    });

    it('should calculate 1.5x multiplier for heavy damage', () => {
      const cost = calculateRepairCost(sumOfAllAttributes, 95, 5); // 95% damage, 5% HP
      expect(cost).toBe(32775); // 23,000 * 0.95 * 1.5
    });

    it('should calculate no multiplier for normal yield', () => {
      const cost = calculateRepairCost(sumOfAllAttributes, 85, 15); // 85% damage, 15% HP
      expect(cost).toBe(19550); // 23,000 * 0.85 * 1.0
    });

    it('should calculate cost for victory scenario', () => {
      const cost = calculateRepairCost(sumOfAllAttributes, 60, 40); // 60% damage, 40% HP
      expect(cost).toBe(13800); // 23,000 * 0.60 * 1.0
    });

    it('should apply Repair Bay discount correctly', () => {
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 5); // Level 5 Repair Bay
      expect(cost).toBe(34500); // 23,000 * 1.0 * 2.0 * 0.75 (25% discount)
    });

    it('should cap Repair Bay discount at 50%', () => {
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 10); // Level 10 Repair Bay
      expect(cost).toBe(23000); // 23,000 * 1.0 * 2.0 * 0.5 (50% discount max)
    });

    it('should apply Repair Bay discount after damage multipliers', () => {
      const cost = calculateRepairCost(sumOfAllAttributes, 85, 15, 5); // Level 5 Repair Bay
      // 23,000 * 0.85 * 1.0 * 0.75 = 14,662.5 -> 14,663
      expect(cost).toBe(14663);
    });

    it('should handle no Repair Bay (level 0)', () => {
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 0);
      expect(cost).toBe(46000); // No discount
    });

    it('should handle partial Repair Bay levels', () => {
      const costLevel3 = calculateRepairCost(sumOfAllAttributes, 100, 0, 3); // 15% discount
      expect(costLevel3).toBe(39100); // 23,000 * 1.0 * 2.0 * 0.85
      
      const costLevel7 = calculateRepairCost(sumOfAllAttributes, 100, 0, 7); // 35% discount
      expect(costLevel7).toBe(29900); // 23,000 * 1.0 * 2.0 * 0.65
    });
  });

  describe('calculateAttributeSum', () => {
    it('should sum all 23 attributes correctly', () => {
      const robot = createMockRobot({
        combatPower: new Prisma.Decimal(10),
        targetingSystems: new Prisma.Decimal(10),
        criticalSystems: new Prisma.Decimal(10),
        penetration: new Prisma.Decimal(10),
        weaponControl: new Prisma.Decimal(10),
        attackSpeed: new Prisma.Decimal(10),
        armorPlating: new Prisma.Decimal(10),
        shieldCapacity: new Prisma.Decimal(10),
        evasionThrusters: new Prisma.Decimal(10),
        damageDampeners: new Prisma.Decimal(10),
        counterProtocols: new Prisma.Decimal(10),
        hullIntegrity: new Prisma.Decimal(10),
        servoMotors: new Prisma.Decimal(10),
        gyroStabilizers: new Prisma.Decimal(10),
        hydraulicSystems: new Prisma.Decimal(10),
        powerCore: new Prisma.Decimal(10),
        combatAlgorithms: new Prisma.Decimal(10),
        threatAnalysis: new Prisma.Decimal(10),
        adaptiveAI: new Prisma.Decimal(10),
        logicCores: new Prisma.Decimal(10),
        syncProtocols: new Prisma.Decimal(10),
        supportSystems: new Prisma.Decimal(10),
        formationTactics: new Prisma.Decimal(10),
      });
      
      expect(calculateAttributeSum(robot)).toBe(230); // 23 * 10
    });

    it('should handle different attribute values', () => {
      const robot = createMockRobot({
        combatPower: new Prisma.Decimal(25),
        targetingSystems: new Prisma.Decimal(30),
        criticalSystems: new Prisma.Decimal(15),
        // ... rest default to lower values
      });
      
      const sum = calculateAttributeSum(robot);
      expect(sum).toBeGreaterThan(230); // Should be higher than all 10s
    });
  });
});
