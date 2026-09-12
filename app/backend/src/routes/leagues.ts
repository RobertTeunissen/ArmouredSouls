import express, { Request, Response } from 'express';
import { z } from 'zod';
import { getInstancesForTier, LeagueTier, LEAGUE_TIERS } from '../services/league/leagueInstanceService';
import { getLeagueTierPreview } from '../services/league/league-rebalancing-preview';
import { HEAD_TO_HEAD_LEAGUE_RULES, LeagueRuleSet } from '../services/league/league-rules';
import prisma from '../lib/prisma';
import type { Prisma, StandingsMode } from '../../generated/prisma';
import { LeagueError, LeagueErrorCode } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';
import { authenticateToken, AuthRequest } from '../middleware/auth';

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
  const isPlacementMode = mode === 'koth' || mode === 'grand_melee';
  const subscriptionEvent = mode === 'koth' ? 'koth' : mode === 'grand_melee' ? 'grand_melee' : 'league_1v1';
  const leagueRules: LeagueRuleSet = isPlacementMode
    ? { ...HEAD_TO_HEAD_LEAGUE_RULES, minCyclesForRebalancing: 10, promotionMinLPOverride: 0 }
    : HEAD_TO_HEAD_LEAGUE_RULES;

  if (!LEAGUE_TIERS.includes(tier)) {
    throw new LeagueError(LeagueErrorCode.INVALID_LEAGUE_TIER, 'Invalid tier', 400, { validTiers: LEAGUE_TIERS });
  }

  // Query from unified standings table (Spec #40)
  const standingsWhere: Prisma.StandingWhereInput = {
    mode: mode as StandingsMode,
    tier,
    ...(instance ? { leagueInstanceId: instance } : {}),
  };

  const total = await prisma.standing.count({ where: standingsWhere });

  const standingRows = await prisma.standing.findMany({
    where: standingsWhere,
    orderBy: [
      { leaguePoints: 'desc' },
      { entityId: 'asc' },
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

  const preview = await getLeagueTierPreview(
    mode as StandingsMode,
    tier,
    leagueRules,
    instance,
  );
  const selectedInstancePlan = instance
    ? preview.instancePlansById.get(instance)
    : undefined;
  const instancePlans = selectedInstancePlan
    ? [selectedInstancePlan]
    : instance
      ? []
      : preview.plan.instancePlans;
  const minLP = leagueRules.promotionMinLPOverride
    ?? instancePlans[0]?.minPromotionLP
    ?? 0;
  const eligibleCount = instancePlans.reduce((sum, plan) => sum + plan.eligibleEntities, 0);
  const totalInstances = instancePlans.length;
  const instancesBelowMinimum = instancePlans.filter((plan) => !plan.hasEnoughEntities).length;
  const activeInstances = totalInstances - instancesBelowMinimum;
  const hasEnoughRobots = totalInstances > 0 && instancesBelowMinimum === 0;
  const smallestInstancePopulation = instancePlans.length > 0
    ? Math.min(...instancePlans.map((plan) => plan.totalEntities))
    : 0;
  const promotionCount = instancePlans.reduce((sum, plan) => sum + plan.promotionSlots, 0);
  const demotionCount = instancePlans.reduce((sum, plan) => sum + plan.demotionSlots, 0);
  const isChampion = tier === leagueRules.tiers[leagueRules.tiers.length - 1];
  const isBronze = tier === leagueRules.tiers[0];
  const promotionRobotIds = preview.effectivePromotionEntityIds;
  const demotionRobotIds = preview.demotionEntityIds;

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
      eligible: s.cyclesInTier >= leagueRules.minCyclesForRebalancing,
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

  res.set('Cache-Control', 'public, max-age=60');
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
      minCycles: leagueRules.minCyclesForRebalancing,
      minRobotsRequired: leagueRules.minEntitiesForRebalancing,
      eligibleCount,
      hasEnoughRobots,
      promotionSlots: promotionCount,
      demotionSlots: demotionCount,
      promotionCandidates: instancePlans.reduce(
        (sum, plan) => sum + plan.promotionCandidates.length,
        0,
      ),
      effectivePromotionCandidates: preview.plan.promotionBlockReason
        ? 0
        : instancePlans.reduce((sum, plan) => sum + plan.promotionCandidates.length, 0),
      promotionBlockReason: preview.plan.promotionBlockReason,
      totalEntities: instancePlans.reduce((sum, plan) => sum + plan.totalEntities, 0),
      totalInstances,
      activeInstances,
      instancesBelowMinimum,
      smallestInstancePopulation,
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

  // Enrich with robot/team names and mode
  const robotIds = changes.filter(c => c.entityType === 'robot').map(c => c.entityId);
  const tagTeamIds = changes.filter(c => c.entityType === 'tag_team').map(c => c.entityId);
  const teamBattleIds = changes.filter(c => c.entityType === 'team_battle').map(c => c.entityId);

  // Look up standings to determine which mode each tier change belongs to
  const allEntityIds = changes.map(c => c.entityId);
  const standings = allEntityIds.length > 0
    ? await prisma.standing.findMany({
        where: { entityId: { in: allEntityIds } },
        select: { entityId: true, entityType: true, mode: true, tier: true, leagueInstanceId: true },
      })
    : [];

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

  const result = changes.map(c => {
    // Use mode from the history record (populated since Spec #44).
    // Falls back to cross-reference for legacy records without mode.
    let mode = (c as unknown as { mode?: string }).mode;
    if (!mode) {
      const entityStandings = standings.filter(s => s.entityId === c.entityId && s.entityType === c.entityType);
      const freshlyChanged = entityStandings.filter(s => s.tier === c.destinationTier);
      const exactMatch = freshlyChanged.find(s => s.leagueInstanceId === c.destinationLeagueId);
      const matchingStanding = exactMatch ?? freshlyChanged[0];
      mode = matchingStanding?.mode ?? (c.entityType === 'tag_team' ? 'tag_team' : 'league_1v1');
    }

    return {
      id: c.id,
      entityType: c.entityType,
      entityId: c.entityId,
      entityName: getEntityName(c),
      changeType: c.changeType,
      sourceTier: c.sourceTier,
      destinationTier: c.destinationTier,
      leaguePoints: c.leaguePoints,
      mode,
      createdAt: c.createdAt.toISOString(),
    };
  });

  // Deduplicate: same entity + same tier change + same mode = show only once
  const seen = new Set<string>();
  const deduped = result.filter(r => {
    const key = `${r.entityType}-${r.entityId}-${r.changeType}-${r.sourceTier}-${r.destinationTier}-${r.mode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.json({ changes: deduped });
});

export default router;
