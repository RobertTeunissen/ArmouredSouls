/**
 * King of the Hill Engine — Core zone mechanics, scoring, and match configuration.
 *
 * Implements the KotH game mode as pluggable strategy objects consumed by
 * the existing combatSimulator.ts via the GameModeConfig extensibility layer.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.5, 3.1–3.7, 11.4, 11.5
 */

import { Position, euclideanDistance, lerp, normalizeVector } from './vector2d';
import type {
  ArenaConfig,
  ArenaZone,
  CombatEvent,
  GameModeConfig,
  GameModeState,
  MovementIntent,
  MovementIntentModifier,
  RobotCombatState,
  TargetPriorityStrategy,
  WinConditionEvaluator,
} from './types';

// ─── Seeded PRNG ────────────────────────────────────────────────────

/**
 * Mulberry32 — a simple seeded 32-bit PRNG.
 * Returns a function that produces deterministic floats in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── KotH Match Configuration ───────────────────────────────────────

/** KotH match configuration provided by the orchestrator */
export interface KothMatchConfig {
  scoreThreshold?: number;    // default 30, range [15, 90]
  timeLimit?: number;         // default 150s, range [60, 300]
  zoneRadius?: number;        // default 5, range [3, 8]
  rotatingZone?: boolean;     // default false
  participantCount: number;   // 5 or 6
  matchId: number;            // for deterministic zone rotation seed
}

// ─── KotH Zone State ────────────────────────────────────────────────

/** Runtime state of the control zone during a match */
export interface KothZoneState {
  center: Position;
  radius: number;
  isActive: boolean;           // false during transition period
  transitionTarget?: Position; // next zone position (rotating variant)
  transitionCountdown?: number;
  rotationCount: number;
  rotationTimer?: number;      // tracks time since last rotation
  transitionTimer?: number;    // tracks time during the 3s inactive transition period
}

// ─── Zone Occupation Result ─────────────────────────────────────────

/** Result of evaluating which robots occupy the zone */
export interface ZoneOccupationResult {
  occupants: number[];
  state: 'uncontested' | 'contested' | 'empty';
}

// ─── Config Validation Result ───────────────────────────────────────

/** Result of validating a KotH match configuration */
export interface KothConfigValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── KotH Score State ───────────────────────────────────────────────

/** Runtime scoring state tracked throughout a KotH match */
export interface KothScoreState {
  zoneScores: Record<number, number>;        // robotId → cumulative score
  zoneOccupants: Set<number>;                // robotIds currently in zone
  zoneOccupationTime: Record<number, number>;// robotId → total seconds in zone
  uncontestedTime: Record<number, number>;   // robotId → seconds of uncontested control
  passiveTimers: Record<number, number>;     // robotId → consecutive seconds outside zone
  passivePenalties: Record<number, { damageReduction: number; accuracyPenalty: number }>;
  eliminatedRobots: Set<number>;             // robotIds permanently eliminated
  eliminationScores: Record<number, number>; // robotId → score at elimination time
  killCounts: Record<number, number>;        // robotId → kills in this match
  nameMap: Record<number, string>;           // robotId → robot name for messages
  lastStandingPhase: boolean;
  lastStandingTimer: number;
  lastStandingRobotId: number | null;
}

// ─── KotH Combat Event ─────────────────────────────────────────────

/** KotH-specific event types extending the base CombatEvent */
export type KothEventType =
  | 'zone_defined'
  | 'zone_enter'
  | 'zone_exit'
  | 'score_tick'
  | 'kill_bonus'
  | 'zone_moving'
  | 'zone_active'
  | 'robot_eliminated'
  | 'passive_warning'
  | 'passive_penalty'
  | 'last_standing'
  | 'match_end';

/** Placement entry for final match results */
export interface KothPlacement {
  robotId: number;
  placement: number;
  zoneScore: number;
  zoneOccupationTime: number;
  totalDamageDealt: number;
}

/** Combat event with KotH-specific type support — now a type alias since CombatEvent includes KotH types */
export type KothCombatEvent = CombatEvent;

// ─── Constants ──────────────────────────────────────────────────────

export const KOTH_PASSIVE_PENALTIES = {
  warningThreshold: 20,
  penaltyThreshold: 30,
  damageReductionPerInterval: 0.03,
  damageReductionInterval: 5,
  damageReductionCap: 0.30,
  accuracyPenaltyThreshold: 60,
  accuracyPenalty: 0.15,
  penaltyDecayTime: 3,
} as const;

export const KOTH_MATCH_DEFAULTS = {
  scoreThreshold: 30,
  timeLimit: 150,
  zoneRadius: 5,
  arenaRadius: 14,
  killBonus: 5,
  rotatingZoneScoreThreshold: 45,
  rotatingZoneTimeLimit: 210,
  rotatingZoneInterval: 30,
  zoneTransitionDuration: 3,
  zoneWarningTime: 5,
  lastStandingDuration: 10,
} as const;

// ─── Zone Management ────────────────────────────────────────────────

/**
 * Create the control zone ArenaZone for a KotH match.
 *
 * Returns an ArenaZone with effect 'control_point', centered at {x:0, y:0},
 * with the configured radius (default 5, constrained to [3, 8]).
 *
 * Requirements: 1.1, 1.5
 */
export function createControlZone(config: KothMatchConfig): ArenaZone {
  const rawRadius = config.zoneRadius ?? KOTH_MATCH_DEFAULTS.zoneRadius;
  const radius = Math.min(8, Math.max(3, rawRadius));

  return {
    id: 'koth_control_zone',
    center: { x: 0, y: 0 },
    radius,
    effect: 'control_point',
  };
}

// ─── Spawn Positioning ──────────────────────────────────────────────

/**
 * Calculate evenly-spaced spawn positions around the arena perimeter.
 *
 * Robots are placed at (arenaRadius - 2) distance from center with equal
 * angular spacing: 72° for 5 participants, 60° for 6 participants.
 * The first robot spawns at angle 0 (positive x-axis).
 *
 * Requirements: 1.3
 */
export function calculateSpawnPositions(
  participantCount: number,
  arenaRadius: number,
): Position[] {
  const spawnDistance = arenaRadius - 2;
  const angleStep = (2 * Math.PI) / participantCount;
  const positions: Position[] = [];

  for (let i = 0; i < participantCount; i++) {
    const angle = i * angleStep;
    positions.push({
      x: Math.round(spawnDistance * Math.cos(angle) * 1000) / 1000,
      y: Math.round(spawnDistance * Math.sin(angle) * 1000) / 1000,
    });
  }

  return positions;
}

// ─── Config Validation ──────────────────────────────────────────────

/**
 * Validate a KotH match configuration.
 *
 * Checks:
 *  - participantCount must be between 5 and 7
 *  - scoreThreshold (if provided) must be in [15, 90]
 *  - timeLimit (if provided) must be in [60, 300]
 *  - zoneRadius (if provided) must be in [3, 8]
 *
 * Returns { valid, errors[] } with descriptive messages for each violation.
 *
 * Requirements: 11.4, 11.5
 */
