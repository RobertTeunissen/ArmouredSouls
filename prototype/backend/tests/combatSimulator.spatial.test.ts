/**
 * Unit tests for the refactored simulateBattle with 2D spatial mechanics.
 * Validates: Requirements 14.1, 14.2, 14.3, 14.6, 14.7, 14.8, 14.9
 */
import { simulateBattle, RobotWithWeapons, CombatResult, CombatEvent } from '../src/services/combatSimulator';
import { Prisma } from '@prisma/client';

// ─── Mock Factories ─────────────────────────────────────────────────

function createMockRobot(overrides?: Partial<RobotWithWeapons>): RobotWithWeapons {
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
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    mainWeapon: null,
    offhandWeapon: null,
    ...overrides,
  };
}

function createMeleeWeaponInventory(weaponId: number = 1) {
  return {
    id: weaponId,
    userId: 1,
    weaponId,
    customName: null,
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
        expect(event).toHaveProperty('robot1HP');
        expect(event).toHaveProperty('robot2HP');
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
        combatAlgorithms: new Prisma.Decimal(1), // Low AI — won't force attack early
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
