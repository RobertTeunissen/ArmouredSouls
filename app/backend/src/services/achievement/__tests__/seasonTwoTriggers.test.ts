/**
 * Season 2 achievement triggers (docs/analysis/ACHIEVEMENTS_SEASON_2_REVAMP.md §4)
 * and the changed conditions (§3). Prisma is mocked: context triggers must not
 * query at all, and history triggers are checked against the rows they read.
 */

const mockPrisma = {
  battleParticipant: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  battle: { findFirst: jest.fn() },
  standing: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  robot: { findUnique: jest.fn(), aggregate: jest.fn() },
  weapon: { findMany: jest.fn() },
  financialLedger: { findFirst: jest.fn(), aggregate: jest.fn() },
  userAchievement: { count: jest.fn() },
  stableSeasonArchive: { count: jest.fn() },
  resetLog: { findFirst: jest.fn().mockResolvedValue(null) },
  $queryRaw: jest.fn(),
};

jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../../utils/robotCalculations', () => ({ calculateEffectiveStatsWithStance: jest.fn() }));

import { ACHIEVEMENTS, type AchievementDefinition } from '../../../config/achievements';
import { evaluateTrigger } from '../triggerEvaluator';

const byId = (id: string): AchievementDefinition => {
  const achievement = ACHIEVEMENTS.find((a) => a.id === id);
  if (!achievement) throw new Error(`no achievement ${id}`);
  return achievement;
};

/** Evaluate one achievement against a battle_complete context. */
const battle = (
  id: string,
  data: Record<string, unknown>,
  cachedRobot: Record<string, unknown> | null = { id: 7, currentLeague: 'bronze', frameId: 3 },
  cachedUser: Record<string, unknown> | null = { currency: 0 },
): Promise<boolean> =>
  evaluateTrigger(byId(id), 1, 7, { type: 'battle_complete', data }, cachedRobot, cachedUser);

const queried = (): boolean =>
  Object.values(mockPrisma).some((model) =>
    typeof model === 'function'
      ? (model as jest.Mock).mock.calls.length > 0
      : Object.values(model).some((fn) => (fn as jest.Mock).mock.calls.length > 0));

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.standing.findMany.mockResolvedValue([]);
  mockPrisma.resetLog.findFirst.mockResolvedValue(null);
});

