/**
 * Tournament Service
 * Handles tournament creation, eligibility, queries, byes and round progression.
 * Bracket math lives in `tournamentBracket`, completion in `tournamentCompletion`.
 */

import { Robot, Tournament, ScheduledTournamentMatch } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { checkSchedulingReadiness } from '../analytics/matchmakingService';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import { ParticipantType } from './tournamentParticipantResolver';
import { resolveByeEvent } from '../battle/byeResolutionService';
import { achievementService } from '../achievement';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import {
  generateBracketPairsGeneric,
  planNextRoundSlots,
  seedForParticipant,
  seedParticipantsByELO,
  TERMINAL_MATCH_STATUSES,
} from './tournamentBracket';
import { completeTournament, completeTournamentWithoutChampion } from './tournamentCompletion';

// Tournament configuration constants
const MIN_TOURNAMENT_PARTICIPANTS = 4; // Minimum robots needed to start a tournament
const AUTO_START_THRESHOLD = 8; // Minimum robots for auto-tournament creation

export interface TournamentCreationResult {
  tournament: Tournament;
  bracket: ScheduledTournamentMatch[];
  participantCount: number;
}

export interface RoundExecutionSummary {
  tournamentId: number;
  round: number;
  matchesExecuted: number;
  matchesFailed: number;
  byeMatches: number;
  winners: number[];
  errors: string[];
  tournamentComplete: boolean;
  championRobotId?: number;
}

/**
 * Calculate maximum rounds needed for a tournament
 * Formula: ceil(log2(participants))
 */
function calculateMaxRounds(participants: number): number {
  return Math.ceil(Math.log2(participants));
}

/**
 * Get robots eligible for tournament participation
 * Robots CAN participate in multiple active tournaments simultaneously
 * 
 * Excludes:
 * - Bye robot
 * - Robots without required weapons equipped
 */
export async function getEligibleRobotsForTournament(): Promise<Robot[]> {
  // Get all robots except bye robot
  const allRobots = await prisma.robot.findMany({
    where: {
    },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  // Filter for scheduling-ready robots (weapons only, HP not checked)
  // Robots will be repaired before tournament matches execute
  const battleReadyRobots = allRobots.filter(robot => {
    const readiness = checkSchedulingReadiness(robot);
    return readiness.isReady;
  });


  // Filter by tournament subscription — only active subscriptions (batch query for efficiency)
  const subscribedRobotIds = await prisma.subscription.findMany({
    where: { eventType: 'tournament_1v1', robotId: { in: battleReadyRobots.map(r => r.id) }, status: 'active' },
    select: { robotId: true },
  });
  const subscribedSet = new Set(subscribedRobotIds.map(s => s.robotId));
  const eligibleRobots = battleReadyRobots.filter(r => subscribedSet.has(r.id));

  const excludedBySubscription = battleReadyRobots.length - eligibleRobots.length;
  if (excludedBySubscription > 0) {
    logger.info(`[Tournament] Excluded ${excludedBySubscription} robots without tournament subscription`);
  }

  return eligibleRobots;
}

// ─── Entity-Agnostic Tournament Interfaces ───────────────────────────────────

/**
 * Generic tournament participant used for entity-agnostic bracket generation.
 * Both robots and teams can be represented as TournamentParticipant.
 */
export interface TournamentParticipant {
  id: number;
  displayName: string;
  elo: number;
  createdAt: Date;
}

/**
 * Options for creating an entity-agnostic tournament.
 */
export interface CreateTournamentOptions {
  participantType: ParticipantType;
  participants: TournamentParticipant[];
  namePrefix?: string; // "Tournament", "2v2 Tournament", "3v3 Tournament"
}


/**
 * Create a new entity-agnostic single-elimination tournament.
 * Handles bracket generation, bye-match auto-completion, sequential naming per type,
 * and sets the tournament to 'active' with startedAt.
 *
 * @param options - participantType, participants array, optional namePrefix
 * @returns Created tournament with bracket and participant count
 */
export async function createTournament(options: CreateTournamentOptions): Promise<TournamentCreationResult> {
  const { participantType, participants, namePrefix } = options;

  if (participants.length < MIN_TOURNAMENT_PARTICIPANTS) {
    throw new TournamentError(
      TournamentErrorCode.INSUFFICIENT_PARTICIPANTS,
      `Insufficient participants for tournament. Need at least ${MIN_TOURNAMENT_PARTICIPANTS}, found ${participants.length}`,
      400,
      { required: MIN_TOURNAMENT_PARTICIPANTS, found: participants.length }
    );
  }

  // Seed by ELO (tie-break by createdAt)
  const seeded = seedParticipantsByELO(participants);

  // Calculate rounds
  const maxRounds = calculateMaxRounds(seeded.length);

  // Generate bracket with participantType
  const bracketTemplate = generateBracketPairsGeneric(seeded, maxRounds, participantType);

  // Sequential naming per type: count existing tournaments of same participantType + 1
  const prefix = namePrefix ?? 'Tournament';
  const tournamentCountForType = await prisma.tournament.count({
    where: { participantType },
  });
  const tournamentName = `${prefix} #${tournamentCountForType + 1}`;

  // Create tournament record with participantType
  const tournament = await prisma.tournament.create({
    data: {
      name: tournamentName,
      tournamentType: 'single_elimination',
      participantType,
      status: 'pending',
      currentRound: 1,
      maxRounds,
      totalParticipants: seeded.length,
      startedAt: null,
      completedAt: null,
      winnerId: null,
    },
  });

  // Create match records — all use same participantType as parent Tournament (R1.10)
  const bracketData = bracketTemplate.map(match => ({
    tournamentId: tournament.id,
    round: match.round,
    matchNumber: match.matchNumber,
    participantType,
    participant1Id: match.participant1Id,
    participant2Id: match.participant2Id,
    winnerId: match.winnerId,
    battleId: match.battleId,
    status: match.status,
    isByeMatch: match.isByeMatch,
  }));

  await prisma.scheduledTournamentMatch.createMany({
    data: bracketData,
  });

  // Fetch created matches for return
  const bracket = await prisma.scheduledTournamentMatch.findMany({
    where: { tournamentId: tournament.id },
    orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
  });

  // Set status to 'active', record startedAt
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: {
      status: 'active',
      startedAt: new Date(),
    },
  });

  logger.info(`[Tournament] Created ${tournamentName} with ${seeded.length} participants (${maxRounds} rounds, type: ${participantType})`);

  return {
    tournament,
    bracket,
    participantCount: seeded.length,
  };
}


