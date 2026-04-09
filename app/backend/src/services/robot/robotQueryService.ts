/**
 * Robot query helpers.
 *
 * Extracts the complex Prisma queries and response-formatting logic from
 * the robots route handlers so the routes stay thin.
 */

import prisma from '../../lib/prisma';
import type { BattleParticipant, Prisma } from '../../../generated/prisma';
import { getNextCronOccurrence } from '../../utils/scheduleUtils';
import { getConfig } from '../../config/env';

// ── Shared include fragments ─────────────────────────────────────────

const WEAPON_INCLUDE = {
  mainWeapon: { include: { weapon: true } },
  offhandWeapon: { include: { weapon: true } },
} as const;

// ── Typed query result for battles with participants ─────────────────

type BattleWithParticipants = Prisma.BattleGetPayload<{
  select: {
    id: true;
    battleType: true;
    leagueType: true;
    tournamentId: true;
    robot1Id: true;
    robot2Id: true;
    winnerId: true;
    team1ActiveRobotId: true;
    team1ReserveRobotId: true;
    team2ActiveRobotId: true;
    team2ReserveRobotId: true;
    createdAt: true;
    participants: true;
    tournament: {
      select: {
        id: true;
        name: true;
        totalParticipants: true;
      };
    };
  };
}>;

// ── GET /all/robots ──────────────────────────────────────────────────

export async function findAllRobots() {
  return prisma.robot.findMany({
    include: {
      user: { select: { username: true } },
      ...WEAPON_INCLUDE,
    },
    orderBy: { elo: 'desc' },
  });
}

// ── GET / (user's robots) ────────────────────────────────────────────

