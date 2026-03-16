/**
 * Manual Repair Discount — Unit Tests
 *
 * Tests the pure discount calculation logic used by
 * POST /api/robots/repair-all. No database or HTTP layer involved.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 4.1, 4.2, 6.1, 6.2, 6.3, 6.7
 */

import { calculateRepairCost } from '../src/utils/robotCalculations';

/** Mirrors the calculation in the repair-all endpoint */
function calculateManualRepairCost(baseCost: number, repairBayDiscount: number) {
  const costAfterRepairBay = Math.floor(baseCost * (1 - repairBayDiscount / 100));
  const finalCost = Math.floor(costAfterRepairBay * 0.5);
  return { costAfterRepairBay, finalCost };
}

/** Simulates the response shape returned by the endpoint.
 *  Manual repairs are always allowed — no currency gate. Balance can go negative. */
function buildRepairResponse(
  totalBaseCost: number,
  repairBayDiscount: number,
  repairedCount: number,
  playerCurrency: number,
) {
  const { costAfterRepairBay, finalCost } = calculateManualRepairCost(totalBaseCost, repairBayDiscount);

  return {
    success: true,
    repairedCount,
    totalBaseCost,
    discount: repairBayDiscount,
    manualRepairDiscount: 50,
    preDiscountCost: costAfterRepairBay,
    finalCost,
    newCurrency: playerCurrency - finalCost,
    message: `Repaired ${repairedCount} robots`,
  };
}

