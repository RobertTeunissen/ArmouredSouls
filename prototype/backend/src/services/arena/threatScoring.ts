/**
 * Threat Scoring and Target Selection
 *
 * Calculates threat scores for opponents based on combat power, HP,
 * weapon type, arena-normalized proximity, and targeting status.
 * Used for target priority in multi-robot battles and positioning
 * decisions in all battle formats.
 *
 * All functions are pure with no module-level mutable state.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 12.3, 12.4
 */

import { euclideanDistance, Position } from './vector2d';
import { RobotCombatState, ThreatScore } from './types';
import { getWeaponOptimalRange, classifyRangeBand, WeaponLike } from './rangeBands';

/**
 * Calculate the threat score of an opponent relative to a robot.
 *
 * Factors:
 * - Combat power (opponent's total combat effectiveness)
 * - HP percentage (higher HP = higher threat)
 * - Weapon threat (optimal range match = 1.5×, mismatch = 0.8×)
 * - Arena-normalized proximity decay: 1/(1 + normalizedDist × 5)
 * - Targeting-me factor (1.3× if opponent is targeting this robot)
 * - Scaled by threatAnalysis: (0.5 + ta/100)
 *
 * Req 6.1, 6.2, 6.4
 */
export function calculateThreatScore(
  robot: RobotCombatState,
  opponent: RobotCombatState,
  distance: number,
  arenaRadius: number,
): ThreatScore {
  const ta = Number(robot.robot.threatAnalysis ?? 1);

  // Base threat from combat power (use totalDamageDealt as proxy if no combatPower field)
  const combatPower = opponent.totalDamageDealt > 0
    ? opponent.totalDamageDealt
    : (opponent.maxHP * 0.5);
  const combatPowerThreat = combatPower * 2;

  // HP-based urgency
  const hpPercentage = opponent.maxHP > 0
    ? opponent.currentHP / opponent.maxHP
    : 0;

  // Weapon threat — does opponent's weapon match current range?
  const mainWeapon = opponent.robot.mainWeapon?.weapon as WeaponLike | undefined;
  let weaponThreat = 0.8;
  if (mainWeapon) {
    const weaponRange = getWeaponOptimalRange(mainWeapon);
    const currentBand = classifyRangeBand(distance);
    weaponThreat = weaponRange === currentBand ? 1.5 : 0.8;
  }

  // Arena-normalized proximity decay
  const normalizedDistance = arenaRadius > 0
    ? distance / (arenaRadius * 2)
    : 0;
  const proximityDecay = 1.0 / (1.0 + normalizedDistance * 5);

  // Is this opponent targeting me?
  const isTargetingMe = opponent.currentTarget !== null
    && opponent.currentTarget === robot.teamIndex; // simplified check
  const targetingMeFactor = isTargetingMe ? 1.3 : 1.0;

  // Composite score scaled by threat analysis
  const taScale = 0.5 + ta / 100;
  const score = combatPowerThreat * hpPercentage * weaponThreat
    * proximityDecay * targetingMeFactor * taScale;

  return {
    robotIndex: opponent.teamIndex,
    score,
    factors: {
      combatPower: combatPowerThreat,
      hpPercentage,
      weaponThreat,
      distance,
      proximityDecay,
      isTargetingMe,
    },
  };
}

/**
 * Select the highest-priority target from a list of opponents.
 *
 * Sorts by threat score descending. When the top two scores are within
 * 10% of each other, the closer opponent is selected (tiebreaker rule).
 *
 * Returns null if no living opponents exist.
 *
 * Req 6.5, 12.3, 12.4
 */
export function selectTarget(
  robot: RobotCombatState,
  opponents: RobotCombatState[],
  arenaRadius: number,
): ThreatScore | null {
  const livingOpponents = opponents.filter((o) => o.isAlive);
  if (livingOpponents.length === 0) return null;

  const scores = livingOpponents.map((opp) => {
    const dist = euclideanDistance(robot.position, opp.position);
    return calculateThreatScore(robot, opp, dist, arenaRadius);
  });

  scores.sort((a, b) => b.score - a.score);

  if (scores.length < 2) return scores[0];

  // Tiebreaker: if top two are within 10%, pick the closer one
  if (scores[0].score <= scores[1].score * 1.1) {
    const dist0 = scores[0].factors.distance;
    const dist1 = scores[1].factors.distance;
    if (dist1 < dist0) return scores[1];
  }

  return scores[0];
}
