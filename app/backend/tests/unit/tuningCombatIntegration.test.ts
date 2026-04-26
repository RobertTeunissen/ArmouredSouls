/**
 * Unit tests for tuning combat integration
 *
 * Tests that tuning bonuses are correctly integrated into the effective stats
 * calculation pipeline, including maxHP/maxShield recalculation and backward
 * compatibility when no tuning parameter is provided.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */

import fc from 'fast-check';
import {
  calculateEffectiveStats,
  calculateMaxHP,
  calculateMaxShield,
  BASE_HP,
  HP_MULTIPLIER,
  LOADOUT_BONUSES,
} from '../../src/utils/robotCalculations';
import type { TuningAttributeMap } from '../../src/services/tuning-pool';
import { getPerAttributeMax } from '../../src/services/tuning-pool/tuningPoolConfig';
import { Robot, Prisma } from '../../generated/prisma';

// ── Mock Robot Factory ──────────────────────────────────────────────

function createMockRobot(overrides?: Partial<Robot>): Robot {
  return {
    id: 1,
    userId: 1,
    name: 'TestBot',
    frameId: 1,
    paintJob: null,
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
    currentHP: 100,
    maxHP: 100,
    currentShield: 40,
    maxShield: 40,
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
    currentWinStreak: 0,
    bestWinStreak: 0,
    currentLoseStreak: 0,
    offensiveWins: 0,
    defensiveWins: 0,
    balancedWins: 0,
    dualWieldWins: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Tuning Combat Integration', () => {
  describe('calculateEffectiveStats with tuning bonuses', () => {
    it('should add tuning bonuses before loadout multiplier', () => {
      const robot = createMockRobot({ loadoutType: 'single' });
      const tuning: TuningAttributeMap = { combatPower: 5 };

      const stats = calculateEffectiveStats(robot, tuning);

      // (base 10 + tuning 5) × 1.0 = 15 (single loadout has no combatPower modifier)
      expect(stats.combatPower).toBe(15);
    });

    it('should apply loadout multiplier to tuning bonuses', () => {
      const robot = createMockRobot({ loadoutType: 'two_handed' });
      const tuning: TuningAttributeMap = { combatPower: 5 };

      const stats = calculateEffectiveStats(robot, tuning);

      // (base 10 + tuning 5) × 1.10 = 16.5
      expect(stats.combatPower).toBe(16.5);
    });

    it('should combine weapon bonus and tuning bonus before loadout', () => {
      const weapon = {
        id: 1, name: 'Test', weaponType: 'energy', baseDamage: 20, cooldown: 3,
        cost: 50000, handsRequired: 'one', damageType: 'energy', loadoutType: 'any',
        rangeBand: 'mid', specialProperty: null, description: null,
        combatPowerBonus: 3, targetingSystemsBonus: 0, criticalSystemsBonus: 0,
        penetrationBonus: 0, weaponControlBonus: 0, attackSpeedBonus: 0,
        armorPlatingBonus: 0, shieldCapacityBonus: 0, evasionThrustersBonus: 0,
        damageDampenersBonus: 0, counterProtocolsBonus: 0, hullIntegrityBonus: 0,
        servoMotorsBonus: 0, gyroStabilizersBonus: 0, hydraulicSystemsBonus: 0,
        powerCoreBonus: 0, combatAlgorithmsBonus: 0, threatAnalysisBonus: 0,
        adaptiveAIBonus: 0, logicCoresBonus: 0, syncProtocolsBonus: 0,
        supportSystemsBonus: 0, formationTacticsBonus: 0, createdAt: new Date(),
      };

      const robot = createMockRobot({ loadoutType: 'two_handed', mainWeaponId: 1 });
      const robotWithWeapon = {
        ...robot,
        mainWeapon: { id: 1, userId: 1, weaponId: 1, customName: null, purchasedAt: new Date(), weapon },
      };
      const tuning: TuningAttributeMap = { combatPower: 4 };

      const stats = calculateEffectiveStats(robotWithWeapon, tuning);

      // (base 10 + weapon 3 + tuning 4) × 1.10 = 18.7
      expect(stats.combatPower).toBe(18.7);
    });

    it('should apply tuning to multiple attributes independently', () => {
      const robot = createMockRobot({ loadoutType: 'single' });
      const tuning: TuningAttributeMap = {
        combatPower: 3,
        armorPlating: 5,
        hullIntegrity: 2,
      };

      const stats = calculateEffectiveStats(robot, tuning);

      expect(stats.combatPower).toBe(13);    // 10 + 3
      expect(stats.armorPlating).toBe(15);   // 10 + 5
      expect(stats.hullIntegrity).toBe(12);  // 10 + 2
      // Untuned attributes remain unchanged
      expect(stats.penetration).toBe(10);
    });
  });

  describe('tuning bonuses capped at academyCap + 5', () => {
    it('should allow tuning up to academyCap + 5 - baseValue', () => {
      // Academy cap 15, base 10 → max tuning = 10
      expect(getPerAttributeMax(15, 10)).toBe(10);
    });

    it('should return 5 when at academy cap (overclock only)', () => {
      // Academy cap 15, base 15 → max tuning = 5
      expect(getPerAttributeMax(15, 15)).toBe(5);
    });

    it('should return 0 when base exceeds academyCap + 5', () => {
      // Academy cap 15, base 21 → max tuning = 0
      expect(getPerAttributeMax(15, 21)).toBe(0);
    });

    it('should handle high academy caps correctly', () => {
      // Academy cap 50, base 50 → max tuning = 5
      expect(getPerAttributeMax(50, 50)).toBe(5);
      // Academy cap 50, base 40 → max tuning = 15
      expect(getPerAttributeMax(50, 40)).toBe(15);
    });
  });

  describe('maxHP recalculation with tuning bonuses', () => {
    it('should increase maxHP when tuning boosts hullIntegrity', () => {
      const robot = createMockRobot({
        loadoutType: 'single',
        hullIntegrity: new Prisma.Decimal(10),
      });
      const tuning: TuningAttributeMap = { hullIntegrity: 5 };

      const maxHP = calculateMaxHP(robot, tuning);

      // BASE_HP (50) + ((10 + 5) × 1.0) × HP_MULTIPLIER (5) = 50 + 75 = 125
      expect(maxHP).toBe(125);
    });

    it('should not change maxHP when tuning does not affect hullIntegrity', () => {
      const robot = createMockRobot({
        loadoutType: 'single',
        hullIntegrity: new Prisma.Decimal(10),
      });
      const tuning: TuningAttributeMap = { combatPower: 5 };

      const maxHP = calculateMaxHP(robot, tuning);

      // BASE_HP (50) + (10 × 1.0) × HP_MULTIPLIER (5) = 50 + 50 = 100
      expect(maxHP).toBe(100);
    });
  });

  describe('maxShield recalculation with tuning bonuses', () => {
    it('should increase maxShield when tuning boosts shieldCapacity', () => {
      const robot = createMockRobot({
        loadoutType: 'single',
        shieldCapacity: new Prisma.Decimal(10),
      });
      const tuning: TuningAttributeMap = { shieldCapacity: 3 };

      const maxShield = calculateMaxShield(robot, tuning);

      // (10 + 3) × 1.0 × 4 = 52
      expect(maxShield).toBe(52);
    });

    it('should apply loadout multiplier to tuning-boosted shield', () => {
      const robot = createMockRobot({
        loadoutType: 'weapon_shield',
        shieldCapacity: new Prisma.Decimal(10),
      });
      const tuning: TuningAttributeMap = { shieldCapacity: 5 };

      const maxShield = calculateMaxShield(robot, tuning);

      // (10 + 5) × 1.20 × 4 = 72
      expect(maxShield).toBe(72);
    });
  });

  describe('backward compatibility (no tuning parameter)', () => {
    it('should produce identical effective stats when tuning is undefined', () => {
      const robot = createMockRobot({ loadoutType: 'two_handed' });

      const statsWithoutTuning = calculateEffectiveStats(robot);
      const statsWithEmptyTuning = calculateEffectiveStats(robot, {});
      const statsWithUndefined = calculateEffectiveStats(robot, undefined);

      expect(statsWithoutTuning).toEqual(statsWithEmptyTuning);
      expect(statsWithoutTuning).toEqual(statsWithUndefined);
    });

    it('should produce identical maxHP when tuning is undefined', () => {
      const robot = createMockRobot({ hullIntegrity: new Prisma.Decimal(10) });

      const hpWithout = calculateMaxHP(robot);
      const hpWithEmpty = calculateMaxHP(robot, {});
      const hpWithUndefined = calculateMaxHP(robot, undefined);

      expect(hpWithout).toBe(hpWithEmpty);
      expect(hpWithout).toBe(hpWithUndefined);
    });

    it('should produce identical maxShield when tuning is undefined', () => {
      const robot = createMockRobot({ shieldCapacity: new Prisma.Decimal(10) });

      const shieldWithout = calculateMaxShield(robot);
      const shieldWithEmpty = calculateMaxShield(robot, {});
      const shieldWithUndefined = calculateMaxShield(robot, undefined);

      expect(shieldWithout).toBe(shieldWithEmpty);
      expect(shieldWithout).toBe(shieldWithUndefined);
    });
  });

  describe('fast-check property: effectiveStatWithTuning ≥ effectiveStatWithoutTuning', () => {
    const ALL_ATTRIBUTES = [
      'combatPower', 'targetingSystems', 'criticalSystems', 'penetration',
      'weaponControl', 'attackSpeed', 'armorPlating', 'shieldCapacity',
      'evasionThrusters', 'damageDampeners', 'counterProtocols', 'hullIntegrity',
      'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
      'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
      'syncProtocols', 'supportSystems', 'formationTactics',
    ] as const;

    const loadoutTypes = ['single', 'weapon_shield', 'two_handed', 'dual_wield'] as const;

    // Generator for a valid tuning bonuses map (all values ≥ 0)
    const tuningBonusesArb = fc.record(
      Object.fromEntries(
        ALL_ATTRIBUTES.map(attr => [attr, fc.double({ min: 0, max: 10, noNaN: true })])
      )
    ).map(record => {
      // Only include non-zero values (sparse map)
      const sparse: TuningAttributeMap = {};
      for (const [key, value] of Object.entries(record)) {
        if (value > 0) {
          sparse[key as keyof TuningAttributeMap] = Math.round(value * 100) / 100;
        }
      }
      return sparse;
    });

    it('effectiveStatWithTuning ≥ effectiveStatWithoutTuning for all attributes and loadouts', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...loadoutTypes),
          tuningBonusesArb,
          (loadoutType, tuning) => {
            const robot = createMockRobot({ loadoutType });

            const statsWithout = calculateEffectiveStats(robot);
            const statsWith = calculateEffectiveStats(robot, tuning);

            for (const attr of ALL_ATTRIBUTES) {
              // For attributes with negative loadout multipliers (e.g., dual_wield combatPower -10%),
              // adding tuning still increases the effective stat because tuning is non-negative
              // and the loadout multiplier is applied to (base + weapon + tuning).
              // The effective stat with tuning should always be ≥ without tuning.
              const loadoutBonuses = LOADOUT_BONUSES[loadoutType as keyof typeof LOADOUT_BONUSES] || {};
              const loadoutMult = 1 + ((loadoutBonuses as Record<string, number>)[attr] ?? 0);

              if (loadoutMult >= 0) {
                // Normal case: positive multiplier means tuning always helps
                expect(statsWith[attr]).toBeGreaterThanOrEqual(statsWithout[attr]);
              }
              // Note: if loadoutMult were negative (doesn't happen in current game),
              // adding tuning could decrease the stat. We skip that edge case.
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
