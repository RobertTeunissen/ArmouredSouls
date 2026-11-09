/**
 * Upcoming matches for a stable's robots and teams: scheduled league, tournament,
 * team-tournament and bye entries, formatted for the dashboard and robot pages.
 */
import prisma from '../../lib/prisma';
import { Prisma, StandingsMode } from '../../../generated/prisma';
import { getConfig } from '../../config/env';
import { getNextCronOccurrence } from '../../utils/scheduleUtils';
import { getExpectedByeReward, type ByeRewardDisplay } from './byeDisplayService';
import { TIER_SCALED_BYE_MODES, type TierScaledByeMode } from '../../utils/byeRewards';

// ─── Prisma Payload Types ────────────────────────────────────────────

const robotUserSelect = { select: { id: true, username: true } } as const;

type RobotWithUser = Prisma.RobotGetPayload<{ include: { user: { select: { id: true; username: true } } } }>;

type ScheduledTournamentByeMatchWithRobots = Prisma.ScheduledTournamentMatchGetPayload<{
  include: {
    tournament: { select: { id: true; name: true; currentRound: true; maxRounds: true; totalParticipants: true } };
  };
}> & {
  resolvedRobot1: RobotWithUser | null;
  resolvedRobot2: RobotWithUser | null;
};

type TeamWithHistoryMembers = Prisma.TeamBattleGetPayload<{
  include: {
    members: { include: { robot: { include: { user: { select: { id: true; username: true } } } } } };
  };
}>;

type ScheduledTeamTournamentMatchWithTeams = Prisma.ScheduledTournamentMatchGetPayload<{
  include: {
    tournament: {
      select: {
        id: true;
        name: true;
        currentRound: true;
        maxRounds: true;
        totalParticipants: true;
        participantType: true;
      };
    };
  };
}> & {
  resolvedTeam1: TeamWithHistoryMembers | null;
  resolvedTeam2: TeamWithHistoryMembers | null;
};

type ActiveTournamentRound = {
  id: number;
  currentRound: number;
  participantType: string;
};

type _BattleWithRobotsAndUsers = Prisma.BattleGetPayload<{
  include: {
    participants: {
      include: { robot: { include: { user: { select: { id: true; username: true; stableName: true } } } } };
    };
  };
}>;

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
  const activeTournaments = await prisma.tournament.findMany({
    where: { status: 'active' },
    select: { id: true, currentRound: true, participantType: true },
  });

  const [tournamentMatches, teamTournamentMatches] = await Promise.all([
    fetchScheduledTournamentMatches(robotIds),
    fetchScheduledTeamTournamentMatches(teamBattleIds, activeTournaments),
  ]);

  const tournamentByeMatches = await fetchCurrentTournamentByes(robotIds, activeTournaments);

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
    const timeA = 'scheduledFor' in a ? (a as Record<string, unknown>).scheduledFor : '';
    const timeB = 'scheduledFor' in b ? (b as Record<string, unknown>).scheduledFor : '';
    return new Date(timeA as string).getTime() - new Date(timeB as string).getTime();
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
      isByeMatch: false,
      tournament: { status: 'active' },
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

async function fetchCurrentTournamentByes(
  robotIds: number[],
  activeTournaments: ActiveTournamentRound[],
): Promise<ScheduledTournamentByeMatchWithRobots[]> {
  const robotTournaments = activeTournaments.filter(t => t.participantType === 'robot');
  if (robotIds.length === 0 || robotTournaments.length === 0) return [];

  const matches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      participantType: 'robot',
      isByeMatch: true,
      battleId: null,
      status: { in: ['pending', 'scheduled', 'completed'] },
      tournament: { status: 'active', participantType: 'robot' },
      AND: [
        { OR: robotTournaments.map(t => ({ tournamentId: t.id, round: t.currentRound })) },
        { OR: [{ participant1Id: { in: robotIds } }, { participant2Id: { in: robotIds } }] },
      ],
    },
    include: {
      tournament: { select: { id: true, name: true, currentRound: true, maxRounds: true, totalParticipants: true } },
    },
    orderBy: { round: 'asc' },
  });

  const participantIds = [...new Set(matches.flatMap(m => [m.participant1Id, m.participant2Id]).filter((id): id is number => id !== null))];
  const robots = participantIds.length > 0
    ? await prisma.robot.findMany({ where: { id: { in: participantIds } }, include: { user: robotUserSelect } })
    : [];
  const robotMap = new Map(robots.map(r => [r.id, r]));

  return matches.map(match => ({
    ...match,
    resolvedRobot1: match.participant1Id ? robotMap.get(match.participant1Id) ?? null : null,
    resolvedRobot2: match.participant2Id ? robotMap.get(match.participant2Id) ?? null : null,
  }));
}

