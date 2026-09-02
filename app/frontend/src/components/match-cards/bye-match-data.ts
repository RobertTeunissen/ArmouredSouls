import type { ScheduledMatch } from '../../utils/matchmakingApi';

export type ByeCardSubject =
  | { kind: 'robot'; id: number; name: string; userId: number }
  | { kind: 'team'; id: number; name: string; teamSize: number; memberNames: string[] }
  | { kind: 'ffa'; id: number; name: string; userId: number };

export interface ByeCardPerspective {
  perspectiveRobotId?: number;
  perspectiveTeamId?: number;
  userId?: number;
}

type TeamBattleSide = NonNullable<ScheduledMatch['teamBattleTeam1']>;
type TagTeamSide = NonNullable<ScheduledMatch['team1']>;
type TeamSide = TeamBattleSide | TagTeamSide;

const TEAM_MATCH_TYPES = new Set([
  'league_2v2',
  'tournament_2v2',
  'league_3v3',
  'tournament_3v3',
  'tag_team',
]);

function isPlacementMode(matchType?: string): boolean {
  return matchType === 'koth' || matchType === 'grand_melee';
}

function isTeamMode(matchType?: string): boolean {
  return matchType != null && TEAM_MATCH_TYPES.has(matchType);
}

function getTeamSide(match: ScheduledMatch, sideNumber: 1 | 2): TeamSide | null {
  if (sideNumber === 1) {
    return match.teamBattleTeam1 ?? match.team1 ?? null;
  }
  return match.teamBattleTeam2 ?? match.team2 ?? null;
}

function getTeamMemberData(side: TeamSide): { id: number; name: string; userId: number }[] {
  if ('members' in side) {
    return side.members.map(member => ({
      id: member.robotId,
      name: member.robotName,
      userId: member.userId,
    }));
  }

  return [side.activeRobot, side.reserveRobot].map(robot => ({
    id: robot.id,
    name: robot.name,
    userId: robot.userId,
  }));
}

function resolveTeamSubject(
  match: ScheduledMatch,
  perspective: ByeCardPerspective,
): ByeCardSubject | null {
  const sides = ([1, 2] as const)
    .map(sideNumber => getTeamSide(match, sideNumber))
    .filter((side): side is TeamSide => side != null);
  const side = perspective.perspectiveTeamId != null
    ? sides.find(candidate => candidate.id === perspective.perspectiveTeamId)
    : sides.find(candidate => (
      perspective.userId != null
      && getTeamMemberData(candidate).some(member => member.userId === perspective.userId)
    ));

  if (!side || side.id <= 0) return null;

  const members = getTeamMemberData(side);
  const teamName = 'teamName' in side ? side.teamName : `Team ${side.id}`;
  return {
    kind: 'team',
    id: side.id,
    name: teamName,
    teamSize: 'teamSize' in side ? side.teamSize : members.length,
    memberNames: members.map(member => member.name),
  };
}

function resolveRobotSubject(
  match: ScheduledMatch,
  perspective: ByeCardPerspective,
): ByeCardSubject | null {
  const robots = [match.robot1, match.robot2].filter(
    (robot): robot is NonNullable<ScheduledMatch['robot1']> => robot != null && robot.id > 0,
  );
  const robot = perspective.perspectiveRobotId != null
    ? robots.find(candidate => candidate.id === perspective.perspectiveRobotId)
    : robots.find(candidate => perspective.userId != null && candidate.userId === perspective.userId);

  return robot
    ? { kind: 'robot', id: robot.id, name: robot.name, userId: robot.userId }
    : null;
}

function resolveFfaSubject(
  match: ScheduledMatch,
  perspective: ByeCardPerspective,
): ByeCardSubject | null {
  const participant = (match.kothParticipants ?? []).find(candidate => (
    candidate.id > 0
    && (perspective.perspectiveRobotId === candidate.id
      || (perspective.perspectiveRobotId == null
        && perspective.userId != null
        && candidate.userId === perspective.userId))
  ));

  return participant && participant.userId != null
    ? { kind: 'ffa', id: participant.id, name: participant.name, userId: participant.userId }
    : null;
}

/** Resolve the real player-owned subject for a scheduled bye without exposing a placeholder. */
export function resolveByeCardSubject(
  match: ScheduledMatch,
  perspective: ByeCardPerspective,
): ByeCardSubject | null {
  if (isPlacementMode(match.matchType)) {
    return resolveFfaSubject(match, perspective);
  }
  if (isTeamMode(match.matchType)) {
    return resolveTeamSubject(match, perspective);
  }
  return resolveRobotSubject(match, perspective);
}
