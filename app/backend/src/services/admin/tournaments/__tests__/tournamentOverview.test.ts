/**
 * Unit tests for the pure admin Tournaments overview.
 */

import { buildTournamentOverview, nextDailyRun, stageName } from '../tournamentOverview';
import type { MatchGroupRow, TournamentRow } from '../tournamentOverviewTypes';

const SCHEDULES = { robot: '0 10 * * *', team_2v2: '0 15 * * *', team_3v3: '0 18 * * *' } as const;
const NOW = new Date('2026-10-30T07:00:00Z');
const HOUR = 60 * 60 * 1000;

let nextId = 1;
function tournament(overrides: Partial<TournamentRow> = {}): TournamentRow {
  const id = nextId++;
  return {
    id,
    name: `Tournament #${id}`,
    type: 'robot',
    status: 'completed',
    currentRound: 8,
    maxRounds: 8,
    totalParticipants: 200,
    createdAt: new Date(Date.UTC(2026, 8, id)),
    startedAt: new Date(Date.UTC(2026, 8, id)),
    completedAt: new Date(Date.UTC(2026, 8, id + 8)),
    champion: { id: 100 + id, name: `Champ ${id}`, stableId: 1, stableName: 'Hit Machine', stableType: 'human' },
    ...overrides,
  };
}

function group(tournamentId: number, round: number, status: string, count: number, overrides: Partial<MatchGroupRow> = {}): MatchGroupRow {
  return { tournamentId, round, status, isBye: false, count, lastCompletedAt: null, ...overrides };
}

describe('stageName', () => {
  it('names the last rounds and counts the others', () => {
    expect(stageName(12, 12)).toBe('Final');
    expect(stageName(11, 12)).toBe('Semi-finals');
    expect(stageName(10, 12)).toBe('Quarter-finals');
    expect(stageName(7, 11)).toBe('Round of 32');
    expect(stageName(1, 9)).toBe('Round of 512');
  });
});

describe('nextDailyRun', () => {
  it('returns today when the time is still ahead, otherwise tomorrow', () => {
    expect(nextDailyRun('0 10 * * *', NOW)?.toISOString()).toBe('2026-10-30T10:00:00.000Z');
    expect(nextDailyRun('0 5 * * *', NOW)?.toISOString()).toBe('2026-10-31T05:00:00.000Z');
    expect(nextDailyRun('*/5 * * * *', NOW)).toBeNull();
  });
});

