/**
 * Stable_Season_Archive totals count each battle once per stable.
 *
 * The archive summed the per-robot counters per stable, so a team battle was
 * archived once per member. It now subtracts the shared-side overlap, read for
 * each archive batch in one query, before anything is purged (so the overlap is
 * scoped to the season being archived). Robot_Season_Archive rows keep the
 * per-robot counters unchanged.
 */

const mockUserFindMany = jest.fn();
const mockRobotFindMany = jest.fn();
const mockQueryRaw = jest.fn();
const mockStableArchiveFindUnique = jest.fn();
const mockStableArchiveCreate = jest.fn();
const mockRobotArchiveCreate = jest.fn();

jest.mock('../../../lib/prisma', () => {
  const tx = {
    stableSeasonArchive: {
      findUnique: (...args: unknown[]) => mockStableArchiveFindUnique(...args),
      create: (...args: unknown[]) => mockStableArchiveCreate(...args),
    },
    robotSeasonArchive: { create: (...args: unknown[]) => mockRobotArchiveCreate(...args) },
  };
  return {
    __esModule: true,
    default: {
      user: { findMany: (...args: unknown[]) => mockUserFindMany(...args) },
      robot: { findMany: (...args: unknown[]) => mockRobotFindMany(...args) },
      facility: { findMany: jest.fn().mockResolvedValue([]) },
      userAchievement: { findMany: jest.fn().mockResolvedValue([]) },
      teamBattle: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

import { writeStableAndRobotArchives } from '../seasonArchiveService';
import {
  robotCountersFrom,
  sharedSidesFrom,
  type FixtureBattle,
} from '../../../../tests/helpers/stableBattleFixture';

const OWNER: Record<number, number> = { 11: 1, 12: 1, 13: 1, 21: 2, 22: 2 };

function p(robotId: number, team: number) {
  return { robotId, userId: OWNER[robotId], team };
}

function serve(battles: FixtureBattle[]): void {
  const counters = robotCountersFrom(battles);
  mockUserFindMany.mockResolvedValue([1, 2].map((id) => ({
    id,
    username: `stable${id}`,
    stableName: null,
    stableType: 'human',
    currency: 0,
    prestige: 0,
    championshipTitles: 0,
    championshipTitles1v1: 0,
    championshipTitles2v2: 0,
    championshipTitles3v3: 0,
  })));
  mockRobotFindMany.mockResolvedValue(Object.keys(OWNER).map(Number).map((id) => ({
    id,
    userId: OWNER[id],
    name: `R${id}`,
    imageUrl: null,
    frameId: 1,
    paintJob: null,
    elo: 1200,
    fame: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    mainWeapon: null,
    offhandWeapon: null,
    ...(counters.get(id) ?? { totalBattles: 0, wins: 0, losses: 0, draws: 0 }),
  })));
  mockQueryRaw.mockImplementation((_strings: TemplateStringsArray, userIds: number[]) =>
    Promise.resolve(sharedSidesFrom(battles, userIds)),
  );
}

type ArchiveData = { userId: number; totalBattles: number; wins: number; losses: number; draws: number; winRate: number };

function archivedStables(): Record<number, Omit<ArchiveData, 'userId'>> {
  return Object.fromEntries(
    mockStableArchiveCreate.mock.calls.map(([{ data }]: [{ data: ArchiveData }]) => [
      data.userId,
      { totalBattles: data.totalBattles, wins: data.wins, losses: data.losses, draws: data.draws, winRate: data.winRate },
    ]),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStableArchiveFindUnique.mockResolvedValue(null);
  mockStableArchiveCreate.mockImplementation(({ data }: { data: ArchiveData }) => Promise.resolve({ id: data.userId * 100 }));
  mockRobotArchiveCreate.mockResolvedValue({});
});

describe('writeStableAndRobotArchives stable totals', () => {
  it('archives team battles once per stable and robot rows with their own counters', async () => {
    serve([
      // Tag team: stable 1's pair beat stable 2's pair.
      { id: 1, battleType: 'tag_team', winnerId: 11, winningSide: 1, participants: [p(11, 1), p(12, 1), p(21, 2), p(22, 2)] },
      // 3v3 League draw: stable 1 fielded three robots, stable 2 two.
      { id: 2, battleType: 'league_3v3', winnerId: null, winningSide: null, participants: [p(11, 1), p(12, 1), p(13, 1), p(21, 2), p(22, 2)] },
      // 1v1: 21 beat 13.
      { id: 3, battleType: 'league_1v1', winnerId: 21, winningSide: null, participants: [p(13, 1), p(21, 2)] },
    ]);

    await writeStableAndRobotArchives(1, 10, new Map(), new Map());

    expect(archivedStables()).toEqual({
      1: { totalBattles: 3, wins: 1, losses: 1, draws: 1, winRate: 1 / 3 },
      2: { totalBattles: 3, wins: 1, losses: 1, draws: 1, winRate: 1 / 3 },
    });
    // Per-robot archives are untouched: robot 11 fought the tag team and the 3v3.
    const robot11 = mockRobotArchiveCreate.mock.calls.find(([{ data }]) => data.robotName === 'R11');
    expect(robot11?.[0].data).toMatchObject({ totalBattles: 2, wins: 1, losses: 0, draws: 1 });
  });

  it('still archives byes as battles', async () => {
    serve([
      { id: 4, battleType: 'league_1v1', winnerId: 11, winningSide: null, participants: [p(11, 1)] },
      { id: 5, battleType: 'league_2v2', winnerId: 11, winningSide: 1, participants: [p(11, 1), p(12, 1)] },
    ]);

    await writeStableAndRobotArchives(1, 10, new Map(), new Map());

    expect(archivedStables()[1]).toEqual({ totalBattles: 2, wins: 2, losses: 0, draws: 0, winRate: 1 });
  });

  it('reads the overlap once per archive batch, for that batch\'s stables', async () => {
    serve([]);

    await writeStableAndRobotArchives(1, 10, new Map(), new Map());

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(mockQueryRaw.mock.calls[0][1]).toEqual([1, 2]);
  });

  it('does not rewrite a stable already archived (idempotent retry)', async () => {
    serve([{ id: 1, battleType: 'tag_team', winnerId: 11, winningSide: 1, participants: [p(11, 1), p(12, 1), p(21, 2), p(22, 2)] }]);
    mockStableArchiveFindUnique.mockResolvedValue({ id: 5 });

    await writeStableAndRobotArchives(1, 10, new Map(), new Map());

    expect(mockStableArchiveCreate).not.toHaveBeenCalled();
    expect(mockRobotArchiveCreate).not.toHaveBeenCalled();
  });
});
