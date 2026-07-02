/**
 * Admin Users & Security Routes
 *
 * User management, search, password reset, security events, uploads, audit log,
 * and battle inspection endpoints.
 * Mounted at /api/admin/ from the main admin router.
 */

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam, paginationQuery } from '../utils/securityValidation';
import logger from '../config/logger';
import { AppError } from '../errors';
import { securityMonitor } from '../services/security/securityMonitor';
import { SecuritySeverity } from '../services/security/securityLogger';
import { resetPassword } from '../services/auth/passwordResetService';
import { validatePassword } from '../utils/validation';
import {
  getAtRiskUsers,
  getRecentUserActivity,
  getRepairAuditLog,
} from '../services/admin/adminStatsService';
import {
  getAdminBattleList,
  getAdminBattleDetail,
} from '../services/admin/adminBattleService';
import { recordAction as recordAuditAction, getEntries as getAuditEntries } from '../services/admin/adminAuditLogService';
import { handleAdminUploads, handleAdminCleanup } from '../services/moderation/adminUploadsHandler';
import prisma from '../lib/prisma';

const router = express.Router();

// --- Configuration constants ---

const BANKRUPTCY_RISK_THRESHOLD = 10000; // Credits below which a user is considered at risk

// --- Zod schemas ---

const battleIdParamsSchema = z.object({
  id: positiveIntParam,
});

const battlesQuerySchema = paginationQuery.extend({
  leagueType: z.string().optional(),
  battleType: z.string().optional(),
});

const recentUsersQuerySchema = z.object({
  cycles: z.coerce.number().int().positive().max(200).optional().default(10),
  filter: z.enum(['all', 'real', 'auto']).optional().default('real'),
});

const repairAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  repairType: z.enum(['manual', 'automatic']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  stableName: z.string().max(100).optional(),
  robotName: z.string().max(100).optional(),
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

const adminUploadsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
  userId: z.coerce.number().int().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
  operationType: z.string().max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const auditLogBodySchema = z.object({
  operationType: z.string().min(1).max(100),
  operationResult: z.enum(['success', 'failure']),
  resultSummary: z.record(z.string(), z.unknown()),
});

// --- Rate limiter ---

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

// --- Routes ---

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
    });
  }
});

/**
 * GET /api/admin/users/recent
 * Get users registered in the last X cycles, with their robots and activity status.
 * Query params:
 *   - cycles: number of recent cycles to look back (default: 10)
 *   - filter: 'real' | 'auto' | 'all' (default: 'real')
 */
router.get('/users/recent', authenticateToken, requireAdmin, validateRequest({ query: recentUsersQuerySchema }), async (req: Request, res: Response) => {
  const cyclesBack = Math.min(Math.max(1, parseInt(req.query.cycles as string) || 10), 200);
  const filter = (req.query.filter as string) || 'real';
  const result = await getRecentUserActivity(cyclesBack, filter);
  res.json(result);
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

  // Search by stable name (partial, case-insensitive)
  const stableNameResults = await prisma.user.findMany({
    where: { stableName: { contains: q, mode: 'insensitive' } },
    select: safeSelect,
    take: 10,
  });

  // Search by robot name (partial, case-insensitive) — return the owning user
  const robotResults = await prisma.robot.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    select: { user: { select: safeSelect } },
    take: 10,
  });

  // Deduplicate by user ID and limit to 10
  const seen = new Set<number>();
  const users: typeof idResults = [];
  for (const user of [...idResults, ...usernameResults, ...emailResults, ...stableNameResults, ...robotResults.map(r => r.user)]) {
    if (!seen.has(user.id)) {
      seen.add(user.id);
      users.push(user);
      if (users.length >= 10) break;
    }
  }

  res.json({ users });
});

/**
 * GET /api/admin/users/:id
 * Get detailed user info for the admin player detail panel.
 */
router.get('/users/:id', authenticateToken, requireAdmin, validateRequest({ params: resetPasswordParamsSchema }), async (req: Request, res: Response) => {
  const userId = Number(req.params.id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      stableName: true,
      currency: true,
      role: true,
      createdAt: true,
      hasCompletedOnboarding: true,
      onboardingStep: true,
      robots: {
        where: {},
        select: {
          id: true,
          name: true,
          elo: true,
          wins: true,
          losses: true,
          draws: true,
          mainWeapon: { select: { weapon: { select: { name: true } } } },
        },
      },
      facilities: {
        where: { level: { gt: 0 } },
        select: {
          facilityType: true,
          level: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'User not found', 404);
  }

  // Enrich robots with league tier from standings table (source of truth since Spec #40)
  const robotIds = user.robots.map(r => r.id);
  const standings = await prisma.standing.findMany({
    where: { entityType: 'robot', entityId: { in: robotIds }, mode: 'league_1v1' },
    select: { entityId: true, tier: true },
  });
  const leagueMap = new Map(standings.map(s => [s.entityId, s.tier]));

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    stableName: user.stableName,
    currency: user.currency,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    onboarding: {
      completed: user.hasCompletedOnboarding,
      currentStep: user.onboardingStep,
    },
    robots: user.robots.map((r) => ({
      id: r.id,
      name: r.name,
      elo: r.elo,
      league: leagueMap.get(r.id) ?? 'bronze',
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      equippedWeapon: r.mainWeapon?.weapon?.name ?? null,
    })),
    facilities: user.facilities.map((f) => ({
      type: f.facilityType,
      level: f.level,
      passiveIncome: 0,
    })),
  });
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
 * GET /api/admin/uploads
 * Paginated list of uploaded images from AuditLog (image_upload_success events).
 * Query params: page, limit, userId, startDate, endDate
 */
router.get('/uploads', authenticateToken, requireAdmin, validateRequest({ query: adminUploadsQuerySchema }), handleAdminUploads);

/**
 * POST /api/admin/uploads/cleanup
 * Trigger on-demand orphan image cleanup.
 */
router.post('/uploads/cleanup', authenticateToken, requireAdmin, validateRequest({}), handleAdminCleanup);

/**
 * GET /api/admin/audit-log
 * Get paginated admin audit log entries.
 */
router.get('/audit-log', authenticateToken, requireAdmin, validateRequest({ query: auditLogQuerySchema }), async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);
  const operationType = req.query.operationType as string | undefined;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

  const result = await getAuditEntries({ page, pageSize, operationType, startDate, endDate });
  res.json(result);
});

/**
 * POST /api/admin/audit-log
 * Manually record an admin audit log entry.
 */
router.post('/audit-log', authenticateToken, requireAdmin, validateRequest({ body: auditLogBodySchema }), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { operationType, operationResult, resultSummary } = req.body;
  recordAuditAction(authReq.user!.userId, operationType, operationResult, resultSummary);
  res.json({ success: true });
});

/**
 * GET /api/admin/battles
 * Get paginated list of battles with filtering and search.
 * Supports battleType: 'all' | 'league' | 'tournament' | 'tagteam' | 'koth'
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
    });
  }
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
  const stableName = req.query.stableName as string | undefined;
  const robotName = req.query.robotName as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 25), 100);

  // Validate repairType if provided
  if (repairType && repairType !== 'manual' && repairType !== 'automatic') {
    throw new AppError('INVALID_REPAIR_TYPE', "Invalid repairType. Must be 'manual' or 'automatic'", 400);
  }

  const result = await getRepairAuditLog({ repairType, startDate, endDate, stableName, robotName, page, limit });
  res.json(result);
});

export default router;