export function validateKothConfig(config: KothMatchConfig): KothConfigValidationResult {
  const errors: string[] = [];

  if (config.participantCount < 5 || config.participantCount > 7) {
    errors.push(
      `participantCount must be between 5 and 7, got ${config.participantCount}`,
    );
  }

  if (
    config.scoreThreshold !== undefined &&
    (config.scoreThreshold < 15 || config.scoreThreshold > 90)
  ) {
    errors.push(
      `scoreThreshold must be between 15 and 90, got ${config.scoreThreshold}`,
    );
  }

  if (
    config.timeLimit !== undefined &&
    (config.timeLimit < 60 || config.timeLimit > 300)
  ) {
    errors.push(
      `timeLimit must be between 60 and 300 seconds, got ${config.timeLimit}`,
    );
  }

  if (
    config.zoneRadius !== undefined &&
    (config.zoneRadius < 3 || config.zoneRadius > 8)
  ) {
    errors.push(
      `zoneRadius must be between 3 and 8 grid units, got ${config.zoneRadius}`,
    );
  }

  return { valid: errors.length === 0, errors };
}

// ─── Zone Occupation Detection ──────────────────────────────────────

/**
 * Evaluate which robots currently occupy the control zone.
 *
 * Computes Euclidean distance from each alive robot's position to the zone
 * center. A robot occupies the zone when distance <= zone radius.
 *
 * Returns the set of occupant robot IDs and the zone state:
 *  - 'uncontested' — exactly one robot inside
 *  - 'contested'   — two or more robots inside
 *  - 'empty'       — no robots inside
 *
 * Requirements: 2.1, 2.2, 2.5
 */
export function evaluateZoneOccupation(
  robots: RobotCombatState[],
  zone: KothZoneState,
): ZoneOccupationResult {
  const occupants: number[] = [];

  for (const robot of robots) {
    if (!robot.isAlive) continue;

    const distance = euclideanDistance(robot.position, zone.center);
    if (distance <= zone.radius) {
      occupants.push(robot.robot.id);
    }
  }

  let state: ZoneOccupationResult['state'];
  if (occupants.length === 0) {
    state = 'empty';
  } else if (occupants.length === 1) {
    state = 'uncontested';
  } else {
    state = 'contested';
  }

  return { occupants, state };
}

// ─── Score State Factory ────────────────────────────────────────────

/**
 * Create an initial KothScoreState for a set of robot IDs.
 *
 * All scores, timers, and counters start at zero.
 */
export function createKothScoreState(robotIds: number[]): KothScoreState {
  const zoneScores: Record<number, number> = {};
  const zoneOccupationTime: Record<number, number> = {};
  const uncontestedTime: Record<number, number> = {};
  const passiveTimers: Record<number, number> = {};
  const passivePenalties: Record<number, { damageReduction: number; accuracyPenalty: number }> = {};
  const killCounts: Record<number, number> = {};

  for (const id of robotIds) {
    zoneScores[id] = 0;
    zoneOccupationTime[id] = 0;
    uncontestedTime[id] = 0;
    passiveTimers[id] = 0;
    passivePenalties[id] = { damageReduction: 0, accuracyPenalty: 0 };
    killCounts[id] = 0;
  }

  return {
    zoneScores,
    zoneOccupants: new Set(),
    zoneOccupationTime,
    uncontestedTime,
    passiveTimers,
    passivePenalties,
    eliminatedRobots: new Set(),
    eliminationScores: {},
    killCounts,
    nameMap: {},
    lastStandingPhase: false,
    lastStandingTimer: 0,
    lastStandingRobotId: null,
  };
}

// ─── Scoring System ─────────────────────────────────────────────────

/**
 * Accumulated game time tracker for score_tick event emission.
 * Tracks fractional seconds so we emit a score_tick every 1s of game time.
 */
let _scoreTickAccumulator: Record<string, number> = {};

/**
 * Reset the score tick accumulator (useful for testing).
 */
export function resetScoreTickAccumulator(): void {
  _scoreTickAccumulator = {};
}

/**
 * Tick the scoring system for a single simulation step.
 *
 * Awards 0.1 points per tick (1 pt/sec at 10 ticks/sec) when the zone is
 * in uncontested state. Awards 0 points when contested or empty.
 *
 * Emits a `score_tick` event every 1 second of accumulated game time.
 *
 * Mutates `scoreState` in place (zoneScores, zoneOccupants,
 * zoneOccupationTime, uncontestedTime).
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5, 3.6
 */
export function tickScoring(
  scoreState: KothScoreState,
  zoneState: KothZoneState,
  occupationResult: ZoneOccupationResult,
  deltaTime: number,
): KothCombatEvent[] {
  const events: KothCombatEvent[] = [];

  // Update zone occupants set
  scoreState.zoneOccupants = new Set(occupationResult.occupants);

  // Track zone occupation time for all occupants
  for (const robotId of occupationResult.occupants) {
    scoreState.zoneOccupationTime[robotId] =
      Math.round(((scoreState.zoneOccupationTime[robotId] ?? 0) + deltaTime) * 1e6) / 1e6;
  }

  // Award points only in uncontested state (Req 3.1)
  // No points for contested (Req 3.2) or empty (Req 3.3)
  if (occupationResult.state === 'uncontested' && zoneState.isActive) {
    const robotId = occupationResult.occupants[0];
    const pointsThisTick = deltaTime; // 0.1 per tick at 10Hz = 1 pt/sec
    scoreState.zoneScores[robotId] =
      Math.round(((scoreState.zoneScores[robotId] ?? 0) + pointsThisTick) * 1e6) / 1e6;

    // Track uncontested time
    scoreState.uncontestedTime[robotId] =
      Math.round(((scoreState.uncontestedTime[robotId] ?? 0) + deltaTime) * 1e6) / 1e6;
  }

  // Emit score_tick event every 1 second of game time (Req 3.6)
  // Use rounding to avoid IEEE 754 drift (10 × 0.1 ≠ 1.0 exactly)
  const accKey = 'global';
  _scoreTickAccumulator[accKey] =
    Math.round(((_scoreTickAccumulator[accKey] ?? 0) + deltaTime) * 1e6) / 1e6;

  if (_scoreTickAccumulator[accKey] >= 1.0) {
    _scoreTickAccumulator[accKey] =
      Math.round((_scoreTickAccumulator[accKey] - 1.0) * 1e6) / 1e6;

    events.push({
      timestamp: 0, // caller should set the actual game timestamp
      type: 'score_tick' as KothCombatEvent['type'],
      attacker: occupationResult.state === 'uncontested'
        ? (scoreState.nameMap[occupationResult.occupants[0]] ?? `Robot ${occupationResult.occupants[0]}`)
        : undefined,
      damage: occupationResult.state === 'uncontested'
        ? Math.round((scoreState.zoneScores[occupationResult.occupants[0]] ?? 0) * 10) / 10
        : undefined,
      message: occupationResult.state === 'uncontested'
        ? `${scoreState.nameMap[occupationResult.occupants[0]] ?? `Robot ${occupationResult.occupants[0]}`} holds the zone unopposed`
        : occupationResult.state === 'contested'
          ? 'The zone is contested — no points awarded'
          : 'The zone is empty — no points awarded',
      kpiData: {
        zoneScores: { ...scoreState.zoneScores },
        zoneState: occupationResult.state,
        occupants: [...occupationResult.occupants],
      },
    });
  }

  return events;
}

// ─── Zone Transition Tracking ───────────────────────────────────────

/**
 * Track zone transitions for all robots and emit zone_enter/zone_exit events.
 *
 * Compares the current zone occupation result against the previous occupant set
 * stored in scoreState.zoneOccupants. Emits exactly one event per robot that
 * changed zone status.
 *
 * Requirements: 2.3, 2.4
 */
