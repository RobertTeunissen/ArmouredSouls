/**
 * Merchandising roster concentration — Spec #46 Requirement 2
 *
 * The Merchandising Hub was intended to scale with prestige while the Streaming
 * Studio scaled with fame, on the assumption those were independent axes. They
 * were not: `prestige` is a stable-level counter and every orchestrator calls
 * `awardPrestigeToUser()` once per winning robot, so raw prestige grows with
 * roster size. Both facilities therefore rewarded breadth, and the game had no
 * depth facility.
 *
 * Dividing prestige by Roster_Capacity fixes the axis. Raising the base rate or
 * cutting the purchase cost could not: the ratio between a narrow and a wide
 * stable's income is `(1 + P_wide/10000) / (1 + P_narrow/10000)`, which is
 * invariant to both, so a uniform buff widens the absolute gap in the wide
 * stable's favour.
 *
 * **Validates: Requirements 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.13, 2.18, 2.19, 2.20**
 */

import * as fc from 'fast-check';
import {
  calculateMerchandisingIncome,
  getMerchandisingBaseRate,
  getRosterCapacity,
  calculateFacilityOperatingCost,
} from '../../src/utils/economyFormulas';
import { getFacilityConfig } from '../../src/config/facilities';

/** The pre-change formula, kept here to prove the doubling claim precisely. */
function legacyMerchandisingIncome(level: number, prestige: number): number {
  if (level === 0) return 0;
  const legacyBase = 5000 * level;
  return Math.round(legacyBase * (1 + prestige / 10000));
}

describe('getRosterCapacity (Spec #46 R2.3, R2.4)', () => {
  it('is facility level plus one', () => {
    expect(getRosterCapacity(0)).toBe(1);
    expect(getRosterCapacity(1)).toBe(2);
    expect(getRosterCapacity(9)).toBe(10);
  });

  it('treats a missing or level-0 facility as one slot', () => {
    expect(getRosterCapacity(0)).toBe(1);
  });

  it('never returns less than one, so the divisor cannot be zero', () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 50 }), (level) => {
        expect(getRosterCapacity(level)).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });

  it('matches the roster limit rule used when creating robots', () => {
    // robotCreationService.ts: maxRobots = rosterLevel + 1
    for (let level = 0; level <= 9; level++) {
      expect(getRosterCapacity(level)).toBe(level + 1);
    }
  });
});

