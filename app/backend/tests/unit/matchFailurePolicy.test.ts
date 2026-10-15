/**
 * T16 / T16b — shared per-match failure policy (design §6, rule 7, R1, R3).
 *
 * `handleMatchFailure` moves a failed queued match to a terminal state with no
 * rewards and never throws. `recoverTournamentMatch` gives a tournament match
 * with a linked fought battle exactly one in-run resume before falling back to
 * the policy.
 */
import prisma from '../../src/lib/prisma';
import logger from '../../src/config/logger';
import { BattleError, BattleErrorCode } from '../../src/errors/battleErrors';
import { resolveHigherSeed } from '../../src/services/tournament/tournamentService';
import { awardCreditsWithLedger } from '../../src/services/battle/battlePostCombat';
import {
  handleMatchFailure,
  recoverTournamentMatch,
} from '../../src/services/battle/matchFailurePolicy';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    scheduledMatch: { updateMany: jest.fn() },
    scheduledTournamentMatch: { findUnique: jest.fn(), updateMany: jest.fn() },
    battle: { findUnique: jest.fn() },
  },
}));

jest.mock('../../src/services/tournament/tournamentService', () => ({
  resolveHigherSeed: jest.fn(),
}));

jest.mock('../../src/services/battle/battlePostCombat', () => ({
  awardCreditsWithLedger: jest.fn(),
}));

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const db = prisma as unknown as {
  scheduledMatch: { updateMany: jest.Mock };
  scheduledTournamentMatch: { findUnique: jest.Mock; updateMany: jest.Mock };
  battle: { findUnique: jest.Mock };
};
const log = logger as unknown as { error: jest.Mock; warn: jest.Mock };
const higherSeed = resolveHigherSeed as jest.Mock;

function loggedEvents(mock: jest.Mock): string[] {
  return mock.mock.calls.map((c) => (c[1] as { event?: string } | undefined)?.event ?? '');
}

function tournamentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 50,
    tournamentId: 7,
    round: 2,
    matchNumber: 1,
    participantType: 'robot',
    participant1Id: 11,
    participant2Id: 22,
    winnerId: null,
    battleId: null,
    status: 'pending',
    isByeMatch: false,
    createdAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleMatchFailure — scheduled_match', () => {
  it('cancels a scheduled (or legacy error) row with the error summary', async () => {
    db.scheduledMatch.updateMany.mockResolvedValue({ count: 1 });
    const error = new BattleError(BattleErrorCode.ROBOT_NOT_BATTLE_READY, 'no weapon', 500, { robotIds: [3] });

    const result = await handleMatchFailure({
      mode: 'league_1v1',
      ref: { source: 'scheduled_match', id: 9 },
      error,
      participants: [3, 4],
    });

    expect(result).toEqual({ cancelled: true, errorSummary: 'ROBOT_NOT_BATTLE_READY: no weapon' });
    expect(db.scheduledMatch.updateMany).toHaveBeenCalledWith({
      where: { id: 9, status: { in: ['scheduled', 'error'] } },
      data: { status: 'cancelled', cancelReason: 'ROBOT_NOT_BATTLE_READY: no weapon' },
    });
    expect(log.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        event: 'battle_match_cancelled',
        mode: 'league_1v1',
        source: 'scheduled_match',
        matchId: 9,
        errorCode: 'ROBOT_NOT_BATTLE_READY',
        message: 'no weapon',
        participants: [3, 4],
        cancelled: true,
      }),
    );
  });

  it('uses the error name for plain errors and UNKNOWN for non-errors', async () => {
    db.scheduledMatch.updateMany.mockResolvedValue({ count: 1 });
    const typed = await handleMatchFailure({ mode: 'koth', ref: { source: 'scheduled_match', id: 1 }, error: new TypeError('boom') });
    expect(typed.errorSummary).toBe('TypeError: boom');
    const unknown = await handleMatchFailure({ mode: 'koth', ref: { source: 'scheduled_match', id: 1 }, error: 'bad' });
    expect(unknown.errorSummary).toBe('UNKNOWN: bad');
  });

  it('truncates the summary to 500 characters and stores no stack', async () => {
    db.scheduledMatch.updateMany.mockResolvedValue({ count: 1 });
    const error = new Error('x'.repeat(2000));
    const result = await handleMatchFailure({ mode: 'grand_melee', ref: { source: 'scheduled_match', id: 2 }, error });
    expect(result.errorSummary).toHaveLength(500);
    expect(result.errorSummary.startsWith('Error: xxx')).toBe(true);
    const data = db.scheduledMatch.updateMany.mock.calls[0][0].data as { cancelReason: string };
    expect(data.cancelReason).toHaveLength(500);
    expect(data.cancelReason).not.toContain('    at ');
  });

  it('leaves an already-terminal row alone and logs battle_match_already_terminal', async () => {
    db.scheduledMatch.updateMany.mockResolvedValue({ count: 0 });
    const result = await handleMatchFailure({ mode: 'tag_team', ref: { source: 'scheduled_match', id: 3 }, error: new Error('late') });
    expect(result.cancelled).toBe(false);
    expect(loggedEvents(log.warn)).toContain('battle_match_already_terminal');
  });

  it('never throws when the write rejects', async () => {
    db.scheduledMatch.updateMany.mockRejectedValue(new Error('db down'));
    const result = await handleMatchFailure({ mode: 'league_2v2', ref: { source: 'scheduled_match', id: 4 }, error: new Error('first') });
    expect(result).toEqual({ cancelled: false, errorSummary: 'Error: first' });
    expect(loggedEvents(log.error)).toContain('battle_match_cancel_failed');
  });
});

