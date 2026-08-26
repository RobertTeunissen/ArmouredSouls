/**
 * Property tests for the Cycle_Progress_Summary service — Spec #48.
 *
 * Properties 3, 4, 5, 10, 12, 21, 22 and 23.
 */

import * as fc from 'fast-check';

const mockPrisma = {
  robot: { findMany: jest.fn() },
  teamBattleMember: { findMany: jest.fn() },
  battleParticipant: { findMany: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
  scheduledMatchParticipant: { findMany: jest.fn() },
  scheduledTournamentMatch: { findMany: jest.fn() },
  auditLog: { findMany: jest.fn() },
  cycleSnapshot: { findFirst: jest.fn() },
  cycleMetadata: { findUnique: jest.fn() },
};

jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/config/env', () => ({
  getConfig: () => ({
    leagueSchedule: '0 8 * * *',
    team2v2LeagueSchedule: '0 9 * * *',
    tournamentSchedule: '0 10 * * *',
    tagTeamSchedule: '0 11 * * *',
    kothSchedule: '0 13 * * *',
    team3v3LeagueSchedule: '0 14 * * *',
    team2v2TournamentSchedule: '0 15 * * *',
    grandMeleeSchedule: '0 17 * * *',
    team3v3TournamentSchedule: '0 18 * * *',
  }),
}));

import { readFileSync } from 'fs';
import { resolve } from 'path';

import { currentCycleWindow } from '../../src/services/dashboard/cycleWindow';
import {
  getCycleProgressSummary,
  resolveSideOutcome,
} from '../../src/services/dashboard/cycleProgressService';
import { PLACEMENT_MODE_BATTLE_TYPES } from '../../src/services/auth/userProfileService';

const RUNS = { numRuns: 200 };

/** Reset every mock to an empty-but-valid shape. */
function resetMocks(): void {
  mockPrisma.robot.findMany.mockResolvedValue([]);
  mockPrisma.teamBattleMember.findMany.mockResolvedValue([]);
  mockPrisma.battleParticipant.findMany.mockResolvedValue([]);
  mockPrisma.battleParticipant.aggregate.mockResolvedValue({
    _sum: { credits: 0, streamingRevenue: 0, prestigeAwarded: 0 },
  });
  mockPrisma.battleParticipant.groupBy.mockResolvedValue([]);
  mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);
  mockPrisma.scheduledTournamentMatch.findMany.mockResolvedValue([]);
  mockPrisma.auditLog.findMany.mockResolvedValue([]);
  mockPrisma.cycleSnapshot.findFirst.mockResolvedValue(null);
  mockPrisma.cycleMetadata.findUnique.mockResolvedValue({ totalCycles: 60 });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetMocks();
});

describe('Property 3: One window covers every figure on the row', () => {
  // Feature: 48-dashboard-overview-row, Property 3: One window covers every figure on the row

  it('is the half-open interval from that day midnight UTC to the request timestamp', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2035-01-01'), noInvalidDate: true }),
        (now) => {
          const { start, end, nextBoundary } = currentCycleWindow(now);

          expect(start.getUTCHours()).toBe(0);
          expect(start.getUTCMinutes()).toBe(0);
          expect(start.getUTCSeconds()).toBe(0);
          expect(start.getUTCMilliseconds()).toBe(0);

          expect(start.getUTCFullYear()).toBe(now.getUTCFullYear());
          expect(start.getUTCMonth()).toBe(now.getUTCMonth());
          expect(start.getUTCDate()).toBe(now.getUTCDate());

          expect(end.getTime()).toBe(now.getTime());
          expect(start.getTime()).toBeLessThanOrEqual(end.getTime());
          // UTC has no DST, so a calendar day is always exactly 24 hours here.
          expect(nextBoundary.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
          expect(nextBoundary.getTime()).toBeGreaterThan(now.getTime());
        },
      ),
      RUNS,
    );
  });

  it('never derives the window from a fixed duration before now', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2035-01-01'), noInvalidDate: true }),
        (now) => {
          const { start } = currentCycleWindow(now);
          // A rolling 24h window would put start exactly 24h back. Midnight-anchored
          // windows are strictly shorter than that unless `now` is exactly midnight.
          const rolling24h = now.getTime() - 24 * 60 * 60 * 1000;
          if (now.getTime() !== start.getTime()) {
            expect(start.getTime()).toBeGreaterThan(rolling24h);
          }
        },
      ),
      RUNS,
    );
  });
});