async function fetchScheduledTeamTournamentMatches(
  teamBattleIds: number[],
  activeTournaments: ActiveTournamentRound[],
): Promise<ScheduledTeamTournamentMatchWithTeams[]> {

  const participantTypes: string[] = ['team_2v2', 'team_3v3'];
  const teamTournaments = activeTournaments.filter(t =>
    t.participantType === 'team_2v2' || t.participantType === 'team_3v3',
  );
  const tournamentSelect = {
    id: true,
    name: true,
    currentRound: true,
    maxRounds: true,
    totalParticipants: true,
    participantType: true,
  } as const;

  const [ordinaryMatches, currentByeMatches] = await Promise.all([
    prisma.scheduledTournamentMatch.findMany({
      where: {
        participantType: { in: participantTypes },
        status: { in: ['pending', 'scheduled'] },
        isByeMatch: false,
        tournament: { status: 'active' },
        OR: [{ participant1Id: { in: teamBattleIds } }, { participant2Id: { in: teamBattleIds } }],
      },
      include: { tournament: { select: tournamentSelect } },
      orderBy: { round: 'asc' },
    }),
    teamTournaments.length === 0
      ? Promise.resolve([])
      : prisma.scheduledTournamentMatch.findMany({
          where: {
            participantType: { in: participantTypes },
            isByeMatch: true,
            battleId: null,
            status: { in: ['pending', 'scheduled', 'completed'] },
            tournament: { status: 'active' },
            AND: [
              { OR: teamTournaments.map(t => ({ tournamentId: t.id, round: t.currentRound })) },
              { OR: [{ participant1Id: { in: teamBattleIds } }, { participant2Id: { in: teamBattleIds } }] },
            ],
          },
          include: { tournament: { select: tournamentSelect } },
          orderBy: { round: 'asc' },
        }),
  ]);

  const matches = [...ordinaryMatches, ...currentByeMatches].sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);

  // Resolve team data for participants
  const allParticipantIds = matches.flatMap(m => [m.participant1Id, m.participant2Id]).filter((id): id is number => id !== null);
  const teams = allParticipantIds.length > 0
    ? await prisma.teamBattle.findMany({
        where: { id: { in: allParticipantIds } },
        include: { members: { include: { robot: { include: { user: robotUserSelect } } }, orderBy: { slotIndex: 'asc' } } },
      })
    : [];
  const teamMap = new Map(teams.map(t => [t.id, t]));

  return matches.map(m => ({
    ...m,
    resolvedTeam1: m.participant1Id ? teamMap.get(m.participant1Id) ?? null : null,
    resolvedTeam2: m.participant2Id ? teamMap.get(m.participant2Id) ?? null : null,
  }));
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
function getTierByeDisplay(matchType: string, tier: string): ByeRewardDisplay {
  if (!(TIER_SCALED_BYE_MODES as readonly string[]).includes(matchType)) {
    return { byeRewardCredits: null, byeRewardStatus: 'pending' };
  }

  return getExpectedByeReward({ mode: matchType as TierScaledByeMode, tier });
}

/**
 * Format unified scheduled matches into the response shape the frontend expects.
 * Resolves the authenticated stable's real side as the primary subject while
 * preserving the opposite side for ordinary matches.
 */