/**
 * The higher (better, lower-numbered) seed of two participants of a tournament.
 * Used for double forfeits and errored unfought matches (rule 5, R1). When only
 * one seed resolves that participant wins; when neither resolves, p1 is
 * returned (the same final rule as the team tournament's draw resolution).
 */
export async function resolveHigherSeed(tournamentId: number, p1: number, p2: number): Promise<number> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new TournamentError(
      TournamentErrorCode.TOURNAMENT_NOT_FOUND,
      `Tournament ${tournamentId} not found`,
      404,
      { tournamentId }
    );
  }
  const round1 = await prisma.scheduledTournamentMatch.findMany({
    where: { tournamentId, round: 1 },
    orderBy: { matchNumber: 'asc' },
    select: { matchNumber: true, participant1Id: true, participant2Id: true },
  });
  const bracketSize = Math.pow(2, tournament.maxRounds);
  const seed1 = seedForParticipant(round1, bracketSize, p1);
  const seed2 = seedForParticipant(round1, bracketSize, p2);
  if (seed1 === null && seed2 === null) return p1;
  if (seed1 === null) return p2;
  if (seed2 === null) return p1;
  return seed2 < seed1 ? p2 : p1;
}


/**
 * Create a new single elimination tournament (1v1 robots)
 * Thin wrapper around createTournament for backward compatibility.
 * All eligible robots participate (can be in multiple tournaments)
 */
export async function createSingleEliminationTournament(): Promise<TournamentCreationResult> {
  // Get eligible robots
  const eligibleRobots = await getEligibleRobotsForTournament();

  if (eligibleRobots.length < MIN_TOURNAMENT_PARTICIPANTS) {
    throw new TournamentError(
      TournamentErrorCode.INSUFFICIENT_PARTICIPANTS,
      `Insufficient participants for tournament. Need at least ${MIN_TOURNAMENT_PARTICIPANTS}, found ${eligibleRobots.length}`,
      400,
      { required: MIN_TOURNAMENT_PARTICIPANTS, found: eligibleRobots.length }
    );
  }

  // Map robots to generic TournamentParticipant interface
  const participants: TournamentParticipant[] = eligibleRobots.map(r => ({
    id: r.id,
    displayName: r.name,
    elo: r.elo,
    createdAt: r.createdAt,
  }));

  return createTournament({ participantType: 'robot', participants, namePrefix: '1v1 Tournament' });
}

/**
 * Get active tournaments (1v1 robot tournaments only).
 * Team tournaments are handled by their own dedicated handlers.
 */
export async function getActiveTournaments(): Promise<Tournament[]> {
  return prisma.tournament.findMany({
    where: {
      participantType: 'robot',
      status: { in: ['pending', 'active'] },
    },
    include: {
      matches: {
        orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
      },
    },
  });
}

/**
 * Get tournament by ID with all matches
 */