describe('handleMatchFailure — tournament_match', () => {
  const ref = { source: 'tournament_match' as const, id: 50 };

  it('branch 1: a bye row advances its sole participant without reward', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow({ isByeMatch: true, participant2Id: null, battleId: 900 }));
    db.scheduledTournamentMatch.updateMany.mockResolvedValue({ count: 1 });

    const result = await handleMatchFailure({ mode: 'tournament_1v1', ref, error: new Error('bye failed') });

    expect(result.cancelled).toBe(true);
    expect(db.scheduledTournamentMatch.updateMany).toHaveBeenCalledWith({
      where: { id: 50, status: { in: ['pending', 'scheduled'] } },
      data: { status: 'completed', winnerId: 11, completedAt: expect.any(Date) },
    });
    expect(loggedEvents(log.error)).toContain('battle_bye_finalized_after_error');
    expect(higherSeed).not.toHaveBeenCalled();
  });

  it('branch 2: a linked fought battle finalises with its winner', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow({ battleId: 777 }));
    db.battle.findUnique.mockResolvedValue({ winnerId: 22 });
    db.scheduledTournamentMatch.updateMany.mockResolvedValue({ count: 1 });

    const result = await handleMatchFailure({ mode: 'tournament_1v1', ref, error: new Error('income failed') });

    expect(result.cancelled).toBe(true);
    expect(db.scheduledTournamentMatch.updateMany).toHaveBeenCalledWith({
      where: { id: 50, status: { in: ['pending', 'scheduled'] } },
      data: { status: 'completed', winnerId: 22, completedAt: expect.any(Date) },
    });
    expect(loggedEvents(log.error)).toContain('battle_match_finalized_after_error');
  });

  it('branch 2: the row winner (team tournaments) wins over the battle winner', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow({ battleId: 777, winnerId: 11 }));
    db.battle.findUnique.mockResolvedValue({ winnerId: 9999 });
    db.scheduledTournamentMatch.updateMany.mockResolvedValue({ count: 1 });

    await handleMatchFailure({ mode: 'tournament_2v2', ref, error: new Error('x') });

    expect(db.scheduledTournamentMatch.updateMany.mock.calls[0][0].data.winnerId).toBe(11);
  });

  it('branch 2 falls through to R1 when the linked winner is not a participant', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow({ battleId: 777 }));
    db.battle.findUnique.mockResolvedValue({ winnerId: null });
    higherSeed.mockResolvedValue(22);
    db.scheduledTournamentMatch.updateMany.mockResolvedValue({ count: 1 });

    await handleMatchFailure({ mode: 'tournament_1v1', ref, error: new Error('x') });

    expect(db.scheduledTournamentMatch.updateMany.mock.calls[0][0].data).toEqual({
      status: 'cancelled', winnerId: 22, completedAt: expect.any(Date),
    });
  });

  it('branch 3 (R1): nothing fought → cancelled with the higher seed, no credits', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow());
    higherSeed.mockResolvedValue(22);
    db.scheduledTournamentMatch.updateMany.mockResolvedValue({ count: 1 });

    const result = await handleMatchFailure({ mode: 'tournament_1v1', ref, error: new Error('engine') });

    expect(result.cancelled).toBe(true);
    expect(higherSeed).toHaveBeenCalledWith(7, 11, 22);
    expect(db.scheduledTournamentMatch.updateMany).toHaveBeenCalledWith({
      where: { id: 50, status: { in: ['pending', 'scheduled'] } },
      data: { status: 'cancelled', winnerId: 22, completedAt: expect.any(Date) },
    });
    expect(log.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ event: 'battle_match_cancelled', advancedParticipantId: 22, matchId: 50, source: 'tournament_match' }),
    );
    expect(awardCreditsWithLedger).not.toHaveBeenCalled();
  });

  it('branch 3 (R1): one participant → that one advances without a seed lookup', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow({ participant1Id: null }));
    db.scheduledTournamentMatch.updateMany.mockResolvedValue({ count: 1 });

    await handleMatchFailure({ mode: 'tournament_3v3', ref, error: new Error('x') });

    expect(higherSeed).not.toHaveBeenCalled();
    expect(db.scheduledTournamentMatch.updateMany.mock.calls[0][0].data.winnerId).toBe(22);
    expect(awardCreditsWithLedger).not.toHaveBeenCalled();
  });

  it('branch 3 (R1): resolveHigherSeed rejects → cancel_failed, no throw, row untouched', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow());
    higherSeed.mockRejectedValue(new Error('db read failed'));

    const result = await handleMatchFailure({ mode: 'tournament_1v1', ref, error: new Error('x') });

    expect(result.cancelled).toBe(false);
    expect(db.scheduledTournamentMatch.updateMany).not.toHaveBeenCalled();
    expect(loggedEvents(log.error)).toContain('battle_match_cancel_failed');
    expect(awardCreditsWithLedger).not.toHaveBeenCalled();
  });

  it('a row already terminal is left alone', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow({ status: 'completed', winnerId: 11 }));

    const result = await handleMatchFailure({ mode: 'tournament_1v1', ref, error: new Error('x') });

    expect(result.cancelled).toBe(false);
    expect(db.scheduledTournamentMatch.updateMany).not.toHaveBeenCalled();
    expect(loggedEvents(log.warn)).toContain('battle_match_already_terminal');
  });

  it('a conditional write matching 0 rows is not a failure', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow());
    higherSeed.mockResolvedValue(11);
    db.scheduledTournamentMatch.updateMany.mockResolvedValue({ count: 0 });

    const result = await handleMatchFailure({ mode: 'tournament_1v1', ref, error: new Error('x') });

    expect(result.cancelled).toBe(false);
    expect(loggedEvents(log.warn)).toContain('battle_match_already_terminal');
  });

  it('never throws when the read rejects', async () => {
    db.scheduledTournamentMatch.findUnique.mockRejectedValue(new Error('db down'));
    await expect(handleMatchFailure({ mode: 'tournament_1v1', ref, error: new Error('x') })).resolves.toEqual({
      cancelled: false,
      errorSummary: 'Error: x',
    });
    expect(loggedEvents(log.error)).toContain('battle_match_cancel_failed');
  });
});

