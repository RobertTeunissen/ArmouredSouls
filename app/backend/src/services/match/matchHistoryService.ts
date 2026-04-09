import prisma from '../../lib/prisma';
import { getConfig } from '../../config/env';
import { getNextCronOccurrence } from '../../utils/scheduleUtils';

// ─── Upcoming Matches ────────────────────────────────────────────────

interface RobotAndTeamIds {
  robotIds: number[];
  teamIds: number[];
}

/**
 * Resolve robot IDs and tag-team IDs for the upcoming-matches query.
 * If a specific robotId is provided, returns that robot (plus any teams it belongs to).
 * Otherwise returns all robots/teams owned by the given user.
 */
export async function resolveRobotAndTeamIds(
  userId: number,
  queryRobotId?: number,
): Promise<RobotAndTeamIds> {
  if (queryRobotId !== undefined && !isNaN(queryRobotId)) {
    const teamsWithRobot = await prisma.tagTeam.findMany({
      where: {
        OR: [
          { activeRobotId: queryRobotId },
          { reserveRobotId: queryRobotId },
        ],
      },
      select: { id: true },
    });
    return {
      robotIds: [queryRobotId],
      teamIds: teamsWithRobot.map(t => t.id),
    };
  }

  const [userRobots, userTeams] = await Promise.all([
    prisma.robot.findMany({ where: { userId }, select: { id: true } }),
    prisma.tagTeam.findMany({ where: { stableId: userId }, select: { id: true } }),
  ]);

  return {
    robotIds: userRobots.map(r => r.id),
    teamIds: userTeams.map(t => t.id),
  };
}

/**
 * Fetch and format all upcoming matches (league, tournament, tag-team, KotH)
 * for the given robot/team IDs.
 */
