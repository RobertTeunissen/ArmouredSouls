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
const mockGetTuningBonusesBatch = jest.fn();

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

jest.mock('../../../src/services/tuning-pool', () => ({
  getTuningBonusesBatch: (...args: unknown[]) => mockGetTuningBonusesBatch(...args),
}));

import type { ScheduledTournamentMatch } from '../../../generated/prisma';
import { processTournamentBattle } from '../../../src/services/tournament/tournamentBattleOrchestrator';
import { ROBOT_ATTRIBUTES } from '../../../src/shared/utils/robotAttributes';

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

// #517: the solo tournament path runs the REAL combat preparation, so the robots
// handed to the simulator must carry the canonical loadout-adjusted attributes.
describe('processTournamentBattle combat preparation (#517)', () => {
  const STOP_AFTER_SIMULATE = new Error('stop after simulateBattle');

  const weaponRow = (id: number, attackSpeedBonus: number) => ({
    id,
    refinements: [],
    customName: null,
    weapon: {
      id,
      name: `Blade-${id}`,
      baseDamage: 10,
      cooldown: 3,
      ...Object.fromEntries(ROBOT_ATTRIBUTES.map((attr) => [`${attr}Bonus`, 0])),
      attackSpeedBonus,
    },
  });

  const rawRobot = (id: number, loadoutType: string, offhand: boolean) => ({
    id,
    userId: 11110,
    name: `Robot-${id}`,
    elo: 1500,
    loadoutType,
    stance: 'balanced',
    yieldThreshold: 0,
    currentHP: 1,
    maxHP: 1,
    currentShield: 0,
    maxShield: 0,
    ...Object.fromEntries(ROBOT_ATTRIBUTES.map((attr) => [attr, 10])),
    mainWeapon: weaponRow(id * 10, 2),
    offhandWeapon: offhand ? weaponRow(id * 10 + 1, 2) : null,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockBattleFindUnique.mockResolvedValue(null);
    mockRobotFindUnique.mockReset();
    mockRobotFindUnique
      .mockResolvedValueOnce(rawRobot(3001, 'dual_wield', true))
      .mockResolvedValueOnce(rawRobot(3002, 'weapon_shield', false));
    mockGetTuningBonusesBatch.mockResolvedValue(new Map([[3001, { attackSpeed: 1 }]]));
    mockSimulateBattle.mockImplementation(() => {
      throw STOP_AFTER_SIMULATE;
    });
  });

  it('hands canonical effective attributes to the simulator in tournament mode', async () => {
    const match = {
      id: 78,
      tournamentId: 9,
      participant1Id: 3001,
      participant2Id: 3002,
      battleId: null,
      status: 'scheduled',
      isByeMatch: false,
    } as unknown as ScheduledTournamentMatch;

    await expect(processTournamentBattle(match)).rejects.toBe(STOP_AFTER_SIMULATE);

    expect(mockSimulateBattle).toHaveBeenCalledTimes(1);
    const [r1, r2, isTournament] = mockSimulateBattle.mock.calls[0] as [Record<string, number>, Record<string, number>, boolean];
    expect(isTournament).toBe(true);
    // Dual Wield: (10 + 2 + 2 + tuning 1) × 1.30 = 19.5
    expect(Number(r1.attackSpeed)).toBe(19.5);
    // Weapon + Shield: (10 + 2) × 0.85 = 10.2; shield capacity 10 × 1.20 = 12 → maxShield 48
    expect(Number(r2.attackSpeed)).toBe(10.2);
    expect(Number(r2.shieldCapacity)).toBe(12);
    expect(r2.maxShield).toBe(48);
    expect(r2.currentShield).toBe(48);
    // Full health on entry: 50 + 10 × 5
    expect(r1.currentHP).toBe(100);
  });
});
