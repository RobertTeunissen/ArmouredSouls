/**
 * Team Tournament Service
 *
 * Handles team-specific tournament logic: eligibility checks, tournament creation,
 * and combined-ELO seeding for 2v2 and 3v3 team tournaments.
 *
 * Teams are eligible when:
 * - Team has `eligibility = 'ELIGIBLE'`
 * - ALL member robots have active subscription to the corresponding event type
 * - ALL member robots pass scheduling readiness checks (weapon loadout)
 *
 * Combined ELO = sum of member robot ELOs (used for seeding).
 *
 * Requirements: R2.1–R2.8, R3.1–R3.7
 *
 * @module services/tournament/teamTournamentService
 */

import { Tournament } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import { ParticipantType } from './tournamentParticipantResolver';
import { TournamentParticipant, TournamentCreationResult, createTournament } from './tournamentService';
import { checkSchedulingReadiness } from '../analytics/matchmakingService';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get all eligible teams for a team tournament of the given size.
 *
 * Eligibility criteria:
 * 1. Team has `eligibility = 'ELIGIBLE'` and matching `teamSize`
 * 2. All member robots have active subscription to the event type
 * 3. All member robots pass scheduling readiness checks
 *
 * @param teamSize - 2 for 2v2, 3 for 3v3
 * @returns Array of TournamentParticipant with combined ELO
 */
export async function getEligibleTeamsForTournament(teamSize: 2 | 3): Promise<TournamentParticipant[]> {
  const eventType = teamSize === 2 ? 'tournament_2v2' : 'tournament_3v3';

  const teams = await prisma.teamBattle.findMany({
    where: { teamSize, eligibility: 'ELIGIBLE' },
    include: {
      members: {
        include: {
          robot: {
            include: {
              mainWeapon: { include: { weapon: true } },
              offhandWeapon: { include: { weapon: true } },
            },
          },
        },
      },
    },
  });

  // Batch-activate pending subscriptions for all member robots
  const allRobotIds = teams.flatMap(t => t.members.map(m => m.robotId));
  const { batchActivatePendingSubscriptions } = await import('../subscription/subscriptionService');
  await batchActivatePendingSubscriptions(allRobotIds, eventType);

  // Check subscriptions in batch — only active subscriptions count
  const subscriptions = await prisma.subscription.findMany({
    where: { eventType, robotId: { in: allRobotIds }, status: 'active' },
    select: { robotId: true },
  });
  const subscribedSet = new Set(subscriptions.map(s => s.robotId));

  // Filter teams: all members must be subscribed AND scheduling-ready
  const eligible: TournamentParticipant[] = [];
  for (const team of teams) {
    const allSubscribed = team.members.every(m => subscribedSet.has(m.robotId));
    const allReady = team.members.every(m => checkSchedulingReadiness(m.robot).isReady);

    if (allSubscribed && allReady) {
      const combinedELO = team.members.reduce((sum, m) => sum + m.robot.elo, 0);
      eligible.push({
        id: team.id,
        displayName: team.teamName,
        elo: combinedELO,
        createdAt: team.createdAt,
      });
    }
  }

  const excluded = teams.length - eligible.length;
  if (excluded > 0) {
    logger.info(`[TeamTournament] Excluded ${excluded} ${teamSize}v${teamSize} teams (subscription or readiness)`);
  }

  return eligible;
}

/**
 * Create a team tournament for the given team size.
 *
 * 1. Gets eligible teams via `getEligibleTeamsForTournament`
 * 2. Throws INSUFFICIENT_PARTICIPANTS if < 4 eligible teams
 * 3. Calls `createTournament` with correct participantType and namePrefix
 *
 * @param teamSize - 2 for 2v2, 3 for 3v3
 * @returns Tournament creation result with bracket
 * @throws TournamentError with INSUFFICIENT_PARTICIPANTS if < 4 eligible teams
 */
export async function createTeamTournament(teamSize: 2 | 3): Promise<TournamentCreationResult> {
  const participantType: ParticipantType = teamSize === 2 ? 'team_2v2' : 'team_3v3';
  const namePrefix = teamSize === 2 ? '2v2 Tournament' : '3v3 Tournament';

  const eligible = await getEligibleTeamsForTournament(teamSize);

  if (eligible.length < 4) {
    logger.info(`[TeamTournament] Insufficient ${teamSize}v${teamSize} teams for tournament (${eligible.length}/4)`);
    throw new TournamentError(
      TournamentErrorCode.INSUFFICIENT_PARTICIPANTS,
      `Need at least 4 eligible ${teamSize}v${teamSize} teams, found ${eligible.length}`,
      400,
      { required: 4, found: eligible.length, teamSize },
    );
  }

  logger.info(`[TeamTournament] Creating ${teamSize}v${teamSize} tournament with ${eligible.length} eligible teams`);
  return createTournament({ participantType, participants: eligible, namePrefix });
}

/**
 * Auto-create a team tournament if none is currently active.
 *
 * 1. Checks for active tournament of the given participantType
 * 2. If active exists, returns null (no action needed)
 * 3. Gets eligible teams
 * 4. If < 4 eligible, returns null (no error — just skip)
 * 5. Creates tournament
 *
 * @param teamSize - 2 for 2v2, 3 for 3v3
 * @returns Created tournament or null if skipped
 */
export async function autoCreateNextTeamTournament(teamSize: 2 | 3): Promise<Tournament | null> {
  const participantType: ParticipantType = teamSize === 2 ? 'team_2v2' : 'team_3v3';

  // Check for active tournament of this type
  const activeTournament = await prisma.tournament.findFirst({
    where: {
      participantType,
      status: { in: ['pending', 'active'] },
    },
  });

  if (activeTournament) {
    logger.info(`[TeamTournament] Active ${teamSize}v${teamSize} tournament exists (${activeTournament.name}). Skipping auto-creation.`);
    return null;
  }

  // Get eligible teams
  const eligible = await getEligibleTeamsForTournament(teamSize);

  if (eligible.length < 4) {
    logger.info(`[TeamTournament] Insufficient ${teamSize}v${teamSize} teams for auto-tournament (${eligible.length}/4)`);
    return null;
  }

  logger.info(`[TeamTournament] Auto-creating ${teamSize}v${teamSize} tournament with ${eligible.length} eligible teams`);
  const namePrefix = teamSize === 2 ? '2v2 Tournament' : '3v3 Tournament';
  const result = await createTournament({ participantType, participants: eligible, namePrefix });
  return result.tournament;
}
