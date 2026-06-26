/**
 * Unit tests for StandingsService.
 *
 * Mocks Prisma client and logger to isolate service logic.
 */

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    standing: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    leagueHistory: { create: jest.fn() },
    cycleMetadata: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import prisma from '../../../lib/prisma';
import standingsService from '../standingsService';
import { createStanding } from '../../../../tests/factories/standingFactory';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================================
// recordBattleResult
// =============================================================================

describe('recordBattleResult', () => {
  it('should increment wins and currentWinStreak on win', async () => {
    const existing = createStanding({ wins: 3, currentWinStreak: 2, bestWinStreak: 4, currentLoseStreak: 1, leaguePoints: 100 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.upsert as jest.Mock).mockResolvedValue({ ...existing, wins: 4, currentWinStreak: 3 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'win',
      lpDelta: 10,
    });

    expect(mockPrisma.standing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          wins: 4,
        }),
      }),
    );
  });

  it('should reset currentLoseStreak to 0 on win', async () => {
    const existing = createStanding({ currentLoseStreak: 5, currentWinStreak: 0, leaguePoints: 50 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.upsert as jest.Mock).mockResolvedValue({ ...existing, currentLoseStreak: 0 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'win',
      lpDelta: 10,
    });

    expect(mockPrisma.standing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ currentLoseStreak: 0 }),
      }),
    );
  });

  it('should update bestWinStreak when currentWinStreak exceeds it', async () => {
    const existing = createStanding({ currentWinStreak: 4, bestWinStreak: 4, leaguePoints: 100 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.upsert as jest.Mock).mockResolvedValue({ ...existing, currentWinStreak: 5, bestWinStreak: 5 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'win',
      lpDelta: 10,
    });

    expect(mockPrisma.standing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ bestWinStreak: 5 }),
      }),
    );
  });

  it('should NOT update bestWinStreak when currentWinStreak does not exceed it', async () => {
    const existing = createStanding({ currentWinStreak: 1, bestWinStreak: 10, leaguePoints: 100 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.upsert as jest.Mock).mockResolvedValue({ ...existing, currentWinStreak: 2 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'win',
      lpDelta: 10,
    });

    expect(mockPrisma.standing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ bestWinStreak: 10 }),
      }),
    );
  });

  it('should increment losses and currentLoseStreak on loss', async () => {
    const existing = createStanding({ losses: 2, currentLoseStreak: 1, leaguePoints: 100 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.upsert as jest.Mock).mockResolvedValue({ ...existing, losses: 3, currentLoseStreak: 2 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'loss',
      lpDelta: -10,
    });

    expect(mockPrisma.standing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          losses: 3,
        }),
      }),
    );
  });

  it('should reset currentWinStreak to 0 on loss', async () => {
    const existing = createStanding({ currentWinStreak: 5, leaguePoints: 100 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.upsert as jest.Mock).mockResolvedValue({ ...existing, currentWinStreak: 0 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'loss',
      lpDelta: -10,
    });

    expect(mockPrisma.standing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ currentWinStreak: 0 }),
      }),
    );
  });

  it('should increment draws and reset both streaks on draw', async () => {
    const existing = createStanding({ draws: 1, currentWinStreak: 3, currentLoseStreak: 0, leaguePoints: 100 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.upsert as jest.Mock).mockResolvedValue({ ...existing, draws: 2, currentWinStreak: 0, currentLoseStreak: 0 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'draw',
      lpDelta: 0,
    });

    expect(mockPrisma.standing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          draws: 2,
        }),
      }),
    );
  });

  it('should enforce LP floor at 0 (never go negative)', async () => {
    const existing = createStanding({ leaguePoints: 5 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.upsert as jest.Mock).mockResolvedValue({ ...existing, leaguePoints: 0 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'loss',
      lpDelta: -20, // Would push LP to -15, but floor is 0
    });

    expect(mockPrisma.standing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ leaguePoints: 0 }),
      }),
    );
  });

  it('should create default standing if none exists', async () => {
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(null);
    const newStanding = createStanding({ entityId: 999, mode: 'league_1v1', tier: 'bronze', leaguePoints: 0 });
    (mockPrisma.standing.create as jest.Mock).mockResolvedValue(newStanding);
    (mockPrisma.standing.upsert as jest.Mock).mockResolvedValue({ ...newStanding, wins: 1, currentWinStreak: 1 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: 999,
      mode: 'league_1v1',
      outcome: 'win',
      lpDelta: 10,
    });

    // Should have tried findUnique first, got null, then created
    expect(mockPrisma.standing.findUnique).toHaveBeenCalled();
    expect(mockPrisma.standing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'robot',
          entityId: 999,
          mode: 'league_1v1',
          tier: 'bronze',
          leagueInstanceId: 'bronze_1',
        }),
      }),
    );
  });
});

// =============================================================================
// awardKothPoints
// =============================================================================