async function formatUnifiedMatches(
  matches: Array<{ id: number; matchType: string; scheduledFor: Date; leagueType: string | null; leagueInstanceId: string | null; isByeMatch: boolean | null; participants: Array<{ participantType: string; participantId: number; slot: number }> }>,
  targetRobotIds: number[],
  userTeamBattleIds: number[],
) {
  const formatted = [];

  for (const match of matches) {
    const p1 = match.participants.find(p => p.slot === 1);
    const p2 = match.participants.find(p => p.slot === 2);
    const isByeMatch = match.isByeMatch ?? false;
    const isRobotMatch = match.participants.some(p => p.participantType === 'robot');
    const isKoth = match.matchType === 'koth';
    const isGrandMelee = match.matchType === 'grand_melee';

    if (isKoth || isGrandMelee) {
      // FFA modes (KotH, Grand Melee): resolve participant robots for the card.
      const robotIds = match.participants.map(p => p.participantId);
      const robots = await prisma.robot.findMany({
        where: { id: { in: robotIds } },
        select: { id: true, name: true, elo: true, userId: true, user: { select: { username: true } } },
      });

      const byeReward = isByeMatch
        ? getTierByeDisplay(match.matchType, match.leagueType ?? 'bronze')
        : null;
      formatted.push({
        id: match.id,
        matchType: match.matchType,
        scheduledFor: match.scheduledFor.toISOString(),
        leagueType: match.leagueType ?? 'koth',
        status: 'scheduled',
        isByeMatch,
        ...(byeReward ?? {}),
        kothParticipantCount: match.participants.length,
        kothParticipants: robots.map(r => ({
          id: r.id,
          name: r.name,
          elo: r.elo,
          userId: r.userId,
          user: { username: r.user?.username ?? 'Unknown' },
        })),
      });
    } else if (isRobotMatch) {
      const robot1 = p1 ? await prisma.robot.findUnique({
        where: { id: p1.participantId },
        select: { id: true, name: true, elo: true, currentHP: true, maxHP: true, userId: true },
      }) : null;
      const robot2 = p2 ? await prisma.robot.findUnique({
        where: { id: p2.participantId },
        select: { id: true, name: true, elo: true, currentHP: true, maxHP: true, userId: true },
      }) : null;

      const perspectiveRobot = [robot1, robot2].find(robot =>
        robot !== null && targetRobotIds.includes(robot.id),
      ) ?? robot1 ?? robot2;
      const displayRobot2 = isByeMatch
        ? null
        : perspectiveRobot?.id === robot1?.id ? robot2 : robot1;
      const robot1User = perspectiveRobot ? await prisma.user.findUnique({ where: { id: perspectiveRobot.userId }, select: { username: true } }) : null;
      const robot2User = displayRobot2 ? await prisma.user.findUnique({ where: { id: displayRobot2.userId }, select: { username: true } }) : null;
      const byeReward = isByeMatch
        ? getTierByeDisplay(match.matchType, match.leagueType ?? 'bronze')
        : null;

      formatted.push({
        id: match.id,
        matchType: match.matchType,
        scheduledFor: match.scheduledFor.toISOString(),
        leagueType: match.leagueType ?? 'bronze',
        status: 'scheduled',
        isByeMatch,
        ...(byeReward ?? {}),
        robot1Id: perspectiveRobot?.id,
        robot2Id: displayRobot2?.id,
        robot1: perspectiveRobot ? { ...perspectiveRobot, user: { username: robot1User?.username ?? 'Unknown' } } : null,
        robot2: displayRobot2 ? { ...displayRobot2, user: { username: robot2User?.username ?? 'Unknown' } } : null,
      });
    } else {
      // Team modes (2v2, 3v3, tag_team): resolve team data.
      const team1 = p1 ? await prisma.teamBattle.findUnique({
        where: { id: p1.participantId },
        include: { members: { include: { robot: { include: { user: { select: { username: true } } } } }, orderBy: { slotIndex: 'asc' } }, stable: { select: { stableName: true } } },
      }) : null;
      const team2 = p2 ? await prisma.teamBattle.findUnique({
        where: { id: p2.participantId },
        include: { members: { include: { robot: { include: { user: { select: { username: true } } } } }, orderBy: { slotIndex: 'asc' } }, stable: { select: { stableName: true } } },
      }) : null;

      // Resolve LP/league from standings (source of truth).
      const teamIds = [team1?.id, team2?.id].filter((id): id is number => id != null);
      const mode = match.matchType === 'tag_team' ? 'tag_team' : (match.matchType === 'league_3v3' ? 'league_3v3' : 'league_2v2');
      const teamStandings = teamIds.length > 0 ? await prisma.standing.findMany({
        where: { entityType: 'team', entityId: { in: teamIds }, mode: mode as StandingsMode },
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

      const perspectiveTeam = [team1, team2].find(team =>
        team !== null && userTeamBattleIds.includes(team.id),
      ) ?? team1 ?? team2;
      const displayTeam2 = isByeMatch
        ? null
        : perspectiveTeam?.id === team1?.id ? team2 : team1;
      const byeReward = isByeMatch
        ? getTierByeDisplay(match.matchType, match.leagueType ?? 'bronze')
        : null;

      formatted.push({
        id: match.id,
        matchType: match.matchType,
        scheduledFor: match.scheduledFor.toISOString(),
        leagueType: match.leagueType ?? 'bronze',
        teamBattleLeague: match.leagueType ?? 'bronze',
        teamSize: perspectiveTeam?.teamSize ?? (match.matchType === 'league_3v3' ? 3 : 2),
        status: 'scheduled',
        isByeMatch,
        ...(byeReward ?? {}),
        team1Id: perspectiveTeam?.id,
        team2Id: displayTeam2?.id,
        teamBattleTeam1: perspectiveTeam ? formatTeamBattle(perspectiveTeam) : undefined,
        teamBattleTeam2: displayTeam2 ? formatTeamBattle(displayTeam2) : null,
      });
    }
  }

  return formatted;
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
  return matches.map(match => {
    const realRobot = match.resolvedRobot1 ?? match.resolvedRobot2;
    const byeReward = getExpectedByeReward({
      mode: 'tournament_1v1',
      totalParticipants: match.tournament.totalParticipants,
      currentRound: match.round,
      maxRounds: match.tournament.maxRounds,
    });

    return {
      id: `tournament-bye-${match.id}`,
      matchType: 'tournament_1v1' as const,
      tournamentId: match.tournamentId,
      tournamentName: match.tournament.name,
      tournamentRound: match.round,
      currentRound: match.tournament.currentRound,
      maxRounds: match.tournament.maxRounds,
      robot1Id: realRobot?.id ?? null,
      robot2Id: null,
      isByeMatch: true,
      leagueType: 'tournament' as const,
      scheduledFor: getNextCronOccurrence(getConfig().tournamentSchedule).toISOString(),
      status: 'bye' as const,
      ...byeReward,
      robot1: realRobot ? formatRobotSummary(realRobot) : null,
      robot2: null,
    };
  });
}

async function formatTeamTournamentMatches(matches: Awaited<ReturnType<typeof fetchScheduledTeamTournamentMatches>>) {
  // Batch-fetch standings for all participating teams
  const teamIds = matches.flatMap(m => [m.resolvedTeam1?.id, m.resolvedTeam2?.id].filter((id): id is number => id != null));
  const standings = teamIds.length > 0 ? await prisma.standing.findMany({
    where: { entityType: 'team', entityId: { in: teamIds }, mode: { in: [StandingsMode.league_2v2, StandingsMode.league_3v3] } },
    select: { entityId: true, leaguePoints: true, tier: true },
  }) : [];
  const standingsMap = new Map(standings.map(s => [s.entityId, s]));

  return matches.map(match => {
    const participantType = match.tournament.participantType as 'team_2v2' | 'team_3v3';
    const matchType = participantType === 'team_2v2' ? 'tournament_2v2' as const : 'tournament_3v3' as const;
    const isByeMatch = match.isByeMatch;
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

    const realTeam = isByeMatch ? (match.resolvedTeam1 ?? match.resolvedTeam2) : match.resolvedTeam1;
    const opponentTeam = isByeMatch ? null : match.resolvedTeam2;
    const byeReward = isByeMatch
      ? getExpectedByeReward({
          mode: matchType,
          totalParticipants: match.tournament.totalParticipants,
          currentRound: match.round,
          maxRounds: match.tournament.maxRounds,
        })
      : null;

    return {
      id: `team-tournament-${match.id}`,
      matchType,
      teamSize: realTeam?.teamSize ?? teamSize,
      tournamentId: match.tournamentId,
      tournamentName: match.tournament.name,
      tournamentRound: match.round,
      currentRound: match.tournament.currentRound,
      maxRounds: match.tournament.maxRounds,
      team1Id: realTeam?.id ?? null,
      team2Id: opponentTeam?.id ?? null,
      isByeMatch,
      leagueType: 'tournament' as const,
      scheduledFor: getNextCronOccurrence(schedule).toISOString(),
      status: isByeMatch ? 'bye' as const : match.status,
      ...(byeReward ?? {}),
      teamBattleTeam1: realTeam ? formatTeam(realTeam) : undefined,
      teamBattleTeam2: opponentTeam ? formatTeam(opponentTeam) : null,
    };
  });
}

