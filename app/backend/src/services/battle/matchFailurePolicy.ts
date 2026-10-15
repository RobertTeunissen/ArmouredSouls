/**
 * Match failure policy — the one per-match failure handler every orchestrator
 * catch delegates to (design §6, rule 7).
 *
 * An unexpected per-match error cancels the queued match with no rewards, logs
 * a structured admin error and never re-throws, so the round or cycle carries
 * on. Nothing stays scheduled and nothing is retried on a later day.
 *
 * Knockout tournaments (product-owner R1): an errored match with no fought
 * battle linked does not eliminate both sides. The bracket row becomes
 * `cancelled` with the higher seed as `winnerId`; nobody is paid and no battle,
 * ELO, standings or stats are written. A linked fought battle finalises with
 * that battle's winner; a failed bye advances its sole participant.
 *
 * Financial guarantee: never paid twice. The policy itself writes no credits.
 *
 * @module services/battle/matchFailurePolicy
 */
import type { ScheduledTournamentMatch } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { AppError } from '../../errors/AppError';
import type { ByeMode } from '../../utils/byeRewards';
import { resolveHigherSeed } from '../tournament/tournamentService';

export type QueuedMatchRef =
  | { source: 'scheduled_match'; id: number }
  | { source: 'tournament_match'; id: number };

export interface MatchFailureContext {
  mode: ByeMode;
  ref: QueuedMatchRef;
  error: unknown;
  /** Robot or team ids involved, for the admin log only. */
  participants?: number[];
}

export interface MatchFailureResult {
  /** True when this call moved the row to a terminal state (any branch). */
  cancelled: boolean;
  errorSummary: string;
}

export type TournamentMode = 'tournament_1v1' | 'tournament_2v2' | 'tournament_3v3';

export interface TournamentRecoveryContext {
  mode: TournamentMode;
  matchId: number;
  error: unknown;
  /** The mode's finalizer. Called with a freshly read row whose battleId is set, so it routes to the idempotent resume. */
  resume: (row: ScheduledTournamentMatch) => Promise<unknown>;
}

export interface TournamentRecoveryResult extends MatchFailureResult {
  outcome: 'resumed' | 'failed';
}

const MAX_SUMMARY_LENGTH = 500;
const QUEUED_SCHEDULED_STATUSES = ['scheduled', 'error'];
const QUEUED_TOURNAMENT_STATUSES = ['pending', 'scheduled'];

interface ErrorParts {
  errorCode: string;
  message: string;
  errorSummary: string;
}

/** `${code}: ${message}`, at most 500 characters, never a stack trace. */
function describeError(error: unknown): ErrorParts {
  let errorCode = 'UNKNOWN';
  let message: string;
  try {
    if (error instanceof AppError) {
      errorCode = error.code;
      message = error.message;
    } else if (error instanceof Error) {
      errorCode = error.name || 'UNKNOWN';
      message = error.message;
    } else {
      message = String(error);
    }
  } catch {
    message = 'unprintable error';
  }
  return { errorCode, message, errorSummary: `${errorCode}: ${message}`.slice(0, MAX_SUMMARY_LENGTH) };
}

interface LogFields {
  event: string;
  mode: ByeMode;
  source: QueuedMatchRef['source'];
  matchId: number;
  errorCode: string;
  message: string;
  participants: number[];
  cancelled: boolean;
  advancedParticipantId?: number | null;
}

function logAlreadyTerminal(fields: Omit<LogFields, 'event' | 'cancelled'>): void {
  logger.warn('[MatchFailure] Failed match was already terminal; nothing changed', {
    ...fields,
    event: 'battle_match_already_terminal',
    cancelled: false,
  });
}

/**
 * Move a failed queued match to a terminal state with no rewards.
 * Never throws. Returns whether this call moved the match.
 */
export async function handleMatchFailure(ctx: MatchFailureContext): Promise<MatchFailureResult> {
  const { errorCode, message, errorSummary } = describeError(ctx.error);
  const base = {
    mode: ctx.mode,
    source: ctx.ref.source,
    matchId: ctx.ref.id,
    errorCode,
    message,
    participants: ctx.participants ?? [],
  };

  try {
    if (ctx.ref.source === 'scheduled_match') {
      // The conditional keeps an already-claimed bye or forfeit (`completed`)
      // intact; including 'error' cleans up rows left by the old KotH/GM code.
      const { count } = await prisma.scheduledMatch.updateMany({
        where: { id: ctx.ref.id, status: { in: QUEUED_SCHEDULED_STATUSES } },
        data: { status: 'cancelled', cancelReason: errorSummary },
      });
      if (count !== 1) {
        logAlreadyTerminal(base);
        return { cancelled: false, errorSummary };
      }
      logger.error('[MatchFailure] Match cancelled after an unexpected error', {
        ...base,
        event: 'battle_match_cancelled',
        cancelled: true,
      });
      return { cancelled: true, errorSummary };
    }

    return await finalizeTournamentMatch(ctx.ref.id, base, errorSummary);
  } catch (writeError) {
    const failure = describeError(writeError);
    logger.error('[MatchFailure] Could not move the failed match to a terminal state', {
      ...base,
      event: 'battle_match_cancel_failed',
      cancelled: false,
      writeErrorCode: failure.errorCode,
      writeErrorMessage: failure.message,
    });
    return { cancelled: false, errorSummary };
  }
}

