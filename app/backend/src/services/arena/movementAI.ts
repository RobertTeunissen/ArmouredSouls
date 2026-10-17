/**
 * Movement AI Decision Framework
 *
 * Calculates movement intent per robot per tick based on combatAlgorithms,
 * threatAnalysis, weapon loadout, and combat stance. Handles preferred range
 * calculation, movement prediction, threat-aware positioning, patience timer,
 * the wall-aware kiting path (Season 2 round 3, #538: a kiter near the wall
 * circles away from its chaser, see wallAwareKiting.ts), movement application,
 * and team separation enforcement.
 *
 * All functions are pure with no module-level mutable state.
 *
 * Requirements: 5.1–5.7, 10.1–10.10
 */

import {
  Position,
  Vector2D,
  euclideanDistance,
  normalizeVector,
  rotateVector,
  lerp,
} from './vector2d';
import {
  ArenaConfig,
  GameModeState,
  MovementIntent,
  MovementIntentModifier,
  RobotCombatState,
  RangeBand,
} from './types';
import { getWeaponOptimalRange, WeaponLike } from './rangeBands';
import { BattleError, BattleErrorCode } from '../../errors/battleErrors';
import { clampToArena } from './arenaLayout';
import type { MovementMode } from './servoStrain';
import { planWallAwareKitingStep, WALL_KITING_MARGIN } from './wallAwareKiting';

/** Extended weapon shape with DPS fields needed for range preference */
interface WeaponWithDPS extends WeaponLike {
  baseDamage: number;
  cooldown: number;
}

// ─── Constants ──────────────────────────────────────────────────────

/** Range band midpoints for positioning targets (grid units) */
export const RANGE_BAND_MIDPOINTS: Record<RangeBand, number> = {
  melee: 1,
  short: 4.5,
  mid: 9.5,
  long: 16,
};

/** Patience timer bounds */
const PATIENCE_MAX_SECONDS = 15;
const PATIENCE_SCORE_FACTOR = 5;

/** Minimum team separation in grid units (prevents clumping on same target position) */
const MIN_TEAM_SEPARATION = 3;

/** Maximum random deviation (degrees) at CA=1; linearly decreases to 5° at CA=50 */
const DEVIATION_MAX = 30;
const DEVIATION_MIN = 5;

/** Prediction look-ahead time in seconds */
const PREDICTION_LOOK_AHEAD = 1.5;

/** Movement modes that take the wall-aware kiting path near the wall (Season 2 round 3) */
const KITING_MODES: ReadonlySet<MovementMode> = new Set<MovementMode>(['kiting', 'ranged_kiting', 'ranged_disengage']);

// ─── Preferred Range ────────────────────────────────────────────────

/**
 * Determine the preferred range band for a robot based on its loadout.
 *
 * - Single / weapon+shield / two-handed: use main weapon's optimal range
 * - Dual-wield same range: use that range
 * - Dual-wield mixed: DPS-weighted compromise, dynamically adjusted
 *   when combatAlgorithmScore > 0.5 based on opponent shield state
 *
 * Req 10.1–10.5
 */
export function getPreferredRange(state: RobotCombatState): RangeBand {
  const mainWeapon = state.robot.mainWeapon?.weapon as WeaponWithDPS | undefined;
  const offhandWeapon = state.robot.offhandWeapon?.weapon as WeaponWithDPS | undefined;
  const loadout = state.robot.loadoutType;

  // Every robot in combat is armed (battle-time readiness gate).
  if (!mainWeapon) {
    throw new BattleError(BattleErrorCode.ROBOT_NOT_BATTLE_READY, 'Robot has no main weapon in combat', 500, { robotId: state.robot.id });
  }

  // Dual wield with both weapons
  if (loadout === 'dual_wield' && offhandWeapon) {
    const mainRange = getWeaponOptimalRange(mainWeapon);
    const offhandRange = getWeaponOptimalRange(offhandWeapon);

    if (mainRange === offhandRange) return mainRange;

    // Mixed loadout: DPS-weighted compromise (Req 10.4)
    const mainDPS = mainWeapon.baseDamage / Math.max(mainWeapon.cooldown, 1);
    const offhandDPS = offhandWeapon.baseDamage / Math.max(offhandWeapon.cooldown, 1);
    const totalDPS = mainDPS + offhandDPS;
    const mainWeight = totalDPS > 0 ? mainDPS / totalDPS : 0.5;

    // Dynamic adjustment for high combat algorithm score (Req 10.5)
    // is applied in calculateMovementIntent via getEngagementRange
    // where opponent state is available.

    return mainWeight >= 0.5 ? mainRange : offhandRange;
  }

  // Single, weapon+shield, two-handed (and any other loadout): main weapon range
  return getWeaponOptimalRange(mainWeapon);
}