export async function findUserRobots(userId: number) {
  return prisma.robot.findMany({
    where: { userId },
    include: WEAPON_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

// ── GET /:id ─────────────────────────────────────────────────────────

export async function findRobotById(robotId: number) {
  return prisma.robot.findUnique({
    where: { id: robotId },
    include: {
      ...WEAPON_INCLUDE,
      user: { select: { username: true, stableName: true } },
    },
  });
}

// ── GET /:id/matches (paginated battle history) ──────────────────────

export interface PaginatedMatchesResult {
  data: Array<{
    battleId: number;
    createdAt: Date;
    leagueType: string | null;
    result: { won: boolean; isDraw: boolean; duration: number | null };
    thisRobot: { finalHP: number; damageDealt: number; eloBefore: number; eloAfter: number };
    opponent: { id: number; name: string; owner: string; finalHP: number; damageDealt: number };
  }>;
  pagination: { page: number; perPage: number; total: number; totalPages: number };
  robot: { id: number; name: string };
}

export async function getMatchHistory(
  robotId: number,
  robotName: string,
  page: number,
  perPage: number,
): Promise<PaginatedMatchesResult> {
  const total = await prisma.battle.count({
    where: { OR: [{ robot1Id: robotId }, { robot2Id: robotId }] },
  });

  const battles = await prisma.battle.findMany({
    where: { OR: [{ robot1Id: robotId }, { robot2Id: robotId }] },
    include: {
      robot1: { include: { user: { select: { id: true, username: true } } } },
      robot2: { include: { user: { select: { id: true, username: true } } } },
      participants: true,
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * perPage,
    take: perPage,
  });

  const data = battles.map(battle => {
    const isRobot1 = battle.robot1Id === robotId;
    const opponent = isRobot1 ? battle.robot2 : battle.robot1;
    const won = battle.winnerId === robotId;

    const thisParticipant = battle.participants.find(p => p.robotId === robotId);
    const opponentId = isRobot1 ? battle.robot2Id : battle.robot1Id;
    const opponentParticipant = battle.participants.find(p => p.robotId === opponentId);

    return {
      battleId: battle.id,
      createdAt: battle.createdAt,
      leagueType: battle.leagueType,
      result: {
        won,
        isDraw: battle.winnerId === null,
        duration: battle.durationSeconds,
      },
      thisRobot: {
        finalHP: thisParticipant?.finalHP || 0,
        damageDealt: thisParticipant?.damageDealt || 0,
        eloBefore: thisParticipant?.eloBefore || 0,
        eloAfter: thisParticipant?.eloAfter || 0,
      },
      opponent: {
        id: opponent.id,
        name: opponent.name,
        owner: opponent.user.username,
        finalHP: opponentParticipant?.finalHP || 0,
        damageDealt: opponentParticipant?.damageDealt || 0,
      },
    };
  });

  return {
    data,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    robot: { id: robotId, name: robotName },
  };
}

// ── GET /:id/upcoming ────────────────────────────────────────────────

export async function getUpcomingScheduledMatches(robotId: number, robotName: string) {
  const matches = await prisma.scheduledLeagueMatch.findMany({
    where: {
      status: 'scheduled',
      OR: [{ robot1Id: robotId }, { robot2Id: robotId }],
    },
    include: {
      robot1: { include: { user: { select: { id: true, username: true } } } },
      robot2: { include: { user: { select: { id: true, username: true } } } },
    },
    orderBy: { scheduledFor: 'asc' },
  });

  const formattedMatches = matches.map(match => {
    const isRobot1 = match.robot1Id === robotId;
    const opponent = isRobot1 ? match.robot2 : match.robot1;
    return {
      matchId: match.id,
      scheduledFor: match.scheduledFor,
      leagueType: match.leagueType,
      opponent: {
        id: opponent.id,
        name: opponent.name,
        elo: opponent.elo,
        owner: opponent.user.username,
      },
    };
  });

  return {
    matches: formattedMatches,
    total: formattedMatches.length,
    robot: { id: robotId, name: robotName },
  };
}


// ── GET /:id/upcoming-matches ────────────────────────────────────────

export async function getUpcomingMatches(robotId: number, robot: { currentHP: number; maxHP: number; mainWeaponId: number | null }) {
  // Calculate battle readiness
  const hpPercentage = (robot.currentHP / robot.maxHP) * 100;
  const hasWeapons = robot.mainWeaponId !== null;
  const isReady = hpPercentage >= 50 && hasWeapons;
  const warnings: string[] = [];
  if (hpPercentage < 50) warnings.push('HP below 50%');
  if (!hasWeapons) warnings.push('No weapons equipped');

  // Fetch scheduled league matches
  const scheduledMatches = await prisma.scheduledLeagueMatch.findMany({
    where: {
      OR: [{ robot1Id: robotId }, { robot2Id: robotId }],
      status: 'scheduled',
      scheduledFor: { gte: new Date() },
    },
    include: {
      robot1: { select: { id: true, name: true, imageUrl: true } },
      robot2: { select: { id: true, name: true, imageUrl: true } },
    },
    orderBy: { scheduledFor: 'asc' },
  });

  // Fetch upcoming tournament matches
  const tournamentMatches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      OR: [{ robot1Id: robotId }, { robot2Id: robotId }],
      status: 'scheduled',
    },
    include: {
      robot1: { select: { id: true, name: true, imageUrl: true } },
      robot2: { select: { id: true, name: true, imageUrl: true } },
      tournament: { select: { id: true, name: true, status: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Fetch upcoming tag team matches
  const tagTeamMatches = await prisma.scheduledTagTeamMatch.findMany({
    where: {
      OR: [
        { team1: { OR: [{ activeRobotId: robotId }, { reserveRobotId: robotId }] } },
        { team2: { OR: [{ activeRobotId: robotId }, { reserveRobotId: robotId }] } },
      ],
      status: 'scheduled',
      scheduledFor: { gte: new Date() },
    },
    include: {
      team1: {
        include: {
          activeRobot: { select: { id: true, name: true, imageUrl: true } },
          reserveRobot: { select: { id: true, name: true, imageUrl: true } },
        },
      },
      team2: {
        include: {
          activeRobot: { select: { id: true, name: true, imageUrl: true } },
          reserveRobot: { select: { id: true, name: true, imageUrl: true } },
        },
      },
    },
    orderBy: { scheduledFor: 'asc' },
  });

  // Format matches for response
  const formattedMatches = [
    ...scheduledMatches.map(match => {
      const opponent = match.robot1Id === robotId ? match.robot2 : match.robot1;
      return {
        matchId: match.id,
        opponentName: opponent.name,
        opponentPortrait: opponent.imageUrl || '/src/assets/robots/robot-1.png',
        scheduledTime: match.scheduledFor.toISOString(),
        battleType: 'league' as const,
        leagueContext: match.leagueType,
      };
    }),
    ...tournamentMatches.map(match => {
      const opponent = match.robot1Id === robotId ? match.robot2 : match.robot1;
      return {
        matchId: match.id,
        opponentName: opponent?.name || 'TBD',
        opponentPortrait: opponent?.imageUrl || '/src/assets/robots/robot-1.png',
        scheduledTime: getNextCronOccurrence(getConfig().tournamentSchedule).toISOString(),
        battleType: 'tournament' as const,
        tournamentContext: match.tournament.name,
      };
    }),
    ...tagTeamMatches.filter(match => match.team1 && match.team2).map(match => {
      const isTeam1 = match.team1!.activeRobotId === robotId || match.team1!.reserveRobotId === robotId;

      let teammates: string[];
      let opponentTeam: string[];

      if (isTeam1) {
        teammates = [
          match.team1!.activeRobotId === robotId ? match.team1!.reserveRobot.name : match.team1!.activeRobot.name,
        ];
        opponentTeam = [match.team2!.activeRobot.name, match.team2!.reserveRobot.name];
      } else {
        teammates = [
          match.team2!.activeRobotId === robotId ? match.team2!.reserveRobot.name : match.team2!.activeRobot.name,
        ];
        opponentTeam = [match.team1!.activeRobot.name, match.team1!.reserveRobot.name];
      }

      return {
        matchId: match.id,
        opponentName: opponentTeam[0],
        opponentPortrait: '/src/assets/robots/robot-1.png',
        scheduledTime: match.scheduledFor.toISOString(),
        battleType: 'tag_team' as const,
        leagueContext: match.tagTeamLeague,
        teammates,
        opponentTeam,
      };
    }),
  ].sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

  return {
    matches: formattedMatches,
    battleReadiness: { isReady, warnings },
  };
}


// ── GET /:id/performance-context ─────────────────────────────────────

/** Determine if robot won, lost, or drew a battle. */
function getBattleResult(battle: BattleWithParticipants, robotId: number): 'win' | 'loss' | 'draw' {
  if (battle.winnerId === null) return 'draw';

  if (battle.battleType === 'tag_team') {
    const participant = battle.participants.find((p: BattleParticipant) => p.robotId === robotId);
    if (!participant) return 'draw';
    const eloChange = participant.eloAfter - participant.eloBefore;
    if (eloChange > 0) return 'win';
    if (eloChange < 0) return 'loss';
    return 'draw';
  }

  return battle.winnerId === robotId ? 'win' : 'loss';
}

/** Get damage dealt/taken and ELO change for a robot in a battle. */
function getBattleStats(battle: BattleWithParticipants, robotId: number) {
  const participant = battle.participants.find((p: BattleParticipant) => p.robotId === robotId);
  if (!participant) {
    return { damageDealt: 0, damageTaken: 0, eloChange: 0 };
  }

  let damageTaken = 0;
  if (battle.battleType === 'tag_team') {
    const opponentTeam = participant.team === 1 ? 2 : 1;
    damageTaken = battle.participants
      .filter((p: BattleParticipant) => p.team === opponentTeam)
      .reduce((sum: number, p: BattleParticipant) => sum + p.damageDealt, 0);
  } else {
    const opponent = battle.participants.find((p: BattleParticipant) => p.robotId !== robotId);
    damageTaken = opponent?.damageDealt || 0;
  }

  return {
    damageDealt: participant.damageDealt,
    damageTaken,
    eloChange: participant.eloAfter - participant.eloBefore,
  };
}

export async function getPerformanceContext(robotId: number) {
  // Get all battles for this robot (including tag team)
  const battles: BattleWithParticipants[] = await prisma.battle.findMany({
    where: {
      OR: [
        { robot1Id: robotId },
        { robot2Id: robotId },
        { team1ActiveRobotId: robotId },
        { team1ReserveRobotId: robotId },
        { team2ActiveRobotId: robotId },
        { team2ReserveRobotId: robotId },
      ],
    },
    select: {
      id: true,
      battleType: true,
      leagueType: true,
      tournamentId: true,
      robot1Id: true,
      robot2Id: true,
      winnerId: true,
      team1ActiveRobotId: true,
      team1ReserveRobotId: true,
      team2ActiveRobotId: true,
      team2ReserveRobotId: true,
      createdAt: true,
      participants: true,
      tournament: { select: { id: true, name: true, totalParticipants: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // ── League stats ───────────────────────────────────────────────────
  const leagueBattles = battles.filter(b => b.battleType === 'league');
  const leagueStatsMap = new Map<string, {
    leagueName: string;
    leagueIcon: string;
    wins: number; losses: number; draws: number;
    damageDealt: number; damageTaken: number; eloChange: number; battlesPlayed: number;
  }>();

  leagueBattles.forEach(battle => {
    const leagueName = battle.leagueType;
    if (!leagueStatsMap.has(leagueName)) {
      leagueStatsMap.set(leagueName, {
        leagueName, leagueIcon: '🏆',
        wins: 0, losses: 0, draws: 0,
        damageDealt: 0, damageTaken: 0, eloChange: 0, battlesPlayed: 0,
      });
    }
    const stats = leagueStatsMap.get(leagueName)!;
    const result = getBattleResult(battle, robotId);
    const bs = getBattleStats(battle, robotId);
    if (result === 'win') stats.wins++;
    else if (result === 'loss') stats.losses++;
    else stats.draws++;
    stats.damageDealt += bs.damageDealt;
    stats.damageTaken += bs.damageTaken;
    stats.eloChange += bs.eloChange;
    stats.battlesPlayed++;
  });

  const leagueStats = Array.from(leagueStatsMap.values()).map(s => ({
    ...s,
    winRate: s.battlesPlayed > 0 ? ((s.wins / s.battlesPlayed) * 100).toFixed(1) : '0.0',
  }));

  // ── Tournament stats ───────────────────────────────────────────────
  const tournamentBattles = battles.filter(b => b.battleType === 'tournament' && b.tournamentId);
  const tournamentStatsMap = new Map<number, {
    tournamentId: number; tournamentName: string; tournamentDate: Date;
    totalParticipants: number; wins: number; losses: number;
    damageDealt: number; damageTaken: number; placement: number | null;
  }>();

  tournamentBattles.forEach(battle => {
    const tournamentId = battle.tournamentId!;
    if (!tournamentStatsMap.has(tournamentId)) {
      tournamentStatsMap.set(tournamentId, {
        tournamentId,
        tournamentName: battle.tournament?.name || `Tournament #${tournamentId}`,
        tournamentDate: battle.createdAt,
        totalParticipants: battle.tournament?.totalParticipants || 0,
        wins: 0, losses: 0, damageDealt: 0, damageTaken: 0, placement: null,
      });
    }
    const stats = tournamentStatsMap.get(tournamentId)!;
    const result = getBattleResult(battle, robotId);
    const bs = getBattleStats(battle, robotId);
    if (result === 'win') stats.wins++;
    else if (result === 'loss') stats.losses++;
    stats.damageDealt += bs.damageDealt;
    stats.damageTaken += bs.damageTaken;
  });

  // Calculate tournament placements
  const tournamentStats = await Promise.all(
    Array.from(tournamentStatsMap.values()).map(async (stats) => {
      const tournamentMatches = await prisma.scheduledTournamentMatch.findMany({
        where: {
          tournamentId: stats.tournamentId,
          OR: [{ robot1Id: robotId }, { robot2Id: robotId }],
        },
        orderBy: { round: 'desc' },
      });

      let placement = stats.totalParticipants;
      if (tournamentMatches.length > 0) {
        const highestRound = tournamentMatches[0].round;
        const wonFinal = tournamentMatches.some(m => m.winnerId === robotId && m.round === highestRound);
        const maxRounds = Math.ceil(Math.log2(stats.totalParticipants));

        if (wonFinal && highestRound === maxRounds) {
          placement = 1;
        } else if (highestRound === maxRounds) {
          placement = 2;
        } else if (highestRound === maxRounds - 1) {
          placement = 3;
        } else {
          placement = Math.pow(2, maxRounds - highestRound + 1);
        }
      }

      return { ...stats, placement };
    }),
  );

  // ── Tag team stats ─────────────────────────────────────────────────
  const tagTeamBattles = battles.filter(b => b.battleType === 'tag_team');
  const tagTeamStats = {
    totalBattles: tagTeamBattles.length,
    wins: 0, losses: 0, draws: 0,
    damageDealt: 0, damageTaken: 0,
  };

  tagTeamBattles.forEach(battle => {
    const result = getBattleResult(battle, robotId);
    const bs = getBattleStats(battle, robotId);
    if (result === 'win') tagTeamStats.wins++;
    else if (result === 'loss') tagTeamStats.losses++;
    else tagTeamStats.draws++;
    tagTeamStats.damageDealt += bs.damageDealt;
    tagTeamStats.damageTaken += bs.damageTaken;
  });

  return {
    leagues: leagueStats,
    tournaments: tournamentStats,
    tagTeam: {
      ...tagTeamStats,
      winRate: tagTeamStats.totalBattles > 0
        ? ((tagTeamStats.wins / tagTeamStats.totalBattles) * 100).toFixed(1)
        : '0.0',
    },
  };
}
