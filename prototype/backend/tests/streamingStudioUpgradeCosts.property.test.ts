/**
 * Property-Based Tests for Streaming Studio Upgrade Costs
 * Property 7: Streaming Studio Upgrade Cost Formula
 * 
 * **Validates: Requirements 5.2**
 * 
 * For any Streaming Studio at level N (where N < 10), the cost to upgrade 
 * to level N+1 should equal (N + 1) × 100,000 credits
 */

import fc from 'fast-check';
import { getFacilityConfig, getFacilityUpgradeCost } from '../src/config/facilities';

describe('Property 7: Streaming Studio Upgrade Cost Formula', () => {
  afterAll(() => {
    // Pure unit test - no cleanup needed
  });

  /**
   * Property 7: For any Streaming Studio at level N (where N < 10), 
   * the cost to upgrade to level N+1 equals (N + 1) × 100,000
   */
  test('Property 7: Upgrade cost formula correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 9 }), // Current level N (0-9, since max is 10)
        async (currentLevel) => {
          // Get the Streaming Studio configuration
          const config = getFacilityConfig('streaming_studio');
          
          // Property: Configuration should exist
          expect(config).toBeDefined();
          expect(config).not.toBeNull();

          // Calculate expected upgrade cost using the formula: (N + 1) × 100,000
          const expectedCost = (currentLevel + 1) * 100000;

          // Get actual upgrade cost from configuration
          const actualCost = config!.costs[currentLevel];

          // Property: Upgrade cost should match the formula
          expect(actualCost).toBe(expectedCost);

          // Property: Using helper function should give same result
          const helperCost = getFacilityUpgradeCost('streaming_studio', currentLevel);
          expect(helperCost).toBe(expectedCost);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 7.1: Upgrade costs should increase monotonically
   */
  test('Property 7.1: Upgrade costs increase with each level', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 8 }), // Current level (0-8, to compare with next level)
        async (currentLevel) => {
          const config = getFacilityConfig('streaming_studio');
          
          const currentCost = config!.costs[currentLevel];
          const nextCost = config!.costs[currentLevel + 1];

          // Property: Each upgrade should cost more than the previous one
          expect(nextCost).toBeGreaterThan(currentCost);

          // Property: The increase should be exactly 100,000
          expect(nextCost - currentCost).toBe(100000);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7.2: Specific upgrade cost examples from requirements
   */
  test('Property 7.2: Specific upgrade costs match requirements', () => {
    const config = getFacilityConfig('streaming_studio');
    
    // Requirement 5.1: Level 1 costs ₡100,000
    expect(config!.costs[0]).toBe(100000);
    
    // Requirement 5.3: Upgrading from Level 3 to Level 4 costs ₡400,000
    expect(config!.costs[3]).toBe(400000);
    
    // Requirement 5.4: Upgrading from Level 9 to Level 10 costs ₡1,000,000
    expect(config!.costs[9]).toBe(1000000);
  });

  /**
   * Property 7.3: Total investment to reach any level
   */
  test('Property 7.3: Total investment formula correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // Target level (1-10)
        async (targetLevel) => {
          const config = getFacilityConfig('streaming_studio');
          
          // Calculate total investment by summing all upgrade costs
          let actualTotal = 0;
          for (let i = 0; i < targetLevel; i++) {
            actualTotal += config!.costs[i];
          }

          // Calculate expected total using formula: sum of (i+1) × 100,000 for i=0 to targetLevel-1
          // This is: 100,000 × (1 + 2 + 3 + ... + targetLevel)
          // Which equals: 100,000 × (targetLevel × (targetLevel + 1) / 2)
          const expectedTotal = 100000 * (targetLevel * (targetLevel + 1) / 2);

          // Property: Total investment should match the sum formula
          expect(actualTotal).toBe(expectedTotal);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7.4: No upgrade cost beyond max level
   */
  test('Property 7.4: No upgrade cost at max level', () => {
    const config = getFacilityConfig('streaming_studio');
    
    // Property: Max level should be 10
    expect(config!.maxLevel).toBe(10);
    
    // Property: Should have exactly 10 cost entries (for levels 1-10)
    expect(config!.costs.length).toBe(10);
    
    // Property: Helper function should return 0 for upgrade at max level
    const costAtMax = getFacilityUpgradeCost('streaming_studio', 10);
    expect(costAtMax).toBe(0);
  });

  /**
   * Property 7.5: Upgrade cost is independent of user's current resources
   */
  test('Property 7.5: Upgrade cost is deterministic based on level only', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 9 }), // Current level
        fc.integer({ min: 0, max: 10000000 }), // User's currency (irrelevant)
        async (currentLevel, userCurrency) => {
          // Get upgrade cost multiple times
          const cost1 = getFacilityUpgradeCost('streaming_studio', currentLevel);
          const cost2 = getFacilityUpgradeCost('streaming_studio', currentLevel);
          
          const config = getFacilityConfig('streaming_studio');
          const cost3 = config!.costs[currentLevel];

          // Property: Cost should be the same regardless of how many times we query it
          expect(cost1).toBe(cost2);
          expect(cost2).toBe(cost3);

          // Property: Cost should be independent of user's currency
          // (The currency parameter is just to show it doesn't affect the cost)
          const expectedCost = (currentLevel + 1) * 100000;
          expect(cost1).toBe(expectedCost);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7.6: Costs array structure validation
   */
  test('Property 7.6: Costs array has correct structure', () => {
    const config = getFacilityConfig('streaming_studio');
    
    // Property: Costs array should have exactly 10 entries
    expect(config!.costs).toHaveLength(10);
    
    // Property: All costs should be positive integers
    config!.costs.forEach((cost, index) => {
      expect(cost).toBeGreaterThan(0);
      expect(Number.isInteger(cost)).toBe(true);
      
      // Property: Each cost should match the formula
      const expectedCost = (index + 1) * 100000;
      expect(cost).toBe(expectedCost);
    });
  });

  /**
   * Property 7.7: Upgrade cost relationship between consecutive levels
   */
  test('Property 7.7: Cost difference between levels is constant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 8 }), // Current level (0-8)
        async (level1) => {
          const level2 = level1 + 1;
          
          const cost1 = getFacilityUpgradeCost('streaming_studio', level1);
          const cost2 = getFacilityUpgradeCost('streaming_studio', level2);
          
          // Property: Difference between consecutive upgrade costs is always 100,000
          const difference = cost2 - cost1;
          expect(difference).toBe(100000);
          
          // Property: This holds for any pair of consecutive levels
          expect(cost1).toBe((level1 + 1) * 100000);
          expect(cost2).toBe((level2 + 1) * 100000);
        }
      ),
      { numRuns: 50 }
    );
  });
});
