import * as fc from 'fast-check';
import {
  euclideanDistance,
  normalizeVector,
  normalizeAngle,
  Position,
  Vector2D,
} from '../../src/services/arena/vector2d';

/**
 * Property-based tests for vector2d math utilities.
 * Uses fast-check to verify universal properties across random inputs.
 */

/** Arbitrary for Position with reasonable coordinate range */
const arbPosition = (): fc.Arbitrary<Position> =>
  fc.record({
    x: fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
    y: fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
  });

/** Arbitrary for non-zero Vector2D with magnitude large enough to avoid subnormal float issues */
const arbNonZeroVector = (): fc.Arbitrary<Vector2D> =>
  fc
    .record({
      x: fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
      y: fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
    })
    .filter((v) => v.x * v.x + v.y * v.y > 1e-300);

describe('vector2d property tests', () => {
  /**
   * Property 1: euclideanDistance is symmetric — distance(a,b) === distance(b,a) for all positions
   * **Validates: Requirements 1.6**
   */
  describe('Property 1: euclideanDistance symmetry', () => {
    it('should satisfy distance(a, b) === distance(b, a) for all positions', () => {
      fc.assert(
        fc.property(arbPosition(), arbPosition(), (a, b) => {
          const dAB = euclideanDistance(a, b);
          const dBA = euclideanDistance(b, a);
          expect(dAB).toBeCloseTo(dBA, 10);
        }),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 2: normalizeVector produces unit length (magnitude ≈ 1.0) for all non-zero vectors,
   * and {0,0} for zero vectors
   * **Validates: Requirements 1.6**
   */
  describe('Property 2: normalizeVector produces unit length or zero', () => {
    it('should produce magnitude ≈ 1.0 for all non-zero vectors', () => {
      fc.assert(
        fc.property(arbNonZeroVector(), (v) => {
          const result = normalizeVector(v);
          const mag = Math.sqrt(result.x * result.x + result.y * result.y);
          expect(mag).toBeCloseTo(1.0, 5);
        }),
        { numRuns: 500 }
      );
    });

    it('should return {0, 0} for the zero vector', () => {
      const result = normalizeVector({ x: 0, y: 0 });
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  /**
   * Property 3: normalizeAngle always returns a value in [-180, 180] for any input angle
   * **Validates: Requirements 9.1**
   */
  describe('Property 3: normalizeAngle range', () => {
    it('should always return a value in [-180, 180] for any finite angle', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1e9, max: 1e9, noNaN: true, noDefaultInfinity: true }),
          (angle) => {
            const result = normalizeAngle(angle);
            expect(result).toBeGreaterThanOrEqual(-180);
            expect(result).toBeLessThanOrEqual(180);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should return 0 for non-finite inputs', () => {
      expect(normalizeAngle(Infinity)).toBe(0);
      expect(normalizeAngle(-Infinity)).toBe(0);
      expect(normalizeAngle(NaN)).toBe(0);
    });
  });
});
