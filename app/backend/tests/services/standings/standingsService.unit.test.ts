/**
 * Unit tests for Standings Service.
 *
 * Tests the unified standings management across all competitive modes:
 * - recordBattleResult (win/loss/draw with LP and streak tracking)
 * - awardKothPoints (KotH F1-style point scale)
 * - awardGrandMeleePoints (Grand Melee F1-style point scale)
 * - getOrCreateStanding (idempotent initialization)
 * - getStandings (paginated query)
 * - getEntityStandings (per-entity multi-mode query)
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockStandingFindUnique = jest.fn();
const mockStandingFindMany = jest.fn();
const mockStandingCreate = jest.fn();
const mockStandingUpdate = jest.fn();
const mockStandingUpsert = jest.fn();
const mockStandingCount = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    standing: {
      findUnique: (...args: unknown[]) => mockStandingFindUnique(...args),
      findMany: (...args: unknown[]) => mockStandingFindMany(...args),
      create: (...args: unknown[]) => mockStandingCreate(...args),
      update: (...args: unknown[]) => mockStandingUpdate(...args),
      upsert: (...args: unknown[]) => mockStandingUpsert(...args),
      count: (...args: unknown[]) => mockStandingCount(...args),
    },
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import standingsService, { getOrCreateStanding, KOTH_POINT_SCALE, GRAND_MELEE_POINT_SCALE } from '../../../src/services/standings/standingsService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStanding(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    entityType: 'robot',
    entityId: 1,
    mode: 'league_1v1',
    tier: 'bronze',
    leagueInstanceId: 'bronze_1',
    leaguePoints: 50,
    cyclesInTier: 0,
    wins: 5,
    losses: 3,
    draws: 1,
    currentWinStreak: 2,
    bestWinStreak: 4,
    currentLoseStreak: 0,
    totalMatches: null,
    totalKills: null,
    totalZoneScore: null,
    totalZoneTime: null,
    bestPlacement: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getOrCreateStanding', () => {
  it('should return existing standing if found', async () => {
    const existing = makeStanding();
    mockStandingFindUnique.mockResolvedValue(existing);

    const result = await getOrCreateStanding('robot', 1, 'league_1v1' as any);

    expect(result).toBe(existing);
    expect(mockStandingCreate).not.toHaveBeenCalled();
  });

  it('should create and return a new standing if not found', async () => {
    mockStandingFindUnique.mockResolvedValue(null);
    const created = makeStanding({ leaguePoints: 0, wins: 0, losses: 0, draws: 0 });
    mockStandingCreate.mockResolvedValue(created);

    const result = await getOrCreateStanding('robot', 42, 'koth' as any);

    expect(result).toEqual(created);
    expect(mockStandingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'robot',
          entityId: 42,
          mode: 'koth',
          tier: 'bronze',
          leaguePoints: 0,
        }),
      }),
    );
  });
});

describe('recordBattleResult', () => {
  it('should increment wins and win streak on win', async () => {
    const current = makeStanding({ leaguePoints: 50, wins: 5, currentWinStreak: 2, bestWinStreak: 4, currentLoseStreak: 0 });
    mockStandingFindUnique.mockResolvedValue(current);
    const updated = makeStanding({ leaguePoints: 60, wins: 6, currentWinStreak: 3, bestWinStreak: 4, currentLoseStreak: 0 });
    mockStandingUpsert.mockResolvedValue(updated);

    const result = await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: 1,
      mode: 'league_1v1' as any,
      outcome: 'win',
      lpDelta: 10,
    });

    expect(result.leaguePoints).toBe(60);
    expect(mockStandingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          wins: 6,
          currentWinStreak: 3,
          bestWinStreak: 4,
          currentLoseStreak: 0,
          leaguePoints: 60,
        }),
      }),
    );
  });

  it('should update bestWinStreak when new streak exceeds it', async () => {
    const current = makeStanding({ currentWinStreak: 4, bestWinStreak: 4 });
    mockStandingFindUnique.mockResolvedValue(current);
    mockStandingUpsert.mockResolvedValue(makeStanding({ currentWinStreak: 5, bestWinStreak: 5 }));

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: 1,
      mode: 'league_1v1' as any,
      outcome: 'win',
      lpDelta: 10,
    });

    expect(mockStandingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          currentWinStreak: 5,
          bestWinStreak: 5,
        }),
      }),
    );
  });

  it('should increment losses and lose streak on loss, reset win streak', async () => {
    const current = makeStanding({ losses: 3, currentLoseStreak: 0, currentWinStreak: 2, leaguePoints: 50 });
    mockStandingFindUnique.mockResolvedValue(current);
    mockStandingUpsert.mockResolvedValue(makeStanding({ losses: 4, currentLoseStreak: 1, currentWinStreak: 0, leaguePoints: 42 }));

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: 1,
      mode: 'league_1v1' as any,
      outcome: 'loss',
      lpDelta: -8,
    });

    expect(mockStandingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          losses: 4,
          currentLoseStreak: 1,
          currentWinStreak: 0,
          leaguePoints: 42,
        }),
      }),
    );
  });

  it('should enforce LP floor at 0 on large negative delta', async () => {
    const current = makeStanding({ leaguePoints: 5 });
    mockStandingFindUnique.mockResolvedValue(current);
    mockStandingUpsert.mockResolvedValue(makeStanding({ leaguePoints: 0 }));

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: 1,
      mode: 'league_1v1' as any,
      outcome: 'loss',
      lpDelta: -20,
    });

    expect(mockStandingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          leaguePoints: 0, // floor at 0, not -15
        }),
      }),
    );
  });

  it('should reset both streaks on draw', async () => {
    const current = makeStanding({ currentWinStreak: 3, currentLoseStreak: 0, draws: 1, leaguePoints: 50 });
    mockStandingFindUnique.mockResolvedValue(current);
    mockStandingUpsert.mockResolvedValue(makeStanding({ currentWinStreak: 0, currentLoseStreak: 0, draws: 2 }));

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: 1,
      mode: 'league_1v1' as any,
      outcome: 'draw',
      lpDelta: 2,
    });

    expect(mockStandingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          draws: 2,
          currentWinStreak: 0,
          currentLoseStreak: 0,
          leaguePoints: 52,
        }),
      }),
    );
  });

  it('should work for team entities', async () => {
    const current = makeStanding({ entityType: 'team', entityId: 7, mode: 'league_2v2' });
    mockStandingFindUnique.mockResolvedValue(current);
    mockStandingUpsert.mockResolvedValue(current);

    await standingsService.recordBattleResult({
      entityType: 'team',
      entityId: 7,
      mode: 'league_2v2' as any,
      outcome: 'win',
      lpDelta: 15,
    });

    expect(mockStandingFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType_entityId_mode: { entityType: 'team', entityId: 7, mode: 'league_2v2' } },
      }),
    );
  });
});

describe('awardKothPoints', () => {
  it('should award points from F1 scale for 1st place', async () => {
    const current = makeStanding({ mode: 'koth', leaguePoints: 20, totalMatches: 5, totalKills: 3, totalZoneScore: 100, totalZoneTime: 60, bestPlacement: 2, currentWinStreak: 0, wins: 1, bestWinStreak: 1 });
    mockStandingFindUnique.mockResolvedValue(current);
    mockStandingUpdate.mockResolvedValue({ ...current, leaguePoints: 30 });

    await standingsService.awardKothPoints({
      robotId: 1,
      placement: 1,
      totalParticipants: 6,
      kills: 2,
      zoneScore: 50,
      zoneTime: 30,
    });

    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaguePoints: 30, // 20 + 10 (1st place)
          totalMatches: 6,
          totalKills: 5,
          totalZoneScore: 150,
          totalZoneTime: 90,
          bestPlacement: 1,
          wins: 2,
          currentWinStreak: 1,
        }),
      }),
    );
  });

  it('should award 0 points for 6th place', async () => {
    const current = makeStanding({ mode: 'koth', leaguePoints: 20, totalMatches: 5, totalKills: 0, totalZoneScore: 0, totalZoneTime: 0, bestPlacement: 3 });
    mockStandingFindUnique.mockResolvedValue(current);
    mockStandingUpdate.mockResolvedValue(current);

    await standingsService.awardKothPoints({
      robotId: 1,
      placement: 6,
      totalParticipants: 6,
      kills: 0,
      zoneScore: 5,
      zoneTime: 2,
    });

    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaguePoints: 20, // 20 + 0 (6th place)
          bestPlacement: 3, // 3 is better than 6
        }),
      }),
    );
  });

  it('should update bestPlacement when new placement is better', async () => {
    const current = makeStanding({ mode: 'koth', bestPlacement: 3, totalMatches: 10, totalKills: 5, totalZoneScore: 200, totalZoneTime: 100, leaguePoints: 50 });
    mockStandingFindUnique.mockResolvedValue(current);
    mockStandingUpdate.mockResolvedValue({ ...current, bestPlacement: 1 });

    await standingsService.awardKothPoints({
      robotId: 1,
      placement: 1,
      totalParticipants: 6,
      kills: 3,
      zoneScore: 80,
      zoneTime: 50,
    });

    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bestPlacement: 1, // improved from 3 to 1
        }),
      }),
    );
  });

  it('should have correct point scale values', () => {
    expect(KOTH_POINT_SCALE).toEqual([10, 6, 4, 2, 1, 0]);
  });
});

describe('awardGrandMeleePoints', () => {
  it('should award 25 LP for 1st place', async () => {
    const current = makeStanding({ mode: 'grand_melee', leaguePoints: 100, totalMatches: 3, totalKills: 5, totalZoneScore: 1000, totalZoneTime: 300, bestPlacement: 2, wins: 1, currentWinStreak: 0, bestWinStreak: 1, currentLoseStreak: 0 });
    mockStandingFindUnique.mockResolvedValue(current);
    mockStandingUpdate.mockResolvedValue({ ...current, leaguePoints: 125 });

    await standingsService.awardGrandMeleePoints({
      robotId: 1,
      placement: 1,
      totalParticipants: 20,
      kills: 4,
      damageDealt: 500,
      survivalTime: 120,
    });

    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaguePoints: 125, // 100 + 25
          totalMatches: 4,
          totalKills: 9,
          totalZoneScore: 1500, // reused for damage dealt
          totalZoneTime: 420, // reused for survival time
          bestPlacement: 1,
          wins: 2,
          currentWinStreak: 1,
        }),
      }),
    );
  });

  it('should award 0 LP for 11th+ place', async () => {
    const current = makeStanding({ mode: 'grand_melee', leaguePoints: 50, totalMatches: 1, totalKills: 0, totalZoneScore: 100, totalZoneTime: 60, bestPlacement: 15, currentWinStreak: 1 });
    mockStandingFindUnique.mockResolvedValue(current);
    mockStandingUpdate.mockResolvedValue(current);

    await standingsService.awardGrandMeleePoints({
      robotId: 1,
      placement: 15,
      totalParticipants: 20,
      kills: 0,
      damageDealt: 30,
      survivalTime: 20,
    });

    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaguePoints: 50, // no change for 15th place
          currentWinStreak: 0, // reset because not 1st
        }),
      }),
    );
  });

  it('should have correct F1 point scale', () => {
    expect(GRAND_MELEE_POINT_SCALE).toEqual([25, 18, 15, 12, 10, 8, 6, 4, 2, 1]);
  });
});

describe('getStandings', () => {
  it('should return paginated standings with default page size', async () => {
    const standings = [makeStanding(), makeStanding({ entityId: 2 })];
    mockStandingFindMany.mockResolvedValue(standings);
    mockStandingCount.mockResolvedValue(2);

    const result = await standingsService.getStandings('league_1v1' as any);

    expect(result.standings).toHaveLength(2);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 50,
      total: 2,
      totalPages: 1,
    });
  });

  it('should apply tier and instance filters', async () => {
    mockStandingFindMany.mockResolvedValue([]);
    mockStandingCount.mockResolvedValue(0);

    await standingsService.getStandings('koth' as any, {
      tier: 'gold',
      leagueInstanceId: 'gold_1',
      page: 2,
      limit: 10,
    });

    expect(mockStandingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { mode: 'koth', tier: 'gold', leagueInstanceId: 'gold_1' },
        skip: 10,
        take: 10,
      }),
    );
  });
});

describe('getEntityStandings', () => {
  it('should return all standings for a robot across modes', async () => {
    const standings = [
      makeStanding({ mode: 'league_1v1' }),
      makeStanding({ mode: 'koth' }),
      makeStanding({ mode: 'grand_melee' }),
    ];
    mockStandingFindMany.mockResolvedValue(standings);

    const result = await standingsService.getEntityStandings('robot', 1);

    expect(result).toHaveLength(3);
    expect(mockStandingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType: 'robot', entityId: 1 },
      }),
    );
  });
});