async function finalizeTournamentMatch(
  id: number,
  base: Omit<LogFields, 'event' | 'cancelled'>,
  errorSummary: string,
): Promise<MatchFailureResult> {
  const row = await prisma.scheduledTournamentMatch.findUnique({
    where: { id },
    select: {
      tournamentId: true,
      battleId: true,
      winnerId: true,
      isByeMatch: true,
      participant1Id: true,
      participant2Id: true,
      status: true,
    },
  });
  if (!row || !QUEUED_TOURNAMENT_STATUSES.includes(row.status)) {
    logAlreadyTerminal(base);
    return { cancelled: false, errorSummary };
  }

  const rowParticipants = [row.participant1Id, row.participant2Id].filter((p): p is number => p !== null);
  const fields = { ...base, participants: base.participants.length > 0 ? base.participants : rowParticipants };
  const where = { id, status: { in: QUEUED_TOURNAMENT_STATUSES } };

  const write = async (
    data: { status: 'completed' | 'cancelled'; winnerId: number | null },
    event: string,
    extra: { advancedParticipantId?: number | null } = {},
  ): Promise<MatchFailureResult> => {
    const { count } = await prisma.scheduledTournamentMatch.updateMany({
      where,
      data: { ...data, completedAt: new Date() },
    });
    if (count !== 1) {
      logAlreadyTerminal(fields);
      return { cancelled: false, errorSummary };
    }
    logger.error('[MatchFailure] Tournament match finalised after an unexpected error', {
      ...fields,
      ...extra,
      event,
      cancelled: true,
    });
    return { cancelled: true, errorSummary };
  };

  // 1. Bye row: advance the sole participant without reward. Cancelling would
  //    eliminate an unopposed participant for a bug.
  if (row.isByeMatch) {
    return write(
      { status: 'completed', winnerId: row.participant1Id ?? row.participant2Id },
      'battle_bye_finalized_after_error',
    );
  }

  // 2. Fought battle linked: finalise with that battle's winner, so history and
  //    bracket agree. Team tournaments write winnerId at link time; solo
  //    tournaments leave it unset and the battle's winnerId is the robot id.
  if (row.battleId !== null) {
    const battle = await prisma.battle.findUnique({ where: { id: row.battleId }, select: { winnerId: true } });
    const winner = row.winnerId ?? battle?.winnerId ?? null;
    if (winner !== null && rowParticipants.includes(winner)) {
      return write({ status: 'completed', winnerId: winner }, 'battle_match_finalized_after_error');
    }
  }

  // 3. Nothing fought (R1): the higher seed advances with no rewards.
  const advancing = row.participant1Id !== null && row.participant2Id !== null
    ? await resolveHigherSeed(row.tournamentId, row.participant1Id, row.participant2Id)
    : (row.participant1Id ?? row.participant2Id);
  return write(
    { status: 'cancelled', winnerId: advancing },
    'battle_match_cancelled',
    { advancedParticipantId: advancing },
  );
}

/**
 * Tournament per-match catch. Never throws.
 *
 * 1. Re-read the row. If it is not a bye, is still pending/scheduled and has a
 *    linked fought battle, call `resume(row)` ONCE (battle-keyed identities make
 *    already-paid components a no-op). A bye row's battleId is set by the bye
 *    claim while it is still pending, so byes never resume.
 * 2. Otherwise, or if the resume throws, apply `handleMatchFailure` with the
 *    last error.
 */
export async function recoverTournamentMatch(ctx: TournamentRecoveryContext): Promise<TournamentRecoveryResult> {
  let lastError: unknown = ctx.error;
  try {
    const row = await prisma.scheduledTournamentMatch.findUnique({ where: { id: ctx.matchId } });
    if (
      row &&
      !row.isByeMatch &&
      QUEUED_TOURNAMENT_STATUSES.includes(row.status) &&
      row.battleId !== null
    ) {
      try {
        await ctx.resume(row);
        const { errorCode, message, errorSummary } = describeError(ctx.error);
        logger.warn('[MatchFailure] Tournament match resumed after an error', {
          event: 'battle_match_resumed_after_error',
          mode: ctx.mode,
          source: 'tournament_match',
          matchId: ctx.matchId,
          errorCode,
          message,
          participants: [row.participant1Id, row.participant2Id].filter((p): p is number => p !== null),
          cancelled: false,
        });
        return { outcome: 'resumed', cancelled: false, errorSummary };
      } catch (resumeError) {
        lastError = resumeError;
      }
    }
  } catch {
    // The re-read failed; the policy below re-reads and reports the failure.
  }

  const result = await handleMatchFailure({
    mode: ctx.mode,
    ref: { source: 'tournament_match', id: ctx.matchId },
    error: lastError,
  });
  return { outcome: 'failed', ...result };
}
