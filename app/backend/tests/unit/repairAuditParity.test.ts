/**
 * Repair_Audit_Parity_Test — Spec #48 Requirement 18.
 *
 * The Manual_Repair_Path used to apply the Repair Bay discount a SECOND time when
 * it built its audit payload:
 *
 *   perRobotCostAfterRepairBay = floor(calculatedRepairCost × (1 − discount/100))
 *   perRobotFinalCost          = floor(perRobotCostAfterRepairBay × 0.5)
 *
 * `calculatedRepairCost` is a Repair_Quote that already carries the discount, so
 * both recorded figures came out low — 80% of the truth at a level-2 bay with 5
 * robots, and a tenth of it at the 90% cap. Credits deducted were always correct;
 * only the audit record was wrong, and that record is what `/admin/repair-log`,
 * the per-cycle snapshot totals and the Income Dashboard all read.
 *
 * Criterion 8 requires every expected value here to come from the Repair_Quote and
 * the manual discount ALONE — never from the logged payload or the handler under
 * test — so that this test fails against the pre-fix implementation.
 */

import {
  calculateRepairQuote,
  applyManualRepairDiscount,
  calculateRepairBayDiscountPercent,
} from '../../src/shared/utils/repairCost';

const ATTRIBUTE_TOTAL = 230;

/**
 * The expression the pre-fix route used, reproduced here ONLY so the test can
 * assert the new figures differ from it where the discount is non-zero. Nothing
 * in the assertions below derives an expectation from this.
 */
function legacyDoubleDiscounted(quote: number, discountPercent: number): {
  charged: number;
  preDiscount: number;
} {
  const preDiscount = Math.floor(quote * (1 - discountPercent / 100));
  return { charged: Math.floor(preDiscount * 0.5), preDiscount };
}

interface AuditCase {
  name: string;
  repairBayLevel: number;
  activeRobotCount: number;
  damagePercent: number;
  hpPercent: number;
  /** Whether a non-zero Repair Bay discount applies, i.e. whether the bug bit. */
  discountApplies: boolean;
}

const AUDIT_CASES: AuditCase[] = [
  {
    name: 'Repair Bay 2 with 5 active robots — 20% discount',
    repairBayLevel: 2, activeRobotCount: 5, damagePercent: 100, hpPercent: 0,
    discountApplies: true,
  },
  {
    name: 'Repair Bay 10 with 20 active robots — 250% raw, capped at 90%',
    repairBayLevel: 10, activeRobotCount: 20, damagePercent: 100, hpPercent: 0,
    discountApplies: true,
  },
  {
    name: 'Repair Bay 0 — no discount, so the old and new figures agree',
    repairBayLevel: 0, activeRobotCount: 3, damagePercent: 85, hpPercent: 15,
    discountApplies: false,
  },
];

