import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  eventLabel,
  formatPercentOf,
  humanizeKey,
  refinementKindEffect,
  refinementKindLabel,
  summarizeYield,
  toShares,
} from '../adminMetaFormat';

describe('humanizeKey', () => {
  it('turns snake_case keys into sentence case', () => {
    expect(humanizeKey('weapon_shield')).toBe('Weapon shield');
    expect(humanizeKey('balanced')).toBe('Balanced');
    expect(humanizeKey('ai_training_academy')).toBe('AI training academy');
    expect(humanizeKey('repair_bay')).toBe('Repair bay');
  });
});

describe('toShares', () => {
  it('computes shares of the total, largest first, label order on ties', () => {
    expect(toShares([
      { label: 'B', value: 25 },
      { label: 'A', value: 25 },
      { label: 'C', value: 50 },
    ])).toEqual([
      { label: 'C', value: 50, share: 50 },
      { label: 'A', value: 25, share: 25 },
      { label: 'B', value: 25, share: 25 },
    ]);
  });

  it('gives zero shares for an empty total', () => {
    expect(toShares([{ label: 'A', value: 0 }])).toEqual([{ label: 'A', value: 0, share: 0 }]);
    expect(toShares([])).toEqual([]);
  });

  it('shares always add up to 100 when anything is counted', () => {
    fc.assert(fc.property(fc.array(fc.nat({ max: 10_000 }), { minLength: 1, maxLength: 8 }), (values) => {
      fc.pre(values.some((value) => value > 0));
      const shares = toShares(values.map((value, index) => ({ label: `L${index}`, value })));
      expect(shares.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(100, 6);
    }));
  });
});

describe('summarizeYield', () => {
  it('finds the most common value, the median and the tail above 20%', () => {
    const summary = summarizeYield([
      { threshold: 30, count: 20 },
      { threshold: 0, count: 10 },
      { threshold: 10, count: 50 },
      { threshold: 15, count: 20 },
      { threshold: 5, count: 0 },
    ]);

    expect(summary.total).toBe(100);
    expect(summary.bars.map((bar) => bar.threshold)).toEqual([0, 10, 15, 30]);
    expect(summary.mostCommon).toEqual({ threshold: 10, count: 50, share: 50 });
    expect(summary.median).toBe(10);
    expect(summary.above20).toEqual({ count: 20, share: 20 });
  });

  it('breaks a most-common tie towards the lower threshold and handles no robots', () => {
    expect(summarizeYield([{ threshold: 20, count: 5 }, { threshold: 10, count: 5 }]).mostCommon?.threshold).toBe(10);
    expect(summarizeYield([])).toEqual({ total: 0, bars: [], mostCommon: null, median: null, above20: { count: 0, share: 0 } });
  });

  it('the median splits the robots: at least half are at or below it, and at least half at or above it', () => {
    const entry = fc.record({ threshold: fc.integer({ min: 0, max: 50 }), count: fc.integer({ min: 1, max: 500 }) });
    fc.assert(fc.property(fc.uniqueArray(entry, { minLength: 1, maxLength: 30, selector: (e) => e.threshold }), (distribution) => {
      const summary = summarizeYield(distribution);
      const median = summary.median ?? -1;
      const atOrBelow = distribution.filter((e) => e.threshold <= median).reduce((sum, e) => sum + e.count, 0);
      const atOrAbove = distribution.filter((e) => e.threshold >= median).reduce((sum, e) => sum + e.count, 0);
      expect(atOrBelow * 2).toBeGreaterThanOrEqual(summary.total);
      expect(atOrAbove * 2).toBeGreaterThanOrEqual(summary.total);
    }));
  });
});

describe('build section labels', () => {
  it('formats a whole-number share of a total, zero-safe', () => {
    expect(formatPercentOf(168, 171)).toBe('98%');
    expect(formatPercentOf(3670, 3670)).toBe('100%');
    expect(formatPercentOf(5, 0)).toBe('0%');
  });

  it('labels refinement kinds with their effect from the shared constants', () => {
    expect(refinementKindLabel('sharpen')).toBe('Sharpen');
    expect(refinementKindEffect('sharpen')).toBe('−10% cooldown');
    expect(refinementKindEffect('forge')).toBe('+8% base damage');
    expect(refinementKindEffect('hone')).toBe('+1–5 to an attribute the weapon has');
  });

  it('labels events with the approved names and humanizes unknown ones', () => {
    expect(eventLabel('koth')).toBe('King of the Hill');
    expect(eventLabel('tournament_2v2')).toBe('2v2 Tournament');
    expect(eventLabel('future_mode')).toBe('Future mode');
  });
});
