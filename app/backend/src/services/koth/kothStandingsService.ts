import prisma from '../../lib/prisma';
import type { KothPlacement } from '../../types/battleLogTypes';

interface KothStandingsParams {
  view: string;
  page: number;
  limit: number;
}

export async function getKothStandings({ view, page, limit }: KothStandingsParams) {
  if (view === 'last_10') {
    return getKothStandingsLast10({ page, limit });
  }
  return getKothStandingsAllTime({ page, limit });
}

async function getKothStandingsAllTime({ page, limit }: { page: number; limit: number }) {
  const kothRobotWhere = { kothMatches: { gt: 0 }, NOT: { name: 'Bye Robot' as const } };

  const [totalEvents, uniqueParticipants, robots, total] = await Promise.all([
    prisma.scheduledKothMatch.count({ where: { status: 'completed' } }),
    prisma.robot.count({ where: kothRobotWhere }),
    prisma.robot.findMany({
      where: kothRobotWhere,
      include: {
        user: { select: { id: true, username: true, stableName: true } },
      },
      orderBy: [
        { kothWins: 'desc' },
        { kothTotalZoneScore: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.robot.count({ where: kothRobotWhere }),
  ]);

  const topRobot = robots.length > 0 ? robots[0] : null;

  const standings = robots.map((robot, index) => ({
    rank: (page - 1) * limit + index + 1,
    robotId: robot.id,
    robotName: robot.name,
    owner: robot.user.stableName || robot.user.username,
    ownerId: robot.user.id,
    kothWins: robot.kothWins,
    kothMatches: robot.kothMatches,
    winRate: robot.kothMatches > 0 ? Number((robot.kothWins / robot.kothMatches * 100).toFixed(1)) : 0,
    totalZoneScore: robot.kothTotalZoneScore,
    avgZoneScore: robot.kothMatches > 0 ? Number((robot.kothTotalZoneScore / robot.kothMatches).toFixed(1)) : 0,
    kothKills: robot.kothKills,
    bestStreak: robot.kothBestWinStreak,
  }));

  return {
    summary: {
      totalEvents,
      uniqueParticipants,
      topRobot: topRobot
        ? { id: topRobot.id, name: topRobot.name, owner: topRobot.user.stableName || topRobot.user.username }
        : null,
    },
    standings,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    view: 'all_time',
  };
}

async function getKothStandingsLast10({ page, limit }: { page: number; limit: number }) {
  // Get the last 10 completed KotH matches with their battle logs
  const recentMatches = await prisma.scheduledKothMatch.findMany({
    where: { status: 'completed', battleId: { not: null } },
    orderBy: { scheduledFor: 'desc' },
    take: 10,
    select: {
      id: true,
      battle: {
        select: {
          id: true,
          battleLog: true,
        },
      },
    },
  });

  // Aggregate per-robot stats from battle log placements
  const robotStats = new Map<number, {
    robotId: number;
    robotName: string;
    wins: number;
    matches: number;
    totalZoneScore: number;
    kills: number;
    bestStreak: number;
    currentStreak: number;
  }>();

  // Process matches in chronological order (oldest first) for streak calculation
  const chronologicalMatches = [...recentMatches].reverse();

  for (const match of chronologicalMatches) {
    if (!match.battle?.battleLog) continue;

    const log = match.battle.battleLog as unknown as { placements?: KothPlacement[] };
    if (!log.placements) continue;

    for (const placement of log.placements) {
      let stats = robotStats.get(placement.robotId);
      if (!stats) {
        stats = {
          robotId: placement.robotId,
          robotName: placement.robotName,
          wins: 0,
          matches: 0,
          totalZoneScore: 0,
          kills: 0,
          bestStreak: 0,
          currentStreak: 0,
        };
        robotStats.set(placement.robotId, stats);
      }

      stats.matches++;
      stats.totalZoneScore += placement.zoneScore;
      stats.kills += placement.kills;

      if (placement.placement === 1) {
        stats.wins++;
        stats.currentStreak++;
        stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
      } else {
        stats.currentStreak = 0;
      }
    }
  }

  // Convert to array and sort by wins desc, then zone score desc
  const allRobotStats = Array.from(robotStats.values())
    .sort((a, b) => b.wins - a.wins || b.totalZoneScore - a.totalZoneScore);

  const total = allRobotStats.length;
  const paginatedStats = allRobotStats.slice((page - 1) * limit, page * limit);

  // Fetch owner info for paginated robots
  const robotIds = paginatedStats.map(s => s.robotId);
  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIds } },
    select: { id: true, user: { select: { id: true, username: true, stableName: true } } },
  });
  const ownerMap = new Map(robots.map(r => [r.id, r.user]));

  const uniqueParticipants = allRobotStats.length;
  const topRobotStats = allRobotStats.length > 0 ? allRobotStats[0] : null;

  const standings = paginatedStats.map((stats, index) => {
    const owner = ownerMap.get(stats.robotId);
    return {
      rank: (page - 1) * limit + index + 1,
      robotId: stats.robotId,
      robotName: stats.robotName,
      owner: owner ? (owner.stableName || owner.username) : 'Unknown',
      ownerId: owner?.id ?? 0,
      kothWins: stats.wins,
      kothMatches: stats.matches,
      winRate: stats.matches > 0 ? Number((stats.wins / stats.matches * 100).toFixed(1)) : 0,
      totalZoneScore: Number(stats.totalZoneScore.toFixed(1)),
      avgZoneScore: stats.matches > 0 ? Number((stats.totalZoneScore / stats.matches).toFixed(1)) : 0,
      kothKills: stats.kills,
      bestStreak: stats.bestStreak,
    };
  });

  return {
    summary: {
      totalEvents: recentMatches.length,
      uniqueParticipants,
      topRobot: topRobotStats
        ? { id: topRobotStats.robotId, name: topRobotStats.robotName, owner: standings[0]?.owner ?? 'Unknown' }
        : null,
    },
    standings,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    view: 'last_10',
  };
}
