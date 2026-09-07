const mockBattleFindUnique = jest.fn();
const mockRobotFindUnique = jest.fn();
const mockParticipantFindUnique = jest.fn();
const mockScheduledMatchUpdate = jest.fn();
const mockSimulateBattle = jest.fn();
const mockAwardCreditsWithLedger = jest.fn();
const mockAwardStreamingRevenue = jest.fn();
const mockLogBattleAuditEvent = jest.fn();
const mockCheckAndAwardAchievements = jest.fn();
const mockDidRobotLosePreviousBattle = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    battle: { findUnique: (...args: unknown[]) => mockBattleFindUnique(...args) },
    robot: { findUnique: (...args: unknown[]) => mockRobotFindUnique(...args) },
    battleParticipant: { findUnique: (...args: unknown[]) => mockParticipantFindUnique(...args) },
    scheduledTournamentMatch: { update: (...args: unknown[]) => mockScheduledMatchUpdate(...args) },
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../src/services/battle/combatSimulator', () => ({
  simulateBattle: (...args: unknown[]) => mockSimulateBattle(...args),
}));

jest.mock('../../../src/services/battle/baseOrchestrator', () => ({
  getCurrentCycleNumber: jest.fn().mockResolvedValue(7),
}));

jest.mock('../../../src/services/battle/battlePostCombat', () => ({
  awardCreditsWithLedger: (...args: unknown[]) => mockAwardCreditsWithLedger(...args),
  awardStreamingRevenueForParticipant: (...args: unknown[]) => mockAwardStreamingRevenue(...args),
  logBattleAuditEvent: (...args: unknown[]) => mockLogBattleAuditEvent(...args),
  checkAndAwardAchievements: (...args: unknown[]) => mockCheckAndAwardAchievements(...args),
  didRobotLosePreviousBattle: (...args: unknown[]) => mockDidRobotLosePreviousBattle(...args),
  updateRobotCombatStats: jest.fn(),
  awardPrestigeToUser: jest.fn(),
}));

import type { ScheduledTournamentMatch } from '../../../generated/prisma';
import { processTournamentBattle } from '../../../src/services/tournament/tournamentBattleOrchestrator';

const persistedBattle = {
  id: 390777,
  winnerId: 2001,
  winnerReward: 1200,
  loserReward: 300,
  leagueType: 'tournament',
  durationSeconds: 65,
};

const robot1 = {
  id: 2001,
  userId: 11110,
  maxHP: 1000,
  elo: 1500,
  loadoutType: 'single',
  stance: 'balanced',
  yieldThreshold: 0,
  mainWeaponId: 1,
};

const robot2 = {
  id: 2002,
  userId: 11110,
  maxHP: 1000,
  elo: 1450,
  loadoutType: 'single',
  stance: 'balanced',
  yieldThreshold: 0,
  mainWeaponId: 2,
};

const winnerParticipant = {
  battleId: 390777,
  robotId: 2001,
  damageDealt: 700,
  finalHP: 250,
  yielded: false,
  destroyed: false,
  credits: 1200,
  prestigeAwarded: 20,
  fameAwarded: 15,
  eloBefore: 1500,
  eloAfter: 1516,
};

const loserParticipant = {
  battleId: 390777,
  robotId: 2002,
  damageDealt: 400,
  finalHP: 0,
  yielded: false,
  destroyed: true,
  credits: 300,
  prestigeAwarded: 0,
  fameAwarded: 0,
  eloBefore: 1450,
  eloAfter: 1434,
};

describe('processTournamentBattle persisted-battle finalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBattleFindUnique.mockResolvedValue(persistedBattle);
    mockRobotFindUnique
      .mockResolvedValueOnce(robot1)
      .mockResolvedValueOnce(robot2);
    mockParticipantFindUnique
      .mockResolvedValueOnce(winnerParticipant)
      .mockResolvedValueOnce(loserParticipant);
    mockAwardStreamingRevenue
      .mockResolvedValueOnce({ totalRevenue: 600 })
      .mockResolvedValueOnce({ totalRevenue: 550 });
    mockCheckAndAwardAchievements.mockResolvedValue([]);
    mockDidRobotLosePreviousBattle.mockResolvedValue(false);
    mockScheduledMatchUpdate.mockResolvedValue({});
  });

  it('should finalize the existing battle without simulating or replaying combat stats', async () => {
    const match = {
      id: 77,
      tournamentId: 9,
      participant1Id: 2001,
      participant2Id: 2002,
      battleId: 390777,
      status: 'scheduled',
      isByeMatch: false,
    } as unknown as ScheduledTournamentMatch;

    const result = await processTournamentBattle(match);

    expect(mockSimulateBattle).not.toHaveBeenCalled();
    expect(mockAwardCreditsWithLedger).toHaveBeenCalledTimes(2);
    expect(mockAwardCreditsWithLedger.mock.calls.map((call) => call[5])).toEqual([2001, 2002]);
    expect(mockAwardStreamingRevenue).toHaveBeenCalledTimes(2);
    expect(mockLogBattleAuditEvent).toHaveBeenCalledTimes(2);
    expect(mockCheckAndAwardAchievements).toHaveBeenCalledTimes(2);
    expect(mockScheduledMatchUpdate).toHaveBeenCalledWith({
      where: { id: 77 },
      data: {
        winnerId: 2001,
        status: 'completed',
        completedAt: expect.any(Date),
      },
    });
    expect(result).toMatchObject({
      battleId: 390777,
      winnerId: 2001,
      achievementUnlocks: [],
    });
  });
});
