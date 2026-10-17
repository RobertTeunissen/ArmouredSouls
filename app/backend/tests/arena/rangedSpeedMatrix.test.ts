/**
 * Season 2 round 3 (A): ranged vs ranged kiting and pursuit.
 *
 * A ranged robot whose opponent prefers a closer range kites at 1.10×
 * (strain-free) while inside its own engagement midpoint; the closer-preferring
 * ranged robot follows at 1.05× (strain-free) while beyond its own midpoint.
 *
 * Each case runs a straight-line chase tick by tick, simultaneously (both robots
 * decide from the tick-start snapshot, then both move), following
 * pursuitSpeedMatrix.test.ts. The short-range pursuer uses the real movement AI
 * (calculateMovementIntent + applyMovement) and the real speed model; the
 * long-range kiter flees straight along +x at its engine speed. A chase ends
 * when the gap reaches the kiter's midpoint (≥ 16, the kiter keeps its
 * distance) or the pursuer's midpoint (≤ 4.5, the pursuer holds it).
 *
 * Rates (balanced stance, base speed 7 + 0.2 × Servo): the gap opens at
 * 0.35 + 0.22 × kiter Servo − 0.21 × pursuer Servo u/s. At equal Servo 25 the
 * kiter gains 0.60 u/s; the pursuer holds the kiter only above
 * pursuer Servo ≈ 1.0476 × kiter Servo + 1.67.
 */
import { applyMovement, calculateMovementIntent, RANGE_BAND_MIDPOINTS } from '../../src/services/arena/movementAI';
import { calculateEffectiveSpeed, ServoStrainState } from '../../src/services/arena/servoStrain';
import type { ArenaConfig, RobotCombatState } from '../../src/services/arena/types';
import { SIMULATION_TICK } from '../../src/services/battle/combat-simulator/combatTypes';

const ARENA: ArenaConfig = { radius: 10000, center: { x: 0, y: 0 }, spawnPositions: [] };
const PURSUER_MIDPOINT = RANGE_BAND_MIDPOINTS.short; // 4.5
const KITER_MIDPOINT = RANGE_BAND_MIDPOINTS.long; // 16
const START_GAP = 10;
const MAX_TICKS = 3000;

function makeState(name: string, servo: number, weapon: Record<string, unknown>, x: number): RobotCombatState {
  return {
    robot: {
      name,
      loadoutType: 'single',
      stance: 'balanced',
      mainWeapon: { weapon: { handsRequired: 'one', baseDamage: 20, cooldown: 2, ...weapon } },
      offhandWeapon: null,
      threatAnalysis: 1,
      combatAlgorithms: 50,
    } as unknown as RobotCombatState['robot'],
    currentHP: 100, maxHP: 100, currentShield: 0, maxShield: 0,
    lastAttackTime: 0, lastOffhandAttackTime: 0, attackCooldown: 2, offhandCooldown: 0,
    totalDamageDealt: 0, totalDamageTaken: 0,
    numServoMotors: servo, numGyroStabilizers: 1, numThreatAnalysis: 1, numAdaptiveAI: 1,
    numLogicCores: 1, numHydraulicSystems: 1, numPowerCore: 1,
    position: { x, y: 0 }, facingDirection: 0, velocity: { x: 0, y: 0 },
    movementSpeed: 0, effectiveMovementSpeed: 0, servoStrain: 0, sustainedMovementTime: 0,
    isUsingClosingBonus: false,
    movementIntent: { targetPosition: { x, y: 0 }, strategy: 'calculated_path', preferredRange: 'short', stanceSpeedModifier: 0 },
    currentTarget: null, patienceTimer: 0, combatAlgorithmScore: 1, lastMeleeHitTakenAt: null,
    disengageBurstUntil: 0, disengageReadyAt: 0, disengageScheduledAt: null, speedBurst: 'none', movementMode: 'normal',
    adaptationHitBonus: 0, adaptationDamageBonus: 0, hitsTaken: 0, missCount: 0,
    pressureThreshold: 30, isUnderPressure: false, teamIndex: 0, isAlive: true, targetLockTimer: 0,
  };
}

function speedOf(servo: number, own: number, opponent: number, distance: number): ReturnType<typeof calculateEffectiveSpeed> {
  const state: ServoStrainState = {
    servoMotors: servo,
    servoStrain: 0,
    sustainedMovementTime: 0,
    isUsingClosingBonus: false,
    stance: 'balanced',
    role: 'ranged',
    engagementRangeMidpoint: own,
    speedBurst: 'none',
    distanceToTarget: distance,
    currentSpeedRatio: 0,
    opponentEngagementMidpoint: opponent,
  };
  return calculateEffectiveSpeed(state, 'ranged');
}

interface ChaseResult {
  outcome: 'held' | 'kept_distance' | 'open';
  ticks: number;
  pursuerSpeed: number;
  kiterSpeed: number;
  /** Per-tick gap changes minus the predicted (kiterSpeed − pursuerSpeed) × tick */
  maxGapError: number;
  finalGap: number;
}