export function trackZoneTransitions(
  scoreState: KothScoreState,
  occupationResult: ZoneOccupationResult,
  timestamp: number,
): KothCombatEvent[] {
  const events: KothCombatEvent[] = [];
  const previousOccupants = scoreState.zoneOccupants;
  const currentOccupants = new Set(occupationResult.occupants);

  // Check for zone_enter: in current but not in previous
  for (const robotId of currentOccupants) {
    if (!previousOccupants.has(robotId)) {
      const name = scoreState.nameMap[robotId] ?? `Robot ${robotId}`;
      events.push({
        timestamp,
        type: 'zone_enter' as KothCombatEvent['type'],
        attacker: name,
        message: `${name} enters the control zone`,
        kpiData: {
          robotId,
          zoneState: occupationResult.state,
        },
      });
    }
  }

  // Check for zone_exit: in previous but not in current
  for (const robotId of previousOccupants) {
    if (!currentOccupants.has(robotId)) {
      const name = scoreState.nameMap[robotId] ?? `Robot ${robotId}`;
      events.push({
        timestamp,
        type: 'zone_exit' as KothCombatEvent['type'],
        attacker: name,
        message: `${name} exits the control zone`,
        kpiData: {
          robotId,
        },
      });
    }
  }

  return events;
}

// ─── Rotating Zone Mechanics ────────────────────────────────────────

/**
 * Generate the next zone position for the rotating zone variant.
 *
 * Uses a deterministic seeded PRNG (mulberry32) so that the same
 * matchId + rotationCount always produces the same position.
 *
 * Constraints:
 *   - New position must be ≥6 units from arena boundary
 *     (distance from center ≤ arenaRadius - 6 - zoneRadius)
 *   - New position must be ≥8 units from the previous position
 *   - Falls back to arena center {x:0, y:0} after 100 failed attempts
 */
export function generateNextZonePosition(
  matchId: number,
  rotationCount: number,
  currentCenter: Position,
  arenaRadius: number,
  zoneRadius: number,
): Position {
  const seed = matchId * 1000 + rotationCount;
  const rng = mulberry32(seed);
  const maxDist = arenaRadius - 6 - zoneRadius;

  for (let attempt = 0; attempt < 100; attempt++) {
    const angle = rng() * 2 * Math.PI;
    const dist = rng() * maxDist;
    const candidate: Position = {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
    };

    const distFromCenter = euclideanDistance(candidate, { x: 0, y: 0 });
    if (distFromCenter > maxDist) continue;

    const distFromPrevious = euclideanDistance(candidate, currentCenter);
    if (distFromPrevious < 8) continue;

    return candidate;
  }

  return { x: 0, y: 0 };
}

/**
 * Process zone rotation lifecycle for the rotating zone variant.
 *
 * Manages three phases:
 *   1. Warning countdown (transitionCountdown > 0): decrement by deltaTime,
 *      when it reaches 0 deactivate the zone and start transition.
 *   2. Transition period (isActive === false): track transitionTimer,
 *      after 3s move zone to transitionTarget and reactivate.
 *   3. Rotation interval (rotationTimer >= 30s): generate next position,
 *      set transitionTarget, start 5s warning countdown.
 */
export function processZoneRotation(
  zoneState: KothZoneState,
  matchId: number,
  arenaRadius: number,
  deltaTime: number,
): KothCombatEvent[] {
  const events: KothCombatEvent[] = [];
  const now = Date.now();

  // Phase 1: Warning countdown active — decrement toward 0
  if (zoneState.transitionCountdown !== undefined && zoneState.transitionCountdown > 0) {
    zoneState.transitionCountdown = Math.max(0, zoneState.transitionCountdown - deltaTime);

    if (zoneState.transitionCountdown <= 0) {
      zoneState.transitionCountdown = 0;
      zoneState.isActive = false;
      zoneState.transitionTimer = 0;
    }
    return events;
  }

  // Phase 2: Transition period (zone inactive, moving to new position)
  if (!zoneState.isActive) {
    zoneState.transitionTimer = (zoneState.transitionTimer ?? 0) + deltaTime;

    if (zoneState.transitionTimer >= KOTH_MATCH_DEFAULTS.zoneTransitionDuration) {
      const newCenter = zoneState.transitionTarget ?? { x: 0, y: 0 };
      zoneState.center = newCenter;
      zoneState.isActive = true;
      zoneState.rotationCount += 1;
      zoneState.transitionTimer = undefined;
      zoneState.transitionTarget = undefined;
      zoneState.transitionCountdown = undefined;
      zoneState.rotationTimer = 0;

      events.push({
        timestamp: now,
        type: 'zone_active' as KothCombatEvent['type'],
        message: 'The control zone has moved to a new position!',
        kpiData: {
          center: newCenter,
          radius: zoneState.radius,
          rotationCount: zoneState.rotationCount,
        },
      });
    }
    return events;
  }

  // Phase 3: Normal active state — track rotation timer
  zoneState.rotationTimer = (zoneState.rotationTimer ?? 0) + deltaTime;

  if (zoneState.rotationTimer >= KOTH_MATCH_DEFAULTS.rotatingZoneInterval) {
    const nextPos = generateNextZonePosition(
      matchId,
      zoneState.rotationCount + 1,
      zoneState.center,
      arenaRadius,
      zoneState.radius,
    );
    zoneState.transitionTarget = nextPos;
    zoneState.transitionCountdown = KOTH_MATCH_DEFAULTS.zoneWarningTime;
    zoneState.rotationTimer = 0;

    events.push({
      timestamp: now,
      type: 'zone_moving' as KothCombatEvent['type'],
      message: 'The control zone is moving in 5 seconds!',
      kpiData: {
        newCenter: nextPos,
        countdown: KOTH_MATCH_DEFAULTS.zoneWarningTime,
      },
    });
  }

  return events;
}

// ─── Anti-Passive Penalty System ────────────────────────────────────

/**
 * Tick the passive penalty system for all alive, non-eliminated robots.
 *
 * For each robot:
 *   - Outside zone: increment passiveTimers by deltaTime, apply penalties
 *   - Inside zone: reset timer to 0, decay penalties linearly over 3s
 *
 * Penalty thresholds:
 *   20s outside → emit passive_warning (once)
 *   30s outside → damage reduction: 3% per 5s, capped at 30%
 *   60s outside → additional 15% accuracy penalty
 *
 * Mutates scoreState.passiveTimers and scoreState.passivePenalties.
 */