describe('Property 1: Merchandising income is monotonic in roster size', () => {
  /**
   * **Validates: Requirements 2.7, 2.18**
   */
  it('is non-increasing as Roster_Capacity rises at fixed prestige and level', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 200_000 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (level, prestige, capA, capB) => {
          const [small, large] = capA <= capB ? [capA, capB] : [capB, capA];
          const incomeSmall = calculateMerchandisingIncome(level, prestige, small);
          const incomeLarge = calculateMerchandisingIncome(level, prestige, large);
          expect(incomeSmall).toBeGreaterThanOrEqual(incomeLarge);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('gives the lower-capacity stable at least as much at equal prestige and level', () => {
    // The concrete case from the requirement: two stables, same prestige and level
    const prestige = 20_000;
    const level = 5;
    expect(calculateMerchandisingIncome(level, prestige, 1))
      .toBeGreaterThan(calculateMerchandisingIncome(level, prestige, 5));
  });

  it('neutralises the wide stable advantage when prestige scales with roster', () => {
    // A 5-robot stable accruing 5× the prestige lands on the same multiplier as
    // a 1-robot stable — the free ride is gone, not inverted into a penalty.
    for (let level = 1; level <= 10; level++) {
      expect(calculateMerchandisingIncome(level, 50_000, 5))
        .toBe(calculateMerchandisingIncome(level, 10_000, 1));
    }
  });
});

describe('Property 2: Merchandising income doubles at capacity 1', () => {
  /**
   * **Validates: Requirements 2.5, 2.6, 2.20**
   */
  it('is exactly twice the pre-change value for a single-robot stable', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 200_000 }),
        (level, prestige) => {
          const legacy = legacyMerchandisingIncome(level, prestige);
          const current = calculateMerchandisingIncome(level, prestige, 1);
          // Both round independently, so allow a 1-credit rounding difference
          expect(Math.abs(current - legacy * 2)).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('doubles the base rate table', () => {
    expect(getMerchandisingBaseRate(1)).toBe(10_000);
    expect(getMerchandisingBaseRate(5)).toBe(50_000);
    expect(getMerchandisingBaseRate(10)).toBe(100_000);
    expect(getMerchandisingBaseRate(0)).toBe(0);
    expect(getMerchandisingBaseRate(11)).toBe(0);
  });

  it('returns zero at level 0 regardless of prestige or capacity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 1, max: 10 }),
        (prestige, capacity) => {
          expect(calculateMerchandisingIncome(0, prestige, capacity)).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Payback fits inside a 100-cycle season (Spec #46 R2.13, R2.19)', () => {
  const config = getFacilityConfig('merchandising_hub')!;

  /** Cumulative purchase cost to reach `level` from unowned. */
  function cumulativeCost(level: number): number {
    let total = 0;
    for (let i = 0; i < level; i++) total += config.costs[i];
    return total;
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'level %i pays back in under 100 cycles at zero prestige per slot',
    (level) => {
      const dailyIncome = calculateMerchandisingIncome(level, 0, 1);
      const dailyOpex = calculateFacilityOperatingCost('merchandising_hub', level);
      const netDaily = dailyIncome - dailyOpex;

      expect(netDaily).toBeGreaterThan(0);

      const paybackCycles = cumulativeCost(level) / netDaily;
      expect(paybackCycles).toBeLessThan(100);
    },
  );

  it('worst case is level 10 at roughly 84 cycles', () => {
    const netDaily =
      calculateMerchandisingIncome(10, 0, 1) - calculateFacilityOperatingCost('merchandising_hub', 10);
    const paybackCycles = cumulativeCost(10) / netDaily;

    expect(paybackCycles).toBeGreaterThan(80);
    expect(paybackCycles).toBeLessThan(90);
  });

  it('best case is level 1 at roughly 15 cycles', () => {
    const netDaily =
      calculateMerchandisingIncome(1, 0, 1) - calculateFacilityOperatingCost('merchandising_hub', 1);
    const paybackCycles = cumulativeCost(1) / netDaily;

    expect(paybackCycles).toBeGreaterThan(14);
    expect(paybackCycles).toBeLessThan(17);
  });

  it('would have exceeded 100 cycles under the pre-change base rate', () => {
    // Guards the reason for the doubling: at ₡5,000/level, level 10 could never
    // be recovered inside a season.
    const legacyNet = legacyMerchandisingIncome(10, 0) - calculateFacilityOperatingCost('merchandising_hub', 10);
    expect(cumulativeCost(10) / legacyNet).toBeGreaterThan(100);
  });
});

describe('Prestige gates use unified curve (post Spec #46 unification)', () => {
  const config = getFacilityConfig('merchandising_hub')!;

  it('uses the unified PRESTIGE_GATES_10 thresholds', () => {
    expect(config.prestigeRequirements).toEqual([0, 0, 0, 1000, 3000, 5000, 10000, 15000, 25000, 50000]);
  });

  it('no facility uses prestigeGateIsPerSlot (deprecated)', () => {
    const flagged = ['merchandising_hub', 'streaming_studio', 'repair_bay', 'booking_office', 'tuning_bay']
      .map((t) => [t, getFacilityConfig(t)?.prestigeGateIsPerSlot ?? false] as const)
      .filter(([, isPerSlot]) => isPerSlot)
      .map(([type]) => type);

    expect(flagged).toEqual([]);
  });
});
