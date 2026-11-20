/**
 * Property tests for the repair JSON key readers — Spec #48 Requirement 17.
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import {
  readCycleRepairSpend,
  readRepairChargedCredits,
  CYCLE_REPAIR_SPEND_KEY,
  REPAIR_CHARGED_KEY,
} from '../../src/services/economy/repairPayloadKeys';

const RUNS = { numRuns: 200 };
const money = fc.integer({ min: 0, max: 5_000_000 });

describe('Property 31: The key readers', () => {
  it('read the key when it is present', () => {
    fc.assert(
      fc.property(money, (value) => {
        expect(readCycleRepairSpend({ [CYCLE_REPAIR_SPEND_KEY]: value })).toBe(value);
        expect(readRepairChargedCredits({ [REPAIR_CHARGED_KEY]: value })).toBe(value);
      }),
      RUNS,
    );
  });

  it('return zero for Cycle_Repair_Spend and null for the charged figure when the key is absent', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.integer()), (noise) => {
        const clean = { ...noise };
        delete clean[CYCLE_REPAIR_SPEND_KEY];
        delete clean[REPAIR_CHARGED_KEY];

        // A stable with no repairs genuinely spent nothing, and every caller sums it.
        expect(readCycleRepairSpend(clean)).toBe(0);
        // A malformed or absent audit figure is excluded rather than counted as 0.
        expect(readRepairChargedCredits(clean)).toBeNull();
      }),
      RUNS,
    );
  });

  it('exclude a non-numeric or non-finite value rather than poisoning a total', () => {
    const bad = fc.oneof(
      fc.string(),
      fc.constant(null),
      fc.constant(undefined),
      fc.boolean(),
      fc.constant(Number.NaN),
      fc.constant(Number.POSITIVE_INFINITY),
    );

    fc.assert(
      fc.property(bad, (value) => {
        expect(readRepairChargedCredits({ [REPAIR_CHARGED_KEY]: value })).toBeNull();
        expect(readCycleRepairSpend({ [CYCLE_REPAIR_SPEND_KEY]: value })).toBe(0);
      }),
      RUNS,
    );
  });

  it('tolerate null and undefined payloads', () => {
    expect(readCycleRepairSpend(null)).toBe(0);
    expect(readCycleRepairSpend(undefined)).toBe(0);
    expect(readRepairChargedCredits(null)).toBeNull();
  });
});

describe('Property 32: New writes carry the renamed keys only', () => {
  // Feature: 48-dashboard-overview-row, Property 32: New writes carry the renamed keys only

  const backendSrc = path.join(__dirname, '..', '..', 'src');

  function codeOnly(file: string): string {
    return fs
      .readFileSync(path.join(backendSrc, file), 'utf-8')
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n');
  }

  it('eventLogger writes the renamed audit keys and not the old ones', () => {
    const source = codeOnly('services/common/eventLogger.ts');

    // The renamed keys are written through the exported constants.
    expect(source).toMatch(/REPAIR_CHARGED_KEY/);
    expect(source).toMatch(/REPAIR_PRE_DISCOUNT_KEY/);

    // The old keys are not assigned onto a repair payload.
    expect(source).not.toMatch(/payload\.preDiscountCost\s*=/);
  });

  it('the snapshot aggregation writes the renamed stableMetrics key only', () => {
    const source = codeOnly('services/cycle/cycleSnapshotService.ts');

    expect(source).toMatch(/cycleRepairCreditsPaid/);
    // No write of the legacy key alongside it (criterion 9).
    expect(source).not.toMatch(/totalRepairCosts\s*[:+]?=/);
  });

  it('StableMetric declares the renamed field and not the old one', () => {
    const source = codeOnly('types/snapshotTypes.ts');
    expect(source).toMatch(/cycleRepairCreditsPaid\s*:/);
    expect(source).not.toMatch(/totalRepairCosts\s*:/);
  });

  it('repairType and manualRepairDiscount are deliberately NOT renamed', () => {
    // Criterion 5: the `payload.repairType` JSON path join in the Finance Center's
    // robot deployment query must keep matching pre- and post-rename rows.
    const source = codeOnly('services/common/eventLogger.ts');
    expect(source).toMatch(/payload\.repairType\s*=/);
    expect(source).toMatch(/payload\.manualRepairDiscount\s*=/);
  });
});