export function tickPassivePenalties(
  scoreState: KothScoreState,
  robots: RobotCombatState[],
  zone: KothZoneState,
  deltaTime: number,
): KothCombatEvent[] {
  const events: KothCombatEvent[] = [];

  for (const robot of robots) {
    const robotId = robot.robot.id;

    // Skip dead or eliminated robots
    if (!robot.isAlive || scoreState.eliminatedRobots.has(robotId)) continue;

    const distance = euclideanDistance(robot.position, zone.center);
    const insideZone = distance <= zone.radius;

    if (!insideZone) {
      // Outside zone: increment passive timer
      const prevTimer = scoreState.passiveTimers[robotId] ?? 0;
      const newTimer = prevTimer + deltaTime;
      scoreState.passiveTimers[robotId] = newTimer;

      // Check warning threshold (emit once when crossing 20s)
      if (prevTimer < KOTH_PASSIVE_PENALTIES.warningThreshold &&
          newTimer >= KOTH_PASSIVE_PENALTIES.warningThreshold) {
        const name = scoreState.nameMap[robotId] ?? `Robot ${robotId}`;
        events.push({
          type: 'passive_warning' as KothCombatEvent['type'],
          timestamp: Date.now(),
          message: `${name} has been outside the zone for 20 seconds — return to the zone!`,
          kpiData: { robotId, timeOutside: newTimer },
        });
      }

      // Calculate penalties
      let damageReduction = 0;
      let accuracyPenalty = 0;

      if (newTimer >= KOTH_PASSIVE_PENALTIES.penaltyThreshold) {
        const secondsOverThreshold = newTimer - KOTH_PASSIVE_PENALTIES.penaltyThreshold;
        damageReduction = Math.min(
          KOTH_PASSIVE_PENALTIES.damageReductionCap,
          Math.floor(secondsOverThreshold / KOTH_PASSIVE_PENALTIES.damageReductionInterval) *
            KOTH_PASSIVE_PENALTIES.damageReductionPerInterval,
        );
      }

      if (newTimer >= KOTH_PASSIVE_PENALTIES.accuracyPenaltyThreshold) {
        accuracyPenalty = KOTH_PASSIVE_PENALTIES.accuracyPenalty;
      }

      // Store penalties
      const prevPenalties = scoreState.passivePenalties[robotId] ?? { damageReduction: 0, accuracyPenalty: 0 };
      scoreState.passivePenalties[robotId] = { damageReduction, accuracyPenalty };

      // Emit passive_penalty event when penalties change
      if (damageReduction !== prevPenalties.damageReduction ||
          accuracyPenalty !== prevPenalties.accuracyPenalty) {
        const name = scoreState.nameMap[robotId] ?? `Robot ${robotId}`;
        events.push({
          type: 'passive_penalty' as KothCombatEvent['type'],
          timestamp: Date.now(),
          message: `${name} suffers a ${damageReduction * 100}% damage reduction for staying outside the zone`,
          kpiData: { robotId, damageReduction, accuracyPenalty, timeOutside: newTimer },
        });
      }
    } else {
      // Inside zone: reset timer, decay penalties
      const _prevTimer = scoreState.passiveTimers[robotId] ?? 0;

      // Reset timer on zone entry
      scoreState.passiveTimers[robotId] = 0;

      // Decay penalties linearly over penaltyDecayTime seconds
      const currentPenalties = scoreState.passivePenalties[robotId] ?? { damageReduction: 0, accuracyPenalty: 0 };
      if (currentPenalties.damageReduction > 0 || currentPenalties.accuracyPenalty > 0) {
        const decayRate = deltaTime / KOTH_PASSIVE_PENALTIES.penaltyDecayTime;
        const newDamageReduction = Math.max(0, currentPenalties.damageReduction - currentPenalties.damageReduction * decayRate);
        const newAccuracyPenalty = Math.max(0, currentPenalties.accuracyPenalty - currentPenalties.accuracyPenalty * decayRate);

        scoreState.passivePenalties[robotId] = {
          damageReduction: newDamageReduction,
          accuracyPenalty: newAccuracyPenalty,
        };
      }
    }
  }

  return events;
}

// ─── Kill Bonus ─────────────────────────────────────────────────────

/**
 * Award a kill bonus when a robot destroys an opponent.
 *
 * Awards exactly 5 points to the killer's Zone_Score and emits a
 * `kill_bonus` event.
 *
 * Mutates `scoreState.zoneScores` and `scoreState.killCounts`.
 *
 * Requirements: 3.4, 3.7
 */
export function awardKillBonus(
  scoreState: KothScoreState,
  killerRobotId: number,
  victimRobotId: number,
): KothCombatEvent {
  const bonus = KOTH_MATCH_DEFAULTS.killBonus; // 5 points

  scoreState.zoneScores[killerRobotId] =
    (scoreState.zoneScores[killerRobotId] ?? 0) + bonus;

  scoreState.killCounts[killerRobotId] =
    (scoreState.killCounts[killerRobotId] ?? 0) + 1;

  const killerName = scoreState.nameMap[killerRobotId] ?? `Robot ${killerRobotId}`;
  const victimName = scoreState.nameMap[victimRobotId] ?? `Robot ${victimRobotId}`;

  return {
    timestamp: 0, // caller should set the actual game timestamp
    type: 'kill_bonus' as KothCombatEvent['type'],
    message: `${killerName} eliminates ${victimName} and earns a kill bonus of ${bonus} points`,
    kpiData: {
      killerRobotId,
      victimRobotId,
      bonusAmount: bonus,
      zoneScores: { ...scoreState.zoneScores },
    },
  };
}


// ─── Final Placement Calculation ────────────────────────────────────

/**
 * Calculate final placements for all robots in a KotH match.
 *
 * Ordering rules (Req 4.12):
 *   1. Zone_Score descending
 *   2. Zone occupation time descending (tiebreaker)
 *   3. Total damage dealt descending (tiebreaker)
 *
 * Both surviving and eliminated robots are ranked. Eliminated robots
 * use their score at elimination time (stored in eliminationScores).
 *
 * Requirements: 4.4, 4.5, 4.12
 */
export function calculateFinalPlacements(
  scoreState: KothScoreState,
  robots: RobotCombatState[],
): KothPlacement[] {
  const entries: KothPlacement[] = robots.map((robot) => {
    const robotId = robot.robot.id;
    const isEliminated = scoreState.eliminatedRobots.has(robotId);
    const zoneScore = isEliminated
      ? (scoreState.eliminationScores[robotId] ?? scoreState.zoneScores[robotId] ?? 0)
      : (scoreState.zoneScores[robotId] ?? 0);

    return {
      robotId,
      placement: 0, // assigned after sorting
      zoneScore,
      zoneOccupationTime: scoreState.zoneOccupationTime[robotId] ?? 0,
      totalDamageDealt: robot.totalDamageDealt,
    };
  });

  // Sort: Zone_Score desc → zone occupation time desc → damage dealt desc
  entries.sort((a, b) => {
    if (b.zoneScore !== a.zoneScore) return b.zoneScore - a.zoneScore;
    if (b.zoneOccupationTime !== a.zoneOccupationTime)
      return b.zoneOccupationTime - a.zoneOccupationTime;
    return b.totalDamageDealt - a.totalDamageDealt;
  });

  // Assign placement numbers (1-indexed)
  for (let i = 0; i < entries.length; i++) {
    entries[i].placement = i + 1;
  }

  return entries;
}

// ─── Zone Occupant Removal ──────────────────────────────────────────

/**
 * Remove a robot from the zone occupants set if present.
 *
 * Helper used by both yield and destruction handlers.
 *
 * Requirements: 7.5
 */
export function removeFromZoneOccupants(
  scoreState: KothScoreState,
  robotId: number,
): void {
  scoreState.zoneOccupants.delete(robotId);
}

// ─── Robot Yield ────────────────────────────────────────────────────

/**
 * Handle a robot voluntarily yielding from the match.
 *
 * Permanently eliminates the robot, records its Zone_Score at elimination
 * time, removes it from zone occupants if present, and emits a
 * `robot_eliminated` event with reason 'yielded'.
 *
 * No Kill_Bonus is awarded to anyone (yield is voluntary).
 *
 * Requirements: 7.1, 7.2, 7.5, 7.6
 */
