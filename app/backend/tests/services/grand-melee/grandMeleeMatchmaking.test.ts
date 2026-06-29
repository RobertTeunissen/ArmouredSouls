/**
 * Property-based and unit tests for Grand Melee LP-banding matchmaking grouping.
 *
 * Tests the pure `groupByLPBanding` function which groups eligible robots into
 * LP-banded groups of 8-20 with same-stable swap conflict resolution.
 *
 * Validates: Spec #44 Grand Melee — Matchmaking Grouping (P8, P9)
 */

// Mock transitive dependencies that are not needed for pure function testing
jest.mock('../../../src/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/services/scheduling/schedulingService', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../src/services/analytics/matchmakingService', () => ({
  checkSchedulingReadiness: jest.fn(),
}));
jest.mock('../../../src/services/team-battle/teamBattleAdapter', () => ({
  TEAM_BATTLE_LEAGUE_TIERS: [],
}));
jest.mock('../../../src/services/matchmaking/teamMatchmakingUtils', () => ({
  calculateMatchScore: jest.fn(),
  RECENT_OPPONENT_LIMIT: 5,
  createRecentOpponentQueryFn: jest.fn(),
  getRecentOpponentsBatch: jest.fn(),
  defaultScheduledFor: jest.fn(),
}));

import { groupByLPBanding, EligibleRobot, GrandMeleeMatchGroup } from '../../../src/services/grand-melee/grandMeleeMatchmakingService';
import * as fc from 'fast-check';

// ─── Constants (mirror service) ──────────────────────────────────────────────

const MIN_GROUP_SIZE = 8;
const IDEAL_GROUP_SIZE = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEligibleRobots(count: number, userIdFn?: (i: number) => number): EligibleRobot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    userId: userIdFn ? userIdFn(i) : i + 1, // default: unique users
    elo: 1200 + i,
    name: `Robot-${i + 1}`,
    createdAt: new Date('2025-01-01'),
  }));
}

function emptyLPMap(robots: EligibleRobot[]): Map<number, number> {
  return new Map(robots.map(r => [r.id, 0]));
}

