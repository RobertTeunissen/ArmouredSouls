import { describe, expect, it } from 'vitest';
import { formatActionDate, formatActionTime, readActionsView, summaryRows, writeActionsView } from '../adminActionsFormat';

describe('adminActionsFormat', () => {
  it('reads and writes the URL state, leaving defaults out', () => {
    expect(readActionsView(new URLSearchParams(''))).toEqual({ area: null, result: 'all', page: 1 });
    expect(readActionsView(new URLSearchParams('area=season&result=failure&page=3'))).toEqual({ area: 'season', result: 'failure', page: 3 });
    expect(readActionsView(new URLSearchParams('area=bogus&result=x&page=-2'))).toEqual({ area: null, result: 'all', page: 1 });
    const written = writeActionsView(new URLSearchParams('area=season&page=4&keep=1'), { area: null, result: 'all', page: 1 });
    expect(written.toString()).toBe('keep=1');
  });

  it('formats times in UTC, with the year only outside the current one', () => {
    const now = new Date('2026-11-01T00:00:00Z');
    expect(formatActionTime('2026-10-27T21:16:40Z', now)).toBe('27 Oct 21:16');
    expect(formatActionTime('2025-12-31T23:05:00Z', now)).toBe('31 Dec 2025 23:05');
    expect(formatActionDate('2026-05-16T09:00:00Z')).toBe('16 May 2026');
  });

  it('flattens the stored summary into label/value lines', () => {
    expect(summaryRows({ seasonNumber: 0, durations: { totalMs: 2289 }, activated: ['a', 'b'], background: true, error: null })).toEqual([
      { label: 'seasonNumber', value: '0' },
      { label: 'durations', value: 'totalMs 2,289' },
      { label: 'activated', value: 'a, b' },
      { label: 'background', value: 'yes' },
      { label: 'error', value: '—' },
    ]);
    expect(summaryRows(null)).toEqual([]);
    expect(summaryRows('note')).toEqual([{ label: 'summary', value: 'note' }]);
  });
});