function chase(pursuerServo: number, kiterServo: number, maxTicks = MAX_TICKS): ChaseResult {
  const pursuer = makeState('Short', pursuerServo, { weaponType: 'ballistic', rangeBand: 'short' }, 0);
  const kiter = makeState('Long', kiterServo, { weaponType: 'energy', rangeBand: 'long' }, START_GAP);
  let pursuerSpeed = 0;
  let kiterSpeed = 0;
  let maxGapError = 0;
  let gap = START_GAP;
  kiter.velocity = { x: speedOf(kiterServo, KITER_MIDPOINT, PURSUER_MIDPOINT, gap).effectiveSpeed, y: 0 };

  for (let tick = 1; tick <= maxTicks; tick++) {
    // Decide from the tick-start snapshot
    const pursuerMode = speedOf(pursuerServo, PURSUER_MIDPOINT, KITER_MIDPOINT, gap);
    const kiterMode = speedOf(kiterServo, KITER_MIDPOINT, PURSUER_MIDPOINT, gap);
    expect(pursuerMode.mode).toBe('ranged_pursuit');
    expect(kiterMode.mode).toBe('ranged_kiting');
    pursuerSpeed = pursuerMode.effectiveSpeed;
    kiterSpeed = kiterMode.effectiveSpeed;
    pursuer.effectiveMovementSpeed = pursuerSpeed;
    pursuer.movementMode = pursuerMode.mode;
    kiter.effectiveMovementSpeed = kiterSpeed;
    kiter.movementMode = kiterMode.mode;
    const intent = calculateMovementIntent(pursuer, [kiter], ARENA, SIMULATION_TICK);
    const pursuerNext = applyMovement(pursuer, intent, ARENA, SIMULATION_TICK, kiter.position);
    const kiterNext = { x: kiter.position.x + kiterSpeed * SIMULATION_TICK, y: 0 };

    // Then both move
    pursuer.velocity = {
      x: (pursuerNext.x - pursuer.position.x) / SIMULATION_TICK,
      y: (pursuerNext.y - pursuer.position.y) / SIMULATION_TICK,
    };
    kiter.velocity = { x: kiterSpeed, y: 0 };
    pursuer.position = pursuerNext;
    kiter.position = kiterNext;

    const nextGap = Math.hypot(kiter.position.x - pursuer.position.x, kiter.position.y - pursuer.position.y);
    maxGapError = Math.max(maxGapError, Math.abs((nextGap - gap) - (kiterSpeed - pursuerSpeed) * SIMULATION_TICK));
    gap = nextGap;
    if (gap <= PURSUER_MIDPOINT) return { outcome: 'held', ticks: tick, pursuerSpeed, kiterSpeed, maxGapError, finalGap: gap };
    if (gap >= KITER_MIDPOINT) return { outcome: 'kept_distance', ticks: tick, pursuerSpeed, kiterSpeed, maxGapError, finalGap: gap };
  }
  return { outcome: 'open', ticks: maxTicks, pursuerSpeed, kiterSpeed, maxGapError, finalGap: gap };
}

const RANGED_KITING = 1.10;
const RANGED_PURSUIT = 1.05;

/** Pursuer Servo at which a 1.05× short pursuer and a 1.10× long kiter are exactly equally fast. */
function holdServo(kiterServo: number): number {
  return ((RANGED_KITING / RANGED_PURSUIT) * (7 + 0.2 * kiterServo) - 7) / 0.2;
}

/** Tick tolerance: deviation (≤ 3° for short range at CA 50) and the TA 1 biases cost < 0.005 units per tick. */
const GAP_TOLERANCE = 0.005;

describe('ranged vs ranged speed matrix (Season 2 round 3)', () => {
  it('at range the gap opens by 0.35 + 0.22 × kiter Servo − 0.21 × pursuer Servo u/s', () => {
    const cases: Array<[number, number, number]> = [[25, 25, 0.60], [30, 20, -1.55], [10, 12, 0.89]];
    for (const [pursuerServo, kiterServo, rate] of cases) {
      const result = chase(pursuerServo, kiterServo, 1);
      expect(result.kiterSpeed - result.pursuerSpeed).toBeCloseTo(0.35 + 0.22 * kiterServo - 0.21 * pursuerServo, 10);
      expect(result.kiterSpeed - result.pursuerSpeed).toBeCloseTo(rate, 10);
      expect(Math.abs(result.finalGap - START_GAP - SIMULATION_TICK * rate)).toBeLessThan(GAP_TOLERANCE);
    }
  });

  it('equal Servo 25: the long kiter gains 0.60 u/s and reaches its 16-unit midpoint', () => {
    const result = chase(25, 25);
    expect(result.outcome).toBe('kept_distance');
    expect(result.kiterSpeed - result.pursuerSpeed).toBeCloseTo(0.60, 10);
    // 6 units (gap 10 → 16) at 0.06 units per tick
    expect(result.ticks).toBeGreaterThanOrEqual(99);
    expect(result.ticks).toBeLessThanOrEqual(102);
    expect(result.maxGapError).toBeLessThan(GAP_TOLERANCE);
  });

  describe('the pursuer holds the kiter only above pursuer Servo ≈ 1.0476 × kiter Servo + 1.67', () => {
    for (const servo of [10, 20, 30]) {
      const threshold = holdServo(servo);
      it(`pursuer around ${threshold.toFixed(2)} (kiter ${servo})`, () => {
        expect(threshold).toBeCloseTo(1.0476 * servo + 1.67, 1);
        const held = chase(threshold + 0.5, servo);
        const kept = chase(threshold - 0.5, servo);
        expect(held.outcome).toBe('held');
        expect(kept.outcome).toBe('kept_distance');
        expect(held.maxGapError).toBeLessThan(GAP_TOLERANCE);
        expect(kept.maxGapError).toBeLessThan(GAP_TOLERANCE);
      });
    }
  });
});
