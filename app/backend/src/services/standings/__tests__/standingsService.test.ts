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
// Placement (instance pick, locks, skipDuplicates) has its own suites; here it
// is a stub returning the row recordBattleResult/awardKothPoints update.
jest.mock('../standingPlacement', () => ({
  __esModule: true,
  ...jest.requireActual('../standingPlacement'),
  ensureStanding: jest.fn(),
}));

import prisma from '../../../lib/prisma';
import logger from '../../../config/logger';
import { ensureStanding } from '../standingPlacement';
import { StandingsMode } from '../../../../generated/prisma';
import standingsService from '../standingsService';
import { createStanding } from '../../../../tests/factories/standingFactory';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockEnsureStanding = ensureStanding as jest.Mock;

/** The standing the placement rule returns for the entity (already existing). */
function givenStanding(standing: ReturnType<typeof createStanding>): void {
  mockEnsureStanding.mockResolvedValue({ standing, created: false });
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockPrisma.$transaction as jest.Mock).mockImplementation(
    (fn: (tx: typeof prisma) => unknown) => fn(mockPrisma),
  );
});

// =============================================================================
// recordBattleResult
// =============================================================================

describe('recordBattleResult', () => {
  it('should increment wins and currentWinStreak on win', async () => {
    const existing = createStanding({ wins: 3, currentWinStreak: 2, bestWinStreak: 4, currentLoseStreak: 1, leaguePoints: 100 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, wins: 4, currentWinStreak: 3 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'win',
      lpDelta: 10,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wins: 4,
        }),
      }),
    );
  });

  it('should reset currentLoseStreak to 0 on win', async () => {
    const existing = createStanding({ currentLoseStreak: 5, currentWinStreak: 0, leaguePoints: 50 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, currentLoseStreak: 0 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'win',
      lpDelta: 10,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentLoseStreak: 0 }),
      }),
    );
  });

  it('should update bestWinStreak when currentWinStreak exceeds it', async () => {
    const existing = createStanding({ currentWinStreak: 4, bestWinStreak: 4, leaguePoints: 100 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, currentWinStreak: 5, bestWinStreak: 5 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'win',
      lpDelta: 10,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bestWinStreak: 5 }),
      }),
    );
  });

  it('should NOT update bestWinStreak when currentWinStreak does not exceed it', async () => {
    const existing = createStanding({ currentWinStreak: 1, bestWinStreak: 10, leaguePoints: 100 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, currentWinStreak: 2 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'win',
      lpDelta: 10,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bestWinStreak: 10 }),
      }),
    );
  });

  it('should increment losses and currentLoseStreak on loss', async () => {
    const existing = createStanding({ losses: 2, currentLoseStreak: 1, leaguePoints: 100 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, losses: 3, currentLoseStreak: 2 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'loss',
      lpDelta: -10,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          losses: 3,
        }),
      }),
    );
  });

  it('should reset currentWinStreak to 0 on loss', async () => {
    const existing = createStanding({ currentWinStreak: 5, leaguePoints: 100 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, currentWinStreak: 0 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'loss',
      lpDelta: -10,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentWinStreak: 0 }),
      }),
    );
  });

  it('should increment draws and reset both streaks on draw', async () => {
    const existing = createStanding({ draws: 1, currentWinStreak: 3, currentLoseStreak: 0, leaguePoints: 100 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, draws: 2, currentWinStreak: 0, currentLoseStreak: 0 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'draw',
      lpDelta: 0,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draws: 2,
        }),
      }),
    );
  });

  it('should enforce LP floor at 0 (never go negative)', async () => {
    const existing = createStanding({ leaguePoints: 5 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, leaguePoints: 0 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'loss',
      lpDelta: -20, // Would push LP to -15, but floor is 0
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leaguePoints: 0 }),
      }),
    );
  });

  it('should place a missing standing through the placement rule, warn, and update it by id', async () => {
    const placed = createStanding({ entityId: 999, mode: 'league_1v1', tier: 'bronze', leagueInstanceId: 'bronze_2', leaguePoints: 0 });
    mockEnsureStanding.mockResolvedValue({ standing: placed, created: true });
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...placed, wins: 1, currentWinStreak: 1 });

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: 999,
      mode: 'league_1v1',
      outcome: 'win',
      lpDelta: 10,
    });

    expect(mockEnsureStanding).toHaveBeenCalledWith(mockPrisma, 'robot', 999, 'league_1v1');
    expect(mockPrisma.standing.create).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('[Standings] Safety net created a missing standing', {
      entityType: 'robot',
      entityId: 999,
      mode: 'league_1v1',
      leagueInstanceId: 'bronze_2',
    });
    expect(mockPrisma.standing.update).toHaveBeenCalledWith({
      where: { id: placed.id },
      data: expect.objectContaining({ wins: 1, currentWinStreak: 1, leaguePoints: 10 }),
    });
  });

  it('should not warn when the standing already exists', async () => {
    const existing = createStanding({ leaguePoints: 40 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue(existing);

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: existing.entityId,
      mode: 'league_1v1',
      outcome: 'win',
      lpDelta: 10,
    });

    expect(logger.warn).not.toHaveBeenCalled();
  });
});

