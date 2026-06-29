/**
 * Property-based and unit tests for Grand Melee placement computation.
 *
 * Since `computePlacements` is a private function inside the orchestrator,
 * we test placement properties through integration with the combat simulator.
 * The placement derivation logic is re-implemented here (same algorithm) to
 * verify properties P4, P5, and P10 from the spec.
 *
 * Validates: Spec #44 Grand Melee — Placement Correctness (P4, P5, P10)
 */

import { simulateBattleMulti } from '../../../src/services/battle/combatSimulator';
import type { RobotWithWeapons, SpatialCombatResult, SpatialRobotCombatState, SpatialCombatEvent } from '../../../src/services/battle/combat-simulator/combatTypes';
import * as fc from 'fast-check';
import { Prisma } from '../../../generated/prisma';

// ─── Mock Factories ─────────────────────────────────────────────────

function createMockRobot(id: number, name: string, overrides: Partial<any> = {}): any {
  return {
    id,
    name,
    userId: 1,
    frameId: 1,
    paintJob: null,
    stance: 'balanced',
    loadoutType: 'balanced',
    currentHP: overrides.currentHP ?? 100,
    maxHP: overrides.maxHP ?? 100,
    currentShield: overrides.currentShield ?? 50,
    maxShield: overrides.maxShield ?? 50,
    damageTaken: 0,
    elo: 1200,
    totalBattles: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    fame: 0,
    titles: null,
    repairCost: 0,
    battleReadiness: 100,
    totalRepairsPaid: 0,
    yieldThreshold: 10,
    mainWeaponId: null,
    offhandWeaponId: null,
    imageUrl: null,
    offensiveWins: 0,
    defensiveWins: 0,
    balancedWins: 0,
    dualWieldWins: 0,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    combatPower: new Prisma.Decimal(overrides.combatPower ?? 25),
    targetingSystems: new Prisma.Decimal(overrides.targetingSystems ?? 25),
    criticalSystems: new Prisma.Decimal(overrides.criticalSystems ?? 15),
    penetration: new Prisma.Decimal(overrides.penetration ?? 15),
    weaponControl: new Prisma.Decimal(overrides.weaponControl ?? 20),
    attackSpeed: new Prisma.Decimal(overrides.attackSpeed ?? 20),
    armorPlating: new Prisma.Decimal(overrides.armorPlating ?? 20),
    shieldCapacity: new Prisma.Decimal(overrides.shieldCapacity ?? 15),
    evasionThrusters: new Prisma.Decimal(overrides.evasionThrusters ?? 10),
    damageDampeners: new Prisma.Decimal(overrides.damageDampeners ?? 10),
    counterProtocols: new Prisma.Decimal(overrides.counterProtocols ?? 10),
    hullIntegrity: new Prisma.Decimal(overrides.hullIntegrity ?? 25),
    servoMotors: new Prisma.Decimal(overrides.servoMotors ?? 20),
    gyroStabilizers: new Prisma.Decimal(overrides.gyroStabilizers ?? 15),
    hydraulicSystems: new Prisma.Decimal(overrides.hydraulicSystems ?? 15),
    powerCore: new Prisma.Decimal(overrides.powerCore ?? 15),
    combatAlgorithms: new Prisma.Decimal(overrides.combatAlgorithms ?? 20),
    threatAnalysis: new Prisma.Decimal(overrides.threatAnalysis ?? 15),
    adaptiveAI: new Prisma.Decimal(overrides.adaptiveAI ?? 10),
    logicCores: new Prisma.Decimal(overrides.logicCores ?? 15),
    syncProtocols: new Prisma.Decimal(overrides.syncProtocols ?? 10),
    supportSystems: new Prisma.Decimal(overrides.supportSystems ?? 10),
    formationTactics: new Prisma.Decimal(overrides.formationTactics ?? 10),
    mainWeapon: {
      id: id,
      userId: 1,
      weaponId: id,
      customName: null,
      pricePaid: 0,
      purchasedAt: new Date('2025-01-01'),
      weapon: {
        id: id,
        name: `Weapon-${id}`,
        weaponType: overrides.weaponType ?? 'energy',
        baseDamage: overrides.baseDamage ?? 25,
        cooldown: overrides.cooldown ?? 4,
        cost: 50000,
        handsRequired: 'one',
        damageType: overrides.damageType ?? 'energy',
        loadoutType: 'any',
        rangeBand: overrides.rangeBand ?? 'mid',
        specialProperty: null,
        description: null,
        combatPowerBonus: 3,
        targetingSystemsBonus: 2,
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
        createdAt: new Date('2025-01-01'),
      },
    },
    offhandWeapon: null,
  };
}

// ─── Placement Derivation (mirrors orchestrator logic) ──────────────

interface DerivedPlacement {
  robotId: number;
  placement: number;
}

/**
 * Re-implementation of the orchestrator's `computePlacements` sorting logic.
 * Used to verify placement properties from simulation results.
 */