export function handleRobotYield(
  scoreState: KothScoreState,
  robotId: number,
  _zoneState: KothZoneState,
): KothCombatEvent {
  // Permanently eliminate the robot
  scoreState.eliminatedRobots.add(robotId);

  // Record Zone_Score at elimination time
  scoreState.eliminationScores[robotId] = scoreState.zoneScores[robotId] ?? 0;

  // Remove from zone occupants if inside zone
  removeFromZoneOccupants(scoreState, robotId);

  const zoneScore = scoreState.zoneScores[robotId] ?? 0;
  const name = scoreState.nameMap[robotId] ?? `Robot ${robotId}`;

  return {
    timestamp: Date.now(),
    type: 'robot_eliminated' as KothCombatEvent['type'],
    attacker: name,
    message: `${name} has yielded with a Zone Score of ${zoneScore}`,
    kpiData: {
      robotId,
      reason: 'yielded',
      zoneScore,
    },
  };
}

// ─── Robot Destruction ──────────────────────────────────────────────

/**
 * Handle a robot being destroyed by another robot.
 *
 * Permanently eliminates the destroyed robot, records its Zone_Score at
 * elimination time, awards a Kill_Bonus to the destroyer, removes the
 * destroyed robot from zone occupants if present, and emits both a
 * `robot_eliminated` event and a `kill_bonus` event.
 *
 * Requirements: 7.1, 7.3, 7.4, 7.5, 7.6
 */
export function handleRobotDestruction(
  scoreState: KothScoreState,
  destroyerRobotId: number,
  destroyedRobotId: number,
  _zoneState: KothZoneState,
): KothCombatEvent[] {
  // Permanently eliminate the destroyed robot
  scoreState.eliminatedRobots.add(destroyedRobotId);

  // Record Zone_Score at elimination time
  scoreState.eliminationScores[destroyedRobotId] = scoreState.zoneScores[destroyedRobotId] ?? 0;

  // Remove from zone occupants if inside zone
  removeFromZoneOccupants(scoreState, destroyedRobotId);

  // Award kill bonus to destroyer
  const killBonusEvent = awardKillBonus(scoreState, destroyerRobotId, destroyedRobotId);

  const zoneScore = scoreState.zoneScores[destroyedRobotId] ?? 0;
  const destroyedName = scoreState.nameMap[destroyedRobotId] ?? `Robot ${destroyedRobotId}`;

  const eliminatedEvent: KothCombatEvent = {
    timestamp: Date.now(),
    type: 'robot_eliminated' as KothCombatEvent['type'],
    attacker: destroyedName,
    message: `${destroyedName} has been destroyed with a Zone Score of ${zoneScore}`,
    kpiData: {
      robotId: destroyedRobotId,
      reason: 'destroyed',
      zoneScore,
      destroyerRobotId,
    },
  };

  return [eliminatedEvent, killBonusEvent];
}

// ─── Win Condition Evaluator ────────────────────────────────────────

/**
 * KotH win condition evaluator implementing the WinConditionEvaluator interface.
 *
 * Checks (in order each simulation step):
 *   1. Score threshold reached → ended, reason 'score_threshold'
 *   2. All but one eliminated → enter last-standing phase (10s window)
 *   3. Last-standing timer expired → highest score wins, reason 'last_standing'
 *   4. Time limit reached → highest score wins, reason 'time_limit'
 *   5. Tiebreaker: zone occupation time → damage dealt
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12
 */
export class KothWinConditionEvaluator implements WinConditionEvaluator {
  private scoreThreshold: number;
  private timeLimit: number;
  private lastStandingDuration: number;

  constructor(config: KothMatchConfig) {
    this.scoreThreshold = config.scoreThreshold
      ?? (config.rotatingZone
        ? KOTH_MATCH_DEFAULTS.rotatingZoneScoreThreshold
        : KOTH_MATCH_DEFAULTS.scoreThreshold);
    this.timeLimit = config.timeLimit
      ?? (config.rotatingZone
        ? KOTH_MATCH_DEFAULTS.rotatingZoneTimeLimit
        : KOTH_MATCH_DEFAULTS.timeLimit);
    this.lastStandingDuration = KOTH_MATCH_DEFAULTS.lastStandingDuration;
  }

  evaluate(
    teams: RobotCombatState[][],
    currentTime: number,
    gameState?: GameModeState,
  ): { ended: boolean; winnerId: number | null; reason: string } | null {
    const robots = teams.flat();
    const scoreState = gameState?.customData?.scoreState as KothScoreState | undefined;
    if (!scoreState) return null;

    // Collect events to emit (stored on gameState for caller to retrieve)
    const events: KothCombatEvent[] = [];

    // --- Check 1: Score threshold reached (Req 4.2) ---
    for (const robot of robots) {
      const robotId = robot.robot.id;
      const score = scoreState.zoneScores[robotId] ?? 0;
      if (score >= this.scoreThreshold) {
        const placements = calculateFinalPlacements(scoreState, robots);
        events.push(this._buildMatchEndEvent(
          robotId, scoreState, placements, currentTime, 'score_threshold',
        ));
        this._storeEvents(gameState!, events);
        return { ended: true, winnerId: robotId, reason: 'score_threshold' };
      }
    }

    // --- Check 2: Last-standing phase is detected and managed by the tick hook ---
    // The tick hook sets lastStandingPhase, emits the last_standing event, and
    // increments the timer — all in chronological order with score_tick events.

    // --- Check 3: Last-standing timer expired (Req 4.9) ---
    if (scoreState.lastStandingPhase) {
      // Timer is incremented externally by the simulation loop via deltaTime.
      // Here we just check if it has expired.
      if (
        scoreState.lastStandingTimer >= this.lastStandingDuration ||
        currentTime >= this.timeLimit
      ) {
        const placements = calculateFinalPlacements(scoreState, robots);
        const winnerId = placements[0]?.robotId ?? null;
        events.push(this._buildMatchEndEvent(
          winnerId, scoreState, placements, currentTime, 'last_standing',
        ));
        this._storeEvents(gameState!, events);
        return { ended: true, winnerId, reason: 'last_standing' };
      }
      // Still in last-standing phase, not expired yet
      this._storeEvents(gameState!, events);
      return null;
    }

    // --- Check 4: Time limit reached (Req 4.4) ---
    if (currentTime >= this.timeLimit) {
      const placements = calculateFinalPlacements(scoreState, robots);
      const winnerId = placements[0]?.robotId ?? null;
      events.push(this._buildMatchEndEvent(
        winnerId, scoreState, placements, currentTime, 'time_limit',
      ));
      this._storeEvents(gameState!, events);
      return { ended: true, winnerId, reason: 'time_limit' };
    }

    // No end condition met
    this._storeEvents(gameState!, events);
    return null;
  }

  /** Build a match_end event (Req 4.11) */
  private _buildMatchEndEvent(
    winnerId: number | null,
    scoreState: KothScoreState,
    placements: KothPlacement[],
    currentTime: number,
    reason: string,
  ): KothCombatEvent {
    const winnerLabel = winnerId != null
      ? (scoreState.nameMap[winnerId] ?? `Robot ${winnerId}`)
      : 'No robot';
    return {
      timestamp: currentTime,
      type: 'match_end' as KothCombatEvent['type'],
      message: `${winnerLabel} wins the King of the Hill match — ${reason.replace(/_/g, ' ')}`,
      kpiData: {
        winnerId,
        zoneScores: { ...scoreState.zoneScores },
        placements: [...placements],
        duration: currentTime,
        winReason: reason,
      },
    };
  }

  /** Store emitted events on gameState for the caller to retrieve */
  private _storeEvents(gameState: GameModeState, events: KothCombatEvent[]): void {
    if (events.length === 0) return;
    if (!gameState.customData) gameState.customData = {};
    const existing = (gameState.customData.pendingEvents as KothCombatEvent[]) ?? [];
    gameState.customData.pendingEvents = [...existing, ...events];
  }
}


