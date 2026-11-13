/**
 * Solo Tournament Battle-Time Forfeits
 *
 * A 1v1 tournament match where one or both robots cannot fight (no main
 * weapon) is resolved through the shared Forfeit_Resolution_Writer. Nothing
 * is simulated.
 *
 * @module services/tournament/tournamentForfeit
 */

import { Robot, ScheduledTournamentMatch } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { calculateELOChange } from '../../utils/battleMath';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import type { MatchEntryOutcome } from '../battle/combatReadiness';
import { resolveForfeitEvent } from '../battle/forfeitResolutionService';
import { BYE_BATTLE_DURATION_SECONDS } from '../battle/byeResolutionService';
import { resolveHigherSeed } from './tournamentService';
import type { TournamentBattleResult } from './tournamentBattleOrchestrator';

/**
 * Resolve a solo tournament battle-time forfeit through the Forfeit_Resolution_Writer.
 *
 * Nothing is simulated and no standings are written (fought tournament battles
 * write none either). A single forfeit: the ready robot wins the battle and
 * advances with the bye-level round reward; the forfeiter takes a normal ELO
 * loss with 0 credits and is eliminated. A double forfeit: the battle row is a
 * draw with no credits, and only the bracket row names the higher seed (A3).
 * The claim finalises the bracket row atomically (`status: 'forfeit'`).
 */
export async function resolveSoloTournamentForfeit(
  tournamentMatch: ScheduledTournamentMatch,
  robot1: Robot,
  robot2: Robot,
  outcome: Exclude<MatchEntryOutcome, { kind: 'fight' }>,
): Promise<TournamentBattleResult> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentMatch.tournamentId } });
  if (!tournament) {
    throw new TournamentError(
      TournamentErrorCode.TOURNAMENT_NOT_FOUND,
      `Tournament ${tournamentMatch.tournamentId} not found`,
      404,
      { tournamentId: tournamentMatch.tournamentId }
    );
  }

  const isDraw = outcome.kind === 'double_forfeit';
  const side1Forfeits = isDraw || outcome.forfeitingSides[0] === 1;
  const side2Forfeits = isDraw || outcome.forfeitingSides[0] === 2;

  // ELO: the mode's normal formula against the real opponent (A2/A3).
  let robot1Change: number;
  let robot2Change: number;
  if (isDraw) {
    const changes = calculateELOChange(robot1.elo, robot2.elo, true);
    robot1Change = changes.winnerChange;
    robot2Change = changes.loserChange;
  } else {
    const [ready, forfeiter] = side2Forfeits ? [robot1, robot2] : [robot2, robot1];
    const changes = calculateELOChange(ready.elo, forfeiter.elo, false);
    robot1Change = ready.id === robot1.id ? changes.winnerChange : changes.loserChange;
    robot2Change = ready.id === robot2.id ? changes.winnerChange : changes.loserChange;
  }
  const winner = isDraw ? null : side2Forfeits ? robot1 : robot2;
  // The participant advancing in the bracket: the ready robot, or the higher seed.
  const tournamentWinnerId = winner
    ? winner.id
    : await resolveHigherSeed(tournament.id, robot1.id, robot2.id);
  const forfeiterNames = [side1Forfeits ? robot1.name : null, side2Forfeits ? robot2.name : null]
    .filter((n): n is string => n !== null)
    .join(' and ');

  const toParticipant = (robot: Robot) => ({
    id: robot.id,
    name: robot.name,
    userId: robot.userId,
    currentHP: robot.currentHP,
    maxHP: robot.maxHP,
    elo: robot.elo,
  });

  const resolution = await resolveForfeitEvent({
    mode: 'tournament_1v1',
    context: {
      mode: 'tournament_1v1',
      totalParticipants: tournament.totalParticipants,
      currentRound: tournament.currentRound,
      maxRounds: tournament.maxRounds,
    },
    claim: { source: 'tournament_match', tournamentMatchId: tournamentMatch.id },
    sides: [
      { side: 1, forfeited: side1Forfeits, stableUserId: robot1.userId, standingEntity: null, robots: [toParticipant(robot1)] },
      { side: 2, forfeited: side2Forfeits, stableUserId: robot2.userId, standingEntity: null, robots: [toParticipant(robot2)] },
    ],
    newEloByRobotId: { [robot1.id]: robot1.elo + robot1Change, [robot2.id]: robot2.elo + robot2Change },
    eloChangeBySide: { 1: robot1Change, 2: robot2Change },
    lp: { win: 0, loss: 0, draw: 0 },
    standingMode: null,
    battle: {
      battleType: 'tournament_1v1',
      leagueType: 'tournament',
      tournamentId: tournament.id,
      tournamentRound: tournament.currentRound,
      winnerId: winner?.id ?? null,
      winningSide: null,
      message: `${forfeiterNames} forfeited: no main weapon equipped`,
    },
    tournamentWinnerId,
    cycleNumber: await getCurrentCycleNumber(),
  });

  logger.info(
    `[Battle] Tournament forfeit: Round ${tournament.currentRound} | match ${tournamentMatch.id} | ` +
    `${robot1.name} vs ${robot2.name} | ` +
    `${isDraw ? `double forfeit, higher seed ${tournamentWinnerId} advances` : `${winner?.name} wins by forfeit`} | ` +
    `₡${resolution.creditsPaid}${resolution.alreadyResolved ? ' | already resolved' : ''}`,
  );

  if (resolution.battleId === null) {
    throw new TournamentError(
      TournamentErrorCode.BATTLE_RECORD_FAILED,
      `Forfeit resolution produced no battle for tournament match ${tournamentMatch.id}`,
      500,
      { matchId: tournamentMatch.id },
    );
  }

  return {
    battleId: resolution.battleId,
    winnerId: tournamentWinnerId,
    isForfeit: true,
    isByeMatch: false,
    robot1FinalHP: robot1.currentHP,
    robot2FinalHP: robot2.currentHP,
    robot1Damage: 0,
    robot2Damage: 0,
    durationSeconds: BYE_BATTLE_DURATION_SECONDS,
    prestigeAwarded: 0,
    fameAwarded: 0,
    achievementUnlocks: [],
  };
}