describe('Property 12: Win, loss and draw are resolved once per battle side', () => {
  // Feature: 48-dashboard-overview-row, Property 12: Win, loss and draw counts are once per battle side and exclude Placement_Mode

  it('prefers winningSide when it is set', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 2),
        fc.constantFrom(1, 2),
        fc.integer({ min: 1, max: 1000 }),
        (team, winningSide, robotId) => {
          const outcome = resolveSideOutcome(team, winningSide, null, new Set([robotId]));
          expect(outcome).toBe(team === winningSide ? 'win' : 'loss');
        },
      ),
      RUNS,
    );
  });

  it('falls back to winnerId membership when winningSide is null', () => {
    fc.assert(
      fc.property(fc.constantFrom(1, 2), fc.integer({ min: 1, max: 1000 }), (team, robotId) => {
        // The fallback is load-bearing: winningSide is null for a 1v1 AND for a draw,
        // so it cannot distinguish them alone.
        expect(resolveSideOutcome(team, null, robotId, new Set([robotId]))).toBe('win');
        expect(resolveSideOutcome(team, null, robotId + 1, new Set([robotId]))).toBe('loss');
      }),
      RUNS,
    );
  });

  it('reports a draw only when both winner columns are null', () => {
    fc.assert(
      fc.property(fc.constantFrom(1, 2), fc.integer({ min: 1, max: 1000 }), (team, robotId) => {
        expect(resolveSideOutcome(team, null, null, new Set([robotId]))).toBe('draw');
      }),
      RUNS,
    );
  });

  it('is total: every input yields exactly one of win, loss or draw', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 2),
        fc.option(fc.constantFrom(1, 2), { nil: null }),
        fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
        fc.array(fc.integer({ min: 1, max: 100 }), { maxLength: 5 }),
        (team, winningSide, winnerId, sideRobots) => {
          const outcome = resolveSideOutcome(team, winningSide, winnerId, new Set(sideRobots));
          expect(['win', 'loss', 'draw']).toContain(outcome);
        },
      ),
      RUNS,
    );
  });
});

describe('Property 10: Battle and match counts are once-per-stable', () => {
  // Feature: 48-dashboard-overview-row, Property 10: Battle and match counts are once-per-stable

  it('counts a 3v3 battle with three of the players robots as ONE battle and ONE win', async () => {
    // The case that made Requirement 5 criterion 1 necessary: per-participant counting
    // reported three wins against one battle fought.
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    mockPrisma.battleParticipant.findMany.mockResolvedValue([
      { battleId: 500, robotId: 1, team: 1, placement: null, battle: { battleType: 'league_3v3', winnerId: null, winningSide: 1 } },
      { battleId: 500, robotId: 2, team: 1, placement: null, battle: { battleType: 'league_3v3', winnerId: null, winningSide: 1 } },
      { battleId: 500, robotId: 3, team: 1, placement: null, battle: { battleType: 'league_3v3', winnerId: null, winningSide: 1 } },
    ]);

    const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

    expect(summary.battlesFought).toBe(1);
    expect(summary.winLossDraw).toEqual({ wins: 1, losses: 0, draws: 0 });
  });

  it('counts a Same_Stable_Pairing as one battle with one win and one loss', async () => {
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockPrisma.battleParticipant.findMany.mockResolvedValue([
      { battleId: 600, robotId: 1, team: 1, placement: null, battle: { battleType: 'league_1v1', winnerId: 1, winningSide: null } },
      { battleId: 600, robotId: 2, team: 2, placement: null, battle: { battleType: 'league_1v1', winnerId: 1, winningSide: null } },
    ]);

    const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

    expect(summary.battlesFought).toBe(1);
    expect(summary.winLossDraw).toEqual({ wins: 1, losses: 1, draws: 0 });
  });

  it('counts a Placement_Mode battle with three robots as one battle and NO outcomes', async () => {
    // Requirement 5 criterion 15.
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    mockPrisma.battleParticipant.findMany.mockResolvedValue([
      { battleId: 700, robotId: 1, team: 1, placement: 4, battle: { battleType: 'grand_melee', winnerId: 99, winningSide: null } },
      { battleId: 700, robotId: 2, team: 1, placement: 9, battle: { battleType: 'grand_melee', winnerId: 99, winningSide: null } },
      { battleId: 700, robotId: 3, team: 1, placement: 15, battle: { battleType: 'grand_melee', winnerId: 99, winningSide: null } },
    ]);
    mockPrisma.battleParticipant.groupBy.mockResolvedValue([{ battleId: 700, _count: { id: 20 } }]);

    const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

    expect(summary.battlesFought).toBe(1);
    expect(summary.winLossDraw).toEqual({ wins: 0, losses: 0, draws: 0 });
    // Three robots collapse to a single Best_Placement figure.
    expect(summary.bestPlacement).toEqual({ position: 4, fieldSize: 20 });
  });
});

