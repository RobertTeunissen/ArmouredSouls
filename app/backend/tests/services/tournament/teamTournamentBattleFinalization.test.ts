const mockBattleFindUnique = jest.fn();
const mockTeamBattleFindUnique = jest.fn();
const mockRobotFindMany = jest.fn();
const mockScheduledMatchFindMany = jest.fn();
const mockScheduledMatchUpdate = jest.fn();
const mockBattleParticipantUpdate = jest.fn();
const mockBattleUpdate = jest.fn();
const mockSimulateTeamBattle = jest.fn();
const mockAwardCreditsWithLedger = jest.fn();
const mockAwardStreamingRevenue = jest.fn();
const mockAwardPrestigeToUser = jest.fn();
const mockCheckAndAwardAchievements = jest.fn();
const mockDidRobotLosePreviousBattle = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    battle: {
      findUnique: (...args: unknown[]) => mockBattleFindUnique(...args),
      update: (...args: unknown[]) => mockBattleUpdate(...args),
    },
    teamBattle: { findUnique: (...args: unknown[]) => mockTeamBattleFindUnique(...args) },
    robot: { findMany: (...args: unknown[]) => mockRobotFindMany(...args) },
    scheduledTournamentMatch: {
      findMany: (...args: unknown[]) => mockScheduledMatchFindMany(...args),
      update: (...args: unknown[]) => mockScheduledMatchUpdate(...args),
    },
    battleParticipant: { update: (...args: unknown[]) => mockBattleParticipantUpdate(...args) },
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../src/services/team-battle/teamBattleEngine', () => ({
  simulateTeamBattle: (...args: unknown[]) => mockSimulateTeamBattle(...args),
}));

jest.mock('../../../src/services/battle/baseOrchestrator', () => ({
  getCurrentCycleNumber: jest.fn().mockResolvedValue(7),
}));

jest.mock('../../../src/services/battle/battlePostCombat', () => ({
  awardCreditsWithLedger: (...args: unknown[]) => mockAwardCreditsWithLedger(...args),
  awardStreamingRevenueForParticipant: (...args: unknown[]) => mockAwardStreamingRevenue(...args),
  awardPrestigeToUser: (...args: unknown[]) => mockAwardPrestigeToUser(...args),
  checkAndAwardAchievements: (...args: unknown[]) => mockCheckAndAwardAchievements(...args),
  didRobotLosePreviousBattle: (...args: unknown[]) => mockDidRobotLosePreviousBattle(...args),
  updateRobotCombatStats: jest.fn(),
}));

import type { ScheduledTournamentMatch, Tournament } from '../../../generated/prisma';
import { processTeamTournamentBattle } from '../../../src/services/tournament/teamTournamentBattleOrchestrator';

const team1Robots = [
  { id: 101, name: 'A', userId: 11110, elo: 1500, maxHP: 1000, currentHP: 800, mainWeaponId: 1, loadoutType: 'single', stance: 'balanced', yieldThreshold: 0 },
  { id: 102, name: 'B', userId: 11110, elo: 1490, maxHP: 1000, currentHP: 700, mainWeaponId: 2, loadoutType: 'single', stance: 'balanced', yieldThreshold: 0 },
];
const team2Robots = [
  { id: 201, name: 'C', userId: 11110, elo: 1480, maxHP: 1000, currentHP: 0, mainWeaponId: 3, loadoutType: 'single', stance: 'balanced', yieldThreshold: 0 },
  { id: 202, name: 'D', userId: 11110, elo: 1470, maxHP: 1000, currentHP: 0, mainWeaponId: 4, loadoutType: 'single', stance: 'balanced', yieldThreshold: 0 },
];

const persistedBattle = {
  id: 501,
  winnerId: 11,
  winningSide: 1,
  durationSeconds: 60,
  participants: [
    { battleId: 501, robotId: 101, team: 1, damageDealt: 600, finalHP: 800, eloBefore: 1500, eloAfter: 1516 },
    { battleId: 501, robotId: 102, team: 1, damageDealt: 500, finalHP: 700, eloBefore: 1490, eloAfter: 1506 },
    { battleId: 501, robotId: 201, team: 2, damageDealt: 250, finalHP: 0, eloBefore: 1480, eloAfter: 1464 },
    { battleId: 501, robotId: 202, team: 2, damageDealt: 300, finalHP: 0, eloBefore: 1470, eloAfter: 1454 },
  ],
};

describe('processTeamTournamentBattle persisted-battle finalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTeamBattleFindUnique
      .mockResolvedValueOnce({ id: 11, stableId: 11110, teamName: 'First', members: team1Robots.map(robot => ({ robotId: robot.id })) })
      .mockResolvedValueOnce({ id: 12, stableId: 11110, teamName: 'Second', members: team2Robots.map(robot => ({ robotId: robot.id })) });
    mockRobotFindMany
      .mockResolvedValueOnce(team1Robots)
      .mockResolvedValueOnce(team2Robots);
    mockBattleFindUnique.mockResolvedValue(persistedBattle);
    mockScheduledMatchFindMany.mockResolvedValue([{ isByeMatch: false }]);
    mockAwardStreamingRevenue.mockResolvedValue({ totalRevenue: 500 });
    mockCheckAndAwardAchievements.mockResolvedValue([]);
    mockDidRobotLosePreviousBattle.mockResolvedValue(false);
    mockScheduledMatchUpdate.mockResolvedValue({});
    mockBattleParticipantUpdate.mockResolvedValue({});
    mockBattleUpdate.mockResolvedValue({});
  });

  it('should finalize all four same-stable recipients without a second team simulation', async () => {
    const match = {
      id: 88,
      tournamentId: 9,
      participant1Id: 11,
      participant2Id: 12,
      battleId: 501,
      status: 'scheduled',
      isByeMatch: false,
    } as unknown as ScheduledTournamentMatch;
    const tournament = {
      id: 9,
      participantType: 'team_2v2',
      totalParticipants: 8,
      currentRound: 2,
      maxRounds: 3,
    } as unknown as Tournament;

    const result = await processTeamTournamentBattle(match, tournament);

    expect(mockSimulateTeamBattle).not.toHaveBeenCalled();
    expect(mockAwardCreditsWithLedger).toHaveBeenCalledTimes(4);
    expect(mockAwardCreditsWithLedger.mock.calls.map((call) => call[5])).toEqual([101, 102, 201, 202]);
    expect(mockScheduledMatchUpdate).toHaveBeenCalledWith({
      where: { id: 88 },
      data: {
        winnerId: 11,
        battleId: 501,
        status: 'completed',
        completedAt: expect.any(Date),
      },
    });
    expect(result).toMatchObject({ battleId: 501, winnerId: 11 });
  });
});
