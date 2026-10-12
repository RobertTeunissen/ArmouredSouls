/**
 * #532 / #530 — shared all-modes battle count.
 *
 * allModes = robots.total_battles + standings.total_matches for KotH and Grand Melee.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

const mockStandingFindMany = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    standing: { findMany: (...args: unknown[]) => mockStandingFindMany(...args) },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import {
  PLACEMENT_COUNTED_MODES,
  combineAllModesBattleCount,
  getAllModesBattleCount,
  getAllModesBattleCounts,
  getPlacementMatchCounts,
  getTopRobotsByAllModesBattleCount,
} from '../all-modes-battle-count';
import { PLACEMENT_MODE_BATTLE_TYPES } from '../../auth/userProfileService';

type StandingRow = { entityId: number; mode: string; totalMatches: number | null };

/** Fake `standing.findMany` that honours the where clause the helper sends. */
function serveStandings(rows: StandingRow[]): void {
  mockStandingFindMany.mockImplementation(
    async (args: { where: { entityId: { in: number[] }; mode: { in: string[] } } }) =>
      rows
        .filter((r) => args.where.entityId.in.includes(r.entityId) && args.where.mode.in.includes(r.mode))
        .map(({ entityId, totalMatches }) => ({ entityId, totalMatches })),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  serveStandings([]);
});

describe('getAllModesBattleCount', () => {
  it('returns totalBattles when the robot has no placement standings', async () => {
    await expect(getAllModesBattleCount({ id: 1, totalBattles: 211 })).resolves.toBe(211);
  });

  it('adds KotH matches', async () => {
    serveStandings([{ entityId: 1, mode: 'koth', totalMatches: 68 }]);
    await expect(getAllModesBattleCount({ id: 1, totalBattles: 211 })).resolves.toBe(279);
  });

  it('adds Grand Melee matches', async () => {
    serveStandings([{ entityId: 1, mode: 'grand_melee', totalMatches: 6 }]);
    await expect(getAllModesBattleCount({ id: 1, totalBattles: 211 })).resolves.toBe(217);
  });

  it('adds KotH and Grand Melee together', async () => {
    serveStandings([
      { entityId: 1, mode: 'koth', totalMatches: 68 },
      { entityId: 1, mode: 'grand_melee', totalMatches: 6 },
    ]);
    await expect(getAllModesBattleCount({ id: 1, totalBattles: 211 })).resolves.toBe(285);
  });

  it('treats a null totalMatches as 0', async () => {
    serveStandings([{ entityId: 1, mode: 'koth', totalMatches: null }]);
    await expect(getAllModesBattleCount({ id: 1, totalBattles: 10 })).resolves.toBe(10);
  });

  it('ignores win/loss-mode standings, which are already inside totalBattles', async () => {
    serveStandings([
      { entityId: 1, mode: 'tag_team', totalMatches: 70 },
      { entityId: 1, mode: 'league_2v2', totalMatches: 71 },
      { entityId: 1, mode: 'koth', totalMatches: 2 },
    ]);
    await expect(getAllModesBattleCount({ id: 1, totalBattles: 211 })).resolves.toBe(213);
  });
});

