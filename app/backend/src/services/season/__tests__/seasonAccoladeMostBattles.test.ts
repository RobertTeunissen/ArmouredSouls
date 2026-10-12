/**
 * The "Most Battles" season accolade captures the all-modes battle count
 * (KotH and Grand Melee matches included), the value the Hall of Records ranks.
 *
 * Only the season passed in is written: accolades for earlier seasons (Season 0
 * included) are never deleted or rewritten.
 */
const mockSeasonAccoladeDeleteMany = jest.fn();
const mockSeasonAccoladeCreateMany = jest.fn();
const mockFetchCareerRecords = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: {
      findMany: jest.fn().mockResolvedValue([
        { id: 2, name: 'Gridlock', userId: 7, user: { username: 'u7', stableName: 'Seven', isGenerated: false, stableType: 'human' } },
        { id: 1, name: 'Ironclad', userId: 7, user: { username: 'u7', stableName: 'Seven', isGenerated: false, stableType: 'human' } },
      ]),
    },
    teamBattle: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    tournament: { findMany: jest.fn().mockResolvedValue([]) },
    seasonAccolade: {
      deleteMany: (...args: unknown[]) => mockSeasonAccoladeDeleteMany(...args),
      createMany: (...args: unknown[]) => mockSeasonAccoladeCreateMany(...args),
    },
  },
}));

jest.mock('../../../config/env', () => ({
  ...jest.requireActual('../../../config/env'),
  loadEnvConfig: () => ({ accoladeDepth: 10 }),
}));

jest.mock('../../records/recordsQueryService', () => ({
  fetchCombatRecords: jest.fn().mockResolvedValue({ mostDamageInBattle: {}, narrowestVictory: [] }),
  fetchUpsetRecords: jest.fn().mockResolvedValue({ biggestUpset: [] }),
  fetchCareerRecords: (...args: unknown[]) => mockFetchCareerRecords(...args),
  fetchEconomicRecords: jest.fn().mockResolvedValue({ highestFame: [], richestStables: [] }),
  fetchPrestigeRecords: jest.fn().mockResolvedValue({ highestPrestige: [], mostTitles: [] }),
  fetchKothRecords: jest.fn().mockResolvedValue(undefined),
  fetchGrandMeleeRecords: jest.fn().mockResolvedValue(undefined),
  fetchWinStreakRecords: jest.fn().mockResolvedValue({}),
}));

import { writeAccolades } from '../seasonArchiveService';

type AccoladeRow = { seasonNumber: number; category: string; rank: number; subjectName: string; value: number; valueLabel: string };

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchCareerRecords.mockResolvedValue({
    // Gridlock: 40 win/loss-mode battles + 260 KotH/Grand Melee matches.
    mostBattles: [
      { robotId: 2, robotName: 'Gridlock', allModesBattleCount: 300, totalBattles: 40 },
      { robotId: 1, robotName: 'Ironclad', allModesBattleCount: 280, totalBattles: 280 },
    ],
    highestWinRate: [],
    mostLifetimeDamage: [],
    highestElo: [],
    mostKills: [],
  });
});

function writtenRows(): AccoladeRow[] {
  const [args] = mockSeasonAccoladeCreateMany.mock.calls[0] as [{ data: AccoladeRow[] }];
  return args.data;
}

describe('writeAccolades — Most Battles', () => {
  it('captures the all-modes battle count, labelled "battles"', async () => {
    await writeAccolades(1);

    const rows = writtenRows().filter((r) => r.category === 'mostBattles');
    expect(rows.map((r) => [r.rank, r.subjectName, r.value, r.valueLabel])).toEqual([
      [1, 'Gridlock', 300, 'battles'],
      [2, 'Ironclad', 280, 'battles'],
    ]);
  });

  it('only replaces the rows of the season being archived', async () => {
    await writeAccolades(1);

    expect(mockSeasonAccoladeDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockSeasonAccoladeDeleteMany).toHaveBeenCalledWith({ where: { seasonNumber: 1 } });
    expect(writtenRows().every((r) => r.seasonNumber === 1)).toBe(true);
  });
});
