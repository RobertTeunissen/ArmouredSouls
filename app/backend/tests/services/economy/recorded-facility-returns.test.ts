/**
 * Recorded facility returns (#524): the Streaming Studio's historical return is
 * the studio-attributable share of each recorded award, read from the row's own
 * stored studioMultiplier — never the current level or formula.
 *
 * Repair Bay (#525): the historical saving is computed from each recorded
 * robot_repair row's charged credits and its own recorded discountPercent.
 *
 * #542: production sums in the database per stored key and applies the
 * grouped helpers; the properties below assert grouped === per-row.
 */
import fc from 'fast-check';
import {
  sumRepairBaySavingsFromGroups,
  sumRepairBaySavingsFromRecords,
  sumStudioAttributableStreaming,
  sumStudioAttributableStreamingFromGroups,
  type RecordedStreamingRow,
  type RepairChargedGroup,
  type StudioStreamingGroup,
} from '../../../src/services/economy/recorded-facility-returns';
import { readRepairChargedCredits } from '../../../src/services/economy/repairPayloadKeys';

describe('sumStudioAttributableStreaming', () => {
  it('attributes half of a v1 award at studio ×2 to the studio (2,000 → 1,000)', () => {
    const rows = [{ amount: 2000, metadata: { formulaVersion: '1', studioMultiplier: 2 } }];
    expect(sumStudioAttributableStreaming(rows)).toBe(1000);
  });

  it('attributes three quarters of a v2 award at studio ×4 to the studio (4,000 → 3,000)', () => {
    const rows = [{ amount: 4000, metadata: { formulaVersion: '2', studioMultiplier: 4 } }];
    expect(sumStudioAttributableStreaming(rows)).toBe(3000);
  });

  it('sums per row with each row\'s own multiplier', () => {
    const rows = [
      { amount: 2000, metadata: { formulaVersion: '1', studioMultiplier: 2 } },
      { amount: 4000, metadata: { formulaVersion: '2', studioMultiplier: 4 } },
      { amount: 1000, metadata: { formulaVersion: '2', studioMultiplier: 1 } },
    ];
    // 1,000 + 3,000 + 0
    expect(sumStudioAttributableStreaming(rows)).toBe(4000);
  });

  it('skips rows with missing or malformed metadata', () => {
    const rows = [
      { amount: 2000, metadata: { formulaVersion: '1', studioMultiplier: 2 } },
      { amount: 5000, metadata: null },
      { amount: 5000, metadata: 'not-an-object' },
      { amount: 5000, metadata: [] },
      { amount: 5000, metadata: { studioMultiplier: '2' } },
      { amount: 5000, metadata: { studioMultiplier: 0.5 } },
      { amount: 5000, metadata: { studioMultiplier: Number.NaN } },
      { amount: 5000, metadata: {} },
    ];
    expect(sumStudioAttributableStreaming(rows)).toBe(1000);
  });

  it('returns 0 for no rows', () => {
    expect(sumStudioAttributableStreaming([])).toBe(0);
  });

  it('rounds once at the end, not per row', () => {
    // Each row: 1,000 × (1 − 1/1.5) = 333.33…; three rows → 1,000 (per-row rounding would give 999).
    const row = { amount: 1000, metadata: { studioMultiplier: 1.5 } };
    expect(sumStudioAttributableStreaming([row, row, row])).toBe(1000);
  });
});

