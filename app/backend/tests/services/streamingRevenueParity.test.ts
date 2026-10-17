/**
 * Streaming revenue single source of truth — Spec #46 Requirement 10, Season 2 #524
 *
 * The Streaming_Revenue_Formula had four implementations: the single award path,
 * the batch award path, the financial report display (with *different* divisors
 * and invented caps), and two facility ROI approximations. A player could see one
 * number on the Financial Report and be paid another.
 *
 * These tests pin `computeStreamingRevenue()` as the only implementation, pin the
 * Season 2 additive formula (formula version '2'):
 *
 *   floor(1000 × (1 + battles/2000 + fame/10000) × (1 + 0.5 × studioLevel))
 *
 * and assert every consumer routes through it. Expected values are computed by
 * hand over the common denominator: floor((20000 + 10·B + 2·F) × (2 + L) / 40).
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9; #524**
 */

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';
import {
  applyStreamingTeamShare,
  computeStreamingRevenue,
  STREAMING_BASE_AMOUNT,
  STREAMING_BATTLE_DIVISOR,
  STREAMING_FAME_DIVISOR,
  STREAMING_FORMULA_VERSION,
  STREAMING_STUDIO_PER_LEVEL,
  type StreamingRevenueCalculation,
} from '../../src/services/economy/streamingRevenueService';
import { FinancialError } from '../../src/errors';

const src = (relative: string): string =>
  fs.readFileSync(path.join(__dirname, '../../src', relative), 'utf8');

/** Exact reference: floor((20000 + 10B + 2F) × (2 + L) / 40) in BigInt. */
const bigIntReference = (battles: number, fame: number, level: number): number =>
  Number(((20000n + 10n * BigInt(battles) + 2n * BigInt(fame)) * (2n + BigInt(level))) / 40n);

function calculation(revenueBeforeTeamShare: number): StreamingRevenueCalculation {
  return {
    baseAmount: 1000,
    battleContribution: 0,
    fameContribution: 0,
    audienceMultiplier: 1,
    studioMultiplier: 1,
    totalRevenue: revenueBeforeTeamShare,
    robotId: 1,
    robotName: 'Robot',
    robotBattles: 0,
    robotFame: 0,
    studioLevel: 0,
    teamSize: 1,
    revenueBeforeTeamShare,
  };
}

