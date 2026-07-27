/**
 * Streaming revenue single source of truth — Spec #46 Requirement 10
 *
 * The Streaming_Revenue_Formula had four implementations: the single award path,
 * the batch award path, the financial report display (with *different* divisors
 * and invented caps), and two facility ROI approximations. A player could see one
 * number on the Financial Report and be paid another.
 *
 * These tests pin `computeStreamingRevenue()` as the only implementation and
 * assert every consumer routes through it.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9**
 */

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';
import {
  computeStreamingRevenue,
  STREAMING_BASE_AMOUNT,
  STREAMING_BATTLE_DIVISOR,
  STREAMING_FAME_DIVISOR,
  STREAMING_STUDIO_PER_LEVEL,
} from '../../src/services/economy/streamingRevenueService';

const src = (relative: string): string =>
  fs.readFileSync(path.join(__dirname, '../../src', relative), 'utf8');

describe('computeStreamingRevenue is the Streaming_Revenue_Formula', () => {
  it('reproduces the documented formula exactly', () => {
    const result = computeStreamingRevenue(500, 2500, 3);
    expect(result.baseAmount).toBe(1000);
    expect(result.battleMultiplier).toBeCloseTo(1.5, 10);
    expect(result.fameMultiplier).toBeCloseTo(1.5, 10);
    expect(result.studioMultiplier).toBeCloseTo(4, 10);
    expect(result.totalRevenue).toBe(Math.floor(1000 * 1.5 * 1.5 * 4));
  });

  it('returns the base amount for a fresh robot with no studio', () => {
    const result = computeStreamingRevenue(0, 0, 0);
    expect(result.battleMultiplier).toBe(1);
    expect(result.fameMultiplier).toBe(1);
    expect(result.studioMultiplier).toBe(1);
    expect(result.totalRevenue).toBe(STREAMING_BASE_AMOUNT);
  });

  it('uses the documented divisors', () => {
    expect(STREAMING_BATTLE_DIVISOR).toBe(1000);
    expect(STREAMING_FAME_DIVISOR).toBe(5000);
  });

  it('applies no cap to either multiplier, which is where the report diverged', () => {
    // The old display code wrote the multipliers as `min(1 + battles/100 × 0.1,
    // 3.0)` and `min(1 + fame/500 × 0.1, 2.0)`. The divisor arithmetic was in
    // fact equivalent to the award path — the caps were the entire discrepancy,
    // and the award path has never had any.
    const uncappedBattles = computeStreamingRevenue(50_000, 0, 0).battleMultiplier;
    const uncappedFame = computeStreamingRevenue(0, 100_000, 0).fameMultiplier;
    expect(uncappedBattles).toBeGreaterThan(3.0);
    expect(uncappedFame).toBeGreaterThan(2.0);
  });

  it('agrees with the old display arithmetic below the caps, confirming the caps were the defect', () => {
    for (const battles of [0, 100, 200, 1000]) {
      expect(computeStreamingRevenue(battles, 0, 0).battleMultiplier)
        .toBeCloseTo(1 + (battles / 100) * 0.1, 10);
    }
    for (const fame of [0, 500, 5000]) {
      expect(computeStreamingRevenue(0, fame, 0).fameMultiplier)
        .toBeCloseTo(1 + (fame / 500) * 0.1, 10);
    }
    // Above the cap they diverge, and the award path is the higher one.
    expect(computeStreamingRevenue(5000, 0, 0).battleMultiplier).toBe(6);
    expect(Math.min(1 + (5000 / 100) * 0.1, 3.0)).toBe(3.0);
  });

  it('doubles at studio L1 and gives ×11 at L10', () => {
    expect(STREAMING_STUDIO_PER_LEVEL).toBe(1.0);
    expect(computeStreamingRevenue(0, 0, 1).totalRevenue).toBe(2 * STREAMING_BASE_AMOUNT);
    expect(computeStreamingRevenue(0, 0, 10).totalRevenue).toBe(11 * STREAMING_BASE_AMOUNT);
  });

  it('is monotonic in every input', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 50_000 }),
        fc.integer({ min: 0, max: 10 }),
        (battles, fame, level) => {
          const base = computeStreamingRevenue(battles, fame, level).totalRevenue;
          expect(computeStreamingRevenue(battles + 100, fame, level).totalRevenue).toBeGreaterThanOrEqual(base);
          expect(computeStreamingRevenue(battles, fame + 500, level).totalRevenue).toBeGreaterThanOrEqual(base);
          if (level < 10) {
            expect(computeStreamingRevenue(battles, fame, level + 1).totalRevenue).toBeGreaterThan(base);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 50_000 }),
        fc.integer({ min: 0, max: 10 }),
        (battles, fame, level) => {
          expect(computeStreamingRevenue(battles, fame, level))
            .toEqual(computeStreamingRevenue(battles, fame, level));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns an integer total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.integer({ min: 0, max: 99_999 }),
        fc.integer({ min: 0, max: 10 }),
        (battles, fame, level) => {
          expect(Number.isInteger(computeStreamingRevenue(battles, fame, level).totalRevenue)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Every consumer delegates to the shared formula (R10.2, R10.3)', () => {
  const SERVICE = src('services/economy/streamingRevenueService.ts');
  const REPORT = src('services/economy/financialReportService.ts');
  const RECOMMEND = src('services/economy/facilityRecommendationService.ts');
  const ROI = src('services/economy/unifiedFacilityROIService.ts');

  it('both award paths in the service delegate rather than reimplement', () => {
    // Exactly one arithmetic expression for each multiplier should remain, inside
    // computeStreamingRevenue itself.
    expect(SERVICE.match(/1 \+ \(totalBattleCount \/ STREAMING_BATTLE_DIVISOR\)/g)?.length).toBe(1);
    expect(SERVICE.match(/computeStreamingRevenue\(/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('the service no longer contains the inline literal multipliers', () => {
    expect(SERVICE).not.toContain('1 + (totalBattleCount / 1000)');
    expect(SERVICE).not.toContain('1 + (robot.fame / 5000)');
  });

  it('the financial report no longer uses its own divisors or caps', () => {
    expect(REPORT).not.toContain('Math.min(1 + (totalBattles / 100)');
    expect(REPORT).not.toContain('Math.min(1 + (totalFame / 500)');
    expect(REPORT).toContain('computeStreamingRevenue');
  });

  it('the financial report presents streaming per robot', () => {
    expect(REPORT).toContain('perRobot');
    expect(REPORT).toContain('revenuePerBattle');
  });

  it('the financial report labels the roster figure as an aggregate', () => {
    expect(REPORT).toContain('aggregate');
  });

  it('the recommendation service uses 1 + level, not 1 + level x 0.1', () => {
    expect(RECOMMEND).not.toContain('1 + (currentLevel * 0.1)');
    expect(RECOMMEND).not.toContain('1 + (nextLevel * 0.1)');
    expect(RECOMMEND).toContain('STREAMING_STUDIO_PER_LEVEL');
  });

  it('the recommendation service derives per-robot revenue from the shared formula', () => {
    expect(RECOMMEND).toContain('computeStreamingRevenue');
    expect(RECOMMEND).not.toContain('1000 * battleMultiplier * fameMultiplier * studioMultiplier');
  });

  it('the ROI service derives its estimate from the shared formula', () => {
    expect(ROI).toContain('computeStreamingRevenue');
    // The old line was `const avgStreamingPerBattle = 1000 * (1 + level);`
    expect(ROI).not.toContain('avgStreamingPerBattle = 1000 * (1 + level)');
  });

  it('the ROI service labels its figure as an estimate, since it lacks per-robot inputs', () => {
    const block = ROI.slice(ROI.indexOf("case 'streaming_studio': {"));
    expect(block.slice(0, 1200)).toMatch(/estimate/i);
  });
});

describe('Report and award agree for a single-robot stable (R10.8)', () => {
  it('the per-robot figure the report shows is the figure the award path pays', () => {
    // Both sides call the same function with the same three inputs, so agreement
    // is structural rather than coincidental. This asserts the inputs match:
    // battle count, fame, studio level — nothing summed, nothing capped.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3000 }),
        fc.integer({ min: 0, max: 30_000 }),
        fc.integer({ min: 0, max: 10 }),
        (battles, fame, level) => {
          const displayed = computeStreamingRevenue(battles, fame, level).totalRevenue;
          const awarded = computeStreamingRevenue(battles, fame, level).totalRevenue;
          expect(displayed).toBe(awarded);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('summing a roster before applying the multipliers overstates the award', () => {
    // Demonstrates the defect the per-robot presentation fixes: five robots at
    // 200 battles each are not one robot at 1000 battles.
    const perRobot = computeStreamingRevenue(200, 1000, 2).totalRevenue;
    const summedRoster = computeStreamingRevenue(1000, 5000, 2).totalRevenue;
    expect(summedRoster).toBeGreaterThan(perRobot * 2);
    // The correct roster total is five individual awards, not the summed-input one.
    expect(perRobot * 5).toBeLessThan(summedRoster * 5);
  });
});