/**
 * Engagement range: the DPS-weighted preferred range with dynamic adjustment
 * based on opponent shield state. Drives movement intent and, since #520, the
 * robot's engagement role (`getEngagementRole`) and kiting midpoint.
 */
export function getEngagementRange(
  state: RobotCombatState,
  opponent: RobotCombatState | null,
): RangeBand {
  const mainWeapon = state.robot.mainWeapon?.weapon as WeaponWithDPS | undefined;
  const offhandWeapon = state.robot.offhandWeapon?.weapon as WeaponWithDPS | undefined;
  const loadout = state.robot.loadoutType;

  if (loadout !== 'dual_wield' || !mainWeapon || !offhandWeapon) {
    return getPreferredRange(state);
  }

  const mainRange = getWeaponOptimalRange(mainWeapon);
  const offhandRange = getWeaponOptimalRange(offhandWeapon);
  if (mainRange === offhandRange) return mainRange;

  const mainDPS = mainWeapon.baseDamage / Math.max(mainWeapon.cooldown, 1);
  const offhandDPS = offhandWeapon.baseDamage / Math.max(offhandWeapon.cooldown, 1);
  const totalDPS = mainDPS + offhandDPS;
  let mainWeight = totalDPS > 0 ? mainDPS / totalDPS : 0.5;

  // Dynamic adjustment (Req 10.5)
  if (state.combatAlgorithmScore > 0.5 && opponent) {
    if (opponent.currentShield <= 0) {
      // Shield depleted: bias toward melee for burst
      mainWeight = Math.max(mainWeight, 0.7);
    } else if (opponent.currentShield > opponent.maxShield * 0.5) {
      // Strong shields: bias toward ranged for chip
      mainWeight = Math.min(mainWeight, 0.3);
    }
  }

  return mainWeight >= 0.5 ? mainRange : offhandRange;
}

// ─── Patience Timer ─────────────────────────────────────────────────

/**
 * Calculate the patience timer limit in seconds.
 * Formula: 15 - combatAlgorithmScore × 5
 * Range: 10s (score=1.0) to 15s (score=0.0) — a higher score shortens the wait.
 *
 * Not used to gate attacks since #518: patience never lets a weapon attack beyond
 * its physical reach. Since #520 it drives the engagement cycle: a melee robot that
 * has not landed a hit within this window commits (melee commit burst), and it is
 * the cooldown after a ranged robot's disengage burst. Patience resets on a landed hit.
 *
 * Req 5.7
 */
export function getPatienceLimit(combatAlgorithmScore: number): number {
  return PATIENCE_MAX_SECONDS - combatAlgorithmScore * PATIENCE_SCORE_FACTOR;
}

// ─── Movement Intent Calculation ────────────────────────────────────

/**
 * Calculate the target position at the preferred range from the opponent.
 * Returns a position along the line from robot to opponent at the desired distance.
 */
function calculateOptimalRangePosition(
  robotPos: Position,
  opponentPos: Position,
  preferredRange: RangeBand,
): Position {
  const targetDistance = RANGE_BAND_MIDPOINTS[preferredRange];
  const dx = opponentPos.x - robotPos.x;
  const dy = opponentPos.y - robotPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) {
    // Already on top of opponent, move away to preferred range
    return { x: robotPos.x + targetDistance, y: robotPos.y };
  }

  // Position at targetDistance from opponent, along the robot→opponent line
  const nx = dx / dist;
  const ny = dy / dist;
  return {
    x: opponentPos.x - nx * targetDistance,
    y: opponentPos.y - ny * targetDistance,
  };
}

/**
 * Apply avoidance bias to steer away from the opponent's optimal range.
 * Shifts the target position perpendicular to the opponent direction.
 */
function applyAvoidanceBias(
  targetPos: Position,
  robotPos: Position,
  opponentPos: Position,
  avoidanceWeight: number,
): Position {
  // Perpendicular offset to the robot→opponent line
  const dx = opponentPos.x - robotPos.x;
  const dy = opponentPos.y - robotPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return targetPos;

  // Perpendicular direction (rotate 90°)
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const offset = avoidanceWeight * 3; // Scale avoidance

  return {
    x: targetPos.x + perpX * offset,
    y: targetPos.y + perpY * offset,
  };
}