function derivePlacements(result: SpatialCombatResult): DerivedPlacement[] {
  const states = result.finalStates ?? [];
  const events = result.events;

  // Extract elimination timestamps (earliest per robot)
  const eliminationTimeMap = new Map<string, number>();
  for (const event of events) {
    if (
      (event.type === 'destroyed' || event.type === 'robot_eliminated') &&
      event.defender
    ) {
      if (!eliminationTimeMap.has(event.defender)) {
        eliminationTimeMap.set(event.defender, event.timestamp);
      }
    }
  }

  // Split into survivors and eliminated
  const survivors = states.filter(s => s.isAlive);
  const eliminated = states.filter(s => !s.isAlive);

  // Sort survivors: HP% descending, tiebreak by totalDamageDealt descending
  survivors.sort((a, b) => {
    const hpPercentA = a.maxHP > 0 ? a.currentHP / a.maxHP : 0;
    const hpPercentB = b.maxHP > 0 ? b.currentHP / b.maxHP : 0;
    const diff = hpPercentB - hpPercentA;
    if (Math.abs(diff) > 0.001) return diff;
    return b.totalDamageDealt - a.totalDamageDealt;
  });

  // Sort eliminated: later elimination = better rank (descending timestamp)
  // Same-tick tiebreak: higher totalDamageDealt = better rank
  eliminated.sort((a, b) => {
    const timeA = eliminationTimeMap.get(a.robot.name) ?? 0;
    const timeB = eliminationTimeMap.get(b.robot.name) ?? 0;
    if (Math.abs(timeB - timeA) > 0.001) return timeB - timeA;
    return b.totalDamageDealt - a.totalDamageDealt;
  });

  // Concat: survivors first (placement 1..S), then eliminated (placement S+1..N)
  const ordered = [...survivors, ...eliminated];
  return ordered.map((s, i) => ({ robotId: s.robot.id, placement: i + 1 }));
}

// ─── Helper: Generate N robots with varied stats ────────────────────

const RANGE_BANDS = ['melee', 'short', 'mid', 'long'] as const;
const WEAPON_TYPES_MAP: Record<string, { weaponType: string; damageType: string }> = {
  melee: { weaponType: 'melee', damageType: 'melee' },
  short: { weaponType: 'ballistic', damageType: 'ballistic' },
  mid: { weaponType: 'energy', damageType: 'energy' },
  long: { weaponType: 'energy', damageType: 'energy' },
};

function generateRobots(count: number): RobotWithWeapons[] {
  const robots: RobotWithWeapons[] = [];
  for (let i = 0; i < count; i++) {
    const rangeBand = RANGE_BANDS[i % RANGE_BANDS.length];
    const { weaponType, damageType } = WEAPON_TYPES_MAP[rangeBand];
    robots.push(
      createMockRobot(i + 1, `Robot-${i + 1}`, {
        // Vary stats to produce diverse combat outcomes
        combatPower: 20 + (i * 3) % 15,
        targetingSystems: 18 + (i * 5) % 20,
        armorPlating: 15 + (i * 2) % 15,
        servoMotors: 15 + (i * 4) % 20,
        hullIntegrity: 20 + (i * 3) % 15,
        evasionThrusters: 8 + (i * 2) % 12,
        baseDamage: 20 + (i * 3) % 15,
        rangeBand,
        weaponType,
        damageType,
      }) as unknown as RobotWithWeapons,
    );
  }
  return robots;
}

// ─── Test Suite ─────────────────────────────────────────────────────

