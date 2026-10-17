/**
 * Recorded facility returns (#524): the Streaming Studio's historical return is
 * the studio-attributable share of each recorded award, read from the row's own
 * stored studioMultiplier — never the current level or formula.
 *
 * Repair Bay (#525): the historical saving is computed from each recorded
 * robot_repair row's charged credits and its own recorded discountPercent.
 */
import {
  sumRepairBaySavingsFromRecords,
  sumStudioAttributableStreaming,
} from '../../../src/services/economy/recorded-facility-returns';

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
