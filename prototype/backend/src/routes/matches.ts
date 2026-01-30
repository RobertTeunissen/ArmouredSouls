import express, { Request, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/matches/upcoming
 * Get upcoming scheduled matches for the current user's robots
 */
router.get('/upcoming', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's robots
    const userRobots = await prisma.robot.findMany({
      where: { userId: req.user.userId },
      select: { id: true },
    });

    const robotIds = userRobots.map(r => r.id);

    // Get scheduled matches involving user's robots
    const matches = await prisma.scheduledMatch.findMany({
      where: {
        status: 'scheduled',
        OR: [
          { robot1Id: { in: robotIds } },
          { robot2Id: { in: robotIds } },
        ],
      },
      include: {
        robot1: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        robot2: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        scheduledFor: 'asc',
      },
    });

    // Format response with opponent details
    const formattedMatches = matches.map(match => {
      const isRobot1User = robotIds.includes(match.robot1Id);
      const userRobot = isRobot1User ? match.robot1 : match.robot2;
      const opponent = isRobot1User ? match.robot2 : match.robot1;

      return {
        matchId: match.id,
        scheduledFor: match.scheduledFor,
        leagueType: match.leagueType,
        userRobot: {
          id: userRobot.id,
          name: userRobot.name,
          currentHP: userRobot.currentHP,
          maxHP: userRobot.maxHP,
          elo: userRobot.elo,
        },
        opponent: {
          id: opponent.id,
          name: opponent.name,
          elo: opponent.elo,
          owner: opponent.user.username,
        },
      };
    });

    res.json({
      matches: formattedMatches,
      total: formattedMatches.length,
    });
  } catch (error) {
    console.error('[Matches API] Error fetching upcoming matches:', error);
    res.status(500).json({
      error: 'Failed to fetch upcoming matches',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/matches/history
 * Get paginated battle history for the current user's robots
 */
router.get('/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 20));
    const robotId = req.query.robotId ? parseInt(req.query.robotId as string) : undefined;

    // Get user's robots
    const userRobots = await prisma.robot.findMany({
      where: { userId: req.user.userId },
      select: { id: true },
    });

    const robotIds = userRobots.map(r => r.id);

    // If robotId filter is provided, verify ownership
    if (robotId !== undefined && !robotIds.includes(robotId)) {
      return res.status(403).json({ error: 'Access denied to robot data' });
    }

    // Build where clause
    const whereClause: any = {
      OR: [
        { robot1Id: { in: robotId !== undefined ? [robotId] : robotIds } },
        { robot2Id: { in: robotId !== undefined ? [robotId] : robotIds } },
      ],
    };

    // Get total count
    const total = await prisma.battle.count({ where: whereClause });

    // Get battles with pagination
    const battles = await prisma.battle.findMany({
      where: whereClause,
      include: {
        robot1: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        robot2: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Format response
    const formattedBattles = battles.map(battle => {
      const isRobot1User = robotIds.includes(battle.robot1Id);
      const userRobot = isRobot1User ? battle.robot1 : battle.robot2;
      const opponent = isRobot1User ? battle.robot2 : battle.robot1;
      const userWon = battle.winnerId === userRobot.id;

      return {
        battleId: battle.id,
        createdAt: battle.createdAt,
        leagueType: battle.leagueType,
        userRobot: {
          id: userRobot.id,
          name: userRobot.name,
          finalHP: isRobot1User ? battle.robot1FinalHP : battle.robot2FinalHP,
          damageDealt: isRobot1User ? battle.robot1DamageDealt : battle.robot2DamageDealt,
          eloBefore: isRobot1User ? battle.robot1ELOBefore : battle.robot2ELOBefore,
          eloAfter: isRobot1User ? battle.robot1ELOAfter : battle.robot2ELOAfter,
        },
        opponent: {
          id: opponent.id,
          name: opponent.name,
          owner: opponent.user.username,
          finalHP: isRobot1User ? battle.robot2FinalHP : battle.robot1FinalHP,
          damageDealt: isRobot1User ? battle.robot2DamageDealt : battle.robot1DamageDealt,
        },
        result: {
          won: userWon,
          isDraw: battle.winnerId === null,
          reward: userWon ? battle.winnerReward : battle.loserReward,
          duration: battle.durationSeconds,
        },
      };
    });

    res.json({
      data: formattedBattles,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error('[Matches API] Error fetching battle history:', error);
    res.status(500).json({
      error: 'Failed to fetch battle history',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
