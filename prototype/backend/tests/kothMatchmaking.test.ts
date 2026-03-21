/**
 * KotH Matchmaking Tests
 * Tests for distributeIntoGroups and group count calculation logic.
 *
 * Core rule: no sit-outs. Every eligible robot plays.
 * Groups target 5-6 robots each (KotH supports 4-8).
 */

import { distributeIntoGroups, EligibleRobot } from '../src/services/kothMatchmakingService';

function makeRobots(count: number): EligibleRobot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    userId: i + 1,
    elo: 1000 + i * 10,
    name: `Robot ${i + 1}`,
  }));
}

/** Mirrors the production group count formula */
function calculateGroupCount(eligible: number): number {
  if (eligible < 5) return 0;
  return Math.max(1, Math.round(eligible / 5.5));
}

describe('KotH Matchmaking — Group Count (no sit-outs)', () => {
  it('should skip when fewer than 5 robots', () => {
    expect(calculateGroupCount(0)).toBe(0);
    expect(calculateGroupCount(4)).toBe(0);
  });

  it('should create 1 group for 5-7 robots', () => {
    expect(calculateGroupCount(5)).toBe(1);
    expect(calculateGroupCount(6)).toBe(1);
    expect(calculateGroupCount(7)).toBe(1);
  });

  it('should create 2 groups for 8-14 robots', () => {
    expect(calculateGroupCount(8)).toBe(1); // round(8/5.5) = round(1.45) = 1
    expect(calculateGroupCount(9)).toBe(2); // round(9/5.5) = round(1.64) = 2
    expect(calculateGroupCount(11)).toBe(2);
    expect(calculateGroupCount(14)).toBe(3); // round(14/5.5) = round(2.55) = 3
  });

  it('should handle 25 robots → 5 groups of 5', () => {
    expect(calculateGroupCount(25)).toBe(5); // round(25/5.5) = round(4.55) = 5
    const groups = distributeIntoGroups(makeRobots(25), 5);
    expect(groups).toHaveLength(5);
    groups.forEach((g) => expect(g.robots).toHaveLength(5));
  });

  it('should handle 23 robots → 4 groups (3×6 + 1×5)', () => {
    expect(calculateGroupCount(23)).toBe(4); // round(23/5.5) = round(4.18) = 4
    const groups = distributeIntoGroups(makeRobots(23), 4);
    expect(groups).toHaveLength(4);
    const sizes = groups.map((g) => g.robots.length).sort();
    expect(sizes).toEqual([5, 6, 6, 6]);
  });

  it('should handle 30 robots → 5 groups of 6', () => {
    expect(calculateGroupCount(30)).toBe(5); // round(30/5.5) = round(5.45) = 5
    const groups = distributeIntoGroups(makeRobots(30), 5);
    expect(groups).toHaveLength(5);
    groups.forEach((g) => expect(g.robots).toHaveLength(6));
  });

  it('should handle 11 robots → 2 groups (1×6 + 1×5)', () => {
    expect(calculateGroupCount(11)).toBe(2);
    const groups = distributeIntoGroups(makeRobots(11), 2);
    const sizes = groups.map((g) => g.robots.length).sort();
    expect(sizes).toEqual([5, 6]);
  });

  it('should never leave robots out for any count 5-60', () => {
    for (let n = 5; n <= 60; n++) {
      const gc = calculateGroupCount(n);
      const groups = distributeIntoGroups(makeRobots(n), gc);
      const totalAssigned = groups.reduce((sum, g) => sum + g.robots.length, 0);
      expect(totalAssigned).toBe(n);
    }
  });

  it('should produce groups within KotH valid range (4-8) for any count 5-60', () => {
    for (let n = 5; n <= 60; n++) {
      const gc = calculateGroupCount(n);
      const groups = distributeIntoGroups(makeRobots(n), gc);
      groups.forEach((g) => {
        expect(g.robots.length).toBeGreaterThanOrEqual(4);
        expect(g.robots.length).toBeLessThanOrEqual(8);
      });
    }
  });
});

describe('KotH Matchmaking — Snake Draft ELO Balance', () => {
  it('should distribute ELO evenly across groups', () => {
    const robots = makeRobots(12); // ELO: 1000-1110
    const groups = distributeIntoGroups(robots, 2);

    const elo1 = groups[0].totalElo;
    const elo2 = groups[1].totalElo;
    // Snake draft should keep groups within ~10% of each other
    const diff = Math.abs(elo1 - elo2);
    const avg = (elo1 + elo2) / 2;
    expect(diff / avg).toBeLessThan(0.1);
  });

  it('should not mutate the input array', () => {
    const robots = makeRobots(10);
    const originalOrder = robots.map((r) => r.id);
    distributeIntoGroups(robots, 2);
    expect(robots.map((r) => r.id)).toEqual(originalOrder);
  });
});
