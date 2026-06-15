import prisma from '../../lib/prisma';
import { Prisma, BattleParticipant } from '../../../generated/prisma';
import { getConfig } from '../../config/env';
import { getNextCronOccurrence } from '../../utils/scheduleUtils';
import type { KothPlacement } from '../../types/battleLogTypes';

// ─── Prisma Payload Types ────────────────────────────────────────────

const robotUserSelect = { select: { id: true, username: true } } as const;
const robotInclude = { include: { user: robotUserSelect } } as const;

type RobotWithUser = Prisma.RobotGetPayload<{ include: { user: { select: { id: true; username: true } } } }>;

type ScheduledLeagueMatchWithRobots = Prisma.ScheduledLeagueMatchGetPayload<{
  include: { robot1: { include: { user: { select: { id: true; username: true } } } }; robot2: { include: { user: { select: { id: true; username: true } } } } };
}>;

type ScheduledTournamentMatchWithRobots = Prisma.ScheduledTournamentMatchGetPayload<{
  include: {
    tournament: { select: { id: true; name: true; currentRound: true; maxRounds: true } };
  };
}>;

type ScheduledTournamentByeMatchWithRobots = Prisma.ScheduledTournamentMatchGetPayload<{
  include: {
    tournament: { select: { id: true; name: true; currentRound: true; maxRounds: true } };
  };
}>;

// Legacy type removed — tag team data now served via TeamBattle
type TagTeamWithMembers = {
  id: number;
  stableId: number;
  teamName: string;
  members: Array<{ slotIndex: number; robot: { id: number; name: string; user: { id: number; username: string } } }>;
  stable?: { stableName: string | null };
};

// Legacy type replaced — tag team scheduled matches now use ScheduledTeamBattleMatch with matchMode='tag_team'
type ScheduledTagTeamMatchWithTeams = Prisma.ScheduledTeamBattleMatchGetPayload<{
  include: {
    team1: { include: { members: { include: { robot: { include: { user: { select: { id: true; username: true } } } } } }; stable: { select: { stableName: true } } } };
    team2: { include: { members: { include: { robot: { include: { user: { select: { id: true; username: true } } } } } }; stable: { select: { stableName: true } } } };
  };
}>;

type ScheduledKothMatchWithParticipants = Prisma.ScheduledKothMatchGetPayload<{
  include: { participants: { include: { robot: { include: { user: { select: { id: true; username: true } } } } } } };
}>;

type TeamBattleWithMembers = Prisma.TeamBattleGetPayload<{
  include: {
    members: {
      include: { robot: { include: { user: { select: { id: true; username: true } } } } };
    };
  };
}>;

type ScheduledTeamBattleMatchWithTeams = Prisma.ScheduledTeamBattleMatchGetPayload<{
  include: {
    team1: { include: { members: { include: { robot: { include: { user: { select: { id: true; username: true } } } } } } } };
    team2: { include: { members: { include: { robot: { include: { user: { select: { id: true; username: true } } } } } } } };
  };
}>;

type BattleWithFullRelations = Prisma.BattleGetPayload<{
  include: {
    robot1: { include: { user: { select: { id: true; username: true; stableName: true } } } };
    robot2: { include: { user: { select: { id: true; username: true; stableName: true } } } };
    tournament: { select: { id: true; name: true; maxRounds: true } };
    participants: true;
  };
}>;

type _BattleWithRobotsAndUsers = Prisma.BattleGetPayload<{
  include: {
    robot1: { include: { user: { select: { id: true; username: true; stableName: true } } } };
    robot2: { include: { user: { select: { id: true; username: true; stableName: true } } } };
  };
}>;

type BattleWithRobotsAndWeapons = Prisma.BattleGetPayload<{
  include: {
    robot1: { include: { user: { select: { id: true; username: true; stableName: true } }; mainWeapon: { include: { weapon: { select: { name: true; rangeBand: true } } } }; offhandWeapon: { include: { weapon: { select: { name: true; rangeBand: true } } } } } };
    robot2: { include: { user: { select: { id: true; username: true; stableName: true } }; mainWeapon: { include: { weapon: { select: { name: true; rangeBand: true } } } }; offhandWeapon: { include: { weapon: { select: { name: true; rangeBand: true } } } } } };
  };
}>;

/** battleData in getBattleLog — bigint tag-out times converted to number */
type BattleDataForLog = Omit<BattleWithRobotsAndWeapons, 'team1TagOutTime' | 'team2TagOutTime'> & {
  team1TagOutTime: number | null;
  team2TagOutTime: number | null;
};

type TagTeamRobot = Prisma.RobotGetPayload<{
  include: { user: { select: { id: true; username: true; stableName: true } } };
}> | null;

// ─── Upcoming Matches ────────────────────────────────────────────────

interface RobotAndTeamIds {
  robotIds: number[];
  teamIds: number[];
  teamBattleIds: number[];
}

/**
 * Resolve robot IDs, tag-team IDs, and team-battle IDs for the upcoming-matches query.
 * If a specific robotId is provided, returns that robot (plus any teams it belongs to).
 * Otherwise returns all robots/teams owned by the given user.
 */
export async function resolveRobotAndTeamIds(
  userId: number,
  queryRobotId?: number,
): Promise<RobotAndTeamIds> {
  if (queryRobotId !== undefined && !isNaN(queryRobotId)) {
    const [teamBattlesWithRobot] = await Promise.all([
      prisma.teamBattle.findMany({
        where: { members: { some: { robotId: queryRobotId } } },
        select: { id: true },
      }),
    ]);
    return {
      robotIds: [queryRobotId],
      teamIds: [],
      teamBattleIds: teamBattlesWithRobot.map(t => t.id),
    };
  }

  const [userRobots, userTeamBattles] = await Promise.all([
    prisma.robot.findMany({ where: { userId }, select: { id: true } }),
    prisma.teamBattle.findMany({ where: { stableId: userId }, select: { id: true } }),
  ]);

  return {
    robotIds: userRobots.map(r => r.id),
    teamIds: [],
    teamBattleIds: userTeamBattles.map(t => t.id),
  };
}

