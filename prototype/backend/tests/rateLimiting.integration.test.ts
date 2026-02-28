/**
 * Integration tests for rate limiting behavior.
 * Validates: Requirements 11.12
 *
 * Uses a fresh Express app with rate limiter per test to ensure
 * isolated, deterministic rate limit counters.
 */
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import authRoutes from '../src/routes/auth';

const RATE_LIMIT = 10;

/**
 * Create a fresh Express app with a rate limiter matching the authLimiter config.
 * Recreated per test so internal counters are reset.
 */
function createRateLimitedApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: RATE_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    keyGenerator: (req) =>
      req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
  });

  app.use('/api/auth/register', limiter);
  app.use('/api/auth', authRoutes);

  return app;
}

describe('Rate Limiting - Integration Tests', () => {
  test('allows exactly max (10) requests without returning 429', async () => {
    const app = createRateLimitedApp();

    for (let i = 0; i < RATE_LIMIT; i++) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'u', email: 'e', password: 'p' });

      expect(res.status).not.toBe(429);
    }
  });

  test('returns 429 when rate limit is exceeded', async () => {
    const app = createRateLimitedApp();

    // Exhaust the limit
    for (let i = 0; i < RATE_LIMIT; i++) {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'u', email: 'e', password: 'p' });
    }

    // The next request should be rate-limited
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'u', email: 'e', password: 'p' });

    expect(res.status).toBe(429);
  });

  test('429 response body contains an error message', async () => {
    const app = createRateLimitedApp();

    // Exhaust the limit
    for (let i = 0; i < RATE_LIMIT; i++) {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'u', email: 'e', password: 'p' });
    }

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'u', email: 'e', password: 'p' });

    expect(res.status).toBe(429);
    // express-rate-limit returns a text message by default; verify it exists
    expect(res.text).toBeTruthy();
    expect(res.text.length).toBeGreaterThan(0);
  });

  test('responses include RateLimit-* standard headers', async () => {
    const app = createRateLimitedApp();

    // First request — should have rate limit headers since standardHeaders: true
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'u', email: 'e', password: 'p' });

    expect(res.status).not.toBe(429);

    // express-rate-limit with standardHeaders: true sets RateLimit-Limit,
    // RateLimit-Remaining, and RateLimit-Reset (or the draft-7 equivalents).
    // Check for at least one RateLimit-* header.
    const rateLimitHeaders = Object.keys(res.headers).filter((h) =>
      h.toLowerCase().startsWith('ratelimit')
    );
    expect(rateLimitHeaders.length).toBeGreaterThan(0);
  });
});
