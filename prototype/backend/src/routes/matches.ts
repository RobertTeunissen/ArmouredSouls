import express, { Request, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/matches/upcoming
 * Get upcoming scheduled matches and tournament matches for the current user's robots
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

    // Get scheduled league matches involving user's robots
    const leagueMatches = await prisma.scheduledMatch.findMany({
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

    // Get tournament matches involving user's robots (scheduled status, not completed)
    const tournamentMatches = await prisma.tournamentMatch.findMany({
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
        tournament: {
          select: {
            id: true,
            name: true,
            currentRound: true,
            maxRounds: true,
          },
        },
      },
      orderBy: {
        round: 'asc',
      },
    });

    // Format league matches
    const formattedLeagueMatches = leagueMatches.map(match => ({
      id: match.id,
      matchType: 'league',
      robot1Id: match.robot1Id,
      robot2Id: match.robot2Id,
      leagueType: match.leagueType,
      scheduledFor: match.scheduledFor,
      status: match.status,
      robot1: {
        id: match.robot1.id,
        name: match.robot1.name,
        elo: match.robot1.elo,
        currentHP: match.robot1.currentHP,
        maxHP: match.robot1.maxHP,
        userId: match.robot1.userId,
        user: {
          username: match.robot1.user.username,
        },
      },
      robot2: {
        id: match.robot2.id,
        name: match.robot2.name,
        elo: match.robot2.elo,
        currentHP: match.robot2.currentHP,
        maxHP: match.robot2.maxHP,
        userId: match.robot2.userId,
        user: {
          username: match.robot2.user.username,
        },
      },
    }));

    // Format tournament matches
    const formattedTournamentMatches = tournamentMatches.map(match => ({
      id: `tournament-${match.id}`,
      matchType: 'tournament',
      tournamentId: match.tournamentId,
      tournamentName: match.tournament.name,
      tournamentRound: match.round,
      currentRound: match.tournament.currentRound,
      maxRounds: match.tournament.maxRounds,
      robot1Id: match.robot1Id,
      robot2Id: match.robot2Id,
      leagueType: 'tournament', // Use 'tournament' as league type for display
      scheduledFor: new Date().toISOString(), // Tournaments don't have scheduled time
      status: match.status,
      robot1: match.robot1 ? {
        id: match.robot1.id,
        name: match.robot1.name,
        elo: match.robot1.elo,
        currentHP: match.robot1.currentHP,
        maxHP: match.robot1.maxHP,
        userId: match.robot1.userId,
        user: {
          username: match.robot1.user.username,
        },
      } : null,
      robot2: match.robot2 ? {
        id: match.robot2.id,
        name: match.robot2.name,
        elo: match.robot2.elo,
        currentHP: match.robot2.currentHP,
        maxHP: match.robot2.maxHP,
        userId: match.robot2.userId,
        user: {
          username: match.robot2.user.username,
        },
      } : null,
    }));

    // Combine both types of matches
    const allMatches = [...formattedLeagueMatches, ...formattedTournamentMatches];

    res.json({
      matches: allMatches,
      total: allMatches.length,
      leagueMatches: formattedLeagueMatches.length,
      tournamentMatches: formattedTournamentMatches.length,
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
        tournament: {
          select: {
            id: true,
            name: true,
            maxRounds: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Format response to match frontend BattleHistory interface
    const formattedBattles = battles.map(battle => ({
      id: battle.id,
      robot1Id: battle.robot1Id,
      robot2Id: battle.robot2Id,
      winnerId: battle.winnerId,
      createdAt: battle.createdAt,
      durationSeconds: battle.durationSeconds,
      robot1ELOBefore: battle.robot1ELOBefore,
      robot1ELOAfter: battle.robot1ELOAfter,
      robot2ELOBefore: battle.robot2ELOBefore,
      robot2ELOAfter: battle.robot2ELOAfter,
      robot1FinalHP: battle.robot1FinalHP,
      robot2FinalHP: battle.robot2FinalHP,
      winnerReward: battle.winnerReward,
      loserReward: battle.loserReward,
      battleType: battle.battleType,
      tournamentId: battle.tournamentId,
      tournamentRound: battle.tournamentRound,
      tournamentName: battle.tournament?.name,
      tournamentMaxRounds: battle.tournament?.maxRounds,
      robot1: {
        id: battle.robot1.id,
        name: battle.robot1.name,
        userId: battle.robot1.userId,
        user: {
          username: battle.robot1.user.username,
        },
      },
      robot2: {
        id: battle.robot2.id,
        name: battle.robot2.name,
        userId: battle.robot2.userId,
        user: {
          username: battle.robot2.user.username,
        },
      },
    }));

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

/**
 * GET /api/matches/battles/:id/log
 * Get detailed battle log with combat messages for a specific battle
 */
router.get('/battles/:id/log', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const battleId = parseInt(req.params.id);

    // Get battle with full details
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        robot1: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
        robot2: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    // Get user's robots to verify access
    const userRobots = await prisma.robot.findMany({
      where: { userId: req.user.userId },
      select: { id: true },
    });

    const robotIds = userRobots.map(r => r.id);

    // Verify user has access to this battle
    if (!robotIds.includes(battle.robot1Id) && !robotIds.includes(battle.robot2Id)) {
      return res.status(403).json({ error: 'Access denied to battle data' });
    }

    // Format battle log response
    res.json({
      battleId: battle.id,
      createdAt: battle.createdAt,
      leagueType: battle.leagueType,
      duration: battle.durationSeconds,
      robot1: {
        id: battle.robot1.id,
        name: battle.robot1.name,
        owner: battle.robot1.user.username,
        eloBefore: battle.robot1ELOBefore,
        eloAfter: battle.robot1ELOAfter,
        finalHP: battle.robot1FinalHP,
        damageDealt: battle.robot1DamageDealt,
      },
      robot2: {
        id: battle.robot2.id,
        name: battle.robot2.name,
        owner: battle.robot2.user.username,
        eloBefore: battle.robot2ELOBefore,
        eloAfter: battle.robot2ELOAfter,
        finalHP: battle.robot2FinalHP,
        damageDealt: battle.robot2DamageDealt,
      },
      winner: battle.winnerId === battle.robot1Id ? 'robot1' : battle.winnerId === battle.robot2Id ? 'robot2' : null,
      battleLog: battle.battleLog,
    });
  } catch (error) {
    console.error('[Matches API] Error fetching battle log:', error);
    res.status(500).json({
      error: 'Failed to fetch battle log',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
