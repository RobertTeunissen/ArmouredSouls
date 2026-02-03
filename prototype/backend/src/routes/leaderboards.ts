import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Get fame tier name based on fame value
 */
function getFameTier(fame: number): string {
  if (fame < 100) return "Unknown";
  if (fame < 500) return "Known";
  if (fame < 1000) return "Famous";
  if (fame < 2500) return "Renowned";
  if (fame < 5000) return "Legendary";
  return "Mythical";
}

/**
 * Get prestige rank title based on prestige value
 */
function getPrestigeRank(prestige: number): string {
  if (prestige < 1000) return "Novice";
  if (prestige < 5000) return "Established";
  if (prestige < 10000) return "Veteran";
  if (prestige < 25000) return "Elite";
  if (prestige < 50000) return "Champion";
  return "Legendary";
}

/**
 * Calculate battle winnings bonus percentage
 */
function calculateBattleWinningsBonus(prestige: number): number {
  if (prestige >= 50000) return 20;
  if (prestige >= 25000) return 15;
  if (prestige >= 10000) return 10;
  if (prestige >= 5000) return 5;
  return 0;
}

/**
 * GET /api/leaderboards/fame
 * Get top robots ranked by fame
 */
router.get('/fame', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
    const league = req.query.league as string;
    const minBattles = parseInt(req.query.minBattles as string) || 10;
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: any = {
      NOT: { name: 'Bye Robot' },
      totalBattles: { gte: minBattles }
    };
    
    if (league && league !== 'all') {
      where.currentLeague = league;
    }
    
    // Get total count
    const totalRobots = await prisma.robot.count({ where });
    
    // Get top robots by fame
    const robots = await prisma.robot.findMany({
      where,
      orderBy: { fame: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: { id: true, username: true }
        }
      }
    });
    
    // Calculate ranks and win rates
    const leaderboard = robots.map((robot, index) => ({
      rank: skip + index + 1,
      robotId: robot.id,
      robotName: robot.name,
      fame: robot.fame,
      fameTier: getFameTier(robot.fame),
      stableId: robot.userId,
      stableName: robot.user.username,
      currentLeague: robot.currentLeague,
      elo: robot.elo,
      totalBattles: robot.totalBattles,
      wins: robot.wins,
      losses: robot.losses,
      draws: robot.draws,
      winRate: robot.totalBattles > 0 
        ? Number((robot.wins / robot.totalBattles * 100).toFixed(1)) 
        : 0,
      kills: robot.kills,
      damageDealtLifetime: robot.damageDealtLifetime
    }));
    
    res.json({
      leaderboard,
      pagination: {
        page,
        limit,
        totalRobots,
        totalPages: Math.ceil(totalRobots / limit),
        hasMore: skip + robots.length < totalRobots,
      },
      filters: {
        league: league || 'all',
        minBattles,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Leaderboards] Fame leaderboard error:', error);
    res.status(500).json({
      error: 'Failed to retrieve fame leaderboard',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/leaderboards/prestige
 * Get top stables/users ranked by prestige
 */
router.get('/prestige', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
    const minRobots = parseInt(req.query.minRobots as string) || 1;
    const skip = (page - 1) * limit;
    
    // Get all users (we'll filter after counting robots)
    const users = await prisma.user.findMany({
      orderBy: { prestige: 'desc' },
      include: {
        robots: {
          where: {
            NOT: { name: 'Bye Robot' }
          },
          select: { 
            elo: true,
            totalBattles: true,
            wins: true,
            losses: true,
            draws: true,
          }
        }
      }
    });
    
    // Calculate derived stats and filter by minRobots
    const allLeaderboardEntries = users
      .map((user) => {
        const highestELO = user.robots.length > 0 
          ? Math.max(...user.robots.map(r => r.elo), 0)
          : 0;
        const totalBattles = user.robots.reduce((sum, r) => sum + r.totalBattles, 0);
        const totalWins = user.robots.reduce((sum, r) => sum + r.wins, 0);
        const totalLosses = user.robots.reduce((sum, r) => sum + r.losses, 0);
        const totalDraws = user.robots.reduce((sum, r) => sum + r.draws, 0);
        const winRate = totalBattles > 0 ? (totalWins / totalBattles * 100) : 0;
        
        return {
          userId: user.id,
          username: user.username,
          stableName: user.username, // TODO: Add dedicated stable name field in future
          prestige: user.prestige,
          prestigeRank: getPrestigeRank(user.prestige),
          totalRobots: user.robots.length,
          totalBattles,
          totalWins,
          totalLosses,
          totalDraws,
          winRate: Number(winRate.toFixed(1)),
          highestELO,
          championshipTitles: user.championshipTitles,
          battleWinningsBonus: calculateBattleWinningsBonus(user.prestige),
          merchandisingMultiplier: Number((1 + user.prestige / 10000).toFixed(3))
        };
      })
      .filter(entry => entry.totalRobots >= minRobots);
    
    // Apply pagination to filtered results
    const totalStables = allLeaderboardEntries.length;
    const paginatedEntries = allLeaderboardEntries.slice(skip, skip + limit);
    
    // Add ranks to paginated entries
    const leaderboard = paginatedEntries.map((entry, index) => ({
      rank: skip + index + 1,
      ...entry
    }));
    
    res.json({
      leaderboard,
      pagination: {
        page,
        limit,
        totalStables,
        totalPages: Math.ceil(totalStables / limit),
        hasMore: skip + paginatedEntries.length < totalStables,
      },
      filters: {
        minRobots,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Leaderboards] Prestige leaderboard error:', error);
    res.status(500).json({
      error: 'Failed to retrieve prestige leaderboard',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
