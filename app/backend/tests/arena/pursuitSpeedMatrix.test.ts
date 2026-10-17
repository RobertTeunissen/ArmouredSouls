/**
 * #520 movement fix: pursuit closes at full speed, so the speed race alone
 * decides whether a melee robot reaches a kiter.
 *
 * Each case runs a straight-line chase tick by tick, simultaneously: both
 * robots decide from the tick-start snapshot, then both move. The melee robot
 * uses the real movement AI (calculateMovementIntent + applyMovement) and the
 * real speed model (calculateEffectiveSpeed); the kiter flees straight along
 * +x at its engine speed for the given mode. A chase ends when the gap reaches
 * melee reach (≤ 2, caught) or the kiter's engagement midpoint (≥ 4.5, the
 * kiter is back at its preferred distance and escapes).
 *
 * Rates (balanced stance, base speed 7 + 0.2 × Servo): pursuit 1.15×,
 * kiting 1.10×, melee commit and ranged disengage 1.30× (Season 2 round 2).
 * At equal Servo the chaser closes 0.35 + 0.01 × Servo u/s at range; a kiter
 * keeps away only above ≈ 1.0455 × melee Servo + 1.59.
 *
 * Before the fix the melee robot aimed 1 unit short of the kiter's current
 * position and stopped there, so any kiter faster than 10 u/s (1 unit per
 * 0.1 s tick) ended every tick at a gap of 1 + its step > 2 and was never caught.
 */
import { applyMovement, calculateMovementIntent, RANGE_BAND_MIDPOINTS } from '../../src/services/arena/movementAI';
import { calculateEffectiveSpeed, ServoStrainState } from '../../src/services/arena/servoStrain';
import type { ArenaConfig, RobotCombatState } from '../../src/services/arena/types';
import { SIMULATION_TICK } from '../../src/services/battle/combat-simulator/combatTypes';

type MeleeMode = 'pursuit' | 'commit';
type KiterMode = 'kiting' | 'disengage';

const ARENA: ArenaConfig = { radius: 10000, center: { x: 0, y: 0 }, spawnPositions: [] };
const KITER_MIDPOINT = RANGE_BAND_MIDPOINTS.short; // Laser Pistol: 4.5
const START_GAP = 3;
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
    movementIntent: { targetPosition: { x, y: 0 }, strategy: 'calculated_path', preferredRange: 'melee', stanceSpeedModifier: 0 },
    currentTarget: null, patienceTimer: 0, combatAlgorithmScore: 1, lastMeleeHitTakenAt: null,
    disengageBurstUntil: 0, disengageReadyAt: 0, disengageScheduledAt: null, speedBurst: 'none', movementMode: 'normal',
    adaptationHitBonus: 0, adaptationDamageBonus: 0, hitsTaken: 0, missCount: 0,
    pressureThreshold: 30, isUnderPressure: false, teamIndex: 0, isAlive: true, targetLockTimer: 0,
  };
}

function speedOf(servo: number, role: 'melee' | 'ranged', burst: boolean, distance: number): number {
  const state: ServoStrainState = {
    servoMotors: servo,
    servoStrain: 0,
    sustainedMovementTime: 0,
    isUsingClosingBonus: false,
    stance: 'balanced',
    role,
    engagementRangeMidpoint: role === 'melee' ? RANGE_BAND_MIDPOINTS.melee : KITER_MIDPOINT,
    speedBurst: burst ? (role === 'melee' ? 'melee_commit' : 'ranged_disengage') : 'none',
    distanceToTarget: distance,
    currentSpeedRatio: 0,
    opponentEngagementMidpoint: null,
  };
  return calculateEffectiveSpeed(state, role === 'melee' ? 'ranged' : 'melee').effectiveSpeed;
}

interface ChaseResult {
  outcome: 'caught' | 'escaped' | 'open';
  ticks: number;
  meleeSpeed: number;
  kiterSpeed: number;
  /** Per-tick gap changes minus the predicted (kiterSpeed − meleeSpeed) × tick */
  maxGapError: number;
  finalGap: number;
}