/**
 * Bias movement toward the opponent's flank (side/rear).
 */
function biasTowardFlank(
  targetPos: Position,
  opponentPos: Position,
  opponentFacing: number,
): Position {
  // Move toward 90° offset from opponent's facing direction
  const flankAngle = opponentFacing + 90;
  const rad = (flankAngle * Math.PI) / 180;
  const flankOffset = 2;

  return {
    x: targetPos.x + Math.cos(rad) * flankOffset,
    y: targetPos.y + Math.sin(rad) * flankOffset,
  };
}

/**
 * Generate a deterministic pseudo-random deviation based on state.
 * Uses a simple hash of position and time to avoid true randomness
 * while still producing varied movement patterns.
 */
function deterministicDeviation(
  position: Position,
  patienceTimer: number,
  maxDeg: number,
): number {
  // Simple hash combining position and timer for deterministic but varied output
  const hash = Math.sin(position.x * 12.9898 + position.y * 78.233 + patienceTimer * 43.758);
  const normalized = hash - Math.floor(hash); // 0..1
  return (normalized * 2 - 1) * maxDeg; // -maxDeg..+maxDeg
}

/**
 * Calculate movement intent for a robot based on its AI attributes,
 * weapon loadout, opponents, and arena configuration.
 *
 * Strategy selection based on combatAlgorithms score:
 * - < 0.3: random_bias (semi-random, ±30° deviation)
 * - 0.3–0.6: direct_path (±15° deviation)
 * - > 0.6: calculated_path (no deviation, prediction + threat awareness)
 *
 * `deltaTime` is the tick length in seconds; pursuit uses it to project the
 * target's end-of-tick position.
 *
 * Req 5.1–5.6, 10.1–10.10
 */
