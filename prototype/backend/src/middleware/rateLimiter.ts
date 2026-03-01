/**
 * @module middleware/rateLimiter
 *
 * Express rate-limiting middleware factory. Creates two limiters:
 *
 * - {@link createGeneralLimiter} — broad limit for general API routes
 * - {@link createAuthLimiter} — stricter limit for authentication endpoints
 *
 * Both limiters read their configuration from EnvConfig so limits can be
 * tuned per environment via RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX_REQUESTS.
 */
import rateLimit from 'express-rate-limit';
import type { EnvConfig } from '../config/env';

/**
 * Create the general-purpose rate limiter for non-authentication API routes.
 *
 * Allows 10x the auth limit per window (e.g. 300 req/min with default config).
 */
export function createGeneralLimiter(config: EnvConfig) {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests * 10,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    keyGenerator: (req) =>
      req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
  });
}

/**
 * Create the authentication rate limiter for login and registration endpoints.
 *
 * Stricter than the general limiter to protect against brute-force and
 * credential-stuffing attacks.
 */
export function createAuthLimiter(config: EnvConfig) {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    keyGenerator: (req) =>
      req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
  });
}
