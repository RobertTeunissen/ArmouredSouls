import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { executeScheduledBattles } from '../services/league/leagueBattleOrchestrator';
import { runMatchmaking } from '../services/analytics/matchmakingService';
import { rebalanceLeagues } from '../services/league/leagueRebalancingService';
import logger from '../config/logger';
import { rebalanceTagTeamLeagues } from '../services/tag-team/tagTeamLeagueRebalancingService';
import { runTagTeamMatchmaking } from '../services/tag-team/tagTeamMatchmakingService';
import { executeScheduledTagTeamBattles } from '../services/tag-team/tagTeamBattleOrchestrator';
import { processAllDailyFinances } from '../utils/economyCalculations';
import tournamentRoutes from './adminTournaments';
import { getSchedulerState } from '../services/cycle/cycleScheduler';
import { AppError } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam, paginationQuery } from '../utils/securityValidation';
import { securityMonitor } from '../services/security/securityMonitor';
import { SecuritySeverity } from '../services/security/securityLogger';
import { resetPassword } from '../services/auth/passwordResetService';
import { validatePassword } from '../utils/validation';
import { practiceArenaMetrics } from '../services/practice-arena/practiceArenaMetrics';
import {
  getAdminBattleList,
  getAdminBattleDetail,
} from '../services/admin/adminBattleService';
import {
  getSystemStats,
  getAtRiskUsers,
  getRobotAttributeStats,
  getRecentUserActivity,
  getRepairAuditLog,
} from '../services/admin/adminStatsService';
import {
  repairAllRobotsAdmin,
  recalculateAllRobotHP,
} from '../services/admin/adminMaintenanceService';
import {
  executeBulkCycles,
  backfillCycleSnapshots,
} from '../services/admin/adminCycleService';
import prisma from '../lib/prisma';

const router = express.Router();

// --- Zod schemas for admin routes ---

const battleIdParamsSchema = z.object({
  id: positiveIntParam,
});

const scheduledForBodySchema = z.object({
  scheduledFor: z.string().optional(),
});

const repairAllBodySchema = z.object({
  deductCosts: z.boolean().optional().default(false),
});

const bulkCyclesBodySchema = z.object({
  cycles: z.number().int().positive().max(100).optional().default(1),
  generateUsersPerCycle: z.boolean().optional().default(false),
  includeTournaments: z.boolean().optional().default(true),
  includeKoth: z.boolean().optional().default(true),
});

const battlesQuerySchema = paginationQuery.extend({
  leagueType: z.string().optional(),
  battleType: z.string().optional(),
});

const recentUsersQuerySchema = z.object({
  cycles: z.coerce.number().int().positive().max(200).optional().default(10),
});

const repairAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  repairType: z.enum(['manual', 'automatic']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const securityEventsQuerySchema = z.object({
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  eventType: z.string().optional(),
  userId: z.coerce.number().int().positive().optional(),
  since: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

const userSearchQuerySchema = z.object({
  q: z.string().min(1).max(50),
});

const resetPasswordParamsSchema = z.object({
  id: positiveIntParam,
});

const resetPasswordBodySchema = z.object({
  password: z.string(),
});

// Mount tournament routes
router.use('/tournaments', tournamentRoutes);

// Configuration constants
const BANKRUPTCY_RISK_THRESHOLD = 10000; // Credits below which a user is considered at risk

/**
 * POST /api/admin/matchmaking/run
 * Trigger matchmaking for all leagues
 */
router.post('/matchmaking/run', authenticateToken, requireAdmin, validateRequest({ body: scheduledForBodySchema }), async (req: Request, res: Response) => {
  try {
    const { scheduledFor } = req.body;
    const targetTime = scheduledFor ? new Date(scheduledFor) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    logger.info('[Admin] Triggering matchmaking...');
    const totalMatches = await runMatchmaking(targetTime);

    res.json({
      success: true,
      matchesCreated: totalMatches,
      scheduledFor: targetTime.toISOString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Matchmaking error:', error);
    res.status(500).json({
      error: 'Failed to run matchmaking',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/battles/run
 * Execute scheduled battles
 */
router.post('/battles/run', authenticateToken, requireAdmin, validateRequest({ body: scheduledForBodySchema }), async (req: Request, res: Response) => {
  try {
    const { scheduledFor } = req.body;
    // Only pass a date if scheduledFor is explicitly provided
    // If not provided, pass undefined to execute ALL scheduled matches
    const targetTime = scheduledFor ? new Date(scheduledFor) : undefined;

    logger.info('[Admin] Executing battles...');
    const summary = await executeScheduledBattles(targetTime);

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Battle execution error:', error);
    res.status(500).json({
      error: 'Failed to execute battles',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/leagues/rebalance
 * Trigger league rebalancing (promotions/demotions)
 */
router.post('/leagues/rebalance', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    logger.info('[Admin] Triggering league rebalancing...');
    const summary = await rebalanceLeagues();

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Rebalancing error:', error);
    res.status(500).json({
      error: 'Failed to rebalance leagues',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/repair/all
 * Auto-repair all robots to 100% HP
 */
router.post('/repair/all', authenticateToken, requireAdmin, validateRequest({ body: repairAllBodySchema }), async (req: Request, res: Response) => {
  try {
    const { deductCosts = false } = req.body;
    const result = await repairAllRobotsAdmin(deductCosts);
    res.json(result);
  } catch (error) {
    logger.error('[Admin] Auto-repair error:', error);
    res.status(500).json({
      error: 'Failed to auto-repair robots',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/recalculate-hp
 * Recalculate HP for all robots using the new formula: 30 + (hullIntegrity × 8)
 */
router.post('/recalculate-hp', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    const result = await recalculateAllRobotHP();
    res.json(result);
  } catch (error) {
    logger.error('[Admin] HP recalculation error:', error);
    res.status(500).json({
      error: 'Failed to recalculate HP',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/daily-finances/process
 * Process daily financial obligations (operating costs) for all users
 */
router.post('/daily-finances/process', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    logger.info('[Admin] Processing daily finances for all users...');
    
    const summary = await processAllDailyFinances();
    
    logger.info(`[Admin] Processed ${summary.usersProcessed} users, ` +
      `deducted ₡${summary.totalCostsDeducted.toLocaleString()}, ` +
      `${summary.bankruptUsers} bankruptcies`);
    
    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Daily finances error:', error);
    res.status(500).json({
      error: 'Failed to process daily finances',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/cycles/bulk
 * Run multiple complete cycles — delegates to adminCycleService.
 */
router.post('/cycles/bulk', authenticateToken, requireAdmin, validateRequest({ body: bulkCyclesBodySchema }), async (req: Request, res: Response) => {
  try {
    const result = await executeBulkCycles(req.body);

    res.json(result);
  } catch (error) {
    logger.error('[Admin] Bulk cycles error:', error);
    res.status(500).json({
      error: 'Failed to run bulk cycles',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/snapshots/backfill
 * Backfill cycle snapshots for cycles that don't have them — delegates to adminCycleService.
 */
router.post('/snapshots/backfill', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    const result = await backfillCycleSnapshots();
    if (result.totalCycles === 0) {
      return res.json({
        success: true,
        message: 'No cycles to backfill',
        snapshotsCreated: 0,
      });
    }
    res.json(result);
  } catch (error) {
    logger.error('[Admin] Backfill snapshots error:', error);
    res.status(500).json({
      error: 'Failed to backfill snapshots',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/stats
 * Get system statistics
 */
router.get('/stats', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    const stats = await getSystemStats();
    res.json(stats);
  } catch (error) {
    logger.error('[Admin] Stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve stats',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/users/at-risk
 * Get list of users at risk of bankruptcy with financial history
 */
router.get('/users/at-risk', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    const result = await getAtRiskUsers(BANKRUPTCY_RISK_THRESHOLD);
    res.json(result);
  } catch (error) {
    logger.error('[Admin] At-risk users error:', error);
    res.status(500).json({
      error: 'Failed to retrieve at-risk users',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});



/**
 * GET /api/admin/battles
 * Get paginated list of battles with filtering and search.
 * Supports battleType: 'all' | 'league' | 'tournament' | 'tagteam'
 * Returns battleFormat ('1v1' | '2v2') on each record.
 */
router.get('/battles', authenticateToken, requireAdmin, validateRequest({ query: battlesQuerySchema }), async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string;
    const leagueType = req.query.leagueType as string;
    const battleType = req.query.battleType as string;

    const result = await getAdminBattleList({ page, limit, search, leagueType, battleType });
    res.json(result);
  } catch (error) {
    logger.error('[Admin] Battles list error:', error);
    res.status(500).json({
      error: 'Failed to retrieve battles',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/battles/:id
 * Get detailed battle information including full combat log.
 * Detects tag team battles via TagTeamMatch and returns team data when present.
 */
router.get('/battles/:id', authenticateToken, requireAdmin, validateRequest({ params: battleIdParamsSchema }), async (req: Request, res: Response) => {
  try {
    const battleId = parseInt(String(req.params.id));

    if (isNaN(battleId)) {
      throw new AppError('INVALID_BATTLE_ID', 'Invalid battle ID', 400);
    }

    const result = await getAdminBattleDetail(battleId);
    res.json(result);
  } catch (error) {
    logger.error('[Admin] Battle detail error:', error);
    res.status(500).json({
      error: 'Failed to retrieve battle details',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/stats/robots
 * Get comprehensive statistics about robot attributes for debugging and outlier detection
 * 
 * Security Note: This endpoint is protected by authentication and admin-role authorization.
 * Rate limiting not implemented as admin endpoints are used for debugging/analysis only.
 * Future: Consider adding rate limiting for production deployments.
 */
router.get('/stats/robots', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    const result = await getRobotAttributeStats();
    res.json(result);
  } catch (error) {
    logger.error('[Admin] Robot stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve robot statistics',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/tag-teams/matchmaking
 * Manually trigger tag team matchmaking
 */
router.post('/tag-teams/matchmaking', authenticateToken, requireAdmin, validateRequest({ body: scheduledForBodySchema }), async (req: Request, res: Response) => {
  try {
    const { scheduledFor } = req.body;
    const targetTime = scheduledFor ? new Date(scheduledFor) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    logger.info('[Admin] Triggering tag team matchmaking...');
    const totalMatches = await runTagTeamMatchmaking(targetTime);

    res.json({
      success: true,
      matchesCreated: totalMatches,
      scheduledFor: targetTime.toISOString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Tag team matchmaking error:', error);
    res.status(500).json({
      error: 'Failed to run tag team matchmaking',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/tag-teams/battles
 * Manually execute scheduled tag team battles
 */
router.post('/tag-teams/battles', authenticateToken, requireAdmin, validateRequest({ body: scheduledForBodySchema }), async (req: Request, res: Response) => {
  try {
    const { scheduledFor } = req.body;
    const targetTime = scheduledFor ? new Date(scheduledFor) : undefined;

    logger.info('[Admin] Executing tag team battles...');
    const summary = await executeScheduledTagTeamBattles(targetTime);

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Tag team battle execution error:', error);
    res.status(500).json({
      error: 'Failed to execute tag team battles',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/admin/tag-teams/rebalance
 * Manually trigger tag team league rebalancing
 */
router.post('/tag-teams/rebalance', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  try {
    logger.info('[Admin] Triggering tag team league rebalancing...');
    const summary = await rebalanceTagTeamLeagues();

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] Tag team rebalancing error:', error);
    res.status(500).json({
      error: 'Failed to rebalance tag team leagues',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/users/recent
 * Get real (non-auto-generated) users registered in the last X cycles, with their robots and activity status.
 * Query params:
 *   - cycles: number of recent cycles to look back (default: 10)
 */
router.get('/users/recent', authenticateToken, requireAdmin, validateRequest({ query: recentUsersQuerySchema }), async (req: Request, res: Response) => {
  const cyclesBack = Math.min(Math.max(1, parseInt(req.query.cycles as string) || 10), 200);
  const result = await getRecentUserActivity(cyclesBack);
  res.json(result);
});

/**
 * GET /api/admin/audit-log/repairs
 * Get paginated repair audit log events with optional filtering by repairType and date range.
 * Returns events, summary stats, and pagination.
 */
router.get('/audit-log/repairs', authenticateToken, requireAdmin, validateRequest({ query: repairAuditQuerySchema }), async (req: Request, res: Response) => {
  const repairType = req.query.repairType as string | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 25), 100);

  // Validate repairType if provided
  if (repairType && repairType !== 'manual' && repairType !== 'automatic') {
    throw new AppError('INVALID_REPAIR_TYPE', "Invalid repairType. Must be 'manual' or 'automatic'", 400);
  }

  const result = await getRepairAuditLog({ repairType, startDate, endDate, page, limit });
  res.json(result);
});

/**
 * GET /api/admin/scheduler/status
 * Return the current state of the Cycle Scheduler
 */
router.get('/scheduler/status', authenticateToken, requireAdmin, validateRequest({}), (_req: Request, res: Response) => {
  const state = getSchedulerState();
  res.json(state);
});

/**
 * POST /api/admin/koth/trigger
 * Manually trigger a KotH cycle execution (admin-only)
 */
router.post('/koth/trigger', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  try {
    const { runJob } = await import('../services/cycle/cycleScheduler');
    const { executeScheduledKothBattles } = await import('../services/koth/kothBattleOrchestrator');
    const { runKothMatchmaking } = await import('../services/koth/kothMatchmakingService');

    logger.info('[Admin] Manually triggering KotH cycle...');

    await runJob('koth', async () => {
      const battleSummary = await executeScheduledKothBattles(new Date());
      const scheduledFor = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h ahead
      const matchesCreated = await runKothMatchmaking(scheduledFor);

      return {
        jobName: 'koth' as const,
        matchesCompleted: battleSummary.successfulMatches,
        matchesScheduled: matchesCreated,
      };
    });

    res.json({
      success: true,
      message: 'KotH cycle triggered successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Admin] KotH trigger error:', error);
    res.status(500).json({
      error: 'Failed to trigger KotH cycle',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/admin/practice-arena/stats
 * Returns current in-memory practice arena metrics and historical daily stats.
 */
router.get('/practice-arena/stats', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  res.json({
    current: practiceArenaMetrics.getStats(),
    history: await practiceArenaMetrics.getHistory(),
  });
});

/**
 * GET /api/admin/security/events
 * Query recent security events with optional filters.
 * Query params: severity, eventType, userId, since (ISO date), limit (default 50, max 200)
 */
router.get('/security/events', authenticateToken, requireAdmin, validateRequest({ query: securityEventsQuerySchema }), async (req: Request, res: Response) => {
  const events = securityMonitor.getRecentEvents({
    severity: req.query.severity as SecuritySeverity | undefined,
    eventType: req.query.eventType as string | undefined,
    userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
    since: req.query.since ? new Date(req.query.since as string) : undefined,
    limit: Math.min(parseInt(req.query.limit as string) || 50, 200),
  });
  res.json({ events, total: events.length });
});

/**
 * GET /api/admin/security/summary
 * Get a high-level overview: event counts by severity, active alerts, flagged users.
 */
router.get('/security/summary', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  const summary = securityMonitor.getSummary();
  res.json(summary);
});

/**
 * GET /api/admin/users/search
 * Search for users by username, email, or user ID.
 * Returns at most 10 results with only safe fields.
 */
router.get('/users/search', authenticateToken, requireAdmin, validateRequest({ query: userSearchQuerySchema }), async (req: Request, res: Response) => {
  const q = (req.query.q as string).trim();

  const safeSelect = { id: true, username: true, email: true, stableName: true } as const;

  // Search by exact user ID if query is numeric
  const idResults = /^\d+$/.test(q)
    ? await prisma.user.findMany({
        where: { id: Number(q) },
        select: safeSelect,
        take: 10,
      })
    : [];

  // Search by username (partial, case-insensitive)
  const usernameResults = await prisma.user.findMany({
    where: { username: { contains: q, mode: 'insensitive' } },
    select: safeSelect,
    take: 10,
  });

  // Search by email (partial, case-insensitive)
  const emailResults = await prisma.user.findMany({
    where: { email: { contains: q, mode: 'insensitive' } },
    select: safeSelect,
    take: 10,
  });

  // Deduplicate by user ID and limit to 10
  const seen = new Set<number>();
  const users: typeof idResults = [];
  for (const user of [...idResults, ...usernameResults, ...emailResults]) {
    if (!seen.has(user.id)) {
      seen.add(user.id);
      users.push(user);
      if (users.length >= 10) break;
    }
  }

  res.json({ users });
});

/**
 * Strict rate limiter for admin password reset.
 * 10 requests per 15-minute window per authenticated admin user.
 */
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `admin-reset:${authReq.user?.userId?.toString() || req.ip || 'unknown'}`;
  },
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    if (authReq.user?.userId) {
      securityMonitor.trackRateLimitViolation(authReq.user.userId, req.originalUrl);
    }
    res.status(429).json({
      error: 'Too many password reset attempts. Try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 900,
    });
  },
});

/**
 * POST /api/admin/users/:id/reset-password
 * Reset a user's password. Admin-only, rate-limited, fully audited.
 * The PasswordResetService handles hashing, session invalidation, and audit logging atomically.
 */
router.post('/users/:id/reset-password', authenticateToken, requireAdmin, resetPasswordLimiter, validateRequest({ params: resetPasswordParamsSchema, body: resetPasswordBodySchema }), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const targetUserId = Number(req.params.id);
  const { password } = req.body;
  const initiatorId = authReq.user!.userId;

  // Validate password strength before delegating to service
  const validation = validatePassword(password);
  if (!validation.valid) {
    logger.warn('[Admin] Password reset validation failure', { initiatorId, targetUserId });
    securityMonitor.logValidationFailure(req.originalUrl, 'weak_password', req.ip || 'unknown');
    res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' });
    return;
  }

  const result = await resetPassword(targetUserId, password, {
    initiatorId,
    resetType: 'admin',
  });

  logger.info('[Admin] Password reset successful', { initiatorId, targetUserId: result.userId });

  res.json({ success: true, userId: result.userId, username: result.username });
});

export default router;