export function calculateMovementIntent(
  state: RobotCombatState,
  opponents: RobotCombatState[],
  arena: ArenaConfig,
  deltaTime: number,
  movementModifier?: MovementIntentModifier,
  gameState?: GameModeState,
): MovementIntent {
  const score = state.combatAlgorithmScore;
  const ta = state.robot.threatAnalysis
    ? Number(state.robot.threatAnalysis)
    : 1;

  // Find primary target (nearest living opponent, or current target)
  // Note: callers already pass only alive opponents — no need to re-filter
  const target = opponents.length > 0
    ? opponents.reduce((closest, opp) => {
        const distA = euclideanDistance(state.position, closest.position);
        const distB = euclideanDistance(state.position, opp.position);
        return distB < distA ? opp : closest;
      })
    : null;

  if (!target) {
    // No living opponents — stay put (unless a game mode modifier overrides)
    let intent: MovementIntent = {
      targetPosition: state.position,
      strategy: 'direct_path',
      preferredRange: getPreferredRange(state),
      stanceSpeedModifier: getStanceModifier(state),
    };
    if (movementModifier) {
      intent = movementModifier.modify(intent, state, arena, gameState);
    }
    return intent;
  }

  const preferredRange = getEngagementRange(state, target);
  const currentDistToTarget = euclideanDistance(state.position, target.position);
  const isMelee = preferredRange === 'melee';
  const isMeleeOutOfRange = isMelee && currentDistToTarget > 2;
  const meleeFinalApproachFactor = isMelee && currentDistToTarget <= 4
    ? Math.max(0, (currentDistToTarget - 2) / 2)
    : 1;
  const targetPrefersMelee = getPreferredRange(target) === 'melee';
  // Pursuit (#520 movement fix): a melee-role robot outside reach of a target
  // that does not itself prefer melee heads for the target's projected
  // end-of-tick position (position + velocity × tick) instead of a standoff
  // point 1 unit short of where the target is now. The standoff point lies
  // within one step whenever the gap is small, so the pursuer used to stop
  // short every tick and a kiter faster than 1 unit per tick stayed out of
  // reach. Aiming at the projected position closes at full effective speed;
  // the gap then shrinks by exactly the speed difference. Within reach the
  // standoff applies again. Melee mirrors keep the standoff (#467).
  const isPursuing = isMeleeOutOfRange && !targetPrefersMelee;
  let targetPos = isPursuing
    ? {
        x: target.position.x + target.velocity.x * deltaTime,
        y: target.position.y + target.velocity.y * deltaTime,
      }
    : calculateOptimalRangePosition(
        state.position,
        target.position,
        preferredRange,
      );

  let strategy: MovementIntent['strategy'];

  // Linear deviation: 30° at CA=1, 5° at CA=50 (every point of CA tightens pathing)
  // Melee robots get reduced deviation — they need direct paths to reach the
  // narrow 2-unit melee range window. Deviation at range causes orbiting.
  // Within 4 units of target (the "final approach"), deviation further tapers
  // linearly to zero at distance ≤ 2, preventing the orbital lock that occurs
  // when two melee robots circle each other just outside melee range.
  const ca = state.robot.combatAlgorithms ? Number(state.robot.combatAlgorithms) : 1;
  const baseDeviation = DEVIATION_MAX - ((ca - 1) / 49) * (DEVIATION_MAX - DEVIATION_MIN);
  const deviationScale = isMelee
    ? 0.3 * meleeFinalApproachFactor
    : preferredRange === 'short' ? 0.6 : 1.0;
  const deviation = deterministicDeviation(
    state.position,
    state.patienceTimer,
    baseDeviation * deviationScale,
  );

  // Strategy label for logging (derived from score, no behavioral gates)
  if (score < 0.3) {
    strategy = 'random_bias';
  } else if (score <= 0.6) {
    strategy = 'direct_path';
  } else {
    strategy = 'calculated_path';
  }

  // Apply deviation to movement direction
  const dir: Vector2D = {
    x: targetPos.x - state.position.x,
    y: targetPos.y - state.position.y,
  };
  const rotated = rotateVector(dir, deviation);
  targetPos = {
    x: state.position.x + rotated.x,
    y: state.position.y + rotated.y,
  };

  // Movement prediction — linear weight from 0 at CA=1 to 1.0 at CA=50.
  // Do not predict a melee target during the final approach: prediction follows
  // tangential velocity and can pull a melee robot around the opponent instead
  // of into the ≤2-unit attack radius, recreating the orbital deadlock this
  // module's final-approach taper is intended to prevent.
  // This also applies while already in melee range: prediction must not move a
  // robot back out of the radius it can currently attack from.
  // In a melee mirror match prediction is off at every distance (#467): each
  // robot leads the other's tangential velocity, so two melee robots can circle
  // at ~8 units for the whole battle and draw on the time limit without ever
  // entering the final approach. Against a ranged target prediction stays on,
  // because there it helps cut off a retreating opponent.
  const predictionWeight = isMelee && (currentDistToTarget <= 4 || targetPrefersMelee)
    ? 0
    : (ca - 1) / 49;
  if (predictionWeight > 0) {
    const predictedPos: Position = {
      x: target.position.x + target.velocity.x * PREDICTION_LOOK_AHEAD,
      y: target.position.y + target.velocity.y * PREDICTION_LOOK_AHEAD,
    };
    const optimalFromPredicted = calculateOptimalRangePosition(
      state.position,
      predictedPos,
      preferredRange,
    );
    targetPos = lerp(targetPos, optimalFromPredicted, predictionWeight);
  }

  // Threat-aware avoidance — linear weight: ta/50 (always active, weak at low TA).
  // Melee robots use the final-approach taper at every distance. Outside melee
  // range the base is reduced so closing takes priority; inside melee range the
  // taper reaches zero and cannot push the robot back out of attack range.
  let avoidanceWeight: number;
  if (isMelee) {
    const baseAvoidance = isMeleeOutOfRange ? (ta / 50) * 0.2 : ta / 50;
    avoidanceWeight = baseAvoidance * meleeFinalApproachFactor;
  } else {
    avoidanceWeight = ta / 50;
  }
  if (avoidanceWeight > 0.01) {
    targetPos = applyAvoidanceBias(
      targetPos,
      state.position,
      target.position,
      avoidanceWeight,
    );
  }

  // Flank approach — linear weight: ta/50, requires speed advantage.
  // As with avoidance, melee robots taper flank bias at every distance so a
  // faster melee robot cannot be steered back outside its attack radius.
  let flankWeight: number;
  if (isMelee) {
    const baseFlank = isMeleeOutOfRange ? (ta / 50) * 0.2 : ta / 50;
    flankWeight = baseFlank * meleeFinalApproachFactor;
  } else {
    flankWeight = ta / 50;
  }
  if (flankWeight > 0.01) {
    const robotSpeed = state.effectiveMovementSpeed;
    const targetSpeed = target.effectiveMovementSpeed;
    if (robotSpeed > targetSpeed) {
      const flankPos = biasTowardFlank(
        targetPos,
        target.position,
        target.facingDirection,
      );
      targetPos = lerp(targetPos, flankPos, flankWeight);
    }
  }

  // Stance bias (Req 10.6, 10.7)
  const stance = state.robot.stance ?? 'balanced';
  if (stance === 'defensive') {
    // Bias toward maintaining current distance — but NOT when a melee-role robot
    // (engagement range melee, #520) is outside its weapon range. A defensive
    // melee robot still needs to close to melee range (≤2 units) to attack at all.
    const currentDist = euclideanDistance(state.position, target.position);
    const targetDist = euclideanDistance(targetPos, target.position);
    const outsideMeleeRange = currentDist > 2;
    if (targetDist < currentDist && !(isMelee && outsideMeleeRange)) {
      // Reduce closing tendency (only when already in weapon range or ranged)
      targetPos = lerp(targetPos, state.position, 0.3);
    }
  } else if (stance === 'offensive') {
    // Bias toward closing distance
    targetPos = lerp(targetPos, target.position, 0.15);
  }

  // Wall-aware kiting path (Season 2 round 3, #538): a kiter whose step would
  // end near the wall circles away from its chaser instead of stalling against
  // the wall. Reads only this robot's state and the chaser's tick-start
  // position and velocity (simultaneous movement, #520).
  if (KITING_MODES.has(state.movementMode)) {
    const stepLength = state.effectiveMovementSpeed * deltaTime;
    const stepX = targetPos.x - state.position.x;
    const stepY = targetPos.y - state.position.y;
    const stepDist = Math.sqrt(stepX * stepX + stepY * stepY);
    const ratio = stepDist > stepLength ? stepLength / stepDist : 1;
    const stepEnd: Position = { x: state.position.x + stepX * ratio, y: state.position.y + stepY * ratio };
    if (euclideanDistance(stepEnd, arena.center) > arena.radius - WALL_KITING_MARGIN) {
      targetPos = planWallAwareKitingStep({
        position: state.position,
        velocity: state.velocity,
        chaserPosition: target.position,
        chaserVelocity: target.velocity,
        stepLength,
        arena,
        deltaTime,
      });
    }
  }

  let intent: MovementIntent = {
    targetPosition: targetPos,
    strategy,
    preferredRange,
    stanceSpeedModifier: getStanceModifier(state),
  };

  // Apply extensibility modifier if provided (Req 16.6)
  if (movementModifier) {
    intent = movementModifier.modify(intent, state, arena, gameState);
  }

  return intent;
}

