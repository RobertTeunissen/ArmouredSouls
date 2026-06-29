/**
 * Unit and property-based tests for SpatialGrid, computeMaxWeaponRange,
 * and spatial/variable-tick-rate optimizations in the combat simulator.
 *
 * Validates: Spec #44 Grand Melee — Algorithmic Optimizations (R1.1–R1.7)
 */

import { SpatialGrid, computeMaxWeaponRange } from '../../../src/services/battle/combat-simulator/spatialGrid';
import { simulateBattleMulti } from '../../../src/services/battle/combatSimulator';
import * as fc from 'fast-check';
import { Prisma } from '../../../generated/prisma';
import type { RobotWithWeapons } from '../../../src/services/battle/combat-simulator/combatTypes';

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
    currentHP: 100,
    maxHP: 100,
    currentShield: 50,
    maxShield: 50,
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
    combatPower: new Prisma.Decimal(25),
    targetingSystems: new Prisma.Decimal(25),
    criticalSystems: new Prisma.Decimal(15),
    penetration: new Prisma.Decimal(15),
    weaponControl: new Prisma.Decimal(20),
    attackSpeed: new Prisma.Decimal(20),
    armorPlating: new Prisma.Decimal(20),
    shieldCapacity: new Prisma.Decimal(15),
    evasionThrusters: new Prisma.Decimal(10),
    damageDampeners: new Prisma.Decimal(10),
    counterProtocols: new Prisma.Decimal(10),
    hullIntegrity: new Prisma.Decimal(25),
    servoMotors: new Prisma.Decimal(20),
    gyroStabilizers: new Prisma.Decimal(15),
    hydraulicSystems: new Prisma.Decimal(15),
    powerCore: new Prisma.Decimal(15),
    combatAlgorithms: new Prisma.Decimal(20),
    threatAnalysis: new Prisma.Decimal(15),
    adaptiveAI: new Prisma.Decimal(10),
    logicCores: new Prisma.Decimal(15),
    syncProtocols: new Prisma.Decimal(10),
    supportSystems: new Prisma.Decimal(10),
    formationTactics: new Prisma.Decimal(10),
    mainWeapon: {
      id: 1,
      userId: 1,
      weaponId: 1,
      customName: null,
      pricePaid: 0,
      purchasedAt: new Date('2025-01-01'),
      weapon: {
        id: 1,
        name: 'Laser Rifle',
        weaponType: 'energy',
        baseDamage: 25,
        cooldown: 4,
        cost: 50000,
        handsRequired: 'one',
        damageType: 'energy',
        loadoutType: 'any',
        rangeBand: 'mid',
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
        ...overrides.weaponOverrides,
      },
    },
    offhandWeapon: null,
    ...overrides,
  };
}

// ─── Unit Tests: SpatialGrid ────────────────────────────────────────

