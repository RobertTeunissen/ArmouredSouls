/**
 * Event schedule scope — the one place that answers "is there a queued match?"
 *
 * Two questions are asked of the schedule from opposite directions:
 *
 * - Pre-battle repair asks *"who fights event X next?"* so it only charges the
 *   robots actually taking part in the slot it is about to run (issue #411).
 * - Subscription management asks *"which events does robot R still owe a match
 *   to?"* so a slot stays occupied until the match it was booked for has run.
 *
 * Both are the same question over the same rows, so they share one scope map.
 * The map is a `Record` over `SubscribableEventType`, which means adding a tenth
 * event mode fails to compile until its schedule source is declared — repair
 * scoping and subscription accounting cannot silently drift apart, and neither
 * can drift away from the set of modes that actually run battles.
 *
 * @module services/scheduling/eventScheduleScope
 */

import prisma from '../../lib/prisma';
import { MatchType, Prisma } from '../../../generated/prisma';
import {
  SUBSCRIBABLE_EVENT_TYPES,
  type SubscribableEventType,
} from '../subscription/eventRegistry';

/** Prisma client or interactive-transaction client. */
type Db = Prisma.TransactionClient;

/** Tournament brackets store participants as two columns, not as rows. */
type TournamentParticipantType = 'robot' | 'team_2v2' | 'team_3v3';

/**
 * How a battle type's queued matches are found.
 *
 * `unified` reads `scheduled_matches_v2` through the participant join table.
 * `tournament` reads `tournament_matches`, which the tournament orchestrators
 * use instead.
 */
type EventScheduleScope =
  | { source: 'unified'; matchType: MatchType; participantType: 'robot' | 'team' }
  | { source: 'tournament'; participantType: TournamentParticipantType };

/** Where each battle type's queued matches live. Exhaustive by construction. */
export const EVENT_SCHEDULE_SCOPES: Record<SubscribableEventType, EventScheduleScope> = {
  league_1v1: { source: 'unified', matchType: MatchType.league_1v1, participantType: 'robot' },
  koth: { source: 'unified', matchType: MatchType.koth, participantType: 'robot' },
  grand_melee: { source: 'unified', matchType: MatchType.grand_melee, participantType: 'robot' },
  tag_team: { source: 'unified', matchType: MatchType.tag_team, participantType: 'team' },
  league_2v2: { source: 'unified', matchType: MatchType.league_2v2, participantType: 'team' },
  league_3v3: { source: 'unified', matchType: MatchType.league_3v3, participantType: 'team' },
  tournament_1v1: { source: 'tournament', participantType: 'robot' },
  tournament_2v2: { source: 'tournament', participantType: 'team_2v2' },
  tournament_3v3: { source: 'tournament', participantType: 'team_3v3' },
};

// ── Direction 1: who fights event X next? ────────────────────────────

/** Expand team ids to the robot ids of their members. */
async function robotIdsForTeams(teamIds: number[], db: Db): Promise<number[]> {
  if (teamIds.length === 0) return [];

  const members = await db.teamBattleMember.findMany({
    where: { teamId: { in: teamIds } },
    select: { robotId: true },
  });

  return members.map((m) => m.robotId);
}

/** Participants of matches queued in `scheduled_matches_v2` for one match type. */
async function resolveUnifiedParticipants(
  matchType: MatchType,
  participantType: 'robot' | 'team',
  db: Db,
): Promise<number[]> {
  const rows = await db.scheduledMatchParticipant.findMany({
    where: {
      participantType,
      scheduledMatch: { status: 'scheduled', matchType },
    },
    select: { participantId: true },
    distinct: ['participantId'],
  });

  const ids = rows.map((r) => r.participantId);
  return participantType === 'team' ? robotIdsForTeams(ids, db) : ids;
}

/**
 * Participants of tournament matches that could run next.
 *
 * Later-round matches exist as placeholders with null participants until the
 * bracket resolves, so filtering on a non-null participant naturally limits this
 * to the rounds that can actually be fought — no round arithmetic needed.
 */
async function resolveTournamentParticipants(
  participantType: TournamentParticipantType,
  db: Db,
): Promise<number[]> {
  // No bye filter (Spec #49). A Bye_Event is a scheduled match that resolves
  // differently, not a match that does not exist, so the robot is repaired on
  // the same rule as everyone else in that Battle_Slot. Before Spec #49 this
  // clause carried `isByeMatch: false`, which meant auto-repair depended on
  // which mode the bye happened in — the unified arm has never had such a
  // filter, so a league bye was repaired and a bracket bye was not.
  const matches = await db.scheduledTournamentMatch.findMany({
    where: {
      participantType,
      status: { in: ['pending', 'scheduled'] },
    },
    select: { participant1Id: true, participant2Id: true },
  });

  const ids = matches
    .flatMap((m) => [m.participant1Id, m.participant2Id])
    .filter((id): id is number => id !== null);

  const unique = [...new Set(ids)];
  return participantType === 'robot' ? unique : robotIdsForTeams(unique, db);
}

/**
 * Robot ids that have a match queued for the given battle type.
 *
 * Returns robot ids in every case: team modes are expanded through team
 * membership, because repair is always charged per robot.
 */
export async function resolveRobotIdsForEvent(
  eventType: SubscribableEventType,
  db: Db = prisma,
): Promise<number[]> {
  const scope = EVENT_SCHEDULE_SCOPES[eventType];

  const ids = scope.source === 'unified'
    ? await resolveUnifiedParticipants(scope.matchType, scope.participantType, db)
    : await resolveTournamentParticipants(scope.participantType, db);

  return [...new Set(ids)];
}

// ── Direction 2: which events does robot R still owe a match to? ─────