describe('battle-context triggers (no queries)', () => {
  it('C20 Moral Victory: a 1v1 loss with more damage dealt', async () => {
    const loss = { won: false, isDraw: false, battleType: 'league_1v1', damageDealt: 900, opponentDamageDealt: 800 };
    await expect(battle('C20', loss)).resolves.toBe(true);
    await expect(battle('C20', { ...loss, damageDealt: 700 })).resolves.toBe(false);
    await expect(battle('C20', { ...loss, isDraw: true })).resolves.toBe(false);
    // Team modes don't report the opponent's damage, so they never qualify.
    await expect(battle('C20', { ...loss, battleType: 'league_2v2' })).resolves.toBe(false);
    expect(queried()).toBe(false);
  });

  it('C21 Not Like This: a 1v1 loss with the opponent below 10% HP', async () => {
    const loss = { won: false, isDraw: false, battleType: 'tournament_1v1', opponentFinalHpPercent: 8 };
    await expect(battle('C21', loss)).resolves.toBe(true);
    await expect(battle('C21', { ...loss, opponentFinalHpPercent: 12 })).resolves.toBe(false);
    await expect(battle('C21', { ...loss, opponentFinalHpPercent: undefined })).resolves.toBe(false);
  });

  it('C22 Shall We Play a Game?: only an actual draw', async () => {
    await expect(battle('C22', { won: false, isDraw: true })).resolves.toBe(true);
    await expect(battle('C22', { won: false })).resolves.toBe(false);
  });

  it('C28 The Neverending Story: a 1v1 win of 100 s or more', async () => {
    await expect(battle('C28', { won: true, battleType: 'league_1v1', battleDurationSeconds: 100 })).resolves.toBe(true);
    await expect(battle('C28', { won: true, battleType: 'league_1v1', battleDurationSeconds: 99 })).resolves.toBe(false);
    await expect(battle('C28', { won: true, battleType: 'koth', battleDurationSeconds: 200 })).resolves.toBe(false);
  });

  it('C30 Run, Forrest, Run!: a win at the 50% maximum yield threshold', async () => {
    await expect(battle('C30', { won: true, yieldThreshold: 50 })).resolves.toBe(true);
    await expect(battle('C30', { won: true, yieldThreshold: 49 })).resolves.toBe(false);
  });

  it('S11 R2-D2 Would Be Proud: a reserve win after the partner was destroyed, not after a yield', async () => {
    await expect(battle('S11', { won: true, taggedIn: true, partnerDestroyed: true })).resolves.toBe(true);
    await expect(battle('S11', { won: true, taggedIn: true, partnerDestroyed: false })).resolves.toBe(false);
    // L15 still unlocks on any tag-in win: the two are no longer the same check.
    await expect(battle('L15', { won: true, taggedIn: true, partnerDestroyed: false })).resolves.toBe(true);
  });

  it('L32–L34: tournament round wins, semi-finals and a lost final', async () => {
    const semi = { battleType: 'tournament_2v2', tournamentRound: 2, tournamentMaxRounds: 3 };
    await expect(battle('L32', { ...semi, won: true })).resolves.toBe(true);
    await expect(battle('L32', { ...semi, battleType: 'league_1v1', won: true })).resolves.toBe(false);
    await expect(battle('L33', { ...semi, won: false })).resolves.toBe(true);
    await expect(battle('L33', { ...semi, tournamentRound: 1, won: true })).resolves.toBe(false);
    await expect(battle('L34', { ...semi, tournamentRound: 3, won: false })).resolves.toBe(true);
    await expect(battle('L34', { ...semi, tournamentRound: 3, won: true })).resolves.toBe(false);
    await expect(battle('L34', { ...semi, won: false })).resolves.toBe(false);
  });

  it('L36 Red Shirt and L37 Stayin\' Alive: Grand Melee first out and survivor', async () => {
    const gm = { battleType: 'grand_melee', fieldSize: 20 };
    await expect(battle('L36', { ...gm, destroyed: true, placement: 20 })).resolves.toBe(true);
    await expect(battle('L36', { ...gm, destroyed: true, placement: 19 })).resolves.toBe(false);
    await expect(battle('L37', { ...gm, destroyed: false, placement: 4 })).resolves.toBe(true);
    await expect(battle('L37', { ...gm, destroyed: true, placement: 4 })).resolves.toBe(false);
    // A yield is an elimination: first out, and not a survivor.
    await expect(battle('L36', { ...gm, destroyed: false, yielded: true, placement: 20 })).resolves.toBe(true);
    await expect(battle('L37', { ...gm, destroyed: false, yielded: true, placement: 4 })).resolves.toBe(false);
  });

  it('L38 Rampage: 3 kills in one Grand Melee, not in KotH', async () => {
    await expect(battle('L38', { battleType: 'grand_melee', killsThisBattle: 3 })).resolves.toBe(true);
    await expect(battle('L38', { battleType: 'grand_melee', killsThisBattle: 2 })).resolves.toBe(false);
    await expect(battle('L38', { battleType: 'koth', killsThisBattle: 5 })).resolves.toBe(false);
  });

  it('L39/L40: KotH last robot standing and 30 s uncontested', async () => {
    await expect(battle('L39', { battleType: 'koth', lastStanding: true })).resolves.toBe(true);
    await expect(battle('L39', { battleType: 'koth', lastStanding: false })).resolves.toBe(false);
    await expect(battle('L40', { battleType: 'koth', uncontestedSeconds: 30 })).resolves.toBe(true);
    await expect(battle('L40', { battleType: 'koth', uncontestedSeconds: 29.9 })).resolves.toBe(false);
  });

  it('L41 Ohana: a 3v3 win with the whole team standing', async () => {
    await expect(battle('L41', { won: true, teamSize: 3, teamAllSurvived: true })).resolves.toBe(true);
    await expect(battle('L41', { won: true, teamSize: 2, teamAllSurvived: true })).resolves.toBe(false);
    await expect(battle('L41', { won: true, teamSize: 3, teamAllSurvived: false })).resolves.toBe(false);
  });

  it('S15 Spanish Inquisition: first place as the lowest-rated robot in the field', async () => {
    await expect(battle('S15', { battleType: 'koth', placement: 1, isLowestEloInField: true })).resolves.toBe(true);
    await expect(battle('S15', { battleType: 'grand_melee', placement: 2, isLowestEloInField: true })).resolves.toBe(false);
    await expect(battle('S15', { battleType: 'league_1v1', placement: 1, isLowestEloInField: true })).resolves.toBe(false);
  });

  it('C19 reads the lowest HP of the fight, falling back to final HP', async () => {
    await expect(battle('C19', { won: true, finalHpPercent: 40, minHpPercent: 3 })).resolves.toBe(true);
    await expect(battle('C19', { won: true, finalHpPercent: 40, minHpPercent: 6 })).resolves.toBe(false);
    await expect(battle('C19', { won: true, finalHpPercent: 4 })).resolves.toBe(true);
  });
});

