/**
 * Spec #55 task 9.6 — Need_Attention classification (R11.11, R11.12,
 * design §17.1a) and the Status_Bar Turn_Step label (§6.2).
 */
import { classifyNeedAttention, NOTHING_BOUGHT_WINDOW, zeroSpendRun } from '../needAttention';
import { turnStepLabel } from '../automatonStatus';

const completed = (creditsSpent: number) => ({ status: 'completed', creditsSpent });

describe('classifyNeedAttention', () => {
  it('returns no reason for a healthy stable', () => {
    expect(classifyNeedAttention({ latestTurn: { status: 'completed', reason: null }, balance: 100, zeroSpendRun: 3 })).toEqual([]);
  });

  it('flags a failed most recent Turn_Record with its error code (approved label)', () => {
    expect(classifyNeedAttention({ latestTurn: { status: 'failed', reason: 'AUTOMATON_WEAPON_UNKNOWN' }, balance: 0, zeroSpendRun: 0 })).toEqual([
      { code: 'last_cycle_failed', errorCode: 'AUTOMATON_WEAPON_UNKNOWN', label: 'Last cycle failed: AUTOMATON_WEAPON_UNKNOWN' },
    ]);
  });

  it('does not flag a skipped or in-progress most recent record', () => {
    expect(classifyNeedAttention({ latestTurn: { status: 'skipped', reason: 'program_off' }, balance: 0, zeroSpendRun: 0 })).toEqual([]);
    expect(classifyNeedAttention({ latestTurn: { status: 'in_progress', reason: null }, balance: 0, zeroSpendRun: 0 })).toEqual([]);
  });

  it('flags a balance below ₡0 but not ₡0 itself', () => {
    expect(classifyNeedAttention({ latestTurn: null, balance: -1, zeroSpendRun: 0 })).toEqual([{ code: 'balance_negative', label: 'Balance negative' }]);
    expect(classifyNeedAttention({ latestTurn: null, balance: 0, zeroSpendRun: 0 })).toEqual([]);
    expect(classifyNeedAttention({ latestTurn: null, balance: null, zeroSpendRun: 0 })).toEqual([]);
  });

  it('flags nothing bought from 14 zero-spend completed records, with the run length', () => {
    expect(classifyNeedAttention({ latestTurn: null, balance: 5, zeroSpendRun: NOTHING_BOUGHT_WINDOW - 1 })).toEqual([]);
    expect(classifyNeedAttention({ latestTurn: null, balance: 5, zeroSpendRun: 14 })).toEqual([
      { code: 'nothing_bought', cycles: 14, label: 'Nothing bought for 14 cycles' },
    ]);
    expect(classifyNeedAttention({ latestTurn: null, balance: 5, zeroSpendRun: 20 })[0]).toMatchObject({ cycles: 20, label: 'Nothing bought for 20 cycles' });
  });

  it('returns every applicable reason in the approved order', () => {
    const reasons = classifyNeedAttention({ latestTurn: { status: 'failed', reason: 'X' }, balance: -50, zeroSpendRun: 15 });
    expect(reasons.map((r) => r.code)).toEqual(['last_cycle_failed', 'balance_negative', 'nothing_bought']);
  });

  it('labels a failure without a stored reason', () => {
    expect(classifyNeedAttention({ latestTurn: { status: 'failed', reason: null }, balance: 1, zeroSpendRun: 0 })[0]).toMatchObject({ errorCode: 'unknown' });
  });
});

describe('zeroSpendRun', () => {
  it('counts completed zero-spend records until the first purchase', () => {
    expect(zeroSpendRun([completed(0), completed(0), completed(500), completed(0)])).toBe(2);
  });

  it('passes over skipped, failed and in-progress records', () => {
    expect(zeroSpendRun([
      completed(0),
      { status: 'skipped', creditsSpent: 0 },
      { status: 'failed', creditsSpent: 0 },
      { status: 'in_progress', creditsSpent: 0 },
      completed(0),
      completed(1),
    ])).toBe(2);
  });

  it('counts every record when nothing was ever bought, and 0 when the latest bought', () => {
    expect(zeroSpendRun(Array.from({ length: 16 }, () => completed(0)))).toBe(16);
    expect(zeroSpendRun([completed(10), completed(0)])).toBe(0);
    expect(zeroSpendRun([])).toBe(0);
  });
});

describe('turnStepLabel (PLAYER_FACING_TEXT §6.2)', () => {
  it('labels settlement, preparation and season-open steps', () => {
    expect(turnStepLabel('settlement', 7)).toBe('Cycle 7');
    expect(turnStepLabel('preparation', 2)).toBe('Prep 2');
    expect(turnStepLabel('season_open', 0)).toBe('Season start');
  });
});
