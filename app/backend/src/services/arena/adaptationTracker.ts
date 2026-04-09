/**
 * Adaptive AI Bonus Tracking
 *
 * Tracks cumulative hit chance and damage bonuses that increase when a robot
 * takes damage or misses attacks. Designed to help losing robots adapt,
 * with reduced effectiveness when the robot is winning (HP > 70%).
 *
 * All functions are pure (updateAdaptation mutates the passed state object,
 * acceptable within the simulation loop).
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

/** Minimal state shape needed for adaptation tracking */
export interface AdaptationState {
  /** adaptiveAI attribute (1–50) */
  adaptiveAI: number;
  /** Accumulated hit chance bonus (%) */
  adaptationHitBonus: number;
  /** Accumulated damage bonus (%) */
  adaptationDamageBonus: number;
  /** Current HP */
  currentHP: number;
  /** Maximum HP */
  maxHP: number;
}

/** Events that trigger adaptation updates */
export type AdaptationEvent = 'damage_taken' | 'miss';

/** Hit bonus increment per damage_taken event: adaptiveAI × 0.02 */
const HIT_BONUS_PER_DAMAGE = 0.02;

/** Damage bonus increment per damage_taken event: adaptiveAI × 0.01 */
const DAMAGE_BONUS_PER_DAMAGE = 0.01;

/** Hit bonus increment per miss event: adaptiveAI × 0.03 */
const HIT_BONUS_PER_MISS = 0.03;

/** Cap multiplier for hit bonus: adaptiveAI × 0.5 */
const HIT_CAP_MULTIPLIER = 0.5;

/** Cap multiplier for damage bonus: adaptiveAI × 0.25 */
const DAMAGE_CAP_MULTIPLIER = 0.25;

/** HP percentage above which adaptation effectiveness is halved */
const WINNING_HP_THRESHOLD = 0.70;

/** Effectiveness multiplier when HP > 70% */
const WINNING_EFFECTIVENESS = 0.5;

/**
 * Update adaptation bonuses based on a combat event.
 *
 * - damage_taken: +adaptiveAI×0.02% hit, +adaptiveAI×0.01% damage
 * - miss: +adaptiveAI×0.03% hit
 *
 * Bonuses are capped at adaptiveAI×0.5 (hit) and adaptiveAI×0.25 (damage).
 *
 * Mutates the state object.
 *
 * Req 7.2, 7.3, 7.4
 */
export function updateAdaptation(state: AdaptationState, event: AdaptationEvent): void {
  const ai = state.adaptiveAI;

  if (event === 'damage_taken') {
    state.adaptationHitBonus += ai * HIT_BONUS_PER_DAMAGE;
    state.adaptationDamageBonus += ai * DAMAGE_BONUS_PER_DAMAGE;
  } else if (event === 'miss') {
    state.adaptationHitBonus += ai * HIT_BONUS_PER_MISS;
  }

  // Cap (Req 7.4)
  const maxHit = ai * HIT_CAP_MULTIPLIER;
  const maxDamage = ai * DAMAGE_CAP_MULTIPLIER;
  state.adaptationHitBonus = Math.min(state.adaptationHitBonus, maxHit);
  state.adaptationDamageBonus = Math.min(state.adaptationDamageBonus, maxDamage);
}

/**
 * Get effective adaptation bonuses, accounting for HP-based effectiveness.
 *
 * When HP > 70%, bonuses are applied at 50% effectiveness to prevent
 * the winning robot from gaining full adaptive benefits.
 *
 * Req 7.5
 */
export function getEffectiveAdaptation(
  state: AdaptationState,
): { hitBonus: number; damageBonus: number } {
  const hpPercent = state.maxHP > 0 ? state.currentHP / state.maxHP : 0;
  const effectiveness = hpPercent > WINNING_HP_THRESHOLD
    ? WINNING_EFFECTIVENESS
    : 1.0;

  return {
    hitBonus: state.adaptationHitBonus * effectiveness,
    damageBonus: state.adaptationDamageBonus * effectiveness,
  };
}
