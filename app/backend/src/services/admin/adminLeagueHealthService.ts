import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { StandingsMode } from '../../../generated/prisma';

/**
 * Get league health metrics.
 */
export async function getLeagueHealth(_userFilter: Prisma.UserWhereInput = {}) {
  const leagues = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];

  // Use standings table for league health (source of truth)
  const robotsByLeague = await prisma.standing.groupBy({
    by: ['tier'],
    where: { mode: 'league_1v1', entityType: 'robot' },
    _count: { id: true },
  });

  // Get average ELO per tier via raw query joining standings → robots
  const eloByTier = await prisma.$queryRaw<Array<{ tier: string; avg_elo: number | null }>>`
    SELECT s."tier", AVG(r.elo) as avg_elo
    FROM "standings" s
    JOIN "robots" r ON r.id = s."entity_id"
    WHERE s."entity_type" = 'robot' AND s."mode" = 'league_1v1'
    GROUP BY s."tier"
  `;

  // Count distinct league instances per tier from standings
  const instancesByLeague = await prisma.standing.groupBy({
    by: ['tier', 'leagueInstanceId'],
    where: { mode: 'league_1v1', entityType: 'robot' },
    _count: { id: true },
  });

  const leagueData = leagues.map((league) => {
    const data = robotsByLeague.find((r) => r.tier === league);
    const eloData = eloByTier.find((e) => e.tier === league);
    const instances = instancesByLeague.filter((r) => r.tier === league);
    return {
      league,
      robotCount: data?._count.id ?? 0,
      averageElo: Math.round(eloData?.avg_elo ?? 0),
      instances: instances.length,
      instanceDetails: instances.map((i) => ({
        id: i.leagueInstanceId,
        robotCount: i._count.id,
      })),
    };
  });

  const totalRobots = leagueData.reduce((sum, l) => sum + l.robotCount, 0);

  return {
    leagues: leagueData,
    totalRobots,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get team battle league health metrics for 2v2 and 3v3 leagues.
 * Returns per-tier team counts, instance counts, avg ELO, and needs-rebalancing indicators.
 */
export async function getTeamBattleLeagueHealth() {
  const leagues = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];
  const MAX_TEAMS_PER_INSTANCE = 50;
  const REBALANCE_THRESHOLD = 10;

  async function getLeagueDataForSize(teamSize: 2 | 3) {
    const mode: StandingsMode = teamSize === 2 ? StandingsMode.league_2v2 : StandingsMode.league_3v3;

    // Get team counts per tier from standings (source of truth)
    const teamsByLeague = await prisma.standing.groupBy({
      by: ['tier'],
      where: { mode, entityType: 'team' },
      _count: { id: true },
    });

    // Get instance details per tier from standings
    const instancesByLeague = await prisma.standing.groupBy({
      by: ['tier', 'leagueInstanceId'],
      where: { mode, entityType: 'team' },
      _count: { id: true },
    });

    // Get average ELO per tier (computed from member robots)
    const teamsWithMembers = await prisma.teamBattle.findMany({
      where: { teamSize },
      select: {
        id: true,
        members: {
          select: {
            robot: {
              select: { elo: true },
            },
          },
        },
      },
    });

    // Get each team's tier from standings
    const teamStandings = await prisma.standing.findMany({
      where: { mode, entityType: 'team', entityId: { in: teamsWithMembers.map(t => t.id) } },
      select: { entityId: true, tier: true },
    });
    const tierByTeamId = new Map(teamStandings.map(s => [s.entityId, s.tier]));

    // Compute average team ELO per tier
    const eloByTier: Record<string, { totalElo: number; teamCount: number }> = {};
    for (const team of teamsWithMembers) {
      const tier = tierByTeamId.get(team.id) ?? 'bronze';
      const teamElo = team.members.reduce((sum, m) => sum + m.robot.elo, 0);
      if (!eloByTier[tier]) {
        eloByTier[tier] = { totalElo: 0, teamCount: 0 };
      }
      eloByTier[tier].totalElo += teamElo;
      eloByTier[tier].teamCount += 1;
    }

    const leagueData = leagues.map((league) => {
      const data = teamsByLeague.find((r) => r.tier === league);
      const instances = instancesByLeague.filter((r) => r.tier === league);
      const teamCount = data?._count.id ?? 0;
      const eloData = eloByTier[league];
      const averageElo = eloData && eloData.teamCount > 0
        ? Math.round(eloData.totalElo / eloData.teamCount)
        : 0;

      // Determine needs-rebalancing: overflow or imbalance
      const instanceCounts = instances.map((i) => i._count.id);
      const hasOverflow = instanceCounts.some((c) => c > MAX_TEAMS_PER_INSTANCE);
      const totalInInstances = instanceCounts.reduce((sum, c) => sum + c, 0);
      const targetPerInstance = instances.length > 0 ? Math.ceil(totalInInstances / instances.length) : 0;
      const hasImbalance = instances.length >= 2 && instanceCounts.some((c) =>
        Math.abs(c - targetPerInstance) > REBALANCE_THRESHOLD
      );
      const needsRebalancing = hasOverflow || hasImbalance;

      return {
        league,
        teamCount,
        averageElo,
        instances: instances.length,
        instanceDetails: instances.map((i) => ({
          id: i.leagueInstanceId,
          teamCount: i._count.id,
        })),
        needsRebalancing,
      };
    });

    const totalTeams = leagueData.reduce((sum, l) => sum + l.teamCount, 0);

    return { leagues: leagueData, totalTeams };
  }

  const [league2v2, league3v3] = await Promise.all([
    getLeagueDataForSize(2),
    getLeagueDataForSize(3),
  ]);

  return {
    league2v2,
    league3v3,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get tag team league health metrics.
 * Returns per-tier team counts, instance counts, teams per instance (min/max/avg),
 * and needs-rebalancing indicators for the tag team league (teamSize=2, tagTeamLeague fields).
 */
export async function getTagTeamLeagueHealth() {
  const leagues = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];
  const MAX_TEAMS_PER_INSTANCE = 50;
  const MIN_TEAMS_FOR_TIER = 10;

  // Get team counts per tag team tier from standings (source of truth)
  const teamsByLeague = await prisma.standing.groupBy({
    by: ['tier'],
    where: { mode: StandingsMode.tag_team, entityType: 'team' },
    _count: { id: true },
  });

  // Get instance details per tag team tier from standings
  const instancesByLeague = await prisma.standing.groupBy({
    by: ['tier', 'leagueInstanceId'],
    where: { mode: StandingsMode.tag_team, entityType: 'team' },
    _count: { id: true },
  });

  const leagueData = leagues.map((league) => {
    const data = teamsByLeague.find((r) => r.tier === league);
    const instances = instancesByLeague.filter((r) => r.tier === league);
    const teamCount = data?._count.id ?? 0;
    const instanceCounts = instances.map((i) => i._count.id);

    // Compute teams per instance stats
    const teamsPerInstanceMin = instanceCounts.length > 0 ? Math.min(...instanceCounts) : 0;
    const teamsPerInstanceMax = instanceCounts.length > 0 ? Math.max(...instanceCounts) : 0;
    const teamsPerInstanceAvg = instanceCounts.length > 0
      ? Math.round(instanceCounts.reduce((sum, c) => sum + c, 0) / instanceCounts.length)
      : 0;

    // Determine needs-rebalancing: any instance exceeds 50 teams or team count below minimum threshold (10)
    const hasOverflow = instanceCounts.some((c) => c > MAX_TEAMS_PER_INSTANCE);
    const belowMinimum = teamCount > 0 && teamCount < MIN_TEAMS_FOR_TIER;
    const needsRebalancing = hasOverflow || belowMinimum;

    return {
      league,
      teamCount,
      instances: instances.length,
      instanceDetails: instances.map((i) => ({
        id: i.leagueInstanceId,
        teamCount: i._count.id,
      })),
      teamsPerInstance: {
        min: teamsPerInstanceMin,
        max: teamsPerInstanceMax,
        avg: teamsPerInstanceAvg,
      },
      needsRebalancing,
    };
  });

  const totalTeams = leagueData.reduce((sum, l) => sum + l.teamCount, 0);

  return {
    leagues: leagueData,
    totalTeams,
    timestamp: new Date().toISOString(),
  };
}
