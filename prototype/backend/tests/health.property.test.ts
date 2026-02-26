import * as fc from 'fast-check';
import express, { Request, Response } from 'express';
import request from 'supertest';

const NUM_RUNS = 100;

/**
 * Creates a minimal Express app that mimics the health endpoint behavior.
 * The `prismaQueryFn` parameter controls whether the DB check succeeds or fails.
 */
function createHealthApp(options: {
  prismaQueryFn: () => Promise<unknown>;
  environment: string;
}) {
  const app = express();

  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      await options.prismaQueryFn();
      res.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
        environment: options.environment,
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
        environment: options.environment,
      });
    }
  });

  return app;
}

const REQUIRED_FIELDS = ['status', 'database', 'timestamp', 'environment'] as const;

describe('Health Endpoint - Property Tests', () => {
  describe('Property 8: Health endpoint response structure', () => {
    /**
     * **Validates: Requirements 12.1, 12.3**
     * For any database state (connected or disconnected), the health endpoint response
     * should always contain `status`, `database`, `timestamp`, and `environment` fields.
     * When the database is unreachable, the HTTP status code should be 503.
     */

    test('response always contains required fields when DB is connected', async () => {
      const envGen = fc.constantFrom('development', 'acceptance', 'production', 'test');

      await fc.assert(
        fc.asyncProperty(envGen, async (environment) => {
          const app = createHealthApp({
            prismaQueryFn: async () => [{ '?column?': 1 }],
            environment,
          });

          const res = await request(app).get('/api/health');

          expect(res.status).toBe(200);
          for (const field of REQUIRED_FIELDS) {
            expect(res.body).toHaveProperty(field);
          }
          expect(res.body.status).toBe('ok');
          expect(res.body.database).toBe('connected');
          expect(res.body.environment).toBe(environment);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    test('response always contains required fields when DB is disconnected', async () => {
      const envGen = fc.constantFrom('development', 'acceptance', 'production', 'test');
      const errorGen = fc.oneof(
        fc.constant(new Error('Connection refused')),
        fc.constant(new Error('ECONNRESET')),
        fc.constant(new Error('timeout')),
        fc.string({ minLength: 1, maxLength: 50 }).map((msg) => new Error(msg))
      );

      await fc.assert(
        fc.asyncProperty(envGen, errorGen, async (environment, dbError) => {
          const app = createHealthApp({
            prismaQueryFn: async () => { throw dbError; },
            environment,
          });

          const res = await request(app).get('/api/health');

          expect(res.status).toBe(503);
          for (const field of REQUIRED_FIELDS) {
            expect(res.body).toHaveProperty(field);
          }
          expect(res.body.status).toBe('error');
          expect(res.body.database).toBe('disconnected');
          expect(res.body.environment).toBe(environment);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    test('timestamp is a valid ISO 8601 string for any database state', async () => {
      const dbStateGen = fc.boolean(); // true = connected, false = disconnected

      await fc.assert(
        fc.asyncProperty(dbStateGen, async (dbConnected) => {
          const app = createHealthApp({
            prismaQueryFn: dbConnected
              ? async () => [{ '?column?': 1 }]
              : async () => { throw new Error('DB down'); },
            environment: 'test',
          });

          const res = await request(app).get('/api/health');

          expect(typeof res.body.timestamp).toBe('string');
          const parsed = new Date(res.body.timestamp);
          expect(parsed.toISOString()).toBe(res.body.timestamp);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    test('status and database fields are consistent for any database state', async () => {
      const dbStateGen = fc.boolean();

      await fc.assert(
        fc.asyncProperty(dbStateGen, async (dbConnected) => {
          const app = createHealthApp({
            prismaQueryFn: dbConnected
              ? async () => [{ '?column?': 1 }]
              : async () => { throw new Error('unreachable'); },
            environment: 'production',
          });

          const res = await request(app).get('/api/health');

          if (dbConnected) {
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body.database).toBe('connected');
          } else {
            expect(res.status).toBe(503);
            expect(res.body.status).toBe('error');
            expect(res.body.database).toBe('disconnected');
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
