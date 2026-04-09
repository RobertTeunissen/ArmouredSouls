import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeBattleSummary, EMPTY_SUMMARY } from '../battleHistoryStats';
import type { BattleHistory } from '../matchmakingApi';

// Mock the matchmakingApi helpers
vi.mock('../matchmakingApi', () => ({
  getBattleOutcome: vi.fn(),
  getELOChange: vi.fn(),
  getBattleReward: vi.fn(),
}));

import { getBattleOutcome, getELOChange, getBattleReward } from '../matchmakingApi';

const mockedGetBattleOutcome = vi.mocked(getBattleOutcome);
const mockedGetELOChange = vi.mocked(getELOChange);
const mockedGetBattleReward = vi.mocked(getBattleReward);

/** Minimal BattleHistory factory with sensible defaults */
function makeBattle(overrides: Partial<BattleHistory> = {}): BattleHistory {
  return {
    id: 1,
    robot1Id: 100,
    robot2Id: 200,
    winnerId: 100,
    createdAt: '2025-01-01T00:00:00Z',
    durationSeconds: 60,
    robot1ELOBefore: 1000,
    robot1ELOAfter: 1020,
    robot2ELOBefore: 1000,
    robot2ELOAfter: 980,
    robot1FinalHP: 50,
    robot2FinalHP: 0,
    winnerReward: 100,
    loserReward: 25,
    robot1: { id: 100, name: 'Bot-A', userId: 1, user: { username: 'player1' } },
    robot2: { id: 200, name: 'Bot-B', userId: 2, user: { username: 'player2' } },
    ...overrides,
  };
}

const USER_ID = 1;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Task 2.1: Empty array, single win, single loss, single draw ────────────

describe('computeBattleSummary — basics', () => {
  it('should return EMPTY_SUMMARY for an empty battle array', () => {
    const result = computeBattleSummary([], USER_ID);
    expect(result).toEqual(EMPTY_SUMMARY);
    expect(result.totalBattles).toBe(0);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.draws).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.currentStreak).toBeUndefined();
  });

  it('should compute a single league win correctly', () => {
    const battle = makeBattle(); // default: no battleType = league, winnerId = robot1
    mockedGetBattleOutcome.mockReturnValue('win');
    mockedGetELOChange.mockReturnValue(20);
    mockedGetBattleReward.mockReturnValue(100);

    const result = computeBattleSummary([battle], USER_ID);

    expect(result.totalBattles).toBe(1);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
    expect(result.draws).toBe(0);
    expect(result.winRate).toBe(1);
    expect(result.avgELOChange).toBe(20);
    expect(result.totalCreditsEarned).toBe(100);
    expect(result.leagueStats.battles).toBe(1);
    expect(result.leagueStats.wins).toBe(1);
  });

  it('should compute a single league loss correctly', () => {
    const battle = makeBattle({ winnerId: 200 });
    mockedGetBattleOutcome.mockReturnValue('loss');
    mockedGetELOChange.mockReturnValue(-15);
    mockedGetBattleReward.mockReturnValue(25);

    const result = computeBattleSummary([battle], USER_ID);

    expect(result.totalBattles).toBe(1);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(1);
    expect(result.draws).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.avgELOChange).toBe(-15);
    expect(result.totalCreditsEarned).toBe(25);
    expect(result.leagueStats.losses).toBe(1);
  });

  it('should compute a single draw correctly (winnerId null)', () => {
    const battle = makeBattle({ winnerId: null });
    mockedGetBattleOutcome.mockReturnValue('draw');
    mockedGetELOChange.mockReturnValue(0);
    mockedGetBattleReward.mockReturnValue(10);

    const result = computeBattleSummary([battle], USER_ID);

    expect(result.totalBattles).toBe(1);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.draws).toBe(1);
    expect(result.winRate).toBe(0);
    expect(result.avgELOChange).toBe(0);
    expect(result.totalCreditsEarned).toBe(10);
    expect(result.leagueStats.draws).toBe(1);
  });
});