describe('sumRepairBaySavingsFromRecords', () => {
  it('saves 3,600 on an automatic repair charged 6,400 at a recorded 36% discount', () => {
    // 6,400 × 36 / 64 = 3,600 (pre-discount 10,000)
    const payloads = [{ creditsCharged: 6400, discountPercent: 36, repairType: 'automatic' }];
    expect(sumRepairBaySavingsFromRecords(payloads)).toBe(3600);
  });

  it('saves 1,800 on a manual repair charged 3,200 at a recorded 36% discount', () => {
    // 3,200 × 36 / 64 = 1,800
    const payloads = [{ creditsCharged: 3200, discountPercent: 36, repairType: 'manual', manualRepairDiscount: 50 }];
    expect(sumRepairBaySavingsFromRecords(payloads)).toBe(1800);
  });

  it('reads the legacy `cost` key when `creditsCharged` is absent', () => {
    const payloads = [{ cost: 6400, discountPercent: 36 }];
    expect(sumRepairBaySavingsFromRecords(payloads)).toBe(3600);
  });

  it('saves nothing on a row recorded with no discount', () => {
    expect(sumRepairBaySavingsFromRecords([{ creditsCharged: 6400, discountPercent: 0 }])).toBe(0);
  });

  it('uses each row\'s own recorded discount, not one shared figure', () => {
    const payloads = [
      { creditsCharged: 6400, discountPercent: 36 }, // 3,600
      { creditsCharged: 5200, discountPercent: 48 }, // 5,200 × 48 / 52 = 4,800
      { creditsCharged: 1000, discountPercent: 90 }, // legacy row at the old cap: 9,000
    ];
    expect(sumRepairBaySavingsFromRecords(payloads)).toBe(17400);
  });

  it('skips rows with a missing or invalid charge or discount', () => {
    const payloads = [
      { creditsCharged: 6400, discountPercent: 36 },
      null,
      'not-an-object',
      [],
      { creditsCharged: 6400 },
      { discountPercent: 36 },
      { creditsCharged: 6400, discountPercent: '36' },
      { creditsCharged: 6400, discountPercent: Number.NaN },
      { creditsCharged: 6400, discountPercent: -1 },
      { creditsCharged: 6400, discountPercent: 100 },
      { creditsCharged: Number.POSITIVE_INFINITY, discountPercent: 36 },
    ];
    expect(sumRepairBaySavingsFromRecords(payloads)).toBe(3600);
  });

  it('returns 0 for no rows', () => {
    expect(sumRepairBaySavingsFromRecords([])).toBe(0);
  });
});

describe('sumStudioAttributableStreamingFromGroups', () => {
  it('applies each group\'s multiplier to its summed amount', () => {
    const groups: StudioStreamingGroup[] = [
      { studioMultiplier: 2, amountSum: 6000 }, // 3,000
      { studioMultiplier: 4, amountSum: 4000 }, // 3,000
      { studioMultiplier: 1, amountSum: 1000 }, // 0
    ];
    expect(sumStudioAttributableStreamingFromGroups(groups)).toBe(6000);
  });

  it('skips groups whose stored multiplier the per-row helper would skip', () => {
    const groups: StudioStreamingGroup[] = [
      { studioMultiplier: 2, amountSum: 2000 },
      { studioMultiplier: 0.5, amountSum: 5000 },
      { studioMultiplier: '2', amountSum: 5000 },
      { studioMultiplier: null, amountSum: 5000 },
      { studioMultiplier: Number.NaN, amountSum: 5000 },
      { studioMultiplier: 2, amountSum: Number.NaN },
    ];
    expect(sumStudioAttributableStreamingFromGroups(groups)).toBe(1000);
  });

  it('returns 0 for no groups', () => {
    expect(sumStudioAttributableStreamingFromGroups([])).toBe(0);
  });

  it('rounds once at the end', () => {
    // 1,000 × (1 − 1/1.5) + 1,000 × (1 − 1/3) = 333.33… + 666.66… = 1,000
    const groups: StudioStreamingGroup[] = [
      { studioMultiplier: 1.5, amountSum: 1000 },
      { studioMultiplier: 3, amountSum: 1000 },
    ];
    expect(sumStudioAttributableStreamingFromGroups(groups)).toBe(1000);
  });
});

describe('sumRepairBaySavingsFromGroups', () => {
  it('applies each group\'s discount to its summed charge', () => {
    const groups: RepairChargedGroup[] = [
      { discountPercent: 36, chargedSum: 6400 }, // 3,600
      { discountPercent: 48, chargedSum: 5200 }, // 4,800
      { discountPercent: 90, chargedSum: 1000 }, // 9,000
      { discountPercent: 0, chargedSum: 9999 }, // 0
    ];
    expect(sumRepairBaySavingsFromGroups(groups)).toBe(17400);
  });

  it('skips groups whose discount or charged sum is invalid', () => {
    const groups: RepairChargedGroup[] = [
      { discountPercent: 36, chargedSum: 6400 },
      { discountPercent: 100, chargedSum: 6400 },
      { discountPercent: -1, chargedSum: 6400 },
      { discountPercent: '36', chargedSum: 6400 },
      { discountPercent: Number.NaN, chargedSum: 6400 },
      { discountPercent: 36, chargedSum: Number.POSITIVE_INFINITY },
    ];
    expect(sumRepairBaySavingsFromGroups(groups)).toBe(3600);
  });

  it('returns 0 for no groups', () => {
    expect(sumRepairBaySavingsFromGroups([])).toBe(0);
  });

  it('rounds once at the end', () => {
    // 100 × 6 / 94 = 6.38…; 100 × 12 / 88 = 13.63…; total 20.02 → 20
    const groups: RepairChargedGroup[] = [
      { discountPercent: 6, chargedSum: 100 },
      { discountPercent: 12, chargedSum: 100 },
    ];
    expect(sumRepairBaySavingsFromGroups(groups)).toBe(20);
  });
});

