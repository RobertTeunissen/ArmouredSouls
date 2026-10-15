/**
 * T7 — Forfeit writer contract (design §4), mocked Prisma.
 *
 * What the writer writes, in what order, and what it never touches. The
 * integration tier (tests/integration/forfeitResolution.test.ts) owns the
 * end-to-end per-mode assertions against real Postgres.
 */
import { BattleErrorCode } from '../../src/errors/battleErrors';
import { resolveByeReward } from '../../src/utils/byeRewards';
import {
  buildByeBattleIncomeEventId,
  buildForfeitBattleIncomeEventId,
} from '../../src/services/financial/financialEventIdentity';

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const calls: string[] = [];
const record = (name: string, value: unknown) => (...args: unknown[]) => {
  calls.push(name);
  void args;
  return value;
};

const mockBattleCreate = jest.fn();
const mockBattleDelete = jest.fn();
const mockParticipantCreate = jest.fn();
const mockSummaryCreate = jest.fn();
const mockScheduledMatchUpdateMany = jest.fn();
const mockTournamentMatchUpdateMany = jest.fn();
const mockScheduledMatchFindUnique = jest.fn();
const mockTournamentMatchFindUnique = jest.fn();

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    battle: {
      create: (...a: unknown[]) => mockBattleCreate(...a),
      delete: (...a: unknown[]) => mockBattleDelete(...a),
    },
    battleParticipant: { create: (...a: unknown[]) => mockParticipantCreate(...a) },
    battleSummary: { create: (...a: unknown[]) => mockSummaryCreate(...a) },
    scheduledMatch: {
      updateMany: (...a: unknown[]) => mockScheduledMatchUpdateMany(...a),
      findUnique: (...a: unknown[]) => mockScheduledMatchFindUnique(...a),
    },
    scheduledTournamentMatch: {
      updateMany: (...a: unknown[]) => mockTournamentMatchUpdateMany(...a),
      findUnique: (...a: unknown[]) => mockTournamentMatchFindUnique(...a),
    },
  },
}));

const mockAwardCredits = jest.fn();
const mockLogAudit = jest.fn();
const mockUpdateRobotCombatStats = jest.fn();
jest.mock('../../src/services/battle/battlePostCombat', () => ({
  awardCreditsWithLedger: (...a: unknown[]) => mockAwardCredits(...a),
  logBattleAuditEvent: (...a: unknown[]) => mockLogAudit(...a),
  updateRobotCombatStats: (...a: unknown[]) => mockUpdateRobotCombatStats(...a),
}));

const mockRecordBattleResult = jest.fn();
jest.mock('../../src/services/standings/standingsService', () => ({
  __esModule: true,
  default: { recordBattleResult: (...a: unknown[]) => mockRecordBattleResult(...a) },
}));

import {
  resolveForfeitEvent,
  type ForfeitResolutionInput,
} from '../../src/services/battle/forfeitResolutionService';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const READY = { id: 11, name: 'Ready', userId: 101, currentHP: 70, maxHP: 100, elo: 1200 };
const UNARMED = { id: 22, name: 'Unarmed', userId: 202, currentHP: 40, maxHP: 100, elo: 1250 };

function leagueInput(overrides: Partial<ForfeitResolutionInput> = {}): ForfeitResolutionInput {
  return {
    mode: 'league_1v1',
    context: { mode: 'league_1v1', tier: 'silver' },
    claim: { source: 'scheduled_match', scheduledMatchId: 5 },
    sides: [
      {
        side: 1,
        forfeited: false,
        stableUserId: READY.userId,
        standingEntity: { entityType: 'robot', entityId: READY.id },
        robots: [READY],
      },
      {
        side: 2,
        forfeited: true,
        stableUserId: UNARMED.userId,
        standingEntity: { entityType: 'robot', entityId: UNARMED.id },
        robots: [UNARMED],
      },
    ],
    newEloByRobotId: { [READY.id]: 1217, [UNARMED.id]: 1233 },
    eloChangeBySide: { 1: 17, 2: -17 },
    lp: { win: 3, loss: -1, draw: 1 },
    standingMode: 'league_1v1',
    battle: {
      battleType: 'league_1v1',
      leagueType: 'silver',
      leagueInstanceId: 'silver_1',
      winnerId: READY.id,
      winningSide: null,
      message: 'Unarmed forfeits',
    },
    cycleNumber: 9,
    ...overrides,
  };
}

