/**
 * Logic Cores Pressure System
 *
 * Calculates composure effects when a robot's HP drops below its
 * pressure threshold. Low logicCores robots suffer accuracy/damage
 * penalties; high logicCores robots gain composure bonuses.
 *
 * All functions are pure with no module-level mutable state.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

/** Minimal state shape needed for pressure calculations */
export interface PressureState {
  /** logicCores attribute (1–50) */
  logicCores: number;
  /** Current HP */
  currentHP: number;
  /** Maximum HP */
  maxHP: number;
}

/** Result of pressure effect calculation */
export interface PressureEffects {
  /** Accuracy modifier (negative = penalty, positive = bonus) */
  accuracyMod: number;
  /** Damage modifier (negative = penalty, positive = bonus) */
  damageMod: number;
  /** The HP% threshold where pressure activates */
  pressureThreshold: number;
  /** Whether the robot is currently under pressure */
  isUnderPressure: boolean;
}

/**
 * Calculate the pressure threshold as a percentage of max HP.
 * Formula: (15 + logicCores × 0.6)%
 *
 * Req 8.1
 */
export function calculatePressureThreshold(logicCores: number): number {
  return 15 + logicCores * 0.6;
}

/**
 * Calculate pressure effects based on current HP and logicCores.
 *
 * When HP% < pressureThreshold:
 * - Base accuracy penalty: max(0, 15 - logicCores × 0.5)
 * - Base damage penalty: max(0, 10 - logicCores × 0.33)
 * - Death spiral cap (logicCores < 10): accuracy ≤ 10%, damage ≤ 8%
 * - Composure bonus (logicCores > 30): (logicCores - 30) × 0.5%
 *
 * At logicCores = 30, penalties are exactly 0 (fully negated).
 *
 * Req 8.1, 8.2, 8.3, 8.4
 */
export function calculatePressureEffects(state: PressureState): PressureEffects {
  const lc = state.logicCores;
  const pressureThreshold = calculatePressureThreshold(lc);
  const hpPercent = state.maxHP > 0
    ? (state.currentHP / state.maxHP) * 100
    : 0;

  if (hpPercent >= pressureThreshold) {
    return {
      accuracyMod: 0,
      damageMod: 0,
      pressureThreshold,
      isUnderPressure: false,
    };
  }

  // Base penalties (Req 8.1)
  let accuracyPenalty = Math.max(0, 15 - lc * 0.5);
  let damagePenalty = Math.max(0, 10 - lc * 0.33);

  // Death spiral cap for low logicCores (Req 8.4)
  if (lc < 10) {
    accuracyPenalty = Math.min(accuracyPenalty, 10);
    damagePenalty = Math.min(damagePenalty, 8);
  }

  // Composure bonus for high logicCores (Req 8.2)
  let composureBonus = 0;
  if (lc > 30) {
    composureBonus = (lc - 30) * 0.5;
  }

  return {
    accuracyMod: -accuracyPenalty + composureBonus,
    damageMod: -damagePenalty + composureBonus,
    pressureThreshold,
    isUnderPressure: true,
  };
}
