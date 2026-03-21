/**
 * Movement AI Decision Framework
 *
 * Calculates movement intent per robot per tick based on combatAlgorithms,
 * threatAnalysis, weapon loadout, and combat stance. Handles preferred range
 * calculation, movement prediction, threat-aware positioning, patience timer,
 * movement application, and team separation enforcement.
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
import { clampToArena } from './arenaLayout';

/** Extended weapon shape with DPS fields needed for range preference */
interface WeaponWithDPS extends WeaponLike {
  baseDamage: number;
  cooldown: number;
}

// ─── Constants ──────────────────────────────────────────────────────

/** Range band midpoints for positioning targets (grid units) */
const RANGE_BAND_MIDPOINTS: Record<RangeBand, number> = {
  melee: 1,
  short: 4.5,
  mid: 9.5,
  long: 16,
};

/** Patience timer bounds */
const PATIENCE_MAX_SECONDS = 15;
const PATIENCE_SCORE_FACTOR = 5;

/** Minimum team separation in grid units */
const MIN_TEAM_SEPARATION = 1;

/** Random deviation by strategy tier (degrees) */
const DEVIATION_RANDOM_BIAS = 30;
const DEVIATION_DIRECT_PATH = 15;

/** Prediction look-ahead time in seconds */
const PREDICTION_LOOK_AHEAD = 1.5;

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

  // Single weapon, weapon+shield, or two-handed: use main weapon range
  if (loadout === 'single' || loadout === 'weapon_shield' || loadout === 'two_handed') {
    if (mainWeapon) return getWeaponOptimalRange(mainWeapon);
    return 'short';
  }

  // Dual wield
  if (loadout === 'dual_wield' && mainWeapon && offhandWeapon) {
    const mainRange = getWeaponOptimalRange(mainWeapon);
    const offhandRange = getWeaponOptimalRange(offhandWeapon);

    if (mainRange === offhandRange) return mainRange;

    // Mixed loadout: DPS-weighted compromise (Req 10.4)
    const mainDPS = mainWeapon.baseDamage / Math.max(mainWeapon.cooldown, 1);
    const offhandDPS = offhandWeapon.baseDamage / Math.max(offhandWeapon.cooldown, 1);
    const totalDPS = mainDPS + offhandDPS;
    const mainWeight = totalDPS > 0 ? mainDPS / totalDPS : 0.5;

    // Dynamic adjustment for high combat algorithm score (Req 10.5)
    // is applied in calculateMovementIntent via getPreferredRangeWithDynamic
    // where opponent state is available.

    return mainWeight >= 0.5 ? mainRange : offhandRange;
  }

  return 'short'; // Fallback
}

/**
 * Compute DPS-weighted preferred range with dynamic adjustment based on
 * opponent shield state. Used internally by calculateMovementIntent.
 */
function getPreferredRangeWithDynamic(
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
 * Range: 10s (score=1.0) to 15s (score=0.0)
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
 * Req 5.1–5.6, 10.1–10.10
 */
export function calculateMovementIntent(
  state: RobotCombatState,
  opponents: RobotCombatState[],
  arena: ArenaConfig,
  movementModifier?: MovementIntentModifier,
  gameState?: GameModeState,
): MovementIntent {
  const score = state.combatAlgorithmScore;
  const ta = state.robot.threatAnalysis
    ? Number(state.robot.threatAnalysis)
    : 1;

  // Find primary target (nearest living opponent, or current target)
  const livingOpponents = opponents.filter((o) => o.isAlive);
  const target = livingOpponents.length > 0
    ? livingOpponents.reduce((closest, opp) => {
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

  const preferredRange = getPreferredRangeWithDynamic(state, target);
  let targetPos = calculateOptimalRangePosition(
    state.position,
    target.position,
    preferredRange,
  );

  let strategy: MovementIntent['strategy'];

  if (score < 0.3) {
    // Random bias strategy (Req 5.2, 10.8)
    strategy = 'random_bias';
    const deviation = deterministicDeviation(
      state.position,
      state.patienceTimer,
      DEVIATION_RANDOM_BIAS,
    );
    const dir: Vector2D = {
      x: targetPos.x - state.position.x,
      y: targetPos.y - state.position.y,
    };
    const rotated = rotateVector(dir, deviation);
    targetPos = {
      x: state.position.x + rotated.x,
      y: state.position.y + rotated.y,
    };
  } else if (score <= 0.6) {
    // Direct path strategy (Req 5.2, 10.8)
    strategy = 'direct_path';
    const deviation = deterministicDeviation(
      state.position,
      state.patienceTimer,
      DEVIATION_DIRECT_PATH,
    );
    const dir: Vector2D = {
      x: targetPos.x - state.position.x,
      y: targetPos.y - state.position.y,
    };
    const rotated = rotateVector(dir, deviation);
    targetPos = {
      x: state.position.x + rotated.x,
      y: state.position.y + rotated.y,
    };
  } else {
    // Calculated path strategy (Req 5.2)
    strategy = 'calculated_path';

    // Movement prediction (Req 5.3)
    if (score >= 0.4) {
      const predictionWeight = (score - 0.4) / 0.6;
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

    // Threat-aware positioning (Req 6.3)
    if (ta > 15) {
      const avoidanceWeight = (ta - 15) / 35;
      targetPos = applyAvoidanceBias(
        targetPos,
        state.position,
        target.position,
        avoidanceWeight,
      );
    }

    // Flank approach bias (Req 10.9)
    if (ta > 20) {
      const robotSpeed = state.effectiveMovementSpeed;
      const targetSpeed = target.effectiveMovementSpeed;
      if (robotSpeed > targetSpeed) {
        targetPos = biasTowardFlank(
          targetPos,
          target.position,
          target.facingDirection,
        );
      }
    }
  }

  // Stance bias (Req 10.6, 10.7)
  const stance = state.robot.stance ?? 'balanced';
  if (stance === 'defensive') {
    // Bias toward maintaining current distance
    const currentDist = euclideanDistance(state.position, target.position);
    const targetDist = euclideanDistance(targetPos, target.position);
    if (targetDist < currentDist) {
      // Reduce closing tendency
      targetPos = lerp(targetPos, state.position, 0.3);
    }
  } else if (stance === 'offensive') {
    // Bias toward closing distance
    targetPos = lerp(targetPos, target.position, 0.15);
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

/**
 * Apply movement intent to a robot's position, clamping to arena boundary.
 *
 * Moves the robot toward the intent's target position by up to
 * (effectiveSpeed × deltaTime) units. Returns the new position.
 *
 * Req 5.2, 1.7
 */
export function applyMovement(
  state: RobotCombatState,
  intent: MovementIntent,
  arena: ArenaConfig,
  deltaTime: number,
): Position {
  const maxMove = state.effectiveMovementSpeed * deltaTime;
  const dx = intent.targetPosition.x - state.position.x;
  const dy = intent.targetPosition.y - state.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  let newPos: Position;

  if (dist <= maxMove || dist === 0) {
    // Can reach target this tick
    newPos = { x: intent.targetPosition.x, y: intent.targetPosition.y };
  } else {
    // Move toward target by maxMove
    const ratio = maxMove / dist;
    newPos = {
      x: state.position.x + dx * ratio,
      y: state.position.y + dy * ratio,
    };
  }

  // Clamp to arena boundary (Req 1.7)
  return clampToArena(newPos, arena);
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
