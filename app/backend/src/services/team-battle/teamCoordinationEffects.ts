/**
 * Team Coordination Effects — Ally-Targeted Bonuses for Team Battle Mode (2v2 / 3v3)
 *
 * These formulas produce ally-facing effects from the three Team Coordination
 * Attributes (syncProtocols, supportSystems, formationTactics) during
 * simultaneous N-vs-N combat. They complement the existing 1v1 self-bonuses
 * in `arena/teamCoordination.ts` which remain unchanged.
 *
 * All functions are pure computations — no database access, no side effects.
 *
 * Scaling: √(attribute / 50) provides diminishing returns. Attributes are
 * clamped to [0, 50] because the practical cap is 50.
 *
 * Requirements: R6.1, R6.2, R6.3, R6.4, R6.5, R6.7, R6.8
 */

/** Formation proximity range in grid units */
export const FORMATION_RANGE = 8;

/** Maximum attribute value used for scaling (practical cap) */
export const ATTRIBUTE_SCALE_CAP = 50;

/** Maximum focus fire damage bonus (25%) */
export const FOCUS_FIRE_MAX = 0.25;

/** Maximum ally shield regen per second (at supportSystems=50, dt=1.0) */
export const ALLY_SHIELD_REGEN_MAX = 0.8;

/** Maximum formation damage reduction (20%) */
export const FORMATION_DEFENCE_MAX = 0.20;

/**
 * Calculate focus fire damage bonus from syncProtocols.
 *
 * When 2+ allied robots target the same enemy in the same tick, each
 * contributor's damage is multiplied by (1 + bonus).
 *
 * Formula: 0.25 × √(avgSyncProtocols / 50) × (contributorCount / teamSize)
 *
 * @param avgSyncProtocols - Average syncProtocols across contributing robots
 * @param contributorCount - Number of robots targeting the same enemy (≥ 2 for bonus)
 * @param teamSize - Team size (2 or 3)
 * @returns Bonus multiplier in [0, 0.25]. Returns 0 when avgSyncProtocols ≤ 0 or contributorCount < 2.
 *
 * Req R6.1, R6.2, R6.7
 */
export function calculateFocusFireBonus(
  avgSyncProtocols: number,
  contributorCount: number,
  teamSize: number,
): number {
  if (avgSyncProtocols <= 0 || contributorCount < 2) return 0;

  const clamped = Math.min(Math.max(avgSyncProtocols, 0), ATTRIBUTE_SCALE_CAP);
  return FOCUS_FIRE_MAX * Math.sqrt(clamped / ATTRIBUTE_SCALE_CAP) * (contributorCount / teamSize);
}

/**
 * Calculate ally shield regeneration per tick from supportSystems.
 *
 * Each robot passively regenerates shields on all allies within line-of-sight.
 * The regen is per-supporter, so a 3v3 team with 3 high-support robots each
 * regenerates shields on 2 allies.
 *
 * Formula: 0.8 × √(supportSystems / 50) × dt
 *
 * @param supportSystemsValue - The supporting robot's supportSystems attribute value
 * @param dt - Time delta in seconds (combat tick interval)
 * @returns Shield regen amount for this tick. Returns 0 when supportSystems ≤ 0.
 *
 * Req R6.3, R6.7
 */
export function calculateAllyShieldRegen(
  supportSystemsValue: number,
  dt: number,
): number {
  if (supportSystemsValue <= 0) return 0;

  const clamped = Math.min(Math.max(supportSystemsValue, 0), ATTRIBUTE_SCALE_CAP);
  return ALLY_SHIELD_REGEN_MAX * Math.sqrt(clamped / ATTRIBUTE_SCALE_CAP) * dt;
}

/**
 * Calculate formation damage reduction from formationTactics.
 *
 * When allies are within FORMATION_RANGE grid units, the robot receives a
 * damage reduction based on the average formationTactics of those nearby allies.
 *
 * Formula: 0.20 × √(avgFormationTactics / 50) × (alliesInRange / (teamSize - 1))
 *
 * @param avgFormationTactics - Average formationTactics of all allies within range
 * @param alliesInRange - Count of allies within FORMATION_RANGE grid units
 * @param teamSize - Team size (2 or 3)
 * @returns Damage reduction multiplier in [0, 0.20]. Returns 0 when avgFormationTactics ≤ 0, alliesInRange ≤ 0, or teamSize ≤ 1.
 *
 * Req R6.4, R6.5, R6.7
 */
export function calculateFormationDefense(
  avgFormationTactics: number,
  alliesInRange: number,
  teamSize: number,
): number {
  if (avgFormationTactics <= 0 || alliesInRange <= 0 || teamSize <= 1) return 0;

  const clamped = Math.min(Math.max(avgFormationTactics, 0), ATTRIBUTE_SCALE_CAP);
  return FORMATION_DEFENCE_MAX * Math.sqrt(clamped / ATTRIBUTE_SCALE_CAP) * (alliesInRange / (teamSize - 1));
}