describe('Property 21: Repair aggregation is a per-type sum that tolerates malformed rows', () => {
  // Feature: 48-dashboard-overview-row, Property 21: Repair aggregation is a per-type sum that tolerates malformed rows

  it('sums per repairType and skips rows with no type or a non-numeric figure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            creditsCharged: fc.oneof(fc.integer({ min: 0, max: 100000 }), fc.constant('nope'), fc.constant(null)),
            repairType: fc.constantFrom('manual', 'automatic', undefined, 'nonsense'),
          }),
          { maxLength: 25 },
        ),
        async (rows) => {
          resetMocks();
          mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
          mockPrisma.auditLog.findMany.mockResolvedValue(rows.map((payload) => ({ payload })));

          const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

          const expectManual = rows
            .filter((r) => r.repairType === 'manual' && typeof r.creditsCharged === 'number')
            .reduce((sum, r) => sum + (r.creditsCharged as number), 0);
          const expectAutomatic = rows
            .filter((r) => r.repairType === 'automatic' && typeof r.creditsCharged === 'number')
            .reduce((sum, r) => sum + (r.creditsCharged as number), 0);

          expect(summary.repairSpend.manual).toBe(expectManual);
          expect(summary.repairSpend.automatic).toBe(expectAutomatic);
        },
      ),
      { numRuns: 60 },
    );
  });

  it('reads pre-rename rows through the fallback', async () => {
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { payload: { cost: 500, repairType: 'manual' } },
      { payload: { cost: 900, repairType: 'automatic' } },
    ]);

    const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

    expect(summary.repairSpend).toEqual({ manual: 500, automatic: 900 });
  });

  it('never reads preDiscountCost into a spend total', async () => {
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { payload: { creditsCharged: 100, creditsBeforeManualDiscount: 200, repairType: 'manual' } },
    ]);

    const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

    // 100, not 200 and not 300.
    expect(summary.repairSpend.manual).toBe(100);
  });
});

describe('Property 22: Battle_Earnings is battle credits plus streaming revenue', () => {
  // Feature: 48-dashboard-overview-row, Property 22: Battle_Earnings is battle credits plus streaming revenue and nothing else

  it('is exactly credits + streamingRevenue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        async (credits, streamingRevenue, prestigeAwarded) => {
          resetMocks();
          mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
          mockPrisma.battleParticipant.aggregate.mockResolvedValue({
            _sum: { credits, streamingRevenue, prestigeAwarded },
          });

          const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

          expect(summary.battleEarnings).toBe(credits + streamingRevenue);
          expect(summary.prestigeEarned).toBe(prestigeAwarded);
        },
      ),
      { numRuns: 80 },
    );
  });

  it('treats null aggregate sums as zero rather than NaN', async () => {
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
    mockPrisma.battleParticipant.aggregate.mockResolvedValue({
      _sum: { credits: null, streamingRevenue: null, prestigeAwarded: null },
    });

    const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

    expect(summary.battleEarnings).toBe(0);
    expect(summary.prestigeEarned).toBe(0);
  });
});

