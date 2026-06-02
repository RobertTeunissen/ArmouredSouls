/**
 * Property-based test for C18 "Autobots, Roll Out!" achievement evaluation.
 * Feature: team-battle-tournaments, Property 17: C18 unlocked iff sum of championship counters >= 1
 *
 * Validates: Requirements 10.3
 *
 * C18 evaluates to unlocked when the sum of all per-type championship title counters
 * (championshipTitles1v1 + championshipTitles2v2 + championshipTitles3v3) >= 1,
 * regardless of which tournament type earned the title.
 */

import * as fc from 'fast-check';

/**
 * Pure evaluation logic for C18 tournament win check.
 * Mirrors the achievementService.checkAllModesWin tournament component:
 *   hasTournamentWin = championshipTitles >= 1
 * where championshipTitles = sum of all per-type counters.
 */
function evaluateC18TournamentCondition(
  championshipTitles1v1: number,
  championshipTitles2v2: number,
  championshipTitles3v3: number,
): boolean {
  const totalChampionships = championshipTitles1v1 + championshipTitles2v2 + championshipTitles3v3;
  return totalChampionships >= 1;
}

describe('Feature: team-battle-tournaments, Property 17: C18 unlocked iff sum of championship counters >= 1', () => {
  /**
   * **Validates: Requirements 10.3**
   *
   * Property 17: C18 achievement evaluation — For any user with per-type championship
   * counters (titles1v1, titles2v2, titles3v3), the C18 "Autobots, Roll Out!" achievement
   * SHALL evaluate to unlocked if and only if titles1v1 + titles2v2 + titles3v3 >= 1.
   */
  it('should evaluate C18 as unlocked iff sum of all championship counters >= 1', () => {
    fc.assert(
      fc.property(
        fc.record({
          championshipTitles1v1: fc.nat({ max: 10 }),
          championshipTitles2v2: fc.nat({ max: 10 }),
          championshipTitles3v3: fc.nat({ max: 10 }),
        }),
        ({ championshipTitles1v1, championshipTitles2v2, championshipTitles3v3 }) => {
          const totalChampionships = championshipTitles1v1 + championshipTitles2v2 + championshipTitles3v3;
          const c18Unlocked = evaluateC18TournamentCondition(
            championshipTitles1v1,
            championshipTitles2v2,
            championshipTitles3v3,
          );

          // C18 unlocked iff total >= 1
          expect(c18Unlocked).toBe(totalChampionships >= 1);

          // Equivalently: unlocked iff any single counter is positive
          const anyCounterPositive =
            championshipTitles1v1 >= 1 || championshipTitles2v2 >= 1 || championshipTitles3v3 >= 1;
          expect(c18Unlocked).toBe(anyCounterPositive);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should evaluate C18 as locked when all championship counters are 0', () => {
    const c18Unlocked = evaluateC18TournamentCondition(0, 0, 0);
    expect(c18Unlocked).toBe(false);
  });

  it('should evaluate C18 as unlocked regardless of which specific counter holds the value', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('1v1' as const, '2v2' as const, '3v3' as const),
        fc.integer({ min: 1, max: 10 }),
        (winningType, count) => {
          const titles1v1 = winningType === '1v1' ? count : 0;
          const titles2v2 = winningType === '2v2' ? count : 0;
          const titles3v3 = winningType === '3v3' ? count : 0;

          const c18Unlocked = evaluateC18TournamentCondition(titles1v1, titles2v2, titles3v3);

          // Any single counter with value >= 1 should unlock C18
          expect(c18Unlocked).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