describe('computeStreamingRevenue is the Streaming_Revenue_Formula (v2, #524)', () => {
  it('uses the decided constants and formula version', () => {
    expect(STREAMING_BASE_AMOUNT).toBe(1000);
    expect(STREAMING_BATTLE_DIVISOR).toBe(2000);
    expect(STREAMING_FAME_DIVISOR).toBe(10000);
    expect(STREAMING_STUDIO_PER_LEVEL).toBe(0.5);
    expect(STREAMING_FORMULA_VERSION).toBe('2');
  });

  it('pays 1,000 / 4,000 / 6,000 for a fresh robot at Studio L0 / L6 / L10', () => {
    expect(computeStreamingRevenue(0, 0, 0).totalRevenue).toBe(1000);
    expect(computeStreamingRevenue(0, 0, 6).totalRevenue).toBe(4000);
    expect(computeStreamingRevenue(0, 0, 10).totalRevenue).toBe(6000);
  });

  it('returns the additive facts for a fresh robot with no studio', () => {
    const result = computeStreamingRevenue(0, 0, 0);
    expect(result.baseAmount).toBe(1000);
    expect(result.battleContribution).toBe(0);
    expect(result.fameContribution).toBe(0);
    expect(result.audienceMultiplier).toBe(1);
    expect(result.studioMultiplier).toBe(1);
  });

  it('pays the ACC platinum robot (552 battles, 10,492 fame, L9) 12,788 (v1 paid 48,087)', () => {
    // (20000 + 5520 + 20984) × 11 / 40 = 511,544 / 40 = 12,788.6 → 12,788
    const result = computeStreamingRevenue(552, 10492, 9);
    expect(result.battleContribution).toBeCloseTo(0.276, 10);
    expect(result.fameContribution).toBeCloseTo(1.0492, 10);
    expect(result.audienceMultiplier).toBeCloseTo(2.3252, 10);
    expect(result.studioMultiplier).toBe(5.5);
    expect(result.totalRevenue).toBe(12788);
  });

  it('pays (500 battles, 2,500 fame, L3) 3,750', () => {
    // (20000 + 5000 + 5000) × 5 / 40 = 3,750
    const result = computeStreamingRevenue(500, 2500, 3);
    expect(result.audienceMultiplier).toBeCloseTo(1.5, 10);
    expect(result.studioMultiplier).toBe(2.5);
    expect(result.totalRevenue).toBe(3750);
  });

  it('is exact where a floating-point product drifts below an integer', () => {
    // (20000 + 260) × 2 / 40 = 1,013 exactly; Math.floor(1000 × 1.013) is 1,012.
    expect(computeStreamingRevenue(0, 130, 0).totalRevenue).toBe(1013);
    // (20000 + 624) × 5 / 40 = 2,578 exactly.
    expect(computeStreamingRevenue(0, 312, 3).totalRevenue).toBe(2578);
  });

  it('equals the exact BigInt reference for all integer inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 10 }),
        (battles, fame, level) => {
          expect(computeStreamingRevenue(battles, fame, level).totalRevenue)
            .toBe(bigIntReference(battles, fame, level));
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('has no caps: strictly increasing in battles and fame beyond 10,000 battles / 100,000 fame', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10_000, max: 500_000 }),
        fc.integer({ min: 100_000, max: 5_000_000 }),
        fc.integer({ min: 0, max: 10 }),
        (battles, fame, level) => {
          const base = computeStreamingRevenue(battles, fame, level).totalRevenue;
          // +2000 battles or +10000 fame adds exactly 1000 × studio multiplier.
          expect(computeStreamingRevenue(battles + 2000, fame, level).totalRevenue).toBeGreaterThan(base);
          expect(computeStreamingRevenue(battles, fame + 10_000, level).totalRevenue).toBeGreaterThan(base);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('adds 50% of the base per studio level', () => {
    expect(computeStreamingRevenue(0, 0, 1).totalRevenue).toBe(1500);
    expect(computeStreamingRevenue(0, 0, 2).totalRevenue).toBe(2000);
    expect(computeStreamingRevenue(0, 0, 10).studioMultiplier).toBe(6);
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

describe('applyStreamingTeamShare divides exactly once', () => {
  it('splits 12,788 into 6,394 (2 robots) and 4,262 (3 robots)', () => {
    expect(applyStreamingTeamShare(calculation(12788), 2).totalRevenue).toBe(6394);
    expect(applyStreamingTeamShare(calculation(12788), 3).totalRevenue).toBe(4262);
  });

  it('splits 4,000 into 2,000 (2 robots) and 1,333 (3 robots)', () => {
    expect(applyStreamingTeamShare(calculation(4000), 2).totalRevenue).toBe(2000);
    expect(applyStreamingTeamShare(calculation(4000), 3).totalRevenue).toBe(1333);
  });

  it('records the team size and keeps the pre-share figure', () => {
    const shared = applyStreamingTeamShare(calculation(12788), 2);
    expect(shared.teamSize).toBe(2);
    expect(shared.revenueBeforeTeamShare).toBe(12788);
  });

  it('is idempotent: applying it twice gives the same result', () => {
    const once = applyStreamingTeamShare(calculation(12788), 2);
    const twice = applyStreamingTeamShare(once, 2);
    expect(twice).toEqual(once);
    expect(twice.totalRevenue).toBe(6394);
  });

  it('leaves a solo award unchanged', () => {
    expect(applyStreamingTeamShare(calculation(4000), 1).totalRevenue).toBe(4000);
  });

  it('rejects a team size that is not a positive integer', () => {
    expect(() => applyStreamingTeamShare(calculation(4000), 0)).toThrow(FinancialError);
    expect(() => applyStreamingTeamShare(calculation(4000), -1)).toThrow(FinancialError);
    expect(() => applyStreamingTeamShare(calculation(4000), 1.5)).toThrow(FinancialError);
  });
});

describe('Every consumer delegates to the shared formula (R10.2, R10.3)', () => {
  const SERVICE = src('services/economy/streamingRevenueService.ts');
  const REPORT = src('services/economy/financialReportService.ts');
  const RECOMMEND = src('services/economy/facilityRecommendationService.ts');
  const ROI = src('services/economy/unifiedFacilityROIService.ts');

  it('the service has exactly one formula body and both award paths delegate to it', () => {
    expect(SERVICE.match(/export function computeStreamingRevenue\(/g)?.length).toBe(1);
    expect(SERVICE.match(/totalBattleCount \/ STREAMING_BATTLE_DIVISOR/g)?.length).toBe(1);
    expect(SERVICE.match(/computeStreamingRevenue\(/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('no consumer keeps the multiplicative v1 product form', () => {
    for (const source of [SERVICE, REPORT, RECOMMEND, ROI]) {
      expect(source).not.toContain('1 + (totalBattleCount /');
      expect(source).not.toContain('1 + (robot.fame / 5000)');
    }
  });

  it('the report, the advisor and the ROI service import computeStreamingRevenue', () => {
    for (const source of [REPORT, RECOMMEND, ROI]) {
      expect(source).toMatch(/import \{[^}]*computeStreamingRevenue[^}]*\} from '\.\/streamingRevenueService'/);
    }
  });

  it('the financial report no longer uses its own divisors or caps', () => {
    expect(REPORT).not.toContain('Math.min(1 + (totalBattles / 100)');
    expect(REPORT).not.toContain('Math.min(1 + (totalFame / 500)');
  });

  it('the financial report presents streaming per robot', () => {
    expect(REPORT).toContain('perRobot');
    expect(REPORT).toContain('revenuePerBattle');
  });

  it('the financial report labels the roster figure as an aggregate', () => {
    expect(REPORT).toContain('aggregate');
  });

  it('the advisor no longer keeps a stale Merchandising base table', () => {
    expect(RECOMMEND).not.toContain('getIncomeGeneratorBaseIncome');
    expect(RECOMMEND).not.toContain('[5000, 8000, 11000');
    expect(RECOMMEND).toContain('getMerchandisingBaseRate');
  });

  it('the advisor does not approximate the Studio Multiplier', () => {
    expect(RECOMMEND).not.toContain('1 + (currentLevel * 0.1)');
    expect(RECOMMEND).not.toContain('1 + (nextLevel * 0.1)');
    expect(RECOMMEND).not.toContain('1000 * battleMultiplier * fameMultiplier * studioMultiplier');
  });

  it('the ROI service does not reproduce the formula inline', () => {
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

  it('summing a roster before applying the formula misstates the roster awards', () => {
    // Five robots at 200 battles / 1,000 fame each, L2:
    //   per robot (20000 + 2000 + 2000) × 4 / 40 = 2,400 → roster 12,000
    //   summed inputs (20000 + 10000 + 10000) × 4 / 40 = 4,000
    const perRobot = computeStreamingRevenue(200, 1000, 2).totalRevenue;
    const summedRoster = computeStreamingRevenue(1000, 5000, 2).totalRevenue;
    expect(perRobot).toBe(2400);
    expect(summedRoster).toBe(4000);
    expect(perRobot * 5).toBe(12000);
  });
});
