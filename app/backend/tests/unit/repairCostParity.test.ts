/**
 * Repair_Cost_Parity_Test — Spec #48 Requirement 15 criteria 13, 14, 15.
 *
 * Pins the Charged_Repair_Cost the consolidated Shared_Repair_Module produces
 * against the amounts the PRE-consolidation `calculateRepairCost` in
 * `app/backend/src/utils/robotCalculations.ts` produced.
 *
 * Every expected value below is a LITERAL captured from that old implementation
 * before it was deleted (Spec #48 task 1.2). Criterion 14 forbids deriving an
 * expectation by calling the consolidated function — a test that computes its
 * expectation with the same formula it is testing cannot fail. If a number here
 * changes, someone changed what a player is charged.
 *
 * Attribute sum for every case is 115, a plausible total for a low-level robot
 * across its 23 attributes.
 */

import {
  calculateRepairQuote,
  applyManualRepairDiscount,
} from '../../src/shared/utils/repairCost';

const ATTRIBUTE_TOTAL = 115;

interface ParityCase {
  name: string;
  damagePercent: number;
  hpPercent: number;
  repairBayLevel: number;
  activeRobotCount: number;
  /** Captured from the pre-consolidation implementation. */
  expectedQuote: number;
  /** floor(expectedQuote × MANUAL_REPAIR_DISCOUNT), also captured. */
  expectedManualCharged: number;
}

/**
 * The seven-case matrix from design § 3.6: every Damage_Multiplier boundary
 * (2.0 at 0% HP, 1.5 below 10%, 1.0 above), an undamaged robot, Repair Bay
 * level 0, a discount below the cap, and a level/count product above the 90% cap.
 */
const PARITY_CASES: ParityCase[] = [
  {
    name: 'destroyed (0% HP), no Repair Bay — Damage_Multiplier 2.0',
    damagePercent: 100, hpPercent: 0, repairBayLevel: 0, activeRobotCount: 1,
    expectedQuote: 23000, expectedManualCharged: 11500,
  },
  {
    name: 'critical (5% HP), no Repair Bay — Damage_Multiplier 1.5',
    damagePercent: 95, hpPercent: 5, repairBayLevel: 0, activeRobotCount: 1,
    expectedQuote: 16388, expectedManualCharged: 8194,
  },
  {
    name: 'damaged (40% HP), no Repair Bay — Damage_Multiplier 1.0',
    damagePercent: 60, hpPercent: 40, repairBayLevel: 0, activeRobotCount: 1,
    expectedQuote: 6900, expectedManualCharged: 3450,
  },
  {
    name: 'undamaged (100% HP) — quote is 0 (criterion 16)',
    damagePercent: 0, hpPercent: 100, repairBayLevel: 0, activeRobotCount: 1,
    expectedQuote: 0, expectedManualCharged: 0,
  },
  {
    name: 'destroyed, Repair Bay 2 with 5 active robots — 20% discount, below cap',
    damagePercent: 100, hpPercent: 0, repairBayLevel: 2, activeRobotCount: 5,
    expectedQuote: 18400, expectedManualCharged: 9200,
  },
  {
    name: 'damaged, Repair Bay 10 with 20 active robots — product 250%, capped at 90%',
    damagePercent: 60, hpPercent: 40, repairBayLevel: 10, activeRobotCount: 20,
    expectedQuote: 690, expectedManualCharged: 345,
  },
  {
    name: 'critical, Repair Bay 1 with 3 active robots — 8% discount, odd quote',
    damagePercent: 95, hpPercent: 5, repairBayLevel: 1, activeRobotCount: 3,
    expectedQuote: 15077, expectedManualCharged: 7538,
  },
];