/**
 * Group rows exactly the way the SQL does: JSON-number keys only, equal keys
 * together, amount summed per key. Validation is left to the helper.
 */
function groupStreamingLikeSql(rows: ReadonlyArray<RecordedStreamingRow>): StudioStreamingGroup[] {
  const sums = new Map<number, number>();
  for (const row of rows) {
    const metadata = row.metadata;
    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) continue;
    const key = (metadata as Record<string, unknown>).studioMultiplier;
    if (typeof key !== 'number') continue;
    sums.set(key, (sums.get(key) ?? 0) + row.amount);
  }
  return [...sums].map(([studioMultiplier, amountSum]) => ({ studioMultiplier, amountSum }));
}

function groupRepairsLikeSql(payloads: ReadonlyArray<unknown>): RepairChargedGroup[] {
  const sums = new Map<number, number>();
  for (const payload of payloads) {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) continue;
    const record = payload as Record<string, unknown>;
    const key = record.discountPercent;
    const charged = readRepairChargedCredits(record);
    if (typeof key !== 'number' || charged === null) continue;
    sums.set(key, (sums.get(key) ?? 0) + charged);
  }
  return [...sums].map(([discountPercent, chargedSum]) => ({ discountPercent, chargedSum }));
}

const studioMultiplierArb = fc.oneof(
  { weight: 8, arbitrary: fc.integer({ min: 0, max: 10 }).map((level) => 1 + level * 0.5) },
  { weight: 1, arbitrary: fc.constantFrom<unknown>(0.5, '2', null, undefined) },
);

const streamingRowArb: fc.Arbitrary<RecordedStreamingRow> = fc.oneof(
  {
    weight: 8,
    arbitrary: fc.record({
      amount: fc.integer({ min: 0, max: 100_000 }),
      metadata: fc.record({
        formulaVersion: fc.constantFrom('1', '2'),
        studioMultiplier: studioMultiplierArb,
      }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      amount: fc.integer({ min: 0, max: 100_000 }),
      metadata: fc.constantFrom<unknown>(null, [], 'not-an-object', {}),
    }),
  },
);

const discountArb = fc.oneof(
  { weight: 8, arbitrary: fc.constantFrom<unknown>(0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 90) },
  { weight: 1, arbitrary: fc.constantFrom<unknown>(-1, 100, '36', null) },
);

const chargeAmountArb = fc.integer({ min: 0, max: 100_000 });

const repairPayloadArb: fc.Arbitrary<unknown> = fc.oneof(
  { weight: 4, arbitrary: fc.record({ creditsCharged: chargeAmountArb, discountPercent: discountArb }) },
  { weight: 2, arbitrary: fc.record({ cost: chargeAmountArb, discountPercent: discountArb }) },
  {
    weight: 2,
    arbitrary: fc.record({ creditsCharged: chargeAmountArb, cost: chargeAmountArb, discountPercent: discountArb }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ creditsCharged: fc.constant('500'), cost: chargeAmountArb, discountPercent: discountArb }),
  },
  { weight: 1, arbitrary: fc.record({ discountPercent: discountArb }) },
  { weight: 1, arbitrary: fc.constantFrom<unknown>(null, [], 'not-an-object') },
);

describe('grouped helpers equal the per-row reference (#542)', () => {
  it('Streaming Studio: grouping by stored multiplier gives the per-row total', () => {
    fc.assert(
      fc.property(fc.array(streamingRowArb, { maxLength: 200 }), (rows) => {
        expect(sumStudioAttributableStreamingFromGroups(groupStreamingLikeSql(rows))).toBe(
          sumStudioAttributableStreaming(rows),
        );
      }),
      { numRuns: 300 },
    );
  });

  it('Repair Bay: grouping by stored discount gives the per-row total', () => {
    fc.assert(
      fc.property(fc.array(repairPayloadArb, { maxLength: 200 }), (payloads) => {
        expect(sumRepairBaySavingsFromGroups(groupRepairsLikeSql(payloads))).toBe(
          sumRepairBaySavingsFromRecords(payloads),
        );
      }),
      { numRuns: 300 },
    );
  });
});
