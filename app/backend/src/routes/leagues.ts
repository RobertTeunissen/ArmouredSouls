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
 * Get league standings for a specific tier and instance.
 * Supports mode=koth to serve KotH standings through the same unified path.
 */
router.get('/:tier/standings', validateRequest({ params: leagueTierParamsSchema }), async (req: Request, res: Response) => {
  const tier = req.params.tier as LeagueTier;
  const instance = req.query.instance as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 50));
  const mode = (req.query.mode as string) || 'league_1v1';
  const subscriptionEvent = mode === 'koth' ? 'koth' : 'league_1v1';
  // KotH has no LP threshold for promotion (position-based)
  const useMinLP = mode !== 'koth';
  // KotH requires 10 min cycles (vs 5 for other leagues) to balance promotion speed
  const minCyclesForMode = mode === 'koth' ? 10 : MIN_CYCLES_IN_LEAGUE;

  if (!LEAGUE_TIERS.includes(tier)) {
    throw new LeagueError(LeagueErrorCode.INVALID_LEAGUE_TIER, 'Invalid tier', 400, { validTiers: LEAGUE_TIERS });
  }

  // Query from unified standings table (Spec #40)
  const standingsWhere: Prisma.StandingWhereInput = {
    mode: mode as any,
    tier,
    ...(instance ? { leagueInstanceId: instance } : {}),
  };

  const total = await prisma.standing.count({ where: standingsWhere });

  const standingRows = await prisma.standing.findMany({
    where: standingsWhere,
    orderBy: [
      { leaguePoints: 'desc' },
    ],
    skip: (page - 1) * perPage,
    take: perPage,
  });

  // Batch-fetch robot data for these standings
  const robotIds = standingRows.map(s => s.entityId);
  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIds } },
    include: { user: { select: { id: true, username: true, stableName: true } } },
  });
  const robotMap = new Map(robots.map(r => [r.id, r]));

  // Batch-check subscription status
  const activeSubscriptions = await prisma.subscription.findMany({
    where: { robotId: { in: robotIds }, eventType: subscriptionEvent, status: 'active' },
    select: { robotId: true },
  });
  const subscribedRobotIds = new Set(activeSubscriptions.map(s => s.robotId));

  // Calculate promotion/demotion zones
  const minLP = useMinLP ? getMinLPForPromotion(tier) : 0;
  const isChampion = tier === 'champion';
  const isBronze = tier === 'bronze';

  let eligibleCount: number;
  let hasEnoughRobots: boolean;
  let promotionCount = 0;
  let demotionCount = 0;
  const promotionRobotIds = new Set<number>();
  const demotionRobotIds = new Set<number>();

  if (instance) {
    eligibleCount = await prisma.standing.count({
      where: { mode: mode as any, leagueInstanceId: instance, cyclesInTier: { gte: minCyclesForMode } },
    });

    hasEnoughRobots = eligibleCount >= MIN_ROBOTS_FOR_REBALANCING;
    promotionCount = hasEnoughRobots ? Math.floor(eligibleCount * PROMOTION_PERCENTAGE) : 0;
    demotionCount = hasEnoughRobots ? Math.floor(eligibleCount * DEMOTION_PERCENTAGE) : 0;

    if (hasEnoughRobots && demotionCount > 0 && !isBronze) {
      const demotionStandings = await prisma.standing.findMany({
        where: { mode: mode as any, leagueInstanceId: instance, cyclesInTier: { gte: minCyclesForMode } },
        orderBy: [{ leaguePoints: 'asc' }],
        select: { entityId: true },
        take: demotionCount,
      });
      for (const s of demotionStandings) demotionRobotIds.add(s.entityId);
    }

    if (hasEnoughRobots && promotionCount > 0 && !isChampion) {
      const promotionStandings = await prisma.standing.findMany({
        where: { mode: mode as any, leagueInstanceId: instance, cyclesInTier: { gte: minCyclesForMode }, ...(useMinLP ? { leaguePoints: { gte: minLP } } : {}) },
        orderBy: [{ leaguePoints: 'desc' }],
        select: { entityId: true },
        take: promotionCount,
      });
      for (const s of promotionStandings) promotionRobotIds.add(s.entityId);
    }
  } else {
    eligibleCount = await prisma.standing.count({
      where: { mode: mode as any, tier, cyclesInTier: { gte: minCyclesForMode } },
    });
    hasEnoughRobots = eligibleCount >= MIN_ROBOTS_FOR_REBALANCING;
  }

  const standings = standingRows.map((s) => {
    const robot = robotMap.get(s.entityId);
    return {
      id: s.entityId,
      name: robot?.name ?? `Robot #${s.entityId}`,
      elo: robot?.elo ?? 0,
      leaguePoints: s.leaguePoints,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      totalBattles: (s.totalMatches ?? null) !== null ? s.totalMatches! : (s.wins + s.losses + s.draws),
      currentHP: robot?.currentHP ?? 0,
      maxHP: robot?.maxHP ?? 100,
      fame: robot?.fame ?? 0,
      userId: robot?.user?.id ?? 0,
      cyclesInCurrentLeague: s.cyclesInTier,
      eligible: s.cyclesInTier >= minCyclesForMode,
      isSubscribed: subscribedRobotIds.has(s.entityId),
      user: {
        username: robot?.user?.username ?? 'Unknown',
        stableName: robot?.user?.stableName ?? null,
      },
      zone: promotionRobotIds.has(s.entityId)
        ? 'promotion' as const
        : demotionRobotIds.has(s.entityId)
          ? 'demotion' as const
          : null,
    };
  });

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
      minCycles: minCyclesForMode,
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
 * Get all instances for a tier. Supports mode=koth for KotH instances.
 */
router.get('/:tier/instances', validateRequest({ params: leagueTierParamsSchema }), async (req: Request, res: Response) => {
  const tier = req.params.tier as LeagueTier;
  const mode = (req.query.mode as string) || 'league_1v1';
  const maxPerInstance = mode === 'koth' ? 100 : 100; // same for now

  if (!LEAGUE_TIERS.includes(tier)) {
    throw new LeagueError(LeagueErrorCode.INVALID_LEAGUE_TIER, 'Invalid tier', 400, { validTiers: LEAGUE_TIERS });
  }

  const instances = await getInstancesForTier(tier, { mode, maxPerInstance });

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
      ? prisma.teamBattle.findMany({
          where: { id: { in: tagTeamIds } },
          select: { id: true, teamName: true },
        })
      : [],
    teamBattleIds.length > 0
      ? prisma.teamBattle.findMany({ where: { id: { in: teamBattleIds } }, select: { id: true, teamName: true, teamSize: true } })
      : [],
  ]);

  const robotMap = new Map(robots.map(r => [r.id, r.name]));
  const tagTeamMap = new Map(tagTeams.map(t => [t.id, t.teamName]));
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