// ─── Task 2.2: Battle type categorization ────────────────────────────────────

describe('computeBattleSummary — battle type categorization', () => {
  it('should categorize battles with no battleType as league', () => {
    const battle = makeBattle(); // no battleType field
    mockedGetBattleOutcome.mockReturnValue('win');
    mockedGetELOChange.mockReturnValue(10);
    mockedGetBattleReward.mockReturnValue(50);

    const result = computeBattleSummary([battle], USER_ID);

    expect(result.leagueStats.battles).toBe(1);
    expect(result.leagueStats.wins).toBe(1);
    expect(result.tournamentStats.battles).toBe(0);
    expect(result.tagTeamStats.battles).toBe(0);
    expect(result.kothStats.battles).toBe(0);
  });

  it('should categorize tournament battles correctly', () => {
    const battle = makeBattle({ battleType: 'tournament' });
    mockedGetBattleOutcome.mockReturnValue('win');
    mockedGetELOChange.mockReturnValue(15);
    mockedGetBattleReward.mockReturnValue(75);

    const result = computeBattleSummary([battle], USER_ID);

    expect(result.tournamentStats.battles).toBe(1);
    expect(result.tournamentStats.wins).toBe(1);
    expect(result.leagueStats.battles).toBe(0);
    expect(result.tagTeamStats.battles).toBe(0);
    expect(result.kothStats.battles).toBe(0);
  });

  it('should categorize tag-team battles correctly', () => {
    const battle = makeBattle({ battleType: 'tag_team' });
    mockedGetBattleOutcome.mockReturnValue('loss');
    mockedGetELOChange.mockReturnValue(-10);
    mockedGetBattleReward.mockReturnValue(20);

    const result = computeBattleSummary([battle], USER_ID);

    expect(result.tagTeamStats.battles).toBe(1);
    expect(result.tagTeamStats.losses).toBe(1);
    expect(result.leagueStats.battles).toBe(0);
    expect(result.tournamentStats.battles).toBe(0);
    expect(result.kothStats.battles).toBe(0);
  });

  it('should categorize KotH battles and derive outcome from kothPlacement', () => {
    // kothPlacement 1 = win
    const winBattle = makeBattle({ battleType: 'koth', kothPlacement: 1, kothZoneScore: 85 });
    mockedGetELOChange.mockReturnValue(25);
    mockedGetBattleReward.mockReturnValue(150);

    const result = computeBattleSummary([winBattle], USER_ID);

    expect(result.kothStats.battles).toBe(1);
    expect(result.kothStats.wins).toBe(1);
    expect(result.kothStats.losses).toBe(0);
    expect(result.leagueStats.battles).toBe(0);
    // getBattleOutcome should NOT be called for KotH — outcome is derived from placement
    expect(mockedGetBattleOutcome).not.toHaveBeenCalled();
  });

  it('should treat KotH placement != 1 as a loss', () => {
    const lossBattle = makeBattle({ battleType: 'koth', kothPlacement: 3, kothZoneScore: 40 });
    mockedGetELOChange.mockReturnValue(-5);
    mockedGetBattleReward.mockReturnValue(30);

    const result = computeBattleSummary([lossBattle], USER_ID);

    expect(result.kothStats.losses).toBe(1);
    expect(result.kothStats.wins).toBe(0);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(1);
  });
});


// ─── Task 2.3: Aggregate stats — win rate, avg ELO, credits, streaks ─────────

