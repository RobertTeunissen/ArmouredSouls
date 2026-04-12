/**
 * Upload Rate Limiter
 *
 * Per-user rate limit for image upload preview requests.
 * 5 uploads per 10-minute window, keyed by authenticated userId.
 * Runs after authenticateToken so req.user is available.
 *
 * @module services/moderation/uploadRateLimiter
 */

import rateLimit from 'express-rate-limit';
import { AuthRequest } from '../../middleware/auth';
import { securityMonitor } from '../security/securityMonitor';

export const uploadRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    return `upload:${authReq.user?.userId?.toString() || req.ip || 'unknown'}`;
  },
  handler: (req, res) => {
    const authReq = req as AuthRequest;
    if (authReq.user?.userId) {
      securityMonitor.trackRateLimitViolation(authReq.user.userId, req.originalUrl);
    }
    res.status(429).json({
      error: 'Too many uploads',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 600,
    });
  },
});
