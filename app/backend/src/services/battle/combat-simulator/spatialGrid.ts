/**
 * Spatial Grid — Grid-based spatial partitioning for combat threat evaluation.
 *
 * Divides the arena into cells sized by maxWeaponRange + safety margin,
 * enabling O(n×k) threat queries instead of O(n²) brute-force scanning.
 * Each tick, the grid is rebuilt from current robot positions. getNearby()
 * returns all robots in the same or adjacent cells (8-neighbourhood),
 * guaranteeing that any robot within weapon range is included.
 *
 * All functions are pure (stateless per-call) — the grid is the only mutable structure.
 *
 * Spec #44: Grand Melee — Algorithmic Optimizations (R1.1, R1.2, R1.5)
 */

import type { Position } from '../../arena/vector2d';

/** Minimal state interface — only needs position and isAlive */
export interface SpatialEntity {
  position: Position;
  isAlive: boolean;
}

/**
 * Grid-based spatial index for fast nearby-robot queries.
 *
 * Cell size is set to maxWeaponRange + 10 (safety margin), ensuring that
 * any robot within attack range of another is always in the same cell or
 * an adjacent cell (8-neighbourhood). This is conservative — it may include
 * robots slightly out of range (handled by existing distance checks in
 * attack resolution), but never excludes a valid target.
 */
export class SpatialGrid {
  private readonly cellSize: number;
  private cells: Map<string, number[]>;
  private robotCells: string[];

  constructor(maxWeaponRange: number) {
    // Cell size = max weapon range + safety margin of 10 units
    // Ensures any robot within attack range is in same or adjacent cell
    this.cellSize = Math.max(maxWeaponRange + 10, 1);
    this.cells = new Map();
    this.robotCells = [];
  }

  /**
   * Rebuild the entire grid from current robot positions.
   * Called once per simulation tick. Only indexes alive robots.
   */
  update(entities: SpatialEntity[]): void {
    this.cells.clear();
    this.robotCells = new Array(entities.length);

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity.isAlive) {
        this.robotCells[i] = '';
        continue;
      }

      const key = this.getCellKey(entity.position);
      this.robotCells[i] = key;

      const cell = this.cells.get(key);
      if (cell) {
        cell.push(i);
      } else {
        this.cells.set(key, [i]);
      }
    }
  }

  /**
   * Get indices of all alive robots in the same cell or 8-neighbourhood.
   * Returns an array of robot indices (not including the queried robot itself).
   *
   * This is the core performance optimization — instead of evaluating all N
   * robots for threat scoring, we only evaluate the k nearby ones.
   */
  getNearby(robotIndex: number): number[] {
    const key = this.robotCells[robotIndex];
    if (!key) return [];

    const [cx, cy] = this.parseCellKey(key);
    const result: number[] = [];

    // Check 3×3 neighbourhood (self + 8 adjacent cells)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const neighbourKey = `${cx + dx},${cy + dy}`;
        const cell = this.cells.get(neighbourKey);
        if (!cell) continue;
        for (const idx of cell) {
          if (idx !== robotIndex) {
            result.push(idx);
          }
        }
      }
    }

    return result;
  }

  /** Map a position to its cell grid coordinates as a string key. */
  private getCellKey(pos: Position): string {
    const cx = Math.floor(pos.x / this.cellSize);
    const cy = Math.floor(pos.y / this.cellSize);
    return `${cx},${cy}`;
  }

  /** Parse a cell key back into grid coordinates. */
  private parseCellKey(key: string): [number, number] {
    const comma = key.indexOf(',');
    return [
      parseInt(key.substring(0, comma), 10),
      parseInt(key.substring(comma + 1), 10),
    ];
  }
}

/**
 * Compute the maximum weapon range across all robots in a battle.
 * Used to determine the spatial grid cell size.
 * Falls back to 15 (long range band max) if no weapons are equipped.
 */
export function computeMaxWeaponRange(robots: Array<{ mainWeapon?: { weapon?: { rangeBand?: string } | null } | null; offhandWeapon?: { weapon?: { rangeBand?: string } | null } | null }>): number {
  const RANGE_MAP: Record<string, number> = {
    melee: 2,
    short: 6,
    mid: 12,
    long: 15,
  };

  let maxRange = 0;
  for (const robot of robots) {
    const mainRange = robot.mainWeapon?.weapon?.rangeBand;
    const offRange = robot.offhandWeapon?.weapon?.rangeBand;
    if (mainRange) maxRange = Math.max(maxRange, RANGE_MAP[mainRange] ?? 15);
    if (offRange) maxRange = Math.max(maxRange, RANGE_MAP[offRange] ?? 15);
  }

  // Default to long range if no weapons found (shouldn't happen in practice)
  return maxRange > 0 ? maxRange : 15;
}
