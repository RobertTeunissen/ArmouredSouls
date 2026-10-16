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
    disengageBurstUntil: 0, disengageReadyAt: 0, speedBurst: 'none',
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

/** Kiter Servo at which a 1.30× melee robot and a 1.10× kiter are exactly equally fast. */
function equalSpeedServo(fasterModeServo: number): number {
  return ((1.30 / 1.10) * (7 + 0.2 * fasterModeServo) - 7) / 0.2;
}

/** Tick tolerance: deviation (≤ 1.5° for melee at CA 50) costs at most ~0.001 units per tick. */
const GAP_TOLERANCE = 0.005;

describe('pursuit speed matrix (#520 movement fix)', () => {
  it('melee Servo 50 catches a Servo 12 kiter that steps more than 1 unit per tick', () => {
    const result = chase(50, 12, 'pursuit', 'kiting');
    expect(result.kiterSpeed * SIMULATION_TICK).toBeGreaterThan(1);
    expect(result.meleeSpeed).toBeCloseTo((7 + 0.2 * 50) * 1.10, 10);
    expect(result.outcome).toBe('caught');
    expect(result.maxGapError).toBeLessThan(GAP_TOLERANCE);
  });

  describe('melee Servo 25 vs a faster kiter', () => {
    it('a Servo 40 kiter escapes at range (1.10× vs 1.10×)', () => {
      const result = chase(25, 40, 'pursuit', 'kiting');
      expect(result.outcome).toBe('escaped');
      expect(result.maxGapError).toBeLessThan(GAP_TOLERANCE);
    });

    it('a Servo 40 kiter also outruns the 1.30× commit (40 ≥ 1.18 × 25 + 6.4)', () => {
      expect(chase(25, 40, 'commit', 'kiting').outcome).toBe('escaped');
    });

    it('the commit catches a Servo 35 kiter but not a Servo 36 kiter (threshold ~35.9)', () => {
      expect(equalSpeedServo(25)).toBeCloseTo(35.9, 1);
      const caught = chase(25, 35, 'commit', 'kiting');
      const escaped = chase(25, 36, 'commit', 'kiting');
      expect(caught.outcome).toBe('caught');
      expect(escaped.outcome).toBe('escaped');
      expect(caught.maxGapError).toBeLessThan(GAP_TOLERANCE);
      expect(escaped.maxGapError).toBeLessThan(GAP_TOLERANCE);
    });
  });

  describe('equal Servo 25', () => {
    it('keeps the gap constant at range', () => {
      const result = chase(25, 25, 'pursuit', 'kiting', 200);
      expect(result.outcome).toBe('open');
      expect(Math.abs(result.finalGap - START_GAP)).toBeLessThan(200 * GAP_TOLERANCE);
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

  it('at range the gap changes by 0.22 u/s per Servo point of difference', () => {
    for (const [meleeServo, kiterServo] of [[20, 25], [30, 22], [10, 11]]) {
      const result = chase(meleeServo, kiterServo, 'pursuit', 'kiting', 1);
      expect(result.kiterSpeed - result.meleeSpeed).toBeCloseTo(0.22 * (kiterServo - meleeServo), 10);
      expect(Math.abs(result.finalGap - START_GAP - 0.022 * (kiterServo - meleeServo))).toBeLessThan(GAP_TOLERANCE);
    }
  });

  describe('thresholds: kiter Servo ≥ 1.18 × melee Servo + 6.4 outruns the commit, and vice versa', () => {
    for (const servo of [10, 20, 30]) {
      const threshold = equalSpeedServo(servo);
      it(`commit vs kiter around ${threshold.toFixed(2)} (melee ${servo})`, () => {
        expect(threshold).toBeCloseTo(1.18 * servo + 6.4, 0);
        expect(chase(servo, threshold - 0.5, 'commit', 'kiting').outcome).toBe('caught');
        expect(chase(servo, threshold + 0.5, 'commit', 'kiting').outcome).toBe('escaped');
      });
      it(`disengage vs melee around ${threshold.toFixed(2)} (kiter ${servo})`, () => {
        expect(chase(threshold + 0.5, servo, 'pursuit', 'disengage').outcome).toBe('caught');
        expect(chase(threshold - 0.5, servo, 'pursuit', 'disengage').outcome).toBe('escaped');
      });
    }
  });
});