function chase(meleeServo: number, kiterServo: number, meleeMode: MeleeMode, kiterMode: KiterMode, maxTicks = MAX_TICKS): ChaseResult {
  const melee = makeState('Melee', meleeServo, { weaponType: 'melee', rangeBand: 'melee' }, 0);
  const kiter = makeState('Kiter', kiterServo, { weaponType: 'energy', rangeBand: 'short' }, START_GAP);
  let meleeSpeed = 0;
  let kiterSpeed = 0;
  let maxGapError = 0;
  let gap = START_GAP;
  kiter.velocity = { x: speedOf(kiterServo, 'ranged', kiterMode === 'disengage', gap), y: 0 };

  for (let tick = 1; tick <= maxTicks; tick++) {
    // Decide from the tick-start snapshot
    meleeSpeed = speedOf(meleeServo, 'melee', meleeMode === 'commit', gap);
    kiterSpeed = speedOf(kiterServo, 'ranged', kiterMode === 'disengage', gap);
    melee.effectiveMovementSpeed = meleeSpeed;
    kiter.effectiveMovementSpeed = kiterSpeed;
    const intent = calculateMovementIntent(melee, [kiter], ARENA, SIMULATION_TICK);
    const meleeNext = applyMovement(melee, intent, ARENA, SIMULATION_TICK, kiter.position);
    const kiterNext = { x: kiter.position.x + kiterSpeed * SIMULATION_TICK, y: 0 };

    // Then both move
    melee.velocity = {
      x: (meleeNext.x - melee.position.x) / SIMULATION_TICK,
      y: (meleeNext.y - melee.position.y) / SIMULATION_TICK,
    };
    kiter.velocity = { x: kiterSpeed, y: 0 };
    melee.position = meleeNext;
    kiter.position = kiterNext;

    const nextGap = Math.hypot(kiter.position.x - melee.position.x, kiter.position.y - melee.position.y);
    maxGapError = Math.max(maxGapError, Math.abs((nextGap - gap) - (kiterSpeed - meleeSpeed) * SIMULATION_TICK));
    gap = nextGap;
    if (gap <= 2) return { outcome: 'caught', ticks: tick, meleeSpeed, kiterSpeed, maxGapError, finalGap: gap };
    if (gap >= KITER_MIDPOINT) return { outcome: 'escaped', ticks: tick, meleeSpeed, kiterSpeed, maxGapError, finalGap: gap };
  }
  return { outcome: 'open', ticks: maxTicks, meleeSpeed, kiterSpeed, maxGapError, finalGap: gap };
}

const PURSUIT = 1.15;
const KITING = 1.10;
const BURST = 1.30;

/** Kiter Servo at which a 1.15× pursuing melee robot and a 1.10× kiter are exactly equally fast. */
function pursuitOutrunServo(meleeServo: number): number {
  return ((PURSUIT / KITING) * (7 + 0.2 * meleeServo) - 7) / 0.2;
}

/** Kiter Servo at which a 1.30× committing melee robot and a 1.10× kiter are exactly equally fast. */
function commitOutrunServo(meleeServo: number): number {
  return ((BURST / KITING) * (7 + 0.2 * meleeServo) - 7) / 0.2;
}

/** Melee Servo at which a 1.15× pursuing melee robot and a 1.30× disengaging kiter are exactly equally fast. */
function disengageDenyServo(kiterServo: number): number {
  return ((BURST / PURSUIT) * (7 + 0.2 * kiterServo) - 7) / 0.2;
}

/** Tick tolerance: deviation (≤ 1.5° for melee at CA 50) costs at most ~0.001 units per tick. */
const GAP_TOLERANCE = 0.005;

