/**
 * Bye_Resolution_Writer — behavioural tests (Spec #49).
 *
 * These sit on the unit tier with a mocked Prisma client rather than in the
 * integration tier, because what they assert is the writer's *contract*: what it
 * writes, in what order, and what it never touches. The integration tier owns
 * the end-to-end Bye_Invariant across all nine modes against real Postgres.
 *
 * The central assertion — repeated across modes — is that a bye leaves every
 * robot exactly as it was. Before Spec #49 a team or tag team bye ran a full
 * combat simulation against weaponless Bye_Placeholders which, via the Fists
 * fallback and the `!weaponLike` range bypass, dealt real damage that was then
 * persisted. A walkover was billing players for repairs.
 */

import { BYE_MODES, BYE_MODE_SPECS, ByeMode, ByeRewardInput } from '../../../../src/utils/byeRewards';

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const mockBattleCreate = jest.fn();
const mockBattleDelete = jest.fn();
const mockParticipantCreate = jest.fn();
const mockSummaryCreate = jest.fn();
const mockScheduledMatchUpdateMany = jest.fn();
const mockTournamentMatchUpdateMany = jest.fn();
const mockScheduledMatchFindUnique = jest.fn();
const mockTournamentMatchFindUnique = jest.fn();

jest.mock('../../../../src/lib/prisma', () => ({
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
jest.mock('../../../../src/services/battle/battlePostCombat', () => ({
  awardCreditsWithLedger: (...a: unknown[]) => mockAwardCredits(...a),
  logBattleAuditEvent: (...a: unknown[]) => mockLogAudit(...a),
  updateRobotCombatStats: (...a: unknown[]) => mockUpdateRobotCombatStats(...a),
}));

const mockRecordBattleResult = jest.fn();
jest.mock('../../../../src/services/standings/standingsService', () => ({
  __esModule: true,
  default: { recordBattleResult: (...a: unknown[]) => mockRecordBattleResult(...a) },
}));

import { resolveByeEvent } from '../../../../src/services/battle/byeResolutionService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROBOT = {
  id: 7,
  name: 'Ironclad',
  userId: 42,
  currentHP: 61, // deliberately damaged: a bye must not change this
  maxHP: 100,
  elo: 1200,
};

// The input is a discriminated union on `mode`; a generic ByeMode cannot narrow
// it, so the cast is unavoidable in a table-driven helper.
function contextFor(mode: ByeMode): ByeRewardInput {
  return (
    BYE_MODE_SPECS[mode].floor === 'tier_scaled'
      ? { mode, tier: 'bronze' }
      : { mode, totalParticipants: 16, currentRound: 1, maxRounds: 4 }
  ) as ByeRewardInput;
}

function inputFor(mode: ByeMode, overrides: Record<string, unknown> = {}): Parameters<typeof resolveByeEvent>[0] {
  const spec = BYE_MODE_SPECS[mode];
  const participants = Array.from({ length: spec.teamSize }, (_, i) => ({
    ...ROBOT,
    id: ROBOT.id + i,
    name: `${ROBOT.name}-${i}`,
  }));

  return {
    mode,
    context: contextFor(mode),
    claim:
      spec.floor === 'tournament_round_loss'
        ? { source: 'tournament_match' as const, tournamentMatchId: 5 }
        : { source: 'scheduled_match' as const, scheduledMatchId: 5 },
    participants,
    stableUserId: ROBOT.userId,
    battle: {
      battleType: mode,
      leagueType: 'bronze',
      winnerId: participants[0].id,
      byeMessage: 'walkover',
    },
    standingEntity: { entityType: 'robot' as const, entityId: participants[0].id },
    cycleNumber: 10,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBattleCreate.mockResolvedValue({ id: 999 });
  mockBattleDelete.mockResolvedValue({});
  mockScheduledMatchUpdateMany.mockResolvedValue({ count: 1 });
  mockTournamentMatchUpdateMany.mockResolvedValue({ count: 1 });
  mockParticipantCreate.mockResolvedValue({});
  mockSummaryCreate.mockResolvedValue({});
  mockAwardCredits.mockResolvedValue(undefined);
  mockLogAudit.mockResolvedValue(undefined);
  mockUpdateRobotCombatStats.mockResolvedValue(undefined);
  mockRecordBattleResult.mockResolvedValue({});
});

// ─── The Bye_Invariant, across all nine modes ────────────────────────────────

describe('the Bye_Invariant holds in every mode', () => {
  it.each(BYE_MODES)('should write an inert, credits-only record for %s', async (mode) => {
    const input = inputFor(mode);
    const result = await resolveByeEvent(input);

    expect(result.alreadyResolved).toBe(false);
    expect(result.creditsPaid).toBeGreaterThan(0);

    // One battles row, flagged as a bye.
    expect(mockBattleCreate).toHaveBeenCalledTimes(1);
    const battleData = mockBattleCreate.mock.calls[0][0].data;
    expect(battleData.battleLog.isByeMatch).toBe(true);
    expect(battleData.loserReward).toBe(0);

    // One participant row per real robot, all inert, HP untouched.
    expect(mockParticipantCreate).toHaveBeenCalledTimes(BYE_MODE_SPECS[mode].teamSize);
    const rows = mockParticipantCreate.mock.calls.map((c) => c[0].data);
    for (const row of rows) {
      expect(row.damageDealt).toBe(0);
      expect(row.destroyed).toBe(false);
      expect(row.yielded).toBe(false);
      expect(row.prestigeAwarded).toBe(0);
      expect(row.fameAwarded).toBe(0);
      expect(row.streamingRevenue).toBe(0);
      expect(row.finalHP).toBe(ROBOT.currentHP);
      expect(row.robotId).toBeGreaterThan(0);
    }

    // Per-robot credits reconcile exactly with the stable award.
    const sum = rows.reduce((acc: number, r: { credits: number }) => acc + r.credits, 0);
    expect(sum).toBe(result.creditsPaid);
    expect(mockAwardCredits).toHaveBeenCalledWith(
      ROBOT.userId,
      result.creditsPaid,
      'battle_income',
      10,
      expect.any(String),
    );

    // A summary row with no combat data.
    expect(mockSummaryCreate).toHaveBeenCalledTimes(1);
    const summaryData = mockSummaryCreate.mock.calls[0][0].data;
    expect(summaryData.hasData).toBe(false);
    expect(summaryData.totalEvents).toBe(0);

    // One audit row per real robot, flagged as a bye.
    expect(mockLogAudit).toHaveBeenCalledTimes(BYE_MODE_SPECS[mode].teamSize);
    for (const call of mockLogAudit.mock.calls) {
      expect(call[4]).toBe(true); // isByeMatch
      const participant = call[0] as { isDraw: boolean; isWinner: boolean };
      expect(participant.isDraw).toBe(false);
      expect(participant.isWinner).toBe(true);
    }
  });
});

// ─── The per-mode differences ────────────────────────────────────────────────

describe('the per-mode differences match the Bye_Mode_Table', () => {
  it.each(BYE_MODES)('should apply the declared Standing and ELO rules for %s', async (mode) => {
    const spec = BYE_MODE_SPECS[mode];
    await resolveByeEvent(inputFor(mode));

    if (spec.standingMode && spec.lpDelta !== 0) {
      expect(mockRecordBattleResult).toHaveBeenCalledWith(
        expect.objectContaining({ mode: spec.standingMode, outcome: 'win', lpDelta: spec.lpDelta }),
      );
    } else {
      // Not calling is a stronger guarantee than calling with zeroes: a match
      // that never ran cannot register as a finishing position.
      expect(mockRecordBattleResult).not.toHaveBeenCalled();
    }

    if (spec.updatesElo) {
      expect(mockUpdateRobotCombatStats).toHaveBeenCalledTimes(spec.teamSize);
      for (const call of mockUpdateRobotCombatStats.mock.calls) {
        // The robot's existing HP, never a simulated finalHP.
        expect(call[0].finalHP).toBe(ROBOT.currentHP);
        expect(call[0].damageDealt).toBe(0);
        expect(call[0].fameIncrement).toBe(0);
      }
    } else {
      expect(mockUpdateRobotCombatStats).not.toHaveBeenCalled();
    }
  });

  it('should leave eloAfter equal to eloBefore wherever the mode does not move ELO', async () => {
    for (const mode of BYE_MODES) {
      jest.clearAllMocks();
      mockBattleCreate.mockResolvedValue({ id: 999 });
      mockScheduledMatchUpdateMany.mockResolvedValue({ count: 1 });
      mockTournamentMatchUpdateMany.mockResolvedValue({ count: 1 });

      await resolveByeEvent(inputFor(mode));

      if (!BYE_MODE_SPECS[mode].updatesElo) {
        for (const call of mockParticipantCreate.mock.calls) {
          expect(call[0].data.eloAfter).toBe(call[0].data.eloBefore);
        }
      }
    }
  });
});

// ─── Idempotency ─────────────────────────────────────────────────────────────

describe('the Bye_Award_Claim pays at most once', () => {
  it('should pay nothing and delete the orphan battle when the claim is lost', async () => {
    mockScheduledMatchUpdateMany.mockResolvedValue({ count: 0 });
    mockScheduledMatchFindUnique.mockResolvedValue({ battleId: 555 });

    const result = await resolveByeEvent(inputFor('league_1v1'));

    expect(result.alreadyResolved).toBe(true);
    expect(result.creditsPaid).toBe(0);
    expect(mockAwardCredits).not.toHaveBeenCalled();
    expect(mockParticipantCreate).not.toHaveBeenCalled();
    // The battles row created before the claim is cleaned up, so a lost claim
    // leaves no orphan.
    expect(mockBattleDelete).toHaveBeenCalledWith({ where: { id: 999 } });
  });

  it('should report the winning battle id when the claim is lost, not the orphan and not null', async () => {
    mockScheduledMatchUpdateMany.mockResolvedValue({ count: 0 });
    mockScheduledMatchFindUnique.mockResolvedValue({ battleId: 555 });

    const result = await resolveByeEvent(inputFor('league_1v1'));

    // 555 is the battle written by whoever claimed first; 999 is this call's
    // orphan, which was deleted. A caller linking to a battle needs the former.
    expect(result.battleId).toBe(555);
    expect(mockScheduledMatchFindUnique).toHaveBeenCalled();
  });

  it('should claim before paying, never after', async () => {
    const order: string[] = [];
    mockScheduledMatchUpdateMany.mockImplementation(async () => {
      order.push('claim');
      return { count: 1 };
    });
    mockAwardCredits.mockImplementation(async () => {
      order.push('pay');
    });

    await resolveByeEvent(inputFor('league_1v1'));

    expect(order).toEqual(['claim', 'pay']);
  });

  it('should claim the tournament battleId column rather than status', async () => {
    await resolveByeEvent(inputFor('tournament_1v1'));

    // Bracket advancement has already spent the status token by the time the
    // reward is due, so tournaments claim battleId instead.
    expect(mockTournamentMatchUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5, battleId: null } }),
    );
    expect(mockScheduledMatchUpdateMany).not.toHaveBeenCalled();
  });
});

// ─── Error handling ──────────────────────────────────────────────────────────

describe('a summary failure never costs a player a reward', () => {
  it('should still pay credits and take the claim when the summary insert rejects', async () => {
    mockSummaryCreate.mockRejectedValue(new Error('summary table unavailable'));

    const result = await resolveByeEvent(inputFor('league_1v1'));

    expect(result.alreadyResolved).toBe(false);
    expect(result.creditsPaid).toBeGreaterThan(0);
    expect(mockAwardCredits).toHaveBeenCalledTimes(1);
  });

  it('should continue with remaining robots when one audit row fails', async () => {
    mockLogAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await resolveByeEvent(inputFor('league_3v3'));

    expect(result.creditsPaid).toBeGreaterThan(0);
    expect(mockLogAudit).toHaveBeenCalledTimes(3);
  });
});
