/**
 * Repair_Cost_Parity_Test — Spec #48 Requirement 15 criteria 13, 14, 15.
 *
 * Pins the Charged_Repair_Cost the consolidated Shared_Repair_Module produces
 * against the amounts the PRE-consolidation `calculateRepairCost` in
 * `app/backend/src/utils/robotCalculations.ts` produced.
 *
 * Every Repair Bay Level 0 value below is a LITERAL captured from that old
 * implementation before it was deleted (Spec #48 task 1.2). Criterion 14 forbids
 * deriving an expectation by calling the consolidated function — a test that
 * computes its expectation with the same formula it is testing cannot fail. If a
 * number here changes, someone changed what a player is charged.
 *
 * Season 2 (#525) changed the Repair Bay discount from
 * min(90, level × (5 + activeRobotCount)) to 6 × min(level, 10), independent of
 * robot count. The base price, damage multipliers and rounding are unchanged, so
 * the Level 0 literals stand; every row with a Repair Bay was recomputed BY HAND
 * for the new discount (the arithmetic is in each row's comment).
 *
 * Attribute sum for every case is 115, a plausible total for a low-level robot
 * across its 23 attributes.
 */

import * as fs from 'fs';
import * as path from 'path';
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
  /** Captured from the pre-consolidation implementation (Level 0) or hand-computed (#525). */
  expectedQuote: number;
  /** floor(expectedQuote × MANUAL_REPAIR_DISCOUNT), also captured. */
  expectedManualCharged: number;
}

/**
 * The seven-case matrix from design § 3.6: every Damage_Multiplier boundary
 * (2.0 at 0% HP, 1.5 below 10%, 1.0 above), an undamaged robot, Repair Bay
 * level 0, a mid-level discount, the Level 10 maximum and an odd quote.
 */
