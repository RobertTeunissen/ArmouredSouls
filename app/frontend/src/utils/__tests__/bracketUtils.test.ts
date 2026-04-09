import { describe, it, expect } from 'vitest';
import {
  getRoundLabel,
  buildBracketTree,
  formatSeedDisplay,
  getUserFuturePath,
  TournamentMatchWithRobots,
} from '../bracketUtils';

/** Helper to create a minimal match object for testing */
function makeMatch(overrides: Partial<TournamentMatchWithRobots> & { id: number; round: number; matchNumber: number }): TournamentMatchWithRobots {
  return {
    tournamentId: 1,
    robot1Id: null,
    robot2Id: null,
    winnerId: null,
    battleId: null,
    status: 'pending',
    isByeMatch: false,
    completedAt: null,
    robot1: null,
    robot2: null,
    winner: null,
    ...overrides,
  };
}

describe('getRoundLabel', () => {
  it('should return "Finals" when round equals maxRounds', () => {
    expect(getRoundLabel(4, 4)).toBe('Finals');
    expect(getRoundLabel(1, 1)).toBe('Finals');
    expect(getRoundLabel(7, 7)).toBe('Finals');
  });

  it('should return "Semi-finals" when round is maxRounds - 1', () => {
    expect(getRoundLabel(3, 4)).toBe('Semi-finals');
    expect(getRoundLabel(6, 7)).toBe('Semi-finals');
  });

  it('should return "Quarter-finals" when round is maxRounds - 2', () => {
    expect(getRoundLabel(2, 4)).toBe('Quarter-finals');
    expect(getRoundLabel(5, 7)).toBe('Quarter-finals');
  });

  it('should return "Round N" for earlier rounds', () => {
    expect(getRoundLabel(1, 4)).toBe('Round 1');
    expect(getRoundLabel(1, 7)).toBe('Round 1');
    expect(getRoundLabel(3, 7)).toBe('Round 3');
    expect(getRoundLabel(4, 7)).toBe('Round 4');
  });

  it('should handle 2-round tournament correctly', () => {
    expect(getRoundLabel(1, 2)).toBe('Semi-finals');
    expect(getRoundLabel(2, 2)).toBe('Finals');
  });

  it('should handle 3-round tournament correctly', () => {
    expect(getRoundLabel(1, 3)).toBe('Quarter-finals');
    expect(getRoundLabel(2, 3)).toBe('Semi-finals');
    expect(getRoundLabel(3, 3)).toBe('Finals');
  });
});

describe('buildBracketTree', () => {
  it('should organize matches into a Map keyed by round', () => {
    const matches: TournamentMatchWithRobots[] = [
      makeMatch({ id: 1, round: 1, matchNumber: 1 }),
      makeMatch({ id: 2, round: 1, matchNumber: 2 }),
      makeMatch({ id: 3, round: 2, matchNumber: 1 }),
    ];

    const tree = buildBracketTree(matches, 2);

    expect(tree.size).toBe(2);
    expect(tree.get(1)!.length).toBe(2);
    expect(tree.get(2)!.length).toBe(1);
  });

  it('should sort matches within each round by matchNumber', () => {
    const matches: TournamentMatchWithRobots[] = [
      makeMatch({ id: 3, round: 1, matchNumber: 3 }),
      makeMatch({ id: 1, round: 1, matchNumber: 1 }),
      makeMatch({ id: 2, round: 1, matchNumber: 2 }),
    ];

    const tree = buildBracketTree(matches, 1);
    const round1 = tree.get(1)!;

    expect(round1[0].matchNumber).toBe(1);
    expect(round1[1].matchNumber).toBe(2);
    expect(round1[2].matchNumber).toBe(3);
  });

  it('should initialize empty arrays for rounds with no matches', () => {
    const matches: TournamentMatchWithRobots[] = [
      makeMatch({ id: 1, round: 1, matchNumber: 1 }),
    ];

    const tree = buildBracketTree(matches, 3);

    expect(tree.get(1)!.length).toBe(1);
    expect(tree.get(2)!.length).toBe(0);
    expect(tree.get(3)!.length).toBe(0);
  });

  it('should handle empty matches array', () => {
    const tree = buildBracketTree([], 3);

    expect(tree.size).toBe(3);
    expect(tree.get(1)!.length).toBe(0);
    expect(tree.get(2)!.length).toBe(0);
    expect(tree.get(3)!.length).toBe(0);
  });
});

describe('formatSeedDisplay', () => {
  it('should prefix seed number for seeds 1-32', () => {
    expect(formatSeedDisplay(1, 'AlphaBot')).toBe('#1 AlphaBot');
    expect(formatSeedDisplay(16, 'BetaBot')).toBe('#16 BetaBot');
    expect(formatSeedDisplay(32, 'GammaBot')).toBe('#32 GammaBot');
  });

  it('should return just the name for seeds > 32', () => {
    expect(formatSeedDisplay(33, 'DeltaBot')).toBe('DeltaBot');
    expect(formatSeedDisplay(64, 'EpsilonBot')).toBe('EpsilonBot');
    expect(formatSeedDisplay(128, 'ZetaBot')).toBe('ZetaBot');
  });
});

