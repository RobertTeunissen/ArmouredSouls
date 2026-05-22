/**
 * Unit tests for shared discount and resale formulas in app/shared/utils/discounts.ts
 *
 * Covers Spec #33 (Weapon Resale) requirements R2.1, R2.2, R2.3, R4.2.
 */

import fc from 'fast-check';
import {
  calculateWeaponWorkshopDiscount,
  calculateTrainingFacilityDiscount,
  applyDiscount,
  calculateWeaponResaleRate,
  applyResaleRate,
} from '../../shared/utils/discounts';

describe('calculateWeaponWorkshopDiscount', () => {
  it('returns 10% per level', () => {
    expect(calculateWeaponWorkshopDiscount(0)).toBe(0);
    expect(calculateWeaponWorkshopDiscount(1)).toBe(10);
    expect(calculateWeaponWorkshopDiscount(5)).toBe(50);
    expect(calculateWeaponWorkshopDiscount(10)).toBe(100);
  });
});

describe('calculateTrainingFacilityDiscount', () => {
  it('returns 10% per level capped at 90%', () => {
    expect(calculateTrainingFacilityDiscount(0)).toBe(0);
    expect(calculateTrainingFacilityDiscount(5)).toBe(50);
    expect(calculateTrainingFacilityDiscount(9)).toBe(90);
    expect(calculateTrainingFacilityDiscount(10)).toBe(90); // capped
  });
});

describe('applyDiscount', () => {
  it('applies discount percentage and floor-rounds', () => {
    expect(applyDiscount(1000, 0)).toBe(1000);
    expect(applyDiscount(1000, 30)).toBe(700);
    expect(applyDiscount(1000, 100)).toBe(0);
    expect(applyDiscount(99, 50)).toBe(49); // floor of 49.5
  });
});

describe('calculateWeaponResaleRate', () => {
  it('returns 0% at Workshop L0 (resale gated behind L1)', () => {
    expect(calculateWeaponResaleRate(0)).toBe(0);
  });

  it('returns 10% per level for L0–L10', () => {
    expect(calculateWeaponResaleRate(1)).toBe(10);
    expect(calculateWeaponResaleRate(2)).toBe(20);
    expect(calculateWeaponResaleRate(3)).toBe(30);
    expect(calculateWeaponResaleRate(5)).toBe(50);
    expect(calculateWeaponResaleRate(7)).toBe(70);
    expect(calculateWeaponResaleRate(10)).toBe(100);
  });

  it('clamps levels below 0 to 0%', () => {
    expect(calculateWeaponResaleRate(-1)).toBe(0);
    expect(calculateWeaponResaleRate(-100)).toBe(0);
  });

  it('clamps levels above 10 to 100%', () => {
    expect(calculateWeaponResaleRate(11)).toBe(100);
    expect(calculateWeaponResaleRate(100)).toBe(100);
  });

  it('mirrors the purchase discount slope (same 10%/level)', () => {
    // Property: at any valid level, resale rate equals the purchase discount.
    // This is the "Workshop level rewards you 10% on both ends" guarantee.
    for (let level = 0; level <= 10; level++) {
      expect(calculateWeaponResaleRate(level)).toBe(calculateWeaponWorkshopDiscount(level));
    }
  });
});

describe('applyResaleRate', () => {
  it('returns 0 when rate is 0', () => {
    expect(applyResaleRate(1000, 0)).toBe(0);
    expect(applyResaleRate(425000, 0)).toBe(0);
  });

  it('applies the rate as a percentage with floor rounding', () => {
    expect(applyResaleRate(1000, 30)).toBe(300);
    expect(applyResaleRate(1000, 50)).toBe(500);
    expect(applyResaleRate(1000, 100)).toBe(1000);
    expect(applyResaleRate(99, 50)).toBe(49); // floor of 49.5
  });

  it('returns 0 when pricePaid is 0 (starter weapon case)', () => {
    expect(applyResaleRate(0, 0)).toBe(0);
    expect(applyResaleRate(0, 50)).toBe(0);
    expect(applyResaleRate(0, 100)).toBe(0);
  });

  describe('property-based guarantees', () => {
    it('result is always between 0 and pricePaid for any rate in [0, 100]', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000_000 }),
          fc.integer({ min: 0, max: 100 }),
          (pricePaid, rate) => {
            const result = applyResaleRate(pricePaid, rate);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThanOrEqual(pricePaid);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('result is monotonic in rate (higher rate = same-or-more credits)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10_000_000 }),
          fc.integer({ min: 0, max: 99 }),
          (pricePaid, rateA) => {
            const resultA = applyResaleRate(pricePaid, rateA);
            const resultB = applyResaleRate(pricePaid, rateA + 1);
            expect(resultB).toBeGreaterThanOrEqual(resultA);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('buy-then-sell cycle is never net-positive (no infinite money loop)', () => {
      // Property 1 from design.md correctness properties:
      // For any (workshopLevel, pricePaid), applyResaleRate <= pricePaid.
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10_000_000 }),
          (workshopLevel, pricePaid) => {
            const rate = calculateWeaponResaleRate(workshopLevel);
            const refund = applyResaleRate(pricePaid, rate);
            // Net delta of buy-then-sell: -pricePaid + refund <= 0
            expect(refund).toBeLessThanOrEqual(pricePaid);
          },
        ),
        { numRuns: 200 },
      );
    });
  });
});
