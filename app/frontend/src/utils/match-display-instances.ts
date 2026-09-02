import type {
  BattleHistory,
  BattleParticipantData,
  ScheduledMatch,
} from './matchmakingApi';

export interface BattleDisplayInstance {
  battle: BattleHistory;
  displayInstanceKey: string;
  perspectiveRobotId: number;
  perspectiveRobotIds: number[];
  perspectiveTeamId?: number;
}

export interface UpcomingMatchInstance extends ScheduledMatch {
  displayInstanceKey: string;
  perspectiveRobotId?: number;
  perspectiveRobotIds: number[];
  perspectiveTeamId?: number;
}

type ScheduledRobot = NonNullable<ScheduledMatch['robot1']>;
type TagTeamSide = NonNullable<ScheduledMatch['team1']>;
type TeamBattleSide = NonNullable<ScheduledMatch['teamBattleTeam1']>;
type ScheduledTeamSide = TagTeamSide | TeamBattleSide;

const TEAM_MATCH_TYPES = new Set([
  'league_2v2',
  'tournament_2v2',
  'league_3v3',
  'tournament_3v3',
  'tag_team',
]);

const PLACEMENT_MATCH_TYPES = new Set(['koth', 'grand_melee']);

function isPlacementMode(battleType?: string): boolean {
  return battleType != null && PLACEMENT_MATCH_TYPES.has(battleType);
}

function isTeamMatch(matchType?: string): boolean {
  return matchType != null && TEAM_MATCH_TYPES.has(matchType);
}

function uniqueRobotIds(participants: BattleParticipantData[]): number[] {
  return [...new Set(participants.map(participant => participant.robotId))];
}

function getOwnedParticipants(
  battle: BattleHistory,
  context: { userId?: number; robotId?: number },
): BattleParticipantData[] {
  const participants = battle.participants ?? [];

  if (context.robotId !== undefined) {
    const selected = participants.find(participant => participant.robotId === context.robotId);
    return selected ? [selected] : [];
  }

  if (context.userId === undefined) {
    return [];
  }

  return participants.filter(participant => participant.robot.userId === context.userId);
}

/**
 * Expand one resolved Battle into the perspectives owned by the requesting
 * stable. Non-FFA participants sharing a team remain one card instance;
 * Placement_Mode participants always remain separate instances.
 */
export function expandBattleDisplayInstances(
  battle: BattleHistory,
  context: { userId?: number; robotId?: number },
): BattleDisplayInstance[] {
  const ownedParticipants = getOwnedParticipants(battle, context);

  if (isPlacementMode(battle.battleType)) {
    return ownedParticipants.map(participant => ({
      battle,
      displayInstanceKey: `battle:${battle.id}:robot:${participant.robotId}`,
      perspectiveRobotId: participant.robotId,
      perspectiveRobotIds: [participant.robotId],
      perspectiveTeamId: participant.team,
    }));
  }

  const byTeam = new Map<number, BattleParticipantData[]>();
  for (const participant of ownedParticipants) {
    const teamParticipants = byTeam.get(participant.team) ?? [];
    teamParticipants.push(participant);
    byTeam.set(participant.team, teamParticipants);
  }

  return [...byTeam.entries()].map(([team, participants]) => ({
    battle,
    displayInstanceKey: `battle:${battle.id}:team:${team}`,
    perspectiveRobotId: participants[0].robotId,
    perspectiveRobotIds: uniqueRobotIds(participants),
    perspectiveTeamId: team,
  }));
}

function getTeamSide(match: ScheduledMatch, sideNumber: 1 | 2): ScheduledTeamSide | null {
  if (sideNumber === 1) {
    return match.teamBattleTeam1 ?? match.team1 ?? null;
  }
  return match.teamBattleTeam2 ?? match.team2 ?? null;
}

function getTeamRobotIds(side: ScheduledTeamSide): number[] {
  if ('members' in side) {
    return side.members.map(member => member.robotId);
  }

  return [side.activeRobot.id, side.reserveRobot.id];
}

function getTeamUserIds(side: ScheduledTeamSide): number[] {
  if ('members' in side) {
    return side.members.map(member => member.userId);
  }

  return [side.activeRobot.userId, side.reserveRobot.userId];
}

function getOwnedTeamRobotIds(side: ScheduledTeamSide, userId: number): number[] {
  if ('members' in side) {
    return side.members
      .filter(member => member.userId === userId)
      .map(member => member.robotId);
  }

  return [side.activeRobot, side.reserveRobot]
    .filter(robot => robot.userId === userId)
    .map(robot => robot.id);
}

function createRobotInstances(match: ScheduledMatch, robots: ScheduledRobot[]): UpcomingMatchInstance[] {
  const seen = new Set<number>();

  return robots
    .filter(robot => {
      if (seen.has(robot.id)) return false;
      seen.add(robot.id);
      return true;
    })
    .map(robot => ({
      ...match,
      displayInstanceKey: `match:${String(match.id)}:robot:${robot.id}`,
      perspectiveRobotId: robot.id,
      perspectiveRobotIds: [robot.id],
    }));
}

function createTeamInstances(match: ScheduledMatch, userId: number): UpcomingMatchInstance[] {
  return ([1, 2] as const)
    .map(sideNumber => getTeamSide(match, sideNumber))
    .filter((side): side is ScheduledTeamSide => (
      side != null && getTeamUserIds(side).includes(userId)
    ))
    .map(side => {
      const perspectiveRobotIds = getOwnedTeamRobotIds(side, userId);
      const perspectiveRobotId = perspectiveRobotIds[0] ?? getTeamRobotIds(side)[0];

      return {
        ...match,
        displayInstanceKey: `match:${String(match.id)}:team:${side.id}`,
        perspectiveRobotId,
        perspectiveRobotIds,
        perspectiveTeamId: side.id,
      };
    });
}

/**
 * Expand one scheduled Match into the authenticated stable's represented
 * sides. This is presentation-only: it neither mutates the API row nor
 * performs additional ownership or team lookups.
 */
export function expandUpcomingMatchInstances(
  match: ScheduledMatch,
  userId: number,
): UpcomingMatchInstance[] {
  if (isPlacementMode(match.matchType)) {
    const ownedRobots = (match.kothParticipants ?? [])
      .filter(participant => participant.userId === userId)
      .map(participant => ({
        id: participant.id,
        name: participant.name,
        elo: participant.elo,
        currentHP: 0,
        maxHP: 0,
        userId,
        user: participant.user ?? { username: '' },
      }));

    return createRobotInstances(match, ownedRobots);
  }

  if (isTeamMatch(match.matchType)) {
    return createTeamInstances(match, userId);
  }

  return createRobotInstances(
    match,
    [match.robot1, match.robot2].filter((robot): robot is ScheduledRobot => (
      robot != null && robot.userId === userId
    )),
  );
}
