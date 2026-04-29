import express, { Request, Response } from 'express';
import { z } from 'zod';
import { getInstancesForTier, LeagueTier, LEAGUE_TIERS } from '../services/league/leagueInstanceService';
import prisma from '../lib/prisma';
import type { Prisma } from '../../generated/prisma';
import { LeagueError, LeagueErrorCode } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';

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

  const standings = robots.map((robot) => ({
    id: robot.id,
    name: robot.name,
    elo: robot.elo,
    leaguePoints: robot.leaguePoints,
    wins: robot.wins,
    draws: robot.draws,
    losses: robot.losses,
    totalBattles: robot.totalBattles,
    currentHP: robot.currentHP,
    maxHP: robot.maxHP,
    fame: robot.fame,
    userId: robot.user.id,
    user: {
      username: robot.user.username,
      stableName: robot.user.stableName,
    },
  }));

  res.json({
    data: standings,
    pagination: {
      page,
      pageSize: perPage,
      total,
      totalPages: Math.ceil(total / perPage),
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

export default router;
