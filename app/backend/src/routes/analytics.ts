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
import { getCurrentCycle } from '../services/analytics/cycleAnalyticsService';
import { unifiedFacilityROIService } from '../services/economy/unifiedFacilityROIService';
import { getKothPerformance } from '../services/analytics/kothAnalyticsService';
import { calculateTrendLine } from '../services/analytics/trendHelpers';
import prisma from '../lib/prisma';
import {
  AppError,
  RobotError,
  RobotErrorCode,
  AuthError,
  AuthErrorCode,
  KothError,
  KothErrorCode,
} from '../errors';
import { validateRequest, validated } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import { parseCycleRange } from '../utils/cycleRangeParser';

const router = express.Router();

// --- Zod schemas for analytics routes ---

const userIdParamsSchema = z.object({
  userId: positiveIntParam,
});

const robotIdByIdParamsSchema = z.object({
  id: positiveIntParam,
});

const robotMetricParamsSchema = z.object({
  robotId: positiveIntParam,
  metricName: z.string().min(1).max(30),
});


// The handler still reports a missing cycleRange itself (MISSING_PARAMETER) and
// parses its "[start,end]" format; flags count only when exactly "true".
const robotMetricQuerySchema = z.object({
  cycleRange: z.string().max(40).optional(),
  includeMovingAverage: z.string().max(10).optional(),
  includeTrendLine: z.string().max(10).optional(),
});

// --- Shared validation helpers ---

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

const VALID_METRIC_NAMES = ['elo', 'fame', 'damageDealt', 'damageReceived', 'wins', 'losses', 'draws', 'kills', 'creditsEarned'];

// --- Route handlers ---

/** GET /api/analytics/cycle/current */
router.get('/cycle/current', authenticateToken, validateRequest({}), async (_req: Request, res: Response) => {
  const result = await getCurrentCycle();
  return res.json(result);
});

/** GET /api/analytics/robot/:robotId/metric/:metricName */
router.get('/robot/:robotId/metric/:metricName', authenticateToken, ...validated({ params: robotMetricParamsSchema, query: robotMetricQuerySchema }, async (_req: Request, res: Response, { params, query }) => {
  const robotId = params.robotId;
  const metricName = params.metricName as RobotMetric;
  if (!VALID_METRIC_NAMES.includes(metricName)) {
    throw new AppError('INVALID_METRIC', `Metric must be one of: ${VALID_METRIC_NAMES.join(', ')}`, 400);
  }

  const cycleRangeParam = query.cycleRange;
  if (!cycleRangeParam) throw new AppError('MISSING_PARAMETER', 'The "cycleRange" query parameter is required (format: [startCycle,endCycle])', 400);
  const [startCycle, endCycle] = parseCycleRange(cycleRangeParam);

  await requireRobotExists(robotId);

  const includeMovingAverage = query.includeMovingAverage === 'true';
  const includeTrendLine = query.includeTrendLine === 'true';

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
}));

// Spec #51: three endpoints were removed here — GET /api/analytics/leaderboard,
// GET /api/analytics/robot/:robotId/stats and POST /api/analytics/stats/refresh.
//
// All three read the `robot_current_stats` materialized view, which no migration ever
// created: spec "cycle-audit-logging-system" task 5.6 is ticked but its DDL never
// landed. Every request to them could only ever raise a Postgres "relation does not
// exist" and answer 500, and nothing called them — the game's leaderboards are served
// by `/api/leaderboards/*` and `leaderboardService`, and the robot analytics the
// frontend uses are `/performance`, `/metric/:metric` and `/koth-performance`.
//
// Deleted rather than backfilled with a migration because a battles-derived view of
// ELO and win counts would be a second source of truth for ranking, and
// .kiro/steering/coding-standards.md makes `standings` the only one.

/** GET /api/analytics/facility/:userId/roi/all-economic */
router.get('/facility/:userId/roi/all-economic', authenticateToken, ...validated({ params: userIdParamsSchema }, async (req: Request, res: Response, { params }) => {
  const authReq = req as AuthRequest;
  const userId = params.userId;
  if (authReq.user!.userId !== userId && authReq.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  await requireUserExists(userId);

  const result = await unifiedFacilityROIService.calculateAllEconomicROIs(userId);
  return res.json(result);
}));

/** GET /api/analytics/facility/:userId/recommendations */
router.get('/facility/:userId/recommendations', authenticateToken, ...validated({ params: userIdParamsSchema }, async (req: Request, res: Response, { params }) => {
  const { facilityRecommendationService } = await import('../services/economy/facilityRecommendationService');
  const authReq = req as AuthRequest;
  const userId = params.userId;
  if (authReq.user!.userId !== userId && authReq.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  await requireUserExists(userId);

  const recommendations = await facilityRecommendationService.generateRecommendations(userId);
  return res.json(recommendations);
}));

/** GET /api/analytics/robot/:id/koth-performance */
router.get('/robot/:id/koth-performance', authenticateToken, ...validated({ params: robotIdByIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
  const robotId = params.id;
  const result = await getKothPerformance(robotId);
  if (!result) throw new KothError(KothErrorCode.KOTH_NOT_FOUND, 'No KotH data for this robot', 404);
  return res.json(result);
}));

export default router;
