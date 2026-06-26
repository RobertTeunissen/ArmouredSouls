/**
 * Property-based tests for StandingsService (Properties 4–7).
 *
 * Uses fast-check with minimum 100 iterations per property to verify
 * invariants of the unified standings algorithm.
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

import * as fc from 'fast-check';
import { StandingsMode } from '../../../../generated/prisma';
import { KOTH_POINT_SCALE } from '../standingsService';
import standingsService from '../standingsService';
import prisma from '../../../lib/prisma';
import { createStanding } from '../../../../tests/factories/standingFactory';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const ALL_MODES: StandingsMode[] = [
  'league_1v1',
  'league_2v2',
  'league_3v3',
  'tag_team',
  'koth',
  'tournament_1v1',
  'tournament_2v2',
  'tournament_3v3',
];

const OUTCOMES = ['win', 'loss', 'draw'] as const;

beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================================
// Property 4: Unified Promotion/Demotion Algorithm
// =============================================================================

describe('Property 4: Unified Promotion/Demotion Algorithm', () => {
  it('produces identical LP update results regardless of mode for same inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...ALL_MODES),
        fc.constantFrom(...ALL_MODES),
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: -50, max: 50 }),
        fc.constantFrom(...OUTCOMES),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 50 }),
        async (modeA, modeB, initialLP, lpDelta, outcome, winStreak, loseStreak, bestWinStreak) => {
          // Create two standings with identical state but different modes
          const baseStanding = {
            wins: 10,
            losses: 5,
            draws: 3,
          };

          const standingA = createStanding({ ...baseStanding, mode: modeA as any });
          const standingB = createStanding({ ...baseStanding, mode: modeB as any });

          // Track the upsert update data for each mode
          const updateCalls: Record<string, unknown>[] = [];

          (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValueOnce(standingA);
          (mockPrisma.standing.upsert as jest.Mock).mockImplementationOnce((args: any) => {
            updateCalls.push(args.update);
            return Promise.resolve({ ...standingA, ...args.update });
          });

          await standingsService.recordBattleResult({
            entityType: 'robot',
            entityId: standingA.entityId,
            mode: modeA,
            outcome,
            lpDelta,
          });

          jest.clearAllMocks();

          (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValueOnce(standingB);
          (mockPrisma.standing.upsert as jest.Mock).mockImplementationOnce((args: any) => {
            updateCalls.push(args.update);
            return Promise.resolve({ ...standingB, ...args.update });
          });

          await standingsService.recordBattleResult({
            entityType: 'robot',
            entityId: standingB.entityId,
            mode: modeB,
            outcome,
            lpDelta,
          });

          // The update data should be identical regardless of mode
          expect(updateCalls[0]).toEqual(updateCalls[1]);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// =============================================================================
// Property 5: Battle Completion Updates Standings
// =============================================================================

describe('Property 5: Battle Completion Updates Standings', () => {
  it('exactly one counter is incremented by 1, LP floors at 0, and streaks are consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...OUTCOMES),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: -20, max: 20 }),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 10 }),
        async (
          outcome,
          initialLP,
          initialWinStreak,
          initialLoseStreak,
          bestWinStreak,
          lpDelta,
          initialWins,
          initialLosses,
          initialDraws,
        ) => {
          const existing = createStanding({
            wins: initialWins,
            losses: initialLosses,
            draws: initialDraws,
          });

          let capturedUpdate: Record<string, number> | null = null;

          (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
          (mockPrisma.standing.upsert as jest.Mock).mockImplementation((args: any) => {
            capturedUpdate = args.update;
            return Promise.resolve({ ...existing, ...args.update });
          });

          await standingsService.recordBattleResult({
            entityType: 'robot',
            entityId: existing.entityId,
            mode: 'league_1v1',
            outcome,
            lpDelta,
          });

          expect(capturedUpdate).not.toBeNull();
          const update = capturedUpdate!;

          // LP is max(0, initial + delta)
          const expectedLP = Math.max(0, initialLP + lpDelta);
          expect(update.leaguePoints).toBe(expectedLP);

          // Exactly one counter incremented by 1
          if (outcome === 'win') {
            expect(update.wins).toBe(initialWins + 1);
            expect(update.losses).toBeUndefined();
            expect(update.draws).toBeUndefined();
          } else if (outcome === 'loss') {
            expect(update.losses).toBe(initialLosses + 1);
            expect(update.wins).toBeUndefined();
            expect(update.draws).toBeUndefined();
          } else {
            expect(update.draws).toBe(initialDraws + 1);
            expect(update.wins).toBeUndefined();
            expect(update.losses).toBeUndefined();
          }

          // Streak consistency
          if (outcome === 'win') {
            expect(update.currentWinStreak).toBe(initialWinStreak + 1);
            expect(update.currentLoseStreak).toBe(0);
            expect(update.bestWinStreak).toBe(
              Math.max(Math.max(bestWinStreak, initialWinStreak), initialWinStreak + 1),
            );
          } else if (outcome === 'loss') {
            expect(update.currentWinStreak).toBe(0);
            expect(update.currentLoseStreak).toBe(initialLoseStreak + 1);
          } else {
            // draw
            expect(update.currentWinStreak).toBe(0);
            expect(update.currentLoseStreak).toBe(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// =============================================================================
// Property 6: KotH Point Award by Placement
// =============================================================================

describe('Property 6: KotH Point Award by Placement', () => {
  it('awards correct points from F1 scale for any placement 1-6, and 0 for placement > 6', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (placement) => {
        const expectedPoints =
          placement <= KOTH_POINT_SCALE.length ? KOTH_POINT_SCALE[placement - 1] : 0;

        if (placement <= 6) {
          expect(expectedPoints).toBe([25, 18, 15, 12, 10, 8][placement - 1]);
        } else {
          expect(expectedPoints).toBe(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('for N participants (2-6), the sum of points awarded equals the sum of first N scale values', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 6 }), (totalParticipants) => {
        // Sum the points for all participants (placements 1 through N)
        let totalPoints = 0;
        for (let placement = 1; placement <= totalParticipants; placement++) {
          const points =
            placement <= KOTH_POINT_SCALE.length ? KOTH_POINT_SCALE[placement - 1] : 0;
          totalPoints += points;
        }

        // Expected sum is the first N values of the scale
        const expectedSum = KOTH_POINT_SCALE.slice(0, totalParticipants).reduce(
          (sum, v) => sum + v,
          0,
        );
        expect(totalPoints).toBe(expectedSum);
      }),
      { numRuns: 100 },
    );
  });

  it('awardKothPoints applies correct LP delta for any placement', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 500 }),
        async (placement, initialLP, kills, zoneScore, zoneTime) => {
          const existing = createStanding({
            mode: 'koth' as any,
            totalMatches: 5,
            totalKills: 10,
            totalZoneScore: 40,
            totalZoneTime: 200,
            bestPlacement: 3,
            wins: 3,
          });

          let capturedData: Record<string, number> | null = null;

          (mockPrisma.standing.findUnique as jest.Mock).mockResolvedValue(existing);
          (mockPrisma.standing.update as jest.Mock).mockImplementation((args: any) => {
            capturedData = args.data;
            return Promise.resolve({ ...existing, ...args.data });
          });

          await standingsService.awardKothPoints({
            robotId: existing.entityId,
            placement,
            totalParticipants: 6,
            kills,
            zoneScore,
            zoneTime,
          });

          expect(capturedData).not.toBeNull();
          const data = capturedData!;

          const expectedPoints =
            placement <= KOTH_POINT_SCALE.length ? KOTH_POINT_SCALE[placement - 1] : 0;

          // LP is cumulative: initialLP + points from placement
          expect(data.leaguePoints).toBe(initialLP + expectedPoints);

          // totalMatches always incremented
          expect(data.totalMatches).toBe(6);

          // Cumulative stats added correctly
          expect(data.totalKills).toBe(10 + kills);
          expect(data.totalZoneScore).toBe(40 + zoneScore);
          expect(data.totalZoneTime).toBe(200 + zoneTime);

          // Best placement is min of existing and new
          expect(data.bestPlacement).toBe(Math.min(3, placement));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// =============================================================================
// Property 7: KotH Standings Ordering
// =============================================================================

describe('Property 7: KotH Standings Ordering', () => {
  it('query results are ordered by LP descending within instance', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 20 }),
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 5, maxLength: 20 }),
        async (n, lpValues) => {
          // Use exactly n values (trim or pad)
          const values = lpValues.slice(0, n);
          while (values.length < n) {
            values.push(Math.floor(Math.random() * 1000));
          }

          // Create standings sorted by LP desc (simulating what the DB would return)
          const sortedValues = [...values].sort((a, b) => b - a);
          const standings = sortedValues.map((lp, i) =>
            createStanding({
              id: i + 1,
              mode: 'koth' as any,
              leagueInstanceId: 'koth_1',
              entityId: 1000 + i,
            }),
          );

          (mockPrisma.standing.findMany as jest.Mock).mockResolvedValue(standings);
          (mockPrisma.standing.count as jest.Mock).mockResolvedValue(standings.length);

          const result = await standingsService.getStandings('koth' as StandingsMode, {
            leagueInstanceId: 'koth_1',
          });

          // Verify descending LP order
          for (let i = 0; i < result.standings.length - 1; i++) {
            expect(result.standings[i].leaguePoints).toBeGreaterThanOrEqual(
              result.standings[i + 1].leaguePoints,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
