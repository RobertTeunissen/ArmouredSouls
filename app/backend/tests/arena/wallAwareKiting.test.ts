/**
 * Season 2 round 3 (A-late) and #538: wall-aware kiting path.
 *
 * Near the arena wall a kiter picks the step that ends farthest from its
 * chaser's projected position, keeping its direction of travel among near-best
 * headings, instead of retreating radially into the wall and stalling (or
 * sliding back and forth along it, #538).
 */
import * as fc from 'fast-check';
import { planWallAwareKitingStep, WallAwareKitingInput } from '../../src/services/arena/wallAwareKiting';
import { applyMovement, calculateMovementIntent, RANGE_BAND_MIDPOINTS } from '../../src/services/arena/movementAI';
import { calculateEffectiveSpeed } from '../../src/services/arena/servoStrain';
import type { ArenaConfig, RobotCombatState } from '../../src/services/arena/types';
import { SIMULATION_TICK } from '../../src/services/battle/combat-simulator/combatTypes';

const ARENA: ArenaConfig = { radius: 16, center: { x: 0, y: 0 }, spawnPositions: [] };
const EPS = 1e-9;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

function makeState(name: string, servo: number, weapon: Record<string, unknown>, x: number, y: number): RobotCombatState {
  return {
    robot: {
      name,
      loadoutType: 'single',
      stance: 'balanced',
      mainWeapon: { weapon: { handsRequired: 'one', baseDamage: 20, cooldown: 2, ...weapon } },
      offhandWeapon: null,
      threatAnalysis: 15,
      combatAlgorithms: 25,
    } as unknown as RobotCombatState['robot'],
    currentHP: 100, maxHP: 100, currentShield: 0, maxShield: 0,
    lastAttackTime: 0, lastOffhandAttackTime: 0, attackCooldown: 2, offhandCooldown: 0,
    totalDamageDealt: 0, totalDamageTaken: 0,
    numServoMotors: servo, numGyroStabilizers: 1, numThreatAnalysis: 15, numAdaptiveAI: 1,
    numLogicCores: 1, numHydraulicSystems: 1, numPowerCore: 1,
    position: { x, y }, facingDirection: 0, velocity: { x: 0, y: 0 },
    movementSpeed: 0, effectiveMovementSpeed: 0, servoStrain: 0, sustainedMovementTime: 0,
    isUsingClosingBonus: false,
    movementIntent: { targetPosition: { x, y }, strategy: 'direct_path', preferredRange: 'melee', stanceSpeedModifier: 0 },
    currentTarget: null, patienceTimer: 0, combatAlgorithmScore: 0.5, lastMeleeHitTakenAt: null,
    disengageBurstUntil: 0, disengageReadyAt: 0, disengageScheduledAt: null, speedBurst: 'none', movementMode: 'normal',
    adaptationHitBonus: 0, adaptationDamageBonus: 0, hitsTaken: 0, missCount: 0,
    pressureThreshold: 30, isUnderPressure: false, teamIndex: 0, isAlive: true, targetLockTimer: 0,
  };
}

/** Set a robot's speed and mode from the real speed model (tick-start distance). */
function setSpeed(state: RobotCombatState, role: 'melee' | 'ranged', midpoint: number, opponentMidpoint: number, distance: number): void {
  const result = calculateEffectiveSpeed({
    servoMotors: state.numServoMotors,
    servoStrain: 0,
    sustainedMovementTime: 0,
    isUsingClosingBonus: false,
    stance: 'balanced',
    role,
    engagementRangeMidpoint: midpoint,
    speedBurst: 'none',
    distanceToTarget: distance,
    currentSpeedRatio: 0,
    opponentEngagementMidpoint: opponentMidpoint,
  }, role === 'melee' ? 'ranged' : 'melee');
  state.effectiveMovementSpeed = result.effectiveSpeed;
  state.movementMode = result.mode;
}

const baseInput = (overrides: Partial<WallAwareKitingInput> = {}): WallAwareKitingInput => ({
  position: { x: 16, y: 0 },
  velocity: { x: 0, y: -14 },
  chaserPosition: { x: 12, y: 0 },
  chaserVelocity: { x: 13, y: 0 },
  stepLength: 1.4,
  arena: ARENA,
  deltaTime: SIMULATION_TICK,
  ...overrides,
});

