/**
 * Analytics API Routes
 * 
 * Provides REST API endpoints for analytics queries.
 * 
 * Requirements: 12.1
 */

import express, { Request, Response } from 'express';
import { cycleSnapshotService } from '../services/cycleSnapshotService';
import { robotPerformanceService } from '../services/robotPerformanceService';
import prisma from '../lib/prisma';

const router = express.Router();

/**
 * GET /api/analytics/cycle/current
 * 
 * Returns the current cycle number from cycle metadata.
 * 
 * Response:
 * {
 *   cycleNumber: number,
 *   lastCycleAt: Date | null
 * }
 */
router.get('/cycle/current', async (req: Request, res: Response) => {
  try {
    const metadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });

    if (!metadata) {
      return res.json({
        cycleNumber: 0,
        lastCycleAt: null,
      });
    }

    return res.json({
      cycleNumber: metadata.totalCycles,
      lastCycleAt: metadata.lastCycleAt,
    });
  } catch (error) {
    console.error('[Analytics] Error getting current cycle:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/analytics/stable/:userId/summary
 * 
 * Returns income, expenses, and net profit for the last N cycles for a specific stable (user).
 * 
 * Query parameters:
 * - lastNCycles: Number of cycles to analyze (default: 10)
 * 
 * Response:
 * {
 *   userId: number,
 *   cycleRange: [startCycle, endCycle],
 *   totalIncome: number,
 *   totalExpenses: number,
 *   netProfit: number,
 *   cycles: Array<{
 *     cycleNumber: number,
 *     income: number,
 *     expenses: number,
 *     netProfit: number,
 *     breakdown: {
 *       battleCredits: number,
 *       merchandising: number,
 *       streaming: number,
 *       repairCosts: number,
 *       operatingCosts: number
 *     }
 *   }>
 * }
 */
router.get('/stable/:userId/summary', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const lastNCyclesParam = req.query.lastNCycles as string;
    const lastNCycles = lastNCyclesParam ? parseInt(lastNCyclesParam) : 10;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    if (lastNCyclesParam && (isNaN(lastNCycles) || lastNCycles < 1)) {
      return res.status(400).json({ error: 'Invalid lastNCycles parameter' });
    }

    // Get the latest cycle number
    const latestSnapshot = await prisma.cycleSnapshot.findFirst({
      orderBy: { cycleNumber: 'desc' },
      select: { cycleNumber: true },
    });

    if (!latestSnapshot) {
      return res.status(404).json({ 
        error: 'No cycle snapshots found',
        message: 'No cycles have been completed yet'
      });
    }

    const latestCycle = latestSnapshot.cycleNumber;
    const startCycle = Math.max(1, latestCycle - lastNCycles + 1);
    const endCycle = latestCycle;

    // Get snapshots for the requested range
    const snapshots = await cycleSnapshotService.getSnapshotRange(startCycle, endCycle);

    if (snapshots.length === 0) {
      return res.status(404).json({
        error: 'No snapshots found',
        message: `No snapshots found for cycles ${startCycle} to ${endCycle}`
      });
    }

    // First pass: calculate cycles without balance
    const cyclesWithoutBalance = snapshots.map(snapshot => {
      const userMetrics = snapshot.stableMetrics.find(m => m.userId === userId);

      if (!userMetrics) {
        // User had no activity in this cycle
        return {
          cycleNumber: snapshot.cycleNumber,
          income: 0,
          expenses: 0,
          purchases: 0,
          netProfit: 0,
          breakdown: {
            battleCredits: 0,
            merchandising: 0,
            streaming: 0,
            repairCosts: 0,
            operatingCosts: 0,
            weaponPurchases: 0,
            facilityPurchases: 0,
            robotPurchases: 0,
            attributeUpgrades: 0,
          },
        };
      }

      const income = userMetrics.totalCreditsEarned + 
                     userMetrics.merchandisingIncome + 
                     userMetrics.streamingIncome;
      const expenses = userMetrics.totalRepairCosts + userMetrics.operatingCosts;
      const weaponPurchases = Number(userMetrics.weaponPurchases) || 0;
      const facilityPurchases = Number(userMetrics.facilityPurchases) || 0;
      const robotPurchases = Number(userMetrics.robotPurchases) || 0;
      const attributeUpgrades = Number(userMetrics.attributeUpgrades) || 0;
      
      const purchases = weaponPurchases + facilityPurchases + robotPurchases + attributeUpgrades;

      return {
        cycleNumber: snapshot.cycleNumber,
        income,
        expenses,
        purchases,
        netProfit: userMetrics.netProfit,
        breakdown: {
          battleCredits: userMetrics.totalCreditsEarned,
          merchandising: userMetrics.merchandisingIncome,
          streaming: userMetrics.streamingIncome,
          repairCosts: userMetrics.totalRepairCosts,
          operatingCosts: userMetrics.operatingCosts,
          weaponPurchases,
          facilityPurchases,
          robotPurchases,
          attributeUpgrades,
        },
      };
    });

    // Use stored balance from snapshots instead of recalculating
    const cycles = cyclesWithoutBalance.map((cycle, index) => {
      const snapshot = snapshots[index];
      const userMetrics = snapshot.stableMetrics.find(m => m.userId === userId);
      
      // Use the stored balance if available, otherwise fallback to 0
      const balance = userMetrics?.balance ?? 0;
      
      return {
        ...cycle,
        balance,
      };
    });

    // Calculate totals
    const totalIncome = cycles.reduce((sum, c) => sum + c.income, 0);
    const totalExpenses = cycles.reduce((sum, c) => sum + c.expenses, 0);
    const totalPurchases = cycles.reduce((sum, c) => sum + c.purchases, 0);
    const netProfit = cycles.reduce((sum, c) => sum + c.netProfit, 0);

    return res.json({
      userId,
      cycleRange: [startCycle, endCycle],
      totalIncome,
      totalExpenses,
      totalPurchases,
      netProfit,
      cycles,
    });
  } catch (error) {
    console.error('[Analytics] Error in stable summary:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});



/**
 * GET /api/analytics/robot/:robotId/performance
 * 
 * Returns robot performance summary including ELO progression, win rate, earnings,
 * and damage statistics over a specified cycle range.
 * 
 * Query parameters:
 * - cycleRange: Cycle range as [startCycle,endCycle] (required)
 *   Example: cycleRange=[1,10]
 * - includeELOProgression: Whether to include detailed ELO progression data (optional, default: false)
 *   DEPRECATED: Use includeMetricProgression with progressionMetric instead
 * - includeMetricProgression: Whether to include detailed metric progression data (optional, default: false)
 * - progressionMetric: Which metric to track (optional, default: 'elo')
 *   Supported values: 'elo', 'fame', 'damageDealt', 'damageReceived', 'wins', 'losses', 'creditsEarned'
 * 
 * Response:
 * {
 *   robotId: number,
 *   cycleRange: [startCycle, endCycle],
 *   battlesParticipated: number,
 *   wins: number,
 *   losses: number,
 *   draws: number,
 *   winRate: number,
 *   damageDealt: number,
 *   damageReceived: number,
 *   totalCreditsEarned: number,
 *   totalFameEarned: number,
 *   eloChange: number,
 *   eloStart: number,
 *   eloEnd: number,
 *   eloProgression?: {  // Deprecated, use metricProgression
 *     dataPoints: Array<{
 *       cycleNumber: number,
 *       elo: number,
 *       change: number
 *     }>,
 *     startElo: number,
 *     endElo: number,
 *     totalChange: number,
 *     averageChange: number
 *   },
 *   metricProgression?: {
 *     robotId: number,
 *     metric: string,
 *     dataPoints: Array<{
 *       cycleNumber: number,
 *       value: number,
 *       change: number
 *     }>,
 *     startValue: number,
 *     endValue: number,
 *     totalChange: number,
 *     averageChange: number,
 *     movingAverage: number[]
 *   }
 * }
 * 
 * Requirements: 12.2, 7.1, 7.2, 7.3, 7.4, 7.5
 */
router.get('/robot/:robotId/performance', async (req: Request, res: Response) => {
  try {
    const robotId = parseInt(req.params.robotId);
    const cycleRangeParam = req.query.cycleRange as string;
    const includeELOProgressionParam = req.query.includeELOProgression as string | undefined;
    const includeMetricProgressionParam = req.query.includeMetricProgression as string | undefined;
    const progressionMetricParam = req.query.progressionMetric as string | undefined;

    // Validate robotId
    if (isNaN(robotId)) {
      return res.status(400).json({ 
        error: 'Invalid robotId',
        message: 'robotId must be a valid integer'
      });
    }

    // Validate cycleRange parameter
    if (!cycleRangeParam) {
      return res.status(400).json({ 
        error: 'Missing required parameter',
        message: 'The "cycleRange" query parameter is required (format: [startCycle,endCycle])'
      });
    }

    // Parse cycleRange [A,B]
    const cycleRangeMatch = cycleRangeParam.match(/^\[(-?\d+),(-?\d+)\]$/);
    if (!cycleRangeMatch) {
      return res.status(400).json({ 
        error: 'Invalid cycleRange format',
        message: 'cycleRange must be in format [startCycle,endCycle], e.g., [1,10]'
      });
    }

    const startCycle = parseInt(cycleRangeMatch[1]);
    const endCycle = parseInt(cycleRangeMatch[2]);

    if (startCycle < 1 || endCycle < 1) {
      return res.status(400).json({ 
        error: 'Invalid cycle numbers',
        message: 'Cycle numbers must be positive integers'
      });
    }

    if (startCycle > endCycle) {
      return res.status(400).json({ 
        error: 'Invalid cycle range',
        message: 'startCycle must be less than or equal to endCycle'
      });
    }

    // Verify robot exists
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
    });

    if (!robot) {
      return res.status(404).json({ 
        error: 'Robot not found',
        message: `Robot with ID ${robotId} does not exist`
      });
    }

    // Parse includeELOProgression flag (deprecated, but kept for backward compatibility)
    const includeELOProgression = includeELOProgressionParam === 'true';
    
    // Parse includeMetricProgression flag
    const includeMetricProgression = includeMetricProgressionParam === 'true' || includeELOProgression;
    
    // Parse progressionMetric (default to 'elo' for backward compatibility)
    const progressionMetric = (progressionMetricParam || 'elo') as any;
    
    // Validate progressionMetric
    const validMetrics = ['elo', 'fame', 'damageDealt', 'damageReceived', 'wins', 'losses', 'creditsEarned'];
    if (!validMetrics.includes(progressionMetric)) {
      return res.status(400).json({ 
        error: 'Invalid progressionMetric',
        message: `progressionMetric must be one of: ${validMetrics.join(', ')}`
      });
    }

    // Get robot performance summary
    const summary = await robotPerformanceService.getRobotPerformanceSummary(
      robotId,
      [startCycle, endCycle]
    );

    // Build response
    const response: any = {
      ...summary,
    };

    // Optionally include metric progression data
    if (includeMetricProgression) {
      const metricProgression = await robotPerformanceService.getRobotMetricProgression(
        robotId,
        progressionMetric,
        [startCycle, endCycle]
      );
      
      // For backward compatibility, also include eloProgression if metric is 'elo'
      if (progressionMetric === 'elo' && includeELOProgression) {
        response.eloProgression = {
          robotId: metricProgression.robotId,
          cycleRange: metricProgression.cycleRange,
          dataPoints: metricProgression.dataPoints.map(dp => ({
            cycleNumber: dp.cycleNumber,
            elo: dp.value,
            change: dp.change,
          })),
          startElo: metricProgression.startValue,
          endElo: metricProgression.endValue,
          totalChange: metricProgression.totalChange,
          averageChange: metricProgression.averageChange,
        };
      }
      
      response.metricProgression = metricProgression;
    }

    return res.json(response);
  } catch (error) {
    console.error('[Analytics] Error in robot performance:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/robot/:robotId/elo
 * 
 * Returns ELO progression data for a specific robot over a cycle range.
 * This is a convenience endpoint that provides just the ELO progression data
 * without the full performance summary.
 * 
 * Query parameters:
 * - cycleRange: Cycle range as [startCycle,endCycle] (required)
 *   Example: cycleRange=[1,10]
 * - includeMovingAverage: Whether to include moving averages (optional, default: false)
 * - includeTrendLine: Whether to include trend line (optional, default: false)
 * 
 * Response:
 * {
 *   robotId: number,
 *   cycleRange: [startCycle, endCycle],
 *   dataPoints: Array<{
 *     cycleNumber: number,
 *     elo: number,
 *     change: number
 *   }>,
 *   startElo: number,
 *   endElo: number,
 *   totalChange: number,
 *   averageChange: number,
 *   movingAverage?: number[],
 *   trendLine?: {
 *     slope: number,
 *     intercept: number,
 *     points: Array<{ cycleNumber: number, value: number }>
 *   }
 * }
 * 
 * Requirements: 7.1, 7.3, 7.4
 */
router.get('/robot/:robotId/elo', async (req: Request, res: Response) => {
  try {
    const robotId = parseInt(req.params.robotId);
    const cycleRangeParam = req.query.cycleRange as string;
    const includeMovingAverageParam = req.query.includeMovingAverage as string | undefined;
    const includeTrendLineParam = req.query.includeTrendLine as string | undefined;

    // Validate robotId
    if (isNaN(robotId)) {
      return res.status(400).json({ 
        error: 'Invalid robotId',
        message: 'robotId must be a valid integer'
      });
    }

    // Validate cycleRange parameter
    if (!cycleRangeParam) {
      return res.status(400).json({ 
        error: 'Missing required parameter',
        message: 'The "cycleRange" query parameter is required (format: [startCycle,endCycle])'
      });
    }

    // Parse cycleRange [A,B]
    const cycleRangeMatch = cycleRangeParam.match(/^\[(-?\d+),(-?\d+)\]$/);
    if (!cycleRangeMatch) {
      return res.status(400).json({ 
        error: 'Invalid cycleRange format',
        message: 'cycleRange must be in format [startCycle,endCycle], e.g., [1,10]'
      });
    }

    const startCycle = parseInt(cycleRangeMatch[1]);
    const endCycle = parseInt(cycleRangeMatch[2]);

    if (startCycle < 1 || endCycle < 1) {
      return res.status(400).json({ 
        error: 'Invalid cycle numbers',
        message: 'Cycle numbers must be positive integers'
      });
    }

    if (startCycle > endCycle) {
      return res.status(400).json({ 
        error: 'Invalid cycle range',
        message: 'startCycle must be less than or equal to endCycle'
      });
    }

    // Verify robot exists
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
    });

    if (!robot) {
      return res.status(404).json({ 
        error: 'Robot not found',
        message: `Robot with ID ${robotId} does not exist`
      });
    }

    // Parse boolean flags
    const includeMovingAverage = includeMovingAverageParam === 'true';
    const includeTrendLine = includeTrendLineParam === 'true';

    // Get ELO progression data
    const eloProgression = await robotPerformanceService.getELOProgression(
      robotId,
      [startCycle, endCycle]
    );

    // Build response
    const response: any = {
      robotId: eloProgression.robotId,
      cycleRange: eloProgression.cycleRange,
      dataPoints: eloProgression.dataPoints,
      startElo: eloProgression.startElo,
      endElo: eloProgression.endElo,
      totalChange: eloProgression.totalChange,
      averageChange: eloProgression.averageChange,
    };

    // Optionally include moving average
    if (includeMovingAverage && eloProgression.dataPoints.length > 0) {
      // Calculate 3-period moving average
      const movingAverage: number[] = [];
      for (let i = 0; i < eloProgression.dataPoints.length; i++) {
        if (i < 2) {
          movingAverage.push(eloProgression.dataPoints[i].elo);
        } else {
          const avg = (
            eloProgression.dataPoints[i - 2].elo + 
            eloProgression.dataPoints[i - 1].elo + 
            eloProgression.dataPoints[i].elo
          ) / 3;
          movingAverage.push(Math.round(avg * 100) / 100);
        }
      }
      response.movingAverage = movingAverage;
    }

    // Optionally include trend line
    if (includeTrendLine && eloProgression.dataPoints.length > 1) {
      // Calculate linear regression trend line
      const n = eloProgression.dataPoints.length;
      const sumX = eloProgression.dataPoints.reduce((sum, dp) => sum + dp.cycleNumber, 0);
      const sumY = eloProgression.dataPoints.reduce((sum, dp) => sum + dp.elo, 0);
      const sumXY = eloProgression.dataPoints.reduce((sum, dp) => sum + dp.cycleNumber * dp.elo, 0);
      const sumX2 = eloProgression.dataPoints.reduce((sum, dp) => sum + dp.cycleNumber * dp.cycleNumber, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      const trendPoints = eloProgression.dataPoints.map(dp => ({
        cycleNumber: dp.cycleNumber,
        value: Math.round((slope * dp.cycleNumber + intercept) * 100) / 100,
      }));

      response.trendLine = {
        slope: Math.round(slope * 100) / 100,
        intercept: Math.round(intercept * 100) / 100,
        points: trendPoints,
      };
    }

    return res.json(response);
  } catch (error) {
    console.error('[Analytics] Error in ELO progression:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/robot/:robotId/metric/:metricName
 * 
 * Returns metric progression data for a specific robot over a cycle range.
 * This is a generalized endpoint that supports multiple metrics:
 * - elo: ELO rating progression
 * - fame: Fame earned progression
 * - damageDealt: Cumulative damage dealt
 * - damageReceived: Cumulative damage received
 * - wins: Cumulative wins
 * - losses: Cumulative losses
 * - draws: Cumulative draws
 * - kills: Cumulative kills (opponent robots destroyed)
 * - creditsEarned: Cumulative credits earned
 * 
 * Query parameters:
 * - cycleRange: Cycle range as [startCycle,endCycle] (required)
 *   Example: cycleRange=[1,10]
 * - includeMovingAverage: Whether to include moving averages (optional, default: false)
 * - includeTrendLine: Whether to include trend line (optional, default: false)
 * 
 * Response:
 * {
 *   robotId: number,
 *   metric: string,
 *   cycleRange: [startCycle, endCycle],
 *   dataPoints: Array<{
 *     cycleNumber: number,
 *     value: number,
 *     change: number
 *   }>,
 *   startValue: number,
 *   endValue: number,
 *   totalChange: number,
 *   averageChange: number,
 *   movingAverage?: number[],
 *   trendLine?: {
 *     slope: number,
 *     intercept: number,
 *     points: Array<{ cycleNumber: number, value: number }>
 *   }
 * }
 * 
 * Requirements: 7.1, 7.3, 7.4
 */
router.get('/robot/:robotId/metric/:metricName', async (req: Request, res: Response) => {
  try {
    const robotId = parseInt(req.params.robotId);
    const metricName = req.params.metricName as any;
    const cycleRangeParam = req.query.cycleRange as string;
    const includeMovingAverageParam = req.query.includeMovingAverage as string | undefined;
    const includeTrendLineParam = req.query.includeTrendLine as string | undefined;

    // Validate robotId
    if (isNaN(robotId)) {
      return res.status(400).json({ 
        error: 'Invalid robotId',
        message: 'robotId must be a valid integer'
      });
    }

    // Validate metric name
    const validMetrics = ['elo', 'fame', 'damageDealt', 'damageReceived', 'wins', 'losses', 'draws', 'kills', 'creditsEarned'];
    if (!validMetrics.includes(metricName)) {
      return res.status(400).json({ 
        error: 'Invalid metric',
        message: `Metric must be one of: ${validMetrics.join(', ')}`
      });
    }

    // Validate cycleRange parameter
    if (!cycleRangeParam) {
      return res.status(400).json({ 
        error: 'Missing required parameter',
        message: 'The "cycleRange" query parameter is required (format: [startCycle,endCycle])'
      });
    }

    // Parse cycleRange [A,B]
    const cycleRangeMatch = cycleRangeParam.match(/^\[(-?\d+),(-?\d+)\]$/);
    if (!cycleRangeMatch) {
      return res.status(400).json({ 
        error: 'Invalid cycleRange format',
        message: 'cycleRange must be in format [startCycle,endCycle], e.g., [1,10]'
      });
    }

    const startCycle = parseInt(cycleRangeMatch[1]);
    const endCycle = parseInt(cycleRangeMatch[2]);

    if (startCycle < 1 || endCycle < 1) {
      return res.status(400).json({ 
        error: 'Invalid cycle numbers',
        message: 'Cycle numbers must be positive integers'
      });
    }

    if (startCycle > endCycle) {
      return res.status(400).json({ 
        error: 'Invalid cycle range',
        message: 'startCycle must be less than or equal to endCycle'
      });
    }

    // Verify robot exists
    const robot = await prisma.robot.findUnique({
      where: { id: robotId },
    });

    if (!robot) {
      return res.status(404).json({ 
        error: 'Robot not found',
        message: `Robot with ID ${robotId} does not exist`
      });
    }

    // Parse boolean flags
    const includeMovingAverage = includeMovingAverageParam === 'true';
    const includeTrendLine = includeTrendLineParam === 'true';

    // Get metric progression data
    const metricProgression = await robotPerformanceService.getRobotMetricProgression(
      robotId,
      metricName,
      [startCycle, endCycle]
    );

    // Build response
    const response: any = {
      robotId: metricProgression.robotId,
      metric: metricProgression.metric,
      cycleRange: metricProgression.cycleRange,
      dataPoints: metricProgression.dataPoints,
      startValue: metricProgression.startValue,
      endValue: metricProgression.endValue,
      totalChange: metricProgression.totalChange,
      averageChange: metricProgression.averageChange,
    };

    // Include moving average if already calculated by service
    if (includeMovingAverage && metricProgression.movingAverage) {
      response.movingAverage = metricProgression.movingAverage;
    }

    // Optionally include trend line
    if (includeTrendLine && metricProgression.dataPoints.length > 1) {
      // Calculate linear regression trend line
      const n = metricProgression.dataPoints.length;
      const sumX = metricProgression.dataPoints.reduce((sum, dp) => sum + dp.cycleNumber, 0);
      const sumY = metricProgression.dataPoints.reduce((sum, dp) => sum + dp.value, 0);
      const sumXY = metricProgression.dataPoints.reduce((sum, dp) => sum + dp.cycleNumber * dp.value, 0);
      const sumX2 = metricProgression.dataPoints.reduce((sum, dp) => sum + dp.cycleNumber * dp.cycleNumber, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      const trendPoints = metricProgression.dataPoints.map(dp => ({
        cycleNumber: dp.cycleNumber,
        value: Math.round((slope * dp.cycleNumber + intercept) * 100) / 100,
      }));

      response.trendLine = {
        slope: Math.round(slope * 100) / 100,
        intercept: Math.round(intercept * 100) / 100,
        points: trendPoints,
      };
    }

    return res.json(response);
  } catch (error) {
    console.error('[Analytics] Error in metric progression:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/leaderboard
 * 
 * Returns robot leaderboard data from the materialized view.
 * Fast queries optimized for leaderboard display.
 * 
 * Query parameters:
 * - orderBy: Metric to order by (optional, default: 'elo')
 *   Options: 'elo', 'winRate', 'battles', 'kills', 'damageDealt'
 * - limit: Number of results to return (optional, default: 100, max: 1000)
 * - offset: Number of results to skip (optional, default: 0)
 * 
 * Response:
 * {
 *   leaderboard: Array<{
 *     robotId: number,
 *     robotName: string,
 *     userId: number,
 *     currentElo: number,
 *     totalBattles: number,
 *     wins: number,
 *     draws: number,
 *     losses: number,
 *     winRate: number,
 *     totalDamageDealt: number,
 *     totalDamageReceived: number,
 *     totalKills: number,
 *     totalCreditsEarned: number,
 *     totalFameEarned: number,
 *     lastBattleAt: Date | null
 *   }>,
 *   orderBy: string,
 *   limit: number,
 *   offset: number,
 *   total: number
 * }
 * 
 * Requirements: 10.3
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const { robotStatsViewService } = await import('../services/robotStatsViewService');
    
    const orderByParam = req.query.orderBy as string | undefined;
    const limitParam = req.query.limit as string | undefined;
    const offsetParam = req.query.offset as string | undefined;

    // Validate and parse orderBy
    const validOrderBy = ['elo', 'winRate', 'battles', 'kills', 'damageDealt'];
    const orderBy = orderByParam && validOrderBy.includes(orderByParam) 
      ? orderByParam as any
      : 'elo';

    // Validate and parse limit
    let limit = 100;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return res.status(400).json({
          error: 'Invalid limit',
          message: 'limit must be a positive integer'
        });
      }
      limit = Math.min(parsedLimit, 1000); // Cap at 1000
    }

    // Validate and parse offset
    let offset = 0;
    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return res.status(400).json({
          error: 'Invalid offset',
          message: 'offset must be a non-negative integer'
        });
      }
      offset = parsedOffset;
    }

    // Get leaderboard data
    const leaderboard = await robotStatsViewService.getLeaderboard({
      orderBy,
      limit,
      offset,
    });

    // Get total count (for pagination)
    const totalResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*) as count FROM robot_current_stats'
    );
    const total = Number(totalResult[0].count);

    return res.json({
      leaderboard,
      orderBy,
      limit,
      offset,
      total,
    });
  } catch (error) {
    console.error('[Analytics] Error in leaderboard:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/robot/:robotId/stats
 * 
 * Returns current aggregated stats for a specific robot from the materialized view.
 * Fast query optimized for robot detail pages.
 * 
 * Response:
 * {
 *   robotId: number,
 *   robotName: string,
 *   userId: number,
 *   currentElo: number,
 *   totalBattles: number,
 *   wins: number,
 *   draws: number,
 *   losses: number,
 *   winRate: number,
 *   totalDamageDealt: number,
 *   totalDamageReceived: number,
 *   totalKills: number,
 *   totalCreditsEarned: number,
 *   totalFameEarned: number,
 *   lastBattleAt: Date | null
 * }
 * 
 * Requirements: 10.3
 */
router.get('/robot/:robotId/stats', async (req: Request, res: Response) => {
  try {
    const { robotStatsViewService } = await import('../services/robotStatsViewService');
    
    const robotId = parseInt(req.params.robotId);

    if (isNaN(robotId)) {
      return res.status(400).json({
        error: 'Invalid robotId',
        message: 'robotId must be a valid integer'
      });
    }

    const stats = await robotStatsViewService.getRobotStats(robotId);

    if (!stats) {
      return res.status(404).json({
        error: 'Robot not found',
        message: `No stats found for robot with ID ${robotId}`
      });
    }

    return res.json(stats);
  } catch (error) {
    console.error('[Analytics] Error getting robot stats:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/analytics/stats/refresh
 * 
 * Manually refresh the robot_current_stats materialized view.
 * Should be called after battles complete or at cycle end.
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 * 
 * Requirements: 10.3
 */
router.post('/stats/refresh', async (req: Request, res: Response) => {
  try {
    const { robotStatsViewService } = await import('../services/robotStatsViewService');
    
    await robotStatsViewService.refreshStats();

    return res.json({
      success: true,
      message: 'Robot stats materialized view refreshed successfully'
    });
  } catch (error) {
    console.error('[Analytics] Error refreshing stats:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/facility/:userId/roi
 * 
 * Returns ROI (Return on Investment) data for a specific facility owned by a user.
 * Calculates total investment, returns (income or savings), operating costs, and net ROI.
 * 
 * Query parameters:
 * - facilityType: Type of facility to analyze (required)
 *   Examples: 'merchandising_hub', 'repair_bay', 'training_facility', 'weapons_workshop'
 * 
 * Response:
 * {
 *   facilityType: string,
 *   currentLevel: number,
 *   totalInvestment: number,
 *   totalReturns: number,
 *   totalOperatingCosts: number,
 *   netROI: number,
 *   breakevenCycle: number | null,
 *   cyclesSincePurchase: number,
 *   isProfitable: boolean
 * }
 * 
 * Returns 404 if facility not purchased or no purchase event found.
 * 
 * Requirements: 12.3, 5.5, 8.2
 */
router.get('/facility/:userId/roi', async (req: Request, res: Response) => {
  try {
    const { roiCalculatorService } = await import('../services/roiCalculatorService');
    
    const userId = parseInt(req.params.userId);
    const facilityType = req.query.facilityType as string;

    // Validate userId
    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid userId',
        message: 'userId must be a valid integer'
      });
    }

    // Validate facilityType parameter
    if (!facilityType) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'The "facilityType" query parameter is required'
      });
    }

    // Validate facilityType value
    const validFacilityTypes = [
      'repair_bay',
      'training_facility',
      'weapons_workshop',
      'streaming_studio',
      'research_lab',
      'medical_bay',
      'roster_expansion',
      'storage_facility',
      'coaching_staff',
      'booking_office',
      'combat_training_academy',
      'defense_training_academy',
      'mobility_training_academy',
      'ai_training_academy',
      'merchandising_hub',
      'streaming_studio'
    ];

    if (!validFacilityTypes.includes(facilityType)) {
      return res.status(400).json({
        error: 'Invalid facilityType',
        message: `facilityType must be one of: ${validFacilityTypes.join(', ')}`
      });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with ID ${userId} does not exist`
      });
    }

    // Calculate facility ROI
    const roi = await roiCalculatorService.calculateFacilityROI(userId, facilityType);

    if (!roi) {
      return res.status(404).json({
        error: 'Facility not purchased',
        message: `User ${userId} has not purchased ${facilityType} or no purchase event found`
      });
    }

    return res.json(roi);
  } catch (error) {
    console.error('[Analytics] Error calculating facility ROI:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/facility/:userId/roi/all
 * 
 * Returns ROI data for all facilities owned by a user.
 * Provides a comprehensive view of all facility investments and their returns.
 * 
 * Response:
 * {
 *   userId: number,
 *   facilities: Array<{
 *     facilityType: string,
 *     currentLevel: number,
 *     totalInvestment: number,
 *     totalReturns: number,
 *     totalOperatingCosts: number,
 *     netROI: number,
 *     breakevenCycle: number | null,
 *     cyclesSincePurchase: number,
 *     isProfitable: boolean
 *   }>,
 *   totalInvestment: number,
 *   totalReturns: number,
 *   totalOperatingCosts: number,
 *   overallNetROI: number
 * }
 * 
 * Requirements: 12.3, 5.5, 8.2
 */
router.get('/facility/:userId/roi/all', async (req: Request, res: Response) => {
  try {
    const { roiCalculatorService } = await import('../services/roiCalculatorService');
    
    const userId = parseInt(req.params.userId);

    // Validate userId
    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid userId',
        message: 'userId must be a valid integer'
      });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with ID ${userId} does not exist`
      });
    }

    // Calculate ROI for all facilities
    const facilities = await roiCalculatorService.calculateAllFacilityROIs(userId);

    // Calculate overall totals
    const totalInvestment = facilities.reduce((sum, f) => sum + f.totalInvestment, 0);
    const totalReturns = facilities.reduce((sum, f) => sum + f.totalReturns, 0);
    const totalOperatingCosts = facilities.reduce((sum, f) => sum + f.totalOperatingCosts, 0);
    
    const overallNetProfit = totalReturns - totalOperatingCosts - totalInvestment;
    const overallNetROI = totalInvestment > 0 ? overallNetProfit / totalInvestment : 0;

    return res.json({
      userId,
      facilities,
      totalInvestment,
      totalReturns,
      totalOperatingCosts,
      overallNetROI,
    });
  } catch (error) {
    console.error('[Analytics] Error calculating all facility ROIs:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/facility/:userId/recommendations
 * 
 * Returns ranked facility recommendations based on projected ROI.
 * 
 * Query parameters:
 * - lastNCycles: Number of cycles to analyze for activity metrics (default: 10)
 * 
 * Response:
 * {
 *   recommendations: Array<{
 *     facilityType: string,
 *     facilityName: string,
 *     currentLevel: number,
 *     recommendedLevel: number,
 *     upgradeCost: number,
 *     projectedROI: number,
 *     projectedPayoffCycles: number | null,
 *     reason: string,
 *     priority: 'high' | 'medium' | 'low'
 *   }>,
 *   totalRecommendedInvestment: number,
 *   userCurrency: number,
 *   userPrestige: number,
 *   analysisWindow: {
 *     startCycle: number,
 *     endCycle: number,
 *     cycleCount: number
 *   }
 * }
 * 
 * Requirements: 8.5
 */
router.get('/facility/:userId/recommendations', async (req: Request, res: Response) => {
  try {
    const { facilityRecommendationService } = await import('../services/facilityRecommendationService');
    
    const userId = parseInt(req.params.userId);
    const lastNCyclesParam = req.query.lastNCycles as string;
    const lastNCycles = lastNCyclesParam ? parseInt(lastNCyclesParam) : 10;

    // Validate userId
    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid userId',
        message: 'userId must be a valid number'
      });
    }

    // Validate lastNCycles
    if (lastNCyclesParam && (isNaN(lastNCycles) || lastNCycles < 1)) {
      return res.status(400).json({
        error: 'Invalid lastNCycles parameter',
        message: 'lastNCycles must be a positive number'
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with ID ${userId} does not exist`
      });
    }

    // Generate recommendations
    const recommendations = await facilityRecommendationService.generateRecommendations(
      userId,
      lastNCycles
    );

    return res.json(recommendations);
  } catch (error) {
    console.error('[Analytics] Error generating facility recommendations:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

/**
 * GET /api/analytics/performance
 * 
 * Returns cycle performance metrics for a range of cycles.
 * Validates: Requirements 15.4, 15.5
 * 
 * Query params:
 * - startCycle: number
 * - endCycle: number
 * 
 * Response: CyclePerformanceMetrics[]
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const startCycle = parseInt(req.query.startCycle as string) || 1;
    const endCycle = parseInt(req.query.endCycle as string) || 10;

    const { CyclePerformanceMonitoringService } = await import('../services/cyclePerformanceMonitoringService');
    const perfService = new CyclePerformanceMonitoringService();

    const metrics = [];
    for (let cycle = startCycle; cycle <= endCycle; cycle++) {
      const cycleMetrics = await perfService.getCyclePerformanceMetrics(cycle, cycle);
      if (cycleMetrics) {
        metrics.push(cycleMetrics);
      }
    }

    return res.json(metrics);
  } catch (error) {
    console.error('[Analytics] Error getting performance metrics:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/analytics/integrity
 * 
 * Returns data integrity reports for a range of cycles.
 * Validates: Requirements 9.2, 9.4
 * 
 * Query params:
 * - startCycle: number
 * - endCycle: number
 * 
 * Response: IntegrityReport[]
 */
router.get('/integrity', async (req: Request, res: Response) => {
  try {
    const startCycle = parseInt(req.query.startCycle as string) || 1;
    const endCycle = parseInt(req.query.endCycle as string) || 10;

    const { DataIntegrityService } = await import('../services/dataIntegrityService');
    const integrityService = new DataIntegrityService();

    const reports = await integrityService.validateCycleRange(startCycle, endCycle);

    return res.json(reports);
  } catch (error) {
    console.error('[Analytics] Error getting integrity reports:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/analytics/logs/summary
 * 
 * Returns event log summary for a range of cycles.
 * Note: Renamed from /events/stats and /events/metrics to avoid ad blocker issues
 * Ad blockers commonly block URLs containing "events", "stats", "metrics", "analytics"
 * Validates: Requirements 9.2
 * 
 * Query params:
 * - startCycle: number
 * - endCycle: number
 * 
 * Response: EventStatistics
 */
router.get('/logs/summary', async (req: Request, res: Response) => {
  try {
    const startCycle = parseInt(req.query.startCycle as string) || 1;
    const endCycle = parseInt(req.query.endCycle as string) || 10;

    const { queryService } = await import('../services/queryService');

    const stats = await queryService.getEventStatistics([startCycle, endCycle]);

    return res.json(stats);
  } catch (error) {
    console.error('[Analytics] Error getting event statistics:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
