import { describe, expect, it } from 'vitest';
import { bucketLabel, firedSummary, readSecurityWindow, shortDateTime, writeSecurityWindow } from '../adminSecurityFormat';
import { readImagesView, writeImagesView, bytesText } from '../adminImagesFormat';
import type { SignalSummary } from '@shared/types';

const summary = (signal: SignalSummary['signal'], total: number): SignalSummary => ({ signal, total, perBucket: [total], lastSeenAt: null });

describe('firedSummary', () => {
  it('is quiet when nothing fired', () => {
    expect(firedSummary([summary('failed_login', 0), summary('rate_limit', 0)], '7d')).toEqual({ quiet: true, text: 'No signals in the last 7 days.' });
  });

  it('names one, two or more fired types', () => {
    expect(firedSummary([summary('failed_login', 3), summary('rate_limit', 0)], '24h').text)
      .toBe('1 of 2 signal types fired in the last 24 hours: failed logins (3).');
    expect(firedSummary([summary('failed_login', 1200), summary('rate_limit', 6), summary('nsfw_block', 1)], '30d').text)
      .toBe('3 of 3 signal types fired in the last 30 days: failed logins (1,200), rate-limit hits (6) and nsfw blocks (1).');
  });
});

describe('window URL state', () => {
  it('reads a known window and falls back to 7 days', () => {
    expect(readSecurityWindow(new URLSearchParams('window=30d'))).toBe('30d');
    expect(readSecurityWindow(new URLSearchParams('window=1y'))).toBe('7d');
    expect(readSecurityWindow(new URLSearchParams(''))).toBe('7d');
  });

  it('drops the default from the URL', () => {
    expect(writeSecurityWindow(new URLSearchParams('window=24h&x=1'), '7d').toString()).toBe('x=1');
    expect(writeSecurityWindow(new URLSearchParams(''), '24h').toString()).toBe('window=24h');
  });
});

describe('time labels (UTC)', () => {
  it('labels hours and days', () => {
    expect(bucketLabel('2026-11-01T09:00:00.000Z', 'hour')).toBe('09:00');
    expect(bucketLabel('2026-10-29T00:00:00.000Z', 'day')).toBe('Thu 29');
    expect(shortDateTime('2026-10-29T21:04:00.000Z')).toBe('Thu 29, 21:04');
  });
});

describe('images view state', () => {
  it('round-trips filter, search, page and the open image', () => {
    const params = writeImagesView(new URLSearchParams(''), { filter: 'anyway', q: 'iron', page: 2, image: 5 });
    expect(params.toString()).toBe('filter=anyway&q=iron&page=2&image=5');
    expect(readImagesView(params)).toEqual({ filter: 'anyway', q: 'iron', page: 2, image: 5 });
  });

  it('ignores invalid values', () => {
    expect(readImagesView(new URLSearchParams('filter=nsfw&page=-3&image=abc'))).toEqual({ filter: 'all', q: '', page: 1, image: null });
  });

  it('formats sizes', () => {
    expect(bytesText(512)).toBe('512 B');
    expect(bytesText(38_000)).toBe('37 KB');
    expect(bytesText(3_460_000)).toBe('3.3 MB');
  });
});
