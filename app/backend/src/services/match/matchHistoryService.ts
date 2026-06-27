import prisma from '../../lib/prisma';
import { Prisma, BattleParticipant } from '../../../generated/prisma';
import { getConfig } from '../../config/env';
import { getNextCronOccurrence } from '../../utils/scheduleUtils';
import type { KothPlacement } from '../../types/battleLogTypes';

// ─── Prisma Payload Types ────────────────────────────────────────────

const robotUserSelect = { select: { id: true, username: true } } as const;
const robotInclude = { include: { user: robotUserSelect } } as const;

type RobotWithUser = Prisma.RobotGetPayload<{ include: { user: { select: { id: true; username: true } } } }>;

type ScheduledLeagueMatchWithRobots = {
  id: number;
  robot1Id: number;
  robot2Id: number;
  leagueType: string;
  scheduledFor: Date;
  status: string;
  battleId: number | null;
  createdAt: Date;
  robot1: RobotWithUser;
  robot2: RobotWithUser;
};

type _ScheduledTournamentMatchWithRobots = Prisma.ScheduledTournamentMatchGetPayload<{
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
type _TagTeamWithMembers = {
  id: number;
  stableId: number;
  teamName: string;
  members: Array<{ slotIndex: number; robot: { id: number; name: string; user: { id: number; username: string } } }>;
  stable?: { stableName: string | null };
};

// Legacy type replaced — tag team scheduled matches now use unified scheduling
type ScheduledTagTeamMatchWithTeams = {
  id: number;
  team1Id: number;
  team2Id: number | null;
  teamSize: number;
  matchMode: string;
  teamBattleLeague: string;
  teamBattleLeagueId: string;
  scheduledFor: Date;
  status: string;
  createdAt: Date;
  team1: {
    id: number;
    stableId: number;
    teamName: string;
    members: Array<{ slotIndex: number; robot: { id: number; name: string; user: { id: number; username: string } } }>;
    stable: { stableName: string | null };
  };
  team2: {
    id: number;
    stableId: number;
    teamName: string;
    members: Array<{ slotIndex: number; robot: { id: number; name: string; user: { id: number; username: string } } }>;
    stable: { stableName: string | null };
  } | null;
};

type ScheduledKothMatchWithParticipants = {
  id: number;
  scheduledFor: Date;
  status: string;
  battleId: number | null;
  createdAt: Date;
  participants: Array<{ robotId: number; robot: { id: number; name: string; userId: number; user: { id: number; username: string } } }>;
};

type TeamBattleWithMembers = Prisma.TeamBattleGetPayload<{
  include: {
    members: {
      include: { robot: { include: { user: { select: { id: true; username: true } } } } };
    };
  };
}>;

type ScheduledTeamBattleMatchWithTeams = {
  id: number;
  team1Id: number;
  team2Id: number | null;
  teamSize: number;
  matchMode: string;
  teamBattleLeague: string;
  teamBattleLeagueId: string;
  scheduledFor: Date;
  status: string;
  createdAt: Date;
  team1: TeamBattleWithMembers;
  team2: TeamBattleWithMembers | null;
};

type BattleWithFullRelations = Prisma.BattleGetPayload<{
  include: {
    participants: {
      include: { robot: { include: { user: { select: { id: true; username: true; stableName: true } } } } };
    };
    tournament: { select: { id: true; name: true; maxRounds: true } };
  };
}>;

type _BattleWithRobotsAndUsers = Prisma.BattleGetPayload<{
  include: {
    participants: {
      include: { robot: { include: { user: { select: { id: true; username: true; stableName: true } } } } };
    };
  };
}>;

type BattleWithRobotsAndWeapons = Prisma.BattleGetPayload<{
  include: {
    participants: {
      include: { robot: { include: { user: { select: { id: true; username: true; stableName: true } }; mainWeapon: { include: { weapon: { select: { name: true; rangeBand: true } } } }; offhandWeapon: { include: { weapon: { select: { name: true; rangeBand: true } } } } } } };
    };
  };
}>;

/** battleData in getBattleLog — full battle with robot includes */
type BattleDataForLog = BattleWithRobotsAndWeapons;

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
  // Fetch from unified scheduling table for league, tag_team, koth, team battles (Spec #40)
  const unifiedMatches = (robotIds.length > 0 || teamBattleIds.length > 0) ? await prisma.scheduledMatch.findMany({
    where: {
      status: 'scheduled',
      participants: {
        some: {
          OR: [
            ...(robotIds.length > 0 ? [{ participantType: 'robot', participantId: { in: robotIds } }] : []),
            ...(teamBattleIds.length > 0 ? [{ participantType: 'team', participantId: { in: teamBattleIds } }] : []),
          ],
        },
      },
    },
    include: { participants: true },
    orderBy: { scheduledFor: 'asc' },
  }) : [];

  // Tournaments still use their own table
  const [tournamentMatches, activeTournaments, teamTournamentMatches] =
    await Promise.all([
      fetchScheduledTournamentMatches(robotIds),
      prisma.tournament.findMany({
        where: { status: 'active' },
        select: { id: true, currentRound: true },
      }),
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

  // Format unified matches — resolve robot/team names
  const formattedUnified = await formatUnifiedMatches(unifiedMatches, robotIds, teamBattleIds);

  const formattedTournament = formatTournamentMatches(tournamentMatches);
  const formattedBye = formatByeMatches(tournamentByeMatches);
  const formattedTeamTournament = await formatTeamTournamentMatches(teamTournamentMatches);

  const allMatches = [
    ...formattedUnified,
    ...formattedTournament,
    ...formattedBye,
    ...formattedTeamTournament,
  ].sort((a, b) => {
    const timeA = 'scheduledFor' in a ? (a as any).scheduledFor : '';
    const timeB = 'scheduledFor' in b ? (b as any).scheduledFor : '';
    return new Date(timeA).getTime() - new Date(timeB).getTime();
  });

  const leagueCount = formattedUnified.filter(m => m.matchType === 'league_1v1').length;
  const tagTeamCount = formattedUnified.filter(m => m.matchType === 'tag_team').length;
  const kothCount = formattedUnified.filter(m => m.matchType === 'koth').length;
  const teamBattleCount = formattedUnified.filter(m => m.matchType === 'league_2v2' || m.matchType === 'league_3v3').length;

  return {
    matches: allMatches,
    total: allMatches.length,
    leagueMatches: leagueCount,
    tournamentMatches: formattedTournament.length + formattedBye.length + formattedTeamTournament.length,
    tagTeamMatches: tagTeamCount,
    kothMatches: kothCount,
    teamBattleMatches: teamBattleCount,
  };
}

// ─── Upcoming: Prisma queries ────────────────────────────────────────

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

async function fetchScheduledTagTeamMatches(_teamIds: number[]) {
  // Tag team matches now live in ScheduledTeamBattleMatch with matchMode='tag_team'
  // teamIds is no longer used (legacy TagTeam IDs); tag team matches are found via teamBattleIds
  return [] as ScheduledTagTeamMatchWithTeams[];
}

async function fetchScheduledKothMatches(robotIds: number[]) {
  // Query from unified scheduled_matches_v2 table
  const matches = await prisma.scheduledMatch.findMany({
    where: {
      matchType: 'koth' as any,
      status: 'scheduled',
      participants: { some: { participantType: 'robot', participantId: { in: robotIds } } },
    },
    include: {
      participants: true,
    },
    orderBy: { scheduledFor: 'asc' },
  });

  // Load robot data for all participants
  const allRobotIds = matches.flatMap(m => m.participants.map(p => p.participantId));
  const robots = allRobotIds.length > 0 ? await prisma.robot.findMany({
    where: { id: { in: allRobotIds } },
    include: { user: { select: { id: true, username: true } } },
  }) : [];
  const robotMap = new Map(robots.map(r => [r.id, r]));

  // Map to the shape formatKothMatches expects
  return matches.map(m => ({
    id: m.id,
    scheduledFor: m.scheduledFor,
    status: m.status,
    rotatingZone: false,
    participants: m.participants.map(p => ({
      id: p.id,
      matchId: m.id,
      robotId: p.participantId,
      robot: robotMap.get(p.participantId) ?? null,
    })),
  }));
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

  // Query from unified scheduled_matches_v2 table
  const matches = await prisma.scheduledMatch.findMany({
    where: {
      status: 'scheduled',
      matchType: { in: ['league_2v2', 'league_3v3', 'tag_team'] as any },
      participants: { some: { participantType: 'team', participantId: { in: teamBattleIds } } },
    },
    include: { participants: true },
    orderBy: { scheduledFor: 'asc' },
  });

  // Load team data for all participants
  const allTeamIds = matches.flatMap(m => m.participants.filter(p => p.participantType === 'team').map(p => p.participantId));
  const teams = allTeamIds.length > 0 ? await prisma.teamBattle.findMany({
    where: { id: { in: allTeamIds } },
    ...teamBattleMemberInclude,
  }) : [];
  const teamMap = new Map(teams.map(t => [t.id, t]));

  // Map to shape formatTeamBattleMatches expects
  return matches.map(m => {
    const p1 = m.participants.find(p => p.slot === 1);
    const p2 = m.participants.find(p => p.slot === 2);
    return {
      id: m.id,
      team1Id: p1?.participantId ?? 0,
      team2Id: p2?.participantId ?? null,
      teamSize: m.matchType === 'league_3v3' ? 3 : 2,
      matchMode: m.matchType === 'tag_team' ? 'tag_team' : (m.matchType === 'league_3v3' ? 'league_3v3' : 'league_2v2'),
      teamBattleLeague: m.leagueType ?? 'bronze',
      teamBattleLeagueId: m.leagueInstanceId ?? 'bronze_1',
      scheduledFor: m.scheduledFor,
      status: m.status,
      cancelReason: m.cancelReason,
      createdAt: m.createdAt,
      team1: teamMap.get(p1?.participantId ?? 0) ?? null,
      team2: p2 ? teamMap.get(p2.participantId) ?? null : null,
    };
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

/**
 * Format unified scheduled matches into the response shape the frontend expects.
 * Resolves robot/team data to match the ScheduledMatch interface.
 */
async function formatUnifiedMatches(
  matches: Array<{ id: number; matchType: string; scheduledFor: Date; leagueType: string | null; leagueInstanceId: string | null; isByeMatch: boolean | null; participants: Array<{ participantType: string; participantId: number; slot: number }> }>,
  userRobotIds: number[],
  userTeamBattleIds: number[],
) {
  const formatted = [];

  for (const match of matches) {
    const p1 = match.participants.find(p => p.slot === 1);
    const p2 = match.participants.find(p => p.slot === 2);

    const isRobotMatch = p1?.participantType === 'robot';
    const isKoth = match.matchType === 'koth';

    if (isKoth) {
      // KotH: FFA — resolve participant robots for the card
      const robotIds = match.participants.map(p => p.participantId);
      const robots = await prisma.robot.findMany({
        where: { id: { in: robotIds } },
        select: { id: true, name: true, elo: true, userId: true, user: { select: { username: true } } },
      });

      formatted.push({
        id: match.id,
        matchType: match.matchType,
        scheduledFor: match.scheduledFor.toISOString(),
        leagueType: match.leagueType ?? 'koth',
        status: 'scheduled',
        isByeMatch: false,
        kothParticipantCount: match.participants.length,
        kothParticipants: robots.map(r => ({
          id: r.id,
          name: r.name,
          elo: r.elo,
          userId: r.userId,
          user: { username: (r as any).user?.username ?? 'Unknown' },
        })),
      });
    } else if (isRobotMatch) {
      // 1v1 league: resolve robot1 and robot2
      const robot1 = p1 ? await prisma.robot.findUnique({
        where: { id: p1.participantId },
        select: { id: true, name: true, elo: true, currentHP: true, maxHP: true, userId: true },
        }) : null;
      const robot2 = p2 ? await prisma.robot.findUnique({
        where: { id: p2.participantId },
        select: { id: true, name: true, elo: true, currentHP: true, maxHP: true, userId: true },
      }) : null;

      const robot1User = robot1 ? await prisma.user.findUnique({ where: { id: robot1.userId }, select: { username: true } }) : null;
      const robot2User = robot2 ? await prisma.user.findUnique({ where: { id: robot2.userId }, select: { username: true } }) : null;

      formatted.push({
        id: match.id,
        matchType: match.matchType,
        scheduledFor: match.scheduledFor.toISOString(),
        leagueType: match.leagueType ?? 'bronze',
        status: 'scheduled',
        isByeMatch: match.isByeMatch ?? false,
        robot1Id: robot1?.id,
        robot2Id: robot2?.id,
        robot1: robot1 ? { ...robot1, user: { username: robot1User?.username ?? 'Unknown' } } : null,
        robot2: robot2 ? { ...robot2, user: { username: robot2User?.username ?? 'Unknown' } } : null,
      });
    } else {
      // Team modes (2v2, 3v3, tag_team): resolve team data
      const team1 = p1 ? await prisma.teamBattle.findUnique({
        where: { id: p1.participantId },
        include: { members: { include: { robot: { include: { user: { select: { username: true } } } } }, orderBy: { slotIndex: 'asc' } }, stable: { select: { stableName: true } } },
      }) : null;
      const team2 = p2 ? await prisma.teamBattle.findUnique({
        where: { id: p2.participantId },
        include: { members: { include: { robot: { include: { user: { select: { username: true } } } } }, orderBy: { slotIndex: 'asc' } }, stable: { select: { stableName: true } } },
      }) : null;

      // Resolve LP/league from standings (source of truth)
      const teamIds = [team1?.id, team2?.id].filter((id): id is number => id != null);
      const mode = match.matchType === 'tag_team' ? 'tag_team' : (match.matchType === 'league_3v3' ? 'league_3v3' : 'league_2v2');
      const teamStandings = teamIds.length > 0 ? await prisma.standing.findMany({
        where: { entityType: 'team', entityId: { in: teamIds }, mode: mode as any },
        select: { entityId: true, leaguePoints: true, tier: true },
      }) : [];
      const standingsMap = new Map(teamStandings.map(s => [s.entityId, s]));

      const formatTeamBattle = (team: NonNullable<typeof team1>) => {
        const standing = standingsMap.get(team.id);
        return {
          id: team.id,
          teamName: team.teamName,
          teamSize: team.teamSize,
          teamLp: standing?.leaguePoints ?? 0,
          teamLeague: standing?.tier ?? 'bronze',
          members: team.members.map(m => ({
            robotId: m.robot.id,
            robotName: m.robot.name,
            robotElo: m.robot.elo,
            userId: m.robot.userId,
            user: { username: m.robot.user?.username ?? 'Unknown' },
          })),
          combinedELO: team.members.reduce((sum, m) => sum + m.robot.elo, 0),
        };
      };

      formatted.push({
        id: match.id,
        matchType: match.matchType,
        scheduledFor: match.scheduledFor.toISOString(),
        leagueType: match.leagueType ?? 'bronze',
        teamBattleLeague: match.leagueType ?? 'bronze',
        teamSize: team1?.teamSize ?? (match.matchType === 'league_3v3' ? 3 : 2),
        status: 'scheduled',
        isByeMatch: match.isByeMatch ?? false,
        team1Id: team1?.id,
        team2Id: team2?.id,
        teamBattleTeam1: team1 ? formatTeamBattle(team1) : undefined,
        teamBattleTeam2: team2 ? formatTeamBattle(team2) : null,
      });
    }
  }

  return formatted;
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

async function formatTeamTournamentMatches(matches: Awaited<ReturnType<typeof fetchScheduledTeamTournamentMatches>>) {
  // Batch-fetch standings for all participating teams
  const teamIds = matches.flatMap(m => [m.resolvedTeam1?.id, m.resolvedTeam2?.id].filter((id): id is number => id != null));
  const standings = teamIds.length > 0 ? await prisma.standing.findMany({
    where: { entityType: 'team', entityId: { in: teamIds }, mode: { in: ['league_2v2', 'league_3v3'] as any[] } },
    select: { entityId: true, leaguePoints: true, tier: true },
  }) : [];
  const standingsMap = new Map(standings.map(s => [s.entityId, s]));

  return matches.map(match => {
    const participantType = match.tournament.participantType as 'team_2v2' | 'team_3v3';
    const matchType = participantType === 'team_2v2' ? 'tournament_2v2' as const : 'tournament_3v3' as const;
    const teamSize = participantType === 'team_2v2' ? 2 : 3;
    const schedule = participantType === 'team_2v2'
      ? getConfig().team2v2TournamentSchedule
      : getConfig().team3v3TournamentSchedule;

    const formatTeam = (team: NonNullable<typeof match.resolvedTeam1>) => {
      const standing = standingsMap.get(team.id);
      return {
        id: team.id,
        teamName: team.teamName,
        teamSize: team.teamSize,
        teamLp: standing?.leaguePoints ?? 0,
        teamLeague: standing?.tier ?? 'bronze',
        members: team.members.map(m => ({
          robotId: m.robot.id,
          robotName: m.robot.name,
          robotElo: m.robot.elo,
          userId: m.robot.userId,
          user: { username: m.robot.user.username },
        })),
        combinedELO: team.members.reduce((sum, m) => sum + m.robot.elo, 0),
      };
    };

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
      const formatTeam = (team: Record<string, unknown>) => {
        const members = ((team.members as Array<{ slotIndex: number; robot: Record<string, unknown> }>) || []).sort((a, b) => a.slotIndex - b.slotIndex);
        const activeRobot = members[0]?.robot as Record<string, unknown> | undefined;
        const reserveRobot = members[1]?.robot as Record<string, unknown> | undefined;
        return {
          id: team.id,
          stableName: (team.stable as { stableName?: string | null } | undefined)?.stableName || null,
          activeRobot: activeRobot ? {
            id: activeRobot.id,
            name: activeRobot.name,
            elo: activeRobot.elo,
            currentHP: activeRobot.currentHP,
            maxHP: activeRobot.maxHP,
            userId: activeRobot.userId,
            user: { username: (activeRobot.user as { username?: string } | undefined)?.username },
          } : null,
          reserveRobot: reserveRobot ? {
            id: reserveRobot.id,
            name: reserveRobot.name,
            elo: reserveRobot.elo,
            currentHP: reserveRobot.currentHP,
            maxHP: reserveRobot.maxHP,
            userId: reserveRobot.userId,
            user: { username: (reserveRobot.user as { username?: string } | undefined)?.username },
          } : null,
          combinedELO: ((activeRobot?.elo as number) || 0) + ((reserveRobot?.elo as number) || 0),
        };
      };

      return {
        id: `tag-team-${match.id}`,
        matchType: 'tag_team' as const,
        team1Id: match.team1Id,
        team2Id: match.team2Id,
        tagTeamLeague: match.teamBattleLeague || 'bronze',
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
      teamLp: 0,
      teamLeague: match.teamBattleLeague,
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
        participants: {
          include: { robot: { include: { user: { select: { id: true, username: true, stableName: true } } } } },
        },
        tournament: { select: { id: true, name: true, maxRounds: true } },
        summary: { select: { kothPlacements: true } },
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
  // Derive robot1/robot2 from participants by team
  const robot1Part = battle.participants.find((p) => p.team === 1);
  const robot2Part = battle.participants.find((p) => p.team === 2);
  const robot1 = robot1Part?.robot;
  const robot2 = robot2Part?.robot;
  const robot1Id = robot1Part?.robotId ?? 0;
  const robot2Id = robot2Part?.robotId ?? 0;

  // Find the requesting user's participant for economic fields
  const userParticipant = battle.participants.find((p) => targetRobotIds.includes(p.robotId));

  const baseData = {
    id: battle.id,
    robot1Id,
    robot2Id,
    winnerId: battle.winnerId,
    createdAt: battle.createdAt,
    durationSeconds: battle.durationSeconds,
    robot1ELOBefore: robot1Part?.eloBefore || 0,
    robot1ELOAfter: robot1Part?.eloAfter || 0,
    robot2ELOBefore: robot2Part?.eloBefore || 0,
    robot2ELOAfter: robot2Part?.eloAfter || 0,
    robot1FinalHP: robot1Part?.finalHP || 0,
    robot2FinalHP: robot2Part?.finalHP || 0,
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
    robot1: robot1 ? {
      id: robot1.id,
      name: robot1.name,
      userId: robot1.userId,
      user: { username: robot1.user.stableName || robot1.user.username },
    } : { id: 0, name: 'Unknown', userId: 0, user: { username: 'Unknown' } },
    robot2: robot2 ? {
      id: robot2.id,
      name: robot2.name,
      userId: robot2.userId,
      user: { username: robot2.user.stableName || robot2.user.username },
    } : { id: 0, name: 'Unknown', userId: 0, user: { username: 'Unknown' } },
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

  // Read zone score from eager-loaded summary (Spec #39), fallback to battle_log for pre-migration battles
  let userZoneScore: number | null = null;
  const summary = (battle as unknown as { summary?: { kothPlacements: unknown } | null }).summary;
  if (summary?.kothPlacements && userParticipant) {
    const placements = summary.kothPlacements as Array<{ robotId: number; zoneScore: number }>;
    const entry = placements.find(p => p.robotId === userParticipant.robotId);
    if (entry) userZoneScore = entry.zoneScore;
  }
  // Fallback to battle_log if no summary exists
  if (userZoneScore === null && userParticipant) {
    const battleLogData = battle.battleLog !== null && typeof battle.battleLog === 'object'
      ? battle.battleLog as Record<string, unknown>
      : {};
    const logPlacements = ((battleLogData).placements || []) as Array<{ robotId: number; zoneScore: number }>;
    const logEntry = logPlacements.find(lp => lp.robotId === userParticipant.robotId);
    if (logEntry) userZoneScore = logEntry.zoneScore;
  }

  const kothData: Record<string, unknown> = {
    ...baseData,
    winnerReward: userParticipant?.credits ?? 0,
    loserReward: userParticipant?.credits ?? 0,
    kothPlacement: userParticipant?.placement ?? null,
    kothParticipantCount: battle.participants.length,
    kothZoneScore: userZoneScore,
  };

  if (userParticipant && userParticipant.robotId !== (battle.participants.find(p => p.team === 1)?.robotId) && userParticipant.robotId !== (battle.participants.find(p => p.team === 2)?.robotId)) {
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
    // League/tag-team battles: resolve team names from BattleParticipant → TeamBattle
    // Each participant has a team number (1 or 2) and robotId.
    // Find which TeamBattle each robot belongs to.
    const participants = battle.participants || [];
    const team1Robots = participants.filter(p => p.team === 1).map(p => p.robotId);
    const team2Robots = participants.filter(p => p.team === 2).map(p => p.robotId);

    const [team1Match, team2Match] = await Promise.all([
      team1Robots.length > 0
        ? prisma.teamBattle.findFirst({
            where: { members: { some: { robotId: { in: team1Robots } } }, teamSize },
            select: { id: true, teamName: true, stableId: true },
          })
        : null,
      team2Robots.length > 0
        ? prisma.teamBattle.findFirst({
            where: { members: { some: { robotId: { in: team2Robots } } }, teamSize },
            select: { id: true, teamName: true, stableId: true },
          })
        : null,
    ]);

    team1Id = team1Match?.id ?? null;
    team2Id = team2Match?.id ?? null;
    team1Name = team1Match?.teamName ?? null;
    team2Name = team2Match?.teamName ?? null;
    isByeMatch = team2Robots.length === 0 || team2Match === null;

    // Calculate LP delta for league battles (not tag team)
    if (!isTagTeam && battle.winnerId !== null && team1Id) {
      const team1Won = battle.winnerId === team1Id;
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
      participants: {
        include: {
          robot: {
            include: {
              user: { select: { id: true, username: true, stableName: true } },
              mainWeapon: { include: { weapon: { select: { name: true, rangeBand: true } } } },
              offhandWeapon: { include: { weapon: { select: { name: true, rangeBand: true } } } },
            },
          },
        },
      },
    },
  });

  if (!battle) return null;

  // Derive robot1/robot2 from participants
  const robot1Participant = battle.participants.find(p => p.team === 1 && (p.role === null || p.role === 'active'));
  const robot2Participant = battle.participants.find(p => p.team === 2 && (p.role === null || p.role === 'active'));

  const battleData = {
    ...battle,
    robot1: robot1Participant!.robot,
    robot2: robot2Participant!.robot,
  };

  const battleParticipants = battle.participants;

  const participantMap = new Map(battleParticipants.map(p => [p.robotId, p]));
  const robot1Part = participantMap.get(robot1Participant?.robotId ?? 0);
  const robot2Part = participantMap.get(robot2Participant?.robotId ?? 0);

  const streamingRevenue1 = robot1Part?.streamingRevenue || 0;
  const streamingRevenue2 = robot2Part?.streamingRevenue || 0;

  const baseResponse: Record<string, unknown> = {
    battleId: battleData.id,
    createdAt: battleData.createdAt,
    battleType: battleData.battleType,
    leagueType: battleData.leagueType,
    leagueInstanceId: battleData.leagueInstanceId ?? null,
    tournamentId: battleData.tournamentId ?? null,
    duration: battleData.durationSeconds,
    playbackAvailable: battleData.battleLog !== null,
    battleLog:
      typeof battleData.battleLog === 'object' && battleData.battleLog !== null
        ? JSON.parse(
            JSON.stringify(battleData.battleLog, (_key, value) =>
              typeof value === 'bigint' ? Number(value) : value,
            ),
          )
        : battleData.battleLog,
  };

  // Include pre-computed summary if available (Spec #39)
  const summary = await prisma.battleSummary.findUnique({ where: { battleId: battleData.id } });
  if (summary) {
    baseResponse.summary = {
      perRobot: summary.perRobot,
      perTeam: summary.perTeam,
      damageFlows: summary.damageFlows,
      participants: summary.participants,
      kothPlacements: summary.kothPlacements,
      kothData: summary.kothData,
      startingPositions: summary.startingPositions,
      endingPositions: summary.endingPositions,
      arenaRadius: summary.arenaRadius,
      battleDuration: summary.battleDuration,
      totalEvents: summary.totalEvents,
      hasData: summary.hasData,
    };
  }

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

  if (battleData.battleType === 'tag_team') {
    // Derive tag-team robot IDs from BattleParticipant records (replaces deprecated Battle columns)
    const team1Active = battleParticipants.find(p => p.team === 1 && p.role === 'active');
    const team2Active = battleParticipants.find(p => p.team === 2 && p.role === 'active');
    if (team1Active && team2Active) {
      await buildTagTeamLogResponse(baseResponse, battleData, battleParticipants);
    }
  } else if (battleData.battleType === 'koth') {
    await buildKothLogResponse(baseResponse, battleData, battleId, battleParticipants);
  } else {
    buildStandardLogResponse(baseResponse, battleData, robot1Part, robot2Part, streamingRevenue1, streamingRevenue2);
  }

  // Determine winner
  const derivedRobot1Id = robot1Participant?.robotId ?? 0;
  const derivedRobot2Id = robot2Participant?.robotId ?? 0;
  if (battleData.battleType === 'koth') {
    if (baseResponse.winner === undefined) {
      baseResponse.winner = battleData.winnerId === derivedRobot1Id ? 'robot1' : null;
    }
  } else if (battleData.battleType === 'tag_team' && baseResponse.tagTeam) {
    const tagTeam = baseResponse.tagTeam as { team1: { teamId: number | null }; team2: { teamId: number | null } };
    const team1Id = tagTeam.team1.teamId;
    const team2Id = tagTeam.team2.teamId;
    baseResponse.winner = battleData.winnerId === team1Id ? 'robot1' : battleData.winnerId === team2Id ? 'robot2' : null;
  } else if (battleData.battleType === 'league_2v2' || battleData.battleType === 'league_3v3' || battleData.battleType === 'tournament_2v2' || battleData.battleType === 'tournament_3v3') {
    // For team battles, winnerId stores the winning team ID (not a robot ID).
    // Use the winning_side column (populated at battle creation) to determine winner.
    // Falls back to battleLog.winningSide for battles created before Spec #39.
    const winningSide = battleData.winningSide
      ?? (battleData.battleLog as unknown as { winningSide?: 1 | 2 | null })?.winningSide
      ?? null;
    if (winningSide === 1) {
      baseResponse.winner = 'robot1';
    } else if (winningSide === 2) {
      baseResponse.winner = 'robot2';
    } else {
      baseResponse.winner = null;
    }
  } else {
    baseResponse.winner = battleData.winnerId === derivedRobot1Id ? 'robot1' : battleData.winnerId === derivedRobot2Id ? 'robot2' : null;
  }

  return baseResponse;
}

async function buildTagTeamLogResponse(baseResponse: Record<string, unknown>, battleData: { battleLog: unknown; winnerId: number | null }, battleParticipants: BattleParticipant[]) {
  // Derive robot IDs from BattleParticipant records (replaces deprecated Battle columns)
  const team1ActivePart = battleParticipants.find(p => p.team === 1 && p.role === 'active');
  const team1ReservePart = battleParticipants.find(p => p.team === 1 && p.role === 'reserve');
  const team2ActivePart = battleParticipants.find(p => p.team === 2 && p.role === 'active');
  const team2ReservePart = battleParticipants.find(p => p.team === 2 && p.role === 'reserve');

  const tagTeamUserSelect = { select: { id: true, username: true, stableName: true } };
  const [team1Active, team1Reserve, team2Active, team2Reserve] = await Promise.all([
    team1ActivePart
      ? prisma.robot.findUnique({ where: { id: team1ActivePart.robotId }, include: { user: tagTeamUserSelect } })
      : null,
    team1ReservePart
      ? prisma.robot.findUnique({ where: { id: team1ReservePart.robotId }, include: { user: tagTeamUserSelect } })
      : null,
    team2ActivePart
      ? prisma.robot.findUnique({ where: { id: team2ActivePart.robotId }, include: { user: tagTeamUserSelect } })
      : null,
    team2ReservePart
      ? prisma.robot.findUnique({ where: { id: team2ReservePart.robotId }, include: { user: tagTeamUserSelect } })
      : null,
  ]);

  // Look up team details from TeamBattle via member robot IDs
  const [team1Details, team2Details] = await Promise.all([
    team1ActivePart
      ? prisma.teamBattle.findFirst({
          where: { members: { some: { robotId: team1ActivePart.robotId } }, teamSize: 2 },
          include: { stable: { select: { stableName: true } } },
          orderBy: { updatedAt: 'desc' },
        })
      : null,
    team2ActivePart
      ? prisma.teamBattle.findFirst({
          where: { members: { some: { robotId: team2ActivePart.robotId } }, teamSize: 2 },
          include: { stable: { select: { stableName: true } } },
          orderBy: { updatedAt: 'desc' },
        })
      : null,
  ]);

  const formatTagRobot = (robot: TagTeamRobot, participant: typeof team1ActivePart) =>
    robot
      ? {
          id: robot.id,
          name: robot.name,
          owner: robot.user.stableName || robot.user.username,
          maxHP: robot.maxHP,
          maxShield: robot.maxShield,
          damageDealt: participant?.damageDealt ?? 0,
          fameAwarded: participant?.fameAwarded ?? 0,
          imageUrl: robot.imageUrl ?? null,
        }
      : null;

  // Tag-out times: read from BattleParticipant.tagOutTimeMs (populated for new battles),
  // fall back to battleLog JSON for historical data (pre-migration battles have NULL tagOutTimeMs)
  const battleLogData = battleData.battleLog as unknown as { team1TagOutTime?: number; team2TagOutTime?: number } | null;
  const getTagOutTime = (participant: typeof team1ActivePart, team: 1 | 2): number | null => {
    if (participant?.tagOutTimeMs != null) return Number(participant.tagOutTimeMs) / 1000;
    // Fallback: read from battleLog JSON (for historical battles before tagOutTimeMs was populated)
    if (battleLogData) {
      const logTime = team === 1 ? battleLogData.team1TagOutTime : battleLogData.team2TagOutTime;
      if (logTime != null) return logTime / 1000;
    }
    return null;
  };

  baseResponse.tagTeam = {
    team1: {
      teamId: team1Details?.id || null,
      stableName: team1Details?.stable?.stableName || null,
      activeRobot: formatTagRobot(team1Active, team1ActivePart),
      reserveRobot: formatTagRobot(team1Reserve, team1ReservePart),
      tagOutTime: getTagOutTime(team1ActivePart, 1),
    },
    team2: {
      teamId: team2Details?.id || null,
      stableName: team2Details?.stable?.stableName || null,
      activeRobot: formatTagRobot(team2Active, team2ActivePart),
      reserveRobot: formatTagRobot(team2Reserve, team2ReservePart),
      tagOutTime: getTagOutTime(team2ActivePart, 2),
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

async function buildKothLogResponse(baseResponse: Record<string, unknown>, battleData: { battleLog: unknown; winnerId: number | null }, battleId: number, _battleParticipants: BattleParticipant[]) {
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

  baseResponse.winner = battleData.winnerId === allParticipants[0]?.robotId ? 'robot1' : null;

  if (battleLogData.kothData) {
    baseResponse.kothData = battleLogData.kothData;
  }
}

/** Robot data shape expected by buildStandardLogResponse */
interface RobotForLog {
  id: number;
  name: string;
  user: { id: number; username: string; stableName: string | null };
  maxHP: number;
  maxShield: number;
  imageUrl: string | null;
  loadoutType: string;
  stance: string;
  mainWeapon: { weapon: { name: string; rangeBand: string } | null } | null;
  offhandWeapon: { weapon: { name: string; rangeBand: string } | null } | null;
}

function buildStandardLogResponse(baseResponse: Record<string, unknown>, battleData: { robot1: RobotForLog; robot2: RobotForLog }, robot1Participant: BattleParticipant | undefined, robot2Participant: BattleParticipant | undefined, streamingRevenue1: number, streamingRevenue2: number) {
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