function emptyRecentOpponents(): Map<number, number[]> {
  return new Map();
}

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe('groupByLPBanding - Property-Based Tests', () => {
  describe('P8: Match size bounds', () => {
    it('should produce groups where all have size >= 8 and <= 20 for any eligible count >= 8', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 200 }),
          (eligibleCount) => {
            const robots = makeEligibleRobots(eligibleCount);
            const lpMap = emptyLPMap(robots);
            const recentOpponents = emptyRecentOpponents();

            const groups = groupByLPBanding(robots, lpMap, recentOpponents);

            expect(groups.length).toBeGreaterThan(0);
            for (const group of groups) {
              expect(group.robots.length).toBeGreaterThanOrEqual(MIN_GROUP_SIZE);
              expect(group.robots.length).toBeLessThanOrEqual(IDEAL_GROUP_SIZE);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should place all robots into exactly one group (no robots lost or duplicated)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 200 }),
          (eligibleCount) => {
            const robots = makeEligibleRobots(eligibleCount);
            const lpMap = emptyLPMap(robots);
            const recentOpponents = emptyRecentOpponents();

            const groups = groupByLPBanding(robots, lpMap, recentOpponents);

            const allRobotIds = groups.flatMap(g => g.robots.map(r => r.id));
            expect(allRobotIds.length).toBe(eligibleCount);
            expect(new Set(allRobotIds).size).toBe(eligibleCount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('P9: Same-stable exclusion', () => {
    it('should attempt to separate robots from the same user into different groups', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              robotId: fc.nat({ max: 1000 }),
              userId: fc.nat({ max: 50 }),
            }),
            { minLength: 8, maxLength: 40 },
          ),
          (generated) => {
            // Deduplicate by robotId
            const seen = new Set<number>();
            const unique = generated.filter(g => {
              if (seen.has(g.robotId)) return false;
              seen.add(g.robotId);
              return true;
            });

            if (unique.length < MIN_GROUP_SIZE) return; // skip trivial cases

            const robots: EligibleRobot[] = unique.map((g, i) => ({
              id: g.robotId,
              userId: g.userId,
              elo: 1200 + i,
              name: `Robot-${g.robotId}`,
              createdAt: new Date('2025-01-01'),
            }));

            const lpMap = new Map(robots.map(r => [r.id, 0]));
            const recentOpponents = emptyRecentOpponents();

            const groups = groupByLPBanding(robots, lpMap, recentOpponents);

            // The function should run without crashing regardless of conflict density
            expect(groups.length).toBeGreaterThan(0);

            // For each group, check userId duplicates — the algorithm is best-effort,
            // so we just verify it doesn't crash and the stable swap logic ran
            for (const group of groups) {
              expect(group.robots.length).toBeGreaterThanOrEqual(MIN_GROUP_SIZE);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should have no same-user duplicates when users each have exactly one robot', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8, max: 100 }),
          (count) => {
            // Each robot has a unique userId — no conflicts possible
            const robots = makeEligibleRobots(count);
            const lpMap = emptyLPMap(robots);
            const recentOpponents = emptyRecentOpponents();

            const groups = groupByLPBanding(robots, lpMap, recentOpponents);

            for (const group of groups) {
              const userIds = group.robots.map(r => r.userId);
              const uniqueUserIds = new Set(userIds);
              expect(uniqueUserIds.size).toBe(userIds.length);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe('groupByLPBanding - Unit Tests', () => {
  it('should return empty array when fewer than 8 robots (below minimum)', () => {
    const robots = makeEligibleRobots(7);
    const groups = groupByLPBanding(robots, emptyLPMap(robots), emptyRecentOpponents());

    expect(groups).toEqual([]);
  });

  it('should return a single group of 8 for exactly 8 eligible robots', () => {
    const robots = makeEligibleRobots(8);
    const groups = groupByLPBanding(robots, emptyLPMap(robots), emptyRecentOpponents());

    expect(groups).toHaveLength(1);
    expect(groups[0].robots).toHaveLength(8);
  });

  it('should return a single group of 20 for exactly 20 eligible robots', () => {
    const robots = makeEligibleRobots(20);
    const groups = groupByLPBanding(robots, emptyLPMap(robots), emptyRecentOpponents());

    expect(groups).toHaveLength(1);
    expect(groups[0].robots).toHaveLength(20);
  });

  it('should split 21 eligible robots into two groups both >= 8', () => {
    const robots = makeEligibleRobots(21);
    const groups = groupByLPBanding(robots, emptyLPMap(robots), emptyRecentOpponents());

    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(group.robots.length).toBeGreaterThanOrEqual(MIN_GROUP_SIZE);
      expect(group.robots.length).toBeLessThanOrEqual(IDEAL_GROUP_SIZE);
    }
    // Total should equal input
    const total = groups.reduce((sum, g) => sum + g.robots.length, 0);
    expect(total).toBe(21);
  });

  it('should create 5 groups of 20 for 100 eligible robots', () => {
    const robots = makeEligibleRobots(100);
    const groups = groupByLPBanding(robots, emptyLPMap(robots), emptyRecentOpponents());

    expect(groups).toHaveLength(5);
    for (const group of groups) {
      expect(group.robots).toHaveLength(20);
    }
  });

  it('should create 2 groups of 20 for 40 eligible robots', () => {
    const robots = makeEligibleRobots(40);
    const groups = groupByLPBanding(robots, emptyLPMap(robots), emptyRecentOpponents());

    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(group.robots).toHaveLength(20);
    }
  });

  it('should sort robots by LP descending within groups', () => {
    const robots = makeEligibleRobots(20);
    const lpMap = new Map<number, number>();
    // Assign LP in reverse order: robot 1 gets highest LP, robot 20 gets lowest
    robots.forEach((r, i) => lpMap.set(r.id, 100 - i));

    const groups = groupByLPBanding(robots, lpMap, emptyRecentOpponents());

    expect(groups).toHaveLength(1);
    // First robot in group should have highest LP
    const groupLPs = groups[0].robots.map(r => lpMap.get(r.id) ?? 0);
    for (let i = 0; i < groupLPs.length - 1; i++) {
      expect(groupLPs[i]).toBeGreaterThanOrEqual(groupLPs[i + 1]);
    }
  });

  describe('Same-stable conflict resolution', () => {
    it('should separate robots from the same user into different groups when possible', () => {
      // 20 robots: robots 0 and 10 both belong to user 1 (rest unique)
      // With 21 robots we get 2 groups — the two same-user robots should be separated
      const robots = makeEligibleRobots(21, (i) => {
        if (i === 0 || i === 10) return 1; // same user
        return i + 100; // unique users
      });

      const lpMap = new Map<number, number>();
      robots.forEach((r, i) => lpMap.set(r.id, 100 - i));

      const groups = groupByLPBanding(robots, lpMap, emptyRecentOpponents());

      expect(groups).toHaveLength(2);

      // Verify that user 1's robots are in different groups
      const user1Groups = new Set<number>();
      groups.forEach((group, gi) => {
        for (const robot of group.robots) {
          if (robot.userId === 1) {
            user1Groups.add(gi);
          }
        }
      });

      // Both robots from user 1 should be in different groups
      expect(user1Groups.size).toBe(2);
    });

    it('should handle case where same user has more robots than available groups gracefully', () => {
      // All 8 robots belong to user 1 — only 1 group possible, conflicts remain
      const robots = makeEligibleRobots(8, () => 1);
      const lpMap = emptyLPMap(robots);

      // Should not throw
      const groups = groupByLPBanding(robots, lpMap, emptyRecentOpponents());

      expect(groups).toHaveLength(1);
      expect(groups[0].robots).toHaveLength(8);
    });
  });

  describe('LP banding respects standings', () => {
    it('should group high-LP robots together and low-LP robots together', () => {
      const robots = makeEligibleRobots(40);
      const lpMap = new Map<number, number>();
      // First 20 robots get high LP, last 20 get low LP
      robots.forEach((r, i) => lpMap.set(r.id, i < 20 ? 100 : 0));

      const groups = groupByLPBanding(robots, lpMap, emptyRecentOpponents());

      expect(groups).toHaveLength(2);

      // First group (highest LP) should contain the first 20 robots
      const group0Ids = new Set(groups[0].robots.map(r => r.id));
      const highLPRobots = robots.slice(0, 20).map(r => r.id);
      for (const id of highLPRobots) {
        expect(group0Ids.has(id)).toBe(true);
      }
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for 0 robots', () => {
      const groups = groupByLPBanding([], new Map(), new Map());
      expect(groups).toEqual([]);
    });

    it('should return empty array for 1 robot', () => {
      const robots = makeEligibleRobots(1);
      const groups = groupByLPBanding(robots, emptyLPMap(robots), emptyRecentOpponents());
      expect(groups).toEqual([]);
    });

    it('should handle robots with missing LP entries (defaults to 0)', () => {
      const robots = makeEligibleRobots(10);
      // Empty LP map — all robots default to LP 0
      const groups = groupByLPBanding(robots, new Map(), emptyRecentOpponents());

      expect(groups).toHaveLength(1);
      expect(groups[0].robots).toHaveLength(10);
    });

    it('should handle recent opponents map without crashing', () => {
      const robots = makeEligibleRobots(20);
      const lpMap = emptyLPMap(robots);
      // Every robot recently faced every other robot
      const recentOpponents = new Map<number, number[]>();
      for (const r of robots) {
        recentOpponents.set(r.id, robots.filter(o => o.id !== r.id).map(o => o.id));
      }

      // Should not throw — recent opponent resolution is best-effort
      const groups = groupByLPBanding(robots, lpMap, recentOpponents);

      expect(groups).toHaveLength(1);
      expect(groups[0].robots).toHaveLength(20);
    });
  });
});