/**
 * Fetch and format all upcoming matches (league, tournament, tag-team, KotH, team-battle)
 * for the given robot/team IDs.
 */
export async function getUpcomingMatches(robotIds: number[], teamIds: number[], teamBattleIds: number[] = []) {
  const [leagueMatches, tournamentMatches, activeTournaments, tagTeamMatches, kothMatches, teamBattleMatches, teamTournamentMatches] =
    await Promise.all([
      fetchScheduledLeagueMatches(robotIds),
      fetchScheduledTournamentMatches(robotIds),
      prisma.tournament.findMany({
        where: { status: 'active' },
        select: { id: true, currentRound: true },
      }),
      fetchScheduledTagTeamMatches(teamIds),
      fetchScheduledKothMatches(robotIds),
      fetchScheduledTeamBattleMatches(teamBattleIds),
      fetchScheduledTeamTournamentMatches(teamBattleIds),
    ]);

  const tournamentByeMatches = activeTournaments.length > 0
    ? await prisma.scheduledTournamentMatch.findMany({
        where: {
          isByeMatch: true,
          status: 'completed',
          participantType: 'robot',
          participant1Id: { in: robotIds },
          OR: activeTournaments.map(t => ({
            tournamentId: t.id,
            round: t.currentRound,
          })),
        },
        include: {
          tournament: { select: { id: true, name: true, currentRound: true, maxRounds: true } },
        },
        orderBy: { round: 'asc' },
      })
    : [];

  const formattedLeague = formatLeagueMatches(leagueMatches);
  const formattedTournament = formatTournamentMatches(tournamentMatches);
  const formattedBye = formatByeMatches(tournamentByeMatches);
  const formattedTagTeam = formatTagTeamMatches(tagTeamMatches);
  const formattedKoth = formatKothMatches(kothMatches);
  const formattedTeamBattle = formatTeamBattleMatches(teamBattleMatches);
  const formattedTeamTournament = formatTeamTournamentMatches(teamTournamentMatches);

  const allMatches = [
    ...formattedLeague,
    ...formattedTournament,
    ...formattedBye,
    ...formattedTagTeam,
    ...formattedKoth,
    ...formattedTeamBattle,
    ...formattedTeamTournament,
  ].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());

  return {
    matches: allMatches,
    total: allMatches.length,
    leagueMatches: formattedLeague.length,
    tournamentMatches: formattedTournament.length + formattedBye.length + formattedTeamTournament.length,
    tagTeamMatches: formattedTagTeam.length,
    kothMatches: formattedKoth.length,
    teamBattleMatches: formattedTeamBattle.length,
  };
}

// ─── Upcoming: Prisma queries ────────────────────────────────────────

async function fetchScheduledLeagueMatches(robotIds: number[]) {
  return prisma.scheduledLeagueMatch.findMany({
    where: {
      status: 'scheduled',
      OR: [{ robot1Id: { in: robotIds } }, { robot2Id: { in: robotIds } }],
    },
    include: { robot1: robotInclude, robot2: robotInclude },
    orderBy: { scheduledFor: 'asc' },
  });
}

async function fetchScheduledTournamentMatches(robotIds: number[]) {
  const matches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      participantType: 'robot',
      status: { in: ['pending', 'scheduled'] },
      OR: [{ participant1Id: { in: robotIds } }, { participant2Id: { in: robotIds } }],
    },
    include: {
      tournament: { select: { id: true, name: true, currentRound: true, maxRounds: true } },
    },
    orderBy: { round: 'asc' },
  });

  // Resolve participant robots
  const allParticipantIds = [...new Set(matches.flatMap(m => [m.participant1Id, m.participant2Id]).filter((id): id is number => id !== null))];
  const robots = allParticipantIds.length > 0
    ? await prisma.robot.findMany({ where: { id: { in: allParticipantIds } }, include: { user: robotUserSelect } })
    : [];
  const robotMap = new Map(robots.map(r => [r.id, r]));

  return matches.map(m => ({
    ...m,
    resolvedRobot1: m.participant1Id ? robotMap.get(m.participant1Id) ?? null : null,
    resolvedRobot2: m.participant2Id ? robotMap.get(m.participant2Id) ?? null : null,
  }));
}

async function fetchScheduledTagTeamMatches(teamIds: number[]) {
  // Tag team matches now live in ScheduledTeamBattleMatch with matchMode='tag_team'
  // teamIds is no longer used (legacy TagTeam IDs); tag team matches are found via teamBattleIds
  return [] as ScheduledTagTeamMatchWithTeams[];
}

async function fetchScheduledKothMatches(robotIds: number[]) {
  return prisma.scheduledKothMatch.findMany({
    where: {
      status: 'scheduled',
      participants: { some: { robotId: { in: robotIds } } },
    },
    include: {
      participants: { include: { robot: { include: { user: robotUserSelect } } } },
    },
    orderBy: { scheduledFor: 'asc' },
  });
}

async function fetchScheduledTeamBattleMatches(teamBattleIds: number[]) {
  if (teamBattleIds.length === 0) return [];
  const teamBattleMemberInclude = {
    include: {
      members: {
        include: { robot: { include: { user: robotUserSelect } } },
        orderBy: { slotIndex: 'asc' as const },
      },
    },
  } as const;

  return prisma.scheduledTeamBattleMatch.findMany({
    where: {
      status: 'scheduled',
      OR: [{ team1Id: { in: teamBattleIds } }, { team2Id: { in: teamBattleIds } }],
    },
    include: { team1: teamBattleMemberInclude, team2: teamBattleMemberInclude },
    orderBy: { scheduledFor: 'asc' },
  });
}

