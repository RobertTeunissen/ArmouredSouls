/**
 * Analytics API Routes
 *
 * Provides REST API endpoints for analytics queries.
 * Handlers are thin wrappers: parse input → call service → return result.
 *
 * Requirements: 12.1
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { robotPerformanceService } from '../services/analytics/robotPerformanceService';
import type { RobotMetric } from '../services/analytics/robotPerformanceService';
import type { LeaderboardOptions } from '../services/analytics/robotStatsViewService';
import { getCurrentCycle } from '../services/analytics/cycleAnalyticsService';
import { getStableSummary } from '../services/analytics/stableAnalyticsService';
import { getLeaderboardWithTotal } from '../services/analytics/leaderboardAnalyticsService';
import { getAllFacilityROIs } from '../services/analytics/facilityAnalyticsService';
import { getKothPerformance } from '../services/analytics/kothAnalyticsService';
import { calculateEloMovingAverage, calculateTrendLine } from '../services/analytics/trendHelpers';
import prisma from '../lib/prisma';
import {
  AppError,
  RobotError,
  RobotErrorCode,
  AuthError,
  AuthErrorCode,
  EconomyError,
  EconomyErrorCode,
  KothError,
  KothErrorCode,
} from '../errors';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';

const router = express.Router();

// --- Zod schemas for analytics routes ---

const userIdParamsSchema = z.object({
  userId: positiveIntParam,
});

const robotIdParamsSchema = z.object({
  robotId: positiveIntParam,
});

const robotIdByIdParamsSchema = z.object({
  id: positiveIntParam,
});

const robotMetricParamsSchema = z.object({
  robotId: positiveIntParam,
  metricName: z.string().min(1).max(30),
});

const leaderboardQuerySchema = z.object({
  orderBy: z.enum(['elo', 'winRate', 'battles', 'kills', 'damageDealt']).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const cycleRangeQuerySchema = z.object({
  startCycle: z.coerce.number().int().positive().optional(),
  endCycle: z.coerce.number().int().positive().optional(),
});

// --- Shared validation helpers ---

function parseCycleRange(param: string): [number, number] {
  const match = param.match(/^\[(-?\d+),(-?\d+)\]$/);
  if (!match) {
    throw new AppError('INVALID_CYCLE_RANGE_FORMAT', 'cycleRange must be in format [startCycle,endCycle], e.g., [1,10]', 400);
  }
  const start = parseInt(match[1]);
  const end = parseInt(match[2]);
  if (start < 1 || end < 1) {
    throw new AppError('INVALID_CYCLE_NUMBERS', 'Cycle numbers must be positive integers', 400);
  }
  if (start > end) {
    throw new AppError('INVALID_CYCLE_RANGE', 'startCycle must be less than or equal to endCycle', 400);
  }
  return [start, end];
}

async function requireRobotExists(robotId: number): Promise<void> {
  const robot = await prisma.robot.findUnique({ where: { id: robotId } });
  if (!robot) {
    throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, `Robot with ID ${robotId} does not exist`, 404);
  }
}

async function requireUserExists(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AuthError(AuthErrorCode.USER_NOT_FOUND, `User with ID ${userId} does not exist`, 404);
  }
}

const VALID_PROGRESSION_METRICS = ['elo', 'fame', 'damageDealt', 'damageReceived', 'wins', 'losses', 'creditsEarned'];
const VALID_METRIC_NAMES = ['elo', 'fame', 'damageDealt', 'damageReceived', 'wins', 'losses', 'draws', 'kills', 'creditsEarned'];
const VALID_FACILITY_TYPES = [
  'repair_bay', 'training_facility', 'weapons_workshop', 'streaming_studio',
  'research_lab', 'medical_bay', 'roster_expansion', 'storage_facility',
  'coaching_staff', 'booking_office', 'combat_training_academy',
  'defense_training_academy', 'mobility_training_academy', 'ai_training_academy',
  'merchandising_hub',
];

// --- Route handlers ---

/** GET /api/analytics/cycle/current */
router.get('/cycle/current', validateRequest({}), async (_req: Request, res: Response) => {
  const result = await getCurrentCycle();
  return res.json(result);
});

