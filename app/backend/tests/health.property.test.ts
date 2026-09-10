import { Server } from 'node:http';
import * as fc from 'fast-check';
import express, { Express, Request, Response } from 'express';
import request from 'supertest';

const NUM_RUNS = 10;

interface HealthAppOptions {
  prismaQueryFn: () => Promise<unknown>;
  environment: string;
}

/**
 * Creates a minimal Express app that mimics the health endpoint behavior.
 * The mutable options object lets the property tests vary dependencies while
 * reusing one listening server for the lifetime of this test file.
 */
function createHealthApp(options: HealthAppOptions): Express {
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
    } catch {
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
  const options: HealthAppOptions = {
    prismaQueryFn: async () => [{ '?column?': 1 }],
    environment: 'test',
  };
  const app = createHealthApp(options);
  let server: Server;

  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

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
          options.prismaQueryFn = async () => [{ '?column?': 1 }];
          options.environment = environment;

          const res = await request(server).get('/api/health');

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
          options.prismaQueryFn = async () => { throw dbError; };
          options.environment = environment;

          const res = await request(server).get('/api/health');

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
          options.prismaQueryFn = dbConnected
            ? async () => [{ '?column?': 1 }]
            : async () => { throw new Error('DB down'); };
          options.environment = 'test';

          const res = await request(server).get('/api/health');

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
          options.prismaQueryFn = dbConnected
            ? async () => [{ '?column?': 1 }]
            : async () => { throw new Error('unreachable'); };
          options.environment = 'production';

          const res = await request(server).get('/api/health');

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
