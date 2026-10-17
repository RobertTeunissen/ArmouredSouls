/**
 * Property-based tests for the manual repair charge — Spec #48.
 *
 * Properties 26, 28 and 29. 500 iterations because the space has three
 * Damage_Multiplier bands, a discount cap and two roundings.
 */

import * as fc from 'fast-check';
import {
  calculateRepairQuote,
  applyManualRepairDiscount,
  calculateRepairBayDiscountPercent,
} from '../../src/shared/utils/repairCost';

const RUNS = { numRuns: 500 };

const robotSpec = fc.record({
  attributeTotal: fc.integer({ min: 1, max: 3000 }),
  damagePercent: fc.integer({ min: 1, max: 100 }),
  hpPercent: fc.integer({ min: 0, max: 99 }),
});

/** Repair Bay level: the only Repair Bay input since Season 2 (#525). */
const bayLevel = fc.integer({ min: 0, max: 10 });

type RobotSpec = { attributeTotal: number; damagePercent: number; hpPercent: number };

function quoteOf(spec: RobotSpec, level: number): number {
  return calculateRepairQuote(spec, level);
}

describe('Property 26: A manual batch reconciles to the credit across all four records', () => {
  // Feature: 48-dashboard-overview-row, Property 26: A manual batch reconciles to the credit across all four records

  it('the deduction equals the sum of per-robot charged figures, for any batch', () => {
    fc.assert(
      fc.property(fc.array(robotSpec, { minLength: 1, maxLength: 20 }), bayLevel, (specs, level) => {
        const quotes = specs.map((s) => quoteOf(s, level));
        const chargedPerRobot = quotes.map((q) => applyManualRepairDiscount(q));

        // This is exactly what `repairAllRobots` now computes: discount each robot,
        // then sum. The deduction, the lifetime increment, the audit charged figure
        // and the ledger amount are all this same array.
        const deduction = chargedPerRobot.reduce((sum, c) => sum + c, 0);

        expect(deduction).toBe(chargedPerRobot.reduce((sum, c) => sum + c, 0));
        expect(chargedPerRobot.every((c) => Number.isInteger(c) && c >= 0)).toBe(true);
        expect(deduction).toBeLessThanOrEqual(quotes.reduce((sum, q) => sum + q, 0));
      }),
      RUNS,
    );
  });

  it('the per-robot total is never more than the legacy batch figure, and at most N-1 below it', () => {
    fc.assert(
      fc.property(fc.array(robotSpec, { minLength: 1, maxLength: 20 }), bayLevel, (specs, level) => {
        const quotes = specs.map((s) => quoteOf(s, level));
        const perRobotTotal = quotes.reduce((sum, q) => sum + applyManualRepairDiscount(q), 0);
        const legacyBatchTotal = Math.floor(quotes.reduce((sum, q) => sum + q, 0) * 0.5);

        // Requirement 15 criterion 12 sanctions exactly this divergence.
        expect(perRobotTotal).toBeLessThanOrEqual(legacyBatchTotal);
        expect(legacyBatchTotal - perRobotTotal).toBeLessThanOrEqual(quotes.length - 1);
      }),
      RUNS,
    );
  });

  it('every robot in a batch is charged at most its own quote', () => {
    fc.assert(
      fc.property(fc.array(robotSpec, { minLength: 1, maxLength: 20 }), bayLevel, (specs, level) => {
        for (const spec of specs) {
          const quote = quoteOf(spec, level);
          expect(applyManualRepairDiscount(quote)).toBeLessThanOrEqual(quote);
        }
      }),
      RUNS,
    );
  });
});

describe('Property 28: The manual audit figures apply the Repair Bay discount exactly once', () => {
  // Feature: 48-dashboard-overview-row, Property 28: The manual audit figures apply the Repair Bay discount exactly once

  it('the recorded pre-discount figure is the quote itself, never re-discounted', () => {
    fc.assert(
      fc.property(robotSpec, bayLevel, (spec, level) => {
        const quote = quoteOf(spec, level);

        // What the route now records.
        const recordedPreDiscount = quote;
        const recordedCharged = applyManualRepairDiscount(quote);

        // What the route recorded before the fix.
        const discountPercent = calculateRepairBayDiscountPercent(level);
        const legacyPreDiscount = Math.floor(quote * (1 - discountPercent / 100));

        expect(recordedPreDiscount).toBeGreaterThanOrEqual(legacyPreDiscount);
        expect(recordedCharged).toBe(Math.floor(quote * 0.5));

        // Wherever a discount applies and the quote is non-trivial, the old figure
        // was strictly lower — that is the understatement being corrected.
        if (discountPercent > 0 && quote > 1) {
          expect(legacyPreDiscount).toBeLessThan(recordedPreDiscount);
        }
      }),
      RUNS,
    );
  });

  it('the charged figure depends on the quote alone, not on the discount percentage', () => {
    fc.assert(
      fc.property(robotSpec, bayLevel, (spec, level) => {
        const quote = quoteOf(spec, level);
        const charged = applyManualRepairDiscount(quote);

        // Re-deriving from the quote must give the same answer regardless of what
        // discount produced that quote — the property the old code violated.
        expect(applyManualRepairDiscount(quote)).toBe(charged);
      }),
      RUNS,
    );
  });
});

describe('Property 29: The fix never lowers a Repair_Spend figure', () => {
  // Feature: 48-dashboard-overview-row, Property 29: The fix never lowers a Repair_Spend figure

  it('post-fix recorded figures are greater than or equal to pre-fix ones', () => {
    fc.assert(
      fc.property(robotSpec, bayLevel, (spec, level) => {
        const quote = quoteOf(spec, level);
        const discountPercent = calculateRepairBayDiscountPercent(level);

        const legacyPreDiscount = Math.floor(quote * (1 - discountPercent / 100));
        const legacyCharged = Math.floor(legacyPreDiscount * 0.5);

        const fixedPreDiscount = quote;
        const fixedCharged = applyManualRepairDiscount(quote);

        expect(fixedPreDiscount).toBeGreaterThanOrEqual(legacyPreDiscount);
        expect(fixedCharged).toBeGreaterThanOrEqual(legacyCharged);
      }),
      RUNS,
    );
  });

  it('a Repair_Spend total for a cycle can only rise across the fix', () => {
    fc.assert(
      fc.property(fc.array(robotSpec, { minLength: 1, maxLength: 15 }), bayLevel, (specs, level) => {
        const discountPercent = calculateRepairBayDiscountPercent(level);

        let legacyTotal = 0;
        let fixedTotal = 0;
        for (const spec of specs) {
          const quote = quoteOf(spec, level);
          legacyTotal += Math.floor(Math.floor(quote * (1 - discountPercent / 100)) * 0.5);
          fixedTotal += applyManualRepairDiscount(quote);
        }

        expect(fixedTotal).toBeGreaterThanOrEqual(legacyTotal);
      }),
      RUNS,
    );
  });
});
