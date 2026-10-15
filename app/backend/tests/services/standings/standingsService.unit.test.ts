/**
 * Unit tests for Standings Service.
 *
 * Tests the unified standings management across all competitive modes:
 * - recordBattleResult (win/loss/draw with LP and streak tracking)
 * - awardKothPoints (KotH F1-style point scale)
 * - awardGrandMeleePoints (Grand Melee F1-style point scale)
 * - getOrCreateStanding (safety net placing through standingPlacement.ensureStanding)
 * - getStandings (paginated query)
 * - getEntityStandings (per-entity multi-mode query)
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockStandingFindUnique = jest.fn();
const mockStandingFindMany = jest.fn();
const mockStandingCreate = jest.fn();
const mockStandingUpdate = jest.fn();
const mockStandingCount = jest.fn();
const mockTransaction = jest.fn();
const mockLoggerWarn = jest.fn();

/** The prisma singleton mock; `$transaction` hands it to the callback as `tx`. */
const mockPrismaClient = {
  standing: {
    findUnique: (...args: unknown[]) => mockStandingFindUnique(...args),
    findMany: (...args: unknown[]) => mockStandingFindMany(...args),
    create: (...args: unknown[]) => mockStandingCreate(...args),
    update: (...args: unknown[]) => mockStandingUpdate(...args),
    count: (...args: unknown[]) => mockStandingCount(...args),
  },
  $transaction: (...args: unknown[]) => mockTransaction(...args),
};

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrismaClient,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: (...args: unknown[]) => mockLoggerWarn(...args), error: jest.fn(), debug: jest.fn() },
}));

// Placement (instance pick, locks, skipDuplicates) is covered by the
// standingPlacement suites; here it is a stub returning the row to update.
const mockEnsureStanding = jest.fn();
jest.mock('../../../src/services/standings/standingPlacement', () => ({
  __esModule: true,
  ...jest.requireActual('../../../src/services/standings/standingPlacement'),
  ensureStanding: (...args: unknown[]) => mockEnsureStanding(...args),
}));

import * as fc from 'fast-check';
import standingsService, { getOrCreateStanding, KOTH_POINT_SCALE } from '../../../src/services/standings/standingsService';
// Spec #49: the Grand Melee placement scale is declared once, in the rewards
// module, and imported by the Standings_Service. The former
// GRAND_MELEE_POINT_SCALE duplicate in standingsService is gone.
import { GRAND_MELEE_LP_SCALE } from '../../../src/services/grand-melee/grandMeleeRewards';

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
    totalZoneScore: null,
    totalZoneTime: null,
    bestPlacement: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

/** The standing the placement rule returns for the entity (already existing). */
function givenStanding(standing: ReturnType<typeof makeStanding>): void {
  mockEnsureStanding.mockResolvedValue({ standing, created: false });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockPrismaClient));
});

describe('getOrCreateStanding', () => {
  it('should return the existing standing through the placement rule without warning', async () => {
    const existing = makeStanding();
    givenStanding(existing);

    const result = await getOrCreateStanding('robot', 1, 'league_1v1' as any);

    expect(result).toBe(existing);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockEnsureStanding).toHaveBeenCalledWith(mockPrismaClient, 'robot', 1, 'league_1v1');
    expect(mockStandingCreate).not.toHaveBeenCalled();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('should place a missing standing through the placement rule and warn', async () => {
    const created = makeStanding({ entityId: 42, mode: 'koth', leagueInstanceId: 'bronze_3', leaguePoints: 0 });
    mockEnsureStanding.mockResolvedValue({ standing: created, created: true });

    const result = await getOrCreateStanding('robot', 42, 'koth' as any);

    expect(result).toEqual(created);
    expect(mockEnsureStanding).toHaveBeenCalledWith(mockPrismaClient, 'robot', 42, 'koth');
    // No hard-coded instance: the row comes from the placement rule only.
    expect(mockStandingCreate).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith('[Standings] Safety net created a missing standing', {
      entityType: 'robot',
      entityId: 42,
      mode: 'koth',
      leagueInstanceId: 'bronze_3',
    });
  });

  it('should run inside the caller transaction when one is given', async () => {
    const tx = { standing: {} };
    const existing = makeStanding({ entityType: 'team', entityId: 7, mode: 'tag_team' });
    givenStanding(existing);

    await getOrCreateStanding('team', 7, 'tag_team' as any, tx as any);

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockEnsureStanding).toHaveBeenCalledWith(tx, 'team', 7, 'tag_team');
  });

  it('should find-or-create a tournament standing (no league instances) and warn on create', async () => {
    mockStandingFindUnique.mockResolvedValue(null);
    const created = makeStanding({ mode: 'tournament_1v1', leaguePoints: 0 });
    mockStandingCreate.mockResolvedValue(created);

    const result = await getOrCreateStanding('robot', 1, 'tournament_1v1' as any);

    expect(result).toBe(created);
    expect(mockEnsureStanding).not.toHaveBeenCalled();
    expect(mockStandingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entityType: 'robot', entityId: 1, mode: 'tournament_1v1', leaguePoints: 0 }),
      }),
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[Standings] Safety net created a missing standing',
      expect.objectContaining({ entityType: 'robot', entityId: 1, mode: 'tournament_1v1' }),
    );
  });
});

