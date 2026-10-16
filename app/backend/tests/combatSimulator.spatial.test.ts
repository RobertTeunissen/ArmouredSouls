/**
 * Unit tests for the refactored simulateBattle with 2D spatial mechanics.
 * Validates: Requirements 14.1, 14.2, 14.3, 14.6, 14.7, 14.8, 14.9
 */
import { simulateBattle, simulateBattleMulti, RobotWithWeapons, CombatResult, CombatEvent, Position } from '../src/services/battle/combatSimulator';
import type { GameModeConfig, MovementIntent, RobotCombatState } from '../src/services/arena/types';
import type { SpeedBurst } from '../src/services/arena/engagementCycle';
import { prepareRobotForCombat } from '../src/utils/robotCalculations';
import { ROBOT_ATTRIBUTES } from '../src/shared/utils/robotAttributes';
import { buildKothGameModeConfig, buildKothInitialState } from '../src/services/arena/koth/kothGameMode';
import { simulateTeamBattle } from '../src/services/team-battle/teamBattleEngine';
import { simulateTagTeamBattle } from '../src/services/tag-team/tagTeamSimulation';
import type { TagTeamWithRobots } from '../src/services/tag-team/tagTeamTypes';
import { Prisma } from '../generated/prisma';
import * as arenaLayout from '../src/services/arena/arenaLayout';

// ─── Mock Factories ─────────────────────────────────────────────────

function createMockRobot(overrides?: Partial<RobotWithWeapons>): RobotWithWeapons {
  // Test fixture cast: the Robot model has accumulated many counter fields over time
  // (per-loadout wins, per-stance wins, KotH stats, streak counters). The cast through
  // `unknown` avoids enumerating every default-zero counter here — combat tests only
  // exercise the 23 attribute fields, weapon includes, and HP/shield state.
  return {
    id: 1,
    userId: 1,
    name: 'TestBot-1',
    frameId: 1,
    paintJob: null,
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
    currentHP: 175,
    maxHP: 175,
    currentShield: 30,
    maxShield: 30,
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
    repairQuoteCredits: 0,
    battleReadiness: 100,
    lifetimeRepairCreditsPaid: 0,
    yieldThreshold: 10,
    loadoutType: 'single',
    stance: 'balanced',
    // Armed by default: the simulator rejects robots without a main weapon.
    mainWeaponId: 2,
    offhandWeaponId: null,
    imageUrl: null,
    offensiveWins: 0,
    defensiveWins: 0,
    balancedWins: 0,
    dualWieldWins: 0,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    mainWeapon: createRangedWeaponInventory(2),
    offhandWeapon: null,
    ...overrides,
  } as unknown as RobotWithWeapons;
}

