import { MatchType } from '../../../generated/prisma';
import prisma from '../../lib/prisma';

interface KothStandingsParams {
  view: string;
  page: number;
  limit: number;
  tier?: string;
  instance?: string;
}

export async function getKothStandings({ view: _view, page, limit, tier, instance }: KothStandingsParams) {
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
    prisma.scheduledMatch.count({ where: { matchType: MatchType.koth, status: 'completed' } }),
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