describe('SpatialGrid', () => {
  describe('constructor', () => {
    it('should produce cellSize = maxWeaponRange + 10 for typical ranges', () => {
      const grid2 = new SpatialGrid(2);
      expect((grid2 as any).cellSize).toBe(12); // 2 + 10

      const grid12 = new SpatialGrid(12);
      expect((grid12 as any).cellSize).toBe(22); // 12 + 10

      const grid15 = new SpatialGrid(15);
      expect((grid15 as any).cellSize).toBe(25); // 15 + 10
    });

    it('should enforce minimum cellSize of 1', () => {
      const grid = new SpatialGrid(0);
      expect((grid as any).cellSize).toBe(10); // max(0 + 10, 1) = 10

      const gridNeg = new SpatialGrid(-20);
      expect((gridNeg as any).cellSize).toBe(1); // max(-20 + 10, 1) = 1
    });
  });

  describe('update()', () => {
    it('should index alive robots and skip dead ones', () => {
      const grid = new SpatialGrid(10); // cellSize = 20
      const entities = [
        { position: { x: 5, y: 5 }, isAlive: true },
        { position: { x: 6, y: 6 }, isAlive: false },
        { position: { x: 7, y: 7 }, isAlive: true },
      ];

      grid.update(entities);

      // Robot 0 and 2 are alive and in same cell (positions 5,5 and 7,7 with cellSize 20 → cell 0,0)
      const nearby0 = grid.getNearby(0);
      expect(nearby0).toContain(2);
      expect(nearby0).not.toContain(1); // dead robot

      // Dead robot returns empty
      const nearby1 = grid.getNearby(1);
      expect(nearby1).toEqual([]);
    });
  });

  describe('getNearby()', () => {
    it('should return robots in same cell', () => {
      const grid = new SpatialGrid(10); // cellSize = 20
      const entities = [
        { position: { x: 1, y: 1 }, isAlive: true },
        { position: { x: 2, y: 2 }, isAlive: true },
        { position: { x: 3, y: 3 }, isAlive: true },
      ];

      grid.update(entities);

      // All in cell (0,0) — each should see the other two
      expect(grid.getNearby(0).sort()).toEqual([1, 2]);
      expect(grid.getNearby(1).sort()).toEqual([0, 2]);
      expect(grid.getNearby(2).sort()).toEqual([0, 1]);
    });

    it('should return robots in adjacent cells (8-neighbourhood)', () => {
      const grid = new SpatialGrid(10); // cellSize = 20
      // Place robots in adjacent cells
      const entities = [
        { position: { x: 5, y: 5 }, isAlive: true },    // cell (0, 0)
        { position: { x: 25, y: 5 }, isAlive: true },   // cell (1, 0) — adjacent
        { position: { x: 25, y: 25 }, isAlive: true },  // cell (1, 1) — diagonal adjacent
        { position: { x: 50, y: 50 }, isAlive: true },  // cell (2, 2) — NOT adjacent to (0,0)
      ];

      grid.update(entities);

      const nearby0 = grid.getNearby(0);
      expect(nearby0).toContain(1); // adjacent
      expect(nearby0).toContain(2); // diagonal adjacent
      expect(nearby0).not.toContain(3); // too far
    });

    it('should NOT return the queried robot itself', () => {
      const grid = new SpatialGrid(10); // cellSize = 20
      const entities = [
        { position: { x: 5, y: 5 }, isAlive: true },
        { position: { x: 6, y: 6 }, isAlive: true },
      ];

      grid.update(entities);

      expect(grid.getNearby(0)).not.toContain(0);
      expect(grid.getNearby(1)).not.toContain(1);
    });

    it('should return empty array for dead robots', () => {
      const grid = new SpatialGrid(10);
      const entities = [
        { position: { x: 5, y: 5 }, isAlive: false },
        { position: { x: 6, y: 6 }, isAlive: true },
      ];

      grid.update(entities);

      expect(grid.getNearby(0)).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle robot exactly on cell boundary', () => {
      const grid = new SpatialGrid(10); // cellSize = 20
      // Position exactly at boundary (20, 20) → cell (1, 1) via Math.floor(20/20)=1
      const entities = [
        { position: { x: 20, y: 20 }, isAlive: true },  // cell (1, 1)
        { position: { x: 19.9, y: 19.9 }, isAlive: true }, // cell (0, 0)
        { position: { x: 20.1, y: 20.1 }, isAlive: true }, // cell (1, 1)
      ];

      grid.update(entities);

      // Robot 0 (cell 1,1) should see robot 1 (cell 0,0 — adjacent) and robot 2 (cell 1,1 — same)
      const nearby0 = grid.getNearby(0);
      expect(nearby0).toContain(1);
      expect(nearby0).toContain(2);
    });

    it('should handle all robots in single cell (small arena)', () => {
      const grid = new SpatialGrid(100); // cellSize = 110
      // All positions fit within a single cell
      const entities = [
        { position: { x: 0, y: 0 }, isAlive: true },
        { position: { x: 10, y: 10 }, isAlive: true },
        { position: { x: 50, y: 50 }, isAlive: true },
        { position: { x: 100, y: 100 }, isAlive: true },
      ];

      grid.update(entities);

      // All should see each other
      expect(grid.getNearby(0).sort()).toEqual([1, 2, 3]);
      expect(grid.getNearby(1).sort()).toEqual([0, 2, 3]);
      expect(grid.getNearby(2).sort()).toEqual([0, 1, 3]);
      expect(grid.getNearby(3).sort()).toEqual([0, 1, 2]);
    });

    it('should handle robots at negative positions', () => {
      const grid = new SpatialGrid(10); // cellSize = 20
      const entities = [
        { position: { x: -5, y: -5 }, isAlive: true },    // cell (-1, -1)
        { position: { x: -15, y: -15 }, isAlive: true },  // cell (-1, -1)
        { position: { x: -45, y: -45 }, isAlive: true },  // cell (-3, -3) — far away
      ];

      grid.update(entities);

      const nearby0 = grid.getNearby(0);
      expect(nearby0).toContain(1); // same cell
      expect(nearby0).not.toContain(2); // too far
    });
  });
});

// ─── Unit Tests: computeMaxWeaponRange ──────────────────────────────

