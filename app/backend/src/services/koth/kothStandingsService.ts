import prisma from '../../lib/prisma';
import type { KothPlacement } from '../../types/battleLogTypes';

interface KothStandingsParams {
  view: string;
  page: number;
  limit: number;
  tier?: string;
  instance?: string;
}

export async function getKothStandings({ view, page, limit, tier, instance }: KothStandingsParams) {
  if (view === 'last_10') {
    return getKothStandingsLast10({ page, limit });
  }
  return getKothStandingsAllTime({ page, limit, tier, instance });
}

async function getKothStandingsAllTime({ page, limit, tier, instance }: { page: number; limit: number; tier?: string; instance?: string }) {
  const kothWhere = {
    mode: 'koth' as const,
    entityType: 'robot',
    ...(tier && { tier }),
    ...(instance && { leagueInstanceId: instance }),
  };

  const [totalEvents, total, standings_rows] = await Promise.all([
    prisma.scheduledMatch.count({ where: { matchType: 'koth' as any, status: 'completed' } }),
    prisma.standing.count({ where: kothWhere }),
    prisma.standing.findMany({
      where: kothWhere,
      orderBy: [
        { leaguePoints: 'desc' },
        { totalZoneScore: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  // Fetch robot names and owner info for the standings
  const robotIds = standings_rows.map(s => s.entityId);
  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIds } },
    select: {
      id: true,
      name: true,
      user: { select: { id: true, username: true, stableName: true } },
    },
  });
  const robotMap = new Map(robots.map(r => [r.id, r]));

  // Batch-check KotH subscription status
  const kothSubs = await prisma.subscription.findMany({
    where: { robotId: { in: robotIds }, eventType: 'koth', status: 'active' },
    select: { robotId: true },
  });
  const subscribedKothRobotIds = new Set(kothSubs.map(s => s.robotId));

  const topStanding = standings_rows.length > 0 ? standings_rows[0] : null;
  const topRobot = topStanding ? robotMap.get(topStanding.entityId) : null;

  const standings = standings_rows.map((standing, index) => {
    const robot = robotMap.get(standing.entityId);
    const kothMatches = standing.totalMatches ?? 0;
    const kothWins = standing.wins;
    return {
      rank: (page - 1) * limit + index + 1,
      robotId: standing.entityId,
      robotName: robot?.name ?? `Robot #${standing.entityId}`,
      owner: robot?.user ? (robot.user.stableName || robot.user.username) : 'Unknown',
      ownerId: robot?.user?.id ?? 0,
      isSubscribed: subscribedKothRobotIds.has(standing.entityId),
      kothWins,
      kothMatches,
      kothPoints: standing.leaguePoints,
      tier: standing.tier,
      leagueInstanceId: standing.leagueInstanceId,
      winRate: kothMatches > 0 ? Number((kothWins / kothMatches * 100).toFixed(1)) : 0,
      totalZoneScore: standing.totalZoneScore ?? 0,
      avgZoneScore: kothMatches > 0 ? Number(((standing.totalZoneScore ?? 0) / kothMatches).toFixed(1)) : 0,
      kothKills: standing.totalKills ?? 0,
      bestStreak: standing.bestWinStreak,
      bestPlacement: standing.bestPlacement,
    };
  });

  return {
    summary: {
      totalEvents,
      uniqueParticipants: total,
      topRobot: topRobot
        ? { id: topRobot.id, name: topRobot.name, owner: topRobot.user.stableName || topRobot.user.username }
        : null,
    },
    standings,
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
    view: 'all_time',
  };
}

async function getKothStandingsLast10({ page, limit }: { page: number; limit: number }) {
  // Get the last 10 completed KotH matches with their battle logs (unified table)
  const recentMatches = await prisma.scheduledMatch.findMany({
    where: { matchType: 'koth' as any, status: 'completed', battleId: { not: null } },
    orderBy: { scheduledFor: 'desc' },
    take: 10,
    select: {
      id: true,
      battleId: true,
    },
  });

  // Load battle logs for completed matches
  const battleIds = recentMatches.map(m => m.battleId).filter((id): id is number => id !== null);
  const battles = battleIds.length > 0
    ? await prisma.battle.findMany({
        where: { id: { in: battleIds } },
        select: { id: true, battleLog: true },
      })
    : [];
  const battleMap = new Map(battles.map(b => [b.id, b]));

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
    const battle = match.battleId ? battleMap.get(match.battleId) : null;
    if (!battle?.battleLog) continue;

    const log = battle.battleLog as unknown as { placements?: KothPlacement[] };
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
  const topRobotStats = allRobotStats.length > 0 ? allRobotStats[0] : null;

  // Fetch owner info for paginated robots (and top robot if not on current page)
  const robotIdsToFetch = [...new Set([...paginatedStats.map(s => s.robotId), ...(topRobotStats ? [topRobotStats.robotId] : [])])];
  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIdsToFetch } },
    select: { id: true, user: { select: { id: true, username: true, stableName: true } } },
  });
  const ownerMap = new Map(robots.map(r => [r.id, r.user]));

  // Batch-check KotH subscription status
  const kothSubsLast10 = await prisma.subscription.findMany({
    where: { robotId: { in: robotIdsToFetch }, eventType: 'koth', status: 'active' },
    select: { robotId: true },
  });
  const subscribedKothIds = new Set(kothSubsLast10.map(s => s.robotId));

  const uniqueParticipants = allRobotStats.length;
  const topRobotOwner = topRobotStats ? ownerMap.get(topRobotStats.robotId) : null;

  const standings = paginatedStats.map((stats, index) => {
    const owner = ownerMap.get(stats.robotId);
    return {
      rank: (page - 1) * limit + index + 1,
      robotId: stats.robotId,
      robotName: stats.robotName,
      owner: owner ? (owner.stableName || owner.username) : 'Unknown',
      ownerId: owner?.id ?? 0,
      isSubscribed: subscribedKothIds.has(stats.robotId),
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
        ? { id: topRobotStats.robotId, name: topRobotStats.robotName, owner: topRobotOwner ? (topRobotOwner.stableName || topRobotOwner.username) : 'Unknown' }
        : null,
    },
    standings,
    pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
    view: 'last_10',
  };
}
