/**
 * `passive_income` audit payload: `totalBattles` was renamed to
 * `winLossModeBattles` (the raw win/loss-mode counter sum). New rows carry the
 * new key; rows written before the rename keep `totalBattles` and must stay
 * readable. No data migration.
 */
import * as fc from 'fast-check';
import {
  PASSIVE_INCOME_WIN_LOSS_BATTLES_KEY,
  readPassiveIncomeWinLossModeBattles,
} from '../passive-income-payload-keys';

describe('readPassiveIncomeWinLossModeBattles', () => {
  it('writes and reads the renamed key', () => {
    expect(PASSIVE_INCOME_WIN_LOSS_BATTLES_KEY).toBe('winLossModeBattles');
    expect(readPassiveIncomeWinLossModeBattles({ merchandising: 100, winLossModeBattles: 42 })).toBe(42);
  });

  it('falls back to the legacy totalBattles key on a pre-rename row', () => {
    expect(readPassiveIncomeWinLossModeBattles({ merchandising: 100, totalBattles: 17 })).toBe(17);
  });

  it('prefers the renamed key and never sums the two', () => {
    fc.assert(
      fc.property(fc.nat(100_000), fc.nat(100_000), (renamed, legacy) => {
        expect(readPassiveIncomeWinLossModeBattles({ winLossModeBattles: renamed, totalBattles: legacy })).toBe(renamed);
      }),
      { numRuns: 100 },
    );
  });

  it('reads 0 as a real value, not as missing', () => {
    expect(readPassiveIncomeWinLossModeBattles({ winLossModeBattles: 0, totalBattles: 9 })).toBe(0);
  });

  it('falls back when the renamed key is present but not a finite number', () => {
    expect(readPassiveIncomeWinLossModeBattles({ winLossModeBattles: 'x', totalBattles: 9 })).toBe(9);
    expect(readPassiveIncomeWinLossModeBattles({ winLossModeBattles: Number.NaN, totalBattles: 9 })).toBe(9);
  });

  it('returns null for a missing payload or a payload with neither key', () => {
    expect(readPassiveIncomeWinLossModeBattles(null)).toBeNull();
    expect(readPassiveIncomeWinLossModeBattles(undefined)).toBeNull();
    expect(readPassiveIncomeWinLossModeBattles({ merchandising: 100 })).toBeNull();
    expect(readPassiveIncomeWinLossModeBattles({ totalBattles: 'oops' })).toBeNull();
  });
});