function createMeleeWeaponInventory(weaponId: number = 1) {
  return {
    id: weaponId,
    userId: 1,
    weaponId,
    customName: null,
    pricePaid: 0,
    purchasedAt: new Date('2025-01-01'),
    weapon: {
      id: weaponId,
      name: 'Energy Blade',
      weaponType: 'melee',
      baseDamage: 30,
      cooldown: 2,
      cost: 50000,
      handsRequired: 'one',
      damageType: 'melee',
      loadoutType: 'any',
      rangeBand: 'melee',
      specialProperty: null,
      description: null,
      combatPowerBonus: 3,
      targetingSystemsBonus: 0,
      criticalSystemsBonus: 2,
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
  };
}

function createRangedWeaponInventory(weaponId: number = 2) {
  return {
    id: weaponId,
    userId: 1,
    weaponId,
    customName: null,
    pricePaid: 0,
    purchasedAt: new Date('2025-01-01'),
    weapon: {
      id: weaponId,
      name: 'Laser Pistol',
      weaponType: 'energy',
      baseDamage: 20,
      cooldown: 3,
      cost: 40000,
      handsRequired: 'one',
      damageType: 'energy',
      loadoutType: 'any',
      rangeBand: 'short',
      specialProperty: null,
      description: null,
      combatPowerBonus: 2,
      targetingSystemsBonus: 3,
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
  };
}

// ─── Helper ─────────────────────────────────────────────────────────

function getEventsByType(events: CombatEvent[], type: string): CombatEvent[] {
  return events.filter(e => e.type === type);
}

// ─── Simulator entry points (shared by #517 and #518 suites) ────────

type EntryPoint = {
  name: string;
  count: number;
  run: (robots: RobotWithWeapons[]) => Promise<unknown>;
};

const entryPoints: EntryPoint[] = [
  { name: 'simulateBattle (league 1v1 / practice)', count: 2, run: async (r) => simulateBattle(r[0], r[1]) },
  { name: 'simulateBattle tournament (solo tournament)', count: 2, run: async (r) => simulateBattle(r[0], r[1], true) },
  {
    name: 'simulateBattleMulti (Grand Melee shape)',
    count: 6,
    run: async (r) => simulateBattleMulti(r, { allowDraws: false, arenaRadius: 16 + (r.length - 2) * 3, maxDuration: 20 }),
  },
  {
    name: 'simulateBattleMulti (KotH game mode)',
    count: 5,
    run: async (r) => {
      const kothConfig = { scoreThreshold: 15, timeLimit: 60, zoneRadius: 5, participantCount: r.length, matchId: 1 };
      return simulateBattleMulti(r, {
        allowDraws: false,
        maxDuration: 60,
        gameModeConfig: buildKothGameModeConfig(kothConfig),
        gameModeState: buildKothInitialState(kothConfig, r.map((robot) => robot.id)),
      });
    },
  },
  { name: 'simulateTeamBattle 2v2', count: 4, run: async (r) => simulateTeamBattle(r.slice(0, 2), r.slice(2), 2) },
  { name: 'simulateTeamBattle 3v3', count: 6, run: async (r) => simulateTeamBattle(r.slice(0, 3), r.slice(3), 3) },
  {
    name: 'simulateTagTeamBattle',
    count: 4,
    run: async (r) => {
      const team = (id: number, active: RobotWithWeapons, reserve: RobotWithWeapons): TagTeamWithRobots => ({
        id, stableId: id, teamName: `Team-${id}`, teamSize: 2,
        activeRobotId: active.id, reserveRobotId: reserve.id,
        activeRobot: active, reserveRobot: reserve,
        createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
      });
      return simulateTagTeamBattle(team(1, r[0], r[1]), team(2, r[2], r[3]));
    },
  },
];

// ─── #518 helpers ───────────────────────────────────────────────────

const RESOLVED_ATTACK_TYPES = ['attack', 'critical', 'miss', 'malfunction'];

/** Deterministic PRNG so seeded battles replay identically. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Run `fn` with Math.random replaced by a seeded PRNG; restored afterwards. */
function withSeededRandom<T>(seed: number, fn: () => T): T {
  const spy = jest.spyOn(Math, 'random').mockImplementation(mulberry32(seed));
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

/** Game mode hook that pins every robot (by teamIndex) to a fixed position. */
function pinned(pins: Position[]): GameModeConfig {
  return {
    movementModifier: {
      modify: (intent: MovementIntent, s: RobotCombatState): MovementIntent => ({ ...intent, targetPosition: pins[s.teamIndex] }),
    },
  };
}

/** Energy-type weapon with melee reach (Shock Maul shape). */
function createShockMaulInventory(weaponId: number = 4) {
  const inventory = createMeleeWeaponInventory(weaponId);
  return { ...inventory, weapon: { ...inventory.weapon, name: 'Shock Maul', weaponType: 'energy', damageType: 'energy' } };
}

/** Resolved attack attempts (attack/critical/miss/malfunction), optionally by attacker and hand. */
function resolvedAttacks(events: CombatEvent[], name?: string, hand?: 'main' | 'offhand'): CombatEvent[] {
  return events.filter(e =>
    RESOLVED_ATTACK_TYPES.includes(e.type)
    && e.attacker !== undefined
    && (name === undefined || e.attacker === name)
    && (hand === undefined || e.hand === hand),
  );
}

/** Robot that never yields and survives a full 120 s battle. */
function durableRobot(overrides: Partial<RobotWithWeapons>): RobotWithWeapons {
  return createMockRobot({
    currentHP: 100000,
    maxHP: 100000,
    yieldThreshold: 0,
    ...overrides,
  });
}

/** Point `distance` units from `from` toward `toward`. */
function towards(from: Position, toward: Position, distance: number): Position {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: from.x + (dx / len) * distance, y: from.y + (dy / len) * distance };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('simulateBattle — spatial refactor', () => {

  // Validates: Requirement 14.1, 14.2
  describe('1v1 battle completion and CombatResult with arena metadata', () => {
    it('should complete a 1v1 battle and return valid CombatResult with arena metadata', () => {
      const robot1 = createMockRobot({ id: 1, name: 'Alpha' });
      const robot2 = createMockRobot({ id: 2, name: 'Beta' });

      const result = simulateBattle(robot1, robot2);

      // Arena metadata present
      expect(result.arenaRadius).toBeDefined();
      expect(result.arenaRadius).toBe(16); // 1v1 default
      expect(result.startingPositions).toBeDefined();
      expect(result.startingPositions!['Alpha']).toBeDefined();
      expect(result.startingPositions!['Beta']).toBeDefined();
      expect(result.startingPositions!['Alpha']).toHaveProperty('x');
      expect(result.startingPositions!['Alpha']).toHaveProperty('y');
      expect(result.endingPositions).toBeDefined();
      expect(result.endingPositions!['Alpha']).toHaveProperty('x');
      expect(result.endingPositions!['Beta']).toHaveProperty('x');

      // Battle completed
      expect(result.durationSeconds).toBeGreaterThan(0);
      expect(result.durationSeconds).toBeLessThanOrEqual(120);
      expect(result.events.length).toBeGreaterThan(0);
    });
  });

  // Validates: Requirement 14.2
  describe('backward compatibility — CombatResult fields', () => {
    it('should retain all existing CombatResult fields', () => {
      const robot1 = createMockRobot({ id: 1, name: 'Alpha' });
      const robot2 = createMockRobot({ id: 2, name: 'Beta' });

      const result = simulateBattle(robot1, robot2);

      // All existing fields must be present
      expect(result).toHaveProperty('winnerId');
      expect(result).toHaveProperty('robot1FinalHP');
      expect(result).toHaveProperty('robot2FinalHP');
      expect(result).toHaveProperty('robot1FinalShield');
      expect(result).toHaveProperty('robot2FinalShield');
      expect(result).toHaveProperty('robot1Damage');
      expect(result).toHaveProperty('robot2Damage');
      expect(result).toHaveProperty('robot1DamageDealt');
      expect(result).toHaveProperty('robot2DamageDealt');
      expect(result).toHaveProperty('durationSeconds');
      expect(result).toHaveProperty('isDraw');
      expect(result).toHaveProperty('events');

      // Type checks
      expect(typeof result.robot1FinalHP).toBe('number');
      expect(typeof result.robot2FinalHP).toBe('number');
      expect(typeof result.robot1FinalShield).toBe('number');
      expect(typeof result.robot2FinalShield).toBe('number');
      expect(typeof result.durationSeconds).toBe('number');
      expect(typeof result.isDraw).toBe('boolean');
      expect(Array.isArray(result.events)).toBe(true);

      // HP values are non-negative
      expect(result.robot1FinalHP).toBeGreaterThanOrEqual(0);
      expect(result.robot2FinalHP).toBeGreaterThanOrEqual(0);
      expect(result.robot1FinalShield).toBeGreaterThanOrEqual(0);
      expect(result.robot2FinalShield).toBeGreaterThanOrEqual(0);

      // winnerId is either null (draw) or one of the robot ids
      if (!result.isDraw) {
        expect([robot1.id, robot2.id]).toContain(result.winnerId);
      } else {
        expect(result.winnerId).toBeNull();
      }
    });
  });

  // Validates: Requirement 14.3
  describe('CombatEvent backward compatibility', () => {
    it('should retain existing event type structure with required fields', () => {
      const robot1 = createMockRobot({ id: 1, name: 'Alpha', mainWeapon: createRangedWeaponInventory(1), mainWeaponId: 1 });
      const robot2 = createMockRobot({ id: 2, name: 'Beta', mainWeapon: createRangedWeaponInventory(2), mainWeaponId: 2 });

      const result = simulateBattle(robot1, robot2);

      // Every event must have timestamp and message
      for (const event of result.events) {
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('message');
        expect(typeof event.timestamp).toBe('number');
        expect(typeof event.message).toBe('string');
        expect(event.timestamp).toBeGreaterThanOrEqual(0);
      }

      // Attack/miss/critical events should have attacker/defender
      // Exclude the initial battle-start event (type 'attack' at timestamp 0 with no attacker)
      const combatEvents = result.events.filter(e =>
        ['attack', 'miss', 'critical', 'malfunction'].includes(e.type) && e.attacker !== undefined
      );
      expect(combatEvents.length).toBeGreaterThan(0);
      for (const event of combatEvents) {
        expect(event.attacker).toBeDefined();
        expect(event.defender).toBeDefined();
        // `robotHP`, not `robot1HP`/`robot2HP`. Those two are marked @deprecated and
        // optional on CombatEvent — they swap with attacker/defender roles, which is
        // why the name-keyed map replaced them — and `malfunction` events never carried
        // them, which is what this assertion was actually catching. The map is injected
        // on every event push, so asserting it is both correct and stronger.
        expect(event.robotHP).toBeDefined();
        expect(Object.keys(event.robotHP!)).toEqual(
          expect.arrayContaining([event.attacker!, event.defender!]),
        );
      }
    });

    it('should include optional spatial fields on combat events without breaking structure', () => {
      const robot1 = createMockRobot({ id: 1, name: 'Alpha', mainWeapon: createRangedWeaponInventory(1), mainWeaponId: 1 });
      const robot2 = createMockRobot({ id: 2, name: 'Beta', mainWeapon: createRangedWeaponInventory(2), mainWeaponId: 2 });

      const result = simulateBattle(robot1, robot2);

      // At least some events should have position data
      const eventsWithPositions = result.events.filter(e => e.positions !== undefined);
      expect(eventsWithPositions.length).toBeGreaterThan(0);

      // Position data should have valid structure
      for (const event of eventsWithPositions) {
        for (const name of Object.keys(event.positions!)) {
          expect(event.positions![name]).toHaveProperty('x');
          expect(event.positions![name]).toHaveProperty('y');
          expect(typeof event.positions![name].x).toBe('number');
          expect(typeof event.positions![name].y).toBe('number');
        }
      }
    });
  });

  // Validates: Requirements 14.3 (movement events, range transitions)
  describe('melee vs ranged — movement events and range transitions', () => {
    it('should produce movement events and range transitions when melee fights ranged', () => {
      const meleeRobot = createMockRobot({
        id: 1,
        name: 'MeleeBot',
        mainWeapon: createMeleeWeaponInventory(1),
        mainWeaponId: 1,
        servoMotors: new Prisma.Decimal(30), // Fast melee
      });
      const rangedRobot = createMockRobot({
        id: 2,
        name: 'RangedBot',
        mainWeapon: createRangedWeaponInventory(2),
        mainWeaponId: 2,
        servoMotors: new Prisma.Decimal(10), // Slower ranged
      });

      const result = simulateBattle(meleeRobot, rangedRobot);

      const movementEvents = getEventsByType(result.events, 'movement');
      const rangeTransitions = getEventsByType(result.events, 'range_transition');

      // Melee robot must close distance, so movement events should exist
      expect(movementEvents.length).toBeGreaterThan(0);

      // Starting at long range (28 units apart), transitions should occur
      // as melee robot closes to melee range
      expect(rangeTransitions.length).toBeGreaterThan(0);

      // Range transitions should have distance and rangeBand
      for (const rt of rangeTransitions) {
        expect(rt.distance).toBeDefined();
        expect(rt.rangeBand).toBeDefined();
        expect(['melee', 'short', 'mid', 'long']).toContain(rt.rangeBand);
      }
    });

    it('should converge two melee robots into attack range instead of patience-rate attacks', () => {
      const robotDefaults = {
        currentHP: 100000,
        maxHP: 100000,
        currentShield: 1000,
        maxShield: 1000,
        yieldThreshold: 0,
        servoMotors: new Prisma.Decimal(30),
        combatAlgorithms: new Prisma.Decimal(50),
        threatAnalysis: new Prisma.Decimal(50),
        attackSpeed: new Prisma.Decimal(50),
      };
      const dommeAap = createMockRobot({
        ...robotDefaults,
        id: 1,
        name: 'DommeAap',
        mainWeapon: createMeleeWeaponInventory(1),
        mainWeaponId: 1,
      });
      const ultron = createMockRobot({
        ...robotDefaults,
        id: 2,
        name: 'Ultron',
        mainWeapon: createMeleeWeaponInventory(2),
        mainWeaponId: 2,
      });

      const result = simulateBattle(dommeAap, ultron);
      const attackEvents = result.events.filter(event =>
        ['attack', 'critical', 'miss', 'malfunction'].includes(event.type)
        && event.attacker !== undefined,
      );
      const ultronAttackEvents = attackEvents.filter(event => event.attacker === 'Ultron');
      const dommeAapAttackEvents = attackEvents.filter(event => event.attacker === 'DommeAap');

      expect(ultronAttackEvents.length).toBeGreaterThan(20);
      expect(dommeAapAttackEvents.length).toBeGreaterThan(20);
      expect(attackEvents.every(event => event.distance !== undefined && event.distance <= 2)).toBe(true);
    });
  });

  // Validates: Requirement 14.3 (out_of_range events)
  describe('out_of_range events for melee robots', () => {
    it('should emit out_of_range events when melee robot cannot reach target', () => {
      const meleeRobot = createMockRobot({
        id: 1,
        name: 'SlowMelee',
        mainWeapon: createMeleeWeaponInventory(1),
        mainWeaponId: 1,
        servoMotors: new Prisma.Decimal(5), // Very slow
        combatAlgorithms: new Prisma.Decimal(1), // Low AI — weakest pathing
      });
      const rangedRobot = createMockRobot({
        id: 2,
        name: 'FastRanged',
        mainWeapon: createRangedWeaponInventory(2),
        mainWeaponId: 2,
        servoMotors: new Prisma.Decimal(40), // Very fast
      });

      const result = simulateBattle(meleeRobot, rangedRobot);

      const outOfRangeEvents = getEventsByType(result.events, 'out_of_range');

      // Melee robot starts at long range (28 units) and needs to close to ≤2 units.
      // With slow speed, it should have out_of_range events before reaching melee range.
      expect(outOfRangeEvents.length).toBeGreaterThan(0);

      // out_of_range events should reference the melee weapon
      for (const event of outOfRangeEvents) {
        expect(event.attacker).toBe('SlowMelee');
        expect(event.weapon).toBeDefined();
        expect(event.distance).toBeDefined();
        expect(event.distance!).toBeGreaterThan(2);
      }
    });
  });

  // Validates: Requirement 14.3 (backstab events)
  describe('backstab detection', () => {
    it('should produce backstab-flagged attack events during combat', () => {
      // Use a fast melee robot with high servo motors to maneuver behind a slow-turning opponent
      const fastMelee = createMockRobot({
        id: 1,
        name: 'Flanker',
        mainWeapon: createMeleeWeaponInventory(1),
        mainWeaponId: 1,
        servoMotors: new Prisma.Decimal(45), // Very fast
        gyroStabilizers: new Prisma.Decimal(40), // Fast turning
        combatAlgorithms: new Prisma.Decimal(40), // Smart pathing
        threatAnalysis: new Prisma.Decimal(30), // Flank approach bias
      });
      const slowDefender = createMockRobot({
        id: 2,
        name: 'SlowTurner',
        mainWeapon: createRangedWeaponInventory(2),
        mainWeaponId: 2,
        servoMotors: new Prisma.Decimal(5),
        gyroStabilizers: new Prisma.Decimal(1), // Very slow turning
      });

      const result = simulateBattle(fastMelee, slowDefender);

      // Check for any attack events with backstab flag
      const attackEvents = result.events.filter(e =>
        ['attack', 'critical'].includes(e.type)
      );

      // At least some attacks should have the attackAngle field
      const eventsWithAngle = attackEvents.filter(e => e.attackAngle !== undefined);
      expect(eventsWithAngle.length).toBeGreaterThan(0);

      // Check if any backstab events were emitted
      const backstabEvents = result.events.filter(e => e.backstab === true);
      // Backstab is probabilistic based on positioning, so we check the field exists
      // on attack events rather than requiring it to always trigger
      const eventsWithBackstabField = attackEvents.filter(e => e.backstab !== undefined);
      expect(eventsWithBackstabField.length).toBeGreaterThan(0);
    });
  });

  // Validates: Requirement 14.6
  describe('tournament HP tiebreaker', () => {
    it('should resolve draws via HP tiebreaker when isTournament is true', () => {
      // Create two very tanky robots that are unlikely to destroy each other in 120s
      const tanky1 = createMockRobot({
        id: 1,
        name: 'Tank1',
        hullIntegrity: new Prisma.Decimal(50),
        currentHP: 300,
        maxHP: 300,
        armorPlating: new Prisma.Decimal(50),
        shieldCapacity: new Prisma.Decimal(50),
        currentShield: 100,
        maxShield: 100,
        mainWeapon: createRangedWeaponInventory(1),
        mainWeaponId: 1,
      });
      const tanky2 = createMockRobot({
        id: 2,
        name: 'Tank2',
        hullIntegrity: new Prisma.Decimal(50),
        currentHP: 300,
        maxHP: 300,
        armorPlating: new Prisma.Decimal(50),
        shieldCapacity: new Prisma.Decimal(50),
        currentShield: 100,
        maxShield: 100,
        mainWeapon: createRangedWeaponInventory(2),
        mainWeaponId: 2,
      });

      const result = simulateBattle(tanky1, tanky2, true);

      // In tournament mode, there should always be a winner (no draws)
      expect(result.winnerId).not.toBeNull();
      expect(result.isDraw).toBe(false);

      // Winner should be one of the two robots
      expect([tanky1.id, tanky2.id]).toContain(result.winnerId);
    });

    it('should allow draws when isTournament is false', () => {
      // Very tanky robots with minimal damage output
      const tanky1 = createMockRobot({
        id: 1,
        name: 'Tank1',
        hullIntegrity: new Prisma.Decimal(50),
        currentHP: 300,
        maxHP: 300,
        armorPlating: new Prisma.Decimal(50),
        shieldCapacity: new Prisma.Decimal(50),
        currentShield: 100,
        maxShield: 100,
        combatPower: new Prisma.Decimal(1),
        yieldThreshold: 0, // Never yield
      });
      const tanky2 = createMockRobot({
        id: 2,
        name: 'Tank2',
        hullIntegrity: new Prisma.Decimal(50),
        currentHP: 300,
        maxHP: 300,
        armorPlating: new Prisma.Decimal(50),
        shieldCapacity: new Prisma.Decimal(50),
        currentShield: 100,
        maxShield: 100,
        combatPower: new Prisma.Decimal(1),
        yieldThreshold: 0, // Never yield
      });

      const result = simulateBattle(tanky1, tanky2, false);

      // Non-tournament: if time runs out, it's a draw
      if (result.durationSeconds >= 120) {
        expect(result.isDraw).toBe(true);
        expect(result.winnerId).toBeNull();
      }
      // If one robot happened to win, that's fine too — the test validates the draw path
    });
  });

  // Validates: Requirement 14.7, 14.8, 14.9
  describe('pure function guarantee', () => {
    it('should produce structurally consistent results across multiple calls with same inputs', () => {
      const robot1 = createMockRobot({
        id: 1,
        name: 'Alpha',
        mainWeapon: createRangedWeaponInventory(1),
        mainWeaponId: 1,
      });
      const robot2 = createMockRobot({
        id: 2,
        name: 'Beta',
        mainWeapon: createRangedWeaponInventory(2),
        mainWeaponId: 2,
      });

      const result1 = simulateBattle(robot1, robot2);
      const result2 = simulateBattle(robot1, robot2);

      // Structural consistency (not exact values due to Math.random)
      // Both results should have the same field set
      expect(Object.keys(result1).sort()).toEqual(Object.keys(result2).sort());

      // Both should have arena metadata
      expect(result1.arenaRadius).toBe(result2.arenaRadius);

      // Starting positions should be identical (deterministic arena layout)
      expect(result1.startingPositions).toEqual(result2.startingPositions);

      // Both should have events
      expect(result1.events.length).toBeGreaterThan(0);
      expect(result2.events.length).toBeGreaterThan(0);

      // Duration should be within valid range
      expect(result1.durationSeconds).toBeGreaterThan(0);
      expect(result1.durationSeconds).toBeLessThanOrEqual(120);
      expect(result2.durationSeconds).toBeGreaterThan(0);
      expect(result2.durationSeconds).toBeLessThanOrEqual(120);

      // HP values should be non-negative
      expect(result1.robot1FinalHP).toBeGreaterThanOrEqual(0);
      expect(result1.robot2FinalHP).toBeGreaterThanOrEqual(0);
      expect(result2.robot1FinalHP).toBeGreaterThanOrEqual(0);
      expect(result2.robot2FinalHP).toBeGreaterThanOrEqual(0);
    });

    it('should not mutate input robot objects', () => {
      const robot1 = createMockRobot({ id: 1, name: 'Alpha' });
      const robot2 = createMockRobot({ id: 2, name: 'Beta' });

      // Snapshot original values
      const r1HP = robot1.currentHP;
      const r2HP = robot2.currentHP;
      const r1Name = robot1.name;
      const r2Name = robot2.name;

      simulateBattle(robot1, robot2);

      // Input objects should not be mutated
      expect(robot1.currentHP).toBe(r1HP);
      expect(robot2.currentHP).toBe(r2HP);
      expect(robot1.name).toBe(r1Name);
      expect(robot2.name).toBe(r2Name);
    });
  });

  // #517: cooldowns are derived from the prepared (loadout-adjusted) attack speed.
  describe('prepared Dual Wield robot uses canonical attack speed (#517)', () => {
    it('derives main and offhand cooldowns from the loadout-adjusted attack speed', () => {
      const dualWield = createMockRobot({
        id: 1,
        name: 'Dualist',
        loadoutType: 'dual_wield',
        mainWeapon: createRangedWeaponInventory(1),
        offhandWeapon: createRangedWeaponInventory(2),
        mainWeaponId: 1,
        offhandWeaponId: 2,
      });
      const opponent = createMockRobot({
        id: 2,
        name: 'Opponent',
        mainWeapon: createRangedWeaponInventory(3),
        mainWeaponId: 3,
      });
      prepareRobotForCombat(dualWield);
      prepareRobotForCombat(opponent);

      // Fixture attackSpeed 20, Laser Pistol attackSpeedBonus 0 → (20 + 0 + 0) × 1.30 = 26
      const canonicalAttackSpeed = 26;
      expect(Number(dualWield.attackSpeed)).toBe(canonicalAttackSpeed);

      const result = simulateBattleMulti([dualWield, opponent], { allowDraws: true, maxDuration: 5 });
      const state = result.finalStates![0];
      expect(state.attackCooldown).toBeCloseTo(3 / (1 + canonicalAttackSpeed / 50), 5);
      expect(state.offhandCooldown).toBeCloseTo((3 * 1.4) / (1 + canonicalAttackSpeed / 50), 5);
    });
  });

  // #517: every simulator entry point consumes prepared robots as-is — it never
  // re-derives, mutates or compounds the prepared attributes.
  describe('simulator entry points consume prepared robots without compounding (#517)', () => {
    const LOADOUT_CYCLE = ['dual_wield', 'weapon_shield', 'two_handed', 'single'] as const;

    function preparedRobots(count: number): RobotWithWeapons[] {
      return Array.from({ length: count }, (_, i) => {
        const loadoutType = LOADOUT_CYCLE[i % LOADOUT_CYCLE.length];
        const robot = createMockRobot({
          id: i + 1,
          name: `Entry-${i + 1}`,
          loadoutType,
          mainWeapon: createRangedWeaponInventory(100 + i * 2),
          offhandWeapon: loadoutType === 'dual_wield' ? createRangedWeaponInventory(101 + i * 2) : null,
          mainWeaponId: 100 + i * 2,
        });
        prepareRobotForCombat(robot);
        return robot;
      });
    }

    function attributeSnapshot(robots: RobotWithWeapons[]): Array<Record<string, number>> {
      return robots.map((robot) => Object.fromEntries(
        ROBOT_ATTRIBUTES.map((attr) => [attr, Number(robot[attr as keyof RobotWithWeapons])]),
      ));
    }

    /** Main-hand cooldown the simulator must derive from the prepared attack speed. */
    function expectedMainCooldown(robot: RobotWithWeapons): number {
      return (robot.mainWeapon?.weapon?.cooldown ?? 3) / (1 + Number(robot.attackSpeed) / 50);
    }

    it.each(entryPoints)('$name', async ({ count, run }) => {
      const robots = preparedRobots(count);
      const before = attributeSnapshot(robots);
      const maxBefore = robots.map((r) => ({ maxHP: r.maxHP, maxShield: r.maxShield }));

      const result = await run(robots);

      expect(result).toBeDefined();
      expect(attributeSnapshot(robots)).toEqual(before);
      expect(robots.map((r) => ({ maxHP: r.maxHP, maxShield: r.maxShield }))).toEqual(maxBefore);

      const finalStates = (result as { finalStates?: Array<{ attackCooldown: number }> }).finalStates;
      if (finalStates) {
        finalStates.forEach((state, i) => {
          expect(state.attackCooldown).toBeCloseTo(expectedMainCooldown(robots[i]), 5);
        });
      }
    });
  });

  // #518: physical reach is an invariant of every resolved attack. Patience never
  // lets a melee-band weapon (incl. energy melee) hit beyond 2 units, in either hand.
  describe('melee reach is enforced regardless of patience (#518)', () => {
    /** Each robot sits 1e-6 / 2 beyond x = ±1, so the pair is 2 + 1e-6 apart. */
    const JUST_OUT = 5e-7;
    const PINS_BEYOND_REACH: Position[] = [{ x: -1 - JUST_OUT, y: 0 }, { x: 1 + JUST_OUT, y: 0 }];
    const PINS_AT_REACH: Position[] = [{ x: -1, y: 0 }, { x: 1, y: 0 }];
    const PINS_AT_TEN: Position[] = [{ x: -5, y: 0 }, { x: 5, y: 0 }];

    function pinnedDuel(robots: RobotWithWeapons[], pins: Position[]) {
      return simulateBattleMulti(robots, { allowDraws: true, gameModeConfig: { maxDuration: 120, ...pinned(pins) } });
    }

    const counterEvents = (events: CombatEvent[]): CombatEvent[] =>
      events.filter(e => e.type === 'counter' || e.type === 'counter_out_of_range');

    const hits = (events: CombatEvent[]): CombatEvent[] =>
      events.filter(e => e.type === 'attack' || e.type === 'critical');

    const MELEE_WEAPONS = [
      { label: 'melee (Energy Blade)', make: createMeleeWeaponInventory },
      { label: 'energy melee (Shock Maul)', make: createShockMaulInventory },
    ];
    const S1_CASES = MELEE_WEAPONS.flatMap(w => [1, 50].map(ca => ({ ...w, ca })));

    it.each(S1_CASES)('$label at 2 + 1e-6 never resolves an attack over 120 s (CA $ca)', ({ make, ca }) => {
      const robots = [
        durableRobot({ id: 1, name: 'Left', mainWeapon: make(1), mainWeaponId: 1, combatAlgorithms: new Prisma.Decimal(ca) }),
        durableRobot({ id: 2, name: 'Right', mainWeapon: make(2), mainWeaponId: 2, combatAlgorithms: new Prisma.Decimal(ca) }),
      ];
      const spy = jest.spyOn(Math, 'random');
      let randomCalls: number;
      let result: ReturnType<typeof pinnedDuel>;
      try {
        result = pinnedDuel(robots, PINS_BEYOND_REACH);
        randomCalls = spy.mock.calls.length;
      } finally {
        spy.mockRestore();
      }

      expect(resolvedAttacks(result.events)).toHaveLength(0);
      expect(counterEvents(result.events)).toHaveLength(0);
      expect(result.finalStates!.map(s => s.totalDamageDealt)).toEqual([0, 0]);
      expect(getEventsByType(result.events, 'out_of_range').length).toBeGreaterThanOrEqual(1);
      // Patience ran far past any limit (15 s max) without granting an attack.
      expect(result.finalStates!.every(s => s.patienceTimer > 100)).toBe(true);
      // Blocked attempts consume no randomness.
      expect(randomCalls).toBe(0);
    });

    it('melee at exactly 2 units stays legal', () => {
      const robots = [
        durableRobot({ id: 1, name: 'Left', mainWeapon: createMeleeWeaponInventory(1), mainWeaponId: 1 }),
        durableRobot({ id: 2, name: 'Right', mainWeapon: createMeleeWeaponInventory(2), mainWeaponId: 2 }),
      ];
      const result = withSeededRandom(518, () => pinnedDuel(robots, PINS_AT_REACH));
      const attacks = resolvedAttacks(result.events);

      expect(attacks.length).toBeGreaterThan(20);
      expect(attacks.every(e => e.distance !== undefined && e.distance <= 2)).toBe(true);
      expect(result.finalStates![0].totalDamageDealt + result.finalStates![1].totalDamageDealt).toBeGreaterThan(0);
    });

    it('dual-wield melee + melee at 2 + 1e-6 resolves no attack in either hand', () => {
      const dualMelee = (id: number, name: string) => durableRobot({
        id, name, loadoutType: 'dual_wield',
        mainWeapon: createMeleeWeaponInventory(id * 10), mainWeaponId: id * 10,
        offhandWeapon: createMeleeWeaponInventory(id * 10 + 1), offhandWeaponId: id * 10 + 1,
      });
      const result = withSeededRandom(518, () => pinnedDuel([dualMelee(1, 'Left'), dualMelee(2, 'Right')], PINS_BEYOND_REACH));

      expect(resolvedAttacks(result.events, undefined, 'main')).toHaveLength(0);
      expect(resolvedAttacks(result.events, undefined, 'offhand')).toHaveLength(0);
      expect(counterEvents(result.events)).toHaveLength(0);
    });

    /** Mixed-hand dual wielder 10 units from a ranged opponent. */
    function mixedHandsAtTen(main: 'ranged' | 'melee', seed: number) {
      const ranged = createRangedWeaponInventory(11);
      const melee = createMeleeWeaponInventory(12);
      const mixed = durableRobot({
        id: 1, name: 'Mixed', loadoutType: 'dual_wield',
        mainWeapon: main === 'ranged' ? ranged : melee, mainWeaponId: 11,
        offhandWeapon: main === 'ranged' ? melee : ranged, offhandWeaponId: 12,
      });
      const opponent = durableRobot({ id: 2, name: 'Opponent', mainWeapon: createRangedWeaponInventory(13), mainWeaponId: 13 });
      return withSeededRandom(seed, () => pinnedDuel([mixed, opponent], PINS_AT_TEN));
    }

    it('ranged main + melee offhand at 10 units: only the main hand fires, with the range penalty', () => {
      const result = mixedHandsAtTen('ranged', 518);
      const mainHits = hits(resolvedAttacks(result.events, 'Mixed', 'main'));

      expect(resolvedAttacks(result.events, 'Mixed', 'main').length).toBeGreaterThan(0);
      expect(mainHits.length).toBeGreaterThan(0);
      expect(mainHits.every(e => e.rangePenalty === 0.75)).toBe(true);
      expect(resolvedAttacks(result.events, 'Mixed', 'offhand')).toHaveLength(0);
    });

    it('melee main + ranged offhand at 10 units: only the offhand fires, with the range penalty', () => {
      const result = mixedHandsAtTen('melee', 518);
      const offhandHits = hits(resolvedAttacks(result.events, 'Mixed', 'offhand'));

      expect(resolvedAttacks(result.events, 'Mixed', 'main')).toHaveLength(0);
      expect(offhandHits.length).toBeGreaterThan(0);
      expect(offhandHits.every(e => e.rangePenalty === 0.75)).toBe(true);
    });

    it('ranged attacks beyond reach fire with the penalty, and a melee defender cannot counter them', () => {
      const gunner = durableRobot({ id: 1, name: 'Gunner', mainWeapon: createRangedWeaponInventory(1), mainWeaponId: 1 });
      const brawler = durableRobot({
        id: 2, name: 'Brawler', mainWeapon: createMeleeWeaponInventory(2), mainWeaponId: 2,
        counterProtocols: new Prisma.Decimal(30),
      });
      const result = withSeededRandom(518, () => pinnedDuel([gunner, brawler], PINS_AT_TEN));
      const gunnerHits = hits(resolvedAttacks(result.events, 'Gunner'));

      expect(gunnerHits.length).toBeGreaterThan(0);
      expect(gunnerHits.every(e => e.rangePenalty === 0.75)).toBe(true);
      expect(result.events.filter(e => e.type === 'counter' && e.attacker === 'Brawler')).toHaveLength(0);
      expect(result.events.filter(e => e.type === 'counter_out_of_range' && e.attacker === 'Brawler').length)
        .toBeGreaterThan(0);
    });

    describe('opportunistic targeting in multi-robot battles', () => {
      // simulateBattleMulti places n = 3 robots on a radius-18 ring (arena radius 20).
      const ringSpawn = (i: number): Position => ({
        x: Math.round(18 * Math.cos((i * 2 * Math.PI) / 3) * 1000) / 1000,
        y: Math.round(18 * Math.sin((i * 2 * Math.PI) / 3) * 1000) / 1000,
      });

      /**
       * A stays on its spawn; Near and Far approach A along straight lines from their
       * own spawns and stop `nearDistance` / 10 units away. A's primary target is Far.
       */
      function threeWay(attacker: RobotWithWeapons, nearDistance: number) {
        const a = ringSpawn(0);
        const pins = [a, towards(a, ringSpawn(1), nearDistance), towards(a, ringSpawn(2), 10)];
        const near = durableRobot({ id: 2, name: 'Near', mainWeapon: createRangedWeaponInventory(21), mainWeaponId: 21 });
        const far = durableRobot({ id: 3, name: 'Far', mainWeapon: createRangedWeaponInventory(22), mainWeaponId: 22 });
        const forceFar: GameModeConfig['targetPriority'] = {
          selectTargets: (robot: RobotCombatState) => (robot.teamIndex === 0 ? [2] : []),
        };
        return withSeededRandom(518, () => simulateBattleMulti([attacker, near, far], {
          allowDraws: true,
          gameModeConfig: { maxDuration: 120, ...pinned(pins), targetPriority: forceFar },
        }));
      }

      const meleeA = () => durableRobot({ id: 1, name: 'A', mainWeapon: createMeleeWeaponInventory(20), mainWeaponId: 20 });

      it('a melee hand switches to the nearest opponent within its own reach', () => {
        const attacks = resolvedAttacks(threeWay(meleeA(), 1.5).events, 'A');

        expect(attacks.length).toBeGreaterThan(0);
        expect(attacks.every(e => e.defender === 'Near' && e.distance !== undefined && e.distance <= 2)).toBe(true);
      });

      it('with no opponent in reach, melee never attacks — not even the primary target after patience', () => {
        const result = threeWay(meleeA(), 2 + 1e-6);

        expect(resolvedAttacks(result.events, 'A')).toHaveLength(0);
        expect(result.finalStates![0].totalDamageDealt).toBe(0);
      });

      it('each hand validates its own target: ranged main hits Far, melee offhand hits only Near', () => {
        const mixed = durableRobot({
          id: 1, name: 'A', loadoutType: 'dual_wield',
          mainWeapon: createRangedWeaponInventory(20), mainWeaponId: 20,
          offhandWeapon: createMeleeWeaponInventory(23), offhandWeaponId: 23,
        });
        const events = threeWay(mixed, 1.5).events;
        const main = resolvedAttacks(events, 'A', 'main');
        const offhand = resolvedAttacks(events, 'A', 'offhand');

        expect(main.length).toBeGreaterThan(0);
        expect(main.every(e => e.defender === 'Far')).toBe(true);
        expect(offhand.length).toBeGreaterThan(0);
        expect(offhand.every(e => e.defender === 'Near' && e.distance !== undefined && e.distance <= 2)).toBe(true);
      });
    });

    /** Slow melee robot against a fast ranged kiter, free movement. */
    function slowMeleeVsKiter(seed: number) {
      const slowMelee = createMockRobot({
        id: 1, name: 'SlowMelee', mainWeapon: createMeleeWeaponInventory(1), mainWeaponId: 1,
        servoMotors: new Prisma.Decimal(5), combatAlgorithms: new Prisma.Decimal(1),
      });
      const fastRanged = createMockRobot({
        id: 2, name: 'FastRanged', mainWeapon: createRangedWeaponInventory(2), mainWeaponId: 2,
        servoMotors: new Prisma.Decimal(40),
      });
      return withSeededRandom(seed, () => simulateBattle(slowMelee, fastRanged));
    }

    it.each(Array.from({ length: 10 }, (_, i) => i + 1))(
      'free movement, seed %i: a slow melee robot never hits a kiting ranged robot beyond reach',
      (seed) => {
        const attacks = resolvedAttacks(slowMeleeVsKiter(seed).events, 'SlowMelee');
        expect(attacks.every(e => e.distance !== undefined && e.distance <= 2)).toBe(true);
      },
    );

    describe('every simulator entry point enforces reach', () => {
      /** Cycles melee, energy melee, ranged and mixed (ranged main + melee offhand) dual wield. */
      function reachRobots(count: number): RobotWithWeapons[] {
        return Array.from({ length: count }, (_, i) => {
          const kind = i % 4;
          const weaponId = 200 + i * 2;
          const robot = createMockRobot({
            id: i + 1,
            name: `Reach-${i + 1}`,
            loadoutType: kind === 3 ? 'dual_wield' : 'single',
            mainWeapon: kind === 0 ? createMeleeWeaponInventory(weaponId)
              : kind === 1 ? createShockMaulInventory(weaponId)
                : createRangedWeaponInventory(weaponId),
            mainWeaponId: weaponId,
            offhandWeapon: kind === 3 ? createMeleeWeaponInventory(weaponId + 1) : null,
            offhandWeaponId: kind === 3 ? weaponId + 1 : null,
          });
          prepareRobotForCombat(robot);
          return robot;
        });
      }

      /** Raw combat events, whatever the entry point calls them. */
      function rawEvents(result: unknown): CombatEvent[] {
        const r = result as { events?: CombatEvent[]; detailedCombatEvents?: unknown[]; battleLog?: unknown[] };
        if (r.detailedCombatEvents) return r.detailedCombatEvents as CombatEvent[];
        if (r.events) return r.events;
        return (r.battleLog ?? []) as CombatEvent[];
      }

      it.each(entryPoints)('$name', async ({ count, run }) => {
        const robots = reachRobots(count);
        const bands = new Map(robots.map(r => [r.name, {
          main: r.mainWeapon?.weapon?.rangeBand,
          offhand: r.offhandWeapon?.weapon?.rangeBand,
        }]));

        const spy = jest.spyOn(Math, 'random').mockImplementation(mulberry32(518));
        let result: unknown;
        try {
          result = await run(robots);
        } finally {
          spy.mockRestore();
        }

        const attacks = resolvedAttacks(rawEvents(result));
        expect(attacks.length).toBeGreaterThan(0);
        for (const event of attacks) {
          const weaponBands = bands.get(event.attacker!);
          expect(weaponBands).toBeDefined();
          const band = event.hand === 'offhand' ? weaponBands!.offhand : weaponBands!.main;
          if (band === 'melee') {
            expect(typeof event.distance).toBe('number');
            expect(event.distance!).toBeLessThanOrEqual(2);
          }
        }
      });
    });

    it('seeded replays are deterministic', () => {
      expect(mixedHandsAtTen('ranged', 7).events).toEqual(mixedHandsAtTen('ranged', 7).events);
      expect(slowMeleeVsKiter(1).events).toEqual(slowMeleeVsKiter(1).events);
    });
  });

  describe('engagement cycle (#520)', () => {
    /** Movement-phase sample of one robot, taken right after its speed was set. */
    interface MoveSample {
      name: string;
      tick: number;
      speed: number;
      burst: SpeedBurst;
      exempt: boolean;
      patience: number;
      distance: number;
    }

    /**
     * Pass-through movement modifier that samples each robot's speed state (optionally
     * pinning robots). In a 1v1 the distance is to the only opponent.
     */
    function recorder(pins?: Position[]): { samples: MoveSample[]; config: GameModeConfig } {
      const samples: MoveSample[] = [];
      const seen = new Map<number, RobotCombatState>();
      const ticks = new Map<number, number>();
      const config: GameModeConfig = {
        movementModifier: {
          modify: (intent: MovementIntent, s: RobotCombatState): MovementIntent => {
            seen.set(s.teamIndex, s);
            const tick = (ticks.get(s.teamIndex) ?? 0) + 1;
            ticks.set(s.teamIndex, tick);
            const other = [...seen.values()].find(o => o !== s);
            samples.push({
              name: s.robot.name,
              tick,
              speed: s.effectiveMovementSpeed,
              burst: s.speedBurst,
              exempt: s.isUsingClosingBonus,
              patience: s.patienceTimer,
              distance: other
                ? Math.hypot(s.position.x - other.position.x, s.position.y - other.position.y)
                : Number.NaN,
            });
            return pins ? { ...intent, targetPosition: pins[s.teamIndex] } : intent;
          },
        },
      };
      return { samples, config };
    }

    function duel(robots: RobotWithWeapons[], seed: number, pins?: Position[], maxDuration: number = 120) {
      const rec = recorder(pins);
      const result = withSeededRandom(seed, () => simulateBattleMulti(robots, {
        allowDraws: true,
        gameModeConfig: { maxDuration, ...rec.config },
      }));
      return { result, samples: rec.samples };
    }

    /** One-handed long-range weapon with a higher DPS than the Energy Blade offhand. */
    function createLongRangeInventory(weaponId: number) {
      const inventory = createRangedWeaponInventory(weaponId);
      return { ...inventory, weapon: { ...inventory.weapon, name: 'Long Rifle', baseDamage: 60, cooldown: 2, rangeBand: 'long' } };
    }

    // createMockRobot defaults: servoMotors 20 → base speed 11.0, balanced stance.
    const BASE_SPEED = 7.0 + 20 * 0.2;

    it('a long-range main + offhand sword robot is not a pursuer', () => {
      const hybrid = durableRobot({
        id: 1, name: 'Hybrid', loadoutType: 'dual_wield',
        mainWeapon: createLongRangeInventory(1), mainWeaponId: 1,
        offhandWeapon: createMeleeWeaponInventory(2), offhandWeaponId: 2,
      });
      const gunner = durableRobot({ id: 2, name: 'Gunner', mainWeapon: createRangedWeaponInventory(3), mainWeaponId: 3 });
      const { samples } = duel([hybrid, gunner], 520, undefined, 30);
      const hybridSamples = samples.filter(s => s.name === 'Hybrid' && Number.isFinite(s.distance));

      expect(hybridSamples.length).toBeGreaterThan(100);
      expect(hybridSamples.some(s => s.distance > 2)).toBe(true);
      // Ranged role vs ranged role: no pursuit, no burst, never above base speed.
      expect(hybridSamples.every(s => !s.exempt && s.burst === 'none')).toBe(true);
      expect(hybridSamples.every(s => s.speed <= BASE_SPEED + 1e-9)).toBe(true);
    });

    it('a Shock Maul (energy, melee band) robot gets the pursuit multiplier', () => {
      const maul = durableRobot({ id: 1, name: 'Maul', mainWeapon: createShockMaulInventory(1), mainWeaponId: 1 });
      const gunner = durableRobot({ id: 2, name: 'Gunner', mainWeapon: createRangedWeaponInventory(2), mainWeaponId: 2 });
      const { samples } = duel([maul, gunner], 520, undefined, 10);
      const pursuing = samples.filter(s => s.name === 'Maul' && s.distance > 2 && s.burst === 'none');

      expect(pursuing.length).toBeGreaterThan(10);
      for (const s of pursuing) {
        expect(s.exempt).toBe(true);
        expect(s.speed).toBeCloseTo(BASE_SPEED * 1.10, 10);
      }
    });

    it('a melee robot kited beyond its patience window commits and reaches melee reach', () => {
      // Pursuit 12 × 1.10 = 13.2 loses to kiting 13 × 1.10 = 14.3; the commit burst 12 × 1.30 = 15.6 wins.
      // The brawler is robot 1: movement is simultaneous, so robot order does not matter.
      const kiter = durableRobot({
        id: 1, name: 'Kiter', mainWeapon: createRangedWeaponInventory(1), mainWeaponId: 1,
        servoMotors: new Prisma.Decimal(30),
      });
      const brawler = durableRobot({
        id: 2, name: 'Brawler', mainWeapon: createMeleeWeaponInventory(2), mainWeaponId: 2,
        servoMotors: new Prisma.Decimal(25), combatAlgorithms: new Prisma.Decimal(25),
      });
      const { result, samples } = duel([brawler, kiter], 520, undefined, 120);
      const brawlerSamples = samples.filter(s => s.name === 'Brawler' && Number.isFinite(s.distance));
      const firstCommit = brawlerSamples.findIndex(s => s.burst === 'melee_commit');
      const patienceLimit = 15 - (25 / 50) * 5; // 12.5 s

      expect(firstCommit).toBeGreaterThanOrEqual(0);
      const commit = brawlerSamples[firstCommit];
      expect(commit.patience).toBeGreaterThanOrEqual(patienceLimit);
      expect(commit.distance).toBeGreaterThan(2);
      expect(commit.exempt).toBe(true);
      expect(commit.speed).toBeCloseTo(12 * 1.30, 10);

      // The commit lasts until the brawler is within reach and resolves an attack (distance ≤ 2)
      const commitTime = commit.tick * 0.1;
      const reach = resolvedAttacks(result.events, 'Brawler').find(e => e.timestamp >= commitTime - 1e-6);
      expect(reach).toBeDefined();
      expect(reach!.distance!).toBeLessThanOrEqual(2);
      const reachTick = Math.round(reach!.timestamp * 10);
      const beforeReach = brawlerSamples.filter(s => s.tick >= commit.tick && s.tick <= reachTick);
      expect(beforeReach.length).toBeGreaterThan(0);
      expect(beforeReach.every(s => s.burst === 'melee_commit')).toBe(true);
    });

    describe('simultaneous movement (#520 movement fix)', () => {
      interface PositionSample { name: string; x: number; y: number }

      /**
       * Every robot's tick-start position, in decision order. Math.random is pinned
       * to 0.999 so every attack misses: combat never feeds back into movement, and
       * the run only depends on the movement phase.
       */
      function trajectories(robots: RobotWithWeapons[], reverseSpawns: boolean): Map<string, Array<{ x: number; y: number }>> {
        const samples: PositionSample[] = [];
        const config: GameModeConfig = {
          maxDuration: 40,
          movementModifier: {
            modify: (intent: MovementIntent, st: RobotCombatState): MovementIntent => {
              samples.push({ name: st.robot.name, x: st.position.x, y: st.position.y });
              return intent;
            },
          },
        };
        const realCreateArena = arenaLayout.createArena;
        const arenaSpy = jest.spyOn(arenaLayout, 'createArena').mockImplementation((sizes, radius) => {
          const arena = realCreateArena(sizes, radius);
          return reverseSpawns ? { ...arena, spawnPositions: [...arena.spawnPositions].reverse() } : arena;
        });
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999);
        try {
          simulateBattleMulti(robots, { allowDraws: true, gameModeConfig: config });
        } finally {
          randomSpy.mockRestore();
          arenaSpy.mockRestore();
        }
        const byRobot = new Map<string, Array<{ x: number; y: number }>>();
        for (const { name, x, y } of samples) {
          byRobot.set(name, [...(byRobot.get(name) ?? []), { x, y }]);
        }
        return byRobot;
      }

      const brawler = () => durableRobot({
        id: 1, name: 'Brawler', mainWeapon: createMeleeWeaponInventory(1), mainWeaponId: 1,
        servoMotors: new Prisma.Decimal(25), combatAlgorithms: new Prisma.Decimal(25),
      });
      const kiter = () => durableRobot({
        id: 2, name: 'Kiter', mainWeapon: createRangedWeaponInventory(2), mainWeaponId: 2,
        servoMotors: new Prisma.Decimal(30),
      });

      it('swapping robot 1 and robot 2 gives identical movement for each robot', () => {
        // Same spawn per robot in both runs; only the order in the robot list differs.
        const forward = trajectories([brawler(), kiter()], false);
        const swapped = trajectories([kiter(), brawler()], true);

        expect(forward.get('Brawler')!.length).toBeGreaterThan(300);
        expect(swapped.get('Brawler')).toEqual(forward.get('Brawler'));
        expect(swapped.get('Kiter')).toEqual(forward.get('Kiter'));
      });

      it('swapping robot 1 and robot 2 on their own spawns gives mirrored movement', () => {
        // Default spawns: robot 1 on the left, robot 2 on the right. Distances between
        // the two robots are the same per tick whichever robot is listed first.
        const gaps = (t: Map<string, Array<{ x: number; y: number }>>): number[] =>
          t.get('Brawler')!.map((b, i) => Math.hypot(b.x - t.get('Kiter')![i].x, b.y - t.get('Kiter')![i].y));
        const forward = trajectories([brawler(), kiter()], false);
        const swapped = trajectories([kiter(), brawler()], false);
        const forwardBrawler = forward.get('Brawler')!;
        const swappedBrawler = swapped.get('Brawler')!;

        // Tick-start spawn positions mirror across the y-axis
        expect(swappedBrawler[0]).toEqual({ x: -forwardBrawler[0].x, y: forwardBrawler[0].y });
        expect(gaps(swapped).length).toBe(gaps(forward).length);
        // Path deviation hashes the absolute position, so mirrored paths are not
        // bit-identical; the gap between the robots stays close tick by tick.
        const maxGapDiff = Math.max(...gaps(forward).map((g, i) => Math.abs(g - gaps(swapped)[i])));
        expect(maxGapDiff).toBeLessThan(1);
      });
    });

    describe('patience resets on a landed hit, not on a miss', () => {
      const PINS_AT_TEN: Position[] = [{ x: -5, y: 0 }, { x: 5, y: 0 }];
      const pair = () => [
        durableRobot({ id: 1, name: 'Shooter', mainWeapon: createRangedWeaponInventory(1), mainWeaponId: 1 }),
        durableRobot({ id: 2, name: 'Target', mainWeapon: createRangedWeaponInventory(2), mainWeaponId: 2 }),
      ];

      const hits = (events: CombatEvent[]): CombatEvent[] =>
        events.filter(e => e.type === 'attack' || e.type === 'critical');

      function constantRandomDuel(value: number) {
        const rec = recorder(PINS_AT_TEN);
        const spy = jest.spyOn(Math, 'random').mockReturnValue(value);
        try {
          const result = simulateBattleMulti(pair(), { allowDraws: true, gameModeConfig: { maxDuration: 60, ...rec.config } });
          return { result, samples: rec.samples.filter(s => s.name === 'Shooter') };
        } finally {
          spy.mockRestore();
        }
      }

      it('misses never reset patience', () => {
        // Rolls of 99.9: every attack resolves as a miss (hit chance ≤ 95), no malfunction, no counter.
        const { result, samples } = constantRandomDuel(0.999);
        const attempts = resolvedAttacks(result.events, 'Shooter');

        expect(attempts.length).toBeGreaterThan(10);
        expect(attempts.every(e => e.type === 'miss')).toBe(true);
        for (let i = 1; i < samples.length; i++) {
          expect(samples[i].patience).toBeGreaterThan(samples[i - 1].patience);
        }
        expect(result.finalStates![0].patienceTimer).toBeGreaterThan(55);
      });

      it('every landed hit resets patience to 0', () => {
        // Rolls of 50: reliable weapon, every attack hits, no crit, no counter.
        const { result, samples } = constantRandomDuel(0.5);
        const hitTicks = new Set(hits(resolvedAttacks(result.events, 'Shooter')).map(e => e.timestamp));
        const drops = samples.filter((s, i) => i > 0 && s.patience < samples[i - 1].patience);

        expect(hitTicks.size).toBeGreaterThan(10);
        expect(drops.every(s => s.patience === 0)).toBe(true);
        // Every hit except possibly one on the final tick is followed by a reset sample
        expect(drops.length).toBeGreaterThanOrEqual(hitTicks.size - 1);
        expect(drops.length).toBeLessThanOrEqual(hitTicks.size);
      });
    });
  });

  // Validates: Requirement 14.1 (function signature preserved)
  describe('function signature compatibility', () => {
    it('should accept (robot1, robot2) without isTournament', () => {
      const robot1 = createMockRobot({ id: 1, name: 'A' });
      const robot2 = createMockRobot({ id: 2, name: 'B' });

      const result = simulateBattle(robot1, robot2);
      expect(result).toBeDefined();
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('should accept (robot1, robot2, true) for tournament mode', () => {
      const robot1 = createMockRobot({ id: 1, name: 'A' });
      const robot2 = createMockRobot({ id: 2, name: 'B' });

      const result = simulateBattle(robot1, robot2, true);
      expect(result).toBeDefined();
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('should accept (robot1, robot2, false) for non-tournament mode', () => {
      const robot1 = createMockRobot({ id: 1, name: 'A' });
      const robot2 = createMockRobot({ id: 2, name: 'B' });

      const result = simulateBattle(robot1, robot2, false);
      expect(result).toBeDefined();
      expect(result.events.length).toBeGreaterThan(0);
    });
  });
});
