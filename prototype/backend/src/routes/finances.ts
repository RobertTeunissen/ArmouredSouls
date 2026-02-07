import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  generateFinancialReport,
  calculateTotalDailyOperatingCosts,
  calculateDailyPassiveIncome,
  getPrestigeMultiplier,
  calculateBattleWinnings,
  generatePerRobotFinancialReport,
  calculateFacilityROI,
} from '../utils/economyCalculations';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/finances/daily
 * Get comprehensive daily financial report
 */
router.get('/daily', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get recent battle winnings from query params (defaults to 0)
    // In production, this would be tracked in a separate table
    const recentBattleWinnings = parseInt(req.query.battleWinnings as string) || 0;

    const report = await generateFinancialReport(userId, recentBattleWinnings);

    res.json(report);
  } catch (error) {
    console.error('Daily financial report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/finances/summary
 * Get quick financial summary for dashboard
 */
router.get('/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const operatingCosts = await calculateTotalDailyOperatingCosts(userId);
    const passiveIncome = await calculateDailyPassiveIncome(userId);

    const netIncome = passiveIncome.total - operatingCosts.total;

    res.json({
      currentBalance: user.currency,
      prestige: user.prestige,
      dailyOperatingCosts: operatingCosts.total,
      dailyPassiveIncome: passiveIncome.total,
      netPassiveIncome: netIncome,
      prestigeMultiplier: getPrestigeMultiplier(user.prestige),
    });
  } catch (error) {
    console.error('Financial summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/finances/operating-costs
 * Get detailed operating costs breakdown
 */
router.get('/operating-costs', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const operatingCosts = await calculateTotalDailyOperatingCosts(userId);

    res.json(operatingCosts);
  } catch (error) {
    console.error('Operating costs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/finances/revenue-streams
 * Get detailed revenue streams breakdown
 */
router.get('/revenue-streams', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passiveIncome = await calculateDailyPassiveIncome(userId);

    // Get user's robots to determine average league
    const robots = await prisma.robot.findMany({
      where: { userId },
      select: { currentLeague: true },
    });

    const prestigeMultiplier = getPrestigeMultiplier(user.prestige);

    res.json({
      passive: {
        merchandising: passiveIncome.merchandising,
        streaming: passiveIncome.streaming,
        total: passiveIncome.total,
      },
      battleMultipliers: {
        prestigeMultiplier,
        prestigeBonus: Math.round((prestigeMultiplier - 1) * 100), // Percentage
      },
      robotCount: robots.length,
      prestige: user.prestige,
    });
  } catch (error) {
    console.error('Revenue streams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/finances/projections
 * Get financial projections and recommendations
 */
router.get('/projections', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const operatingCosts = await calculateTotalDailyOperatingCosts(userId);
    const passiveIncome = await calculateDailyPassiveIncome(userId);

    const netPassiveIncome = passiveIncome.total - operatingCosts.total;
    const weeklyProjection = netPassiveIncome * 7;
    const monthlyProjection = netPassiveIncome * 30;

    // Calculate days until bankruptcy if income stops
    const daysToBankruptcy = operatingCosts.total > 0 
      ? Math.floor(user.currency / operatingCosts.total)
      : 999;

    // Recommendations
    const recommendations: string[] = [];

    if (user.currency < 100000) {
      recommendations.push('Low balance warning: Consider reducing operating costs or winning more battles');
    }

    if (netPassiveIncome < 0) {
      recommendations.push('Negative passive cash flow: Your facilities cost more than passive income generates');
    }

    if (daysToBankruptcy < 14) {
      recommendations.push('Critical: Less than 2 weeks of operating costs remaining');
    }

    // Check if Income Generator could help
    const incomeGenerator = await prisma.facility.findUnique({
      where: {
        userId_facilityType: {
          userId,
          facilityType: 'income_generator',
        },
      },
    });

    if (!incomeGenerator || incomeGenerator.level === 0) {
      if (user.currency >= 800000 && user.prestige >= 1000) {
        recommendations.push('Consider purchasing Income Generator to unlock passive income streams');
      }
    } else if (incomeGenerator.level < 5 && user.prestige >= 5000) {
      recommendations.push('Your prestige is high - upgrading Income Generator would significantly increase merchandising income');
    }

    res.json({
      current: {
        balance: user.currency,
        dailyNet: netPassiveIncome,
      },
      projections: {
        weekly: weeklyProjection,
        monthly: monthlyProjection,
      },
      metrics: {
        daysToBankruptcy,
        // Days to break even only makes sense if user has negative balance and positive net income
        daysToBreakEven: (user.currency < 0 && netPassiveIncome > 0)
          ? Math.ceil(Math.abs(user.currency) / netPassiveIncome)
          : null,
      },
      recommendations,
    });
  } catch (error) {
    console.error('Financial projections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/finances/per-robot
 * Get per-robot financial breakdown with profitability analysis
 */
router.get('/per-robot', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const report = await generatePerRobotFinancialReport(userId);

    res.json(report);
  } catch (error) {
    console.error('Per-robot financial report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/finances/roi-calculator
 * Calculate ROI for facility upgrade
 */
router.post('/roi-calculator', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { facilityType, targetLevel } = req.body;

    if (!facilityType || !targetLevel) {
      return res.status(400).json({ error: 'Facility type and target level are required' });
    }

    const roiData = await calculateFacilityROI(userId, facilityType, targetLevel);

    res.json(roiData);
  } catch (error) {
    console.error('ROI calculator error:', error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
