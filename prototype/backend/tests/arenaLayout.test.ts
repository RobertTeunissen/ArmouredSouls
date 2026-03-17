import {
  calculateArenaRadius,
  calculateSpawnPositions,
  createArena,
  clampToArena,
} from '../src/services/arena/arenaLayout';
import { euclideanDistance } from '../src/services/arena/vector2d';
import { ArenaConfig } from '../src/services/arena/types';

describe('arenaLayout', () => {
  describe('calculateArenaRadius', () => {
    it('should return 16 for 1v1 (2 robots)', () => {
      expect(calculateArenaRadius(2)).toBe(16);
    });

    it('should return 16 for a single robot', () => {
      expect(calculateArenaRadius(1)).toBe(16);
    });

    it('should return 20 for 2v2 (4 robots)', () => {
      expect(calculateArenaRadius(4)).toBe(20);
    });

    it('should return 20 for 3 robots', () => {
      expect(calculateArenaRadius(3)).toBe(20);
    });

    it('should scale for larger battles using formula 16 + (totalRobots - 2) * 3', () => {
      // 5v5 = 10 robots → 16 + (10 - 2) * 3 = 40
      expect(calculateArenaRadius(10)).toBe(40);
      // 3v3 = 6 robots → 16 + (6 - 2) * 3 = 28
      expect(calculateArenaRadius(6)).toBe(28);
      // 5 robots → 16 + (5 - 2) * 3 = 25
      expect(calculateArenaRadius(5)).toBe(25);
    });

    it('should use overrideRadius when provided', () => {
      expect(calculateArenaRadius(2, 50)).toBe(50);
      expect(calculateArenaRadius(10, 100)).toBe(100);
    });

    it('should use overrideRadius even when 0', () => {
      expect(calculateArenaRadius(2, 0)).toBe(0);
    });
  });

  describe('calculateSpawnPositions', () => {
    it('should place 1v1 robots on opposite sides of horizontal axis', () => {
      const teams = calculateSpawnPositions([1, 1], 16);
      // Team 0 at (-14, 0), Team 1 at (14, 0)
      expect(teams[0][0]).toEqual({ x: -14, y: 0 });
      expect(teams[1][0]).toEqual({ x: 14, y: 0 });
    });

    it('should produce 28 units apart for 1v1 with radius 16', () => {
      const teams = calculateSpawnPositions([1, 1], 16);
      const dist = euclideanDistance(teams[0][0], teams[1][0]);
      expect(dist).toBe(28);
    });

    it('should place 2v2 teams with vertical spread', () => {
      const teams = calculateSpawnPositions([2, 2], 20);
      // Team 0: (-18, -2) and (-18, 2)
      expect(teams[0][0]).toEqual({ x: -18, y: -2 });
      expect(teams[0][1]).toEqual({ x: -18, y: 2 });
      // Team 1: (18, -2) and (18, 2)
      expect(teams[1][0]).toEqual({ x: 18, y: -2 });
      expect(teams[1][1]).toEqual({ x: 18, y: 2 });
    });

    it('should spread 3 robots vertically 4 units apart', () => {
      const teams = calculateSpawnPositions([3, 3], 20);
      // Team 0: 3 robots, totalSpread = 8, startY = -4
      expect(teams[0][0]).toEqual({ x: -18, y: -4 });
      expect(teams[0][1]).toEqual({ x: -18, y: 0 });
      expect(teams[0][2]).toEqual({ x: -18, y: 4 });
    });

    it('should keep all spawn positions inside the arena', () => {
      const radius = 20;
      const teams = calculateSpawnPositions([2, 2], radius);
      for (const team of teams) {
        for (const pos of team) {
          const dist = euclideanDistance(pos, { x: 0, y: 0 });
          expect(dist).toBeLessThanOrEqual(radius);
        }
      }
    });

    it('should handle asymmetric team sizes', () => {
      const teams = calculateSpawnPositions([1, 3], 20);
      expect(teams[0]).toHaveLength(1);
      expect(teams[1]).toHaveLength(3);
      // Team 0 single robot on axis
      expect(teams[0][0].y).toBe(0);
    });
  });

  describe('createArena', () => {
    it('should create a 1v1 arena with correct radius and center', () => {
      const arena = createArena([1, 1]);
      expect(arena.radius).toBe(16);
      expect(arena.center).toEqual({ x: 0, y: 0 });
      expect(arena.spawnPositions).toHaveLength(2);
    });

    it('should create a 2v2 arena with correct radius', () => {
      const arena = createArena([2, 2]);
      expect(arena.radius).toBe(20);
      expect(arena.spawnPositions).toHaveLength(4);
    });

    it('should flatten spawn positions from all teams', () => {
      const arena = createArena([1, 1]);
      expect(arena.spawnPositions[0]).toEqual({ x: -14, y: 0 });
      expect(arena.spawnPositions[1]).toEqual({ x: 14, y: 0 });
    });

    it('should respect overrideRadius', () => {
      const arena = createArena([1, 1], 30);
      expect(arena.radius).toBe(30);
      // Spawn offset = 30 - 2 = 28
      expect(arena.spawnPositions[0]).toEqual({ x: -28, y: 0 });
      expect(arena.spawnPositions[1]).toEqual({ x: 28, y: 0 });
    });

    it('should not include zones by default', () => {
      const arena = createArena([1, 1]);
      expect(arena.zones).toBeUndefined();
    });
  });

  describe('clampToArena', () => {
    const arena: ArenaConfig = {
      radius: 16,
      center: { x: 0, y: 0 },
      spawnPositions: [],
    };

    it('should not change positions inside the arena', () => {
      const pos = { x: 5, y: 5 };
      const result = clampToArena(pos, arena);
      expect(result).toEqual({ x: 5, y: 5 });
    });

    it('should not change positions exactly on the boundary', () => {
      const pos = { x: 16, y: 0 };
      const result = clampToArena(pos, arena);
      expect(result.x).toBeCloseTo(16, 10);
      expect(result.y).toBeCloseTo(0, 10);
    });

    it('should clamp positions outside the arena to the boundary', () => {
      const pos = { x: 32, y: 0 };
      const result = clampToArena(pos, arena);
      expect(result.x).toBeCloseTo(16, 10);
      expect(result.y).toBeCloseTo(0, 10);
    });

    it('should clamp diagonal positions to the boundary circle', () => {
      // Position at (20, 20), distance from center = ~28.28
      const pos = { x: 20, y: 20 };
      const result = clampToArena(pos, arena);
      const dist = euclideanDistance(result, { x: 0, y: 0 });
      expect(dist).toBeCloseTo(16, 5);
    });

    it('should preserve direction when clamping', () => {
      const pos = { x: 30, y: 0 };
      const result = clampToArena(pos, arena);
      expect(result.x).toBeCloseTo(16, 10);
      expect(result.y).toBeCloseTo(0, 10);
    });

    it('should return center position as-is', () => {
      const result = clampToArena({ x: 0, y: 0 }, arena);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('should handle negative coordinates', () => {
      const pos = { x: -30, y: 0 };
      const result = clampToArena(pos, arena);
      expect(result.x).toBeCloseTo(-16, 10);
      expect(result.y).toBeCloseTo(0, 10);
    });

    it('should always produce a position within the arena radius', () => {
      const testPositions = [
        { x: 100, y: 100 },
        { x: -50, y: 30 },
        { x: 0, y: -200 },
        { x: 1, y: 1 },
      ];
      for (const pos of testPositions) {
        const result = clampToArena(pos, arena);
        const dist = euclideanDistance(result, arena.center);
        expect(dist).toBeLessThanOrEqual(arena.radius + 0.0001);
      }
    });
  });
});