describe('getUserFuturePath', () => {
  it('should return empty set when no user robot IDs provided', () => {
    const matches = [makeMatch({ id: 1, round: 1, matchNumber: 1 })];
    const result = getUserFuturePath(matches, new Set(), 2);
    expect(result.size).toBe(0);
  });

  it('should return empty set when matches array is empty', () => {
    const result = getUserFuturePath([], new Set([1]), 2);
    expect(result.size).toBe(0);
  });

  it('should return empty set when user robot is not in any match', () => {
    const matches = [
      makeMatch({ id: 1, round: 1, matchNumber: 1, robot1Id: 10, robot2Id: 20 }),
    ];
    const result = getUserFuturePath(matches, new Set([99]), 2);
    expect(result.size).toBe(0);
  });

  it('should compute future path for a robot in round 1 of a 3-round bracket', () => {
    // 4-match round 1, 2-match round 2, 1-match round 3
    const matches = [
      makeMatch({ id: 1, round: 1, matchNumber: 1, robot1Id: 10, robot2Id: 20, status: 'pending' }),
      makeMatch({ id: 2, round: 1, matchNumber: 2, robot1Id: 30, robot2Id: 40, status: 'pending' }),
      makeMatch({ id: 3, round: 1, matchNumber: 3, robot1Id: 50, robot2Id: 60, status: 'pending' }),
      makeMatch({ id: 4, round: 1, matchNumber: 4, robot1Id: 70, robot2Id: 80, status: 'pending' }),
      makeMatch({ id: 5, round: 2, matchNumber: 1 }), // winner of match 1 vs winner of match 2
      makeMatch({ id: 6, round: 2, matchNumber: 2 }), // winner of match 3 vs winner of match 4
      makeMatch({ id: 7, round: 3, matchNumber: 1 }), // finals
    ];

    // Robot 10 is in match 1 (round 1, matchNumber 1)
    // Next: round 2, matchNumber ceil(1/2)=1 → match id 5
    // Then: round 3, matchNumber ceil(1/2)=1 → match id 7
    const result = getUserFuturePath(matches, new Set([10]), 3);
    expect(result).toEqual(new Set([5, 7]));
  });

  it('should not include future matches for an eliminated robot', () => {
    const matches = [
      makeMatch({ id: 1, round: 1, matchNumber: 1, robot1Id: 10, robot2Id: 20, winnerId: 20, status: 'completed' }),
      makeMatch({ id: 2, round: 1, matchNumber: 2, robot1Id: 30, robot2Id: 40, status: 'pending' }),
      makeMatch({ id: 3, round: 2, matchNumber: 1 }),
    ];

    // Robot 10 lost in match 1
    const result = getUserFuturePath(matches, new Set([10]), 2);
    expect(result.size).toBe(0);
  });

  it('should trace from the current match when robot has already advanced', () => {
    const matches = [
      makeMatch({ id: 1, round: 1, matchNumber: 1, robot1Id: 10, robot2Id: 20, winnerId: 10, status: 'completed' }),
      makeMatch({ id: 2, round: 1, matchNumber: 2, robot1Id: 30, robot2Id: 40, winnerId: 30, status: 'completed' }),
      makeMatch({ id: 3, round: 2, matchNumber: 1, robot1Id: 10, robot2Id: 30, status: 'pending' }),
      makeMatch({ id: 4, round: 1, matchNumber: 3, robot1Id: 50, robot2Id: 60, status: 'pending' }),
      makeMatch({ id: 5, round: 1, matchNumber: 4, robot1Id: 70, robot2Id: 80, status: 'pending' }),
      makeMatch({ id: 6, round: 2, matchNumber: 2 }),
      makeMatch({ id: 7, round: 3, matchNumber: 1 }),
    ];

    // Robot 10 won round 1 and is now in round 2 match 1
    // From round 2 match 1: next is round 3 matchNumber ceil(1/2)=1 → match id 7
    // From round 1 match 1 (completed win): round 2 match 1 has robot 10 already assigned, so not "future"
    const result = getUserFuturePath(matches, new Set([10]), 3);
    expect(result).toEqual(new Set([7]));
  });

  it('should handle multiple user robots', () => {
    const matches = [
      makeMatch({ id: 1, round: 1, matchNumber: 1, robot1Id: 10, robot2Id: 20, status: 'pending' }),
      makeMatch({ id: 2, round: 1, matchNumber: 2, robot1Id: 30, robot2Id: 40, status: 'pending' }),
      makeMatch({ id: 3, round: 2, matchNumber: 1 }),
    ];

    // Both robot 10 and robot 30 belong to the user
    const result = getUserFuturePath(matches, new Set([10, 30]), 2);
    // Both trace to match 3 (round 2, matchNumber 1)
    expect(result).toEqual(new Set([3]));
  });
});
