/**
 * @module middleware/rateLimiter
 *
 * Express rate-limiting middleware instances used to protect API endpoints
 * from abuse. Two limiters are exported:
 *
 * - {@link generalLimiter} — broad limit for general API routes
 * - {@link authLimiter} — stricter limit for authentication endpoints
 *   (login and registration)
 */
import rateLimit from 'express-rate-limit';

/**
 * General-purpose rate limiter for non-authentication API routes.
 *
 * **Configuration:**
 * - Window: 60 seconds
 * - Max requests per window: 100
 * - Key: client IP address (falls back to `x-forwarded-for` header, then `'unknown'`)
 * - Standard `RateLimit-*` headers are included in responses
 *
 * @example
 * import { generalLimiter } from '../middleware/rateLimiter';
 * app.use('/api', generalLimiter);
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1-minute sliding window
  max: 100, // generous limit for normal API usage
  standardHeaders: true, // sends RateLimit-* headers so clients can self-throttle
  legacyHeaders: false,
  validate: false,
  // Use IP-based keying; x-forwarded-for fallback handles reverse-proxy setups
  keyGenerator: (req) =>
    req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
});

/**
 * Authentication rate limiter for login and registration endpoints.
 *
 * Applies a stricter limit than {@link generalLimiter} to protect against
 * brute-force and credential-stuffing attacks. The same limiter instance is
 * shared between the login and registration routes (Requirement 7.1, 7.3).
 *
 * **Configuration:**
 * - Window: 60 seconds
 * - Max requests per window: 10
 * - Key: client IP address (falls back to `x-forwarded-for` header, then `'unknown'`)
 * - Standard `RateLimit-*` headers are included in responses
 * - Returns `429 Too Many Requests` when the limit is exceeded
 *
 * @example
 * import { authLimiter } from '../middleware/rateLimiter';
 * router.post('/login', authLimiter, loginHandler);
 * router.post('/register', authLimiter, registerHandler);
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1-minute sliding window
  max: 10, // stricter than generalLimiter to slow brute-force / credential-stuffing
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) =>
    req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
});
