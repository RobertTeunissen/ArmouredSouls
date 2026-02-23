import { calculateRepairCost } from '../src/utils/robotCalculations';

describe('calculateRepairCost - Multi-Robot Discount', () => {
  afterAll(() => {
    // Pure unit test - no cleanup needed
  });

  const sumOfAllAttributes = 230; // Sum of all 23 attributes
  const baseRepairCost = sumOfAllAttributes * 100; // 23,000

  describe('Backward Compatibility', () => {
    it('should default activeRobotCount to 0 when not provided', () => {
      // Old formula: repairBayLevel * 5, max 50%
      // Level 5 = 25% discount
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 5);
      expect(cost).toBe(34500); // 23,000 * 1.0 * 2.0 * 0.75 (25% discount)
    });

    it('should work with all parameters omitted except required ones', () => {
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0);
      expect(cost).toBe(46000); // No discount
    });
  });

  describe('Multi-Robot Discount Formula', () => {
    it('should calculate 9% discount for Level 1 Repair Bay with 4 robots', () => {
      // 1 × (5 + 4) = 9%
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 1, 0, 4);
      expect(cost).toBe(41860); // 23,000 * 1.0 * 2.0 * 0.91
    });

    it('should calculate 21% discount for Level 3 Repair Bay with 2 robots', () => {
      // 3 × (5 + 2) = 21%
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 3, 0, 2);
      expect(cost).toBe(36340); // 23,000 * 1.0 * 2.0 * 0.79
    });

    it('should calculate 60% discount for Level 5 Repair Bay with 7 robots', () => {
      // 5 × (5 + 7) = 60%
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 5, 0, 7);
      expect(cost).toBe(18400); // 23,000 * 1.0 * 2.0 * 0.40
    });

    it('should cap discount at 90% for Level 10 Repair Bay with 10 robots', () => {
      // 10 × (5 + 10) = 150%, capped at 90%
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 10, 0, 10);
      expect(cost).toBe(4600); // 23,000 * 1.0 * 2.0 * 0.10 (90% discount)
    });

    it('should cap discount at 90% for Level 6 Repair Bay with 10 robots', () => {
      // 6 × (5 + 10) = 90%
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 6, 0, 10);
      expect(cost).toBe(4600); // 23,000 * 1.0 * 2.0 * 0.10 (90% discount)
    });
  });

  describe('Medical Bay Integration', () => {
    it('should apply Medical Bay reduction with multi-robot discount', () => {
      // Medical Bay 3: 2.0 * (1 - 0.3) = 1.4 multiplier
      // Repair Bay 5 with 7 robots: 5 × (5 + 7) = 60% discount
      // Cost: 23,000 * 1.0 * 1.4 * 0.40 = 12,880
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 5, 3, 7);
      expect(cost).toBe(12880);
    });

    it('should preserve Medical Bay logic for destroyed robots', () => {
      // Medical Bay 5: 2.0 * (1 - 0.5) = 1.0 multiplier
      // Repair Bay 3 with 2 robots: 3 × (5 + 2) = 21% discount
      // Cost: 23,000 * 1.0 * 1.0 * 0.79 = 18,170
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 3, 5, 2);
      expect(cost).toBe(18170);
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0 robots (backward compatible)', () => {
      // Level 5 with 0 robots: 5 × (5 + 0) = 25%
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 5, 0, 0);
      expect(cost).toBe(34500); // Same as old formula
    });

    it('should handle 0 repair bay level', () => {
      // Level 0 with 10 robots: 0 × (5 + 10) = 0%
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0, 0, 0, 10);
      expect(cost).toBe(46000); // No discount
    });

    it('should apply discount after damage multipliers', () => {
      // 85% damage, 15% HP (1.0x multiplier)
      // Level 5 with 7 robots: 5 × (5 + 7) = 60% discount
      // Cost: 23,000 * 0.85 * 1.0 * 0.40 = 7,820
      const cost = calculateRepairCost(sumOfAllAttributes, 85, 15, 5, 0, 7);
      expect(cost).toBe(7820);
    });
  });
});
