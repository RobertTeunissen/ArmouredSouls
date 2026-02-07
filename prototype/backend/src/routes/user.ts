import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get current user profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        username: true,
        role: true,
        currency: true,
        prestige: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's stable statistics (aggregate across all robots)
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get all user's robots with their battle data
    const robots = await prisma.robot.findMany({
      where: { userId },
      select: {
        elo: true,
        totalBattles: true,
        wins: true,
        losses: true,
        draws: true,
        currentLeague: true,
      },
    });

    // If no robots, return zeros
    if (robots.length === 0) {
      return res.json({
        totalBattles: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        avgELO: 0,
        highestLeague: null,
      });
    }

    // Calculate aggregate stats
    const totalBattles = robots.reduce((sum, r) => sum + r.totalBattles, 0);
    const wins = robots.reduce((sum, r) => sum + r.wins, 0);
    const losses = robots.reduce((sum, r) => sum + r.losses, 0);
    const draws = robots.reduce((sum, r) => sum + r.draws, 0);
    const winRate = totalBattles > 0 ? (wins / totalBattles) * 100 : 0;
    const avgELO = Math.round(robots.reduce((sum, r) => sum + r.elo, 0) / robots.length);

    // Determine highest league (league hierarchy)
    const leagueHierarchy = [
      'bronze_4', 'bronze_3', 'bronze_2', 'bronze_1',
      'silver_4', 'silver_3', 'silver_2', 'silver_1',
      'gold_4', 'gold_3', 'gold_2', 'gold_1',
      'platinum_4', 'platinum_3', 'platinum_2', 'platinum_1',
      'diamond_4', 'diamond_3', 'diamond_2', 'diamond_1',
      'master', 'grandmaster', 'challenger'
    ];

    const highestLeague = robots
      .map(r => r.currentLeague)
      .filter(league => league !== null)
      .sort((a, b) => {
        const indexA = leagueHierarchy.indexOf(a!);
        const indexB = leagueHierarchy.indexOf(b!);
        return indexB - indexA; // Higher index = higher league
      })[0] || null;

    res.json({
      totalBattles,
      wins,
      losses,
      draws,
      winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal
      avgELO,
      highestLeague,
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stable name endpoint removed - feature not yet implemented

export default router;
