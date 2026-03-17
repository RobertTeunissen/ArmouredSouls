import {
  euclideanDistance,
  normalizeVector,
  rotateVector,
  lerp,
  clampMagnitude,
  angleBetween,
  normalizeAngle,
  sign,
  dotProduct,
  Position,
  Vector2D,
} from '../src/services/arena/vector2d';

describe('vector2d', () => {
  describe('euclideanDistance', () => {
    it('should return 0 for identical positions', () => {
      const p: Position = { x: 3, y: 4 };
      expect(euclideanDistance(p, p)).toBe(0);
    });

    it('should calculate distance for a 3-4-5 triangle', () => {
      const a: Position = { x: 0, y: 0 };
      const b: Position = { x: 3, y: 4 };
      expect(euclideanDistance(a, b)).toBe(5);
    });

    it('should be symmetric', () => {
      const a: Position = { x: 1, y: 2 };
      const b: Position = { x: 7, y: -3 };
      expect(euclideanDistance(a, b)).toBe(euclideanDistance(b, a));
    });

    it('should handle negative coordinates', () => {
      const a: Position = { x: -3, y: -4 };
      const b: Position = { x: 0, y: 0 };
      expect(euclideanDistance(a, b)).toBe(5);
    });
  });

  describe('normalizeVector', () => {
    it('should return {0,0} for zero vector', () => {
      const result = normalizeVector({ x: 0, y: 0 });
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should produce unit length for non-zero vectors', () => {
      const result = normalizeVector({ x: 3, y: 4 });
      const mag = Math.sqrt(result.x * result.x + result.y * result.y);
      expect(mag).toBeCloseTo(1.0, 10);
    });

    it('should preserve direction', () => {
      const v: Vector2D = { x: 6, y: 8 };
      const result = normalizeVector(v);
      expect(result.x).toBeCloseTo(0.6, 10);
      expect(result.y).toBeCloseTo(0.8, 10);
    });

    it('should handle vectors along axes', () => {
      expect(normalizeVector({ x: 5, y: 0 })).toEqual({ x: 1, y: 0 });
      expect(normalizeVector({ x: 0, y: -7 })).toEqual({ x: 0, y: -1 });
    });
  });

  describe('rotateVector', () => {
    it('should not change vector when rotating by 0 degrees', () => {
      const v: Vector2D = { x: 1, y: 0 };
      const result = rotateVector(v, 0);
      expect(result.x).toBeCloseTo(1, 10);
      expect(result.y).toBeCloseTo(0, 10);
    });

    it('should rotate 90 degrees counter-clockwise', () => {
      const v: Vector2D = { x: 1, y: 0 };
      const result = rotateVector(v, 90);
      expect(result.x).toBeCloseTo(0, 10);
      expect(result.y).toBeCloseTo(1, 10);
    });

    it('should rotate 180 degrees', () => {
      const v: Vector2D = { x: 1, y: 0 };
      const result = rotateVector(v, 180);
      expect(result.x).toBeCloseTo(-1, 10);
      expect(result.y).toBeCloseTo(0, 10);
    });

    it('should handle zero vector rotation', () => {
      const result = rotateVector({ x: 0, y: 0 }, 45);
      expect(result.x).toBeCloseTo(0, 10);
      expect(result.y).toBeCloseTo(0, 10);
    });

    it('should preserve magnitude', () => {
      const v: Vector2D = { x: 3, y: 4 };
      const result = rotateVector(v, 37);
      const origMag = Math.sqrt(v.x * v.x + v.y * v.y);
      const newMag = Math.sqrt(result.x * result.x + result.y * result.y);
      expect(newMag).toBeCloseTo(origMag, 10);
    });
  });

  describe('lerp', () => {
    it('should return a when t=0', () => {
      const a: Position = { x: 0, y: 0 };
      const b: Position = { x: 10, y: 20 };
      expect(lerp(a, b, 0)).toEqual({ x: 0, y: 0 });
    });

    it('should return b when t=1', () => {
      const a: Position = { x: 0, y: 0 };
      const b: Position = { x: 10, y: 20 };
      expect(lerp(a, b, 1)).toEqual({ x: 10, y: 20 });
    });

    it('should return midpoint when t=0.5', () => {
      const a: Position = { x: 0, y: 0 };
      const b: Position = { x: 10, y: 20 };
      expect(lerp(a, b, 0.5)).toEqual({ x: 5, y: 10 });
    });

    it('should extrapolate beyond [0,1]', () => {
      const a: Position = { x: 0, y: 0 };
      const b: Position = { x: 10, y: 0 };
      expect(lerp(a, b, 2)).toEqual({ x: 20, y: 0 });
    });
  });

  describe('clampMagnitude', () => {
    it('should not change vectors within the limit', () => {
      const v: Vector2D = { x: 3, y: 4 }; // magnitude 5
      const result = clampMagnitude(v, 10);
      expect(result.x).toBe(3);
      expect(result.y).toBe(4);
    });

    it('should clamp vectors exceeding the limit', () => {
      const v: Vector2D = { x: 6, y: 8 }; // magnitude 10
      const result = clampMagnitude(v, 5);
      const mag = Math.sqrt(result.x * result.x + result.y * result.y);
      expect(mag).toBeCloseTo(5, 10);
    });

    it('should preserve direction when clamping', () => {
      const v: Vector2D = { x: 6, y: 8 }; // magnitude 10
      const result = clampMagnitude(v, 5);
      expect(result.x).toBeCloseTo(3, 10);
      expect(result.y).toBeCloseTo(4, 10);
    });

    it('should handle zero vector', () => {
      const result = clampMagnitude({ x: 0, y: 0 }, 5);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should handle vector exactly at the limit', () => {
      const v: Vector2D = { x: 3, y: 4 }; // magnitude 5
      const result = clampMagnitude(v, 5);
      expect(result.x).toBe(3);
      expect(result.y).toBe(4);
    });
  });

  describe('angleBetween', () => {
    it('should return 0 for identical positions', () => {
      const p: Position = { x: 5, y: 5 };
      expect(angleBetween(p, p)).toBe(0);
    });

    it('should return 0 degrees for east direction', () => {
      expect(angleBetween({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0, 10);
    });

    it('should return 90 degrees for north direction', () => {
      expect(angleBetween({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 10);
    });

    it('should return 180 or -180 for west direction', () => {
      const angle = angleBetween({ x: 0, y: 0 }, { x: -1, y: 0 });
      expect(Math.abs(angle)).toBeCloseTo(180, 10);
    });

    it('should return -90 degrees for south direction', () => {
      expect(angleBetween({ x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(-90, 10);
    });
  });

  describe('normalizeAngle', () => {
    it('should keep angles already in [-180, 180]', () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(90)).toBe(90);
      expect(normalizeAngle(-90)).toBe(-90);
      expect(normalizeAngle(180)).toBe(180);
    });

    it('should wrap angles > 180', () => {
      expect(normalizeAngle(270)).toBe(-90);
      expect(normalizeAngle(360)).toBe(0);
      expect(normalizeAngle(540)).toBe(180);
    });

    it('should wrap angles < -180', () => {
      expect(normalizeAngle(-270)).toBe(90);
      expect(normalizeAngle(-360)).toBe(0);
    });

    it('should handle large angles', () => {
      const result = normalizeAngle(3600);
      expect(result).toBeGreaterThanOrEqual(-180);
      expect(result).toBeLessThanOrEqual(180);
    });

    it('should return 0 for non-finite inputs', () => {
      expect(normalizeAngle(Infinity)).toBe(0);
      expect(normalizeAngle(-Infinity)).toBe(0);
      expect(normalizeAngle(NaN)).toBe(0);
    });
  });

  describe('sign', () => {
    it('should return 1 for positive numbers', () => {
      expect(sign(5)).toBe(1);
      expect(sign(0.001)).toBe(1);
    });

    it('should return -1 for negative numbers', () => {
      expect(sign(-5)).toBe(-1);
      expect(sign(-0.001)).toBe(-1);
    });

    it('should return 0 for zero', () => {
      expect(sign(0)).toBe(0);
    });
  });

  describe('dotProduct', () => {
    it('should return 0 for perpendicular vectors', () => {
      expect(dotProduct({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
    });

    it('should return positive for same-direction vectors', () => {
      expect(dotProduct({ x: 1, y: 0 }, { x: 1, y: 0 })).toBe(1);
    });

    it('should return negative for opposite-direction vectors', () => {
      expect(dotProduct({ x: 1, y: 0 }, { x: -1, y: 0 })).toBe(-1);
    });

    it('should calculate correctly for arbitrary vectors', () => {
      expect(dotProduct({ x: 2, y: 3 }, { x: 4, y: 5 })).toBe(23);
    });

    it('should return 0 when either vector is zero', () => {
      expect(dotProduct({ x: 0, y: 0 }, { x: 5, y: 3 })).toBe(0);
    });
  });
});
