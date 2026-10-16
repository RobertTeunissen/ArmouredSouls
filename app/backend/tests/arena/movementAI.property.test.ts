import * as fc from 'fast-check';
import {
  applyMovement,
  calculateMovementIntent,
  getPatienceLimit,
  getPreferredRange,
} from '../../src/services/arena/movementAI';
import { euclideanDistance, Position } from '../../src/services/arena/vector2d';
import { ArenaConfig, MovementIntent, RobotCombatState, RangeBand } from '../../src/services/arena/types';
import { BattleErrorCode } from '../../src/errors/battleErrors';

/**
 * Property-based tests for movementAI module.
 * Uses fast-check to verify universal properties across random inputs.
 */

// ─── Arbitraries ────────────────────────────────────────────────────

const arbPosition = (): fc.Arbitrary<Position> =>
  fc.record({
    x: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
    y: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  });

const arbArenaRadius = (): fc.Arbitrary<number> =>
  fc.double({ min: 5, max: 100, noNaN: true, noDefaultInfinity: true });

const arbSpeed = (): fc.Arbitrary<number> =>
  fc.double({ min: 0.1, max: 30, noNaN: true, noDefaultInfinity: true });

const arbDeltaTime = (): fc.Arbitrary<number> =>
  fc.double({ min: 0.01, max: 1.0, noNaN: true, noDefaultInfinity: true });

const arbCombatAlgorithms = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 50 });

const arbRangeBand = (): fc.Arbitrary<RangeBand> =>
  fc.constantFrom('melee' as const, 'short' as const, 'mid' as const, 'long' as const);

const arbStance = (): fc.Arbitrary<string> =>
  fc.constantFrom('defensive', 'offensive', 'balanced');

const arbLoadoutType = (): fc.Arbitrary<string> =>
  fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield');

function makeArena(radius: number): ArenaConfig {
  return {
    radius,
    center: { x: 0, y: 0 },
    spawnPositions: [{ x: -radius + 2, y: 0 }, { x: radius - 2, y: 0 }],
  };
}

function makeIntent(overrides: Partial<MovementIntent> = {}): MovementIntent {
  return {
    targetPosition: { x: 5, y: 5 },
    strategy: 'direct_path',
    preferredRange: 'short',
    stanceSpeedModifier: 0,
    ...overrides,
  };
}

/** Minimal weapon mock */
function makeWeapon(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Laser Pistol',
    weaponType: 'energy',
    handsRequired: 'one',
    baseDamage: 10,
    cooldown: 2,
    rangeBand: 'mid',
    ...overrides,
  };
}

/** Helper to build a minimal RobotCombatState for testing */
function makeState(overrides: Partial<RobotCombatState> = {}): RobotCombatState {
  return {
    robot: {
      loadoutType: 'single',
      stance: 'balanced',
      mainWeapon: { weapon: makeWeapon() } as any,
      offhandWeapon: null,
      threatAnalysis: 1,
      combatAlgorithms: 25,
    } as any,
    currentHP: 100,
    maxHP: 100,
    currentShield: 50,
    maxShield: 50,
    lastAttackTime: 0,
    lastOffhandAttackTime: 0,
    attackCooldown: 2,
    offhandCooldown: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    numServoMotors: 1,
    numGyroStabilizers: 1,
    numThreatAnalysis: 1,
    numAdaptiveAI: 1,
    numLogicCores: 1,
    numHydraulicSystems: 1,
    numPowerCore: 1,
    position: { x: 0, y: 0 },
    facingDirection: 0,
    velocity: { x: 0, y: 0 },
    movementSpeed: 10,
    effectiveMovementSpeed: 10,
    servoStrain: 0,
    sustainedMovementTime: 0,
    isUsingClosingBonus: false,
    movementIntent: makeIntent(),
    currentTarget: null,
    patienceTimer: 0,
    combatAlgorithmScore: 0.5,
    lastMeleeHitTakenAt: null,
    disengageBurstUntil: 0,
    disengageReadyAt: 0,
    speedBurst: 'none',
    adaptationHitBonus: 0,
    adaptationDamageBonus: 0,
    hitsTaken: 0,
    missCount: 0,
    pressureThreshold: 30,
    isUnderPressure: false,
    teamIndex: 0,
    isAlive: true,
    targetLockTimer: 0,
    ...overrides,
  };
}

