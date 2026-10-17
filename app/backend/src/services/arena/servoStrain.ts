/**
 * Servo Strain and Movement Speed System
 *
 * Calculates base and effective movement speed from servoMotors and applies
 * the stance modifier plus one of the engagement-cycle movement modes (#520):
 * speed burst (melee commit / ranged disengage, 1.30×), melee pursuit (1.15×),
 * mutual-melee final approach (1.15×), kiting vs melee (1.10×), and since
 * Season 2 round 3 ranged kiting vs a closer-preferring ranged opponent
 * (1.10×) and ranged pursuit of a farther-preferring ranged opponent (1.05×),
 * or normal movement reduced by servo strain. Every mode except normal
 * movement is exempt from strain. There is no speed-compensation term: Servo
 * Motors investment decides the speed race. Tracks servo strain accumulation
 * and decay over time.
 *
 * All functions are pure except updateServoStrain which mutates the
 * state object passed in (acceptable within the simulation loop).
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import { BURST_SPEED_MULTIPLIER, EngagementRole, SpeedBurst } from './engagementCycle';

/** Minimal state shape needed for speed and strain calculations */
export interface ServoStrainState {
  /** servoMotors attribute (1–50) */
  servoMotors: number;
  /** Current servo strain percentage (0–30) */
  servoStrain: number;
  /** Seconds of sustained high-speed movement */
  sustainedMovementTime: number;
  /** Whether the robot is currently in a strain-exempt movement mode (burst, pursuit, final approach, kiting, ranged kiting or ranged pursuit) */
  isUsingClosingBonus: boolean;
  /** Current combat stance */
  stance: 'defensive' | 'offensive' | 'balanced';
  /** Engagement role derived from the robot's engagement range */
  role: EngagementRole;
  /** Midpoint of the robot's engagement range band (grid units) */
  engagementRangeMidpoint: number;
  /** Active speed burst this tick */
  speedBurst: SpeedBurst;
  /** Distance to the current target in grid units */
  distanceToTarget: number;
  /** Ratio of actual movement this tick to max possible (0–1) */
  currentSpeedRatio: number;
  /** Midpoint of the opponent's engagement range band (grid units), or null without an opponent (Season 2 round 3) */
  opponentEngagementMidpoint: number | null;
}

/** Movement mode chosen by calculateEffectiveSpeed for this tick */
export type MovementMode =
  | 'melee_commit'
  | 'ranged_disengage'
  | 'pursuit'
  | 'final_approach'
  | 'kiting'
  | 'ranged_kiting'
  | 'ranged_pursuit'
  | 'normal';

/** Stance speed modifiers */
const STANCE_MODIFIERS: Record<string, number> = {
  defensive: 0.80,
  offensive: 1.10,
  balanced: 1.00,
};

/** Maximum servo strain percentage */
const MAX_SERVO_STRAIN = 30;

/** Speed ratio threshold above which strain accumulates */
const STRAIN_ACCUMULATION_THRESHOLD = 0.80;

/** Seconds of sustained movement before strain starts */
const STRAIN_GRACE_PERIOD = 3.0;

/** Strain accumulation rate in % per second */
const STRAIN_ACCUMULATION_RATE = 2.0;

/** Speed ratio threshold below which strain decays */
const STRAIN_DECAY_THRESHOLD = 0.50;

/** Strain decay rate in % per second */
const STRAIN_DECAY_RATE = 5.0;

/** Melee pursuit multiplier (melee role closing on a ranged-role opponent) */
const PURSUIT_MULTIPLIER = 1.15;

/**
 * Kiting multiplier: ranged role inside its engagement midpoint vs a melee-role
 * opponent, and (Season 2 round 3) vs a ranged opponent that prefers a closer range
 */
const KITING_MULTIPLIER = 1.10;

/**
 * Ranged pursuit multiplier (Season 2 round 3): ranged role beyond its engagement
 * midpoint vs a ranged opponent that prefers a farther range
 */
const RANGED_PURSUIT_MULTIPLIER = 1.05;

/** Mutual-melee final approach multiplier (melee vs melee at 2 < distance ≤ 4) */
const MUTUAL_MELEE_APPROACH_MULTIPLIER = 1.15;

/** Melee range band max distance */
const MELEE_RANGE_MAX = 2;

/** Outer edge of the mutual-melee final approach zone */
const FINAL_APPROACH_MAX = 4;

/**
 * Calculate base movement speed from servoMotors attribute.
 *
 * Formula: 7.0 + servoMotors × 0.2
 * Range: 7.2 (servoMotors=1) to 17.0 (servoMotors=50)
 */
export function calculateBaseSpeed(servoMotors: number): number {
  return 7.0 + servoMotors * 0.2;
}

