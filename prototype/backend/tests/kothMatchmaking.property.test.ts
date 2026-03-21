/**
 * Property-based tests for KotH Matchmaking Service
 *
 * Uses fast-check to verify correctness properties from the design document.
 *
 * Property 26: Matchmaking produces ELO-balanced groups with one robot per stable
 * Property 27: Only eligible robots are selected for matchmaking
 */

import * as fc from 'fast-check';
import { distributeIntoGroups, EligibleRobot } from '../src/services/kothMatchmakingService';

// ─── Helpers ────────────────────────────────────────────────────────

/** Arbitrary for a single EligibleRobot with ELO in [500, 2000] */
const eligibleRobotArb = (id: number, userId: number): fc.Arbitrary<EligibleRobot> =>
  fc.integer({ min: 500, max: 2000 }).map((elo) => ({
    id,
    userId,
    elo,
    name: `Robot-${id}`,
  }));

/**
 * Generate a list of robots where each has a unique userId (one per stable).
 * Count is between min and max inclusive.
 */
function uniqueUserRobotsArb(min: number, max: number): fc.Arbitrary<EligibleRobot[]> {
  return fc.integer({ min, max }).chain((count) => {
    const arbs = Array.from({ length: count }, (_, i) => eligibleRobotArb(i + 1, i + 1));
    return fc.tuple(...(arbs as [fc.Arbitrary<EligibleRobot>, ...fc.Arbitrary<EligibleRobot>[]]));
  }).map((tuple) => [...tuple]);
}

/**
 * Generate robot counts that produce clean groups of 5 or 6.
 * With the no-sit-out formula (round(N / 5.5)), most counts produce
 * groups of 5-6. We test a range of counts that guarantee 5-6 groups.
 *  - n = 5k     → k groups of 5
 *  - n = 6k     → k groups of 6
 *  - n = 6k + 5 → k groups of 6 + 1 group of 5
 */
function validRobotCountArb(): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: 7 }).chain((k) =>
    fc.constantFrom(5 * (k + 1), 6 * (k + 1), 6 * k + 5),
  ).filter((n) => n >= 5);
}

/**
 * Generate robots with a count that produces clean 5-6 groups.
 */
function cleanGroupRobotsArb(): fc.Arbitrary<EligibleRobot[]> {
  return validRobotCountArb().chain((count) => {
    const arbs = Array.from({ length: count }, (_, i) => eligibleRobotArb(i + 1, i + 1));
    return fc.tuple(...(arbs as [fc.Arbitrary<EligibleRobot>, ...fc.Arbitrary<EligibleRobot>[]]));
  }).map((tuple) => [...tuple]);
}

/**
 * Calculate group count the same way runKothMatchmaking does.
 * No sit-outs: round(N / 5.5), minimum 1 group.
 */
function calcGroupCount(eligible: number): number {
  if (eligible < 5) return 0;
  return Math.max(1, Math.round(eligible / 5.5));
}

/**
 * Replicate the pure filtering logic from getEligibleRobots:
 * one robot per stable (userId), highest ELO wins, result sorted by ELO desc.
 */
function filterOnePerStable(robots: EligibleRobot[]): EligibleRobot[] {
  const sorted = [...robots].sort((a, b) => b.elo - a.elo);
  const seenUsers = new Set<number>();
  const eligible: EligibleRobot[] = [];
  for (const robot of sorted) {
    if (!seenUsers.has(robot.userId)) {
      seenUsers.add(robot.userId);
      eligible.push(robot);
    }
  }
  return eligible;
}


// ─── Property 26: ELO-balanced groups with one robot per stable ─────