async function fetchScheduledTeamTournamentMatches(teamBattleIds: number[]) {
  if (teamBattleIds.length === 0) return [];
  const matches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      participantType: { in: ['team_2v2', 'team_3v3'] },
      status: { in: ['pending', 'scheduled'] },
      OR: [{ participant1Id: { in: teamBattleIds } }, { participant2Id: { in: teamBattleIds } }],
    },
    include: {
      tournament: { select: { id: true, name: true, currentRound: true, maxRounds: true, participantType: true } },
    },
    orderBy: { round: 'asc' },
  });

  // Resolve team data for participants
  const allParticipantIds = matches.flatMap(m => [m.participant1Id, m.participant2Id]).filter((id): id is number => id !== null);
  const teams = allParticipantIds.length > 0
    ? await prisma.teamBattle.findMany({
        where: { id: { in: allParticipantIds } },
        include: { members: { include: { robot: { include: { user: robotUserSelect } } }, orderBy: { slotIndex: 'asc' } } },
      })
    : [];
  const teamMap = new Map(teams.map(t => [t.id, t]));

  return matches.map(m => ({ ...m, resolvedTeam1: m.participant1Id ? teamMap.get(m.participant1Id) ?? null : null, resolvedTeam2: m.participant2Id ? teamMap.get(m.participant2Id) ?? null : null }));
}

// ─── Upcoming: Formatters ────────────────────────────────────────────

function formatRobotSummary(robot: RobotWithUser) {
  return {
    id: robot.id,
    name: robot.name,
    elo: robot.elo,
    currentHP: robot.currentHP,
    maxHP: robot.maxHP,
    userId: robot.userId,
    user: { username: robot.user.username },
  };
}

function formatLeagueMatches(matches: ScheduledLeagueMatchWithRobots[]) {
  return matches.map(match => ({
    id: match.id,
    matchType: 'league_1v1' as const,
    robot1Id: match.robot1Id,
    robot2Id: match.robot2Id,
    leagueType: match.leagueType,
    scheduledFor: match.scheduledFor,
    status: match.status,
    robot1: formatRobotSummary(match.robot1),
    robot2: formatRobotSummary(match.robot2),
  }));
}

function formatTournamentMatches(matches: Awaited<ReturnType<typeof fetchScheduledTournamentMatches>>) {
  return matches.map(match => ({
    id: `tournament-${match.id}`,
    matchType: 'tournament_1v1' as const,
    tournamentId: match.tournamentId,
    tournamentName: match.tournament.name,
    tournamentRound: match.round,
    currentRound: match.tournament.currentRound,
    maxRounds: match.tournament.maxRounds,
    robot1Id: match.participant1Id,
    robot2Id: match.participant2Id,
    isByeMatch: match.isByeMatch,
    leagueType: 'tournament' as const,
    scheduledFor: getNextCronOccurrence(getConfig().tournamentSchedule).toISOString(),
    status: match.status,
    robot1: match.resolvedRobot1 ? formatRobotSummary(match.resolvedRobot1 as RobotWithUser) : null,
    robot2: match.resolvedRobot2 ? formatRobotSummary(match.resolvedRobot2 as RobotWithUser) : null,
  }));
}

function formatByeMatches(matches: ScheduledTournamentByeMatchWithRobots[]) {
  return matches.map(match => ({
    id: `tournament-bye-${match.id}`,
    matchType: 'tournament_1v1' as const,
    tournamentId: match.tournamentId,
    tournamentName: match.tournament.name,
    tournamentRound: match.round,
    currentRound: match.tournament.currentRound,
    maxRounds: match.tournament.maxRounds,
    robot1Id: match.participant1Id,
    robot2Id: null,
    isByeMatch: true,
    leagueType: 'tournament' as const,
    scheduledFor: getNextCronOccurrence(getConfig().tournamentSchedule).toISOString(),
    status: 'bye' as const,
    robot1: null, // Participant details resolved separately
    robot2: null,
  }));
}

function formatTeamTournamentMatches(matches: Awaited<ReturnType<typeof fetchScheduledTeamTournamentMatches>>) {
  return matches.map(match => {
    const participantType = match.tournament.participantType as 'team_2v2' | 'team_3v3';
    const matchType = participantType === 'team_2v2' ? 'tournament_2v2' as const : 'tournament_3v3' as const;
    const teamSize = participantType === 'team_2v2' ? 2 : 3;
    const schedule = participantType === 'team_2v2'
      ? getConfig().team2v2TournamentSchedule
      : getConfig().team3v3TournamentSchedule;

    const formatTeam = (team: NonNullable<typeof match.resolvedTeam1>) => ({
      id: team.id,
      teamName: team.teamName,
      teamSize: team.teamSize,
      teamLp: team.teamLp,
      teamLeague: team.teamLeague,
      members: team.members.map(m => ({
        robotId: m.robot.id,
        robotName: m.robot.name,
        robotElo: m.robot.elo,
        userId: m.robot.userId,
        user: { username: m.robot.user.username },
      })),
      combinedELO: team.members.reduce((sum, m) => sum + m.robot.elo, 0),
    });

    return {
      id: `team-tournament-${match.id}`,
      matchType,
      teamSize,
      tournamentId: match.tournamentId,
      tournamentName: match.tournament.name,
      tournamentRound: match.round,
      currentRound: match.tournament.currentRound,
      maxRounds: match.tournament.maxRounds,
      team1Id: match.participant1Id,
      team2Id: match.participant2Id,
      isByeMatch: match.isByeMatch,
      leagueType: 'tournament' as const,
      scheduledFor: getNextCronOccurrence(schedule).toISOString(),
      status: match.status,
      teamBattleTeam1: match.resolvedTeam1 ? formatTeam(match.resolvedTeam1) : undefined,
      teamBattleTeam2: match.resolvedTeam2 ? formatTeam(match.resolvedTeam2) : null,
    };
  });
}

