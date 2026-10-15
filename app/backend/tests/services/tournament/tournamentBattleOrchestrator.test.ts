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
const mockTournamentFindUnique = jest.fn();
const mockResolveForfeitEvent = jest.fn();
const mockResolveHigherSeed = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    tournament: { findUnique: (...args: unknown[]) => mockTournamentFindUnique(...args) },
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

jest.mock('../../../src/services/battle/forfeitResolutionService', () => ({
  resolveForfeitEvent: (...args: unknown[]) => mockResolveForfeitEvent(...args),
}));

jest.mock('../../../src/services/tournament/tournamentService', () => ({
  ...jest.requireActual('../../../src/services/tournament/tournamentService'),
  resolveHigherSeed: (...args: unknown[]) => mockResolveHigherSeed(...args),
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
      isForfeit: false,
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

  // A complete loadout: an incomplete one would fight as single (rule 6) and
  // lose the loadout modifier this case asserts. The weapon_shield offhand is a
  // zero-bonus shield so the asserted values are the loadout modifier alone.
  const rawRobot = (id: number, loadoutType: string, offhandAttackSpeedBonus: number) => ({
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
    offhandWeapon: weaponRow(id * 10 + 1, offhandAttackSpeedBonus),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockBattleFindUnique.mockResolvedValue(null);
    mockRobotFindUnique.mockReset();
    mockRobotFindUnique
      .mockResolvedValueOnce(rawRobot(3001, 'dual_wield', 2))
      .mockResolvedValueOnce(rawRobot(3002, 'weapon_shield', 0));
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

// Design §5.4: a robot without a main weapon forfeits through the shared
// writer; nothing is simulated and the return literal names the advancing
// participant.
describe('processTournamentBattle battle-time forfeits', () => {
  const armed = (id: number) => ({
    id,
    userId: id * 10,
    name: `Robot-${id}`,
    elo: id === 4001 ? 1500 : 1450,
    currentHP: 80,
    maxHP: 100,
    loadoutType: 'single',
    mainWeaponId: id,
    offhandWeaponId: null,
    mainWeapon: { id, weapon: { id } },
    offhandWeapon: null,
  });
  const unarmed = (id: number) => ({ ...armed(id), mainWeaponId: null, mainWeapon: null });
  const match = {
    id: 79,
    tournamentId: 9,
    participant1Id: 4001,
    participant2Id: 4002,
    battleId: null,
    status: 'pending',
    isByeMatch: false,
  } as unknown as ScheduledTournamentMatch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRobotFindUnique.mockReset();
    mockTournamentFindUnique.mockResolvedValue({ id: 9, totalParticipants: 8, currentRound: 2, maxRounds: 3 });
    mockResolveForfeitEvent.mockResolvedValue({ battleId: 555, creditsPaid: 1000, outcome: 'forfeit_win', alreadyResolved: false });
  });

  it('forfeits the unarmed robot and advances the ready one', async () => {
    mockRobotFindUnique.mockResolvedValueOnce(armed(4001)).mockResolvedValueOnce(unarmed(4002));

    const result = await processTournamentBattle(match);

    expect(mockSimulateBattle).not.toHaveBeenCalled();
    expect(mockGetTuningBonusesBatch).not.toHaveBeenCalled();
    expect(mockResolveForfeitEvent).toHaveBeenCalledTimes(1);
    const input = mockResolveForfeitEvent.mock.calls[0][0];
    expect(input).toMatchObject({
      mode: 'tournament_1v1',
      context: { mode: 'tournament_1v1', totalParticipants: 8, currentRound: 2, maxRounds: 3 },
      claim: { source: 'tournament_match', tournamentMatchId: 79 },
      standingMode: null,
      tournamentWinnerId: 4001,
      battle: { battleType: 'tournament_1v1', leagueType: 'tournament', tournamentId: 9, tournamentRound: 2, winnerId: 4001, winningSide: null },
    });
    expect(input.sides.map((s: { forfeited: boolean }) => s.forfeited)).toEqual([false, true]);
    expect(result).toEqual({
      battleId: 555,
      winnerId: 4001,
      isForfeit: true,
      isByeMatch: false,
      robot1FinalHP: 80,
      robot2FinalHP: 80,
      robot1Damage: 0,
      robot2Damage: 0,
      durationSeconds: 15,
      prestigeAwarded: 0,
      fameAwarded: 0,
      achievementUnlocks: [],
    });
  });

  it('writes a draw battle on a double forfeit and advances the higher seed', async () => {
    mockRobotFindUnique.mockResolvedValueOnce(unarmed(4001)).mockResolvedValueOnce(unarmed(4002));
    mockResolveForfeitEvent.mockResolvedValue({ battleId: 556, creditsPaid: 0, outcome: 'double_forfeit', alreadyResolved: false });
    mockResolveHigherSeed.mockResolvedValue(4002);

    const result = await processTournamentBattle(match);

    expect(mockSimulateBattle).not.toHaveBeenCalled();
    expect(mockResolveHigherSeed).toHaveBeenCalledWith(9, 4001, 4002);
    const input = mockResolveForfeitEvent.mock.calls[0][0];
    expect(input.battle).toMatchObject({ winnerId: null, winningSide: null });
    expect(input.tournamentWinnerId).toBe(4002);
    expect(input.sides.map((s: { forfeited: boolean }) => s.forfeited)).toEqual([true, true]);
    expect(result).toMatchObject({ battleId: 556, winnerId: 4002, isForfeit: true });
  });
});
