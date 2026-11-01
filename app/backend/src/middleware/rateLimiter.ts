/**
 * @module middleware/rateLimiter
 *
 * Express rate-limiting middleware factory. Creates three IP-keyed limiters:
 *
 * - {@link createGeneralLimiter} — broad limit for general API routes
 * - {@link createAuthLimiter} — stricter limit for registration
 * - {@link createLoginLimiter} — tightest limit, for login
 *
 * All read their configuration from EnvConfig so limits can be tuned per
 * environment. Every refusal is recorded as a `rate_limit` security signal
 * (by IP, before login) for the admin Security page.
 */
import rateLimit, { type Options } from 'express-rate-limit';
import type { Request, Response } from 'express';
import type { EnvConfig } from '../config/env';
import { securityMonitor } from '../services/security/securityMonitor';

function clientKey(req: Request): string {
  return req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
}

/** Default express-rate-limit response, plus the security signal. */
function recordAndRefuse(req: Request, res: Response, _next: unknown, options: Options): void {
  securityMonitor.trackAnonymousRateLimit(clientKey(req), req.originalUrl);
  res.status(options.statusCode).send(options.message);
}

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
    keyGenerator: clientKey,
    handler: recordAndRefuse,
  });
}

/**
 * Create the authentication rate limiter for registration endpoints.
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
    keyGenerator: clientKey,
    handler: recordAndRefuse,
  });
}

/**
 * Create the login rate limiter — tighter than the general auth limiter.
 *
 * 10 requests per 15-minute window by default (Req 3.1).
 */
export function createLoginLimiter(config: EnvConfig) {
  return rateLimit({
    windowMs: config.loginRateLimitWindowMs,
    max: config.loginRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    keyGenerator: clientKey,
    handler: recordAndRefuse,
  });
}
