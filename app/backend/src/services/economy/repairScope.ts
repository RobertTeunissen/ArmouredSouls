/**
 * Repair scope resolution — which robots are about to fight (issue #411).
 *
 * Pre-battle repair used to repair every damaged robot in the game, once per
 * battle cron. With nine daily slots that meant a robot subscribed only to
 * `league_1v1` was auto-repaired at full price by the 2v2 cron an hour later,
 * before its owner had any realistic chance to log in and take the 50% manual
 * repair discount. Scoping each cron to its own participants leaves everyone
 * else damaged until either the player repairs manually or their own match comes
 * up, which is what makes the discount reachable without logging in constantly.
 *
 * This is the single resolver for all nine battle types. The scope map is a
 * `Record` over `SubscribableEventType`, so adding a tenth event mode fails to
 * compile until its repair scope is declared — the scope cannot silently drift
 * away from the set of modes that actually run battles.
 *
 * Leaving a robot damaged is safe: `checkBattleReadiness` is weapon-only and
 * explicitly does not check HP, so a damaged robot is still matched normally and
 * gets repaired by the cron that runs its match. It cannot strand itself.
 *
 * @module services/economy/repairScope
 */

import prisma from '../../lib/prisma';
import { MatchType } from '../../../generated/prisma';
import type { SubscribableEventType } from '../subscription/eventRegistry';

/**
 * How a battle type's upcoming participants are found.
 *
 * `unified` reads `scheduled_matches_v2` through the participant join table.
 * `tournament` reads `tournament_matches`, which the tournament orchestrators
 * use instead and which stores participants as two columns rather than rows.
 */
type RepairScope =
  | { source: 'unified'; matchType: MatchType; participantType: 'robot' | 'team' }
  | { source: 'tournament'; participantType: 'robot' | 'team_2v2' | 'team_3v3' };

/** Where each battle type's next participants come from. Exhaustive by construction. */
const REPAIR_SCOPES: Record<SubscribableEventType, RepairScope> = {
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

/** Expand team ids to the robot ids of their members. */
async function robotIdsForTeams(teamIds: number[]): Promise<number[]> {
  if (teamIds.length === 0) return [];

  const members = await prisma.teamBattleMember.findMany({
    where: { teamId: { in: teamIds } },
    select: { robotId: true },
  });

  return members.map((m) => m.robotId);
}

/** Participants of matches queued in `scheduled_matches_v2` for one match type. */
async function resolveUnifiedParticipants(
  matchType: MatchType,
  participantType: 'robot' | 'team',
): Promise<number[]> {
  const rows = await prisma.scheduledMatchParticipant.findMany({
    where: {
      participantType,
      scheduledMatch: { status: 'scheduled', matchType },
    },
    select: { participantId: true },
    distinct: ['participantId'],
  });

  const ids = rows.map((r) => r.participantId);
  return participantType === 'team' ? robotIdsForTeams(ids) : ids;
}

/**
 * Participants of tournament matches that could run next.
 *
 * Later-round matches exist as placeholders with null participants until the
 * bracket resolves, so filtering on a non-null participant naturally limits this
 * to the rounds that can actually be fought — no round arithmetic needed.
 */
async function resolveTournamentParticipants(
  participantType: 'robot' | 'team_2v2' | 'team_3v3',
): Promise<number[]> {
  const matches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      participantType,
      status: { in: ['pending', 'scheduled'] },
      isByeMatch: false,
    },
    select: { participant1Id: true, participant2Id: true },
  });

  const ids = matches
    .flatMap((m) => [m.participant1Id, m.participant2Id])
    .filter((id): id is number => id !== null);

  const unique = [...new Set(ids)];
  return participantType === 'robot' ? unique : robotIdsForTeams(unique);
}

/**
 * Robot ids that have a match queued for the given battle type.
 *
 * Returns robot ids in every case: team modes are expanded through team
 * membership, because repair is always charged per robot.
 */
export async function resolveRobotIdsForEvent(
  eventType: SubscribableEventType,
): Promise<number[]> {
  const scope = REPAIR_SCOPES[eventType];

  const ids = scope.source === 'unified'
    ? await resolveUnifiedParticipants(scope.matchType, scope.participantType)
    : await resolveTournamentParticipants(scope.participantType);

  return [...new Set(ids)];
}
