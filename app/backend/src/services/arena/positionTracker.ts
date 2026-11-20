/**
 * Position Tracker — Facing Direction, Backstab, and Flanking
 *
 * Tracks robot facing direction with turn-speed limits, detects
 * backstab and flanking (team battles) positioning advantages,
 * and applies gyro/threatAnalysis reductions to bonuses.
 *
 * All functions are pure except updateFacing which mutates the
 * state object passed in (acceptable within the simulation loop).
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9
 */

import { Position, angleBetween, normalizeAngle, sign } from './vector2d';

// ─── Minimal interfaces ─────────────────────────────────────────────

/** Minimal state needed for facing-direction updates */
export interface FacingState {
  position: Position;
  facingDirection: number;
  turnSpeed: number;
}

/** Minimal opponent state for predictive turn bias */
export interface OpponentState {
  position: Position;
  velocity: { x: number; y: number };
}

/** Minimal robot attributes for backstab/flanking checks */
export interface PositionedRobot {
  position: Position;
  facingDirection: number;
  gyroStabilizers: number;
  threatAnalysis: number;
}

/** Result of a backstab check */
export interface BackstabResult {
  isBackstab: boolean;
  bonus: number;
  angle: number;
}

/** Result of a flanking check */
export interface FlankingResult {
  isFlanking: boolean;
  bonus: number;
}

// ─── Constants ──────────────────────────────────────────────────────

/** Base turn speed in degrees per second */
const BASE_TURN_SPEED = 180;

/** Turn speed bonus per gyroStabilizers point (degrees/second) */
const TURN_SPEED_PER_GYRO = 6;

/** Backstab angle threshold in degrees from facing */
const BACKSTAB_ANGLE_THRESHOLD = 120;

/** Backstab base damage bonus */
const BACKSTAB_BASE_BONUS = 0.10;

/** Backstab gyro reduction per point */
const BACKSTAB_GYRO_REDUCTION_PER_POINT = 0.0025;

/** Flanking angle threshold between attackers */
const FLANKING_ANGLE_THRESHOLD = 90;

/** Flanking damage bonus at Formation Tactics 50 (scales with √(formationTactics / 50)) */
const FLANKING_MAX_BONUS = 0.20;

/** Attribute value at which the flanking bonus reaches its maximum */
const FLANKING_ATTRIBUTE_CAP = 50;

/** Flanking gyro reduction per point */
const FLANKING_GYRO_REDUCTION_PER_POINT = 0.003;

/** Threat analysis threshold for bonus reduction */
const TA_REDUCTION_THRESHOLD = 25;

/** Threat analysis reduction per point above threshold */
const TA_REDUCTION_PER_POINT = 0.01;

/** Threat analysis threshold for predictive turn bias */
const PREDICTIVE_BIAS_TA_THRESHOLD = 20;

/** Rear arc angle threshold for predictive bias */
const REAR_ARC_THRESHOLD = 90;

// ─── Turn Speed ─────────────────────────────────────────────────────

/**
 * Calculate turn speed from gyroStabilizers attribute.
 *
 * Formula: 180 + gyroStabilizers × 6 (degrees/second)
 * Range: 186°/s (gyro=1) to 480°/s (gyro=50)
 */
export function calculateTurnSpeed(gyroStabilizers: number): number {
  return BASE_TURN_SPEED + gyroStabilizers * TURN_SPEED_PER_GYRO;
}

// ─── Facing Direction Update ────────────────────────────────────────

/**
 * Check if an opponent is moving toward the robot's rear arc.
 * Returns true when the opponent's velocity vector points toward
 * the area >90° from the robot's facing direction.
 */
function isMovingTowardRearArc(
  state: FacingState,
  opponent: OpponentState,
): boolean {
  // Angle of opponent's velocity
  const velMag = Math.sqrt(
    opponent.velocity.x * opponent.velocity.x +
    opponent.velocity.y * opponent.velocity.y,
  );
  if (velMag < 0.001) return false;

  const velAngle = (Math.atan2(opponent.velocity.y, opponent.velocity.x) * 180) / Math.PI;

  // Where the opponent is heading relative to the robot
  // Check if the opponent's movement would place them in the rear arc
  const rearAngle = normalizeAngle(state.facingDirection + 180);
  const diffToRear = Math.abs(normalizeAngle(velAngle - rearAngle));

  return diffToRear < REAR_ARC_THRESHOLD;
}