const PARITY_CASES: ParityCase[] = [
  {
    name: 'destroyed (0% HP), no Repair Bay — Damage_Multiplier 2.0',
    damagePercent: 100, hpPercent: 0, repairBayLevel: 0,
    expectedQuote: 23000, expectedManualCharged: 11500,
  },
  {
    name: 'critical (5% HP), no Repair Bay — Damage_Multiplier 1.5',
    damagePercent: 95, hpPercent: 5, repairBayLevel: 0,
    expectedQuote: 16388, expectedManualCharged: 8194,
  },
  {
    name: 'damaged (40% HP), no Repair Bay — Damage_Multiplier 1.0',
    damagePercent: 60, hpPercent: 40, repairBayLevel: 0,
    expectedQuote: 6900, expectedManualCharged: 3450,
  },
  {
    name: 'undamaged (100% HP) — quote is 0 (criterion 16)',
    damagePercent: 0, hpPercent: 100, repairBayLevel: 0,
    expectedQuote: 0, expectedManualCharged: 0,
  },
  {
    // 11,500 × 1.0 × 2.0 = 23,000; × (1 − 0.12) = 20,240; manual floor(20,240 / 2) = 10,120
    name: 'destroyed, Repair Bay 2 — 12% discount',
    damagePercent: 100, hpPercent: 0, repairBayLevel: 2,
    expectedQuote: 20240, expectedManualCharged: 10120,
  },
  {
    // 11,500 × 0.6 × 1.0 = 6,900; × (1 − 0.60) = 2,760; manual 1,380
    name: 'damaged, Repair Bay 10 — maximum 60% discount',
    damagePercent: 60, hpPercent: 40, repairBayLevel: 10,
    expectedQuote: 2760, expectedManualCharged: 1380,
  },
  {
    // 11,500 × 0.95 × 1.5 = 16,387.5; × (1 − 0.12) = 14,421; manual floor(7,210.5) = 7,210
    name: 'critical, Repair Bay 2 — 12% discount, odd quote',
    damagePercent: 95, hpPercent: 5, repairBayLevel: 2,
    expectedQuote: 14421, expectedManualCharged: 7210,
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
        testCase.repairBayLevel,
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
        testCase.repairBayLevel,
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
   * exactly that divergence: three quotes of 14421 give 21630 per-robot against
   * 21631 batch-level (floor(43,263 / 2)). Hand-computed for the Season 2
   * Repair Bay discount (#525); the assertion picks the per-robot one on purpose.
   */
  const ODD_QUOTE = 14421;
  const ODD_BATCH_PER_ROBOT_TOTAL = 21630;
  const ODD_BATCH_LEGACY_TOTAL = 21631;

  function quoteFor(damagePercent: number, hpPercent: number, bay: number): number {
    return calculateRepairQuote(
      { attributeTotal: ATTRIBUTE_TOTAL, damagePercent, hpPercent },
      bay,
    );
  }

  it('sums per-robot Charged_Repair_Costs for a batch whose quotes divide evenly', () => {
    const quotes = [
      quoteFor(100, 0, 3),
      quoteFor(95, 5, 3),
      quoteFor(33, 67, 3),
    ];

    // Hand-computed at Repair Bay 3 (18%): 23,000 × 0.82 = 18,860;
    // 16,387.5 × 0.82 = 13,437.75 → 13,438; 3,795 × 0.82 = 3,111.9 → 3,112.
    expect(quotes).toEqual([18860, 13438, 3112]);

    // 9,430 + 6,719 + 1,556
    const perRobotThenSum = quotes.reduce((sum, q) => sum + applyManualRepairDiscount(q), 0);
    expect(perRobotThenSum).toBe(17705);
  });

  it('charges the per-robot total for a batch of odd quotes, up to N-1 below the legacy batch figure', () => {
    const quotes = [
      quoteFor(95, 5, 2),
      quoteFor(95, 5, 2),
      quoteFor(95, 5, 2),
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
 * captured from the backend implementation before it was deleted. Rows with a
 * Repair Bay were recomputed by hand for the Season 2 discount (#525):
 * 46,000 × (1 − 6 × level / 100) for a destroyed 230-point robot.
 *
 * Attribute sum is 230 for most cases — roughly a mid-level robot — which
 * exercises different rounding than the 115 used above.
 */
const INHERITED_CASES: ParityCase[] = [
  { name: 'total destruction, no discount',      damagePercent: 100, hpPercent: 0,  repairBayLevel: 0,  expectedQuote: 46000, expectedManualCharged: 23000 },
  { name: 'heavy damage (5% HP)',                damagePercent: 95,  hpPercent: 5,  repairBayLevel: 0,  expectedQuote: 32775, expectedManualCharged: 16387 },
  { name: 'normal damage (15% HP)',              damagePercent: 85,  hpPercent: 15, repairBayLevel: 0,  expectedQuote: 19550, expectedManualCharged: 9775 },
  { name: 'light damage (40% HP)',               damagePercent: 60,  hpPercent: 40, repairBayLevel: 0,  expectedQuote: 13800, expectedManualCharged: 6900 },
  { name: 'no damage',                           damagePercent: 0,   hpPercent: 50, repairBayLevel: 0,  expectedQuote: 0,     expectedManualCharged: 0 },
  // 46,000 × 0.70
  { name: 'repair bay level 5',                  damagePercent: 100, hpPercent: 0,  repairBayLevel: 5,  expectedQuote: 32200, expectedManualCharged: 16100 },
  // 46,000 × 0.76
  { name: 'repair bay level 4',                  damagePercent: 100, hpPercent: 0,  repairBayLevel: 4,  expectedQuote: 34960, expectedManualCharged: 17480 },
  // 46,000 × 0.40
  { name: 'repair bay level 10',                 damagePercent: 100, hpPercent: 0,  repairBayLevel: 10, expectedQuote: 18400, expectedManualCharged: 9200 },
  // 23,000 × 0.5 × 1.0 = 11,500; × 0.82
  { name: 'repair bay level 3, 50% damage',      damagePercent: 50,  hpPercent: 25, repairBayLevel: 3,  expectedQuote: 9430,  expectedManualCharged: 4715 },
  // Level 11 earns nothing beyond Level 10: 46,000 × 0.40
  { name: 'maximum at Level 10 (60%)',           damagePercent: 100, hpPercent: 0,  repairBayLevel: 11, expectedQuote: 18400, expectedManualCharged: 9200 },
];

describe('Repair_Cost_Parity_Test — cases inherited from the deleted shared/backend parity test', () => {
  it.each(INHERITED_CASES.map((c) => [c.name, c] as const))(
    'Repair_Quote is unchanged for %s (attribute sum 230)',
    (_name, testCase) => {
      const quote = calculateRepairQuote(
        { attributeTotal: 230, damagePercent: testCase.damagePercent, hpPercent: testCase.hpPercent },
        testCase.repairBayLevel,
      );
      expect(quote).toBe(testCase.expectedQuote);
      expect(applyManualRepairDiscount(quote)).toBe(testCase.expectedManualCharged);
    },
  );

  it('Repair_Quote is unchanged for a fractional attribute sum', () => {
    const quote = calculateRepairQuote(
      { attributeTotal: 230.75, damagePercent: 80, hpPercent: 20 },
      2,
    );
    // 23,075 × 0.8 = 18,460; × 0.88 = 16,244.8 → 16,245
    expect(quote).toBe(16245);
  });

  it('Repair_Quote is unchanged for a large attribute sum', () => {
    const quote = calculateRepairQuote(
      { attributeTotal: 2300, damagePercent: 50, hpPercent: 50 },
      5,
    );
    // 230,000 × 0.5 = 115,000; × 0.70 = 80,500
    expect(quote).toBe(80500);
  });

  it('Repair_Quote is unchanged for a small attribute sum', () => {
    const quote = calculateRepairQuote(
      { attributeTotal: 23, damagePercent: 100, hpPercent: 0 },
      0,
    );
    expect(quote).toBe(4600);
    expect(applyManualRepairDiscount(quote)).toBe(2300);
  });
});

describe('Repair_Cost_Parity_Test — no duplicate Repair Bay formula (#525)', () => {
  const REPO_APP = path.join(__dirname, '../../..');
  const CALLERS = [
    'backend/src/routes/facility.ts',
    'backend/src/services/economy/facilityRecommendationService.ts',
    'backend/src/services/economy/unifiedFacilityROIService.ts',
    'frontend/src/components/YieldThresholdSlider.tsx',
  ];

  it.each(CALLERS)('%s has no "(5 +" robot-count formula and uses the shared helper', (relative) => {
    const source = fs.readFileSync(path.join(REPO_APP, relative), 'utf8');
    expect(source).not.toMatch(/\(5 \+/);
    expect(source).not.toMatch(/activeRobotCount|getRepairBayDiscount/);
    expect(source).toContain('calculateRepairBayDiscountPercent(');
  });
});
