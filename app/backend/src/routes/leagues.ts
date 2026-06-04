import express, { Request, Response } from 'express';
import { z } from 'zod';
import { getInstancesForTier, LeagueTier, LEAGUE_TIERS } from '../services/league/leagueInstanceService';
import { getMinLPForPromotion } from '../services/league/leaguePromotionThresholds';
import prisma from '../lib/prisma';
import type { Prisma } from '../../generated/prisma';
import { LeagueError, LeagueErrorCode } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';
import { authenticateToken, AuthRequest } from '../middleware/auth';

// Constants matching leagueRebalancingService.ts
const PROMOTION_PERCENTAGE = 0.10;
const DEMOTION_PERCENTAGE = 0.10;
const MIN_CYCLES_IN_LEAGUE = 5;
const MIN_ROBOTS_FOR_REBALANCING = 10;

const router = express.Router();

// --- Zod schemas for league routes ---

const leagueTierParamsSchema = z.object({
  tier: z.string().min(1).max(30),
});

/**
 * GET /api/leagues/:tier/standings
 * Get league standings for a specific tier and instance
 */
router.get('/:tier/standings', validateRequest({ params: leagueTierParamsSchema }), async (req: Request, res: Response) => {
  const tier = req.params.tier as LeagueTier;
  const instance = req.query.instance as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 50));

  if (!LEAGUE_TIERS.includes(tier)) {
    throw new LeagueError(LeagueErrorCode.INVALID_LEAGUE_TIER, 'Invalid tier', 400, { validTiers: LEAGUE_TIERS });
  }

  let leagueIds: string[];
  if (instance) {
    leagueIds = [instance];
  } else {
    const instances = await getInstancesForTier(tier);
    leagueIds = instances.map(i => i.leagueId);
  }

  const whereClause: Prisma.RobotWhereInput = {
    leagueId: { in: leagueIds },
    NOT: { name: 'Bye Robot' },
  };

  const total = await prisma.robot.count({ where: whereClause });

  const robots = await prisma.robot.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, username: true, stableName: true } },
    },
    orderBy: [
      { leaguePoints: 'desc' },
      { elo: 'desc' },
    ],
    skip: (page - 1) * perPage,
    take: perPage,
  });

  // Calculate promotion/demotion zone metadata
  const minLP = getMinLPForPromotion(tier);
  const isChampion = tier === 'champion';
  const isBronze = tier === 'bronze';
  const isSingleInstance = instance !== undefined;

  let eligibleCount = 0;
  let hasEnoughRobots = false;
  let promotionCount = 0;
  let demotionCount = 0;
  let promotionRobotIds: Set<number> = new Set();
  let demotionRobotIds: Set<number> = new Set();

  if (isSingleInstance) {
    // Count eligible robots (≥5 cycles) in this specific instance
    eligibleCount = await prisma.robot.count({
      where: {
        leagueId: instance,
        cyclesInCurrentLeague: { gte: MIN_CYCLES_IN_LEAGUE },
        NOT: { name: 'Bye Robot' },
      },
    });

    hasEnoughRobots = eligibleCount >= MIN_ROBOTS_FOR_REBALANCING;
    promotionCount = hasEnoughRobots ? Math.floor(eligibleCount * PROMOTION_PERCENTAGE) : 0;
    demotionCount = hasEnoughRobots ? Math.floor(eligibleCount * DEMOTION_PERCENTAGE) : 0;

    // For demotion zone, get the IDs of robots in the bottom 10% of eligible robots
    if (hasEnoughRobots && demotionCount > 0 && !isBronze) {
      const demotionRobots = await prisma.robot.findMany({
        where: {
          leagueId: instance,
          cyclesInCurrentLeague: { gte: MIN_CYCLES_IN_LEAGUE },
          NOT: { name: 'Bye Robot' },
        },
        orderBy: [
          { leaguePoints: 'asc' },
          { elo: 'asc' },
        ],
        select: { id: true },
        take: demotionCount,
      });
      demotionRobotIds = new Set(demotionRobots.map(r => r.id));
    }

    // For promotion zone, get the IDs of robots that meet ALL criteria
    if (hasEnoughRobots && promotionCount > 0 && !isChampion) {
      const promotionRobots = await prisma.robot.findMany({
        where: {
          leagueId: instance,
          cyclesInCurrentLeague: { gte: MIN_CYCLES_IN_LEAGUE },
          leaguePoints: { gte: minLP },
          NOT: { name: 'Bye Robot' },
        },
        orderBy: [
          { leaguePoints: 'desc' },
          { elo: 'desc' },
        ],
        select: { id: true },
        take: promotionCount,
      });
      promotionRobotIds = new Set(promotionRobots.map(r => r.id));
    }
  } else {
    // Tier-wide eligible count (no per-robot zone highlighting without a specific instance)
    eligibleCount = await prisma.robot.count({
      where: {
        leagueId: { in: leagueIds },
        cyclesInCurrentLeague: { gte: MIN_CYCLES_IN_LEAGUE },
        NOT: { name: 'Bye Robot' },
      },
    });

    hasEnoughRobots = eligibleCount >= MIN_ROBOTS_FOR_REBALANCING;
  }

  // Batch-check subscription status for all robots on this page
  const robotIds = robots.map(r => r.id);
  const activeSubscriptions = await prisma.subscription.findMany({
    where: { robotId: { in: robotIds }, eventType: 'league_1v1', status: 'active' },
    select: { robotId: true },
  });
  const subscribedRobotIds = new Set(activeSubscriptions.map(s => s.robotId));

  const standings = robots.map((robot) => ({
    id: robot.id,
    name: robot.name,
    elo: robot.elo,
    leaguePoints: robot.leaguePoints,
    wins: robot.totalLeague1v1Wins,
    draws: robot.totalLeague1v1Draws,
    losses: robot.totalLeague1v1Losses,
    totalBattles: robot.totalLeague1v1Wins + robot.totalLeague1v1Losses + robot.totalLeague1v1Draws,
    currentHP: robot.currentHP,
    maxHP: robot.maxHP,
    fame: robot.fame,
    userId: robot.user.id,
    cyclesInCurrentLeague: robot.cyclesInCurrentLeague,
    eligible: robot.cyclesInCurrentLeague >= MIN_CYCLES_IN_LEAGUE,
    isSubscribed: subscribedRobotIds.has(robot.id),
    user: {
      username: robot.user.username,
      stableName: robot.user.stableName,
    },
    zone: promotionRobotIds.has(robot.id)
      ? 'promotion' as const
      : demotionRobotIds.has(robot.id)
        ? 'demotion' as const
        : null,
  }));

  res.json({
    data: standings,
    pagination: {
      page,
      pageSize: perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
    zoneMeta: {
      tier,
      minLP,
      minCycles: MIN_CYCLES_IN_LEAGUE,
      minRobotsRequired: MIN_ROBOTS_FOR_REBALANCING,
      eligibleCount,
      hasEnoughRobots,
      promotionSlots: promotionCount,
      demotionSlots: demotionCount,
      isChampion,
      isBronze,
    },
  });
});

