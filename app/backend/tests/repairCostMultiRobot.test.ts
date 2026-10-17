import { calculateRepairCost } from './helpers/legacyRepairCost';
import {
  calculateRepairBayDiscountPercent,
  calculateRepairQuote,
} from '../src/shared/utils/repairCost';

/**
 * Season 2 (#525): the Repair Bay discount is 6% per level, independent of how
 * many robots a stable owns. It used to be min(90, level × (5 + robots)), which
 * this suite covered as a "multi-robot discount". The roster size is no longer an
 * input, so the suite now pins that 1-, 5- and 11-robot stables get identical
 * discounts and quotes at every level.
 */
describe('calculateRepairCost - Repair Bay discount is independent of robot count (#525)', () => {
  const sumOfAllAttributes = 230; // Sum of all 23 attributes
  // Full destruction: 230 × 100 × 1.0 damage × 2.0 multiplier = 46,000 before discount.

  // Hand-computed: discount = 6 × level, quote = 46,000 × (1 − discount / 100).
  const levelTable: ReadonlyArray<{ level: number; discount: number; quote: number }> = [
    { level: 0, discount: 0, quote: 46000 },
    { level: 1, discount: 6, quote: 43240 },
    { level: 2, discount: 12, quote: 40480 },
    { level: 3, discount: 18, quote: 37720 },
    { level: 4, discount: 24, quote: 34960 },
    { level: 5, discount: 30, quote: 32200 },
    { level: 6, discount: 36, quote: 29440 },
    { level: 7, discount: 42, quote: 26680 },
    { level: 8, discount: 48, quote: 23920 },
    { level: 9, discount: 54, quote: 21160 },
    { level: 10, discount: 60, quote: 18400 },
  ];

  /**
   * A stable of `robotCount` identical, destroyed robots, each priced the way the
   * repair paths price them: per robot, by Repair Bay level only.
   */
  function quoteStable(robotCount: number, level: number): number[] {
    return Array.from({ length: robotCount }, () =>
      calculateRepairQuote(
        { attributeTotal: sumOfAllAttributes, damagePercent: 100, hpPercent: 0 },
        level,
      ),
    );
  }

  describe.each(levelTable)('Repair Bay Level $level', ({ level, discount, quote }) => {
    it(`gives a ${discount}% discount`, () => {
      expect(calculateRepairBayDiscountPercent(level)).toBe(discount);
    });

    it(`quotes ₡${quote.toLocaleString()} for a destroyed 230-point robot`, () => {
      expect(calculateRepairCost(sumOfAllAttributes, 100, 0, level)).toBe(quote);
    });

    it.each([1, 5, 11])('gives every robot in a %i-robot stable the same quote', (robotCount) => {
      const quotes = quoteStable(robotCount, level);
      expect(quotes).toHaveLength(robotCount);
      expect(quotes.every((q) => q === quote)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should work with all parameters omitted except required ones', () => {
      const cost = calculateRepairCost(sumOfAllAttributes, 100, 0);
      expect(cost).toBe(46000); // No discount
    });

    it('should apply discount after damage multipliers', () => {
      // 85% damage, 15% HP (1.0x multiplier); Level 5 = 30% discount
      // Cost: 23,000 × 0.85 × 1.0 × 0.70 = 13,685
      const cost = calculateRepairCost(sumOfAllAttributes, 85, 15, 5);
      expect(cost).toBe(13685);
    });

    it('should not raise the discount past Level 10', () => {
      expect(calculateRepairBayDiscountPercent(11)).toBe(60);
      expect(calculateRepairCost(sumOfAllAttributes, 100, 0, 11)).toBe(18400);
    });
  });
});
