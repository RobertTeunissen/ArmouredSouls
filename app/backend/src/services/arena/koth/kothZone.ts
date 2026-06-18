/**
 * King of the Hill — Zone management, spawn positioning, and rotation mechanics.
 *
 * Requirements: 1.1, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { Position, euclideanDistance } from '../vector2d';
import type { ArenaZone, RobotCombatState } from '../types';
import type {
  KothMatchConfig,
  KothZoneState,
  ZoneOccupationResult,
  KothScoreState,
  KothCombatEvent,
} from './kothConfig';
import { KOTH_MATCH_DEFAULTS } from './kothConfig';

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
        positions: {
          zone_center: newCenter,
        },
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