// =============================================================================
// awardKothPoints
// =============================================================================

describe('awardKothPoints', () => {
  // KOTH_POINT_SCALE is [10, 6, 4, 2, 1, 0]. These two cases previously expected
  // 25 and 18 — the Grand Melee scale — and had been failing on that mismatch.
  it('should award 10 points for 1st place', async () => {
    const existing = createStanding({ mode: 'koth', leaguePoints: 100, totalMatches: 5, totalZoneScore: 50, totalZoneTime: 200, bestPlacement: 2 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, leaguePoints: 110 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 1,
      totalParticipants: 6,
      zoneScore: 10,
      zoneTime: 30,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leaguePoints: 110 }),
      }),
    );
  });

  it('should award 6 points for 2nd place', async () => {
    const existing = createStanding({ mode: 'koth', leaguePoints: 50, totalMatches: 2, totalZoneScore: 20, totalZoneTime: 100, bestPlacement: 2 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, leaguePoints: 56 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 2,
      totalParticipants: 6,
      zoneScore: 5,
      zoneTime: 20,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leaguePoints: 56 }),
      }),
    );
  });

  it('should award 0 points for placement > 6', async () => {
    const existing = createStanding({ mode: 'koth', leaguePoints: 80, totalMatches: 3, totalZoneScore: 30, totalZoneTime: 150, bestPlacement: 3 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, leaguePoints: 80 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 7,
      totalParticipants: 10,
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
    const existing = createStanding({ mode: 'koth', leaguePoints: 50, totalMatches: 10, totalZoneScore: 100, totalZoneTime: 500, bestPlacement: 1 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, totalMatches: 11 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 4,
      totalParticipants: 6,
      zoneScore: 3,
      zoneTime: 15,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalMatches: 11 }),
      }),
    );
  });

  // Destructions moved to `robot_mode_kills`, so this only covers zone score.
  it('should accumulate totalZoneScore', async () => {
    const existing = createStanding({ mode: 'koth', leaguePoints: 50, totalMatches: 5, totalZoneScore: 40, totalZoneTime: 200, bestPlacement: 2 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, totalZoneScore: 48 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 3,
      totalParticipants: 6,
      zoneScore: 8,
      zoneTime: 25,
    });

    expect(mockPrisma.standing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalZoneScore: 48,
        }),
      }),
    );
  });

  it('should update bestPlacement when better placement achieved', async () => {
    const existing = createStanding({ mode: 'koth', leaguePoints: 50, totalMatches: 5, totalZoneScore: 40, totalZoneTime: 200, bestPlacement: 3 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, bestPlacement: 2 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 2,
      totalParticipants: 6,
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
    const existing = createStanding({ mode: 'koth', wins: 3, currentWinStreak: 1, bestWinStreak: 2, currentLoseStreak: 0, leaguePoints: 100, totalMatches: 10, totalZoneScore: 80, totalZoneTime: 400, bestPlacement: 1 });
    givenStanding(existing);
    (mockPrisma.standing.update as jest.Mock).mockResolvedValue({ ...existing, wins: 4, currentWinStreak: 2 });

    await standingsService.awardKothPoints({
      robotId: existing.entityId,
      placement: 1,
      totalParticipants: 6,
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

    const result = await standingsService.getStandings('league_1v1' as StandingsMode, { page: 1, limit: 10 });

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

    await standingsService.getStandings('league_1v1' as StandingsMode, { leagueInstanceId: 'gold_1' });

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
