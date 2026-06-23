/**
 * Tournament Participant Resolver
 *
 * Resolves tournament participant details based on `participantType`.
 * For 'robot' participants, joins the Robot table.
 * For 'team_2v2' or 'team_3v3' participants, joins the TeamBattle table.
 *
 * @module services/tournament/tournamentParticipantResolver
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ParticipantType = 'robot' | 'team_2v2' | 'team_3v3';

const VALID_PARTICIPANT_TYPES: ParticipantType[] = ['robot', 'team_2v2', 'team_3v3'];

export interface ResolvedParticipant {
  id: number;
  displayName: string;
  leagueTier: string;
  elo: number;
  ownerId: number;
  ownerStableName?: string;
  members?: { robotId: number; robotName: string; elo: number }[];
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates that the given type string is a recognized ParticipantType.
 * Throws TournamentError with INVALID_PARTICIPANT_TYPE if unrecognized.
 */
export function validateParticipantType(type: string): asserts type is ParticipantType {
  if (!VALID_PARTICIPANT_TYPES.includes(type as ParticipantType)) {
    throw new TournamentError(
      TournamentErrorCode.INVALID_PARTICIPANT_TYPE,
      `Unrecognized participant type: '${type}'. Allowed values: ${VALID_PARTICIPANT_TYPES.join(', ')}`,
      400,
    );
  }
}

// ─── Single Resolution ───────────────────────────────────────────────────────

/**
 * Resolves a single participant's details by ID and type.
 * Returns null if the entity is not found.
 */
export async function resolveParticipant(
  participantId: number,
  participantType: ParticipantType,
): Promise<ResolvedParticipant | null> {
  if (participantType === 'robot') {
    return resolveRobotParticipant(participantId);
  }
  return resolveTeamParticipant(participantId);
}

// ─── Batch Resolution ────────────────────────────────────────────────────────

/**
 * Resolves multiple participants by IDs and type.
 * Returns a Map keyed by participant ID.
 */
export async function resolveParticipantsBatch(
  ids: number[],
  participantType: ParticipantType,
): Promise<Map<number, ResolvedParticipant>> {
  if (ids.length === 0) {
    return new Map();
  }

  if (participantType === 'robot') {
    return resolveRobotParticipantsBatch(ids);
  }
  return resolveTeamParticipantsBatch(ids);
}

// ─── Internal: Robot Resolution ──────────────────────────────────────────────

async function resolveRobotParticipant(robotId: number): Promise<ResolvedParticipant | null> {
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    include: {
      user: {
        select: { id: true, stableName: true, username: true },
      },
    },
  });

  if (!robot) {
    logger.warn(`Participant resolver: Robot ${robotId} not found`);
    return null;
  }

  // Read tier from standings (source of truth)
  const standing = await prisma.standing.findFirst({
    where: { entityType: 'robot', entityId: robot.id, mode: 'league_1v1' as any },
    select: { tier: true },
  });

  return {
    id: robot.id,
    displayName: robot.name,
    leagueTier: standing?.tier ?? robot.currentLeague,
    elo: robot.elo,
    ownerId: robot.userId,
    ownerStableName: robot.user.stableName || robot.user.username,
  };
}

async function resolveRobotParticipantsBatch(ids: number[]): Promise<Map<number, ResolvedParticipant>> {
  const robots = await prisma.robot.findMany({
    where: { id: { in: ids } },
    include: {
      user: {
        select: { id: true, stableName: true, username: true },
      },
    },
  });

  // Batch fetch tiers from standings
  const standings = await prisma.standing.findMany({
    where: { entityType: 'robot', entityId: { in: ids }, mode: 'league_1v1' as any },
    select: { entityId: true, tier: true },
  });
  const tierByRobot = new Map(standings.map(s => [s.entityId, s.tier]));

  const result = new Map<number, ResolvedParticipant>();
  for (const robot of robots) {
    result.set(robot.id, {
      id: robot.id,
      displayName: robot.name,
      leagueTier: tierByRobot.get(robot.id) ?? robot.currentLeague,
      elo: robot.elo,
      ownerId: robot.userId,
      ownerStableName: robot.user.stableName || robot.user.username,
    });
  }

  return result;
}

// ─── Internal: Team Resolution ───────────────────────────────────────────────

async function resolveTeamParticipant(teamId: number): Promise<ResolvedParticipant | null> {
  const team = await prisma.teamBattle.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          robot: {
            select: { id: true, name: true, elo: true },
          },
        },
        orderBy: { slotIndex: 'asc' },
      },
      stable: {
        select: { id: true, stableName: true, username: true },
      },
    },
  });

  if (!team) {
    logger.warn(`Participant resolver: Team ${teamId} not found`);
    return null;
  }

  const members = team.members.map((m) => ({
    robotId: m.robot.id,
    robotName: m.robot.name,
    elo: m.robot.elo,
  }));

  // Read tier from standings (source of truth)
  const mode = team.teamSize === 2 ? 'league_2v2' : 'league_3v3';
  const standing = await prisma.standing.findFirst({
    where: { entityType: 'team', entityId: team.id, mode: mode as any },
    select: { tier: true },
  });

  return {
    id: team.id,
    displayName: team.teamName,
    leagueTier: standing?.tier ?? team.teamLeague,
    elo: members.reduce((sum, m) => sum + m.elo, 0),
    ownerId: team.stableId,
    ownerStableName: team.stable.stableName || team.stable.username,
    members,
  };
}

async function resolveTeamParticipantsBatch(ids: number[]): Promise<Map<number, ResolvedParticipant>> {
  const teams = await prisma.teamBattle.findMany({
    where: { id: { in: ids } },
    include: {
      members: {
        include: {
          robot: {
            select: { id: true, name: true, elo: true },
          },
        },
        orderBy: { slotIndex: 'asc' },
      },
      stable: {
        select: { id: true, stableName: true, username: true },
      },
    },
  });

  // Batch fetch tiers from standings (try both 2v2 and 3v3)
  const standings = await prisma.standing.findMany({
    where: { entityType: 'team', entityId: { in: ids }, mode: { in: ['league_2v2', 'league_3v3'] as any[] } },
    select: { entityId: true, tier: true },
  });
  const tierByTeam = new Map(standings.map(s => [s.entityId, s.tier]));

  const result = new Map<number, ResolvedParticipant>();
  for (const team of teams) {
    const members = team.members.map((m) => ({
      robotId: m.robot.id,
      robotName: m.robot.name,
      elo: m.robot.elo,
    }));

    result.set(team.id, {
      id: team.id,
      displayName: team.teamName,
      leagueTier: tierByTeam.get(team.id) ?? team.teamLeague,
      elo: members.reduce((sum, m) => sum + m.elo, 0),
      ownerId: team.stableId,
      ownerStableName: team.stable.stableName || team.stable.username,
      members,
    });
  }

  return result;
}
