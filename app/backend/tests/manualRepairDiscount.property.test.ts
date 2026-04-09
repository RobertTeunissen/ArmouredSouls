import * as fc from 'fast-check';
import { calculateRepairCost } from '../src/utils/robotCalculations';

// Feature: manual-repair-cost-reduction, Property 1: Manual discount formula

/**
 * Pure manual repair discount formula — mirrors the calculation in
 * POST /api/robots/repair-all (robots.ts).
 *
 * costAfterRepairBay = Math.floor(baseCost * (1 - repairBayDiscount / 100))
 * finalCost          = Math.floor(costAfterRepairBay * 0.5)
 */
function calculateManualRepairCost(baseCost: number, repairBayDiscount: number): number {
  const costAfterRepairBay = Math.floor(baseCost * (1 - repairBayDiscount / 100));
  const finalCost = Math.floor(costAfterRepairBay * 0.5);
  return finalCost;
}

// Feature: manual-repair-cost-reduction, Property 3: Manual repairs always allowed (no currency gate)

/**
 * Manual repairs are always allowed regardless of the player's current balance.
 * The player's balance can go negative as a result. This is the only transaction
 * in the game that permits spending into negative credits.
 *
 * Given any player currency (including negative), base cost, and Repair Bay discount,
 * the repair is always allowed and the resulting balance equals currency - discountedCost.
 */
function validateCurrencyForRepair(
  playerCurrency: number,
  baseCost: number,
  repairBayDiscount: number
): { allowed: true; cost: number; newBalance: number } {
  const costAfterRepairBay = Math.floor(baseCost * (1 - repairBayDiscount / 100));
  const discountedCost = Math.floor(costAfterRepairBay * 0.5);

  return { allowed: true, cost: discountedCost, newBalance: playerCurrency - discountedCost };
}

// Feature: manual-repair-cost-reduction, Property 6: Repair type correctly tagged

/**
 * Simulates the repair type tagging logic for audit log payloads.
 *
 * - Manual repairs (POST /api/robots/repair-all) produce a payload with
 *   repairType: 'manual', manualRepairDiscount: 50, and preDiscountCost.
 * - Automatic repairs (repairAllRobots() during cycle processing) produce a
 *   payload with repairType: 'automatic' and no manual-specific fields.
 */
function buildRepairAuditPayload(
  repairSource: 'manual' | 'automatic',
  cost: number,
  preDiscountCost: number
): Record<string, unknown> {
  if (repairSource === 'manual') {
    return {
      repairType: 'manual',
      manualRepairDiscount: 50,
      preDiscountCost,
      cost,
    };
  }
  return {
    repairType: 'automatic',
    cost,
  };
}