describe('Repair_Cost_Parity_Test — consolidated module reproduces pre-consolidation amounts', () => {
  it.each(PARITY_CASES.map((c) => [c.name, c] as const))(
    'Repair_Quote is unchanged for %s',
    (_name, testCase) => {
      const quote = calculateRepairQuote(
        {
          attributeTotal: ATTRIBUTE_TOTAL,
          damagePercent: testCase.damagePercent,
          hpPercent: testCase.hpPercent,
        },
        {
          repairBayLevel: testCase.repairBayLevel,
          activeRobotCount: testCase.activeRobotCount,
        },
      );

      expect(quote).toBe(testCase.expectedQuote);
    },
  );

  it.each(PARITY_CASES.map((c) => [c.name, c] as const))(
    'Charged_Repair_Cost on the Manual_Repair_Path is unchanged for %s',
    (_name, testCase) => {
      const quote = calculateRepairQuote(
        {
          attributeTotal: ATTRIBUTE_TOTAL,
          damagePercent: testCase.damagePercent,
          hpPercent: testCase.hpPercent,
        },
        {
          repairBayLevel: testCase.repairBayLevel,
          activeRobotCount: testCase.activeRobotCount,
        },
      );

      expect(applyManualRepairDiscount(quote)).toBe(testCase.expectedManualCharged);
    },
  );
});

describe('Repair_Cost_Parity_Test — a manual batch charges the sum of per-robot amounts', () => {
  /**
   * Requirement 15 criterion 11: quote each robot, discount each robot, then sum.
   *
   * DELIBERATELY NOT A PARITY ASSERTION. Criterion 12 sanctions a total up to
   * N−1 credits below the batch-level `floor(totalQuote × 0.5)` the old code
   * charged, because the per-robot figure is the one that reconciles with the
   * per-robot audit, lifetime and ledger records. The odd-quote case below is
   * exactly that divergence: three quotes of 15077 give 22614 per-robot against
   * 22615 batch-level. Both numbers are captured from the old implementation;
   * the assertion picks the per-robot one on purpose.
   */
  const ODD_QUOTE = 15077;
  const ODD_BATCH_PER_ROBOT_TOTAL = 22614;
  const ODD_BATCH_LEGACY_TOTAL = 22615;

  function quoteFor(damagePercent: number, hpPercent: number, bay: number, robots: number): number {
    return calculateRepairQuote(
      { attributeTotal: ATTRIBUTE_TOTAL, damagePercent, hpPercent },
      { repairBayLevel: bay, activeRobotCount: robots },
    );
  }

  it('sums per-robot Charged_Repair_Costs for a batch whose quotes divide evenly', () => {
    const quotes = [
      quoteFor(100, 0, 2, 3),
      quoteFor(95, 5, 2, 3),
      quoteFor(33, 67, 2, 3),
    ];

    // Captured from the pre-consolidation implementation.
    expect(quotes).toEqual([19320, 13766, 3188]);

    const perRobotThenSum = quotes.reduce((sum, q) => sum + applyManualRepairDiscount(q), 0);
    expect(perRobotThenSum).toBe(18137);
  });

  it('charges the per-robot total for a batch of odd quotes, up to N-1 below the legacy batch figure', () => {
    const quotes = [
      quoteFor(95, 5, 1, 3),
      quoteFor(95, 5, 1, 3),
      quoteFor(95, 5, 1, 3),
    ];

    expect(quotes).toEqual([ODD_QUOTE, ODD_QUOTE, ODD_QUOTE]);

    const perRobotThenSum = quotes.reduce((sum, q) => sum + applyManualRepairDiscount(q), 0);
    expect(perRobotThenSum).toBe(ODD_BATCH_PER_ROBOT_TOTAL);

    // The divergence criterion 12 permits: at most N−1 credits for N robots.
    const divergence = ODD_BATCH_LEGACY_TOTAL - perRobotThenSum;
    expect(divergence).toBeGreaterThanOrEqual(0);
    expect(divergence).toBeLessThanOrEqual(quotes.length - 1);
  });
});

/**
 * The thirteen cases inherited from `tests/sharedRepairCostParity.test.ts`.
 *
 * That file asserted that the shared `calculateRepairCost` and the backend's own
 * `calculateRepairCost` produced identical results — a guard against the two
 * declarations drifting apart. Spec #48 deletes the backend declaration, so the
 * behaviour that test covered ("the two copies agree") is genuinely gone and the
 * file was removed. Its *cases* were not gone, so they live on here as literals
 * captured from the backend implementation before it was deleted.
 *
 * Attribute sum is 230 for most cases — roughly a mid-level robot — which
 * exercises different rounding than the 115 used above.
 */