function formatTagTeamMatches(matches: ScheduledTagTeamMatchWithTeams[]) {
  return matches
    .filter(match => match.team2 !== null)
    .map(match => {
      const formatTeam = (team: any) => {
        const members = team.members?.sort((a: any, b: any) => a.slotIndex - b.slotIndex) || [];
        const activeRobot = members[0]?.robot;
        const reserveRobot = members[1]?.robot;
        return {
          id: team.id,
          stableName: team.stable?.stableName || null,
          activeRobot: activeRobot ? {
            id: activeRobot.id,
            name: activeRobot.name,
            elo: activeRobot.elo,
            currentHP: activeRobot.currentHP,
            maxHP: activeRobot.maxHP,
            userId: activeRobot.userId,
            user: { username: activeRobot.user?.username },
          } : null,
          reserveRobot: reserveRobot ? {
            id: reserveRobot.id,
            name: reserveRobot.name,
            elo: reserveRobot.elo,
            currentHP: reserveRobot.currentHP,
            maxHP: reserveRobot.maxHP,
            userId: reserveRobot.userId,
            user: { username: reserveRobot.user?.username },
          } : null,
          combinedELO: (activeRobot?.elo || 0) + (reserveRobot?.elo || 0),
        };
      };

      return {
        id: `tag-team-${match.id}`,
        matchType: 'tag_team' as const,
        team1Id: match.team1Id,
        team2Id: match.team2Id,
        tagTeamLeague: match.team1?.tagTeamLeague || 'bronze',
        scheduledFor: match.scheduledFor,
        status: match.status,
        team1: formatTeam(match.team1),
        team2: formatTeam(match.team2!),
      };
    });
}

function formatKothMatches(matches: ScheduledKothMatchWithParticipants[]) {
  return matches.map(match => ({
    id: `koth-${match.id}`,
    matchType: 'koth' as const,
    scheduledFor: match.scheduledFor,
    status: match.status,
    kothRotatingZone: match.rotatingZone,
    kothParticipantCount: match.participants.length,
    kothParticipants: match.participants.map((p) => ({
      id: p.robot.id,
      name: p.robot.name,
      elo: 0,
      userId: p.robot.userId,
      user: { username: p.robot.user.username },
    })),
  }));
}

function formatTeamBattleMatches(matches: ScheduledTeamBattleMatchWithTeams[]) {
  return matches.map(match => {
    const formatTeamBattle = (team: TeamBattleWithMembers) => ({
      id: team.id,
      teamName: team.teamName,
      teamSize: team.teamSize,
      teamLp: team.teamLp,
      teamLeague: team.teamLeague,
      members: team.members.map(m => ({
        robotId: m.robot.id,
        robotName: m.robot.name,
        robotElo: m.robot.elo,
        userId: m.robot.userId,
        user: { username: m.robot.user.username },
      })),
      combinedELO: team.members.reduce((sum, m) => sum + m.robot.elo, 0),
    });

    const matchType = match.matchMode === 'tag_team'
      ? 'tag_team' as const
      : match.teamSize === 2
        ? 'league_2v2' as const
        : 'league_3v3' as const;

    return {
      id: `team-battle-${match.id}`,
      matchType,
      teamSize: match.teamSize,
      team1Id: match.team1Id,
      team2Id: match.team2Id,
      teamBattleLeague: match.teamBattleLeague,
      scheduledFor: match.scheduledFor,
      status: match.status,
      isByeMatch: match.team2Id === null,
      teamBattleTeam1: formatTeamBattle(match.team1),
      teamBattleTeam2: match.team2 ? formatTeamBattle(match.team2) : null,
    };
  });
}

// ─── Match History ───────────────────────────────────────────────────

export interface HistoryParams {
  page: number;
  perPage: number;
  robotId?: number;
  battleType?: string;
  userId: number;
}

/**
 * Fetch paginated battle history with optional robot/type filters.
 * Returns the exact response shape expected by the frontend.
 */