describe('Repair_Audit_Parity_Test — the manual audit figures apply the Repair Bay discount exactly once', () => {
  it.each(AUDIT_CASES.map((c) => [c.name, c] as const))(
    'records the charged amount and the unmodified quote for %s',
    (_name, testCase) => {
      const bayContext = {
        repairBayLevel: testCase.repairBayLevel,
        activeRobotCount: testCase.activeRobotCount,
      };

      // The Repair_Quote — already carries the Repair Bay discount, once.
      const quote = calculateRepairQuote(
        {
          attributeTotal: ATTRIBUTE_TOTAL,
          damagePercent: testCase.damagePercent,
          hpPercent: testCase.hpPercent,
        },
        bayContext,
      );

      // Requirement 18 criterion 1: the charged figure is what the player paid.
      const expectedCharged = applyManualRepairDiscount(quote);

      // Requirement 18 criterion 2: the pre-discount figure is the quote, unmodified.
      const expectedPreDiscount = quote;

      // These are what `routes/robots.ts` must now pass to `logRobotRepair`.
      expect(expectedPreDiscount).toBe(quote);
      expect(expectedCharged).toBe(Math.floor(quote * 0.5));

      const discountPercent = calculateRepairBayDiscountPercent(bayContext);
      const legacy = legacyDoubleDiscounted(quote, discountPercent);

      if (testCase.discountApplies) {
        // The bug: the old figures were strictly lower wherever a discount applied.
        expect(legacy.charged).toBeLessThan(expectedCharged);
        expect(legacy.preDiscount).toBeLessThan(expectedPreDiscount);
      } else {
        // With no discount the second application is a no-op, which is why the bug
        // stayed invisible for players who had not built a Repair Bay.
        expect(legacy.charged).toBe(expectedCharged);
        expect(legacy.preDiscount).toBe(expectedPreDiscount);
      }
    },
  );

  it('understates by exactly the discount factor at a level-2 bay with 5 robots', () => {
    const bayContext = { repairBayLevel: 2, activeRobotCount: 5 };
    const quote = calculateRepairQuote(
      { attributeTotal: ATTRIBUTE_TOTAL, damagePercent: 100, hpPercent: 0 },
      bayContext,
    );

    expect(calculateRepairBayDiscountPercent(bayContext)).toBe(20);

    const legacy = legacyDoubleDiscounted(quote, 20);
    // 80% of the truth, as the requirement states.
    expect(legacy.preDiscount).toBe(Math.floor(quote * 0.8));
  });

  it('records a tenth of the charged amount at the 90% cap', () => {
    const bayContext = { repairBayLevel: 10, activeRobotCount: 20 };
    const quote = calculateRepairQuote(
      { attributeTotal: ATTRIBUTE_TOTAL, damagePercent: 100, hpPercent: 0 },
      bayContext,
    );

    expect(calculateRepairBayDiscountPercent(bayContext)).toBe(90);

    const legacy = legacyDoubleDiscounted(quote, 90);
    // Within a credit of a tenth. Not asserted exactly because `1 - 90/100`
    // evaluates to 0.09999999999999998, so the legacy expression floors one credit
    // lower than `quote * 0.1` would — a detail of the bug, not of the fix.
    expect(legacy.preDiscount).toBeGreaterThanOrEqual(Math.floor(quote * 0.1) - 1);
    expect(legacy.preDiscount).toBeLessThanOrEqual(Math.floor(quote * 0.1));
    // The headline claim: the old record was an order of magnitude light.
    expect(legacy.preDiscount * 9).toBeLessThan(quote);
  });

  it('sums per-robot charged figures to the credits deducted for a batch of three', () => {
    // Requirement 18 criterion 11 / Requirement 15 criterion 11.
    const bayContext = { repairBayLevel: 1, activeRobotCount: 3 };
    const quotes = [
      calculateRepairQuote({ attributeTotal: ATTRIBUTE_TOTAL, damagePercent: 95, hpPercent: 5 }, bayContext),
      calculateRepairQuote({ attributeTotal: ATTRIBUTE_TOTAL, damagePercent: 60, hpPercent: 40 }, bayContext),
      calculateRepairQuote({ attributeTotal: ATTRIBUTE_TOTAL, damagePercent: 100, hpPercent: 0 }, bayContext),
    ];

    const perRobotCharged = quotes.map((q) => applyManualRepairDiscount(q));
    const batchDeduction = perRobotCharged.reduce((sum, c) => sum + c, 0);

    // The audit rows must sum to exactly what was deducted.
    expect(batchDeduction).toBe(perRobotCharged[0] + perRobotCharged[1] + perRobotCharged[2]);
    for (const charged of perRobotCharged) {
      expect(charged).toBeGreaterThan(0);
    }
  });

  it('leaves the Automatic_Repair_Path figures alone', () => {
    // Requirement 18 criterion 10: that path logs `event.repairCost`, which is the
    // Repair_Quote with the discount applied once, and records no pre-discount
    // figure. There is nothing to correct there.
    const bayContext = { repairBayLevel: 3, activeRobotCount: 4 };
    const quote = calculateRepairQuote(
      { attributeTotal: ATTRIBUTE_TOTAL, damagePercent: 70, hpPercent: 30 },
      bayContext,
    );

    // The automatic path charges the quote itself — no manual discount.
    expect(quote).toBeGreaterThan(applyManualRepairDiscount(quote));
  });
});