const INHERITED_CASES: ParityCase[] = [
  { name: 'total destruction, no discount',      damagePercent: 100, hpPercent: 0,  repairBayLevel: 0,  activeRobotCount: 0,  expectedQuote: 46000, expectedManualCharged: 23000 },
  { name: 'heavy damage (5% HP)',                damagePercent: 95,  hpPercent: 5,  repairBayLevel: 0,  activeRobotCount: 0,  expectedQuote: 32775, expectedManualCharged: 16387 },
  { name: 'normal damage (15% HP)',              damagePercent: 85,  hpPercent: 15, repairBayLevel: 0,  activeRobotCount: 0,  expectedQuote: 19550, expectedManualCharged: 9775 },
  { name: 'light damage (40% HP)',               damagePercent: 60,  hpPercent: 40, repairBayLevel: 0,  activeRobotCount: 0,  expectedQuote: 13800, expectedManualCharged: 6900 },
  { name: 'no damage',                           damagePercent: 0,   hpPercent: 50, repairBayLevel: 0,  activeRobotCount: 0,  expectedQuote: 0,     expectedManualCharged: 0 },
  { name: 'repair bay level 5, no robots',       damagePercent: 100, hpPercent: 0,  repairBayLevel: 5,  activeRobotCount: 0,  expectedQuote: 34500, expectedManualCharged: 17250 },
  { name: 'repair bay level 5, 4 robots',        damagePercent: 100, hpPercent: 0,  repairBayLevel: 5,  activeRobotCount: 4,  expectedQuote: 25300, expectedManualCharged: 12650 },
  { name: 'repair bay level 10, 0 robots',       damagePercent: 100, hpPercent: 0,  repairBayLevel: 10, activeRobotCount: 0,  expectedQuote: 23000, expectedManualCharged: 11500 },
  { name: 'repair bay level 3, 10 robots',       damagePercent: 50,  hpPercent: 25, repairBayLevel: 3,  activeRobotCount: 10, expectedQuote: 6325,  expectedManualCharged: 3162 },
  { name: 'cap at 90% discount',                 damagePercent: 100, hpPercent: 0,  repairBayLevel: 10, activeRobotCount: 20, expectedQuote: 4600,  expectedManualCharged: 2300 },
];

describe('Repair_Cost_Parity_Test — cases inherited from the deleted shared/backend parity test', () => {
  it.each(INHERITED_CASES.map((c) => [c.name, c] as const))(
    'Repair_Quote is unchanged for %s (attribute sum 230)',
    (_name, testCase) => {
      const quote = calculateRepairQuote(
        { attributeTotal: 230, damagePercent: testCase.damagePercent, hpPercent: testCase.hpPercent },
        { repairBayLevel: testCase.repairBayLevel, activeRobotCount: testCase.activeRobotCount },
      );
      expect(quote).toBe(testCase.expectedQuote);
      expect(applyManualRepairDiscount(quote)).toBe(testCase.expectedManualCharged);
    },
  );

  it('Repair_Quote is unchanged for a fractional attribute sum', () => {
    const quote = calculateRepairQuote(
      { attributeTotal: 230.75, damagePercent: 80, hpPercent: 20 },
      { repairBayLevel: 2, activeRobotCount: 5 },
    );
    expect(quote).toBe(14768);
  });

  it('Repair_Quote is unchanged for a large attribute sum', () => {
    const quote = calculateRepairQuote(
      { attributeTotal: 2300, damagePercent: 50, hpPercent: 50 },
      { repairBayLevel: 5, activeRobotCount: 3 },
    );
    expect(quote).toBe(69000);
  });

  it('Repair_Quote is unchanged for a small attribute sum', () => {
    const quote = calculateRepairQuote(
      { attributeTotal: 23, damagePercent: 100, hpPercent: 0 },
      { repairBayLevel: 0, activeRobotCount: 0 },
    );
    expect(quote).toBe(4600);
    expect(applyManualRepairDiscount(quote)).toBe(2300);
  });
});
