import express, { Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import prisma from '../lib/prisma';
import logger from '../config/logger';

const router = express.Router();

/**
 * GET /api/koth/standings
 * KotH standings with pagination and time filter
 */
router.get('/standings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const view = (req.query.view as string) || 'all_time'; // 'all_time' | 'last_10'
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

    // Get total KotH events completed
    const totalEvents = await prisma.scheduledKothMatch.count({
      where: { status: 'completed' },
    });

    // Get unique participants
    const uniqueParticipants = await prisma.robot.count({
      where: { kothMatches: { gt: 0 }, NOT: { name: 'Bye Robot' } },
    });

    // Query robots with KotH stats, sorted by wins desc then zone score desc
    const robots = await prisma.robot.findMany({
      where: { kothMatches: { gt: 0 }, NOT: { name: 'Bye Robot' } },
      include: {
        user: { select: { id: true, username: true, stableName: true } },
      },
      orderBy: [
        { kothWins: 'desc' },
        { kothTotalZoneScore: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.robot.count({
      where: { kothMatches: { gt: 0 }, NOT: { name: 'Bye Robot' } },
    });

    // Get #1 robot
    const topRobot = robots.length > 0 ? robots[0] : null;

    const standings = robots.map((robot, index) => ({
      rank: (page - 1) * limit + index + 1,
      robotId: robot.id,
      robotName: robot.name,
      owner: robot.user.stableName || robot.user.username,
      ownerId: robot.user.id,
      kothWins: robot.kothWins,
      kothMatches: robot.kothMatches,
      winRate: robot.kothMatches > 0 ? Number((robot.kothWins / robot.kothMatches * 100).toFixed(1)) : 0,
      totalZoneScore: robot.kothTotalZoneScore,
      avgZoneScore: robot.kothMatches > 0 ? Number((robot.kothTotalZoneScore / robot.kothMatches).toFixed(1)) : 0,
      kothKills: robot.kothKills,
      bestStreak: robot.kothBestWinStreak,
    }));

    res.json({
      summary: {
        totalEvents,
        uniqueParticipants,
        topRobot: topRobot ? { id: topRobot.id, name: topRobot.name, owner: topRobot.user.stableName || topRobot.user.username } : null,
      },
      standings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      view,
    });
  } catch (error) {
    logger.error('[KotH API] Error fetching standings:', error);
    res.status(500).json({ error: 'Failed to fetch KotH standings' });
  }
});

export default router;
