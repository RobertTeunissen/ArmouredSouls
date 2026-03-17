/**
 * 2D Math Utilities for the Combat Arena
 *
 * All functions are pure with no module-level mutable state.
 * Zero-length vectors are handled safely throughout.
 *
 * Requirements: 1.5 (position tracking), 1.6 (Euclidean distance)
 */

/** 2D position in arena grid units */
export interface Position {
  x: number;
  y: number;
}

/** 2D direction vector (normalized or raw) */
export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Calculate Euclidean distance between two positions.
 * Always returns a non-negative value.
 */
export function euclideanDistance(a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normalize a vector to unit length (magnitude ≈ 1.0).
 * Returns {x: 0, y: 0} for zero-length vectors.
 */
export function normalizeVector(v: Vector2D): Vector2D {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  if (mag === 0) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / mag, y: v.y / mag };
}

/**
 * Rotate a vector by the given angle in degrees (counter-clockwise).
 * Returns {x: 0, y: 0} for zero-length vectors.
 */
export function rotateVector(v: Vector2D, angleDeg: number): Vector2D {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}

/**
 * Linearly interpolate between two positions.
 * t=0 returns a, t=1 returns b, t=0.5 returns the midpoint.
 * t is not clamped — values outside [0,1] extrapolate.
 */
export function lerp(a: Position, b: Position, t: number): Position {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * Clamp a vector's magnitude to a maximum value.
 * Returns the original vector if its magnitude is already ≤ max.
 * Returns {x: 0, y: 0} for zero-length vectors.
 */
export function clampMagnitude(v: Vector2D, max: number): Vector2D {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  if (mag === 0 || mag <= max) {
    return { x: v.x, y: v.y };
  }
  const scale = max / mag;
  return { x: v.x * scale, y: v.y * scale };
}

/**
 * Calculate the angle in degrees between two positions,
 * measured from a to b. Returns the angle in the range (-180, 180].
 * Returns 0 when both positions are identical.
 */
export function angleBetween(a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    return 0;
  }
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Normalize an angle in degrees to the range [-180, 180].
 */
export function normalizeAngle(deg: number): number {
  // Handle non-finite inputs safely
  if (!Number.isFinite(deg)) {
    return 0;
  }
  let result = deg % 360;
  if (result > 180) {
    result -= 360;
  } else if (result <= -180) {
    result += 360;
  }
  // Avoid returning -0
  return result === 0 ? 0 : result;
}

/**
 * Return the sign of a number: -1, 0, or 1.
 */
export function sign(n: number): number {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

/**
 * Calculate the dot product of two vectors.
 */
export function dotProduct(a: Vector2D, b: Vector2D): number {
  return a.x * b.x + a.y * b.y;
}