/**
 * Calculate effective movement speed after applying the stance modifier and
 * the first matching movement mode (#520):
 *
 * 1. Speed burst (`speedBurst !== 'none'`): base × stance × 1.30, strain-exempt.
 * 2. Pursuit (melee role, distance > 2, ranged-role opponent): base × stance × 1.15, strain-exempt.
 * 3. Mutual final approach (melee vs melee, 2 < distance ≤ 4): base × stance × 1.15, strain-exempt.
 * 4. Kiting (ranged role, distance < engagement midpoint, melee-role opponent): base × stance × 1.10, strain-exempt.
 * 5. Ranged kiting (Season 2 round 3: ranged vs ranged, the opponent's engagement midpoint is closer
 *    than its own, distance < own midpoint): base × stance × 1.10, strain-exempt.
 * 6. Ranged pursuit (Season 2 round 3: ranged vs ranged, the opponent's engagement midpoint is farther
 *    than its own, distance > own midpoint): base × stance × 1.05, strain-exempt.
 * 7. Otherwise: base × stance × (1 − strain/100). Equal midpoints, or no opponent, stay here.
 *
 * The stance modifier always applies (defensive 0.80, also while pursuing).
 *
 * Returns the effective speed in units/second, whether a strain-exempt
 * mode is active, and the chosen movement mode.
 */
export function calculateEffectiveSpeed(
  state: ServoStrainState,
  opponentRole: EngagementRole | null,
): { effectiveSpeed: number; isClosingBonus: boolean; mode: MovementMode } {
  const baseSpeed = calculateBaseSpeed(state.servoMotors);
  const stanceModifier = STANCE_MODIFIERS[state.stance] ?? 1.0;
  const d = state.distanceToTarget;
  const exempt = (multiplier: number, mode: MovementMode): { effectiveSpeed: number; isClosingBonus: boolean; mode: MovementMode } =>
    ({ effectiveSpeed: baseSpeed * stanceModifier * multiplier, isClosingBonus: true, mode });

  // Speed burst: melee commit or ranged disengage
  if (state.speedBurst !== 'none') {
    return exempt(BURST_SPEED_MULTIPLIER, state.speedBurst);
  }

  // Melee pursuit of a ranged opponent (Req 2.5) — exempt from strain (Req 2.7)
  if (state.role === 'melee' && d > MELEE_RANGE_MAX && opponentRole === 'ranged') {
    return exempt(PURSUIT_MULTIPLIER, 'pursuit');
  }

  // Melee vs melee final approach — prevents orbital deadlock just outside
  // the narrow 2-unit melee window (distance 2–4).
  if (state.role === 'melee' && opponentRole === 'melee' && d > MELEE_RANGE_MAX && d <= FINAL_APPROACH_MAX) {
    return exempt(MUTUAL_MELEE_APPROACH_MULTIPLIER, 'final_approach');
  }

  // Ranged kiting away from a melee opponent — exempt from strain
  if (state.role === 'ranged' && d < state.engagementRangeMidpoint && opponentRole === 'melee') {
    return exempt(KITING_MULTIPLIER, 'kiting');
  }

  // Ranged vs ranged (Season 2 round 3): the farther-preferring robot keeps its
  // distance, the closer-preferring robot follows slightly slower
  const opponentMidpoint = state.opponentEngagementMidpoint;
  if (state.role === 'ranged' && opponentRole === 'ranged' && opponentMidpoint !== null) {
    if (opponentMidpoint < state.engagementRangeMidpoint && d < state.engagementRangeMidpoint) {
      return exempt(KITING_MULTIPLIER, 'ranged_kiting');
    }
    if (opponentMidpoint > state.engagementRangeMidpoint && d > state.engagementRangeMidpoint) {
      return exempt(RANGED_PURSUIT_MULTIPLIER, 'ranged_pursuit');
    }
  }

  // Normal movement with strain reduction (Req 2.6)
  const strainReduction = 1.0 - (state.servoStrain / 100);
  return {
    effectiveSpeed: baseSpeed * stanceModifier * strainReduction,
    isClosingBonus: false,
    mode: 'normal',
  };
}

/**
 * Update servo strain based on current movement state.
 *
 * Mutates the state object:
 * - Accumulates strain at +2%/s when moving >80% speed for >3s
 *   (unless using closing bonus, which is exempt per Req 2.7)
 * - Decays strain at -5%/s when moving <50% speed
 * - Caps strain at 30%
 * - Clamps strain floor at 0%
 */
export function updateServoStrain(state: ServoStrainState, deltaTime: number): void {
  // Strain accumulation (Req 2.6)
  if (state.currentSpeedRatio > STRAIN_ACCUMULATION_THRESHOLD && !state.isUsingClosingBonus) {
    state.sustainedMovementTime += deltaTime;
    if (state.sustainedMovementTime > STRAIN_GRACE_PERIOD) {
      state.servoStrain += STRAIN_ACCUMULATION_RATE * deltaTime;
      state.servoStrain = Math.min(state.servoStrain, MAX_SERVO_STRAIN);
    }
  } else {
    // Decay sustained movement timer when not at high speed
    state.sustainedMovementTime = Math.max(0, state.sustainedMovementTime - deltaTime);
  }

  // Strain decay when slow or stationary (Req 2.6)
  if (state.currentSpeedRatio < STRAIN_DECAY_THRESHOLD) {
    state.servoStrain -= STRAIN_DECAY_RATE * deltaTime;
    state.servoStrain = Math.max(state.servoStrain, 0);
  }
}