describe('history triggers', () => {
  it('C23/C24: count yields and destructions only when this battle changed them', async () => {
    mockPrisma.battleParticipant.count.mockResolvedValue(10);
    await expect(battle('C23', { yielded: false })).resolves.toBe(false);
    expect(mockPrisma.battleParticipant.count).not.toHaveBeenCalled();
    await expect(battle('C23', { yielded: true })).resolves.toBe(true);
    expect(mockPrisma.battleParticipant.count).toHaveBeenCalledWith({ where: { robotId: 7, yielded: true } });

    mockPrisma.battleParticipant.count.mockResolvedValue(25);
    await expect(battle('C24', { finalHpPercent: 0 })).resolves.toBe(true);
    // Only 0-HP destructions count: a Grand Melee yield used to be stored as destroyed.
    expect(mockPrisma.battleParticipant.count).toHaveBeenLastCalledWith({
      where: { robotId: 7, destroyed: true, finalHP: { lte: 0 } },
    });
    await expect(battle('C24', { finalHpPercent: 30 })).resolves.toBe(false);
  });

  it('E27/E28/E33 count only ledger rows after the latest account reset', async () => {
    const resetAt = new Date('2026-10-01T00:00:00Z');
    mockPrisma.resetLog.findFirst.mockResolvedValue({ resetAt });
    mockPrisma.financialLedger.aggregate.mockResolvedValue({ _sum: { amount: -100 } });
    mockPrisma.financialLedger.findFirst.mockResolvedValue(null);

    await evaluateTrigger(byId('E27'), 1, null, { type: 'attribute_upgraded', data: {} }, null, null);
    expect(mockPrisma.financialLedger.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 1, createdAt: { gt: resetAt }, transactionType: 'attribute_upgrade' },
    }));

    await expect(battle('E28', {}, null, { currency: 1_500_000 })).resolves.toBe(false);
    expect(mockPrisma.financialLedger.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 1, createdAt: { gt: resetAt }, balanceAfter: { lt: 100_000 } },
    }));
  });

  it('C25 Eye of the Tiger: a win after 5 straight 1v1 losses', async () => {
    const loss = { battle: { winnerId: 99 } };
    mockPrisma.battleParticipant.findMany.mockResolvedValue([{ battle: { winnerId: 7 } }, loss, loss, loss, loss, loss]);
    await expect(battle('C25', { won: true, battleType: 'league_1v1' })).resolves.toBe(true);

    // A draw (no winner) in the run breaks the streak.
    mockPrisma.battleParticipant.findMany.mockResolvedValue([{ battle: { winnerId: 7 } }, loss, loss, { battle: { winnerId: null } }, loss, loss]);
    await expect(battle('C25', { won: true, battleType: 'league_1v1' })).resolves.toBe(false);
  });

  it('C26 Revenge of the Fallen: the opponent won the previous meeting', async () => {
    mockPrisma.battle.findFirst.mockResolvedValue({ winnerId: 42 });
    const win = { won: true, battleType: 'league_1v1', opponentRobotId: 42, battleId: 500 };
    await expect(battle('C26', win)).resolves.toBe(true);
    expect(mockPrisma.battle.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { not: 500 } }),
    }));
    mockPrisma.battle.findFirst.mockResolvedValue({ winnerId: 7 });
    await expect(battle('C26', win)).resolves.toBe(false);
  });

  it('C27 Judge Me by My Size: the opponent is in a higher 1v1 tier', async () => {
    mockPrisma.standing.findFirst.mockResolvedValue({ tier: 'gold' });
    const win = { won: true, battleType: 'tournament_1v1', opponentRobotId: 42 };
    await expect(battle('C27', win, { currentLeague: 'silver' })).resolves.toBe(true);
    await expect(battle('C27', win, { currentLeague: 'gold' })).resolves.toBe(false);
  });

  it('S16 Mirror, Mirror: the opponent uses the same chassis', async () => {
    mockPrisma.robot.findUnique.mockResolvedValue({ frameId: 3 });
    const win = { won: true, battleType: 'league_1v1', opponentRobotId: 42 };
    await expect(battle('S16', win, { frameId: 3 })).resolves.toBe(true);
    await expect(battle('S16', win, { frameId: 4 })).resolves.toBe(false);
  });

  it('E28 Back to the Future: now above ₡1M after once dipping below ₡100K', async () => {
    mockPrisma.financialLedger.findFirst.mockResolvedValue({ id: 1 });
    await expect(battle('E28', {}, null, { currency: 1_500_000 })).resolves.toBe(true);
    await expect(battle('E28', {}, null, { currency: 900_000 })).resolves.toBe(false);
    mockPrisma.financialLedger.findFirst.mockResolvedValue(null);
    await expect(battle('E28', {}, null, { currency: 1_500_000 })).resolves.toBe(false);
  });

  it('E27 Better, Stronger, Faster: attribute spend is read from negative ledger amounts', async () => {
    mockPrisma.financialLedger.aggregate.mockResolvedValue({ _sum: { amount: -6_000_000 } });
    const result = await evaluateTrigger(byId('E27'), 1, null, { type: 'attribute_upgraded', data: {} }, null, null);
    expect(result).toBe(true);
  });

  it('P12 Veteran of the Clone Wars: an archive row from an earlier season', async () => {
    mockPrisma.stableSeasonArchive.count.mockResolvedValue(1);
    const result = await evaluateTrigger(byId('P12'), 1, null, { type: 'season_started', data: {} }, null, null);
    expect(result).toBe(true);
  });

  it('S17 Gotta Catch \'Em All: 50 unlocks', async () => {
    mockPrisma.userAchievement.count.mockResolvedValue(50);
    const result = await evaluateTrigger(byId('S17'), 1, null, { type: 'achievement_unlocked', data: {} }, null, null);
    expect(result).toBe(true);
  });
});

describe('changed conditions', () => {
  it('E21 Buy High, Sell Higher: Workshop level 5 or higher', async () => {
    const sale = (workshopLevel: number): Promise<boolean> =>
      evaluateTrigger(byId('E21'), 1, null, { type: 'weapon_sold', data: { workshopLevel } }, null, null);
    await expect(sale(5)).resolves.toBe(true);
    await expect(sale(8)).resolves.toBe(true);
    await expect(sale(4)).resolves.toBe(false);
  });

  it('C3 counts battles in every mode', async () => {
    await expect(battle('C3', {}, { allModesBattles: 10, totalBattles: 6 })).resolves.toBe(true);
    await expect(battle('C3', {}, { allModesBattles: 9, totalBattles: 9 })).resolves.toBe(false);
  });
});
