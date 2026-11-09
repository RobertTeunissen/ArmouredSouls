/**
 * Admin Users & Security Routes
 *
 * User management, search, password reset and the Admin actions list. Security
 * and image moderation live in `adminModeration.ts`. Battle inspection lives in `adminBattles.ts`.
 * Mounted at /api/admin/ from the main admin router.
 */

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest, validated } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import logger from '../config/logger';
import { securityMonitor } from '../services/security/securityMonitor';
import { resetPassword } from '../services/auth/passwordResetService';
import { validatePassword } from '../utils/validation';
import { assertHumanStable, getPlayerDetail, getPlayersOverview, searchStables } from '../services/admin/adminPlayersService';
import { recordAction as recordAuditAction } from '../services/admin/adminAuditLogService';
import { ADMIN_ACTION_AREAS, ADMIN_ACTION_RESULTS, getAdminActions } from '../services/admin/admin-actions';

const router = express.Router();

// --- Zod schemas ---

const userSearchQuerySchema = z.object({
  q: z.string().min(1).max(50),
});

const resetPasswordParamsSchema = z.object({
  id: positiveIntParam,
});

const resetPasswordBodySchema = z.object({
  password: z.string(),
});

const adminActionsQuerySchema = z.object({
  area: z.enum(ADMIN_ACTION_AREAS).optional(),
  result: z.enum(ADMIN_ACTION_RESULTS).optional().default('all'),
  page: z.coerce.number().int().positive().max(10_000).optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(50),
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
router.get('/users/search', authenticateToken, requireAdmin, ...validated({ query: userSearchQuerySchema }, async (req: Request, res: Response, { query }) => {
  res.json({ users: await searchStables(query.q as string) });
}));

/**
 * GET /api/admin/users/:id
 * Everything the stable detail panel shows, for any stable type.
 */
router.get('/users/:id', authenticateToken, requireAdmin, ...validated({ params: resetPasswordParamsSchema }, async (req: Request, res: Response, { params }) => {
  res.json(await getPlayerDetail(params.id));
}));

/**
 * POST /api/admin/users/:id/reset-password
 * Reset a user's password. Admin-only, rate-limited, fully audited.
 * The PasswordResetService handles hashing, session invalidation, and audit logging atomically.
 */
router.post('/users/:id/reset-password', authenticateToken, requireAdmin, resetPasswordLimiter, ...validated({ params: resetPasswordParamsSchema, body: resetPasswordBodySchema }, async (req: Request, res: Response, { params, body }) => {
  const authReq = req as AuthRequest;
  const targetUserId = params.id;
  const { password } = body;
  const initiatorId = authReq.user!.userId;

  // Automatons and generated stables never log in.
  await assertHumanStable(targetUserId);

  // Validate password strength before delegating to service
  const validation = validatePassword(password);
  if (!validation.valid) {
    logger.warn('[Admin] Password reset validation failure', { initiatorId, targetUserId });
    securityMonitor.logValidationFailure(req.originalUrl, 'weak_password', req.ip || 'unknown', true);
    res.status(400).json({ error: validation.error, code: 'VALIDATION_ERROR' });
    return;
  }

  const result = await resetPassword(targetUserId, password, {
    initiatorId,
    resetType: 'admin',
  });

  logger.info('[Admin] Password reset successful', { initiatorId, targetUserId: result.userId });
  // Who and which stable, never the password.
  recordAuditAction(initiatorId, 'password_reset', 'success', {
    targetUserId: result.userId,
    username: result.username,
    stableName: result.stableName,
  });

  res.json({ success: true, userId: result.userId, username: result.username });
}));

/**
 * GET /api/admin/actions
 * The Admin actions page: recorded admin actions newest first, filterable by
 * area (`area`) and result (`result=failure`), with plain descriptions, the
 * admin's name and counts per area. Replaced GET/POST /audit-log and
 * GET /audit-log/repairs (repairs are on the Economy page).
 */
router.get('/actions', authenticateToken, requireAdmin, ...validated({ query: adminActionsQuerySchema }, async (req: Request, res: Response, { query }) => {
  res.json(await getAdminActions(query));
}));

export default router;
