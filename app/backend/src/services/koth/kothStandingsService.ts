import prisma from '../../lib/prisma';

interface KothStandingsParams {
  view: string;
  page: number;
  limit: number;
}

export async function getKothStandings({ view, page, limit }: KothStandingsParams) {
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
    view,
  };
}