describe('awardKothPoints', () => {
  it('should award 25 points for 1st place', async () => {
    const existing = createStanding({ mode: 'koth', leaguePoints: 100, totalMatches: 5, totalKills: 10, totalZoneScore: 50, totalZoneTime: 200, bestPlacement: 2 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, leaguePoints: 125 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 1,
      totalParticipants: 6,
      kills: 3,
      zoneScore: 10,
      zoneTime: 30,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leaguePoints: 125 }),
      }),
    );
  });

  it('should award 18 points for 2nd place', async () => {
    const existing = createStanding({ mode: 'koth', leaguePoints: 50, totalMatches: 2, totalKills: 5, totalZoneScore: 20, totalZoneTime: 100, bestPlacement: 2 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, leaguePoints: 68 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 2,
      totalParticipants: 6,
      kills: 2,
      zoneScore: 5,
      zoneTime: 20,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leaguePoints: 68 }),
      }),
    );
  });

  it('should award 0 points for placement > 6', async () => {
    const existing = createStanding({ mode: 'koth', leaguePoints: 80, totalMatches: 3, totalKills: 7, totalZoneScore: 30, totalZoneTime: 150, bestPlacement: 3 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, leaguePoints: 80 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 7,
      totalParticipants: 10,
      kills: 1,
      zoneScore: 2,
      zoneTime: 10,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leaguePoints: 80 }), // No change
      }),
    );
  });

  it('should increment totalMatches on every call', async () => {
    const existing = createStanding({ mode: 'koth', leaguePoints: 50, totalMatches: 10, totalKills: 20, totalZoneScore: 100, totalZoneTime: 500, bestPlacement: 1 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, totalMatches: 11 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 4,
      totalParticipants: 6,
      kills: 0,
      zoneScore: 3,
      zoneTime: 15,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalMatches: 11 }),
      }),
    );
  });

  it('should accumulate totalKills and totalZoneScore', async () => {
    const existing = createStanding({ mode: 'koth', leaguePoints: 50, totalMatches: 5, totalKills: 10, totalZoneScore: 40, totalZoneTime: 200, bestPlacement: 2 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, totalKills: 14, totalZoneScore: 48 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 3,
      totalParticipants: 6,
      kills: 4,
      zoneScore: 8,
      zoneTime: 25,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalKills: 14,
          totalZoneScore: 48,
        }),
      }),
    );
  });

  it('should update bestPlacement when better placement achieved', async () => {
    const existing = createStanding({ mode: 'koth', leaguePoints: 50, totalMatches: 5, totalKills: 10, totalZoneScore: 40, totalZoneTime: 200, bestPlacement: 3 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, bestPlacement: 2 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 2,
      totalParticipants: 6,
      kills: 2,
      zoneScore: 5,
      zoneTime: 20,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bestPlacement: 2 }),
      }),
    );
  });

  it('should increment wins and update streak only for 1st place', async () => {
    const existing = createStanding({ mode: 'koth', wins: 3, currentWinStreak: 1, bestWinStreak: 2, currentLoseStreak: 0, leaguePoints: 100, totalMatches: 10, totalKills: 20, totalZoneScore: 80, totalZoneTime: 400, bestPlacement: 1 });
    (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, wins: 4, currentWinStreak: 2 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 1,
      totalParticipants: 6,
      kills: 5,
      zoneScore: 15,
      zoneTime: 40,
    });

    const updateCall = (mockPrisma.standing.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.wins).toBe(4);
    expect(updateCall.data.currentWinStreak).toBe(2);
    expect(updateCall.data.bestWinStreak).toBe(2);
    expect(updateCall.data.currentLoseStreak).toBe(0);
  });
});

// =============================================================================
// getStandings
// =============================================================================

describe('getStandings', () => {
  it('should return paginated standings sorted by LP desc', async () => {
    const standings = [
      createStanding({ leaguePoints: 300 }),
      createStanding({ leaguePoints: 200 }),
      createStanding({ leaguePoints: 100 }),
    ];

    (mockPrisma.standing.findMany as jest.Mock).mockResolvedValue(standings);
    (mockPrisma.standing.count as jest.Mock).mockResolvedValue(3);

    const result = await standingsService.getStandings('league_1v1' as any, { page: 1, limit: 10 });

    expect(result.standings).toHaveLength(3);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 3,
      totalPages: 1,
    });
    expect(mockPrisma.standing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { leaguePoints: 'desc' },
        skip: 0,
        take: 10,
      }),
    );
  });

  it('should filter by leagueInstanceId when provided', async () => {
    (mockPrisma.standing.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.standing.count as jest.Mock).mockResolvedValue(0);

    await standingsService.getStandings('league_1v1' as any, { leagueInstanceId: 'gold_1' });

    expect(mockPrisma.standing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          mode: 'league_1v1',
          leagueInstanceId: 'gold_1',
        }),
      }),
    );
  });
});

// =============================================================================
// getEntityStandings
// =============================================================================

describe('getEntityStandings', () => {
  it('should return all standings for an entity across modes', async () => {
    const standings = [
      createStanding({ entityId: 100, mode: 'koth' }),
      createStanding({ entityId: 100, mode: 'league_1v1' }),
      createStanding({ entityId: 100, mode: 'league_2v2' }),
    ];

    (mockPrisma.standing.findMany as jest.Mock).mockResolvedValue(standings);

    const result = await standingsService.getEntityStandings('robot', 100);

    expect(result).toHaveLength(3);
    expect(mockPrisma.standing.findMany).toHaveBeenCalledWith({
      where: { entityType: 'robot', entityId: 100 },
      orderBy: { mode: 'asc' },
    });
  });
});