describe('buildTournamentOverview', () => {
  it('describes the running tournament: stage, progress, byes and the expected finish', () => {
    const running = tournament({ status: 'active', currentRound: 11, maxRounds: 12, totalParticipants: 3160, completedAt: null, champion: null });
    const overview = buildTournamentOverview({
      tournaments: [running],
      matchGroups: [
        group(running.id, 1, 'completed', 1112, { lastCompletedAt: new Date(NOW.getTime() - 50 * HOUR) }),
        group(running.id, 1, 'completed', 936, { isBye: true }),
        group(running.id, 10, 'completed', 4, { lastCompletedAt: new Date(NOW.getTime() - 21 * HOUR) }),
        group(running.id, 11, 'pending', 2),
      ],
      schedules: SCHEDULES,
      seasonPhase: 'competitive',
      now: NOW,
    });
    const current = overview.types[0].current!;
    expect(current).toMatchObject({
      round: 11,
      maxRounds: 12,
      stage: 'Semi-finals',
      participants: 3160,
      currentRound: { matches: 2, done: 0 },
      firstRound: { matches: 2048, byes: 936 },
      leftBehind: 0,
      nextRunAt: '2026-10-30T10:00:00.000Z',
      expectedFinish: '2026-10-31',
      status: { level: 'ok', reasons: [] },
    });
    expect(overview.types[0].jobTime).toBe('10:00');
    expect(overview.types.map((t) => t.type)).toEqual(['robot', 'team_2v2', 'team_3v3']);
    expect(overview.types[1].current).toBeNull();
  });

  it('warns when the round has not advanced for more than 26 hours or a match was left behind', () => {
    const stalled = tournament({ type: 'team_2v2', status: 'active', currentRound: 3, maxRounds: 6, completedAt: null, champion: null });
    const overview = buildTournamentOverview({
      tournaments: [stalled],
      matchGroups: [
        group(stalled.id, 2, 'completed', 8, { lastCompletedAt: new Date(NOW.getTime() - 27 * HOUR) }),
        group(stalled.id, 2, 'scheduled', 1),
        group(stalled.id, 3, 'pending', 4),
      ],
      schedules: SCHEDULES,
      seasonPhase: 'competitive',
      now: NOW,
    });
    expect(overview.types[1].current?.status).toEqual({ level: 'warning', reasons: ['stalled', 'left_behind'] });
    expect(overview.types[1].current?.leftBehind).toBe(1);
  });

  it('uses the start as last progress when no match finished yet, and pauses during preparation', () => {
    const fresh = tournament({
      type: 'team_3v3', status: 'active', currentRound: 1, maxRounds: 9, completedAt: null, champion: null,
      startedAt: new Date(NOW.getTime() - 13 * HOUR),
    });
    const input = { tournaments: [fresh], matchGroups: [group(fresh.id, 1, 'pending', 256)], schedules: SCHEDULES, now: NOW };
    const competitive = buildTournamentOverview({ ...input, seasonPhase: 'competitive' }).types[2].current!;
    expect(competitive.status.level).toBe('ok');
    expect(competitive.lastProgressAt).toBe(fresh.startedAt!.toISOString());
    expect(competitive.expectedFinish).toBe('2026-11-07');
    const preparing = buildTournamentOverview({ ...input, seasonPhase: 'preparation', now: new Date(NOW.getTime() + 48 * HOUR) }).types[2].current!;
    expect(preparing.status).toEqual({ level: 'info', reasons: ['paused'] });
  });

  it('summarises the season: sizes, average length, champions by stable and dominance', () => {
    const rows = [
      tournament({ totalParticipants: 100, maxRounds: 7 }),
      tournament({ totalParticipants: 200, maxRounds: 8 }),
      tournament({ totalParticipants: 400, maxRounds: 9, champion: { id: 9, name: 'Bolt', stableId: 2, stableName: 'Bolzen GmbH', stableType: 'human' } }),
      tournament({ totalParticipants: 800, maxRounds: 10 }),
      tournament({ status: 'active', totalParticipants: 1600, maxRounds: 11, currentRound: 2, completedAt: null, champion: null }),
    ];
    const season = buildTournamentOverview({ tournaments: rows, matchGroups: [], schedules: SCHEDULES, seasonPhase: 'competitive', now: NOW }).types[0].season;
    expect(season.completed).toBe(4);
    expect(season.averageDays).toBe(8.5);
    expect(season.sizes.map((s) => [s.participants, s.current])).toEqual([[100, false], [200, false], [400, false], [800, false], [1600, true]]);
    expect(season.championsByStableType).toEqual({ human: 4, automaton: 0, generated: 0, unknown: 0 });
    expect(season.championStables).toEqual([
      { stableId: 1, stableName: 'Hit Machine', titles: 3 },
      { stableId: 2, stableName: 'Bolzen GmbH', titles: 1 },
    ]);
    expect(season.dominantStable).toEqual({ stableId: 1, stableName: 'Hit Machine', titles: 3 });
    expect(season.recentChampions[0]).toMatchObject({ name: rows[3].name, champion: rows[3].champion!.name, stableName: 'Hit Machine' });
  });

  it('does not note dominance at exactly half, or with fewer than 3 completed tournaments', () => {
    const other = { id: 9, name: 'X', stableId: 2, stableName: 'Other', stableType: 'automaton' as const };
    const half = [tournament(), tournament(), tournament({ champion: other }), tournament({ champion: other })];
    expect(buildTournamentOverview({ tournaments: half, matchGroups: [], schedules: SCHEDULES, seasonPhase: 'competitive', now: NOW })
      .types[0].season.dominantStable).toBeNull();
    const few = [tournament(), tournament()];
    expect(buildTournamentOverview({ tournaments: few, matchGroups: [], schedules: SCHEDULES, seasonPhase: 'competitive', now: NOW })
      .types[0].season.dominantStable).toBeNull();
  });

  it('keeps a champion whose robot or team was deleted as unknown', () => {
    const lost = tournament({ champion: { id: 77, name: null, stableId: null, stableName: null, stableType: null } });
    const season = buildTournamentOverview({ tournaments: [lost], matchGroups: [], schedules: SCHEDULES, seasonPhase: 'competitive', now: NOW }).types[0].season;
    expect(season.championsByStableType.unknown).toBe(1);
    expect(season.recentChampions[0]).toMatchObject({ champion: null, stableName: null });
  });
});
