/**
 * #453: the team-tournament create path must write `winningSide` as part of
 * `battle.create()`. The resume path (`resumeTeamTournamentBattleFinalization`)
 * rejects a persisted battle without a winning side, so a swallowed post-create
 * update used to make an interrupted match unrecoverable.
 *
 * `battle.create` captures its payload and then throws a sentinel, which stops
 * processing before rewards, so the test only needs the pre-create mocks.
 */
const mockBattleCreate = jest.fn();
const mockBattleUpdate = jest.fn();
const mockTeamBattleFindUnique = jest.fn();
const mockRobotFindMany = jest.fn();
const mockSimulateTeamBattle = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    battle: {
      create: (...args: unknown[]) => mockBattleCreate(...args),
      update: (...args: unknown[]) => mockBattleUpdate(...args),
    },
    teamBattle: { findUnique: (...args: unknown[]) => mockTeamBattleFindUnique(...args) },
    robot: { findMany: (...args: unknown[]) => mockRobotFindMany(...args) },
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/services/team-battle/teamBattleEngine', () => ({
  simulateTeamBattle: (...args: unknown[]) => mockSimulateTeamBattle(...args),
}));

jest.mock('../../../src/services/tuning-pool', () => ({
  getTuningBonusesBatch: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('../../../src/utils/robotCalculations', () => ({
  prepareRobotForCombat: jest.fn(),
}));

import type { ScheduledTournamentMatch, Tournament } from '../../../generated/prisma';
import { processTeamTournamentBattle } from '../../../src/services/tournament/teamTournamentBattleOrchestrator';

const STOP_AFTER_CREATE = new Error('stop after battle.create');

const team1Robots = [
  { id: 101, name: 'A', userId: 1, elo: 1500, maxHP: 1000, currentHP: 1000, stance: 'balanced', loadoutType: 'single' },
  { id: 102, name: 'B', userId: 1, elo: 1500, maxHP: 1000, currentHP: 1000, stance: 'balanced', loadoutType: 'single' },
];
const team2Robots = [
  { id: 201, name: 'C', userId: 2, elo: 1500, maxHP: 1000, currentHP: 1000, stance: 'balanced', loadoutType: 'single' },
  { id: 202, name: 'D', userId: 2, elo: 1500, maxHP: 1000, currentHP: 1000, stance: 'balanced', loadoutType: 'single' },
];

const match = {
  id: 88,
  tournamentId: 9,
  participant1Id: 11,
  participant2Id: 12,
  battleId: null,
  status: 'scheduled',
  isByeMatch: false,
} as unknown as ScheduledTournamentMatch;

const tournament = {
  id: 9,
  participantType: 'team_2v2',
  totalParticipants: 8,
  currentRound: 1,
  maxRounds: 3,
} as unknown as Tournament;

function battleResult(winningSide: 1 | 2 | null, team1HP: number, team2HP: number) {
  const participant = (robotId: number, team: 1 | 2, finalHP: number) => ({
    robotId,
    team,
    damageDealt: 100,
    damageTaken: 100,
    finalHP,
    survivalSeconds: 60,
  });
  return {
    winningSide,
    winnerRobotId: null,
    isDraw: winningSide === null,
    isByeMatch: false,
    durationSeconds: 60,
    participants: [
      participant(101, 1, team1HP),
      participant(102, 1, team1HP),
      participant(201, 2, team2HP),
      participant(202, 2, team2HP),
    ],
    battleLog: [],
    focusFireEvents: [],
    focusFireMetrics: { team1: 0, team2: 0 },
    allySupportMetrics: { team1: 0, team2: 0 },
    formationDefenceMetrics: { team1: 0, team2: 0 },
    detailedCombatEvents: [],
    arenaRadius: 20,
    startingPositions: {},
    endingPositions: {},
  };
}

describe('processTeamTournamentBattle winningSide (#453)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTeamBattleFindUnique
      .mockResolvedValueOnce({ id: 11, stableId: 1, teamName: 'First', members: team1Robots.map((r) => ({ robotId: r.id })) })
      .mockResolvedValueOnce({ id: 12, stableId: 2, teamName: 'Second', members: team2Robots.map((r) => ({ robotId: r.id })) });
    mockRobotFindMany.mockResolvedValueOnce(team1Robots).mockResolvedValueOnce(team2Robots);
    mockBattleCreate.mockRejectedValue(STOP_AFTER_CREATE);
  });

  it.each([
    ['natural team 1 win', battleResult(1, 500, 0), 1, 11],
    ['natural team 2 win', battleResult(2, 0, 500), 2, 12],
    ['draw resolved to team 2 on HP', battleResult(null, 100, 300), 2, 12],
    ['draw with equal HP resolved to the higher seed', battleResult(null, 200, 200), 1, 11],
  ] as const)('%s: create payload carries the resolved side', async (_label, result, expectedSide, expectedWinnerId) => {
    mockSimulateTeamBattle.mockReturnValue(result);

    await expect(processTeamTournamentBattle(match, tournament)).rejects.toBe(STOP_AFTER_CREATE);

    expect(mockBattleCreate).toHaveBeenCalledTimes(1);
    const { data } = mockBattleCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.winningSide).toBe(expectedSide);
    expect(data.winnerId).toBe(expectedWinnerId);
    expect(mockBattleUpdate).not.toHaveBeenCalled();
  });
});