function doubleInput(): ForfeitResolutionInput {
  const base = leagueInput();
  return {
    ...base,
    sides: [{ ...base.sides[0], forfeited: true }, base.sides[1]],
    battle: { ...base.battle, winnerId: null, winningSide: null },
    newEloByRobotId: { [READY.id]: 1201, [UNARMED.id]: 1249 },
    eloChangeBySide: { 1: 1, 2: -1 },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  calls.length = 0;
  mockBattleCreate.mockImplementation(record('battle.create', Promise.resolve({ id: 999 })));
  mockBattleDelete.mockImplementation(record('battle.delete', Promise.resolve({})));
  mockScheduledMatchUpdateMany.mockImplementation(record('claim', Promise.resolve({ count: 1 })));
  mockTournamentMatchUpdateMany.mockImplementation(record('claim', Promise.resolve({ count: 1 })));
  mockParticipantCreate.mockImplementation(record('participant', Promise.resolve({})));
  mockSummaryCreate.mockImplementation(record('summary', Promise.resolve({})));
  mockAwardCredits.mockImplementation(record('pay', Promise.resolve(undefined)));
  mockRecordBattleResult.mockImplementation(record('standings', Promise.resolve({})));
  mockUpdateRobotCombatStats.mockImplementation(record('stats', Promise.resolve(undefined)));
  mockLogAudit.mockImplementation(record('audit', Promise.resolve(undefined)));
});

function collapse(sequence: string[]): string[] {
  return sequence.filter((name, i) => i === 0 || sequence[i - 1] !== name);
}

// ─── Validation ──────────────────────────────────────────────────────────────

describe('validation (INVALID_BATTLE_STATE)', () => {
  it('should reject an input with no forfeiting side', async () => {
    const base = leagueInput();
    const input = { ...base, sides: [base.sides[0], { ...base.sides[1], forfeited: false }] as ForfeitResolutionInput['sides'] };
    await expect(resolveForfeitEvent(input)).rejects.toMatchObject({ code: BattleErrorCode.INVALID_BATTLE_STATE });
    expect(mockBattleCreate).not.toHaveBeenCalled();
  });

  it('should reject a ready side with a null stable or no robots', async () => {
    const base = leagueInput();
    const nullStable = { ...base, sides: [{ ...base.sides[0], stableUserId: null }, base.sides[1]] as ForfeitResolutionInput['sides'] };
    const noRobots = { ...base, sides: [{ ...base.sides[0], robots: [] }, base.sides[1]] as ForfeitResolutionInput['sides'] };
    await expect(resolveForfeitEvent(nullStable)).rejects.toMatchObject({ code: BattleErrorCode.INVALID_BATTLE_STATE });
    await expect(resolveForfeitEvent(noRobots)).rejects.toMatchObject({ code: BattleErrorCode.INVALID_BATTLE_STATE });
    expect(mockBattleCreate).not.toHaveBeenCalled();
  });

  it('should reject a tournament claim without tournamentWinnerId', async () => {
    const input = leagueInput({
      mode: 'tournament_1v1',
      context: { mode: 'tournament_1v1', totalParticipants: 8, currentRound: 1, maxRounds: 3 },
      claim: { source: 'tournament_match', tournamentMatchId: 5 },
      standingMode: null,
    });
    await expect(resolveForfeitEvent(input)).rejects.toMatchObject({ code: BattleErrorCode.INVALID_BATTLE_STATE });
    expect(mockBattleCreate).not.toHaveBeenCalled();
  });

  it('should reject a double forfeit that names a winner', async () => {
    const input = doubleInput();
    await expect(
      resolveForfeitEvent({ ...input, battle: { ...input.battle, winnerId: READY.id } }),
    ).rejects.toMatchObject({ code: BattleErrorCode.INVALID_BATTLE_STATE });
    await expect(
      resolveForfeitEvent({ ...input, battle: { ...input.battle, winningSide: 1 } }),
    ).rejects.toMatchObject({ code: BattleErrorCode.INVALID_BATTLE_STATE });
    expect(mockBattleCreate).not.toHaveBeenCalled();
  });
});

// ─── Single forfeit ──────────────────────────────────────────────────────────