describe('computeBattleSummary — aggregate stats', () => {
  it('should calculate win rate as wins / total', () => {
    const battles = [
      makeBattle({ id: 1 }),
      makeBattle({ id: 2, winnerId: 200 }),
      makeBattle({ id: 3 }),
      makeBattle({ id: 4, winnerId: null }),
    ];
    mockedGetBattleOutcome
      .mockReturnValueOnce('win')
      .mockReturnValueOnce('loss')
      .mockReturnValueOnce('win')
      .mockReturnValueOnce('draw');
    mockedGetELOChange.mockReturnValue(5);
    mockedGetBattleReward.mockReturnValue(50);

    const result = computeBattleSummary(battles, USER_ID);

    expect(result.totalBattles).toBe(4);
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.draws).toBe(1);
    expect(result.winRate).toBe(0.5); // 2/4
  });

  it('should calculate average ELO change across all battles', () => {
    const battles = [
      makeBattle({ id: 1 }),
      makeBattle({ id: 2 }),
      makeBattle({ id: 3 }),
    ];
    mockedGetBattleOutcome.mockReturnValue('win');
    mockedGetELOChange
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(-10)
      .mockReturnValueOnce(30);
    mockedGetBattleReward.mockReturnValue(0);

    const result = computeBattleSummary(battles, USER_ID);

    // (20 + -10 + 30) / 3 ≈ 13.33
    expect(result.avgELOChange).toBeCloseTo(40 / 3);
  });

  it('should sum total credits earned', () => {
    const battles = [
      makeBattle({ id: 1 }),
      makeBattle({ id: 2 }),
    ];
    mockedGetBattleOutcome.mockReturnValue('win');
    mockedGetELOChange.mockReturnValue(0);
    mockedGetBattleReward
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(200);

    const result = computeBattleSummary(battles, USER_ID);

    expect(result.totalCreditsEarned).toBe(300);
  });

  it('should detect a win streak of 3+', () => {
    const battles = Array.from({ length: 4 }, (_, i) => makeBattle({ id: i + 1 }));
    mockedGetBattleOutcome.mockReturnValue('win');
    mockedGetELOChange.mockReturnValue(10);
    mockedGetBattleReward.mockReturnValue(50);

    const result = computeBattleSummary(battles, USER_ID);

    expect(result.currentStreak).toEqual({ type: 'win', count: 4 });
  });

  it('should detect a loss streak of 3+', () => {
    const battles = Array.from({ length: 3 }, (_, i) =>
      makeBattle({ id: i + 1, winnerId: 200 }),
    );
    mockedGetBattleOutcome.mockReturnValue('loss');
    mockedGetELOChange.mockReturnValue(-10);
    mockedGetBattleReward.mockReturnValue(10);

    const result = computeBattleSummary(battles, USER_ID);

    expect(result.currentStreak).toEqual({ type: 'loss', count: 3 });
  });

  it('should not report a streak when count < 3', () => {
    const battles = [
      makeBattle({ id: 1 }),
      makeBattle({ id: 2 }),
      makeBattle({ id: 3, winnerId: 200 }),
    ];
    mockedGetBattleOutcome
      .mockReturnValueOnce('win')
      .mockReturnValueOnce('win')
      .mockReturnValueOnce('loss');
    mockedGetELOChange.mockReturnValue(5);
    mockedGetBattleReward.mockReturnValue(25);

    const result = computeBattleSummary(battles, USER_ID);

    // Streak of 2 wins is below threshold
    expect(result.currentStreak).toBeUndefined();
  });

  it('should break streak when first battle is a draw', () => {
    const battles = [
      makeBattle({ id: 1, winnerId: null }),
      makeBattle({ id: 2 }),
      makeBattle({ id: 3 }),
      makeBattle({ id: 4 }),
    ];
    mockedGetBattleOutcome
      .mockReturnValueOnce('draw')
      .mockReturnValueOnce('win')
      .mockReturnValueOnce('win')
      .mockReturnValueOnce('win');
    mockedGetELOChange.mockReturnValue(5);
    mockedGetBattleReward.mockReturnValue(25);

    const result = computeBattleSummary(battles, USER_ID);

    // Draw at start breaks streak tracking
    expect(result.currentStreak).toBeUndefined();
  });
});


// ─── Task 2.4: KotH-specific stats ──────────────────────────────────────────

