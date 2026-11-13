/**
 * Tournament Completion
 *
 * Finishes a tournament once its final round has resolved: the champion's
 * titles and achievements, or a completion without a champion when the
 * bracket produced none.
 *
 * @module services/tournament/tournamentCompletion
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';

/**
 * Finish a tournament whose bracket produced no champion (degenerate case:
 * only empty placeholder rows remained). No titles are awarded; the callers'
 * auto-creation of the next tournament runs as usual.
 */
export async function completeTournamentWithoutChampion(tournamentId: number): Promise<void> {
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      status: 'completed',
      winnerId: null,
      completedAt: new Date(),
    },
  });
  logger.warn(`[Tournament] Tournament ${tournamentId} completed without a champion (no winners left in the bracket)`);
}

/**
 * Complete tournament and award championship based on participantType.
 * Awards both the unified championshipTitles counter and the per-type counter.
 */
export async function completeTournament(tournamentId: number, winnerId: number): Promise<void> {
  // Fetch tournament to determine participantType
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    throw new TournamentError(
      TournamentErrorCode.TOURNAMENT_NOT_FOUND,
      `Tournament ${tournamentId} not found`,
      404,
      { tournamentId }
    );
  }

  // Update tournament status
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      status: 'completed',
      winnerId,
      completedAt: new Date(),
    },
  });

  // Award championship title based on participantType
  if (tournament.participantType === 'robot') {
    // 1v1 robot tournament — award to robot's owner
    const robot = await prisma.robot.findUnique({
      where: { id: winnerId },
      include: { user: true },
    });

    if (robot) {
      await prisma.user.update({
        where: { id: robot.userId },
        data: {
          championshipTitles: { increment: 1 },
          championshipTitles1v1: { increment: 1 },
        },
      });

      // Fire tournament_complete achievement event for the winner's owner
      try {
        const { achievementService } = await import('../achievement');
        await achievementService.checkAndAward(robot.userId, robot.id, {
          type: 'tournament_complete',
          data: { battleType: 'tournament_1v1' },
        });
      } catch (achievementError) {
        logger.error(`[Tournament] Achievement check failed for tournament ${tournamentId} winner: ${achievementError}`);
      }

      logger.info(`[Tournament] Tournament ${tournamentId} completed! Winner: ${robot.name} (User: ${robot.user.username})`);
      logger.info(`[Tournament] Championship title (1v1) awarded to ${robot.user.username}`);
    }
  } else {
    // Team tournament — award to team's stable owner
    const team = await prisma.teamBattle.findUnique({
      where: { id: winnerId },
      include: { stable: true },
    });

    if (team) {
      const field = tournament.participantType === 'team_2v2' ? 'championshipTitles2v2' : 'championshipTitles3v3';
      await prisma.user.update({
        where: { id: team.stableId },
        data: {
          championshipTitles: { increment: 1 },
          [field]: { increment: 1 },
        },
      });

      // Fire tournament_complete achievement event for the team owner
      try {
        const { achievementService } = await import('../achievement');
        await achievementService.checkAndAward(team.stableId, null, {
          type: 'tournament_complete',
          data: { battleType: tournament.participantType === 'team_2v2' ? 'tournament_2v2' : 'tournament_3v3' },
        });
      } catch (achievementError) {
        logger.error(`[Tournament] Achievement check failed for tournament ${tournamentId} winner: ${achievementError}`);
      }

      logger.info(`[Tournament] Tournament ${tournamentId} completed! Winner: ${team.teamName} (Stable: ${team.stable.stableName || team.stable.username})`);
      logger.info(`[Tournament] Championship title (${tournament.participantType}) awarded to ${team.stable.stableName || team.stable.username}`);
    }
  }

  // Dispatch Discord champion announcement for all tournament types
  try {
    const { dispatchNotification, getActiveIntegrations } = await import('../notifications/notification-service');
    const { getConfig } = await import('../../config/env');
    const appUrl = getConfig().appBaseUrl || 'http://localhost:5173';

    const typeLabel = tournament.participantType === 'team_2v2' ? '2v2'
      : tournament.participantType === 'team_3v3' ? '3v3'
      : '1v1';

    // Resolve champion name and owner
    const team = tournament.participantType !== 'robot'
      ? await prisma.teamBattle.findUnique({ where: { id: winnerId }, include: { stable: true } })
      : null;
    const robot = tournament.participantType === 'robot'
      ? await prisma.robot.findUnique({ where: { id: winnerId }, include: { user: true } })
      : null;

    const championName = team ? team.teamName : robot ? robot.name : 'Unknown';
    const ownerName = team
      ? (team.stable.stableName || team.stable.username)
      : (robot ? robot.user.username : 'Unknown');

    const message = `🏆 ${typeLabel} Tournament Champion: "${championName}" (${ownerName})!\n${appUrl}/tournaments`;
    await dispatchNotification(message, getActiveIntegrations());
  } catch (notificationError) {
    // Log error, don't interrupt tournament completion
    logger.error(`[Tournament] Discord notification failed for tournament ${tournamentId}: ${notificationError}`);
  }
}