export async function getMatchHistory(params: HistoryParams) {
  const { page, perPage, robotId, battleType, userId } = params;

  const userRobots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true },
  });
  const userRobotIds = userRobots.map(r => r.id);
  const targetRobotIds = robotId !== undefined ? [robotId] : userRobotIds;

  const whereClause: Prisma.BattleWhereInput = {};

  if (battleType === 'league') {
    whereClause.battleType = 'league_1v1';
  } else if (battleType === 'tournament') {
    whereClause.battleType = 'tournament_1v1';
  } else if (battleType === 'tournament_2v2') {
    whereClause.battleType = 'tournament_2v2';
  } else if (battleType === 'tournament_3v3') {
    whereClause.battleType = 'tournament_3v3';
  } else if (battleType === 'tag_team') {
    whereClause.battleType = 'tag_team';
  } else if (battleType === 'koth') {
    whereClause.battleType = 'koth';
  } else if (battleType === 'league_2v2') {
    whereClause.battleType = 'league_2v2';
  } else if (battleType === 'league_3v3') {
    whereClause.battleType = 'league_3v3';
  }

  // Always use BattleParticipant to find the user's battles — works for all modes
  whereClause.participants = { some: { robotId: { in: targetRobotIds } } };

  const [total, battles] = await Promise.all([
    prisma.battle.count({ where: whereClause }),
    prisma.battle.findMany({
      where: whereClause,
      include: {
        robot1: { include: { user: { select: { id: true, username: true, stableName: true } } } },
        robot2: { include: { user: { select: { id: true, username: true, stableName: true } } } },
        tournament: { select: { id: true, name: true, maxRounds: true } },
        participants: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  const formattedBattles = await Promise.all(
    battles.map(battle => formatBattleHistoryEntry(battle, targetRobotIds)),
  );

  return {
    data: formattedBattles,
    pagination: {
      page,
      pageSize: perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
}

export async function formatBattleHistoryEntry(battle: BattleWithFullRelations, targetRobotIds: number[]) {
  const robot1Participant = battle.participants.find((p) => p.robotId === battle.robot1Id);
  const robot2Participant = battle.participants.find((p) => p.robotId === battle.robot2Id);

  // Find the requesting user's participant for economic fields
  const userParticipant = battle.participants.find((p) => targetRobotIds.includes(p.robotId));

  const baseData = {
    id: battle.id,
    robot1Id: battle.robot1Id,
    robot2Id: battle.robot2Id,
    winnerId: battle.winnerId,
    createdAt: battle.createdAt,
    durationSeconds: battle.durationSeconds,
    robot1ELOBefore: robot1Participant?.eloBefore || 0,
    robot1ELOAfter: robot1Participant?.eloAfter || 0,
    robot2ELOBefore: robot2Participant?.eloBefore || 0,
    robot2ELOAfter: robot2Participant?.eloAfter || 0,
    robot1FinalHP: robot1Participant?.finalHP || 0,
    robot2FinalHP: robot2Participant?.finalHP || 0,
    winnerReward: battle.winnerReward,
    loserReward: battle.loserReward,
    battleType: battle.battleType,
    leagueType: battle.leagueType,
    tournamentId: battle.tournamentId,
    tournamentRound: battle.tournamentRound,
    tournamentName: battle.tournament?.name,
    tournamentMaxRounds: battle.tournament?.maxRounds,
    prestigeAwarded: userParticipant?.prestigeAwarded ?? 0,
    fameAwarded: userParticipant?.fameAwarded ?? 0,
    streamingRevenue: userParticipant?.streamingRevenue ?? 0,
    robot1: {
      id: battle.robot1.id,
      name: battle.robot1.name,
      userId: battle.robot1.userId,
      currentLeague: battle.robot1.currentLeague,
      leagueId: battle.robot1.leagueId,
      user: { username: battle.robot1.user.stableName || battle.robot1.user.username },
    },
    robot2: {
      id: battle.robot2.id,
      name: battle.robot2.name,
      userId: battle.robot2.userId,
      currentLeague: battle.robot2.currentLeague,
      leagueId: battle.robot2.leagueId,
      user: { username: battle.robot2.user.stableName || battle.robot2.user.username },
    },
  };

  if (battle.battleType === 'koth') {
    return formatKothHistoryEntry(battle, baseData, targetRobotIds);
  }

  if (battle.battleType === 'tag_team') {
    return formatTeamBattleHistoryEntry(battle, baseData);
  }

  if (battle.battleType === 'league_2v2' || battle.battleType === 'league_3v3' || battle.battleType === 'tournament_2v2' || battle.battleType === 'tournament_3v3') {
    return formatTeamBattleHistoryEntry(battle, baseData);
  }

  return baseData;
}

async function formatKothHistoryEntry(battle: BattleWithFullRelations, baseData: Record<string, unknown>, targetRobotIds: number[]) {
  const userParticipant = battle.participants.find((p) => targetRobotIds.includes(p.robotId));
  const battleLogData =
    battle.battleLog !== null && typeof battle.battleLog === 'object'
      ? battle.battleLog as Record<string, unknown>
      : {};
  const logPlacements = ((battleLogData as Record<string, unknown>).placements || []) as Array<Pick<KothPlacement, 'robotId' | 'zoneScore'>>;
  const userLogEntry = userParticipant ? logPlacements.find((lp) => lp.robotId === userParticipant.robotId) : null;

  const kothMatch = await prisma.scheduledKothMatch.findFirst({
    where: { battleId: battle.id },
    select: { rotatingZone: true },
  });

  const kothData: Record<string, unknown> = {
    ...baseData,
    winnerReward: userParticipant?.credits ?? 0,
    loserReward: userParticipant?.credits ?? 0,
    kothPlacement: userParticipant?.placement ?? null,
    kothParticipantCount: battle.participants.length,
    kothZoneScore: userLogEntry?.zoneScore ?? null,
    kothRotatingZone: kothMatch?.rotatingZone ?? false,
  };

  if (userParticipant && userParticipant.robotId !== battle.robot1Id && userParticipant.robotId !== battle.robot2Id) {
    const userRobot = await prisma.robot.findUnique({
      where: { id: userParticipant.robotId },
      include: { user: { select: { id: true, username: true, stableName: true } } },
    });
    if (userRobot) {
      kothData.robot1Id = userRobot.id;
      kothData.robot1 = {
        id: userRobot.id,
        name: userRobot.name,
        userId: userRobot.userId,
        currentLeague: userRobot.currentLeague,
        leagueId: userRobot.leagueId,
        user: { username: userRobot.user.stableName || userRobot.user.username },
      };
    }
  }

  return kothData;
}

/**
 * Format a team battle (2v2/3v3/tag_team) history entry with team names and LP delta.
 * Looks up the ScheduledTeamBattleMatch to resolve team names and computes
 * LP delta from the battle outcome.
 *
 * Requirements: R9.7 (match notification data: team_size, outcome, opponent team name, Team_LP delta)
 */
async function formatTeamBattleHistoryEntry(battle: BattleWithFullRelations, baseData: Record<string, unknown>) {
  const isTournamentBattle = battle.battleType === 'tournament_2v2' || battle.battleType === 'tournament_3v3';
  const isTagTeam = battle.battleType === 'tag_team';
  const teamSize = (battle.battleType === 'league_2v2' || battle.battleType === 'tournament_2v2' || battle.battleType === 'tag_team') ? 2 : 3;

  let team1Name: string | null = null;
  let team2Name: string | null = null;
  let team1Id: number | null = null;
  let team2Id: number | null = null;
  let isByeMatch: boolean;
  let team1LpDelta = 0;
  let team2LpDelta = 0;

  if (isTournamentBattle) {
    // Tournament battles: look up the ScheduledTournamentMatch and resolve team names
    const tournamentMatch = await prisma.scheduledTournamentMatch.findFirst({
      where: {
        battleId: battle.id,
      },
    });

    if (tournamentMatch?.participant1Id) {
      const team1 = await prisma.teamBattle.findUnique({
        where: { id: tournamentMatch.participant1Id },
        select: { id: true, teamName: true },
      });
      team1Id = team1?.id ?? null;
      team1Name = team1?.teamName ?? null;
    }
    if (tournamentMatch?.participant2Id) {
      const team2 = await prisma.teamBattle.findUnique({
        where: { id: tournamentMatch.participant2Id },
        select: { id: true, teamName: true },
      });
      team2Id = team2?.id ?? null;
      team2Name = team2?.teamName ?? null;
    }
    isByeMatch = tournamentMatch?.isByeMatch ?? false;
    // No LP delta for tournament battles
  } else {
    // League battles: look up the ScheduledTeamBattleMatch
    const teamBattleMatch = await prisma.scheduledTeamBattleMatch.findFirst({
      where: {
        status: 'completed',
        teamSize,
        team1: { members: { some: { robotId: battle.robot1Id } } },
      },
      include: {
        team1: { select: { id: true, teamName: true, stableId: true } },
        team2: { select: { id: true, teamName: true, stableId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    team1Id = teamBattleMatch?.team1?.id ?? null;
    team2Id = teamBattleMatch?.team2?.id ?? null;
    team1Name = teamBattleMatch?.team1?.teamName ?? null;
    team2Name = teamBattleMatch?.team2?.teamName ?? null;
    isByeMatch = teamBattleMatch?.team2Id === null;

    // Calculate LP delta for league battles
    if (battle.winnerId !== null && teamBattleMatch) {
      const team1Won = battle.winnerId === teamBattleMatch.team1Id;
      team1LpDelta = team1Won ? 3 : -1;
      team2LpDelta = team1Won ? -1 : 3;
    } else if (battle.winnerId === null) {
      team1LpDelta = 1;
      team2LpDelta = 1;
    }
  }

  return {
    ...baseData,
    team1Id,
    team2Id,
    team1TeamName: team1Name,
    team2TeamName: isByeMatch ? 'Bye' : (team2Name ?? 'Unknown'),
    teamSize,
    isByeMatch,
    team1LpDelta,
    team2LpDelta,
  };
}

// ─── Battle Log ──────────────────────────────────────────────────────

/**
 * Fetch and format a detailed battle log for a specific battle.
 * Returns the full response shape expected by the frontend.
 */
export async function getBattleLog(battleId: number) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      robot1: {
        include: {
          user: { select: { id: true, username: true, stableName: true } },
          mainWeapon: { include: { weapon: { select: { name: true, rangeBand: true } } } },
          offhandWeapon: { include: { weapon: { select: { name: true, rangeBand: true } } } },
        },
      },
      robot2: {
        include: {
          user: { select: { id: true, username: true, stableName: true } },
          mainWeapon: { include: { weapon: { select: { name: true, rangeBand: true } } } },
          offhandWeapon: { include: { weapon: { select: { name: true, rangeBand: true } } } },
        },
      },
    },
  });

  if (!battle) return null;

  const battleData = {
    ...battle,
    team1TagOutTime: battle.team1TagOutTime ? Number(battle.team1TagOutTime) / 1000 : null,
    team2TagOutTime: battle.team2TagOutTime ? Number(battle.team2TagOutTime) / 1000 : null,
  };

  const battleParticipants = await prisma.battleParticipant.findMany({
    where: { battleId },
    include: {
      robot: {
        include: {
          user: { select: { id: true, username: true, stableName: true } },
          mainWeapon: { include: { weapon: { select: { name: true, rangeBand: true } } } },
          offhandWeapon: { include: { weapon: { select: { name: true, rangeBand: true } } } },
        },
      },
    },
  });

  const participantMap = new Map(battleParticipants.map(p => [p.robotId, p]));
  const robot1Participant = participantMap.get(battle.robot1Id);
  const robot2Participant = participantMap.get(battle.robot2Id);

  const streamingRevenue1 = robot1Participant?.streamingRevenue || 0;
  const streamingRevenue2 = robot2Participant?.streamingRevenue || 0;

  const baseResponse: Record<string, unknown> = {
    battleId: battleData.id,
    createdAt: battleData.createdAt,
    battleType: battleData.battleType,
    leagueType: battleData.leagueType,
    leagueInstanceId: battleData.leagueInstanceId ?? null,
    tournamentId: battleData.tournamentId ?? null,
    duration: battleData.durationSeconds,
    battleLog:
      typeof battleData.battleLog === 'object' && battleData.battleLog !== null
        ? JSON.parse(
            JSON.stringify(battleData.battleLog, (_key, value) =>
              typeof value === 'bigint' ? Number(value) : value,
            ),
          )
        : battleData.battleLog,
  };

  // Build unified participants array from BattleParticipant records
  // This is the single source of truth — same shape for all battle types
  baseResponse.participants = battleParticipants.map(p => ({
    robotId: p.robotId,
    robotName: p.robot.name,
    owner: p.robot.user.stableName || p.robot.user.username,
    ownerId: p.robot.user.id,
    imageUrl: p.robot.imageUrl ?? null,
    teamIndex: p.team - 1, // DB uses 1-based, frontend uses 0-based
    team: p.team,
    role: p.role,
    placement: p.placement,
    // Combat outcome
    finalHP: p.finalHP,
    maxHP: p.robot.maxHP,
    maxShield: p.robot.maxShield,
    destroyed: p.destroyed,
    yielded: p.yielded,
    damageDealt: p.damageDealt,
    // Economy
    eloBefore: p.eloBefore,
    eloAfter: p.eloAfter,
    credits: p.credits,
    streamingRevenue: p.streamingRevenue,
    prestigeAwarded: p.prestigeAwarded,
    fameAwarded: p.fameAwarded,
    // Loadout
    stance: p.robot.stance,
    loadoutType: p.robot.loadoutType,
    mainWeaponName: p.robot.mainWeapon?.weapon?.name ?? null,
    mainWeaponRangeBand: p.robot.mainWeapon?.weapon?.rangeBand ?? null,
    offhandWeaponName: p.robot.offhandWeapon?.weapon?.name ?? null,
    offhandWeaponRangeBand: p.robot.offhandWeapon?.weapon?.rangeBand ?? null,
  }));

  if (battleData.battleType === 'tag_team' && battleData.team1ActiveRobotId && battleData.team2ActiveRobotId) {
    await buildTagTeamLogResponse(baseResponse, battleData, battleParticipants);
  } else if (battleData.battleType === 'koth') {
    await buildKothLogResponse(baseResponse, battleData, battleId, battleParticipants);
  } else {
    buildStandardLogResponse(baseResponse, battleData, robot1Participant, robot2Participant, streamingRevenue1, streamingRevenue2);
  }

  // Determine winner
  if (battleData.battleType === 'koth') {
    if (baseResponse.winner === undefined) {
      baseResponse.winner = battleData.winnerId === battleData.robot1Id ? 'robot1' : null;
    }
  } else if (battleData.battleType === 'tag_team' && baseResponse.tagTeam) {
    const tagTeam = baseResponse.tagTeam as { team1: { teamId: number | null }; team2: { teamId: number | null } };
    const team1Id = tagTeam.team1.teamId;
    const team2Id = tagTeam.team2.teamId;
    baseResponse.winner = battleData.winnerId === team1Id ? 'robot1' : battleData.winnerId === team2Id ? 'robot2' : null;
  } else if (battleData.battleType === 'league_2v2' || battleData.battleType === 'league_3v3' || battleData.battleType === 'tournament_2v2' || battleData.battleType === 'tournament_3v3') {
    // For team battles, winnerId stores the winning team ID (not a robot ID).
    // Use the battleLog.winningSide field to determine winner: side 1 = 'robot1', side 2 = 'robot2'.
    const teamBattleLog = battleData.battleLog as unknown as { winningSide?: 1 | 2 | null };
    if (teamBattleLog?.winningSide === 1) {
      baseResponse.winner = 'robot1';
    } else if (teamBattleLog?.winningSide === 2) {
      baseResponse.winner = 'robot2';
    } else {
      baseResponse.winner = null;
    }
  } else {
    baseResponse.winner = battleData.winnerId === battleData.robot1Id ? 'robot1' : battleData.winnerId === battleData.robot2Id ? 'robot2' : null;
  }

  return baseResponse;
}

async function buildTagTeamLogResponse(baseResponse: Record<string, unknown>, battleData: BattleDataForLog, battleParticipants: BattleParticipant[]) {
  const tagTeamUserSelect = { select: { id: true, username: true, stableName: true } };
  const [team1Active, team1Reserve, team2Active, team2Reserve] = await Promise.all([
    battleData.team1ActiveRobotId
      ? prisma.robot.findUnique({ where: { id: battleData.team1ActiveRobotId }, include: { user: tagTeamUserSelect } })
      : null,
    battleData.team1ReserveRobotId
      ? prisma.robot.findUnique({ where: { id: battleData.team1ReserveRobotId }, include: { user: tagTeamUserSelect } })
      : null,
    battleData.team2ActiveRobotId
      ? prisma.robot.findUnique({ where: { id: battleData.team2ActiveRobotId }, include: { user: tagTeamUserSelect } })
      : null,
    battleData.team2ReserveRobotId
      ? prisma.robot.findUnique({ where: { id: battleData.team2ReserveRobotId }, include: { user: tagTeamUserSelect } })
      : null,
  ]);

  const tagTeamMatch = await prisma.scheduledTeamBattleMatch.findFirst({
    where: { battleId: battleData.id, matchMode: 'tag_team' },
    select: { team1Id: true, team2Id: true },
  });

  const [team1Details, team2Details] = await Promise.all([
    tagTeamMatch?.team1Id
      ? prisma.teamBattle.findUnique({ where: { id: tagTeamMatch.team1Id }, include: { stable: { select: { stableName: true } } } })
      : null,
    tagTeamMatch?.team2Id
      ? prisma.teamBattle.findUnique({ where: { id: tagTeamMatch.team2Id }, include: { stable: { select: { stableName: true } } } })
      : null,
  ]);

  const formatTagRobot = (robot: TagTeamRobot, damageDealt: number, fameAwarded: number) =>
    robot
      ? {
          id: robot.id,
          name: robot.name,
          owner: robot.user.stableName || robot.user.username,
          maxHP: robot.maxHP,
          maxShield: robot.maxShield,
          damageDealt,
          fameAwarded,
          imageUrl: robot.imageUrl ?? null,
        }
      : null;

  baseResponse.tagTeam = {
    team1: {
      teamId: tagTeamMatch?.team1Id || null,
      stableName: team1Details?.stable?.stableName || null,
      activeRobot: formatTagRobot(team1Active, battleData.team1ActiveDamageDealt, battleData.team1ActiveFameAwarded),
      reserveRobot: formatTagRobot(team1Reserve, battleData.team1ReserveDamageDealt, battleData.team1ReserveFameAwarded),
      tagOutTime: battleData.team1TagOutTime,
    },
    team2: {
      teamId: tagTeamMatch?.team2Id || null,
      stableName: team2Details?.stable?.stableName || null,
      activeRobot: formatTagRobot(team2Active, battleData.team2ActiveDamageDealt, battleData.team2ActiveFameAwarded),
      reserveRobot: formatTagRobot(team2Reserve, battleData.team2ReserveDamageDealt, battleData.team2ReserveFameAwarded),
      tagOutTime: battleData.team2TagOutTime,
    },
  };

  // Team-level summaries from BattleParticipant
  const team1Participants = battleParticipants.filter(p => p.team === 1);
  const team2Participants = battleParticipants.filter(p => p.team === 2);

  const sumField = (arr: BattleParticipant[], field: keyof BattleParticipant) => arr.reduce((sum, p) => sum + (Number(p[field]) || 0), 0);

  baseResponse.team1Summary = {
    reward: sumField(team1Participants, 'credits'),
    prestige: sumField(team1Participants, 'prestigeAwarded'),
    totalDamage: sumField(team1Participants, 'damageDealt'),
    totalFame: sumField(team1Participants, 'fameAwarded'),
    streamingRevenue: sumField(team1Participants, 'streamingRevenue'),
  };

  baseResponse.team2Summary = {
    reward: sumField(team2Participants, 'credits'),
    prestige: sumField(team2Participants, 'prestigeAwarded'),
    totalDamage: sumField(team2Participants, 'damageDealt'),
    totalFame: sumField(team2Participants, 'fameAwarded'),
    streamingRevenue: sumField(team2Participants, 'streamingRevenue'),
  };
}

async function buildKothLogResponse(baseResponse: Record<string, unknown>, battleData: BattleDataForLog, battleId: number, _battleParticipants: BattleParticipant[]) {
  const allParticipants = await prisma.battleParticipant.findMany({
    where: { battleId },
    include: {
      robot: {
        include: { user: { select: { id: true, username: true, stableName: true } } },
      },
    },
    orderBy: { placement: 'asc' },
  });

  const battleLogData = typeof battleData.battleLog === 'object' ? battleData.battleLog as Record<string, unknown> : {};
  const logPlacements = (battleLogData.placements || []) as Array<{ robotId: number; zoneScore: number; zoneTime: number; kills: number; destroyed: boolean }>;

  baseResponse.kothParticipants = allParticipants.map(p => {
    const logEntry = logPlacements.find(lp => lp.robotId === p.robotId);
    return {
      robotId: p.robot.id,
      robotName: p.robot.name,
      owner: p.robot.user.stableName || p.robot.user.username,
      ownerId: p.robot.user.id,
      placement: p.placement ?? p.team,
      zoneScore: logEntry?.zoneScore ?? 0,
      zoneTime: logEntry?.zoneTime ?? 0,
      kills: logEntry?.kills ?? 0,
      damageDealt: p.damageDealt,
      finalHP: p.finalHP,
      destroyed: p.destroyed,
      credits: p.credits,
      fame: p.fameAwarded,
      prestige: p.prestigeAwarded,
      streamingRevenue: p.streamingRevenue || 0,
      imageUrl: p.robot.imageUrl ?? null,
    };
  });

  baseResponse.winner = battleData.winnerId === battleData.robot1Id ? 'robot1' : null;

  if (battleLogData.kothData) {
    baseResponse.kothData = battleLogData.kothData;
  }
}

function buildStandardLogResponse(baseResponse: Record<string, unknown>, battleData: BattleDataForLog, robot1Participant: BattleParticipant | undefined, robot2Participant: BattleParticipant | undefined, streamingRevenue1: number, streamingRevenue2: number) {
  baseResponse.robot1 = {
    id: battleData.robot1.id,
    name: battleData.robot1.name,
    owner: battleData.robot1.user.stableName || battleData.robot1.user.username,
    ownerId: battleData.robot1.user.id,
    maxHP: battleData.robot1.maxHP,
    maxShield: battleData.robot1.maxShield,
    eloBefore: robot1Participant?.eloBefore || 0,
    eloAfter: robot1Participant?.eloAfter || 0,
    finalHP: robot1Participant?.finalHP ?? 0,
    damageDealt: robot1Participant?.damageDealt ?? 0,
    reward: robot1Participant?.credits ?? 0,
    prestige: robot1Participant?.prestigeAwarded ?? 0,
    fame: robot1Participant?.fameAwarded ?? 0,
    streamingRevenue: streamingRevenue1,
    yielded: robot1Participant?.yielded ?? false,
    destroyed: robot1Participant?.destroyed ?? false,
    imageUrl: battleData.robot1.imageUrl ?? null,
    loadoutType: battleData.robot1.loadoutType,
    rangeBand: battleData.robot1.mainWeapon?.weapon?.rangeBand ?? null,
    stance: battleData.robot1.stance,
    mainWeaponName: battleData.robot1.mainWeapon?.weapon?.name ?? null,
    offhandWeaponName: battleData.robot1.offhandWeapon?.weapon?.name ?? null,
    offhandRangeBand: battleData.robot1.offhandWeapon?.weapon?.rangeBand ?? null,
  };

  baseResponse.robot2 = {
    id: battleData.robot2.id,
    name: battleData.robot2.name,
    owner: battleData.robot2.user.stableName || battleData.robot2.user.username,
    ownerId: battleData.robot2.user.id,
    maxHP: battleData.robot2.maxHP,
    maxShield: battleData.robot2.maxShield,
    eloBefore: robot2Participant?.eloBefore || 0,
    eloAfter: robot2Participant?.eloAfter || 0,
    finalHP: robot2Participant?.finalHP ?? 0,
    damageDealt: robot2Participant?.damageDealt ?? 0,
    reward: robot2Participant?.credits ?? 0,
    prestige: robot2Participant?.prestigeAwarded ?? 0,
    fame: robot2Participant?.fameAwarded ?? 0,
    streamingRevenue: streamingRevenue2,
    yielded: robot2Participant?.yielded ?? false,
    destroyed: robot2Participant?.destroyed ?? false,
    imageUrl: battleData.robot2.imageUrl ?? null,
    loadoutType: battleData.robot2.loadoutType,
    rangeBand: battleData.robot2.mainWeapon?.weapon?.rangeBand ?? null,
    stance: battleData.robot2.stance,
    mainWeaponName: battleData.robot2.mainWeapon?.weapon?.name ?? null,
    offhandWeaponName: battleData.robot2.offhandWeapon?.weapon?.name ?? null,
    offhandRangeBand: battleData.robot2.offhandWeapon?.weapon?.rangeBand ?? null,
  };
}