export async function getUpcomingMatches(robotIds: number[], teamIds: number[]) {
  const [leagueMatches, tournamentMatches, activeTournaments, tagTeamMatches, kothMatches] =
    await Promise.all([
      fetchScheduledLeagueMatches(robotIds),
      fetchScheduledTournamentMatches(robotIds),
      prisma.tournament.findMany({
        where: { status: 'active' },
        select: { id: true, currentRound: true },
      }),
      fetchScheduledTagTeamMatches(teamIds),
      fetchScheduledKothMatches(robotIds),
    ]);

  const tournamentByeMatches = activeTournaments.length > 0
    ? await prisma.scheduledTournamentMatch.findMany({
        where: {
          isByeMatch: true,
          status: 'completed',
          robot1Id: { in: robotIds },
          OR: activeTournaments.map(t => ({
            tournamentId: t.id,
            round: t.currentRound,
          })),
        },
        include: {
          robot1: { include: { user: { select: { id: true, username: true } } } },
          robot2: true,
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

  const allMatches = [
    ...formattedLeague,
    ...formattedTournament,
    ...formattedBye,
    ...formattedTagTeam,
    ...formattedKoth,
  ].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());

  return {
    matches: allMatches,
    total: allMatches.length,
    leagueMatches: formattedLeague.length,
    tournamentMatches: formattedTournament.length + formattedBye.length,
    tagTeamMatches: formattedTagTeam.length,
    kothMatches: formattedKoth.length,
  };
}

// ─── Upcoming: Prisma queries ────────────────────────────────────────

const robotUserSelect = { select: { id: true, username: true } } as const;
const robotInclude = { include: { user: robotUserSelect } } as const;

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
  return prisma.scheduledTournamentMatch.findMany({
    where: {
      status: { in: ['pending', 'scheduled'] },
      OR: [{ robot1Id: { in: robotIds } }, { robot2Id: { in: robotIds } }],
    },
    include: {
      robot1: robotInclude,
      robot2: robotInclude,
      tournament: { select: { id: true, name: true, currentRound: true, maxRounds: true } },
    },
    orderBy: { round: 'asc' },
  });
}

async function fetchScheduledTagTeamMatches(teamIds: number[]) {
  if (teamIds.length === 0) return [];
  const teamMemberInclude = {
    include: {
      activeRobot: { include: { user: robotUserSelect } },
      reserveRobot: { include: { user: robotUserSelect } },
      stable: { select: { stableName: true } },
    },
  } as const;

  return prisma.scheduledTagTeamMatch.findMany({
    where: {
      status: 'scheduled',
      OR: [{ team1Id: { in: teamIds } }, { team2Id: { in: teamIds } }],
    },
    include: { team1: teamMemberInclude, team2: teamMemberInclude },
    orderBy: { scheduledFor: 'asc' },
  });
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

// ─── Upcoming: Formatters ────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatRobotSummary(robot: any) {
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

function formatLeagueMatches(matches: any[]) {
  return matches.map(match => ({
    id: match.id,
    matchType: 'league' as const,
    robot1Id: match.robot1Id,
    robot2Id: match.robot2Id,
    leagueType: match.leagueType,
    scheduledFor: match.scheduledFor,
    status: match.status,
    robot1: formatRobotSummary(match.robot1),
    robot2: formatRobotSummary(match.robot2),
  }));
}

function formatTournamentMatches(matches: any[]) {
  return matches.map(match => ({
    id: `tournament-${match.id}`,
    matchType: 'tournament' as const,
    tournamentId: match.tournamentId,
    tournamentName: match.tournament.name,
    tournamentRound: match.round,
    currentRound: match.tournament.currentRound,
    maxRounds: match.tournament.maxRounds,
    robot1Id: match.robot1Id,
    robot2Id: match.robot2Id,
    isByeMatch: match.isByeMatch,
    leagueType: 'tournament' as const,
    scheduledFor: getNextCronOccurrence(getConfig().tournamentSchedule).toISOString(),
    status: match.status,
    robot1: match.robot1 ? formatRobotSummary(match.robot1) : null,
    robot2: match.robot2 ? formatRobotSummary(match.robot2) : null,
  }));
}

function formatByeMatches(matches: any[]) {
  return matches.map(match => ({
    id: `tournament-bye-${match.id}`,
    matchType: 'tournament' as const,
    tournamentId: match.tournamentId,
    tournamentName: match.tournament.name,
    tournamentRound: match.round,
    currentRound: match.tournament.currentRound,
    maxRounds: match.tournament.maxRounds,
    robot1Id: match.robot1Id,
    robot2Id: null,
    isByeMatch: true,
    leagueType: 'tournament' as const,
    scheduledFor: getNextCronOccurrence(getConfig().tournamentSchedule).toISOString(),
    status: 'bye' as const,
    robot1: match.robot1 ? formatRobotSummary(match.robot1) : null,
    robot2: null,
  }));
}

function formatTagTeamMatches(matches: any[]) {
  return matches
    .filter(match => match.team2 !== null)
    .map(match => {
      const formatTeam = (team: any) => ({
        id: team.id,
        stableName: team.stable?.stableName || null,
        activeRobot: {
          id: team.activeRobot.id,
          name: team.activeRobot.name,
          elo: team.activeRobot.elo,
          currentHP: team.activeRobot.currentHP,
          maxHP: team.activeRobot.maxHP,
          userId: team.activeRobot.userId,
          user: { username: team.activeRobot.user.username },
        },
        reserveRobot: {
          id: team.reserveRobot.id,
          name: team.reserveRobot.name,
          elo: team.reserveRobot.elo,
          currentHP: team.reserveRobot.currentHP,
          maxHP: team.reserveRobot.maxHP,
          userId: team.reserveRobot.userId,
          user: { username: team.reserveRobot.user.username },
        },
        combinedELO: team.activeRobot.elo + team.reserveRobot.elo,
      });

      return {
        id: `tag-team-${match.id}`,
        matchType: 'tag_team' as const,
        team1Id: match.team1Id,
        team2Id: match.team2Id,
        tagTeamLeague: match.tagTeamLeague,
        scheduledFor: match.scheduledFor,
        status: match.status,
        team1: formatTeam(match.team1),
        team2: formatTeam(match.team2!),
      };
    });
}

function formatKothMatches(matches: any[]) {
  return matches.map(match => ({
    id: `koth-${match.id}`,
    matchType: 'koth' as const,
    scheduledFor: match.scheduledFor,
    status: match.status,
    kothRotatingZone: match.rotatingZone,
    kothParticipantCount: match.participants.length,
    kothParticipants: match.participants.map((p: any) => ({
      id: p.robot.id,
      name: p.robot.name,
      elo: 0,
      userId: p.robot.userId,
      user: { username: p.robot.user.username },
    })),
  }));
}

/* eslint-enable @typescript-eslint/no-explicit-any */

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: Record<string, any> = {};

  if (battleType === 'league') {
    whereClause.battleType = { notIn: ['tournament', 'tag_team', 'koth'] };
  } else if (battleType === 'tournament') {
    whereClause.battleType = 'tournament';
  } else if (battleType === 'tag_team') {
    whereClause.battleType = 'tag_team';
  } else if (battleType === 'koth') {
    whereClause.battleType = 'koth';
  }

  if (battleType === 'koth') {
    whereClause.participants = { some: { robotId: { in: targetRobotIds } } };
  } else if (!battleType || battleType === 'overall') {
    whereClause.OR = [
      { robot1Id: { in: targetRobotIds } },
      { robot2Id: { in: targetRobotIds } },
      { battleType: 'koth', participants: { some: { robotId: { in: targetRobotIds } } } },
    ];
  } else {
    whereClause.OR = [
      { robot1Id: { in: targetRobotIds } },
      { robot2Id: { in: targetRobotIds } },
    ];
  }

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
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function formatBattleHistoryEntry(battle: any, targetRobotIds: number[]) {
  const robot1Participant = battle.participants.find((p: any) => p.robotId === battle.robot1Id);
  const robot2Participant = battle.participants.find((p: any) => p.robotId === battle.robot2Id);

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
    return formatTagTeamHistoryEntry(battle, baseData);
  }

  return baseData;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function formatKothHistoryEntry(battle: any, baseData: any, targetRobotIds: number[]) {
  const userParticipant = battle.participants.find((p: any) => targetRobotIds.includes(p.robotId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const battleLogData = typeof battle.battleLog === 'object' ? battle.battleLog as Record<string, any> : {};
  const logPlacements = (battleLogData.placements || []) as Array<{ robotId: number; zoneScore: number }>;
  const userLogEntry = userParticipant ? logPlacements.find((lp: any) => lp.robotId === userParticipant.robotId) : null;

  const kothMatch = await prisma.scheduledKothMatch.findFirst({
    where: { battleId: battle.id },
    select: { rotatingZone: true },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kothData: any = {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function formatTagTeamHistoryEntry(battle: any, baseData: any) {
  const tagTeamMatch = await prisma.scheduledTagTeamMatch.findFirst({
    where: { battleId: battle.id },
    include: {
      team1: {
        include: {
          stable: { select: { stableName: true } },
          activeRobot: { select: { id: true, name: true } },
          reserveRobot: { select: { id: true, name: true } },
        },
      },
      team2: {
        include: {
          stable: { select: { stableName: true } },
          activeRobot: { select: { id: true, name: true } },
          reserveRobot: { select: { id: true, name: true } },
        },
      },
    },
  });

  return {
    ...baseData,
    team1Id: tagTeamMatch?.team1Id || null,
    team2Id: tagTeamMatch?.team2Id || null,
    team1StableName: tagTeamMatch?.team1?.stable?.stableName || null,
    team2StableName: tagTeamMatch?.team2?.stable?.stableName || null,
    team1ActiveRobotId: battle.team1ActiveRobotId,
    team1ReserveRobotId: battle.team1ReserveRobotId,
    team2ActiveRobotId: battle.team2ActiveRobotId,
    team2ReserveRobotId: battle.team2ReserveRobotId,
    team1ActiveRobotName: tagTeamMatch?.team1?.activeRobot?.name || null,
    team1ReserveRobotName: tagTeamMatch?.team1?.reserveRobot?.name || null,
    team2ActiveRobotName: tagTeamMatch?.team2?.activeRobot?.name || null,
    team2ReserveRobotName: tagTeamMatch?.team2?.reserveRobot?.name || null,
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
        include: { user: { select: { id: true, username: true, stableName: true } } },
      },
      robot2: {
        include: { user: { select: { id: true, username: true, stableName: true } } },
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
  });

  const participantMap = new Map(battleParticipants.map(p => [p.robotId, p]));
  const robot1Participant = participantMap.get(battle.robot1Id);
  const robot2Participant = participantMap.get(battle.robot2Id);

  const streamingRevenue1 = robot1Participant?.streamingRevenue || 0;
  const streamingRevenue2 = robot2Participant?.streamingRevenue || 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseResponse: Record<string, any> = {
    battleId: battleData.id,
    createdAt: battleData.createdAt,
    battleType: battleData.battleType,
    leagueType: battleData.leagueType,
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
    const team1Id = baseResponse.tagTeam.team1.teamId;
    const team2Id = baseResponse.tagTeam.team2.teamId;
    baseResponse.winner = battleData.winnerId === team1Id ? 'robot1' : battleData.winnerId === team2Id ? 'robot2' : null;
  } else {
    baseResponse.winner = battleData.winnerId === battleData.robot1Id ? 'robot1' : battleData.winnerId === battleData.robot2Id ? 'robot2' : null;
  }

  return baseResponse;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildTagTeamLogResponse(baseResponse: Record<string, any>, battleData: any, battleParticipants: any[]) {
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

  const tagTeamMatch = await prisma.scheduledTagTeamMatch.findFirst({
    where: { battleId: battleData.id },
    select: { team1Id: true, team2Id: true },
  });

  const [team1Details, team2Details] = await Promise.all([
    tagTeamMatch?.team1Id
      ? prisma.tagTeam.findUnique({ where: { id: tagTeamMatch.team1Id }, include: { stable: { select: { stableName: true } } } })
      : null,
    tagTeamMatch?.team2Id
      ? prisma.tagTeam.findUnique({ where: { id: tagTeamMatch.team2Id }, include: { stable: { select: { stableName: true } } } })
      : null,
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatTagRobot = (robot: any, damageDealt: any, fameAwarded: any) =>
    robot
      ? {
          id: robot.id,
          name: robot.name,
          owner: robot.user.stableName || robot.user.username,
          maxHP: robot.maxHP,
          maxShield: robot.maxShield,
          damageDealt,
          fameAwarded,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sumField = (arr: any[], field: string) => arr.reduce((sum, p) => sum + (p[field] || 0), 0);

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildKothLogResponse(baseResponse: Record<string, any>, battleData: any, battleId: number, _battleParticipants: any[]) {
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
    };
  });

  baseResponse.winner = battleData.winnerId === battleData.robot1Id ? 'robot1' : null;

  if (battleLogData.kothData) {
    baseResponse.kothData = battleLogData.kothData;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStandardLogResponse(baseResponse: Record<string, any>, battleData: any, robot1Participant: any, robot2Participant: any, streamingRevenue1: number, streamingRevenue2: number) {
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
  };
}
