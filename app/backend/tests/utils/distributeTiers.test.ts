import { distributeTiers } from '../../src/utils/tierConfig';
import fc from 'fast-check';

describe('distributeTiers', () => {
  it('should return all zeros when n=0', () => {
    const result = distributeTiers(0);
    expect(result).toEqual({ wimpBot: 0, averageBot: 0, expertBot: 0 });
  });

  it('should return {1,0,0} when n=1', () => {
    const result = distributeTiers(1);
    expect(result).toEqual({ wimpBot: 1, averageBot: 0, expertBot: 0 });
  });

  it('should return {1,1,0} when n=2', () => {
    const result = distributeTiers(2);
    expect(result).toEqual({ wimpBot: 1, averageBot: 1, expertBot: 0 });
  });

  it('should return {1,1,1} when n=3', () => {
    const result = distributeTiers(3);
    expect(result).toEqual({ wimpBot: 1, averageBot: 1, expertBot: 1 });
  });

  it('should return {2,2,1} when n=5', () => {
    const result = distributeTiers(5);
    expect(result).toEqual({ wimpBot: 2, averageBot: 2, expertBot: 1 });
  });

  it('should return {4,3,3} when n=10', () => {
    const result = distributeTiers(10);
    expect(result).toEqual({ wimpBot: 4, averageBot: 3, expertBot: 3 });
  });

  it('should always sum to n', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 10, 50, 100, 999]) {
      const result = distributeTiers(n);
      expect(result.wimpBot + result.averageBot + result.expertBot).toBe(n);
    }
  });

  it('should maintain wimpBot >= averageBot >= expertBot ordering', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 10, 50, 100, 999]) {
      const result = distributeTiers(n);
      expect(result.wimpBot).toBeGreaterThanOrEqual(result.averageBot);
      expect(result.averageBot).toBeGreaterThanOrEqual(result.expertBot);
    }
  });

  /**
   * Property 1: Tier distribution is correct and exhaustive
   * **Validates: Requirements 8.2, 8.3**
   *
   * For any positive integer N:
   * - Sum of all tier counts equals N
   * - Each count is either floor(N/3) or ceil(N/3)
   * - wimpBot >= averageBot >= expertBot
   */
  describe('Property-Based Tests', () => {
    it('Property 1: Tier distribution is correct and exhaustive', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 500 }), (n) => {
          const result = distributeTiers(n);

          // Sum equals N
          const sum = result.wimpBot + result.averageBot + result.expertBot;
          expect(sum).toBe(n);

          // Each count is floor(N/3) or ceil(N/3)
          const floor = Math.floor(n / 3);
          const ceil = Math.ceil(n / 3);
          expect(result.wimpBot === floor || result.wimpBot === ceil).toBe(true);
          expect(result.averageBot === floor || result.averageBot === ceil).toBe(true);
          expect(result.expertBot === floor || result.expertBot === ceil).toBe(true);

          // Ordering: wimpBot >= averageBot >= expertBot
          expect(result.wimpBot).toBeGreaterThanOrEqual(result.averageBot);
          expect(result.averageBot).toBeGreaterThanOrEqual(result.expertBot);
        }),
        { numRuns: 100 }
      );
    });
  });
});
