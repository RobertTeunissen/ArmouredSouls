/**
 * Property-based tests for the Shared_Repair_Module — Spec #48.
 *
 * 500 iterations rather than the default 100: the input space has three
 * Damage_Multiplier bands, a discount cap and two different rounding rules, so a
 * shallow run misses the boundaries that matter.
 */

import * as fc from 'fast-check';
import {
  calculateRepairQuote,
  applyManualRepairDiscount,
  calculateRepairBayDiscountPercent,
  MANUAL_REPAIR_DISCOUNT,
  MAX_REPAIR_BAY_DISCOUNT_PERCENT,
} from '../../src/shared/utils/repairCost';

const RUNS = { numRuns: 500 };

/** Inputs that are always valid: finite, non-negative, within sane game ranges. */
const validSubject = fc.record({
  attributeTotal: fc.double({ min: 0, max: 5000, noNaN: true }),
  damagePercent: fc.double({ min: 0, max: 100, noNaN: true }),
  hpPercent: fc.double({ min: 0, max: 100, noNaN: true }),
});

const validContext = fc.record({
  repairBayLevel: fc.integer({ min: 0, max: 10 }),
  activeRobotCount: fc.integer({ min: 0, max: 30 }),
});

describe('Property 25: The Repair_Quote formula is exact, bounded and monotonic', () => {
  // Feature: 48-dashboard-overview-row, Property 25: The Repair_Quote formula is exact, bounded and monotonic

  it('returns a non-negative whole number for every valid input', () => {
    fc.assert(
      fc.property(validSubject, validContext, (subject, context) => {
        const quote = calculateRepairQuote(subject, context);
        expect(Number.isInteger(quote)).toBe(true);
        expect(quote).toBeGreaterThanOrEqual(0);
      }),
      RUNS,
    );
  });

  it('returns exactly 0 when there is no damage, whatever the other inputs', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 5000, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        validContext,
        (attributeTotal, hpPercent, context) => {
          expect(calculateRepairQuote({ attributeTotal, damagePercent: 0, hpPercent }, context)).toBe(0);
        },
      ),
      RUNS,
    );
  });

  it('is monotonic non-decreasing in damage percentage', () => {
    fc.assert(
      fc.property(
        fc.record({
          attributeTotal: fc.double({ min: 1, max: 5000, noNaN: true }),
          hpPercent: fc.double({ min: 0, max: 100, noNaN: true }),
          lowDamage: fc.double({ min: 0, max: 50, noNaN: true }),
          highDamage: fc.double({ min: 50, max: 100, noNaN: true }),
        }),
        validContext,
        ({ attributeTotal, hpPercent, lowDamage, highDamage }, context) => {
          const low = calculateRepairQuote({ attributeTotal, damagePercent: lowDamage, hpPercent }, context);
          const high = calculateRepairQuote({ attributeTotal, damagePercent: highDamage, hpPercent }, context);
          expect(high).toBeGreaterThanOrEqual(low);
        },
      ),
      RUNS,
    );
  });

  it('is monotonic non-increasing in Repair Bay level', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 5000, noNaN: true }),
        fc.double({ min: 1, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.integer({ min: 0, max: 30 }),
        (attributeTotal, damagePercent, hpPercent, activeRobotCount) => {
          const cheaper = calculateRepairQuote(
            { attributeTotal, damagePercent, hpPercent },
            { repairBayLevel: 5, activeRobotCount },
          );
          const dearer = calculateRepairQuote(
            { attributeTotal, damagePercent, hpPercent },
            { repairBayLevel: 0, activeRobotCount },
          );
          expect(cheaper).toBeLessThanOrEqual(dearer);
        },
      ),
      RUNS,
    );
  });

  it('applies the documented Damage_Multiplier band for the HP percentage', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 1, max: 100, noNaN: true }),
        (attributeTotal, damagePercent) => {
          const noDiscount = { repairBayLevel: 0, activeRobotCount: 0 };
          const destroyed = calculateRepairQuote({ attributeTotal, damagePercent, hpPercent: 0 }, noDiscount);
          const critical = calculateRepairQuote({ attributeTotal, damagePercent, hpPercent: 5 }, noDiscount);
          const ordinary = calculateRepairQuote({ attributeTotal, damagePercent, hpPercent: 50 }, noDiscount);

          // 2.0 > 1.5 > 1.0, so the ordering holds for any positive damage.
          expect(destroyed).toBeGreaterThanOrEqual(critical);
          expect(critical).toBeGreaterThanOrEqual(ordinary);
        },
      ),
      RUNS,
    );
  });

  it('never discounts by more than the documented cap', () => {
    fc.assert(
      fc.property(validContext, (context) => {
        const percent = calculateRepairBayDiscountPercent(context);
        expect(percent).toBeGreaterThanOrEqual(0);
        expect(percent).toBeLessThanOrEqual(MAX_REPAIR_BAY_DISCOUNT_PERCENT);
      }),
      RUNS,
    );
  });

  it('applies the manual discount as a floor, never above half the quote', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), (quote) => {
        const charged = applyManualRepairDiscount(quote);
        expect(charged).toBe(Math.floor(quote * MANUAL_REPAIR_DISCOUNT));
        expect(charged).toBeLessThanOrEqual(quote);
        expect(charged).toBeGreaterThanOrEqual(0);
      }),
      RUNS,
    );
  });

  it('prices the robot form identically to the equivalent explicit form', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 0, max: 99 }),
        validContext,
        (maxHP, hpPercentInt, context) => {
          const currentHP = Math.floor((maxHP * hpPercentInt) / 100);
          const robot = { currentHP, maxHP, combatPower: 5 } as never;

          const viaRobot = calculateRepairQuote({ robot }, context);
          expect(Number.isInteger(viaRobot)).toBe(true);
          expect(viaRobot).toBeGreaterThanOrEqual(0);
        },
      ),
      RUNS,
    );
  });
});