export async function getTournamentById(tournamentId: number): Promise<Tournament | null> {
  return prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      matches: {
        orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
        include: {
          battle: true,
        },
      },
    },
  });
}

/**
 * Get current round matches for a tournament
 */
export async function getCurrentRoundMatches(tournamentId: number): Promise<ScheduledTournamentMatch[]> {
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

  return prisma.scheduledTournamentMatch.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
      OR: [
        { status: { in: ['pending', 'scheduled'] } },
        { isByeMatch: true, battleId: null, status: 'completed' },
      ],
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          participantType: true,
        },
      },
    },
  });
}

/**
 * Resolve a generated tournament bye during current-round processing.
 *
 * Bracket generation and advancement only create the pending scheduled Match.
 * This function is the round boundary that invokes the shared no-simulation
 * writer, then marks the scheduling row terminal after its Bye_Record exists.
 * The writer's tournament-match battleId claim makes retries idempotent.
 *
 * @param advancingParticipantId The participant advancing, or null for empty
 *   bracket housekeeping with nobody to resolve.
 * @returns true when a real Bye_Event has a resolved battle.
 */
export async function completeByeMatch(
  match: ScheduledTournamentMatch,
  advancingParticipantId: number | null,
): Promise<boolean> {
  if (advancingParticipantId === null) {
    await prisma.scheduledTournamentMatch.update({
      where: { id: match.id },
      data: {
        winnerId: null,
        status: 'completed',
        isByeMatch: false,
        completedAt: new Date(),
      },
    });
    return false;
  }

  const tournament = await prisma.tournament.findUnique({ where: { id: match.tournamentId } });
  if (!tournament) return false;

  const mode =
    tournament.participantType === 'team_2v2'
      ? 'tournament_2v2' as const
      : tournament.participantType === 'team_3v3'
        ? 'tournament_3v3' as const
        : 'tournament_1v1' as const;

  // Expand the advancing participant into its real robots. A team participant id
  // is a TeamBattle id; a robot participant id is already a robot id.
  let robotIds: number[];
  let stableUserId: number;
  if (mode === 'tournament_1v1') {
    const robot = await prisma.robot.findUnique({ where: { id: advancingParticipantId } });
    if (!robot) return false;
    robotIds = [robot.id];
    stableUserId = robot.userId;
  } else {
    const team = await prisma.teamBattle.findUnique({
      where: { id: advancingParticipantId },
      include: { members: true },
    });
    if (!team) return false;
    robotIds = team.members.map(m => m.robotId);
    stableUserId = team.stableId;
  }

  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIds } },
    select: { id: true, name: true, userId: true, currentHP: true, maxHP: true, elo: true },
  });
  if (robots.length === 0) return false;

  try {
    const resolution = await resolveByeEvent({
      mode,
      context: {
        mode,
        totalParticipants: tournament.totalParticipants,
        currentRound: match.round,
        maxRounds: tournament.maxRounds,
      },
      claim: { source: 'tournament_match', tournamentMatchId: match.id },
      participants: robots,
      stableUserId,
      battle: {
        battleType: mode,
        leagueType: 'tournament',
        tournamentId: tournament.id,
        tournamentRound: match.round,
        // The bracket already records the advancing participant, and a tournament
        // bye touches no Standing, so there is no counter a winnerId could inflate.
        winnerId: mode === 'tournament_1v1' ? advancingParticipantId : (robots[0]?.id ?? null),
        winningSide: mode === 'tournament_1v1' ? null : 1,
        byeMessage: `Advances by bye in round ${match.round}`,
        battleLogExtras: {
          isTournament: true,
          round: match.round,
          maxRounds: tournament.maxRounds,
          isFinals: match.round === tournament.maxRounds,
        },
      },
      cycleNumber: await getCurrentCycleNumber(),
    });

    if (resolution.battleId === null) return false;

    await prisma.scheduledTournamentMatch.update({
      where: { id: match.id },
      data: {
        winnerId: advancingParticipantId,
        status: 'completed',
        isByeMatch: true,
        battleId: resolution.battleId,
        completedAt: new Date(),
      },
    });

    // L35 "Free Real Estate". Non-critical: the bye is already resolved.
    try {
      await achievementService.checkAndAward(stableUserId, null, { type: 'tournament_bye', data: { tournamentId: tournament.id } });
    } catch (achievementError) {
      logger.error(`[Tournament] Bye achievement check failed for match ${match.id}: ${achievementError}`);
    }
    return true;
  } catch (err) {
    // Keep the scheduling row pending when resolution fails so the round can be retried.
    logger.error(`[Tournament] Bye reward failed for match ${match.id}: ${err}`);
    return false;
  }
}

/**
 * Advance winners to next round
 * Populates next round matches with winners from current round
 */
