/**
 * Per-user rate limiter for economic endpoints.
 *
 * Uses the authenticated userId (not IP) as the rate-limit key so that
 * abuse from a single authenticated session is throttled regardless of
 * IP rotation. Falls back to IP when no user is attached (shouldn't
 * happen since this middleware runs after auth).
 *
 * @module middleware/userRateLimiter
 * @see Requirements 6.4, 6.6
 */
import rateLimit from 'express-rate-limit';
import { AuthRequest } from './auth';
import { securityMonitor } from '../services/security/securityMonitor';

/**
 * Create a per-user rate limiter for economic transaction endpoints.
 *
 * - 60 requests per 1-minute window per authenticated user
 * - On limit exceeded: tracks violation via securityMonitor and returns 429
 * - Includes standard `Retry-After` header via `standardHeaders: true`
 */
export function createUserEconomicLimiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    keyGenerator: (req) => {
      const authReq = req as AuthRequest;
      return authReq.user?.userId?.toString() || req.ip || 'unknown';
    },
    handler: (req, res) => {
      const authReq = req as AuthRequest;
      if (authReq.user?.userId) {
        securityMonitor.trackRateLimitViolation(authReq.user.userId, req.originalUrl);
      }
      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60,
      });
    },
  });
}