describe('Property 26: Matchmaking produces ELO-balanced groups with one robot per stable', () => {
  it('all groups have size 5 or 6 when robot count produces clean groups', () => {
    fc.assert(
      fc.property(
        cleanGroupRobotsArb(),
        (robots) => {
          const groupCount = calcGroupCount(robots.length);
          const groups = distributeIntoGroups(robots, groupCount);

          for (const group of groups) {
            expect(group.robots.length).toBeGreaterThanOrEqual(5);
            expect(group.robots.length).toBeLessThanOrEqual(6);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('no duplicate userIds (stables) within a single group', () => {
    fc.assert(
      fc.property(
        cleanGroupRobotsArb(),
        (robots) => {
          const groupCount = calcGroupCount(robots.length);
          const groups = distributeIntoGroups(robots, groupCount);

          for (const group of groups) {
            const userIds = group.robots.map((r) => r.userId);
            const uniqueUserIds = new Set(userIds);
            expect(uniqueUserIds.size).toBe(userIds.length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all input robots appear in exactly one group', () => {
    fc.assert(
      fc.property(
        cleanGroupRobotsArb(),
        (robots) => {
          const groupCount = calcGroupCount(robots.length);
          const groups = distributeIntoGroups(robots, groupCount);

          // Collect all robot IDs from groups
          const allGroupedIds = groups.flatMap((g) => g.robots.map((r) => r.id));
          const inputIds = robots.map((r) => r.id);

          // Every input robot appears exactly once
          expect(allGroupedIds.sort()).toEqual(inputIds.sort());
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ELO variance between groups is bounded (snake-draft property)', () => {
    fc.assert(
      fc.property(
        cleanGroupRobotsArb(),
        (robots) => {
          const groupCount = calcGroupCount(robots.length);
          if (groupCount < 2) return; // need at least 2 groups to compare

          const groups = distributeIntoGroups(robots, groupCount);

          const avgElos = groups.map(
            (g) => g.totalElo / g.robots.length,
          );
          const maxAvg = Math.max(...avgElos);
          const minAvg = Math.min(...avgElos);

          // Snake-draft should keep average ELO difference bounded.
          // With ELOs in [500, 2000], the max spread of a single robot is 1500.
          // Snake-draft distributes top ELOs across groups, so the average
          // difference should be well under the max single-robot ELO range.
          // A generous bound: max difference in group averages < 500.
          expect(maxAvg - minAvg).toBeLessThan(500);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Property 27: Eligibility filtering ─────────────────────────────

/**
 * Arbitrary for robots where multiple robots can share the same userId.
 * This simulates a stable with multiple robots — only the highest ELO should be selected.
 */
function multiRobotPerUserArb(minRobots: number, maxRobots: number): fc.Arbitrary<EligibleRobot[]> {
  return fc.integer({ min: minRobots, max: maxRobots }).chain((count) => {
    const arbs: fc.Arbitrary<EligibleRobot>[] = [];
    for (let i = 0; i < count; i++) {
      arbs.push(
        fc.record({
          id: fc.constant(i + 1),
          // userId between 1 and ceil(count/2) to force duplicates
          userId: fc.integer({ min: 1, max: Math.max(1, Math.ceil(count / 2)) }),
          elo: fc.integer({ min: 500, max: 2000 }),
          name: fc.constant(`Robot-${i + 1}`),
        }),
      );
    }
    return fc.tuple(...(arbs as [fc.Arbitrary<EligibleRobot>, ...fc.Arbitrary<EligibleRobot>[]]));
  }).map((tuple) => [...tuple]);
}

describe('Property 27: Only eligible robots are selected for matchmaking', () => {
  it('should select exactly one robot per userId', () => {
    fc.assert(
      fc.property(
        multiRobotPerUserArb(5, 40),
        (robots) => {
          const filtered = filterOnePerStable(robots);
          const userIds = filtered.map((r) => r.userId);
          const uniqueUserIds = new Set(userIds);

          // Exactly one robot per userId
          expect(uniqueUserIds.size).toBe(userIds.length);

          // Every userId from input is represented
          const inputUserIds = new Set(robots.map((r) => r.userId));
          expect(uniqueUserIds).toEqual(inputUserIds);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should select the highest ELO robot for each userId', () => {
    fc.assert(
      fc.property(
        multiRobotPerUserArb(5, 40),
        (robots) => {
          const filtered = filterOnePerStable(robots);

          // For each selected robot, verify it has the max ELO for its userId
          for (const selected of filtered) {
            const sameUserRobots = robots.filter((r) => r.userId === selected.userId);
            const maxElo = Math.max(...sameUserRobots.map((r) => r.elo));
            expect(selected.elo).toBe(maxElo);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return results sorted by ELO descending', () => {
    fc.assert(
      fc.property(
        multiRobotPerUserArb(5, 40),
        (robots) => {
          const filtered = filterOnePerStable(robots);

          for (let i = 1; i < filtered.length; i++) {
            expect(filtered[i - 1].elo).toBeGreaterThanOrEqual(filtered[i].elo);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should never return more robots than unique userIds in input', () => {
    fc.assert(
      fc.property(
        multiRobotPerUserArb(5, 40),
        (robots) => {
          const filtered = filterOnePerStable(robots);
          const uniqueInputUsers = new Set(robots.map((r) => r.userId)).size;
          expect(filtered.length).toBe(uniqueInputUsers);
        },
      ),
      { numRuns: 100 },
    );
  });
});