// ─── Movement Application ───────────────────────────────────────────

/** Below this length a tangent is treated as zero (purely radial step) */
const TANGENT_EPSILON = 1e-9;

/** Relative tolerance for treating a position as on (not outside) the arena wall */
const WALL_EPSILON = 1e-9;

/**
 * Apply movement intent to a robot's position, keeping it inside the arena.
 *
 * Moves the robot toward the intent's target position by up to
 * (effectiveSpeed × deltaTime) units. Returns the new position.
 *
 * Wall-aware retreat (#520): when the step would leave the arena, the robot
 * moves along the step up to the wall and spends the rest of
 * `effectiveSpeed × deltaTime` sliding along the wall's tangent instead of
 * getting stuck. For a purely radial step the slide direction is the tangent
 * that continues the robot's tick-start velocity (#538: no back-and-forth
 * dither along the wall); without a tangential velocity component it is the
 * one that ends farther from `threatPosition` (tie or no threat →
 * counter-clockwise).
 * The result is always inside the arena, its displacement never exceeds
 * `effectiveSpeed × deltaTime`, and it is deterministic.
 *
 * Req 5.2, 1.7
 */
export function applyMovement(
  state: RobotCombatState,
  intent: MovementIntent,
  arena: ArenaConfig,
  deltaTime: number,
  threatPosition?: Position,
): Position {
  const maxMove = state.effectiveMovementSpeed * deltaTime;
  const pos = state.position;
  const dx = intent.targetPosition.x - pos.x;
  const dy = intent.targetPosition.y - pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  let candidate: Position;
  let step: Vector2D;

  if (dist <= maxMove || dist === 0) {
    // Can reach target this tick
    candidate = { x: intent.targetPosition.x, y: intent.targetPosition.y };
    step = { x: dx, y: dy };
  } else {
    // Move toward target by maxMove
    const ratio = maxMove / dist;
    step = { x: dx * ratio, y: dy * ratio };
    candidate = { x: pos.x + step.x, y: pos.y + step.y };
  }

  if (euclideanDistance(candidate, arena.center) <= arena.radius) {
    return candidate;
  }

  // Robot at the centre, or already outside (no in-arena start): plain clamp (Req 1.7).
  // A robot clamped onto the wall can sit a rounding error outside it; it counts as on the wall.
  const relX = pos.x - arena.center.x;
  const relY = pos.y - arena.center.y;
  const relSq = relX * relX + relY * relY;
  const radiusSq = arena.radius * arena.radius;
  if (relSq === 0 || relSq > radiusSq * (1 + WALL_EPSILON)) {
    return clampToArena(candidate, arena);
  }

  // Boundary intersection along the step: |rel + t·step| = R, t ∈ [0, 1]
  const a = step.x * step.x + step.y * step.y;
  const b = 2 * (relX * step.x + relY * step.y);
  const c = relSq - radiusSq; // ≤ 0: the robot is inside or on the wall
  const t = Math.min(1, Math.max(0, (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a)));
  const boundaryPoint: Position = { x: pos.x + step.x * t, y: pos.y + step.y * t };
  const travelled = Math.sqrt(a) * t;
  const remaining = Math.max(0, maxMove - travelled);

  // Tangent = step minus its radial component at the boundary point
  const bpX = boundaryPoint.x - arena.center.x;
  const bpY = boundaryPoint.y - arena.center.y;
  const bpLen = Math.sqrt(bpX * bpX + bpY * bpY);
  const nX = bpX / bpLen;
  const nY = bpY / bpLen;
  const radial = step.x * nX + step.y * nY;
  let tanX = step.x - radial * nX;
  let tanY = step.y - radial * nY;
  const tanLen = Math.sqrt(tanX * tanX + tanY * tanY);

  if (tanLen <= TANGENT_EPSILON) {
    // Purely radial step: keep sliding the way the robot was already moving
    // (#538), else slide the way that ends farther from the threat
    const ccw: Vector2D = { x: -nY, y: nX };
    const cw: Vector2D = { x: nY, y: -nX };
    let dir = ccw;
    const along = state.velocity.x * ccw.x + state.velocity.y * ccw.y;
    if (Math.abs(along) > TANGENT_EPSILON) {
      dir = along > 0 ? ccw : cw;
    } else if (threatPosition) {
      const ccwEnd = { x: boundaryPoint.x + ccw.x * remaining, y: boundaryPoint.y + ccw.y * remaining };
      const cwEnd = { x: boundaryPoint.x + cw.x * remaining, y: boundaryPoint.y + cw.y * remaining };
      if (euclideanDistance(cwEnd, threatPosition) > euclideanDistance(ccwEnd, threatPosition)) {
        dir = cw;
      }
    }
    tanX = dir.x;
    tanY = dir.y;
  } else {
    tanX /= tanLen;
    tanY /= tanLen;
  }

  return clampToArena(
    { x: boundaryPoint.x + tanX * remaining, y: boundaryPoint.y + tanY * remaining },
    arena,
  );
}