export async function advanceWinnersToNextRound(tournamentId: number): Promise<void> {
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

  // Get terminal matches from current round. A cancelled row with a winner
  // (R1: an errored unfought match advances the higher seed) advances that
  // winner exactly like a completed or forfeit row.
  const currentRoundMatches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
      status: { in: [...TERMINAL_MATCH_STATUSES] },
    },
    orderBy: { matchNumber: 'asc' },
  });

  // Check if all matches in current round are terminal
  const allMatches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
    },
  });

  const allCompleted = allMatches.every(match => TERMINAL_MATCH_STATUSES.includes(match.status));
  if (!allCompleted) {
    logger.info(`[Tournament] Round ${tournament.currentRound} not yet complete. Waiting for all matches.`);
    return;
  }

  const winners = currentRoundMatches
    .filter(match => match.winnerId !== null)
    .map(match => match.winnerId as number);

  // Final round: crown the single winner, or finish without a champion.
  if (tournament.currentRound >= tournament.maxRounds) {
    if (winners.length > 0) {
      await completeTournament(tournamentId, winners[0]);
    } else {
      await completeTournamentWithoutChampion(tournamentId);
    }
    return;
  }

  // A non-final round without any winner can only come from empty placeholder
  // rows; nobody is left to advance.
  if (winners.length === 0) {
    await completeTournamentWithoutChampion(tournamentId);
    return;
  }

  // Get next round placeholder matches
  const nextRound = tournament.currentRound + 1;
  const nextRoundMatches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      tournamentId,
      round: nextRound,
    },
    orderBy: { matchNumber: 'asc' },
  });

  // Populate next round matches with winners. A one-sided row is an upcoming
  // Bye_Event; it is resolved only when this round is processed. A fully empty
  // row is bracket housekeeping and can be terminal immediately.
  // Pairing is positional: match 1 & 2 → next match 1, match 3 & 4 → next
  // match 2, etc. A match without a winner leaves its slot empty.
  const plan = planNextRoundSlots(currentRoundMatches, nextRoundMatches.length);
  for (let i = 0; i < nextRoundMatches.length; i++) {
    const { participant1Id, participant2Id } = plan[i];
    const hasParticipant1 = participant1Id !== null;
    const hasParticipant2 = participant2Id !== null;
    const isByeMatch = hasParticipant1 !== hasParticipant2;
    const isEmptyPlaceholder = !hasParticipant1 && !hasParticipant2;

    await prisma.scheduledTournamentMatch.update({
      where: { id: nextRoundMatches[i].id },
      data: {
        participant1Id,
        participant2Id,
        winnerId: null,
        battleId: null,
        status: isEmptyPlaceholder ? 'completed' : 'pending',
        isByeMatch,
        completedAt: isEmptyPlaceholder ? new Date() : null,
      },
    });

    if (isByeMatch) {
      logger.info(
        `[Tournament] Created pending bye match ${nextRoundMatches[i].id} in round ${nextRound}`,
      );
    } else if (isEmptyPlaceholder) {
      logger.warn(
        `[Tournament] Empty match ${nextRoundMatches[i].id} in round ${nextRound} — marked as bracket housekeeping`,
      );
    }
  }

  // Advance to next round. Any generated bye remains visible in Upcoming
  // Matches until the next scheduled round execution invokes completeByeMatch.
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      currentRound: nextRound,
    },
  });

  logger.info(`[Tournament] Advanced to round ${nextRound} with ${winners.length} winners`);
}


/**
 * Check if a new 1v1 tournament should be auto-created
 * Creates tournament if:
 * - No active 1v1 tournaments exist (scoped by participantType: 'robot')
 * - Sufficient eligible robots (≥ AUTO_START_THRESHOLD)
 */
export async function autoCreateNextTournament(): Promise<Tournament | null> {
  // Check for active 1v1 tournaments only (team tournaments have their own handlers)
  const activeTournament = await prisma.tournament.findFirst({
    where: {
      participantType: 'robot',
      status: { in: ['pending', 'active'] },
    },
  });

  if (activeTournament) {
    logger.info(`[Tournament] Active 1v1 tournament exists (${activeTournament.name}). Skipping auto-creation.`);
    return null;
  }

  // Check for eligible robots
  const eligibleRobots = await getEligibleRobotsForTournament();
  if (eligibleRobots.length < AUTO_START_THRESHOLD) {
    logger.info(`[Tournament] Insufficient robots for auto-tournament (${eligibleRobots.length}/${AUTO_START_THRESHOLD})`);
    return null;
  }

  logger.info(`[Tournament] Auto-creating tournament with ${eligibleRobots.length} eligible robots`);
  const result = await createSingleEliminationTournament();
  return result.tournament;
}
