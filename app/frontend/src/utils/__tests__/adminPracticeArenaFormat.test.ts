import { describe, it, expect } from 'vitest';
import { dayLabel, formatUnavailable, refusedCaption, share, shortDate } from '../adminPracticeArenaFormat';

describe('adminPracticeArenaFormat', () => {
  const now = new Date('2026-11-01T05:00:00Z');

  it('labels UTC days relative to now, across a month boundary', () => {
    expect(dayLabel('2026-11-01', now)).toBe('Today (so far)');
    expect(dayLabel('2026-10-31', now)).toBe('Yesterday');
    expect(dayLabel('2026-10-21', now)).toBe('21 Oct');
    expect(shortDate('2026-08-02')).toBe('2 Aug');
  });

  it('writes unavailable time in whole minutes, and — before run history', () => {
    expect(formatUnavailable(null)).toBe('—');
    expect(formatUnavailable(0)).toBe('0m');
    expect(formatUnavailable(30_000)).toBe('<1m');
    expect(formatUnavailable(48 * 60_000 + 12_000)).toBe('48m');
    expect(formatUnavailable(104 * 60_000)).toBe('1h 44m');
  });

  it('rounds shares and never divides by zero', () => {
    expect(share(72, 100)).toBe('72%');
    expect(share(1, 3)).toBe('33%');
    expect(share(0, 0)).toBe('0%');
  });

  it('splits refusals by reason', () => {
    expect(refusedCaption({ rateLimited: 2, cycleBusy: 5 })).toBe('2 rate limit · 5 during a job');
  });
});