// ─── Team Separation ────────────────────────────────────────────────

/**
 * Enforce minimum separation between teammates.
 *
 * If the intent's target position would place the robot within
 * MIN_TEAM_SEPARATION units of any teammate, the target is pushed
 * away from the nearest teammate.
 *
 * Req 12.6
 */
export function enforceTeamSeparation(
  intent: MovementIntent,
  state: RobotCombatState,
  teammates: RobotCombatState[],
): MovementIntent {
  let adjusted = { ...intent.targetPosition };

  for (const mate of teammates) {
    if (mate === state || !mate.isAlive) continue;

    const dist = euclideanDistance(adjusted, mate.position);
    if (dist < MIN_TEAM_SEPARATION && dist > 0) {
      // Push away from teammate
      const dir = normalizeVector({
        x: adjusted.x - mate.position.x,
        y: adjusted.y - mate.position.y,
      });
      adjusted = {
        x: mate.position.x + dir.x * MIN_TEAM_SEPARATION,
        y: mate.position.y + dir.y * MIN_TEAM_SEPARATION,
      };
    } else if (dist === 0) {
      // Exactly overlapping — push in arbitrary direction
      adjusted = {
        x: adjusted.x + MIN_TEAM_SEPARATION,
        y: adjusted.y,
      };
    }
  }

  return {
    ...intent,
    targetPosition: adjusted,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Get stance speed modifier for a robot */
function getStanceModifier(state: RobotCombatState): number {
  const stance = state.robot.stance ?? 'balanced';
  if (stance === 'defensive') return -0.2;
  if (stance === 'offensive') return 0.1;
  return 0;
}
