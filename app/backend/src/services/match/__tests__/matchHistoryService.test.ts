/**
 * Unit tests for matchHistoryService — economic fields in match history.
 *
 * Tests that formatBattleHistoryEntry includes prestigeAwarded, fameAwarded,
 * and streamingRevenue fields sourced from BattleParticipant records.
 *
 * Validates: Requirement 7.5
 */

import { formatBattleHistoryEntry } from '../matchHistoryService';

// ─── Mock Data Helpers ───────────────────────────────────────────────

function makeBattleParticipant(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    battleId: 100,
    robotId: 10,
    team: 1,
    role: null,
    placement: null,
    credits: 500,
    streamingRevenue: 0,
    eloBefore: 1200,
    eloAfter: 1220,
    prestigeAwarded: 0,
    fameAwarded: 0,
    damageDealt: 150,
    finalHP: 80,
    yielded: false,
    destroyed: false,
    createdAt: new Date('2026-04-01T12:00:00Z'),
    ...overrides,
  };
}

function makeRobotWithUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    name: 'TestBot',
    userId: 1,
    currentLeague: 'bronze',
    leagueId: 1,
    elo: 1200,
    currentHP: 100,
    maxHP: 100,
    maxShield: 50,
    imageUrl: null,
    loadoutType: 'single',
    user: { id: 1, username: 'TestPlayer', stableName: 'TestStable' },
    ...overrides,
  };
}

/**
 * Creates a mock league battle with full relations.
 * For league battles, formatBattleHistoryEntry returns baseData directly
 * without additional Prisma queries, making this safe for unit testing.
 */
