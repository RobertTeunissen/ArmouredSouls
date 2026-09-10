import { createServer, type Server } from 'node:http';
import express from 'express';
import request from 'supertest';
import { _resetConfigForTesting } from '../../config/env';
import type { AuthRequest } from '../auth';
import { createUserEconomicLimiter } from '../userRateLimiter';

const mockTrackRateLimitViolation = jest.fn();

jest.mock('../../services/security/securityMonitor', () => ({
  securityMonitor: {
    trackRateLimitViolation: (...args: unknown[]) => mockTrackRateLimitViolation(...args),
  },
}));

const originalEconomicLimit = process.env.USER_ECONOMIC_RATE_LIMIT_MAX;

async function startTestServer(maxRequests?: number): Promise<Server> {
  const app = express();
  app.use((req, _res, next) => {
    const userId = Number(req.header('x-user-id'));
    (req as AuthRequest).user = {
      userId,
      username: `user-${userId}`,
      role: 'player',
    };
    next();
  });
  app.use(
    maxRequests === undefined
      ? createUserEconomicLimiter()
      : createUserEconomicLimiter({ userEconomicRateLimitMax: maxRequests }),
  );
  app.get('/economic', (_req, res) => res.status(200).json({ ok: true }));

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

async function stopTestServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

describe('createUserEconomicLimiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.USER_ECONOMIC_RATE_LIMIT_MAX;
    _resetConfigForTesting();
  });

  afterAll(() => {
    if (originalEconomicLimit === undefined) {
      delete process.env.USER_ECONOMIC_RATE_LIMIT_MAX;
    } else {
      process.env.USER_ECONOMIC_RATE_LIMIT_MAX = originalEconomicLimit;
    }
    _resetConfigForTesting();
  });

  it('should reject the 101st request with the production-safe default', async () => {
    const server = await startTestServer();
    try {
      for (let requestNumber = 1; requestNumber <= 100; requestNumber += 1) {
        const response = await request(server).get('/economic').set('x-user-id', '1');
        expect(response.status).toBe(200);
      }

      const limited = await request(server).get('/economic').set('x-user-id', '1');
      expect(limited.status).toBe(429);
      expect(limited.body).toEqual({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60,
      });
      expect(mockTrackRateLimitViolation).toHaveBeenCalledWith(1, '/economic');
    } finally {
      await stopTestServer(server);
    }
  });

  it('should allow requests beyond 100 up to the configured maximum', async () => {
    const server = await startTestServer(101);
    try {
      for (let requestNumber = 1; requestNumber <= 101; requestNumber += 1) {
        const response = await request(server).get('/economic').set('x-user-id', '1');
        expect(response.status).toBe(200);
      }

      const limited = await request(server).get('/economic').set('x-user-id', '1');
      expect(limited.status).toBe(429);
    } finally {
      await stopTestServer(server);
    }
  });

  it('should isolate request budgets by authenticated user', async () => {
    const server = await startTestServer(1);
    try {
      const firstUserInitial = await request(server).get('/economic').set('x-user-id', '1');
      const firstUserLimited = await request(server).get('/economic').set('x-user-id', '1');
      const secondUserInitial = await request(server).get('/economic').set('x-user-id', '2');

      expect(firstUserInitial.status).toBe(200);
      expect(firstUserLimited.status).toBe(429);
      expect(secondUserInitial.status).toBe(200);
    } finally {
      await stopTestServer(server);
    }
  });
});
