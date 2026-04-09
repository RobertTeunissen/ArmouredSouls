/**
 * Unit tests for pure (non-database) admin service functions.
 * Tests calculateStats, buildTagTeamWhere, and mapBattleRecord.
 */

import { calculateStats } from '../src/services/admin/adminStatsService';
import { buildTagTeamWhere, mapBattleRecord } from '../src/services/admin/adminBattleService';
import type { BattleWithDetails } from '../src/services/admin/adminBattleService';

// ── calculateStats ───────────────────────────────────────────────────

describe('calculateStats', () => {
  it('should return null for an empty array', () => {
    expect(calculateStats([])).toBeNull();
  });

  it('should handle a single value', () => {
    const result = calculateStats([10]);
    expect(result).not.toBeNull();
    expect(result!.mean).toBe(10);
    expect(result!.median).toBe(10);
    expect(result!.min).toBe(10);
    expect(result!.max).toBe(10);
    expect(result!.stdDev).toBe(0);
  });

  it('should calculate correct stats for multiple values', () => {
    const values = [2, 4, 6, 8, 10];
    const result = calculateStats(values)!;

    expect(result.mean).toBe(6);
    expect(result.median).toBe(6);
    expect(result.min).toBe(2);
    expect(result.max).toBe(10);
  });

  it('should calculate correct median for even-length arrays', () => {
    const result = calculateStats([1, 3, 5, 7])!;
    // median of [1,3,5,7] = (3+5)/2 = 4
    expect(result.median).toBe(4);
  });

  it('should calculate standard deviation', () => {
    // stdDev of [2, 4, 4, 4, 5, 5, 7, 9] = 2.0
    const result = calculateStats([2, 4, 4, 4, 5, 5, 7, 9])!;
    expect(result.stdDev).toBe(2);
  });

  it('should calculate quartiles, IQR, and bounds', () => {
    // sorted: [1, 2, 3, 4, 5, 6, 7, 8]
    const values = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = calculateStats(values)!;

    // q1Index = floor(8 * 0.25) = 2 → sorted[2] = 3
    expect(result.q1).toBe(3);
    // q3Index = floor(8 * 0.75) = 6 → sorted[6] = 7
    expect(result.q3).toBe(7);
    // iqr = 7 - 3 = 4
    expect(result.iqr).toBe(4);
    // lowerBound = 3 - 1.5*4 = -3
    expect(result.lowerBound).toBe(-3);
    // upperBound = 7 + 1.5*4 = 13
    expect(result.upperBound).toBe(13);
  });

  it('should return numbers rounded to 2 decimal places', () => {
    const result = calculateStats([1, 2, 3])!;
    // mean = 2, median = 2, stdDev = sqrt(2/3) ≈ 0.82
    expect(typeof result.mean).toBe('number');
    expect(typeof result.stdDev).toBe('number');
    // Verify rounding: stdDev of [1,2,3] = sqrt(((1-2)^2+(2-2)^2+(3-2)^2)/3) = sqrt(2/3) ≈ 0.8165
    expect(result.stdDev).toBe(0.82);
  });
});

// ── buildTagTeamWhere ────────────────────────────────────────────────

describe('buildTagTeamWhere', () => {
  it('should return base where clause with no args', () => {
    const where = buildTagTeamWhere();
    expect(where.status).toBe('completed');
    expect(where.battleId).toEqual({ not: null });
    expect(where.tagTeamLeague).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });

  it('should add tagTeamLeague filter when leagueType is provided', () => {
    const where = buildTagTeamWhere(undefined, 'gold');
    expect(where.tagTeamLeague).toBe('gold');
  });

  it('should not add tagTeamLeague filter when leagueType is "all"', () => {
    const where = buildTagTeamWhere(undefined, 'all');
    expect(where.tagTeamLeague).toBeUndefined();
  });

  it('should add OR search conditions when search is provided', () => {
    const where = buildTagTeamWhere('Destroyer');
    expect(where.OR).toBeDefined();
    expect(where.OR).toHaveLength(4);
  });

  it('should combine search and leagueType filters', () => {
    const where = buildTagTeamWhere('Destroyer', 'silver');
    expect(where.tagTeamLeague).toBe('silver');
    expect(where.OR).toBeDefined();
    expect(where.OR).toHaveLength(4);
  });
});

// ── mapBattleRecord ──────────────────────────────────────────────────

describe('mapBattleRecord', () => {
  const mockBattle: BattleWithDetails = {
    id: 42,
    robot1Id: 1,
    robot2Id: 2,
    robot1: { id: 1, name: 'Alpha', userId: 10 },
    robot2: { id: 2, name: 'Beta', userId: 20 },
    winnerId: 1,
    leagueType: 'gold',
    durationSeconds: 120,
    createdAt: new Date('2025-01-15T12:00:00Z'),
    participants: [
      { robotId: 1, finalHP: 50, eloBefore: 1200, eloAfter: 1220 } as any,
      { robotId: 2, finalHP: 0, eloBefore: 1180, eloAfter: 1160 } as any,
    ],
  } as any;

  it('should map battle to correct response shape', () => {
    const result = mapBattleRecord(mockBattle, '1v1');

    expect(result.id).toBe(42);
    expect(result.robot1).toEqual({ id: 1, name: 'Alpha', userId: 10 });
    expect(result.robot2).toEqual({ id: 2, name: 'Beta', userId: 20 });
    expect(result.winnerId).toBe(1);
    expect(result.winnerName).toBe('Alpha');
    expect(result.leagueType).toBe('gold');
    expect(result.durationSeconds).toBe(120);
    expect(result.battleFormat).toBe('1v1');
  });

  it('should extract participant HP and ELO data', () => {
    const result = mapBattleRecord(mockBattle, '1v1');

    expect(result.robot1FinalHP).toBe(50);
    expect(result.robot2FinalHP).toBe(0);
    expect(result.robot1ELOBefore).toBe(1200);
    expect(result.robot2ELOBefore).toBe(1180);
    expect(result.robot1ELOAfter).toBe(1220);
    expect(result.robot2ELOAfter).toBe(1160);
  });

  it('should show "Draw" when winnerId is null', () => {
    const drawBattle = { ...mockBattle, winnerId: null };
    const result = mapBattleRecord(drawBattle as any, '1v1');
    expect(result.winnerName).toBe('Draw');
  });

  it('should show robot2 name when robot2 wins', () => {
    const r2Wins = { ...mockBattle, winnerId: 2 };
    const result = mapBattleRecord(r2Wins as any, '1v1');
    expect(result.winnerName).toBe('Beta');
  });

  it('should default HP/ELO to 0 when participants are missing', () => {
    const noParticipants = { ...mockBattle, participants: [] };
    const result = mapBattleRecord(noParticipants as any, '2v2');

    expect(result.robot1FinalHP).toBe(0);
    expect(result.robot2FinalHP).toBe(0);
    expect(result.robot1ELOBefore).toBe(0);
    expect(result.robot2ELOBefore).toBe(0);
    expect(result.battleFormat).toBe('2v2');
  });
});