describe('computeMaxWeaponRange', () => {
  it('should return correct range for melee-only robots', () => {
    const robots = [
      { mainWeapon: { weapon: { rangeBand: 'melee' } }, offhandWeapon: null },
      { mainWeapon: { weapon: { rangeBand: 'melee' } }, offhandWeapon: null },
    ];

    expect(computeMaxWeaponRange(robots)).toBe(2);
  });

  it('should return correct range for mixed weapons (picks highest)', () => {
    const robots = [
      { mainWeapon: { weapon: { rangeBand: 'melee' } }, offhandWeapon: null },
      { mainWeapon: { weapon: { rangeBand: 'short' } }, offhandWeapon: { weapon: { rangeBand: 'mid' } } },
      { mainWeapon: { weapon: { rangeBand: 'long' } }, offhandWeapon: null },
    ];

    expect(computeMaxWeaponRange(robots)).toBe(15); // long = 15
  });

  it('should return mid range correctly', () => {
    const robots = [
      { mainWeapon: { weapon: { rangeBand: 'short' } }, offhandWeapon: null },
      { mainWeapon: { weapon: { rangeBand: 'mid' } }, offhandWeapon: null },
    ];

    expect(computeMaxWeaponRange(robots)).toBe(12); // mid = 12
  });

  it('should return 15 fallback when no weapons equipped', () => {
    const robots = [
      { mainWeapon: null, offhandWeapon: null },
      { mainWeapon: null, offhandWeapon: null },
    ];

    expect(computeMaxWeaponRange(robots)).toBe(15);
  });

  it('should consider offhand weapon range', () => {
    const robots = [
      { mainWeapon: { weapon: { rangeBand: 'melee' } }, offhandWeapon: { weapon: { rangeBand: 'long' } } },
    ];

    expect(computeMaxWeaponRange(robots)).toBe(15); // offhand long = 15
  });
});

// ─── Property-Based Tests ───────────────────────────────────────────