/**
 * Update a robot's facing direction toward a target position,
 * limited by turn speed. Optionally applies predictive turn bias
 * when threatAnalysis is high and the opponent is moving to the rear arc.
 *
 * Mutates state.facingDirection.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.6
 */
export function updateFacing(
  state: FacingState,
  targetPosition: Position,
  deltaTime: number,
  opponent?: OpponentState,
  threatAnalysis?: number,
): void {
  const desiredAngle = angleBetween(state.position, targetPosition);
  const angleDiff = normalizeAngle(desiredAngle - state.facingDirection);
  let maxTurn = state.turnSpeed * deltaTime;

  // Predictive turn bias (Req 9.6)
  const ta = threatAnalysis ?? 0;
  if (ta > PREDICTIVE_BIAS_TA_THRESHOLD && opponent) {
    if (isMovingTowardRearArc(state, opponent)) {
      const biasStrength = 0.5 + (ta - PREDICTIVE_BIAS_TA_THRESHOLD) * 0.015;
      maxTurn *= (1 + biasStrength);
    }
  }

  if (Math.abs(angleDiff) <= maxTurn) {
    state.facingDirection = desiredAngle;
  } else {
    state.facingDirection += sign(angleDiff) * maxTurn;
  }

  state.facingDirection = normalizeAngle(state.facingDirection);
}

// ─── Backstab Detection ─────────────────────────────────────────────

/**
 * Check if an attack qualifies as a backstab (1v1).
 *
 * Backstab: attacker is >120° from defender's facing direction.
 * Base bonus: +10%, reduced by defender's gyro and threatAnalysis.
 *
 * Requirements: 9.4, 9.5, 9.9
 */
export function checkBackstab(
  attacker: PositionedRobot,
  defender: PositionedRobot,
): BackstabResult {
  const attackAngle = angleBetween(defender.position, attacker.position);
  const angleDiff = Math.abs(normalizeAngle(attackAngle - defender.facingDirection));

  if (angleDiff > BACKSTAB_ANGLE_THRESHOLD) {
    const gyroReduction = defender.gyroStabilizers * BACKSTAB_GYRO_REDUCTION_PER_POINT;
    let taReduction = 0;
    if (defender.threatAnalysis > TA_REDUCTION_THRESHOLD) {
      taReduction = (defender.threatAnalysis - TA_REDUCTION_THRESHOLD) * TA_REDUCTION_PER_POINT;
    }
    const effectiveBonus = Math.max(0, BACKSTAB_BASE_BONUS - gyroReduction - taReduction);
    return { isBackstab: true, bonus: effectiveBonus, angle: angleDiff };
  }

  return { isBackstab: false, bonus: 0, angle: angleDiff };
}

// ─── Flanking Detection ─────────────────────────────────────────────

/**
 * Check if an attack is a flanking attack (team battles).
 *
 * Flanking: a teammate engaging the same defender stands more than 90° away
 * from the attacker, measured around the defender. The bonus comes from the
 * attacker's formationTactics, 20% × √(formationTactics / 50), reduced by the
 * defender's gyroStabilizers (0.3% per point) and threatAnalysis (1% per point
 * above 25). Without an engaging teammate there is no flank.
 *
 * Requirements: 9.7, 9.8, 9.9
 */
export function checkFlanking(
  attacker: PositionedRobot,
  attackerFormationTactics: number,
  engagingTeammates: readonly PositionedRobot[],
  defender: PositionedRobot,
): FlankingResult {
  const attackerAngle = angleBetween(defender.position, attacker.position);
  const flanked = engagingTeammates.some((mate) =>
    Math.abs(normalizeAngle(angleBetween(defender.position, mate.position) - attackerAngle)) > FLANKING_ANGLE_THRESHOLD,
  );
  if (!flanked) return { isFlanking: false, bonus: 0 };

  const gyroReduction = defender.gyroStabilizers * FLANKING_GYRO_REDUCTION_PER_POINT;
  const taReduction = defender.threatAnalysis > TA_REDUCTION_THRESHOLD
    ? (defender.threatAnalysis - TA_REDUCTION_THRESHOLD) * TA_REDUCTION_PER_POINT
    : 0;
  const formation = Math.min(Math.max(attackerFormationTactics, 0), FLANKING_ATTRIBUTE_CAP);
  const baseBonus = FLANKING_MAX_BONUS * Math.sqrt(formation / FLANKING_ATTRIBUTE_CAP);
  return { isFlanking: true, bonus: Math.max(0, baseBonus - gyroReduction - taReduction) };
}
