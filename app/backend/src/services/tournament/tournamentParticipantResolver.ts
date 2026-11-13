/**
 * Tournament Participant Resolver
 *
 * Resolves tournament participant details based on `participantType`.
 * For 'robot' participants, joins the Robot table.
 * For 'team_2v2' or 'team_3v3' participants, joins the TeamBattle table.
 *
 * @module services/tournament/tournamentParticipantResolver
 */

import { StandingsMode } from '../../../generated/prisma';
import prisma from '../../lib/prisma';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ParticipantType = 'robot' | 'team_2v2' | 'team_3v3';

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

// ─── Single Resolution ───────────────────────────────────────────────────────

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
    where: { entityType: 'robot', entityId: { in: ids }, mode: StandingsMode.league_1v1 },
    select: { entityId: true, tier: true },
  });
  const tierByRobot = new Map(standings.map(s => [s.entityId, s.tier]));

  const result = new Map<number, ResolvedParticipant>();
  for (const robot of robots) {
    result.set(robot.id, {
      id: robot.id,
      displayName: robot.name,
      leagueTier: tierByRobot.get(robot.id) ?? 'bronze',
      elo: robot.elo,
      ownerId: robot.userId,
      ownerStableName: robot.user.stableName || robot.user.username,
    });
  }

  return result;
}

// ─── Internal: Team Resolution ───────────────────────────────────────────────

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
    where: { entityType: 'team', entityId: { in: ids }, mode: { in: [StandingsMode.league_2v2, StandingsMode.league_3v3] } },
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
      leagueTier: tierByTeam.get(team.id) ?? 'bronze',
      elo: members.reduce((sum, m) => sum + m.elo, 0),
      ownerId: team.stableId,
      ownerStableName: team.stable.stableName || team.stable.username,
      members,
    });
  }

  return result;
}
