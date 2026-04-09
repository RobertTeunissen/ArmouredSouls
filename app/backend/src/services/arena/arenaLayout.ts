/**
 * Arena Layout Module
 *
 * Handles arena creation, spawn position calculation, and boundary clamping.
 * All functions are pure with no module-level mutable state.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 1.8
 */

import { Position, euclideanDistance, normalizeVector } from './vector2d';
import { ArenaConfig } from './types';

/**
 * Calculate the arena radius based on the total number of robots.
 *
 * - 1v1 (2 robots): radius 16 (32 unit diameter)
 * - 2v2 (4 robots): radius 20 (40 unit diameter)
 * - Larger: 16 + (totalRobots - 2) * 3
 *
 * An optional override bypasses the scaling formula entirely.
 *
 * Req 1.1, 1.3, 1.4, 1.8
 */
export function calculateArenaRadius(totalRobots: number, overrideRadius?: number): number {
  if (overrideRadius !== undefined) return overrideRadius;
  if (totalRobots <= 2) return 16;
  if (totalRobots <= 4) return 20;
  return 16 + (totalRobots - 2) * 3;
}

/**
 * Calculate spawn positions for each team.
 *
 * Teams are placed on opposite sides of the arena along the horizontal axis:
 * - Team 0 on the left (-x)
 * - Team 1 on the right (+x)
 *
 * Each robot spawns at (radius - 2) units from center on its team's side.
 * For teams with multiple robots, they are spread vertically 4 units apart,
 * centered on y = 0.
 *
 * Returns a nested array: teams[teamIndex][robotIndex] = Position.
 *
 * Req 1.2, 1.3, 1.4
 */
export function calculateSpawnPositions(
  teamSizes: number[],
  radius: number,
): Position[][] {
  const spawnOffset = radius - 2;
  const teams: Position[][] = [];

  for (let teamIdx = 0; teamIdx < teamSizes.length; teamIdx++) {
    const teamPositions: Position[] = [];
    const teamCount = teamSizes[teamIdx];
    const xSign = teamIdx === 0 ? -1 : 1;

    if (teamCount === 1) {
      // Single robot: on horizontal axis
      teamPositions.push({ x: xSign * spawnOffset, y: 0 });
    } else {
      // Multiple robots: spread vertically, 4 units apart
      const totalSpread = (teamCount - 1) * 4;
      const startY = -totalSpread / 2;
      for (let i = 0; i < teamCount; i++) {
        teamPositions.push({
          x: xSign * spawnOffset,
          y: startY + i * 4,
        });
      }
    }

    teams.push(teamPositions);
  }

  return teams;
}

/**
 * Create a complete ArenaConfig for a battle.
 *
 * Calculates the radius from team sizes (or uses the override), computes
 * spawn positions, and returns the full arena configuration.
 *
 * Req 1.1, 1.2, 1.3, 1.4, 1.8
 */
export function createArena(
  teamSizes: number[],
  overrideRadius?: number,
): ArenaConfig {
  const totalRobots = teamSizes.reduce((sum, size) => sum + size, 0);
  const radius = calculateArenaRadius(totalRobots, overrideRadius);
  const teams = calculateSpawnPositions(teamSizes, radius);

  // Flatten team positions into a single spawn list
  const spawnPositions: Position[] = teams.flat();

  return {
    radius,
    center: { x: 0, y: 0 },
    spawnPositions,
  };
}

/**
 * Clamp a position to the circular arena boundary.
 *
 * If the position is inside the arena, it is returned unchanged.
 * If outside, it is projected onto the boundary circle (nearest point
 * on the circle from center toward the position).
 *
 * Positions exactly at center are returned as-is (no direction to project).
 *
 * Req 1.7
 */
export function clampToArena(position: Position, arena: ArenaConfig): Position {
  const dist = euclideanDistance(position, arena.center);

  if (dist <= arena.radius) {
    return { x: position.x, y: position.y };
  }

  // Position is outside — project onto boundary
  const direction = normalizeVector({
    x: position.x - arena.center.x,
    y: position.y - arena.center.y,
  });

  return {
    x: arena.center.x + direction.x * arena.radius,
    y: arena.center.y + direction.y * arena.radius,
  };
}
