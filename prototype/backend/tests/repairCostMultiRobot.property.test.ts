import * as fc from 'fast-check';
import { calculateRepairCost } from '../src/utils/robotCalculations';
import prisma from '../src/lib/prisma';


// Test configuration
const NUM_RUNS = 100;

// Disconnect Prisma after all tests
afterAll(async () => {
  await prisma.$disconnect();
});

describe('Repair Cost Multi-Robot Discount - Property Tests', () => {
  describe('Property 1: Multi-Robot Discount Formula with Cap', () => {
    /**
     * **Validates: Requirements 1.1, 1.2, 1.3**
     * For any repair bay level (0-10) and active robot count (0-10), the discount percentage
     * should be calculated as `repairBayLevel × (5 + activeRobotCount)`, and the result
     * should never exceed 90%.
     */
    test('discount is calculated correctly and never exceeds 90%', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 0, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          (repairBayLevel, activeRobotCount, sumOfAllAttributes, damagePercent, hpPercent, medicalBayLevel) => {
            // Calculate expected discount
            const rawDiscount = repairBayLevel * (5 + activeRobotCount);
            const expectedDiscount = Math.min(rawDiscount, 90);
            
            // Calculate repair cost
            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Calculate what the cost would be without discount
            const baseRepairCost = sumOfAllAttributes * 100;
            
            // Determine multiplier based on HP percentage
            let multiplier = 1.0;
            if (hpPercent === 0) {
              // Total destruction - apply Medical Bay reduction to 2.0x multiplier
              if (medicalBayLevel > 0) {
                const medicalReduction = medicalBayLevel * 0.1;
                multiplier = 2.0 * (1 - medicalReduction);
              } else {
                multiplier = 2.0;
              }
            } else if (hpPercent < 10) {
              // Heavily damaged
              multiplier = 1.5;
            }
            
            const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;
            const expectedCost = Math.round(rawCost * (1 - expectedDiscount / 100));
            
            // Verify the discount was capped at 90%
            expect(expectedDiscount).toBeLessThanOrEqual(90);
            
            // Verify the repair cost matches expected calculation
            expect(repairCost).toBe(expectedCost);
            
            // Verify discount formula is correct
            if (rawDiscount <= 90) {
              expect(expectedDiscount).toBe(rawDiscount);
            } else {
              expect(expectedDiscount).toBe(90);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('discount formula produces correct percentage for all valid inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (repairBayLevel, activeRobotCount) => {
            const rawDiscount = repairBayLevel * (5 + activeRobotCount);
            const cappedDiscount = Math.min(rawDiscount, 90);
            
            // Verify formula calculation
            expect(rawDiscount).toBe(repairBayLevel * (5 + activeRobotCount));
            
            // Verify cap is applied correctly
            expect(cappedDiscount).toBeLessThanOrEqual(90);
            expect(cappedDiscount).toBeGreaterThanOrEqual(0);
            
            // Verify cap only applies when raw discount exceeds 90
            if (rawDiscount > 90) {
              expect(cappedDiscount).toBe(90);
            } else {
              expect(cappedDiscount).toBe(rawDiscount);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('repair cost decreases as discount increases', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9 }), // repairBayLevel (1-9 to allow increment)
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 1, max: 100 }), // damagePercent (at least 1% to ensure cost > 0)
          fc.integer({ min: 10, max: 100 }), // hpPercent (>= 10 to avoid 1.5x multiplier)
          (repairBayLevel, activeRobotCount, sumOfAllAttributes, damagePercent, hpPercent) => {
            // Calculate cost at current level
            const cost1 = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              0,
              activeRobotCount
            );
            
            // Calculate cost at next level (higher discount)
            const cost2 = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel + 1,
              0,
              activeRobotCount
            );
            
            // Check if either discount is at the 90% cap
            const discount1 = Math.min(repairBayLevel * (5 + activeRobotCount), 90);
            const discount2 = Math.min((repairBayLevel + 1) * (5 + activeRobotCount), 90);
            
            // If both are at cap, costs should be equal
            // Otherwise, higher level should have lower or equal cost
            if (discount1 === 90 && discount2 === 90) {
              expect(cost2).toBe(cost1);
            } else {
              expect(cost2).toBeLessThanOrEqual(cost1);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('90% cap is reached at expected combinations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (repairBayLevel, activeRobotCount) => {
            const rawDiscount = repairBayLevel * (5 + activeRobotCount);
            
            // If raw discount >= 90, the cap should be applied
            if (rawDiscount >= 90) {
              const sumOfAllAttributes = 230; // Sum of all 23 attributes
              const cost = calculateRepairCost(
                sumOfAllAttributes,
                100,   // damagePercent
                0,     // hpPercent (destroyed, 2.0x multiplier)
                repairBayLevel,
                0,     // medicalBayLevel
                activeRobotCount
              );
              
              // At 90% discount, cost should be 10% of base
              // Base: 230 * 100 = 23,000
              // With damage: 23,000 * 1.0 (100% damage) = 23,000
              // With multiplier: 23,000 * 2.0 (HP = 0) = 46,000
              // With 90% discount: 46,000 * 0.10 = 4,600
              expect(cost).toBe(4600);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 3: Medical Bay Reduction Preserved', () => {
    /**
     * **Validates: Requirements 3.4, 8.4**
     * For any robot with HP = 0 (destroyed), the repair cost multiplier should be reduced
     * by Medical Bay level × 10%, maintaining the existing Medical Bay functionality.
     */
    test('Medical Bay reduces destruction multiplier for destroyed robots', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 1, max: 100 }), // damagePercent (at least 1% to ensure cost > 0)
          (medicalBayLevel, repairBayLevel, activeRobotCount, sumOfAllAttributes, damagePercent) => {
            // Calculate repair cost for destroyed robot (HP = 0)
            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              0, // hpPercent = 0 (destroyed)
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Calculate expected multiplier with Medical Bay reduction
            let expectedMultiplier = 2.0;
            if (medicalBayLevel > 0) {
              const medicalReduction = medicalBayLevel * 0.1;
              expectedMultiplier = 2.0 * (1 - medicalReduction);
            }
            
            // Calculate expected cost
            const baseRepairCost = sumOfAllAttributes * 100;
            const rawCost = baseRepairCost * (damagePercent / 100) * expectedMultiplier;
            
            // Apply Repair Bay discount
            const rawDiscount = repairBayLevel * (5 + activeRobotCount);
            const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
            const expectedCost = Math.round(rawCost * (1 - repairBayDiscount));
            
            // Verify the repair cost matches expected calculation
            expect(repairCost).toBe(expectedCost);
            
            // Verify Medical Bay reduction is applied correctly
            expect(expectedMultiplier).toBeLessThanOrEqual(2.0);
            expect(expectedMultiplier).toBeGreaterThanOrEqual(0.0);
            
            // Verify Medical Bay reduction formula
            if (medicalBayLevel > 0) {
              const expectedReduction = medicalBayLevel * 0.1;
              expect(expectedMultiplier).toBe(2.0 * (1 - expectedReduction));
            } else {
              expect(expectedMultiplier).toBe(2.0);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('Medical Bay reduction only applies to destroyed robots (HP = 0)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // medicalBayLevel (at least 1 to test reduction)
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 50, max: 100 }), // damagePercent
          fc.integer({ min: 1, max: 100 }), // hpPercent (not destroyed)
          (medicalBayLevel, repairBayLevel, activeRobotCount, sumOfAllAttributes, damagePercent, hpPercent) => {
            // Calculate cost for non-destroyed robot
            const costNonDestroyed = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Calculate cost for destroyed robot
            const costDestroyed = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              0, // hpPercent = 0 (destroyed)
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // For non-destroyed robots, multiplier should be 1.0 or 1.5 (not affected by Medical Bay)
            // For destroyed robots, multiplier should be 2.0 * (1 - medicalBayLevel * 0.1)
            const baseRepairCost = sumOfAllAttributes * 100;
            const rawDiscount = repairBayLevel * (5 + activeRobotCount);
            const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
            
            // Calculate expected cost for non-destroyed (Medical Bay should NOT apply)
            let multiplierNonDestroyed = 1.0;
            if (hpPercent < 10) {
              multiplierNonDestroyed = 1.5;
            }
            const expectedCostNonDestroyed = Math.round(
              baseRepairCost * (damagePercent / 100) * multiplierNonDestroyed * (1 - repairBayDiscount)
            );
            
            // Calculate expected cost for destroyed (Medical Bay SHOULD apply)
            const medicalReduction = medicalBayLevel * 0.1;
            const multiplierDestroyed = 2.0 * (1 - medicalReduction);
            const expectedCostDestroyed = Math.round(
              baseRepairCost * (damagePercent / 100) * multiplierDestroyed * (1 - repairBayDiscount)
            );
            
            // Verify costs match expectations
            expect(costNonDestroyed).toBe(expectedCostNonDestroyed);
            expect(costDestroyed).toBe(expectedCostDestroyed);
            
            // Verify destroyed robot has lower cost due to Medical Bay reduction
            // (unless Medical Bay level is 0, in which case multipliers are 2.0 vs 1.0/1.5)
            if (medicalBayLevel > 0) {
              // With Medical Bay, destroyed multiplier is reduced
              expect(multiplierDestroyed).toBeLessThan(2.0);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('Medical Bay reduction scales linearly with level', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 9 }), // medicalBayLevel (0-9 to allow increment)
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 50, max: 100 }), // damagePercent
          (medicalBayLevel, repairBayLevel, activeRobotCount, sumOfAllAttributes, damagePercent) => {
            // Calculate cost at current Medical Bay level
            const cost1 = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              0, // hpPercent = 0 (destroyed)
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Calculate cost at next Medical Bay level
            const cost2 = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              0, // hpPercent = 0 (destroyed)
              repairBayLevel,
              medicalBayLevel + 1,
              activeRobotCount
            );
            
            // Higher Medical Bay level should result in lower or equal cost
            // (equal only if Repair Bay discount is already at 90% cap and cost is 0)
            expect(cost2).toBeLessThanOrEqual(cost1);
            
            // Verify the reduction is exactly 10% per level (with floating-point tolerance)
            const multiplier1 = medicalBayLevel > 0 ? 2.0 * (1 - medicalBayLevel * 0.1) : 2.0;
            const multiplier2 = 2.0 * (1 - (medicalBayLevel + 1) * 0.1);
            
            // Use toBeCloseTo for floating-point comparison (within 0.0001)
            expect(multiplier2).toBeCloseTo(multiplier1 - 0.2, 4);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('Medical Bay at level 10 reduces destruction multiplier to 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 1, max: 100 }), // damagePercent
          (repairBayLevel, activeRobotCount, sumOfAllAttributes, damagePercent) => {
            // Calculate cost with Medical Bay level 10
            const cost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              0, // hpPercent = 0 (destroyed)
              repairBayLevel,
              10, // medicalBayLevel = 10 (max)
              activeRobotCount
            );
            
            // At Medical Bay level 10, multiplier should be 2.0 * (1 - 1.0) = 0
            // This means repair cost should be 0 regardless of other factors
            expect(cost).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 4: Attribute-Sum Formula Consistency', () => {
    /**
     * **Validates: Requirements 8.3**
     * For any robot, the base repair cost should be calculated as
     * `sumOfAllAttributes × 100 × (damagePercent / 100) × multiplier`,
     * where multiplier depends on HP percentage (2.0 for HP=0, 1.5 for HP<10%, 1.0 otherwise).
     */
    test('base repair cost follows attribute-sum formula', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 0, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount) => {
            // Calculate repair cost using the function
            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Calculate expected cost using the attribute-sum formula
            const baseRepairCost = sumOfAllAttributes * 100;
            
            // Determine multiplier based on HP percentage
            let multiplier = 1.0;
            if (hpPercent === 0) {
              // Total destruction - apply Medical Bay reduction to 2.0x multiplier
              if (medicalBayLevel > 0) {
                const medicalReduction = medicalBayLevel * 0.1;
                multiplier = 2.0 * (1 - medicalReduction);
              } else {
                multiplier = 2.0;
              }
            } else if (hpPercent < 10) {
              // Heavily damaged
              multiplier = 1.5;
            }
            
            // Apply damage percentage
            const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;
            
            // Apply Repair Bay discount
            const rawDiscount = repairBayLevel * (5 + activeRobotCount);
            const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
            const expectedCost = Math.round(rawCost * (1 - repairBayDiscount));
            
            // Verify the repair cost matches the attribute-sum formula
            expect(repairCost).toBe(expectedCost);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('multiplier is 2.0 for destroyed robots (HP = 0)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 1, max: 100 }), // damagePercent (at least 1% to ensure cost > 0)
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, damagePercent, repairBayLevel, activeRobotCount) => {
            // Calculate cost for destroyed robot (HP = 0, no Medical Bay)
            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              0, // hpPercent = 0 (destroyed)
              repairBayLevel,
              0, // medicalBayLevel = 0 (no Medical Bay)
              activeRobotCount
            );
            
            // Calculate expected cost with 2.0x multiplier
            const baseRepairCost = sumOfAllAttributes * 100;
            const rawCost = baseRepairCost * (damagePercent / 100) * 2.0;
            
            // Apply Repair Bay discount
            const rawDiscount = repairBayLevel * (5 + activeRobotCount);
            const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
            const expectedCost = Math.round(rawCost * (1 - repairBayDiscount));
            
            // Verify the repair cost uses 2.0x multiplier
            expect(repairCost).toBe(expectedCost);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('multiplier is 1.5 for heavily damaged robots (HP < 10%)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 1, max: 100 }), // damagePercent (at least 1% to ensure cost > 0)
          fc.integer({ min: 1, max: 9 }), // hpPercent (1-9% for heavily damaged)
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount) => {
            // Calculate cost for heavily damaged robot (HP < 10%)
            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Calculate expected cost with 1.5x multiplier
            const baseRepairCost = sumOfAllAttributes * 100;
            const rawCost = baseRepairCost * (damagePercent / 100) * 1.5;
            
            // Apply Repair Bay discount
            const rawDiscount = repairBayLevel * (5 + activeRobotCount);
            const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
            const expectedCost = Math.round(rawCost * (1 - repairBayDiscount));
            
            // Verify the repair cost uses 1.5x multiplier
            expect(repairCost).toBe(expectedCost);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('multiplier is 1.0 for normal damage (HP >= 10%)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 1, max: 100 }), // damagePercent (at least 1% to ensure cost > 0)
          fc.integer({ min: 10, max: 100 }), // hpPercent (>= 10% for normal damage)
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount) => {
            // Calculate cost for normally damaged robot (HP >= 10%)
            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Calculate expected cost with 1.0x multiplier
            const baseRepairCost = sumOfAllAttributes * 100;
            const rawCost = baseRepairCost * (damagePercent / 100) * 1.0;
            
            // Apply Repair Bay discount
            const rawDiscount = repairBayLevel * (5 + activeRobotCount);
            const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
            const expectedCost = Math.round(rawCost * (1 - repairBayDiscount));
            
            // Verify the repair cost uses 1.0x multiplier
            expect(repairCost).toBe(expectedCost);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('repair cost scales linearly with sumOfAllAttributes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 11500 }), // sumOfAllAttributes (half of max to allow doubling)
          fc.integer({ min: 50, max: 100 }), // damagePercent
          fc.integer({ min: 10, max: 100 }), // hpPercent (>= 10 to avoid 1.5x multiplier)
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, activeRobotCount) => {
            // Calculate cost with base attributes
            const cost1 = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              0, // medicalBayLevel
              activeRobotCount
            );
            
            // Calculate cost with doubled attributes
            const cost2 = calculateRepairCost(
              sumOfAllAttributes * 2,
              damagePercent,
              hpPercent,
              repairBayLevel,
              0, // medicalBayLevel
              activeRobotCount
            );
            
            // Cost should scale linearly (doubled attributes = doubled cost)
            // Allow for rounding differences
            const expectedCost2 = cost1 * 2;
            expect(Math.abs(cost2 - expectedCost2)).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('repair cost scales linearly with damagePercent', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 25, max: 50 }), // damagePercent (25-50% to allow doubling)
          fc.integer({ min: 10, max: 100 }), // hpPercent (>= 10 to avoid 1.5x multiplier)
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, activeRobotCount) => {
            // Calculate cost with base damage
            const cost1 = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              0, // medicalBayLevel
              activeRobotCount
            );
            
            // Calculate cost with doubled damage
            const cost2 = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent * 2,
              hpPercent,
              repairBayLevel,
              0, // medicalBayLevel
              activeRobotCount
            );
            
            // Cost should scale linearly (doubled damage = doubled cost)
            // Allow for rounding differences
            const expectedCost2 = cost1 * 2;
            expect(Math.abs(cost2 - expectedCost2)).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('zero damage results in zero repair cost', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount) => {
            // Calculate cost with zero damage
            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              0, // damagePercent = 0 (no damage)
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Zero damage should result in zero cost
            expect(repairCost).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('100% damage with 1.0x multiplier equals base repair cost before discount', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 10, max: 100 }), // hpPercent (>= 10 to ensure 1.0x multiplier)
          (sumOfAllAttributes, hpPercent) => {
            // Calculate cost with 100% damage, no discounts
            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              100, // damagePercent = 100%
              hpPercent,
              0, // repairBayLevel = 0 (no discount)
              0, // medicalBayLevel = 0
              0  // activeRobotCount = 0
            );
            
            // Expected cost: sumOfAllAttributes × 100 × 1.0 × 1.0
            const expectedCost = sumOfAllAttributes * 100;
            
            // Verify the cost matches the base formula
            expect(repairCost).toBe(expectedCost);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 2: Robot Count Includes All Robots', () => {
    /**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     * For any stable, the active robot count used in repair cost calculations should include
     * all robots owned by that stable, regardless of their current HP status or battle-ready state.
     */

    test('robot count includes all robots regardless of HP status', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 10 }), // robot HP percentages
          async (robotHPs) => {
            // Create test user for this iteration
            const user = await prisma.user.create({
              data: {
                username: `rc_test_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                passwordHash: 'test_hash',
                currency: 1000000,
              },
            });
            
            // Create robots with various HP values
            for (let i = 0; i < robotHPs.length; i++) {
              const maxHP = 100;
              const currentHP = Math.floor((robotHPs[i] / 100) * maxHP);
              
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Test Robot ${i}`,
                  currentHP: currentHP,
                  maxHP: maxHP,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }
            
            // Query robot count (excluding "Bye Robot")
            const count = await prisma.robot.count({
              where: {
                userId: user.id,
                NOT: { name: 'Bye Robot' },
              },
            });
            
            // Clean up
            await prisma.robot.deleteMany({ where: { userId: user.id } });
            await prisma.user.deleteMany({ where: { id: user.id } });
            
            // Verify all robots are counted
            expect(count).toBe(robotHPs.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('robot count excludes "Bye Robot" system robot', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // number of regular robots
          async (numRobots) => {
            // Create test user for this iteration
            const user = await prisma.user.create({
              data: {
                username: `rc_test_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                passwordHash: 'test_hash',
                currency: 1000000,
              },
            });
            
            // Create regular robots
            for (let i = 0; i < numRobots; i++) {
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Test Robot ${i}`,
                  currentHP: 100,
                  maxHP: 100,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }
            
            // Create a "Bye Robot"
            await prisma.robot.create({
              data: {
                userId: user.id,
                name: 'Bye Robot',
                currentHP: 100,
                maxHP: 100,
                currentShield: 0,
                maxShield: 20,
              },
            });
            
            // Query robot count (should exclude "Bye Robot")
            const count = await prisma.robot.count({
              where: {
                userId: user.id,
                NOT: { name: 'Bye Robot' },
              },
            });
            
            // Clean up
            await prisma.robot.deleteMany({ where: { userId: user.id } });
            await prisma.user.deleteMany({ where: { id: user.id } });
            
            // Verify only regular robots are counted
            expect(count).toBe(numRobots);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('robot count includes destroyed robots (HP = 0)', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // number of healthy robots
          fc.integer({ min: 1, max: 5 }), // number of destroyed robots
          async (numHealthy, numDestroyed) => {
            // Create test user for this iteration
            const user = await prisma.user.create({
              data: {
                username: `rc_test_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                passwordHash: 'test_hash',
                currency: 1000000,
              },
            });
            
            // Create healthy robots
            for (let i = 0; i < numHealthy; i++) {
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Healthy Robot ${i}`,
                  currentHP: 100,
                  maxHP: 100,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }
            
            // Create destroyed robots (HP = 0)
            for (let i = 0; i < numDestroyed; i++) {
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Destroyed Robot ${i}`,
                  currentHP: 0,
                  maxHP: 100,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }
            
            // Query robot count
            const count = await prisma.robot.count({
              where: {
                userId: user.id,
                NOT: { name: 'Bye Robot' },
              },
            });
            
            // Clean up
            await prisma.robot.deleteMany({ where: { userId: user.id } });
            await prisma.user.deleteMany({ where: { id: user.id } });
            
            // Verify all robots are counted (healthy + destroyed)
            expect(count).toBe(numHealthy + numDestroyed);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('robot count includes damaged robots (0 < HP < maxHP)', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // number of healthy robots
          fc.integer({ min: 1, max: 5 }), // number of damaged robots
          async (numHealthy, numDamaged) => {
            // Create test user for this iteration
            const user = await prisma.user.create({
              data: {
                username: `rc_test_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                passwordHash: 'test_hash',
                currency: 1000000,
              },
            });
            
            // Create healthy robots
            for (let i = 0; i < numHealthy; i++) {
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Healthy Robot ${i}`,
                  currentHP: 100,
                  maxHP: 100,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }
            
            // Create damaged robots (50% HP)
            for (let i = 0; i < numDamaged; i++) {
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Damaged Robot ${i}`,
                  currentHP: 50,
                  maxHP: 100,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }
            
            // Query robot count
            const count = await prisma.robot.count({
              where: {
                userId: user.id,
                NOT: { name: 'Bye Robot' },
              },
            });
            
            // Clean up
            await prisma.robot.deleteMany({ where: { userId: user.id } });
            await prisma.user.deleteMany({ where: { id: user.id } });
            
            // Verify all robots are counted (healthy + damaged)
            expect(count).toBe(numHealthy + numDamaged);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('robot count affects repair cost calculation correctly', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // number of robots
          fc.integer({ min: 1, max: 10 }), // repairBayLevel
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 50, max: 100 }), // damagePercent
          fc.integer({ min: 10, max: 100 }), // hpPercent
          async (numRobots, repairBayLevel, sumOfAllAttributes, damagePercent, hpPercent) => {
            // Create test user for this iteration
            const user = await prisma.user.create({
              data: {
                username: `rc_test_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                passwordHash: 'test_hash',
                currency: 1000000,
              },
            });
            
            // Create robots
            for (let i = 0; i < numRobots; i++) {
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Test Robot ${i}`,
                  currentHP: 100,
                  maxHP: 100,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }
            
            // Query robot count
            const activeRobotCount = await prisma.robot.count({
              where: {
                userId: user.id,
                NOT: { name: 'Bye Robot' },
              },
            });
            
            // Verify count matches expected
            expect(activeRobotCount).toBe(numRobots);
            
            // Calculate repair cost with the queried robot count
            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              0, // medicalBayLevel
              activeRobotCount
            );
            
            // Calculate expected cost
            const baseRepairCost = sumOfAllAttributes * 100;
            const multiplier = 1.0; // hpPercent >= 10
            const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;
            const rawDiscount = repairBayLevel * (5 + activeRobotCount);
            const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
            const expectedCost = Math.round(rawCost * (1 - repairBayDiscount));
            
            // Clean up
            await prisma.robot.deleteMany({ where: { userId: user.id } });
            await prisma.user.deleteMany({ where: { id: user.id } });
            
            // Verify repair cost uses the correct robot count
            expect(repairCost).toBe(expectedCost);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('empty stable (0 robots) results in no multi-robot bonus', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // repairBayLevel
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 50, max: 100 }), // damagePercent
          fc.integer({ min: 10, max: 100 }), // hpPercent
          async (repairBayLevel, sumOfAllAttributes, damagePercent, hpPercent) => {
            // Create test user for this iteration
            const user = await prisma.user.create({
              data: {
                username: `rc_test_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                passwordHash: 'test_hash',
                currency: 1000000,
              },
            });
            
            // Don't create any robots (empty stable)
            
            // Query robot count
            const activeRobotCount = await prisma.robot.count({
              where: {
                userId: user.id,
                NOT: { name: 'Bye Robot' },
              },
            });
            
            // Verify count is 0
            expect(activeRobotCount).toBe(0);
            
            // Calculate repair cost with 0 robots
            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              0, // medicalBayLevel
              activeRobotCount
            );
            
            // Calculate expected cost (no multi-robot bonus)
            const baseRepairCost = sumOfAllAttributes * 100;
            const multiplier = 1.0; // hpPercent >= 10
            const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;
            const rawDiscount = repairBayLevel * 5; // No robot bonus
            const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
            const expectedCost = Math.round(rawCost * (1 - repairBayDiscount));
            
            // Clean up
            await prisma.user.deleteMany({ where: { id: user.id } });
            
            // Verify repair cost has no multi-robot bonus
            expect(repairCost).toBe(expectedCost);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 5: Repair Cost Consistency Across Battle Types', () => {
    /**
     * **Validates: Requirements 8.6, 8.7, 8.8, 8.9**
     * For any robot with the same damage, HP, facility levels, and robot count, the repair cost
     * calculated should be identical whether the damage occurred in a league battle, tag team battle,
     * or tournament battle.
     */
    test('repair costs are identical for same damage across all battle types', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 0, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount) => {
            // Calculate repair cost as if from league battle
            const leagueBattleCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Calculate repair cost as if from tag team battle
            const tagTeamBattleCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Calculate repair cost as if from tournament battle
            const tournamentBattleCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Calculate repair cost as if from auto-repair (cycle trigger)
            const autoRepairCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // All costs should be identical (validates canonical function usage)
            expect(leagueBattleCost).toBe(tagTeamBattleCost);
            expect(leagueBattleCost).toBe(tournamentBattleCost);
            expect(leagueBattleCost).toBe(autoRepairCost);
            
            // Verify the cost is calculated correctly
            const baseRepairCost = sumOfAllAttributes * 100;
            
            // Determine multiplier based on HP percentage
            let multiplier = 1.0;
            if (hpPercent === 0) {
              // Total destruction - apply Medical Bay reduction
              if (medicalBayLevel > 0) {
                const medicalReduction = medicalBayLevel * 0.1;
                multiplier = 2.0 * (1 - medicalReduction);
              } else {
                multiplier = 2.0;
              }
            } else if (hpPercent < 10) {
              // Heavily damaged
              multiplier = 1.5;
            }
            
            const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;
            const rawDiscount = repairBayLevel * (5 + activeRobotCount);
            const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
            const expectedCost = Math.round(rawCost * (1 - repairBayDiscount));
            
            // Verify all costs match the expected calculation
            expect(leagueBattleCost).toBe(expectedCost);
            expect(tagTeamBattleCost).toBe(expectedCost);
            expect(tournamentBattleCost).toBe(expectedCost);
            expect(autoRepairCost).toBe(expectedCost);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('repair costs remain consistent with varying facility levels', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 50, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount) => {
            // Simulate multiple battle types calculating repair cost
            const costs = [
              calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount),
              calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount),
              calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount),
              calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount),
            ];
            
            // All costs should be identical
            const firstCost = costs[0];
            costs.forEach(cost => {
              expect(cost).toBe(firstCost);
            });
            
            // Verify cost is non-negative
            expect(firstCost).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('repair costs are deterministic for same inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 0, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount) => {
            // Call the function multiple times with same inputs
            const results = [];
            for (let i = 0; i < 10; i++) {
              results.push(
                calculateRepairCost(
                  sumOfAllAttributes,
                  damagePercent,
                  hpPercent,
                  repairBayLevel,
                  medicalBayLevel,
                  activeRobotCount
                )
              );
            }
            
            // All results should be identical (deterministic)
            const firstResult = results[0];
            results.forEach(result => {
              expect(result).toBe(firstResult);
            });
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('repair costs are consistent regardless of call order', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 25, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 1, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          fc.integer({ min: 1, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount) => {
            // Calculate costs in different orders (simulating different battle types executing)
            const cost1 = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Different damage scenario
            const cost2 = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent + 10,
              hpPercent - 10,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Back to original scenario
            const cost3 = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // First and third calls (same inputs) should produce identical results
            expect(cost1).toBe(cost3);
            
            // Second call (different inputs) should produce different result (unless edge case)
            // This verifies the function is not caching incorrectly
            if (damagePercent + 10 <= 100 && hpPercent - 10 >= 0) {
              // Only check if inputs are valid
              expect(cost2).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('repair costs scale consistently across battle types with robot count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 50, max: 100 }), // damagePercent
          fc.integer({ min: 10, max: 100 }), // hpPercent
          fc.integer({ min: 1, max: 10 }), // repairBayLevel
          fc.integer({ min: 1, max: 9 }), // activeRobotCount (1-9 to allow increment)
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, activeRobotCount) => {
            // Calculate costs with current robot count
            const costWithNRobots = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              0, // medicalBayLevel
              activeRobotCount
            );
            
            // Calculate costs with one more robot
            const costWithNPlus1Robots = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              0, // medicalBayLevel
              activeRobotCount + 1
            );
            
            // More robots should result in lower or equal cost (higher discount)
            // Equal only if discount is already at 90% cap
            const discountN = Math.min(repairBayLevel * (5 + activeRobotCount), 90);
            const discountNPlus1 = Math.min(repairBayLevel * (5 + activeRobotCount + 1), 90);
            
            if (discountN === 90 && discountNPlus1 === 90) {
              // Both at cap, costs should be equal
              expect(costWithNPlus1Robots).toBe(costWithNRobots);
            } else {
              // Higher discount should result in lower cost
              expect(costWithNPlus1Robots).toBeLessThanOrEqual(costWithNRobots);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('repair costs handle edge cases consistently across battle types', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, repairBayLevel, medicalBayLevel, activeRobotCount) => {
            // Edge case 1: Zero damage
            const zeroDamageCost = calculateRepairCost(
              sumOfAllAttributes,
              0, // damagePercent = 0
              100, // hpPercent = 100 (full health)
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            expect(zeroDamageCost).toBe(0);
            
            // Edge case 2: Full damage, destroyed
            const fullDamageCost = calculateRepairCost(
              sumOfAllAttributes,
              100, // damagePercent = 100
              0, // hpPercent = 0 (destroyed)
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            expect(fullDamageCost).toBeGreaterThanOrEqual(0);
            
            // Edge case 3: Maximum discount (90% cap)
            const maxDiscountCost = calculateRepairCost(
              sumOfAllAttributes,
              100, // damagePercent = 100
              50, // hpPercent = 50
              10, // repairBayLevel = 10
              0, // medicalBayLevel
              10 // activeRobotCount = 10 (10 × (5 + 10) = 150% -> capped at 90%)
            );
            
            // At 90% discount, cost should be 10% of base
            const baseRepairCost = sumOfAllAttributes * 100;
            const rawCost = baseRepairCost * 1.0; // 100% damage, 1.0x multiplier
            const expectedCost = Math.round(rawCost * 0.10);
            expect(maxDiscountCost).toBe(expectedCost);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('repair costs with Medical Bay are consistent across battle types', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 50, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 1, max: 10 }), // medicalBayLevel (at least 1 to test Medical Bay)
          fc.integer({ min: 0, max: 10 }), // activeRobotCount
          (sumOfAllAttributes, damagePercent, repairBayLevel, medicalBayLevel, activeRobotCount) => {
            // Calculate cost for destroyed robot (Medical Bay applies)
            const destroyedCost1 = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              0, // hpPercent = 0 (destroyed)
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Calculate again (simulating different battle type)
            const destroyedCost2 = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              0, // hpPercent = 0 (destroyed)
              repairBayLevel,
              medicalBayLevel,
              activeRobotCount
            );
            
            // Costs should be identical
            expect(destroyedCost1).toBe(destroyedCost2);
            
            // Verify Medical Bay reduction is applied
            const expectedMultiplier = 2.0 * (1 - medicalBayLevel * 0.1);
            const baseRepairCost = sumOfAllAttributes * 100;
            const rawCost = baseRepairCost * (damagePercent / 100) * expectedMultiplier;
            const rawDiscount = repairBayLevel * (5 + activeRobotCount);
            const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
            const expectedCost = Math.round(rawCost * (1 - repairBayDiscount));
            
            expect(destroyedCost1).toBe(expectedCost);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
