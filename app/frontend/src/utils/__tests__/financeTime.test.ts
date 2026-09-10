import { describe, expect, it } from 'vitest';
import { formatFinanceInstant, formatFinancePeriod } from '../financeTime';

describe('financeTime', () => {
  it('formats absolute instants with the selected browser timezone across DST', () => {
    const before = formatFinanceInstant('2026-03-29T00:30:00.000Z', { locale: 'en-GB', timeZone: 'Europe/Amsterdam' });
    const after = formatFinanceInstant('2026-03-29T01:30:00.000Z', { locale: 'en-GB', timeZone: 'Europe/Amsterdam' });
    expect(before).toContain('01:30');
    expect(after).toContain('03:30');
  });

  it('formats ranges without a redundant local-time label', () => {
    const formatted = formatFinancePeriod('2026-03-29T00:00:00.000Z', '2026-03-30T00:00:00.000Z', { locale: 'en-GB', timeZone: 'UTC' });
    expect(formatted).toContain('29 Mar 2026');
    expect(formatted).not.toContain('Your local time');
  });

  it('renders a safe unavailable state for malformed instants', () => {
    expect(formatFinanceInstant('not-an-instant')).toBe('Time unavailable');
  });
});
