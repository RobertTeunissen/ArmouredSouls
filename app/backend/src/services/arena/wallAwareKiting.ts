/**
 * Wall-Aware Kiting Path (Season 2 round 3, #538)
 *
 * A kiting robot that retreats radially into the arena wall stalls there while
 * its chaser cuts across the inside of the circle. Near the wall a kiter instead
 * picks the step that ends farthest from its chaser's projected end-of-tick
 * position, among headings fanned out from "straight away" in 15° steps. In
 * practice that is a tangential path: the kiter circles along the wall away
 * from the chaser at full speed.
 *
 * Continuity: among near-best headings (within CONTINUITY_TOLERANCE × step of
 * the best score) the kiter keeps going the way it was already moving
 * (positive dot product with its tick-start velocity). A chaser straight
 * behind it therefore never makes it flip direction from tick to tick (the
 * #538 wall-slide dither).
 *
 * The function is pure and deterministic. It reads only the kiter's own state
 * and the chaser's tick-start position and velocity, so the simultaneous
 * movement guarantee (#520) holds: robot order never changes the result. Every
 * candidate end point is projected onto the arena disc, which is
 * non-expansive, so the displacement never exceeds `stepLength` (no teleport)
 * and the result is always inside the arena. Apart from exact ties (broken
 * towards smaller rotations, then counter-clockwise) the choice is
 * mirror-symmetric.
 */

import { Position, Vector2D, euclideanDistance, normalizeVector, rotateVector } from './vector2d';
import type { ArenaConfig } from './types';
import { clampToArena } from './arenaLayout';

/** Distance from the wall (grid units) at which a kiter starts circling instead of retreating radially */
export const WALL_KITING_MARGIN = 2;

/** Angular spacing of the candidate headings (degrees) */
const HEADING_STEP_DEG = 15;

/** Candidate rotations per side: 12 × 15° = 180° */
const HEADING_STEPS = 12;

/** Near-best band, as a fraction of the step length, in which the current direction of travel is kept */
const CONTINUITY_TOLERANCE = 0.25;

/** Inputs for one wall-aware kiting step */
export interface WallAwareKitingInput {
  /** Kiter position at tick start */
  position: Position;
  /** Kiter velocity at tick start (units/second) */
  velocity: Vector2D;
  /** Chaser position at tick start */
  chaserPosition: Position;
  /** Chaser velocity at tick start (units/second) */
  chaserVelocity: Vector2D;
  /** Maximum distance the kiter moves this tick */
  stepLength: number;
  arena: ArenaConfig;
  /** Tick length in seconds */
  deltaTime: number;
}

interface Candidate {
  end: Position;
  score: number;
  k: number;
  side: 1 | -1;
  continues: boolean;
}

/** True when `a` ranks before `b`: higher score, then smaller rotation, then counter-clockwise. */
function ranksBefore(a: Candidate, b: Candidate): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (a.k !== b.k) return a.k < b.k;
  return a.side > b.side;
}

/**
 * Plan a kiter's step near the arena wall: the end point (within `stepLength`,
 * inside the arena) that maximises the distance from the chaser's projected
 * end-of-tick position, keeping the current direction of travel among
 * near-best headings.
 */
export function planWallAwareKitingStep(input: WallAwareKitingInput): Position {
  const { position, velocity, chaserPosition, chaserVelocity, stepLength, arena, deltaTime } = input;
  const chaser: Position = {
    x: chaserPosition.x + chaserVelocity.x * deltaTime,
    y: chaserPosition.y + chaserVelocity.y * deltaTime,
  };

  // Straight away from the chaser; if the chaser sits on top of the kiter, the
  // counter-clockwise wall tangent (or +x at the centre)
  let away = normalizeVector({ x: position.x - chaser.x, y: position.y - chaser.y });
  if (away.x === 0 && away.y === 0) {
    const radial = normalizeVector({ x: position.x - arena.center.x, y: position.y - arena.center.y });
    away = radial.x === 0 && radial.y === 0 ? { x: 1, y: 0 } : { x: -radial.y, y: radial.x };
  }
  const heading = normalizeVector(velocity);

  const candidates: Candidate[] = [];
  for (let k = 0; k <= HEADING_STEPS; k++) {
    for (const side of (k === 0 ? [1] : [1, -1]) as Array<1 | -1>) {
      const h = rotateVector(away, side * k * HEADING_STEP_DEG);
      const end = clampToArena({ x: position.x + h.x * stepLength, y: position.y + h.y * stepLength }, arena);
      candidates.push({
        end,
        score: euclideanDistance(end, chaser),
        k,
        side,
        continues: h.x * heading.x + h.y * heading.y > 0,
      });
    }
  }

  let best = candidates[0];
  for (const c of candidates) if (ranksBefore(c, best)) best = c;

  // Keep the direction of travel among near-best headings
  const threshold = best.score - CONTINUITY_TOLERANCE * stepLength;
  let continuing: Candidate | null = null;
  for (const c of candidates) {
    if (c.continues && c.score >= threshold && (continuing === null || ranksBefore(c, continuing))) {
      continuing = c;
    }
  }

  const chosen = continuing ?? best;
  return { x: chosen.end.x, y: chosen.end.y };
}