describe('computeBattleSummary — KotH-specific stats', () => {
  it('should count placements correctly (1st/2nd/3rd/other)', () => {
    const battles = [
      makeBattle({ id: 1, battleType: 'koth', kothPlacement: 1, kothZoneScore: 90 }),
      makeBattle({ id: 2, battleType: 'koth', kothPlacement: 2, kothZoneScore: 70 }),
      makeBattle({ id: 3, battleType: 'koth', kothPlacement: 3, kothZoneScore: 50 }),
      makeBattle({ id: 4, battleType: 'koth', kothPlacement: 5, kothZoneScore: 20 }),
    ];
    mockedGetELOChange.mockReturnValue(0);
    mockedGetBattleReward.mockReturnValue(0);

    const result = computeBattleSummary(battles, USER_ID);

    expect(result.kothStats.placements.first).toBe(1);
    expect(result.kothStats.placements.second).toBe(1);
    expect(result.kothStats.placements.third).toBe(1);
    expect(result.kothStats.placements.other).toBe(1);
  });

  it('should average zone scores across KotH battles', () => {
    const battles = [
      makeBattle({ id: 1, battleType: 'koth', kothPlacement: 1, kothZoneScore: 80 }),
      makeBattle({ id: 2, battleType: 'koth', kothPlacement: 2, kothZoneScore: 60 }),
    ];
    mockedGetELOChange.mockReturnValue(0);
    mockedGetBattleReward.mockReturnValue(0);

    const result = computeBattleSummary(battles, USER_ID);

    expect(result.kothStats.avgZoneScore).toBe(70); // (80 + 60) / 2
  });

  it('should sum total credits for KotH battles', () => {
    const battles = [
      makeBattle({ id: 1, battleType: 'koth', kothPlacement: 1, kothZoneScore: 90 }),
      makeBattle({ id: 2, battleType: 'koth', kothPlacement: 3, kothZoneScore: 40 }),
    ];
    mockedGetELOChange.mockReturnValue(0);
    mockedGetBattleReward
      .mockReturnValueOnce(150)
      .mockReturnValueOnce(50);

    const result = computeBattleSummary(battles, USER_ID);

    expect(result.kothStats.totalCredits).toBe(200);
  });

  it('should count wins as kills in KotH (placement 1 = kill)', () => {
    const battles = [
      makeBattle({ id: 1, battleType: 'koth', kothPlacement: 1, kothZoneScore: 95 }),
      makeBattle({ id: 2, battleType: 'koth', kothPlacement: 1, kothZoneScore: 88 }),
      makeBattle({ id: 3, battleType: 'koth', kothPlacement: 4, kothZoneScore: 30 }),
    ];
    mockedGetELOChange.mockReturnValue(0);
    mockedGetBattleReward.mockReturnValue(0);

    const result = computeBattleSummary(battles, USER_ID);

    expect(result.kothStats.totalKills).toBe(2); // only placement 1 counts
    expect(result.kothStats.wins).toBe(2);
    expect(result.kothStats.losses).toBe(1);
  });

  it('should handle KotH with undefined kothZoneScore gracefully', () => {
    const battle = makeBattle({ battleType: 'koth', kothPlacement: 2 });
    // kothZoneScore is undefined — should default to 0
    mockedGetELOChange.mockReturnValue(0);
    mockedGetBattleReward.mockReturnValue(0);

    const result = computeBattleSummary([battle], USER_ID);

    expect(result.kothStats.avgZoneScore).toBe(0);
    expect(result.kothStats.battles).toBe(1);
  });

  it('should not mix KotH stats with league stats', () => {
    const battles = [
      makeBattle({ id: 1 }), // league
      makeBattle({ id: 2, battleType: 'koth', kothPlacement: 1, kothZoneScore: 80 }),
    ];
    mockedGetBattleOutcome.mockReturnValueOnce('win'); // only called for league
    mockedGetELOChange.mockReturnValue(10);
    mockedGetBattleReward.mockReturnValue(50);

    const result = computeBattleSummary(battles, USER_ID);

    expect(result.leagueStats.battles).toBe(1);
    expect(result.kothStats.battles).toBe(1);
    expect(result.totalBattles).toBe(2);
  });
});