function makeBattle(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const robot1 = makeRobotWithUser({ id: 10, name: 'Bot-Alpha', userId: 1 });
  const robot2 = makeRobotWithUser({
    id: 20,
    name: 'Bot-Beta',
    userId: 2,
    user: { id: 2, username: 'Opponent', stableName: 'OpponentStable' },
  });

  return {
    id: 100,
    robot1Id: 10,
    robot2Id: 20,
    winnerId: 10,
    battleType: 'league',
    leagueType: 'bronze',
    tournamentId: null,
    tournamentRound: null,
    team1ActiveRobotId: null,
    team1ReserveRobotId: null,
    team2ActiveRobotId: null,
    team2ReserveRobotId: null,
    team1TagOutTime: null,
    team2TagOutTime: null,
    battleLog: { events: [] },
    durationSeconds: 120,
    winnerReward: 500,
    loserReward: 100,
    team1ActiveDamageDealt: 0,
    team1ReserveDamageDealt: 0,
    team2ActiveDamageDealt: 0,
    team2ReserveDamageDealt: 0,
    team1ActiveFameAwarded: 0,
    team1ReserveFameAwarded: 0,
    team2ActiveFameAwarded: 0,
    team2ReserveFameAwarded: 0,
    robot1ELOBefore: 1200,
    robot2ELOBefore: 1180,
    robot1ELOAfter: 1220,
    robot2ELOAfter: 1160,
    eloChange: 20,
    createdAt: new Date('2026-04-01T12:00:00Z'),
    robot1,
    robot2,
    tournament: null,
    participants: [
      makeBattleParticipant({ id: 1, robotId: 10, team: 1, credits: 500, eloBefore: 1200, eloAfter: 1220, finalHP: 80 }),
      makeBattleParticipant({ id: 2, robotId: 20, team: 2, credits: 100, eloBefore: 1180, eloAfter: 1160, finalHP: 0, destroyed: true }),
    ],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

/** Helper type for accessing result properties in assertions. */
type HistoryResult = Record<string, unknown>;

describe('formatBattleHistoryEntry — economic fields', () => {
  it('should include prestigeAwarded, fameAwarded, and streamingRevenue in the response', async () => {
    const battle = makeBattle({
      participants: [
        makeBattleParticipant({ robotId: 10, prestigeAwarded: 5, fameAwarded: 3, streamingRevenue: 200 }),
        makeBattleParticipant({ robotId: 20, prestigeAwarded: 1, fameAwarded: 0, streamingRevenue: 50 }),
      ],
    });

    const result = await formatBattleHistoryEntry(battle as never, [10]) as HistoryResult;

    expect(result).toHaveProperty('prestigeAwarded', 5);
    expect(result).toHaveProperty('fameAwarded', 3);
    expect(result).toHaveProperty('streamingRevenue', 200);
  });

  it('should source economic fields from the requesting user participant (robot1)', async () => {
    const battle = makeBattle({
      participants: [
        makeBattleParticipant({ robotId: 10, prestigeAwarded: 10, fameAwarded: 7, streamingRevenue: 300 }),
        makeBattleParticipant({ robotId: 20, prestigeAwarded: 2, fameAwarded: 1, streamingRevenue: 80 }),
      ],
    });

    const result = await formatBattleHistoryEntry(battle as never, [10]) as HistoryResult;

    // Should use robot1's participant values, not robot2's
    expect(result.prestigeAwarded).toBe(10);
    expect(result.fameAwarded).toBe(7);
    expect(result.streamingRevenue).toBe(300);
  });

  it('should source economic fields from the requesting user participant (robot2)', async () => {
    const battle = makeBattle({
      participants: [
        makeBattleParticipant({ robotId: 10, prestigeAwarded: 10, fameAwarded: 7, streamingRevenue: 300 }),
        makeBattleParticipant({ robotId: 20, prestigeAwarded: 2, fameAwarded: 1, streamingRevenue: 80 }),
      ],
    });

    const result = await formatBattleHistoryEntry(battle as never, [20]) as HistoryResult;

    // Should use robot2's participant values
    expect(result.prestigeAwarded).toBe(2);
    expect(result.fameAwarded).toBe(1);
    expect(result.streamingRevenue).toBe(80);
  });

  it('should default economic fields to 0 when user participant is not found', async () => {
    const battle = makeBattle({
      participants: [
        makeBattleParticipant({ robotId: 10, prestigeAwarded: 5, fameAwarded: 3, streamingRevenue: 200 }),
        makeBattleParticipant({ robotId: 20, prestigeAwarded: 1, fameAwarded: 0, streamingRevenue: 50 }),
      ],
    });

    // Request with a robotId that doesn't match any participant
    const result = await formatBattleHistoryEntry(battle as never, [999]) as HistoryResult;

    expect(result.prestigeAwarded).toBe(0);
    expect(result.fameAwarded).toBe(0);
    expect(result.streamingRevenue).toBe(0);
  });

  it('should default economic fields to 0 when participant has zero values', async () => {
    const battle = makeBattle({
      participants: [
        makeBattleParticipant({ robotId: 10, prestigeAwarded: 0, fameAwarded: 0, streamingRevenue: 0 }),
        makeBattleParticipant({ robotId: 20, prestigeAwarded: 0, fameAwarded: 0, streamingRevenue: 0 }),
      ],
    });

    const result = await formatBattleHistoryEntry(battle as never, [10]) as HistoryResult;

    expect(result.prestigeAwarded).toBe(0);
    expect(result.fameAwarded).toBe(0);
    expect(result.streamingRevenue).toBe(0);
  });

  it('should include economic fields alongside standard battle history fields', async () => {
    const battle = makeBattle({
      participants: [
        makeBattleParticipant({ robotId: 10, prestigeAwarded: 5, fameAwarded: 3, streamingRevenue: 200 }),
        makeBattleParticipant({ robotId: 20, prestigeAwarded: 1, fameAwarded: 0, streamingRevenue: 50 }),
      ],
    });

    const result = await formatBattleHistoryEntry(battle as never, [10]) as HistoryResult;

    // Standard fields still present
    expect(result).toHaveProperty('id', 100);
    expect(result).toHaveProperty('robot1Id', 10);
    expect(result).toHaveProperty('robot2Id', 20);
    expect(result).toHaveProperty('winnerId', 10);
    expect(result).toHaveProperty('battleType', 'league');
    expect(result).toHaveProperty('robot1');
    expect(result).toHaveProperty('robot2');

    // Economic fields present
    expect(result).toHaveProperty('prestigeAwarded');
    expect(result).toHaveProperty('fameAwarded');
    expect(result).toHaveProperty('streamingRevenue');
  });

  it('should handle multiple user robots in targetRobotIds', async () => {
    const battle = makeBattle({
      participants: [
        makeBattleParticipant({ robotId: 10, prestigeAwarded: 8, fameAwarded: 4, streamingRevenue: 150 }),
        makeBattleParticipant({ robotId: 20, prestigeAwarded: 2, fameAwarded: 1, streamingRevenue: 50 }),
      ],
    });

    // User owns both robots (e.g., viewing all battles)
    const result = await formatBattleHistoryEntry(battle as never, [10, 20]) as HistoryResult;

    // Should find the first matching participant (robot 10)
    expect(result.prestigeAwarded).toBe(8);
    expect(result.fameAwarded).toBe(4);
    expect(result.streamingRevenue).toBe(150);
  });
});
