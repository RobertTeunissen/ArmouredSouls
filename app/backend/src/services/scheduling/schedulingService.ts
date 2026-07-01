/**
 * Scheduling Service
 *
 * Unified scheduling service that replaces the multi-table scheduling approach
 * (scheduled_league_matches, scheduled_koth_matches, scheduled_team_battle_matches,
 * scheduled_tournament_matches) with a single `scheduled_matches_v2` table.
 *
 * Handles creation, completion, and cancellation of scheduled matches with
 * atomic participant insertion via Prisma transactions.
 *
 * @module services/scheduling/schedulingService
 */

import prisma from '../../lib/prisma';
import { MatchType } from '../../../generated/prisma';
import logger from '../../config/logger';

// ── Types ────────────────────────────────────────────────────────────

export interface ParticipantInput {
  participantType: 'robot' | 'team';
  participantId: number;
  slot: number;
}

export interface CreateScheduledMatchInput {
  matchType: MatchType;
  scheduledFor: Date;
  participants: ParticipantInput[];
  // Tournament-specific (optional)
  tournamentId?: number;
  round?: number;
  matchNumber?: number;
  isByeMatch?: boolean;
  // League-specific (optional)
  leagueType?: string;
  leagueInstanceId?: string;
  // KotH-specific (optional)
  scoreThreshold?: number;
  timeLimit?: number;
  zoneRadius?: number;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Create a scheduled match with participants in a single atomic transaction.
 * Inserts one row into `scheduled_matches_v2` and N participant rows into
 * `scheduled_match_participants`.
 *
 * @param input - Match configuration and participant list
 * @returns The created ScheduledMatch with participants included
 */
async function createMatch(input: CreateScheduledMatchInput) {
  const {
    matchType,
    scheduledFor,
    participants,
    tournamentId,
    round,
    matchNumber,
    isByeMatch,
    leagueType,
    leagueInstanceId,
    scoreThreshold,
    timeLimit,
    zoneRadius,
  } = input;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the scheduled match row
    const match = await tx.scheduledMatch.create({
      data: {
        matchType,
        scheduledFor,
        status: 'scheduled',
        // Tournament fields
        tournamentId: tournamentId ?? null,
        round: round ?? null,
        matchNumber: matchNumber ?? null,
        isByeMatch: isByeMatch ?? null,
        // League fields
        leagueType: leagueType ?? null,
        leagueInstanceId: leagueInstanceId ?? null,
        // KotH fields
        scoreThreshold: scoreThreshold ?? null,
        timeLimit: timeLimit ?? null,
        zoneRadius: zoneRadius ?? null,
      },
    });

    // 2. Create all participant rows
    if (participants.length > 0) {
      await tx.scheduledMatchParticipant.createMany({
        data: participants.map((p) => ({
          scheduledMatchId: match.id,
          participantType: p.participantType,
          participantId: p.participantId,
          slot: p.slot,
        })),
      });
    }

    // 3. Re-fetch with participants included for the return value
    const fullMatch = await tx.scheduledMatch.findUniqueOrThrow({
      where: { id: match.id },
      include: { participants: true },
    });

    return fullMatch;
  });

  logger.info('[Scheduling] Match created', {
    matchId: result.id,
    matchType,
    scheduledFor: scheduledFor.toISOString(),
    participantCount: participants.length,
  });

  return result;
}

/**
 * Mark a scheduled match as completed and link it to the resulting battle.
 *
 * @param matchId - The scheduled match ID to complete
 * @param battleId - The battle ID produced by executing this match
 */
async function completeMatch(matchId: number, battleId: number): Promise<void> {
  await prisma.scheduledMatch.update({
    where: { id: matchId },
    data: {
      status: 'completed',
      battleId,
    },
  });

  logger.info('[Scheduling] Match completed', { matchId, battleId });
}

/**
 * Cancel a scheduled match with a reason.
 *
 * @param matchId - The scheduled match ID to cancel
 * @param reason - Human-readable cancellation reason
 */