describe('getAllModesBattleCounts (batch)', () => {
  it('computes every robot with one query, including robots without standings', async () => {
    serveStandings([
      { entityId: 1, mode: 'koth', totalMatches: 68 },
      { entityId: 1, mode: 'grand_melee', totalMatches: 6 },
      { entityId: 2, mode: 'grand_melee', totalMatches: 3 },
    ]);

    const counts = await getAllModesBattleCounts([
      { id: 1, totalBattles: 211 },
      { id: 2, totalBattles: 5 },
      { id: 3, totalBattles: 9 },
    ]);

    expect(counts.get(1)).toBe(285);
    expect(counts.get(2)).toBe(8);
    expect(counts.get(3)).toBe(9);
    expect(mockStandingFindMany).toHaveBeenCalledTimes(1);
  });

  it('sends one standings query filtered to the placement modes', async () => {
    await getAllModesBattleCounts([{ id: 1, totalBattles: 0 }, { id: 1, totalBattles: 0 }]);

    expect(mockStandingFindMany).toHaveBeenCalledTimes(1);
    expect(mockStandingFindMany).toHaveBeenCalledWith({
      where: { entityType: 'robot', entityId: { in: [1] }, mode: { in: ['koth', 'grand_melee'] } },
      select: { entityId: true, totalMatches: true },
    });
  });

  it('does not query for an empty roster', async () => {
    await expect(getAllModesBattleCounts([])).resolves.toEqual(new Map());
    await expect(getPlacementMatchCounts([])).resolves.toEqual(new Map());
    expect(mockStandingFindMany).not.toHaveBeenCalled();
  });

  it('equals totalBattles plus the placement matches (property)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),
        fc.option(fc.integer({ min: 0, max: 500 }), { nil: null }),
        fc.option(fc.integer({ min: 0, max: 500 }), { nil: null }),
        async (totalBattles, koth, gm) => {
          const rows: StandingRow[] = [];
          if (koth !== null) rows.push({ entityId: 1, mode: 'koth', totalMatches: koth });
          if (gm !== null) rows.push({ entityId: 1, mode: 'grand_melee', totalMatches: gm });
          serveStandings(rows);

          const single = await getAllModesBattleCount({ id: 1, totalBattles });
          const batch = (await getAllModesBattleCounts([{ id: 1, totalBattles }])).get(1);
          const expected = combineAllModesBattleCount(totalBattles, (koth ?? 0) + (gm ?? 0));
          expect(single).toBe(expected);
          expect(batch).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('getTopRobotsByAllModesBattleCount (Most Battles ranking)', () => {
  /** Collapse the tagged-template SQL to one line for text assertions. */
  function sentSql(): string {
    const [strings] = mockQueryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    return strings.join('?').replace(/\s+/g, ' ');
  }

  it('ranks in one query on the combined value, not on a total_battles pre-filter', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getTopRobotsByAllModesBattleCount(10);

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    const sql = sentSql();
    // Every robot is a candidate: no WHERE on robots, placement matches joined in.
    expect(sql).toMatch(/FROM robots r LEFT JOIN \(/);
    expect(sql).not.toMatch(/WHERE r\./);
    expect(sql).toContain("s.entity_type = 'robot'");
    expect(sql).toContain('ORDER BY r.total_battles::bigint + COALESCE(p.placement_matches, 0::bigint) DESC');
  });

  it('adds in bigint so two int4 parts cannot overflow (PostgreSQL 22003)', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getTopRobotsByAllModesBattleCount(10);

    const sql = sentSql();
    expect(sql).toContain('SUM(COALESCE(s.total_matches, 0))::bigint AS placement_matches');
    expect(sql).not.toMatch(/::int\b/);
  });

  it('breaks ties on more win/loss-mode battles, then the lower robot id', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getTopRobotsByAllModesBattleCount(10);

    expect(sentSql()).toContain('DESC, r.total_battles DESC, r.id ASC LIMIT ?');
  });

  it('binds the placement modes and the limit as parameters', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getTopRobotsByAllModesBattleCount(7);

    const [, ...values] = mockQueryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(values).toEqual([[...PLACEMENT_COUNTED_MODES], 7]);
  });

  it('returns the robots in rank order with the count from the same row', async () => {
    mockQueryRaw.mockResolvedValue([
      { id: 9, total_battles: 2_000_000_000, placement_matches: BigInt(2_000_000_000) },
      { id: 3, total_battles: 40, placement_matches: BigInt(260) },
      { id: 5, total_battles: 12, placement_matches: BigInt(0) },
    ]);
    await expect(getTopRobotsByAllModesBattleCount(3)).resolves.toEqual([
      { robotId: 9, allModesBattleCount: 4_000_000_000 },
      { robotId: 3, allModesBattleCount: 300 },
      { robotId: 5, allModesBattleCount: 12 },
    ]);
  });
});

describe('every mode that skips battle counters still adds to the count (#530)', () => {
  const SERVICES_DIR = path.join(__dirname, '../..');

  function listSourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue;
        out.push(...listSourceFiles(full));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        out.push(full);
      }
    }
    return out;
  }

  /** Return the `{ ... }` argument of every `updateRobotCombatStats({` call. */
  function callArguments(source: string): string[] {
    const marker = 'updateRobotCombatStats({';
    const args: string[] = [];
    let from = source.indexOf(marker);
    while (from !== -1) {
      const open = from + marker.length - 1;
      let depth = 0;
      let end = open;
      for (let i = open; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      args.push(source.slice(open, end + 1));
      from = source.indexOf(marker, end);
    }
    return args;
  }

  it('the battle types passing skipBattleCounters are exactly the placement-counted modes', () => {
    const skipped = new Set<string>();
    for (const file of listSourceFiles(SERVICES_DIR)) {
      for (const arg of callArguments(fs.readFileSync(file, 'utf8'))) {
        if (!/skipBattleCounters:\s*true/.test(arg)) continue;
        const match = arg.match(/battleType:\s*'([a-z0-9_]+)'/);
        if (!match) throw new Error(`skipBattleCounters call without a literal battleType in ${file}`);
        skipped.add(match[1]);
      }
    }

    expect([...skipped].sort()).toEqual([...PLACEMENT_COUNTED_MODES].sort());
    expect([...PLACEMENT_MODE_BATTLE_TYPES].sort()).toEqual([...PLACEMENT_COUNTED_MODES].sort());
  });
});