// ─── Zone-Aware Target Priority Strategy ────────────────────────────

/**
 * KotH target priority strategy implementing TargetPriorityStrategy.
 *
 * Assigns zone-context weights to opponents and scales them by the
 * robot's threatAnalysis attribute. Returns opponent IDs sorted by
 * descending priority weight.
 *
 * Priority weights:
 *   Zone contesters (inside zone):        3.0× base
 *   Zone approachers (moving toward zone): 2.0× base
 *   Outside, not approaching:              1.0× base
 *
 * Situational modifiers:
 *   Robot inside zone uncontested: prioritize approachers
 *   Robot inside zone contested:   prioritize lowest HP contester
 *   Robot outside zone:            1.5× for approaching opponents
 *
 * threatAnalysis scaling:
 *   ta < 10:  50% effectiveness
 *   ta 10–30: linear 50% → 100%
 *   ta > 30:  100% effectiveness
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
export class KothTargetPriorityStrategy implements TargetPriorityStrategy {
  selectTargets(
    robot: RobotCombatState,
    opponents: RobotCombatState[],
    arena: ArenaConfig,
    gameState?: GameModeState,
  ): number[] {
    // Filter out dead opponents
    const alive = opponents.filter((o) => o.isAlive);
    if (alive.length === 0) return [];

    // Resolve zone state from gameState or arena zones
    const zoneState = this._resolveZoneState(arena, gameState);
    if (!zoneState) {
      // No zone info — return opponents in original order (by teamIndex, not DB id)
      return alive.map((o) => o.teamIndex);
    }

    // Determine robot's own zone status
    const robotDist = euclideanDistance(robot.position, zoneState.center);
    const robotInZone = robotDist <= zoneState.radius;

    // Determine zone occupation state
    const occupants = alive.filter(
      (o) => euclideanDistance(o.position, zoneState.center) <= zoneState.radius,
    );
    const robotIsContested = robotInZone && occupants.length > 0;
    const robotIsUncontested = robotInZone && occupants.length === 0;

    // Get threatAnalysis scaling factor
    const ta = Number(robot.robot.threatAnalysis ?? 1);
    const taScale = this._threatAnalysisScale(ta);

    // Calculate weighted priority for each alive opponent
    const weighted = alive.map((opp) => {
      const oppDist = euclideanDistance(opp.position, zoneState.center);
      const oppInZone = oppDist <= zoneState.radius;
      const oppApproaching = this._isApproaching(opp, zoneState);

      // Base zone-context weight (Req 5.2)
      let weight: number;
      let context: string;
      if (oppInZone) {
        weight = 3.0;
        context = 'contester';
      } else if (oppApproaching) {
        weight = 2.0;
        context = 'approacher';
      } else {
        weight = 1.0;
        context = 'standard';
      }

      // Situational modifiers
      if (robotIsUncontested && oppApproaching && !oppInZone) {
        // Inside zone uncontested: prioritize approachers (Req 5.3)
        weight = Math.max(weight, 2.5);
      } else if (robotIsContested && oppInZone) {
        // Inside zone contested: prioritize lowest HP contester (Req 5.4)
        // Use inverse HP as a bonus so lower HP = higher weight
        const hpRatio = opp.currentHP / opp.maxHP;
        weight += (1.0 - hpRatio) * 2.0;
      } else if (!robotInZone && oppApproaching && !oppInZone) {
        // Outside zone: 1.5× for approaching opponents (Req 5.5)
        weight *= 1.5;
      }

      // Apply threatAnalysis scaling (Req 5.6)
      // Scale the zone-aware portion: blend between base (1.0) and full weight
      const zoneBonus = weight - 1.0;
      const scaledWeight = 1.0 + zoneBonus * taScale;

      return { id: opp.teamIndex, weight: scaledWeight, context };
    });

    // Sort by weight descending (Req 5.7)
    weighted.sort((a, b) => b.weight - a.weight);

    return weighted.map((w) => w.id);
  }

  /**
   * Calculate threatAnalysis scaling factor.
   * ta < 10 → 0.5, ta 10–30 → linear 0.5–1.0, ta > 30 → 1.0
   */
  private _threatAnalysisScale(ta: number): number {
    if (ta < 10) return 0.5;
    if (ta > 30) return 1.0;
    return 0.5 + ((ta - 10) / 20) * 0.5;
  }

  /**
   * Determine if an opponent is approaching the zone.
   * Checks if movementIntent.targetPosition is closer to zone center
   * than the opponent's current position, OR if velocity points toward zone.
   */
  private _isApproaching(opp: RobotCombatState, zone: KothZoneState): boolean {
    const currentDist = euclideanDistance(opp.position, zone.center);

    // Check movement intent target
    if (opp.movementIntent?.targetPosition) {
      const targetDist = euclideanDistance(opp.movementIntent.targetPosition, zone.center);
      if (targetDist < currentDist) return true;
    }

    // Check velocity vector direction
    if (opp.velocity && (opp.velocity.x !== 0 || opp.velocity.y !== 0)) {
      const toZoneX = zone.center.x - opp.position.x;
      const toZoneY = zone.center.y - opp.position.y;
      const dot = opp.velocity.x * toZoneX + opp.velocity.y * toZoneY;
      if (dot > 0) return true;
    }

    return false;
  }

  /**
   * Resolve zone state from gameState or arena zones.
   */
  private _resolveZoneState(
    arena: ArenaConfig,
    gameState?: GameModeState,
  ): KothZoneState | null {
    // Try gameState.customData.zoneState first
    const zs = gameState?.customData?.zoneState as KothZoneState | undefined;
    if (zs) return zs;

    // Fall back to arena zones with control_point effect
    const controlZone = arena.zones?.find((z) => z.effect === 'control_point');
    if (controlZone) {
      return {
        center: controlZone.center,
        radius: controlZone.radius,
        isActive: true,
        rotationCount: 0,
      };
    }

    return null;
  }
}


// ─── Zone-Biased Movement Intent Modifier ───────────────────────────