describe('single forfeit', () => {
  it('should run create → claim → pay → participants → summary → standings → stats → audit', async () => {
    await resolveForfeitEvent(leagueInput());
    expect(collapse(calls)).toEqual([
      'battle.create', 'claim', 'pay', 'participant', 'summary', 'standings', 'stats', 'audit',
    ]);
  });

  it('should pay the ready stable the bye-level reward once, classified as walkover income', async () => {
    const reward = resolveByeReward({ mode: 'league_1v1', tier: 'silver' });
    const result = await resolveForfeitEvent(leagueInput());

    expect(result).toEqual({ battleId: 999, creditsPaid: reward.credits, outcome: 'forfeit_win', alreadyResolved: false });
    expect(mockAwardCredits).toHaveBeenCalledTimes(1);
    const [userId, amount, type, cycle, , robotId, metadata, options] = mockAwardCredits.mock.calls[0];
    expect(userId).toBe(READY.userId);
    expect(amount).toBe(reward.credits);
    expect(type).toBe('battle_income');
    expect(cycle).toBe(9);
    expect(robotId).toBeUndefined();
    expect(metadata).toEqual({ battleId: 999, scheduledMatchId: 5, isBye: true, forfeit: true });
    expect(options).toEqual({
      battleId: 999,
      sourceEventId: 'forfeit:5:101:league_1v1:battle_income',
      mode: 'league_1v1',
      tier: 'silver',
      outcome: 'forfeit_win',
      participationFloor: reward.credits,
      winComponent: 0,
      teamSize: 1,
      isBye: true,
    });
  });

  it('should write a forfeit battle row and inert participant rows', async () => {
    const reward = resolveByeReward({ mode: 'league_1v1', tier: 'silver' });
    await resolveForfeitEvent(leagueInput());

    const battle = mockBattleCreate.mock.calls[0][0].data;
    expect(battle).toMatchObject({
      battleType: 'league_1v1',
      leagueType: 'silver',
      leagueInstanceId: 'silver_1',
      winnerId: READY.id,
      winningSide: null,
      durationSeconds: 15,
      winnerReward: reward.credits,
      loserReward: 0,
    });
    expect(battle.battleLog).toMatchObject({ isForfeit: true, detailedCombatEvents: [] });
    expect(battle.battleLog.events).toEqual([{ timestamp: 0, type: 'forfeit', message: 'Unarmed forfeits' }]);

    const rows = mockParticipantCreate.mock.calls.map((c) => c[0].data);
    expect(rows).toHaveLength(2);
    const ready = rows.find((r) => r.robotId === READY.id);
    const unarmed = rows.find((r) => r.robotId === UNARMED.id);
    expect(ready).toMatchObject({ team: 1, forfeited: false, credits: reward.credits, finalHP: 70, eloBefore: 1200, eloAfter: 1217 });
    expect(unarmed).toMatchObject({ team: 2, forfeited: true, credits: 0, finalHP: 40, eloBefore: 1250, eloAfter: 1233 });
    for (const row of rows) {
      expect(row).toMatchObject({ damageDealt: 0, destroyed: false, yielded: false, prestigeAwarded: 0, fameAwarded: 0, streamingRevenue: 0 });
    }
  });

  it('should record win/loss standings and a normal loss in robot stats', async () => {
    await resolveForfeitEvent(leagueInput());
    expect(mockRecordBattleResult).toHaveBeenCalledWith({ entityType: 'robot', entityId: READY.id, mode: 'league_1v1', outcome: 'win', lpDelta: 3 });
    expect(mockRecordBattleResult).toHaveBeenCalledWith({ entityType: 'robot', entityId: UNARMED.id, mode: 'league_1v1', outcome: 'loss', lpDelta: -1 });

    const stats = mockUpdateRobotCombatStats.mock.calls.map((c) => c[0]);
    expect(stats.find((s) => s.robotId === READY.id)).toMatchObject({ finalHP: 70, newELO: 1217, isWinner: true, isDraw: false, damageDealt: 0, fameIncrement: 0 });
    expect(stats.find((s) => s.robotId === UNARMED.id)).toMatchObject({ finalHP: 40, newELO: 1233, isWinner: false, isDraw: false, damageDealt: 0, fameIncrement: 0 });
    for (const s of stats) {
      expect(s.stance).toBeUndefined();
      expect(s.loadoutType).toBeUndefined();
    }
  });

  it('should write one audit row per robot with the forfeit extras', async () => {
    await resolveForfeitEvent(leagueInput());
    expect(mockLogAudit).toHaveBeenCalledTimes(2);
    for (const call of mockLogAudit.mock.calls) {
      const participant = call[0] as { robotId: number };
      expect(call[4]).toBe(false); // not a bye
      expect(call[5]).toEqual({ forfeit: true, forfeited: participant.robotId === UNARMED.id, forfeitReason: 'No main weapon equipped' });
      expect(call[6]).toBe(`battle-complete:999:${participant.robotId}`);
    }
  });

  it('should skip standings when standingMode is null and write nothing for an empty forfeiting side', async () => {
    const base = leagueInput();
    await resolveForfeitEvent({
      ...base,
      standingMode: null,
      sides: [base.sides[0], { ...base.sides[1], stableUserId: null, robots: [] }],
    });
    expect(mockRecordBattleResult).not.toHaveBeenCalled();
    expect(mockParticipantCreate).toHaveBeenCalledTimes(1);
    expect(mockUpdateRobotCombatStats).toHaveBeenCalledTimes(1);
    expect(mockLogAudit).toHaveBeenCalledTimes(1);
  });

  it('should finalise a tournament claim atomically with the forfeit', async () => {
    const base = leagueInput();
    await resolveForfeitEvent({
      ...base,
      mode: 'tournament_1v1',
      context: { mode: 'tournament_1v1', totalParticipants: 8, currentRound: 1, maxRounds: 3 },
      claim: { source: 'tournament_match', tournamentMatchId: 5 },
      standingMode: null,
      tournamentWinnerId: READY.id,
    });
    const where = mockTournamentMatchUpdateMany.mock.calls[0][0];
    expect(where.data).toMatchObject({ battleId: 999, status: 'forfeit', winnerId: READY.id });
    const options = mockAwardCredits.mock.calls[0][7] as { tier: string; sourceEventId: string };
    expect(options.tier).toBe('tournament_round');
    expect(options.sourceEventId).toBe('forfeit:5:101:tournament_1v1:battle_income');
  });
});

