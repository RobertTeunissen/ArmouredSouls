/**
 * Servo Strain and Movement Speed System
 *
 * Calculates base and effective movement speed from servoMotors,
 * applies stance modifiers, servo strain reduction, and melee closing bonus.
 * Tracks servo strain accumulation and decay over time.
 *
 * All functions are pure except updateServoStrain which mutates the
 * state object passed in (acceptable within the simulation loop).
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

/** Minimal state shape needed for speed and strain calculations */
export interface ServoStrainState {
  /** servoMotors attribute (1–50) */
  servoMotors: number;
  /** Current servo strain percentage (0–30) */
  servoStrain: number;
  /** Seconds of sustained high-speed movement */
  sustainedMovementTime: number;
  /** Whether the robot is currently using the melee closing bonus or ranged kiting bonus */
  isUsingClosingBonus: boolean;
  /** Current combat stance */
  stance: 'defensive' | 'offensive' | 'balanced';
  /** Whether the robot has a melee weapon equipped */
  hasMeleeWeapon: boolean;
  /** Whether the robot has a ranged weapon equipped */
  hasRangedWeapon: boolean;
  /** The optimal range midpoint for the robot's weapon (grid units) */
  weaponOptimalRangeMidpoint: number;
  /** Distance to the current target in grid units */
  distanceToTarget: number;
  /** Ratio of actual movement this tick to max possible (0–1) */
  currentSpeedRatio: number;
}

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

/** Melee closing bonus base multiplier */
const CLOSING_BONUS_BASE = 1.30;

/** Melee closing bonus per-speed-diff multiplier */
const CLOSING_BONUS_PER_DIFF = 0.02;

/** Ranged kiting bonus base multiplier (weaker than closing: 10% vs 30%) */
const KITING_BONUS_BASE = 1.10;

/** Ranged kiting bonus per-speed-diff multiplier (weaker than closing: 0.8% vs 2%) */
const KITING_BONUS_PER_DIFF = 0.008;

/** Melee range band max distance */
const MELEE_RANGE_MAX = 2;

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
 * Calculate effective movement speed after applying stance modifier,
 * servo strain reduction, melee closing bonus, or ranged kiting bonus.
 *
 * When the melee closing bonus applies (melee weapon, distance > 2,
 * opponent has ranged weapon), strain reduction is NOT applied —
 * the closing bonus is exempt from strain (Req 2.7).
 *
 * When the ranged kiting bonus applies (ranged weapon, distance < optimal range,
 * opponent has melee weapon), strain reduction is NOT applied —
 * the kiting bonus is exempt from strain to allow ranged builds to maintain distance.
 *
 * Returns the effective speed in units/second and whether a movement
 * bonus (closing or kiting) is active.
 */
export function calculateEffectiveSpeed(
  state: ServoStrainState,
  opponentSpeed: number,
  hasRangedOpponent: boolean,
  hasMeleeOpponent: boolean = false,
): { effectiveSpeed: number; isClosingBonus: boolean } {
  const baseSpeed = calculateBaseSpeed(state.servoMotors);
  const stanceModifier = STANCE_MODIFIERS[state.stance] ?? 1.0;

  // Melee closing bonus (Req 2.5) — exempt from strain (Req 2.7)
  if (state.hasMeleeWeapon && state.distanceToTarget > MELEE_RANGE_MAX && hasRangedOpponent) {
    // Use opponent's effective speed (which may include kiting bonus) so the
    // closing bonus actually compensates for the speed advantage kiting gives.
    // During closing, the stance speed penalty is relaxed — defensive robots
    // still need to reach melee range to fight at all. The stance benefits
    // (shield regen, counter chance, damage reduction) apply once in combat.
    const closingStanceModifier = stanceModifier < 1.0
      ? Math.max(stanceModifier, 0.95) // Defensive: cap penalty at 5% while closing (was 20%)
      : stanceModifier;
    const speedGap = Math.max(0, opponentSpeed - baseSpeed * closingStanceModifier);
    const closingBonus = CLOSING_BONUS_BASE + speedGap * CLOSING_BONUS_PER_DIFF;
    return {
      effectiveSpeed: baseSpeed * closingStanceModifier * closingBonus,
      isClosingBonus: true,
    };
  }

  // Ranged kiting bonus — exempt from strain (mirrors closing bonus for ranged builds)
  // Activates when: ranged weapon, distance < optimal range midpoint, opponent has melee weapon
  if (
    state.hasRangedWeapon &&
    state.distanceToTarget < state.weaponOptimalRangeMidpoint &&
    hasMeleeOpponent
  ) {
    const speedGap = Math.max(0, opponentSpeed - baseSpeed);
    const kitingBonus = KITING_BONUS_BASE + speedGap * KITING_BONUS_PER_DIFF;
    return {
      effectiveSpeed: baseSpeed * stanceModifier * kitingBonus,
      isClosingBonus: true, // Reusing flag — means "exempt from strain"
    };
  }

  // Normal movement with strain reduction (Req 2.6)
  const strainReduction = 1.0 - (state.servoStrain / 100);
  return {
    effectiveSpeed: baseSpeed * stanceModifier * strainReduction,
    isClosingBonus: false,
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