describe('Property 23: The read is idempotent and writes nothing', () => {
  // Feature: 48-dashboard-overview-row, Property 23: The Cycle_Progress_Summary read is idempotent and writes nothing

  it('returns equal results for two successive calls at the same instant', async () => {
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
    const at = new Date('2026-08-26T12:00:00Z');

    const first = await getCycleProgressSummary(7, at);
    const second = await getCycleProgressSummary(7, at);

    expect(second).toEqual(first);
  });

  it('calls no create, update, upsert or delete on any model', async () => {
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
    await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

    for (const model of Object.values(mockPrisma)) {
      for (const [name, fn] of Object.entries(model)) {
        if (/create|update|upsert|delete/i.test(name)) {
          expect(fn).not.toHaveBeenCalled();
        }
      }
    }
  });
});

describe('Requirement 4 criteria 9 and 10: both Match_Schedule_Sources are counted', () => {
  it('counts one unified match plus one tournament bracket row as two scheduled', async () => {
    // Verification criterion 29.
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
    mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([
      {
        scheduledMatchId: 900,
        scheduledMatch: {
          matchType: 'league_1v1',
          status: 'scheduled',
          scheduledFor: new Date('2026-08-26T08:00:00Z'),
        },
      },
    ]);
    mockPrisma.scheduledTournamentMatch.findMany.mockResolvedValue([
      { id: 55, participantType: 'robot' },
    ]);

    const summary = await getCycleProgressSummary(7, new Date('2026-08-26T07:00:00Z'));

    expect(summary.matchesScheduled).toBe(2);
    // The unified match is still ahead of `now`, so its slot appears.
    expect(summary.remainingSlotsUtc).toContain('08:00');
    // The 1v1 tournament slot (10:00) appears from the cron config, since bracket rows
    // carry no scheduledFor column.
    expect(summary.remainingSlotsUtc).toContain('10:00');
  });

  it('counts a unified match once per stable however many of the players robots are in it', async () => {
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([
      { scheduledMatchId: 901, scheduledMatch: { matchType: 'league_3v3', status: 'scheduled', scheduledFor: new Date('2026-08-26T14:00:00Z') } },
      { scheduledMatchId: 901, scheduledMatch: { matchType: 'league_3v3', status: 'scheduled', scheduledFor: new Date('2026-08-26T14:00:00Z') } },
      { scheduledMatchId: 901, scheduledMatch: { matchType: 'league_3v3', status: 'scheduled', scheduledFor: new Date('2026-08-26T14:00:00Z') } },
    ]);

    const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

    expect(summary.matchesScheduled).toBe(1);
    expect(summary.remainingSlotsUtc).toEqual(['14:00']);
  });
});

describe('Requirement 8 criterion 11: the read is a bounded, unpaginated set of queries', () => {
  /**
   * The bound is on the number of QUERIES, not on wall-clock time. A timing assertion
   * would measure the mock, and would be the kind of check that goes flaky on a loaded
   * CI box; the shape of the read is what actually determines whether the endpoint
   * stays inside its budget as a roster grows.
   */
  it('issues the same number of queries for 20 robots and 40 battles as for one of each', async () => {
    const countQueries = (): number =>
      Object.values(mockPrisma)
        .flatMap((model) => Object.values(model))
        .reduce((total, fn) => total + (fn as jest.Mock).mock.calls.length, 0);

    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
    await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));
    const smallStable = countQueries();

    jest.clearAllMocks();
    resetMocks();

    const robots = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
    mockPrisma.robot.findMany.mockResolvedValue(robots);
    mockPrisma.battleParticipant.findMany.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({
        battleId: 1000 + i,
        robotId: (i % 20) + 1,
        team: 1,
        placement: null,
        battle: {
          battleType: 'league_1v1',
          winnerId: (i % 20) + 1,
          winningSide: null,
          createdAt: new Date('2026-08-26T08:00:00Z'),
        },
      })),
    );

    const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));
    const largeStable = countQueries();

    // No per-robot and no per-battle query: the count does not grow with the data.
    expect(largeStable).toBe(smallStable);
    expect(summary.battlesFought).toBe(40);
  });

  it('takes no `skip` or `take` argument on any query', async () => {
    // Requirement 8 criterion 11: the response is a fixed-size aggregate, so pagination
    // would only be able to truncate a total into a wrong number.
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
    await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

    const everyArgument = Object.values(mockPrisma)
      .flatMap((model) => Object.values(model))
      .flatMap((fn) => (fn as jest.Mock).mock.calls)
      .flat();

    for (const argument of everyArgument) {
      expect(argument).not.toHaveProperty('skip');
      expect(argument).not.toHaveProperty('take');
    }
  });
});

