/**
 * Property tests for the repair JSON key resolvers — Spec #48 Requirement 17.
 *
 * Properties 31, 32 and 33.
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import {
  readCycleRepairSpend,
  readRepairChargedCredits,
  readRepairPreDiscountCredits,
  CYCLE_REPAIR_SPEND_KEY,
  REPAIR_CHARGED_KEY,
  REPAIR_PRE_DISCOUNT_KEY,
} from '../../src/services/economy/repairPayloadKeys';

const RUNS = { numRuns: 200 };
const money = fc.integer({ min: 0, max: 5_000_000 });

describe('Property 31: The key resolvers prefer the renamed key and never sum', () => {
  // Feature: 48-dashboard-overview-row, Property 31: The key resolvers prefer the renamed key and never sum

  it('reads the renamed key when only it is present', () => {
    fc.assert(
      fc.property(money, (value) => {
        expect(readCycleRepairSpend({ [CYCLE_REPAIR_SPEND_KEY]: value })).toBe(value);
        expect(readRepairChargedCredits({ [REPAIR_CHARGED_KEY]: value })).toBe(value);
        expect(readRepairPreDiscountCredits({ [REPAIR_PRE_DISCOUNT_KEY]: value })).toBe(value);
      }),
      RUNS,
    );
  });

  it('falls back to the legacy key when only it is present', () => {
    fc.assert(
      fc.property(money, (value) => {
        expect(readCycleRepairSpend({ totalRepairCosts: value })).toBe(value);
        expect(readRepairChargedCredits({ cost: value })).toBe(value);
        expect(readRepairPreDiscountCredits({ preDiscountCost: value })).toBe(value);
      }),
      RUNS,
    );
  });

  it('prefers the renamed key and NEVER sums when both are present with different values', () => {
    fc.assert(
      fc.property(money, money, (renamed, legacy) => {
        // The guard that matters: a partially migrated row must not double a total.
        expect(readCycleRepairSpend({ [CYCLE_REPAIR_SPEND_KEY]: renamed, totalRepairCosts: legacy })).toBe(renamed);
        expect(readRepairChargedCredits({ [REPAIR_CHARGED_KEY]: renamed, cost: legacy })).toBe(renamed);
        expect(
          readRepairPreDiscountCredits({ [REPAIR_PRE_DISCOUNT_KEY]: renamed, preDiscountCost: legacy }),
        ).toBe(renamed);
      }),
      RUNS,
    );
  });

  it('returns zero for Cycle_Repair_Spend and null for the audit figures when neither key is present', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.integer()), (noise) => {
        const clean = { ...noise };
        delete clean[CYCLE_REPAIR_SPEND_KEY];
        delete clean.totalRepairCosts;
        delete clean[REPAIR_CHARGED_KEY];
        delete clean.cost;
        delete clean[REPAIR_PRE_DISCOUNT_KEY];
        delete clean.preDiscountCost;

        // A stable with no repairs genuinely spent nothing, and every caller sums it.
        expect(readCycleRepairSpend(clean)).toBe(0);
        // A malformed or absent audit figure is excluded rather than counted as 0.
        expect(readRepairChargedCredits(clean)).toBeNull();
        expect(readRepairPreDiscountCredits(clean)).toBeNull();
      }),
      RUNS,
    );
  });

  it('excludes a non-numeric or non-finite value rather than poisoning a total', () => {
    // Requirement 9 criterion 10, satisfied once for every reader.
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

  it('tolerates null and undefined payloads', () => {
    expect(readCycleRepairSpend(null)).toBe(0);
    expect(readCycleRepairSpend(undefined)).toBe(0);
    expect(readRepairChargedCredits(null)).toBeNull();
    expect(readRepairPreDiscountCredits(undefined)).toBeNull();
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
    // Criterion 5: the `payload.repairType` JSON path filter behind
    // GET /api/admin/audit-log/repairs must keep matching pre- and post-rename rows.
    const source = codeOnly('services/common/eventLogger.ts');
    expect(source).toMatch(/payload\.repairType\s*=/);
    expect(source).toMatch(/payload\.manualRepairDiscount\s*=/);
  });
});

describe('Property 33: The renames preserve every value', () => {
  // Feature: 48-dashboard-overview-row, Property 33: The renames preserve every value

  it('a pre-rename row reports the same number as an equivalent post-rename row', () => {
    fc.assert(
      fc.property(money, (value) => {
        const legacyRow = { totalRepairCosts: value };
        const renamedRow = { [CYCLE_REPAIR_SPEND_KEY]: value };
        expect(readCycleRepairSpend(legacyRow)).toBe(readCycleRepairSpend(renamedRow));

        const legacyAudit = { cost: value, preDiscountCost: value * 2 };
        const renamedAudit = {
          [REPAIR_CHARGED_KEY]: value,
          [REPAIR_PRE_DISCOUNT_KEY]: value * 2,
        };
        expect(readRepairChargedCredits(legacyAudit)).toBe(readRepairChargedCredits(renamedAudit));
        expect(readRepairPreDiscountCredits(legacyAudit)).toBe(
          readRepairPreDiscountCredits(renamedAudit),
        );
      }),
      RUNS,
    );
  });

  it('the savings figure is identical whichever key form a row uses', () => {
    fc.assert(
      fc.property(money, money, (charged, preDiscount) => {
        const legacy = { cost: charged, preDiscountCost: preDiscount };
        const renamed = {
          [REPAIR_CHARGED_KEY]: charged,
          [REPAIR_PRE_DISCOUNT_KEY]: preDiscount,
        };

        const savingsOf = (row: Record<string, unknown>): number =>
          (readRepairPreDiscountCredits(row) ?? 0) - (readRepairChargedCredits(row) ?? 0);

        expect(savingsOf(legacy)).toBe(savingsOf(renamed));
      }),
      RUNS,
    );
  });

  it('the fallback is documented as removable at the next Season_Rollover', () => {
    // Criterion 12: the condition under which the fallback becomes dead code must be
    // stated, so the next reader does not have to work it out.
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'services', 'economy', 'repairPayloadKeys.ts'),
      'utf-8',
    );
    expect(source).toMatch(/Season_Rollover/);
  });
});
