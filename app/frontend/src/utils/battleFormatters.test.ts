/**
 * Unit tests for battleFormatters — pure utility functions for
 * formatting battle-related data for UI display.
 */
import { describe, it, expect } from 'vitest';
import {
  getBattleOutcome,
  getELOChange,
  formatDuration,
  getTournamentRoundName,
  getBattleReward,
  isTeamBattleType,
} from './battleFormatters';
import type { BattleHistory } from './matchmakingApi';

// Minimal battle factory for testing
function makeBattle(overrides: Partial<BattleHistory> = {}): BattleHistory {
  return {
    id: 1,
    battleType: 'league',
    robot1Id: 10,
    robot2Id: 20,
    robot1Name: 'Robot A',
    robot2Name: 'Robot B',
    winnerId: 10,
    robot1ELOBefore: 1200,
    robot1ELOAfter: 1215,
    robot2ELOBefore: 1200,
    robot2ELOAfter: 1185,
    eloChange: 15,
    winnerReward: 1000,
    loserReward: 200,
    createdAt: '2026-06-01T12:00:00Z',
    isByeMatch: false,
    ...overrides,
  } as BattleHistory;
}

describe('getBattleOutcome', () => {
  it('should return win when robot is the winner', () => {
    const battle = makeBattle({ winnerId: 10 });
    expect(getBattleOutcome(battle, 10)).toBe('win');
  });

  it('should return loss when robot is the loser', () => {
    const battle = makeBattle({ winnerId: 10 });
    expect(getBattleOutcome(battle, 20)).toBe('loss');
  });

  it('should return draw when no winner', () => {
    const battle = makeBattle({ winnerId: null as unknown as number });
    expect(getBattleOutcome(battle, 10)).toBe('draw');
  });

  it('should return win for bye matches regardless of winnerId', () => {
    const battle = makeBattle({ isByeMatch: true, winnerId: 999 });
    expect(getBattleOutcome(battle, 10)).toBe('win');
  });

  it('should handle team battle outcome for robot1', () => {
    const battle = makeBattle({
      battleType: 'league_2v2',
      team1Id: 100,
      team2Id: 200,
      winnerId: 100,
      robot1Id: 10,
      robot2Id: 20,
    });
    expect(getBattleOutcome(battle, 10)).toBe('win');
    expect(getBattleOutcome(battle, 20)).toBe('loss');
  });
});

describe('getELOChange', () => {
  it('should return positive ELO change for winner (robot1)', () => {
    const battle = makeBattle();
    expect(getELOChange(battle, 10)).toBe(15);
  });

  it('should return negative ELO change for loser (robot2)', () => {
    const battle = makeBattle();
    expect(getELOChange(battle, 20)).toBe(-15);
  });
});

describe('formatDuration', () => {
  it('should format seconds only when < 60', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('should format minutes and seconds when >= 60', () => {
    expect(formatDuration(60)).toBe('1m 0s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(125)).toBe('2m 5s');
  });
});

describe('getTournamentRoundName', () => {
  it('should return Finals for last round', () => {
    expect(getTournamentRoundName(4, 4)).toBe('Finals');
  });

  it('should return Semi-finals for second to last round', () => {
    expect(getTournamentRoundName(3, 4)).toBe('Semi-finals');
  });

  it('should return Quarter-finals for third to last round', () => {
    expect(getTournamentRoundName(2, 4)).toBe('Quarter-finals');
  });

  it('should return Round X/Y for earlier rounds', () => {
    expect(getTournamentRoundName(1, 4)).toBe('Round 1/4');
    expect(getTournamentRoundName(1, 5)).toBe('Round 1/5');
  });
});

describe('getBattleReward', () => {
  it('should return winner reward for winning robot', () => {
    const battle = makeBattle({ winnerId: 10, winnerReward: 1000, loserReward: 200 });
    expect(getBattleReward(battle, 10)).toBe(1000);
  });

  it('should return loser reward for losing robot', () => {
    const battle = makeBattle({ winnerId: 10, winnerReward: 1000, loserReward: 200 });
    expect(getBattleReward(battle, 20)).toBe(200);
  });
});

describe('isTeamBattleType', () => {
  it('should return true for team battle types', () => {
    expect(isTeamBattleType('league_2v2')).toBe(true);
    expect(isTeamBattleType('league_3v3')).toBe(true);
    expect(isTeamBattleType('tournament_2v2')).toBe(true);
    expect(isTeamBattleType('tournament_3v3')).toBe(true);
  });

  it('should return false for non-team battle types', () => {
    expect(isTeamBattleType('league')).toBe(false);
    expect(isTeamBattleType('tournament')).toBe(false);
    expect(isTeamBattleType(undefined)).toBe(false);
  });
});