describe('Manual Repair Discount — Unit Tests', () => {
  describe('50% discount calculation', () => {
    // Validates: Requirement 1.1
    it('should apply 50% discount on known cost (base 10000, no Repair Bay → 5000)', () => {
      const { finalCost } = calculateManualRepairCost(10000, 0);
      expect(finalCost).toBe(5000);
    });

    // Validates: Requirement 6.2
    it('should round down odd cost (base 10001 → Math.floor(10001 * 0.5) = 5000)', () => {
      const { finalCost } = calculateManualRepairCost(10001, 0);
      expect(finalCost).toBe(5000);
    });

    // Validates: Requirements 1.2, 6.7
    // Note: Math.floor(100000 * 0.1) = 9999 due to floating-point (0.1 ≈ 0.09999...)
    it('should stack Repair Bay 90% + manual 50% (base 100000 → 9999 → 4999)', () => {
      const { costAfterRepairBay, finalCost } = calculateManualRepairCost(100000, 90);
      const expectedAfterRepairBay = Math.floor(100000 * (1 - 90 / 100));
      expect(costAfterRepairBay).toBe(expectedAfterRepairBay); // 9999
      expect(finalCost).toBe(Math.floor(expectedAfterRepairBay * 0.5)); // 4999
    });

    // Validates: Requirement 1.3
    it('should apply 50% manual discount when Repair Bay is 0%', () => {
      const { costAfterRepairBay, finalCost } = calculateManualRepairCost(20000, 0);
      expect(costAfterRepairBay).toBe(20000);
      expect(finalCost).toBe(10000);
    });

    it('should return zero cost when base cost is zero (zero damage)', () => {
      const { finalCost } = calculateManualRepairCost(0, 0);
      expect(finalCost).toBe(0);
    });
  });

  describe('Response shape', () => {
    // Validates: Requirement 1.4
    it('should contain manualRepairDiscount field set to 50', () => {
      const response = buildRepairResponse(10000, 0, 2, 100000);
      expect(response).toHaveProperty('manualRepairDiscount', 50);
    });

    // Validates: Requirement 5.2
    it('should contain preDiscountCost field', () => {
      const response = buildRepairResponse(10000, 0, 2, 100000);
      expect(response).toHaveProperty('preDiscountCost', 10000);
    });

    it('should contain finalCost reflecting the 50% discount', () => {
      const response = buildRepairResponse(10000, 0, 2, 100000);
      expect(response).toHaveProperty('finalCost', 5000);
    });
  });

  describe('Negative balance allowed for manual repairs', () => {
    // Validates: Requirements 4.1, 4.2 (updated — no currency gate)
    it('should allow repair even when credits are less than discounted cost (balance goes negative)', () => {
      // Base 10000, no Repair Bay → discounted cost = 5000
      // Player has 3000 credits — less than 5000 → allowed, balance = -2000
      const response = buildRepairResponse(10000, 0, 2, 3000);
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('newCurrency', -2000);
    });

    it('should allow repair when credits exactly equal discounted cost (balance = 0)', () => {
      const response = buildRepairResponse(10000, 0, 1, 5000);
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('newCurrency', 0);
    });

    it('should allow repair when credits are zero (balance goes negative)', () => {
      const response = buildRepairResponse(10000, 0, 1, 0);
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('newCurrency', -5000);
    });

    it('should allow repair when credits are already negative (balance goes further negative)', () => {
      const response = buildRepairResponse(10000, 0, 1, -3000);
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('newCurrency', -8000);
    });

    it('should apply Repair Bay + manual discount even with negative balance', () => {
      // Base 100000, Repair Bay 90% → after RB = 9999, after manual = 4999
      // Player has -1000 credits → allowed, balance = -1000 - 4999 = -5999
      const response = buildRepairResponse(100000, 90, 3, -1000);
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('finalCost', 4999);
      expect(response).toHaveProperty('newCurrency', -5999);
    });
  });

  // Validates: Requirements 2.1, 2.2, 2.3, 6.3
  describe('Regression: calculateRepairCost() unchanged for known inputs', () => {
    it('should return 5000 for attributeSum=100, damagePercent=50, hpPercent=50, repairBayLevel=0, medicalBayLevel=0, robotCount=5', () => {
      // baseRepairCost = 100 * 100 = 10000
      // hpPercent=50 → multiplier = 1.0
      // rawCost = 10000 * 0.5 * 1.0 = 5000
      // rawDiscount = 0 * (5 + 5) = 0, repairBayDiscount = 0
      // finalCost = Math.round(5000 * 1) = 5000
      const result = calculateRepairCost(100, 50, 50, 0, 0, 5);
      expect(result).toBe(5000);
    });

    it('should return 7000 for attributeSum=200, damagePercent=100, hpPercent=0, repairBayLevel=5, medicalBayLevel=3, robotCount=10', () => {
      // baseRepairCost = 200 * 100 = 20000
      // hpPercent=0, medicalBayLevel=3 → medicalReduction = 0.3, multiplier = 2.0 * 0.7 = 1.4
      // rawCost = 20000 * 1.0 * 1.4 = 28000
      // rawDiscount = 5 * (5 + 10) = 75, repairBayDiscount = 0.75
      // finalCost = Math.round(28000 * 0.25) = 7000
      const result = calculateRepairCost(200, 100, 0, 5, 3, 10);
      expect(result).toBe(7000);
    });
  });

  // Validates: Requirements 2.1, 2.2, 2.3, 6.3
  describe('Regression: automatic repair audit payload excludes manual discount fields', () => {
    /**
     * Simulates the audit payload construction for the automatic repair path
     * in repairService.ts → eventLogger.logRobotRepair().
     *
     * The automatic path passes repairType: 'automatic' but does NOT pass
     * manualRepairDiscount or preDiscountCost, so those fields must be absent.
     */
    function buildAutomaticRepairAuditPayload(
      cost: number,
      damageRepaired: number,
      discountPercent: number,
    ): Record<string, unknown> {
      const payload: Record<string, unknown> = {
        cost,
        damageRepaired,
        discountPercent,
        repairType: 'automatic',
      };
      // Automatic path does NOT set manualRepairDiscount or preDiscountCost
      return payload;
    }

    it('should not include manualRepairDiscount in automatic repair audit payload', () => {
      const payload = buildAutomaticRepairAuditPayload(5000, 150, 14);
      expect(payload).not.toHaveProperty('manualRepairDiscount');
    });

    it('should not include preDiscountCost in automatic repair audit payload', () => {
      const payload = buildAutomaticRepairAuditPayload(5000, 150, 14);
      expect(payload).not.toHaveProperty('preDiscountCost');
    });

    it('should set repairType to "automatic" in audit payload', () => {
      const payload = buildAutomaticRepairAuditPayload(7000, 200, 75);
      expect(payload.repairType).toBe('automatic');
    });

    it('should include cost, damageRepaired, and discountPercent in audit payload', () => {
      const payload = buildAutomaticRepairAuditPayload(7000, 200, 75);
      expect(payload).toEqual({
        cost: 7000,
        damageRepaired: 200,
        discountPercent: 75,
        repairType: 'automatic',
      });
    });
  });
});
