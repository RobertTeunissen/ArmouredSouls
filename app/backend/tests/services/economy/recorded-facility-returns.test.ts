/**
 * Recorded facility returns (#524): the Streaming Studio's historical return is
 * the studio-attributable share of each recorded award, read from the row's own
 * stored studioMultiplier — never the current level or formula.
 */
import { sumStudioAttributableStreaming } from '../../../src/services/economy/recorded-facility-returns';

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