/**
 * GET /api/leagues/:tier/instances
 * Get all instances for a tier
 */
router.get('/:tier/instances', validateRequest({ params: leagueTierParamsSchema }), async (req: Request, res: Response) => {
  const tier = req.params.tier as LeagueTier;

  if (!LEAGUE_TIERS.includes(tier)) {
    throw new LeagueError(LeagueErrorCode.INVALID_LEAGUE_TIER, 'Invalid tier', 400, { validTiers: LEAGUE_TIERS });
  }

  const instances = await getInstancesForTier(tier);

  res.json(instances.map(instance => ({
    leagueId: instance.leagueId,
    leagueTier: tier,
    currentRobots: instance.currentRobots,
    maxRobots: instance.maxRobots,
  })));
});

/**
 * GET /api/leagues/tier-changes/unseen
 * Returns league tier changes (promotions/demotions) for the current user's robots
 * that occurred since their previous login. Used for dashboard notifications.
 */
router.get('/tier-changes/unseen', authenticateToken, validateRequest({}), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user!.userId;

  // Show tier changes from the last 24 hours. Using a fixed window avoids the
  // race where lastLoginAt is updated at login time (before the dashboard loads),
  // which would cause the endpoint to return no results on the current session.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const changes = await prisma.leagueHistory.findMany({
    where: {
      userId,
      createdAt: { gt: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Enrich with robot/team names
  const robotIds = changes.filter(c => c.entityType === 'robot').map(c => c.entityId);
  const tagTeamIds = changes.filter(c => c.entityType === 'tag_team').map(c => c.entityId);
  const teamBattleIds = changes.filter(c => c.entityType === 'team_battle').map(c => c.entityId);

  const [robots, tagTeams, teamBattles] = await Promise.all([
    robotIds.length > 0
      ? prisma.robot.findMany({ where: { id: { in: robotIds } }, select: { id: true, name: true } })
      : [],
    tagTeamIds.length > 0
      ? prisma.tagTeam.findMany({
          where: { id: { in: tagTeamIds } },
          select: { id: true, activeRobot: { select: { name: true } }, reserveRobot: { select: { name: true } } },
        })
      : [],
    teamBattleIds.length > 0
      ? prisma.teamBattle.findMany({ where: { id: { in: teamBattleIds } }, select: { id: true, teamName: true, teamSize: true } })
      : [],
  ]);

  const robotMap = new Map(robots.map(r => [r.id, r.name]));
  const tagTeamMap = new Map(tagTeams.map(t => [t.id, `${t.activeRobot.name} & ${t.reserveRobot.name}`]));
  const teamBattleMap = new Map(teamBattles.map(t => [t.id, { name: t.teamName, size: t.teamSize }]));

  function getEntityName(c: { entityType: string; entityId: number }): string {
    if (c.entityType === 'robot') return robotMap.get(c.entityId) ?? `Robot #${c.entityId}`;
    if (c.entityType === 'tag_team') return tagTeamMap.get(c.entityId) ?? `Tag Team #${c.entityId}`;
    const tb = teamBattleMap.get(c.entityId);
    if (tb) return `${tb.name} (${tb.size}v${tb.size})`;
    return `Team #${c.entityId}`;
  }

  const result = changes.map(c => ({
    id: c.id,
    entityType: c.entityType,
    entityId: c.entityId,
    entityName: getEntityName(c),
    changeType: c.changeType,
    sourceTier: c.sourceTier,
    destinationTier: c.destinationTier,
    leaguePoints: c.leaguePoints,
    createdAt: c.createdAt.toISOString(),
  }));

  res.json({ changes: result });
});

export default router;