/**
 * KotH movement intent modifier implementing MovementIntentModifier.
 *
 * Biases robot movement toward the control zone based on game context.
 * Rules are checked in order — first match wins:
 *
 *   1. Opponent within 4 units and attacking → preserve base combat AI movement
 *   2. Inside zone uncontested, no opponent within 8 units → hold position
 *   3. combatAlgorithms > 25 + zone contested by 2+ others → wait-and-enter
 *   4. No opponent within 6 units → move toward zone center (bias scaled by ta)
 *   5. Otherwise → return baseIntent unchanged
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export class KothMovementIntentModifier implements MovementIntentModifier {
  modify(
    baseIntent: MovementIntent,
    robot: RobotCombatState,
    arena: ArenaConfig,
    gameState?: GameModeState,
  ): MovementIntent {
    // Resolve zone state
    const zoneState = this._resolveZoneState(arena, gameState);
    if (!zoneState) return baseIntent;

    // Resolve score state for occupant info
    const scoreState = gameState?.customData?.scoreState as KothScoreState | undefined;

    // Gather all alive opponents from score state or fall back to empty
    const allRobots = this._getAliveOpponents(robot, gameState);

    // Find closest opponent distance and check if any opponent is attacking this robot
    let closestOpponentDist = Infinity;
    let hasAttackingOpponentWithin4 = false;

    for (const opp of allRobots) {
      const dist = euclideanDistance(robot.position, opp.position);
      if (dist < closestOpponentDist) {
        closestOpponentDist = dist;
      }
      if (dist <= 4 && opp.currentTarget === robot.teamIndex) {
        hasAttackingOpponentWithin4 = true;
      }
    }

    // Rule 0: Last-standing phase — aggressively move to zone center (override all other rules)
    if (scoreState?.lastStandingPhase || allRobots.length === 0) {
      return {
        ...baseIntent,
        targetPosition: { x: zoneState.center.x, y: zoneState.center.y },
      };
    }

    // Determine robot's zone status
    const robotDist = euclideanDistance(robot.position, zoneState.center);
    const robotInZone = robotDist <= zoneState.radius;

    // Determine zone occupation
    const zoneOccupants = this._getZoneOccupants(allRobots, zoneState);
    const isUncontested = robotInZone && zoneOccupants.length === 0;

    // Check if any opponent is within 8 units
    const hasOpponentWithin8 = closestOpponentDist <= 8;

    // Rule 1: Inside zone uncontested, no opponent within 8 units → hold position (Req 6.3)
    if (isUncontested && !hasOpponentWithin8) {
      return {
        ...baseIntent,
        targetPosition: { x: robot.position.x, y: robot.position.y },
      };
    }

    // Rule 2: combatAlgorithms > 25 + zone contested by 2+ others → wait-and-enter (Req 6.4)
    const combatAlgorithms = Number(robot.robot.combatAlgorithms ?? 0);
    if (combatAlgorithms > 25 && !robotInZone && zoneOccupants.length >= 2) {
      const waitPos = this._calculateWaitPosition(robot.position, zoneState);
      return {
        ...baseIntent,
        targetPosition: waitPos,
      };
    }

    // Rule 3: No opponent within 6 units → strong zone pull (Req 6.2)
    if (closestOpponentDist > 6) {
      const ta = Number(robot.robot.threatAnalysis ?? 1);
      const biasStrength = this._calculateBiasStrength(ta);
      const blended = lerp(baseIntent.targetPosition, zoneState.center, biasStrength);
      return {
        ...baseIntent,
        targetPosition: blended,
      };
    }

    // Rule 4: Opponent within 4 units and actively attacking → mild zone pull
    // Even during close combat, robots should drift toward the zone.
    // Attacking opponents get a weaker pull so they don't disengage.
    if (hasAttackingOpponentWithin4) {
      const ta = Number(robot.robot.threatAnalysis ?? 1);
      const mildBias = this._calculateBiasStrength(ta) * 0.25; // 25% of normal pull
      const blended = lerp(baseIntent.targetPosition, zoneState.center, mildBias);
      return {
        ...baseIntent,
        targetPosition: blended,
      };
    }

    // Rule 5: Opponents within 6 units but not attacking → moderate zone pull
    // Robots should fight their way toward the zone, not just stand and trade blows.
    const ta = Number(robot.robot.threatAnalysis ?? 1);
    const moderateBias = this._calculateBiasStrength(ta) * 0.45; // 45% of normal pull
    const blended = lerp(baseIntent.targetPosition, zoneState.center, moderateBias);
    return {
      ...baseIntent,
      targetPosition: blended,
    };
  }

  /**
   * Calculate bias strength from threatAnalysis.
   * ta=1 → 30%, ta=50 → 100%, linear interpolation, clamped [0.3, 1.0].
   */
  private _calculateBiasStrength(ta: number): number {
    const raw = ((ta - 1) / 49) * 0.7 + 0.3;
    return Math.max(0.3, Math.min(1.0, raw));
  }

  /**
   * Calculate wait-and-enter position: 2 units outside zone edge,
   * on the line from zone center toward the robot's current position.
   */
  private _calculateWaitPosition(robotPos: Position, zone: KothZoneState): Position {
    const dx = robotPos.x - zone.center.x;
    const dy = robotPos.y - zone.center.y;
    const dir = normalizeVector({ x: dx, y: dy });
    const waitDist = zone.radius + 2;
    return {
      x: zone.center.x + dir.x * waitDist,
      y: zone.center.y + dir.y * waitDist,
    };
  }

  /**
   * Get alive opponents (excluding the robot itself) from gameState robots.
   * Falls back to empty array if no robot data available.
   */
  private _getAliveOpponents(
    robot: RobotCombatState,
    gameState?: GameModeState,
  ): RobotCombatState[] {
    const robots = gameState?.customData?.robots as RobotCombatState[] | undefined;
    if (!robots) return [];
    return robots.filter((r) => r.isAlive && r.robot.id !== robot.robot.id);
  }

  /**
   * Get opponent robots currently inside the zone (excluding the given robot).
   */
  private _getZoneOccupants(
    opponents: RobotCombatState[],
    zone: KothZoneState,
  ): RobotCombatState[] {
    return opponents.filter(
      (opp) => euclideanDistance(opp.position, zone.center) <= zone.radius,
    );
  }

  /**
   * Resolve zone state from gameState or arena zones.
   */
  private _resolveZoneState(
    arena: ArenaConfig,
    gameState?: GameModeState,
  ): KothZoneState | null {
    const zs = gameState?.customData?.zoneState as KothZoneState | undefined;
    if (zs) return zs;

    const controlZone = arena.zones?.find((z) => z.effect === 'control_point');
    if (controlZone) {
      return {
        center: controlZone.center,
        radius: controlZone.radius,
        isActive: true,
        rotationCount: 0,
      };
    }

    return null;
  }
}


// ─── Game Mode Config Assembly ──────────────────────────────────────

/**
 * Assemble a complete GameModeConfig for a KotH match.
 *
 * Wires together all KotH strategy implementations:
 *   - targetPriority: KothTargetPriorityStrategy
 *   - movementModifier: KothMovementIntentModifier
 *   - winCondition: KothWinConditionEvaluator (with config)
 *   - arenaZones: single control_point zone from createControlZone
 *   - maxDuration: config.timeLimit or default (150 fixed / 210 rotating)
 *
 * Requirements: 11.1, 11.2, 11.3, 11.6, 11.7
 */
export function buildKothGameModeConfig(config: KothMatchConfig): GameModeConfig {
  const maxDuration = config.timeLimit
    ?? (config.rotatingZone
      ? KOTH_MATCH_DEFAULTS.rotatingZoneTimeLimit
      : KOTH_MATCH_DEFAULTS.timeLimit);

  return {
    targetPriority: new KothTargetPriorityStrategy(),
    movementModifier: new KothMovementIntentModifier(),
    winCondition: new KothWinConditionEvaluator(config),
    arenaZones: [createControlZone(config)],
    maxDuration,
  };
}

// ─── Game Mode Initial State Assembly ───────────────────────────────

/**
 * Build the initial GameModeState for a KotH match.
 *
 * Initializes:
 *   - mode: 'zone_control'
 *   - zoneScores: zeroed for each robotId
 *   - customData containing scoreState, zoneState, robots, eliminatedRobots, passiveTimers
 *
 * Requirements: 11.1, 11.2, 11.3, 11.6, 11.7
 */