/** GET /api/analytics/stable/:userId/summary */
router.get('/stable/:userId/summary', validateRequest({ params: userIdParamsSchema }), async (req: Request, res: Response) => {
  const userId = parseInt(String(req.params.userId));
  if (isNaN(userId)) throw new AppError('INVALID_USER_ID', 'Invalid userId', 400);

  const lastNCyclesParam = req.query.lastNCycles as string;
  const lastNCycles = lastNCyclesParam ? parseInt(lastNCyclesParam) : 10;
  if (lastNCyclesParam && (isNaN(lastNCycles) || lastNCycles < 1)) {
    throw new AppError('INVALID_PARAMETER', 'Invalid lastNCycles parameter', 400);
  }

  const result = await getStableSummary(userId, lastNCycles);
  return res.json(result);
});

/** GET /api/analytics/robot/:robotId/performance */
router.get('/robot/:robotId/performance', validateRequest({ params: robotIdParamsSchema }), async (req: Request, res: Response) => {
  const robotId = parseInt(String(req.params.robotId));
  if (isNaN(robotId)) throw new AppError('INVALID_ROBOT_ID', 'robotId must be a valid integer', 400);

  const cycleRangeParam = req.query.cycleRange as string;
  if (!cycleRangeParam) throw new AppError('MISSING_PARAMETER', 'The "cycleRange" query parameter is required (format: [startCycle,endCycle])', 400);
  const [startCycle, endCycle] = parseCycleRange(cycleRangeParam);

  await requireRobotExists(robotId);

  const includeELOProgression = req.query.includeELOProgression === 'true';
  const includeMetricProgression = req.query.includeMetricProgression === 'true' || includeELOProgression;
  const progressionMetric = (req.query.progressionMetric as string || 'elo') as RobotMetric;

  if (!VALID_PROGRESSION_METRICS.includes(progressionMetric)) {
    throw new AppError('INVALID_METRIC', `progressionMetric must be one of: ${VALID_PROGRESSION_METRICS.join(', ')}`, 400);
  }

  const summary = await robotPerformanceService.getRobotPerformanceSummary(robotId, [startCycle, endCycle]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: Record<string, any> = { ...summary };

  if (includeMetricProgression) {
    const metricProgression = await robotPerformanceService.getRobotMetricProgression(robotId, progressionMetric, [startCycle, endCycle]);
    if (progressionMetric === 'elo' && includeELOProgression) {
      response.eloProgression = {
        robotId: metricProgression.robotId,
        cycleRange: metricProgression.cycleRange,
        dataPoints: metricProgression.dataPoints.map(dp => ({ cycleNumber: dp.cycleNumber, elo: dp.value, change: dp.change })),
        startElo: metricProgression.startValue,
        endElo: metricProgression.endValue,
        totalChange: metricProgression.totalChange,
        averageChange: metricProgression.averageChange,
      };
    }
    response.metricProgression = metricProgression;
  }

  return res.json(response);
});

/** GET /api/analytics/robot/:robotId/elo */
router.get('/robot/:robotId/elo', validateRequest({ params: robotIdParamsSchema }), async (req: Request, res: Response) => {
  const robotId = parseInt(String(req.params.robotId));
  if (isNaN(robotId)) throw new AppError('INVALID_ROBOT_ID', 'robotId must be a valid integer', 400);

  const cycleRangeParam = req.query.cycleRange as string;
  if (!cycleRangeParam) throw new AppError('MISSING_PARAMETER', 'The "cycleRange" query parameter is required (format: [startCycle,endCycle])', 400);
  const [startCycle, endCycle] = parseCycleRange(cycleRangeParam);

  await requireRobotExists(robotId);

  const includeMovingAverage = req.query.includeMovingAverage === 'true';
  const includeTrendLine = req.query.includeTrendLine === 'true';

  const eloProgression = await robotPerformanceService.getELOProgression(robotId, [startCycle, endCycle]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: Record<string, any> = {
    robotId: eloProgression.robotId,
    cycleRange: eloProgression.cycleRange,
    dataPoints: eloProgression.dataPoints,
    startElo: eloProgression.startElo,
    endElo: eloProgression.endElo,
    totalChange: eloProgression.totalChange,
    averageChange: eloProgression.averageChange,
  };

  if (includeMovingAverage && eloProgression.dataPoints.length > 0) {
    response.movingAverage = calculateEloMovingAverage(eloProgression.dataPoints);
  }

  if (includeTrendLine && eloProgression.dataPoints.length > 1) {
    response.trendLine = calculateTrendLine(
      eloProgression.dataPoints.map(dp => ({ cycleNumber: dp.cycleNumber, value: dp.elo })),
    );
  }

  return res.json(response);
});

/** GET /api/analytics/robot/:robotId/metric/:metricName */
router.get('/robot/:robotId/metric/:metricName', validateRequest({ params: robotMetricParamsSchema }), async (req: Request, res: Response) => {
  const robotId = parseInt(String(req.params.robotId));
  const metricName = String(req.params.metricName) as RobotMetric;
  if (isNaN(robotId)) throw new AppError('INVALID_ROBOT_ID', 'robotId must be a valid integer', 400);
  if (!VALID_METRIC_NAMES.includes(metricName)) {
    throw new AppError('INVALID_METRIC', `Metric must be one of: ${VALID_METRIC_NAMES.join(', ')}`, 400);
  }

  const cycleRangeParam = req.query.cycleRange as string;
  if (!cycleRangeParam) throw new AppError('MISSING_PARAMETER', 'The "cycleRange" query parameter is required (format: [startCycle,endCycle])', 400);
  const [startCycle, endCycle] = parseCycleRange(cycleRangeParam);

  await requireRobotExists(robotId);

  const includeMovingAverage = req.query.includeMovingAverage === 'true';
  const includeTrendLine = req.query.includeTrendLine === 'true';

  const metricProgression = await robotPerformanceService.getRobotMetricProgression(robotId, metricName, [startCycle, endCycle]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: Record<string, any> = {
    robotId: metricProgression.robotId,
    metric: metricProgression.metric,
    cycleRange: metricProgression.cycleRange,
    dataPoints: metricProgression.dataPoints,
    startValue: metricProgression.startValue,
    endValue: metricProgression.endValue,
    totalChange: metricProgression.totalChange,
    averageChange: metricProgression.averageChange,
  };

  if (includeMovingAverage && metricProgression.movingAverage) {
    response.movingAverage = metricProgression.movingAverage;
  }

  if (includeTrendLine && metricProgression.dataPoints.length > 1) {
    response.trendLine = calculateTrendLine(metricProgression.dataPoints);
  }

  return res.json(response);
});

/** GET /api/analytics/leaderboard */
router.get('/leaderboard', validateRequest({ query: leaderboardQuerySchema }), async (req: Request, res: Response) => {
  const validOrderBy = ['elo', 'winRate', 'battles', 'kills', 'damageDealt'];
  const orderByParam = req.query.orderBy as string | undefined;
  const orderBy = (orderByParam && validOrderBy.includes(orderByParam)
    ? orderByParam
    : 'elo') as LeaderboardOptions['orderBy'];

  let limit = 100;
  if (req.query.limit) {
    const parsed = parseInt(req.query.limit as string);
    if (isNaN(parsed) || parsed < 1) throw new AppError('INVALID_LIMIT', 'limit must be a positive integer', 400);
    limit = Math.min(parsed, 1000);
  }

  let offset = 0;
  if (req.query.offset) {
    const parsed = parseInt(req.query.offset as string);
    if (isNaN(parsed) || parsed < 0) throw new AppError('INVALID_OFFSET', 'offset must be a non-negative integer', 400);
    offset = parsed;
  }

  const result = await getLeaderboardWithTotal({ orderBy, limit, offset });
  return res.json(result);
});

/** GET /api/analytics/robot/:robotId/stats */
router.get('/robot/:robotId/stats', validateRequest({ params: robotIdParamsSchema }), async (req: Request, res: Response) => {
  const { robotStatsViewService } = await import('../services/analytics/robotStatsViewService');
  const robotId = parseInt(String(req.params.robotId));
  if (isNaN(robotId)) throw new AppError('INVALID_ROBOT_ID', 'robotId must be a valid integer', 400);

  const stats = await robotStatsViewService.getRobotStats(robotId);
  if (!stats) throw new RobotError(RobotErrorCode.ROBOT_NOT_FOUND, `No stats found for robot with ID ${robotId}`, 404);

  return res.json(stats);
});

/** POST /api/analytics/stats/refresh */
router.post('/stats/refresh', validateRequest({}), async (_req: Request, res: Response) => {
  const { robotStatsViewService } = await import('../services/analytics/robotStatsViewService');
  await robotStatsViewService.refreshStats();
  return res.json({ success: true, message: 'Robot stats materialized view refreshed successfully' });
});

/** GET /api/analytics/facility/:userId/roi */
router.get('/facility/:userId/roi', validateRequest({ params: userIdParamsSchema }), async (req: Request, res: Response) => {
  const { roiCalculatorService } = await import('../services/economy/roiCalculatorService');
  const userId = parseInt(String(req.params.userId));
  if (isNaN(userId)) throw new AppError('INVALID_USER_ID', 'userId must be a valid integer', 400);

  const facilityType = req.query.facilityType as string;
  if (!facilityType) throw new AppError('MISSING_PARAMETER', 'The "facilityType" query parameter is required', 400);
  if (!VALID_FACILITY_TYPES.includes(facilityType)) {
    throw new EconomyError(EconomyErrorCode.INVALID_FACILITY_TYPE, `facilityType must be one of: ${VALID_FACILITY_TYPES.join(', ')}`, 400);
  }

  await requireUserExists(userId);

  const roi = await roiCalculatorService.calculateFacilityROI(userId, facilityType);
  if (!roi) throw new EconomyError(EconomyErrorCode.FACILITY_NOT_FOUND, `User ${userId} has not purchased ${facilityType} or no purchase event found`, 404);

  return res.json(roi);
});

/** GET /api/analytics/facility/:userId/roi/all */
router.get('/facility/:userId/roi/all', validateRequest({ params: userIdParamsSchema }), async (req: Request, res: Response) => {
  const userId = parseInt(String(req.params.userId));
  if (isNaN(userId)) throw new AppError('INVALID_USER_ID', 'userId must be a valid integer', 400);
  await requireUserExists(userId);

  const result = await getAllFacilityROIs(userId);
  return res.json(result);
});

/** GET /api/analytics/facility/:userId/recommendations */
router.get('/facility/:userId/recommendations', validateRequest({ params: userIdParamsSchema }), async (req: Request, res: Response) => {
  const { facilityRecommendationService } = await import('../services/economy/facilityRecommendationService');
  const userId = parseInt(String(req.params.userId));
  if (isNaN(userId)) throw new AppError('INVALID_USER_ID', 'userId must be a valid number', 400);

  const lastNCyclesParam = req.query.lastNCycles as string;
  const lastNCycles = lastNCyclesParam ? parseInt(lastNCyclesParam) : 10;
  if (lastNCyclesParam && (isNaN(lastNCycles) || lastNCycles < 1)) {
    throw new AppError('INVALID_PARAMETER', 'lastNCycles must be a positive number', 400);
  }

  await requireUserExists(userId);

  const recommendations = await facilityRecommendationService.generateRecommendations(userId, lastNCycles);
  return res.json(recommendations);
});

/** GET /api/analytics/robot/:id/koth-performance */
router.get('/robot/:id/koth-performance', authenticateToken, validateRequest({ params: robotIdByIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const robotId = parseInt(String(req.params.id));
  const result = await getKothPerformance(robotId);
  if (!result) throw new KothError(KothErrorCode.KOTH_NOT_FOUND, 'No KotH data for this robot', 404);
  return res.json(result);
});

/** GET /api/analytics/performance */
router.get('/performance', validateRequest({ query: cycleRangeQuerySchema }), async (req: Request, res: Response) => {
  const startCycle = parseInt(req.query.startCycle as string) || 1;
  const endCycle = parseInt(req.query.endCycle as string) || 10;

  const { CyclePerformanceMonitoringService } = await import('../services/cycle/cyclePerformanceMonitoringService');
  const perfService = new CyclePerformanceMonitoringService();

  const metrics = [];
  for (let cycle = startCycle; cycle <= endCycle; cycle++) {
    const cycleMetrics = await perfService.getCyclePerformanceMetrics(cycle, cycle);
    if (cycleMetrics) metrics.push(cycleMetrics);
  }

  return res.json(metrics);
});

/** GET /api/analytics/integrity */
router.get('/integrity', validateRequest({ query: cycleRangeQuerySchema }), async (req: Request, res: Response) => {
  const startCycle = parseInt(req.query.startCycle as string) || 1;
  const endCycle = parseInt(req.query.endCycle as string) || 10;

  const { DataIntegrityService } = await import('../services/common/dataIntegrityService');
  const integrityService = new DataIntegrityService();

  const reports = await integrityService.validateCycleRange(startCycle, endCycle);
  return res.json(reports);
});

/** GET /api/analytics/logs/summary */
router.get('/logs/summary', validateRequest({ query: cycleRangeQuerySchema }), async (req: Request, res: Response) => {
  const startCycle = parseInt(req.query.startCycle as string) || 1;
  const endCycle = parseInt(req.query.endCycle as string) || 10;

  const { queryService } = await import('../services/common/queryService');
  const stats = await queryService.getEventStatistics([startCycle, endCycle]);
  return res.json(stats);
});

export default router;