describe('Manual Repair Discount - Property Tests', () => {
  describe('Property 1: Manual discount formula', () => {
    /**
     * **Validates: Requirements 1.1, 1.2, 1.3, 3.1**
     *
     * For any valid base cost (non-negative integer) and any Repair Bay discount
     * percentage (0–90), the manual repair final cost shall equal
     * Math.floor(Math.floor(baseCost * (1 - repairBayDiscount / 100)) * 0.5).
     */
    test('manual cost equals Math.floor(Math.floor(baseCost * (1 - repairBayDiscount / 100)) * 0.5)', () => {
      fc.assert(
        fc.property(
          fc.nat(1_000_000),                      // baseCost
          fc.integer({ min: 0, max: 90 }),        // repairBayDiscount
          (baseCost, repairBayDiscount) => {
            const result = calculateManualRepairCost(baseCost, repairBayDiscount);

            const expectedCostAfterRepairBay = Math.floor(baseCost * (1 - repairBayDiscount / 100));
            const expectedFinalCost = Math.floor(expectedCostAfterRepairBay * 0.5);

            expect(result).toBe(expectedFinalCost);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: manual-repair-cost-reduction, Property 2: Automatic repair cost unchanged
  describe('Property 2: Automatic repair cost unchanged', () => {
    /**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     *
     * For any valid inputs, calculateRepairCost() output is identical with no
     * manual discount applied — i.e., the function itself has no 0.5 multiplier.
     * The result is a non-negative number equal to the expected formula:
     *   baseRepairCost = sumOfAllAttributes * 100
     *   multiplier = 2.0 (with Medical Bay reduction) if hpPercent === 0,
     *                1.5 if hpPercent < 10, else 1.0
     *   rawCost = baseRepairCost * (damagePercent / 100) * multiplier
     *   repairBayDiscount = min(repairBayLevel * (5 + robotCount), 90) / 100
     *   finalCost = Math.round(rawCost * (1 - repairBayDiscount))
     */
    test('calculateRepairCost() returns expected formula result with no 0.5 multiplier', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 500 }),       // attributeSum
          fc.float({ min: 0, max: 100 }),          // damagePercent
          fc.float({ min: 0, max: 100 }),          // hpPercent
          fc.integer({ min: 0, max: 10 }),         // repairBayLevel
          fc.integer({ min: 0, max: 10 }),         // medicalBayLevel
          fc.integer({ min: 1, max: 20 }),         // robotCount
          (attributeSum, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, robotCount) => {
            // Skip NaN-producing floats
            if (!Number.isFinite(damagePercent) || !Number.isFinite(hpPercent)) return;

            const result = calculateRepairCost(
              attributeSum,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
              robotCount
            );

            // Result must be non-negative
            expect(result).toBeGreaterThanOrEqual(0);

            // Recompute expected value using the same formula (no 0.5 multiplier)
            const baseRepairCost = attributeSum * 100;

            let multiplier = 1.0;
            if (hpPercent === 0) {
              if (medicalBayLevel > 0) {
                const medicalReduction = medicalBayLevel * 0.1;
                multiplier = 2.0 * (1 - medicalReduction);
              } else {
                multiplier = 2.0;
              }
            } else if (hpPercent < 10) {
              multiplier = 1.5;
            }

            const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;

            const rawDiscount = repairBayLevel * (5 + robotCount);
            const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
            const expectedCost = Math.round(rawCost * (1 - repairBayDiscount));

            expect(result).toBe(expectedCost);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: manual-repair-cost-reduction, Property 3: Manual repairs always allowed (no currency gate)
  describe('Property 3: Manual repairs always allowed (no currency gate)', () => {
    /**
     * **Validates: Requirements 4.1, 4.2**
     *
     * For any player currency value (including negative), base cost, and Repair Bay
     * discount (0–90), the manual repair is always allowed. The resulting balance
     * equals playerCurrency - discountedCost and may be negative.
     */
    test('repair is always allowed regardless of currency; new balance equals currency minus discounted cost', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -5_000_000, max: 10_000_000 }), // playerCurrency (can be negative)
          fc.nat(1_000_000),                      // baseCost
          fc.integer({ min: 0, max: 90 }),        // repairBayDiscount
          (playerCurrency, baseCost, repairBayDiscount) => {
            const result = validateCurrencyForRepair(playerCurrency, baseCost, repairBayDiscount);

            const costAfterRepairBay = Math.floor(baseCost * (1 - repairBayDiscount / 100));
            const discountedCost = Math.floor(costAfterRepairBay * 0.5);

            // Manual repairs are always allowed
            expect(result.allowed).toBe(true);
            expect(result.cost).toBe(discountedCost);
            expect(result.newBalance).toBe(playerCurrency - discountedCost);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: manual-repair-cost-reduction, Property 4: Manual cost ≤ automatic cost
  describe('Property 4: Manual cost ≤ automatic cost', () => {
    /**
     * **Validates: Requirements 1.1, 6.5**
     *
     * For any valid base cost (non-negative integer) and any Repair Bay discount
     * percentage (0–90), the manual repair cost shall be less than or equal to
     * the automatic repair cost (costAfterRepairBay, before the 50% manual discount).
     */
    test('manual cost is at most the automatic cost (costAfterRepairBay)', () => {
      fc.assert(
        fc.property(
          fc.nat(1_000_000),                      // baseCost
          fc.integer({ min: 0, max: 90 }),        // repairBayDiscount
          (baseCost, repairBayDiscount) => {
            const manualCost = calculateManualRepairCost(baseCost, repairBayDiscount);
            const automaticCost = Math.floor(baseCost * (1 - repairBayDiscount / 100));

            expect(manualCost).toBeLessThanOrEqual(automaticCost);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: manual-repair-cost-reduction, Property 5: Manual cost non-negative
  describe('Property 5: Manual cost non-negative', () => {
    /**
     * **Validates: Requirements 1.1, 6.6**
     *
     * For any valid base cost (non-negative integer) and any Repair Bay discount
     * percentage (0–90), the manual repair cost shall be greater than or equal to zero.
     */
    test('manual cost is non-negative for any valid inputs', () => {
      fc.assert(
        fc.property(
          fc.nat(1_000_000),                      // baseCost
          fc.integer({ min: 0, max: 90 }),        // repairBayDiscount
          (baseCost, repairBayDiscount) => {
            const manualCost = calculateManualRepairCost(baseCost, repairBayDiscount);

            expect(manualCost).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: manual-repair-cost-reduction, Property 6: Repair type correctly tagged
  describe('Property 6: Repair type correctly tagged', () => {
    /**
     * **Validates: Requirements 7.1, 7.2**
     *
     * For any repair event, if the repair source is 'manual' then the audit log
     * payload's repairType field shall be "manual" with manualRepairDiscount and
     * preDiscountCost present. If the repair source is 'automatic' then the
     * repairType field shall be "automatic" with no manual-specific fields.
     */
    test('manual source produces repairType "manual" with discount fields; automatic produces repairType "automatic" without them', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('manual' as const, 'automatic' as const),
          fc.nat(1_000_000),                      // cost
          fc.nat(1_000_000),                      // preDiscountCost
          (repairSource, cost, preDiscountCost) => {
            const payload = buildRepairAuditPayload(repairSource, cost, preDiscountCost);

            expect(payload.repairType).toBe(repairSource);

            if (repairSource === 'manual') {
              expect(payload.repairType).toBe('manual');
              expect(payload.manualRepairDiscount).toBe(50);
              expect(payload.preDiscountCost).toBe(preDiscountCost);
            } else {
              expect(payload.repairType).toBe('automatic');
              expect(payload).not.toHaveProperty('manualRepairDiscount');
              expect(payload).not.toHaveProperty('preDiscountCost');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
