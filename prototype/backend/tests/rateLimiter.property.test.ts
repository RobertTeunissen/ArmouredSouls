import * as fc from 'fast-check';
import express, { Request, Response } from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

const NUM_RUNS = 25;

/**
 * Helper to create a fresh Express app with a rate limiter for each test run.
 * We recreate the limiter each time to reset internal state (request counts).
 */
function createApp(options: { max: number; keyGenerator?: (req: Request) => string }) {
  const app = express();
  app.set('trust proxy', true);

  const limiterOptions: Parameters<typeof rateLimit>[0] = {
    windowMs: 60 * 1000,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
  };
  if (options.keyGenerator) {
    limiterOptions.keyGenerator = options.keyGenerator;
  }
  const limiter = rateLimit(limiterOptions);

  app.use('/api', limiter);
  app.get('/api/test', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  return app;
}

describe('Rate Limiter - Property Tests', () => {
  describe('Property 6: Rate limiting enforcement', () => {
    /**
     * **Validates: Requirements 20.1, 20.2, 20.3**
     * For any IP address, after making N requests within a 60-second window where N
     * exceeds the configured limit, the next request should receive a 429 status code
     * with a Retry-After header. Requests within the limit should pass through normally.
     */

    test('requests within the limit return 200', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          async (limit) => {
            const app = createApp({ max: limit });

            // Make exactly `limit` requests — all should succeed
            for (let i = 0; i < limit; i++) {
              const res = await request(app).get('/api/test').set('X-Forwarded-For', '127.0.0.1');
              expect(res.status).toBe(200);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('request exceeding the limit returns 429 with Retry-After header', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          async (limit) => {
            const app = createApp({ max: limit });

            // Exhaust the limit
            for (let i = 0; i < limit; i++) {
              await request(app).get('/api/test').set('X-Forwarded-For', '127.0.0.1');
            }

            // The next request should be rate limited
            const res = await request(app).get('/api/test').set('X-Forwarded-For', '127.0.0.1');
            expect(res.status).toBe(429);
            expect(res.headers['retry-after']).toBeDefined();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('multiple requests beyond the limit all return 429', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 5 }),
          async (limit, extraRequests) => {
            const app = createApp({ max: limit });

            // Exhaust the limit
            for (let i = 0; i < limit; i++) {
              await request(app).get('/api/test').set('X-Forwarded-For', '127.0.0.1');
            }

            // All subsequent requests should be 429
            for (let i = 0; i < extraRequests; i++) {
              const res = await request(app).get('/api/test').set('X-Forwarded-For', '127.0.0.1');
              expect(res.status).toBe(429);
              expect(res.headers['retry-after']).toBeDefined();
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 7: Rate limiter uses forwarded IP', () => {
    /**
     * **Validates: Requirements 20.5**
     * For any request containing an X-Forwarded-For header, the rate limiter should
     * use the forwarded IP address (not the direct connection IP) as the rate limiting key.
     */

    test('different X-Forwarded-For IPs have independent rate limits', async () => {
      // Generator for valid IPv4 addresses
      const ipGen = fc
        .tuple(
          fc.integer({ min: 1, max: 254 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 })
        )
        .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

      await fc.assert(
        fc.asyncProperty(
          fc.tuple(ipGen, ipGen).filter(([a, b]) => a !== b),
          async ([ip1, ip2]) => {
            const limit = 2;
            const app = createApp({ max: limit });

            // Exhaust the limit for ip1
            for (let i = 0; i < limit; i++) {
              await request(app)
                .get('/api/test')
                .set('X-Forwarded-For', ip1);
            }

            // ip1 should now be rate limited
            const res1 = await request(app)
              .get('/api/test')
              .set('X-Forwarded-For', ip1);
            expect(res1.status).toBe(429);

            // ip2 should still be allowed (independent counter)
            const res2 = await request(app)
              .get('/api/test')
              .set('X-Forwarded-For', ip2);
            expect(res2.status).toBe(200);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('X-Forwarded-For header determines the rate limiting key', async () => {
      const ipGen = fc
        .tuple(
          fc.integer({ min: 1, max: 254 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 254 })
        )
        .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

      await fc.assert(
        fc.asyncProperty(
          ipGen,
          fc.integer({ min: 1, max: 10 }),
          async (forwardedIp, limit) => {
            // Track which key the limiter actually uses
            let capturedKey: string | undefined;
            const app = createApp({
              max: limit,
              keyGenerator: (req: Request) => {
                const key = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
                capturedKey = key;
                return key;
              },
            });

            await request(app)
              .get('/api/test')
              .set('X-Forwarded-For', forwardedIp);

            // The captured key should be the forwarded IP
            expect(capturedKey).toBe(forwardedIp);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
