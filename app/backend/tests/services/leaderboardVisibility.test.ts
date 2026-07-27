/**
 * Leaderboard visibility — Spec #46 Requirement 5
 *
 * The fame and prestige leaderboards previously carried filters that suppressed
 * entrants rather than narrowing a complete list:
 *
 *  - Fame defaulted to `minBattles: 10`, but `robots.total_battles` is never
 *    incremented for KotH or Grand Melee (both orchestrators pass
 *    `skipBattleCounters: true`). A robot whose fame came from those modes was
 *    therefore hidden by default, despite both modes awarding fame.
 *  - Fame's league filter joined `standings` on `mode = 'league_1v1'`, so any
 *    robot without a 1v1 standing vanished whenever a tier was selected.
 *  - Prestige defaulted to `minRobots: 1` but allowed higher values, hiding
 *    small stables from a ranking of stable prestige.
 *
 * These tests assert the generated SQL no longer restricts the population, and
 * that a robot with fame but zero recorded battles is ranked.
 *
 * **Validates: Requirements 5.3, 5.4, 5.9, 5.18, 5.19**
 */

const capturedQueries: string[] = [];

/** Collapse a Prisma tagged-template into inspectable SQL text. */
function sqlTextOf(strings: TemplateStringsArray | string[]): string {
  return Array.isArray(strings) ? strings.join(' ? ') : String(strings);
}

const mockQueryRaw = jest.fn();

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
      capturedQueries.push(sqlTextOf(strings));
      return mockQueryRaw(strings, ...values);
    },
  },
}));

import { getFameLeaderboard, getPrestigeLeaderboard } from '../../src/services/analytics/leaderboardService';

/** A robot that has earned fame exclusively in KotH / Grand Melee. */
const kothOnlyRobot = {
  id: 7,
  name: 'Zone Tyrant',
  fame: 4200,
  elo: 1200,
  total_battles: 0, // never incremented for KotH or Grand Melee
  wins: 0,
  losses: 0,
  draws: 0,
  kills: 0,
  damage_dealt_lifetime: 918_000,
  user_id: 3,
  username: 'operator',
  stable_name: 'Iron Vigil',
  total_count: BigInt(1),
};

beforeEach(() => {
  capturedQueries.length = 0;
  mockQueryRaw.mockReset();
});

describe('Fame leaderboard population (Spec #46 R5)', () => {
  it('ranks a robot with fame and zero recorded battles', async () => {
    mockQueryRaw.mockResolvedValue([kothOnlyRobot]);

    const result = await getFameLeaderboard({ page: 1, limit: 100 });

    expect(result.leaderboard).toHaveLength(1);
    expect(result.leaderboard[0]).toMatchObject({
      rank: 1,
      robotId: 7,
      robotName: 'Zone Tyrant',
      fame: 4200,
      totalBattles: 0,
      stableName: 'Iron Vigil',
    });
  });

  it('does not divide by zero when computing win rate for a robot with no battles', async () => {
    mockQueryRaw.mockResolvedValue([kothOnlyRobot]);

    const result = await getFameLeaderboard({ page: 1, limit: 100 });

    expect(result.leaderboard[0].winRate).toBe(0);
    expect(Number.isFinite(result.leaderboard[0].winRate)).toBe(true);
  });

  it('applies no minimum-battles predicate', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await getFameLeaderboard({ page: 1, limit: 100 });

    const sql = capturedQueries.join('\n');
    expect(sql).not.toMatch(/total_battles"?\s*>=/);
  });

  it('no longer joins standings, so robots without a 1v1 standing are included', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await getFameLeaderboard({ page: 1, limit: 100 });

    const sql = capturedQueries.join('\n');
    expect(sql).not.toMatch(/standings/i);
    expect(sql).not.toMatch(/league_1v1/);
  });

  it('omits the filters block from the response', async () => {
    mockQueryRaw.mockResolvedValue([kothOnlyRobot]);

    const result = await getFameLeaderboard({ page: 1, limit: 100 });

    expect(result).not.toHaveProperty('filters');
  });

  it('does not expose currentLeague on an entry', async () => {
    mockQueryRaw.mockResolvedValue([kothOnlyRobot]);

    const result = await getFameLeaderboard({ page: 1, limit: 100 });

    expect(result.leaderboard[0]).not.toHaveProperty('currentLeague');
  });

  it('orders deterministically by fame then id', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await getFameLeaderboard({ page: 1, limit: 100 });

    const sql = capturedQueries.join('\n');
    expect(sql).toMatch(/ORDER BY\s+r\.fame DESC,\s*r\.id ASC/);
  });
});

describe('Prestige leaderboard population (Spec #46 R5)', () => {
  const singleRobotStable = {
    id: 11,
    username: 'solo',
    stable_name: 'One Machine',
    prestige: 8800,
    championship_titles: 1,
    robot_count: BigInt(1),
    highest_elo: 1480,
    total_battles: BigInt(60),
    total_wins: BigInt(41),
    total_losses: BigInt(17),
    total_draws: BigInt(2),
  };

  it('ranks a stable that owns a single robot', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ count: BigInt(1) }])
      .mockResolvedValueOnce([singleRobotStable]);

    const result = await getPrestigeLeaderboard({ page: 1, limit: 100 });

    expect(result.leaderboard).toHaveLength(1);
    expect(result.leaderboard[0]).toMatchObject({
      rank: 1,
      userId: 11,
      prestige: 8800,
      totalRobots: 1,
    });
  });

  it('applies no minimum robot-count predicate', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([]);

    await getPrestigeLeaderboard({ page: 1, limit: 100 });

    const sql = capturedQueries.join('\n');
    expect(sql).not.toMatch(/HAVING\s+COUNT/i);
  });

  it('drops the derived bonus fields and the filters block', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ count: BigInt(1) }])
      .mockResolvedValueOnce([singleRobotStable]);

    const result = await getPrestigeLeaderboard({ page: 1, limit: 100 });

    expect(result).not.toHaveProperty('filters');
    expect(result.leaderboard[0]).not.toHaveProperty('battleWinningsBonus');
    expect(result.leaderboard[0]).not.toHaveProperty('merchandisingMultiplier');
  });

  it('retains totalRobots as identifying context', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ count: BigInt(1) }])
      .mockResolvedValueOnce([singleRobotStable]);

    const result = await getPrestigeLeaderboard({ page: 1, limit: 100 });

    expect(result.leaderboard[0].totalRobots).toBe(1);
  });
});
