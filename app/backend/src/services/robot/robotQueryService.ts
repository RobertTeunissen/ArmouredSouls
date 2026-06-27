/**
 * Robot query helpers.
 *
 * Extracts the complex Prisma queries and response-formatting logic from
 * the robots route handlers so the routes stay thin.
 */

import prisma from '../../lib/prisma';
import schedulingService from '../scheduling/schedulingService';
import type { BattleParticipant, Prisma } from '../../../generated/prisma';

// ── Shared include fragments ─────────────────────────────────────────

// Spec #34: include refinements so the frontend can render the rank prefix
// and slot bar on equipped weapons in robot listings and the robot detail page.
const WEAPON_INCLUDE = {
  mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' as const } } } },
  offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' as const } } } },
} as const;

// ── Typed query result for battles with participants ─────────────────

type BattleWithParticipants = Prisma.BattleGetPayload<{
  select: {
    id: true;
    battleType: true;
    leagueType: true;
    tournamentId: true;
    winnerId: true;
    createdAt: true;
    battleLog: true;
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

export async function findAllRobots(page = 1, perPage = 100) {
  // Clamp inputs to prevent invalid skip/take values
  const safePage = Math.max(1, Math.floor(page));
  const safePerPage = Math.min(200, Math.max(1, Math.floor(perPage)));

  return prisma.robot.findMany({
    include: {
      user: { select: { username: true } },
      ...WEAPON_INCLUDE,
    },
    orderBy: { elo: 'desc' },
    skip: (safePage - 1) * safePerPage,
    take: safePerPage,
  });
}

// ── GET / (user's robots) ────────────────────────────────────────────

export async function findUserRobots(userId: number) {
  const robots = await prisma.robot.findMany({
    where: { userId },
    include: {
      ...WEAPON_INCLUDE,
      teamBattleMembers: {
        include: {
          team: {
            select: { id: true, teamSize: true, teamName: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Enrich with standings data (Spec #40 — LP, wins/losses/draws now live in standings table)
  const robotIds = robots.map(r => r.id);
  const standings = await prisma.standing.findMany({
    where: { entityType: 'robot', entityId: { in: robotIds }, mode: 'league_1v1' },
    select: { entityId: true, leaguePoints: true, wins: true, losses: true, draws: true, tier: true, leagueInstanceId: true, cyclesInTier: true, currentWinStreak: true, bestWinStreak: true, currentLoseStreak: true },
  });

  const standingsMap = new Map(standings.map(s => [s.entityId, s]));

  return robots.map(robot => {
    const standing = standingsMap.get(robot.id);
    if (standing) {
      return {
        ...robot,
        leaguePoints: standing.leaguePoints,
        currentLeague: standing.tier,
        leagueId: standing.leagueInstanceId,
        cyclesInCurrentLeague: standing.cyclesInTier,
        totalLeague1v1Wins: standing.wins,
        totalLeague1v1Losses: standing.losses,
        totalLeague1v1Draws: standing.draws,
        currentWinStreak: standing.currentWinStreak,
        bestWinStreak: standing.bestWinStreak,
        currentLoseStreak: standing.currentLoseStreak,
      };
    }
    return robot;
  });
}

// ── GET /:id ─────────────────────────────────────────────────────────

export async function findRobotById(robotId: number) {
  const robot = await prisma.robot.findUnique({
    where: { id: robotId },
    include: {
      ...WEAPON_INCLUDE,
      user: { select: { username: true, stableName: true } },
    },
  });

  if (!robot) return null;

  // Enrich with standings data (Spec #40 — LP, wins/losses now live in standings table)
  const standing = await prisma.standing.findFirst({
    where: { entityType: 'robot', entityId: robot.id, mode: 'league_1v1' },
    select: { leaguePoints: true, wins: true, losses: true, draws: true, tier: true, leagueInstanceId: true, cyclesInTier: true, currentWinStreak: true, bestWinStreak: true, currentLoseStreak: true },
  });

  if (standing) {
    return {
      ...robot,
      leaguePoints: standing.leaguePoints,
      currentLeague: standing.tier,
      leagueId: standing.leagueInstanceId,
      cyclesInCurrentLeague: standing.cyclesInTier,
      totalLeague1v1Wins: standing.wins,
      totalLeague1v1Losses: standing.losses,
      totalLeague1v1Draws: standing.draws,
      currentWinStreak: standing.currentWinStreak,
      bestWinStreak: standing.bestWinStreak,
      currentLoseStreak: standing.currentLoseStreak,
    };
  }

  return robot;
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
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  robot: { id: number; name: string };
}

export async function getMatchHistory(
  robotId: number,
  robotName: string,
  page: number,
  perPage: number,
): Promise<PaginatedMatchesResult> {
  const total = await prisma.battle.count({
    where: { participants: { some: { robotId: robotId } } },
  });

  const battles = await prisma.battle.findMany({
    where: { participants: { some: { robotId: robotId } } },
    include: {
      participants: {
        include: { robot: { include: { user: { select: { id: true, username: true } } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * perPage,
    take: perPage,
  });

  const data = battles.map(battle => {
    const thisParticipant = battle.participants.find(p => p.robotId === robotId);
    // Find opponent: pick the primary participant on the opposing team (active/solo preferred)
    const myTeam = thisParticipant?.team ?? 1;
    const opponents = battle.participants.filter(p => p.team !== myTeam);
    const opponentParticipant = opponents.find(p => p.role === 'active' || p.role === null || p.role === 'solo') ?? opponents[0];
    const opponent = opponentParticipant?.robot;
    const won = battle.winnerId === robotId;

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
        id: opponent?.id || 0,
        name: opponent?.name || 'Unknown',
        owner: opponent?.user?.username || 'Unknown',
        finalHP: opponentParticipant?.finalHP || 0,
        damageDealt: opponentParticipant?.damageDealt || 0,
      },
    };
  });

  return {
    data,
    pagination: { page, pageSize: perPage, total, totalPages: Math.ceil(total / perPage) },
    robot: { id: robotId, name: robotName },
  };
}

// ── GET /:id/upcoming ────────────────────────────────────────────────

export async function getUpcomingScheduledMatches(robotId: number, robotName: string) {
  // Single query via unified scheduling service (replaces 4-table fan-out)
  const upcoming = await schedulingService.getUpcomingForRobot(robotId);

  // Fetch opponent robot details for each match
  const formattedMatches = [];
  for (const match of upcoming) {
    const opponentParticipant = match.participants.find(
      (p) => p.participantId !== robotId && p.participantType === 'robot'
    );
    if (!opponentParticipant) continue;

    const opponent = await prisma.robot.findUnique({
      where: { id: opponentParticipant.participantId },
      include: { user: { select: { id: true, username: true } } },
    });
    if (!opponent) continue;

    formattedMatches.push({
      matchId: match.id,
      scheduledFor: match.scheduledFor,
      matchType: match.matchType,
      leagueType: match.leagueType,
      opponent: {
        id: opponent.id,
        name: opponent.name,
        elo: opponent.elo,
        owner: opponent.user.username,
      },
    });
  }

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

  // Single unified query via SchedulingService (replaces 4-table fan-out)
  const upcoming = await schedulingService.getUpcomingForRobot(robotId);

  // Resolve opponent info for each match
  const formattedMatches = [];
  for (const match of upcoming) {
    const opponentParticipant = match.participants.find(
      (p) => p.participantId !== robotId
    );

    let opponentName = 'TBD';
    let opponentPortrait = '/src/assets/robots/robot-1.png';

    if (opponentParticipant && opponentParticipant.participantType === 'robot') {
      const opponent = await prisma.robot.findUnique({
        where: { id: opponentParticipant.participantId },
        select: { id: true, name: true, imageUrl: true },
      });
      if (opponent) {
        opponentName = opponent.name;
        opponentPortrait = opponent.imageUrl || opponentPortrait;
      }
    }

    formattedMatches.push({
      matchId: match.id,
      opponentName,
      opponentPortrait,
      scheduledTime: match.scheduledFor.toISOString(),
      battleType: match.matchType,
      leagueContext: match.leagueType,
    });
  }

  // Sort by scheduled time
  formattedMatches.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

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

  let damageTaken: number;
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
  // Get all battles for this robot (including tag team and team battles via participants)
  const battles: BattleWithParticipants[] = await prisma.battle.findMany({
    where: {
      participants: { some: { robotId } },
    },
    select: {
      id: true,
      battleType: true,
      leagueType: true,
      tournamentId: true,
      winnerId: true,
      createdAt: true,
      battleLog: true,
      participants: true,
      tournament: { select: { id: true, name: true, totalParticipants: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // ── League stats ───────────────────────────────────────────────────
  const leagueBattles = battles.filter(b => b.battleType === 'league_1v1');
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
  const tournamentBattles = battles.filter(b =>
    (b.battleType === 'tournament_1v1' || b.battleType === 'tournament_2v2' || b.battleType === 'tournament_3v3')
    && b.tournamentId
  );
  const tournamentStatsMap = new Map<number, {
    tournamentId: number; tournamentName: string; tournamentDate: Date;
    totalParticipants: number; wins: number; losses: number;
    damageDealt: number; damageTaken: number; placement: number | null;
    battleType: string; participantType: string;
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
        battleType: battle.battleType,
        participantType: battle.battleType === 'tournament_1v1' ? 'robot'
          : battle.battleType === 'tournament_2v2' ? 'team_2v2' : 'team_3v3',
      });
    }
    const stats = tournamentStatsMap.get(tournamentId)!;
    // For team tournaments, determine win/loss from participant's team side
    if (battle.battleType === 'tournament_2v2' || battle.battleType === 'tournament_3v3') {
      const winningSide = (battle as unknown as { winningSide?: number | null }).winningSide
        ?? (battle.battleLog as unknown as { winningSide?: 1 | 2 | null })?.winningSide
        ?? null;
      const participant = battle.participants.find(p => p.robotId === robotId);
      if (participant) {
        if (winningSide === null) { /* draw - no W/L */ }
        else if (winningSide === participant.team) stats.wins++;
        else stats.losses++;
        stats.damageDealt += participant.damageDealt ?? 0;
      }
    } else {
      const result = getBattleResult(battle, robotId);
      const bs = getBattleStats(battle, robotId);
      if (result === 'win') stats.wins++;
      else if (result === 'loss') stats.losses++;
      stats.damageDealt += bs.damageDealt;
      stats.damageTaken += bs.damageTaken;
    }
  });

  // Calculate tournament placements
  // For team tournaments, look up the team ID to query placement
  const teamMemberships = await prisma.teamBattleMember.findMany({
    where: { robotId },
    select: { team: { select: { id: true, teamSize: true } } },
  });
  const teamIdBySize = new Map<number, number>();
  for (const m of teamMemberships) {
    teamIdBySize.set(m.team.teamSize, m.team.id);
  }

  const tournamentStats = await Promise.all(
    Array.from(tournamentStatsMap.values()).map(async (stats) => {
      // Determine the participant ID and type for match lookup
      let participantId = robotId;
      let participantType = 'robot';
      if (stats.battleType === 'tournament_2v2') {
        participantId = teamIdBySize.get(2) ?? robotId;
        participantType = 'team_2v2';
      } else if (stats.battleType === 'tournament_3v3') {
        participantId = teamIdBySize.get(3) ?? robotId;
        participantType = 'team_3v3';
      }

      const tournamentMatches = await prisma.scheduledTournamentMatch.findMany({
        where: {
          tournamentId: stats.tournamentId,
          participantType,
          OR: [{ participant1Id: participantId }, { participant2Id: participantId }],
        },
        orderBy: { round: 'desc' },
      });

      let placement = stats.totalParticipants;
      if (tournamentMatches.length > 0) {
        const highestRound = tournamentMatches[0].round;
        const wonFinal = tournamentMatches.some(m => m.winnerId === participantId && m.round === highestRound);
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

  // ── 2v2 League stats ────────────────────────────────────────────────
  const league2v2Battles = battles.filter(b => b.battleType === 'league_2v2');
  const league2v2Stats = {
    totalBattles: league2v2Battles.length,
    wins: 0, losses: 0, draws: 0,
    damageDealt: 0, damageTaken: 0,
  };

  league2v2Battles.forEach(battle => {
    const winningSide = (battle as unknown as { winningSide?: number | null }).winningSide
      ?? (battle.battleLog as unknown as { winningSide?: 1 | 2 | null })?.winningSide
      ?? null;
    const participant = battle.participants.find(p => p.robotId === robotId);
    if (!participant) return;
    const myTeam = participant.team;
    if (winningSide === null) league2v2Stats.draws++;
    else if (winningSide === myTeam) league2v2Stats.wins++;
    else league2v2Stats.losses++;
    league2v2Stats.damageDealt += participant.damageDealt ?? 0;
  });

  // ── 3v3 League stats ────────────────────────────────────────────────
  const league3v3Battles = battles.filter(b => b.battleType === 'league_3v3');
  const league3v3Stats = {
    totalBattles: league3v3Battles.length,
    wins: 0, losses: 0, draws: 0,
    damageDealt: 0, damageTaken: 0,
  };

  league3v3Battles.forEach(battle => {
    const winningSide = (battle as unknown as { winningSide?: number | null }).winningSide
      ?? (battle.battleLog as unknown as { winningSide?: 1 | 2 | null })?.winningSide
      ?? null;
    const participant = battle.participants.find(p => p.robotId === robotId);
    if (!participant) return;
    const myTeam = participant.team;
    if (winningSide === null) league3v3Stats.draws++;
    else if (winningSide === myTeam) league3v3Stats.wins++;
    else league3v3Stats.losses++;
    league3v3Stats.damageDealt += participant.damageDealt ?? 0;
  });

  // ── KotH stats ──────────────────────────────────────────────────────
  const kothBattles = battles.filter(b => b.battleType === 'koth');
  const kothStats = {
    totalBattles: kothBattles.length,
    wins: 0, // 1st place finishes
    topThree: 0,
    totalPoints: 0,
    bestPlacement: null as number | null,
    damageDealt: 0,
    damageTaken: 0,
  };

  kothBattles.forEach(battle => {
    const participant = battle.participants.find(p => p.robotId === robotId);
    if (!participant) return;
    const placement = participant.placement ?? 6;
    if (placement === 1) kothStats.wins++;
    if (placement <= 3) kothStats.topThree++;
    // F1-style points: [10, 6, 4, 2, 1, 0]
    const pointScale = [10, 6, 4, 2, 1, 0];
    kothStats.totalPoints += placement <= pointScale.length ? pointScale[placement - 1] : 0;
    if (kothStats.bestPlacement === null || placement < kothStats.bestPlacement) {
      kothStats.bestPlacement = placement;
    }
    kothStats.damageDealt += participant.damageDealt ?? 0;
    // Damage taken = sum of all other participants' damageDealt
    const otherParticipants = battle.participants.filter(p => p.robotId !== robotId);
    kothStats.damageTaken += otherParticipants.reduce((sum, p) => sum + (p.damageDealt ?? 0), 0);
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
    league2v2: {
      ...league2v2Stats,
      winRate: league2v2Stats.totalBattles > 0
        ? ((league2v2Stats.wins / league2v2Stats.totalBattles) * 100).toFixed(1)
        : '0.0',
    },
    league3v3: {
      ...league3v3Stats,
      winRate: league3v3Stats.totalBattles > 0
        ? ((league3v3Stats.wins / league3v3Stats.totalBattles) * 100).toFixed(1)
        : '0.0',
    },
    koth: {
      ...kothStats,
      winRate: kothStats.totalBattles > 0
        ? ((kothStats.wins / kothStats.totalBattles) * 100).toFixed(1)
        : '0.0',
    },
  };
}
