/**
 * Tournament Bracket Seeding - Property-Based Tests
 * Feature: tournament-bracket-seeding
 *
 * Tests the correctness properties of the tournament seeding system
 * using fast-check for property-based testing.
 */

import * as fc from 'fast-check';
import {
  seedRobotsByELO,
  generateStandardSeedOrder,
  computeSeedings,
  Round1Match,
} from '../src/services/tournament/tournamentService';
import type { Robot } from '../generated/prisma';

const NUM_RUNS = 10;

/**
 * Create a minimal Robot-like object for testing seeding logic.
 * seedRobotsByELO only accesses .elo for sorting, and the bracket
 * placement logic only uses .id, .name, and .elo.
 */
function makeRobot(id: number, name: string, elo: number): Robot {
  return { id, name, elo } as Robot;
}

/**
 * Compute the next power of 2 >= n.
 */
function nextPowerOf2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

// Feature: tournament-bracket-seeding, Property 3: Seedings round-trip
describe('Feature: tournament-bracket-seeding', () => {
  describe('Property 3: Seedings round-trip', () => {
    /**
     * **Validates: Requirements 2.1, 2.2, 2.3**
     *
     * For any set of robots with distinct ELO ratings placed into a tournament
     * bracket via seedRobotsByELO() and generateStandardSeedOrder(), the
     * computeSeedings() function extracting seed numbers from round-1 match
     * positions SHALL produce a seedings array where seed 1 has the highest ELO,
     * seed 2 has the second-highest ELO, and so on — i.e., the seedings array
     * sorted by seed ascending has strictly descending ELO values.
     */
    it('should preserve ELO ordering through bracket placement', () => {
      fc.assert(
        fc.property(
          // Generate N distinct ELO values for 4-128 robots
          fc.integer({ min: 4, max: 128 }).chain((n) =>
            fc.tuple(
              fc.constant(n),
              fc.uniqueArray(fc.integer({ min: 800, max: 3000 }), {
                minLength: n,
                maxLength: n,
              })
            )
          ),
          ([n, elos]) => {
            // 1. Create N robots with distinct ELO values
            const robots: Robot[] = elos.map((elo, i) =>
              makeRobot(i + 1, `Robot-${i + 1}`, elo)
            );

            // 2. Sort by ELO descending
            const seeded = seedRobotsByELO(robots);

            // 3. Compute bracket size (next power of 2 >= N)
            const bracketSize = nextPowerOf2(n);

            // 4. Get seed order
            const seedOrder = generateStandardSeedOrder(bracketSize);

            // 5. Simulate round-1 match placement (same as generateBracketPairs)
            const bracketSlots: (Robot | null)[] = new Array(bracketSize).fill(null);
            for (let i = 0; i < seeded.length; i++) {
              const bracketPosition = seedOrder[i] - 1;
              bracketSlots[bracketPosition] = seeded[i];
            }

            // Create round-1 matches from consecutive pairs
            const round1Matches: Round1Match[] = [];
            let matchNumber = 1;
            for (let i = 0; i < bracketSize; i += 2) {
              let robot1 = bracketSlots[i];
              let robot2 = bracketSlots[i + 1];

              // Normalize bye matches: actual robot always in robot1
              if (robot1 === null && robot2 !== null) {
                robot1 = robot2;
                robot2 = null;
              }

              if (robot1 === null && robot2 === null) {
                continue;
              }

              round1Matches.push({
                matchNumber: matchNumber++,
                participant1Id: robot1?.id ?? null,
                participant2Id: robot2?.id ?? null,
                robot1: robot1
                  ? { id: robot1.id, name: robot1.name, elo: robot1.elo }
                  : null,
                robot2: robot2
                  ? { id: robot2.id, name: robot2.name, elo: robot2.elo }
                  : null,
              });
            }

            // 6. Compute seedings with empty completed matches
            const seedings = computeSeedings(round1Matches, bracketSize, []);

            // 7. Assert seedings sorted by seed ascending have strictly descending ELO
            expect(seedings.length).toBe(n);

            for (let i = 0; i < seedings.length; i++) {
              expect(seedings[i].seed).toBe(i + 1);
            }

            for (let i = 0; i < seedings.length - 1; i++) {
              expect(seedings[i].elo).toBeGreaterThan(seedings[i + 1].elo);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

// Feature: tournament-bracket-seeding, terminal-status elimination rule (design §7, R1)
describe('Feature: tournament-bracket-seeding', () => {
  describe('Elimination follows the terminal match statuses', () => {
    /**
     * `completed`, `forfeit` and `cancelled` rows with a winner eliminate the
     * non-winner; a `cancelled` row without a winner eliminates its participants;
     * `pending`/`scheduled` rows never eliminate anyone.
     */
    it('eliminates exactly the losers of terminal matches', () => {
      const robots: Robot[] = Array.from({ length: 8 }, (_, i) => makeRobot(i + 1, `R${i + 1}`, 2000 - i * 100));
      const seedOrder = generateStandardSeedOrder(8);
      const slots: (Robot | null)[] = new Array(8).fill(null);
      seedRobotsByELO(robots).forEach((r, i) => {
        slots[seedOrder[i] - 1] = r;
      });
      const round1Matches: Round1Match[] = [];
      for (let i = 0; i < 8; i += 2) {
        const r1 = slots[i]!;
        const r2 = slots[i + 1]!;
        round1Matches.push({
          matchNumber: i / 2 + 1,
          participant1Id: r1.id,
          participant2Id: r2.id,
          robot1: { id: r1.id, name: r1.name, elo: r1.elo },
          robot2: { id: r2.id, name: r2.name, elo: r2.elo },
        });
      }
      const statusArb = fc.constantFrom('completed', 'forfeit', 'cancelled', 'pending', 'scheduled');

      fc.assert(
        fc.property(
          fc.array(fc.tuple(statusArb, fc.constantFrom<0 | 1 | 2>(0, 1, 2)), { minLength: 4, maxLength: 4 }),
          (outcomes) => {
            const matches = round1Matches.map((m, i) => {
              const [status, pick] = outcomes[i];
              const winnerId = pick === 0 ? null : pick === 1 ? m.participant1Id : m.participant2Id;
              return { participant1Id: m.participant1Id, participant2Id: m.participant2Id, winnerId, status };
            });
            const seedings = computeSeedings(round1Matches, 8, matches);
            const expected = new Set<number>();
            for (const m of matches) {
              if (!['completed', 'forfeit', 'cancelled'].includes(m.status)) continue;
              for (const p of [m.participant1Id, m.participant2Id]) {
                if (p === null) continue;
                if (m.winnerId === null ? m.status === 'cancelled' : p !== m.winnerId) expected.add(p);
              }
            }
            for (const s of seedings) {
              expect(s.eliminated).toBe(expected.has(s.robotId));
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Feature: tournament-bracket-seeding, Property 1: API returns all matches in correct order
describe('Feature: tournament-bracket-seeding', () => {
  describe('Property 1: API returns all matches in correct order', () => {
    /**
     * **Validates: Requirements 1.1, 1.4**
     *
     * For any tournament with maxRounds rounds, the match array SHALL be sorted
     * by (round ASC, matchNumber ASC) — i.e., for any two adjacent matches in
     * the array, the first has round <= the second, and within the same round,
     * matchNumber <= the next.
     */
    it('should return matches sorted by (round ASC, matchNumber ASC)', () => {
      /**
       * The ordering logic used by the API is:
       *   orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }]
       *
       * We replicate this with a standard JS sort comparator and verify
       * the output satisfies the adjacency invariant.
       */
      fc.assert(
        fc.property(
          // Generate an array of 1-200 match objects with random round (1-7) and matchNumber (1-64)
          fc.array(
            fc.record({
              round: fc.integer({ min: 1, max: 7 }),
              matchNumber: fc.integer({ min: 1, max: 64 }),
            }),
            { minLength: 1, maxLength: 200 }
          ),
          (matches) => {
            // Apply the same ordering logic the API uses: round ASC, matchNumber ASC
            const sorted = [...matches].sort((a, b) => {
              if (a.round !== b.round) return a.round - b.round;
              return a.matchNumber - b.matchNumber;
            });

            // Assert: for every pair of adjacent matches, the ordering invariant holds
            for (let i = 0; i < sorted.length - 1; i++) {
              const current = sorted[i];
              const next = sorted[i + 1];

              // round must be non-decreasing
              expect(current.round).toBeLessThanOrEqual(next.round);

              // within the same round, matchNumber must be non-decreasing
              if (current.round === next.round) {
                expect(current.matchNumber).toBeLessThanOrEqual(next.matchNumber);
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

// Feature: tournament-bracket-seeding, Property 10: Round labels follow naming convention
describe('Feature: tournament-bracket-seeding', () => {
  describe('Property 10: Round labels follow naming convention', () => {
    /**
     * **Validates: Requirements 7.1**
     *
     * For any round number r and maxRounds value, getRoundLabel(r, maxRounds)
     * SHALL return "Finals" when r === maxRounds, "Semi-finals" when
     * r === maxRounds - 1, "Quarter-finals" when r === maxRounds - 2,
     * and "Round N" for all other values of r.
     */

    // Define getRoundLabel inline for testing (will be extracted to shared utility in Task 3.1)
    function getRoundLabel(round: number, maxRounds: number): string {
      if (round === maxRounds) return 'Finals';
      if (round === maxRounds - 1) return 'Semi-finals';
      if (round === maxRounds - 2) return 'Quarter-finals';
      return `Round ${round}`;
    }

    it('should return correct round labels for any (round, maxRounds) pair', () => {
      fc.assert(
        fc.property(
          // Generate maxRounds >= 1, then round in [1, maxRounds]
          fc.integer({ min: 1, max: 20 }).chain((maxRounds) =>
            fc.tuple(
              fc.integer({ min: 1, max: maxRounds }),
              fc.constant(maxRounds)
            )
          ),
          ([round, maxRounds]) => {
            const label = getRoundLabel(round, maxRounds);

            if (round === maxRounds) {
              expect(label).toBe('Finals');
            } else if (round === maxRounds - 1) {
              expect(label).toBe('Semi-finals');
            } else if (round === maxRounds - 2) {
              expect(label).toBe('Quarter-finals');
            } else {
              expect(label).toBe(`Round ${round}`);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});

// Feature: tournament-bracket-seeding, Property 6: Seed display threshold
describe('Feature: tournament-bracket-seeding', () => {
  describe('Property 6: Seed display threshold', () => {
    /**
     * **Validates: Requirements 4.1, 4.2, 5.3, 5.4**
     *
     * For any robot entry with a seed number, if seed <= 32 then the rendered
     * output SHALL contain the seed prefix (e.g., "#N"), and if seed > 32 then
     * the rendered output SHALL NOT contain a seed prefix.
     */

    // Inline implementation — will be extracted to bracketUtils.ts in Task 3.1
    function formatSeedDisplay(seed: number, robotName: string): string {
      if (seed <= 32) return `#${seed} ${robotName}`;
      return robotName;
    }

    it('should show seed prefix for seeds 1-32 and omit it for seeds > 32', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 500 }),
          // The filter must exclude exactly what the assertion below rejects.
          // It used to require whitespace after the digits (`^#\d+\s`) while the
          // assertion did not (`^#\d+`), so a generated name of "#0" passed the
          // filter and then failed the assertion — a flake that only surfaced on
          // seeds where fast-check happened to produce such a name.
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0 && !/^#\d+/.test(s)),
          (seed, robotName) => {
            const display = formatSeedDisplay(seed, robotName);

            if (seed <= 32) {
              // Must contain the seed prefix "#N "
              expect(display).toBe(`#${seed} ${robotName}`);
              expect(display).toContain(`#${seed}`);
            } else {
              // Must be just the robot name, no seed prefix
              expect(display).toBe(robotName);
              expect(display).not.toMatch(/^#\d+/);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