/** Reverse lookups, derived from the scope map so they can never disagree. */
function buildReverseLookups() {
  const unifiedByMatchType = {
    robot: new Map<MatchType, SubscribableEventType>(),
    team: new Map<MatchType, SubscribableEventType>(),
  };
  const tournamentByParticipantType = new Map<TournamentParticipantType, SubscribableEventType>();

  for (const eventType of SUBSCRIBABLE_EVENT_TYPES) {
    const scope = EVENT_SCHEDULE_SCOPES[eventType];
    if (scope.source === 'unified') {
      unifiedByMatchType[scope.participantType].set(scope.matchType, eventType);
    } else {
      tournamentByParticipantType.set(scope.participantType, eventType);
    }
  }

  return { unifiedByMatchType, tournamentByParticipantType };
}

/**
 * The events each robot has an outstanding queued match for.
 *
 * "Outstanding" means the match has been booked but not yet fought, including a
 * tournament bracket the robot is still alive in. Bye rounds count: the robot is
 * still committed to the bracket even in a round it does not have to fight,
 * which is why this filter differs from the repair one above.
 *
 * A robot that has been eliminated from a bracket has no unresolved match left,
 * so its slot is free again immediately — that is what lets a player knocked out
 * in round 2 of a long tournament put the robot to work somewhere else.
 *
 * Batched over the whole roster: the Booking Office matrix needs this for every
 * robot at once, and four queries for a roster beats three per robot.
 */
export async function resolveOutstandingEventsForRobots(
  robotIds: number[],
  db: Db = prisma,
): Promise<Map<number, SubscribableEventType[]>> {
  const result = new Map<number, SubscribableEventType[]>(robotIds.map((id) => [id, []]));
  if (robotIds.length === 0) return result;

  const { unifiedByMatchType, tournamentByParticipantType } = buildReverseLookups();

  const outstanding = new Map<number, Set<SubscribableEventType>>(
    robotIds.map((id) => [id, new Set<SubscribableEventType>()]),
  );
  const add = (robotId: number, eventType: SubscribableEventType): void => {
    outstanding.get(robotId)?.add(eventType);
  };

  // Team obligations belong to every member of the team.
  const memberships = await db.teamBattleMember.findMany({
    where: { robotId: { in: robotIds } },
    select: { robotId: true, teamId: true },
  });
  const membersByTeam = new Map<number, number[]>();
  for (const { robotId, teamId } of memberships) {
    const members = membersByTeam.get(teamId);
    if (members) members.push(robotId);
    else membersByTeam.set(teamId, [robotId]);
  }
  const teamIds = [...membersByTeam.keys()];

  // ── Unified schedule: the robots' own rows plus their teams' rows ──
  const unifiedFilters: Prisma.ScheduledMatchParticipantWhereInput[] = [
    {
      participantType: 'robot',
      participantId: { in: robotIds },
      scheduledMatch: {
        status: 'scheduled',
        matchType: { in: [...unifiedByMatchType.robot.keys()] },
      },
    },
  ];
  if (teamIds.length > 0) {
    unifiedFilters.push({
      participantType: 'team',
      participantId: { in: teamIds },
      scheduledMatch: {
        status: 'scheduled',
        matchType: { in: [...unifiedByMatchType.team.keys()] },
      },
    });
  }

  const unifiedRows = await db.scheduledMatchParticipant.findMany({
    where: { OR: unifiedFilters },
    select: {
      participantType: true,
      participantId: true,
      scheduledMatch: { select: { matchType: true } },
    },
  });

  for (const row of unifiedRows) {
    const isTeam = row.participantType === 'team';
    const lookup = isTeam ? unifiedByMatchType.team : unifiedByMatchType.robot;
    const eventType = lookup.get(row.scheduledMatch.matchType);
    if (!eventType) continue;

    const affected = isTeam
      ? membersByTeam.get(row.participantId) ?? []
      : [row.participantId];
    for (const robotId of affected) add(robotId, eventType);
  }

  // ── Tournament brackets ──
  const bracketFilters: Prisma.ScheduledTournamentMatchWhereInput[] = [];
  for (const participantType of tournamentByParticipantType.keys()) {
    const ids = participantType === 'robot' ? robotIds : teamIds;
    if (ids.length === 0) continue;
    bracketFilters.push({
      participantType,
      OR: [{ participant1Id: { in: ids } }, { participant2Id: { in: ids } }],
    });
  }

  if (bracketFilters.length > 0) {
    const bracketRows = await db.scheduledTournamentMatch.findMany({
      where: {
        status: { in: ['pending', 'scheduled'] },
        tournament: { status: 'active' },
        winnerId: null,
        OR: bracketFilters,
      },
      select: { participantType: true, participant1Id: true, participant2Id: true },
    });

    for (const row of bracketRows) {
      const participantType = row.participantType as TournamentParticipantType;
      const eventType = tournamentByParticipantType.get(participantType);
      if (!eventType) continue;

      const participants = [row.participant1Id, row.participant2Id]
        .filter((id): id is number => id !== null);

      for (const participantId of participants) {
        const affected = participantType === 'robot'
          ? [participantId]
          : membersByTeam.get(participantId) ?? [];
        for (const robotId of affected) add(robotId, eventType);
      }
    }
  }

  for (const [robotId, events] of outstanding) {
    result.set(robotId, [...events]);
  }
  return result;
}

/** The events this robot has an outstanding queued match for. */
export async function resolveOutstandingEventsForRobot(
  robotId: number,
  db: Db = prisma,
): Promise<SubscribableEventType[]> {
  const byRobot = await resolveOutstandingEventsForRobots([robotId], db);
  return byRobot.get(robotId) ?? [];
}
