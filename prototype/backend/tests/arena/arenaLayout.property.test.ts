import * as fc from 'fast-check';
import {
  calculateSpawnPositions,
  calculateArenaRadius,
  clampToArena,
  createArena,
} from '../../src/services/arena/arenaLayout';
import { euclideanDistance, Position } from '../../src/services/arena/vector2d';
import { ArenaConfig } from '../../src/services/arena/types';

/**
 * Property-based tests for arenaLayout module.
 * Uses fast-check to verify universal properties across random inputs.
 */

/** Arbitrary for team sizes: 2 teams, each with 1-5 robots */
const arbTeamSizes = (): fc.Arbitrary<number[]> =>
  fc.tuple(
    fc.integer({ min: 1, max: 5 }),
    fc.integer({ min: 1, max: 5 }),
  ).map(([a, b]) => [a, b]);

/** Arbitrary for a position with large range (including far outside any arena) */
const arbPosition = (): fc.Arbitrary<Position> =>
  fc.record({
    x: fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
    y: fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
  });

/** Arbitrary for valid radius values */
const arbRadius = (): fc.Arbitrary<number> =>
  fc.integer({ min: 5, max: 100 });

describe('arenaLayout property tests', () => {
  /**
   * Property 4: All spawn positions are inside the arena boundary
   * (distance from center ≤ radius) for any team configuration
   * **Validates: Requirements 1.2, 1.3, 1.4**
   */
  describe('Property 4: All spawn positions inside arena boundary', () => {
    it('should place all spawn positions within the arena radius for any team configuration', () => {
      fc.assert(
        fc.property(arbTeamSizes(), (teamSizes) => {
          const arena = createArena(teamSizes);
          const center = arena.center;

          for (const pos of arena.spawnPositions) {
            const dist = euclideanDistance(pos, center);
            expect(dist).toBeLessThanOrEqual(arena.radius + 1e-9);
          }
        }),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 5: clampToArena always returns a position with distance from center ≤ radius
   * for any input position
   * **Validates: Requirement 1.7**
   */
  describe('Property 5: clampToArena keeps position within radius', () => {
    it('should return a position within the arena radius for any input position', () => {
      fc.assert(
        fc.property(arbPosition(), arbRadius(), (position, radius) => {
          const arena: ArenaConfig = {
            radius,
            center: { x: 0, y: 0 },
            spawnPositions: [],
          };

          const clamped = clampToArena(position, arena);
          const dist = euclideanDistance(clamped, arena.center);
          expect(dist).toBeLessThanOrEqual(radius + 1e-9);
        }),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 6: For 1v1, spawn distance between robots equals 2 × (radius − 2)
   * for any valid radius
   * **Validates: Requirement 1.2**
   */
  describe('Property 6: 1v1 spawn distance equals 2 × (radius − 2)', () => {
    it('should produce spawn distance of 2 × (radius − 2) for any valid radius', () => {
      fc.assert(
        fc.property(arbRadius(), (radius) => {
          const positions = calculateSpawnPositions([1, 1], radius);
          const robot1 = positions[0][0];
          const robot2 = positions[1][0];

          const spawnDistance = euclideanDistance(robot1, robot2);
          const expectedDistance = 2 * (radius - 2);

          expect(spawnDistance).toBeCloseTo(expectedDistance, 5);
        }),
        { numRuns: 500 },
      );
    });
  });
});
