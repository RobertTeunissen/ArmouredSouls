/** Admin Tournaments overview for page and format tests (shape of ACC, 30 Oct 2026). */
import type {
  CurrentTournament,
  TournamentOverview,
  TournamentType,
  TournamentTypeOverview,
} from '../../../utils/adminTournamentsApi';

export function current(overrides: Partial<CurrentTournament> = {}): CurrentTournament {
  return {
    id: 62,
    name: '1v1 Tournament #9',
    round: 11,
    maxRounds: 12,
    stage: 'Semi-finals',
    participants: 3160,
    startedAt: '2026-10-19T10:00:11.000Z',
    expectedFinish: '2026-10-31',
    nextRunAt: '2026-10-30T10:00:00.000Z',
    currentRound: { matches: 2, done: 0 },
    firstRound: { matches: 2048, byes: 936 },
    leftBehind: 0,
    lastProgressAt: '2026-10-29T10:12:00.000Z',
    status: { level: 'ok', reasons: [] },
    ...overrides,
  };
}

function typeEntry(type: TournamentType, overrides: Partial<TournamentTypeOverview> = {}): TournamentTypeOverview {
  return {
    type,
    jobTime: { robot: '10:00', team_2v2: '15:00', team_3v3: '18:00' }[type],
    current: null,
    season: {
      completed: 0,
      averageDays: null,
      sizes: [],
      championsByStableType: { human: 0, automaton: 0, generated: 0, unknown: 0 },
      championStables: [],
      recentChampions: [],
      dominantStable: null,
    },
    ...overrides,
  };
}

export function overview(overrides: Partial<TournamentOverview> = {}): TournamentOverview {
  return {
    generatedAt: '2026-10-30T07:00:00.000Z',
    seasonPhase: 'competitive',
    thresholds: { stalledAfterHours: 26, dominanceShare: 0.5, dominanceMinCompleted: 3 },
    types: [
      typeEntry('robot', {
        current: current(),
        season: {
          completed: 8,
          averageDays: 9.9,
          sizes: [221, 251, 345, 526, 779, 1062, 1601, 2197, 3160].map((participants, index, all) => ({
            tournamentId: 50 + index, participants, current: index === all.length - 1,
          })),
          championsByStableType: { human: 8, automaton: 0, generated: 0, unknown: 0 },
          championStables: [{ stableId: 7, stableName: 'Hit Machine', titles: 7 }, { stableId: 8, stableName: 'Bolzen GmbH', titles: 1 }],
          recentChampions: [
            { tournamentId: 59, name: '1v1 Tournament #8', completedAt: '2026-10-19T10:30:00.000Z', champion: 'HitHard', stableId: 7, stableName: 'Hit Machine', stableType: 'human' },
            { tournamentId: 55, name: '1v1 Tournament #7', completedAt: '2026-10-07T10:30:00.000Z', champion: null, stableId: null, stableName: null, stableType: null },
          ],
          dominantStable: { stableId: 7, stableName: 'Hit Machine', titles: 7 },
        },
      }),
      typeEntry('team_2v2', {
        current: current({
          id: 64, name: '2v2 Tournament #13', round: 7, maxRounds: 11, stage: 'Round of 32', participants: 1201,
          expectedFinish: '2026-11-03', currentRound: { matches: 16, done: 0 }, firstRound: { matches: 1024, byes: 847 },
          leftBehind: 3, lastProgressAt: '2026-10-28T15:20:00.000Z', status: { level: 'warning', reasons: ['stalled', 'left_behind'] },
        }),
        season: {
          completed: 12,
          averageDays: 6.9,
          sizes: [{ tournamentId: 61, participants: 907, current: false }, { tournamentId: 64, participants: 1201, current: true }],
          championsByStableType: { human: 12, automaton: 0, generated: 0, unknown: 0 },
          championStables: [{ stableId: 7, stableName: 'Hit Machine', titles: 10 }, { stableId: 9, stableName: 'Ultron Inc', titles: 2 }],
          recentChampions: [],
          dominantStable: { stableId: 7, stableName: 'Hit Machine', titles: 10 },
        },
      }),
      typeEntry('team_3v3'),
    ],
    ...overrides,
  };
}