describe('Property-based tests', () => {
  describe('P1: Spatial grid safety — nearby robots always included', () => {
    it('for any two robots where distance ≤ cellSize, they appear in each other\'s getNearby result', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -100, max: 100, noNaN: true }),
          fc.float({ min: -100, max: 100, noNaN: true }),
          fc.float({ min: -100, max: 100, noNaN: true }),
          fc.float({ min: -100, max: 100, noNaN: true }),
          fc.integer({ min: 2, max: 20 }),
          (x1, y1, x2, y2, maxRange) => {
            const cellSize = maxRange + 10;
            const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

            // Only test when distance is within cellSize (the invariant we're checking)
            if (distance > cellSize) return true; // skip — not in the property domain

            const grid = new SpatialGrid(maxRange);
            const entities = [
              { position: { x: x1, y: y1 }, isAlive: true },
              { position: { x: x2, y: y2 }, isAlive: true },
            ];

            grid.update(entities);

            // Property: if distance ≤ cellSize, robot 1 appears in robot 0's getNearby
            const nearby0 = grid.getNearby(0);
            const nearby1 = grid.getNearby(1);

            return nearby0.includes(1) && nearby1.includes(0);
          },
        ),
        { numRuns: 500 },
      );
    });
  });

  describe('P3: Outcome neutrality — spatial partitioning produces same results', () => {
    it('seeded 6-robot battle produces same winnerId and totalDamageDealt with/without spatial partitioning', () => {
      // Create 6 distinct robots with weapons
      const robots = [
        createMockRobot(1, 'Alpha', { weaponOverrides: { rangeBand: 'mid' } }),
        createMockRobot(2, 'Bravo', { weaponOverrides: { rangeBand: 'short' } }),
        createMockRobot(3, 'Charlie', { weaponOverrides: { rangeBand: 'long' } }),
        createMockRobot(4, 'Delta', { weaponOverrides: { rangeBand: 'melee', weaponType: 'melee', damageType: 'melee' } }),
        createMockRobot(5, 'Echo', { weaponOverrides: { rangeBand: 'mid' } }),
        createMockRobot(6, 'Foxtrot', { weaponOverrides: { rangeBand: 'short' } }),
      ] as unknown as RobotWithWeapons[];

      // Run with spatial partitioning enabled (default for N>2)
      // Since Math.random is non-deterministic, we need to seed it.
      // We run multiple trials and verify the spatial grid never changes the outcome
      // compared to non-spatial when using the same random sequence.
      //
      // Strategy: mock Math.random with a deterministic sequence for both runs
      const seed = 42;
      const callCount = 0;

      // Simple seeded PRNG (mulberry32)
      function mulberry32(a: number): () => number {
        return function () {
          a |= 0; a = a + 0x6D2B79F5 | 0;
          let t = Math.imul(a ^ a >>> 15, 1 | a);
          t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
      }

      // Run with spatial partitioning ON
      const prng1 = mulberry32(seed);
      const originalRandom = Math.random;
      Math.random = prng1;
      const resultWith = simulateBattleMulti(robots, {
        allowDraws: true,
        spatialPartitioning: true,
      });
      Math.random = originalRandom;

      // Run with spatial partitioning OFF
      const prng2 = mulberry32(seed);
      Math.random = prng2;
      const resultWithout = simulateBattleMulti(robots, {
        allowDraws: true,
        spatialPartitioning: false,
      });
      Math.random = originalRandom;

      // Verify same winner
      expect(resultWith.winnerId).toBe(resultWithout.winnerId);

      // Verify same per-robot totalDamageDealt via finalStates
      if (resultWith.finalStates && resultWithout.finalStates) {
        for (let i = 0; i < resultWith.finalStates.length; i++) {
          expect(resultWith.finalStates[i].totalDamageDealt).toBe(
            resultWithout.finalStates[i].totalDamageDealt,
          );
        }
      }

      // Also verify robot1/robot2 damage dealt fields match
      expect(resultWith.robot1DamageDealt).toBe(resultWithout.robot1DamageDealt);
      expect(resultWith.robot2DamageDealt).toBe(resultWithout.robot2DamageDealt);
    });
  });

  describe('P2: Movement continuity — no teleportation', () => {
    it('10-robot simulation never has position jump exceeding effectiveMovementSpeed × tick', () => {
      // Create 10 robots with varying speeds
      const robots: RobotWithWeapons[] = [];
      for (let i = 0; i < 10; i++) {
        robots.push(createMockRobot(i + 1, `Robot-${i + 1}`, {
          servoMotors: new Prisma.Decimal(10 + i * 3),
          weaponOverrides: {
            rangeBand: ['melee', 'short', 'mid', 'long'][i % 4],
            weaponType: i % 4 === 0 ? 'melee' : 'energy',
            damageType: i % 4 === 0 ? 'melee' : 'energy',
          },
        }) as unknown as RobotWithWeapons);
      }

      const result = simulateBattleMulti(robots, {
        allowDraws: true,
        spatialPartitioning: true,
        variableTickRate: true,
      });

      // Extract movement events and positions from all events
      const TICK = 0.1;
      // Maximum theoretical speed: servoMotors caps at ~40 in our test data
      // effectiveMovementSpeed is derived from servoMotors with modifiers
      // Conservative upper bound: base speed × closing bonus × stance modifier
      // Base speed ≈ servoMotors * 0.2 ≈ 8, with closing bonus 1.5x → 12
      // Add a generous safety margin for any combat-related speed boosts
      const MAX_SPEED_BOUND = 20; // generous upper bound for any robot's speed per tick
      const MAX_DISPLACEMENT_PER_TICK = MAX_SPEED_BOUND * TICK;

      // Track positions per robot across events that have position data
      const robotPositionHistory: Map<string, Array<{ timestamp: number; x: number; y: number }>> = new Map();

      for (const event of result.events) {
        if (!event.positions) continue;
        for (const [name, pos] of Object.entries(event.positions)) {
          if (!robotPositionHistory.has(name)) {
            robotPositionHistory.set(name, []);
          }
          const history = robotPositionHistory.get(name)!;
          // Only add if timestamp is newer (events are chronological)
          if (history.length === 0 || event.timestamp > history[history.length - 1].timestamp) {
            history.push({ timestamp: event.timestamp, x: pos.x, y: pos.y });
          }
        }
      }

      // Verify no teleportation: distance between consecutive positions
      // should not exceed speed × time_delta
      for (const [name, history] of robotPositionHistory) {
        for (let i = 1; i < history.length; i++) {
          const prev = history[i - 1];
          const curr = history[i];
          const dt = curr.timestamp - prev.timestamp;
          if (dt <= 0) continue; // same timestamp, skip

          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          const displacement = Math.sqrt(dx * dx + dy * dy);

          // Allow displacement proportional to time elapsed (multiple ticks may have passed)
          // Plus a small epsilon for floating point
          const maxAllowed = MAX_SPEED_BOUND * dt + 0.01;

          expect(displacement).toBeLessThanOrEqual(maxAllowed);
        }
      }

      // Sanity check: we actually tracked some positions
      expect(robotPositionHistory.size).toBeGreaterThan(0);
    });
  });
});