describe('pursuit speed matrix (#520 movement fix)', () => {
  it('melee Servo 50 catches a Servo 12 kiter that steps more than 1 unit per tick', () => {
    const result = chase(50, 12, 'pursuit', 'kiting');
    expect(result.kiterSpeed * SIMULATION_TICK).toBeGreaterThan(1);
    expect(result.meleeSpeed).toBeCloseTo((7 + 0.2 * 50) * PURSUIT, 10);
    expect(result.outcome).toBe('caught');
    expect(result.maxGapError).toBeLessThan(GAP_TOLERANCE);
  });

  describe('melee Servo 25 vs a faster kiter', () => {
    it('a Servo 40 kiter escapes at range (1.15× vs 1.10×; 40 > 1.05 × 25 + 1.6)', () => {
      const result = chase(25, 40, 'pursuit', 'kiting');
      expect(result.outcome).toBe('escaped');
      expect(result.maxGapError).toBeLessThan(GAP_TOLERANCE);
    });

    it('a Servo 40 kiter also outruns the 1.30× commit (40 ≥ 1.18 × 25 + 6.4)', () => {
      expect(chase(25, 40, 'commit', 'kiting').outcome).toBe('escaped');
    });

    it('the commit catches a Servo 35 kiter but not a Servo 36 kiter (threshold ~35.9)', () => {
      expect(commitOutrunServo(25)).toBeCloseTo(35.9, 1);
      const caught = chase(25, 35, 'commit', 'kiting');
      const escaped = chase(25, 36, 'commit', 'kiting');
      expect(caught.outcome).toBe('caught');
      expect(escaped.outcome).toBe('escaped');
      expect(caught.maxGapError).toBeLessThan(GAP_TOLERANCE);
      expect(escaped.maxGapError).toBeLessThan(GAP_TOLERANCE);
    });
  });

  describe('equal Servo 25', () => {
    it('pursuit closes the gap at 0.60 u/s at range', () => {
      const result = chase(25, 25, 'pursuit', 'kiting');
      expect(result.outcome).toBe('caught');
      expect(result.kiterSpeed - result.meleeSpeed).toBeCloseTo(-0.60, 10);
      // 1 unit (gap 3 → 2) at 0.06 units per tick
      expect(result.ticks).toBeGreaterThanOrEqual(16);
      expect(result.ticks).toBeLessThanOrEqual(18);
      expect(result.maxGapError).toBeLessThan(GAP_TOLERANCE);
    });

    it('the melee commit catches', () => {
      expect(chase(25, 25, 'commit', 'kiting').outcome).toBe('caught');
    });

    it('the ranged disengage escapes', () => {
      expect(chase(25, 25, 'pursuit', 'disengage').outcome).toBe('escaped');
    });
  });

  describe('slow vs slow', () => {
    it('melee Servo 5 slowly catches a Servo 1 kiter', () => {
      const result = chase(5, 1, 'pursuit', 'kiting');
      expect(result.outcome).toBe('caught');
      expect(result.maxGapError).toBeLessThan(GAP_TOLERANCE);
    });

    it('a Servo 5 kiter escapes melee Servo 1', () => {
      expect(chase(1, 5, 'pursuit', 'kiting').outcome).toBe('escaped');
    });
  });

  it('at range the gap changes by 0.22 × kiter Servo − 0.23 × melee Servo − 0.35 u/s', () => {
    const cases: Array<[number, number, number]> = [[20, 25, 0.55], [30, 22, -2.41], [10, 11, -0.23]];
    for (const [meleeServo, kiterServo, rate] of cases) {
      const result = chase(meleeServo, kiterServo, 'pursuit', 'kiting', 1);
      expect(result.kiterSpeed - result.meleeSpeed).toBeCloseTo(0.22 * kiterServo - 0.23 * meleeServo - 0.35, 10);
      expect(result.kiterSpeed - result.meleeSpeed).toBeCloseTo(rate, 10);
      expect(Math.abs(result.finalGap - START_GAP - SIMULATION_TICK * rate)).toBeLessThan(GAP_TOLERANCE);
    }
  });

  describe('pursuit vs kiting threshold ≈ 1.0455 × melee Servo + 1.59', () => {
    for (const servo of [10, 20, 30]) {
      const threshold = pursuitOutrunServo(servo);
      it(`pursuit vs kiter around ${threshold.toFixed(2)} (melee ${servo})`, () => {
        expect(threshold).toBeCloseTo(1.0455 * servo + 1.59, 1);
        expect(chase(servo, threshold - 0.5, 'pursuit', 'kiting').outcome).toBe('caught');
        expect(chase(servo, threshold + 0.5, 'pursuit', 'kiting').outcome).toBe('escaped');
      });
    }
  });

  describe('thresholds: commit: kiter Servo ≥ 1.18 × melee Servo + 6.4 outruns it; disengage: melee Servo ≥ 1.13 × kiter Servo + 4.57 denies it', () => {
    for (const servo of [10, 20, 30]) {
      const commitThreshold = commitOutrunServo(servo);
      it(`commit vs kiter around ${commitThreshold.toFixed(2)} (melee ${servo})`, () => {
        expect(commitThreshold).toBeCloseTo(1.18 * servo + 6.4, 0);
        expect(chase(servo, commitThreshold - 0.5, 'commit', 'kiting').outcome).toBe('caught');
        expect(chase(servo, commitThreshold + 0.5, 'commit', 'kiting').outcome).toBe('escaped');
      });
      const denyThreshold = disengageDenyServo(servo);
      it(`disengage vs melee around ${denyThreshold.toFixed(2)} (kiter ${servo})`, () => {
        expect(denyThreshold).toBeCloseTo(1.1304 * servo + 4.57, 1);
        expect(chase(denyThreshold + 0.5, servo, 'pursuit', 'disengage').outcome).toBe('caught');
        expect(chase(denyThreshold - 0.5, servo, 'pursuit', 'disengage').outcome).toBe('escaped');
      });
    }
  });
});