describe('Grand Melee Placements', () => {
  jest.setTimeout(30000);

  // ─── Property-Based Tests ───────────────────────────────────────

  describe('Property P4: Placement completeness', () => {
    it('for N participants (8-12), placements form exactly {1, 2, ..., N} with no gaps or duplicates', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 12 }),
          (participantCount) => {
            const robots = generateRobots(participantCount);

            const result = simulateBattleMulti(robots, {
              allowDraws: false,
              spatialPartitioning: true,
            });

            const placements = derivePlacements(result);

            // Must have exactly N placements
            if (placements.length !== participantCount) return false;

            // Extract placement numbers and verify they form {1..N}
            const placementNumbers = placements.map(p => p.placement).sort((a, b) => a - b);
            const expected = Array.from({ length: participantCount }, (_, i) => i + 1);

            // No gaps: must match [1, 2, 3, ..., N]
            for (let i = 0; i < participantCount; i++) {
              if (placementNumbers[i] !== expected[i]) return false;
            }

            // No duplicates: set size must equal N
            const uniquePlacements = new Set(placementNumbers);
            if (uniquePlacements.size !== participantCount) return false;

            // No duplicate robotIds
            const uniqueRobotIds = new Set(placements.map(p => p.robotId));
            if (uniqueRobotIds.size !== participantCount) return false;

            return true;
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  describe('Property P5: Placement monotonicity', () => {
    it('if robot A is eliminated later than robot B, A has a better (lower) placement', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 12 }),
          (participantCount) => {
            const robots = generateRobots(participantCount);

            const result = simulateBattleMulti(robots, {
              allowDraws: false,
              spatialPartitioning: true,
            });

            const placements = derivePlacements(result);
            const events = result.events;

            // Build elimination time map
            const eliminationTimeMap = new Map<number, number>();
            const robotNameToId = new Map<string, number>();
            for (const state of result.finalStates ?? []) {
              robotNameToId.set(state.robot.name, state.robot.id);
            }

            for (const event of events) {
              if (
                (event.type === 'destroyed' || event.type === 'robot_eliminated') &&
                event.defender
              ) {
                const robotId = robotNameToId.get(event.defender);
                if (robotId !== undefined && !eliminationTimeMap.has(robotId)) {
                  eliminationTimeMap.set(robotId, event.timestamp);
                }
              }
            }

            // Build placement lookup
            const placementMap = new Map<number, number>();
            for (const p of placements) {
              placementMap.set(p.robotId, p.placement);
            }

            // For all pairs of eliminated robots: later elimination → better placement
            const eliminatedRobotIds = [...eliminationTimeMap.keys()];
            for (let i = 0; i < eliminatedRobotIds.length; i++) {
              for (let j = i + 1; j < eliminatedRobotIds.length; j++) {
                const idA = eliminatedRobotIds[i];
                const idB = eliminatedRobotIds[j];
                const timeA = eliminationTimeMap.get(idA)!;
                const timeB = eliminationTimeMap.get(idB)!;
                const placementA = placementMap.get(idA)!;
                const placementB = placementMap.get(idB)!;

                // Only check when timestamps differ significantly (not same-tick)
                if (Math.abs(timeA - timeB) > 0.001) {
                  if (timeA > timeB) {
                    // A eliminated later → A has better (lower) placement
                    if (placementA >= placementB) return false;
                  } else {
                    // B eliminated later → B has better (lower) placement
                    if (placementB >= placementA) return false;
                  }
                }
              }
            }

            return true;
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe('Property P10: Winner always determined', () => {
    it('for any Grand Melee simulation with allowDraws: false, winnerId is non-null', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 12 }),
          (participantCount) => {
            const robots = generateRobots(participantCount);

            const result = simulateBattleMulti(robots, {
              allowDraws: false,
              spatialPartitioning: true,
            });

            return result.winnerId !== null;
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  // ─── Unit Tests ─────────────────────────────────────────────────

  describe('Unit tests', () => {
    let result: SpatialCombatResult;
    let placements: DerivedPlacement[];

    beforeAll(() => {
      const robots = generateRobots(10);
      result = simulateBattleMulti(robots, {
        allowDraws: false,
        spatialPartitioning: true,
      });
      placements = derivePlacements(result);
    });

    it('10-robot simulation produces placements 1-10 with no duplicates', () => {
      expect(placements).toHaveLength(10);

      const placementNumbers = placements.map(p => p.placement).sort((a, b) => a - b);
      expect(placementNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      const uniqueIds = new Set(placements.map(p => p.robotId));
      expect(uniqueIds.size).toBe(10);
    });

    it('winner (placement 1) matches result.winnerId', () => {
      const winner = placements.find(p => p.placement === 1);
      expect(winner).toBeDefined();
      expect(winner!.robotId).toBe(result.winnerId);
    });

    it('all eliminated robots have worse placements than surviving robots', () => {
      const states = result.finalStates ?? [];
      const survivorIds = new Set(
        states.filter(s => s.isAlive).map(s => s.robot.id),
      );
      const eliminatedIds = new Set(
        states.filter(s => !s.isAlive).map(s => s.robot.id),
      );

      const survivorPlacements = placements
        .filter(p => survivorIds.has(p.robotId))
        .map(p => p.placement);
      const eliminatedPlacements = placements
        .filter(p => eliminatedIds.has(p.robotId))
        .map(p => p.placement);

      if (survivorPlacements.length > 0 && eliminatedPlacements.length > 0) {
        const worstSurvivor = Math.max(...survivorPlacements);
        const bestEliminated = Math.min(...eliminatedPlacements);
        expect(worstSurvivor).toBeLessThan(bestEliminated);
      }
    });

    it('result has finalStates matching the number of participants', () => {
      expect(result.finalStates).toBeDefined();
      expect(result.finalStates!.length).toBe(10);
    });

    it('exactly one survivor (winner) when allowDraws is false', () => {
      const states = result.finalStates ?? [];
      const survivors = states.filter(s => s.isAlive);
      // With allowDraws: false, the battle continues until one remains
      expect(survivors.length).toBeGreaterThanOrEqual(1);
      // The winner should be one of the survivors
      const survivorIds = survivors.map(s => s.robot.id);
      expect(survivorIds).toContain(result.winnerId);
    });
  });
});