export function buildKothInitialState(
  config: KothMatchConfig,
  robotIds: number[],
): GameModeState {
  const scoreState = createKothScoreState(robotIds);
  const zoneRadius = config.zoneRadius ?? KOTH_MATCH_DEFAULTS.zoneRadius;

  const zoneScores: Record<number, number> = {};
  for (const id of robotIds) {
    zoneScores[id] = 0;
  }

  return {
    mode: 'zone_control',
    zoneScores,
    customData: {
      scoreState,
      zoneState: {
        center: { x: 0, y: 0 },
        radius: zoneRadius,
        isActive: true,
        rotationCount: 0,
        rotationTimer: 0,
      },
      robots: [] as unknown[],
      eliminatedRobots: new Set<number>(),
      passiveTimers: {} as Record<string, unknown>,
    },
  };
}

// ─── Tick Hook Builder ──────────────────────────────────────────────

/**
 * Enriched placement with all fields needed by processKothBattle for DB records.
 */
export interface KothEnrichedPlacement extends KothPlacement {
  robotName: string;
  zoneTime: number;
  kills: number;
  destroyed: boolean;
  damageDealt: number;
  finalHP: number;
  uncontestedScore: number;
}

/**
 * Build the per-tick hook function for KotH matches.
 *
 * Called by simulateBattleMulti every tick. Wires together all KotH mechanics:
 * zone occupation, scoring, transitions, passive penalties, zone rotation,
 * and destruction/yield tracking.
 *
 * The hook captures scoreState, zoneState, and gameModeState by reference so
 * mutations are visible to the KothWinConditionEvaluator and the result builder.
 *
 * Requirements: 2.1–2.5, 3.1–3.7, 7.1–7.6
 */
export function buildKothTickHook(
  config: KothMatchConfig,
  scoreState: KothScoreState,
  zoneState: KothZoneState,
  gameModeState: GameModeState,
): (
  states: RobotCombatState[],
  currentTime: number,
  deltaTime: number,
  events: CombatEvent[],
  arena: ArenaConfig,
) => void {
  // Track previous alive set to detect new destructions/yields
  let previousAliveIds: Set<number> | null = null;

  return (states, currentTime, deltaTime, events, _arena) => {
    const aliveRobots = states.filter(s => s.isAlive);

    // Initialize previous alive set on first tick
    if (previousAliveIds === null) {
      previousAliveIds = new Set(states.map(s => s.robot.id));
      // Populate nameMap so all KotH message functions can resolve robot names
      for (const s of states) {
        scoreState.nameMap[s.robot.id] = s.robot.name;
      }
    }

    // --- Detect newly dead/yielded robots ---
    const currentAliveIds = new Set(aliveRobots.map(s => s.robot.id));
    for (const prevId of previousAliveIds) {
      if (!currentAliveIds.has(prevId)) {
        const deadState = states.find(s => s.robot.id === prevId);
        if (!deadState) continue;

        if (deadState.currentHP <= 0) {
          // Find killer: the robot whose last attack target was this robot
          // Use the robot that dealt the most damage as a heuristic
          const killer = aliveRobots.find(s => s.currentTarget === deadState.teamIndex);
          const killerId = killer?.robot.id ?? 0;
          const destroyEvents = handleRobotDestruction(scoreState, killerId, prevId, zoneState);
          for (const e of destroyEvents) {
            e.timestamp = currentTime;
            events.push(e);
          }
        } else {
          // Yielded
          const yieldEvent = handleRobotYield(scoreState, prevId, zoneState);
          yieldEvent.timestamp = currentTime;
          events.push(yieldEvent);
        }
      }
    }
    previousAliveIds = currentAliveIds;

    // --- Zone occupation ---
    const occupation = evaluateZoneOccupation(aliveRobots, zoneState);

    // --- Zone transitions (enter/exit events) ---
    const transitionEvents = trackZoneTransitions(scoreState, occupation, currentTime);
    for (const e of transitionEvents) events.push(e);

    // --- Scoring ---
    const scoreEvents = tickScoring(scoreState, zoneState, occupation, deltaTime);
    for (const e of scoreEvents) {
      e.timestamp = currentTime;
      events.push(e);
    }

    // --- Sync zone scores to gameModeState so win condition evaluator can read them ---
    if (gameModeState.zoneScores) {
      for (const [id, score] of Object.entries(scoreState.zoneScores)) {
        gameModeState.zoneScores[Number(id)] = score;
      }
    }

    // --- Sync scoreState onto customData so win condition evaluator can access it ---
    (gameModeState.customData as Record<string, unknown>).scoreState = scoreState;
    (gameModeState.customData as Record<string, unknown>).zoneState = zoneState;

    // --- Passive penalties ---
    const penaltyEvents = tickPassivePenalties(scoreState, aliveRobots, zoneState, deltaTime);
    for (const e of penaltyEvents) {
      e.timestamp = currentTime;
      events.push(e);
    }

    // --- Zone rotation (rotating variant only) ---
    if (config.rotatingZone) {
      const rotationEvents = processZoneRotation(
        zoneState, config.matchId, _arena.radius, deltaTime,
      );
      for (const e of rotationEvents) {
        e.timestamp = currentTime;
        events.push(e);
      }
      // Update arena zone center if it changed
      if (_arena.zones && _arena.zones.length > 0) {
        _arena.zones[0].center = { ...zoneState.center };
      }
    }

    // --- Update lastStanding tracking for win condition evaluator ---
    if (aliveRobots.length <= 1) {
      if (!scoreState.lastStandingPhase) {
        scoreState.lastStandingPhase = true;
        scoreState.lastStandingTimer = 0;
        scoreState.lastStandingRobotId = aliveRobots.length === 1
          ? aliveRobots[0].robot.id : null;

        // Emit last_standing event here (in tick hook) so it appears in
        // chronological order with score_tick events (Req 4.10)
        const survivorId = scoreState.lastStandingRobotId;
        const lastStandingDuration = config.rotatingZone
          ? KOTH_MATCH_DEFAULTS.lastStandingDuration
          : KOTH_MATCH_DEFAULTS.lastStandingDuration;
        events.push({
          timestamp: currentTime,
          type: 'last_standing' as CombatEvent['type'],
          message: survivorId != null
            ? `${scoreState.nameMap[survivorId] ?? `Robot ${survivorId}`} is the last robot standing — ${lastStandingDuration} seconds to score`
            : `All robots eliminated — match ending`,
          kpiData: {
            survivorId: survivorId ?? undefined,
            zoneScores: { ...scoreState.zoneScores },
            countdown: lastStandingDuration,
          },
        });
      }
      scoreState.lastStandingTimer += deltaTime;
    }
  };
}

/**
 * Build enriched placements from the unified simulator result + KotH score state.
 *
 * Maps the raw KothPlacement (score-based) with robot names, HP, kills, etc.
 * from the combat states, producing the full shape processKothBattle needs for DB records.
 */
export function buildEnrichedPlacements(
  scoreState: KothScoreState,
  states: RobotCombatState[],
): KothEnrichedPlacement[] {
  const basePlacements = calculateFinalPlacements(scoreState, states);

  return basePlacements.map(p => {
    const robot = states.find(s => s.robot.id === p.robotId);
    return {
      ...p,
      robotName: robot?.robot.name ?? `Robot ${p.robotId}`,
      zoneTime: scoreState.zoneOccupationTime[p.robotId] ?? 0,
      kills: scoreState.killCounts[p.robotId] ?? 0,
      destroyed: scoreState.eliminatedRobots.has(p.robotId)
        ? (robot ? robot.currentHP <= 0 : true)
        : false,
      damageDealt: robot?.totalDamageDealt ?? 0,
      finalHP: Math.max(0, robot?.currentHP ?? 0),
      uncontestedScore: scoreState.uncontestedTime[p.robotId] ?? 0,
    };
  });
}