describe('wall-aware kiting path (Season 2 round 3, #538)', () => {
  it('a kiter on the wall with the chaser straight behind keeps its clockwise direction of travel', () => {
    const end = planWallAwareKitingStep(baseInput());
    expect(end.y).toBeLessThan(-1); // clockwise, along the wall
    expect(dist(end, ARENA.center)).toBeLessThanOrEqual(ARENA.radius + EPS);
    expect(dist(end, { x: 16, y: 0 })).toBeLessThanOrEqual(1.4 + EPS);
  });

  it('and keeps a counter-clockwise direction the same way', () => {
    const end = planWallAwareKitingStep(baseInput({ velocity: { x: 0, y: 14 } }));
    expect(end.y).toBeGreaterThan(1);
  });

  it('circles away from a chaser that comes along the wall, even against its direction of travel', () => {
    // Chaser on the wall just clockwise of the kiter, kiter moving clockwise towards it
    const chaserPosition = { x: 16 * Math.cos(-0.3), y: 16 * Math.sin(-0.3) };
    const end = planWallAwareKitingStep(baseInput({ chaserPosition, chaserVelocity: { x: 0, y: 0 } }));
    expect(end.y).toBeGreaterThan(0);
    expect(dist(end, chaserPosition)).toBeGreaterThan(dist({ x: 16, y: 0 }, chaserPosition));
  });

  /**
   * Long-range kiter (Servo 30, kiting 1.10× = 14.3 u/s) on the wall, melee chaser
   * (Servo 25, pursuit 1.15× = 13.8 u/s) radially inward; the kiter was moving
   * clockwise. Both decide from the tick-start snapshot, then both move. Returns
   * the sign of each kiter step around the centre (−1 clockwise, +1 counter-clockwise).
   */
  function wallChase(chaserCombatAlgorithms: number): { turns: number[]; wallTicks: number } {
    const kiter = makeState('Kiter', 30, { weaponType: 'energy', rangeBand: 'long' }, 16, 0);
    const chaser = makeState('Chaser', 25, { weaponType: 'melee', rangeBand: 'melee' }, 11, 0);
    (chaser.robot as unknown as { combatAlgorithms: number }).combatAlgorithms = chaserCombatAlgorithms;
    kiter.teamIndex = 1;
    kiter.velocity = { x: 0, y: -14.3 };
    const turns: number[] = [];
    let wallTicks = 0;

    for (let tick = 0; tick < 50; tick++) {
      // Decide from the tick-start snapshot
      const gap = dist(kiter.position, chaser.position);
      setSpeed(kiter, 'ranged', RANGE_BAND_MIDPOINTS.long, RANGE_BAND_MIDPOINTS.melee, gap);
      setSpeed(chaser, 'melee', RANGE_BAND_MIDPOINTS.melee, RANGE_BAND_MIDPOINTS.long, gap);
      expect(kiter.movementMode).toBe('kiting');
      const kiterIntent = calculateMovementIntent(kiter, [chaser], ARENA, SIMULATION_TICK);
      const chaserIntent = calculateMovementIntent(chaser, [kiter], ARENA, SIMULATION_TICK);
      const kiterNext = applyMovement(kiter, kiterIntent, ARENA, SIMULATION_TICK, chaser.position);
      const chaserNext = applyMovement(chaser, chaserIntent, ARENA, SIMULATION_TICK, kiter.position);

      // Then both move
      const step = kiter.effectiveMovementSpeed * SIMULATION_TICK;
      const disp = { x: kiterNext.x - kiter.position.x, y: kiterNext.y - kiter.position.y };
      const displacement = Math.hypot(disp.x, disp.y);
      expect(displacement).toBeLessThanOrEqual(step + EPS);
      expect(displacement).toBeGreaterThanOrEqual(0.9 * step);
      expect(dist(kiterNext, ARENA.center)).toBeLessThanOrEqual(ARENA.radius + EPS);
      turns.push(Math.sign(kiter.position.x * disp.y - kiter.position.y * disp.x));
      if (dist(kiter.position, ARENA.center) > ARENA.radius - 0.5) wallTicks++;

      kiter.velocity = { x: disp.x / SIMULATION_TICK, y: disp.y / SIMULATION_TICK };
      chaser.velocity = { x: (chaserNext.x - chaser.position.x) / SIMULATION_TICK, y: (chaserNext.y - chaser.position.y) / SIMULATION_TICK };
      kiter.position = kiterNext;
      chaser.position = chaserNext;
    }
    return { turns, wallTicks };
  }

  it('a pursued kiter circles along the wall for 50 ticks without reversing, stalling or leaving the arena', () => {
    // Combat Algorithms 1: the chaser does not lead the kiter, so it stays behind
    const { turns, wallTicks } = wallChase(1);
    expect(turns.every((t) => t === -1)).toBe(true);
    expect(wallTicks).toBeGreaterThan(40);
  });

  it('turns at most once when a leading chaser cuts ahead, then keeps circling (no dither)', () => {
    // Combat Algorithms 25: the chaser leads the kiter's motion and gets ahead of it on the
    // first tick, so the kiter circles the other way, and keeps that direction.
    const { turns, wallTicks } = wallChase(25);
    const changes = turns.filter((t, i) => i > 0 && t !== turns[i - 1]).length;
    expect(turns.every((t) => t !== 0)).toBe(true);
    expect(changes).toBeLessThanOrEqual(1);
    expect(wallTicks).toBeGreaterThan(40);
  });

  it('always ends inside the arena and within one step (property)', () => {
    const arbPointInArena = fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }))
      .map(([r, a]) => ({ x: 16 * Math.sqrt(r) * Math.cos(a), y: 16 * Math.sqrt(r) * Math.sin(a) }));
    const arbVelocity = fc.record({
      x: fc.double({ min: -20, max: 20, noNaN: true, noDefaultInfinity: true }),
      y: fc.double({ min: -20, max: 20, noNaN: true, noDefaultInfinity: true }),
    });
    fc.assert(
      fc.property(arbPointInArena, arbVelocity, arbPointInArena, arbVelocity, fc.double({ min: 0, max: 3, noNaN: true }),
        (position, velocity, chaserPosition, chaserVelocity, stepLength) => {
          const end = planWallAwareKitingStep({ position, velocity, chaserPosition, chaserVelocity, stepLength, arena: ARENA, deltaTime: SIMULATION_TICK });
          expect(dist(end, ARENA.center)).toBeLessThanOrEqual(ARENA.radius + EPS);
          expect(dist(end, position)).toBeLessThanOrEqual(stepLength + EPS);
        }),
      { numRuns: 1000 },
    );
  });

  it('is deterministic', () => {
    const input = baseInput({ position: { x: 11, y: 10 }, velocity: { x: 3, y: 9 }, chaserPosition: { x: 6, y: 7 }, chaserVelocity: { x: 8, y: 1 } });
    expect(planWallAwareKitingStep(input)).toEqual(planWallAwareKitingStep({ ...input }));
  });

  it('mirrors its output for a mirrored input (x → −x) without exact ties', () => {
    const mirror = (p: { x: number; y: number }): { x: number; y: number } => ({ x: -p.x, y: p.y });
    const cases: Array<Partial<WallAwareKitingInput>> = [
      { position: { x: 11, y: 10 }, velocity: { x: 3, y: 9 }, chaserPosition: { x: 6, y: 7 }, chaserVelocity: { x: 8, y: 1 } },
      { position: { x: 15.2, y: -4.1 }, velocity: { x: -2, y: -13 }, chaserPosition: { x: 12.5, y: -2 }, chaserVelocity: { x: 10, y: -5 } },
      { position: { x: 3, y: 15.5 }, velocity: { x: 12, y: 1 }, chaserPosition: { x: 1, y: 12 }, chaserVelocity: { x: 2, y: 13 } },
    ];
    for (const c of cases) {
      const input = baseInput(c);
      const end = planWallAwareKitingStep(input);
      const mirrored = planWallAwareKitingStep({
        ...input,
        position: mirror(input.position),
        velocity: mirror(input.velocity),
        chaserPosition: mirror(input.chaserPosition),
        chaserVelocity: mirror(input.chaserVelocity),
      });
      expect(mirrored.x).toBeCloseTo(-end.x, 9);
      expect(mirrored.y).toBeCloseTo(end.y, 9);
    }
  });
});