describe('recoverTournamentMatch (T16b)', () => {
  it('battleId null → no resume, the policy applies (R1)', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow());
    higherSeed.mockResolvedValue(11);
    db.scheduledTournamentMatch.updateMany.mockResolvedValue({ count: 1 });
    const resume = jest.fn();

    const result = await recoverTournamentMatch({ mode: 'tournament_1v1', matchId: 50, error: new Error('pre-link'), resume });

    expect(resume).not.toHaveBeenCalled();
    expect(result).toEqual({ outcome: 'failed', cancelled: true, errorSummary: 'Error: pre-link' });
    expect(db.scheduledTournamentMatch.updateMany.mock.calls[0][0].data.status).toBe('cancelled');
  });

  it('a claimed bye row (battleId set, still pending) is never resumed; branch 1 advances it', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow({ isByeMatch: true, participant2Id: null, battleId: 901 }));
    db.scheduledTournamentMatch.updateMany.mockResolvedValue({ count: 1 });
    const resume = jest.fn();

    const result = await recoverTournamentMatch({ mode: 'tournament_1v1', matchId: 50, error: new Error('bye'), resume });

    expect(resume).not.toHaveBeenCalled();
    expect(result.outcome).toBe('failed');
    expect(db.scheduledTournamentMatch.updateMany.mock.calls[0][0].data).toEqual({
      status: 'completed', winnerId: 11, completedAt: expect.any(Date),
    });
  });

  it('battleId set → resume called exactly once with the re-read row; success → resumed', async () => {
    const row = tournamentRow({ battleId: 777 });
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(row);
    const resume = jest.fn().mockResolvedValue({ ok: true });

    const result = await recoverTournamentMatch({ mode: 'tournament_2v2', matchId: 50, error: new Error('income'), resume });

    expect(resume).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledWith(row);
    expect(result).toEqual({ outcome: 'resumed', cancelled: false, errorSummary: 'Error: income' });
    expect(db.scheduledTournamentMatch.updateMany).not.toHaveBeenCalled();
    expect(loggedEvents(log.warn)).toContain('battle_match_resumed_after_error');
  });

  it('resume rejects → the policy receives the second error and finalises branch 2', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow({ battleId: 777 }));
    db.battle.findUnique.mockResolvedValue({ winnerId: 11 });
    db.scheduledTournamentMatch.updateMany.mockResolvedValue({ count: 1 });
    const resume = jest.fn().mockRejectedValue(new Error('second'));

    const result = await recoverTournamentMatch({ mode: 'tournament_1v1', matchId: 50, error: new Error('first'), resume });

    expect(resume).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ outcome: 'failed', cancelled: true, errorSummary: 'Error: second' });
    expect(db.scheduledTournamentMatch.updateMany.mock.calls[0][0].data).toEqual({
      status: 'completed', winnerId: 11, completedAt: expect.any(Date),
    });
  });

  it('row already terminal on re-read → no resume, already_terminal logged', async () => {
    db.scheduledTournamentMatch.findUnique.mockResolvedValue(tournamentRow({ battleId: 777, status: 'completed', winnerId: 22 }));
    const resume = jest.fn();

    const result = await recoverTournamentMatch({ mode: 'tournament_1v1', matchId: 50, error: new Error('x'), resume });

    expect(resume).not.toHaveBeenCalled();
    expect(result.cancelled).toBe(false);
    expect(loggedEvents(log.warn)).toContain('battle_match_already_terminal');
  });

  it('never throws, even when the re-read rejects', async () => {
    db.scheduledTournamentMatch.findUnique.mockRejectedValue(new Error('db down'));
    const resume = jest.fn();

    await expect(
      recoverTournamentMatch({ mode: 'tournament_1v1', matchId: 50, error: new Error('x'), resume }),
    ).resolves.toEqual({ outcome: 'failed', cancelled: false, errorSummary: 'Error: x' });
    expect(resume).not.toHaveBeenCalled();
  });
});
