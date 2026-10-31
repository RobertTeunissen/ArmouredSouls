/**
 * Admin Users & Security Routes
 *
 * User management, search, password reset, security events, uploads and audit
 * log endpoints. Battle inspection lives in `adminBattles.ts`.
 * Mounted at /api/admin/ from the main admin router.
 */

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import logger from '../config/logger';
import { AppError } from '../errors';
import { securityMonitor } from '../services/security/securityMonitor';
import { SecuritySeverity } from '../services/security/securityLogger';
import { resetPassword } from '../services/auth/passwordResetService';
import { validatePassword } from '../utils/validation';
import { getRepairAuditLog } from '../services/admin/adminStatsService';
import { assertHumanStable, getPlayerDetail, getPlayersOverview, searchStables } from '../services/admin/adminPlayersService';
import { recordAction as recordAuditAction, getEntries as getAuditEntries } from '../services/admin/adminAuditLogService';
import { handleAdminUploads, handleAdminCleanup } from '../services/moderation/adminUploadsHandler';

const router = express.Router();

// --- Zod schemas ---

const repairAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  // The message is user-facing: `validateRequest` builds the response's `error` from
  // the failing issues, and this schema rejects before the handler's own check below,
  // so Zod's default ('Invalid option: expected one of "manual"|"automatic"') is what
  // an operator would otherwise read.
  repairType: z
    .enum(['manual', 'automatic'], { message: "repairType must be 'manual' or 'automatic'" })
    .optional(),
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
 * GET /api/admin/players
 * Every human stable with its activity segment (Active / Inactive / Dormant)
 * and issues, plus the segment counts (Players page).
 */
router.get('/players', authenticateToken, requireAdmin, validateRequest({}), async (_req: Request, res: Response) => {
  res.json(await getPlayersOverview());
});

/**
 * GET /api/admin/users/search
 * Find any stable (player, Automaton or generated) by #id, username, email,
 * stable name or robot name. At most 10 results with safe fields only.
 */
router.get('/users/search', authenticateToken, requireAdmin, validateRequest({ query: userSearchQuerySchema }), async (req: Request, res: Response) => {
  res.json({ users: await searchStables(req.query.q as string) });
});

/**
 * GET /api/admin/users/:id
 * Everything the stable detail panel shows, for any stable type.
 */
router.get('/users/:id', authenticateToken, requireAdmin, validateRequest({ params: resetPasswordParamsSchema }), async (req: Request, res: Response) => {
  res.json(await getPlayerDetail(Number(req.params.id)));
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

  // Automatons and generated stables never log in.
  await assertHumanStable(targetUserId);

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
