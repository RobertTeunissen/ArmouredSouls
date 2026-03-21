import * as fc from 'fast-check';

interface KothStanding {
  kothWins: number;
  kothTotalZoneScore: number;
}

function sortStandings(standings: KothStanding[]): KothStanding[] {
  return [...standings].sort((a, b) => {
    if (b.kothWins !== a.kothWins) return b.kothWins - a.kothWins;
    return b.kothTotalZoneScore - a.kothTotalZoneScore;
  });
}

describe('Property 30: KotH standings sorted by wins then zone score', () => {
  it('should sort by kothWins descending first', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        kothWins: fc.integer({ min: 0, max: 100 }),
        kothTotalZoneScore: fc.integer({ min: 0, max: 10000 }),
      }), { minLength: 2, maxLength: 50 }),
      (standings) => {
        const sorted = sortStandings(standings);
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i - 1].kothWins !== sorted[i].kothWins) {
            expect(sorted[i - 1].kothWins).toBeGreaterThan(sorted[i].kothWins);
          }
        }
      },
    ), { numRuns: 100 });
  });

  it('should sort by kothTotalZoneScore descending when wins are equal', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        kothWins: fc.integer({ min: 0, max: 100 }),
        kothTotalZoneScore: fc.integer({ min: 0, max: 10000 }),
      }), { minLength: 2, maxLength: 50 }),
      (standings) => {
        const sorted = sortStandings(standings);
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i - 1].kothWins === sorted[i].kothWins) {
            expect(sorted[i - 1].kothTotalZoneScore).toBeGreaterThanOrEqual(sorted[i].kothTotalZoneScore);
          }
        }
      },
    ), { numRuns: 100 });
  });

  it('should preserve all elements (no data loss)', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        kothWins: fc.integer({ min: 0, max: 100 }),
        kothTotalZoneScore: fc.integer({ min: 0, max: 10000 }),
      }), { minLength: 0, maxLength: 50 }),
      (standings) => {
        const sorted = sortStandings(standings);
        expect(sorted.length).toBe(standings.length);
      },
    ), { numRuns: 100 });
  });
});