async function cancelMatch(matchId: number, reason: string): Promise<void> {
  await prisma.scheduledMatch.update({
    where: { id: matchId },
    data: {
      status: 'cancelled',
      cancelReason: reason,
    },
  });

  logger.info('[Scheduling] Match cancelled', { matchId, reason });
}

// ── Query Methods ────────────────────────────────────────────────────

/** Team-based match types used for team scheduling queries. */
const TEAM_MATCH_TYPES: MatchType[] = [
  MatchType.league_2v2,
  MatchType.league_3v3,
  MatchType.tag_team,
  MatchType.tournament_2v2,
  MatchType.tournament_3v3,
];

/**
 * Get all upcoming scheduled matches for a specific robot.
 * Queries via the participant join table, returning full match data with
 * all participants included (so consumers know who the opponent is).
 *
 * @param robotId - The robot ID to find upcoming matches for
 * @param matchTypes - Optional filter to restrict to specific match types
 * @returns Scheduled matches sorted by scheduledFor ascending
 */
async function getUpcomingForRobot(robotId: number, matchTypes?: MatchType[]) {
  const participants = await prisma.scheduledMatchParticipant.findMany({
    where: {
      participantType: 'robot',
      participantId: robotId,
      scheduledMatch: {
        status: 'scheduled',
        ...(matchTypes && matchTypes.length > 0
          ? { matchType: { in: matchTypes } }
          : {}),
      },
    },
    include: {
      scheduledMatch: {
        include: { participants: true },
      },
    },
    orderBy: {
      scheduledMatch: { scheduledFor: 'asc' },
    },
  });

  return participants.map((p) => p.scheduledMatch);
}

/**
 * Get all upcoming scheduled matches for a specific team.
 * When matchTypes is provided, filters to those specific types.
 * When omitted, defaults to all team-based match types (league_2v2, league_3v3,
 * tag_team, tournament_2v2, tournament_3v3).
 *
 * @param teamId - The team ID to find upcoming matches for
 * @param matchTypes - Optional filter to restrict to specific match types
 * @returns Scheduled matches sorted by scheduledFor ascending
 */
async function getUpcomingForTeam(teamId: number, matchTypes?: MatchType[]) {
  const participants = await prisma.scheduledMatchParticipant.findMany({
    where: {
      participantType: 'team',
      participantId: teamId,
      scheduledMatch: {
        status: 'scheduled',
        ...(matchTypes && matchTypes.length > 0
          ? { matchType: { in: matchTypes } }
          : { matchType: { in: TEAM_MATCH_TYPES } }),
      },
    },
    include: {
      scheduledMatch: {
        include: { participants: true },
      },
    },
    orderBy: {
      scheduledMatch: { scheduledFor: 'asc' },
    },
  });

  return participants.map((p) => p.scheduledMatch);
}

// ── Batch Query Methods ───────────────────────────────────────────────

/**
 * Batch-check which participant IDs already have a scheduled match of the given types.
 * Returns the set of participant IDs that are already scheduled.
 *
 * This replaces the N+1 pattern of calling getUpcomingForRobot/getUpcomingForTeam
 * in a loop — a single query with `IN (...)` replaces N individual queries.
 *
 * @param participantType - "robot" or "team"
 * @param participantIds - Array of IDs to check
 * @param matchTypes - Match types to filter on
 * @returns Set of participant IDs that have at least one scheduled match
 */
async function getAlreadyScheduledIds(
  participantType: 'robot' | 'team',
  participantIds: number[],
  matchTypes: MatchType[],
): Promise<Set<number>> {
  if (participantIds.length === 0) return new Set();

  const rows = await prisma.scheduledMatchParticipant.findMany({
    where: {
      participantType,
      participantId: { in: participantIds },
      scheduledMatch: {
        status: 'scheduled',
        matchType: { in: matchTypes },
      },
    },
    select: { participantId: true },
    distinct: ['participantId'],
  });

  return new Set(rows.map((r) => r.participantId));
}

// ── Singleton Export ─────────────────────────────────────────────────

const schedulingService = {
  createMatch,
  completeMatch,
  cancelMatch,
  getUpcomingForRobot,
  getUpcomingForTeam,
  getAlreadyScheduledIds,
};

export default schedulingService;
