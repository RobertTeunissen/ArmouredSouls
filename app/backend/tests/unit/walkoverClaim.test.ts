/**
 * Walkover claim — T29 (PR #536).
 *
 * Byes and battle-time forfeits share one claim: a single conditional UPDATE on
 * the queued match that must be won before any credits are paid. A forfeit in a
 * knockout tournament also finalises the bracket row in the same UPDATE, so a
 * crash before payment never leaves a forfeit battle that the tournament
 * orchestrator would try to resume as a fought battle.
 */

const mockScheduledMatchUpdateMany = jest.fn();
const mockScheduledMatchFindUnique = jest.fn();
const mockTournamentMatchUpdateMany = jest.fn();
const mockTournamentMatchFindUnique = jest.fn();

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
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

import { claimQueuedMatch, readClaimedBattleId } from '../../src/services/battle/walkoverClaim';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('claimQueuedMatch — scheduled_match', () => {
  it('wins the claim when exactly one scheduled row is updated', async () => {
    mockScheduledMatchUpdateMany.mockResolvedValue({ count: 1 });

    const claimed = await claimQueuedMatch({ source: 'scheduled_match', scheduledMatchId: 11 }, 500);

    expect(claimed).toBe(true);
    expect(mockScheduledMatchUpdateMany).toHaveBeenCalledWith({
      where: { id: 11, status: 'scheduled' },
      data: { status: 'completed', battleId: 500 },
    });
    expect(mockTournamentMatchUpdateMany).not.toHaveBeenCalled();
  });

  it('loses the claim when the row was already completed (count 0)', async () => {
    mockScheduledMatchUpdateMany.mockResolvedValue({ count: 0 });

    const claimed = await claimQueuedMatch({ source: 'scheduled_match', scheduledMatchId: 11 }, 501);

    expect(claimed).toBe(false);
  });
});

describe('claimQueuedMatch — tournament_match', () => {
  it('without finalize writes only battleId (bye behaviour unchanged)', async () => {
    mockTournamentMatchUpdateMany.mockResolvedValue({ count: 1 });

    const claimed = await claimQueuedMatch({ source: 'tournament_match', tournamentMatchId: 21 }, 600);

    expect(claimed).toBe(true);
    expect(mockTournamentMatchUpdateMany).toHaveBeenCalledWith({
      where: { id: 21, battleId: null },
      data: { battleId: 600 },
    });
    expect(mockScheduledMatchUpdateMany).not.toHaveBeenCalled();
  });

  it('with finalize writes status, winner and completedAt, guarded by battleId null and pending/scheduled', async () => {
    mockTournamentMatchUpdateMany.mockResolvedValue({ count: 1 });
    const before = Date.now();

    const claimed = await claimQueuedMatch(
      { source: 'tournament_match', tournamentMatchId: 22 },
      601,
      { status: 'forfeit', winnerId: 9 },
    );

    expect(claimed).toBe(true);
    expect(mockTournamentMatchUpdateMany).toHaveBeenCalledTimes(1);
    const [args] = mockTournamentMatchUpdateMany.mock.calls[0] as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    expect(args.where).toEqual({
      id: 22,
      battleId: null,
      status: { in: ['pending', 'scheduled'] },
    });
    expect(args.data).toMatchObject({ battleId: 601, status: 'forfeit', winnerId: 9 });
    expect(args.data.completedAt).toBeInstanceOf(Date);
    expect((args.data.completedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('with finalize loses the claim when the bracket row is already finalised (count 0)', async () => {
    mockTournamentMatchUpdateMany.mockResolvedValue({ count: 0 });

    const claimed = await claimQueuedMatch(
      { source: 'tournament_match', tournamentMatchId: 22 },
      602,
      { status: 'forfeit', winnerId: 9 },
    );

    expect(claimed).toBe(false);
  });
});

describe('readClaimedBattleId', () => {
  it('re-reads the battle id from the scheduled match row', async () => {
    mockScheduledMatchFindUnique.mockResolvedValue({ battleId: 700 });

    await expect(
      readClaimedBattleId({ source: 'scheduled_match', scheduledMatchId: 31 }),
    ).resolves.toBe(700);
    expect(mockScheduledMatchFindUnique).toHaveBeenCalledWith({
      where: { id: 31 },
      select: { battleId: true },
    });
  });

  it('re-reads the battle id from the tournament match row, null when missing', async () => {
    mockTournamentMatchFindUnique.mockResolvedValue(null);

    await expect(
      readClaimedBattleId({ source: 'tournament_match', tournamentMatchId: 32 }),
    ).resolves.toBeNull();
    expect(mockTournamentMatchFindUnique).toHaveBeenCalledWith({
      where: { id: 32 },
      select: { battleId: true },
    });
  });
});
