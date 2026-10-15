/**
 * Walkover claim — the token a walkover (bye or battle-time forfeit) must win
 * before any credits are paid.
 *
 * Extracted from the Bye_Resolution_Writer so byes and forfeits share one claim.
 * The claim is a single conditional UPDATE on the queued match. The order is
 * claim-then-pay, always: if the process dies in the window the reward is lost,
 * not duplicated. A lost reward is detectable: a claimed queued row pointing at
 * a `battles` row with no `battle_participants` rows.
 *
 * @module services/battle/walkoverClaim
 */

import prisma from '../../lib/prisma';

/**
 * For the modes queued in `scheduled_matches_v2` the claimed column is `status`;
 * for the tournament modes it is `scheduled_tournament_matches.battleId`,
 * because bracket advancement has already spent the status token by the time a
 * bye reward is due.
 */
export type WalkoverClaim =
  | { source: 'scheduled_match'; scheduledMatchId: number }
  | { source: 'tournament_match'; tournamentMatchId: number };

/** Bracket finalisation written atomically with a tournament forfeit claim. */
export interface TournamentFinalize {
  status: 'forfeit';
  winnerId: number;
}

/**
 * Win the right to pay this walkover, atomically.
 *
 * - `scheduled_match`: `scheduled` → `completed` with the battle id.
 * - `tournament_match` without `tournamentFinalize` (byes): sets `battleId` on a
 *   row that has none.
 * - `tournament_match` with `tournamentFinalize` (forfeits): also finalises the
 *   bracket row (`status`, `winnerId`, `completedAt`), and only from
 *   `pending`/`scheduled`, so a forfeit battle is never mistaken for a fought
 *   battle to resume.
 */
export async function claimQueuedMatch(
  claim: WalkoverClaim,
  battleId: number,
  tournamentFinalize?: TournamentFinalize,
): Promise<boolean> {
  if (claim.source === 'scheduled_match') {
    const { count } = await prisma.scheduledMatch.updateMany({
      where: { id: claim.scheduledMatchId, status: 'scheduled' },
      data: { status: 'completed', battleId },
    });
    return count === 1;
  }

  if (tournamentFinalize) {
    const { count } = await prisma.scheduledTournamentMatch.updateMany({
      where: {
        id: claim.tournamentMatchId,
        battleId: null,
        status: { in: ['pending', 'scheduled'] },
      },
      data: {
        battleId,
        status: tournamentFinalize.status,
        winnerId: tournamentFinalize.winnerId,
        completedAt: new Date(),
      },
    });
    return count === 1;
  }

  const { count } = await prisma.scheduledTournamentMatch.updateMany({
    where: { id: claim.tournamentMatchId, battleId: null },
    data: { battleId },
  });
  return count === 1;
}

/**
 * Read the battle id held by whoever won the claim.
 *
 * Only called when `claimQueuedMatch` lost. The row has to be re-read: a
 * caller's own copy of the queued match was loaded while the row was still
 * unclaimed, so its `battleId` is null in exactly the case where the value is
 * wanted.
 */
export async function readClaimedBattleId(claim: WalkoverClaim): Promise<number | null> {
  if (claim.source === 'scheduled_match') {
    const row = await prisma.scheduledMatch.findUnique({
      where: { id: claim.scheduledMatchId },
      select: { battleId: true },
    });
    return row?.battleId ?? null;
  }

  const row = await prisma.scheduledTournamentMatch.findUnique({
    where: { id: claim.tournamentMatchId },
    select: { battleId: true },
  });
  return row?.battleId ?? null;
}