describe('recordBattleResult', () => {
  it('should increment wins and win streak on win', async () => {
    const current = makeStanding({ leaguePoints: 50, wins: 5, currentWinStreak: 2, bestWinStreak: 4, currentLoseStreak: 0 });
    givenStanding(current);
    const updated = makeStanding({ leaguePoints: 60, wins: 6, currentWinStreak: 3, bestWinStreak: 4, currentLoseStreak: 0 });
    mockStandingUpdate.mockResolvedValue(updated);

    const result = await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: 1,
      mode: 'league_1v1' as any,
      outcome: 'win',
      lpDelta: 10,
    });

    expect(result.leaguePoints).toBe(60);
    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
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
    givenStanding(current);
    mockStandingUpdate.mockResolvedValue(makeStanding({ currentWinStreak: 5, bestWinStreak: 5 }));

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: 1,
      mode: 'league_1v1' as any,
      outcome: 'win',
      lpDelta: 10,
    });

    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentWinStreak: 5,
          bestWinStreak: 5,
        }),
      }),
    );
  });

  it('should increment losses and lose streak on loss, reset win streak', async () => {
    const current = makeStanding({ losses: 3, currentLoseStreak: 0, currentWinStreak: 2, leaguePoints: 50 });
    givenStanding(current);
    mockStandingUpdate.mockResolvedValue(makeStanding({ losses: 4, currentLoseStreak: 1, currentWinStreak: 0, leaguePoints: 42 }));

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: 1,
      mode: 'league_1v1' as any,
      outcome: 'loss',
      lpDelta: -8,
    });

    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
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
    givenStanding(current);
    mockStandingUpdate.mockResolvedValue(makeStanding({ leaguePoints: 0 }));

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: 1,
      mode: 'league_1v1' as any,
      outcome: 'loss',
      lpDelta: -20,
    });

    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaguePoints: 0, // floor at 0, not -15
        }),
      }),
    );
  });

  it('should reset both streaks on draw', async () => {
    const current = makeStanding({ currentWinStreak: 3, currentLoseStreak: 0, draws: 1, leaguePoints: 50 });
    givenStanding(current);
    mockStandingUpdate.mockResolvedValue(makeStanding({ currentWinStreak: 0, currentLoseStreak: 0, draws: 2 }));

    await standingsService.recordBattleResult({
      entityType: 'robot',
      entityId: 1,
      mode: 'league_1v1' as any,
      outcome: 'draw',
      lpDelta: 2,
    });

    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
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
    givenStanding(current);
    mockStandingUpdate.mockResolvedValue(current);

    await standingsService.recordBattleResult({
      entityType: 'team',
      entityId: 7,
      mode: 'league_2v2' as any,
      outcome: 'win',
      lpDelta: 15,
    });

    expect(mockEnsureStanding).toHaveBeenCalledWith(mockPrismaClient, 'team', 7, 'league_2v2');
    // The row is updated by id; nothing is upserted or created here.
    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: current.id } }),
    );
    expect(mockStandingCreate).not.toHaveBeenCalled();
  });
});