describe('movementAI property tests', () => {
  /**
   * Property 16: applyMovement always produces a position inside the arena
   * boundary for any input.
   * **Validates: Requirements 1.7, 5.2**
   */
  describe('Property 16: applyMovement always inside arena', () => {
    it('should return a position with distance from center ≤ radius for any input', () => {
      fc.assert(
        fc.property(
          arbPosition(),
          arbPosition(),
          arbArenaRadius(),
          arbSpeed(),
          arbDeltaTime(),
          (robotPos, targetPos, radius, speed, dt) => {
            const arena = makeArena(radius);
            const state = makeState({
              position: robotPos,
              effectiveMovementSpeed: speed,
            });
            const intent = makeIntent({ targetPosition: targetPos });

            const newPos = applyMovement(state, intent, arena, dt);
            const distFromCenter = euclideanDistance(newPos, arena.center);

            expect(distFromCenter).toBeLessThanOrEqual(radius + 1e-9);
          },
        ),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 16b (#520): wall-aware retreat. A robot whose step would leave the
   * arena slides along the wall: it stays inside, never moves farther than
   * speed × dt, is deterministic, makes tangential progress on a purely radial
   * retreat, and slides away from the threat.
   */
  describe('Property 16b: wall-aware retreat slides along the wall', () => {
    const arbAngle = (): fc.Arbitrary<number> =>
      fc.double({ min: -Math.PI, max: Math.PI, noNaN: true, noDefaultInfinity: true });
    const arbWallRadius = (): fc.Arbitrary<number> =>
      fc.double({ min: 5, max: 50, noNaN: true, noDefaultInfinity: true });
    const arbFraction = (): fc.Arbitrary<number> =>
      fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });
    const arbWallSpeed = (): fc.Arbitrary<number> =>
      fc.double({ min: 0.5, max: 20, noNaN: true, noDefaultInfinity: true });
    const arbTick = (): fc.Arbitrary<number> =>
      fc.double({ min: 0.05, max: 0.5, noNaN: true, noDefaultInfinity: true });

    const onWall = (radius: number, angle: number): Position => ({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
    /** z-component of pos × next: > 0 counter-clockwise, < 0 clockwise */
    const cross = (a: Position, b: Position): number => a.x * b.y - a.y * b.x;

    it('stays inside the arena and never moves farther than speed × dt', () => {
      fc.assert(
        fc.property(
          arbWallRadius(), arbAngle(), arbFraction(), arbPosition(), arbWallSpeed(), arbTick(),
          fc.option(arbPosition(), { nil: undefined }),
          (radius, angle, fraction, target, speed, dt, threat) => {
            const arena = makeArena(radius);
            const position = onWall(radius * fraction, angle);
            const state = makeState({ position, effectiveMovementSpeed: speed });
            const newPos = applyMovement(state, makeIntent({ targetPosition: target }), arena, dt, threat);

            expect(euclideanDistance(newPos, arena.center)).toBeLessThanOrEqual(radius + 1e-9);
            expect(euclideanDistance(newPos, position)).toBeLessThanOrEqual(speed * dt + 1e-9);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('is deterministic', () => {
      fc.assert(
        fc.property(
          arbWallRadius(), arbAngle(), arbFraction(), arbPosition(), arbWallSpeed(), arbTick(), arbPosition(),
          (radius, angle, fraction, target, speed, dt, threat) => {
            const arena = makeArena(radius);
            const position = onWall(radius * fraction, angle);
            const intent = makeIntent({ targetPosition: target });
            const a = applyMovement(makeState({ position, effectiveMovementSpeed: speed }), intent, arena, dt, threat);
            const b = applyMovement(makeState({ position, effectiveMovementSpeed: speed }), intent, arena, dt, threat);
            expect(a).toEqual(b);
          },
        ),
        { numRuns: 300 },
      );
    });

    it('makes tangential progress on a purely radial retreat at the wall', () => {
      fc.assert(
        fc.property(
          arbWallRadius(), arbAngle(), arbWallSpeed(), arbTick(),
          fc.double({ min: 1, max: 20, noNaN: true, noDefaultInfinity: true }),
          (radius, angle, speed, dt, overshoot) => {
            const arena = makeArena(radius);
            const position = onWall(radius, angle);
            const target = onWall(radius + overshoot, angle); // straight out through the wall
            const state = makeState({ position, effectiveMovementSpeed: speed });
            const newPos = applyMovement(state, makeIntent({ targetPosition: target }), arena, dt);

            expect(euclideanDistance(newPos, position)).toBeGreaterThan(0);
            expect(Math.abs(cross(position, newPos))).toBeGreaterThan(0);
            expect(euclideanDistance(newPos, arena.center)).toBeLessThanOrEqual(radius + 1e-9);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('slides away from the threat on a purely radial retreat (no threat → counter-clockwise)', () => {
      fc.assert(
        fc.property(
          arbWallRadius(), arbAngle(), arbWallSpeed(), arbTick(),
          fc.double({ min: 0.1, max: 1.2, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0.2, max: 0.9, noNaN: true, noDefaultInfinity: true }),
          (radius, angle, speed, dt, offset, threatFraction) => {
            const arena = makeArena(radius);
            const position = onWall(radius, angle);
            const target = onWall(radius + 5, angle);
            const intent = makeIntent({ targetPosition: target });
            const state = makeState({ position, effectiveMovementSpeed: speed });

            // Threat on the counter-clockwise side → slide clockwise
            const ccwThreat = onWall(radius * threatFraction, angle + offset);
            expect(cross(position, applyMovement(state, intent, arena, dt, ccwThreat))).toBeLessThan(0);

            // Threat on the clockwise side → slide counter-clockwise
            const cwThreat = onWall(radius * threatFraction, angle - offset);
            expect(cross(position, applyMovement(state, intent, arena, dt, cwThreat))).toBeGreaterThan(0);

            // No threat → counter-clockwise
            expect(cross(position, applyMovement(state, intent, arena, dt))).toBeGreaterThan(0);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('keeps the plain clamp for a robot at the arena centre', () => {
      const arena = makeArena(5);
      const state = makeState({ position: { x: 0, y: 0 }, effectiveMovementSpeed: 100 });
      const newPos = applyMovement(state, makeIntent({ targetPosition: { x: 20, y: 0 } }), arena, 0.1);
      expect(newPos.x).toBeCloseTo(5, 10);
      expect(newPos.y).toBeCloseTo(0, 10);
    });
  });

  /**
   * Property 17: Patience timer limit is always between 10 and 15 seconds
   * for any combatAlgorithms value (1–50).
   * **Validates: Requirement 5.7**
   */
  describe('Property 17: Patience timer limit in [10, 15]', () => {
    it('should return a value in [10, 15] for any combatAlgorithms in [1, 50]', () => {
      fc.assert(
        fc.property(arbCombatAlgorithms(), (ca) => {
          const score = ca / 50; // combatAlgorithmScore
          const limit = getPatienceLimit(score);

          expect(limit).toBeGreaterThanOrEqual(10);
          expect(limit).toBeLessThanOrEqual(15);
        }),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 18: getPreferredRange always returns a valid RangeBand
   * for any weapon configuration.
   * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
   */
  describe('Property 18: getPreferredRange returns valid RangeBand', () => {
    const validRangeBands: RangeBand[] = ['melee', 'short', 'mid', 'long'];

    it('should return a valid RangeBand for single/weapon_shield/two_handed loadouts', () => {
      const weaponTypes = ['melee', 'energy', 'ballistic', 'shield'];
      const hands = ['one', 'two', 'shield'];
      const names = [
        'Combat Knife', 'Laser Pistol', 'Sniper Rifle',
        'Railgun', 'Ion Beam', 'Shotgun', 'Light Shield',
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...weaponTypes),
          fc.constantFrom(...hands),
          fc.constantFrom(...names),
          fc.constantFrom('single', 'weapon_shield', 'two_handed'),
          (wType, wHands, wName, loadout) => {
            const state = makeState({
              robot: {
                loadoutType: loadout,
                stance: 'balanced',
                mainWeapon: {
                  weapon: makeWeapon({
                    weaponType: wType,
                    handsRequired: wHands,
                    name: wName,
                  }),
                } as any,
                offhandWeapon: null,
              } as any,
              combatAlgorithmScore: 0.5,
            });

            const range = getPreferredRange(state);
            expect(validRangeBands).toContain(range);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('should return a valid RangeBand for dual_wield loadouts with mixed weapons', () => {
      const weaponConfigs = [
        { weaponType: 'melee', handsRequired: 'one', name: 'Combat Knife', baseDamage: 15, cooldown: 1, rangeBand: 'melee' },
        { weaponType: 'energy', handsRequired: 'one', name: 'Laser Pistol', baseDamage: 10, cooldown: 2, rangeBand: 'mid' },
        { weaponType: 'ballistic', handsRequired: 'one', name: 'Machine Pistol', baseDamage: 8, cooldown: 1, rangeBand: 'short' },
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...weaponConfigs),
          fc.constantFrom(...weaponConfigs),
          fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
          (mainW, offhandW, score) => {
            const state = makeState({
              robot: {
                loadoutType: 'dual_wield',
                stance: 'balanced',
                mainWeapon: { weapon: makeWeapon(mainW) } as any,
                offhandWeapon: { weapon: makeWeapon(offhandW) } as any,
              } as any,
              combatAlgorithmScore: score,
            });

            const range = getPreferredRange(state);
            expect(validRangeBands).toContain(range);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('throws ROBOT_NOT_BATTLE_READY when no main weapon is equipped', () => {
      const state = makeState({
        robot: {
          loadoutType: 'single',
          stance: 'balanced',
          mainWeapon: null,
          offhandWeapon: null,
        } as any,
      });

      expect(() => getPreferredRange(state)).toThrow(
        expect.objectContaining({ code: BattleErrorCode.ROBOT_NOT_BATTLE_READY }),
      );
    });

    it('should target the current opponent during the melee final approach', () => {
      const meleeState = makeState({
        robot: {
          loadoutType: 'single',
          stance: 'balanced',
          mainWeapon: { weapon: makeWeapon({ weaponType: 'melee', rangeBand: 'melee' }) } as any,
          offhandWeapon: null,
          threatAnalysis: 50,
          combatAlgorithms: 50,
        } as any,
        position: { x: 0, y: 0 },
        combatAlgorithmScore: 1,
      });
      const movingMeleeOpponent = makeState({
        robot: {
          loadoutType: 'single',
          stance: 'balanced',
          mainWeapon: { weapon: makeWeapon({ weaponType: 'melee', rangeBand: 'melee' }) } as any,
          offhandWeapon: null,
        } as any,
        position: { x: 0, y: 3.1 },
        velocity: { x: 12, y: 0 },
      });

      const intent = calculateMovementIntent(
        meleeState,
        [movingMeleeOpponent],
        makeArena(16),
      );

      expect(intent.preferredRange).toBe('melee');
      expect(euclideanDistance(intent.targetPosition, movingMeleeOpponent.position))
        .toBeLessThanOrEqual(2);
    });

    it('should keep an in-range melee robot inside attack range despite prediction and bias', () => {
      const meleeState = makeState({
        robot: {
          loadoutType: 'single',
          stance: 'balanced',
          mainWeapon: { weapon: makeWeapon({ weaponType: 'melee', rangeBand: 'melee' }) } as any,
          offhandWeapon: null,
          threatAnalysis: 50,
          combatAlgorithms: 50,
        } as any,
        position: { x: 0, y: 0 },
        effectiveMovementSpeed: 20,
        combatAlgorithmScore: 1,
      });
      const inRangeMeleeOpponent = makeState({
        robot: {
          loadoutType: 'single',
          stance: 'balanced',
          mainWeapon: { weapon: makeWeapon({ weaponType: 'melee', rangeBand: 'melee' }) } as any,
          offhandWeapon: null,
        } as any,
        position: { x: 0, y: 1.5 },
        velocity: { x: 12, y: 0 },
        effectiveMovementSpeed: 10,
      });

      const intent = calculateMovementIntent(
        meleeState,
        [inRangeMeleeOpponent],
        makeArena(16),
      );

      expect(euclideanDistance(intent.targetPosition, inRangeMeleeOpponent.position))
        .toBeLessThanOrEqual(2);
    });
  });

  /**
   * #467: in a melee mirror match, leading the opponent's tangential velocity
   * made both robots circle at ~8 units for the whole battle (time-limit draw)
   * without ever entering the ≤4-unit final approach.
   */
  describe('melee mirror prediction (#467)', () => {
    const meleeWeapon = () => ({ weapon: makeWeapon({ weaponType: 'melee', rangeBand: 'melee' }) }) as any;

    /** Angle in degrees between robot→intent and robot→opponent. */
    function headingErrorDeg(robot: Position, intentTarget: Position, opponent: Position): number {
      const a = Math.atan2(intentTarget.y - robot.y, intentTarget.x - robot.x);
      const b = Math.atan2(opponent.y - robot.y, opponent.x - robot.x);
      const diff = Math.abs(a - b) % (2 * Math.PI);
      return (Math.min(diff, 2 * Math.PI - diff) * 180) / Math.PI;
    }

    function chaser() {
      // CA 50 = full prediction weight; TA 1 keeps avoidance/flank below their
      // 0.01 activation threshold, so only deviation (≤1.5° for melee) remains.
      return makeState({
        robot: {
          loadoutType: 'single',
          stance: 'balanced',
          mainWeapon: meleeWeapon(),
          offhandWeapon: null,
          threatAnalysis: 1,
          combatAlgorithms: 50,
        } as any,
        position: { x: 0, y: 0 },
        combatAlgorithmScore: 1,
      });
    }

    it('should head straight at a circling melee opponent outside the final approach', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 4.5, max: 14, noNaN: true }),
          fc.double({ min: 4, max: 15, noNaN: true }),
          fc.constantFrom(1, -1),
          (distance, speed, direction) => {
            const robot = chaser();
            const opponent = makeState({
              robot: { loadoutType: 'single', stance: 'balanced', mainWeapon: meleeWeapon(), offhandWeapon: null } as any,
              position: { x: 0, y: distance },
              velocity: { x: speed * direction, y: 0 }, // purely tangential
            });

            const intent = calculateMovementIntent(robot, [opponent], makeArena(16));

            expect(intent.preferredRange).toBe('melee');
            expect(headingErrorDeg(robot.position, intent.targetPosition, opponent.position)).toBeLessThan(5);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('should still lead a moving ranged opponent', () => {
      const robot = chaser();
      const rangedOpponent = makeState({
        robot: {
          loadoutType: 'single',
          stance: 'balanced',
          mainWeapon: { weapon: makeWeapon({ weaponType: 'ballistic', rangeBand: 'mid' }) } as any,
          offhandWeapon: null,
        } as any,
        position: { x: 0, y: 8 },
        velocity: { x: 12, y: 0 },
      });

      const intent = calculateMovementIntent(robot, [rangedOpponent], makeArena(16));

      expect(intent.preferredRange).toBe('melee');
      expect(headingErrorDeg(robot.position, intent.targetPosition, rangedOpponent.position)).toBeGreaterThan(20);
    });
  });
});
