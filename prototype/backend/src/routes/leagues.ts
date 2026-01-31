import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getInstancesForTier, LeagueTier, LEAGUE_TIERS } from '../services/leagueInstanceService';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/leagues/:tier/standings
 * Get league standings for a specific tier and instance
 */
router.get('/:tier/standings', async (req: Request, res: Response) => {
  try {
    const tier = req.params.tier as LeagueTier;
    const instance = req.query.instance as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 50));

    // Validate tier
    if (!LEAGUE_TIERS.includes(tier)) {
      return res.status(400).json({
        error: 'Invalid tier',
        validTiers: LEAGUE_TIERS,
      });
    }

    // Determine which league IDs to query
    let leagueIds: string[];
    if (instance) {
      leagueIds = [instance];
    } else {
      // Get all instances for this tier
      const instances = await getInstancesForTier(tier);
      leagueIds = instances.map(i => i.leagueId);
    }

    // Build where clause
    const whereClause: any = {
      leagueId: { in: leagueIds },
      NOT: {
        name: 'Bye Robot',
      },
    };

    // Get total count
    const total = await prisma.robot.count({ where: whereClause });

    // Get robots with pagination
    const robots = await prisma.robot.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: [
        { leaguePoints: 'desc' },
        { elo: 'desc' },
      ],
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Add rank to each robot
    const standings = robots.map((robot, index) => ({
      rank: (page - 1) * perPage + index + 1,
      robot: {
        id: robot.id,
        name: robot.name,
        owner: robot.user.username,
        ownerId: robot.user.id,
      },
      stats: {
        leaguePoints: robot.leaguePoints,
        elo: robot.elo,
        wins: robot.wins,
        losses: robot.losses,
        totalBattles: robot.totalBattles,
        winRate: robot.totalBattles > 0 ? ((robot.wins / robot.totalBattles) * 100).toFixed(1) : '0.0',
      },
      league: {
        tier: robot.currentLeague,
        instance: robot.leagueId,
      },
    }));

    res.json({
      data: standings,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
      league: {
        tier,
        instance: instance || 'all',
      },
    });
  } catch (error) {
    console.error('[Leagues API] Error fetching standings:', error);
    res.status(500).json({
      error: 'Failed to fetch league standings',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/leagues/:tier/instances
 * Get all instances for a tier
 */
router.get('/:tier/instances', async (req: Request, res: Response) => {
  try {
    const tier = req.params.tier as LeagueTier;

    // Validate tier
    if (!LEAGUE_TIERS.includes(tier)) {
      return res.status(400).json({
        error: 'Invalid tier',
        validTiers: LEAGUE_TIERS,
      });
    }

    // Get all instances for this tier
    const instances = await getInstancesForTier(tier);

    res.json({
      tier,
      instances: instances.map(instance => ({
        leagueId: instance.leagueId,
        instanceNumber: instance.instanceNumber,
        currentRobots: instance.currentRobots,
        maxRobots: instance.maxRobots,
        isFull: instance.isFull,
      })),
      total: instances.length,
    });
  } catch (error) {
    console.error('[Leagues API] Error fetching instances:', error);
    res.status(500).json({
      error: 'Failed to fetch league instances',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
