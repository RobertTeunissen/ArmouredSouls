/**
 * Property-Based Tests for Streaming Studio Operating Costs
 * Property 8: Streaming Studio Operating Cost Formula
 * 
 * **Validates: Requirements 5.6, 5.9**
 * 
 * For any Streaming Studio at level L (where L > 0), the daily operating cost 
 * should equal L × 100 credits.
 */

import fc from 'fast-check';
import { calculateFacilityOperatingCost } from '../src/utils/economyCalculations';

describe('Property 8: Streaming Studio Operating Cost Formula', () => {
  /**
   * Property 8: For any Streaming Studio at level L (where L > 0), 
   * the daily operating cost should equal L × 100 credits
   */
  test('Property 8: Operating cost equals level × 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // level (1-10)
        (level) => {
          // Calculate operating cost using the function
          const actualCost = calculateFacilityOperatingCost('streaming_studio', level);

          // Calculate expected cost using the formula: level × 100
          const expectedCost = level * 100;

          // Property: Operating cost should match the formula exactly
          expect(actualCost).toBe(expectedCost);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.1: Level 0 (not purchased) should have zero operating cost
   */
  test('Property 8.1: Level 0 has zero operating cost', () => {
    const cost = calculateFacilityOperatingCost('streaming_studio', 0);
    expect(cost).toBe(0);
  });

  /**
   * Property 8.2: Specific level examples from requirements
   */
  test('Property 8.2: Specific level examples', () => {
    // Level 1: ₡100/day (Requirement 5.5)
    expect(calculateFacilityOperatingCost('streaming_studio', 1)).toBe(100);

    // Level 10: ₡1,000/day (Requirement 5.7)
    expect(calculateFacilityOperatingCost('streaming_studio', 10)).toBe(1000);

    // Additional examples
    expect(calculateFacilityOperatingCost('streaming_studio', 5)).toBe(500);
    expect(calculateFacilityOperatingCost('streaming_studio', 7)).toBe(700);
  });

  /**
   * Property 8.3: Operating cost increases linearly with level
   */
  test('Property 8.3: Operating cost increases linearly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }), // level1 (1-9)
        fc.integer({ min: 1, max: 5 }), // level increase
        (level1, increase) => {
          const level2 = Math.min(level1 + increase, 10); // Cap at max level

          const cost1 = calculateFacilityOperatingCost('streaming_studio', level1);
          const cost2 = calculateFacilityOperatingCost('streaming_studio', level2);

          // Property: Cost increase should equal level increase × 100
          const expectedIncrease = (level2 - level1) * 100;
          const actualIncrease = cost2 - cost1;

          expect(actualIncrease).toBe(expectedIncrease);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.4: Operating cost is monotonically increasing with level
   */
  test('Property 8.4: Higher levels have higher operating costs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }), // level1
        fc.integer({ min: 1, max: 5 }), // level increase
        (level1, increase) => {
          const level2 = Math.min(level1 + increase, 10);

          // Skip if no actual increase
          if (level2 === level1) {
            return true;
          }

          const cost1 = calculateFacilityOperatingCost('streaming_studio', level1);
          const cost2 = calculateFacilityOperatingCost('streaming_studio', level2);

          // Property: Higher level should have strictly higher cost
          expect(cost2).toBeGreaterThan(cost1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.5: Operating cost per level is constant (₡100)
   */
  test('Property 8.5: Each level adds exactly ₡100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }), // level (1-9, so we can check level+1)
        (level) => {
          const costAtLevel = calculateFacilityOperatingCost('streaming_studio', level);
          const costAtNextLevel = calculateFacilityOperatingCost('streaming_studio', level + 1);

          // Property: Each level should add exactly ₡100
          const costIncrease = costAtNextLevel - costAtLevel;
          expect(costIncrease).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.6: Operating cost formula consistency across all levels
   */
  test('Property 8.6: Formula consistency for all levels', () => {
    // Test all levels from 0 to 10
    for (let level = 0; level <= 10; level++) {
      const actualCost = calculateFacilityOperatingCost('streaming_studio', level);
      const expectedCost = level * 100;

      expect(actualCost).toBe(expectedCost);
    }
  });
});
