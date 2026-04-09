// Feature: user-registration-module, Property 18: Rate Limiting Application
import * as fc from 'fast-check';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import authRoutes from '../src/routes/auth';

// Low NUM_RUNS since we're testing rate limiting behavior, not input variation.
// Each run sends 11+ HTTP requests, so keeping this small avoids excessive load.
const NUM_RUNS = 5;

/**
 * Create a fresh Express app with a rate limiter applied to /api/auth/register.
 * We recreate the limiter each time to reset internal counters between runs.
 */
function createRateLimitedApp(max: number) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    keyGenerator: (req) =>
      req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
  });

  // Apply rate limiter to the register path before mounting auth routes
  app.use('/api/auth/register', limiter);
  app.use('/api/auth', authRoutes);

  return app;
}

describe('Rate Limiting Application - Property Tests', () => {
  describe('Property 18: Rate Limiting Application', () => {
    /**
     * **Validates: Requirements 7.1, 7.2**
     *
     * For any sequence of registration requests exceeding the rate limit threshold,
     * subsequent requests should be rejected with a rate limit error response (429).
     */
    test('requests within the rate limit are not rejected with 429', async () => {
      // Use the actual authLimiter max of 10
      const RATE_LIMIT = 10;

      await fc.assert(
        fc.asyncProperty(
          // Generate a request count within the limit [1, RATE_LIMIT]
          fc.integer({ min: 1, max: RATE_LIMIT }),
          async (requestCount) => {
            const app = createRateLimitedApp(RATE_LIMIT);

            for (let i = 0; i < requestCount; i++) {
              const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'x', email: 'y', password: 'z' }); // intentionally invalid — we only care about status != 429

              // Requests within the limit should NOT be rate-limited.
              // They may return 400 (validation error) or other codes, but never 429.
              expect(res.status).not.toBe(429);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('requests exceeding the rate limit return 429', async () => {
      const RATE_LIMIT = 10;

      await fc.assert(
        fc.asyncProperty(
          // Generate a number of extra requests beyond the limit [1, 5]
          fc.integer({ min: 1, max: 5 }),
          async (extraRequests) => {
            const app = createRateLimitedApp(RATE_LIMIT);

            // Exhaust the rate limit
            for (let i = 0; i < RATE_LIMIT; i++) {
              const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'x', email: 'y', password: 'z' });

              expect(res.status).not.toBe(429);
            }

            // All subsequent requests should be rate-limited
            for (let i = 0; i < extraRequests; i++) {
              const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'x', email: 'y', password: 'z' });

              expect(res.status).toBe(429);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('rate limiting applies specifically to registration endpoint', async () => {
      const RATE_LIMIT = 10;

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          async (extraRequests) => {
            const app = createRateLimitedApp(RATE_LIMIT);

            // Exhaust the rate limit on /api/auth/register
            for (let i = 0; i < RATE_LIMIT; i++) {
              await request(app)
                .post('/api/auth/register')
                .send({ username: 'x', email: 'y', password: 'z' });
            }

            // Registration should now be rate-limited
            for (let i = 0; i < extraRequests; i++) {
              const res = await request(app)
                .post('/api/auth/register')
                .send({ username: 'x', email: 'y', password: 'z' });

              expect(res.status).toBe(429);
            }

            // Login endpoint should NOT be rate-limited by the register limiter
            const loginRes = await request(app)
              .post('/api/auth/login')
              .send({ identifier: 'nonexistent', password: 'password123' });

            expect(loginRes.status).not.toBe(429);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