describe('Requirement 5 criterion 2: the Placement_Mode list is reused, not copied', () => {
  /**
   * The service imports `PLACEMENT_MODE_BATTLE_TYPES` rather than re-exporting it, so
   * there is no second binding to compare a reference against from out here. What can
   * fail — and what Verification criterion 9 is actually about — is a second *declaration*
   * appearing in the service. A structural `toEqual` would not catch that: a copied
   * `['koth', 'grand_melee']` compares equal to the original right up to the day someone
   * adds a third placement mode to one of them.
   */
  const source = readFileSync(
    resolve(__dirname, '../../src/services/dashboard/cycleProgressService.ts'),
    'utf-8',
  );

  it('imports the list from userProfileService', () => {
    expect(source).toMatch(
      /import\s*\{\s*PLACEMENT_MODE_BATTLE_TYPES\s*\}\s*from\s*'\.\.\/auth\/userProfileService'/,
    );
  });

  it('declares no placement-mode array of its own', () => {
    expect(source).not.toMatch(/PLACEMENT_MODE_BATTLE_TYPES\s*=/);
    expect(source.replace(/\/\/.*$/gm, '')).not.toMatch(/\[\s*'koth'/);
  });

  it('resolves both placement modes through that one list', () => {
    expect(PLACEMENT_MODE_BATTLE_TYPES).toEqual(expect.arrayContaining(['koth', 'grand_melee']));
  });
});

describe('Property 4 and 5: the comparison is the highest snapshot below the current cycle', () => {
  // Feature: 48-dashboard-overview-row, Property 4: The Last_Completed_Cycle is the highest snapshot below the Current_Cycle

  it('reads the snapshot with the highest cycle number strictly below the current one', async () => {
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
    mockPrisma.cycleSnapshot.findFirst.mockResolvedValue({
      cycleNumber: 58,
      startTime: new Date('2026-08-24T00:00:00Z'),
      endTime: new Date('2026-08-25T00:00:00Z'),
      stableMetrics: [
        { userId: 7, totalCreditsEarned: 1000, streamingIncome: 200, totalPrestigeEarned: 30 },
      ],
    });

    const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

    expect(mockPrisma.cycleSnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { cycleNumber: 'desc' } }),
    );
    // Requirement 2 criterion 8: the cycle actually covered is reported, which may not
    // be currentCycle - 1.
    expect(summary.comparison?.cycleNumber).toBe(58);
    expect(summary.comparison?.battleEarnings).toBe(1200);
    expect(summary.comparison?.prestigeEarned).toBe(30);
  });

  it('returns a null comparison when no snapshot exists at all', async () => {
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
    mockPrisma.cycleSnapshot.findFirst.mockResolvedValue(null);

    const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

    expect(summary.comparison).toBeNull();
  });

  it('keeps the Current_Cycle figures when the comparison read throws', async () => {
    // Requirement 2 criterion 9.
    mockPrisma.robot.findMany.mockResolvedValue([{ id: 1 }]);
    mockPrisma.battleParticipant.aggregate.mockResolvedValue({
      _sum: { credits: 5000, streamingRevenue: 500, prestigeAwarded: 25 },
    });
    mockPrisma.cycleSnapshot.findFirst.mockRejectedValue(new Error('snapshot table gone'));

    const summary = await getCycleProgressSummary(7, new Date('2026-08-26T12:00:00Z'));

    expect(summary.comparison).toBeNull();
    expect(summary.battleEarnings).toBe(5500);
    expect(summary.prestigeEarned).toBe(25);
  });
});
