/**
 * The Players page counts each battle once per stable.
 *
 * Summing the per-robot counters per stable counts a team battle once per
 * member, so `getPlayersOverview` subtracts the shared-side overlap, read for
 * the whole list in one query, exactly as the player dashboard does.
 */

const mockUserFindMany = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findMany: (...args: unknown[]) => mockUserFindMany(...args) },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

jest.mock('../../season/seasonService', () => ({
  getCurrentSeason: jest.fn().mockResolvedValue({ seasonNumber: 1 }),
}));

jest.mock('../../season/dormantStables', () => ({
  ...jest.requireActual('../../season/dormantStables'),
  seasonStartedAt: jest.fn().mockResolvedValue(new Date('2026-08-01T00:00:00Z')),
}));

import { getPlayersOverview } from '../adminPlayersService';
import {
  robotCountersFrom,
  sharedSidesFrom,
  type FixtureBattle,
} from '../../../../tests/helpers/stableBattleFixture';

// Stable 1 owns robots 11-14; stable 2 owns robots 21, 22.
const OWNER: Record<number, number> = { 11: 1, 12: 1, 13: 1, 14: 1, 21: 2, 22: 2 };

function p(robotId: number, team: number) {
  return { robotId, userId: OWNER[robotId], team };
}

/** Serve the battles: users with derived counters, and the overlap SQL. */
function serve(battles: FixtureBattle[]): void {
  const counters = robotCountersFrom(battles);
  const users = [1, 2].map((userId) => ({
    id: userId,
    username: `stable${userId}`,
    stableName: null,
    currency: 100_000,
    hasCompletedOnboarding: true,
    onboardingSkipped: false,
    onboardingStep: 9,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    robots: Object.keys(OWNER)
      .map(Number)
      .filter((robotId) => OWNER[robotId] === userId)
      .map((robotId) => {
        const c = counters.get(robotId) ?? { totalBattles: 0, wins: 0 };
        return { battleReadiness: 100, mainWeaponId: 1, totalBattles: c.totalBattles, wins: c.wins };
      }),
  }));
  mockUserFindMany.mockResolvedValue(users);
  mockQueryRaw.mockImplementation((_strings: TemplateStringsArray, userIds: number[]) =>
    Promise.resolve(sharedSidesFrom(battles, userIds)),
  );
}

async function playerTotals(): Promise<Record<number, { totalBattles: number; totalWins: number; winRate: number }>> {
  const { players } = await getPlayersOverview();
  return Object.fromEntries(players.map((pl) => [pl.userId, { totalBattles: pl.battles, totalWins: pl.wins, winRate: pl.winRate ?? 0 }]));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getPlayersOverview stable totals', () => {
  const totals = playerTotals;
  it('counts a tag-team battle between two stable pairs once for each stable (was 2)', async () => {
    // Stable 1's pair (11 active, 12 reserve) beat stable 2's pair (21, 22).
    serve([{ id: 1, battleType: 'tag_team', winnerId: 11, winningSide: 1, participants: [p(11, 1), p(12, 1), p(21, 2), p(22, 2)] }]);

    await expect(totals()).resolves.toEqual({
      1: { totalBattles: 1, totalWins: 1, winRate: 100 },
      2: { totalBattles: 1, totalWins: 0, winRate: 0 },
    });
  });

  it('keeps one win and one loss when two of the same stable\'s teams meet', async () => {
    // Stable 1's team (11, 12) beat stable 1's other team (13, 14) in a 2v2 tournament.
    serve([{ id: 2, battleType: 'tournament_2v2', winnerId: 11, winningSide: 1, participants: [p(11, 1), p(12, 1), p(13, 2), p(14, 2)] }]);

    await expect(totals()).resolves.toEqual({
      1: { totalBattles: 2, totalWins: 1, winRate: 50 },
      2: { totalBattles: 0, totalWins: 0, winRate: 0 },
    });
  });

  it('counts 2v2 and 3v3 League battles once per stable, alongside 1v1', async () => {
    serve([
      { id: 3, battleType: 'league_2v2', winnerId: 21, winningSide: 2, participants: [p(11, 1), p(12, 1), p(21, 2), p(22, 2)] },
      { id: 4, battleType: 'league_3v3', winnerId: 11, winningSide: 1, participants: [p(11, 1), p(12, 1), p(13, 1), p(21, 2), p(22, 2)] },
      { id: 5, battleType: 'league_1v1', winnerId: 13, winningSide: null, participants: [p(13, 1), p(21, 2)] },
    ]);

    await expect(totals()).resolves.toEqual({
      1: { totalBattles: 3, totalWins: 2, winRate: 67 },
      2: { totalBattles: 3, totalWins: 1, winRate: 33 },
    });
  });

  it('still counts byes as battles: a 1v1 bye and a 2v2 bye each count once', async () => {
    serve([
      { id: 6, battleType: 'league_1v1', winnerId: 11, winningSide: null, participants: [p(11, 1)] },
      { id: 7, battleType: 'league_2v2', winnerId: 11, winningSide: 1, participants: [p(11, 1), p(12, 1)] },
      // A team-tournament bye never touches the counters, so nothing is subtracted for it.
      { id: 9, battleType: 'tournament_2v2', winnerId: 11, winningSide: 1, participants: [p(11, 1), p(12, 1)] },
    ]);

    await expect(totals()).resolves.toMatchObject({ 1: { totalBattles: 2, totalWins: 2, winRate: 100 } });
  });

  it('keeps placement modes out of the W/L totals', async () => {
    serve([{ id: 8, battleType: 'koth', winnerId: 11, winningSide: null, participants: [p(11, 1), p(12, 2), p(21, 3)] }]);

    await expect(totals()).resolves.toMatchObject({ 1: { totalBattles: 0, totalWins: 0 } });
  });
});

it('reads the overlap for the whole list in one query', async () => {
  serve([]);
  await getPlayersOverview();

  expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  expect(mockQueryRaw.mock.calls[0][1]).toEqual([1, 2]);
});