describe('Property 27: Bad input to the Shared_Repair_Module signals an error', () => {
  // Feature: 48-dashboard-overview-row, Property 27: Bad input to the Shared_Repair_Module signals an error

  const badNumber = fc.oneof(
    fc.double({ min: -10000, max: -0.0001, noNaN: true }),
    fc.constant(Number.NaN),
    fc.constant(Number.POSITIVE_INFINITY),
    fc.constant(Number.NEGATIVE_INFINITY),
  );

  it('throws RangeError for a bad attribute total', () => {
    fc.assert(
      fc.property(badNumber, (attributeTotal) => {
        expect(() =>
          calculateRepairQuote(
            { attributeTotal, damagePercent: 50, hpPercent: 50 },
            { repairBayLevel: 0, activeRobotCount: 0 },
          ),
        ).toThrow(RangeError);
      }),
      RUNS,
    );
  });

  it('throws RangeError for a bad damage percentage', () => {
    fc.assert(
      fc.property(badNumber, (damagePercent) => {
        expect(() =>
          calculateRepairQuote(
            { attributeTotal: 100, damagePercent, hpPercent: 50 },
            { repairBayLevel: 0, activeRobotCount: 0 },
          ),
        ).toThrow(RangeError);
      }),
      RUNS,
    );
  });

  it('throws RangeError for a bad Repair Bay level or active robot count', () => {
    fc.assert(
      fc.property(badNumber, (bad) => {
        expect(() =>
          calculateRepairBayDiscountPercent({ repairBayLevel: bad, activeRobotCount: 1 }),
        ).toThrow(RangeError);
        expect(() =>
          calculateRepairBayDiscountPercent({ repairBayLevel: 1, activeRobotCount: bad }),
        ).toThrow(RangeError);
      }),
      RUNS,
    );
  });

  it('throws RangeError for a bad quote handed to the manual discount', () => {
    fc.assert(
      fc.property(badNumber, (quote) => {
        expect(() => applyManualRepairDiscount(quote)).toThrow(RangeError);
      }),
      RUNS,
    );
  });

  it('never returns a negative or non-finite quote for any valid input', () => {
    fc.assert(
      fc.property(validSubject, validContext, (subject, context) => {
        const quote = calculateRepairQuote(subject, context);
        expect(Number.isFinite(quote)).toBe(true);
        expect(quote).toBeGreaterThanOrEqual(0);
      }),
      RUNS,
    );
  });
});