// ─── Lost claim ──────────────────────────────────────────────────────────────

describe('lost claim', () => {
  it('should delete its battle, pay nothing and return the winning battle id', async () => {
    mockScheduledMatchUpdateMany.mockResolvedValue({ count: 0 });
    mockScheduledMatchFindUnique.mockResolvedValue({ battleId: 555 });
    const result = await resolveForfeitEvent(leagueInput());
    expect(result).toEqual({ battleId: 555, creditsPaid: 0, outcome: 'forfeit_win', alreadyResolved: true });
    expect(mockBattleDelete).toHaveBeenCalledWith({ where: { id: 999 } });
    expect(mockAwardCredits).not.toHaveBeenCalled();
    expect(mockParticipantCreate).not.toHaveBeenCalled();
    expect(mockRecordBattleResult).not.toHaveBeenCalled();
    expect(mockUpdateRobotCombatStats).not.toHaveBeenCalled();
  });
});

// ─── Double forfeit ──────────────────────────────────────────────────────────

describe('double forfeit', () => {
  it('should pay nothing and record a draw everywhere', async () => {
    const result = await resolveForfeitEvent(doubleInput());
    expect(result).toEqual({ battleId: 999, creditsPaid: 0, outcome: 'double_forfeit', alreadyResolved: false });
    expect(mockAwardCredits).not.toHaveBeenCalled();

    const battle = mockBattleCreate.mock.calls[0][0].data;
    expect(battle).toMatchObject({ winnerId: null, winningSide: null, winnerReward: 0, loserReward: 0 });

    const rows = mockParticipantCreate.mock.calls.map((c) => c[0].data);
    expect(rows.every((r) => r.forfeited === true && r.credits === 0)).toBe(true);

    expect(mockRecordBattleResult).toHaveBeenCalledTimes(2);
    for (const call of mockRecordBattleResult.mock.calls) {
      expect(call[0]).toMatchObject({ outcome: 'draw', lpDelta: 1 });
    }
    for (const call of mockUpdateRobotCombatStats.mock.calls) {
      expect(call[0]).toMatchObject({ isWinner: false, isDraw: true });
    }
    for (const call of mockLogAudit.mock.calls) {
      expect(call[0]).toMatchObject({ isWinner: false, isDraw: true, credits: 0 });
    }
  });
});

// ─── Identity ────────────────────────────────────────────────────────────────

describe('buildForfeitBattleIncomeEventId', () => {
  it('should use the forfeit: prefix and differ from the bye identity', () => {
    expect(buildForfeitBattleIncomeEventId(5, 101, 'league_1v1')).toBe('forfeit:5:101:league_1v1:battle_income');
    expect(buildForfeitBattleIncomeEventId(5, 101, 'league_1v1')).not.toBe(buildByeBattleIncomeEventId(5, 101, 'league_1v1'));
  });

  it('should keep a v2 match id and a tournament match id with the same number apart by mode', () => {
    expect(buildForfeitBattleIncomeEventId(5, 101, 'league_1v1')).not.toBe(
      buildForfeitBattleIncomeEventId(5, 101, 'tournament_1v1'),
    );
  });
});
