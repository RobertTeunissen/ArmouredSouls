/**
 * Admin player lists count each battle once per stable.
 *
 * `getEngagementPlayers` (Engagement tab) and `getRecentUserActivity` (Recent
 * Users) summed the per-robot counters per stable, so a team battle counted
 * once per member. They now subtract the shared-side overlap, read for the
 * whole list in one query, exactly as the player dashboard does.
 */

const mockUserFindMany = jest.fn();
const mockUserCount = jest.fn();
const mockQueryRaw = jest.fn();
const mockCycleMetadataFindUnique = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
      count: (...args: unknown[]) => mockUserCount(...args),
    },
    cycleMetadata: { findUnique: (...args: unknown[]) => mockCycleMetadataFindUnique(...args) },
    cycleSnapshot: { findUnique: jest.fn().mockResolvedValue(null) },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

jest.mock('../../standings/robotLeagueTiers', () => ({
  getRobotLeagueTiers: jest.fn().mockResolvedValue(new Map()),
  tierOf: () => 'bronze',
}));

import { getEngagementPlayers } from '../adminDashboardService';
import { getRecentUserActivity } from '../adminSystemStatsService';
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

/** Serve the battles to both services: users with derived counters, and the overlap SQL. */
function serve(battles: FixtureBattle[]): void {
  const counters = robotCountersFrom(battles);
  const users = [1, 2].map((userId) => ({
    id: userId,
    username: `stable${userId}`,
    stableName: null,
    currency: 100_000,
    role: 'user',
    hasCompletedOnboarding: true,
    onboardingSkipped: false,
    onboardingStep: 9,
    onboardingStrategy: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    facilities: [],
    robots: Object.keys(OWNER)
      .map(Number)
      .filter((robotId) => OWNER[robotId] === userId)
      .map((robotId) => ({
        id: robotId,
        name: `R${robotId}`,
        currentHP: 100,
        maxHP: 100,
        elo: 1200,
        battleReadiness: 100,
        mainWeaponId: 1,
        offhandWeaponId: null,
        loadoutType: 'single',
        stance: 'balanced',
        createdAt: new Date(),
        ...(counters.get(robotId) ?? { totalBattles: 0, wins: 0, losses: 0, draws: 0 }),
      })),
  }));
  mockUserFindMany.mockResolvedValue(users);
  mockUserCount.mockResolvedValue(users.length);
  mockQueryRaw.mockImplementation((_strings: TemplateStringsArray, userIds: number[]) =>
    Promise.resolve(sharedSidesFrom(battles, userIds)),
  );
}

async function engagementTotals(): Promise<Record<number, { totalBattles: number; totalWins: number; winRate: number }>> {
  const { players } = await getEngagementPlayers({}, 1, 50);
  return Object.fromEntries(players.map((pl) => [pl.userId, { totalBattles: pl.totalBattles, totalWins: pl.totalWins, winRate: pl.winRate }]));
}

async function recentUserTotals(): Promise<Record<number, { totalBattles: number; totalWins: number; winRate: number }>> {
  const { users } = await getRecentUserActivity(5, 'all');
  return Object.fromEntries(users.map((u) => [u.userId, {
    totalBattles: u.summary.totalBattles,
    totalWins: u.summary.totalWins,
    winRate: u.summary.winRate,
  }]));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCycleMetadataFindUnique.mockResolvedValue({ totalCycles: 10, lastCycleAt: new Date() });
});

describe.each([
  ['getEngagementPlayers', engagementTotals],
  ['getRecentUserActivity', recentUserTotals],
])('%s stable totals', (_name, totals) => {
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

it('reads the overlap for the whole page in one query', async () => {
  serve([]);
  await getEngagementPlayers({}, 1, 50);

  expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  expect(mockQueryRaw.mock.calls[0][1]).toEqual([1, 2]);
});