describe('awardKothPoints', () => {
  it('should award points from F1 scale for 1st place', async () => {
    const current = makeStanding({ mode: 'koth', leaguePoints: 20, totalMatches: 5, totalZoneScore: 100, totalZoneTime: 60, bestPlacement: 2, currentWinStreak: 0, wins: 1, bestWinStreak: 1 });
    givenStanding(current);
    mockStandingUpdate.mockResolvedValue({ ...current, leaguePoints: 30 });

    await standingsService.awardKothPoints({
      robotId: 1,
      placement: 1,
      totalParticipants: 6,
      zoneScore: 50,
      zoneTime: 30,
    });

    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaguePoints: 30, // 20 + 10 (1st place)
          totalMatches: 6,
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
    const current = makeStanding({ mode: 'koth', leaguePoints: 20, totalMatches: 5, totalZoneScore: 0, totalZoneTime: 0, bestPlacement: 3 });
    givenStanding(current);
    mockStandingUpdate.mockResolvedValue(current);

    await standingsService.awardKothPoints({
      robotId: 1,
      placement: 6,
      totalParticipants: 6,
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
    const current = makeStanding({ mode: 'koth', bestPlacement: 3, totalMatches: 10, totalZoneScore: 200, totalZoneTime: 100, leaguePoints: 50 });
    givenStanding(current);
    mockStandingUpdate.mockResolvedValue({ ...current, bestPlacement: 1 });

    await standingsService.awardKothPoints({
      robotId: 1,
      placement: 1,
      totalParticipants: 6,
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

  // Rule 4: a forfeiter is placed last and earns nothing, but the match counts.
  it('should award 0 points to a forfeiter at any placement, never a win, and still count the match', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 50 }),
        async (placement, leaguePoints, totalMatches) => {
          const current = makeStanding({ mode: 'koth', leaguePoints, totalMatches, totalZoneScore: 10, totalZoneTime: 5, bestPlacement: 3, wins: 2, currentWinStreak: 1 });
          givenStanding(current);
          mockStandingUpdate.mockClear();
          mockStandingUpdate.mockResolvedValue(current);

          await standingsService.awardKothPoints({
            robotId: 1, placement, totalParticipants: 6, zoneScore: 0, zoneTime: 0, forfeited: true,
          });

          const { data } = mockStandingUpdate.mock.calls[0][0] as { data: Record<string, number> };
          expect(data.leaguePoints).toBe(leaguePoints);
          expect(data.totalMatches).toBe(totalMatches + 1);
          expect(data.totalZoneScore).toBe(10);
          expect(data.totalZoneTime).toBe(5);
          // A forfeit never counts as a win or a best finish, even in placement 1.
          expect(data.wins).toBeUndefined();
          expect(data.currentWinStreak).toBeUndefined();
          expect(data.bestPlacement).toBeUndefined();
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe('awardGrandMeleePoints', () => {
  it('should award 25 LP for 1st place', async () => {
    const current = makeStanding({ mode: 'grand_melee', leaguePoints: 100, totalMatches: 3, totalZoneScore: 1000, totalZoneTime: 300, bestPlacement: 2, wins: 1, currentWinStreak: 0, bestWinStreak: 1, currentLoseStreak: 0 });
    givenStanding(current);
    mockStandingUpdate.mockResolvedValue({ ...current, leaguePoints: 125 });

    await standingsService.awardGrandMeleePoints({
      robotId: 1,
      placement: 1,
      totalParticipants: 20,
      damageDealt: 500,
      survivalTime: 120,
    });

    expect(mockStandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaguePoints: 125, // 100 + 25
          totalMatches: 4,
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
    const current = makeStanding({ mode: 'grand_melee', leaguePoints: 50, totalMatches: 1, totalZoneScore: 100, totalZoneTime: 60, bestPlacement: 15, currentWinStreak: 1 });
    givenStanding(current);
    mockStandingUpdate.mockResolvedValue(current);

    await standingsService.awardGrandMeleePoints({
      robotId: 1,
      placement: 15,
      totalParticipants: 20,
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
    expect(GRAND_MELEE_LP_SCALE).toEqual([25, 18, 15, 12, 10, 8, 6, 4, 2, 1]);
  });

  // Rule 4: a forfeiter is placed last and earns nothing, but the match counts
  // and, as for any non-first finish, the win streak resets.
  it('should award 0 LP to a forfeiter at any placement, never a win, reset the win streak and count the match', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 50 }),
        async (placement, leaguePoints, totalMatches) => {
          const current = makeStanding({ mode: 'grand_melee', leaguePoints, totalMatches, totalZoneScore: 10, totalZoneTime: 5, bestPlacement: 3, wins: 2, currentWinStreak: 2 });
          givenStanding(current);
          mockStandingUpdate.mockClear();
          mockStandingUpdate.mockResolvedValue(current);

          await standingsService.awardGrandMeleePoints({
            robotId: 1, placement, totalParticipants: 20, damageDealt: 0, survivalTime: 0, forfeited: true,
          });

          const { data } = mockStandingUpdate.mock.calls[0][0] as { data: Record<string, number> };
          expect(data.leaguePoints).toBe(leaguePoints);
          expect(data.totalMatches).toBe(totalMatches + 1);
          expect(data.wins).toBeUndefined();
          expect(data.currentWinStreak).toBe(0);
          expect(data.bestPlacement).toBeUndefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  // Spec #49: the LP a player is shown and the LP a player is given came from
  // two separate declarations of these ten numbers. This asserts they are now
  // one, across the module boundary, for every placement including past the end.
  it('should award exactly the lpDelta the shared scale declares, for every placement', async () => {
    const startingLp = 100;

    for (let placement = 1; placement <= 25; placement++) {
      const expectedDelta =
        placement <= GRAND_MELEE_LP_SCALE.length ? GRAND_MELEE_LP_SCALE[placement - 1] : 0;

      const current = makeStanding({
        mode: 'grand_melee',
        leaguePoints: startingLp,
        totalMatches: 0,
        totalZoneScore: 0,
        totalZoneTime: 0,
        bestPlacement: 99,
      });
      givenStanding(current);
      mockStandingUpdate.mockResolvedValue(current);
      mockStandingUpdate.mockClear();

      await standingsService.awardGrandMeleePoints({
        robotId: 1,
        placement,
        totalParticipants: 20,
        damageDealt: 0,
        survivalTime: 0,
      });

      expect(mockStandingUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ leaguePoints: startingLp + expectedDelta }),
        }),
      );
    }
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
